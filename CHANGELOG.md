# Changelog

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
