import { expect } from 'vitest';
import { parseStageScore } from '../../src/core/scoreParser';
import type {
  CameraCueSpec,
  EvaluatedEntityState,
  SceneEntityDef,
  SphericalPose,
  StageScore,
} from '../../src/core/types';

/**
 * Parses a YAML choreography score fixture and asserts zero parse errors.
 */
export function parseValidScore(rawYaml: string): StageScore {
  const result = parseStageScore(rawYaml);
  expect(result.error, `Unexpected YAML parse error: ${result.error}`).toBeNull();
  expect(result.score).not.toBeNull();
  return result.score!;
}

export interface ScoreYamlHeaderOptions {
  id?: string;
  title?: string;
  duration?: number;
  continuous?: boolean;
  aspectRatio?: string;
  offset?: number;
  video?: string;
}

/**
 * Wraps a YAML score body with standard boilerplate header fields (`version`, `id`, `title`, etc.).
 */
export function makeScoreYaml(
  bodyYaml: string,
  header: ScoreYamlHeaderOptions = {}
): string {
  const lines: string[] = [
    'version: "1.0"',
    `id: ${JSON.stringify(header.id ?? 'test-score')}`,
    `title: ${JSON.stringify(header.title ?? 'Test Score')}`,
  ];
  if (header.video !== undefined) {
    lines.push(`video: ${JSON.stringify(header.video)}`);
  }
  if (header.aspectRatio !== undefined) {
    lines.push(`aspect_ratio: ${JSON.stringify(header.aspectRatio)}`);
  }
  if (header.duration !== undefined) {
    lines.push(`duration: ${header.duration}`);
  }
  if (header.offset !== undefined) {
    lines.push(`offset: ${header.offset}`);
  }
  if (header.continuous !== undefined) {
    lines.push(`continuous: ${header.continuous}`);
  }
  return `${lines.join('\n')}\n${bodyYaml.trimStart()}`;
}

/**
 * Creates a minimal valid `SphericalPose` for direct camera/optics unit tests.
 */
export function makePose(overrides: Partial<SphericalPose> = {}): SphericalPose {
  return {
    target: { x: 0, y: 1, z: 0 },
    distance: 5,
    pitch: 0,
    yaw: 0,
    roll: 0,
    focalLengthMm: 50,
    ...overrides,
  };
}

/**
 * Creates a minimal valid `CameraCueSpec` for direct camera evaluator tests.
 */
export function makeCameraCue(overrides: Partial<CameraCueSpec> = {}): CameraCueSpec {
  return {
    maneuver: 'dolly',
    easing: 'smooth',
    breathe: 1.0,
    direction: 'cw',
    trackTarget: true,
    ...overrides,
  };
}

/**
 * Creates a minimal valid `SceneEntityDef` for direct entity/target unit tests.
 */
export function makeEntityDef(overrides: Partial<SceneEntityDef> = {}): SceneEntityDef {
  return {
    id: 'actor',
    label: 'Actor',
    kind: 'character',
    position: { x: 0, y: 0, z: 0 },
    rotationYRad: 0,
    height: 1.75,
    radius: 0.28,
    color: '#38bdf8',
    ...overrides,
  };
}

/**
 * Creates a minimal valid `EvaluatedEntityState` for direct anchor/target resolver tests.
 */
export function makeEntityState(
  overrides: Omit<Partial<EvaluatedEntityState>, 'def'> & { def?: Partial<SceneEntityDef> } = {}
): EvaluatedEntityState {
  const { def: defOverrides, ...stateOverrides } = overrides;
  const id = stateOverrides.id ?? defOverrides?.id ?? 'actor';
  const def = makeEntityDef({ id, ...defOverrides });
  return {
    id,
    def,
    position: stateOverrides.position ?? { ...def.position },
    rotationYRad: stateOverrides.rotationYRad ?? def.rotationYRad,
    highlighted: false,
    visible: true,
    trailPoints: [],
    ...stateOverrides,
  };
}

/**
 * Creates a minimal valid AST `StageScore` for fast pure-engine tests without YAML parsing overhead.
 */
export function makeScore(overrides: Partial<StageScore> = {}): StageScore {
  return {
    version: '1.0',
    id: 'test-score',
    title: 'Test Score',
    videoUrl: 'procedural://demo',
    aspectRatio: 16 / 9,
    durationSec: 10.0,
    offsetSec: 0,
    stage: {
      width: 10,
      depth: 10,
      gridStep: 1,
      defaultObserverPose: {
        target: { x: 0, y: 1, z: 0 },
        distance: 7,
        pitch: 0.3,
        yaw: 0.4,
        roll: 0,
        focalLengthMm: 35,
      },
      defaultStageCameraPose: {
        target: { x: 0, y: 1, z: 0 },
        distance: 3.5,
        pitch: 0.1,
        yaw: 0,
        roll: 0,
        focalLengthMm: 50,
      },
    },
    entities: [
      makeEntityDef({
        id: 'actor',
        label: 'Actor',
        position: { x: -2, y: 0, z: 0 },
      }),
    ],
    shots: [
      {
        id: 'shot-1',
        shotNumber: 1,
        label: 'Shot 1',
        description: 'Test Shot',
        startSec: 0,
        endSec: 10,
        entities: {
          actor: {
            position: { x: 2, y: 0, z: 0 },
            easing: 'linear',
            highlighted: false,
            visible: true,
          },
        },
      },
    ],
    ...overrides,
  };
}
