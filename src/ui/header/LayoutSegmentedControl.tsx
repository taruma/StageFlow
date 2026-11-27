/**
 * LayoutSegmentedControl Component for StageFlow Studio Header.
 * Houses the workspace layout modes (Split | Full) and the companion
 * [ Edit ] toggle opening the Dual-Mode Choreography Score Studio ([ Visual | YAML ]).
 */

import React from 'react';
import { Columns2, Maximize2, Pencil } from 'lucide-react';
import type { SplitPreset } from '../../core/types';
import { UI_TOKENS } from '../tokens/ui';

export interface LayoutSegmentedControlProps {
  splitPreset: SplitPreset;
  onSelectSplitPreset: (preset: SplitPreset) => void;
  isEditMode: boolean;
  onToggleEditMode: () => void;
}

export const LayoutSegmentedControl: React.FC<LayoutSegmentedControlProps> = ({
  splitPreset,
  onSelectSplitPreset,
  isEditMode,
  onToggleEditMode,
}) => {
  return (
    <div className="flex items-center gap-1.5">
      <div
        role="group"
        aria-label="Workspace Layout Modes"
        className={UI_TOKENS.button.segmentedGroup}
      >
        <button
          type="button"
          role="button"
          aria-pressed={splitPreset === 'split'}
          onClick={() => onSelectSplitPreset('split')}
          className={
            splitPreset === 'split'
              ? UI_TOKENS.button.segmentedItemActive
              : UI_TOKENS.button.segmentedItem
          }
          title="Side-by-side Video and 3D Diorama Stage"
        >
          <Columns2 className="w-3.5 h-3.5" />
          <span>Split</span>
        </button>

        <button
          type="button"
          role="button"
          aria-pressed={splitPreset === 'full'}
          onClick={() => onSelectSplitPreset('full')}
          className={
            splitPreset === 'full'
              ? UI_TOKENS.button.segmentedItemActive
              : UI_TOKENS.button.segmentedItem
          }
          title="Full-Screen 3D Diorama Stage"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>Full</span>
        </button>
      </div>

      {/* Companion [ Edit ] Authoring Studio Toggle */}
      <button
        type="button"
        aria-pressed={isEditMode}
        onClick={onToggleEditMode}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-[10px] lg:text-xs font-bold transition-all active:scale-95 cursor-pointer ${
          isEditMode
            ? 'bg-surface border-amber-500/40 text-amber-600 dark:text-amber-400 shadow-xs ring-1 ring-amber-500/20'
            : 'bg-surface-muted border-border-main text-text-muted hover:text-text-main hover:bg-surface-subtle'
        }`}
        title={
          isEditMode
            ? 'Close Choreography Score Editor'
            : 'Open Choreography Score Editor (Visual / YAML)'
        }
      >
        <Pencil className="w-3.5 h-3.5" />
        <span>Edit</span>
      </button>
    </div>
  );
};
