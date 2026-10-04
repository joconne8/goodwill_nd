import { lazy, Suspense, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { TooltipProvider } from '@/components/ui/tooltip';
import Home from '@/pages/home';
import NotFound from '@/pages/not-found';
import { ReportingApp } from '@/features/reporting';
import { ReplicaPortal } from '@/features/acquisition';
import { setBaseUrl } from '@workspace/api-client-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();
setBaseUrl(import.meta.env.BASE_URL.replace(/\/$/, '') || null);
const ClerkProviderWithRoutes = lazy(() => import('@/auth/ClerkRoutes').then(module => ({ default: module.ClerkProviderWithRoutes })));
const HomeRedirect = lazy(() => import('@/auth/ClerkRoutes').then(module => ({ default: module.HomeRedirect })));
const SignInPage = lazy(() => import('@/auth/ClerkRoutes').then(module => ({ default: module.SignInPage })));
const SignUpPage = lazy(() => import('@/auth/ClerkRoutes').then(module => ({ default: module.SignUpPage })));
const OperatorGate = lazy(() => import('@/auth/OperatorGate').then(module => ({ default: module.OperatorGate })));


function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/reports"><OperatorGate><ReportingApp legacyHref={`${import.meta.env.BASE_URL}foundation`} /></OperatorGate></Route>
        <Route path="/foundation"><OperatorGate><Home /></OperatorGate></Route>
        <Route path="/replica/upright"><ReplicaPortal /></Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  // The supervised same-origin replay does not load external Clerk resources.
  // This public page contains controls only; generation is separately authorized.
  const replica = window.location.pathname === `${import.meta.env.BASE_URL}replica/upright`;
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      {replica ? <QueryClientProvider client={queryClient}><TooltipProvider><ReplicaPortal /></TooltipProvider></QueryClientProvider>
        : <Suspense fallback={<div className="p-8" role="status">Loading operator sign-in…</div>}><ClerkProviderWithRoutes queryClient={queryClient}><Router /></ClerkProviderWithRoutes></Suspense>}
    </WouterRouter>
  );
}

export default App;
