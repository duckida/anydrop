<img src="assets/icon.svg" width="64" height="64" alt="anydrop icon">

# anydrop

**Drop a G-code file. Start the print. From anywhere.**

anydrop is a small, self-hosted web app that sends G-code to your Anycubic printer through the Anycubic cloud — the same path the official app uses. It runs on Vercel, keeps your Anycubic token on the server, and gives you a calm dashboard instead of a phone app.

- Drag-and-drop `.gcode` upload straight to your Anycubic cloud storage
- Pick a printer, see nozzle/bed temperatures and ACE filament slots
- Match sliced colours to physical spools, then send `START_PRINT`
- Pause, resume, and cancel a running job
- Live progress, remaining time, and cloud storage usage
- Optional password gate, optional Vercel Blob fallback, optional demo mode

No database. No accounts. No copy of your files.

---

## How it works

```
browser ──upload──▶ Anycubic cloud (S3 presigned)   ← preferred
   │                        │
   │                        ▼
   └──relay via Blob──▶ /api/upload/commit ──▶ newUploadFile ──▶ infoFdm
                                                      │
                                                      ▼
                                            /api/print ──▶ sendOrder(START_PRINT)
```

1. **Lock storage** — `lockStorageSpace` reserves space and returns a presigned S3 URL.
2. **Upload** — the browser `PUT`s the file directly to that URL. If the browser is blocked (CORS, proxy, corporate network), the file can be staged in Vercel Blob and the server relays the bytes instead.
3. **Claim** — `newUploadFile` turns the lock into a cloud file; the app then reads `infoFdm` for the print estimate and `slice_param.paint_infos` for materials.
4. **Start** — the confirmation dialog maps each sliced material to an ACE slot and sends the `START_PRINT` order.

The protocol is a TypeScript port of the endpoints and payloads used by [hass-anycubic](https://github.com/Nino6689/hass-anycubic) and its `anycubic-cloud-api` dependency. All credit for reverse-engineering the API goes to those projects.

## Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel (framework preset: **Next.js**).
2. Add the environment variables below in **Project → Settings → Environment Variables**.
3. Deploy.

That is the whole setup. There is no build-time configuration and no database.

### Required

| Variable | Example | Notes |
| --- | --- | --- |
| `ANYCUBIC_TOKEN` | `eyJhbGciOi…` | Cloud token for the printer's account. See below. |
| `ANYDROP_PASSWORD` | `a-long-random-password` | Dashboard password. The app will not run without it. |

### Recommended

| Variable | Default | Notes |
| --- | --- | --- |
| `ANYDROP_SESSION_SECRET` | hash of password | Key for the signed session cookie. Set a long random string if you rotate the password. |
| `BLOB_READ_WRITE_TOKEN` | _(empty)_ | Enables the upload fallback. Vercel injects this when you create a Blob store. |
| `ANYDROP_BLOB_ACCESS` | `public` | `public` or `private` — must match the Blob store's access mode. |

### Optional

| Variable | Default | Notes |
| --- | --- | --- |
| `ANYCUBIC_AUTH_MODE` | `web` | `web` or `slicer`. |
| `ANYCUBIC_REGION` | `global` | `global` or `cn` (mainland China cloud). |
| `ANYDROP_UPLOAD_MODE` | `auto` | `auto`, `direct`, or `blob`. |
| `ANYDROP_MAX_UPLOAD_MB` | `512` | Largest file the UI accepts. |
| `ANYDROP_MAX_RELAY_MB` | `256` | Largest file the Blob relay will buffer. |
| `ANYDROP_DEMO` | `0` | `1` renders mock data, disables cloud calls and uploads. |

## Getting your Anycubic token

anydrop never asks for your Anycubic password. It uses a token you copy once from an official client.

### Web token (default)

1. Sign in at [app.makeronline.com](https://app.makeronline.com) (or the China site if you use that region).
2. Open DevTools → **Application → Local Storage**.
3. Copy the value of `XX-Token`.
4. Set it as `ANYCUBIC_TOKEN` and leave `ANYCUBIC_AUTH_MODE=web`.

### Slicer token

1. Sign in to **Anycubic Slicer Next**.
2. Find its stored access token (the integration's docs cover where each platform keeps it).
3. Set `ANYCUBIC_TOKEN` to that value and `ANYCUBIC_AUTH_MODE=slicer`.

Slicer tokens are short-lived. The server exchanges the access token for a session token via `loginWithAccessToken` and refreshes it automatically when the cloud reports it expired. If refreshes start failing, paste a fresh access token.

Tokens are bearer credentials for your whole printer account. Treat them like a password, and never commit them.

## The Vercel Blob fallback

Anycubic's presigned URLs are intended for native clients. Most browsers can `PUT` to them, but a browser will refuse to read the response unless the bucket sends CORS headers — and some networks block the host entirely.

With a Blob store attached:

- `auto` tries the direct upload first and switches to Blob only if the browser cannot reach Anycubic.
- `blob` always stages through Vercel Blob.

The Blob copy is deleted immediately after the relay and never used as the print source — the server re-uploads the bytes to Anycubic's presigned URL. If you create the store as **private**, set `ANYDROP_BLOB_ACCESS=private`; the default is `public`.

If you would rather not use Blob, set `ANYDROP_UPLOAD_MODE=direct`. Uploads then depend on the browser being able to reach Anycubic's storage.

## Local development

```bash
pnpm install
cp .env.example .env.local   # fill in ANYCUBIC_TOKEN, or set ANYDROP_DEMO=1
pnpm dev
```

Open <http://localhost:3000>.

To preview the interface without a printer or token:

```bash
ANYDROP_DEMO=1 pnpm dev
```

Demo mode shows a mock Kobra S1 with a running job and an ACE unit. Uploads and print controls are disabled.

Other scripts:

```bash
pnpm typecheck   # tsc --noEmit
pnpm build       # production build
pnpm start       # serve the production build
```

## Limits and caveats

- **Undocumented API.** Anycubic can change endpoints, signatures, or payloads at any time. This is a hobby project, not an official integration.
- **One account per deployment.** The token is deployment-wide; anydrop is not multi-tenant.
- **The printer must be online** and signed in to the same Anycubic account. Offline printers are shown but cannot be started.
- **Upload size.** Direct uploads are limited only by the browser and Anycubic. The Blob relay buffers the file in a serverless function, so it is capped by `ANYDROP_MAX_RELAY_MB` and the function's memory/time budget.
- **ACE mapping.** Multi-colour files are matched to physical slots using the colours and materials from the slicer. Always check the mapping in the dialog — a wrong slot means the wrong colour.
- **Serverless timeouts.** The commit route declares `maxDuration = 300`. Very large files on slow links may still exceed it; use `direct` mode in that case.
- **No print queue.** anydrop starts a job immediately; it does not schedule or queue prints.

## Security

- The Anycubic token is read from the environment on the server only. It is never included in `/api/config`, HTML, or client bundles.
- `/api/state`, `/api/print`, `/api/control`, and the upload routes require the signed session cookie; `ANYDROP_PASSWORD` is required.
- Login attempts are rate-limited per IP (in-memory; reset on cold start).
- Presigned upload URLs are validated against Anycubic/S3 hosts before the server relays anything to them.
- Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production.

`ANYDROP_PASSWORD` is required. Starting a print on someone else's printer is a bad surprise.

## Credits

- [hass-anycubic](https://github.com/Nino6689/hass-anycubic) — the Home Assistant integration this app's protocol knowledge comes from.
- `anycubic-cloud-api` — the Python client that documents the signing scheme and endpoints.
- Built with [Next.js](https://nextjs.org) and [Vercel Blob](https://vercel.com/storage/blob).

anydrop is unofficial and not affiliated with Anycubic.
