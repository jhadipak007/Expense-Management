import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { setAccessToken } from '../api/client.js';
import { handlers } from './handlers.js';

// jsdom lacks ResizeObserver; Radix radios and checkboxes inside a <form> use it.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  setAccessToken(null);
});
afterAll(() => server.close());
