import { Navigate } from 'react-router';
import { AuthProvider } from './auth/AuthProvider.jsx';
import { GuestOnly, RequireAuth } from './auth/guards.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import Dashboard from './pages/Dashboard/Dashboard.jsx';
import Login from './pages/Login/Login.jsx';

export const routes = [
  {
    element: <AuthProvider />,
    children: [
      { element: <GuestOnly />, children: [{ path: '/login', element: <Login /> }] },
      {
        element: <RequireAuth />,
        children: [{ element: <AppLayout />, children: [{ path: '/', element: <Dashboard /> }] }],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
