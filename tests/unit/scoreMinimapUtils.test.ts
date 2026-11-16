import { describe, expect, it } from 'vitest';
import {
  computeMinimapLayout,
  resolveMinimapShotOffset,
  resolveMinimapTargetXZ,
} from '../../src/ui/library/scoreMinimapUtils';
import { parseStageScore } from '../../src/core/scoreParser';
import { degToRad } from '../../src/core/sphericalMath';
import type { SceneEntityDef } from '../../src/core/types';

describe('scoreMinimapUtils — Pure 2D Minimap Target & Layout Helpers', () => {
  const entities: SceneEntityDef[] = [
    {
      id: 'hero',
      label: 'Hero',
      kind: 'character',
      position: { x: 2.0, y: 0.0, z: 0.0 },
      rotationYRad: degToRad(90),
      width: 0.6,
      height: 2.0,
      radius: 0.3,
      color: '#38bdf8',
    },
    {
      id: 'dr.smith',
      label: 'Dr. Smith',
      kind: 'character',
      position: { x: -2.0, y: 0.18, z: 0.0 },
      rotationYRad: 0,
      pitchRad: degToRad(90),
      width: 0.52,
      height: 1.8,
      radius: 0.26,
      color: '#10b981',
    },
    {
      id: 'center',
      label: 'Center Prop',
      kind: 'prop',
      position: { x: 5.0, y: 0.0, z: 5.0 },
      rotationYRad: 0,
      width: 1.0,
      height: 1.0,
      radius: 0.5,
      color: '#f59e0b',
    },
  ];

  describe('resolveMinimapTargetXZ', () => {
    it('checks center/origin/stage presets before entity matching in single and array targets', () => {
      // Preset 'center' must resolve to (0, 0) even though an entity named 'center' exists at (5, 5)
      expect(resolveMinimapTargetXZ('center', entities)).toEqual({ x: 0, z: 0 });
      expect(resolveMinimapTargetXZ('origin', entities)).toEqual({ x: 0, z: 0 });
      expect(resolveMinimapTargetXZ('stage', entities)).toEqual({ x: 0, z: 0 });

      // Array ['hero', 'center'] averages hero (2, 0) with (0, 0) -> (1, 0)
      const centroid = resolveMinimapTargetXZ(['hero', 'center'], entities);
      expect(centroid.x).toBeCloseTo(1.0, 4);
      expect(centroid.z).toBeCloseTo(0.0, 4);
    });

    it('resolves rotated and tilted dot-notation sub-anchors and dotted IDs', () => {
      // hero at [2, 0, 0], w=0.6, yaw=+90deg -> shoulder_l local (+0.24, y, 0) rotated -> (2.0, -0.24)
      const shoulder = resolveMinimapTargetXZ('hero.shoulder_l', entities);
      expect(shoulder.x).toBeCloseTo(2.0, 4);
      expect(shoulder.z).toBeCloseTo(-0.24, 4);

      // dr.smith at [-2, 0.18, 0], h=1.8, pitch=90deg -> chest local (0, 1.35, 0) rotated -> (-2.0, 1.35)
      const chest = resolveMinimapTargetXZ('dr.smith.chest', entities);
      expect(chest.x).toBeCloseTo(-2.0, 4);
      expect(chest.z).toBeCloseTo(1.35, 4);
    });

    it('applies metric XZ target_offset cleanly', () => {
      const shifted = resolveMinimapTargetXZ('hero.shoulder_l', entities, {
        x: 0.5,
        y: 0.2,
        z: -0.26,
      });
      expect(shifted.x).toBeCloseTo(2.5, 4);
      expect(shifted.z).toBeCloseTo(-0.5, 4);
    });
  });

  describe('resolveMinimapShotOffset & computeMinimapLayout', () => {
    it('prioritizes targetOffsetEnd -> targetOffset -> targetOffsetStart with continuous inheritance', () => {
      expect(
        resolveMinimapShotOffset({
          targetOffset: { x: 1, y: 0, z: 2 },
          targetOffsetStart: { x: 0.1, y: 0, z: 0.2 },
          targetOffsetEnd: { x: 3, y: 0, z: 4 },
        })
      ).toEqual({ x: 3, y: 0, z: 4 });

      expect(
        resolveMinimapShotOffset({
          targetOffset: { x: 1, y: 0, z: 2 },
          targetOffsetStart: { x: 0.1, y: 0, z: 0.2 },
        })
      ).toEqual({ x: 1, y: 0, z: 2 });

      expect(
        resolveMinimapShotOffset({
          targetOffsetStart: { x: 0.1, y: 0, z: 0.2 },
        })
      ).toEqual({ x: 0.1, y: 0, z: 0.2 });

      expect(
        resolveMinimapShotOffset({}, { x: 2, y: 0, z: -1 }, true)
      ).toEqual({ x: 2, y: 0, z: -1 });
    });

    it('computes minimap cameraTarget and cameraTrackPath with target_offset, sub-anchors, and inherited targets', () => {
      const yaml = `
version: "1.0"
id: "minimap-test"
title: "Minimap Test"
duration: 6.0
entities:
  - id: "hero"
    kind: "character"
    position: [2.0, 0.0, 0.0]
    width: 0.6
    height: 2.0
    rotation: 90
shots:
  - id: "s1"
    start: 0
    end: 3
    stage_camera:
      target: ["hero", "center"]
      target_offset: [0.5, 0.0, -1.0]
      distance: 4.0
      pitch: 0
      yaw: 0
  - id: "s2"
    start: 3
    end: 6
    continuous: true
    stage_camera:
      distance: 2.0
      pitch: 0
      yaw: 0
`;
      const { score, error } = parseStageScore(yaml);
      expect(error).toBeNull();
      const layout = computeMinimapLayout(score!);

      // Shot 1 target: centroid of hero (2,0) & center (0,0) = (1, 0) + offset (0.5, -1.0) = (1.5, -1.0)
      expect(layout.cameraTarget.x).toBeCloseTo(1.5, 4);
      expect(layout.cameraTarget.z).toBeCloseTo(-1.0, 4);
      // Camera at distance 4.0, pitch 0, yaw 0 -> target + (0, 4.0) = (1.5, 3.0)
      expect(layout.cameraPos.x).toBeCloseTo(1.5, 4);
      expect(layout.cameraPos.z).toBeCloseTo(3.0, 4);

      // Shot 2 inherits base target (1, 0) and continuous offset (0.5, -1.0) -> camera at (1.5, 1.0)
      expect(layout.cameraTrackPath).toBe(' M 1.50 3.00 L 1.50 1.00');
    });

    it('projects tilted entity targets using their configured vertical pivotRatio (#20)', () => {
      const yaml = `
version: "1.0"
id: "minimap-pivot-test"
title: "Minimap Pivot Test"
duration: 4.0
entities:
  - id: "flyer"
    kind: "character"
    position: [1.0, 2.0, 0.0]
    height: 2.0
    pitch: 90
    pivot: "center"
shots:
  - id: "s1"
    start: 0
    end: 4
    stage_camera:
      target: "flyer"
      distance: 4.0
      pitch: 0
      yaw: 0
`;
      const { score, error } = parseStageScore(yaml);
      expect(error).toBeNull();
      const layout = computeMinimapLayout(score!);

      // flyer h=2.0, pivot=0.5, pitch=90 -> eye anchor (0.9h -> +0.8m from pivot) rotates forward to z = +0.8m
      expect(layout.cameraTarget.x).toBeCloseTo(1.0, 4);
      expect(layout.cameraTarget.z).toBeCloseTo(0.8, 4);
    });
  });
});
