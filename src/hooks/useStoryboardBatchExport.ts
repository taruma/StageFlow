/**
 * Batch Storyboard Export Hook (Phase 2b):
 *   1. All Frames (.zip): Renders every sampled frame sequentially at 720p/1080p
 *      via a single offscreen CleanStageCamExportCanvas, packs into a zero-dep
 *      STORE ZIP archive, triggers download, and unmounts WebGL immediately.
 *   2. Contact Sheet (.png): Composites the clean white-paper Contact Sheet via
 *      an injected Layer 5 2D canvas renderer, encodes PNG, and downloads.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  computeExportDimensions,
  resolveExportAspectRatio,
  type ExportResolutionTier,
  type ExportTargetCamera,
} from '../core/exportMath';
import {
  formatStoryboardContactSheetFilename,
  formatStoryboardContactSheetZipFilename,
  formatStoryboardFrameFilename,
  formatStoryboardZipFilename,
  type StoryboardExportFormat,
  type StoryboardSamplePoint,
} from '../core/storyboardMath';
import { buildZipArchive, type ZipArchiveEntry } from '../core/zipBuilder';
import type {
  AppThemeCategory,
  StageScore,
  ToastNotification,
} from '../core/types';
import type { CleanStageCamExportHandle } from '../stage/CleanStageCamExportCanvas';
import {
  encodeCanvasImage,
  nextAnimationFrame,
  resolveActualFormat,
  triggerBlobDownload,
  yieldToEventLoop,
} from './storyboardExportUtils';

export type StoryboardBatchExportMode = 'contact-sheet' | 'zip';

export interface StoryboardBatchProgress {
  mode: StoryboardBatchExportMode;
  completed: number;
  total: number;
}

export interface StoryboardZipExportRequest {
  score: StageScore;
  samples: StoryboardSamplePoint[];
  targetCamera: ExportTargetCamera;
  themeCategory: AppThemeCategory;
  dofBlurEnabled: boolean;
  tier: ExportResolutionTier;
  format: StoryboardExportFormat;
  width: number;
  height: number;
  zipFilename: string;
  postProcessCanvas?: (
    source: HTMLCanvasElement,
    sample: StoryboardSamplePoint
  ) => HTMLCanvasElement;
}

export interface ExportStoryboardZipParams {
  score: StageScore;
  samples: StoryboardSamplePoint[];
  targetCamera: ExportTargetCamera;
  themeCategory: AppThemeCategory;
  dofBlurEnabled: boolean;
  tier: ExportResolutionTier;
  format: StoryboardExportFormat;
  postProcessCanvas?: (
    source: HTMLCanvasElement,
    sample: StoryboardSamplePoint
  ) => HTMLCanvasElement;
}

export interface ExportContactSheetParams {
  score: StageScore;
  targetCamera: ExportTargetCamera;
  annotated: boolean;
  renderSheetPages: () => Promise<HTMLCanvasElement[]>;
}

export interface UseStoryboardBatchExportOptions {
  onNotify?: (message: string, type?: ToastNotification['type']) => void;
}

export function useStoryboardBatchExport({
  onNotify,
}: UseStoryboardBatchExportOptions = {}) {
  const [pendingZipRequest, setPendingZipRequest] =
    useState<StoryboardZipExportRequest | null>(null);
  const [progress, setProgress] = useState<StoryboardBatchProgress | null>(null);

  const canvasRef = useRef<CleanStageCamExportHandle | null>(null);
  const jobIdRef = useRef(0);
  const isBusyRef = useRef(false);
  const onNotifyRef = useRef(onNotify);
  onNotifyRef.current = onNotify;

  const cancelBatchExport = useCallback(() => {
    jobIdRef.current++;
    isBusyRef.current = false;
    setPendingZipRequest(null);
    setProgress(null);
  }, []);

  const exportAllZip = useCallback(
    ({
      score,
      samples,
      targetCamera,
      themeCategory,
      dofBlurEnabled,
      tier,
      format,
      postProcessCanvas,
    }: ExportStoryboardZipParams) => {
      if (isBusyRef.current || samples.length === 0) return;
      isBusyRef.current = true;

      const aspectRatio = resolveExportAspectRatio(
        score.aspectRatio,
        targetCamera
      );
      const dims = computeExportDimensions(tier, aspectRatio);
      const zipFilename = formatStoryboardZipFilename({
        scoreIdOrTitle: score.id || score.title,
        targetCamera,
        tier,
        downloadedAt: new Date(),
      });

      setProgress({ mode: 'zip', completed: 0, total: samples.length });
      setPendingZipRequest({
        score,
        samples,
        targetCamera,
        themeCategory,
        dofBlurEnabled,
        tier,
        format,
        width: dims.width,
        height: dims.height,
        zipFilename,
        postProcessCanvas,
      });
    },
    []
  );

  const exportContactSheet = useCallback(
    async ({
      score,
      targetCamera,
      annotated,
      renderSheetPages,
    }: ExportContactSheetParams) => {
      if (isBusyRef.current) return;
      isBusyRef.current = true;
      const jobId = ++jobIdRef.current;
      setProgress({ mode: 'contact-sheet', completed: 0, total: 1 });

      try {
        const pageCanvases = await renderSheetPages();
        if (jobIdRef.current !== jobId) return;

        if (pageCanvases.length === 0) {
          throw new Error('No Contact Sheet pages were rendered.');
        }

        const scoreIdOrTitle = score.id || score.title;

        if (pageCanvases.length === 1) {
          const blob = await encodeCanvasImage(pageCanvases[0], 'png');
          if (jobIdRef.current !== jobId) return;

          if (!blob) {
            throw new Error('Failed to encode Contact Sheet as PNG.');
          }

          const filename = formatStoryboardContactSheetFilename({
            scoreIdOrTitle,
            targetCamera,
            annotated,
          });
          triggerBlobDownload(blob, filename);
          onNotifyRef.current?.(`Saved "${filename}"`, 'success');
          return;
        }

        const totalPages = pageCanvases.length;
        setProgress({ mode: 'contact-sheet', completed: 0, total: totalPages });
        const entries: ZipArchiveEntry[] = [];
        const now = new Date();

        for (let i = 0; i < totalPages; i++) {
          if (jobIdRef.current !== jobId) return;

          const blob = await encodeCanvasImage(pageCanvases[i], 'png');
          if (jobIdRef.current !== jobId) return;

          if (!blob) {
            throw new Error(`Failed to encode Contact Sheet page ${i + 1} as PNG.`);
          }

          const data = new Uint8Array(await blob.arrayBuffer());
          if (jobIdRef.current !== jobId) return;

          entries.push({
            filename: formatStoryboardContactSheetFilename({
              scoreIdOrTitle,
              targetCamera,
              annotated,
              pageNumber: i + 1,
              totalPages,
            }),
            data,
            modifiedAt: now,
          });
          setProgress({
            mode: 'contact-sheet',
            completed: i + 1,
            total: totalPages,
          });
          await yieldToEventLoop();
        }

        if (jobIdRef.current !== jobId) return;

        const zipBytes = buildZipArchive(entries);
        const zipBlob = new Blob([zipBytes], { type: 'application/zip' });
        const zipFilename = formatStoryboardContactSheetZipFilename({
          scoreIdOrTitle,
          targetCamera,
          annotated,
          downloadedAt: now,
        });
        triggerBlobDownload(zipBlob, zipFilename);
        onNotifyRef.current?.(
          `Saved "${zipFilename}" (${totalPages} pages)`,
          'success'
        );
      } catch (err) {
        if (jobIdRef.current === jobId) {
          const message =
            err instanceof Error
              ? err.message
              : 'Failed to export Contact Sheet.';
          onNotifyRef.current?.(message, 'error');
        }
      } finally {
        if (jobIdRef.current === jobId) {
          isBusyRef.current = false;
          setProgress(null);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!pendingZipRequest) return;
    const jobId = ++jobIdRef.current;

    const runZipExport = async () => {
      try {
        let attempts = 0;
        while (!canvasRef.current && attempts < 60 && jobIdRef.current === jobId) {
          await nextAnimationFrame();
          attempts++;
        }
        if (jobIdRef.current !== jobId) return;

        const handle = canvasRef.current;
        if (!handle) {
          throw new Error('Storyboard ZIP exporter failed to initialize.');
        }

        const entries: ZipArchiveEntry[] = [];
        const now = new Date();
        let fallbackTriggered = false;

        for (let i = 0; i < pendingZipRequest.samples.length; i++) {
          if (jobIdRef.current !== jobId) return;

          const sample = pendingZipRequest.samples[i];
          const rawCanvas = await handle.renderFrame(sample.frame);
          if (jobIdRef.current !== jobId) return;

          const finalCanvas = pendingZipRequest.postProcessCanvas
            ? pendingZipRequest.postProcessCanvas(rawCanvas, sample)
            : rawCanvas;

          const blob = await encodeCanvasImage(
            finalCanvas,
            pendingZipRequest.format
          );
          if (jobIdRef.current !== jobId) return;

          if (!blob) {
            throw new Error(
              `Failed to encode Shot #${sample.shot.shotNumber} as ${pendingZipRequest.format.toUpperCase()}.`
            );
          }

          const actualFormat = resolveActualFormat(
            pendingZipRequest.format,
            blob.type
          );
          if (actualFormat !== pendingZipRequest.format) {
            fallbackTriggered = true;
          }

          const filename = formatStoryboardFrameFilename({
            scoreIdOrTitle:
              pendingZipRequest.score.id || pendingZipRequest.score.title,
            shotNumber: sample.shot.shotNumber,
            shotId: sample.shot.id,
            beatTag: sample.beatTag,
            stageTimeSec: sample.stageTimeSec,
            tier: pendingZipRequest.tier,
            format: actualFormat,
            targetCamera: pendingZipRequest.targetCamera,
            orderedBeat: true,
          });

          const data = new Uint8Array(await blob.arrayBuffer());
          if (jobIdRef.current !== jobId) return;

          entries.push({ filename, data, modifiedAt: now });
          setProgress({
            mode: 'zip',
            completed: i + 1,
            total: pendingZipRequest.samples.length,
          });

          await yieldToEventLoop();
        }

        if (jobIdRef.current !== jobId) return;

        const zipBytes = buildZipArchive(entries);
        const zipBlob = new Blob([zipBytes], { type: 'application/zip' });
        triggerBlobDownload(zipBlob, pendingZipRequest.zipFilename);

        if (fallbackTriggered) {
          onNotifyRef.current?.(
            `Saved "${pendingZipRequest.zipFilename}" (${entries.length} frames — ${pendingZipRequest.format.toUpperCase()} fell back to PNG)`,
            'warning'
          );
        } else {
          onNotifyRef.current?.(
            `Saved "${pendingZipRequest.zipFilename}" (${entries.length} frames)`,
            'success'
          );
        }
      } catch (err) {
        if (jobIdRef.current === jobId) {
          const message =
            err instanceof Error
              ? err.message
              : 'Failed to export storyboard ZIP.';
          onNotifyRef.current?.(message, 'error');
        }
      } finally {
        if (jobIdRef.current === jobId) {
          isBusyRef.current = false;
          setPendingZipRequest(null);
          setProgress(null);
        }
      }
    };

    void runZipExport();

    return () => {
      jobIdRef.current++;
      isBusyRef.current = false;
    };
  }, [pendingZipRequest]);

  return {
    progress,
    isBatchExporting: progress !== null,
    pendingZipRequest,
    canvasRef,
    exportAllZip,
    exportContactSheet,
    cancelBatchExport,
  };
}
