# Changelog

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
