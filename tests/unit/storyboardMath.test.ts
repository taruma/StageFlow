import { describe, expect, it } from 'vitest';
import { computeExportDimensions } from '../../src/core/exportMath';
import { parseAspectRatio } from '../../src/core/opticsMath';
import { parseStageScore } from '../../src/core/scoreParser';
import {
  buildStoryboardSamples,
  cleanShotLabel,
  computeShotSampleTimeSec,
  formatStoryboardFrameFilename,
  formatStoryboardPanelMeta,
  formatStoryboardShotMeta,
  groupStoryboardSamplesByShot,
  resolveStoryboardLayoutSpec,
  summarizeStoryboardSheet,
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
      target_offset: [0.45, -0.1, 0]
      distance: 6
      yaw: 82
      pitch: 4
      roll: 5
      lens: 35
      dof: shallow
      aperture: 2.8
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
      lens_start: 35
      lens_end: 85
      rig:
        type: track
        from: [0, 1.5, 6]
        to: [0, 1.5, 2.5]
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

  it('emits START/END pairs in start-end mode and START/MID/END triples in start-mid-end mode for moving shots', () => {
    const score = parseValidScore(MULTI_SHOT_YAML);
    const startEndSamples = buildStoryboardSamples(score, 'start-end', 'stage-cam');

    expect(startEndSamples).toHaveLength(5);
    expect(
      startEndSamples.map((s) => `${s.shot.id}:${s.beatTag ?? 'MID'}`)
    ).toEqual([
      'shot-static:MID',
      'shot-dolly:START',
      'shot-dolly:END',
      'shot-blocking:START',
      'shot-blocking:END',
    ]);

    const startMidEndSamples = buildStoryboardSamples(
      score,
      'start-mid-end',
      'stage-cam'
    );
    expect(startMidEndSamples).toHaveLength(7);
    expect(
      startMidEndSamples.map((s) => `${s.shot.id}:${s.beatTag ?? 'SINGLE'}`)
    ).toEqual([
      'shot-static:SINGLE',
      'shot-dolly:START',
      'shot-dolly:MID',
      'shot-dolly:END',
      'shot-blocking:START',
      'shot-blocking:MID',
      'shot-blocking:END',
    ]);
  });

  it('groups samples by shot and extracts lens transitions, rig, aperture, focus, and sheet summary', () => {
    const score = parseValidScore(MULTI_SHOT_YAML);
    const samples = buildStoryboardSamples(score, 'start-end', 'stage-cam');
    const groups = groupStoryboardSamplesByShot(samples);

    expect(groups).toHaveLength(3);
    expect(groups[0].isMoving).toBe(false);
    expect(groups[0].samples).toHaveLength(1);
    expect(groups[1].isMoving).toBe(true);
    expect(groups[1].samples).toHaveLength(2);

    const staticMeta = formatStoryboardShotMeta(groups[0].samples, 'stage-cam');
    expect(staticMeta.apertureText).toBe('f/2.8');
    expect(staticMeta.opticsText).toBe('35mm · f/2.8');
    expect(staticMeta.opticsTooltip).toBe('Focal Length: 35mm · Aperture: f/2.8');
    expect(staticMeta.moveText).toBe('cut');
    expect(staticMeta.moveTooltip).toBe('Camera Maneuver: cut');
    expect(staticMeta.focusText).toMatch(/^\d+\.\dm \(\d+\.\d–[\d.]+m|∞\)$/);
    expect(staticMeta.focusTooltip).toMatch(
      /^Focus Depth: \d+\.\dm · Sharp DoF Range: \d+\.\dm to [\d.]+m \(Near–Far\)$/
    );
    expect(staticMeta.cameraText).toBe('6.0m · Y82° · P+4° · R+5°');
    expect(staticMeta.cameraTooltip).toBe(
      'Camera Pose — Distance: 6.0m · Yaw: 82° · Pitch: +4° · Roll: +5°'
    );
    expect(staticMeta.targetText).toBe('Hero · Δ[+0.45, -0.1, 0]');
    expect(staticMeta.targetTooltip).toBe(
      'Target: Hero · Offset Δ[X: +0.45m, Y: -0.1m, Z: 0m]'
    );
    expect(staticMeta.rigText).toBeNull();
    expect(staticMeta.rigTooltip).toBeNull();

    const dollyMeta = formatStoryboardShotMeta(groups[1].samples, 'stage-cam');
    expect(dollyMeta.shotNumber).toBe(2);
    expect(dollyMeta.label).toBe('Push In');
    expect(dollyMeta.focalLengthText).toBe('35mm→85mm');
    expect(dollyMeta.opticsText).toBe('35mm→85mm');
    expect(dollyMeta.maneuverText).toBe('dolly');
    expect(dollyMeta.moveText).toMatch(/^dolly \(/);
    expect(dollyMeta.targetText).toBe('Hero');
    expect(dollyMeta.targetTooltip).toBe('Target: Hero');
    expect(dollyMeta.rigText).toBe('track');
    expect(dollyMeta.rigTooltip).toBe('Physical Camera Mount: track');

    // Verify 360-degree yaw normalizes to Y0° without overflowing 3-column cells
    const wrappedYaml = MULTI_SHOT_YAML.replace('yaw: 82', 'yaw: 360');
    const wrappedScore = parseValidScore(wrappedYaml);
    const wrappedSamples = buildStoryboardSamples(wrappedScore, 'mid', 'stage-cam');
    const wrappedMeta = formatStoryboardShotMeta([wrappedSamples[0]], 'stage-cam');
    expect(wrappedMeta.cameraText).toBe('6.0m · Y0° · P+4° · R+5°');
    expect(dollyMeta.description).toBe('Slow dolly move toward hero.');

    const summary = summarizeStoryboardSheet(groups, 'stage-cam');
    expect(summary.lenses).toEqual([
      { label: '24mm', count: 1 },
      { label: '35mm', count: 2 },
    ]);
    expect(summary.maneuvers).toEqual([
      { label: 'cut', count: 2 },
      { label: 'dolly', count: 1 },
    ]);
    expect(summary.rigs).toEqual([{ label: 'track', count: 1 }]);
  });

  it('returns an empty list cleanly when a score has zero shots', () => {
    const base = parseValidScore(MULTI_SHOT_YAML);
    const emptyScore: StageScore = { ...base, shots: [] };
    expect(buildStoryboardSamples(emptyScore, 'mid')).toEqual([]);
    expect(buildStoryboardSamples(emptyScore, 'start-end')).toEqual([]);
    expect(buildStoryboardSamples(emptyScore, 'start-mid-end')).toEqual([]);
    expect(groupStoryboardSamplesByShot([])).toEqual([]);
  });

  it('formats single-sample metadata via backward-compatible wrapper', () => {
    const score = parseValidScore(MULTI_SHOT_YAML);
    const samples = buildStoryboardSamples(score, 'mid', 'stage-cam');

    const meta = formatStoryboardPanelMeta(samples[2], 'stage-cam');
    expect(meta.shotNumber).toBe(3);
    expect(meta.label).toBe('Cross Walk');
    expect(meta.timeRangeText).toBe('8.0s–12.0s');
    expect(meta.durationText).toBe('4.0s');
    expect(meta.focalLengthText).toBe('24mm');
    expect(meta.maneuverText).toBe('cut');
    expect(cleanShotLabel('Shot 01 · Static Wide')).toBe('Static Wide');
  });

  it('computes even 540p preview dimensions honoring each score aspect ratio', () => {
    const cases: Array<{ ratioRaw: string; expectedW: number; expectedH: number }> = [
      { ratioRaw: '16:9', expectedW: 960, expectedH: 540 },
      { ratioRaw: '2.39:1', expectedW: 960, expectedH: 402 },
      { ratioRaw: '1.85:1', expectedW: 960, expectedH: 518 },
      { ratioRaw: '4:3', expectedW: 720, expectedH: 540 },
      { ratioRaw: '9:16', expectedW: 540, expectedH: 960 },
    ];

    for (const c of cases) {
      const dims = computeExportDimensions(540, parseAspectRatio(c.ratioRaw));
      expect(dims.width).toBe(c.expectedW);
      expect(dims.height).toBe(c.expectedH);
      expect(dims.width % 2).toBe(0);
      expect(dims.height % 2).toBe(0);
    }
  });

  it('resolves orientation-aware layout density columns across landscape and portrait scores', () => {
    // Landscape (16:9 / 2.39:1)
    expect(resolveStoryboardLayoutSpec(16 / 9, 'mid', 'compact', true)).toMatchObject({
      isPortrait: false,
      columns: 4,
      disabledDensities: [],
    });
    expect(resolveStoryboardLayoutSpec(2.39, 'mid', 'balanced', true).columns).toBe(3);
    expect(resolveStoryboardLayoutSpec(2.39, 'start-end', 'balanced', true)).toMatchObject({
      isPortrait: false,
      effectiveDensity: 'compact',
      columns: 4,
      isEvenLocked: true,
      disabledDensities: ['balanced'],
    });
    expect(resolveStoryboardLayoutSpec(16 / 9, 'start-mid-end', 'compact', true)).toMatchObject({
      columns: 1,
      isSingleRowLocked: true,
    });

    // Portrait (9:16) annotated vs clean-only
    expect(resolveStoryboardLayoutSpec(9 / 16, 'mid', 'compact', true)).toMatchObject({
      isPortrait: true,
      columns: 3,
    });
    expect(resolveStoryboardLayoutSpec(9 / 16, 'mid', 'balanced', true).columns).toBe(2);
    expect(resolveStoryboardLayoutSpec(9 / 16, 'mid', 'large', true).columns).toBe(1);
    expect(resolveStoryboardLayoutSpec(9 / 16, 'mid', 'compact', false).columns).toBe(6);
    expect(resolveStoryboardLayoutSpec(9 / 16, 'start-end', 'compact', true)).toMatchObject({
      isPortrait: true,
      effectiveDensity: 'balanced',
      columns: 2,
      isEvenLocked: true,
    });
  });

  it('formats deterministic single-panel export filenames across formats, beats, and cameras', () => {
    expect(
      formatStoryboardFrameFilename({
        scoreIdOrTitle: 'Afraid',
        shotNumber: 1,
        shotId: 'shot-01',
        beatTag: null,
        stageTimeSec: 1.6,
        tier: 1080,
        format: 'png',
        targetCamera: 'stage-cam',
      })
    ).toBe('afraid_01_shot_01_1_6s_1080p.png');

    expect(
      formatStoryboardFrameFilename({
        scoreIdOrTitle: 'Vector Field',
        shotNumber: 12,
        shotId: 'orbit-reveal',
        beatTag: 'START',
        stageTimeSec: 0,
        tier: 720,
        format: 'jpeg',
        targetCamera: 'observer',
      })
    ).toBe('vector_field_12_orbit_reveal_start_0s_observer_720p.jpg');

    expect(
      formatStoryboardFrameFilename({
        scoreIdOrTitle: 'The Expansion',
        shotNumber: 3,
        shotId: 'rack',
        beatTag: 'END',
        stageTimeSec: 14.25,
        tier: 1080,
        format: 'webp',
        targetCamera: 'stage-cam',
      })
    ).toBe('the_expansion_03_rack_end_14_25s_1080p.webp');
  });
});
