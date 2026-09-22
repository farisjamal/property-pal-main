import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';

const supabaseMocks = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return {
    eq,
    from,
    getAuthenticatorAssuranceLevel: vi.fn(),
    getSession: vi.fn(),
    maybeSingle,
    onAuthStateChange: vi.fn(),
    select,
    signOut: vi.fn(),
    unsubscribe: vi.fn(),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: supabaseMocks.getSession,
      mfa: {
        getAuthenticatorAssuranceLevel:
          supabaseMocks.getAuthenticatorAssuranceLevel,
      },
      onAuthStateChange: supabaseMocks.onAuthStateChange,
      signOut: supabaseMocks.signOut,
    },
    from: supabaseMocks.from,
  },
}));

const buildSession = (emailConfirmed = true) => ({
  user: {
    email_confirmed_at: emailConfirmed ? '2026-01-01T00:00:00.000Z' : null,
    id: 'user-123',
  },
});

const AuthDestination = () => {
  const location = useLocation();
  const state = location.state as { from?: { pathname?: string } } | null;

  return (
    <main>
      <h1>Sign in</h1>
      <p>Requested path: {state?.from?.pathname ?? 'none'}</p>
    </main>
  );
};

const renderProtectedRoute = (allowedRoles: number[], route: string) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route
          path={route}
          element={
            <ProtectedRoute allowedRoles={allowedRoles}>
              <h1>Authorized dashboard</h1>
            </ProtectedRoute>
          }
        />
        <Route path="/auth" element={<AuthDestination />} />
      </Routes>
    </MemoryRouter>,
  );

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    supabaseMocks.from.mockImplementation(() => ({
      select: supabaseMocks.select,
    }));
    supabaseMocks.select.mockImplementation(() => ({
      eq: supabaseMocks.eq,
    }));
    supabaseMocks.eq.mockImplementation(() => ({
      maybeSingle: supabaseMocks.maybeSingle,
    }));

    supabaseMocks.getSession.mockResolvedValue({
      data: { session: buildSession() },
    });
    supabaseMocks.maybeSingle.mockResolvedValue({
      data: { role_id: 1 },
      error: null,
    });
    supabaseMocks.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal1' },
      error: null,
    });
    supabaseMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: supabaseMocks.unsubscribe } },
    });
    supabaseMocks.signOut.mockResolvedValue({ error: null });
  });

  it('redirects an unauthenticated user to sign in and preserves the requested path', async () => {
    supabaseMocks.getSession.mockResolvedValue({ data: { session: null } });

    renderProtectedRoute([1], '/admin');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('Requested path: /admin')).toBeInTheDocument();
    expect(supabaseMocks.from).not.toHaveBeenCalled();
  });

  it('signs out and redirects a user whose email is not verified', async () => {
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: buildSession(false) },
    });

    renderProtectedRoute([3], '/tenant');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(supabaseMocks.signOut).toHaveBeenCalledOnce();
    expect(supabaseMocks.from).not.toHaveBeenCalled();
  });

  it('redirects safely when no role assignment exists', async () => {
    supabaseMocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      renderProtectedRoute([2], '/owner');

      expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Authorized dashboard' })).not.toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('redirects safely when the role lookup fails', async () => {
    const roleError = new Error('role service unavailable');
    supabaseMocks.maybeSingle.mockResolvedValue({ data: null, error: roleError });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      renderProtectedRoute([1], '/admin');

      expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
      expect(consoleError).toHaveBeenCalledWith('Error fetching role:', roleError);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('denies a valid session when its role is not allowed for the route', async () => {
    supabaseMocks.maybeSingle.mockResolvedValue({
      data: { role_id: 3 },
      error: null,
    });

    renderProtectedRoute([1], '/admin');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(supabaseMocks.getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
  });

  it('redirects when an enrolled MFA factor still requires AAL2 verification', async () => {
    supabaseMocks.maybeSingle.mockResolvedValue({
      data: { role_id: 2 },
      error: null,
    });
    supabaseMocks.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal2' },
      error: null,
    });

    renderProtectedRoute([2], '/owner');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('redirects safely when the authentication check throws', async () => {
    const authError = new Error('session service unavailable');
    supabaseMocks.getSession.mockRejectedValue(authError);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      renderProtectedRoute([3], '/tenant');

      expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
      expect(consoleError).toHaveBeenCalledWith('Auth check error:', authError);
    } finally {
      consoleError.mockRestore();
    }
  });

  it.each([
    { allowedRole: 1, route: '/admin' },
    { allowedRole: 2, route: '/owner' },
    { allowedRole: 3, route: '/tenant' },
  ])('allows role $allowedRole to enter $route', async ({ allowedRole, route }) => {
    supabaseMocks.maybeSingle.mockResolvedValue({
      data: { role_id: allowedRole },
      error: null,
    });

    renderProtectedRoute([allowedRole], route);

    expect(
      await screen.findByRole('heading', { name: 'Authorized dashboard' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('unsubscribes from auth events when the route guard unmounts', () => {
    const { unmount } = renderProtectedRoute([1], '/admin');

    unmount();

    expect(supabaseMocks.unsubscribe).toHaveBeenCalledOnce();
  });
});
