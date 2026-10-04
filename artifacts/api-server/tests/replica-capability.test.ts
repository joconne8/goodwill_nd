import { test } from "node:test";
import assert from "node:assert/strict";
import { consumeReplicaCapability, issueReplicaCapability, revokeReplicaCapability } from "../src/goodwill/replicaCapability";

test("internal replica capability is opaque, single-use and explicitly revocable", () => {
  assert.equal(consumeReplicaCapability("client-provided-identity"), false);
  assert.equal(consumeReplicaCapability(undefined), false);
  const token = issueReplicaCapability();
  assert.equal(consumeReplicaCapability(token), true);
  assert.equal(consumeReplicaCapability(token), false);
  const revoked = issueReplicaCapability();
  revokeReplicaCapability(revoked);
  assert.equal(consumeReplicaCapability(revoked), false);
});