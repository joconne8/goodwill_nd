import type { EvidenceRecord, WorkflowFailure } from "@workspace/api-zod";
import type { Values } from "./types";
/** Frozen evidence wire contract uses strings, including integer cents; internal ledgers stay typed. */
export function wireValues(values: Values): EvidenceRecord["values"] {
  return Object.fromEntries(Object.entries(values).map(([key,value])=>[key,value===null ? "" : String(value)]));
}
const messages:Record<string,string>={
  MISSING_BUYER:"Buyer ID is absent; no replacement identity was inferred.",
  UNKNOWN_STORE:"Store attribution is unresolved and remains Unknown.",
  UNCONFIRMED_SUPPLIER:"Jewelry supplier is missing or unconfirmed.",
  SAME_KEY_SAME_VALUES:"This source identity already has identical normalized values.",
  CONFLICTING_IDENTITY:"This source identity has different values and requires review.",
  REVIEWED_CORRECTION:"Explicit synthetic correction was approved at this publication.",
};
export function wireReasons(codes:string[]):WorkflowFailure[] {
  return codes.map(code=>({code,message:messages[code]??"Source row failed the named validation rule.",
    retryable:false,nextAction:code==="SAME_KEY_SAME_VALUES" ? "No additional contribution." : "Inspect original source row and retained batch evidence; never infer a replacement."}));
}