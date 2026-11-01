import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/setup.js';
import { flush, logger, resetLogger } from './logger.js';

/** Collect the bodies posted to /api/client-logs. */
function capturePosts() {
  const posts = [];
  server.use(
    http.post('/api/client-logs', async ({ request }) => {
      posts.push(await request.json());
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return posts;
}

afterEach(() => {
  resetLogger();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('logger in production', () => {
  beforeEach(() => vi.stubEnv('DEV', false));

  it('batches errors into one post with the page path, stack and request id', async () => {
    const posts = capturePosts();
    window.history.pushState({}, '', '/families?email=priya@example.com');
    logger.error('first', { error: new Error('boom'), requestId: 'req-1' });
    logger.error('second');
    flush();
    await vi.waitFor(() => expect(posts).toHaveLength(1));
    const [first, second] = posts[0].entries;
    expect(first).toMatchObject({ message: 'first', url: '/families', request_id: 'req-1' });
    expect(first.stack).toContain('boom');
    expect(second).toEqual({ message: 'second', stack: null, url: '/families', request_id: null });
  });

  it('does not post debug, info or warn', () => {
    const posts = capturePosts();
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    flush();
    expect(posts).toEqual([]);
  });

  it('clips long messages and stops after 50 errors per page', async () => {
    const posts = capturePosts();
    for (let i = 0; i < 60; i += 1) logger.error('x'.repeat(2000));
    flush();
    await vi.waitFor(() => expect(posts).toHaveLength(5));
    const entries = posts.flatMap((post) => post.entries);
    expect(entries).toHaveLength(50);
    expect(entries[0].message).toHaveLength(1000);
  });
});

describe('logger in development', () => {
  it('writes to the console and posts nothing', () => {
    const posts = capturePosts();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('dev only');
    flush();
    expect(consoleError).toHaveBeenCalledWith('dev only', '');
    expect(posts).toEqual([]);
  });
});
