import { randomUUID } from "node:crypto";

// Short-lived, single-use server-browser capabilities, never operator credentials.
// Only the approved server replay launcher issues them; no public mint endpoint.
const capabilities = new Map<string, number>();
export function issueReplicaCapability() {
  const now = Date.now();
  for (const [token, expiry] of capabilities) if (expiry <= now) capabilities.delete(token);
  if (capabilities.size >= 32) throw new Error("Too many active supervised replay capabilities.");
  const token = randomUUID();
  capabilities.set(token, now + 70_000);
  return token;
}
export function consumeReplicaCapability(token: unknown) {
  if (typeof token !== "string") return false;
  const expiry = capabilities.get(token);
  capabilities.delete(token);
  return expiry !== undefined && expiry > Date.now();
}
export function revokeReplicaCapability(token: string) { capabilities.delete(token); }