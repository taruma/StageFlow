/**
 * Single-Panel High-Resolution Storyboard Frame Export Hook.
 * Mounts CleanStageCamExportCanvas offscreen strictly for 1-frame capture
 * at the user-configured 720p/1080p tier, optionally runs an injected 2D overlay
 * compositor, encodes to PNG/WebP/JPEG, triggers download, and unmounts WebGL.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  computeExportDimensions,
  resolveExportAspectRatio,
  type ExportResolutionTier,
  type ExportTargetCamera,
} from '../core/exportMath';
import {
  formatStoryboardFrameFilename,
  type StoryboardExportFormat,
  type StoryboardSamplePoint,
} from '../core/storyboardMath';
import type {
  AppThemeCategory,
  StageScore,
  ToastNotification,
} from '../core/types';
import type { CleanStageCamExportHandle } from '../stage/CleanStageCamExportCanvas';

export interface StoryboardPanelExportRequest {
  score: StageScore;
  sample: StoryboardSamplePoint;
  targetCamera: ExportTargetCamera;
  themeCategory: AppThemeCategory;
  dofBlurEnabled: boolean;
  tier: ExportResolutionTier;
  format: StoryboardExportFormat;
  width: number;
  height: number;
  filename: string;
  postProcessCanvas?: (source: HTMLCanvasElement) => HTMLCanvasElement;
}

export interface ExportStoryboardPanelParams {
  score: StageScore;
  sample: StoryboardSamplePoint;
  targetCamera: ExportTargetCamera;
  themeCategory: AppThemeCategory;
  dofBlurEnabled: boolean;
  tier: ExportResolutionTier;
  format: StoryboardExportFormat;
  postProcessCanvas?: (source: HTMLCanvasElement) => HTMLCanvasElement;
}

export interface UseStoryboardPanelExportOptions {
  onNotify?: (message: string, type?: ToastNotification['type']) => void;
}

const FORMAT_MIME_TYPE: Record<StoryboardExportFormat, string> = {
  png: 'image/png',
  webp: 'image/webp',
  jpeg: 'image/jpeg',
};

const LOSSY_EXPORT_QUALITY = 0.94;

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function encodeCanvasImage(
  canvas: HTMLCanvasElement,
  format: StoryboardExportFormat
): Promise<Blob | null> {
  const mime = FORMAT_MIME_TYPE[format];
  const quality = format === 'png' ? undefined : LOSSY_EXPORT_QUALITY;
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mime, quality);
  });
}

function triggerImageDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function useStoryboardPanelExport({
  onNotify,
}: UseStoryboardPanelExportOptions = {}) {
  const [pendingRequest, setPendingRequest] =
    useState<StoryboardPanelExportRequest | null>(null);
  const canvasRef = useRef<CleanStageCamExportHandle | null>(null);
  const isExportingRef = useRef(false);
  const onNotifyRef = useRef(onNotify);
  onNotifyRef.current = onNotify;

  const exportPanel = useCallback(
    ({
      score,
      sample,
      targetCamera,
      themeCategory,
      dofBlurEnabled,
      tier,
      format,
      postProcessCanvas,
    }: ExportStoryboardPanelParams) => {
      if (isExportingRef.current) return;
      isExportingRef.current = true;

      const aspectRatio = resolveExportAspectRatio(
        score.aspectRatio,
        targetCamera
      );
      const dims = computeExportDimensions(tier, aspectRatio);
      const filename = formatStoryboardFrameFilename({
        scoreIdOrTitle: score.id || score.title,
        shotNumber: sample.shot.shotNumber,
        shotId: sample.shot.id,
        beatTag: sample.beatTag,
        stageTimeSec: sample.stageTimeSec,
        tier,
        format,
        targetCamera,
      });

      setPendingRequest({
        score,
        sample,
        targetCamera,
        themeCategory,
        dofBlurEnabled,
        tier,
        format,
        width: dims.width,
        height: dims.height,
        filename,
        postProcessCanvas,
      });
    },
    []
  );

  useEffect(() => {
    if (!pendingRequest) return;
    let cancelled = false;

    const runExport = async () => {
      try {
        let attempts = 0;
        while (!canvasRef.current && attempts < 60 && !cancelled) {
          await nextAnimationFrame();
          attempts++;
        }
        if (cancelled) return;

        const handle = canvasRef.current;
        if (!handle) {
          throw new Error('Storyboard frame exporter failed to initialize.');
        }

        const rawCanvas = await handle.renderFrame(pendingRequest.sample.frame);
        if (cancelled) return;

        const finalCanvas = pendingRequest.postProcessCanvas
          ? pendingRequest.postProcessCanvas(rawCanvas)
          : rawCanvas;

        const blob = await encodeCanvasImage(
          finalCanvas,
          pendingRequest.format
        );
        if (cancelled) return;

        if (!blob) {
          throw new Error(
            `Failed to encode frame as ${pendingRequest.format.toUpperCase()}.`
          );
        }

        triggerImageDownload(blob, pendingRequest.filename);
        onNotifyRef.current?.(`Saved "${pendingRequest.filename}"`, 'success');
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error
              ? err.message
              : 'Failed to export storyboard frame.';
          onNotifyRef.current?.(message, 'error');
        }
      } finally {
        if (!cancelled) {
          isExportingRef.current = false;
          setPendingRequest(null);
        }
      }
    };

    void runExport();

    return () => {
      cancelled = true;
      isExportingRef.current = false;
    };
  }, [pendingRequest]);

  return {
    downloadingKey: pendingRequest?.sample.key ?? null,
    pendingRequest,
    canvasRef,
    exportPanel,
  };
}
