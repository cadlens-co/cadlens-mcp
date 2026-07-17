# Changelog

## API service — 2026-07-17 (no SDK changes required)

- Parser 2.2.1: drawings with ACIS 3DSOLID geometry no longer drop circular
  edges (mounting-plate holes, cable-gland openings, bolt circles) from the
  extracted wireframe — a record-layout mis-alignment skipped exactly those
  circles and could inflate drawing extents with mis-read arcs. All solid
  edges are now extracted; results report `parserVersion: "2.2.1"`. No
  request/response shape changes; 2D drawings are unaffected.

## API service — 2026-07-16 (no SDK changes required)

- Large-file parses are ~3x faster: redundant conversion retries that could
  not change the outcome are skipped and the streaming geometry filter
  fast-forwards over out-of-budget sections. Results are identical (same
  entities, layers, `truncated` flag). Conversion time limits for very
  complex drawings are also higher and configurable server-side. No
  request/response shape changes.

## API service — 2026-07-15 (no SDK changes required)

- `mode=sync` uploads now auto-divert to async when the file is large or its
  converted geometry turns out huge: the API returns `202` immediately with a
  human-readable `message` instead of holding the connection until the sync
  wait times out. Poll `GET /v1/jobs/:jobId` or use webhooks as usual.
- Oversized drawings that previously failed with `FILE_TOO_COMPLEX` are now
  parsed with a bounded streaming pre-filter and return `truncated: true` in
  the result summary. No request/response shape changes.

## API service — 2026-07-14 (no SDK changes required)

- Large-file reliability fix on the API: drawings whose converted geometry
  exceeds processing limits now fail fast with status `FAILED` and a clear
  error message (previously they could remain `PROCESSING` indefinitely after
  a server interruption). Failure emails and `job.failed` webhooks now fire
  for every terminal outcome. No request/response shape changes.

## [0.6.0] — 2026-07-13

### Changed — BREAKING (API Schema v2.0.0)
- `CadEntity` restructured to the Schema v2 envelope: flat coordinate fields
  moved into `entity.geometry` (per-type spatial fields, original precision);
  each entity now carries `handle` (original CAD handle or `null`), `category`
  (`Geometry`/`Annotation`/`BlockReference`/`Hatch`/`Other`), `layout`, and
  always-present `properties`, `bbox`, `metrics` siblings (computed helpers,
  6-decimal, `null` when not applicable), plus `text` (TEXT/MTEXT) and
  `reference` (INSERT). The type remains a discriminated union on `type` with
  per-type `geometry` shapes.
- `mcp-server-reference.md` data-shape docs updated to the v2 envelope.

### Added
- `JobResult.schemaVersion` / `parserVersion` ("2.0.0"), `JobResult.parseInfo`
  (`{durationMs, warnings, errors}` — `durationMs` null pre-v2), and
  `ResultSummary.statistics` (`byType` / `byCategory` counts).
- `WebhookPayload.result.schemaVersion` (additive).

## [0.5.0] — 2026-07-07

### Added
- `DrawingMetadata.unsupported3DCount`: optional count of 3D-only entity types
  (3DSOLID/BODY/SURFACE/REGION/MESH) with no extractable geometry.

### Fixed (API behaviour, no type change)
- `metadata.is3D` no longer reports `true` for drawings whose only 3D content
  is unsupported entity types with an empty 3D scene.

## [0.4.0] — 2026-07-06

### Added
- `notify_email` input on `cadlens_parse_file` and `cadlens_parse_url`: CADLens
  emails a job link when the parse finishes unattended (suppressed when the
  uploader watches the job complete live).
- `WebhookPayload.result.resultUrl` and `SheetSummary` type.

### Changed (breaking for webhook consumers)
- `WebhookPayload.result.sheets` is now `SheetSummary[]` — sheets carry metadata
  only (no `entities`/`layers`), matching API v1.4.0 slim webhook payloads.
  Fetch full geometry from `resultUrl` (`GET /v1/jobs/:id/result`, unchanged) or
  the `cadlens_get_result` tool. Payloads over 256 KB omit `sheets` entirely.

### Notes (API v1.4.1, 2026-07-06)
- API responses are now gzip-compressed via standard content negotiation
  (`Accept-Encoding`). HTTP clients handle this automatically — no SDK code
  change or upgrade required; large results simply download ~12× faster.

## [0.3.0] — 2026-07-02

### Added
- `HATCH` added to the `CadEntity` union and `CAD_ENTITY_TYPES` (boundaries, `solid`,
  `patternName`, `patternAngle`, `patternScale`, and new `patternLines` — exact hatch
  pattern geometry in drawing units with rotation/scale applied).
- `DrawingMetadata.linetypePatterns` (LTYPE table) and `DrawingMetadata.ltscale`.

### Fixed (API behaviour)
- Mirrored-OCS entities (extrusion normal 0,0,−1) now returned at correct WCS
  coordinates; Z-artifact entities projected instead of dropped.

## [0.2.1] — 2026-06-26

### Fixed
- `get_job_result` tool: API now responds promptly for drawings with large entity counts
  (PDFs, complex DXF files). Previously the endpoint timed out, making results unavailable
  to LLM clients.
- PDF files now correctly return one image URL per page in `image_urls`. Previously only
  a single entry was returned (or the request timed out entirely).

## [0.2.0] — 2026-06-25

### Added
- `Sheet.key`: HTML/CSS-safe unique slug, safe for use as an HTML `id` attribute.
  Deduplicated with `-2`, `-3` suffix when the same label appears on multiple sheets.
- `DrawingMetadata.layoutLabels`: original display labels in image order. Parallel to `layouts[]`.
- `DrawingMetadata.layoutKeys`: HTML/CSS-safe slugs in image order. Parallel to `layouts[]`.

### Fixed
- Per-viewport frozen-layer rendering: named layout sheets now show only the layers
  visible in that viewport.
- PNG preview now correctly scales entity text height through viewport transforms.

## [0.1.2] — 2026-06-19

Sync types to sheets-based response schema.

## [0.1.0] — 2026-05-01

Initial release.
