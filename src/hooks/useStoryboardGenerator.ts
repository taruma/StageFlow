/**
 * Progressive Offscreen Storyboard Frame Generator Hook.
 * Mounts a single CleanStageCamExportCanvas strictly during batch capture,
 * renders each deterministic sample frame at 540p into an in-memory WebP Blob URL
 * (falling back cleanly to JPEG/PNG if unsupported), streams completed <img>
 * panels into state, and unmounts WebGL immediately afterward.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  computeExportDimensions,
  resolveExportAspectRatio,
  type ExportTargetCamera,
} from '../core/exportMath';
import {
  buildStoryboardSamples,
  type StoryboardSampleMode,
  type StoryboardSamplePoint,
} from '../core/storyboardMath';
import type { AppThemeCategory, StageScore } from '../core/types';
import type { CleanStageCamExportHandle } from '../stage/CleanStageCamExportCanvas';

export interface StoryboardRenderedPanel {
  sample: StoryboardSamplePoint;
  imageUrl: string;
  width: number;
  height: number;
}

export interface UseStoryboardGeneratorParams {
  isOpen: boolean;
  score: StageScore;
  targetCamera: ExportTargetCamera;
  sampleMode: StoryboardSampleMode;
  themeCategory: AppThemeCategory;
  dofBlurEnabled: boolean;
}

const STORYBOARD_PREVIEW_TIER = 540;
const STORYBOARD_PREVIEW_QUALITY = 0.92;

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function encodeCanvasBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

async function canvasToPreviewBlob(
  canvas: HTMLCanvasElement
): Promise<Blob | null> {
  const webp = await encodeCanvasBlob(
    canvas,
    'image/webp',
    STORYBOARD_PREVIEW_QUALITY
  );
  if (webp && webp.type === 'image/webp') {
    return webp;
  }
  const jpeg = await encodeCanvasBlob(
    canvas,
    'image/jpeg',
    STORYBOARD_PREVIEW_QUALITY
  );
  if (jpeg) {
    return jpeg;
  }
  return encodeCanvasBlob(canvas, 'image/png');
}

export function useStoryboardGenerator({
  isOpen,
  score,
  targetCamera,
  sampleMode,
  themeCategory,
  dofBlurEnabled,
}: UseStoryboardGeneratorParams) {
  const canvasRef = useRef<CleanStageCamExportHandle | null>(null);
  const generationIdRef = useRef(0);
  const objectUrlsRef = useRef<string[]>([]);

  const [panels, setPanels] = useState<StoryboardRenderedPanel[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCanvasMounted, setIsCanvasMounted] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [regenSeq, setRegenSeq] = useState(0);

  const dims = useMemo(() => {
    const aspectRatio = resolveExportAspectRatio(score.aspectRatio, targetCamera);
    return computeExportDimensions(STORYBOARD_PREVIEW_TIER, aspectRatio);
  }, [score.aspectRatio, targetCamera]);

  const samples = useMemo(
    () => (isOpen ? buildStoryboardSamples(score, sampleMode, targetCamera) : []),
    [isOpen, score, sampleMode, targetCamera]
  );

  const revokeAllObjectUrls = useCallback(() => {
    for (const url of objectUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    objectUrlsRef.current = [];
  }, []);

  const regenerate = useCallback(() => {
    setRegenSeq((seq) => seq + 1);
  }, []);

  useEffect(() => {
    const runId = ++generationIdRef.current;
    revokeAllObjectUrls();
    setPanels([]);
    setProgressIndex(0);
    setError(null);

    if (!isOpen || samples.length === 0) {
      setIsGenerating(false);
      setIsCanvasMounted(false);
      return;
    }

    setIsGenerating(true);
    setIsCanvasMounted(true);

    const runCapture = async () => {
      try {
        let attempts = 0;
        while (
          !canvasRef.current &&
          attempts < 60 &&
          generationIdRef.current === runId
        ) {
          await nextAnimationFrame();
          attempts++;
        }

        if (generationIdRef.current !== runId) return;

        const handle = canvasRef.current;
        if (!handle) {
          throw new Error('Storyboard WebGL renderer failed to initialize.');
        }

        for (let i = 0; i < samples.length; i++) {
          if (generationIdRef.current !== runId) return;

          const sample = samples[i];
          const canvas = await handle.renderFrame(sample.frame);
          if (generationIdRef.current !== runId) return;

          const blob = await canvasToPreviewBlob(canvas);
          if (generationIdRef.current !== runId) return;

          if (!blob) {
            throw new Error(
              `Failed to encode Shot #${sample.shot.shotNumber} preview image.`
            );
          }

          const imageUrl = URL.createObjectURL(blob);
          objectUrlsRef.current.push(imageUrl);

          const panel: StoryboardRenderedPanel = {
            sample,
            imageUrl,
            width: dims.width,
            height: dims.height,
          };

          setPanels((prev) => [...prev, panel]);
          setProgressIndex(i + 1);

          await yieldToEventLoop();
        }
      } catch (err) {
        if (generationIdRef.current === runId) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to generate storyboard panels.'
          );
        }
      } finally {
        if (generationIdRef.current === runId) {
          setIsGenerating(false);
          setIsCanvasMounted(false);
        }
      }
    };

    void runCapture();

    return () => {
      generationIdRef.current++;
      revokeAllObjectUrls();
    };
  }, [
    isOpen,
    samples,
    dims.width,
    dims.height,
    themeCategory,
    dofBlurEnabled,
    regenSeq,
    revokeAllObjectUrls,
  ]);

  return {
    canvasRef,
    canvasKey: `${regenSeq}-${targetCamera}-${themeCategory}-${dofBlurEnabled}-${dims.width}x${dims.height}`,
    dims,
    samples,
    panels,
    isGenerating,
    isCanvasMounted,
    progressIndex,
    totalCount: samples.length,
    error,
    regenerate,
  };
}
