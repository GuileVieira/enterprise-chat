import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import {
  Login,
  VerifyEmail,
  Registration,
  ResetPassword,
  ApiErrorWatcher,
  TwoFactorScreen,
  RequestPasswordReset,
} from '~/components/Auth';
import { MarketplaceProvider } from '~/components/Agents/MarketplaceContext';
import AgentMarketplace from '~/components/Agents/Marketplace';
import { OAuthSuccess, OAuthError } from '~/components/OAuth';
import { AuthContextProvider } from '~/hooks/AuthContext';
import RouteErrorBoundary from './RouteErrorBoundary';
import StartupLayout from './Layouts/Startup';
import LoginLayout from './Layouts/Login';
import dashboardRoutes from './Dashboard';
import ShareRoute from './ShareRoute';
import ChatRoute from './ChatRoute';
import Search from './Search';
import Root from './Root';
import AdminLayout from '~/components/Admin';

const AuthLayout = () => (
  <AuthContextProvider>
    <Outlet />
    <ApiErrorWatcher />
  </AuthContextProvider>
);

const loadInlinePromptsView = () =>
  import('~/components/Prompts/layouts/InlinePromptsView').then((m) => ({
    Component: m.default,
  }));

const loadSkillsView = () =>
  import('~/components/Skills/layouts/SkillsView').then((m) => ({
    Component: m.default,
  }));

const baseEl = document.querySelector('base');
const baseHref = baseEl?.getAttribute('href') || '/';

export const router = createBrowserRouter(
  [
    {
      path: 'share/:shareId',
      element: <ShareRoute />,
      errorElement: <RouteErrorBoundary />,
    },
    {
      path: 'share/tenant/:shareId',
      element: <ShareRoute isTenantShare={true} />,
      errorElement: <RouteErrorBoundary />,
    },
    {
      path: 'oauth',
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: 'success',
          element: <OAuthSuccess />,
        },
        {
          path: 'error',
          element: <OAuthError />,
        },
      ],
    },
    {
      path: '/',
      element: <StartupLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: 'register',
          element: <Registration />,
        },
        {
          path: 'forgot-password',
          element: <RequestPasswordReset />,
        },
        {
          path: 'reset-password',
          element: <ResetPassword />,
        },
      ],
    },
    {
      path: 'verify',
      element: <VerifyEmail />,
      errorElement: <RouteErrorBoundary />,
    },
    {
      element: <AuthLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: '/',
          element: <LoginLayout />,
          children: [
            {
              path: 'login',
              element: <Login />,
            },
            {
              path: 'login/2fa',
              element: <TwoFactorScreen />,
            },
          ],
        },
        dashboardRoutes,
        {
          path: 'admin',
          element: <AdminLayout />,
          children: [
            {
              index: true,
              lazy: () =>
                import('~/components/Admin/Dashboard').then((m) => ({ Component: m.default })),
            },
            {
              path: 'users',
              lazy: () =>
                import('~/components/Admin/Users/UsersPage').then((m) => ({
                  Component: m.default,
                })),
            },
            {
              path: 'roles',
              lazy: () =>
                import('~/components/Admin/Roles/RolesPage').then((m) => ({
                  Component: m.default,
                })),
            },
            {
              path: 'groups',
              lazy: () =>
                import('~/components/Admin/Groups/GroupsPage').then((m) => ({
                  Component: m.default,
                })),
            },
            {
              path: 'config',
              lazy: () =>
                import('~/components/Admin/Config/ConfigPage').then((m) => ({
                  Component: m.default,
                })),
            },
            {
              path: 'groups/:id',
              lazy: () =>
                import('~/components/Admin/Groups/GroupDetailPage').then((m) => ({
                  Component: m.default,
                })),
            },
            {
              path: 'tenants',
              lazy: () =>
                import('~/components/Admin/Tenants/TenantsPage').then((m) => ({
                  Component: m.default,
                })),
            },
            {
              path: 'tenants/:id',
              lazy: () =>
                import('~/components/Admin/Tenants/TenantDetailPage').then((m) => ({
                  Component: m.default,
                })),
            },
            {
              path: 'functions',
              lazy: () =>
                import('~/components/Admin/Functions/FunctionsPage').then((m) => ({
                  Component: m.default,
                })),
            },
            {
              path: 'secrets',
              lazy: () =>
                import('~/components/Admin/Secrets/SecretsPage').then((m) => ({
                  Component: m.default,
                })),
            },
          ],
        },
        {
          path: '/',
          element: <Root />,
          children: [
            {
              index: true,
              element: <Navigate to="/c/new" replace={true} />,
            },
            {
              path: 'c/:conversationId?',
              element: <ChatRoute />,
            },
            {
              path: 'search',
              element: <Search />,
            },
            {
              path: 'prompts',
              element: <Navigate to="/prompts/new" replace={true} />,
            },
            {
              path: 'prompts/new',
              lazy: loadInlinePromptsView,
            },
            {
              path: 'prompts/:promptId',
              lazy: loadInlinePromptsView,
            },
            {
              path: 'skills',
              lazy: loadSkillsView,
            },
            {
              path: 'skills/:skillId',
              lazy: loadSkillsView,
            },
            {
              path: 'skills/:skillId/edit',
              lazy: loadSkillsView,
            },
            {
              path: 'agents',
              element: (
                <MarketplaceProvider>
                  <AgentMarketplace />
                </MarketplaceProvider>
              ),
            },
            {
              path: 'agents/:category',
              element: (
                <MarketplaceProvider>
                  <AgentMarketplace />
                </MarketplaceProvider>
              ),
            },
            {
              path: 'projects',
              lazy: () =>
                import('~/components/Project/ProjectsList').then((m) => ({
                  Component: m.default,
                })),
            },
            {
              path: 'projects/new',
              lazy: () =>
                import('~/components/Project/ProjectCreatePage').then((m) => ({
                  Component: m.default,
                })),
            },
            {
              path: 'projects/:projectId',
              lazy: () =>
                import('~/components/Project/ProjectDetailPage').then((m) => ({
                  Component: m.default,
                })),
            },
          ],
        },
      ],
    },
  ],
  { basename: baseHref },
);
