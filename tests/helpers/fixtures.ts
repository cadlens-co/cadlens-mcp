import type { EntityProperties, JobResult } from '../../src/api/types.js';

/** Schema v2 entity `properties` with non-HATCH defaults. */
function props(overrides: Partial<EntityProperties> = {}): EntityProperties {
  return {
    colorIndex: 7,
    lineType: 'CONTINUOUS',
    lineweight: null,
    visible: true,
    solid: null,
    patternName: null,
    patternAngle: null,
    patternScale: null,
    ...overrides,
  };
}

export function makeJobResult(overrides: Partial<JobResult> = {}): JobResult {
  return {
    jobId: '42',
    status: 'COMPLETED',
    file: { name: 'sample.dwg', format: 'DWG', version: 'AC1021', units: 'mm' },
    summary: {
      totalSheets: 1,
      totalEntities: 4,
      totalLayers: 3,
      boundingBox: { minX: 0, minY: 0, maxX: 12000, maxY: 8000, width: 12000, height: 8000 },
      truncated: false,
    },
    sheets: [
      {
        name: 'Model',
        key: 'Model',
        index: 0,
        imageUrl: 'https://s3.amazonaws.com/test/preview.png?sig=abc',
        entityCount: 4,
        layerCount: 3,
        boundingBox: { minX: 0, minY: 0, maxX: 12000, maxY: 8000, width: 12000, height: 8000 },
        area: 96_000_000,
        perimeter: 40_000,
        layers: [
          { name: '0', color: 7, colorHex: '#FFFFFF', lineType: 'CONTINUOUS', isVisible: true, entityCount: 1 },
          { name: 'WALLS', color: 1, colorHex: '#FF0000', lineType: 'CONTINUOUS', isVisible: true, entityCount: 2 },
          { name: 'NOTES', color: 3, colorHex: '#00FF00', lineType: 'CONTINUOUS', isVisible: true, entityCount: 1 },
        ],
        entities: [
          {
            type: 'LINE', category: 'Geometry', id: 'e1', handle: '1A', layer: '0', layout: 'Model',
            geometry: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
            text: null, reference: null,
            properties: props(),
            bbox: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
            metrics: { length: 1.414214, area: null, perimeter: null, vertexCount: 2 },
          },
          {
            type: 'LINE', category: 'Geometry', id: 'e2', handle: '1B', layer: 'WALLS', layout: 'Model',
            geometry: { start: { x: 0, y: 0 }, end: { x: 2, y: 0 } },
            text: null, reference: null,
            properties: props({ colorIndex: 1 }),
            bbox: { minX: 0, minY: 0, maxX: 2, maxY: 0 },
            metrics: { length: 2, area: null, perimeter: null, vertexCount: 2 },
          },
          {
            type: 'CIRCLE', category: 'Geometry', id: 'e3', handle: '1C', layer: 'WALLS', layout: 'Model',
            geometry: { center: { x: 5, y: 5 }, radius: 2 },
            text: null, reference: null,
            properties: props({ colorIndex: 1 }),
            bbox: { minX: 3, minY: 3, maxX: 7, maxY: 7 },
            metrics: { length: null, area: 12.566371, perimeter: 12.566371, vertexCount: null },
          },
          {
            type: 'TEXT', category: 'Annotation', id: 'e4', handle: '1D', layer: 'NOTES', layout: 'Model',
            geometry: { position: { x: 0, y: 10 }, rotation: 0 },
            text: { value: 'NORTH', height: 1, style: 'STANDARD' }, reference: null,
            properties: props({ colorIndex: 3 }),
            bbox: { minX: 0, minY: 10, maxX: 3.5, maxY: 11 },
            metrics: { length: null, area: null, perimeter: null, vertexCount: null },
          },
        ],
      },
    ],
    metadata: {
      filename: 'sample.dwg',
      format: 'DWG',
      dwgVersion: 'AC1021',
      units: 'mm',
      boundingBox: { minX: 0, minY: 0, maxX: 12000, maxY: 8000, width: 12000, height: 8000 },
    },
    imageUrl: 'https://s3.amazonaws.com/test/preview.png?sig=abc',
    imageUrls: ['https://s3.amazonaws.com/test/preview.png?sig=abc'],
    createdAt: '2026-05-13T10:14:25.000Z',
    ...overrides,
  };
}
