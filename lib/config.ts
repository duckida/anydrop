/**
 * Deployment configuration.
 *
 * Everything is read from the environment at request time so that a Vercel
 * project can be reconfigured without rebuilding. The Anycubic token is never
 * written to a cookie or sent to the browser.
 */

export type Region = "global" | "cn";
export type AuthMode = "web" | "slicer";
export type UploadMode = "auto" | "direct" | "blob";
export type BlobAccess = "public" | "private";

export interface Endpoints {
  apiBase: string;
  authOrigin: string;
  imageBase: string;
}

const REGION_ENDPOINTS: Record<Region, Endpoints> = {
  global: {
    apiBase: "https://cloud-universe.anycubic.com/p/p/workbench/api",
    authOrigin: "https://uc.makeronline.com",
    imageBase: "https://workbentch.s3.us-east-2.amazonaws.com/",
  },
  cn: {
    apiBase: "https://cloud-platform.anycubicloud.com/p/p/workbench/api",
    authOrigin: "https://uc.makeronline.cn",
    imageBase: "https://workbentch.s3.us-east-2.amazonaws.com/",
  },
};

export interface AppConfig {
  token: string;
  authMode: AuthMode;
  region: Region;
  endpoints: Endpoints;
  password: string;
  sessionSecret: string;
  uploadMode: UploadMode;
  blobToken: string;
  blobAccess: BlobAccess;
  maxUploadBytes: number;
  maxRelayBytes: number;
  demo: boolean;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  const normalised = (value ?? "").trim().toLowerCase();
  return (allowed as readonly string[]).includes(normalised) ? (normalised as T) : fallback;
}

function megabytes(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed * 1024 * 1024);
}

function kilobytes(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed * 1024);
}

export function getConfig(): AppConfig {
  const region = oneOf<Region>(process.env.ANYCUBIC_REGION, ["global", "cn"], "global");
  const authMode = oneOf<AuthMode>(process.env.ANYCUBIC_AUTH_MODE, ["web", "slicer"], "web");
  const uploadMode = oneOf<UploadMode>(process.env.ANYDROP_UPLOAD_MODE, ["auto", "direct", "blob"], "auto");
  const blobAccess = oneOf<BlobAccess>(process.env.ANYDROP_BLOB_ACCESS, ["public", "private"], "public");

  return {
    token: (process.env.ANYCUBIC_TOKEN ?? "").trim(),
    authMode,
    region,
    endpoints: REGION_ENDPOINTS[region],
    password: (process.env.ANYDROP_PASSWORD ?? "").trim(),
    sessionSecret: (process.env.ANYDROP_SESSION_SECRET ?? "").trim(),
    uploadMode,
    blobToken: (process.env.BLOB_READ_WRITE_TOKEN ?? "").trim(),
    blobAccess,
    maxUploadBytes:
      process.env.ANYDROP_MAX_UPLOAD_KB !== undefined
        ? kilobytes(process.env.ANYDROP_MAX_UPLOAD_KB, 2048)
        : megabytes(process.env.ANYDROP_MAX_UPLOAD_MB, 2),
    maxRelayBytes: megabytes(process.env.ANYDROP_MAX_RELAY_MB, 256),
    demo: process.env.ANYDROP_DEMO === "1",
  };
}

export function publicConfig() {
  const config = getConfig();
  return {
    region: config.region,
    authMode: config.authMode,
    uploadMode: config.uploadMode,
    blobEnabled: Boolean(config.blobToken),
    blobAccess: config.blobAccess,
    demo: config.demo,
    configured: Boolean(config.token) || config.demo,
    maxUploadBytes: config.maxUploadBytes,
    maxRelayBytes: config.maxRelayBytes,
  };
}
