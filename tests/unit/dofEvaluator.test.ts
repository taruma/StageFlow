import { describe, expect, it } from 'vitest';
import { computeStageFrame } from '../../src/core/frameEngine';
import { makeScoreYaml, parseValidScore } from '../helpers/scoreFixtures';

describe('dofEvaluator — Focus Distance, Rack Focus & Thin-Lens DoF Limits', () => {
  it('evaluates static focus, dynamic rack focus between moving actors, and thin-lens DoF limits cleanly', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
entities:
  - id: "alice"
    kind: "character"
    position: [-1.5, 0, 2.0]
  - id: "bob"
    kind: "character"
    position: [1.5, 0, -2.0]
shots:
  - id: "shot-1-default"
    shot: 1
    start: 0.0
    end: 4.0
    stage_camera:
      target: [0, 1.575, 0]
      distance: 5.0
      pitch: 0
      yaw: 0
      lens: 50mm
  - id: "shot-2-rack"
    shot: 2
    start: 4.0
    end: 8.0
    stage_camera:
      target: [0, 1.575, 0]
      distance: 5.0
      pitch: 0
      yaw: 0
      lens: 50mm
      easing: "linear"
      focus_start: "alice"
      focus_end: "bob"
      dof: "shallow"
  - id: "shot-3-spline-focus"
    shot: 3
    start: 8.0
    end: 12.0
    stage_camera:
      maneuver: "spline"
      easing: "linear"
      lens: 50mm
      dof: "medium"
      waypoints:
        - target: [0, 1.575, 0]
          distance: 5.0
          pitch: 0
          yaw: 0
          focus: 2.0
        - target: [0, 1.575, 0]
          distance: 5.0
          pitch: 0
          yaw: 0
          focus: 6.0
`,
        { id: 'rack-focus-engine-test', duration: 12.0 }
      )
    );

    const f1 = computeStageFrame(2.0, score);
    expect(f1.stageCamera.dof.enabled).toBe(false);
    expect(f1.stageCamera.dof.hasExplicitFocus).toBe(false);
    expect(f1.stageCamera.dof.focusDistanceM).toBeCloseTo(5.0, 4);

    const fRackStart = computeStageFrame(4.0, score);
    expect(fRackStart.stageCamera.dof.enabled).toBe(true);
    expect(fRackStart.stageCamera.dof.preset).toBe('shallow');
    expect(fRackStart.stageCamera.dof.apertureFStop).toBeCloseTo(2.8, 4);
    expect(fRackStart.stageCamera.dof.focusDistanceM).toBeCloseTo(3.0, 3);
    expect(fRackStart.stageCamera.dof.focusTargetPoint!.x).toBeCloseTo(-1.5, 3);
    expect(fRackStart.stageCamera.dof.focusTargetPoint!.z).toBeCloseTo(2.0, 3);
    expect(fRackStart.stageCamera.dof.nearLimitM).toBeCloseTo(2.73, 2);
    expect(fRackStart.stageCamera.dof.farLimitM).toBeCloseTo(3.33, 2);

    const fRackMid = computeStageFrame(6.0, score);
    expect(fRackMid.stageCamera.dof.focusDistanceM).toBeCloseTo(5.0, 3);
    expect(fRackMid.stageCamera.dof.focusTargetPoint!.x).toBeCloseTo(0.0, 3);
    expect(fRackMid.stageCamera.dof.focusTargetPoint!.z).toBeCloseTo(0.0, 3);

    const fRackEnd = computeStageFrame(7.999, score);
    expect(fRackEnd.stageCamera.dof.focusDistanceM).toBeCloseTo(7.0, 2);
    expect(fRackEnd.stageCamera.dof.focusTargetPoint!.x).toBeCloseTo(1.5, 2);
    expect(fRackEnd.stageCamera.dof.focusTargetPoint!.z).toBeCloseTo(-2.0, 2);

    const fSplineMid = computeStageFrame(10.0, score);
    expect(fSplineMid.stageCamera.dof.enabled).toBe(true);
    expect(fSplineMid.stageCamera.dof.preset).toBe('medium');
    expect(fSplineMid.stageCamera.dof.apertureFStop).toBeCloseTo(5.6, 4);
    expect(fSplineMid.stageCamera.dof.focusDistanceM).toBeCloseTo(4.0, 3);
  });

  it('dynamically tracks look-at target elevation and DoF focus plane as actor crouches in blocking', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
entities:
  - id: "actor"
    label: "Actor"
    kind: "character"
    position: [0, 0, 0]
    height: 1.80
shots:
  - id: "s1"
    shot: 1
    start: 0
    end: 6
    stage_camera:
      target: "actor"
      focus: "actor"
      dof: "shallow"
      distance: 5.0
      pitch: 0
      yaw: 0
      lens: 50mm
blocking:
  - id: "cue-crouch"
    entity: "actor"
    start: 0
    end: 6
    height: 1.00
    easing: "linear"
`,
        { id: 'crouch-dof-tracking', duration: 6.0 }
      )
    );

    const frame0 = computeStageFrame(0.0, score);
    expect(frame0.stageCamera.transform.target.y).toBeCloseTo(1.62, 3);
    expect(frame0.stageCamera.transform.position.y).toBeCloseTo(1.62, 3);
    expect(frame0.stageCamera.dof.focusTargetPoint?.y).toBeCloseTo(1.62, 3);
    expect(frame0.stageCamera.dof.focusDistanceM).toBeCloseTo(5.0, 3);

    const frameMid = computeStageFrame(3.0, score);
    expect(frameMid.stageCamera.transform.target.y).toBeCloseTo(1.26, 3);
    expect(frameMid.stageCamera.transform.position.y).toBeCloseTo(1.26, 3);
    expect(frameMid.stageCamera.dof.focusTargetPoint?.y).toBeCloseTo(1.26, 3);
    expect(frameMid.stageCamera.dof.focusDistanceM).toBeCloseTo(5.0, 3);

    const frameEnd = computeStageFrame(6.0, score);
    expect(frameEnd.stageCamera.transform.target.y).toBeCloseTo(0.9, 3);
    expect(frameEnd.stageCamera.transform.position.y).toBeCloseTo(0.9, 3);
    expect(frameEnd.stageCamera.dof.focusTargetPoint?.y).toBeCloseTo(0.9, 3);
    expect(frameEnd.stageCamera.dof.focusDistanceM).toBeCloseTo(5.0, 3);
  });

  it('tracks a tilted entity rotated getEntityLookAnchor in stageCamera.transform.target and dof.focusDistanceM', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
entities:
  - id: "actor"
    label: "Actor"
    kind: "character"
    position: [0, 0.18, 0]
    rotation: 0
    pitch: 90
    height: 1.80
blocking:
  - id: "wake-up"
    entity: "actor"
    start: 0
    end: 4
    position: [0, 0, 0]
    pitch: 0
    easing: "linear"
  - id: "fall-prone"
    entity: "actor"
    start: 4
    end: 8
    position: [0, 0.18, 0]
    pitch: 90
    easing: "linear"
shots:
  - id: "s1-target-actor"
    shot: 1
    start: 0
    end: 4
    stage_camera:
      target: "actor"
      focus: "actor"
      dof: "shallow"
      distance: 5.0
      pitch: 0
      yaw: 0
      lens: 50mm
  - id: "s2-focus-actor"
    shot: 2
    start: 4
    end: 8
    stage_camera:
      target: [0, 1.0, 0]
      focus: "actor"
      dof: "shallow"
      distance: 5.0
      pitch: 0
      yaw: 0
      lens: 50mm
`,
        { id: 'tilt-anchor-dof-tracking', duration: 8.0 }
      )
    );

    const f0 = computeStageFrame(0.0, score);
    expect(f0.stageCamera.transform.target.x).toBeCloseTo(0, 4);
    expect(f0.stageCamera.transform.target.y).toBeCloseTo(0.18, 4);
    expect(f0.stageCamera.transform.target.z).toBeCloseTo(1.62, 4);
    expect(f0.stageCamera.dof.focusTargetPoint?.z).toBeCloseTo(1.62, 4);

    const f4 = computeStageFrame(4.0, score);
    expect(f4.stageCamera.dof.focusTargetPoint?.y).toBeCloseTo(1.62, 4);
    expect(f4.stageCamera.dof.focusTargetPoint?.z).toBeCloseTo(0, 4);
    expect(f4.stageCamera.dof.focusDistanceM).toBeCloseTo(5.0, 3);

    const f8 = computeStageFrame(8.0, score);
    expect(f8.stageCamera.dof.focusTargetPoint?.y).toBeCloseTo(0.18, 4);
    expect(f8.stageCamera.dof.focusTargetPoint?.z).toBeCloseTo(1.62, 4);
    expect(f8.stageCamera.dof.focusDistanceM).toBeCloseTo(3.38, 3);
  });
});
