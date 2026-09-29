import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from '@/routes.jsx';

/** Render the whole app at `path` with an in-memory router. */
export function renderApp(path = '/', userEventOptions) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const user = userEvent.setup(userEventOptions);
  return { router, user, ...render(<RouterProvider router={router} />) };
}
