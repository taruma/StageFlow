/**
 * Left configuration sidebar for the Storyboard Modal.
 * Separates WebGL render parameters (Sample, Camera, Palette, DoF)
 * from instant client-side sheet layout controls (Columns, Annotations).
 */

import React from 'react';
import { Camera, Eye, RefreshCw } from 'lucide-react';
import type { ExportTargetCamera } from '../core/exportMath';
import type {
  StoryboardColumns,
  StoryboardSampleMode,
} from '../core/storyboardMath';
import type { AppThemeCategory } from '../core/types';
import { UI_TOKENS } from './tokens/ui';

export interface StoryboardControlsSidebarProps {
  sampleMode: StoryboardSampleMode;
  onChangeSampleMode: (mode: StoryboardSampleMode) => void;
  targetCamera: ExportTargetCamera;
  onChangeTargetCamera: (cam: ExportTargetCamera) => void;
  themeCategory: AppThemeCategory;
  onChangeThemeCategory: (theme: AppThemeCategory) => void;
  dofBlurEnabled: boolean;
  onChangeDofBlurEnabled: (enabled: boolean) => void;
  columns: StoryboardColumns;
  onChangeColumns: (cols: StoryboardColumns) => void;
  annotated: boolean;
  onChangeAnnotated: (annotated: boolean) => void;
  isGenerating: boolean;
  panelWidth: number;
  panelHeight: number;
  panelCount: number;
  onRegenerate: () => void;
}

const SINGLE_ANCHOR_OPTIONS: ReadonlyArray<{
  id: Exclude<StoryboardSampleMode, 'start-end'>;
  label: string;
}> = [
  { id: 'start', label: 'Start' },
  { id: 'mid', label: 'Mid' },
  { id: 'end', label: 'End' },
];

const PALETTE_OPTIONS: ReadonlyArray<{ id: AppThemeCategory; label: string }> = [
  { id: 'light', label: 'Light' },
  { id: 'warm', label: 'Warm' },
  { id: 'dark', label: 'Dark' },
];

const COLUMN_OPTIONS: ReadonlyArray<StoryboardColumns> = [2, 3, 4];

export const StoryboardControlsSidebar: React.FC<
  StoryboardControlsSidebarProps
> = ({
  sampleMode,
  onChangeSampleMode,
  targetCamera,
  onChangeTargetCamera,
  themeCategory,
  onChangeThemeCategory,
  dofBlurEnabled,
  onChangeDofBlurEnabled,
  columns,
  onChangeColumns,
  annotated,
  onChangeAnnotated,
  isGenerating,
  panelWidth,
  panelHeight,
  panelCount,
  onRegenerate,
}) => {
  const isObserver = targetCamera === 'observer';

  return (
    <aside className="w-full md:w-[232px] shrink-0 border-b md:border-b-0 md:border-r border-border-subtle bg-surface-subtle/50 p-3 space-y-2.5 overflow-y-auto">
      {/* Sample per Shot */}
      <div className="space-y-1">
        <span className={UI_TOKENS.input.label}>Sample per Shot</span>
        <div className={`${UI_TOKENS.button.segmentedGroup} w-full`}>
          {SINGLE_ANCHOR_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChangeSampleMode(opt.id)}
              className={`flex-1 justify-center !px-2 ${
                sampleMode === opt.id
                  ? UI_TOKENS.button.segmentedItemActive
                  : UI_TOKENS.button.segmentedItem
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onChangeSampleMode('start-end')}
          className={`w-full justify-center py-1 rounded-xl border text-[10px] font-semibold transition-all cursor-pointer ${
            sampleMode === 'start-end'
              ? 'bg-surface text-text-main border-border-main shadow-xs'
              : 'bg-surface-muted/60 text-text-muted border-border-subtle hover:text-text-main hover:bg-surface'
          }`}
        >
          Start &amp; End (Moving Shots)
        </button>
      </div>

      {/* Target Camera */}
      <div className="space-y-1">
        <span className={UI_TOKENS.input.label}>Camera</span>
        <div className={`${UI_TOKENS.button.segmentedGroup} w-full`}>
          <button
            type="button"
            onClick={() => onChangeTargetCamera('stage-cam')}
            className={`flex-1 justify-center !px-2 ${
              targetCamera === 'stage-cam'
                ? UI_TOKENS.button.segmentedItemActive
                : UI_TOKENS.button.segmentedItem
            }`}
          >
            <Camera className="w-3 h-3 text-amber-500 shrink-0" />
            <span>Stage Cam</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeTargetCamera('observer')}
            className={`flex-1 justify-center !px-2 ${
              targetCamera === 'observer'
                ? UI_TOKENS.button.segmentedItemActive
                : UI_TOKENS.button.segmentedItem
            }`}
          >
            <Eye className="w-3 h-3 text-sky-500 shrink-0" />
            <span>Observer</span>
          </button>
        </div>
      </div>

      {/* Stage Palette */}
      <div className="space-y-1">
        <span className={UI_TOKENS.input.label}>Stage Palette</span>
        <div className={`${UI_TOKENS.button.segmentedGroup} w-full`}>
          {PALETTE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChangeThemeCategory(opt.id)}
              className={`flex-1 justify-center !px-2 ${
                themeCategory === opt.id
                  ? UI_TOKENS.button.segmentedItemActive
                  : UI_TOKENS.button.segmentedItem
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Optical DoF Blur */}
      <div className="space-y-1">
        <span className={UI_TOKENS.input.label}>Optical DoF Blur</span>
        <div
          title={
            isObserver
              ? 'Optical DoF Blur applies to Stage Cam view only'
              : 'Toggle thin-lens Depth-of-Field bokeh simulation'
          }
          className={`${UI_TOKENS.button.segmentedGroup} w-full ${
            isObserver ? 'opacity-45' : ''
          }`}
        >
          {(
            [
              { value: true, label: 'On' },
              { value: false, label: 'Off' },
            ] as const
          ).map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              disabled={isObserver}
              onClick={() => onChangeDofBlurEnabled(opt.value)}
              className={`flex-1 justify-center !px-2 disabled:cursor-not-allowed ${
                !isObserver && dofBlurEnabled === opt.value
                  ? UI_TOKENS.button.segmentedItemActive
                  : UI_TOKENS.button.segmentedItem
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-border-subtle pt-2.5 space-y-2.5">
        {/* Sheet Columns */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className={UI_TOKENS.input.label}>Columns</span>
            <span className="text-[9px] font-mono uppercase tracking-wider text-text-faint">
              Instant
            </span>
          </div>
          <div className={`${UI_TOKENS.button.segmentedGroup} w-full`}>
            {COLUMN_OPTIONS.map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => onChangeColumns(col)}
                className={`flex-1 justify-center !px-2 font-mono ${
                  columns === col
                    ? UI_TOKENS.button.segmentedItemActive
                    : UI_TOKENS.button.segmentedItem
                }`}
              >
                {col}
              </button>
            ))}
          </div>
        </div>

        {/* Annotations */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className={UI_TOKENS.input.label}>Annotations</span>
            <span className="text-[9px] font-mono uppercase tracking-wider text-text-faint">
              Instant
            </span>
          </div>
          <div className={`${UI_TOKENS.button.segmentedGroup} w-full`}>
            <button
              type="button"
              onClick={() => onChangeAnnotated(true)}
              className={`flex-1 justify-center !px-2 ${
                annotated
                  ? UI_TOKENS.button.segmentedItemActive
                  : UI_TOKENS.button.segmentedItem
              }`}
            >
              Annotated
            </button>
            <button
              type="button"
              onClick={() => onChangeAnnotated(false)}
              className={`flex-1 justify-center !px-2 ${
                !annotated
                  ? UI_TOKENS.button.segmentedItemActive
                  : UI_TOKENS.button.segmentedItem
              }`}
            >
              Clean Only
            </button>
          </div>
        </div>
      </div>

      {/* Render Telemetry & Refresh */}
      <div className="pt-0.5">
        <div className="px-2.5 py-2 rounded-xl bg-surface border border-border-subtle flex items-center justify-between gap-2 text-[11px] font-mono text-text-muted">
          <div className="min-w-0">
            <div className="text-text-main font-semibold leading-tight">
              {panelCount} {panelCount === 1 ? 'Panel' : 'Panels'}
            </div>
            <div className="text-[10px] text-text-faint leading-tight">
              {panelWidth}×{panelHeight} · 540p Preview
            </div>
          </div>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={panelCount === 0}
            title="Re-render storyboard frames"
            aria-label="Re-render storyboard frames"
            className="p-1.5 rounded-lg border border-border-main bg-surface-subtle hover:bg-surface-hover text-text-body hover:text-text-main disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>
    </aside>
  );
};
