export type Point2D = { x: number; y: number; bulge?: number };

export type CadEntity =
  | { type: 'LINE'; id: string; layer: string; start: Point2D; end: Point2D; colorIndex?: number }
  | {
      type: 'ARC';
      id: string;
      layer: string;
      center: Point2D;
      radius: number;
      startAngle: number;
      endAngle: number;
      colorIndex?: number;
    }
  | { type: 'CIRCLE'; id: string; layer: string; center: Point2D; radius: number; colorIndex?: number }
  | {
      type: 'POLYLINE';
      id: string;
      layer: string;
      vertices: Point2D[];
      closed: boolean;
      colorIndex?: number;
    }
  | {
      type: 'LWPOLYLINE';
      id: string;
      layer: string;
      vertices: Point2D[];
      closed: boolean;
      colorIndex?: number;
    }
  | {
      type: 'TEXT';
      id: string;
      layer: string;
      text: string;
      position: Point2D;
      height: number;
      rotation: number;
      colorIndex?: number;
    }
  | {
      type: 'MTEXT';
      id: string;
      layer: string;
      text: string;
      position: Point2D;
      height: number;
      rotation: number;
      colorIndex?: number;
    }
  | {
      type: 'INSERT';
      id: string;
      layer: string;
      blockName: string;
      position: Point2D;
      scaleX: number;
      scaleY: number;
      rotation: number;
      colorIndex?: number;
    }
  | {
      type: 'SPLINE';
      id: string;
      layer: string;
      controlPoints: Point2D[];
      degree: number;
      colorIndex?: number;
    }
  | {
      type: 'ELLIPSE';
      id: string;
      layer: string;
      center: Point2D;
      majorAxis: Point2D;
      ratio: number;
      startAngle: number;
      endAngle: number;
      colorIndex?: number;
    }
  | {
      type: 'HATCH';
      id: string;
      layer: string;
      colorIndex?: number;
      boundaries: Array<{ edges: CadEntity[] }>;
      solid?: boolean;
      patternName?: string;
      patternAngle?: number;
      patternScale?: number;
      /** Exact pattern geometry — drawing units, rotation/scale already applied */
      patternLines?: HatchPatternLine[];
    };

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

export interface ResultSummary {
  totalSheets: number;
  totalEntities: number;
  totalLayers: number;
  boundingBox?: BoundingBox;
  truncated: boolean;
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
  jobId: string;
  status: 'COMPLETED';
  file?: FileInfo;
  summary?: ResultSummary;
  sheets: Sheet[];
  metadata: DrawingMetadata;
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
  result?: {
    imageUrl?: string;
    imageUrls?: string[];
    file?: FileInfo;
    summary?: ResultSummary;
    sheets?: Sheet[];
  };
  error?: string;
}
