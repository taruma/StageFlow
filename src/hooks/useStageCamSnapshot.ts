/**
 * 1-Click 1080p Clean Stage Cam PNG Snapshot Hook.
 * Mounts CleanStageCamExportCanvas offscreen strictly for the duration of a single
 * deterministic frame capture (inheriting active Diorama Theme and DoF Blur state),
 * encodes to PNG, triggers browser download, and unmounts immediately.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { computeStageFrame } from '../core/frameEngine';
import {
  computeExportDimensions,
  formatExportSnapshotFilename,
  resolveExportAspectRatio,
} from '../core/exportMath';
import type {
  AppThemeCategory,
  StageFrame,
  StageScore,
  ToastNotification,
} from '../core/types';
import type { CleanStageCamExportHandle } from '../stage/CleanStageCamExportCanvas';

export interface StageCamSnapshotRequest {
  score: StageScore;
  frame: StageFrame;
  width: number;
  height: number;
  dofBlurEnabled: boolean;
  themeCategory: AppThemeCategory;
  stageSkinUrl?: string | null;
  entitySkinUrls?: Record<string, string>;
  filename: string;
}

export interface CaptureStageCamSnapshotParams {
  score: StageScore;
  timestampSec: number;
  dofBlurEnabled: boolean;
  themeCategory: AppThemeCategory;
  stageSkinUrl?: string | null;
  entitySkinUrls?: Record<string, string>;
}

export interface UseStageCamSnapshotOptions {
  onNotify?: (message: string, type?: ToastNotification['type']) => void;
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

function triggerPngDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function useStageCamSnapshot({
  onNotify,
}: UseStageCamSnapshotOptions = {}) {
  const [pendingRequest, setPendingRequest] =
    useState<StageCamSnapshotRequest | null>(null);
  const canvasRef = useRef<CleanStageCamExportHandle | null>(null);
  const isCapturingRef = useRef(false);
  const onNotifyRef = useRef(onNotify);
  onNotifyRef.current = onNotify;

  const captureSnapshot = useCallback(
    ({
      score,
      timestampSec,
      dofBlurEnabled,
      themeCategory,
      stageSkinUrl,
      entitySkinUrls,
    }: CaptureStageCamSnapshotParams) => {
      if (isCapturingRef.current) return;
      isCapturingRef.current = true;

      const aspectRatio = resolveExportAspectRatio(
        score.aspectRatio,
        'stage-cam'
      );
      const dims = computeExportDimensions(1080, aspectRatio);
      const frame = computeStageFrame(timestampSec, score);
      const filename = formatExportSnapshotFilename(
        score.id || score.title,
        frame.timestampSec,
        new Date(),
        frame.activeShot?.id,
        1080
      );

      setPendingRequest({
        score,
        frame,
        width: dims.width,
        height: dims.height,
        dofBlurEnabled,
        themeCategory,
        stageSkinUrl,
        entitySkinUrls,
        filename,
      });
    },
    []
  );

  useEffect(() => {
    if (!pendingRequest) return;
    let cancelled = false;

    const runCapture = async () => {
      try {
        let attempts = 0;
        while (!canvasRef.current && attempts < 60 && !cancelled) {
          await nextAnimationFrame();
          attempts++;
        }
        if (cancelled) return;

        const handle = canvasRef.current;
        if (!handle) {
          throw new Error('Stage Cam snapshot renderer failed to initialize.');
        }

        const canvas = await handle.renderFrame(pendingRequest.frame);
        if (cancelled) return;

        const blob = await canvasToPngBlob(canvas);
        if (cancelled) return;

        if (!blob) {
          throw new Error('Failed to encode Stage Cam snapshot as PNG.');
        }

        triggerPngDownload(blob, pendingRequest.filename);
        onNotifyRef.current?.(`Saved "${pendingRequest.filename}"`, 'success');
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error
              ? err.message
              : 'Failed to capture Stage Cam snapshot.';
          onNotifyRef.current?.(message, 'error');
        }
      } finally {
        if (!cancelled) {
          isCapturingRef.current = false;
          setPendingRequest(null);
        }
      }
    };

    void runCapture();

    return () => {
      cancelled = true;
    };
  }, [pendingRequest]);

  return {
    isCapturing: pendingRequest !== null,
    pendingRequest,
    canvasRef,
    captureSnapshot,
  };
}
