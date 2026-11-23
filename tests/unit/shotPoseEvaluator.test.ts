import { describe, expect, it } from 'vitest';
import { computeStageFrame } from '../../src/core/frameEngine';
import {
  evaluateShotCameraPose,
  evaluateSplineCameraPose,
  sampleTrajectoryPoints,
} from '../../src/core/shotPoseEvaluator';
import {
  makeCameraCue,
  makePose,
  makeScoreYaml,
  parseValidScore,
} from '../helpers/scoreFixtures';

describe('shotPoseEvaluator — Spline Trajectories & Directed Orbit Maneuvers', () => {
  it('evaluates spline camera poses and samples 3D trajectory curves', () => {
    const startPose = makePose({ distance: 4, pitch: 0.1, yaw: 0.2, focalLengthMm: 35 });
    const spec = makeCameraCue({
      maneuver: 'spline',
      easing: 'smooth',
      waypoints: [
        { target: { x: 1, y: 1, z: 0 }, distance: 4.5, yawRad: 0.5 },
        { target: { x: 2, y: 1, z: 1 }, distance: 5.0, yawRad: 0.8 },
      ],
    });

    const pMid = evaluateSplineCameraPose(startPose, spec, 0.5, new Map());
    expect(pMid.distance).toBeGreaterThan(4);
    expect(pMid.target.x).toBeGreaterThan(0);

    const pStart = evaluateShotCameraPose(startPose, spec, 0, 5, new Map(), startPose);
    const pEnd = evaluateShotCameraPose(startPose, spec, 1, 5, new Map(), startPose);
    expect(pStart.target.x).toBeCloseTo(0, 2);
    expect(pEnd.target.x).toBeCloseTo(2, 2);

    // sampleTrajectoryPoints: cut returns [], moving returns 33 points (32 segments)
    expect(
      sampleTrajectoryPoints(
        startPose,
        makeCameraCue({ maneuver: 'cut', easing: 'linear' }),
        5,
        new Map(),
        1.777
      )
    ).toHaveLength(0);

    const points = sampleTrajectoryPoints(startPose, spec, 5, new Map(), 1.777);
    expect(points).toHaveLength(33);
    for (const pt of points) {
      expect(Number.isFinite(pt.x)).toBe(true);
      expect(Number.isFinite(pt.y)).toBe(true);
      expect(Number.isFinite(pt.z)).toBe(true);
    }
  });

  it('orbits strictly counter-clockwise when direction: ccw is specified', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
shots:
  - id: "orbit-ccw"
    start: 0.0
    end: 10.0
    stage_camera:
      target: [0, 1.0, 0]
      maneuver: "orbit"
      direction: "ccw"
      easing: "linear"
      yaw_start: 180
      yaw: 225
`,
        { id: 'ccw-orbit-test' }
      )
    );

    expect(computeStageFrame(0.0, score).stageCamera.transform.pose.yaw).toBeCloseTo(
      180 * (Math.PI / 180),
      3
    );
    expect(computeStageFrame(5.0, score).stageCamera.transform.pose.yaw).toBeCloseTo(
      202.5 * (Math.PI / 180),
      3
    );
    expect(computeStageFrame(10.0, score).stageCamera.transform.pose.yaw).toBeCloseTo(
      225 * (Math.PI / 180),
      3
    );
  });

  it('orbits strictly clockwise when direction: cw is specified', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
shots:
  - id: "orbit-cw"
    start: 0.0
    end: 10.0
    stage_camera:
      target: [0, 1.0, 0]
      maneuver: "orbit"
      direction: "cw"
      easing: "linear"
      yaw_start: 175
      yaw: 0
`,
        { id: 'cw-orbit-test' }
      )
    );

    expect(computeStageFrame(5.0, score).stageCamera.transform.pose.yaw).toBeCloseTo(
      87.5 * (Math.PI / 180),
      3
    );
    expect(computeStageFrame(10.0, score).stageCamera.transform.pose.yaw).toBeCloseTo(0, 3);
  });

  it('orbits strictly counter-clockwise when both yaw_start and yaw_end are specified with direction: ccw', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
shots:
  - id: "orbit-ccw-span"
    start: 0.0
    end: 12.0
    stage_camera:
      target: [0, 1.25, 0]
      maneuver: "orbit"
      direction: "ccw"
      easing: "linear"
      yaw_start: 175
      yaw_end: 0
`,
        { id: 'ccw-span-test' }
      )
    );

    expect(computeStageFrame(0.0, score).stageCamera.transform.pose.yaw).toBeCloseTo(
      175 * (Math.PI / 180),
      3
    );
    expect(computeStageFrame(6.0, score).stageCamera.transform.pose.yaw).toBeCloseTo(
      267.5 * (Math.PI / 180),
      3
    );
    expect(computeStageFrame(12.0, score).stageCamera.transform.pose.yaw).toBeCloseTo(
      360 * (Math.PI / 180),
      3
    );
  });

  it('evaluates The Expansion oner score with continuous chaining and CCW orbit maneuver', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
shots:
  - id: "shot-1"
    end: 6.0
    stage_camera:
      target: [0, 1.0, 0]
      distance: 1.8
      pitch: 0
      yaw: 180
      lens: 50
      maneuver: "static"
  - id: "shot-2"
    end: 15.0
    stage_camera:
      target: [0, 1.0, 0]
      distance: 1.5
      pitch: -15
      yaw: 225
      direction: "ccw"
      easing: "linear"
      lens: 35
      maneuver: "orbit"
`,
        { id: 'the-expansion-oner', title: 'The Expansion', continuous: true }
      )
    );

    const f6 = computeStageFrame(6.0, score);
    expect(f6.stageCamera.shotId).toBe('shot-2');
    expect(f6.stageCamera.transform.pose.distance).toBeCloseTo(1.8, 3);
    expect(f6.stageCamera.transform.pose.pitch).toBeCloseTo(0, 3);
    expect(f6.stageCamera.transform.pose.yaw).toBeCloseTo(180 * (Math.PI / 180), 3);
    expect(f6.stageCamera.transform.pose.focalLengthMm).toBe(35);

    const fMid = computeStageFrame(10.5, score);
    expect(fMid.stageCamera.transform.pose.distance).toBeCloseTo(1.65, 3);
    expect(fMid.stageCamera.transform.pose.pitch).toBeCloseTo(-7.5 * (Math.PI / 180), 3);
    expect(fMid.stageCamera.transform.pose.yaw).toBeCloseTo(202.5 * (Math.PI / 180), 3);
    expect(fMid.stageCamera.transform.pose.focalLengthMm).toBe(35);

    const f15 = computeStageFrame(15.0, score);
    expect(f15.stageCamera.transform.pose.distance).toBeCloseTo(1.5, 3);
    expect(f15.stageCamera.transform.pose.pitch).toBeCloseTo(-15 * (Math.PI / 180), 3);
    expect(f15.stageCamera.transform.pose.yaw).toBeCloseTo(225 * (Math.PI / 180), 3);
    expect(f15.stageCamera.transform.pose.focalLengthMm).toBe(35);
  });
});
