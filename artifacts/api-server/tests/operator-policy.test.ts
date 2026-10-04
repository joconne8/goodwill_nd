import { test } from "node:test";
import assert from "node:assert/strict";
import { approvedOperator, approvedOperatorForEmails, parseDemoEmail, parseDemoOperatorEmails, type VerifiedAccount } from "../src/goodwill/operatorPolicy";

const id = "user_DemoAccount00001";
const email = "approved@example.invalid";
const account: VerifiedAccount = {
  id, primaryEmailAddressId: "email_primary",
  emailAddresses: [{ id: "email_primary", emailAddress: email, verification: { status: "verified" } }],
};

test("demo approval requires verified identity and exactly the configured verified primary email", () => {
  assert.equal(approvedOperator(id, account, parseDemoEmail(undefined)), null);
  assert.equal(approvedOperator(null, account, email), null);
  assert.equal(approvedOperator("user_OtherAccount0001", account, email), null);
  assert.equal(approvedOperator(id, account, "someone-else@example.invalid"), null);
  assert.equal(approvedOperator(id, account, email), id);
  assert.equal(parseDemoEmail(" APPROVED@EXAMPLE.INVALID "), email);
});

test("unverified, secondary-only, absent, banned and locked accounts stay denied", () => {
  assert.equal(approvedOperator(id, null, email), null);
  assert.equal(approvedOperator(id, { ...account, banned: true }, email), null);
  assert.equal(approvedOperator(id, { ...account, locked: true }, email), null);
  assert.equal(approvedOperator(id, { ...account, emailAddresses: [] }, email), null);
  assert.equal(approvedOperator(id, { ...account, primaryEmailAddressId: "other" }, email), null);
  for (const status of ["unverified", "expired", "failed"]) {
    assert.equal(approvedOperator(id, {
      ...account, emailAddresses: [{ id: "email_primary", emailAddress: email, verification: { status } }],
    }, email), null);
  }
});

test("configuration accepts one email only, not wildcard/domain/persona/multiple accounts", () => {
  for (const invalid of ["*", "finance", "@example.invalid", "user_x", "a@example.invalid,b@example.invalid"]) {
    assert.throws(() => parseDemoEmail(invalid));
  }
  assert.equal(parseDemoEmail(""), null);
});

test("the partner and explicitly added owner both pass; unrelated accounts stay denied", () => {
  const owner = "owner@example.invalid";
  const approved = parseDemoOperatorEmails(email, owner);
  const withPrimary = (address: string): VerifiedAccount => ({
    ...account,
    emailAddresses: [{ id: "email_primary", emailAddress: address, verification: { status: "verified" } }],
  });
  assert.deepEqual(approved, [email, owner]);
  assert.equal(approvedOperatorForEmails(id, account, approved), id);
  assert.equal(approvedOperatorForEmails(id, withPrimary(owner), approved), id);
  const ownerAccount = { ...withPrimary(owner), id: "user_OwnerAccount00001" };
  assert.equal(approvedOperatorForEmails(ownerAccount.id, ownerAccount, approved), ownerAccount.id);
  assert.equal(approvedOperatorForEmails(id, withPrimary("other@example.invalid"), approved), null);
  assert.equal(approvedOperatorForEmails(id, { ...withPrimary(owner), locked: true }, approved), null);
  assert.equal(approvedOperatorForEmails(id, { ...withPrimary(owner), banned: true }, approved), null);
  assert.equal(approvedOperatorForEmails("wrong-id", withPrimary(owner), approved), null);
  assert.equal(approvedOperatorForEmails(id, {
    ...account, emailAddresses: [
      { id: "email_primary", emailAddress: "other@example.invalid", verification: { status: "verified" } },
      { id: "secondary", emailAddress: owner, verification: { status: "verified" } },
    ],
  }, approved), null);
  assert.equal(approvedOperatorForEmails(id, {
    ...account, emailAddresses: [{ id: "email_primary", emailAddress: owner, verification: { status: "unverified" } }],
  }, approved), null);
});

test("additional approval is optional, deduplicated, and cannot replace missing partner configuration", () => {
  assert.deepEqual(parseDemoOperatorEmails(email, undefined), [email]);
  assert.deepEqual(parseDemoOperatorEmails(email, " APPROVED@EXAMPLE.INVALID "), [email]);
  assert.deepEqual(parseDemoOperatorEmails(undefined, "owner@example.invalid"), []);
  assert.equal(approvedOperatorForEmails(id, account, []), null);
  assert.equal(approvedOperatorForEmails(id, account, [email, "two@example.invalid", "three@example.invalid"]), null);
  assert.throws(() => parseDemoOperatorEmails(email, "owner@example.invalid,other@example.invalid"));
});