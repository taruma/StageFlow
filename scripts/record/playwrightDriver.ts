/**
 * Playwright Chromium driver orchestrating deterministic frame-stepping,
 * hardware GPU acceleration, CDP screenshot capture, and stateless worker sharding.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { parseStageScore } from '../../src/core/scoreParser';
import type { RecorderConfig } from '../../src/recorder/recorderTypes';
import {
  concatMediaSegments,
  createFfmpegPipeline,
} from './ffmpegPipeline';
import type { CliOptions } from './recorderTypes';
import type { ResolvedRecorderSkins } from './skinResolver';
import { runWorkerShard } from './workerRecorder';
import {
  partitionFrameRange,
  resolveCaptureFormat,
  resolveOptimalWorkers,
} from './workerScheduler';

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  return `${String(mins).padStart(2, '0')}:${secs.padStart(5, '0')}`;
}

function renderProgressBar(
  current: number,
  total: number,
  shotId: string | null,
  timestampSec: number,
  fpsRate: number
): void {
  const percent = Math.min(100, Math.round((current / total) * 100));
  const barWidth = 24;
  const filled = Math.round((current / total) * barWidth);
  const bar = '■'.repeat(filled) + '░'.repeat(Math.max(0, barWidth - filled));
  const timeStr = formatTimestamp(timestampSec);
  const shotStr = shotId ? `[${shotId}]` : '';

  process.stdout.write(
    `\r  [${bar}] ${percent}% | Frame ${current}/${total} (${timeStr}) ${shotStr} | ${fpsRate.toFixed(1)} fps `
  );
}

function estimateTotalFrames(
  scoreYaml: string,
  fps: number,
  startSec: number,
  endSec: number
): { totalFrames: number; durationSec: number } {
  const parsed = parseStageScore(scoreYaml).score;
  const fallbackDuration = 10;
  const scoreDuration = parsed?.durationSec ?? fallbackDuration;
  const effectiveEnd = endSec > startSec ? endSec : scoreDuration;
  const durationSec = Math.max(0.01, effectiveEnd - startSec);
  const totalFrames = Math.max(1, Math.ceil(durationSec * fps));
  return { totalFrames, durationSec };
}

export async function runRecordSession(
  options: CliOptions,
  scoreYaml: string,
  serverUrl: string,
  skins?: ResolvedRecorderSkins
): Promise<void> {
  const startSec = options.startSec ?? 0;
  const endSec = options.endSec ?? 0;
  const { totalFrames, durationSec } = estimateTotalFrames(
    scoreYaml,
    options.fps,
    startSec,
    endSec
  );

  const captureFormat = resolveCaptureFormat(
    options.captureFormat,
    options.format
  );
  const workerCount = resolveOptimalWorkers(
    totalFrames,
    options.format,
    os.cpus().length,
    options.workers
  );
  const shards = partitionFrameRange(totalFrames, workerCount);

  const launchArgs = [
    '--enable-webgl',
    '--use-gl=angle',
    '--ignore-gpu-blocklist',
    '--disable-gpu-vsync',
    '--no-sandbox',
  ];
  if (!options.softwareGl && process.platform === 'win32') {
    launchArgs.push('--use-angle=d3d11');
  }

  const browser = await chromium.launch({
    headless: !options.preview,
    args: launchArgs,
  });

  const tempShardDir =
    workerCount > 1 && (options.format === 'mp4' || options.format === 'webm')
      ? fs.mkdtempSync(path.join(os.tmpdir(), 'stageflow-shards-'))
      : null;

  try {
    const recorderConfig: RecorderConfig = {
      scoreYaml,
      cameraMode: options.cameraMode,
      labelMode: options.labels,
      showGuides: options.guides,
      showHud: options.hud,
      dofBlur: options.dofBlur,
      theme: options.theme,
      fps: options.fps,
      width: options.width,
      height: options.height,
      startSec,
      endSec,
      stageSkinUrl: skins?.stageSkinUrl,
      entitySkinUrls:
        skins && Object.keys(skins.entitySkinUrls).length > 0
          ? skins.entitySkinUrls
          : undefined,
      customPose: options.customPose,
    };

    const blurDisplay =
      options.dofBlur !== undefined
        ? options.dofBlur
          ? 'ON (forced)'
          : 'OFF (forced)'
        : 'AUTO (from score)';
    const themeDisplay = (options.theme ?? 'dark').toUpperCase();
    const captureLabel =
      captureFormat === 'jpeg' ? 'CDP JPEG (q=96)' : 'CDP PNG (lossless)';

    console.log('\n🎬 StageFlow Deterministic Viewport Recorder');
    console.log('━'.repeat(52));
    console.log(`  Camera Mode:   ${options.cameraMode.toUpperCase()}`);
    console.log(
      `  Labels:        ${options.labels.toUpperCase()} | HUD: ${options.hud ? 'ON' : 'OFF'} | Guides: ${options.guides ? 'ON' : 'OFF'}`
    );
    console.log(`  Optics Blur:   ${blurDisplay} | Theme: ${themeDisplay}`);
    console.log(
      `  Audio Track:   ${options.audioPath ? options.audioPath : 'NONE (silent)'}`
    );
    if (skins && skins.routeMap.size > 0) {
      const entityCount = Object.keys(skins.entitySkinUrls).length;
      const parts: string[] = [];
      if (skins.stageSkinFilePath) parts.push(`stage=${skins.stageSkinFilePath}`);
      if (entityCount > 0) parts.push(`${entityCount} entity skin(s)`);
      console.log(`  3D Skins:      ${parts.join(' | ')}`);
    }
    console.log(
      `  Pipeline:      ${workerCount} worker(s) | ${captureLabel}`
    );
    console.log(`  Framerate:     ${options.fps} fps (locked)`);
    console.log(`  Resolution:    ${options.width}x${options.height}`);
    console.log(`  Total Frames:  ${totalFrames} (${durationSec.toFixed(2)}s)`);
    console.log(`  Output Path:   ${options.outputPath}`);
    console.log('━'.repeat(52));

    const renderStartTime = Date.now();
    let completedFrames = 0;
    let lastReportTime = Date.now();
    let lastReportFrames = 0;
    let currentFpsRate = 0;
    let rendererLogged = false;

    const handleInitInfo = (info: {
      totalFrames: number;
      durationSec: number;
      rendererInfo?: string;
    }) => {
      if (!rendererLogged && info.rendererInfo) {
        rendererLogged = true;
        console.log(`  WebGL GPU:     ${info.rendererInfo}`);
      }
    };

    const handleFrameCaptured = (result: {
      shotId: string | null;
      timestampSec: number;
    }) => {
      completedFrames += 1;
      const now = Date.now();
      if (now - lastReportTime >= 250 || completedFrames === totalFrames) {
        const framesDelta = completedFrames - lastReportFrames;
        const timeDeltaSec = (now - lastReportTime) / 1000;
        if (timeDeltaSec > 0) {
          currentFpsRate = framesDelta / timeDeltaSec;
        }
        renderProgressBar(
          completedFrames,
          totalFrames,
          result.shotId,
          result.timestampSec,
          currentFpsRate
        );
        lastReportTime = now;
        lastReportFrames = completedFrames;
      }
    };

    const inputCodec = captureFormat === 'jpeg' ? 'mjpeg' : 'png';

    if (workerCount === 1) {
      const pipeline = createFfmpegPipeline({
        outputPath: options.outputPath,
        fps: options.fps,
        width: options.width,
        height: options.height,
        format: options.format,
        inputCodec,
        audioPath: options.audioPath,
        startSec,
        durationSec,
      });

      await runWorkerShard({
        browser,
        serverUrl,
        viewport: { width: options.width, height: options.height },
        recorderConfig,
        skins,
        captureFormat,
        startFrame: 0,
        endFrame: totalFrames,
        pipeline,
        onInitInfo: handleInitInfo,
        onFrameCaptured: handleFrameCaptured,
      });
    } else if (options.format === 'sequence') {
      await Promise.all(
        shards.map((shard) => {
          const pipeline = createFfmpegPipeline({
            outputPath: options.outputPath,
            fps: options.fps,
            width: options.width,
            height: options.height,
            format: 'sequence',
            inputCodec,
            startFrameIndex: shard.startFrame,
          });
          return runWorkerShard({
            browser,
            serverUrl,
            viewport: { width: options.width, height: options.height },
            recorderConfig,
            skins,
            captureFormat,
            startFrame: shard.startFrame,
            endFrame: shard.endFrame,
            pipeline,
            onInitInfo: handleInitInfo,
            onFrameCaptured: handleFrameCaptured,
          });
        })
      );
    } else {
      const shardExt = options.format === 'webm' ? 'webm' : 'mp4';
      const segmentPaths = shards.map((s) =>
        path.join(tempShardDir!, `shard_${String(s.workerIndex).padStart(2, '0')}.${shardExt}`)
      );

      await Promise.all(
        shards.map((shard, idx) => {
          const pipeline = createFfmpegPipeline({
            outputPath: segmentPaths[idx],
            fps: options.fps,
            width: options.width,
            height: options.height,
            format: shardExt,
            inputCodec,
          });
          return runWorkerShard({
            browser,
            serverUrl,
            viewport: { width: options.width, height: options.height },
            recorderConfig,
            skins,
            captureFormat,
            startFrame: shard.startFrame,
            endFrame: shard.endFrame,
            pipeline,
            onInitInfo: handleInitInfo,
            onFrameCaptured: handleFrameCaptured,
          });
        })
      );

      await concatMediaSegments({
        segmentPaths,
        outputPath: options.outputPath,
        format: shardExt,
        audioPath: options.audioPath,
        startSec,
      });
    }

    const elapsedSec = ((Date.now() - renderStartTime) / 1000).toFixed(1);
    const avgFps = (totalFrames / Math.max(0.01, (Date.now() - renderStartTime) / 1000)).toFixed(1);

    console.log(`\n\n✨ Recording completed successfully in ${elapsedSec}s (${avgFps} fps avg)!`);
    console.log(`📁 File saved to: ${options.outputPath}\n`);
  } finally {
    await browser.close();
    if (tempShardDir && fs.existsSync(tempShardDir)) {
      fs.rmSync(tempShardDir, { recursive: true, force: true });
    }
  }
}
