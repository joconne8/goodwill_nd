export interface VerifiedAccount {
  id: string;
  primaryEmailAddressId: string | null;
  emailAddresses: Array<{
    id: string;
    emailAddress: string;
    verification?: { status: string } | null;
  }>;
  banned?: boolean;
  locked?: boolean;
}

/** One private, server-configured demo address. Never a domain/persona wildcard. */
export function parseDemoEmail(value: string | undefined): string | null {
  const email = value?.trim().toLowerCase();
  if (!email) return null; // unset development/production configuration denies all
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) {
    throw new Error("Invalid private demo-operator email configuration.");
  }
  return email;
}

/** Preserve the original partner approval and optionally add one approved owner. */
export function parseDemoOperatorEmails(primary: string | undefined, additional: string | undefined): readonly string[] {
  const partner = parseDemoEmail(primary);
  const owner = parseDemoEmail(additional);
  if (!partner) return []; // original approval configuration remains mandatory
  return [...new Set(owner ? [partner, owner] : [partner])];
}

export function approvedOperator(
  verifiedUserId: string | null,
  account: VerifiedAccount | null,
  approvedEmail: string | null,
): string | null {
  if (!verifiedUserId || !account || !approvedEmail || account.id !== verifiedUserId ||
      account.banned || account.locked) return null;
  const primary = account.emailAddresses.find(email => email.id === account.primaryEmailAddressId);
  return primary?.verification?.status === "verified" &&
    primary.emailAddress.trim().toLowerCase() === approvedEmail ? verifiedUserId : null;
}

export function approvedOperatorForEmails(
  verifiedUserId: string | null,
  account: VerifiedAccount | null,
  approvedEmails: readonly string[],
): string | null {
  if (approvedEmails.length > 2) return null;
  for (const email of approvedEmails) {
    const id = approvedOperator(verifiedUserId, account, email);
    if (id) return id;
  }
  return null;
}