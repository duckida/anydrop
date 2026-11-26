/**
 * A small, dependency-free client for the Anycubic cloud API.
 *
 * The request signing, endpoint paths and payloads mirror
 * `anycubic-cloud-api` (the library behind the hass-anycubic integration).
 * Only the parts this app needs are implemented.
 */
import crypto from "node:crypto";
import { getConfig, type AuthMode } from "./config";

const APP_ID = "f9b3528877c94d5c9c5af32245db46ef";
const APP_SECRET = "0cf75926606049a3937f56b0373b99fb";
const VERSIONS: Record<AuthMode, string> = {
  web: "1.0.0",
  slicer: "V3.0.0",
};
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const REQUEST_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 10 * 60_000;

export class AnycubicError extends Error {
  readonly code?: number;
  readonly status?: number;
  readonly detail?: unknown;

  constructor(message: string, options: { code?: number; status?: number; detail?: unknown } = {}) {
    super(message);
    this.name = "AnycubicError";
    this.code = options.code;
    this.status = options.status;
    this.detail = options.detail;
  }
}

export interface CloudStore {
  used_bytes: number;
  total_bytes: number;
  used: string;
  total: string;
  user_file_exists?: boolean;
}

export interface StorageLock {
  id: number;
  preSignUrl: string;
}

export interface RawSlot {
  index?: number;
  sku?: string;
  type?: string;
  color?: number[];
  status?: number;
  edit_status?: number;
  consumables_percent?: number;
}

export interface RawMultiColorBox {
  id?: number;
  status?: number;
  model_id?: number;
  loaded_slot?: number;
  temp?: number;
  humidity?: number;
  slots?: RawSlot[];
}

export interface RawPrinter {
  id: number;
  name?: string;
  model?: string;
  machine_type?: number;
  device_status?: number;
  is_printing?: number;
  ready_status?: number;
  status?: number;
  type_function_ids?: number[];
  parameter?: {
    curr_nozzle_temp?: number;
    curr_hotbed_temp?: number;
    target_nozzle_temp?: number;
    target_hotbed_temp?: number;
    [key: string]: unknown;
  };
  multi_color_box?: RawMultiColorBox | RawMultiColorBox[] | null;
  [key: string]: unknown;
}

export interface RawProject {
  id: number;
  printer_id?: number;
  gcode_id?: number;
  gcode_name?: string;
  name?: string;
  img?: string;
  estimate?: number;
  remain_time?: number;
  print_time?: number;
  total_time?: string;
  progress?: number;
  print_status?: number;
  pause?: number;
  status?: number;
  material?: string;
  material_type?: number;
  slice_param?: SliceParam | null;
  [key: string]: unknown;
}

export interface RawFile {
  id: number;
  filename?: string;
  old_filename?: string;
  size?: number;
  gcode_id?: number | null;
  estimate?: number | null;
  material_name?: string | null;
  layer_height?: number | null;
  thumbnail?: string | null;
  create_time?: number;
  [key: string]: unknown;
}

export interface PaintInfo {
  paint_index: number;
  filament_used: number;
  material_type: string;
  paint_color?: number[];
  [key: string]: unknown;
}

export interface SliceParam {
  paint_infos?: PaintInfo[];
  layer_height?: number | string;
  image_id?: string;
  [key: string]: unknown;
}

export interface GcodeInfo {
  file_id: number;
  name: string;
  size: number;
  estimate: number;
  gcode_id: number;
  status?: number;
  progress?: number;
  machine_class?: number;
  image_id?: string;
  create_time?: number;
  slice_param?: SliceParam | null;
  [key: string]: unknown;
}

interface RequestOptions {
  method?: "GET" | "POST";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  token?: string | null;
  mode?: AuthMode;
  timeoutMs?: number;
}

interface ApiEnvelope<T> {
  code?: number;
  msg?: string;
  data?: T;
}

let slicerTokenCache: { token: string; obtainedAt: number } | null = null;
const SLICER_TOKEN_TTL_MS = 45 * 60_000;

function authHeaders(mode: AuthMode, token?: string | null): Record<string, string> {
  const config = getConfig();
  const timestamp = Date.now();
  const nonce = crypto.randomUUID();
  const version = VERSIONS[mode];
  const signature = crypto
    .createHash("md5")
    .update(`${APP_ID}${timestamp}${version}${APP_SECRET}${nonce}${APP_ID}`)
    .digest("hex");

  const headers: Record<string, string> = {
    "Xx-Device-Type": mode === "slicer" ? "pcf" : "web",
    "Xx-Is-Cn": "1",
    "Xx-Nonce": nonce,
    "Xx-Signature": signature,
    "Xx-Timestamp": String(timestamp),
    "Xx-Version": version,
    "Content-Type": "application/json",
    "XX-LANGUAGE": "US",
    "User-Agent": USER_AGENT,
  };

  if (mode === "web") {
    headers.Origin = config.endpoints.authOrigin;
  }
  if (token) {
    headers["XX-Token"] = token;
  }

  return headers;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const config = getConfig();
  const url = new URL(`${config.endpoints.apiBase}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function explainError(code: number, message: string): string {
  if (code === 10001) {
    return "Anycubic rejected the token (expired or invalid). Refresh ANYCUBIC_TOKEN.";
  }
  if (/频繁|too frequent/i.test(message)) {
    return "Anycubic is rate limiting token exchanges. Wait a minute and try again.";
  }
  return message || `Anycubic returned error ${code}`;
}

async function rawRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const config = getConfig();
  const mode = options.mode ?? config.authMode;
  const method = options.method ?? "GET";
  const url = buildUrl(path, options.query);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: authHeaders(mode, options.token),
      body: method === "POST" ? JSON.stringify(options.body ?? {}) : undefined,
      signal: AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "network error";
    throw new AnycubicError(`Could not reach the Anycubic cloud (${message}).`, { detail: error });
  }

  const text = await response.text();
  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = text ? (JSON.parse(text) as ApiEnvelope<T>) : null;
  } catch {
    // Non-JSON responses are reported below with a useful status code.
  }

  if (!response.ok) {
    throw new AnycubicError(`Anycubic API returned HTTP ${response.status}.`, {
      status: response.status,
      detail: envelope ?? text.slice(0, 400),
    });
  }

  if (!envelope) {
    throw new AnycubicError("Anycubic returned an unexpected response.", {
      status: response.status,
      detail: text.slice(0, 400),
    });
  }

  const code = typeof envelope.code === "number" ? envelope.code : 0;
  if (code !== 0 && code !== 200) {
    const message = explainError(code, envelope.msg ?? "");
    throw new AnycubicError(message, { code, detail: envelope });
  }

  return envelope.data as T;
}

async function getSlicerUserToken(force = false): Promise<string> {
  const config = getConfig();
  if (config.authMode !== "slicer") return config.token;

  if (!force && slicerTokenCache && Date.now() - slicerTokenCache.obtainedAt < SLICER_TOKEN_TTL_MS) {
    return slicerTokenCache.token;
  }

  const data = await rawRequest<{ token?: string }>("/v3/public/loginWithAccessToken", {
    method: "POST",
    mode: "slicer",
    token: null,
    body: {
      device_type: "pcf",
      access_token: config.token,
    },
  });

  if (!data?.token) {
    throw new AnycubicError("Anycubic did not return a user token for this access token.");
  }

  slicerTokenCache = { token: data.token, obtainedAt: Date.now() };
  return data.token;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const config = getConfig();
  if (!config.token) {
    throw new AnycubicError("ANYCUBIC_TOKEN is not set.");
  }

  const token = options.token !== undefined ? options.token : await getSlicerUserToken();

  try {
    return await rawRequest<T>(path, { ...options, token });
  } catch (error) {
    // A slicer access token can be rotated server-side; retry once with a fresh
    // exchange when the cloud says the token is no longer valid.
    if (
      config.authMode === "slicer" &&
      error instanceof AnycubicError &&
      error.code === 10001 &&
      options.token === undefined
    ) {
      slicerTokenCache = null;
      const fresh = await getSlicerUserToken(true);
      return rawRequest<T>(path, { ...options, token: fresh });
    }
    throw error;
  }
}

export const anycubic = {
  async getUserStore(): Promise<CloudStore> {
    return request<CloudStore>("/work/index/getUserStore", { method: "POST", body: {} });
  },

  async lockStorage(size: number, name: string): Promise<StorageLock> {
    const data = await request<StorageLock>("/v2/cloud_storage/lockStorageSpace", {
      method: "POST",
      body: { size, name, is_temp_file: 0 },
    });
    if (!data?.id || !data?.preSignUrl) {
      throw new AnycubicError("Anycubic did not return an upload slot.");
    }
    return data;
  },

  async unlockStorage(id: number, deleteObject = false): Promise<void> {
    await request("/v2/cloud_storage/unlockStorageSpace", {
      method: "POST",
      body: { id, is_delete_cos: deleteObject ? 1 : 0 },
    });
  },

  async claimUpload(lockId: number): Promise<number> {
    const data = await request<{ id?: number }>("/v2/profile/newUploadFile", {
      method: "POST",
      body: { user_lock_space_id: lockId },
    });
    if (!data?.id) {
      throw new AnycubicError("Anycubic did not accept the uploaded file.");
    }
    return data.id;
  },

  async listFiles(page = 1, limit = 20): Promise<RawFile[]> {
    const data = await request<RawFile[] | null>("/work/index/files", {
      method: "POST",
      body: { page, limit },
    });
    return Array.isArray(data) ? data : [];
  },

  async getGcodeInfo(gcodeId: number): Promise<GcodeInfo> {
    return request<GcodeInfo>("/work/gcode/infoFdm", {
      query: { id: gcodeId },
    });
  },

  async getPrinters(): Promise<RawPrinter[]> {
    const data = await request<RawPrinter[] | null>("/work/printer/getPrinters");
    return Array.isArray(data) ? data : [];
  },

  async getProjects(page = 1, limit = 30): Promise<RawProject[]> {
    const data = await request<RawProject[] | null>("/work/project/getProjects", {
      query: { page, limit },
    });
    return Array.isArray(data) ? data : [];
  },

  async sendOrder(payload: Record<string, unknown>): Promise<unknown> {
    return request("/work/operation/sendOrder", { method: "POST", body: payload });
  },

  /**
   * Streams bytes to the presigned S3 URL that came with a storage lock.
   * The URL is a capability, so callers must only pass URLs they just got
   * from `lockStorage` (the route handlers verify the host as well).
   */
  async uploadToPresignedUrl(url: string, body: Uint8Array): Promise<void> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "PUT",
        // Node's Buffer is a Uint8Array at runtime. The DOM type for BodyInit
        // insists on an ArrayBuffer-backed view, which Buffer satisfies.
        body: body as unknown as BodyInit,
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "network error";
      throw new AnycubicError(`The upload to Anycubic's storage failed (${message}).`, {
        detail: error,
      });
    }

    if (!response.ok) {
      throw new AnycubicError(`Anycubic's storage rejected the upload (HTTP ${response.status}).`, {
        status: response.status,
        detail: (await response.text()).slice(0, 400),
      });
    }
  },
};

export function isPresignedAnycubicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return (
      host.endsWith(".amazonaws.com") ||
      host.endsWith(".myqcloud.com") ||
      host.endsWith(".cos.ap-guangzhou.myqcloud.com") ||
      host.endsWith(".anycubic.com") ||
      host.endsWith(".anycubicloud.com")
    );
  } catch {
    return false;
  }
}
