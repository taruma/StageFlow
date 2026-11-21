/**
 * Deterministic unit test suite for physical camera rigs (Tripod, Linear Track, and Spline Track).
 * Verifies mathematical invariance, spatial position pinning, smart continuous chaining,
 * inverse look-at tracking, fixed-gaze lateral trucking, and 100% backward compatibility.
 */

import { describe, expect, it } from 'vitest';
import { parseStageScore } from '../../src/core/scoreParser';
import { computeStageFrame } from '../../src/core/frameEngine';
import { radToDeg } from '../../src/core/sphericalMath';

describe('cameraRigs — Kinematic Invariants & DSL Contracts', () => {
  it('preserves bit-for-bit stationary eye position on a tripod rig while dynamically tracking a moving target', () => {
    const rawYaml = `
version: "1.0"
id: "tripod-test"
title: "Tripod Invariance Test"
duration: 10.0
stage:
  width: 10
  depth: 10
entities:
  - id: "hero"
    label: "Hero"
    kind: "character"
    position: [-3.0, 0, 0]
blocking:
  - id: "hero-walk"
    entity: "hero"
    start: 0.0
    end: 10.0
    position: [3.0, 0, 0]
    easing: "linear"
shots:
  - id: "s1"
    shot: 1
    start: 0.0
    end: 10.0
    stage_camera:
      rig:
        type: "tripod"
        position: [0.0, 1.6, 5.0]
      target: "hero"
      lens: 50mm
`;
    const { score, error } = parseStageScore(rawYaml);
    expect(error).toBeNull();
    expect(score).toBeDefined();

    // Sample across 11 temporal steps from t=0s to t=10s
    for (let i = 0; i <= 10; i++) {
      const t = i * 1.0;
      const frame = computeStageFrame(t, score!);
      const stageCam = frame.stageCamera;

      // 1. The camera eye position MUST remain 100% locked at the authored tripod coordinate
      expect(stageCam.transform.position.x).toBeCloseTo(0.0, 4);
      expect(stageCam.transform.position.y).toBeCloseTo(1.6, 4);
      expect(stageCam.transform.position.z).toBeCloseTo(5.0, 4);

      // 2. Rig metadata must be attached
      expect(stageCam.rig).toBeDefined();
      expect(stageCam.rig?.type).toBe('tripod');
      expect(stageCam.rig?.hasTargetLock).toBe(true);
      expect(stageCam.rig?.railPoints).toHaveLength(0); // Tripods have no floor rails

      // 3. Aim yaw must dynamically track hero from left (-X) to right (+X)
      const yawDeg = radToDeg(stageCam.transform.pose.yaw);
      if (t === 0.0) {
        expect(yawDeg).toBeGreaterThan(0); // Camera is on +X side of hero (hero at X = -3)
      } else if (t === 5.0) {
        expect(yawDeg).toBeCloseTo(0, 1); // Hero is at X = 0
      } else if (t === 10.0) {
        expect(yawDeg).toBeLessThan(0); // Camera is on -X side of hero (hero at X = +3)
      }
    }
  });

  it('interpolates exact linear eye position on a linear track rig (trucking shot)', () => {
    const rawYaml = `
version: "1.0"
id: "track-test"
title: "Linear Track Test"
duration: 10.0
stage:
  width: 10
  depth: 10
shots:
  - id: "s1"
    shot: 1
    start: 0.0
    end: 10.0
    stage_camera:
      rig:
        type: "track"
        from: [-4.0, 1.2, 6.0]
        to: [4.0, 1.2, 6.0]
      easing: "linear"
      yaw: 0deg
      pitch: 0deg
      lens: 35mm
`;
    const { score } = parseStageScore(rawYaml);
    expect(score).toBeDefined();

    // Check at t = 0 (u = 0)
    const f0 = computeStageFrame(0.0, score!);
    expect(f0.stageCamera.transform.position.x).toBeCloseTo(-4.0, 4);
    expect(f0.stageCamera.transform.position.y).toBeCloseTo(1.2, 4);
    expect(f0.stageCamera.transform.position.z).toBeCloseTo(6.0, 4);
    expect(f0.stageCamera.rig?.progress).toBeCloseTo(0.0, 4);
    expect(f0.stageCamera.rig?.railPoints).toHaveLength(2);

    // Check at t = 5 (u = 0.5)
    const fMid = computeStageFrame(5.0, score!);
    expect(fMid.stageCamera.transform.position.x).toBeCloseTo(0.0, 4);
    expect(fMid.stageCamera.transform.position.y).toBeCloseTo(1.2, 4);
    expect(fMid.stageCamera.transform.position.z).toBeCloseTo(6.0, 4);
    expect(fMid.stageCamera.rig?.progress).toBeCloseTo(0.5, 4);

    // Check at t = 10 (u = 1.0)
    const fEnd = computeStageFrame(10.0, score!);
    expect(fEnd.stageCamera.transform.position.x).toBeCloseTo(4.0, 4);
    expect(fEnd.stageCamera.transform.position.y).toBeCloseTo(1.2, 4);
    expect(fEnd.stageCamera.transform.position.z).toBeCloseTo(6.0, 4);
    expect(fEnd.stageCamera.rig?.progress).toBeCloseTo(1.0, 4);
  });

  it('supports fixed-gaze lateral trucking with locked yaw and pitch (no target)', () => {
    const rawYaml = `
version: "1.0"
id: "fixed-gaze-test"
title: "Fixed Gaze Test"
duration: 6.0
stage:
  width: 10
  depth: 10
shots:
  - id: "s1"
    shot: 1
    start: 0.0
    end: 6.0
    stage_camera:
      rig:
        type: "track"
        from: [-3.0, 1.4, 4.0]
        to: [3.0, 1.4, 4.0]
      yaw: 45deg
      pitch: 10deg
      lens: 40mm
`;
    const { score } = parseStageScore(rawYaml);
    expect(score).toBeDefined();

    for (let t = 0; t <= 6; t += 1.5) {
      const f = computeStageFrame(t, score!);
      // Yaw and pitch must remain fixed
      expect(radToDeg(f.stageCamera.transform.pose.yaw)).toBeCloseTo(45.0, 2);
      expect(radToDeg(f.stageCamera.transform.pose.pitch)).toBeCloseTo(10.0, 2);
      expect(f.stageCamera.rig?.hasTargetLock).toBe(false);
    }
  });

  it('smoothly chains continuous track shots when from: is omitted (smart continuous chaining)', () => {
    const rawYaml = `
version: "1.0"
id: "continuous-chaining-test"
title: "Continuous Chaining Test"
duration: 10.0
stage:
  width: 10
  depth: 10
shots:
  - id: "shot-1"
    shot: 1
    start: 0.0
    end: 5.0
    stage_camera:
      rig:
        type: "track"
        from: [-4.0, 1.3, 5.0]
        to: [0.0, 1.3, 5.0]
      yaw: 0deg
  - id: "shot-2"
    shot: 2
    start: 5.0
    end: 10.0
    continuous: true
    stage_camera:
      rig:
        type: "track"
        to: [4.0, 1.3, 5.0] # 'from:' omitted, should start from [0.0, 1.3, 5.0]
      yaw: 0deg
`;
    const { score } = parseStageScore(rawYaml);
    expect(score).toBeDefined();

    // End of shot 1
    const fShot1End = computeStageFrame(4.99, score!);
    expect(fShot1End.stageCamera.transform.position.x).toBeCloseTo(0.0, 1);

    // Start of shot 2 (must not jump back to -4.0)
    const fShot2Start = computeStageFrame(5.01, score!);
    expect(fShot2Start.stageCamera.transform.position.x).toBeCloseTo(0.0, 1);

    // End of shot 2
    const fShot2End = computeStageFrame(10.0, score!);
    expect(fShot2End.stageCamera.transform.position.x).toBeCloseTo(4.0, 1);
  });

  it('evaluates curved spline tracks through multi-point waypoints', () => {
    const rawYaml = `
version: "1.0"
id: "spline-track-test"
title: "Spline Track Test"
duration: 8.0
stage:
  width: 10
  depth: 10
shots:
  - id: "s1"
    shot: 1
    start: 0.0
    end: 8.0
    stage_camera:
      rig:
        type: "spline_track"
        points:
          - [-3.0, 1.2, 5.0]
          - [-1.0, 1.5, 3.5]
          - [1.0, 1.5, 3.5]
          - [3.0, 1.2, 5.0]
      yaw: 0deg
`;
    const { score } = parseStageScore(rawYaml);
    expect(score).toBeDefined();

    const f0 = computeStageFrame(0.0, score!);
    expect(f0.stageCamera.transform.position.x).toBeCloseTo(-3.0, 2);
    expect(f0.stageCamera.transform.position.z).toBeCloseTo(5.0, 2);
    expect(f0.stageCamera.rig?.railPoints.length).toBeGreaterThanOrEqual(16);

    const fMid = computeStageFrame(4.0, score!);
    expect(fMid.stageCamera.transform.position.x).toBeCloseTo(0.0, 1);
    expect(fMid.stageCamera.transform.position.z).toBeLessThan(5.0); // Bends forward toward Z=3.5

    const fEnd = computeStageFrame(8.0, score!);
    expect(fEnd.stageCamera.transform.position.x).toBeCloseTo(3.0, 2);
    expect(fEnd.stageCamera.transform.position.z).toBeCloseTo(5.0, 2);
  });

  it('respects show_rig: false per shot and stage.show_rigs: false score-wide', () => {
    const rawYaml = `
version: "1.0"
id: "visibility-test"
title: "Visibility Test"
duration: 12.0
stage:
  width: 10
  depth: 10
  show_rigs: true
shots:
  - id: "s1-visible"
    shot: 1
    start: 0.0
    end: 4.0
    stage_camera:
      rig: { type: "tripod", position: [0, 1.5, 5] }
  - id: "s2-hidden"
    shot: 2
    start: 4.0
    end: 8.0
    stage_camera:
      rig: { type: "tripod", position: [0, 1.5, 5] }
      show_rig: false
  - id: "s3-legacy"
    shot: 3
    start: 8.0
    end: 12.0
    stage_camera:
      target: [0, 1, 0]
      distance: 4.0
`;
    const { score } = parseStageScore(rawYaml);
    expect(score).toBeDefined();

    const f1 = computeStageFrame(2.0, score!);
    expect(f1.stageCamera.showRig).toBe(true);

    const f2 = computeStageFrame(6.0, score!);
    expect(f2.stageCamera.showRig).toBe(false);

    const f3 = computeStageFrame(10.0, score!);
    expect(f3.stageCamera.showRig).toBe(false);
    expect(f3.stageCamera.rig).toBeUndefined(); // Legacy shot has no rig attached
  });

  it('inherits prevEndPose eye E_prev on continuous rigs (track, 1-pt spline_track, tripod) even when target switches', () => {
    const rawYaml = `
version: "1.0"
id: "continuous-rig-target-switch"
title: "Continuous Rig Target Switch"
duration: 12.0
entities:
  - id: "hero"
    kind: "character"
    position: [-3.0, 0, 0]
  - id: "villain"
    kind: "character"
    position: [3.0, 0, -2.0]
shots:
  - id: "s1-tripod"
    shot: 1
    start: 0.0
    end: 3.0
    stage_camera:
      rig:
        type: "tripod"
        position: [-1.5, 1.6, 4.5]
      target: "hero"
    observer_camera:
      rig:
        type: "tripod"
        position: [0.0, 4.0, 8.0]
      target: "hero"
  - id: "s2-track-switch"
    shot: 2
    start: 3.0
    end: 6.0
    continuous: true
    stage_camera:
      rig:
        type: "track"
        to: [2.5, 1.6, 4.5]
      target: "villain"
      easing: "linear"
    observer_camera:
      rig:
        type: "track"
        to: [4.0, 4.0, 8.0]
      target: "villain"
      easing: "linear"
  - id: "s3-spline-1pt-switch"
    shot: 3
    start: 6.0
    end: 9.0
    continuous: true
    stage_camera:
      rig:
        type: "spline_track"
        points:
          - [0.5, 2.0, 3.5]
      target: "hero"
      easing: "linear"
  - id: "s4-tripod-no-pos-switch"
    shot: 4
    start: 9.0
    end: 12.0
    continuous: true
    stage_camera:
      rig:
        type: "tripod"
      target: "villain"
`;
    const { score, error } = parseStageScore(rawYaml);
    expect(error).toBeNull();
    expect(score).toBeDefined();

    // Shot 2 start (t = 3.0): must inherit E_prev [-1.5, 1.6, 4.5] for stage and [0, 4, 8] for observer
    const f2Start = computeStageFrame(3.0, score!);
    expect(f2Start.stageCamera.transform.position.x).toBeCloseTo(-1.5, 4);
    expect(f2Start.stageCamera.transform.position.y).toBeCloseTo(1.6, 4);
    expect(f2Start.stageCamera.transform.position.z).toBeCloseTo(4.5, 4);
    expect(f2Start.stageCamera.rig?.eyePosition.x).toBeCloseTo(-1.5, 4);
    expect(f2Start.stageCamera.rig?.railPoints[0].x).toBeCloseTo(-1.5, 4);
    expect(f2Start.stageCamera.rig?.railPoints[1].x).toBeCloseTo(2.5, 4);
    expect(f2Start.stageCamera.trajectoryPoints[0].x).toBeCloseTo(-1.5, 4);
    expect(f2Start.stageCamera.trajectoryPoints[0].z).toBeCloseTo(4.5, 4);
    // Look-at target switched to villain (x = 3.0, z = -2.0)
    expect(f2Start.stageCamera.transform.target.x).toBeCloseTo(3.0, 4);
    expect(f2Start.stageCamera.transform.target.z).toBeCloseTo(-2.0, 4);

    // Observer camera track also inherited E_prev [0.0, 4.0, 8.0] even though target switched to villain
    expect(f2Start.observerCamera.transform.position.x).toBeCloseTo(0.0, 4);
    expect(f2Start.observerCamera.transform.position.y).toBeCloseTo(4.0, 4);
    expect(f2Start.observerCamera.transform.position.z).toBeCloseTo(8.0, 4);
    expect(f2Start.observerCamera.rig?.railPoints[0].x).toBeCloseTo(0.0, 4);
    expect(f2Start.observerCamera.trajectoryPoints[0].x).toBeCloseTo(0.0, 4);
    expect(f2Start.observerCamera.transform.target.x).toBeCloseTo(3.0, 4);

    // Shot 2 midpoint (t = 4.5): linear halfway between -1.5 and 2.5 => x = 0.5
    const f2Mid = computeStageFrame(4.5, score!);
    expect(f2Mid.stageCamera.transform.position.x).toBeCloseTo(0.5, 4);
    expect(f2Mid.observerCamera.transform.position.x).toBeCloseTo(2.0, 4);

    // Shot 3 start (t = 6.0): 1-pt spline_track inherits [2.5, 1.6, 4.5] while switching target to hero
    const f3Start = computeStageFrame(6.0, score!);
    expect(f3Start.stageCamera.transform.position.x).toBeCloseTo(2.5, 4);
    expect(f3Start.stageCamera.transform.position.y).toBeCloseTo(1.6, 4);
    expect(f3Start.stageCamera.transform.position.z).toBeCloseTo(4.5, 4);
    expect(f3Start.stageCamera.rig?.railPoints[0].x).toBeCloseTo(2.5, 4);
    expect(f3Start.stageCamera.trajectoryPoints[0].x).toBeCloseTo(2.5, 4);
    expect(f3Start.stageCamera.transform.target.x).toBeCloseTo(-3.0, 4);

    // Shot 4 (t = 10.5): tripod without position stays pinned at Shot 3 end [0.5, 2.0, 3.5] while looking at villain
    const f4Mid = computeStageFrame(10.5, score!);
    expect(f4Mid.stageCamera.transform.position.x).toBeCloseTo(0.5, 4);
    expect(f4Mid.stageCamera.transform.position.y).toBeCloseTo(2.0, 4);
    expect(f4Mid.stageCamera.transform.position.z).toBeCloseTo(3.5, 4);
    expect(f4Mid.stageCamera.transform.target.x).toBeCloseTo(3.0, 4);
  });
});
