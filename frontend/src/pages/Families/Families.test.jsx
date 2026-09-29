import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { validRefresh } from '@/test/handlers.js';
import { server } from '@/test/setup.js';
import { renderApp } from '@/test/renderApp.jsx';

function mockFamiliesApi(families = []) {
  let created = null;
  server.use(
    validRefresh,
    http.get('/api/families', () => HttpResponse.json(families)),
    http.post('/api/families', async ({ request }) => {
      const { name } = await request.json();
      created = { id: 99, name, role: 'owner' };
      families = [...families, created];
      return HttpResponse.json(created, { status: 201 });
    }),
  );
  return () => created;
}

describe('Families page', () => {
  it('lists my families with my role in each', async () => {
    mockFamiliesApi([
      { id: 1, name: 'Jha Household', role: 'owner' },
      { id: 2, name: 'Trip Crew', role: 'member' },
    ]);
    renderApp('/families');
    const link = await screen.findByRole('link', { name: 'Jha Household' });
    expect(link).toHaveAttribute('href', '/families/1');
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
  });

  it('says when I am not in any family', async () => {
    mockFamiliesApi();
    renderApp('/families');
    expect(await screen.findByText('You are not in a family yet')).toBeInTheDocument();
    expect(screen.getByText(/Create one below/)).toBeInTheDocument();
  });

  it('creates a family, confirms it with a toast and lists me as owner', async () => {
    const created = mockFamiliesApi();
    const { user } = renderApp('/families');
    await user.type(await screen.findByLabelText('Family name'), '  Jha Household  ');
    await user.click(screen.getByRole('button', { name: 'Create family' }));
    expect(await screen.findByRole('link', { name: 'Jha Household' })).toBeInTheDocument();
    expect(screen.getByText('Jha Household created')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(created().name).toBe('Jha Household');
    expect(screen.getByLabelText('Family name')).toHaveValue('');
  });

  it('requires a family name and does not call the API', async () => {
    const created = mockFamiliesApi();
    const { user } = renderApp('/families');
    await screen.findByLabelText('Family name');
    await user.click(screen.getByRole('button', { name: 'Create family' }));
    expect(screen.getByLabelText('Family name')).toHaveAccessibleDescription(
      'Family name is required',
    );
    expect(created()).toBeNull();
  });
});
