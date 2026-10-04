import { useEffect, useRef, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { QueryClientProvider, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';

const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
// Shared managed Clerk proxy already has its own API route and host contract.
// Match that route rather than creating a new tenant or authentication service.
const clerkProxyUrl = import.meta.env.PROD
  ? import.meta.env.VITE_CLERK_PROXY_URL ?? `${window.location.origin}/api/__clerk`
  : undefined; // The existing API's Clerk proxy is intentionally production-only.
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');
const strip = (p: string) => (basePath && p.startsWith(basePath) ? p.slice(basePath.length) || '/' : p);

const appearance = {
  cssLayerName: 'clerk',
  variables: { colorPrimary: '#1b3a66', colorForeground: '#141f33', colorBackground: '#fbf8f0', colorInput: '#ffffff', colorDanger: '#a13a2c', fontFamily: 'IBM Plex Sans, sans-serif', borderRadius: '0.25rem' },
  elements: { rootBox: 'w-full flex justify-center', cardBox: 'w-[420px] max-w-full rounded border border-[#d8cfba]', card: '!shadow-none !bg-transparent', footer: '!bg-transparent' },
};

function AuthFrame({ note, children }: { note: string; children: ReactNode }) {
  return <div className="grid min-h-[100dvh] md:grid-cols-[minmax(0,2fr)_3fr]">
    <aside className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground md:flex">
      <p className="eyebrow text-sidebar-primary">Goodwill Michiana</p>
      <div><h1 className="font-serif text-5xl leading-[1.05]">Analytics that admit what they cannot see.</h1><p className="mt-5 max-w-sm text-sm opacity-75">{note}</p></div>
      <p className="eyebrow opacity-60">Synthetic data. Non-production.</p>
    </aside>
    <main className="flex flex-col items-center justify-center gap-5 px-4 py-10">{children}<Link className="text-sm underline" href="/">Back to KPI definitions</Link></main>
  </div>;
}
export function SignInPage() {
  return <AuthFrame note="Only explicitly approved operator accounts can view published figures."><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></AuthFrame>;
}
export function SignUpPage() {
  return <AuthFrame note="Creating an account does not grant access. Approval is separate and explicit."><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></AuthFrame>;
}
function Invalidator() {
  const { addListener } = useClerk(); const qc = useQueryClient(); const prev = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => { const id = user?.id ?? null; if (prev.current !== undefined && prev.current !== id) qc.clear(); prev.current = id; }), [addListener, qc]);
  return null;
}
export function ClerkProviderWithRoutes({ queryClient, children }: { queryClient: QueryClient; children: ReactNode }) {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    routerPush={to => setLocation(strip(to))} routerReplace={to => setLocation(strip(to), { replace: true })}>
    <QueryClientProvider client={queryClient}><Invalidator /><TooltipProvider>{children}</TooltipProvider><Toaster /></QueryClientProvider>
  </ClerkProvider>;
}
