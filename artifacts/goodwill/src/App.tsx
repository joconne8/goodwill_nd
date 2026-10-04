import { lazy, Suspense, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { TooltipProvider } from '@/components/ui/tooltip';
import Home from '@/pages/home';
import NotFound from '@/pages/not-found';
import { ReportingApp } from '@/features/reporting';
import { AcquisitionConsole, ReplicaPortal } from '@/features/acquisition';
import { useExperimentAdapter } from '@/features/reporting/systemApi';
import { setBaseUrl } from '@workspace/api-client-react';
import {
  Redirect,
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();
setBaseUrl(import.meta.env.BASE_URL.replace(/\/$/, '') || null);
const ClerkProviderWithRoutes = lazy(() => import('@/auth/ClerkRoutes').then(module => ({ default: module.ClerkProviderWithRoutes })));
const SignInPage = lazy(() => import('@/auth/ClerkRoutes').then(module => ({ default: module.SignInPage })));
const SignUpPage = lazy(() => import('@/auth/ClerkRoutes').then(module => ({ default: module.SignUpPage })));
const OperatorGate = lazy(() => import('@/auth/OperatorGate').then(module => ({ default: module.OperatorGate })));


function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/"><Redirect to="/reports" /></Route>
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/reports"><OperatorGate><ReportingApp legacyHref={`${import.meta.env.BASE_URL}foundation`} /></OperatorGate></Route>
        <Route path="/acquisition"><OperatorGate><AcquisitionPage /></OperatorGate></Route>
        <Route path="/foundation"><OperatorGate><Home /></OperatorGate></Route>
        <Route path="/replica/upright"><ReplicaPortal /></Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function AcquisitionPage() {
  const { adapter, loading, error } = useExperimentAdapter();
  return <div className="min-h-[100dvh] bg-background">
    <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3 text-sm" aria-label="Acquisition">
      <a className="underline" href={`${import.meta.env.BASE_URL}reports#overview`} data-testid="link-back-reports">Back to reporting</a>
      <span className="text-muted-foreground" role="status" data-testid="status-experiment-adapter">
        {loading ? 'Checking experiment access…' : error ? `Experiment review unavailable: ${error}` : adapter?.access.discoveryAuthorized ? 'Jev discovery authorized for this operator' : `Jev provider calls disabled: ${adapter?.access.explanation ?? 'spending or model authorization not granted'}`}
      </span>
    </nav>
    <AcquisitionConsole experiment={adapter} />
  </div>;
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
