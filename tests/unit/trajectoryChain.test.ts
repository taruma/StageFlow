import { describe, expect, it } from 'vitest';
import { computeStageFrame } from '../../src/core/frameEngine';
import { makeScoreYaml, parseValidScore } from '../helpers/scoreFixtures';

describe('trajectoryChain — Multi-Shot Chaining, Option A Resets & Observer Tracks', () => {
  describe('Observer Camera 3-Tier Precedence & Gap Holding', () => {
    it('evaluates a single continuous observer_shots move across multiple rapid film cuts smoothly', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
stage:
  observer_camera:
    target: [0, 1.0, 0]
    distance: 10.0
    pitch: 30
    yaw: 0
    lens: 35mm
shots:
  - id: "cut-1"
    shot: 1
    start: 0.0
    end: 2.0
    stage_camera: { target: [0, 1, 0], lens: 35mm }
  - id: "cut-2"
    shot: 2
    start: 2.0
    end: 4.0
    stage_camera: { target: [0, 1, 0], lens: 50mm }
  - id: "cut-3"
    shot: 3
    start: 4.0
    end: 6.0
    stage_camera: { target: [0, 1, 0], lens: 85mm }
  - id: "cut-4"
    shot: 4
    start: 6.0
    end: 8.0
    stage_camera: { target: [0, 1, 0], lens: 135mm }
observer_shots:
  - id: "single-master-orbit"
    start: 0.0
    end: 8.0
    maneuver: "orbit"
    easing: "linear"
    target: [0, 1.0, 0]
    distance: 8.0
    pitch: 20
    yaw_start: 0
    yaw_end: 180
    lens: 28mm
`,
          { id: 'continuous-observer-test', duration: 8.0 }
        )
      );

      const f0 = computeStageFrame(0.0, score);
      expect(f0.observerCamera.transform.pose.yaw).toBeCloseTo(0.0, 3);
      expect(f0.observerCamera.transform.pose.focalLengthMm).toBe(28);

      const f2 = computeStageFrame(2.0, score);
      expect(f2.observerCamera.transform.pose.yaw).toBeCloseTo(Math.PI / 4, 3);

      const f4 = computeStageFrame(4.0, score);
      expect(f4.observerCamera.transform.pose.yaw).toBeCloseTo(Math.PI / 2, 3);

      const f8 = computeStageFrame(8.0, score);
      expect(f8.observerCamera.transform.pose.yaw).toBeCloseTo(Math.PI, 3);
    });

    it('gives complete precedence to root-level observer_shots over per-shot observer_camera cues', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
shots:
  - id: "shot-1"
    shot: 1
    start: 0.0
    end: 6.0
    stage_camera: { target: [0, 1, 0] }
    observer_camera:
      target: [0, 1, 0]
      distance: 2.0
      pitch: 10
      yaw: 45
      lens: 85mm
observer_shots:
  - id: "root-obs-1"
    start: 0.0
    end: 6.0
    maneuver: "dolly"
    target: [0, 1, 0]
    distance: 9.0
    pitch: 40
    yaw: 90
    lens: 24mm
`,
          { id: 'conflict-test', duration: 6.0 }
        )
      );

      const frame = computeStageFrame(3.0, score);
      expect(frame.observerCamera.transform.pose.distance).toBeCloseTo(9.0, 3);
      expect(frame.observerCamera.transform.pose.focalLengthMm).toBe(24);
      expect(frame.observerCamera.shotId).toBe('root-obs-1');
    });

    it('holds resting pose during time gaps and forward-chains into subsequent observer_shots', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
shots:
  - id: "film-shot"
    shot: 1
    start: 0.0
    end: 10.0
    stage_camera: { target: [0, 1, 0] }
observer_shots:
  - id: "move-1"
    start: 0.0
    end: 4.0
    maneuver: "dolly"
    distance_start: 10.0
    distance_end: 6.0
    pitch: 25
    yaw: 30
    lens: 35mm
  - id: "move-2"
    start: 7.0
    end: 10.0
    maneuver: "orbit"
    yaw_delta: 60
    lens: 50mm
`,
          { id: 'gap-test', duration: 10.0 }
        )
      );

      const f4 = computeStageFrame(4.0, score);
      expect(f4.observerCamera.transform.pose.distance).toBeCloseTo(6.0, 3);

      const f5_5 = computeStageFrame(5.5, score);
      expect(f5_5.observerCamera.isHold).toBe(true);
      expect(f5_5.observerCamera.transform.pose.distance).toBeCloseTo(6.0, 3);
      expect(f5_5.observerCamera.shotId).toBe('move-1');

      const f7 = computeStageFrame(7.0, score);
      expect(f7.observerCamera.transform.pose.distance).toBeCloseTo(6.0, 3);
      expect(f7.observerCamera.shotId).toBe('move-2');

      const f10 = computeStageFrame(10.0, score);
      expect(f10.observerCamera.transform.pose.focalLengthMm).toBe(50);
    });
  });

  describe('Option A Shot-Boundary Resets vs. Continuous Preservation', () => {
    it('implements Option A shot-boundary roll reset: resets to 0 deg when roll is omitted on subsequent shot', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
shots:
  - id: "shot-1"
    shot: 1
    start: 0.0
    end: 4.0
    stage_camera: { target: [0, 1, 0], roll: 18 }
  - id: "shot-2"
    shot: 2
    start: 4.0
    end: 8.0
    stage_camera: { target: [0, 1, 0] }
`,
          { id: 'option-a-test', duration: 8.0 }
        )
      );

      expect(computeStageFrame(2.0, score).stageCamera.transform.pose.roll).toBeCloseTo(
        18 * (Math.PI / 180),
        4
      );
      const f2 = computeStageFrame(4.0, score);
      expect(f2.stageCamera.shotId).toBe('shot-2');
      expect(f2.stageCamera.transform.pose.roll).toBeCloseTo(0, 5);
      expect(computeStageFrame(6.0, score).stageCamera.transform.pose.roll).toBeCloseTo(0, 5);
    });

    it('supports smooth animated roll within a shot and cross-shot recovery via roll_end: 0', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
shots:
  - id: "shot-1"
    shot: 1
    start: 0.0
    end: 4.0
    stage_camera:
      target: [0, 1, 0]
      maneuver: "straight"
      easing: "linear"
      roll_start: 0
      roll_end: 20
  - id: "shot-2"
    shot: 2
    start: 4.0
    end: 8.0
    stage_camera:
      target: [0, 1, 0]
      maneuver: "straight"
      easing: "linear"
      roll_end: 0
`,
          { id: 'animated-roll-test', duration: 8.0 }
        )
      );

      expect(computeStageFrame(0.0, score).stageCamera.transform.pose.roll).toBeCloseTo(0, 5);
      expect(computeStageFrame(2.0, score).stageCamera.transform.pose.roll).toBeCloseTo(
        10 * (Math.PI / 180),
        4
      );
      expect(computeStageFrame(4.0, score).stageCamera.transform.pose.roll).toBeCloseTo(
        20 * (Math.PI / 180),
        4
      );
      expect(computeStageFrame(6.0, score).stageCamera.transform.pose.roll).toBeCloseTo(
        10 * (Math.PI / 180),
        4
      );
      expect(computeStageFrame(8.0, score).stageCamera.transform.pose.roll).toBeCloseTo(0, 5);
    });

    it('preserves camera roll seamlessly across shot boundaries under continuous: true without snapping to 0 deg', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
shots:
  - id: "shot-1"
    end: 4.0
    stage_camera: { target: [0, 1, 0], distance: 3.0, roll: 18 }
  - id: "shot-2"
    end: 8.0
    stage_camera: { maneuver: "dolly", easing: "linear", distance: 2.0 }
  - id: "shot-3"
    end: 12.0
    stage_camera: { maneuver: "dolly", easing: "linear", distance: 1.5, roll: 0 }
`,
          { id: 'continuous-roll-test', continuous: true }
        )
      );

      expect(computeStageFrame(2.0, score).stageCamera.transform.pose.roll).toBeCloseTo(
        18 * (Math.PI / 180),
        4
      );
      const f2Start = computeStageFrame(4.0, score);
      expect(f2Start.stageCamera.shotId).toBe('shot-2');
      expect(f2Start.stageCamera.transform.pose.roll).toBeCloseTo(18 * (Math.PI / 180), 4);
      expect(computeStageFrame(6.0, score).stageCamera.transform.pose.roll).toBeCloseTo(
        18 * (Math.PI / 180),
        4
      );
      const f3Start = computeStageFrame(8.0, score);
      expect(f3Start.stageCamera.shotId).toBe('shot-3');
      expect(f3Start.stageCamera.transform.pose.roll).toBeCloseTo(18 * (Math.PI / 180), 4);
      expect(computeStageFrame(10.0, score).stageCamera.transform.pose.roll).toBeCloseTo(
        9 * (Math.PI / 180),
        3
      );
      expect(computeStageFrame(12.0, score).stageCamera.transform.pose.roll).toBeCloseTo(0, 5);
    });

    it('preserves and glides target_offset seamlessly across shot boundaries under continuous: true without snapping', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
shots:
  - id: "shot-1"
    end: 4.0
    stage_camera: { target: [0, 1, 0], distance: 3.0, target_offset: [0.6, 0.4, 0.0] }
  - id: "shot-2"
    end: 8.0
    stage_camera: { maneuver: "dolly", easing: "linear", distance: 2.0 }
  - id: "shot-3"
    end: 12.0
    stage_camera: { maneuver: "dolly", easing: "linear", distance: 1.5, target_offset: [0.0, 0.0, 0.0] }
`,
          { id: 'continuous-offset-test', continuous: true }
        )
      );

      const f1 = computeStageFrame(2.0, score);
      expect(f1.stageCamera.targetOffset!.x).toBeCloseTo(0.6, 3);
      expect(f1.stageCamera.targetOffset!.y).toBeCloseTo(0.4, 3);

      const f2Start = computeStageFrame(4.0, score);
      expect(f2Start.stageCamera.shotId).toBe('shot-2');
      expect(f2Start.stageCamera.targetOffset!.x).toBeCloseTo(0.6, 3);
      expect(f2Start.stageCamera.targetOffset!.y).toBeCloseTo(0.4, 3);
      expect(f2Start.stageCamera.baseTarget!.x).toBeCloseTo(0.0, 4);
      expect(f2Start.stageCamera.baseTarget!.y).toBeCloseTo(1.0, 4);
      expect(f2Start.stageCamera.transform.pose.target.x).toBeCloseTo(0.6, 3);
      expect(f2Start.stageCamera.transform.pose.target.y).toBeCloseTo(1.4, 3);

      const f2Mid = computeStageFrame(6.0, score);
      expect(f2Mid.stageCamera.targetOffset!.x).toBeCloseTo(0.6, 3);
      expect(f2Mid.stageCamera.targetOffset!.y).toBeCloseTo(0.4, 3);
      expect(f2Mid.stageCamera.transform.pose.target.x).toBeCloseTo(0.6, 3);
      expect(f2Mid.stageCamera.transform.pose.target.y).toBeCloseTo(1.4, 3);

      const f3Mid = computeStageFrame(10.0, score);
      expect(f3Mid.stageCamera.targetOffset!.x).toBeCloseTo(0.3, 3);
      expect(f3Mid.stageCamera.targetOffset!.y).toBeCloseTo(0.2, 3);
      expect(f3Mid.stageCamera.transform.pose.target.x).toBeCloseTo(0.3, 3);
      expect(f3Mid.stageCamera.transform.pose.target.y).toBeCloseTo(1.2, 3);

      const f3End = computeStageFrame(12.0, score);
      expect(f3End.stageCamera.targetOffset!.x).toBeCloseTo(0.0, 4);
      expect(f3End.stageCamera.targetOffset!.y).toBeCloseTo(0.0, 4);
      expect(f3End.stageCamera.transform.pose.target.x).toBeCloseTo(0.0, 4);
      expect(f3End.stageCamera.transform.pose.target.y).toBeCloseTo(1.0, 4);
    });

    it('evaluates hybrid cut and oner sequences cleanly using shot-level continuous: true', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
shots:
  - id: "shot-1"
    start: 0.0
    end: 4.0
    stage_camera: { target: [0, 1, 0], distance: 4.0, pitch: 10, yaw: 0 }
  - id: "shot-2"
    start: 4.0
    end: 8.0
    stage_camera: { target: [0, 1, 0], distance: 3.0, pitch: 15, yaw: -30, roll: 20 }
  - id: "shot-3"
    start: 8.0
    end: 12.0
    stage_camera: { target: [0, 1, 0], maneuver: "dolly", distance: 2.0, pitch: 12, yaw: 45, roll: 16 }
  - id: "shot-4"
    continuous: true
    end: 16.0
    stage_camera: { maneuver: "dolly", easing: "linear", distance: 1.5, pitch: 6, yaw: 90 }
  - id: "shot-5"
    start: 16.0
    end: 20.0
    stage_camera: { target: [0, 1, 0], distance: 5.0, pitch: 20, yaw: 0 }
`,
          { id: 'hybrid-oner-cut-test' }
        )
      );

      expect(computeStageFrame(6.0, score).stageCamera.transform.pose.roll).toBeCloseTo(
        20 * (Math.PI / 180),
        4
      );
      expect(computeStageFrame(9.0, score).stageCamera.transform.pose.roll).toBeCloseTo(
        16 * (Math.PI / 180),
        4
      );

      expect(score.shots[3].startSec).toBe(12.0);
      const f4Start = computeStageFrame(12.0, score);
      expect(f4Start.stageCamera.shotId).toBe('shot-4');
      expect(f4Start.stageCamera.transform.pose.distance).toBeCloseTo(2.0, 3);
      expect(f4Start.stageCamera.transform.pose.pitch).toBeCloseTo(12 * (Math.PI / 180), 3);
      expect(f4Start.stageCamera.transform.pose.yaw).toBeCloseTo(45 * (Math.PI / 180), 3);
      expect(f4Start.stageCamera.transform.pose.roll).toBeCloseTo(16 * (Math.PI / 180), 3);

      const f4Mid = computeStageFrame(14.0, score);
      expect(f4Mid.stageCamera.transform.pose.distance).toBeCloseTo(1.75, 3);
      expect(f4Mid.stageCamera.transform.pose.pitch).toBeCloseTo(9 * (Math.PI / 180), 3);
      expect(f4Mid.stageCamera.transform.pose.yaw).toBeCloseTo(67.5 * (Math.PI / 180), 3);
      expect(f4Mid.stageCamera.transform.pose.roll).toBeCloseTo(16 * (Math.PI / 180), 3);

      const f5 = computeStageFrame(17.0, score);
      expect(f5.stageCamera.shotId).toBe('shot-5');
      expect(f5.stageCamera.transform.pose.distance).toBeCloseTo(5.0, 3);
      expect(f5.stageCamera.transform.pose.roll).toBeCloseTo(0, 5);
    });

    it('preserves observer camera roll and target offset seamlessly across observer_shots boundaries under continuous mode', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
shots:
  - id: "s1"
    start: 0.0
    end: 12.0
observer_shots:
  - id: "obs-1"
    end: 4.0
    camera: { target: [0, 1, 0], distance: 8.0, roll: 15, target_offset: [0.5, 0.2, 0.0] }
  - id: "obs-2"
    end: 8.0
    camera: { maneuver: "dolly", easing: "linear", distance: 6.0 }
  - id: "obs-3"
    end: 12.0
    camera: { maneuver: "dolly", easing: "linear", distance: 4.0, roll: 0, target_offset: [0.0, 0.0, 0.0] }
`,
          { id: 'continuous-observer-test', continuous: true }
        )
      );

      const f1 = computeStageFrame(2.0, score);
      expect(f1.observerCamera.transform.pose.roll).toBeCloseTo(15 * (Math.PI / 180), 4);
      expect(f1.observerCamera.targetOffset!.x).toBeCloseTo(0.5, 3);
      expect(f1.observerCamera.targetOffset!.y).toBeCloseTo(0.2, 3);

      const f2Start = computeStageFrame(4.0, score);
      expect(f2Start.observerCamera.shotId).toBe('obs-2');
      expect(f2Start.observerCamera.transform.pose.roll).toBeCloseTo(15 * (Math.PI / 180), 4);
      expect(f2Start.observerCamera.targetOffset!.x).toBeCloseTo(0.5, 3);
      expect(f2Start.observerCamera.targetOffset!.y).toBeCloseTo(0.2, 3);

      const f2Mid = computeStageFrame(6.0, score);
      expect(f2Mid.observerCamera.transform.pose.distance).toBeCloseTo(7.0, 3);
      expect(f2Mid.observerCamera.transform.pose.roll).toBeCloseTo(15 * (Math.PI / 180), 4);
      expect(f2Mid.observerCamera.targetOffset!.x).toBeCloseTo(0.5, 3);

      const f3Mid = computeStageFrame(10.0, score);
      expect(f3Mid.observerCamera.transform.pose.roll).toBeCloseTo(7.5 * (Math.PI / 180), 3);
      expect(f3Mid.observerCamera.targetOffset!.x).toBeCloseTo(0.25, 3);
      expect(f3Mid.observerCamera.targetOffset!.y).toBeCloseTo(0.1, 3);

      const f3End = computeStageFrame(12.0, score);
      expect(f3End.observerCamera.transform.pose.roll).toBeCloseTo(0, 5);
      expect(f3End.observerCamera.targetOffset!.x).toBeCloseTo(0.0, 4);
      expect(f3End.observerCamera.targetOffset!.y).toBeCloseTo(0.0, 4);
    });

    it('implements Option A observer cue-boundary resets when continuous: false or on cut', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
shots:
  - id: "s1"
    start: 0.0
    end: 8.0
observer_shots:
  - id: "obs-1"
    start: 0.0
    end: 4.0
    camera: { target: [0, 1, 0], distance: 8.0, roll: 20, target_offset: [0.8, 0.4, 0.0] }
  - id: "obs-2"
    start: 4.0
    end: 8.0
    camera: { maneuver: "cut", distance: 5.0 }
`,
          { id: 'obs-cuts-test' }
        )
      );

      const f1 = computeStageFrame(2.0, score);
      expect(f1.observerCamera.transform.pose.roll).toBeCloseTo(20 * (Math.PI / 180), 4);
      expect(f1.observerCamera.targetOffset!.x).toBeCloseTo(0.8, 3);

      const f2 = computeStageFrame(4.0, score);
      expect(f2.observerCamera.shotId).toBe('obs-2');
      expect(f2.observerCamera.transform.pose.roll).toBeCloseTo(0, 5);
      expect(f2.observerCamera.targetOffset!.x).toBeCloseTo(0, 5);
      expect(f2.observerCamera.targetOffset!.y).toBeCloseTo(0, 5);
    });

    it('inherits shot-level continuous: true for Tier 2 shots[].observer_camera cues and supports per-camera continuous overrides', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
shots:
  - id: "s1"
    start: 0.0
    end: 4.0
    stage_camera: { target: [0, 1, 0], distance: 4.0, roll: 18 }
    observer_camera: { target: [0, 1, 0], distance: 8.0, roll: 14, target_offset: [0.4, 0.0, 0.0] }
  - id: "s2"
    continuous: true
    end: 8.0
    stage_camera: { maneuver: "dolly", distance: 3.0 }
    observer_camera: { maneuver: "dolly", easing: "linear", distance: 5.0 }
  - id: "s3"
    start: 8.0
    end: 12.0
    stage_camera: { target: [0, 1, 0], distance: 2.0 }
    observer_camera: { continuous: true, maneuver: "dolly", easing: "linear", distance: 4.0 }
`,
          { id: 'tier2-obs-continuous-test' }
        )
      );

      const f1 = computeStageFrame(2.0, score);
      expect(f1.observerCamera.transform.pose.roll).toBeCloseTo(14 * (Math.PI / 180), 4);
      expect(f1.observerCamera.targetOffset!.x).toBeCloseTo(0.4, 3);

      const f2 = computeStageFrame(4.0, score);
      expect(f2.observerCamera.shotId).toBe('s2');
      expect(f2.stageCamera.transform.pose.roll).toBeCloseTo(18 * (Math.PI / 180), 4);
      expect(f2.observerCamera.transform.pose.roll).toBeCloseTo(14 * (Math.PI / 180), 4);
      expect(f2.observerCamera.targetOffset!.x).toBeCloseTo(0.4, 3);

      const f3 = computeStageFrame(8.0, score);
      expect(f3.stageCamera.shotId).toBe('s3');
      expect(f3.stageCamera.transform.pose.roll).toBeCloseTo(0, 5);
      expect(f3.observerCamera.shotId).toBe('s3');
      expect(f3.observerCamera.transform.pose.roll).toBeCloseTo(14 * (Math.PI / 180), 4);
      expect(f3.observerCamera.targetOffset!.x).toBeCloseTo(0.4, 3);
    });

    it('implements Option A shot-boundary target_offset reset: applies world offset and resets to [0,0,0] when omitted on next shot', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
entities:
  - id: "arthur"
    label: "Arthur"
    kind: "character"
    position: [-4, 0, 2]
    height: 1.75
shots:
  - id: "shot-1"
    shot: 1
    start: 0.0
    end: 4.0
    stage_camera:
      target: "arthur"
      target_offset: [0.5, 0.3, -0.2]
      distance: 3.0
      pitch: 0
      yaw: 0
  - id: "shot-2"
    shot: 2
    start: 4.0
    end: 8.0
    stage_camera:
      target: "arthur"
      distance: 3.0
      pitch: 0
      yaw: 0
`,
          { id: 'target-offset-reset-test', duration: 8.0 }
        )
      );

      const baseAnchorY = 1.75 * 0.9;

      const f1 = computeStageFrame(2.0, score);
      expect(f1.stageCamera.transform.target.x).toBeCloseTo(-4 + 0.5, 5);
      expect(f1.stageCamera.transform.target.y).toBeCloseTo(baseAnchorY + 0.3, 5);
      expect(f1.stageCamera.transform.target.z).toBeCloseTo(2 - 0.2, 5);
      expect(f1.stageCamera.transform.position.x).toBeCloseTo(-4 + 0.5, 5);
      expect(f1.stageCamera.transform.position.y).toBeCloseTo(baseAnchorY + 0.3, 5);
      expect(f1.stageCamera.transform.position.z).toBeCloseTo(2 - 0.2 + 3.0, 5);

      const f2 = computeStageFrame(5.0, score);
      expect(f2.stageCamera.transform.target.x).toBeCloseTo(-4, 5);
      expect(f2.stageCamera.transform.target.y).toBeCloseTo(baseAnchorY, 5);
      expect(f2.stageCamera.transform.target.z).toBeCloseTo(2, 5);
    });

    it('interpolates animated target_offset_start -> target_offset_end and supports cross-shot recovery via target_offset_end: [0,0,0]', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
entities:
  - id: "arthur"
    label: "Arthur"
    kind: "character"
    position: [0, 0, 0]
    height: 1.75
shots:
  - id: "shot-1"
    shot: 1
    start: 0.0
    end: 4.0
    stage_camera:
      target: "arthur"
      maneuver: "dolly"
      easing: "linear"
      target_offset_start: [0, -1.0, 0]
      target_offset_end: [0, 0.4, 0]
      distance: 2.5
  - id: "shot-2"
    shot: 2
    start: 4.0
    end: 8.0
    stage_camera:
      target: "arthur"
      maneuver: "dolly"
      easing: "linear"
      target_offset_end: [0, 0, 0]
      distance: 2.5
`,
          { id: 'target-offset-anim-test', duration: 8.0 }
        )
      );

      const baseAnchorY = 1.75 * 0.9;
      expect(computeStageFrame(0.0, score).stageCamera.transform.target.y).toBeCloseTo(
        baseAnchorY - 1.0,
        5
      );
      expect(computeStageFrame(2.0, score).stageCamera.transform.target.y).toBeCloseTo(
        baseAnchorY - 0.3,
        5
      );
      expect(computeStageFrame(4.0, score).stageCamera.transform.target.y).toBeCloseTo(
        baseAnchorY + 0.4,
        5
      );
      expect(computeStageFrame(6.0, score).stageCamera.transform.target.y).toBeCloseTo(
        baseAnchorY + 0.2,
        5
      );
      expect(computeStageFrame(8.0, score).stageCamera.transform.target.y).toBeCloseTo(
        baseAnchorY,
        5
      );
    });

    it('chains physical camera parameters (distance, pitch, yaw) while swapping lens discretely under continuous: true', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
shots:
  - id: "shot-1"
    shot: 1
    end: 6.0
    stage_camera:
      target: [0, 1.0, 0]
      distance: 1.8
      pitch: 4
      yaw: 90
      lens: 35mm
  - id: "shot-2"
    shot: 2
    end: 15.0
    stage_camera:
      target: [0, 1.0, 0]
      maneuver: "arc"
      easing: "linear"
      distance: 1.5
      pitch: -6
      yaw: 175
      lens: 50mm
`,
          { id: 'continuous-camera-chain-test', continuous: true }
        )
      );

      const f6 = computeStageFrame(6.0, score);
      expect(f6.stageCamera.shotId).toBe('shot-2');
      expect(f6.stageCamera.transform.pose.distance).toBeCloseTo(1.8, 3);
      expect(f6.stageCamera.transform.pose.pitch).toBeCloseTo(4 * (Math.PI / 180), 3);
      expect(f6.stageCamera.transform.pose.yaw).toBeCloseTo(90 * (Math.PI / 180), 3);
      expect(f6.stageCamera.transform.pose.focalLengthMm).toBe(50);

      const fMid = computeStageFrame(10.5, score);
      expect(fMid.stageCamera.transform.pose.pitch).toBeCloseTo(-1 * (Math.PI / 180), 2);
      expect(fMid.stageCamera.transform.pose.yaw).toBeCloseTo(132.5 * (Math.PI / 180), 2);
      expect(fMid.stageCamera.transform.pose.focalLengthMm).toBe(50);

      const f15 = computeStageFrame(15.0, score);
      expect(f15.stageCamera.transform.pose.distance).toBeCloseTo(1.5, 3);
      expect(f15.stageCamera.transform.pose.pitch).toBeCloseTo(-6 * (Math.PI / 180), 3);
      expect(f15.stageCamera.transform.pose.yaw).toBeCloseTo(175 * (Math.PI / 180), 3);
      expect(f15.stageCamera.transform.pose.focalLengthMm).toBe(50);
    });

    it('asserts referential stability and zero-jitter of trajectory rails across intra-shot frames', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
entities:
  - id: "ball"
    kind: "prop"
    shape: "sphere"
    position: [-5, 1.0, 0]
blocking:
  - id: "ball-flight"
    entity: "ball"
    start: 0.0
    end: 3.0
    position: [5, 3.0, 0]
    easing: "linear"
shots:
  - id: "shot-1"
    shot: 1
    start: 0.0
    end: 3.0
    stage_camera:
      target: "ball"
      maneuver: "dolly"
      distance_start: 6.0
      distance_end: 3.0
      pitch_start: 10
      pitch_end: 20
      yaw_start: -30
      yaw_end: 30
      lens: 35mm
`,
          { id: 'rail-stability-test', duration: 3.0 }
        )
      );

      const f0 = computeStageFrame(0.0, score);
      const f0_5 = computeStageFrame(0.5, score);
      const f1_0 = computeStageFrame(1.0, score);
      const f2_5 = computeStageFrame(2.5, score);

      expect(f0.stageCamera.trajectoryPoints).toBe(f0_5.stageCamera.trajectoryPoints);
      expect(f0.stageCamera.trajectoryPoints).toBe(f1_0.stageCamera.trajectoryPoints);
      expect(f0.stageCamera.trajectoryPoints).toBe(f2_5.stageCamera.trajectoryPoints);
      expect(f0.stageCamera.trajectoryPoints.length).toBe(33);

      const traj = f0.stageCamera.trajectoryPoints;
      expect(traj[0].x).toBeCloseTo(f0.stageCamera.transform.position.x, 2);
      expect(traj[0].y).toBeCloseTo(f0.stageCamera.transform.position.y, 2);
      expect(traj[0].z).toBeCloseTo(f0.stageCamera.transform.position.z, 2);

      const f3 = computeStageFrame(2.999, score);
      expect(traj[traj.length - 1].x).toBeCloseTo(f3.stageCamera.transform.position.x, 2);
      expect(traj[traj.length - 1].y).toBeCloseTo(f3.stageCamera.transform.position.y, 2);
      expect(traj[traj.length - 1].z).toBeCloseTo(f3.stageCamera.transform.position.z, 2);
    });
  });
});
