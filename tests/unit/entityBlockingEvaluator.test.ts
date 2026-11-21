import { describe, expect, it } from 'vitest';
import {
  evaluateBlockingEntitiesAtTime,
  evaluateEntitiesAtTime,
} from '../../src/core/entityEngine';
import { degToRad, shortestAngleDiff } from '../../src/core/sphericalMath';
import {
  makeEntityDef,
  makeScore,
  makeScoreYaml,
  parseValidScore,
} from '../helpers/scoreFixtures';

describe('Tier 1 Decoupled Entity Blocking Evaluator (entityBlockingEvaluator)', () => {
  it('evaluates cut: true as instant placement with empty trailPoints and no cross-stage sliding', () => {
    const cutScore = makeScore({
      blocking: [
        {
          id: 'cue-walk',
          entityId: 'actor',
          startSec: 0,
          endSec: 5,
          position: { x: 4, y: 0, z: 0 },
          easing: 'linear',
        },
        {
          id: 'cue-jump-cut',
          entityId: 'actor',
          startSec: 5,
          endSec: 10,
          cut: true,
          position: { x: -10, y: 0, z: 5 },
          rotationYRad: Math.PI / 2,
          easing: 'smooth',
        },
        {
          id: 'cue-walk-post-cut',
          entityId: 'actor',
          startSec: 10,
          endSec: 15,
          position: { x: -15, y: 0, z: 5 },
          easing: 'linear',
        },
      ],
    });

    // At 4.9s: still near end of cue-walk (x ~ 3.88)
    const actorAt49 = evaluateBlockingEntitiesAtTime(4.9, cutScore).entitiesById.get('actor')!;
    expect(actorAt49.position.x).toBeCloseTo(3.88, 1);
    expect(actorAt49.trailPoints.length).toBeGreaterThan(0);

    // At 5.0s: immediately manifests at (-10, 0, 5) with suppressed trail
    const actorAt50 = evaluateBlockingEntitiesAtTime(5.0, cutScore).entitiesById.get('actor')!;
    expect(actorAt50.position).toEqual({ x: -10, y: 0, z: 5 });
    expect(actorAt50.trailPoints).toHaveLength(0);
    expect(actorAt50.rotationYRad).toBeCloseTo(Math.PI / 2, 4);

    // At 7.5s: holds exactly at (-10, 0, 5)
    const actorAt75 = evaluateBlockingEntitiesAtTime(7.5, cutScore).entitiesById.get('actor')!;
    expect(actorAt75.position).toEqual({ x: -10, y: 0, z: 5 });
    expect(actorAt75.trailPoints).toHaveLength(0);

    // At 12.5s: walks smoothly from (-10, 0, 5) to (-15, 0, 5) -> x = -12.5
    const actorAt125 = evaluateBlockingEntitiesAtTime(12.5, cutScore).entitiesById.get('actor')!;
    expect(actorAt125.position.x).toBeCloseTo(-12.5, 3);
    expect(actorAt125.position.z).toBeCloseTo(5.0, 3);
    expect(actorAt125.trailPoints.length).toBeGreaterThan(0);
  });

  it('interpolates dimensions at 60fps and forward-chains individual axes across cues', () => {
    const dimensionScore = makeScore({
      entities: [
        makeEntityDef({
          id: 'actor',
          width: 0.52,
          height: 1.75,
          depth: 0.52,
          radius: 0.26,
          color: '#ffffff',
        }),
      ],
      blocking: [
        {
          id: 'cue-crouch',
          entityId: 'actor',
          startSec: 0,
          endSec: 4,
          height: 1.05,
          easing: 'linear',
        },
        {
          id: 'cue-widen',
          entityId: 'actor',
          startSec: 4,
          endSec: 8,
          width: 0.8,
          easing: 'linear',
        },
      ],
    });

    const actor0 = evaluateBlockingEntitiesAtTime(0, dimensionScore).entitiesById.get('actor')!;
    expect(actor0.size).toBeDefined();
    expect(actor0.size!.x).toBeCloseTo(0.52, 3);
    expect(actor0.size!.y).toBeCloseTo(1.75, 3);
    expect(actor0.size!.z).toBeCloseTo(0.52, 3);

    const actor2 = evaluateBlockingEntitiesAtTime(2, dimensionScore).entitiesById.get('actor')!;
    expect(actor2.size!.y).toBeCloseTo(1.4, 3);
    expect(actor2.size!.x).toBeCloseTo(0.52, 3);
    expect(actor2.size!.z).toBeCloseTo(0.52, 3);

    const actor4 = evaluateBlockingEntitiesAtTime(4, dimensionScore).entitiesById.get('actor')!;
    expect(actor4.size!.y).toBeCloseTo(1.05, 3);

    // Cue 2 preserves height at 1.05m while widening width 0.52 -> 0.80
    const actor6 = evaluateBlockingEntitiesAtTime(6, dimensionScore).entitiesById.get('actor')!;
    expect(actor6.size!.y).toBeCloseTo(1.05, 3);
    expect(actor6.size!.x).toBeCloseTo(0.66, 3);
    expect(actor6.size!.z).toBeCloseTo(0.52, 3);

    const actor8 = evaluateBlockingEntitiesAtTime(8, dimensionScore).entitiesById.get('actor')!;
    expect(actor8.size!.y).toBeCloseTo(1.05, 3);
    expect(actor8.size!.x).toBeCloseTo(0.8, 3);
  });

  it('evaluates pitch & roll across prone -> wake up -> fly/bank with shortest-arc wrapping, look_at independence, and cut snap', () => {
    const tiltBlockingScore = makeScore({
      durationSec: 12,
      entities: [
        makeEntityDef({
          id: 'hero',
          label: 'Hero',
          position: { x: 0, y: 0.18, z: 0 },
          pitchRad: degToRad(90),
          rollRad: degToRad(170),
          radius: 0.26,
        }),
        makeEntityDef({
          id: 'target',
          label: 'Target',
          kind: 'prop',
          position: { x: 5, y: 0, z: 4 },
          height: 1,
          radius: 0.5,
          color: '#f59e0b',
        }),
      ],
      blocking: [
        {
          id: 'wake-up',
          entityId: 'hero',
          startSec: 0,
          endSec: 4,
          position: { x: 0, y: 0, z: 0 },
          pitchRad: 0,
          rollRad: degToRad(-170),
          easing: 'linear',
        },
        {
          id: 'fly-bank',
          entityId: 'hero',
          startSec: 4,
          endSec: 8,
          position: { x: 0, y: 3.5, z: 4 },
          pitchRad: degToRad(65),
          rollRad: degToRad(25),
          lookAt: 'target',
          easing: 'linear',
        },
        {
          id: 'fly-cruise',
          entityId: 'hero',
          startSec: 8,
          endSec: 10,
          position: { x: 3, y: 3.5, z: 4 },
          easing: 'linear',
        },
        {
          id: 'cut-prone',
          entityId: 'hero',
          startSec: 10,
          endSec: 12,
          position: { x: 0, y: 0.18, z: 0 },
          pitchRad: degToRad(90),
          rollRad: degToRad(-30),
          cut: true,
          easing: 'linear',
        },
      ],
    });

    const at0 = evaluateBlockingEntitiesAtTime(0, tiltBlockingScore).entitiesById.get('hero')!;
    expect(at0.pitchRad).toBeCloseTo(degToRad(90), 4);
    expect(at0.rollRad).toBeCloseTo(degToRad(170), 4);

    // Midpoint of Cue 1: pitch = 45deg, roll wraps shortest path 170 -> 180 (+10deg)
    const at2 = evaluateBlockingEntitiesAtTime(2, tiltBlockingScore).entitiesById.get('hero')!;
    expect(at2.pitchRad).toBeCloseTo(degToRad(45), 4);
    expect(at2.rollRad).toBeCloseTo(degToRad(180), 4);

    // End of Cue 2: pitch=65, roll=25 (mod 2*PI), lookAt faces +X
    const atFlyEnd = evaluateBlockingEntitiesAtTime(7.9999, tiltBlockingScore).entitiesById.get(
      'hero'
    )!;
    expect(atFlyEnd.pitchRad).toBeCloseTo(degToRad(65), 3);
    expect(shortestAngleDiff(atFlyEnd.rollRad!, degToRad(25))).toBeCloseTo(0, 3);
    expect(atFlyEnd.rotationYRad).toBeCloseTo(Math.PI / 2, 3);

    // Mid Cue 3: auto-facing along +X preserves inherited pitch=65, roll=25
    const at9 = evaluateBlockingEntitiesAtTime(9, tiltBlockingScore).entitiesById.get('hero')!;
    expect(at9.pitchRad).toBeCloseTo(degToRad(65), 4);
    expect(at9.rollRad).toBeCloseTo(degToRad(25), 4);
    expect(at9.rotationYRad).toBeCloseTo(Math.PI / 2, 4);

    // Start of Cue 4: cut=true snaps pitch & roll immediately
    const at10 = evaluateBlockingEntitiesAtTime(10, tiltBlockingScore).entitiesById.get('hero')!;
    expect(at10.pitchRad).toBeCloseTo(degToRad(90), 4);
    expect(at10.rollRad).toBeCloseTo(degToRad(-30), 4);
  });

  it('chains partial single-axis pitch/roll across 3+ cues, pre-cue/gap/post holds, explicit 0, and negative +-180 wrap', () => {
    const chainScore = makeScore({
      durationSec: 12,
      entities: [
        makeEntityDef({
          id: 'hero',
          label: 'Hero',
          pitchRad: degToRad(15),
          rollRad: degToRad(-170),
          radius: 0.26,
        }),
      ],
      blocking: [
        {
          id: 'c1',
          entityId: 'hero',
          startSec: 2,
          endSec: 4,
          pitchRad: degToRad(45),
          easing: 'linear',
        },
        {
          id: 'c2',
          entityId: 'hero',
          startSec: 6,
          endSec: 8,
          rollRad: degToRad(170),
          easing: 'linear',
        },
        {
          id: 'c3',
          entityId: 'hero',
          startSec: 8,
          endSec: 10,
          pitchRad: 0,
          easing: 'linear',
        },
      ],
    });

    const atPre = evaluateBlockingEntitiesAtTime(1, chainScore).entitiesById.get('hero')!;
    expect(atPre.pitchRad).toBeCloseTo(degToRad(15), 4);
    expect(atPre.rollRad).toBeCloseTo(degToRad(-170), 4);

    const atC1Mid = evaluateBlockingEntitiesAtTime(3, chainScore).entitiesById.get('hero')!;
    expect(atC1Mid.pitchRad).toBeCloseTo(degToRad(30), 4);
    expect(atC1Mid.rollRad).toBeCloseTo(degToRad(-170), 4);

    const atGap = evaluateBlockingEntitiesAtTime(5, chainScore).entitiesById.get('hero')!;
    expect(atGap.pitchRad).toBeCloseTo(degToRad(45), 4);
    expect(atGap.rollRad).toBeCloseTo(degToRad(-170), 4);

    const atC2Mid = evaluateBlockingEntitiesAtTime(7, chainScore).entitiesById.get('hero')!;
    expect(atC2Mid.pitchRad).toBeCloseTo(degToRad(45), 4);
    expect(atC2Mid.rollRad).toBeCloseTo(degToRad(-180), 4);

    const atC3Mid = evaluateBlockingEntitiesAtTime(9, chainScore).entitiesById.get('hero')!;
    expect(atC3Mid.pitchRad).toBeCloseTo(degToRad(22.5), 4);
    expect(shortestAngleDiff(atC3Mid.rollRad!, degToRad(170))).toBeCloseTo(0, 4);

    const atPost = evaluateBlockingEntitiesAtTime(12, chainScore).entitiesById.get('hero')!;
    expect(atPost.pitchRad).toBeCloseTo(0, 4);
    expect(shortestAngleDiff(atPost.rollRad!, degToRad(170))).toBeCloseTo(0, 4);
  });

  it('produces identical pitch/roll kinematics between blocking Format A and Format B YAML', () => {
    const scoreA = parseValidScore(
      makeScoreYaml(
        `
entities:
  - id: "hero"
    kind: "character"
    position: [0, 0, 0]
    pitch: 90
    roll: -10
blocking:
  - id: "beat-1"
    entity: "hero"
    start: 0
    end: 4
    position: [2, 0, 0]
    pitch: 0
    roll: 25
    look_at: [5, 0, 0]
    easing: "linear"
  - id: "beat-2"
    entity: "hero"
    start: 4
    end: 6
    cut: true
    pitch: -45
    roll: 0
shots:
  - id: "s1"
    shot: 1
    start: 0
    end: 6
    stage_camera: { target: "hero" }
`,
        { id: 'format-a', title: 'Format A', duration: 6.0 }
      )
    );

    const scoreB = parseValidScore(
      makeScoreYaml(
        `
entities:
  - id: "hero"
    kind: "character"
    position: [0, 0, 0]
    pitch: 90
    roll: -10
blocking:
  - id: "beat-1"
    start: 0
    end: 4
    easing: "linear"
    entities:
      hero:
        position: [2, 0, 0]
        pitch: 0
        roll: 25
        look_at: [5, 0, 0]
  - id: "beat-2"
    start: 4
    end: 6
    cut: true
    entities:
      hero:
        pitch: -45
        roll: 0
shots:
  - id: "s1"
    shot: 1
    start: 0
    end: 6
    stage_camera: { target: "hero" }
`,
        { id: 'format-b', title: 'Format B', duration: 6.0 }
      )
    );

    for (const t of [0, 2, 3.99, 4, 5]) {
      const heroA = evaluateEntitiesAtTime(t, scoreA).entitiesById.get('hero')!;
      const heroB = evaluateEntitiesAtTime(t, scoreB).entitiesById.get('hero')!;
      expect(heroB.position).toEqual(heroA.position);
      expect(heroB.rotationYRad).toBeCloseTo(heroA.rotationYRad, 6);
      expect(heroB.pitchRad).toBeCloseTo(heroA.pitchRad!, 6);
      expect(heroB.rollRad).toBeCloseTo(heroA.rollRad!, 6);
    }
  });

  it('resolves Tier 1 blocking look_at with dot-notation sub-anchors including mutual and chained order independence (#19)', () => {
    const scoreProne = parseValidScore(
      makeScoreYaml(
        `
entities:
  - id: "prone_hero"
    kind: "character"
    position: [0, 0.18, 0]
    height: 2.0
    rotation: 0
    pitch: 90
  - id: "medic"
    kind: "character"
    position: [3, 0, 0]
blocking:
  - id: "look-at-head"
    entity: "medic"
    start: 0
    end: 4
    look_at: "prone_hero.head"
shots:
  - id: "s1"
    start: 0
    end: 4
    stage_camera: { target: "prone_hero.chest" }
`,
        { id: 'look-at-sub-anchor', duration: 4.0 }
      )
    );
    const medic = evaluateEntitiesAtTime(2.0, scoreProne).entitiesById.get('medic')!;
    expect(medic.rotationYRad).toBeCloseTo(Math.atan2(-3, 1.8), 4);

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
blocking:
  - id: "c-alice"
    entity: "alice"
    start: 0
    end: 4
    look_at: "bob.shoulder_l"
  - id: "c-bob"
    entity: "bob"
    start: 0
    end: 4
    look_at: "alice.shoulder_l"
shots:
  - id: "s1"
    start: 0
    end: 4
`,
        { id: `mutual-blocking-${reverseEntities}`, duration: 4.0 }
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
blocking:
  - id: "ca"
    entity: "a"
    start: 0
    end: 4
    look_at: "b.shoulder_l"
  - id: "cb"
    entity: "b"
    start: 0
    end: 4
    look_at: "center"
shots:
  - id: "s1"
    start: 0
    end: 4
`,
        { id: `chain-blocking-${reverseEntities}`, duration: 4.0 }
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

  it('forward-chains cue-level pivot with C0 continuity across upright takeoffs, mid-tilt transitions, cuts, and look_at (#20)', () => {
    const score = parseValidScore(
      makeScoreYaml(
        `
entities:
  - id: "hero"
    kind: "character"
    position: [0, 0, 0]
    height: 2.0
    rotation: 0
  - id: "spotter"
    kind: "character"
    position: [4, 0, 0]
    rotation: -90
blocking:
  - id: "takeoff"
    entity: "hero"
    start: 0.0
    end: 3.0
    position: [0, 3.0, 0]
    pitch: 90
    pivot: "center"
    easing: "linear"
  - id: "mid-tilt-pivot-change"
    entity: "hero"
    start: 3.0
    end: 6.0
    pivot: "base"
    easing: "linear"
  - id: "cut-pivot"
    entity: "hero"
    start: 6.0
    end: 9.0
    cut: true
    pivot: "top"
  - id: "spotter-track"
    entity: "spotter"
    start: 0.0
    end: 3.0
    look_at: "hero"
shots:
  - id: "s1"
    start: 0
    end: 9
`,
        { id: 'pivot-chaining-test', duration: 9.0 }
      )
    );

    // Cue 1: starts upright -> locks immediately to 0.5 at t=0
    expect(evaluateEntitiesAtTime(0.0, score).entitiesById.get('hero')!.pivotRatio).toBeCloseTo(
      0.5,
      6
    );
    expect(evaluateEntitiesAtTime(1.5, score).entitiesById.get('hero')!.pivotRatio).toBeCloseTo(
      0.5,
      6
    );
    expect(evaluateEntitiesAtTime(2.999, score).entitiesById.get('hero')!.pivotRatio).toBeCloseTo(
      0.5,
      6
    );

    // Spotter gaze at end of Cue 1: hero head at z = (0.9 - 0.5) * 2.0 = +0.8m
    const spotterEnd = evaluateEntitiesAtTime(2.999, score).entitiesById.get('spotter')!;
    expect(spotterEnd.rotationYRad).toBeCloseTo(Math.atan2(0 - 4, 0.8 - 0), 4);

    // Cue 2: already tilted (pitch=90) -> eases smoothly 0.5 -> 0.25 -> 0.0
    expect(evaluateEntitiesAtTime(3.0, score).entitiesById.get('hero')!.pivotRatio).toBeCloseTo(
      0.5,
      6
    );
    expect(evaluateEntitiesAtTime(4.5, score).entitiesById.get('hero')!.pivotRatio).toBeCloseTo(
      0.25,
      6
    );
    expect(evaluateEntitiesAtTime(5.999, score).entitiesById.get('hero')!.pivotRatio).toBeCloseTo(
      0.5 * (1 - 2.999 / 3),
      6
    );

    // Cue 3: cut: true snaps pivot immediately to 1.0
    expect(evaluateEntitiesAtTime(6.0, score).entitiesById.get('hero')!.pivotRatio).toBeCloseTo(
      1.0,
      6
    );
  });
});
