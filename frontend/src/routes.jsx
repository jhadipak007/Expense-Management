import { Navigate } from 'react-router';
import { AuthProvider } from './auth/AuthProvider.jsx';
import { GuestOnly, RequireAuth } from './auth/guards.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import Dashboard from './pages/Dashboard/Dashboard.jsx';
import NewExpense from './pages/Expenses/NewExpense.jsx';
import Families from './pages/Families/Families.jsx';
import FamilyDetail from './pages/Families/FamilyDetail.jsx';
import Login from './pages/Login/Login.jsx';
import Register from './pages/Register/Register.jsx';

export const routes = [
  {
    element: <AuthProvider />,
    children: [
      {
        element: <GuestOnly />,
        children: [
          { path: '/login', element: <Login /> },
          { path: '/register', element: <Register /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: '/', element: <Dashboard /> },
              { path: '/expenses/new', element: <NewExpense /> },
              { path: '/families', element: <Families /> },
              { path: '/families/:familyId', element: <FamilyDetail /> },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
