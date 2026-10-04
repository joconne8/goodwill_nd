import { useEffect, type ReactNode } from 'react';
import { useClerk, useUser } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { useGetGoodwillOperatorAccess } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { Skeleton } from '@/components/ui/skeleton';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export function OperatorGate({ children }: { children: (signOut: () => void) => ReactNode }) {
  const { user, isLoaded } = useUser(); const { signOut } = useClerk(); const client = useQueryClient();
  const access = useGetGoodwillOperatorAccess({ query: { queryKey: ['operator-access', user?.id ?? null], enabled: isLoaded && Boolean(user), retry: false, refetchInterval: 60_000, staleTime: 0 } });
  useEffect(() => {
    if (access.isError || (access.data && !access.data.approved)) client.removeQueries({ predicate: q => q.queryKey[0] !== 'operator-access' });
  }, [access.data?.approved, access.isError, client]);
  const out = () => signOut({ redirectUrl: basePath || '/' });

  if (!isLoaded || (user && access.isPending)) return <div className="mx-auto max-w-xl space-y-4 p-10" role="status" aria-label="Checking access"><Skeleton className="h-4 w-40" /><Skeleton className="h-12 w-full" /><Skeleton className="h-4 w-3/4" /></div>;
  if (user && !access.isError && access.data?.signedIn && access.data.approved) return <>{children(out)}</>;
  return <main className="mx-auto flex min-h-[100dvh] max-w-xl flex-col justify-center px-6 py-16 rise">
    <p className="eyebrow text-[hsl(var(--miss))]">{user ? 'Not approved' : 'Sign-in required'}</p>
    <h1 className="mt-3 font-serif text-4xl">{user ? 'This account is not an approved operator.' : 'Published figures are behind sign-in.'}</h1>
    <p className="mt-4 text-muted-foreground">Only explicitly approved operator accounts with a verified primary email may view analytics values. KPI definitions stay public.</p>
    {access.isError && <p role="alert" className="mt-4 border-l-2 border-destructive bg-destructive/10 px-3 py-2 text-sm">Approval could not be checked. No access has been granted.</p>}
    <div className="mt-7 flex flex-wrap items-center gap-3">
      {user ? <>
        <button data-testid="button-recheck" className="rounded-sm border border-primary px-4 py-2 text-sm" onClick={() => access.refetch()}>Check again</button>
        <button data-testid="button-switch" className="text-sm underline" onClick={out}>Sign out and switch account</button>
      </> : <Link data-testid="link-sign-in" className="rounded-sm bg-primary px-5 py-2.5 text-sm text-primary-foreground" href="/sign-in">Operator sign-in</Link>}
      <Link className="text-sm underline" href="/">Definitions</Link>
    </div>
  </main>;
}
