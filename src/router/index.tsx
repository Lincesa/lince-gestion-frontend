import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { GlobalRole, ModuleKey } from '@/types';
import { useAppSelector } from '@/store';
import { PrivateRoute } from './PrivateRoute';
import { RequireModule } from './RequireModule';
import { RequireRole } from './RequireRole';
import { AppLayout } from '@/components/AppLayout';
import { LoginPage } from '@/pages/LoginPage';

const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);

const SoporteItLayout = lazy(() =>
  import('@/pages/soporte-it/SoporteItLayout').then((m) => ({ default: m.SoporteItLayout })),
);
const EquiposPage = lazy(() =>
  import('@/pages/soporte-it/EquiposPage').then((m) => ({ default: m.EquiposPage })),
);
const EquipoDetailPage = lazy(() =>
  import('@/pages/soporte-it/EquipoDetailPage').then((m) => ({ default: m.EquipoDetailPage })),
);
const IncidentesPage = lazy(() =>
  import('@/pages/soporte-it/IncidentesPage').then((m) => ({ default: m.IncidentesPage })),
);
const IncidenteDetailPage = lazy(() =>
  import('@/pages/soporte-it/IncidenteDetailPage').then((m) => ({ default: m.IncidenteDetailPage })),
);
const MisEquiposPage = lazy(() =>
  import('@/pages/soporte-it/MisEquiposPage').then((m) => ({ default: m.MisEquiposPage })),
);
const MisIncidentesPage = lazy(() =>
  import('@/pages/soporte-it/MisIncidentesPage').then((m) => ({ default: m.MisIncidentesPage })),
);
const ReportarIncidentePage = lazy(() =>
  import('@/pages/soporte-it/ReportarIncidentePage').then((m) => ({ default: m.ReportarIncidentePage })),
);
const IncidenteUserDetailPage = lazy(() =>
  import('@/pages/soporte-it/IncidenteUserDetailPage').then((m) => ({ default: m.IncidenteUserDetailPage })),
);
const ModulePlaceholder = lazy(() =>
  import('@/pages/ModulePlaceholder').then((m) => ({ default: m.ModulePlaceholder })),
);

const CrmLayout = lazy(() =>
  import('@/pages/crm/CrmLayout').then((m) => ({ default: m.CrmLayout })),
);
const CrmAnalyticsPage = lazy(() =>
  import('@/pages/crm/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
);
const CrmClientsPage = lazy(() =>
  import('@/pages/crm/ClientsPage').then((m) => ({ default: m.ClientsPage })),
);
const CrmSatisfactionPage = lazy(() =>
  import('@/pages/crm/SatisfactionPage').then((m) => ({ default: m.SatisfactionPage })),
);

const ConciliacionesLayout = lazy(() =>
  import('@/pages/conciliaciones/ConciliacionesLayout').then((m) => ({ default: m.ConciliacionesLayout })),
);
const ConciliacionesDashboardPage = lazy(() =>
  import('@/pages/conciliaciones/DashboardPage').then((m) => ({ default: m.ConciliacionesDashboardPage })),
);
const NewReconciliationPage = lazy(() =>
  import('@/pages/conciliaciones/NewReconciliationPage').then((m) => ({ default: m.NewReconciliationPage })),
);
const RunDetailPage = lazy(() =>
  import('@/pages/conciliaciones/RunDetailPage').then((m) => ({ default: m.RunDetailPage })),
);
const CategoriesPage = lazy(() =>
  import('@/pages/conciliaciones/CategoriesPage').then((m) => ({ default: m.CategoriesPage })),
);

const SuperAdminPage = lazy(() =>
  import('@/pages/admin/SuperAdminPage').then((m) => ({ default: m.SuperAdminPage })),
);
const ChangePasswordPage = lazy(() =>
  import('@/pages/ChangePasswordPage').then((m) => ({ default: m.ChangePasswordPage })),
);

const OcrLayout = lazy(() =>
  import('@/pages/ocr/OcrLayout').then((m) => ({ default: m.OcrLayout })),
);

const MarketingLayout = lazy(() =>
  import('@/pages/marketing/MarketingLayout').then((m) => ({ default: m.MarketingLayout })),
);
const CampaignsPage = lazy(() =>
  import('@/pages/marketing/CampaignsPage').then((m) => ({ default: m.CampaignsPage })),
);
const CampaignDetailPage = lazy(() =>
  import('@/pages/marketing/CampaignDetailPage').then((m) => ({ default: m.CampaignDetailPage })),
);
const MarketingSeguimientoPage = lazy(() =>
  import('@/pages/marketing/SeguimientoPage').then((m) => ({ default: m.SeguimientoPage })),
);
const DirectMessagesPage = lazy(() =>
  import('@/pages/marketing/DirectMessagesPage').then((m) => ({ default: m.DirectMessagesPage })),
);
const OcrDashboardPage = lazy(() =>
  import('@/pages/ocr/OcrDashboardPage').then((m) => ({ default: m.OcrDashboardPage })),
);
const OcrRemitosPage = lazy(() =>
  import('@/pages/ocr/OcrRemitosPage').then((m) => ({ default: m.OcrRemitosPage })),
);
// Facturas y retenciones quedan pausadas temporalmente en el front.
const OcrConfigPage = lazy(() =>
  import('@/pages/ocr/OcrConfigPage').then((m) => ({ default: m.OcrConfigPage })),
);
const RrhhPage = lazy(() =>
  import('@/pages/rrhh/RrhhPage').then((m) => ({ default: m.RrhhPage })),
);

const LogisticaLayout = lazy(() =>
  import('@/pages/logistica/LogisticaLayout').then((m) => ({ default: m.LogisticaLayout })),
);
const RemitosListPage = lazy(() =>
  import('@/pages/logistica/RemitosListPage').then((m) => ({ default: m.RemitosListPage })),
);
const MapaPage = lazy(() =>
  import('@/pages/logistica/MapaPage').then((m) => ({ default: m.MapaPage })),
);

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

function SoporteItIndexRedirect() {
  const user = useAppSelector((s) => s.auth.user);
  if (!user) return <Navigate to="/login" replace />;
  return (
    <Navigate
      to={user.globalRole === GlobalRole.SUPERADMIN ? 'equipos' : 'mis-equipos'}
      replace
    />
  );
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <PrivateRoute />,
    children: [
      {
        path: 'change-password',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ChangePasswordPage />
          </Suspense>
        ),
      },
      {
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<PageLoader />}>
                <DashboardPage />
              </Suspense>
            ),
          },
          {
            path: 'crm',
            element: <RequireModule moduleKey={ModuleKey.CRM} />,
            children: [
              {
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <CrmLayout />
                  </Suspense>
                ),
                children: [
                  { index: true, element: <Navigate to="analytics" replace /> },
                  {
                    path: 'analytics',
                    element: (
                      <Suspense fallback={<PageLoader />}>
                        <CrmAnalyticsPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: 'clients',
                    element: (
                      <Suspense fallback={<PageLoader />}>
                        <CrmClientsPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: 'satisfaction',
                    element: (
                      <Suspense fallback={<PageLoader />}>
                        <CrmSatisfactionPage />
                      </Suspense>
                    ),
                  },
                ],
              },
            ],
          },
          {
            path: 'conciliaciones',
            element: <RequireModule moduleKey={ModuleKey.CONCILIACIONES} />,
            children: [
              {
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <ConciliacionesLayout />
                  </Suspense>
                ),
                children: [
                  {
                    index: true,
                    element: (
                      <Suspense fallback={<PageLoader />}>
                        <ConciliacionesDashboardPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: 'nueva',
                    element: (
                      <Suspense fallback={<PageLoader />}>
                        <NewReconciliationPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: 'run/:id',
                    element: (
                      <Suspense fallback={<PageLoader />}>
                        <RunDetailPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: 'categorias',
                    element: (
                      <Suspense fallback={<PageLoader />}>
                        <CategoriesPage />
                      </Suspense>
                    ),
                  },
                ],
              },
            ],
          },
          {
            path: 'admin',
            element: <RequireRole role={GlobalRole.SUPERADMIN} />,
            children: [
              {
                index: true,
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <SuperAdminPage />
                  </Suspense>
                ),
              },
            ],
          },
          {
            path: 'marketing',
            element: <RequireModule moduleKey={ModuleKey.MARKETING} />,
            children: [
              {
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <MarketingLayout />
                  </Suspense>
                ),
                children: [
                  { index: true, element: <Navigate to="campaigns" replace /> },
                  {
                    path: 'campaigns',
                    element: (
                      <Suspense fallback={<PageLoader />}>
                        <CampaignsPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: 'campaigns/:id',
                    element: (
                      <Suspense fallback={<PageLoader />}>
                        <CampaignDetailPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: 'direct-messages',
                    element: (
                      <Suspense fallback={<PageLoader />}>
                        <DirectMessagesPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: 'seguimiento',
                    element: (
                      <Suspense fallback={<PageLoader />}>
                        <MarketingSeguimientoPage />
                      </Suspense>
                    ),
                  },
                ],
              },
            ],
          },
          {
            path: 'soporte-it',
            element: <RequireModule moduleKey={ModuleKey.SOPORTE_IT} />,
            children: [
              {
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <SoporteItLayout />
                  </Suspense>
                ),
                children: [
                  { index: true, element: <SoporteItIndexRedirect /> },
                  // Vistas SUPERADMIN
                  {
                    path: 'equipos',
                    element: (
                      <Suspense fallback={<PageLoader />}>
                        <EquiposPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: 'equipos/:id',
                    element: (
                      <Suspense fallback={<PageLoader />}>
                        <EquipoDetailPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: 'incidentes',
                    element: (
                      <Suspense fallback={<PageLoader />}>
                        <IncidentesPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: 'incidentes/:id',
                    element: (
                      <Suspense fallback={<PageLoader />}>
                        <IncidenteDetailPage />
                      </Suspense>
                    ),
                  },
                  // Vistas usuario final
                  {
                    path: 'mis-equipos',
                    element: (
                      <Suspense fallback={<PageLoader />}>
                        <MisEquiposPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: 'mis-equipos/:id',
                    element: (
                      <Suspense fallback={<PageLoader />}>
                        <EquipoDetailPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: 'mis-incidentes',
                    element: (
                      <Suspense fallback={<PageLoader />}>
                        <MisIncidentesPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: 'mis-incidentes/:id',
                    element: (
                      <Suspense fallback={<PageLoader />}>
                        <IncidenteUserDetailPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: 'reportar',
                    element: (
                      <Suspense fallback={<PageLoader />}>
                        <ReportarIncidentePage />
                      </Suspense>
                    ),
                  },
                ],
              },
            ],
          },
          {
            path: 'ocr',
            element: <RequireModule moduleKey={ModuleKey.OCR} />,
            children: [
              {
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <OcrLayout />
                  </Suspense>
                ),
                children: [
                  {
                    index: true,
                    element: (
                      <Suspense fallback={<PageLoader />}>
                        <OcrDashboardPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: 'remitos',
                    element: (
                      <Suspense fallback={<PageLoader />}>
                        <OcrRemitosPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: 'facturas',
                    element: <Navigate to="/ocr/remitos" replace />,
                  },
                  {
                    path: 'retenciones',
                    element: <Navigate to="/ocr/remitos" replace />,
                  },
                  {
                    path: 'configuracion',
                    element: (
                      <Suspense fallback={<PageLoader />}>
                        <OcrConfigPage />
                      </Suspense>
                    ),
                  },
                ],
              },
            ],
          },
          {
            path: 'logistica',
            element: <RequireModule moduleKey={ModuleKey.LOGISTICA} />,
            children: [
              {
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <LogisticaLayout />
                  </Suspense>
                ),
                children: [
                  { index: true, element: <Navigate to="remitos" replace /> },
                  {
                    path: 'remitos',
                    element: (
                      <Suspense fallback={<PageLoader />}>
                        <RemitosListPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: 'mapa',
                    element: (
                      <Suspense fallback={<PageLoader />}>
                        <MapaPage />
                      </Suspense>
                    ),
                  },
                ],
              },
            ],
          },
          {
            path: 'rrhh',
            element: <RequireModule moduleKey={ModuleKey.ASISTENCIA} />,
            children: [
              {
                index: true,
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <RrhhPage />
                  </Suspense>
                ),
              },
              {
                path: 'reportes',
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <RrhhPage />
                  </Suspense>
                ),
              },
              {
                path: 'mensual',
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <RrhhPage />
                  </Suspense>
                ),
              },
              {
                path: 'indicadores',
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <RrhhPage />
                  </Suspense>
                ),
              },
              {
                path: 'pines',
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <RrhhPage />
                  </Suspense>
                ),
              },
              {
                path: 'empleados',
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <RrhhPage />
                  </Suspense>
                ),
              },
            ],
          },
        ],
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
