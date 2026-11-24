/**
 * ScoreLibraryFooter Component for ScoreLibraryModal.
 * Shown when the Details Inspector is collapsed, keeping Load, Fork, Duplicate,
 * Rename, Export, and Delete accessible in a single compact bottom bar.
 */

import React, { useState, useEffect } from 'react';
import {
  Play,
  Check,
  GitFork,
  Download,
  Pencil,
  Copy,
  Trash2,
  AlertTriangle,
  X,
} from 'lucide-react';
import type { ScoreCatalogItem } from '../../core/scoreCatalog';

export interface ScoreLibraryFooterProps {
  item: ScoreCatalogItem | null;
  isActive: boolean;
  onSelectScore: () => void;
  onForkScore?: (item: ScoreCatalogItem) => void;
  onDuplicateScore?: (id: string) => void;
  onExportScore?: (item: ScoreCatalogItem) => void;
  onRenameScore?: (id: string, newTitle: string) => Promise<boolean>;
  onDeleteScore?: (id: string) => Promise<boolean>;
}

export const ScoreLibraryFooter: React.FC<ScoreLibraryFooterProps> = ({
  item,
  isActive,
  onSelectScore,
  onForkScore,
  onDuplicateScore,
  onExportScore,
  onRenameScore,
  onDeleteScore,
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [editTitle, setEditTitle] = useState(item?.title ?? '');
  const [isDeletingConfirm, setIsDeletingConfirm] = useState(false);

  useEffect(() => {
    setIsRenaming(false);
    setIsDeletingConfirm(false);
    setEditTitle(item?.title ?? '');
  }, [item?.id, item?.title]);

  if (!item) return null;

  const handleSaveRename = async () => {
    if (editTitle.trim() && editTitle.trim() !== item.title && onRenameScore) {
      await onRenameScore(item.id, editTitle.trim());
    }
    setIsRenaming(false);
  };

  return (
    <div className="border-t border-border-subtle bg-surface-subtle shrink-0 select-none">
      {isDeletingConfirm && (
        <div className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/30 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-mono font-medium truncate">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Permanently delete &ldquo;{item.title}&rdquo;?</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsDeletingConfirm(false)}
              className="px-2.5 py-1 rounded-lg bg-surface border border-border-main text-text-main hover:bg-surface-muted font-mono cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (onDeleteScore) {
                  await onDeleteScore(item.id);
                }
              }}
              className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-mono font-bold hover:bg-rose-700 shadow-xs cursor-pointer"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        {/* Left: Selected Title / Rename + Secondary Actions */}
        <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
          {isRenaming ? (
            <div className="flex items-center gap-1.5 min-w-[220px]">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename();
                  if (e.key === 'Escape') setIsRenaming(false);
                }}
                autoFocus
                className="px-2.5 py-1 rounded-lg bg-surface border border-border-main text-text-main text-xs font-sans focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSaveRename}
                className="px-2.5 py-1 rounded-lg bg-text-main text-surface text-xs font-mono font-bold cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsRenaming(false)}
                aria-label="Cancel rename"
                className="p-1 rounded-lg hover:bg-surface-muted text-text-faint hover:text-text-main cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0 mr-1">
              <span className="text-xs font-sans font-semibold text-text-main truncate max-w-[220px]">
                {item.title}
              </span>
              {item.isCustom && onRenameScore && (
                <button
                  type="button"
                  onClick={() => {
                    setEditTitle(item.title);
                    setIsRenaming(true);
                  }}
                  title="Rename Project"
                  className="p-1 rounded-lg text-text-faint hover:text-text-main hover:bg-surface transition-colors shrink-0 cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            {!item.isCustom && onForkScore && (
              <button
                type="button"
                onClick={() => onForkScore(item)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface border border-border-main hover:bg-surface-hover text-text-main text-[11px] font-mono font-medium transition-colors cursor-pointer"
                title="Clone this score into an editable Custom Project"
              >
                <GitFork className="w-3 h-3 text-text-muted" />
                <span>Fork to Edit</span>
              </button>
            )}

            {item.isCustom && onDuplicateScore && (
              <button
                type="button"
                onClick={() => onDuplicateScore(item.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface border border-border-main hover:bg-surface-hover text-text-main text-[11px] font-mono font-medium transition-colors cursor-pointer"
                title="Duplicate project"
              >
                <Copy className="w-3 h-3 text-text-muted" />
                <span>Duplicate</span>
              </button>
            )}

            {onExportScore && (
              <button
                type="button"
                onClick={() => onExportScore(item)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface border border-border-main hover:bg-surface-hover text-text-main text-[11px] font-mono font-medium transition-colors cursor-pointer"
                title="Export choreography score as .yaml file"
              >
                <Download className="w-3 h-3 text-text-muted" />
                <span>Export</span>
              </button>
            )}

            {item.isCustom && onDeleteScore && !isDeletingConfirm && (
              <button
                type="button"
                onClick={() => setIsDeletingConfirm(true)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-500/10 text-rose-500 text-[11px] font-mono transition-colors cursor-pointer"
                title="Delete custom project"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Primary Load Trigger */}
        <div className="shrink-0">
          {isActive ? (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-surface-muted text-text-muted border border-border-main text-xs font-mono font-bold opacity-80 cursor-default">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span>Loaded in Studio</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={onSelectScore}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-btn-primary-bg text-btn-primary-text font-mono font-bold text-xs shadow-sm hover:opacity-90 active:scale-98 transition-all cursor-pointer"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Load into Studio →</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
