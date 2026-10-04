import { lazy, Suspense, type ReactNode } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { setBaseUrl } from '@workspace/api-client-react';
import { Show } from '@clerk/react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Protected } from '@/components/protected';
import { ScopeStateProvider } from '@/lib/scope';
import Landing from '@/pages/landing';
import Overview from '@/pages/overview';
import Scorecard from '@/pages/scorecard';
import Metrics from '@/pages/metrics';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();
setBaseUrl(import.meta.env.BASE_URL.replace(/\/$/, '') || null);
const Providers = lazy(() => import('@/auth/ClerkRoutes').then(m => ({ default: m.ClerkProviderWithRoutes })));
const SignInPage = lazy(() => import('@/auth/ClerkRoutes').then(m => ({ default: m.SignInPage })));
const SignUpPage = lazy(() => import('@/auth/ClerkRoutes').then(m => ({ default: m.SignUpPage })));

function Router() {
  const [loc] = useLocation();
  return <ErrorBoundary resetKey={loc}><Switch>
    <Route path="/sign-in/*?" component={SignInPage} />
    <Route path="/sign-up/*?" component={SignUpPage} />
    <Route path="/"><Show when="signed-out"><Landing /></Show><Show when="signed-in"><Protected>{(d, o) => <Overview d={d} open={o} />}</Protected></Show></Route>
    <Route path="/scorecard"><Protected>{(d, o) => <Scorecard d={d} open={o} />}</Protected></Route>
    <Route path="/metrics"><Protected>{(d, o) => <Metrics d={d} open={o} />}</Protected></Route>
    <Route component={NotFound} />
  </Switch></ErrorBoundary>;
}
const Loading = (): ReactNode => <div className="p-10 eyebrow" role="status">Loading</div>;

function App() {
  return <ErrorBoundary><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
    <Suspense fallback={<Loading />}><Providers queryClient={queryClient}><ScopeStateProvider><Router /></ScopeStateProvider></Providers></Suspense>
  </WouterRouter></ErrorBoundary>;
}
export default App;
