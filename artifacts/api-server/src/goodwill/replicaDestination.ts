// Trusted server configuration only; incoming Host/forwarded headers never set policy.
const configuredReplicaUrl = process.env.GOODWILL_REPLICA_URL ??
  (process.env.NODE_ENV === "development" && process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}/replica/upright` : undefined);
if (!configuredReplicaUrl) throw new Error("Configure one approved GOODWILL_REPLICA_URL.");
export const approvedReplicaUrl = configuredReplicaUrl;
const destination = new URL(approvedReplicaUrl);
if (!["http:", "https:"].includes(destination.protocol) || destination.username ||
    destination.password || destination.search || destination.hash)
  throw new Error("The approved replica destination must be an exact origin/path without credentials.");
export const approvedAppOrigin = destination.origin;