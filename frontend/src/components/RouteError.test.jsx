import { render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, expect, it, vi } from 'vitest';
import { logger } from '@/utils/logger.js';
import RouteError from './RouteError.jsx';

afterEach(() => vi.restoreAllMocks());

function Broken() {
  throw new Error('render failed');
}

it('reports a render error and offers a reload', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {}); // React logs the thrown error too
  const logError = vi.spyOn(logger, 'error').mockImplementation(() => {});
  const router = createMemoryRouter([
    { path: '/', element: <Broken />, errorElement: <RouteError /> },
  ]);
  render(<RouterProvider router={router} />);

  expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
  expect(logError).toHaveBeenCalledWith('render failed', { error: expect.any(Error) });
});
