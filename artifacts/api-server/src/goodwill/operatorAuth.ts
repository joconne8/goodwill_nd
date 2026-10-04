import { clerkClient, getAuth } from "@clerk/express";
import type { Request, Response } from "express";
import { approvedOperatorForEmails, parseDemoOperatorEmails } from "./operatorPolicy";
import { GetGoodwillOperatorAccessResponse } from "@workspace/api-zod";

// Never commit approved addresses. Preserve the original private partner approval.
const approvedEmails = parseDemoOperatorEmails(
  process.env.GOODWILL_DEMO_OPERATOR_EMAIL,
  process.env.GOODWILL_DEMO_ADDITIONAL_OPERATOR_EMAIL,
);
const approvals = new WeakMap<Request, Promise<string | null>>();

export async function authorizeOperator(request: Request): Promise<string | null> {
  const pending = approvals.get(request);
  if (pending) return pending;
  const verifiedUserId = getAuth(request).userId;
  const approval = (async () => {
    if (!verifiedUserId || !approvedEmails.length) return null;
    // Fresh server-to-Clerk verification, not browser fields/JWT custom metadata.
    const account = await clerkClient.users.getUser(verifiedUserId);
    return approvedOperatorForEmails(verifiedUserId, account, approvedEmails);
  })();
  approvals.set(request, approval);
  return approval;
}

export async function currentOperatorAccess(request: Request, response: Response) {
  response.setHeader("Cache-Control", "private, no-store");
  try {
    response.json(GetGoodwillOperatorAccessResponse.parse({
      signedIn: Boolean(getAuth(request).userId),
      approved: Boolean(await authorizeOperator(request)),
    }));
  } catch {
    response.status(503).json({ code: "AUTH_UNAVAILABLE", message: "Account approval verification is unavailable.", retainedPrevious: true });
  }
}