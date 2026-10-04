import { Fragment, useEffect, type ReactNode } from 'react';
import { useClerk, useUser } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { useGetGoodwillOperatorAccess } from '@workspace/api-client-react';
import { Link } from 'wouter';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export function OperatorGate({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const client = useQueryClient();
  const access = useGetGoodwillOperatorAccess({
    query: {
      queryKey: ['operator-access', user?.id ?? null],
      enabled: isLoaded && Boolean(user),
      retry: false,
      refetchInterval: 15_000,
      staleTime: 0,
    },
  });
  useEffect(() => {
    if (access.isError || (access.data && !access.data.approved))
      client.removeQueries({ predicate: query => query.queryKey[0] !== 'operator-access' });
  }, [access.data?.approved, access.isError, client]);

  if (!isLoaded || (user && access.isPending))
    return <div className="p-8" role="status">Checking approved demo access…</div>;
  if (user && !access.isError && access.data?.signedIn && access.data.approved)
    return <Fragment key={user.id}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3 text-sm">
        <span>Approved synthetic demo session</span>
        <button className="underline" onClick={() => signOut({ redirectUrl: basePath || '/' })}>Sign out</button>
      </div>
      {children}
    </Fragment>;
  return <main className="mx-auto max-w-xl px-6 py-16">
    <p className="text-sm uppercase tracking-widest">Goodwill Reporting · Synthetic demo</p>
    <h1 className="mt-4 font-serif text-4xl">{user ? 'Demo access is restricted' : 'Operator sign-in required'}</h1>
    <p className="mt-5 text-muted-foreground">
      Only explicitly approved demo accounts may access reports, upload files or
      publish synthetic batches. Each primary email must be verified. Other accounts
      and persona labels do not grant access.
    </p>
    {access.isError && <p className="mt-4" role="alert">Account approval could not be checked. No access has been granted.</p>}
    <div className="mt-6 flex flex-wrap gap-5">
      {user ? <>
        <button className="underline" onClick={() => access.refetch()}>Check access again</button>
        <button className="underline" onClick={() => signOut({ redirectUrl: basePath || '/' })}>Sign out and switch account</button>
      </> : <Link className="underline font-semibold" href="/sign-in">Sign in</Link>}
      <Link className="underline" href="/">Home</Link>
    </div>
  </main>;
}