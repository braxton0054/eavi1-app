import { DeleteObjectCommand, GetObjectCommand, S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

function client() {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "default",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  });
}

/**
 * The bucket name the API calls must use.
 *
 * Contabo scopes buckets per account: the API form is `<accountId>:<bucket>` whenever the
 * account id is set. The plain name answers a HEAD but rejects a PUT with
 * InvalidAccessKeyId, which reads like bad credentials and sends you hunting in the wrong
 * panel — the public URL already carries the same prefix (see uploadFile).
 */
function apiBucket() {
  const bucket = process.env.S3_BUCKET!;
  const accountId = process.env.S3_ACCOUNT_ID;
  return accountId ? `${accountId}:${bucket}` : bucket;
}

/** Identifies an object without exposing how to reach it. */
function keyFromUrl(url: string): string {
  const endpoint = process.env.S3_ENDPOINT?.replace(/\/$/, "") ?? "";
  const accountId = process.env.S3_ACCOUNT_ID;
  const bucket = process.env.S3_BUCKET ?? "";
  const prefix = accountId ? `${endpoint}/${accountId}:${bucket}/` : `${endpoint}/${bucket}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : url.slice(url.lastIndexOf("/") + 1);
}

export function storageConfigured() {
  return Boolean(
    process.env.S3_ENDPOINT &&
      process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY,
  );
}

export async function uploadFile(key: string, body: Buffer, contentType: string) {
  await client().send(
    new PutObjectCommand({
      Bucket: apiBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: "public-read",
    }),
  );
  const endpoint = process.env.S3_ENDPOINT!.replace(/\/$/, "");
  // Contabo public object URLs include the account id prefix.
  const accountId = process.env.S3_ACCOUNT_ID;
  if (accountId) {
    return `${endpoint}/${accountId}:${process.env.S3_BUCKET}/${key}`;
  }
  if (process.env.S3_FORCE_PATH_STYLE === "true") {
    return `${endpoint}/${process.env.S3_BUCKET}/${key}`;
  }
  return `${endpoint}/${key}`;
}
/**
 * Uploads an object that is NOT publicly readable.
 *
 * Used for anything with a lifetime — chat documents especially. A public-read object keeps
 * working from a copied URL long after the row is gone, so private-by-default is the only way
 * "deleted after seven days" can mean what it says.
 */
export async function uploadPrivateFile(key: string, body: Buffer, contentType: string) {
  await client().send(
    new PutObjectCommand({
      Bucket: apiBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: "private",
    }),
  );
  return key;
}

/** Streams an object back for a server-side download. The browser never sees the bucket URL. */
export async function readFile(key: string) {
  const response = await client().send(
    new GetObjectCommand({ Bucket: apiBucket(), Key: key }),
  );
  if (!response.Body) return null;
  const bytes = await response.Body.transformToByteArray();
  return { bytes: Buffer.from(bytes), contentType: response.ContentType ?? "application/octet-stream" };
}

/**
 * Removes an object. Reports whether the object is gone, counting "already absent" as success:
 * the caller is deleting, and a missing file is the state it wanted.
 */
export async function deleteFile(key: string): Promise<boolean> {
  try {
    await client().send(new DeleteObjectCommand({ Bucket: apiBucket(), Key: key }));
    return true;
  } catch (error) {
    const name = (error as { name?: string }).name ?? "";
    if (name === "NoSuchKey" || name === "NotFound") return true;
    throw error;
  }
}

/** Removes an object that was stored under a full public URL (older uploads). */
export async function deleteFileByUrl(url: string): Promise<boolean> {
  return deleteFile(keyFromUrl(url));
}
