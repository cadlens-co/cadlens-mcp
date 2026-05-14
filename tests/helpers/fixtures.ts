import type { JobResult } from '../../src/api/types.js';

export function makeJobResult(overrides: Partial<JobResult> = {}): JobResult {
  return {
    jobId: '42',
    status: 'COMPLETED',
    vectorJson: {
      entities: [
        { type: 'LINE', id: 'e1', layer: '0', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
        { type: 'LINE', id: 'e2', layer: 'WALLS', start: { x: 0, y: 0 }, end: { x: 2, y: 0 } },
        {
          type: 'CIRCLE',
          id: 'e3',
          layer: 'WALLS',
          center: { x: 5, y: 5 },
          radius: 2,
        },
        {
          type: 'TEXT',
          id: 'e4',
          layer: 'NOTES',
          text: 'NORTH',
          position: { x: 0, y: 10 },
          height: 1,
          rotation: 0,
        },
      ],
    },
    layersJson: [
      { name: '0', color: 7, colorHex: '#FFFFFF', lineType: 'CONTINUOUS', isVisible: true, entityCount: 1 },
      { name: 'WALLS', color: 1, colorHex: '#FF0000', lineType: 'CONTINUOUS', isVisible: true, entityCount: 2 },
      { name: 'NOTES', color: 3, colorHex: '#00FF00', lineType: 'CONTINUOUS', isVisible: true, entityCount: 1 },
    ],
    metadata: {
      filename: 'sample.dwg',
      format: 'DWG',
      dwgVersion: 'AC1021',
      units: 'mm',
      boundingBox: { minX: 0, minY: 0, maxX: 12000, maxY: 8000, width: 12000, height: 8000 },
    },
    imageUrl: 'https://s3.amazonaws.com/test/preview.png?sig=abc',
    createdAt: '2026-05-13T10:14:25.000Z',
    ...overrides,
  };
}
