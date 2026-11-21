import { describe, expect, it } from 'vitest';
import { computeStageFrame } from '../../src/core/frameEngine';
import {
  ZERO_OFFSET,
  resolveShotDestOffset,
  resolveShotDestRoll,
  resolveShotStartOffset,
  resolveShotStartRoll,
  resolveTargetPoint3D,
} from '../../src/core/cameraTargetResolver';
import {
  makeCameraCue,
  makeEntityState,
  makePose,
  makeScoreYaml,
  parseValidScore,
} from '../helpers/scoreFixtures';

describe('cameraTargetResolver — Target Anchors, Sub-Anchors, Offsets & Pivots', () => {
  it('resolves target point 3D for characters, props, center presets, and offsets', () => {
    const entities = new Map([
      [
        'actor',
        makeEntityState({
          id: 'actor',
          def: { id: 'actor', label: 'Lead Actor', position: { x: 1, y: 0, z: 2 } },
        }),
      ],
      [
        'box',
        makeEntityState({
          id: 'box',
          def: {
            id: 'box',
            label: 'Wooden Box',
            kind: 'prop',
            position: { x: -3, y: 0, z: 1 },
            height: 1.0,
            radius: 0.5,
            color: '#f59e0b',
          },
        }),
      ],
    ]);

    const fallback = { x: 0, y: 0, z: 0 };

    // Character look-at eye-line height: 1.75 * 0.9 = 1.575m
    const pActor = resolveTargetPoint3D('actor', entities, fallback);
    expect(pActor.x).toBe(1);
    expect(pActor.y).toBeCloseTo(1.575, 3);
    expect(pActor.z).toBe(2);

    // Prop center height: 1.0 * 0.5 = 0.5m
    const pProp = resolveTargetPoint3D('box', entities, fallback);
    expect(pProp.x).toBe(-3);
    expect(pProp.y).toBeCloseTo(0.5, 3);
    expect(pProp.z).toBe(1);

    // Center preset
    expect(resolveTargetPoint3D('center', entities, fallback)).toEqual({ x: 0, y: 1.0, z: 0 });

    // Offset applied
    const pOffset = resolveTargetPoint3D('actor', entities, fallback, { x: 0.5, y: -0.2, z: 1.0 });
    expect(pOffset.x).toBeCloseTo(1.5, 3);
    expect(pOffset.y).toBeCloseTo(1.375, 3);
    expect(pOffset.z).toBeCloseTo(3.0, 3);
  });

  it('resolves Option A roll and target offset resets vs continuations', () => {
    const baseline = makePose();
    const prevPose = { ...baseline, roll: 0.25 };

    // Roll resets to baseline (0 rad) when omitted
    expect(resolveShotStartRoll(makeCameraCue(), prevPose, baseline)).toBe(0);
    expect(resolveShotDestRoll(prevPose, makeCameraCue(), baseline)).toBe(0);

    // Explicit roll preservation / delta
    expect(resolveShotStartRoll(makeCameraCue({ rollStartRad: 0.1 }), prevPose, baseline)).toBe(
      0.1
    );
    expect(
      resolveShotDestRoll(prevPose, makeCameraCue({ rollDeltaRad: 0.2 }), baseline)
    ).toBeCloseTo(0.45, 4);

    // Offset resets to ZERO_OFFSET when omitted
    expect(resolveShotStartOffset(makeCameraCue())).toEqual(ZERO_OFFSET);
    expect(resolveShotDestOffset(makeCameraCue())).toEqual(ZERO_OFFSET);

    // Explicit target offset start / end
    expect(
      resolveShotStartOffset(makeCameraCue({ targetOffsetStart: { x: 1, y: 2, z: 3 } }))
    ).toEqual({ x: 1, y: 2, z: 3 });
    expect(
      resolveShotDestOffset(makeCameraCue({ targetOffsetEnd: { x: 4, y: 5, z: 6 } }))
    ).toEqual({ x: 4, y: 5, z: 6 });
  });

  it('resolves dot-notation entity sub-anchors across rotated, tilted, custom-sized, dotted-ID, and multi-entity targets (#19)', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
entities:
  - id: "actor_a"
    label: "Actor A"
    kind: "character"
    position: [1.0, 0.0, 0.0]
    width: 0.60
    height: 2.00
    rotation: 90
  - id: "dr.smith"
    label: "Dr. Smith"
    kind: "character"
    position: [-2.0, 0.18, 0.0]
    width: 0.52
    height: 1.80
    rotation: 0
    pitch: 90
  - id: "crate"
    label: "Wooden Crate"
    kind: "prop"
    position: [0.0, 0.0, -3.0]
    width: 1.00
    height: 1.20
blocking:
  - id: "crouch-a"
    entity: "actor_a"
    start: 6.0
    end: 10.0
    height: 1.00
    easing: "linear"
shots:
  - id: "s1-ots-left"
    shot: 1
    start: 0.0
    end: 2.0
    stage_camera:
      target: "actor_a.shoulder_l"
      focus: "actor_a.eyes"
      dof: "shallow"
      distance: 4.0
      pitch: 0
      yaw: 0
      lens: 50mm
  - id: "s2-prone-feet"
    shot: 2
    start: 2.0
    end: 4.0
    stage_camera:
      target: "dr.smith.chest"
      focus: "dr.smith.feet"
      dof: "shallow"
      distance: 4.0
      pitch: 0
      yaw: 0
  - id: "s3-centroid-and-exact-dot"
    shot: 3
    start: 4.0
    end: 6.0
    stage_camera:
      target: ["dr.smith", "crate.top"]
      distance: 5.0
      pitch: 10
      yaw: 0
  - id: "s4-crouch-and-typo-fallback"
    shot: 4
    start: 6.0
    end: 10.0
    stage_camera:
      from: "actor_a.chest"
      target: "actor_a.unknown_part"
      distance: 4.0
      pitch: 0
      yaw: 0
`,
        { id: 'sub-anchor-suite', duration: 10.0 }
      )
    );

    const f0 = computeStageFrame(0.0, score);
    expect(f0.stageCamera.transform.target.x).toBeCloseTo(1.0, 4);
    expect(f0.stageCamera.transform.target.y).toBeCloseTo(1.54, 4);
    expect(f0.stageCamera.transform.target.z).toBeCloseTo(-0.24, 4);
    expect(f0.stageCamera.dof.focusTargetPoint?.x).toBeCloseTo(1.0, 4);
    expect(f0.stageCamera.dof.focusTargetPoint?.y).toBeCloseTo(1.8, 4);
    expect(f0.stageCamera.dof.focusTargetPoint?.z).toBeCloseTo(0.0, 4);

    const f2 = computeStageFrame(2.0, score);
    expect(f2.stageCamera.transform.target.x).toBeCloseTo(-2.0, 4);
    expect(f2.stageCamera.transform.target.y).toBeCloseTo(0.18, 4);
    expect(f2.stageCamera.transform.target.z).toBeCloseTo(1.35, 4);
    expect(f2.stageCamera.dof.focusTargetPoint?.z).toBeCloseTo(0.09, 4);

    const f4 = computeStageFrame(4.0, score);
    expect(f4.stageCamera.transform.target.x).toBeCloseTo(-1.0, 4);
    expect(f4.stageCamera.transform.target.y).toBeCloseTo(0.69, 4);
    expect(f4.stageCamera.transform.target.z).toBeCloseTo(-0.69, 4);

    const f6 = computeStageFrame(6.0, score);
    expect(f6.stageCamera.transform.target.y).toBeCloseTo(1.5, 4);
    const f10 = computeStageFrame(10.0, score);
    expect(f10.stageCamera.transform.target.y).toBeCloseTo(0.9, 4);
  });

  it('resolves target_offset + sub-anchor, label-based sub-anchors, observer_shots, and spline waypoint sub-anchors (#19)', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
entities:
  - id: "doc"
    label: "  Dr. Smith  "
    kind: "character"
    position: [1.0, 0.0, 0.0]
    width: 0.60
    height: 2.00
    rotation: 0
  - id: "crate"
    label: "Crate"
    kind: "prop"
    position: [-1.0, 0.0, -2.0]
    width: 1.00
    height: 1.20
observer_shots:
  - id: "obs-1"
    start: 0
    end: 8
    camera:
      target: "Dr. Smith.shoulder_l"
      distance: 6.0
      pitch: 20
      yaw: 0
shots:
  - id: "s1-label-offset"
    start: 0
    end: 4
    stage_camera:
      target: "Dr. Smith.chest"
      target_offset: [0.25, 0.15, -0.5]
      distance: 4.0
      pitch: 0
      yaw: 0
  - id: "s2-spline-sub-anchors"
    start: 4
    end: 8
    stage_camera:
      maneuver: "spline"
      easing: "linear"
      waypoints:
        - target: "Dr. Smith.chest"
          distance: 4.0
          pitch: 0
          yaw: 0
        - target: "crate.top"
          distance: 4.0
          pitch: 0
          yaw: 0
`,
        { id: 'sub-anchor-advanced', duration: 8.0 }
      )
    );

    const f2 = computeStageFrame(2.0, score);
    expect(f2.stageCamera.transform.target.x).toBeCloseTo(1.25, 4);
    expect(f2.stageCamera.transform.target.y).toBeCloseTo(1.65, 4);
    expect(f2.stageCamera.transform.target.z).toBeCloseTo(-0.5, 4);

    expect(f2.observerCamera.transform.target.x).toBeCloseTo(1.24, 4);
    expect(f2.observerCamera.transform.target.y).toBeCloseTo(1.54, 4);
    expect(f2.observerCamera.transform.target.z).toBeCloseTo(0.0, 4);

    const f4 = computeStageFrame(4.0, score);
    expect(f4.stageCamera.transform.target.x).toBeCloseTo(1.0, 4);
    expect(f4.stageCamera.transform.target.y).toBeCloseTo(1.5, 4);
    expect(f4.stageCamera.transform.target.z).toBeCloseTo(0.0, 4);

    const f8 = computeStageFrame(8.0, score);
    expect(f8.stageCamera.transform.target.x).toBeCloseTo(-1.0, 4);
    expect(f8.stageCamera.transform.target.y).toBeCloseTo(1.2, 4);
    expect(f8.stageCamera.transform.target.z).toBeCloseTo(-2.0, 4);
  });

  it('tracks center-pivoted banking/pitching entities with live height scaling and thin-lens focus (#20)', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
entities:
  - id: "drone"
    kind: "prop"
    shape: "box"
    position: [0.0, 2.0, 0.0]
    size: [1.0, 1.0, 1.0]
    pivot: "center"
    pitch: 90
    roll: 45
  - id: "flyer"
    kind: "character"
    position: [2.0, 0.0, 0.0]
    size: [0.5, 2.0, 0.5]
blocking:
  - id: "drone-grow"
    entity: "drone"
    start: 0.0
    end: 4.0
    size: [1.0, 3.0, 1.0]
    easing: "linear"
  - id: "flyer-flight"
    entity: "flyer"
    start: 0.0
    end: 4.0
    position: [2.0, 4.0, 0.0]
    pitch: 90
    pivot: "center"
    easing: "linear"
shots:
  - id: "s1"
    start: 0.0
    end: 2.0
    stage_camera:
      target: "drone"
      focus: "drone"
      dof: "shallow"
      distance: 4.0
      pitch: 0
      yaw: 0
  - id: "s2"
    start: 2.0
    end: 4.0
    stage_camera:
      target: "flyer"
      focus: "flyer.feet"
      dof: "shallow"
      distance: 5.0
      pitch: 0
      yaw: 90
`,
        { id: 'pivot-frame-test', duration: 4.0 }
      )
    );

    const f1 = computeStageFrame(1.0, score);
    expect(f1.stageCamera.transform.target.x).toBeCloseTo(0.0, 4);
    expect(f1.stageCamera.transform.target.y).toBeCloseTo(2.75, 4);
    expect(f1.stageCamera.transform.target.z).toBeCloseTo(0.0, 4);
    expect(f1.stageCamera.dof.focusTargetPoint?.y).toBeCloseTo(2.75, 4);

    const f4 = computeStageFrame(4.0, score);
    expect(f4.stageCamera.transform.target.x).toBeCloseTo(2.0, 4);
    expect(f4.stageCamera.transform.target.y).toBeCloseTo(5.0, 4);
    expect(f4.stageCamera.transform.target.z).toBeCloseTo(0.8, 4);
    expect(f4.stageCamera.dof.focusTargetPoint?.x).toBeCloseTo(2.0, 4);
    expect(f4.stageCamera.dof.focusTargetPoint?.y).toBeCloseTo(5.0, 4);
    expect(f4.stageCamera.dof.focusTargetPoint?.z).toBeCloseTo(-0.9, 4);
  });
});
