import type { CadEntity, JobResult, LayerDef } from './api/types.js';

export interface Summary {
  job_id: string;
  status: 'COMPLETED';
  format: string | undefined;
  units: string | undefined;
  bounding_box: JobResult['metadata']['boundingBox'] | undefined;
  entity_count: number;
  entity_count_by_type: Record<string, number>;
  layers: Array<Pick<LayerDef, 'name' | 'colorHex' | 'entityCount'>>;
  image_url: string;
  image_url_expires_in_seconds: number;
  truncated: boolean;
}

export function summarize(result: JobResult): Summary {
  const entities: CadEntity[] = result.vectorJson?.entities ?? [];
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
    layers: (result.layersJson ?? []).map((l) => ({
      name: l.name,
      colorHex: l.colorHex,
      entityCount: l.entityCount,
    })),
    image_url: result.imageUrl,
    image_url_expires_in_seconds: 3600,
    truncated: result.metadata?.truncated === true,
  };
}
