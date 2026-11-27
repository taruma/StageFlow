/**
 * Directorial Action Bar for the Score Editor ([ Visual | YAML ]).
 * Houses Undo/Redo, mode-specific helpers (Collapse/Expand/Active Shot or Wrap),
 * Copy, and Fork-to-Edit action pills.
 */

import React, { useState, useCallback } from 'react';
import {
  ArrowRight,
  Check,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  Crosshair,
  Redo2,
  Undo2,
  WrapText,
} from 'lucide-react';
import type { EditorStudioMode } from '../../core/types';

export interface YamlActionBarProps {
  editorMode: EditorStudioMode;
  rawYaml: string;
  isBundled: boolean;
  wordWrap: boolean;
  canUndo: boolean;
  canRedo: boolean;
  hasActiveShot?: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onToggleWordWrap: () => void;
  onCollapseAll?: () => void;
  onExpandAll?: () => void;
  onJumpToActiveShot?: () => void;
  onForkScore?: () => void;
}

export const YamlActionBar: React.FC<YamlActionBarProps> = React.memo(
  ({
    editorMode,
    rawYaml,
    isBundled,
    wordWrap,
    canUndo,
    canRedo,
    hasActiveShot = false,
    onUndo,
    onRedo,
    onToggleWordWrap,
    onCollapseAll,
    onExpandAll,
    onJumpToActiveShot,
    onForkScore,
  }) => {
    const [copied, setCopied] = useState(false);

    const handleCopyAll = useCallback(() => {
      navigator.clipboard.writeText(rawYaml);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }, [rawYaml]);

    return (
      <div className="px-3.5 py-1.5 border-b border-border-subtle bg-surface flex items-center justify-between gap-1.5 select-none shrink-0 flex-wrap">
        <div className="flex items-center gap-1">
          {/* Unified Document Undo / Redo */}
          {!isBundled && (
            <div className="inline-flex items-center gap-0.5 mr-0.5">
              <button
                type="button"
                disabled={!canUndo}
                onClick={onUndo}
                className="p-1 rounded-md bg-surface-subtle hover:bg-surface-hover border border-border-main text-text-body disabled:opacity-35 disabled:pointer-events-none cursor-pointer transition-colors"
                title="Undo (Ctrl+Z / Cmd+Z)"
                aria-label="Undo"
              >
                <Undo2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                disabled={!canRedo}
                onClick={onRedo}
                className="p-1 rounded-md bg-surface-subtle hover:bg-surface-hover border border-border-main text-text-body disabled:opacity-35 disabled:pointer-events-none cursor-pointer transition-colors"
                title="Redo (Ctrl+Shift+Z / Ctrl+Y)"
                aria-label="Redo"
              >
                <Redo2 className="w-3 h-3" />
              </button>
            </div>
          )}

          {editorMode === 'yaml' ? (
            <button
              type="button"
              onClick={onToggleWordWrap}
              className={`px-2 py-1 rounded-md border text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-all shadow-2xs active:scale-95 ${
                wordWrap
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-medium'
                  : 'bg-surface-subtle hover:bg-surface-hover border-border-main text-text-body hover:text-text-main'
              }`}
              title={
                wordWrap
                  ? 'Disable soft line-wrapping'
                  : 'Enable soft line-wrapping'
              }
            >
              <WrapText className="w-3 h-3" />
              <span>Wrap</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-1">
              {onCollapseAll && (
                <button
                  type="button"
                  onClick={onCollapseAll}
                  className="px-1.5 py-1 rounded-md bg-surface-subtle hover:bg-surface-hover border border-border-main text-[10px] font-mono text-text-body hover:text-text-main flex items-center gap-1 cursor-pointer transition-colors"
                  title="Collapse all sections and cards"
                >
                  <ChevronsDownUp className="w-3 h-3 text-text-muted" />
                </button>
              )}
              {onExpandAll && (
                <button
                  type="button"
                  onClick={onExpandAll}
                  className="px-1.5 py-1 rounded-md bg-surface-subtle hover:bg-surface-hover border border-border-main text-[10px] font-mono text-text-body hover:text-text-main flex items-center gap-1 cursor-pointer transition-colors"
                  title="Expand all sections and cards"
                >
                  <ChevronsUpDown className="w-3 h-3 text-text-muted" />
                </button>
              )}
              {hasActiveShot && onJumpToActiveShot && (
                <button
                  type="button"
                  onClick={onJumpToActiveShot}
                  className="px-2 py-1 rounded-md bg-surface-subtle hover:bg-surface-hover border border-border-main text-[10px] font-mono text-text-body hover:text-amber-500 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Scroll to currently active playhead shot"
                >
                  <Crosshair className="w-3 h-3 text-amber-500" />
                  <span>Active</span>
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleCopyAll}
            className="px-2 py-1 rounded-md bg-surface-subtle hover:bg-surface-hover border border-border-main text-[10px] font-mono text-text-body hover:text-text-main flex items-center gap-1 cursor-pointer transition-all shadow-2xs active:scale-95"
            title="Copy full YAML score"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-300">
                  Copied
                </span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-text-muted" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {isBundled && onForkScore && (
          <button
            type="button"
            onClick={onForkScore}
            className="px-2 py-1 rounded-md bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/30 text-[10px] font-mono text-sky-600 dark:text-sky-300 font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs active:scale-95"
            title="Fork this bundled blueprint into an editable Custom Project"
          >
            <span>Fork to Edit</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }
);
