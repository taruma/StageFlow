/**
 * Stateless Frame Sharding & Capture Format Strategy Helpers for the CLI Recorder.
 */

import type { CaptureFormat, CliOptions } from './recorderTypes';

export interface FrameShard {
  workerIndex: number;
  startFrame: number;
  endFrame: number;
}

const MIN_FRAMES_FOR_MULTI_WORKER = 120;
const MIN_FRAMES_PER_SHARD = 30;
const MAX_AUTO_WORKERS = 4;

export function resolveCaptureFormat(
  explicitCapture: CaptureFormat | undefined,
  outputFormat: CliOptions['format']
): CaptureFormat {
  if (explicitCapture) {
    return explicitCapture;
  }
  return outputFormat === 'sequence' ? 'png' : 'jpeg';
}

export function resolveOptimalWorkers(
  totalFrames: number,
  outputFormat: CliOptions['format'],
  cpuCount: number,
  explicitWorkers?: number
): number {
  if (totalFrames <= 1) {
    return 1;
  }

  if (explicitWorkers !== undefined) {
    if (!Number.isFinite(explicitWorkers) || explicitWorkers < 1) {
      throw new Error(`Invalid --workers count: "${explicitWorkers}". Must be >= 1.`);
    }
    const maxAllowed = outputFormat === 'gif' ? 1 : totalFrames;
    return Math.max(1, Math.min(maxAllowed, Math.floor(explicitWorkers)));
  }

  // GIF 2-pass palettegen requires a single continuous stream
  if (outputFormat === 'gif') {
    return 1;
  }

  if (totalFrames < MIN_FRAMES_FOR_MULTI_WORKER) {
    return 1;
  }

  const safeCpus = Math.max(1, Math.floor(cpuCount));
  const targetByCpu = Math.min(MAX_AUTO_WORKERS, Math.max(2, Math.floor(safeCpus / 2)));
  const maxByShardSize = Math.max(1, Math.floor(totalFrames / MIN_FRAMES_PER_SHARD));
  return Math.max(1, Math.min(targetByCpu, maxByShardSize));
}

export function partitionFrameRange(
  totalFrames: number,
  workerCount: number
): FrameShard[] {
  const safeWorkers = Math.max(1, Math.min(totalFrames, Math.floor(workerCount)));
  const baseSize = Math.floor(totalFrames / safeWorkers);
  const remainder = totalFrames % safeWorkers;

  const shards: FrameShard[] = [];
  let cursor = 0;

  for (let i = 0; i < safeWorkers; i++) {
    const size = baseSize + (i < remainder ? 1 : 0);
    shards.push({
      workerIndex: i,
      startFrame: cursor,
      endFrame: cursor + size,
    });
    cursor += size;
  }

  return shards;
}
