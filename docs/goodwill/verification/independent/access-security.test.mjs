import {test, mock} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";

let account = {
  id: "synthetic-clerk-user",
  primaryEmailAddressId: "mail-primary",
  emailAddresses: [
    {id: "mail-primary", emailAddress: "approved@demo.invalid", verification: {status: "verified"}},
    {id: "mail-secondary", emailAddress: "secondary@demo.invalid", verification: {status: "verified"}},
  ],
  banned: false,
  locked: false,
};
let lookups = 0;
mock.module("@clerk/express", {namedExports: {
  getAuth: request => ({userId: request.clerkSessionUserId ?? null}),
  clerkClient: {users: {getUser: async id => {
    lookups++;
    assert.equal(id, "synthetic-clerk-user");
    return structuredClone(account);
  }}},
}});

const root = process.env.GOODWILL_QA_ROOT;
const policy = await import(process.env.GOODWILL_QA_POLICY_MODULE);
const capability = await import(process.env.GOODWILL_QA_CAPABILITY_MODULE);
const auth = await import(process.env.GOODWILL_QA_OPERATOR_AUTH_MODULE);
const destination = await import(process.env.GOODWILL_QA_REPLICA_DESTINATION_MODULE);
const makeAccount = patch => ({...account, ...patch});

test("the verified Clerk session ID and verified configured primary address are jointly required", () => {
  const email = policy.parseDemoEmail(" APPROVED@DEMO.INVALID ");
  assert.equal(policy.approvedOperator(account.id, account, email), account.id);
  assert.equal(policy.parseDemoEmail(undefined), null);
  assert.equal(policy.approvedOperator(account.id, account, null), null);
  assert.equal(policy.approvedOperator(null, account, email), null);
  assert.equal(policy.approvedOperator("another-synthetic-user", account, email), null);
  assert.equal(policy.approvedOperator(account.id, makeAccount({id: "another-synthetic-user"}), email), null);
  const secondaryOnly = makeAccount({
    primaryEmailAddressId: "mail-primary",
    emailAddresses: [
      {id: "mail-primary", emailAddress: "unapproved@demo.invalid", verification: {status: "verified"}},
      {id: "mail-secondary", emailAddress: "approved@demo.invalid", verification: {status: "verified"}},
    ],
  });
  assert.equal(policy.approvedOperator(account.id, secondaryOnly, email), null);
  for (const status of ["unverified", "expired", "failed"]) {
    assert.equal(policy.approvedOperator(account.id, makeAccount({
      emailAddresses: [{id: "mail-primary", emailAddress: "approved@demo.invalid", verification: {status}}],
    }), email), null);
  }
  assert.equal(policy.approvedOperator(account.id, makeAccount({banned: true}), email), null);
  assert.equal(policy.approvedOperator(account.id, makeAccount({locked: true}), email), null);
  for (const value of ["*", "demo", "demo.invalid", "one@demo.invalid,two@demo.invalid"])
    assert.throws(() => policy.parseDemoEmail(value));
});

test("the Clerk account result is coalesced per request, never reused for a later revocation request", async () => {
  account = makeAccount({});
  lookups = 0;
  const sameRequest = {clerkSessionUserId: account.id};
  const sameRequestResults = await Promise.all([
    auth.authorizeOperator(sameRequest),
    auth.authorizeOperator(sameRequest),
  ]);
  assert.deepEqual(sameRequestResults, [account.id, account.id]);
  assert.equal(lookups, 1);

  account = makeAccount({banned: true});
  assert.equal(await auth.authorizeOperator({clerkSessionUserId: account.id}), null);
  assert.equal(lookups, 2);

  account = makeAccount({banned: false, locked: true});
  assert.equal(await auth.authorizeOperator({clerkSessionUserId: account.id}), null);
  assert.equal(lookups, 3);
});

test("replica capabilities expire, consume once and revoke without becoming user authorization", () => {
  const now = Date.now;
  let time = 1_800_000_000_000;
  Date.now = () => time;
  try {
    const token = capability.issueReplicaCapability();
    assert.match(token, /^[0-9a-f-]{36}$/i);
    assert.equal(capability.consumeReplicaCapability(token), true);
    assert.equal(capability.consumeReplicaCapability(token), false);
    const revoked = capability.issueReplicaCapability();
    capability.revokeReplicaCapability(revoked);
    assert.equal(capability.consumeReplicaCapability(revoked), false);
    const expired = capability.issueReplicaCapability();
    time += 70_001;
    assert.equal(capability.consumeReplicaCapability(expired), false);
  } finally {
    Date.now = now;
  }
});

test("the configured replica destination, not forwarded request headers, defines the approved app origin", () => {
  assert.equal(destination.approvedReplicaUrl, "https://replica.demo.invalid/replica/upright");
  assert.equal(destination.approvedAppOrigin, "https://replica.demo.invalid");
});

test("origin/CORS guards precede access and capability paths; Clerk loads only outside the public replica", async () => {
  const read = file => readFile(path.join(root, file), "utf8");
  const [app, runtime, dataRouter, oldRouter, adapters, replay, frontend, gate, clerkRoutes, proxy, destinationSource] = await Promise.all([
    read("artifacts/api-server/src/app.ts"),
    read("artifacts/api-server/src/goodwill/runtime.ts"),
    read("artifacts/api-server/src/goodwill/data/router.ts"),
    read("artifacts/api-server/src/routes/goodwill.ts"),
    read("artifacts/api-server/src/lib/goodwillAdapters.ts"),
    read("artifacts/api-server/src/goodwill/acquisition/browser.ts"),
    read("artifacts/goodwill/src/App.tsx"),
    read("artifacts/goodwill/src/auth/OperatorGate.tsx"),
    read("artifacts/goodwill/src/auth/ClerkRoutes.tsx"),
    read("artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts"),
    read("artifacts/api-server/src/goodwill/replicaDestination.ts"),
  ]);
  assert.match(app, /origin: \(origin, callback\) => callback\(null, !origin \|\| origin === approvedAppOrigin\)/);
  assert.match(app, /if \(\(origin && origin !== approvedAppOrigin\) \|\| \(mutation && origin !== approvedAppOrigin\)\)/);
  assert.match(app, /const mutation = !\["GET", "HEAD", "OPTIONS"\]\.includes\(req\.method\)/);
  assert.ok(app.indexOf('app.use("/api/goodwill", (req, res, next) =>') < app.indexOf('app.get("/api/goodwill/access"'));
  assert.ok(app.indexOf('app.get("/api/goodwill/access"') < app.indexOf("consumeReplicaCapability("));
  assert.match(app, /req\.method === "POST" && req\.path === "\/report"/);
  assert.match(app, /generator && consumeReplicaCapability\(req\.headers\["x-goodwill-replica-capability"\]\)/);
  assert.doesNotMatch(app, /origin[^\n]*x-forwarded|x-forwarded[^\n]*origin/);
  assert.match(app, /req\.path\.startsWith\("\/v2\/"\)\) \{ next\(\); return; \}/);
  assert.match(destinationSource, /process\.env\.GOODWILL_REPLICA_URL/);
  assert.match(destinationSource, /process\.env\.NODE_ENV === "development"/);
  assert.match(destinationSource, /export const approvedAppOrigin = destination\.origin/);
  assert.match(proxy, /const raw = Array\.isArray\(forwarded\) \? forwarded\[0\] : forwarded/);
  assert.match(runtime, /if \(!await authorizeOperator\(req\)\)/);
  assert.match(runtime, /router\.use\(createDataRouter\(intake, reporting, authorizeOperator\)\)/);
  assert.match(dataRouter, /router\.use\(async\(req,res,next\)=>/);
  assert.match(oldRouter, /router\.post\("\/goodwill\/report"/);
  assert.match(oldRouter, /router\.post\("\/goodwill\/imports"/);
  assert.match(oldRouter, /router\.get\("\/goodwill\/latest"/);
  assert.match(adapters, /issueReplicaCapability\(\)/);
  assert.match(adapters, /revokeReplicaCapability\(capability\)/);
  assert.match(adapters, /extraHTTPHeaders: \{ "X-Goodwill-Replica-Capability": capability \}/);
  assert.match(replay, /url\.origin === this\.url\.origin/);

  // The public replica selects no ClerkProvider or Clerk hooks at render time.
  assert.match(frontend, /const replica = window\.location\.pathname ===/);
  assert.match(frontend, /replica \? <QueryClientProvider/);
  assert.doesNotMatch(frontend, /^import .*from ['"]@\/auth\/(ClerkRoutes|OperatorGate)['"]/m);
  assert.match(frontend, /lazy\(\(\) => import\('@\/auth\/ClerkRoutes'\)/);
  assert.match(frontend, /lazy\(\(\) => import\('@\/auth\/OperatorGate'\)/);
  assert.doesNotMatch(await read("artifacts/goodwill/src/features/acquisition/ReplicaPortal.tsx"), /@clerk\/|useUser|useClerk/);

  // Denials and auth errors clear cached report queries, and stale approved
  // data cannot keep the protected children mounted after a failed check.
  assert.match(gate, /refetchInterval: 15_000/);
  assert.match(gate, /if \(access\.isError \|\| \(access\.data && !access\.data\.approved\)\)/);
  assert.match(gate, /user && !access\.isError && access\.data\?\.signedIn && access\.data\.approved/);
  assert.match(clerkRoutes, /if \(!clerkPubKey\) throw new Error/);
});