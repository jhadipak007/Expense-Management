import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { setAccessToken } from '@/api/client.js';
import { handlers } from './handlers.js';

// jsdom lacks ResizeObserver; Radix radios and checkboxes inside a <form> use it.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom lacks matchMedia; the app layout listens for the 1024px breakpoint.
window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  setAccessToken(null);
});
afterAll(() => server.close());
