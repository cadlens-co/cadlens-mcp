import type { CadEntity, JobResult, LayerDef } from './api/types.js';

export interface Summary {
  job_id: string;
  status: 'COMPLETED';
  format: string | undefined;
  units: string | undefined;
  bounding_box: JobResult['metadata']['boundingBox'] | undefined;
  total_sheets: number;
  entity_count: number;
  entity_count_by_type: Record<string, number>;
  layers: Array<Pick<LayerDef, 'name' | 'colorHex' | 'entityCount'>>;
  image_url: string;
  image_urls: string[];
  image_url_expires_in_seconds: number;
  truncated: boolean;
}

export function summarize(result: JobResult): Summary {
  const sheets = result.sheets ?? [];
  const entities: CadEntity[] = sheets.flatMap((s) => s.entities);
  const byType: Record<string, number> = {};
  for (const e of entities) byType[e.type] = (byType[e.type] ?? 0) + 1;

  // Deduplicate layers by name across sheets
  const layerMap = new Map<string, LayerDef>();
  for (const sheet of sheets) {
    for (const l of sheet.layers) {
      if (!layerMap.has(l.name)) layerMap.set(l.name, l);
    }
  }

  return {
    job_id: result.jobId,
    status: result.status,
    format: result.file?.format ?? result.metadata?.format,
    units: result.file?.units ?? result.metadata?.units,
    bounding_box: result.summary?.boundingBox ?? result.metadata?.boundingBox,
    total_sheets: sheets.length,
    entity_count: result.summary?.totalEntities ?? entities.length,
    entity_count_by_type: byType,
    layers: Array.from(layerMap.values()).map((l) => ({
      name: l.name,
      colorHex: l.colorHex,
      entityCount: l.entityCount,
    })),
    image_url: result.imageUrl ?? (result.imageUrls?.[0] ?? ''),
    image_urls: result.imageUrls ?? (result.imageUrl ? [result.imageUrl] : []),
    image_url_expires_in_seconds: 3600,
    truncated: result.summary?.truncated === true,
  };
}
