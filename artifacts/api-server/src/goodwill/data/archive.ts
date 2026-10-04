import { DataError, type Archive, type Artifact } from "./types";
import { hash, MAX_BYTES } from "./normalize";

interface File {
  save(bytes: Buffer, options: object): Promise<unknown>;
  getMetadata(): Promise<[{size?: string | number; generation?: string; metadata?:{checksum?:string}},...unknown[]]>;
  download(options?: object): Promise<[Buffer,...unknown[]]>;
}
/** Inject the unchanged sidecar-authenticated GCS SDK client from the approved storage template. */
export interface Storage { bucket(name: string): { file(name: string, options?: object): File } }
export class PrivateArchive implements Archive {
  private bucket: string; private prefix: string;
  constructor(private storage: Storage, privateDir: string, private signer: (bucket: string, name: string, expiresAt: string) => Promise<string>) {
    const match = /^\/([^/]+)\/(.+)$/.exec(privateDir);
    if (!match || match[2].includes("..")) throw new DataError("PRIVATE_STORAGE_NOT_CONFIGURED", "An approved private object directory is required.", 503);
    this.bucket = match[1]; this.prefix = match[2].replace(/\/$/, "") + "/goodwill";
  }
  private name(id: string, inbox = false) {
    if (!/^[a-zA-Z0-9_-]{1,160}$/.test(id)) throw new DataError("INVALID_ARTIFACT_ID", "Only opaque server-issued object IDs are allowed.");
    return `${this.prefix}/${inbox ? "inbox" : "immutable"}/${id}.csv`;
  }
  async put(id: string, bytes: Uint8Array, metadata: { filename: string; checksum: string }): Promise<Artifact> {
    if (!bytes.length || bytes.length > MAX_BYTES || hash(bytes) !== metadata.checksum)
      throw new DataError("ARTIFACT_IDENTITY_MISMATCH", "Original bytes do not match the declared artifact.");
    const name = this.name(id);
    try {
      await this.storage.bucket(this.bucket).file(name).save(Buffer.from(bytes), {
        resumable: false, validation: "crc32c", preconditionOpts: { ifGenerationMatch: 0 },
        metadata: { contentType: "application/octet-stream", metadata: { synthetic: "true", checksum: metadata.checksum } },
      });
    } catch (e) {
      if (Number((e as {code?: number}).code) !== 412) throw new DataError("STORAGE_UNAVAILABLE", "Immutable private archive write failed.", 503);
      if (hash(await this.read(id)) !== metadata.checksum) throw new DataError("IMMUTABLE_ARTIFACT_CONFLICT", "An immutable object ID already has different bytes.", 409);
    }
    return { artifactId: id, filename: metadata.filename, checksum: metadata.checksum, byteSize: bytes.length,
      archivedAt: new Date().toISOString(), synthetic: true };
  }
  private async readName(name: string, verifyHash=false) {
    try {
      const file = this.storage.bucket(this.bucket).file(name), [metadata] = await file.getMetadata();
      const size = Number(metadata.size);
      if (!Number.isSafeInteger(size) || size < 1 || size > MAX_BYTES) throw new DataError("INVALID_FILE_SIZE", "Stored file exceeds approved bounds.");
      // Pin the generation observed during size checking; inbox can never change mid-read.
      if (!metadata.generation || !/^\d+$/.test(metadata.generation))throw new DataError("STORAGE_UNAVAILABLE","Storage did not supply an immutable read generation.",503);
      const pinned = this.storage.bucket(this.bucket).file(name, { generation: metadata.generation });
      const [bytes] = await pinned.download({ validation: "crc32c" });
      if (bytes.length !== size) throw new DataError("ARTIFACT_IDENTITY_MISMATCH", "Object size changed while reading.");
      if (verifyHash && (!metadata.metadata?.checksum || hash(bytes)!==metadata.metadata.checksum))
        throw new DataError("ARTIFACT_IDENTITY_MISMATCH","Immutable archive SHA256 verification failed.",409);
      return new Uint8Array(bytes);
    } catch (e) { if (e instanceof DataError) throw e; throw new DataError("STORAGE_UNAVAILABLE", "Private object could not be read.", 503); }
  }
  async read(id: string) { return this.readName(this.name(id),true); }
  async readUpload(id: string) { return this.readName(this.name(id, true)); }
  async signUpload(id: string, expiresAt: string) { return this.signer(this.bucket, this.name(id, true), expiresAt); }
}
/** Same sidecar signing protocol as the official App Storage template; no credentials or URLs persisted. */
export async function signPrivateUpload(bucket:string,name:string,expiresAt:string) {
  const response=await fetch("http://127.0.0.1:1106/object-storage/signed-object-url",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({bucket_name:bucket,object_name:name,method:"PUT",expires_at:expiresAt}),
    signal:AbortSignal.timeout(30000),
  });
  if(!response.ok)throw new DataError("STORAGE_SIGNING_FAILED","Private upload capability could not be issued.",503);
  const body=await response.json() as {signed_url?:unknown};
  if(typeof body.signed_url!=="string")throw new DataError("STORAGE_SIGNING_FAILED","Storage returned an invalid upload capability.",503);
  return body.signed_url;
}