export type Point2D = { x: number; y: number; bulge?: number };

export type EntityCategory = 'Geometry' | 'Annotation' | 'BlockReference' | 'Hatch' | 'Other';

/** Computed axis-aligned bounds (6-decimal). All values null when uncomputable (e.g. INSERT). */
export interface EntityBbox {
  minX: number | null;
  minY: number | null;
  maxX: number | null;
  maxY: number | null;
}

/** Computed helper values (6-decimal, exact-only); null when not applicable. */
export interface EntityMetrics {
  length: number | null;
  area: number | null;
  perimeter: number | null;
  vertexCount: number | null;
}

/** Display properties. HATCH pattern fields are null on non-HATCH types. */
export interface EntityProperties {
  colorIndex: number | null;
  lineType: string | null;
  lineweight: number | null;
  visible: boolean;
  solid: boolean | null;
  patternName: string | null;
  patternAngle: number | null;
  patternScale: number | null;
}

/** TEXT/MTEXT content — null on other entity types. */
export interface EntityText {
  value: string;
  height: number;
  style: string | null;
}

/** INSERT block reference — null on other entity types. */
export interface EntityReference {
  blockName: string;
}

/** Shared Schema v2 entity envelope fields. */
interface EntityBase {
  /** Stable identifier — CAD handle when available, otherwise a synthetic UUID. */
  id: string;
  /** Original CAD handle (DXF group code 5) or null — never derived from `id`. */
  handle: string | null;
  layer: string;
  layout: string | null;
  properties: EntityProperties;
  bbox: EntityBbox;
  metrics: EntityMetrics;
}

/**
 * Schema v2 entity envelope (API schemaVersion 2.0.0). Spatial data lives in
 * `geometry` (original precision; ARC/ELLIPSE angles in radians, TEXT/INSERT
 * rotation in degrees); `text`/`reference` are populated only for the types
 * that use them.
 */
export type CadEntity =
  | (EntityBase & { type: 'LINE'; category: 'Geometry'; geometry: { start: Point2D; end: Point2D }; text: null; reference: null })
  | (EntityBase & { type: 'ARC'; category: 'Geometry'; geometry: { center: Point2D; radius: number; startAngle: number; endAngle: number }; text: null; reference: null })
  | (EntityBase & { type: 'CIRCLE'; category: 'Geometry'; geometry: { center: Point2D; radius: number }; text: null; reference: null })
  | (EntityBase & { type: 'POLYLINE'; category: 'Geometry'; geometry: { vertices: Point2D[]; closed: boolean; filled: boolean | null }; text: null; reference: null })
  | (EntityBase & { type: 'LWPOLYLINE'; category: 'Geometry'; geometry: { vertices: Point2D[]; closed: boolean; filled: boolean | null }; text: null; reference: null })
  | (EntityBase & { type: 'TEXT'; category: 'Annotation'; geometry: { position: Point2D; rotation: number }; text: EntityText; reference: null })
  | (EntityBase & { type: 'MTEXT'; category: 'Annotation'; geometry: { position: Point2D; rotation: number }; text: EntityText; reference: null })
  | (EntityBase & { type: 'INSERT'; category: 'BlockReference'; geometry: { position: Point2D; scaleX: number; scaleY: number; rotation: number }; text: null; reference: EntityReference })
  | (EntityBase & { type: 'SPLINE'; category: 'Geometry'; geometry: { controlPoints: Point2D[]; degree: number; knots: number[] | null }; text: null; reference: null })
  | (EntityBase & { type: 'ELLIPSE'; category: 'Geometry'; geometry: { center: Point2D; majorAxis: Point2D; ratio: number; startAngle: number; endAngle: number }; text: null; reference: null })
  | (EntityBase & { type: 'HATCH'; category: 'Hatch'; geometry: { boundaries: Array<{ edges: unknown[] }> }; text: null; reference: null });

/** One hatch pattern-definition line family (DXF groups 53/43/44/45/46/49). */
export interface HatchPatternLine {
  angle: number;                    // degrees CCW from +X
  base: { x: number; y: number };   // base point of the first line
  offset: { x: number; y: number }; // offset to the next parallel line
  dashes: number[];                 // + dash, − gap, 0 = dot; empty = solid
}

export type CadEntityType = CadEntity['type'];

export const CAD_ENTITY_TYPES: CadEntityType[] = [
  'LINE',
  'ARC',
  'CIRCLE',
  'POLYLINE',
  'LWPOLYLINE',
  'TEXT',
  'MTEXT',
  'INSERT',
  'SPLINE',
  'ELLIPSE',
  'HATCH',
];

export interface LayerDef {
  name: string;
  color: number;
  colorHex: string;
  lineType: string;
  isVisible: boolean;
  entityCount: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface DrawingMetadata {
  filename: string;
  format: 'DWG' | 'DXF' | 'DWF' | 'DWFX' | 'DGN' | 'PDF';
  dwgVersion: string;
  units: 'mm' | 'cm' | 'm' | 'inch' | 'feet' | 'unknown';
  boundingBox: BoundingBox;
  layouts?: string[];
  layoutLabels?: string[];
  layoutKeys?: string[];
  /** LTYPE table: linetype name → dash/gap array in drawing units (+ dash, − gap) */
  linetypePatterns?: Record<string, number[]>;
  /** DXF $LTSCALE global linetype scale factor */
  ltscale?: number;
  /** Count of 3D-only entity types (3DSOLID/BODY/SURFACE/REGION/MESH) with no extractable geometry. */
  unsupported3DCount?: number;
  truncated?: boolean;
}

export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Job {
  id: string;
  uuid?: string;
  status: JobStatus;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  createdAt: string;
  updatedAt?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  errorMsg?: string | null;
  webhookUrl?: string | null;
}

export interface FileInfo {
  name: string;
  format: string;
  version: string;
  units: string;
}

/** Entity counts grouped by type and by category. */
export interface ResultStatistics {
  byType: Record<string, number>;
  byCategory: Record<string, number>;
}

export interface ResultSummary {
  totalSheets: number;
  totalEntities: number;
  totalLayers: number;
  statistics?: ResultStatistics;
  boundingBox?: BoundingBox;
  truncated: boolean;
}

/** Parse diagnostics. `durationMs` is null for jobs parsed before Schema v2. */
export interface ParseInfo {
  durationMs: number | null;
  warnings: string[];
  errors: string[];
}

export interface Sheet {
  name: string;
  key: string;
  index: number;
  imageUrl: string | null;
  entityCount: number;
  layerCount: number;
  boundingBox: BoundingBox;
  area: number;
  perimeter: number;
  layers: LayerDef[];
  entities: CadEntity[];
}

export interface JobResult {
  /** Semver of the JSON contract (Schema v2 = "2.0.0"). */
  schemaVersion?: string;
  /** CAD parser engine version, independent of application releases. */
  parserVersion?: string;
  jobId: string;
  status: 'COMPLETED';
  file?: FileInfo;
  summary?: ResultSummary;
  sheets: Sheet[];
  metadata: DrawingMetadata;
  parseInfo?: ParseInfo;
  imageUrl?: string;
  imageUrls?: string[];
  createdAt: string;
}

export interface ParseResponseAsync {
  job_id: string;
  status: JobStatus;
  fileName: string;
  fileSize: number;
  createdAt: string;
  message?: string;
}

export interface ParseResponseSync extends ParseResponseAsync {
  status: 'COMPLETED';
  completedAt: string;
  file?: FileInfo;
  summary?: ResultSummary;
  sheets: Sheet[];
  metadata: DrawingMetadata;
  imageUrl?: string;
  imageUrls?: string[];
}

export type ParseResponse = ParseResponseAsync | ParseResponseSync;

export interface WebhookPayload {
  eventId: string;
  sequence: number;
  event: 'job.processing' | 'job.completed' | 'job.failed';
  jobId: string;
  status: JobStatus;
  timestamp: string;
  // Webhook sheets carry metadata only (no entities/layers) since API v1.4.0;
  // fetch full geometry from `resultUrl` (GET /v1/jobs/:id/result). Payloads
  // over 256 KB omit `sheets` entirely.
  result?: {
    /** Semver of the result JSON contract (Schema v2 = "2.0.0"). */
    schemaVersion?: string;
    imageUrl?: string;
    imageUrls?: string[];
    file?: FileInfo;
    summary?: ResultSummary;
    sheets?: SheetSummary[];
    resultUrl?: string;
  };
  error?: string;
}

/** A Sheet without the raw geometry arrays — the shape used in webhook payloads. */
export type SheetSummary = Omit<Sheet, 'entities' | 'layers'>;
