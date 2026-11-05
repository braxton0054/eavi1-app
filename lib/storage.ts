import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

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

export function storageConfigured() {
  return Boolean(
    process.env.S3_ENDPOINT &&
      process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY,
  );
}

export async function uploadFile(key: string, body: Buffer, contentType: string) {
  const bucket = process.env.S3_BUCKET!;
  await client().send(
    new PutObjectCommand({
      Bucket: bucket,
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
    return `${endpoint}/${accountId}:${bucket}/${key}`;
  }
  if (process.env.S3_FORCE_PATH_STYLE === "true") {
    return `${endpoint}/${bucket}/${key}`;
  }
  return `${endpoint}/${key}`;
}