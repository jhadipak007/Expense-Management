/**
 * App logger. In development every level goes to the console. In production only
 * errors are kept, batched and posted to /api/client-logs (same origin, so the CSP
 * allows it). Uses plain fetch, not the API client, so a failing post cannot log itself.
 */

const ENDPOINT = '/api/client-logs';
const FLUSH_MS = 1000;
const BATCH_SIZE = 10; // the endpoint's limit per request
const MAX_PER_PAGE = 50; // stops a render loop from posting forever
const LIMITS = { message: 1000, stack: 5000, url: 500, request_id: 64 };

let queue = [];
let sent = 0;
let timer = null;

const isDev = () => import.meta.env.DEV;

function clip(value, max) {
  return value == null ? null : String(value).slice(0, max);
}

function toEntry(message, { error, requestId } = {}) {
  return {
    message: clip(message, LIMITS.message) || 'Unknown error',
    stack: clip(error?.stack, LIMITS.stack),
    url: clip(window.location.pathname, LIMITS.url), // no query string: it may hold user input
    request_id: clip(requestId, LIMITS.request_id),
  };
}

/** Post the queued errors now, in batches the endpoint accepts. */
export function flush() {
  clearTimeout(timer);
  timer = null;
  while (queue.length) {
    const entries = queue.splice(0, BATCH_SIZE);
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
      keepalive: true, // still delivered if the page is closing
    }).catch(() => {});
  }
}

function report(message, details) {
  if (sent >= MAX_PER_PAGE) return;
  sent += 1;
  queue.push(toEntry(message, details));
  if (queue.length >= BATCH_SIZE) flush();
  else timer ??= setTimeout(flush, FLUSH_MS);
}

/** Reset queued state; for tests. */
export function resetLogger() {
  clearTimeout(timer);
  timer = null;
  queue = [];
  sent = 0;
}

export const logger = {
  debug: (...args) => isDev() && console.debug(...args),
  info: (...args) => isDev() && console.info(...args),
  warn: (...args) => isDev() && console.warn(...args),
  /** `details`: `{ error, requestId }`; `requestId` is the failing API response's X-Request-ID. */
  error(message, details) {
    if (isDev()) console.error(message, details ?? '');
    else report(message, details);
  },
};

/** Report uncaught errors and unhandled promise rejections. */
export function captureGlobalErrors() {
  window.addEventListener('error', (event) => logger.error(event.message, { error: event.error }));
  window.addEventListener('unhandledrejection', (event) => {
    const { reason } = event;
    logger.error(reason?.message ?? String(reason), { error: reason });
  });
  window.addEventListener('pagehide', flush);
}
