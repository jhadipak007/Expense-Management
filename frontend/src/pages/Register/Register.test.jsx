import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/setup.js';
import { validRefresh } from '../../test/handlers.js';
import { renderApp } from '../../test/renderApp.jsx';

const VALID = { name: 'Priya', email: 'priya@example.com', password: 'P@ssw0rd', confirm: 'P@ssw0rd' };

async function fillDetails(user, details = VALID) {
  const fields = { name: 'Name', email: 'Email', password: 'Password', confirm: 'Confirm password' };
  for (const [key, label] of Object.entries(fields)) {
    if (details[key]) await user.type(screen.getByLabelText(label), details[key]);
  }
  await user.click(screen.getByRole('button', { name: 'Sign up' }));
}

async function submitCode(user, code) {
  const input = screen.getByLabelText('Code');
  await user.clear(input);
  if (code) await user.type(input, code);
  await user.click(screen.getByRole('button', { name: 'Verify' }));
}

async function openRegister() {
  const rendered = renderApp('/register');
  await screen.findByLabelText('Name');
  return rendered;
}

describe('Register page', () => {
  it('names every missing field and does not call the API', async () => {
    let called = false;
    server.use(http.post('/api/auth/register', () => { called = true; }));
    const { user } = await openRegister();
    await fillDetails(user, {});
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(screen.getByText('Please confirm your password')).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it.each([
    [{ email: 'not-an-email' }, 'Enter a valid email address'],
    [{ password: 'short', confirm: 'short' }, 'Password must be at least 8 characters'],
    [{ confirm: 'Different1' }, 'Passwords do not match'],
  ])('rejects invalid details %o', async (override, message) => {
    const { user } = await openRegister();
    await fillDetails(user, { ...VALID, ...override });
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByLabelText('Code')).not.toBeInTheDocument();
  });

  it('says when the email is already registered, with a login link', async () => {
    server.use(http.post('/api/auth/register', () =>
      HttpResponse.json({ detail: 'Email already registered' }, { status: 409 })));
    const { user } = await openRegister();
    await fillDetails(user);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('An account with this email already exists');
    expect(screen.getAllByRole('link', { name: 'Log in' })[0]).toHaveAttribute('href', '/login');
  });

  it('signs up with the correct code and lands on the dashboard', async () => {
    const { user, router } = await openRegister();
    await fillDetails(user);
    await submitCode(user, '2211');
    expect(await screen.findByRole('heading', { name: 'Welcome, Priya' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('shows a message for a wrong code and stays on the OTP screen', async () => {
    const { user } = await openRegister();
    await fillDetails(user);
    await submitCode(user, '1234');
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect code, please try again');
    expect(screen.getByLabelText('Code')).toBeInTheDocument();
  });

  it.each(['abcd', '221', '22110', ''])('asks for a 4-digit code when given %j', async (code) => {
    let called = false;
    server.use(http.post('/api/auth/register/verify', () => { called = true; }));
    const { user } = await openRegister();
    await fillDetails(user);
    await submitCode(user, code);
    expect(screen.getByText('Enter the 4-digit code')).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('returns to the start of sign-up when the registration is gone', async () => {
    server.use(http.post('/api/auth/register/verify', () =>
      HttpResponse.json({ detail: 'Sign-up expired, please start again' }, { status: 404 })));
    const { user } = await openRegister();
    await fillDetails(user);
    await submitCode(user, '0000');
    expect(await screen.findByRole('alert')).toHaveTextContent('Please sign up again');
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument();
  });

  it('Back returns to the details with them kept', async () => {
    const { user } = await openRegister();
    await fillDetails(user);
    await user.click(await screen.findByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Email')).toHaveValue('priya@example.com');
  });

  it('links login and sign-up both ways', async () => {
    const { user, router } = await openRegister();
    await user.click(screen.getByRole('link', { name: 'Log in' }));
    await user.click(await screen.findByRole('link', { name: 'Create an account' }));
    expect(router.state.location.pathname).toBe('/register');
  });

  it('sends a logged-in user to the dashboard', async () => {
    server.use(validRefresh);
    const { router } = renderApp('/register');
    await screen.findByRole('heading', { name: 'Welcome, Priya' });
    expect(router.state.location.pathname).toBe('/');
  });

  it('gives each password field its own show/hide toggle', async () => {
    const { user } = await openRegister();
    await user.click(screen.getByRole('button', { name: 'Show confirm password' }));
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });
});
