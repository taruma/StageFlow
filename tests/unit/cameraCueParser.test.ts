import { describe, expect, it } from 'vitest';
import {
  parseBaseSphericalPose,
  parseCameraCueSpec,
  parseObserverShots,
  parseStageCameraCueSpec,
  resolveStageCamEntityTarget,
} from '../../src/core/cameraCueParser';
import { DEFAULT_OBSERVER_POSE } from '../../src/core/constants';
import { radToDeg } from '../../src/core/sphericalMath';
import { makeEntityDef, makeScoreYaml, parseValidScore } from '../helpers/scoreFixtures';

describe('cameraCueParser — Camera Poses, Observer Shots, Optics & Baseline Targets', () => {
  it('parses base spherical camera pose and resolves entity targets', () => {
    expect(parseCameraCueSpec({ maneuver: 'dolly' }, 50)?.maneuver).toBe('dolly');
    expect(parseObserverShots([{ start: 0, end: 5 }], 35)).toHaveLength(1);

    const pose = parseBaseSphericalPose(
      { target: [1, 2, 3], distance: 5, pitch: 15, yaw: 45, roll: 10, lens: '35mm' },
      DEFAULT_OBSERVER_POSE
    );
    expect(pose.distance).toBe(5);
    expect(pose.focalLengthMm).toBe(35);
    expect(pose.target).toEqual({ x: 1, y: 2, z: 3 });

    const entities = [
      makeEntityDef({
        id: 'actor',
        label: 'Lead Actor',
        position: { x: 2, y: 0, z: 3 },
        color: '#fff',
      }),
    ];
    const stageCamPose = { ...DEFAULT_OBSERVER_POSE, target: { x: 0, y: 0, z: 0 } };
    resolveStageCamEntityTarget(
      { target: 'actor', target_offset: [0, 0.5, 0] },
      stageCamPose,
      entities
    );
    expect(stageCamPose.target.x).toBe(2);
    expect(stageCamPose.target.y).toBeCloseTo(0 + 1.75 * 0.9 + 0.5, 4);
    expect(stageCamPose.target.z).toBe(3);
  });

  it('parses stage camera cue specs with frustum depth and show_path options', () => {
    const spec = parseStageCameraCueSpec({
      maneuver: 'arc',
      frustum_depth: 4.5,
      frustum_color: '#38bdf8',
      show_path: true,
      waypoints: [{ target: 'center', at: 0.5 }],
    });
    expect(spec).toBeDefined();
    expect(spec!.maneuver).toBe('arc');
    expect(spec!.frustumDepth).toBe(4.5);
    expect(spec!.frustumColor).toBe('#38bdf8');
    expect(spec!.showPath).toBe(true);
    expect(spec!.waypoints).toHaveLength(1);
  });

  it('defaults breathe to 1.25 for recoil maneuver and resolves stage preset targets in baseline cameras', () => {
    const recoilSpec = parseCameraCueSpec({ maneuver: 'recoil' }, 50);
    expect(recoilSpec).toBeDefined();
    expect(recoilSpec!.breathe).toBe(1.25);

    const arcSpec = parseCameraCueSpec({ maneuver: 'arc' }, 50);
    expect(arcSpec!.breathe).toBe(1.12);

    const dollySpec = parseCameraCueSpec({ maneuver: 'dolly' }, 50);
    expect(dollySpec!.breathe).toBe(1.0);

    const centerPose = { ...DEFAULT_OBSERVER_POSE, target: { x: 9, y: 9, z: 9 } };
    resolveStageCamEntityTarget(
      { target: 'center', target_offset: [0.5, 0.25, -0.5] },
      centerPose,
      []
    );
    expect(centerPose.target).toEqual({ x: 0.5, y: 1.25, z: -0.5 });
  });

  it('parses root-level observer_shots with flattened camera properties into ObserverShotCue[]', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
stage:
  width: 10
  depth: 10
  observer_camera:
    target: [0, 1.0, 0]
    distance: 8.0
    pitch: 25
    yaw: 30
    lens: 35mm
shots:
  - id: "film-shot-1"
    shot: 1
    start: 0
    end: 10
    stage_camera: { target: [0, 1.0, 0], lens: 50mm }
  - id: "film-shot-2"
    shot: 2
    start: 10
    end: 20
    stage_camera: { target: [0, 1.0, 0], lens: 85mm }
observer_shots:
  - id: "obs-01"
    label: "Continuous Sweep"
    start: 0.0
    end: 12.0
    maneuver: "orbit"
    easing: "cruise"
    target: [0, 1.2, 0]
    distance: 9.5
    pitch: 32
    yaw_start: 15
    yaw_end: 105
    lens: 28mm
  - id: "obs-02"
    start: 12.0
    end: 20.0
    maneuver: "dolly"
    distance: 6.0
    pitch: 45
    yaw: 120
    lens: 50mm
`,
        { id: 'decoupled-observer-test', duration: 20.0 }
      )
    );

    expect(score.observerShots).toHaveLength(2);

    const obs1 = score.observerShots![0];
    expect(obs1.id).toBe('obs-01');
    expect(obs1.label).toBe('Continuous Sweep');
    expect(obs1.startSec).toBe(0.0);
    expect(obs1.endSec).toBe(12.0);
    expect(obs1.camera.maneuver).toBe('orbit');
    expect(obs1.camera.easing).toBe('cruise');
    expect(obs1.camera.distance).toBe(9.5);
    expect(radToDeg(obs1.camera.pitchRad!)).toBeCloseTo(32, 4);
    expect(radToDeg(obs1.camera.yawStartRad!)).toBeCloseTo(15, 4);
    expect(radToDeg(obs1.camera.yawEndRad!)).toBeCloseTo(105, 4);
    expect(obs1.camera.focalLengthMm).toBe(28);

    const obs2 = score.observerShots![1];
    expect(obs2.id).toBe('obs-02');
    expect(obs2.startSec).toBe(12.0);
    expect(obs2.endSec).toBe(20.0);
    expect(obs2.camera.maneuver).toBe('dolly');
    expect(obs2.camera.distance).toBe(6.0);
    expect(radToDeg(obs2.camera.pitchRad!)).toBeCloseTo(45, 4);
    expect(radToDeg(obs2.camera.yawRad!)).toBeCloseTo(120, 4);
    expect(obs2.camera.focalLengthMm).toBe(50);
  });

  it('parses camera roll parameters and dutch angle aliases in degrees into radians', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
stage:
  observer_camera:
    target: [0, 1, 0]
    roll: 12deg
shots:
  - id: "shot-1"
    shot: 1
    start: 0
    end: 5
    stage_camera:
      target: [0, 1, 0]
      roll: 15
  - id: "shot-2"
    shot: 2
    start: 5
    end: 10
    stage_camera:
      target: [0, 1, 0]
      roll_start: -10
      roll_end: 25deg
      roll_delta: 35deg
`,
        { id: 'roll-parse-test', duration: 10.0 }
      )
    );

    expect(radToDeg(score.stage.defaultObserverPose.roll)).toBeCloseTo(12, 4);
    expect(radToDeg(score.shots[0].stageCamera!.rollRad!)).toBeCloseTo(15, 4);
    expect(radToDeg(score.shots[1].stageCamera!.rollStartRad!)).toBeCloseTo(-10, 4);
    expect(radToDeg(score.shots[1].stageCamera!.rollEndRad!)).toBeCloseTo(25, 4);
    expect(radToDeg(score.shots[1].stageCamera!.rollDeltaRad!)).toBeCloseTo(35, 4);
  });

  it('parses target_offset, target_offset_start, target_offset_end, and spline waypoint target_offset in meters', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
entities:
  - id: "arthur"
    label: "Arthur"
    kind: "character"
    position: [-5, 0, 0]
shots:
  - id: "shot-1"
    shot: 1
    start: 0
    end: 4
    stage_camera:
      target: "arthur"
      target_offset: [0.25, 0.35, -0.1]
  - id: "shot-2"
    shot: 2
    start: 4
    end: 8
    stage_camera:
      target: "arthur"
      target_offset_start: [0, -1.1, 0]
      target_offset_end: [0, 0.25, 0]
  - id: "shot-3"
    shot: 3
    start: 8
    end: 12
    stage_camera:
      maneuver: "spline"
      waypoints:
        - target: "arthur"
          target_offset: [0, 0.4, 0]
          distance: 3.0
`,
        { id: 'target-offset-parse-test', duration: 12.0 }
      )
    );

    expect(score.shots[0].stageCamera!.targetOffset).toEqual({ x: 0.25, y: 0.35, z: -0.1 });
    expect(score.shots[1].stageCamera!.targetOffsetStart).toEqual({ x: 0, y: -1.1, z: 0 });
    expect(score.shots[1].stageCamera!.targetOffsetEnd).toEqual({ x: 0, y: 0.25, z: 0 });
    expect(score.shots[2].stageCamera!.waypoints?.[0].targetOffset).toEqual({ x: 0, y: 0.4, z: 0 });
  });

  it('parses root optics config, cue-level focus/DoF, rack focus, waypoint focus, and flat shot camera overrides (Rule 2.6)', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
optics:
  dof_blur: true
  dof: "medium"
  aperture: "f/4.0"
entities:
  - id: "alice"
    kind: "character"
    position: [-2, 0, 1]
  - id: "bob"
    kind: "character"
    position: [2, 0, -2]
shots:
  - id: "shot-1-nested"
    start: 0
    end: 4
    stage_camera:
      target: "center"
      focus: "alice"
      dof: "shallow"
      aperture: "f/2.0"
  - id: "shot-2-rack"
    start: 4
    end: 8
    stage_camera:
      target: "center"
      focus_start: "alice"
      focus_end: "bob"
      aperture_start: 2.0
      aperture_end: 8.0
  - id: "shot-3-flat-polymorphic"
    start: 8
    end: 12
    focus: "4.5m"
    dof: "shallow"
    stage_camera:
      target: "alice"
  - id: "shot-4-spline-waypoints"
    start: 12
    end: 16
    stage_camera:
      maneuver: "spline"
      waypoints:
        - target: "alice"
          focus: "alice"
          dof: "shallow"
        - target: "bob"
          focus: "bob"
          aperture: 5.6
`,
        { id: 'dof-parse-test' }
      )
    );

    expect(score.optics).toEqual({
      dofBlur: true,
      defaultDof: 'medium',
      defaultApertureFStop: 4.0,
    });

    const s1Cam = score.shots[0].stageCamera!;
    expect(s1Cam.focus).toBe('alice');
    expect(s1Cam.dof).toBe('shallow');
    expect(s1Cam.apertureFStop).toBe(2.0);

    const s2Cam = score.shots[1].stageCamera!;
    expect(s2Cam.focusStart).toBe('alice');
    expect(s2Cam.focusEnd).toBe('bob');
    expect(s2Cam.apertureStartFStop).toBe(2.0);
    expect(s2Cam.apertureEndFStop).toBe(8.0);

    const s3Cam = score.shots[2].stageCamera!;
    expect(s3Cam.focusDistanceM).toBeCloseTo(4.5, 4);
    expect(s3Cam.dof).toBe('shallow');

    const s4Wps = score.shots[3].stageCamera!.waypoints!;
    expect(s4Wps).toHaveLength(2);
    expect(s4Wps[0].focus).toBe('alice');
    expect(s4Wps[0].dof).toBe('shallow');
    expect(s4Wps[1].focus).toBe('bob');
    expect(s4Wps[1].apertureFStop).toBe(5.6);
  });

  it('parses stage.gridStep, flat root optics aliases, and flat shot-root f_stop/dof start/end ramps', () => {
    const scoreA = parseValidScore(
      makeScoreYaml(
        `
blur: true
depth_of_field: "shallow"
f_stop: 2.0
stage:
  width: 12
  depth: 12
  gridStep: 0.5
shots:
  - id: "s1"
    start: 0
    end: 4
    f_stop_start: 1.4
    f_stop_end: 8.0
`,
        { id: 'alias-parity-a' }
      )
    );

    expect(scoreA.stage.gridStep).toBe(0.5);
    expect(scoreA.optics).toEqual({
      dofBlur: true,
      defaultDof: 'shallow',
      defaultApertureFStop: 2.0,
    });
    expect(scoreA.shots[0].stageCamera?.apertureStartFStop).toBeCloseTo(1.4, 4);
    expect(scoreA.shots[0].stageCamera?.apertureEndFStop).toBeCloseTo(8.0, 4);

    const scoreB = parseValidScore(
      makeScoreYaml(
        `
depthOfField: "medium"
fStop: "f/4"
shots:
  - id: "s1"
    start: 0
    end: 4
    dof_start: "shallow"
    dof_end: "deep"
    stage_camera:
      target: [0, 1, 0]
      aperture_end: 11.0
`,
        { id: 'alias-parity-b' }
      )
    );

    expect(scoreB.optics).toEqual({
      dofBlur: false,
      defaultDof: 'medium',
      defaultApertureFStop: 4.0,
    });
    expect(scoreB.shots[0].stageCamera?.apertureStartFStop).toBeCloseTo(2.8, 4);
    expect(scoreB.shots[0].stageCamera?.apertureEndFStop).toBeCloseTo(11.0, 4);
  });

  it('rotates baseline stage.stage_camera.target when pointing to an entity with base pitch/roll', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
stage:
  stage_camera:
    target: "prone_hero"
    distance: 4
    pitch: 15
    yaw: 0
entities:
  - id: "prone_hero"
    kind: "character"
    position: [1.0, 0.2, -0.5]
    height: 1.8
    rotation: 90
    pitch: 90
    roll: 0
shots:
  - id: "s1"
    start: 0
    end: 2
`,
        { id: 'baseline-tilted-target' }
      )
    );

    // Anchor offset (0, 1.8 * 0.9 = 1.62, 0) tilted pitch=+90deg, yaw=+90deg -> world (+1.62, 0, 0)
    const target = score.stage.defaultStageCameraPose.target;
    expect(target.x).toBeCloseTo(1.0 + 1.62, 4);
    expect(target.y).toBeCloseTo(0.2, 4);
    expect(target.z).toBeCloseTo(-0.5, 4);
  });

  it('resolves dot-notation sub-anchors on baseline stage.stage_camera and stage.observer_camera (#19)', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
stage:
  stage_camera:
    target: "hero_a.shoulder_l"
    distance: 3.0
    pitch: 10
    yaw: 0
  observer_camera:
    target: ["hero_a.feet", "crate.top"]
    distance: 6.0
    pitch: 25
    yaw: 30
entities:
  - id: "hero_a"
    kind: "character"
    position: [2.0, 0.0, 1.0]
    width: 0.6
    height: 2.0
    rotation: 0
  - id: "crate"
    kind: "prop"
    position: [-2.0, 0.0, -1.0]
    height: 1.0
shots:
  - id: "s1"
    start: 0
    end: 2
`,
        { id: 'baseline-sub-anchor' }
      )
    );

    // hero_a.shoulder_l: [2.0 + 0.40 * 0.6, 0.77 * 2.0, 1.0] = [2.24, 1.54, 1.0]
    const stageTarget = score.stage.defaultStageCameraPose.target;
    expect(stageTarget.x).toBeCloseTo(2.24, 4);
    expect(stageTarget.y).toBeCloseTo(1.54, 4);
    expect(stageTarget.z).toBeCloseTo(1.0, 4);

    // observer_camera centroid of hero_a.feet [2.0, 0.1, 1.0] and crate.top [-2.0, 1.0, -1.0] = [0.0, 0.55, 0.0]
    const obsTarget = score.stage.defaultObserverPose.target;
    expect(obsTarget.x).toBeCloseTo(0.0, 4);
    expect(obsTarget.y).toBeCloseTo(0.55, 4);
    expect(obsTarget.z).toBeCloseTo(0.0, 4);
  });

  it('applies target_offset on baseline stage.stage_camera for sub-anchors, arrays, and unmatched strings (#19)', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
stage:
  stage_camera:
    target: "hero_a.chest"
    target_offset: [0.3, 0.2, -0.4]
  observer_camera:
    target: "nonexistent_target"
    target_offset: [1.0, 0.5, -1.0]
entities:
  - id: "hero_a"
    kind: "character"
    position: [2.0, 0.0, 1.0]
    width: 0.6
    height: 2.0
    rotation: 0
shots:
  - id: "s1"
    start: 0
    end: 2
`,
        { id: 'baseline-offset-sub-anchor' }
      )
    );

    const stageTarget = score.stage.defaultStageCameraPose.target;
    expect(stageTarget.x).toBeCloseTo(2.3, 4);
    expect(stageTarget.y).toBeCloseTo(1.7, 4);
    expect(stageTarget.z).toBeCloseTo(0.6, 4);

    // Unmatched observer target falls back to DEFAULT_OBSERVER_POSE.target [0, 1.0, 0] + offset
    const obsTarget = score.stage.defaultObserverPose.target;
    expect(obsTarget.x).toBeCloseTo(1.0, 4);
    expect(obsTarget.y).toBeCloseTo(1.5, 4);
    expect(obsTarget.z).toBeCloseTo(-1.0, 4);
  });
});
