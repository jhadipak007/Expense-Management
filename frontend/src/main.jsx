import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { applyTheme } from './hooks/useTheme.js';
import { routes } from './routes.jsx';
import './styles/global.css';

const router = createBrowserRouter(routes);
applyTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
