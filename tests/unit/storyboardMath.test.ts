import { describe, expect, it } from 'vitest';
import { parseStageScore } from '../../src/core/scoreParser';
import {
  buildStoryboardSamples,
  cleanShotLabel,
  computeShotSampleTimeSec,
  formatStoryboardPanelMeta,
} from '../../src/core/storyboardMath';
import type { StageScore } from '../../src/core/types';

function parseValidScore(yamlText: string): StageScore {
  const { score, diagnostics } = parseStageScore(yamlText);
  if (!score) {
    throw new Error(
      `Expected valid StageScore fixture, got diagnostics: ${JSON.stringify(diagnostics)}`
    );
  }
  return score;
}

const MULTI_SHOT_YAML = `
version: "1.0"
id: storyboard-test-scene
title: Storyboard Test Scene
duration: 12
aspect_ratio: "16:9"
entities:
  - id: hero
    label: Hero
    kind: character
    position: [0, 0, 0]
blocking:
  - id: hero-cross
    entity: hero
    start: 8
    end: 12
    from: [-2, 0, 0]
    position: [2, 0, 0]
shots:
  - id: shot-static
    label: "Shot 01 · Static Wide"
    description: "Locked establishing frame."
    start: 0
    end: 4
    stage_camera:
      maneuver: cut
      target: hero
      distance: 6
      lens: 35
  - id: shot-dolly
    label: "Shot 02: Push In"
    description: "Slow dolly move toward hero."
    start: 4
    end: 8
    stage_camera:
      maneuver: dolly
      target: hero
      distance_start: 6
      distance_end: 2.5
      lens: 50
  - id: shot-blocking
    label: "Shot 03 - Cross Walk"
    description: "Locked camera while hero crosses frame."
    start: 8
    end: 12
    stage_camera:
      maneuver: cut
      target: [0, 1, 0]
      distance: 5
      lens: 24
`;

describe('storyboardMath', () => {
  it('computes boundary-safe start, mid, and end sample times inside [startSec, endSec)', () => {
    const score = parseValidScore(MULTI_SHOT_YAML);
    const firstShot = score.shots[0];

    const startSec = computeShotSampleTimeSec(firstShot, 'start', score.durationSec);
    const midSec = computeShotSampleTimeSec(firstShot, 'mid', score.durationSec);
    const endSec = computeShotSampleTimeSec(firstShot, 'end', score.durationSec);

    expect(startSec).toBe(0);
    expect(midSec).toBe(2);
    expect(endSec).toBeGreaterThan(3.9);
    expect(endSec).toBeLessThan(firstShot.endSec);
  });

  it('samples 1 frame per shot in mid/start/end modes without bleeding across cut boundaries', () => {
    const score = parseValidScore(MULTI_SHOT_YAML);

    for (const mode of ['start', 'mid', 'end'] as const) {
      const samples = buildStoryboardSamples(score, mode, 'stage-cam');
      expect(samples).toHaveLength(3);
      expect(samples.map((s) => s.frame.activeShot?.id)).toEqual([
        'shot-static',
        'shot-dolly',
        'shot-blocking',
      ]);
      expect(samples.every((s) => s.beatTag === null)).toBe(true);
    }
  });

  it('compensates for non-zero score.offsetSec when evaluating sample frames', () => {
    const offsetYaml = MULTI_SHOT_YAML.replace(
      'duration: 12',
      'duration: 12\noffset: 1.5'
    );
    const score = parseValidScore(offsetYaml);

    const samples = buildStoryboardSamples(score, 'mid', 'stage-cam');
    expect(samples).toHaveLength(3);
    expect(samples.map((s) => s.frame.activeShot?.id)).toEqual([
      'shot-static',
      'shot-dolly',
      'shot-blocking',
    ]);
    expect(samples[0].stageTimeSec).toBe(2);
    expect(samples[0].rawTimestampSec).toBe(0.5);
    expect(samples[0].frame.timestampSec).toBe(2);
  });

  it('emits START/END pairs for camera moves and blocking-only entity moves in start-end mode', () => {
    const score = parseValidScore(MULTI_SHOT_YAML);
    const samples = buildStoryboardSamples(score, 'start-end', 'stage-cam');

    // shot-static   -> 1 panel (null)
    // shot-dolly    -> 2 panels (START, END)
    // shot-blocking -> 2 panels (START, END) because hero moves via root blocking:
    expect(samples).toHaveLength(5);
    expect(
      samples.map((s) => `${s.shot.id}:${s.beatTag ?? 'MID'}`)
    ).toEqual([
      'shot-static:MID',
      'shot-dolly:START',
      'shot-dolly:END',
      'shot-blocking:START',
      'shot-blocking:END',
    ]);

    expect(samples[1].frame.stageCamera.transform.pose.distance).toBeCloseTo(6, 2);
    expect(samples[2].frame.stageCamera.transform.pose.distance).toBeCloseTo(2.5, 1);
  });

  it('returns an empty list cleanly when a score has zero shots', () => {
    const base = parseValidScore(MULTI_SHOT_YAML);
    const emptyScore: StageScore = { ...base, shots: [] };
    expect(buildStoryboardSamples(emptyScore, 'mid')).toEqual([]);
    expect(buildStoryboardSamples(emptyScore, 'start-end')).toEqual([]);
  });

  it('formats shot label, timing, lens, maneuver, and description metadata', () => {
    const score = parseValidScore(MULTI_SHOT_YAML);
    const samples = buildStoryboardSamples(score, 'mid', 'stage-cam');

    const meta = formatStoryboardPanelMeta(samples[1], 'stage-cam');
    expect(meta.shotNumber).toBe(2);
    expect(meta.label).toBe('Push In');
    expect(meta.timeRangeText).toBe('4.0s–8.0s');
    expect(meta.durationText).toBe('4.0s');
    expect(meta.focalLengthText).toBe('50mm');
    expect(meta.maneuverText).toBe('dolly');
    expect(meta.description).toBe('Slow dolly move toward hero.');
    expect(cleanShotLabel('Shot 01 · Static Wide')).toBe('Static Wide');
  });
});
