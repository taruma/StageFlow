import { describe, expect, it } from 'vitest';
import {
  normalizeCameraEasing,
  normalizeCameraManeuver,
  normalizeEntityKind,
  normalizeEntityShape,
  normalizeEntityStyle,
  parseAngleToRad,
  parseEntityPivotRatio,
  parseLensFocalLengthMm,
  parseOptionalVec3,
  parseTargetOrVec3,
  parseVec3,
} from '../../src/core/scorePrimitives';
import { radToDeg } from '../../src/core/sphericalMath';
import { makeScoreYaml, parseValidScore } from '../helpers/scoreFixtures';

describe('scorePrimitives — Vector, Angle, Enum, Dimension & Pivot Normalizers', () => {
  it('correctly parses vector, angle, lens, and target primitives and fallbacks', () => {
    expect(parseAngleToRad('45deg')).toBeCloseTo(Math.PI / 4, 4);
    expect(parseLensFocalLengthMm('35mm')).toBe(35);
    expect(parseVec3([1, 2, 3])).toEqual({ x: 1, y: 2, z: 3 });
    expect(parseVec3({ x: 4, y: 5, z: 6 })).toEqual({ x: 4, y: 5, z: 6 });
    expect(parseVec3('invalid', { x: 0, y: 1, z: 2 })).toEqual({ x: 0, y: 1, z: 2 });
    expect(parseOptionalVec3([10, 20, 30])).toEqual({ x: 10, y: 20, z: 30 });
    expect(parseOptionalVec3(null)).toBeUndefined();
    expect(parseTargetOrVec3('hero')).toBe('hero');
    expect(parseTargetOrVec3([0, 1, 0])).toEqual({ x: 0, y: 1, z: 0 });
    expect(parseTargetOrVec3('   ')).toBeUndefined();
  });

  it('normalizes enums with case-insensitivity and aliases', () => {
    expect(normalizeCameraManeuver('turntable')).toBe('orbit');
    expect(normalizeCameraManeuver('push')).toBe('dolly');
    expect(normalizeCameraManeuver('unknown')).toBe('dolly');
    expect(normalizeCameraEasing('ramp-up')).toBe('accel');
    expect(normalizeCameraEasing('decel')).toBe('deccel');
    expect(normalizeCameraEasing('unknown')).toBe('smooth');
    expect(normalizeEntityKind('prop')).toBe('prop');
    expect(normalizeEntityKind('marker')).toBe('marker');
    expect(normalizeEntityKind('unknown')).toBe('character');

    // Prop shapes and aliases
    expect(normalizeEntityShape('prop', 'box')).toBe('box');
    expect(normalizeEntityShape('prop', undefined)).toBe('box');
    expect(normalizeEntityShape('prop', 'sphere')).toBe('sphere');
    expect(normalizeEntityShape('prop', 'ball')).toBe('sphere');
    expect(normalizeEntityShape('prop', 'cylinder')).toBe('cylinder');
    expect(normalizeEntityShape('prop', 'can')).toBe('cylinder');
    expect(normalizeEntityShape('prop', 'capsule')).toBe('capsule');
    expect(normalizeEntityShape('prop', 'pill')).toBe('capsule');

    // Marker shapes and aliases
    expect(normalizeEntityShape('marker', 'x')).toBe('x');
    expect(normalizeEntityShape('marker', undefined)).toBe('x');
    expect(normalizeEntityShape('marker', 't')).toBe('t');
    expect(normalizeEntityShape('marker', 't-mark')).toBe('t');
    expect(normalizeEntityShape('marker', 'circle')).toBe('circle');
    expect(normalizeEntityShape('marker', 'ring')).toBe('circle');
    expect(normalizeEntityShape('marker', 'puck')).toBe('puck');
    expect(normalizeEntityShape('marker', 'disc')).toBe('puck');

    // Entity presentation styles & aliases
    expect(normalizeEntityStyle('character', undefined)).toBe('mannequin');
    expect(normalizeEntityStyle('character', 'mannequin')).toBe('mannequin');
    expect(normalizeEntityStyle('character', 'edges')).toBe('edges');
    expect(normalizeEntityStyle('character', 'hologram')).toBe('edges');
    expect(normalizeEntityStyle('character', 'cad')).toBe('edges');
    expect(normalizeEntityStyle('character', 'silhouette')).toBe('silhouette');
    expect(normalizeEntityStyle('character', 'ink')).toBe('silhouette');
    expect(normalizeEntityStyle('character', 'wireframe')).toBe('wireframe');
    expect(normalizeEntityStyle('character', 'wire')).toBe('wireframe');

    expect(normalizeEntityStyle('prop', undefined)).toBe('edges');
    expect(normalizeEntityStyle('prop', 'edges')).toBe('edges');
    expect(normalizeEntityStyle('prop', 'glass')).toBe('glass');
    expect(normalizeEntityStyle('prop', 'ghost')).toBe('glass');
    expect(normalizeEntityStyle('prop', 'translucent')).toBe('glass');
    expect(normalizeEntityStyle('prop', 'solid')).toBe('solid');
    expect(normalizeEntityStyle('prop', 'opaque')).toBe('solid');
    expect(normalizeEntityStyle('prop', 'wireframe')).toBe('wireframe');

    expect(normalizeEntityStyle('marker', undefined)).toBe('tape');
    expect(normalizeEntityStyle('marker', 'tape')).toBe('tape');
    expect(normalizeEntityStyle('marker', 'glow')).toBe('glow');
    expect(normalizeEntityStyle('marker', 'pulse')).toBe('glow');
    expect(normalizeEntityStyle('marker', 'beacon')).toBe('beacon');
    expect(normalizeEntityStyle('marker', 'pin')).toBe('beacon');
  });

  it('normalizes entity kind aliases (actor, person, set, furniture, item, object, spike, mark)', () => {
    expect(normalizeEntityKind('actor')).toBe('character');
    expect(normalizeEntityKind('person')).toBe('character');
    expect(normalizeEntityKind('set')).toBe('prop');
    expect(normalizeEntityKind('furniture')).toBe('prop');
    expect(normalizeEntityKind('item')).toBe('prop');
    expect(normalizeEntityKind('object')).toBe('prop');
    expect(normalizeEntityKind('spike')).toBe('marker');
    expect(normalizeEntityKind('mark')).toBe('marker');
  });

  it('parses entity style property for characters, props, and markers in YAML score', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
entities:
  - id: "actor"
    kind: "character"
    style: "silhouette"
  - id: "table"
    kind: "prop"
    shape: "box"
    style: "solid"
  - id: "halo"
    kind: "marker"
    shape: "circle"
    style: "glow"
shots:
  - id: "s1"
    start: 0
    end: 2
`,
        { id: 'style-test', title: 'Entity Style Test' }
      )
    );
    expect(score.entities[0].style).toBe('silhouette');
    expect(score.entities[1].style).toBe('solid');
    expect(score.entities[2].style).toBe('glow');
  });

  it('parses entity size vectors, explicit dimensions, and derives bounding radius', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
entities:
  - id: "table"
    label: "Dining Table"
    kind: "prop"
    shape: "box"
    position: [0, 0, 0]
    size: [2.2, 0.85, 0.9]
  - id: "pillar"
    label: "Column Pillar"
    kind: "prop"
    shape: "cylinder"
    position: [3, 0, 0]
    size: [0.6, 3.2, 0.6]
  - id: "rug"
    label: "Area Rug"
    kind: "prop"
    shape: "box"
    position: [0, 0, -5]
    size: [2.0, 3.0]
  - id: "bench"
    label: "Park Bench"
    kind: "prop"
    shape: "box"
    position: [-3, 0, 0]
    size: [1.8, 0.5, 0.6]
    width: 2.0
  - id: "square_crate"
    label: "Square Crate"
    kind: "prop"
    shape: "box"
    position: [0, 0, 3]
    width: 1.4
    height: 1.0
  - id: "hero"
    label: "Hero"
    kind: "character"
    position: [0, 0, -2]
    size: [0.60, 1.85, 0.40]
shots:
  - id: "s1"
    shot: 1
    start: 0
    end: 10
`,
        { id: 'entity-dimensions-test', duration: 10.0 }
      )
    );

    const table = score.entities.find((e) => e.id === 'table')!;
    expect(table.width).toBeCloseTo(2.2, 3);
    expect(table.height).toBeCloseTo(0.85, 3);
    expect(table.depth).toBeCloseTo(0.9, 3);
    expect(table.radius).toBeCloseTo(1.1, 3);

    const pillar = score.entities.find((e) => e.id === 'pillar')!;
    expect(pillar.width).toBeCloseTo(0.6, 3);
    expect(pillar.depth).toBeCloseTo(0.6, 3);
    expect(pillar.height).toBeCloseTo(3.2, 3);
    expect(pillar.radius).toBeCloseTo(0.3, 3);

    const rug = score.entities.find((e) => e.id === 'rug')!;
    expect(rug.width).toBeCloseTo(2.0, 3);
    expect(rug.depth).toBeCloseTo(3.0, 3);
    expect(rug.radius).toBeCloseTo(1.5, 3);

    const bench = score.entities.find((e) => e.id === 'bench')!;
    expect(bench.width).toBeCloseTo(2.0, 3);
    expect(bench.height).toBeCloseTo(0.5, 3);
    expect(bench.depth).toBeCloseTo(0.6, 3);

    const crate = score.entities.find((e) => e.id === 'square_crate')!;
    expect(crate.width).toBeCloseTo(1.4, 3);
    expect(crate.depth).toBeCloseTo(1.4, 3);
    expect(crate.height).toBeCloseTo(1.0, 3);

    const hero = score.entities.find((e) => e.id === 'hero')!;
    expect(hero.width).toBeCloseTo(0.6, 3);
    expect(hero.height).toBeCloseTo(1.85, 3);
    expect(hero.depth).toBeCloseTo(0.4, 3);
  });

  it('parses pitch and roll across entities, shots[].entities, and blocking Format A & B with 0 defaults', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
entities:
  - id: "hero"
    kind: "character"
    pitch: 90
    roll: "-15deg"
  - id: "upright"
    kind: "prop"
blocking:
  - id: "cue-single"
    entity: "hero"
    start: 0
    end: 2
    pitch: 0
    roll: "0.5rad"
  - id: "cue-multi"
    start: 2
    end: 4
    entities:
      hero: { pitch: 65, roll: 25 }
      upright: { pitch: -30 }
shots:
  - id: "shot-1"
    start: 0
    end: 4
    entities:
      hero: { pitch: 45, roll: -20 }
      upright: { roll: 15 }
`,
        { id: 'entity-tilt-parse' }
      )
    );

    const heroDef = score.entities.find((e) => e.id === 'hero')!;
    const uprightDef = score.entities.find((e) => e.id === 'upright')!;
    expect(radToDeg(heroDef.pitchRad!)).toBeCloseTo(90, 4);
    expect(radToDeg(heroDef.rollRad!)).toBeCloseTo(-15, 4);
    expect(uprightDef.pitchRad).toBe(0);
    expect(uprightDef.rollRad).toBe(0);

    const b0 = score.blocking![0];
    expect(b0.pitchRad).toBe(0);
    expect(b0.rollRad).toBeCloseTo(0.5, 4);

    const b1Hero = score.blocking![1];
    const b1Upright = score.blocking![2];
    expect(radToDeg(b1Hero.pitchRad!)).toBeCloseTo(65, 4);
    expect(radToDeg(b1Hero.rollRad!)).toBeCloseTo(25, 4);
    expect(radToDeg(b1Upright.pitchRad!)).toBeCloseTo(-30, 4);
    expect(b1Upright.rollRad).toBeUndefined();

    const shotHero = score.shots[0].entities['hero'];
    const shotUpright = score.shots[0].entities['upright'];
    expect(radToDeg(shotHero.pitchRad!)).toBeCloseTo(45, 4);
    expect(radToDeg(shotHero.rollRad!)).toBeCloseTo(-20, 4);
    expect(shotUpright.pitchRad).toBeUndefined();
    expect(radToDeg(shotUpright.rollRad!)).toBeCloseTo(15, 4);
  });

  it('parses degree symbol & negative rad strings and handles invalid/NaN/null/Infinity pitch/roll values', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
entities:
  - id: "deg-sym"
    kind: "character"
    pitch: "45°"
    roll: "-0.5 rad"
  - id: "bad-def"
    kind: "prop"
    pitch: null
    roll: "not-an-angle"
  - id: "nan-def"
    kind: "prop"
    pitch: .nan
    roll: .inf
blocking:
  - id: "b-single"
    entity: "deg-sym"
    start: 0
    end: 2
    pitch: .nan
    roll: null
  - id: "b-multi"
    start: 2
    end: 4
    entities:
      deg-sym: { pitch: "bad", roll: .inf }
shots:
  - id: "s1"
    start: 0
    end: 4
    entities:
      deg-sym: { pitch: null, roll: "invalid" }
      bad-def: { pitch: "45°", roll: "-0.5 rad" }
`,
        { id: 'entity-tilt-edge-parse' }
      )
    );

    const degSym = score.entities.find((e) => e.id === 'deg-sym')!;
    expect(radToDeg(degSym.pitchRad!)).toBeCloseTo(45, 4);
    expect(degSym.rollRad).toBeCloseTo(-0.5, 4);

    const badDef = score.entities.find((e) => e.id === 'bad-def')!;
    expect(badDef.pitchRad).toBe(0);
    expect(badDef.rollRad).toBe(0);

    const nanDef = score.entities.find((e) => e.id === 'nan-def')!;
    expect(nanDef.pitchRad).toBe(0);
    expect(nanDef.rollRad).toBe(0);

    expect(score.blocking![0].pitchRad).toBeUndefined();
    expect(score.blocking![0].rollRad).toBeUndefined();
    expect(score.blocking![1].pitchRad).toBeUndefined();
    expect(score.blocking![1].rollRad).toBeUndefined();

    expect(score.shots[0].entities['deg-sym'].pitchRad).toBeUndefined();
    expect(score.shots[0].entities['deg-sym'].rollRad).toBeUndefined();

    const shotBadDef = score.shots[0].entities['bad-def'];
    expect(radToDeg(shotBadDef.pitchRad!)).toBeCloseTo(45, 4);
    expect(shotBadDef.rollRad).toBeCloseTo(-0.5, 4);
  });

  it('parses entity rotation pivot presets, aliases, numeric ratios, and clamping across all 3 authoring tiers (#20)', () => {
    expect(parseEntityPivotRatio(undefined)).toBeUndefined();
    expect(parseEntityPivotRatio(undefined, 0)).toBe(0);
    expect(parseEntityPivotRatio('base')).toBe(0);
    expect(parseEntityPivotRatio(' BOTTOM ')).toBe(0);
    expect(parseEntityPivotRatio('Feet')).toBe(0);
    expect(parseEntityPivotRatio('floor')).toBe(0);
    expect(parseEntityPivotRatio('ground')).toBe(0);
    expect(parseEntityPivotRatio('center')).toBe(0.5);
    expect(parseEntityPivotRatio('centre')).toBe(0.5);
    expect(parseEntityPivotRatio('Middle')).toBe(0.5);
    expect(parseEntityPivotRatio('mid')).toBe(0.5);
    expect(parseEntityPivotRatio('waist')).toBe(0.5);
    expect(parseEntityPivotRatio('top')).toBe(1);
    expect(parseEntityPivotRatio('HEAD')).toBe(1);
    expect(parseEntityPivotRatio('crown')).toBe(1);
    expect(parseEntityPivotRatio('apex')).toBe(1);
    expect(parseEntityPivotRatio(0.25)).toBe(0.25);
    expect(parseEntityPivotRatio('0.75')).toBe(0.75);
    expect(parseEntityPivotRatio(-0.4)).toBe(0);
    expect(parseEntityPivotRatio(1.6)).toBe(1);
    expect(parseEntityPivotRatio('invalid', 0)).toBe(0);
    expect(parseEntityPivotRatio(true)).toBeUndefined();

    const score = parseValidScore(
      makeScoreYaml(
        `
stage:
  stage_camera:
    target: "drone"
entities:
  - id: "ground_actor"
    kind: "character"
  - id: "drone"
    kind: "prop"
    shape: "box"
    position: [1.0, 2.0, 0.0]
    height: 1.0
    pitch: 90
    pivot: "center"
  - id: "pendulum"
    kind: "prop"
    pivot_ratio: "top"
  - id: "custom_ratio"
    kind: "character"
    pivotRatio: 0.72
blocking:
  - id: "b-format-b"
    entity: "ground_actor"
    start: 0
    end: 4
    pivot: "center"
  - id: "b-format-a"
    start: 4
    end: 8
    pivot: 0.25
    entities:
      ground_actor:
        pitch: 45
      pendulum:
        pivot: "base"
shots:
  - id: "s1"
    start: 0
    end: 8
    entities:
      ground_actor:
        pivot: "top"
`,
        { id: 'pivot-parse-test' }
      )
    );

    expect(score.entities[0].pivotRatio).toBe(0);
    expect(score.entities[1].pivotRatio).toBe(0.5);
    expect(score.entities[2].pivotRatio).toBe(1);
    expect(score.entities[3].pivotRatio).toBeCloseTo(0.72, 6);

    // Baseline stage_camera targeting center-pivoted tilted drone stays at center (1.0, 2.5, 0.0)
    expect(score.stage.defaultStageCameraPose.target.x).toBeCloseTo(1.0, 5);
    expect(score.stage.defaultStageCameraPose.target.y).toBeCloseTo(2.5, 5);
    expect(score.stage.defaultStageCameraPose.target.z).toBeCloseTo(0.0, 5);

    expect(score.blocking![0].pivotRatio).toBe(0.5);
    expect(score.blocking![1].pivotRatio).toBe(0.25);
    expect(score.blocking![2].pivotRatio).toBe(0);
    expect(score.shots[0].entities.ground_actor.pivotRatio).toBe(1);
  });
});
