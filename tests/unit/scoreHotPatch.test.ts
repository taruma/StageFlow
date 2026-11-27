import { describe, it, expect } from 'vitest';
import { computeStageFrame } from '../../src/core/frameEngine';
import {
  applyScoreHotPatch,
  applyShotTimingHotPatch,
} from '../../src/core/scoreHotPatch';
import { parseStageScore } from '../../src/core/scoreParser';
import { applyScoreYamlCommand } from '../../src/core/scoreYamlMutator';

const BASE_YAML = `
version: "1.0"
id: "hotpatch-test"
title: "HotPatch Test"
duration: 10.0
stage:
  width: 12
  depth: 12
  observer_camera:
    target: [0, 1.0, 0]
    distance: 12.0
    pitch: 20
    yaw: 30
    lens: 35mm
entities:
  - id: "hero"
    label: "Hero"
    kind: "character"
    position: [0, 0, 0]
    rotation: 0
shots:
  - id: "s1"
    start: 0.0
    end: 10.0
    stage_camera:
      target: "hero"
      maneuver: "dolly"
      distance: 4.0
      pitch: 10
      yaw: 25
      roll: 5
      lens: 50mm
`;

describe('scoreHotPatch', () => {
  it('produces identical 3D transforms to full YAML mutation + re-parse', () => {
    const baseScore = parseStageScore(BASE_YAML).score!;

    const cases: Array<{ path: (string | number)[]; val: unknown; format?: 'lens-mm' | 'vec3-flow' }> = [
      { path: ['shots', 0, 'stage_camera', 'distance'], val: 6.2 },
      { path: ['shots', 0, 'stage_camera', 'pitch'], val: 18.5 },
      { path: ['shots', 0, 'stage_camera', 'yaw'], val: -42 },
      { path: ['shots', 0, 'stage_camera', 'roll'], val: -12 },
      { path: ['shots', 0, 'stage_camera', 'lens'], val: 85, format: 'lens-mm' },
      { path: ['entities', 0, 'position'], val: [1.5, 0, -2.0], format: 'vec3-flow' },
      { path: ['entities', 0, 'rotation'], val: 90 },
      { path: ['stage', 'observer_camera', 'distance'], val: 15.0 },
    ];

    for (const c of cases) {
      const hot = applyScoreHotPatch(baseScore, c.path, c.val);
      expect(hot).not.toBeNull();

      const nextYaml = applyScoreYamlCommand(BASE_YAML, {
        type: 'set-field',
        path: c.path,
        value: c.val,
        format: c.format,
      });
      const reparsed = parseStageScore(nextYaml).score!;

      const fHot = computeStageFrame(2.5, hot!);
      const fFull = computeStageFrame(2.5, reparsed);

      expect(fHot.stageCamera.transform.position.x).toBeCloseTo(
        fFull.stageCamera.transform.position.x,
        6
      );
      expect(fHot.stageCamera.transform.position.y).toBeCloseTo(
        fFull.stageCamera.transform.position.y,
        6
      );
      expect(fHot.stageCamera.transform.position.z).toBeCloseTo(
        fFull.stageCamera.transform.position.z,
        6
      );
      expect(fHot.stageCamera.transform.fovDeg).toBeCloseTo(
        fFull.stageCamera.transform.fovDeg,
        6
      );
      expect(fHot.entitiesList[0].position).toEqual(fFull.entitiesList[0].position);
      expect(fHot.entitiesList[0].rotationYRad).toBeCloseTo(
        fFull.entitiesList[0].rotationYRad,
        6
      );
    }
  });

  it('hot-patches shot timing in free, roll, and ripple modes identically to AST mutator', () => {
    const multiShotYaml = `${BASE_YAML}
  - id: "s2"
    start: 10.0
    end: 15.0
    stage_camera:
      target: "hero"
      distance: 2.5
  - id: "s3"
    start: 15.0
    end: 20.0
    stage_camera:
      target: "hero"
      distance: 6.0
`;
    const score = parseStageScore(multiShotYaml).score!;
    const patchedBase = { ...score, durationSec: 20.0 };

    // Free mode
    const freeHot = applyShotTimingHotPatch(patchedBase, 0, 'end', 8.5, 'free')!;
    expect(freeHot.shots[0].endSec).toBe(8.5);
    expect(freeHot.shots[1].startSec).toBe(10.0);

    // Roll mode (end & start boundaries)
    const rollEndHot = applyShotTimingHotPatch(patchedBase, 0, 'end', 12.25, 'roll')!;
    expect(rollEndHot.shots[0].endSec).toBe(12.25);
    expect(rollEndHot.shots[1].startSec).toBe(12.25);
    expect(rollEndHot.shots[1].endSec).toBe(15.0);

    const rollStartHot = applyShotTimingHotPatch(patchedBase, 1, 'start', 7.5, 'roll')!;
    expect(rollStartHot.shots[0].endSec).toBe(7.5);
    expect(rollStartHot.shots[1].startSec).toBe(7.5);

    // Ripple mode: +2s shifts downstream shots & durationSec
    const rippleHot = applyShotTimingHotPatch(patchedBase, 0, 'end', 12.0, 'ripple')!;
    expect(rippleHot.shots[0].endSec).toBe(12.0);
    expect(rippleHot.shots[1].startSec).toBe(12.0);
    expect(rippleHot.shots[1].endSec).toBe(17.0);
    expect(rippleHot.shots[2].startSec).toBe(17.0);
    expect(rippleHot.shots[2].endSec).toBe(22.0);
    expect(rippleHot.durationSec).toBe(22.0);

    // Out-of-bounds or non-finite returns null
    expect(applyShotTimingHotPatch(patchedBase, -1, 'end', 5, 'free')).toBeNull();
    expect(applyShotTimingHotPatch(patchedBase, 0, 'end', NaN, 'free')).toBeNull();
  });
});
