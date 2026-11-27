import { describe, it, expect } from 'vitest';
import { computeStageFrame } from '../../src/core/frameEngine';
import { applyScoreHotPatch } from '../../src/core/scoreHotPatch';
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
});
