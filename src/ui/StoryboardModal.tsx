/**
 * Storyboard Contact Sheet Generator & Viewer Modal (Phase 1).
 * Renders shot panels progressively offscreen via a single CleanStageCamExportCanvas,
 * displays them as lightweight <img> cards in a configurable 2/3/4-column sheet,
 * and unmounts the WebGL renderer immediately when generation completes.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, LayoutGrid, Loader2, X } from 'lucide-react';
import {
  resolveExportAspectRatio,
  type ExportTargetCamera,
} from '../core/exportMath';
import type {
  StoryboardColumns,
  StoryboardSampleMode,
} from '../core/storyboardMath';
import type { AppThemeCategory, StageScore } from '../core/types';
import { useStoryboardGenerator } from '../hooks/useStoryboardGenerator';
import { CleanStageCamExportCanvas } from '../stage/CleanStageCamExportCanvas';
import { formatFilmGateLabel } from './shotBreakdownUtils';
import { StoryboardControlsSidebar } from './StoryboardControlsSidebar';
import { StoryboardPanelCard } from './StoryboardPanelCard';
import { UI_TOKENS } from './tokens/ui';

export interface StoryboardModalProps {
  isOpen: boolean;
  score: StageScore;
  dofBlurEnabled: boolean;
  onClose: () => void;
}

const GRID_COLUMN_CLASS: Record<StoryboardColumns, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

export const StoryboardModal: React.FC<StoryboardModalProps> = ({
  isOpen,
  score,
  dofBlurEnabled,
  onClose,
}) => {
  const [sampleMode, setSampleMode] = useState<StoryboardSampleMode>('mid');
  const [targetCamera, setTargetCamera] =
    useState<ExportTargetCamera>('stage-cam');
  const [themeCategory, setThemeCategory] = useState<AppThemeCategory>('light');
  const [localDofBlur, setLocalDofBlur] = useState<boolean>(dofBlurEnabled);
  const [columns, setColumns] = useState<StoryboardColumns>(3);
  const [annotated, setAnnotated] = useState<boolean>(true);

  // Sync DoF blur toggle from active Stage Cam state whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalDofBlur(dofBlurEnabled);
    }
  }, [isOpen, dofBlurEnabled]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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

  const panelByKey = useMemo(() => {
    const map = new Map(panels.map((p) => [p.sample.key, p]));
    return map;
  }, [panels]);

  if (!isOpen) return null;

  const effectiveAspect = resolveExportAspectRatio(
    score.aspectRatio,
    targetCamera
  );
  const gateLabel = formatFilmGateLabel(effectiveAspect);
  const initialFrame = samples[0]?.frame;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="storyboard-modal-title"
      className={UI_TOKENS.modal.overlay}
      onClick={onClose}
    >
      <div
        className={UI_TOKENS.modal.containerLibrary}
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
            columns={columns}
            onChangeColumns={setColumns}
            annotated={annotated}
            onChangeAnnotated={setAnnotated}
            isGenerating={isGenerating}
            panelWidth={dims.width}
            panelHeight={dims.height}
            panelCount={totalCount}
            onRegenerate={regenerate}
          />

          {/* Scrollable Contact Sheet Preview */}
          <div className="flex-1 min-w-0 overflow-y-auto bg-app/60 p-4 sm:p-6">
            <div className="max-w-5xl mx-auto rounded-2xl border border-border-main bg-surface p-4 sm:p-6 shadow-sm space-y-5">
              {/* Contact Sheet Header */}
              <div className="flex flex-wrap items-end justify-between gap-3 pb-3.5 border-b border-border-subtle">
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
                    {totalCount} {totalCount === 1 ? 'Panel' : 'Panels'} ·{' '}
                    {targetCamera === 'observer'
                      ? 'Observer Diorama'
                      : 'Stage Cam POV'}
                  </div>
                  <div className="text-[10px] text-text-faint">
                    {gateLabel} · {dims.width}×{dims.height}
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {samples.length === 0 ? (
                <div className="py-16 text-center text-xs font-mono text-text-muted">
                  No shots defined in this choreography score yet.
                </div>
              ) : (
                <div className={`grid gap-4 ${GRID_COLUMN_CLASS[columns]}`}>
                  {samples.map((sample) => (
                    <StoryboardPanelCard
                      key={sample.key}
                      sample={sample}
                      panel={panelByKey.get(sample.key)}
                      width={dims.width}
                      height={dims.height}
                      targetCamera={targetCamera}
                      annotated={annotated}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Status Bar */}
        <div className="px-5 py-3 border-t border-border-subtle bg-surface-subtle flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
            {isGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                <span>
                  Rendering panel {Math.min(progressIndex + 1, totalCount)} of{' '}
                  {totalCount}...
                </span>
              </>
            ) : (
              <span>
                {panels.length} / {totalCount}{' '}
                {totalCount === 1 ? 'panel' : 'panels'} ready · {dims.width}×
                {dims.height}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className={UI_TOKENS.button.secondary}
          >
            Close
          </button>
        </div>

        {/* Offscreen WebGL Renderer (mounted strictly during batch capture) */}
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
      </div>
    </div>
  );
};
