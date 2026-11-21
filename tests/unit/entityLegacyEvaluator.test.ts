import { describe, expect, it } from 'vitest';
import {
  evaluateEntitiesAtTime,
  evaluateLegacyEntitiesAtTime,
} from '../../src/core/entityEngine';
import { degToRad, shortestAngleDiff } from '../../src/core/sphericalMath';
import {
  makeEntityDef,
  makeScore,
  makeScoreYaml,
  parseValidScore,
} from '../helpers/scoreFixtures';

describe('Tier 2 Legacy Per-Shot Entity Evaluator (entityLegacyEvaluator)', () => {
  it('evaluates Tier 2 legacy entity cut: true without sliding and with empty trailPoints', () => {
    const legacyCutScore = makeScore({
      shots: [
        {
          id: 'shot-1',
          shotNumber: 1,
          label: 'Shot 1',
          description: 'Shot 1',
          startSec: 0,
          endSec: 5,
          entities: {
            actor: {
              position: { x: 5, y: 0, z: 0 },
              easing: 'linear',
              highlighted: false,
              visible: true,
            },
          },
        },
        {
          id: 'shot-2',
          shotNumber: 2,
          label: 'Shot 2',
          description: 'Shot 2 Cut',
          startSec: 5,
          endSec: 10,
          entities: {
            actor: {
              cut: true,
              position: { x: -20, y: 0, z: 0 },
              easing: 'smooth',
              highlighted: false,
              visible: true,
            },
          },
        },
      ],
    });

    const actorAt50 = evaluateLegacyEntitiesAtTime(5.0, legacyCutScore).entitiesById.get('actor')!;
    expect(actorAt50.position).toEqual({ x: -20, y: 0, z: 0 });
    expect(actorAt50.trailPoints).toHaveLength(0);

    const actorAt75 = evaluateLegacyEntitiesAtTime(7.5, legacyCutScore).entitiesById.get('actor')!;
    expect(actorAt75.position).toEqual({ x: -20, y: 0, z: 0 });
    expect(actorAt75.trailPoints).toHaveLength(0);
  });

  it('evaluates legacy shots[].entities pitch & roll chaining, look_at preservation, and cut snapping', () => {
    const tiltLegacyScore = makeScore({
      durationSec: 6,
      entities: [
        makeEntityDef({
          id: 'hero',
          label: 'Hero',
          position: { x: 0, y: 0.18, z: 0 },
          pitchRad: degToRad(90),
          rollRad: 0,
          radius: 0.26,
        }),
      ],
      shots: [
        {
          id: 's1',
          shotNumber: 1,
          label: 'Wake',
          description: '',
          startSec: 0,
          endSec: 2,
          entities: {
            hero: {
              position: { x: 0, y: 0, z: 0 },
              pitchRad: 0,
              easing: 'linear',
              highlighted: false,
              visible: true,
            },
          },
        },
        {
          id: 's2',
          shotNumber: 2,
          label: 'Fly with lookAt',
          description: '',
          startSec: 2,
          endSec: 4,
          entities: {
            hero: {
              position: { x: 0, y: 3, z: 4 },
              pitchRad: degToRad(60),
              rollRad: degToRad(-20),
              lookAt: { x: 5, y: 0, z: 4 },
              easing: 'linear',
              highlighted: false,
              visible: true,
            },
          },
        },
        {
          id: 's3',
          shotNumber: 3,
          label: 'Cut pose',
          description: '',
          startSec: 4,
          endSec: 6,
          entities: {
            hero: {
              cut: true,
              pitchRad: degToRad(-90),
              rollRad: degToRad(10),
              easing: 'linear',
              highlighted: false,
              visible: true,
            },
          },
        },
      ],
    });

    const at1 = evaluateLegacyEntitiesAtTime(1, tiltLegacyScore).entitiesById.get('hero')!;
    expect(at1.pitchRad).toBeCloseTo(degToRad(45), 4);
    expect(at1.rollRad).toBeCloseTo(0, 4);

    const at3 = evaluateLegacyEntitiesAtTime(3, tiltLegacyScore).entitiesById.get('hero')!;
    expect(at3.pitchRad).toBeCloseTo(degToRad(30), 4);
    expect(at3.rollRad).toBeCloseTo(degToRad(-10), 4);
    expect(at3.rotationYRad).toBeCloseTo(Math.atan2(5, 2), 4);

    const at4 = evaluateLegacyEntitiesAtTime(4, tiltLegacyScore).entitiesById.get('hero')!;
    expect(at4.pitchRad).toBeCloseTo(degToRad(-90), 4);
    expect(at4.rollRad).toBeCloseTo(degToRad(10), 4);
  });

  it('chains partial single-axis pitch/roll across 3+ legacy shots with pre/gap/post holds and negative wrap', () => {
    const legacyChainScore = makeScore({
      durationSec: 10,
      entities: [
        makeEntityDef({
          id: 'hero',
          label: 'Hero',
          pitchRad: degToRad(20),
          rollRad: degToRad(-170),
          radius: 0.26,
        }),
      ],
      shots: [
        {
          id: 's1',
          shotNumber: 1,
          label: 'S1',
          description: '',
          startSec: 1,
          endSec: 3,
          entities: {
            hero: { pitchRad: degToRad(60), easing: 'linear', highlighted: false, visible: true },
          },
        },
        {
          id: 's2',
          shotNumber: 2,
          label: 'S2',
          description: '',
          startSec: 4,
          endSec: 6,
          entities: {
            hero: { rollRad: degToRad(170), easing: 'linear', highlighted: false, visible: true },
          },
        },
        {
          id: 's3',
          shotNumber: 3,
          label: 'S3',
          description: '',
          startSec: 6,
          endSec: 8,
          entities: {
            hero: { pitchRad: 0, easing: 'linear', highlighted: false, visible: true },
          },
        },
      ],
    });

    const atPre = evaluateLegacyEntitiesAtTime(0.5, legacyChainScore).entitiesById.get('hero')!;
    expect(atPre.pitchRad).toBeCloseTo(degToRad(20), 4);
    expect(atPre.rollRad).toBeCloseTo(degToRad(-170), 4);

    const atGap = evaluateLegacyEntitiesAtTime(3.5, legacyChainScore).entitiesById.get('hero')!;
    expect(atGap.pitchRad).toBeCloseTo(degToRad(60), 4);
    expect(atGap.rollRad).toBeCloseTo(degToRad(-170), 4);

    const atS2Mid = evaluateLegacyEntitiesAtTime(5, legacyChainScore).entitiesById.get('hero')!;
    expect(atS2Mid.pitchRad).toBeCloseTo(degToRad(60), 4);
    expect(atS2Mid.rollRad).toBeCloseTo(degToRad(-180), 4);

    const atPost = evaluateLegacyEntitiesAtTime(9, legacyChainScore).entitiesById.get('hero')!;
    expect(atPost.pitchRad).toBeCloseTo(0, 4);
    expect(shortestAngleDiff(atPost.rollRad!, degToRad(170))).toBeCloseTo(0, 4);
  });

  it('resolves Tier 2 legacy shots[].entities.<id>.look_at with dot-notation sub-anchors including mutual and chained order independence (#19)', () => {
    const scoreProne = parseValidScore(
      makeScoreYaml(
        `
entities:
  - id: "prone_hero"
    kind: "character"
    position: [0, 0.18, 0]
    width: 0.6
    height: 2.0
    rotation: 0
    pitch: 90
  - id: "medic"
    kind: "character"
    position: [3, 0, 0]
    rotation: 0
shots:
  - id: "s1"
    start: 0
    end: 4
    entities:
      medic:
        look_at: "prone_hero.head"
`,
        { id: 'legacy-look-at-sub-anchor', duration: 4.0 }
      )
    );

    const expectedYaw = Math.atan2(-3, 1.8);
    for (const t of [0.0, 2.0, 3.999, 4.0]) {
      const medic = evaluateEntitiesAtTime(t, scoreProne).entitiesById.get('medic')!;
      expect(medic.rotationYRad).toBeCloseTo(expectedYaw, 4);
    }

    // Mutual look_at order independence
    const buildMutualYaml = (reverseEntities: boolean) => {
      const entA = `
  - id: "alice"
    kind: "character"
    position: [0, 0, 0]
    width: 1.0
    height: 1.8
    rotation: 0`;
      const entB = `
  - id: "bob"
    kind: "character"
    position: [3, 0, 1]
    width: 1.0
    height: 1.8
    rotation: 0`;
      return makeScoreYaml(
        `
entities:${reverseEntities ? `${entB}\n${entA}` : `${entA}\n${entB}`}
shots:
  - id: "s1"
    start: 0
    end: 4
    entities:
      alice:
        look_at: "bob.shoulder_l"
      bob:
        look_at: "alice.shoulder_l"
`,
        { id: `mutual-legacy-${reverseEntities}`, duration: 4.0 }
      );
    };

    const mutualFwd = parseValidScore(buildMutualYaml(false));
    const mutualRev = parseValidScore(buildMutualYaml(true));
    for (const t of [0.5, 2.0, 3.999, 4.0]) {
      const fwd = evaluateEntitiesAtTime(t, mutualFwd).entitiesById;
      const rev = evaluateEntitiesAtTime(t, mutualRev).entitiesById;
      const aliceFwd = fwd.get('alice')!;
      const bobFwd = fwd.get('bob')!;
      expect(aliceFwd.rotationYRad).toBeCloseTo(rev.get('alice')!.rotationYRad, 6);
      expect(bobFwd.rotationYRad).toBeCloseTo(rev.get('bob')!.rotationYRad, 6);

      const bobShoulderL = {
        x: bobFwd.position.x + 0.4 * Math.cos(bobFwd.rotationYRad),
        z: bobFwd.position.z - 0.4 * Math.sin(bobFwd.rotationYRad),
      };
      expect(aliceFwd.rotationYRad).toBeCloseTo(
        Math.atan2(bobShoulderL.x - aliceFwd.position.x, bobShoulderL.z - aliceFwd.position.z),
        5
      );
    }

    // Chained look_at order independence: A -> B.shoulder_l while B -> center
    const buildChainedYaml = (reverseEntities: boolean) => {
      const entA = `
  - id: "a"
    kind: "character"
    position: [-2, 0, 2]
    width: 1.0
    height: 1.8
    rotation: 0`;
      const entB = `
  - id: "b"
    kind: "character"
    position: [2, 0, 2]
    width: 1.0
    height: 1.8
    rotation: 0`;
      return makeScoreYaml(
        `
entities:${reverseEntities ? `${entB}\n${entA}` : `${entA}\n${entB}`}
shots:
  - id: "s1"
    start: 0
    end: 4
    entities:
      a:
        look_at: "b.shoulder_l"
      b:
        look_at: "center"
`,
        { id: `chain-legacy-${reverseEntities}`, duration: 4.0 }
      );
    };

    const chainFwd = parseValidScore(buildChainedYaml(false));
    const chainRev = parseValidScore(buildChainedYaml(true));
    for (const t of [1.0, 3.999, 4.0]) {
      const fwd = evaluateEntitiesAtTime(t, chainFwd).entitiesById;
      const rev = evaluateEntitiesAtTime(t, chainRev).entitiesById;
      expect(fwd.get('a')!.rotationYRad).toBeCloseTo(rev.get('a')!.rotationYRad, 6);
      expect(fwd.get('b')!.rotationYRad).toBeCloseTo(rev.get('b')!.rotationYRad, 6);

      const bYaw = fwd.get('b')!.rotationYRad;
      expect(bYaw).toBeCloseTo(Math.atan2(-2, -2), 5);
      const bShoulderL = {
        x: 2 + 0.4 * Math.cos(bYaw),
        z: 2 - 0.4 * Math.sin(bYaw),
      };
      expect(fwd.get('a')!.rotationYRad).toBeCloseTo(
        Math.atan2(bShoulderL.x - -2, bShoulderL.z - 2),
        5
      );
    }
  });

  it('forward-chains cue-level pivot in legacy shots[].entities across upright takeoff and mid-tilt transitions (#20)', () => {
    const legacyScore = parseValidScore(
      makeScoreYaml(
        `
entities:
  - id: "drone"
    kind: "prop"
    position: [0, 2, 0]
    height: 1.0
shots:
  - id: "s1"
    start: 0
    end: 3
    entities:
      drone:
        pitch: 90
        pivot: "center"
        easing: "linear"
  - id: "s2"
    start: 3
    end: 6
    entities:
      drone:
        pivot: "base"
        easing: "linear"
`,
        { id: 'pivot-legacy-test', duration: 6.0 }
      )
    );

    expect(evaluateEntitiesAtTime(0.0, legacyScore).entitiesById.get('drone')!.pivotRatio).toBeCloseTo(
      0.5,
      6
    );
    expect(evaluateEntitiesAtTime(3.0, legacyScore).entitiesById.get('drone')!.pivotRatio).toBeCloseTo(
      0.5,
      6
    );
    expect(evaluateEntitiesAtTime(4.5, legacyScore).entitiesById.get('drone')!.pivotRatio).toBeCloseTo(
      0.25,
      6
    );
    expect(evaluateEntitiesAtTime(6.0, legacyScore).entitiesById.get('drone')!.pivotRatio).toBeCloseTo(
      0.0,
      6
    );
  });
});
