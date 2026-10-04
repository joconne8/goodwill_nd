import { useEffect, useRef } from 'react';
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClientProvider, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { Link, Redirect, useLocation } from 'wouter';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import type { ReactNode } from 'react';

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#174b56', colorForeground: '#152629',
    colorMutedForeground: '#546268', colorDanger: '#a6372b',
    colorBackground: '#fffdf7', colorInput: '#ffffff',
    colorInputForeground: '#152629', colorNeutral: '#546268',
    fontFamily: 'DM Sans, sans-serif', borderRadius: '0.35rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffdf7] rounded-md w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#152629]', headerSubtitle: 'text-[#546268]',
    socialButtonsBlockButtonText: 'text-[#152629]', formFieldLabel: 'text-[#152629]',
    footerActionLink: 'text-[#174b56] underline', footerActionText: 'text-[#546268]',
    dividerText: 'text-[#546268]', identityPreviewEditButton: 'text-[#174b56]',
    formFieldSuccessText: 'text-[#174b56]', alertText: 'text-[#a6372b]',
    logoBox: 'mb-5', logoImage: 'max-w-[280px] w-full h-auto',
    socialButtonsBlockButton: 'border border-[#546268] bg-white',
    formButtonPrimary: 'bg-[#174b56] text-white',
    formFieldInput: 'bg-white text-[#152629] border border-[#546268]',
    footerAction: 'px-6 py-4', dividerLine: 'bg-[#546268]',
    alert: 'border border-[#a6372b]', otpCodeFieldInput: 'bg-white text-[#152629]',
    formFieldRow: 'mb-4', main: 'gap-4',
  },
};

export function SignInPage() {
  return <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-background px-4 py-10">
    <p className="max-w-md text-center text-sm">Restricted synthetic demo. Sign in with the approved email account.</p>
    <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    <Link className="underline text-sm" href="/">About this prototype</Link>
  </div>;
}
export function SignUpPage() {
  return <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-background px-4 py-10">
    <p className="max-w-md text-center text-sm">Creating an account does not grant access. Only explicitly approved, verified primary emails can operate this demo.</p>
    <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    <Link className="underline text-sm" href="/">About this prototype</Link>
  </div>;
}

export function HomeRedirect() {
  return <>
    <Show when="signed-in"><Redirect to="/reports" /></Show>
    <Show when="signed-out">
      <main className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-sm uppercase tracking-widest">Michiana operations · Reporting prototype</p>
        <h1 className="mt-5 font-serif text-6xl">Goodwill Reporting</h1>
        <p className="mt-6 text-lg text-muted-foreground">Retrieve simulated reports, preserve original files and review reconciled, source-local reporting.</p>
        <p className="mt-5">Synthetic data. Simulated sources. Non-production. No real vendor access, approved accounting posting or measured savings are claimed.</p>
        <p className="mt-5">This demo is restricted to explicitly approved, verified email accounts. Persona views are informational only.</p>
        <Link className="mt-8 inline-block rounded border border-primary bg-primary px-6 py-3 text-primary-foreground" href="/sign-in">Operator sign-in</Link>
      </main>
    </Show>
  </>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);
  return null;
}

export function ClerkProviderWithRoutes({ queryClient, children }: { queryClient: QueryClient; children: ReactNode }) {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Goodwill demo sign-in', subtitle: 'Use the approved email account' } },
        signUp: { start: { title: 'Create your demo account', subtitle: 'Account creation does not grant access' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </QueryClientProvider>
    </ClerkProvider>
  );
}