import { describe, expect, it } from 'vitest';
import { computeStageFrame } from '../../src/core/frameEngine';
import { makeScoreYaml, parseValidScore } from '../helpers/scoreFixtures';

describe('frameEngine — Stateless Functional Timeline (Frame_t = f(t))', () => {
  it('produces bit-for-bit identical 3D states at any timestamp t regardless of scrub direction', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
entities:
  - id: "lead"
    label: "Lead"
    kind: "character"
    position: [-3, 0, 0]
    rotation: 90
  - id: "partner"
    label: "Partner"
    kind: "character"
    position: [3, 0, 0]
    rotation: -90
blocking:
  - id: "lead-walk"
    entity: "lead"
    start: 0.0
    end: 10.0
    position: [1, 0, 1]
    look_at: "partner"
    easing: "smooth"
shots:
  - id: "shot-1"
    shot: 1
    start: 0.0
    end: 4.0
    stage_camera:
      target: "lead"
      maneuver: "dolly"
      distance_start: 5.0
      distance_end: 2.8
      pitch: 10
      yaw: 15
      lens: 35mm
  - id: "shot-2"
    shot: 2
    start: 4.0
    end: 10.0
    stage_camera:
      target: ["lead", "partner"]
      maneuver: "orbit"
      distance: 4.0
      pitch: 12
      yaw_start: -20
      yaw_end: 40
      lens: 50mm
observer_shots:
  - id: "obs-master"
    start: 0.0
    end: 10.0
    maneuver: "orbit"
    target: "center"
    distance: 9.0
    pitch: 28
    yaw_start: 20
    yaw_end: 80
    lens: 35mm
`,
        { id: 'determinism-test', duration: 10.0 }
      )
    );

    // Forward playback evaluation sequence: 0.0 -> 2.5 -> 5.0 -> 8.2
    computeStageFrame(0.0, score);
    computeStageFrame(2.5, score);
    const forwardAt5 = computeStageFrame(5.0, score);
    computeStageFrame(8.2, score);

    // Random backward & jumping scrub sequence: 9.8 -> 1.1 -> 7.4 -> 5.0
    computeStageFrame(9.8, score);
    computeStageFrame(1.1, score);
    computeStageFrame(7.4, score);
    const scrubbedAt5 = computeStageFrame(5.0, score);

    expect(scrubbedAt5.stageCamera.transform.position).toEqual(
      forwardAt5.stageCamera.transform.position
    );
    expect(scrubbedAt5.stageCamera.transform.target).toEqual(
      forwardAt5.stageCamera.transform.target
    );
    expect(scrubbedAt5.observerCamera.transform.position).toEqual(
      forwardAt5.observerCamera.transform.position
    );
  });

  it('chains camera and entity poses across multi-shot transitions cleanly', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
entities:
  - id: "actor_a"
    label: "Actor A"
    kind: "character"
    position: [-2, 0, 0]
    rotation: 0
  - id: "actor_b"
    label: "Actor B"
    kind: "character"
    position: [2, 0, 0]
    rotation: 180
shots:
  - id: "shot-1"
    shot: 1
    label: "Walk In"
    start: 0.0
    end: 4.0
    stage_camera:
      target: "actor_a"
      maneuver: "dolly"
      distance_start: 5.0
      distance_end: 3.0
      pitch: 10
      yaw: 0
      lens: 35mm
    entities:
      actor_a:
        position: [0, 0, 0]
        look_at: "actor_b"
        highlighted: true
  - id: "shot-2"
    shot: 2
    label: "Close Up Hold"
    start: 4.0
    end: 8.0
    stage_camera:
      maneuver: "orbit"
      yaw_delta: 45
      lens: 85mm
`,
        { id: 'multi-shot-test', duration: 8.0 }
      )
    );

    const frameAt6 = computeStageFrame(6.0, score);
    const actorA = frameAt6.entitiesById.get('actor_a');
    expect(actorA).toBeDefined();
    expect(actorA!.position.x).toBeCloseTo(0, 4);
    expect(actorA!.position.z).toBeCloseTo(0, 4);
    expect(frameAt6.stageCamera.transform.pose.distance).toBeCloseTo(3.0, 4);
    expect(frameAt6.stageCamera.transform.pose.focalLengthMm).toBeCloseTo(85, 4);
  });

  it('cuts cleanly between sequential dolly shots with different targets without dragging look-at target across shots', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
entities:
  - id: "actor_a"
    label: "Actor A"
    kind: "character"
    position: [-2, 0, 0]
  - id: "actor_b"
    label: "Actor B"
    kind: "character"
    position: [2, 0, 0]
shots:
  - id: "shot-1"
    shot: 1
    start: 0.0
    end: 3.0
    stage_camera:
      target: "actor_a"
      maneuver: "dolly"
      distance_start: 4.0
      distance_end: 2.0
      pitch: 0
      yaw: 0
      lens: 50mm
  - id: "shot-2"
    shot: 2
    start: 3.0
    end: 6.0
    stage_camera:
      target: "actor_b"
      maneuver: "dolly"
      distance_start: 3.0
      distance_end: 1.5
      pitch: 0
      yaw: 180
      lens: 85mm
`,
        { id: 'sequential-dolly-test', duration: 6.0 }
      )
    );

    const expectedAnchorY = 1.575;

    const f0 = computeStageFrame(0.0, score);
    expect(f0.stageCamera.transform.target.x).toBeCloseTo(-2, 3);
    expect(f0.stageCamera.transform.target.y).toBeCloseTo(expectedAnchorY, 3);
    expect(f0.stageCamera.transform.position.x).toBeCloseTo(-2, 3);
    expect(f0.stageCamera.transform.position.y).toBeCloseTo(expectedAnchorY, 3);
    expect(f0.stageCamera.transform.position.z).toBeCloseTo(4, 3);

    const fBeforeCut = computeStageFrame(2.99, score);
    expect(fBeforeCut.stageCamera.transform.target.x).toBeCloseTo(-2, 2);
    expect(fBeforeCut.stageCamera.transform.position.x).toBeCloseTo(-2, 2);

    const fCut = computeStageFrame(3.0, score);
    expect(fCut.stageCamera.shotId).toBe('shot-2');
    expect(fCut.stageCamera.transform.target.x).toBeCloseTo(2, 3);
    expect(fCut.stageCamera.transform.target.y).toBeCloseTo(expectedAnchorY, 3);
    expect(fCut.stageCamera.transform.target.z).toBeCloseTo(0, 3);
    expect(fCut.stageCamera.transform.position.x).toBeCloseTo(2, 3);
    expect(fCut.stageCamera.transform.position.y).toBeCloseTo(expectedAnchorY, 3);
    expect(fCut.stageCamera.transform.position.z).toBeCloseTo(-3, 3);

    const fMid = computeStageFrame(4.5, score);
    expect(fMid.stageCamera.transform.target.x).toBeCloseTo(2, 3);
    expect(fMid.stageCamera.transform.position.x).toBeCloseTo(2, 3);
  });

  describe('YAML Order Priority, Gap Holding & Continuous Sync', () => {
    it('prioritizes the later shot in YAML order when two shots overlap', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
stage: { width: 10, depth: 10 }
shots:
  - id: "shot-2"
    shot: 2
    label: "Shot 2 Wide"
    start: 0.0
    end: 18.0
    stage_camera:
      target: [0, 1.0, 0]
      distance: 8.0
      pitch: 20
      yaw: 45
      lens: 35mm
  - id: "shot-3"
    shot: 3
    label: "Shot 3 Close"
    start: 15.0
    end: 25.0
    stage_camera:
      target: [0, 1.0, 0]
      distance: 2.5
      pitch: 5
      yaw: -30
      lens: 85mm
`,
          { id: 'overlap-priority-test', duration: 25.0 }
        )
      );

      const f10 = computeStageFrame(10.0, score);
      expect(f10.activeShot?.id).toBe('shot-2');
      expect(f10.stageCamera.shotId).toBe('shot-2');
      expect(f10.stageCamera.transform.pose.distance).toBeCloseTo(8.0, 3);
      expect(f10.stageCamera.transform.pose.focalLengthMm).toBe(35);

      const f16 = computeStageFrame(16.0, score);
      expect(f16.activeShot?.id).toBe('shot-3');
      expect(f16.stageCamera.shotId).toBe('shot-3');
      expect(f16.stageCamera.transform.pose.distance).toBeCloseTo(2.5, 3);
      expect(f16.stageCamera.transform.pose.focalLengthMm).toBe(85);

      const f20 = computeStageFrame(20.0, score);
      expect(f20.activeShot?.id).toBe('shot-3');
      expect(f20.stageCamera.shotId).toBe('shot-3');
    });

    it('holds terminal camera pose and actor positions during intentional time gaps between shots', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
entities:
  - id: "actor"
    label: "Actor"
    kind: "character"
    position: [0, 0, 0]
    rotation: 0
shots:
  - id: "shot-1"
    shot: 1
    start: 0.0
    end: 10.0
    stage_camera:
      target: [0, 1.0, 0]
      distance: 4.0
      pitch: 10
      yaw: 0
      lens: 50mm
    entities:
      actor:
        position: [3.0, 0, 0]
        rotation: 90
  - id: "shot-2"
    shot: 2
    start: 15.0
    end: 20.0
    stage_camera:
      target: [0, 1.0, 0]
      distance: 2.0
      pitch: 0
      yaw: 180
      lens: 85mm
`,
          { id: 'gap-hold-test', duration: 25.0 }
        )
      );

      const fGap = computeStageFrame(12.5, score);
      expect(fGap.activeShot).toBeNull();
      expect(fGap.stageCamera.isHold).toBe(true);
      expect(fGap.stageCamera.transform.pose.distance).toBeCloseTo(4.0, 3);
      expect(fGap.stageCamera.transform.pose.focalLengthMm).toBe(50);

      const actor = fGap.entitiesById.get('actor');
      expect(actor).toBeDefined();
      expect(actor!.position.x).toBeCloseTo(3.0, 3);
    });

    it('evaluates a continuous: true chained score with seamless 3D camera and HUD synchronization', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
shots:
  - id: "shot-1"
    shot: 1
    end: 6.0
    stage_camera:
      target: [0, 1.0, 0]
      distance: 5.0
      pitch: 10
      yaw: 45
      lens: 35mm
  - id: "shot-2"
    shot: 2
    end: 15.0
    stage_camera:
      target: [0, 1.0, 0]
      distance: 2.0
      pitch: 0
      yaw: 90
      lens: 50mm
`,
          { id: 'expansion-mini', continuous: true }
        )
      );

      const f3 = computeStageFrame(3.0, score);
      expect(f3.activeShot?.id).toBe('shot-1');
      expect(f3.stageCamera.shotId).toBe('shot-1');
      expect(f3.stageCamera.transform.pose.distance).toBeCloseTo(5.0, 3);
      expect(f3.stageCamera.transform.pose.focalLengthMm).toBe(35);

      const f6 = computeStageFrame(6.0, score);
      expect(f6.activeShot?.id).toBe('shot-2');
      expect(f6.stageCamera.shotId).toBe('shot-2');
      expect(f6.stageCamera.transform.pose.distance).toBeCloseTo(5.0, 3);
      expect(f6.stageCamera.transform.pose.focalLengthMm).toBe(50);

      const f10 = computeStageFrame(10.5, score);
      expect(f10.activeShot?.id).toBe('shot-2');
      expect(f10.stageCamera.shotId).toBe('shot-2');
      expect(f10.stageCamera.transform.pose.distance).toBeCloseTo(3.5, 2);

      const f15 = computeStageFrame(15.0, score);
      expect(f15.stageCamera.transform.pose.distance).toBeCloseTo(2.0, 3);
    });
  });

  describe('Decoupled Entity Blocking Integration Across Camera Cuts', () => {
    it('evaluates a continuous actor walk across multiple rapid camera cuts without velocity resets or snaps', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
entities:
  - id: "arthur"
    label: "Arthur"
    kind: "character"
    position: [-10, 0, 0]
    rotation: 90
  - id: "ruby"
    label: "Ruby"
    kind: "character"
    position: [6, 0, 0]
    rotation: -90
blocking:
  - id: "arthur-cross-room"
    entity: "arthur"
    start: 0.0
    end: 9.0
    position: [2, 0, 0]
    easing: "linear"
    look_at: "ruby"
shots:
  - id: "shot-1"
    shot: 1
    start: 0.0
    end: 3.0
    stage_camera: { target: "arthur", maneuver: "dolly", distance: 4.0, lens: 35mm }
  - id: "shot-2"
    shot: 2
    start: 3.0
    end: 6.0
    stage_camera: { target: "arthur", maneuver: "arc", distance: 2.8, lens: 50mm }
    entities:
      arthur:
        highlighted: true
        note: "Hero profile"
  - id: "shot-3"
    shot: 3
    start: 6.0
    end: 9.0
    stage_camera: { target: "arthur", maneuver: "orbit", distance: 2.2, lens: 85mm }
`,
          { id: 'decoupled-blocking-walk', duration: 9.0 }
        )
      );

      const f0 = computeStageFrame(0.0, score);
      const a0 = f0.entitiesById.get('arthur')!;
      expect(a0.position.x).toBeCloseTo(-10, 4);
      expect(a0.cueId).toBe('arthur-cross-room');
      expect(a0.highlighted).toBe(false);

      const f3Before = computeStageFrame(2.999, score);
      const f3After = computeStageFrame(3.0, score);
      expect(f3Before.activeShot?.id).toBe('shot-1');
      expect(f3After.activeShot?.id).toBe('shot-2');
      expect(f3After.entitiesById.get('arthur')!.position.x).toBeCloseTo(-6.0, 3);
      expect(
        Math.abs(
          f3After.entitiesById.get('arthur')!.position.x -
            f3Before.entitiesById.get('arthur')!.position.x
        )
      ).toBeLessThan(0.005);

      expect(f3After.entitiesById.get('arthur')!.highlighted).toBe(true);
      expect(f3After.entitiesById.get('arthur')!.note).toBe('Hero profile');
      expect(f3After.entitiesById.get('arthur')!.cueId).toBe('arthur-cross-room');

      const f6 = computeStageFrame(6.0, score);
      expect(f6.activeShot?.id).toBe('shot-3');
      expect(f6.entitiesById.get('arthur')!.position.x).toBeCloseTo(-2.0, 3);
      expect(f6.entitiesById.get('arthur')!.highlighted).toBe(false);

      for (const sampleT of [1.5, 4.5, 7.5]) {
        const frame = computeStageFrame(sampleT, score);
        const trail = frame.entitiesById.get('arthur')!.trailPoints;
        expect(trail).toHaveLength(17);
        expect(trail[0]).toEqual({ x: -10, y: 0.02, z: 0 });
        expect(trail[16]).toEqual({ x: 2, y: 0.02, z: 0 });
      }
    });

    it('holds terminal pose across temporal gaps and resolves two-pass mutual gaze with C0 rotation continuity', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
entities:
  - id: "arthur"
    label: "Arthur"
    kind: "character"
    position: [-5, 0, 0]
    rotation: 0
  - id: "ruby"
    label: "Ruby"
    kind: "character"
    position: [0, 0, -5]
    rotation: 0
blocking:
  - id: "ruby-walk-z"
    entity: "ruby"
    start: 0.0
    end: 10.0
    position: [0, 0, 5]
    easing: "linear"
    look_at: "arthur"
  - id: "arthur-gaze-ruby"
    entity: "arthur"
    start: 0.0
    end: 5.0
    look_at: "ruby"
  - id: "arthur-turn-front"
    entity: "arthur"
    start: 8.0
    end: 10.0
    rotation: 0
    easing: "linear"
shots:
  - id: "master"
    shot: 1
    start: 0.0
    end: 12.0
    stage_camera: { target: "center", distance: 10.0, lens: 35mm }
`,
          { id: 'blocking-gaps-and-gaze', duration: 12.0 }
        )
      );

      const fBeforeGap = computeStageFrame(4.999, score);
      expect(fBeforeGap.entitiesById.get('arthur')!.rotationYRad).toBeCloseTo(Math.PI / 2, 2);

      const fInGap = computeStageFrame(6.5, score);
      const arthurGap = fInGap.entitiesById.get('arthur')!;
      expect(arthurGap.position).toEqual({ x: -5, y: 0, z: 0 });
      expect(arthurGap.rotationYRad).toBeCloseTo(Math.PI / 2, 3);
      expect(arthurGap.trailPoints).toEqual([]);
      expect(arthurGap.cueId).toBe('hold:arthur-gaze-ruby');

      const fTurnMid = computeStageFrame(9.0, score);
      expect(fTurnMid.entitiesById.get('arthur')!.rotationYRad).toBeCloseTo(Math.PI / 4, 3);

      const fPost = computeStageFrame(11.0, score);
      const rubyPost = fPost.entitiesById.get('ruby')!;
      expect(rubyPost.position).toEqual({ x: 0, y: 0, z: 5 });
      expect(rubyPost.trailPoints).toEqual([]);
    });
  });
});
