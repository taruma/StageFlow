/**
 * Storyboard Contact Sheet Generator, Viewer & Single-Panel Export Modal.
 * Renders shot panels progressively offscreen via a single CleanStageCamExportCanvas,
 * adapts grid density and card orientation to the active aspect ratio, overlays
 * instant CSS composition guides, supports 720p/1080p single-frame downloads,
 * and unmounts WebGL immediately upon completion.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Archive,
  FileImage,
  LayoutGrid,
  Loader2,
  X,
} from 'lucide-react';
import {
  computeExportDimensions,
  resolveExportAspectRatio,
  type ExportResolutionTier,
  type ExportTargetCamera,
} from '../core/exportMath';
import {
  groupStoryboardSamplesByShot,
  resolveStoryboardLayoutSpec,
  summarizeStoryboardSheet,
  type StoryboardDensity,
  type StoryboardExportFormat,
  type StoryboardGridColumns,
  type StoryboardGuideMode,
  type StoryboardSampleMode,
  type StoryboardSamplePoint,
} from '../core/storyboardMath';
import type {
  AppThemeCategory,
  StageScore,
  ToastNotification,
} from '../core/types';
import { useStoryboardBatchExport } from '../hooks/useStoryboardBatchExport';
import { useStoryboardGenerator } from '../hooks/useStoryboardGenerator';
import { useStoryboardPanelExport } from '../hooks/useStoryboardPanelExport';
import { CleanStageCamExportCanvas } from '../stage/CleanStageCamExportCanvas';
import { formatFilmGateLabel } from './shotBreakdownUtils';
import {
  estimateStoryboardContactSheetPageCount,
  renderStoryboardContactSheetPages,
} from './storyboardContactSheetRenderer';
import { StoryboardControlsSidebar } from './StoryboardControlsSidebar';
import {
  StoryboardPanelCard,
  type StoryboardCardLayoutMode,
} from './StoryboardPanelCard';
import { StoryboardSpecGuidePopover } from './StoryboardSpecGuidePopover';
import { renderStoryboardOverlayBurnIn } from './storyboardOverlayBurnIn';
import { UI_TOKENS } from './tokens/ui';

export interface StoryboardModalProps {
  isOpen: boolean;
  score: StageScore;
  dofBlurEnabled: boolean;
  onNotify?: (message: string, type?: ToastNotification['type']) => void;
  onClose: () => void;
}

const GRID_COLUMN_CLASS: Record<StoryboardGridColumns, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  6: 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6',
};

export const StoryboardModal: React.FC<StoryboardModalProps> = ({
  isOpen,
  score,
  dofBlurEnabled,
  onNotify,
  onClose,
}) => {
  const [sampleMode, setSampleMode] = useState<StoryboardSampleMode>('mid');
  const [targetCamera, setTargetCamera] =
    useState<ExportTargetCamera>('stage-cam');
  const [themeCategory, setThemeCategory] = useState<AppThemeCategory>('light');
  const [localDofBlur, setLocalDofBlur] = useState<boolean>(dofBlurEnabled);
  const [density, setDensity] = useState<StoryboardDensity>('balanced');
  const [guideMode, setGuideMode] = useState<StoryboardGuideMode>('off');
  const [annotated, setAnnotated] = useState<boolean>(true);
  const [exportTier, setExportTier] = useState<ExportResolutionTier>(1080);
  const [exportFormat, setExportFormat] =
    useState<StoryboardExportFormat>('png');
  const [exportIncludeOverlays, setExportIncludeOverlays] =
    useState<boolean>(false);
  const [isSpecGuideOpen, setIsSpecGuideOpen] = useState<boolean>(false);

  // Sync DoF blur toggle from active Stage Cam state whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalDofBlur(dofBlurEnabled);
    } else {
      setIsSpecGuideOpen(false);
    }
  }, [isOpen, dofBlurEnabled]);

  // Close Spec Guide popover first, otherwise close Storyboard modal on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isSpecGuideOpen) {
          setIsSpecGuideOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSpecGuideOpen, onClose]);

  const {
    canvasRef,
    canvasKey,
    dims,
    samples,
    panels,
    isGenerating,
    isCanvasMounted,
    progressIndex,
    totalCount,
    error,
    regenerate,
  } = useStoryboardGenerator({
    isOpen,
    score,
    targetCamera,
    sampleMode,
    themeCategory,
    dofBlurEnabled: localDofBlur,
  });

  const {
    downloadingKey: panelDownloadingKey,
    pendingRequest: panelExportPendingRequest,
    canvasRef: panelExportCanvasRef,
    exportPanel,
    cancelExport,
  } = useStoryboardPanelExport({ onNotify });

  const {
    progress: batchProgress,
    isBatchExporting,
    pendingZipRequest,
    canvasRef: batchZipCanvasRef,
    exportAllZip,
    exportContactSheet,
    cancelBatchExport,
  } = useStoryboardBatchExport({ onNotify });

  // Cancel any in-flight exports when the modal closes or score/samples change
  useEffect(() => {
    if (!isOpen) {
      cancelExport();
      cancelBatchExport();
    }
  }, [isOpen, cancelExport, cancelBatchExport]);

  useEffect(() => {
    cancelBatchExport();
  }, [score, targetCamera, sampleMode, themeCategory, localDofBlur, cancelBatchExport]);

  const panelsByKey = useMemo(() => {
    return new Map(panels.map((p) => [p.sample.key, p]));
  }, [panels]);

  const shotGroups = useMemo(
    () => groupStoryboardSamplesByShot(samples),
    [samples]
  );

  const sheetSummary = useMemo(
    () => summarizeStoryboardSheet(shotGroups, targetCamera),
    [shotGroups, targetCamera]
  );

  const effectiveAspect = resolveExportAspectRatio(
    score.aspectRatio,
    targetCamera
  );

  const exportDims = useMemo(
    () => computeExportDimensions(exportTier, effectiveAspect),
    [exportTier, effectiveAspect]
  );

  const handleExportSample = useCallback(
    (sample: StoryboardSamplePoint) => {
      const shouldBurnOverlay =
        exportIncludeOverlays && (annotated || guideMode !== 'off');
      exportPanel({
        score,
        sample,
        targetCamera,
        themeCategory,
        dofBlurEnabled: localDofBlur,
        tier: exportTier,
        format: exportFormat,
        postProcessCanvas: shouldBurnOverlay
          ? (sourceCanvas) =>
              renderStoryboardOverlayBurnIn(sourceCanvas, {
                guideMode,
                includeSlate: annotated,
                shotNumber: sample.shot.shotNumber,
                beatTag: sample.beatTag,
                stageTimeSec: sample.stageTimeSec,
                startSec: sample.shot.startSec,
                endSec: sample.shot.endSec,
              })
          : undefined,
      });
    },
    [
      exportPanel,
      score,
      targetCamera,
      themeCategory,
      localDofBlur,
      exportTier,
      exportFormat,
      exportIncludeOverlays,
      annotated,
      guideMode,
    ]
  );

  const layoutSpec = useMemo(
    () =>
      resolveStoryboardLayoutSpec(
        effectiveAspect,
        sampleMode,
        density,
        annotated
      ),
    [effectiveAspect, sampleMode, density, annotated]
  );

  const gateLabel = formatFilmGateLabel(effectiveAspect);
  const layoutMode: StoryboardCardLayoutMode =
    sampleMode === 'start-mid-end'
      ? 'single-row'
      : sampleMode === 'start-end'
        ? 'start-end'
        : 'grid';

  const handleExportContactSheet = useCallback(
    (singlePage = false) => {
      if (
        panelDownloadingKey ||
        isBatchExporting ||
        isGenerating ||
        panels.length < totalCount ||
        shotGroups.length === 0
      ) {
        return;
      }
      void exportContactSheet({
        score,
        targetCamera,
        annotated,
        renderSheetPages: () =>
          renderStoryboardContactSheetPages(
            {
              score,
              shotGroups,
              panelsByKey,
              sheetSummary,
              gateLabel,
              panelWidth: dims.width,
              panelHeight: dims.height,
              targetCamera,
              layoutSpec,
              layoutMode,
              annotated,
              guideMode,
              totalCount,
            },
            { singlePage }
          ),
      });
    },
    [
      panelDownloadingKey,
      isBatchExporting,
      isGenerating,
      panels.length,
      totalCount,
      shotGroups,
      exportContactSheet,
      score,
      targetCamera,
      annotated,
      panelsByKey,
      sheetSummary,
      gateLabel,
      dims.width,
      dims.height,
      layoutSpec,
      layoutMode,
      guideMode,
    ]
  );

  const sheetPageCount = useMemo(
    () =>
      isOpen
        ? estimateStoryboardContactSheetPageCount({
            shotGroups,
            sheetSummary,
            panelWidth: dims.width,
            panelHeight: dims.height,
            targetCamera,
            layoutSpec,
            layoutMode,
            annotated,
          })
        : 1,
    [
      isOpen,
      shotGroups,
      sheetSummary,
      dims.width,
      dims.height,
      targetCamera,
      layoutSpec,
      layoutMode,
      annotated,
    ]
  );

  const handleExportAllZip = useCallback(() => {
    if (panelDownloadingKey || isBatchExporting || samples.length === 0) {
      return;
    }
    const shouldBurnOverlay =
      exportIncludeOverlays && (annotated || guideMode !== 'off');
    exportAllZip({
      score,
      samples,
      targetCamera,
      themeCategory,
      dofBlurEnabled: localDofBlur,
      tier: exportTier,
      format: exportFormat,
      postProcessCanvas: shouldBurnOverlay
        ? (sourceCanvas, sample) =>
            renderStoryboardOverlayBurnIn(sourceCanvas, {
              guideMode,
              includeSlate: annotated,
              shotNumber: sample.shot.shotNumber,
              beatTag: sample.beatTag,
              stageTimeSec: sample.stageTimeSec,
              startSec: sample.shot.startSec,
              endSec: sample.shot.endSec,
            })
        : undefined,
    });
  }, [
    panelDownloadingKey,
    isBatchExporting,
    samples,
    exportIncludeOverlays,
    annotated,
    guideMode,
    exportAllZip,
    score,
    targetCamera,
    themeCategory,
    localDofBlur,
    exportTier,
    exportFormat,
  ]);

  if (!isOpen) return null;

  const initialFrame = samples[0]?.frame;
  const gridClass = GRID_COLUMN_CLASS[layoutSpec.columns];
  const isAnyExportBusy = Boolean(panelDownloadingKey) || isBatchExporting;
  const canExportSheet =
    !isGenerating &&
    !isAnyExportBusy &&
    shotGroups.length > 0 &&
    panels.length >= totalCount;
  const canExportZip = !isAnyExportBusy && samples.length > 0;
  const exportFormatLabel =
    exportFormat === 'jpeg' ? 'JPG' : exportFormat.toUpperCase();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="storyboard-modal-title"
      className={UI_TOKENS.modal.overlay}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[1440px] h-[94vh] sm:h-[92vh] md:h-[90vh] bg-surface rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-border-main text-text-main"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={UI_TOKENS.modal.headerSubtle}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
              <LayoutGrid className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="storyboard-modal-title"
                className="text-sm font-bold text-text-main tracking-tight"
              >
                Storyboard
              </h2>
              <p className="text-[11px] font-mono text-text-muted truncate">
                {score.title} · {score.shots.length}{' '}
                {score.shots.length === 1 ? 'Shot' : 'Shots'} · {gateLabel} ·{' '}
                {score.durationSec.toFixed(1)}s
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close storyboard"
            className={UI_TOKENS.button.iconClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2-Column Body */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          <StoryboardControlsSidebar
            sampleMode={sampleMode}
            onChangeSampleMode={setSampleMode}
            targetCamera={targetCamera}
            onChangeTargetCamera={setTargetCamera}
            themeCategory={themeCategory}
            onChangeThemeCategory={setThemeCategory}
            dofBlurEnabled={localDofBlur}
            onChangeDofBlurEnabled={setLocalDofBlur}
            density={density}
            layoutSpec={layoutSpec}
            onChangeDensity={setDensity}
            guideMode={guideMode}
            onChangeGuideMode={setGuideMode}
            annotated={annotated}
            onChangeAnnotated={setAnnotated}
            exportTier={exportTier}
            onChangeExportTier={setExportTier}
            exportFormat={exportFormat}
            onChangeExportFormat={setExportFormat}
            exportIncludeOverlays={exportIncludeOverlays}
            onChangeExportIncludeOverlays={setExportIncludeOverlays}
            exportWidth={exportDims.width}
            exportHeight={exportDims.height}
            isGenerating={isGenerating}
            panelWidth={dims.width}
            panelHeight={dims.height}
            shotCount={shotGroups.length}
            panelCount={totalCount}
            onRegenerate={regenerate}
          />

          {/* Scrollable Contact Sheet Preview */}
          <div className="flex-1 min-w-0 overflow-y-auto bg-app/60 p-3.5 sm:p-5">
            <div className="w-full mx-auto rounded-2xl border border-border-main bg-surface p-4 sm:p-5 shadow-sm space-y-4">
              {/* Contact Sheet Header + Lens/Rig Summary */}
              <div className="pb-3.5 border-b border-border-subtle space-y-2.5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-faint">
                      Storyboard Contact Sheet
                    </div>
                    <h3 className="text-base font-bold text-text-main truncate">
                      {score.title}
                    </h3>
                  </div>
                  <div className="text-[11px] font-mono text-text-muted text-right">
                    <div>
                      {shotGroups.length}{' '}
                      {shotGroups.length === 1 ? 'Shot' : 'Shots'} · {totalCount}{' '}
                      {totalCount === 1 ? 'Frame' : 'Frames'} ·{' '}
                      {targetCamera === 'observer'
                        ? 'Observer Diorama'
                        : 'Stage Cam POV'}
                    </div>
                    <div className="text-[10px] text-text-faint">
                      {gateLabel} · {dims.width}×{dims.height}
                      {sheetPageCount > 1 && (
                        <span className="ml-1.5 inline-flex items-center px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold">
                          {sheetPageCount} Pages
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {shotGroups.length > 0 && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-text-muted">
                    {sheetSummary.lenses.length > 0 && (
                      <div className="flex flex-wrap items-baseline gap-x-1.5">
                        <span className="text-[9px] uppercase tracking-wider text-text-faint">
                          Lenses
                        </span>
                        <span className="text-text-body">
                          {sheetSummary.lenses
                            .map((item) => `${item.label} ×${item.count}`)
                            .join(' · ')}
                        </span>
                      </div>
                    )}

                    {sheetSummary.maneuvers.length > 0 && (
                      <>
                        <span className="text-border-main select-none">|</span>
                        <div className="flex flex-wrap items-baseline gap-x-1.5">
                          <span className="text-[9px] uppercase tracking-wider text-text-faint">
                            Moves
                          </span>
                          <span className="text-text-body">
                            {sheetSummary.maneuvers
                              .map((item) => `${item.label} ×${item.count}`)
                              .join(' · ')}
                          </span>
                        </div>
                      </>
                    )}

                    {sheetSummary.rigs.length > 0 && (
                      <>
                        <span className="text-border-main select-none">|</span>
                        <div className="flex flex-wrap items-baseline gap-x-1.5">
                          <span className="text-[9px] uppercase tracking-wider text-text-faint">
                            Rigs
                          </span>
                          <span className="text-text-body">
                            {sheetSummary.rigs
                              .map((item) => `${item.label} ×${item.count}`)
                              .join(' · ')}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {shotGroups.length === 0 ? (
                <div className="py-16 text-center text-xs font-mono text-text-muted">
                  No shots defined in this choreography score yet.
                </div>
              ) : (
                <div className={`grid gap-4 ${gridClass}`}>
                  {shotGroups.map((group) => (
                    <StoryboardPanelCard
                      key={group.key}
                      group={group}
                      panelsByKey={panelsByKey}
                      width={dims.width}
                      height={dims.height}
                      targetCamera={targetCamera}
                      annotated={annotated}
                      guideMode={guideMode}
                      layoutMode={layoutMode}
                      isPortrait={layoutSpec.isPortrait}
                      effectiveDensity={layoutSpec.effectiveDensity}
                      downloadingKey={
                        panelDownloadingKey ??
                        (isBatchExporting ? '__batch__' : null)
                      }
                      exportTier={exportTier}
                      exportFormat={exportFormat}
                      onExportSample={handleExportSample}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Status Bar */}
        <div className="px-4 sm:px-5 py-3 border-t border-border-subtle bg-surface-subtle flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 text-xs font-mono text-text-muted min-w-0">
            {batchProgress ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500 shrink-0" />
                <span className="truncate">
                  {batchProgress.mode === 'zip'
                    ? `Exporting ZIP ${batchProgress.completed} / ${batchProgress.total}...`
                    : batchProgress.total > 1
                      ? `Encoding Sheet ${batchProgress.completed} / ${batchProgress.total}...`
                      : 'Compositing Contact Sheet...'}
                </span>
                <button
                  type="button"
                  onClick={cancelBatchExport}
                  className="px-2 py-0.5 rounded-md border border-border-main bg-surface hover:bg-surface-hover text-[11px] font-semibold text-text-body hover:text-text-main transition-colors cursor-pointer shrink-0"
                >
                  Cancel
                </button>
              </>
            ) : isGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500 shrink-0" />
                <span>
                  Rendering frame {Math.min(progressIndex + 1, totalCount)} of{' '}
                  {totalCount}...
                </span>
              </>
            ) : (
              <span>
                {panels.length} / {totalCount}{' '}
                {totalCount === 1 ? 'frame' : 'frames'} ready · {dims.width}×
                {dims.height}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={!canExportSheet}
              onClick={() => handleExportContactSheet(false)}
              title={
                isGenerating
                  ? 'Wait for preview frames to finish rendering'
                  : sheetPageCount > 1
                    ? `Download ${sheetPageCount}-page Contact Sheet bundle (.zip)`
                    : 'Download Contact Sheet as clean white-paper PNG'
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border-main bg-surface hover:bg-surface-hover text-xs font-semibold text-text-main disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {batchProgress?.mode === 'contact-sheet' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
              ) : (
                <FileImage className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span>
                {sheetPageCount > 1
                  ? `Contact Sheet (${sheetPageCount}p .zip)`
                  : 'Contact Sheet'}
              </span>
            </button>

            {sheetPageCount > 1 && (
              <button
                type="button"
                disabled={!canExportSheet}
                onClick={() => handleExportContactSheet(true)}
                title={`Download all ${sheetPageCount} pages combined into one tall single-page PNG`}
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-border-main bg-surface hover:bg-surface-hover text-xs font-semibold text-text-muted hover:text-text-main disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <span>1-Page PNG</span>
              </button>
            )}

            <button
              type="button"
              disabled={!canExportZip}
              onClick={handleExportAllZip}
              title={`Download all ${samples.length} frames as ${exportTier}p ${exportFormatLabel} (.zip)`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-btn-primary-bg text-btn-primary-text hover:bg-btn-primary-hover text-xs font-bold shadow-sm disabled:opacity-45 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {batchProgress?.mode === 'zip' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Archive className="w-3.5 h-3.5" />
              )}
              <span>Download All (.zip)</span>
            </button>

            <StoryboardSpecGuidePopover
              isOpen={isSpecGuideOpen}
              onToggle={() => setIsSpecGuideOpen((prev) => !prev)}
              onClose={() => setIsSpecGuideOpen(false)}
            />
            <button
              type="button"
              onClick={onClose}
              className={UI_TOKENS.button.secondary}
            >
              Close
            </button>
          </div>
        </div>

        {/* Offscreen WebGL Renderer (mounted strictly during preview batch capture) */}
        {isCanvasMounted && initialFrame && (
          <CleanStageCamExportCanvas
            key={canvasKey}
            ref={canvasRef}
            score={score}
            initialFrame={initialFrame}
            width={dims.width}
            height={dims.height}
            dofBlurEnabled={localDofBlur}
            themeCategory={themeCategory}
            targetCamera={targetCamera}
          />
        )}

        {/* Dedicated 1-Frame Offscreen WebGL Renderer (mounted strictly during single-panel export) */}
        {panelExportPendingRequest && (
          <CleanStageCamExportCanvas
            key={`export-${panelExportPendingRequest.sample.key}-${panelExportPendingRequest.tier}`}
            ref={panelExportCanvasRef}
            score={panelExportPendingRequest.score}
            initialFrame={panelExportPendingRequest.sample.frame}
            width={panelExportPendingRequest.width}
            height={panelExportPendingRequest.height}
            dofBlurEnabled={panelExportPendingRequest.dofBlurEnabled}
            themeCategory={panelExportPendingRequest.themeCategory}
            targetCamera={panelExportPendingRequest.targetCamera}
          />
        )}

        {/* Dedicated Offscreen WebGL Renderer (mounted strictly during Download All ZIP export) */}
        {pendingZipRequest && pendingZipRequest.samples[0] && (
          <CleanStageCamExportCanvas
            key={`zip-${pendingZipRequest.zipFilename}-${pendingZipRequest.tier}`}
            ref={batchZipCanvasRef}
            score={pendingZipRequest.score}
            initialFrame={pendingZipRequest.samples[0].frame}
            width={pendingZipRequest.width}
            height={pendingZipRequest.height}
            dofBlurEnabled={pendingZipRequest.dofBlurEnabled}
            themeCategory={pendingZipRequest.themeCategory}
            targetCamera={pendingZipRequest.targetCamera}
          />
        )}
      </div>
    </div>
  );
};
