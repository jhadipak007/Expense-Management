import { render, screen } from '@testing-library/react';
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

/** Log out through the user menu in the top bar. */
export async function logOut(user) {
  await user.click(await screen.findByRole('button', { name: 'Priya' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Logout' }));
}
