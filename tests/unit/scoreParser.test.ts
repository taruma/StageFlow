import { describe, expect, it } from 'vitest';
import { parseStageScore } from '../../src/core/scoreParser';
import { radToDeg } from '../../src/core/sphericalMath';
import { makeScoreYaml, parseValidScore } from '../helpers/scoreFixtures';

describe('scoreParser — Root YAML Score Parsing, Continuous Chaining & Blocking', () => {
  it('parses human degrees into radians and metric meters in YAML scores', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
stage:
  width: 14
  depth: 12
  observer_camera:
    target: [1, 1.5, -0.5]
    distance: 9.0
    pitch: 30
    yaw: -45
    lens: 24mm
entities:
  - id: "hero"
    label: "Hero"
    kind: "character"
    position: [1, 0, 2]
    rotation: 90
shots:
  - id: "s1"
    shot: 1
    label: "Opening"
    start: 0
    end: 12
    stage_camera:
      target: "hero"
      maneuver: "arc"
      distance: 4.2
      pitch: 15
      yaw: 60
      lens: 50mm
`,
        {
          id: 'unit-test-scene',
          video: 'https://youtu.be/dQw4w9WgXcQ',
          aspectRatio: '2.39:1',
          duration: 12.0,
        }
      )
    );

    expect(score.aspectRatio).toBeCloseTo(2.39, 4);
    expect(score.stage.width).toBe(14);
    expect(radToDeg(score.stage.defaultObserverPose.pitch)).toBeCloseTo(30, 4);
    expect(radToDeg(score.stage.defaultObserverPose.yaw)).toBeCloseTo(-45, 4);
    expect(score.stage.defaultObserverPose.focalLengthMm).toBe(24);
    expect(radToDeg(score.entities[0].rotationYRad)).toBeCloseTo(90, 4);
  });

  it('returns a clean diagnostic error string on invalid YAML syntax without throwing', () => {
    const brokenYaml = `
title: "Unclosed quote
shots: [1, 2
`;
    const result = parseStageScore(brokenYaml);
    expect(result.score).toBeNull();
    expect(result.error).toContain('YAML syntax error');
    expect(result.diagnostics).toBeDefined();
    expect(result.diagnostics!.length).toBeGreaterThan(0);
    expect(result.diagnostics![0].line).toBeGreaterThanOrEqual(1);
    expect(result.diagnostics![0].severity).toBe('error');
  });

  it('parses video as object mapping (src/url + aspect_ratio) and as plain string', () => {
    const score1 = parseValidScore(
      makeScoreYaml(
        `
video:
  src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  aspect_ratio: "16:9"
stage: { width: 10, depth: 10 }
shots:
  - id: "s1"
    shot: 1
    start: 0
    end: 10
`,
        { id: 'video-obj-test', duration: 10 }
      )
    );
    expect(score1.videoUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(score1.aspectRatio).toBeCloseTo(16 / 9, 3);

    const score2 = parseValidScore(
      makeScoreYaml(
        `
video:
  url: "https://youtu.be/dQw4w9WgXcQ"
stage: { width: 10, depth: 10 }
shots:
  - id: "s1"
    shot: 1
    start: 0
    end: 5
`,
        { id: 'video-url-test', duration: 5 }
      )
    );
    expect(score2.videoUrl).toBe('https://youtu.be/dQw4w9WgXcQ');
  });

  it('rejects scores without any film shots in shots: even if observer_shots: is present', () => {
    const yamlWithoutFilmShots = makeScoreYaml(
      `
observer_shots:
  - start: 0
    end: 10
    maneuver: "orbit"
`,
      { id: 'no-film-shots' }
    );
    const { score, error } = parseStageScore(yamlWithoutFilmShots);
    expect(score).toBeNull();
    expect(error).toContain('Score must define at least one shot in "shots:".');
  });

  describe('continuous: true — Opt-In Contiguous Shot Chaining', () => {
    it('chains consecutive shots with omitted start when continuous: true is enabled', () => {
      const { score, error, warning } = parseStageScore(
        makeScoreYaml(
          `
shots:
  - id: "s1"
    end: 6.0
  - id: "s2"
    end: 15.0
  - id: "s3"
    end: 27.0
`,
          { id: 'continuous-chain-test', continuous: true }
        )
      );
      expect(error).toBeNull();
      expect(warning).toBeNull();
      expect(score!.continuous).toBe(true);
      expect(score!.shots).toHaveLength(3);
      expect(score!.shots[0].startSec).toBe(0.0);
      expect(score!.shots[0].endSec).toBe(6.0);
      expect(score!.shots[1].startSec).toBe(6.0);
      expect(score!.shots[1].endSec).toBe(15.0);
      expect(score!.shots[2].startSec).toBe(15.0);
      expect(score!.shots[2].endSec).toBe(27.0);
      expect(score!.durationSec).toBe(27.0);
    });

    it('honors explicit start on shot 1 and mid-sequence gap overrides in continuous mode', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
shots:
  - id: "s1"
    start: 4.0
    end: 10.0
  - id: "s2"
    end: 18.0
  - id: "s3"
    start: 24.0
    end: 30.0
`,
          { id: 'override-test', continuous: true }
        )
      );
      expect(score.shots[0].startSec).toBe(4.0);
      expect(score.shots[0].endSec).toBe(10.0);
      expect(score.shots[1].startSec).toBe(10.0);
      expect(score.shots[1].endSec).toBe(18.0);
      expect(score.shots[2].startSec).toBe(24.0);
      expect(score.shots[2].endSec).toBe(30.0);
    });

    it('clamps endSec to startSec + 0.1 on typo where end is earlier than chained start', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
shots:
  - id: "s1"
    end: 15.0
  - id: "s2"
    end: 8.0
`,
          { id: 'typo-test', continuous: true }
        )
      );
      expect(score.shots[0].startSec).toBe(0.0);
      expect(score.shots[0].endSec).toBe(15.0);
      expect(score.shots[1].startSec).toBe(15.0);
      expect(score.shots[1].endSec).toBeCloseTo(15.1, 4);
    });

    it('emits a non-blocking diagnostic warning when continuous is false and start is omitted on shot 2+', () => {
      const { score, error, warning } = parseStageScore(
        makeScoreYaml(
          `
shots:
  - id: "shot-1"
    end: 6.0
  - id: "shot-2"
    end: 15.0
`,
          { id: 'unchained-test' }
        )
      );
      expect(error).toBeNull();
      expect(score).not.toBeNull();
      expect(warning).toContain('Shot "shot-2" omits "start" (defaulted to 0.0s)');
      expect(score!.shots[0].startSec).toBe(0.0);
      expect(score!.shots[0].endSec).toBe(6.0);
      expect(score!.shots[1].startSec).toBe(0.0);
      expect(score!.shots[1].endSec).toBe(15.0);
    });

    it('keeps observer_shots decoupled and explicit even when continuous: true is declared', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
shots:
  - id: "s1"
    end: 6.0
  - id: "s2"
    end: 15.0
observer_shots:
  - id: "obs-1"
    start: 0.0
    end: 27.0
`,
          { id: 'obs-decoupled-test', continuous: true }
        )
      );
      expect(score.shots[1].startSec).toBe(6.0);
      expect(score.observerShots![0].startSec).toBe(0.0);
      expect(score.observerShots![0].endSec).toBe(27.0);
    });

    it('supports shot-level continuous overrides and hybrid cut/oner configurations', () => {
      const { score, error, warning } = parseStageScore(
        makeScoreYaml(
          `
shots:
  - id: "s1"
    start: 0.0
    end: 4.0
  - id: "s2"
    start: 4.0
    end: 8.0
  - id: "s3"
    continuous: true
    end: 14.0
  - id: "s4"
    start: 14.0
    end: 20.0
`,
          { id: 'hybrid-shot-continuous-test' }
        )
      );
      expect(error).toBeNull();
      expect(warning).toBeNull();
      expect(score!.shots[0].continuous).toBeUndefined();
      expect(score!.shots[2].continuous).toBe(true);
      expect(score!.shots[2].startSec).toBe(8.0);
      expect(score!.shots[2].endSec).toBe(14.0);
    });

    it('allows shot-level continuous: false to override root continuous: true', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
shots:
  - id: "s1"
    end: 5.0
  - id: "s2"
    end: 10.0
  - id: "s3"
    continuous: false
    start: 12.0
    end: 18.0
`,
          { id: 'shot-override-test', continuous: true }
        )
      );
      expect(score.continuous).toBe(true);
      expect(score.shots[1].startSec).toBe(5.0);
      expect(score.shots[2].continuous).toBe(false);
      expect(score.shots[2].startSec).toBe(12.0);
    });

    it('auto-chains observer_shots timestamps when root continuous: true is declared', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
shots:
  - id: "s1"
    end: 20.0
observer_shots:
  - id: "obs-1"
    end: 8.0
  - id: "obs-2"
    end: 15.0
  - id: "obs-3"
    start: 17.0
    end: 20.0
`,
          { id: 'obs-continuous-root', continuous: true }
        )
      );
      expect(score.observerShots).toHaveLength(3);
      expect(score.observerShots![0].startSec).toBe(0.0);
      expect(score.observerShots![0].endSec).toBe(8.0);
      expect(score.observerShots![1].startSec).toBe(8.0);
      expect(score.observerShots![1].endSec).toBe(15.0);
      expect(score.observerShots![2].startSec).toBe(17.0);
      expect(score.observerShots![2].endSec).toBe(20.0);
    });

    it('supports cue-level continuous: true on observer_shots when root continuous is false', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
shots:
  - id: "s1"
    start: 0.0
    end: 10.0
  - id: "s2"
    start: 10.0
    end: 20.0
observer_shots:
  - id: "obs-1"
    start: 0.0
    end: 7.5
  - id: "obs-2"
    continuous: true
    end: 14.0
  - id: "obs-3"
    continuous: false
    start: 16.0
    end: 20.0
`,
          { id: 'obs-cue-continuous' }
        )
      );
      expect(score.observerShots).toHaveLength(3);
      expect(score.observerShots![0].startSec).toBe(0.0);
      expect(score.observerShots![0].endSec).toBe(7.5);
      expect(score.observerShots![1].continuous).toBe(true);
      expect(score.observerShots![1].startSec).toBe(7.5);
      expect(score.observerShots![1].endSec).toBe(14.0);
      expect(score.observerShots![2].continuous).toBe(false);
      expect(score.observerShots![2].startSec).toBe(16.0);
      expect(score.observerShots![2].endSec).toBe(20.0);
    });

    it('emits a non-blocking diagnostic warning when continuous is false and start is omitted on observer_shot 2+', () => {
      const { score, error, warning } = parseStageScore(
        makeScoreYaml(
          `
shots:
  - id: "s1"
    start: 0.0
    end: 10.0
observer_shots:
  - id: "obs-1"
    start: 0.0
    end: 5.0
  - id: "obs-2"
    end: 10.0
`,
          { id: 'obs-warning-test' }
        )
      );
      expect(error).toBeNull();
      expect(score).not.toBeNull();
      expect(warning).toContain('Observer shot "obs-2" omits "start" (defaulted to 0.0s)');
      expect(score!.observerShots![1].startSec).toBe(0.0);
    });
  });

  describe('Root Blocking, Legacy Overrides & Metadata Parsing', () => {
    it('parses root-level blocking: cues in both single-entity and multi-entity beat formats', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
entities:
  - id: "arthur"
    label: "Arthur (Lead)"
    kind: "character"
    position: [-10, 0, 0]
    rotation: 90
  - id: "ruby"
    label: "Ruby (Partner)"
    kind: "character"
    position: [6, 0, 0]
    rotation: -90
blocking:
  - id: "arthur-cross"
    label: "Room Cross"
    entity: "Arthur (Lead)"
    start: 0.0
    end: 9.0
    from: [-10, 0, 0]
    position: [2, 0, 0]
    rotation: 45
    look_at: "ruby"
    easing: "cruise"
    highlighted: true
    visible: true
    note: "Walks across stage"
  - id: "beat-2"
    label: "Mutual Turn"
    start: 10.0
    end: 18.0
    entities:
      arthur:
        rotation: 0
        easing: "smooth"
      ruby:
        position: [3, 0, 1]
        look_at: "arthur"
        easing: "ease-out"
        visible: false
shots:
  - id: "shot-1"
    shot: 1
    start: 0.0
    end: 6.0
    stage_camera:
      target: "arthur"
      lens: 35mm
`,
          { id: 'blocking-parse-test' }
        )
      );

      expect(score.blocking).toHaveLength(3);
      expect(score.durationSec).toBe(18.0);

      const c1 = score.blocking![0];
      expect(c1.id).toBe('arthur-cross');
      expect(c1.label).toBe('Room Cross');
      expect(c1.entityId).toBe('arthur');
      expect(c1.startSec).toBe(0.0);
      expect(c1.endSec).toBe(9.0);
      expect(c1.fromPosition).toEqual({ x: -10, y: 0, z: 0 });
      expect(c1.position).toEqual({ x: 2, y: 0, z: 0 });
      expect(radToDeg(c1.rotationYRad!)).toBeCloseTo(45, 4);
      expect(c1.lookAt).toBe('ruby');
      expect(c1.easing).toBe('cruise');
      expect(c1.highlighted).toBe(true);
      expect(c1.visible).toBe(true);
      expect(c1.note).toBe('Walks across stage');

      const c2 = score.blocking![1];
      expect(c2.id).toBe('beat-2:arthur');
      expect(c2.entityId).toBe('arthur');
      expect(c2.startSec).toBe(10.0);
      expect(c2.endSec).toBe(18.0);
      expect(radToDeg(c2.rotationYRad!)).toBeCloseTo(0, 4);
      expect(c2.easing).toBe('smooth');

      const c3 = score.blocking![2];
      expect(c3.id).toBe('beat-2:ruby');
      expect(c3.entityId).toBe('ruby');
      expect(c3.position).toEqual({ x: 3, y: 0, z: 1 });
      expect(c3.lookAt).toBe('arthur');
      expect(c3.easing).toBe('ease-out');
      expect(c3.visible).toBe(false);
    });

    it('parses duration, cut flag, and auto-chains timestamps for continuous blocking cues', () => {
      const { score, error, warning } = parseStageScore(
        makeScoreYaml(
          `
entities:
  - id: "ruby"
    kind: "character"
    position: [0, 0, 0]
  - id: "evan"
    kind: "character"
    position: [-2, 0, 0]
shots:
  - id: "s1"
    start: 0
    end: 10
blocking:
  - id: "beat-1"
    start: 0.0
    duration: 4.0
    entities:
      ruby: { position: [2, 0, 0] }
      evan: { position: [0, 0, 0] }
  - id: "beat-2"
    dur: 2.5
    entities:
      ruby: { cut: true, position: [10, 0, 0] }
      evan: { position: [1, 0, 0] }
  - id: "beat-3-evan"
    actor: "evan"
    duration: 3.0
    position: [5, 0, 0]
  - id: "beat-4-ruby"
    actor: "ruby"
    duration: 2.0
    cut: true
    position: [-8, 0, 0]
`,
          { id: 'continuous-blocking-test', continuous: true }
        )
      );
      expect(error).toBeNull();
      expect(warning).toBeNull();

      const blocking = score!.blocking!;
      expect(blocking).toHaveLength(6);

      const b1Ruby = blocking.find((b) => b.id === 'beat-1:ruby')!;
      expect(b1Ruby.startSec).toBe(0.0);
      expect(b1Ruby.endSec).toBe(4.0);
      expect(b1Ruby.duration).toBe(4.0);
      expect(b1Ruby.cut).toBeUndefined();

      const b2Ruby = blocking.find((b) => b.id === 'beat-2:ruby')!;
      expect(b2Ruby.startSec).toBe(4.0);
      expect(b2Ruby.endSec).toBe(6.5);
      expect(b2Ruby.cut).toBe(true);

      const b2Evan = blocking.find((b) => b.id === 'beat-2:evan')!;
      expect(b2Evan.startSec).toBe(4.0);
      expect(b2Evan.endSec).toBe(6.5);

      const b3Evan = blocking.find((b) => b.id === 'beat-3-evan')!;
      expect(b3Evan.startSec).toBe(6.5);
      expect(b3Evan.endSec).toBe(9.5);
      expect(b3Evan.duration).toBe(3.0);

      const b4Ruby = blocking.find((b) => b.id === 'beat-4-ruby')!;
      expect(b4Ruby.startSec).toBe(9.5);
      expect(b4Ruby.endSec).toBe(11.5);
      expect(b4Ruby.duration).toBe(2.0);
      expect(b4Ruby.cut).toBe(true);
    });

    it('emits diagnostic warning when blocking cue omits start outside continuous mode', () => {
      const { score, error, warning } = parseStageScore(
        makeScoreYaml(
          `
shots:
  - id: "s1"
    start: 0
    end: 10
entities:
  - id: "ruby"
    kind: "character"
blocking:
  - id: "b1"
    actor: "ruby"
    start: 0.0
    end: 3.0
  - id: "b2"
    actor: "ruby"
    end: 6.0
`,
          { id: 'unchained-blocking-test' }
        )
      );
      expect(error).toBeNull();
      expect(score).not.toBeNull();
      expect(warning).toContain('Blocking cue "b2" omits "start" (defaulted to 0.0s)');
    });

    it('parses cut flag on shot-level entity overrides', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
entities:
  - id: "ruby"
    kind: "character"
shots:
  - id: "shot-1"
    start: 0
    end: 5
    entities:
      ruby:
        position: [2, 0, 0]
  - id: "shot-2"
    start: 5
    end: 10
    entities:
      ruby:
        cut: true
        position: [-10, 0, 0]
`,
          { id: 'shot-cut-test' }
        )
      );
      expect(score.shots[1].entities.ruby.cut).toBe(true);
    });

    it('parses blocking cue and legacy shot dimension overrides', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
entities:
  - id: "actor"
    label: "Actor"
    kind: "character"
    position: [0, 0, 0]
blocking:
  - id: "cue-crouch"
    entity: "actor"
    start: 0
    end: 3
    from_size: [0.52, 1.75, 0.52]
    size: [0.60, 1.10, 0.60]
  - id: "cue-expand"
    beat: 2
    start: 3
    end: 6
    entities:
      actor:
        height: 1.80
        width: 0.55
        from_height: 1.10
shots:
  - id: "shot-legacy"
    shot: 1
    start: 6
    end: 12
    entities:
      actor:
        size: [0.52, 1.75, 0.52]
`,
          { id: 'blocking-dimensions-test', duration: 12.0 }
        )
      );

      expect(score.blocking).toHaveLength(2);
      const cue1 = score.blocking![0];
      expect(cue1.fromWidth).toBeCloseTo(0.52, 3);
      expect(cue1.fromHeight).toBeCloseTo(1.75, 3);
      expect(cue1.fromDepth).toBeCloseTo(0.52, 3);
      expect(cue1.width).toBeCloseTo(0.6, 3);
      expect(cue1.height).toBeCloseTo(1.1, 3);
      expect(cue1.depth).toBeCloseTo(0.6, 3);

      const cue2 = score.blocking![1];
      expect(cue2.fromHeight).toBeCloseTo(1.1, 3);
      expect(cue2.height).toBeCloseTo(1.8, 3);
      expect(cue2.width).toBeCloseTo(0.55, 3);

      const shotEnt = score.shots[0].entities?.actor;
      expect(shotEnt).toBeDefined();
      expect(shotEnt?.width).toBeCloseTo(0.52, 3);
      expect(shotEnt?.height).toBeCloseTo(1.75, 3);
      expect(shotEnt?.depth).toBeCloseTo(0.52, 3);
    });

    it('parses root-level description and notes into score.description', () => {
      const score1 = parseValidScore(
        makeScoreYaml(
          `
description: "Directorial overview of the staging."
shots:
  - id: "s1"
    start: 0
    end: 10
`,
          { id: 'desc-test', duration: 10 }
        )
      );
      expect(score1.description).toBe('Directorial overview of the staging.');

      const score2 = parseValidScore(
        makeScoreYaml(
          `
notes: "Staging notes fallback."
shots:
  - id: "s1"
    start: 0
    end: 10
`,
          { id: 'notes-test', duration: 10 }
        )
      );
      expect(score2.description).toBe('Staging notes fallback.');
    });

    it('parses scene-wide metadata block with strings, lists, and nested objects', () => {
      const score = parseValidScore(
        makeScoreYaml(
          `
metadata:
  music: "Max Richter — On The Nature of Daylight"
  camera_package:
    camera: "ARRI Alexa Mini LF"
    stabilizer: "Steadicam M-2"
  production_notes:
    - "Continuous clockwise arc around conversational axis"
    - "Maintain eye-level framing on Dave"
shots:
  - id: "s1"
    start: 0
    end: 10
`,
          { id: 'meta-test', duration: 10 }
        )
      );
      expect(score.metadata?.music).toBe('Max Richter — On The Nature of Daylight');
      expect(score.metadata?.camera_package).toEqual({
        camera: 'ARRI Alexa Mini LF',
        stabilizer: 'Steadicam M-2',
      });
      expect(score.metadata?.production_notes).toEqual([
        'Continuous clockwise arc around conversational axis',
        'Maintain eye-level framing on Dave',
      ]);
    });

    it('handles omitted, empty, or non-object metadata gracefully', () => {
      const baseShots = `
shots:
  - id: "s1"
    start: 0
    end: 10
`;
      expect(parseValidScore(makeScoreYaml(baseShots, { id: 'no-meta', duration: 10 })).metadata).toBeUndefined();
      expect(
        parseValidScore(makeScoreYaml(`metadata: {}\n${baseShots}`, { id: 'empty-meta', duration: 10 }))
          .metadata
      ).toBeUndefined();
      expect(
        parseValidScore(
          makeScoreYaml(`metadata: "Not an object"\n${baseShots}`, { id: 'scalar-meta', duration: 10 })
        ).metadata
      ).toBeUndefined();
    });
  });
});
