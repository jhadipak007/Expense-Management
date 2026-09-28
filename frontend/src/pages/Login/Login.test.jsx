import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/setup.js';
import { renderApp } from '../../test/renderApp.jsx';

async function fillAndSubmit(user, { email = '', password = '' } = {}) {
  if (email) await user.type(screen.getByLabelText('Email'), email);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Log in' }));
}

describe('Login page', () => {
  it('says which fields are required and does not call the API', async () => {
    let called = false;
    server.use(http.post('/api/auth/login', () => { called = true; }));
    const { user } = renderApp('/login');
    await screen.findByLabelText('Email');
    await fillAndSubmit(user);
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Email is required');
    expect(called).toBe(false);
  });

  it('names only the missing field', async () => {
    const { user } = renderApp('/login');
    await screen.findByLabelText('Email');
    await fillAndSubmit(user, { email: 'priya@example.com' });
    expect(screen.queryByText('Email is required')).not.toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('shows the generic message on wrong credentials and stays on login', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ detail: 'Incorrect email or password' }, { status: 401 }),
      ),
    );
    const { user, router } = renderApp('/login');
    await screen.findByLabelText('Email');
    await fillAndSubmit(user, { email: 'priya@example.com', password: 'wrong-pass' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password');
    expect(router.state.location.pathname).toBe('/login');
  });

  it('shows a retry message when the server fails', async () => {
    server.use(http.post('/api/auth/login', () => HttpResponse.json({}, { status: 500 })));
    const { user } = renderApp('/login');
    await screen.findByLabelText('Email');
    await fillAndSubmit(user, { email: 'priya@example.com', password: 'P@ssw0rd' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('logs in and lands on the dashboard with a greeting', async () => {
    const { user, router } = renderApp('/login');
    await screen.findByLabelText('Email');
    await fillAndSubmit(user, { email: 'priya@example.com', password: 'P@ssw0rd' });
    expect(await screen.findByRole('heading', { name: 'Welcome, Priya' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('shows the brand logo and a welcome heading', async () => {
    renderApp('/login');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Expense Sarathi' })).toBeInTheDocument();
  });

  it('shows and hides the password', async () => {
    const { user } = renderApp('/login');
    const password = await screen.findByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('says password reset is coming soon without calling the API', async () => {
    let called = false;
    server.use(http.post('/api/auth/login', () => { called = true; }));
    const { user, router } = renderApp('/login');
    await user.click(await screen.findByRole('button', { name: 'Forgot password?' }));
    expect(screen.getByRole('status')).toHaveTextContent('Password reset is coming soon.');
    expect(router.state.location.pathname).toBe('/login');
    expect(called).toBe(false);
  });

  it('disables the button while logging in so it sends one request', async () => {
    let calls = 0;
    let respond;
    server.use(
      http.post('/api/auth/login', () => {
        calls += 1;
        return new Promise((resolve) => { respond = resolve; });
      }),
    );
    const { user } = renderApp('/login');
    await screen.findByLabelText('Email');
    await fillAndSubmit(user, { email: 'priya@example.com', password: 'P@ssw0rd' });
    const button = await screen.findByRole('button', { name: 'Logging in...' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(calls).toBe(1);
    respond(HttpResponse.json({ access_token: 'token-1', token_type: 'bearer' }));
    expect(await screen.findByRole('heading', { name: 'Welcome, Priya' })).toBeInTheDocument();
  });
});
