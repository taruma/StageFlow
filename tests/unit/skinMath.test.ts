import { describe, expect, it } from 'vitest';
import {
  buildEntitySkinsSignature,
  computeGlbEntityNormalization,
  suggestSkinTargetId,
} from '../../src/core/skinMath';
import type { SceneEntityDef } from '../../src/core/types';

function makeEntity(
  id: string,
  label: string,
  kind: SceneEntityDef['kind'] = 'character'
): SceneEntityDef {
  return {
    id,
    label,
    kind,
    color: '#38bdf8',
    height: 1.75,
    radius: 0.28,
    position: { x: 0, y: 0, z: 0 },
    rotationYRad: 0,
  };
}

describe('skinMath', () => {
  it('centers X/Z and pins min.y to 0 with uniform height scaling for characters', () => {
    const norm = computeGlbEntityNormalization(
      { x: -1, y: -0.5, z: 2 },
      { x: 1, y: 3.0, z: 4 },
      {
        kind: 'character',
        baseWidth: 0.56,
        height: 1.75,
        baseDepth: 0.56,
        hasExplicitWidthDepth: false,
      }
    );

    expect(norm.offset).toEqual([0, 0.5, -3]);
    expect(norm.scale).toEqual([0.5, 0.5, 0.5]);
  });

  it('fits explicit width, height, and depth for props', () => {
    const norm = computeGlbEntityNormalization(
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 4, z: 1 },
      {
        kind: 'prop',
        baseWidth: 4,
        height: 2,
        baseDepth: 3,
        hasExplicitWidthDepth: true,
      }
    );

    expect(norm.offset).toEqual([-1, 0, -0.5]);
    expect(norm.scale).toEqual([2, 0.5, 3]);
  });

  it('guards against zero-volume bounding boxes without NaN or Infinity', () => {
    const norm = computeGlbEntityNormalization(
      { x: 1, y: 2, z: 3 },
      { x: 1, y: 2, z: 3 },
      {
        kind: 'prop',
        baseWidth: 1,
        height: 1,
        baseDepth: 1,
        hasExplicitWidthDepth: true,
      }
    );

    expect(Number.isFinite(norm.scale[0])).toBe(true);
    expect(Number.isFinite(norm.scale[1])).toBe(true);
    expect(Number.isFinite(norm.scale[2])).toBe(true);
  });

  it('suggests matching entity id from dropped .glb filenames and defaults to stage', () => {
    const entities: SceneEntityDef[] = [
      makeEntity('hero', 'Ruby (Hero)', 'character'),
      makeEntity('cafe_table', 'Cafe Table', 'prop'),
    ];

    expect(suggestSkinTargetId('hero.glb', entities)).toBe('hero');
    expect(suggestSkinTargetId('hero_mannequin.glb', entities)).toBe('hero');
    expect(suggestSkinTargetId('Cafe Table.gltf', entities)).toBe('cafe_table');
    expect(suggestSkinTargetId('cafe_interior_set.glb', entities)).toBe('stage');
  });

  it('produces deterministic sorted signatures for entitySkinUrls', () => {
    expect(buildEntitySkinsSignature(null)).toBe('');
    expect(buildEntitySkinsSignature({})).toBe('');
    expect(
      buildEntitySkinsSignature({
        b: 'blob:2',
        a: 'blob:1',
      })
    ).toBe('a=blob:1;b=blob:2');
  });
});
