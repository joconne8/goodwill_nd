import { Storage } from "@google-cloud/storage";

// Unchanged sidecar credential protocol from the approved App Storage template.
const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
export const privateStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});