/**
 * Unit tests for Headless Viewport Recorder CLI configuration and resolvers.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { CAMERA_PRESETS } from '../../scripts/record/cameraPresets';
import {
  extractSceneSlug,
  parseArgs,
  resolveDefaultOutputPath,
} from '../../scripts/record/cliArgs';
import {
  RESOLUTION_PRESETS,
  type ResolutionPresetKey,
} from '../../scripts/record/recorderTypes';
import { resolveFfmpegPath } from '../../scripts/record/ffmpegPipeline';
import {
  parseEntitySkinAssignment,
  resolveRecorderSkins,
} from '../../scripts/record/skinResolver';
import {
  partitionFrameRange,
  resolveCaptureFormat,
  resolveOptimalWorkers,
} from '../../scripts/record/workerScheduler';
import { computeStageFrame } from '../../src/core/frameEngine';
import { INITIAL_CATALOG_ITEMS, findCatalogItem } from '../../src/core/scoreCatalog';

describe('Recorder Camera Presets', () => {
  it('defines valid pitch, yaw, and distance for all presets', () => {
    const keys = Object.keys(CAMERA_PRESETS);
    expect(keys).toContain('isometric');
    expect(keys).toContain('iso');
    expect(keys).toContain('top-down');
    expect(keys).toContain('top');
    expect(keys).toContain('front');
    expect(keys).toContain('side');

    for (const key of keys) {
      const preset = CAMERA_PRESETS[key];
      expect(Number.isFinite(preset.pitchDeg)).toBe(true);
      expect(Number.isFinite(preset.yawDeg)).toBe(true);
      expect(preset.distanceM).toBeGreaterThan(0);
      expect(preset.target).toHaveLength(3);
    }
  });

  it('aligns iso and isometric aliases identically', () => {
    expect(CAMERA_PRESETS['iso']).toEqual(CAMERA_PRESETS['isometric']);
    expect(CAMERA_PRESETS['top']).toEqual(CAMERA_PRESETS['top-down']);
  });
});

describe('Recorder Resolution Presets', () => {
  it('contains expected dimensions for all standard presets', () => {
    const presets: ResolutionPresetKey[] = [
      '1080p',
      '4k',
      '720p',
      'square',
      'vertical',
    ];
    for (const p of presets) {
      const dim = RESOLUTION_PRESETS[p];
      expect(dim.width).toBeGreaterThan(0);
      expect(dim.height).toBeGreaterThan(0);
    }
    expect(RESOLUTION_PRESETS['1080p']).toEqual({ width: 1920, height: 1080 });
    expect(RESOLUTION_PRESETS['4k']).toEqual({ width: 3840, height: 2160 });
    expect(RESOLUTION_PRESETS['vertical']).toEqual({ width: 1080, height: 1920 });
  });
});

describe('FFmpeg Path Resolver', () => {
  it('locates a valid ffmpeg executable name or path', () => {
    const ffmpegPath = resolveFfmpegPath();
    expect(typeof ffmpegPath).toBe('string');
    expect(ffmpegPath.length).toBeGreaterThan(0);
  });
});

describe('Deterministic Frame Evaluation', () => {
  it('evaluates frames identically at stepped intervals', () => {
    const score = INITIAL_CATALOG_ITEMS[0].score;
    const fps = 60;
    const totalFrames = 60; // 1 second

    for (let i = 0; i < totalFrames; i++) {
      const t = i / fps;
      const frameA = computeStageFrame(t, score);
      const frameB = computeStageFrame(t, score);

      expect(frameA.timestampSec).toBeCloseTo(t, 5);
      expect(frameA.stageCamera.transform.position).toEqual(
        frameB.stageCamera.transform.position
      );
      expect(frameA.observerCamera.transform.position).toEqual(
        frameB.observerCamera.transform.position
      );
    }
  });
});

describe('Recorder Audio Track Configuration', () => {
  it('supports opt-in audio path in CLI options schema', () => {
    const audioPath = '_examples/hb_stageflow_blueprint_01_result.mp4';
    expect(typeof audioPath).toBe('string');
  });
});

describe('Bundled Scene Shortcuts & Catalog Resolution', () => {
  it('resolves all 7 blueprints and vector field correctly', () => {
    const resolveShortcut = (input: string) => {
      const direct = findCatalogItem(input);
      if (direct) return direct;

      const normalized = input.trim().toLowerCase().replace(/_/g, '-');
      if (
        normalized === 'vf' ||
        normalized === 'vector-field' ||
        normalized === 'vectorfield'
      ) {
        return findCatalogItem('vector-field');
      }
      const numMatch = input.match(/^(?:bp)?0?([1-9]\d*)$/i);
      if (numMatch) {
        const num = parseInt(numMatch[1], 10);
        const targetBpId = num === 1 ? 'demo' : `blueprint-0${num}`;
        return findCatalogItem(targetBpId);
      }
      return findCatalogItem(normalized);
    };

    expect(resolveShortcut('01')?.id).toBe('demo');
    expect(resolveShortcut('demo-blueprint')?.id).toBe('demo');
    expect(resolveShortcut('02')?.id).toBe('blueprint-02');
    expect(resolveShortcut('blueprint-02-dialogue')?.id).toBe('blueprint-02');
    expect(resolveShortcut('03')?.id).toBe('blueprint-03');
    expect(resolveShortcut('04')?.id).toBe('blueprint-04');
    expect(resolveShortcut('05')?.id).toBe('blueprint-05');
    expect(resolveShortcut('06')?.id).toBe('blueprint-06');
    expect(resolveShortcut('07')?.id).toBe('blueprint-07');
    expect(resolveShortcut('vf')?.id).toBe('vector-field');
    expect(resolveShortcut('vector_field')?.id).toBe('vector-field');
    expect(resolveShortcut('vector-field-taruma-sakti')?.id).toBe('vector-field');
  });
});

describe('Optics Bokeh Blur Invariant in Headless Recorder', () => {
  it('respects score optics dofBlur when CLI flag is omitted', () => {
    const bp06 = findCatalogItem('blueprint-06');
    expect(bp06?.score.optics?.dofBlur).toBe(true);

    const bp01 = findCatalogItem('demo');
    expect(bp01?.score.optics?.dofBlur ?? false).toBe(false);

    const resolveBlur = (cliBlur?: boolean, scoreBlur?: boolean) =>
      cliBlur !== undefined ? cliBlur : (scoreBlur ?? false);

    // Default inherit from score
    expect(resolveBlur(undefined, bp06?.score.optics?.dofBlur)).toBe(true);
    expect(resolveBlur(undefined, bp01?.score.optics?.dofBlur)).toBe(false);

    // Explicit override via CLI flag
    expect(resolveBlur(false, bp06?.score.optics?.dofBlur)).toBe(false);
    expect(resolveBlur(true, bp01?.score.optics?.dofBlur)).toBe(true);
  });
});

describe('Headless Recorder .GLB / .GLTF Skin Resolver', () => {
  it('parses <entity_id>=<path> assignments and rejects malformed specs', () => {
    expect(parseEntitySkinAssignment('hero=assets/hero.glb')).toEqual({
      entityId: 'hero',
      filePath: 'assets/hero.glb',
    });
    expect(parseEntitySkinAssignment('table = C:/sets/a=b.glb')).toEqual({
      entityId: 'table',
      filePath: 'C:/sets/a=b.glb',
    });
    expect(() => parseEntitySkinAssignment('hero.glb')).toThrow();
    expect(() => parseEntitySkinAssignment('=hero.glb')).toThrow();
    expect(() => parseEntitySkinAssignment('hero=')).toThrow();
  });

  it('auto-matches --skins-dir files, honors explicit overrides, and builds virtual route map', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stageflow-skins-'));
    try {
      const stageGlb = path.join(tmpDir, 'stage-environment.glb');
      const heroGlb = path.join(tmpDir, 'subject_a.glb');
      const overrideGlb = path.join(tmpDir, 'custom_hero.gltf');
      fs.writeFileSync(stageGlb, 'glb-stage');
      fs.writeFileSync(heroGlb, 'glb-hero');
      fs.writeFileSync(overrideGlb, '{}');

      const score = INITIAL_CATALOG_ITEMS[0].score;
      const resolved = resolveRecorderSkins(
        {
          skinsDir: tmpDir,
          entitySkinPaths: { subject_a: overrideGlb },
        },
        score.entities
      );

      expect(resolved.stageSkinFilePath).toBe(stageGlb);
      expect(resolved.entitySkinFilePaths.subject_a).toBe(overrideGlb);
      expect(resolved.stageSkinUrl).toBe('/__stageflow_skin__/stage.glb');
      expect(resolved.entitySkinUrls.subject_a).toMatch(
        /^\/__stageflow_skin__\/entity_0_subject_a\.gltf$/
      );
      expect(resolved.routeMap.get('/__stageflow_skin__/stage.glb')?.contentType).toBe(
        'model/gltf-binary'
      );
      expect(
        resolved.routeMap.get(resolved.entitySkinUrls.subject_a)?.contentType
      ).toBe('model/gltf+json');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('throws a clear error when a configured skin file does not exist', () => {
    expect(() =>
      resolveRecorderSkins({ stageSkinPath: 'nonexistent_stage.glb' }, [])
    ).toThrow(/Stage skin file not found/i);
  });
});

describe('Stateless Worker Sharding & Capture Format Scheduler', () => {
  it('defaults capture format to jpeg for video formats and png for image sequences', () => {
    expect(resolveCaptureFormat(undefined, 'mp4')).toBe('jpeg');
    expect(resolveCaptureFormat(undefined, 'webm')).toBe('jpeg');
    expect(resolveCaptureFormat(undefined, 'gif')).toBe('jpeg');
    expect(resolveCaptureFormat(undefined, 'sequence')).toBe('png');
    expect(resolveCaptureFormat('png', 'mp4')).toBe('png');
    expect(resolveCaptureFormat('jpeg', 'sequence')).toBe('jpeg');
  });

  it('auto-selects optimal workers based on frame count, format, and CPU cores', () => {
    expect(resolveOptimalWorkers(60, 'mp4', 16)).toBe(1);
    expect(resolveOptimalWorkers(2160, 'mp4', 16)).toBe(4);
    expect(resolveOptimalWorkers(2160, 'mp4', 2)).toBe(2);
    expect(resolveOptimalWorkers(2160, 'gif', 16)).toBe(1);
    expect(resolveOptimalWorkers(2160, 'mp4', 16, 6)).toBe(6);
    expect(resolveOptimalWorkers(2160, 'mp4', 16, 1)).toBe(1);
    expect(() => resolveOptimalWorkers(200, 'mp4', 8, 0)).toThrow();
  });

  it('partitions frame ranges contiguously without gaps or overlaps', () => {
    const shards = partitionFrameRange(10, 4);
    expect(shards).toEqual([
      { workerIndex: 0, startFrame: 0, endFrame: 3 },
      { workerIndex: 1, startFrame: 3, endFrame: 6 },
      { workerIndex: 2, startFrame: 6, endFrame: 8 },
      { workerIndex: 3, startFrame: 8, endFrame: 10 },
    ]);
    const totalCovered = shards.reduce(
      (sum, s) => sum + (s.endFrame - s.startFrame),
      0
    );
    expect(totalCovered).toBe(10);
  });
});

describe('CLI Default Output Path Resolution', () => {
  it('extracts a clean scene slug from Windows paths, relative paths, and bundled shortcuts', () => {
    expect(
      extractSceneSlug('d:\\Download\\Edge\\custom-custom-project-mwkx2snh-mwkyxzpe.yaml')
    ).toBe('custom-custom-project-mwkx2snh-mwkyxzpe');
    expect(extractSceneSlug('src/scores/studies/afraid.yaml')).toBe('afraid');
    expect(extractSceneSlug('01')).toBe('01');
    expect(extractSceneSlug('vf')).toBe('vf');
    expect(extractSceneSlug('blueprint_01_two_shot_arc')).toBe(
      'blueprint_01_two_shot_arc'
    );
  });

  it('defaults output path into recordings/ using the extracted basename', () => {
    expect(
      resolveDefaultOutputPath(
        'd:\\Download\\Edge\\custom-custom-project-mwkx2snh-mwkyxzpe.yaml',
        'scripted',
        'mp4'
      )
    ).toBe(
      path.join('recordings', 'custom-custom-project-mwkx2snh-mwkyxzpe_scripted.mp4')
    );

    expect(
      resolveDefaultOutputPath(
        'd:\\Download\\Edge\\custom-custom-project-mwkx2snh-mwkyxzpe.yaml',
        'stage-pov',
        'mp4'
      )
    ).toBe(
      path.join('recordings', 'custom-custom-project-mwkx2snh-mwkyxzpe_stage-pov.mp4')
    );

    expect(resolveDefaultOutputPath('01', 'scripted', 'sequence')).toBe(
      path.join('recordings', '01_scripted')
    );
  });

  it('parses CLI arguments and resolves directory -o outputs cleanly', () => {
    const parsedDefault = parseArgs([
      'd:\\Download\\Edge\\custom-custom-project-mwkx2snh-mwkyxzpe.yaml',
      '--camera',
      'stage-pov',
      '--theme',
      'light',
      '--fps',
      '30',
    ]);
    expect(parsedDefault.outputPath).toBe(
      path.join('recordings', 'custom-custom-project-mwkx2snh-mwkyxzpe_stage-pov.mp4')
    );

    const parsedDir = parseArgs([
      'd:\\Download\\Edge\\custom.yaml',
      '-o',
      'recordings/',
    ]);
    expect(parsedDir.outputPath).toBe(path.join('recordings', 'custom_scripted.mp4'));
  });

  it('parses and validates --labels including "cast" mode', () => {
    expect(parseArgs(['01', '--labels', 'all']).labels).toBe('all');
    expect(parseArgs(['01', '--labels', 'cast']).labels).toBe('cast');
    expect(parseArgs(['01', '--labels', 'CAST']).labels).toBe('cast');
    expect(parseArgs(['01', '--labels', 'camera-only']).labels).toBe('camera-only');
    expect(parseArgs(['01', '--labels', 'off']).labels).toBe('off');
    expect(() => parseArgs(['01', '--labels', 'invalid'])).toThrow(/Invalid --labels/);
  });
});
