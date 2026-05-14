# CADLens API — MCP Server Reference

A self-contained reference for building a **Model Context Protocol (MCP) server** that wraps the CADLens REST API in a separate repository. Read this end-to-end and you have everything required: endpoints, request/response shapes, data models the LLM will reason over, a concrete MCP tool surface, and a working TypeScript skeleton.

> **Out of scope:** dashboard UI, billing flows, OAuth provider flows. The MCP server only needs the API-key path.

---

## 1. TL;DR

CADLens is a CAD file parser SaaS. POST a `.dwg` / `.dxf` / `.dwf` / `.dwfx` / `.dgn` / `.pdf` file and you get back:

- **PNG preview** (presigned S3 URL, 1h expiry)
- **Vector JSON** — every entity (LINE, ARC, CIRCLE, POLYLINE, TEXT, INSERT, etc.) as a typed object
- **Layer metadata** — name, color, line type, entity count
- **Drawing metadata** — units, DWG version, bounding box

| | |
|---|---|
| **Production base URL** | `https://api.cadlens.co/v1` |
| **Local dev base URL** | `http://localhost:3001/v1` |
| **Env var convention** | `CADLENS_API_BASE`, `CADLENS_API_KEY` |
| **Auth (parse/jobs)** | `Authorization: Bearer <api_key>` |
| **Max file size** | 100 MB |
| **Job lifecycle** | `PENDING → PROCESSING → COMPLETED \| FAILED` |
| **Result URL TTL** | 3600 s (1 h), refetchable |

**Minimum viable flow:**

1. User creates an API key in the CADLens dashboard (out-of-band, not via this server).
2. MCP server reads `CADLENS_API_KEY` from env.
3. `POST /v1/parse` with the file → returns `job_id` and initial `status`.
4. Poll `GET /v1/jobs/:job_id` until `status === 'COMPLETED'` (or `'FAILED'`).
5. Fetch `GET /v1/jobs/:job_id/result` for `vectorJson`, `layersJson`, `metadata`, `imageUrl`.

---

## 2. Authentication

### API Key (used by the MCP server)

```http
Authorization: Bearer cadl_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- Format: a prefix like `cadl_` followed by random characters. Only the **first 12 characters** (`keyPrefix`) are stored in plaintext for UI identification; the rest is **SHA-256 hashed** on the server.
- The **full key is returned only once**, at creation time in the dashboard. The MCP server cannot retrieve a lost key.
- Keys can be revoked (`revokedAt`) and may have an `expiresAt`. The middleware checks both on every request.
- **No per-IP or per-key rate limiter** — limits are enforced as monthly **quotas** by user plan (see §7).

### JWT (NOT used by the MCP server)

JWT tokens authenticate the dashboard for `/v1/keys`, `/v1/me/profile`, `/v1/billing/*`. The MCP server does not need them. Key creation is **out-of-band**: the user creates the key in the dashboard and pastes it into the MCP server's config.

> **Do not implement key creation, login, or billing in the MCP server.** Those are dashboard concerns.

---

## 3. Endpoint Reference

All endpoints below are prefixed with `/v1`. JSON unless otherwise noted.

### 3.1 `POST /v1/parse` — Upload & parse

Upload a CAD file. Returns immediately with `job_id` (async mode) or, optionally, blocks until the worker finishes (sync mode).

**Request**

```http
POST /v1/parse
Authorization: Bearer <api_key>
Content-Type: multipart/form-data
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `file` | file | yes | The CAD file. Field name must be exactly `file`. Max 100 MB. |
| `webhookUrl` | string (URL) | no | Receives a POST when the job changes state. See §6. |
| `mode` | `"sync"` \| `"async"` | no | Default `"async"`. |

**Mode semantics:**

- `async` (default) — server queues the job, returns **202** immediately with `job_id` and `status: "PENDING"`. Client polls.
- `sync` — server queues the job and long-polls internally:
  - If the file is below the inline threshold and parses fast → **200** with the full result inline.
  - If the worker finishes before `SYNC_WAIT_TIMEOUT_MS` → **200** with the full result inline.
  - Otherwise → **202** with `job_id` and a `message` field — fall back to polling.

**Response — 200 (sync, completed)**

```json
{
  "job_id": "42",
  "status": "COMPLETED",
  "fileName": "floorplan.dwg",
  "fileSize": 1843200,
  "createdAt": "2026-05-13T10:14:22.000Z",
  "completedAt": "2026-05-13T10:14:25.000Z",
  "vectorJson": { "entities": [ /* CadEntity[] */ ] },
  "layersJson": [ /* LayerDef[] */ ],
  "metadata": { /* DrawingMetadata */ },
  "imageUrl": "https://s3.amazonaws.com/.../preview.png?X-Amz-Signature=..."
}
```

**Response — 202 (async, or sync-timeout)**

```json
{
  "job_id": "42",
  "status": "PENDING",
  "fileName": "floorplan.dwg",
  "fileSize": 1843200,
  "createdAt": "2026-05-13T10:14:22.000Z"
}
```

Sync-timeout responses additionally include `"message": "Sync wait timed out — poll GET /v1/jobs/:job_id for completion or use the webhook."`

**Errors**

| Status | Reason |
|---|---|
| 400 | No file, unsupported format, DGN V8 (export to DXF/DWG first), or Zod validation failure on `webhookUrl` / `mode`. |
| 401 | Missing / invalid / revoked / expired API key. |
| 413 | File > 100 MB. |
| 429 | Monthly quota for the plan reached (see §7). |

---

### 3.2 `GET /v1/jobs` — List jobs

Returns up to **100** jobs for the API key, sorted by `createdAt` DESC.

```http
GET /v1/jobs
Authorization: Bearer <api_key>
```

**Response — 200**

```json
{
  "jobs": [
    {
      "id": "42",
      "uuid": "8b7d3f1a-2c5e-4f9b-a1e2-93f5c0b8a7d6",
      "status": "COMPLETED",
      "fileName": "floorplan.dwg",
      "fileSize": 1843200,
      "mimeType": "application/octet-stream",
      "createdAt": "2026-05-13T10:14:22.000Z",
      "updatedAt": "2026-05-13T10:14:25.000Z",
      "startedAt": "2026-05-13T10:14:23.000Z",
      "completedAt": "2026-05-13T10:14:25.000Z",
      "errorMsg": null,
      "webhookUrl": null
    }
  ]
}
```

---

### 3.3 `GET /v1/jobs/:jobId` — Job status

Cheap status check. Use this for polling.

**Response — 200**

```json
{
  "id": "42",
  "uuid": "8b7d3f1a-...",
  "status": "PROCESSING",
  "fileName": "floorplan.dwg",
  "fileSize": 1843200,
  "mimeType": "application/octet-stream",
  "createdAt": "2026-05-13T10:14:22.000Z",
  "completedAt": null,
  "errorMsg": null
}
```

**Errors:** `404` if the job doesn't exist or belongs to a different API key.

---

### 3.4 `GET /v1/jobs/:jobId/result` — Full result

Returns the parsed content. **Only valid when `status === 'COMPLETED'`** — otherwise returns 400.

**Response — 200**

```json
{
  "jobId": "42",
  "status": "COMPLETED",
  "vectorJson": { "entities": [ /* CadEntity[] */ ] },
  "layersJson": [ /* LayerDef[] */ ],
  "metadata": { /* DrawingMetadata */ },
  "imageUrl": "https://s3.amazonaws.com/.../preview.png?X-Amz-Signature=...",
  "createdAt": "2026-05-13T10:14:25.000Z"
}
```

`imageUrl` is a **presigned S3 URL valid for 3600 seconds**. If your MCP session is longer, refetch via §3.5.

**Errors:**
- `400` — job not completed or has no result.
- `404` — job not found.

---

### 3.5 `GET /v1/jobs/:jobId/image` — Image URL only

Cheap way to refresh just the presigned image URL without re-downloading the full result payload.

**Response — 200**

```json
{
  "imageUrl": "https://s3.amazonaws.com/.../preview.png?X-Amz-Signature=..."
}
```

---

### 3.6 `DELETE /v1/jobs/:jobId` — Delete

Removes the job row and **all S3 artifacts** (uploaded source + preview image).

**Response — 204** (no body)

**Errors:** `404` if not found.

---

### 3.7 `GET /health` — Liveness

```http
GET /health
```

No auth. Returns `{ "status": "ok", "db": "ok" }` or `503` if the DB is unreachable. Useful for MCP startup checks.

---

### 3.8 Endpoints *not* for MCP

Listed for completeness; do **not** call from the MCP server:

| Endpoint | Why excluded |
|---|---|
| `GET/POST/DELETE /v1/keys/*` | JWT-only, dashboard-only |
| `GET/POST /v1/auth/*` | OAuth — dashboard-only |
| `GET/PUT /v1/me/profile` | JWT-only, dashboard-only |
| `POST /v1/billing/portal`, `POST /v1/billing/webhook` | Stripe — dashboard-only |
| `GET /.well-known/jwks` | JWT verification — not needed for API-key auth |

---

## 4. Job Lifecycle

```
PENDING ──► PROCESSING ──► COMPLETED
                    │
                    └───► FAILED
```

| Status | Meaning | Result fields populated? |
|---|---|---|
| `PENDING` | Queued in Redis stream `stream:cad-parse`, awaiting a worker. | No |
| `PROCESSING` | Worker dequeued the job, ODA File Converter + DXF parser running. | No |
| `COMPLETED` | Parse succeeded, `JobResult` row written. | Yes — `vectorJson`, `layersJson`, `metadata`, `imageKey` |
| `FAILED` | Parse error. `errorMsg` populated. | No |

### Recommended polling cadence

Most jobs complete in **2–10 seconds** for files under 5 MB. Large files (50 MB+) can take 30–60 s. A reasonable backoff for an MCP `parse_cad` tool:

```
attempts 1–5:    1 s interval
attempts 6–15:   2 s interval
attempts 16+:    5 s interval, capped at 10 s
total timeout:   5 minutes
```

If you hit the timeout, return the `job_id` to the LLM with a "still processing" message rather than failing — the user can call `cadlens_get_job` later.

---

## 5. Data Shapes

These are the structures the LLM will read out of `cadlens_get_result`. Source of truth: `node/src/lib/cad-parser/llm-schema.ts` and `cad-parser.ts:55–104`.

### 5.1 `CadEntity` (discriminated union)

Every entity has `type`, `id` (UUID handle), `layer` (name, default `"0"`), and optional `colorIndex` (AutoCAD Color Index, 1–256). Type-specific fields:

```typescript
type Point2D = { x: number; y: number; bulge?: number };

type CadEntity =
  | { type: 'LINE';       id: string; layer: string; start: Point2D; end: Point2D; colorIndex?: number }
  | { type: 'ARC';        id: string; layer: string; center: Point2D; radius: number; startAngle: number; endAngle: number; colorIndex?: number }
  | { type: 'CIRCLE';     id: string; layer: string; center: Point2D; radius: number; colorIndex?: number }
  | { type: 'POLYLINE';   id: string; layer: string; vertices: Point2D[]; closed: boolean; colorIndex?: number }
  | { type: 'LWPOLYLINE'; id: string; layer: string; vertices: Point2D[]; closed: boolean; colorIndex?: number }
  | { type: 'TEXT';       id: string; layer: string; text: string; position: Point2D; height: number; rotation: number; colorIndex?: number }
  | { type: 'MTEXT';      id: string; layer: string; text: string; position: Point2D; height: number; rotation: number; colorIndex?: number }
  | { type: 'INSERT';     id: string; layer: string; blockName: string; position: Point2D; scaleX: number; scaleY: number; rotation: number; colorIndex?: number }
  | { type: 'SPLINE';     id: string; layer: string; controlPoints: Point2D[]; degree: number; colorIndex?: number }
  | { type: 'ELLIPSE';    id: string; layer: string; center: Point2D; majorAxis: Point2D; ratio: number; startAngle: number; endAngle: number; colorIndex?: number };
```

Angles for `ARC` and `ELLIPSE` are in **radians**. Rotation for `TEXT`/`MTEXT`/`INSERT` is in **degrees**. `bulge` on a vertex is a polyline arc-fitting parameter (DXF group code 42).

The schemas use `.passthrough()` server-side, so additional fields may appear in future versions — your parser should tolerate them.

### 5.2 `LayerDef`

```typescript
interface LayerDef {
  name: string;          // e.g., "0", "WALLS", "Visible"
  color: number;         // AutoCAD Color Index (ACI), 1–256
  colorHex: string;      // e.g., "#FF0000" — resolved from the ACI palette
  lineType: string;      // e.g., "CONTINUOUS", "DASHED"
  isVisible: boolean;
  entityCount: number;   // number of entities on this layer in the drawing
}
```

`colorHex` is provided so the MCP consumer can ignore the ACI table entirely.

### 5.3 `DrawingMetadata`

```typescript
interface DrawingMetadata {
  filename: string;              // original uploaded filename
  format: 'DWG' | 'DXF' | 'DWF' | 'DWFX' | 'DGN' | 'PDF';
  dwgVersion: string;            // e.g., "AC1021" (AutoCAD 2007), or "unknown"
  units: 'mm' | 'cm' | 'm' | 'inch' | 'feet' | 'unknown';
  boundingBox: {
    minX: number; minY: number;
    maxX: number; maxY: number;
    width: number;               // maxX - minX
    height: number;              // maxY - minY
  };
  truncated?: boolean;           // present + true when entity count exceeded 50,000 and the result was truncated
}
```

### 5.4 Token cost warning

`vectorJson.entities` can easily exceed **50,000 entries** for floor plans or assemblies. A full `cadlens_get_result` response can be **megabytes** of JSON — far too much to inject into an LLM prompt.

**Strongly recommend** the MCP server expose a `mode` parameter on the result tool:

| `mode` value | Returns |
|---|---|
| `"summary"` (default) | Just `metadata`, `layersJson`, entity count by type. ~1–2 KB. |
| `"entities_by_type"` | `metadata`, `layersJson`, plus `entities` filtered to a single `type` the LLM asks for. |
| `"entities_on_layer"` | Same, filtered to a single layer. |
| `"full"` | The complete response. Use sparingly. |

See §8 for the suggested tool schema.

---

## 6. Webhooks

Webhooks are **optional** and most MCP servers won't need them — polling §4 is simpler. Document below for completeness.

### Registration

Pass `webhookUrl` (any HTTPS URL) as a form field on `POST /v1/parse`. The URL is stored on the job row.

### Payload

CADLens POSTs to the registered URL with:

```http
POST <webhookUrl>
Content-Type: application/json
User-Agent: CADLens-Webhook/1.0
```

```typescript
interface WebhookPayload {
  eventId: string;                // unique per delivery
  sequence: number;
  event: 'job.processing' | 'job.completed' | 'job.failed';
  jobId: string;
  status: string;                 // 'PROCESSING' | 'COMPLETED' | 'FAILED'
  timestamp: string;              // ISO 8601
  result?: {
    entityCount?: number;
    layerCount?: number;
    imageUrl?: string;
    resultUrl?: string;
  };
  error?: string;                 // present when event === 'job.failed'
}
```

### Delivery semantics

- HTTP timeout: 10 s.
- Retries: up to 3 with exponential backoff (2 s → 4 s → 8 s, capped at 30 s).
- After 3 failures the message is left in the Redis Pending Entry List for manual review; not auto-discarded.
- Receiver must return `2xx`. Anything else is treated as a delivery failure.

### When to use from MCP

Only useful if the MCP server runs as a long-lived HTTP service (not stdio). For the stdio transport recommended here (§9), stick with polling.

---

## 7. Errors & Limits

### Error envelope

Standard error:

```json
{ "error": "Job not found" }
```

Zod validation error (400):

```json
{
  "error": "Validation error",
  "details": {
    "fieldErrors": { "webhookUrl": ["webhookUrl must be a valid URL"] },
    "formErrors": []
  }
}
```

### Status codes

| Code | Meaning |
|---|---|
| 200 | OK (sync parse completed inline) |
| 201 | Created (key creation — not used by MCP) |
| 202 | Accepted — job queued, poll for status |
| 204 | Deleted |
| 400 | Validation / unsupported format / DGN V8 / job not yet complete |
| 401 | Missing / invalid / revoked / expired API key |
| 404 | Job not found (or not owned by this API key) |
| 413 | File > 100 MB |
| 429 | Monthly plan quota exceeded |
| 500 | Server error |
| 503 | Database unreachable |

### Monthly quotas (per user, UTC, resets on the 1st)

| Plan | Requests / month |
|---|---|
| `FREE` | 100 |
| `STARTER` | 1,000 |
| `BUILDER` | 5,000 |
| `GROWTH` | 25,000 |
| `SCALE` | 100,000 |
| `ENTERPRISE` | unlimited |

When the quota is hit, every `POST /v1/parse` returns 429 until the next month rolls over.

### File limits

| | |
|---|---|
| Max size | 100 MB (Multer-enforced) |
| Accepted extensions | `.dwg`, `.dxf`, `.dwf`, `.dwfx`, `.dgn` (V7 only), `.pdf` |
| Rejected | DGN V8 — return a hint to export to DXF/DWG from MicroStation first |
| Validation | Magic-byte check, not extension — but the extension must match an allowed type |

---

## 8. Suggested MCP Tool Surface

A practical six-tool surface. All inputs are JSON Schemas usable directly in `Tool.inputSchema`.

### `cadlens_parse_file`

Upload a local file, poll until completion (or timeout), return summary.

```json
{
  "name": "cadlens_parse_file",
  "description": "Parse a local CAD file (DWG/DXF/DWF/DWFx/DGN-V7/PDF, max 100 MB). Polls until the job completes or 5 minutes elapse. Returns a summary of the parsed drawing including the preview image URL. Use cadlens_get_result with the returned job_id to fetch detailed entity data.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string", "description": "Absolute path to the file on the local filesystem" },
      "webhook_url": { "type": "string", "format": "uri", "description": "Optional webhook URL for state-change notifications" }
    },
    "required": ["path"]
  }
}
```

Output (text content):

```json
{
  "job_id": "42",
  "status": "COMPLETED",
  "format": "DWG",
  "units": "mm",
  "bounding_box": { "minX": 0, "minY": 0, "maxX": 12000, "maxY": 8000, "width": 12000, "height": 8000 },
  "entity_count": 1842,
  "layer_count": 12,
  "image_url": "https://s3.../preview.png?...",
  "image_url_expires_in_seconds": 3600
}
```

### `cadlens_parse_url`

Same as above but downloads from a URL first. Useful for files the LLM has surfaced from a previous tool.

```json
{
  "name": "cadlens_parse_url",
  "description": "Download a CAD file from a URL and parse it. See cadlens_parse_file for output shape.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "url": { "type": "string", "format": "uri" },
      "webhook_url": { "type": "string", "format": "uri" }
    },
    "required": ["url"]
  }
}
```

### `cadlens_get_job`

Cheap status check.

```json
{
  "name": "cadlens_get_job",
  "description": "Check the status of a previously created CAD parse job. Returns PENDING, PROCESSING, COMPLETED, or FAILED.",
  "inputSchema": {
    "type": "object",
    "properties": { "job_id": { "type": "string" } },
    "required": ["job_id"]
  }
}
```

### `cadlens_get_result`

Fetch parsed content with **mode-gated token cost**.

```json
{
  "name": "cadlens_get_result",
  "description": "Fetch the parsed result of a completed CAD job. Use mode='summary' (default) for an overview, 'entities_by_type' or 'entities_on_layer' for filtered detail, or 'full' for the complete vector JSON (can be very large — only use when explicitly needed).",
  "inputSchema": {
    "type": "object",
    "properties": {
      "job_id": { "type": "string" },
      "mode": {
        "type": "string",
        "enum": ["summary", "entities_by_type", "entities_on_layer", "full"],
        "default": "summary"
      },
      "entity_type": {
        "type": "string",
        "enum": ["LINE","ARC","CIRCLE","POLYLINE","LWPOLYLINE","TEXT","MTEXT","INSERT","SPLINE","ELLIPSE"],
        "description": "Required when mode='entities_by_type'"
      },
      "layer_name": {
        "type": "string",
        "description": "Required when mode='entities_on_layer'"
      }
    },
    "required": ["job_id"]
  }
}
```

Implementation note: `summary` and the filtered modes are computed **client-side** from the full response — there's no server-side filtering endpoint. Cache the full response in the MCP server's memory keyed by `job_id` for a short window (e.g., 5 min) to avoid refetching.

### `cadlens_list_jobs`

```json
{
  "name": "cadlens_list_jobs",
  "description": "List the 100 most recent CAD parse jobs for the configured API key, newest first.",
  "inputSchema": { "type": "object", "properties": {} }
}
```

### `cadlens_delete_job`

```json
{
  "name": "cadlens_delete_job",
  "description": "Delete a job and its uploaded file and preview image from CADLens storage. Irreversible.",
  "inputSchema": {
    "type": "object",
    "properties": { "job_id": { "type": "string" } },
    "required": ["job_id"]
  }
}
```

---

## 9. TypeScript MCP Server Skeleton

Uses `@modelcontextprotocol/sdk` with the stdio transport. Targets Node ≥20 (native `fetch` + `FormData` + `File`).

### `package.json`

```json
{
  "name": "cadlens-mcp",
  "version": "0.1.0",
  "type": "module",
  "bin": { "cadlens-mcp": "dist/index.js" },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0"
  }
}
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

### `src/index.ts`

```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';

const API_BASE = process.env['CADLENS_API_BASE'] ?? 'https://api.cadlens.co/v1';
const API_KEY = process.env['CADLENS_API_KEY'];
if (!API_KEY) {
  console.error('CADLENS_API_KEY is required');
  process.exit(1);
}

const authHeaders = { Authorization: `Bearer ${API_KEY}` };

// In-memory cache: job_id → full result, evicted after 5 minutes.
const resultCache = new Map<string, { at: number; data: any }>();
const CACHE_TTL = 5 * 60 * 1000;

async function cadlensFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders, ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`CADLens API ${res.status}: ${body}`);
  }
  return res.json();
}

async function pollUntilDone(jobId: string, timeoutMs = 5 * 60 * 1000) {
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < timeoutMs) {
    const job = await cadlensFetch(`/jobs/${jobId}`);
    if (job.status === 'COMPLETED' || job.status === 'FAILED') return job;
    attempt++;
    const delay = attempt <= 5 ? 1000 : attempt <= 15 ? 2000 : Math.min(5000 + attempt * 100, 10_000);
    await new Promise((r) => setTimeout(r, delay));
  }
  return null;
}

function summarize(result: any) {
  const entities: any[] = result.vectorJson?.entities ?? [];
  const byType: Record<string, number> = {};
  for (const e of entities) byType[e.type] = (byType[e.type] ?? 0) + 1;
  return {
    job_id: result.jobId,
    status: result.status,
    format: result.metadata?.format,
    units: result.metadata?.units,
    bounding_box: result.metadata?.boundingBox,
    entity_count: entities.length,
    entity_count_by_type: byType,
    layers: (result.layersJson ?? []).map((l: any) => ({
      name: l.name,
      colorHex: l.colorHex,
      entityCount: l.entityCount,
    })),
    image_url: result.imageUrl,
    image_url_expires_in_seconds: 3600,
  };
}

async function getResultCached(jobId: string): Promise<any> {
  const cached = resultCache.get(jobId);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.data;
  const fresh = await cadlensFetch(`/jobs/${jobId}/result`);
  resultCache.set(jobId, { at: Date.now(), data: fresh });
  return fresh;
}

const TOOLS = [
  {
    name: 'cadlens_parse_file',
    description: 'Parse a local CAD file (DWG/DXF/DWF/DWFx/DGN-V7/PDF, max 100 MB). Polls until completion or 5 minutes elapse. Returns a summary including preview image URL.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the local file' },
        webhook_url: { type: 'string', format: 'uri' },
      },
      required: ['path'],
    },
  },
  {
    name: 'cadlens_get_job',
    description: 'Check the status of a CAD parse job.',
    inputSchema: {
      type: 'object',
      properties: { job_id: { type: 'string' } },
      required: ['job_id'],
    },
  },
  {
    name: 'cadlens_get_result',
    description: "Fetch the parsed result. Use mode='summary' (default) for an overview, 'entities_by_type' or 'entities_on_layer' to filter, or 'full' for the complete JSON (can be very large).",
    inputSchema: {
      type: 'object',
      properties: {
        job_id: { type: 'string' },
        mode: { type: 'string', enum: ['summary', 'entities_by_type', 'entities_on_layer', 'full'], default: 'summary' },
        entity_type: { type: 'string' },
        layer_name: { type: 'string' },
      },
      required: ['job_id'],
    },
  },
  {
    name: 'cadlens_list_jobs',
    description: 'List the 100 most recent CAD parse jobs for the configured API key.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'cadlens_delete_job',
    description: 'Delete a job and its S3 artifacts. Irreversible.',
    inputSchema: {
      type: 'object',
      properties: { job_id: { type: 'string' } },
      required: ['job_id'],
    },
  },
];

const server = new Server(
  { name: 'cadlens-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    switch (name) {
      case 'cadlens_parse_file': {
        const path = String(args?.['path']);
        const buf = await readFile(path);
        const st = await stat(path);
        if (st.size > 100 * 1024 * 1024) throw new Error('File exceeds 100 MB limit');
        const form = new FormData();
        form.append('file', new File([buf], basename(path)));
        if (args?.['webhook_url']) form.append('webhookUrl', String(args['webhook_url']));
        const created = await cadlensFetch('/parse', { method: 'POST', body: form });
        const final = (await pollUntilDone(created.job_id)) ?? { status: 'TIMEOUT', id: created.job_id };
        if (final.status === 'COMPLETED') {
          const result = await getResultCached(created.job_id);
          return { content: [{ type: 'text', text: JSON.stringify(summarize(result), null, 2) }] };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify({ job_id: created.job_id, status: final.status, error: final.errorMsg ?? null }, null, 2) }],
          isError: final.status === 'FAILED',
        };
      }
      case 'cadlens_get_job': {
        const job = await cadlensFetch(`/jobs/${args?.['job_id']}`);
        return { content: [{ type: 'text', text: JSON.stringify(job, null, 2) }] };
      }
      case 'cadlens_get_result': {
        const jobId = String(args?.['job_id']);
        const mode = (args?.['mode'] as string) ?? 'summary';
        const result = await getResultCached(jobId);
        if (mode === 'full') {
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        if (mode === 'entities_by_type') {
          const t = String(args?.['entity_type']);
          const entities = (result.vectorJson?.entities ?? []).filter((e: any) => e.type === t);
          return { content: [{ type: 'text', text: JSON.stringify({ jobId, metadata: result.metadata, type: t, entities }, null, 2) }] };
        }
        if (mode === 'entities_on_layer') {
          const ln = String(args?.['layer_name']);
          const entities = (result.vectorJson?.entities ?? []).filter((e: any) => e.layer === ln);
          return { content: [{ type: 'text', text: JSON.stringify({ jobId, metadata: result.metadata, layer: ln, entities }, null, 2) }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify(summarize(result), null, 2) }] };
      }
      case 'cadlens_list_jobs': {
        const data = await cadlensFetch('/jobs');
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }
      case 'cadlens_delete_job': {
        await fetch(`${API_BASE}/jobs/${args?.['job_id']}`, { method: 'DELETE', headers: authHeaders });
        resultCache.delete(String(args?.['job_id']));
        return { content: [{ type: 'text', text: JSON.stringify({ deleted: true, job_id: args?.['job_id'] }, null, 2) }] };
      }
      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err) {
    return { content: [{ type: 'text', text: String((err as Error).message ?? err) }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

> **Note:** the `Server` class API and import paths in `@modelcontextprotocol/sdk` evolve; if your installed SDK uses `McpServer` from `/server/mcp.js` instead, swap imports accordingly — the request-handler shape is the same.

---

## 10. Local Development & Testing

### Required env vars

```bash
export CADLENS_API_BASE="https://api.cadlens.co/v1"   # or http://localhost:3001/v1
export CADLENS_API_KEY="cadl_xxxxxxxxxxxxxxxxxxxxxxxx"
```

### Claude Desktop config

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "cadlens": {
      "command": "node",
      "args": ["/absolute/path/to/cadlens-mcp/dist/index.js"],
      "env": {
        "CADLENS_API_BASE": "https://api.cadlens.co/v1",
        "CADLENS_API_KEY": "cadl_xxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

### Testing against a local CADLens dev server

1. In the CADLens repo: `cd node && tsx watch src/index.ts` (port 3001).
2. Set `CADLENS_API_BASE=http://localhost:3001/v1`.
3. Create a key in the local dashboard (`http://localhost:5173`).
4. Smoke test with curl:

```bash
curl -X POST "$CADLENS_API_BASE/parse" \
  -H "Authorization: Bearer $CADLENS_API_KEY" \
  -F "file=@./sample.dwg" \
  -F "mode=async"
```

### Manual MCP smoke test

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

Should print a JSON-RPC response listing the six tools.

---

## 11. Appendix

### ACI color palette

Entities carry `colorIndex` (1–256 AutoCAD Color Index). The full palette is hard-coded in `node/src/lib/cad-parser/cad-parser.ts:101–161`. **You probably don't need it** — `LayerDef.colorHex` already gives you the resolved hex for each layer, and most entities inherit from their layer. Only resolve `colorIndex` to hex when an entity explicitly overrides its layer's color and you need to render it faithfully.

Notable indices: `0` = byblock, `7` = white/black (depends on background), `256` = bylayer.

### S3 presigned URL expiry

`imageUrl` is valid for **3600 seconds**. If your MCP session might exceed that, either:

- Re-fetch via `GET /v1/jobs/:jobId/image` on demand, or
- Download the PNG to a local file as part of `cadlens_parse_file` and return a `file://` path (only useful if the LLM client renders local files).

### Idempotency

The Job entity has an unused `clientRequestId` column intended for future idempotency support. Today, every `POST /v1/parse` creates a new job even with the same file — your MCP server should not retry parse requests blindly on transient errors.

### Glossary

| Term | Meaning |
|---|---|
| **DWG** | AutoCAD's native binary drawing format. |
| **DXF** | Drawing Exchange Format — text-based, vendor-neutral. |
| **DWF / DWFx** | Design Web Format — Autodesk's distribution-oriented format. |
| **DGN** | MicroStation drawing format. V7 supported, V8 not. |
| **ACI** | AutoCAD Color Index — a 256-entry palette. |
| **ODA** | Open Design Alliance — vendor of the File Converter CLI CADLens uses to convert DWG → DXF internally. |
| **JSONB** | PostgreSQL binary JSON column type — how `vectorJson`/`layersJson`/`metadata` are stored. |
| **PEL** | Redis Streams Pending Entry List — where in-flight or failed messages sit until ACKed. |
| **SigV4** | AWS Signature Version 4 — the signing scheme presigned S3 URLs use. |

---

*Reference compiled against CADLens Node API as of 2026-05-13. Last verified against: `node/src/routes/`, `node/src/controllers/`, `node/src/services/`, `node/src/lib/cad-parser/`, `node/src/workers/webhook-notify.worker.ts`, `node/src/types/{auth,jobs}.ts`.*
