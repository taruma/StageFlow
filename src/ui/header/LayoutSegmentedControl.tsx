/**
 * LayoutSegmentedControl Component for StageFlow Studio Header.
 * Houses the workspace layout modes (Split | Full) and the companion
 * [ Visual | YAML ] dual-mode authoring studio switcher.
 */

import React from 'react';
import { Code2, Columns2, Maximize2, SlidersHorizontal } from 'lucide-react';
import type { EditorStudioMode, SplitPreset } from '../../core/types';
import { UI_TOKENS } from '../tokens/ui';

export interface LayoutSegmentedControlProps {
  splitPreset: SplitPreset;
  onSelectSplitPreset: (preset: SplitPreset) => void;
  isEditMode: boolean;
  editorMode: EditorStudioMode;
  onSelectEditorMode: (mode: EditorStudioMode) => void;
}

export const LayoutSegmentedControl: React.FC<LayoutSegmentedControlProps> = ({
  splitPreset,
  onSelectSplitPreset,
  isEditMode,
  editorMode,
  onSelectEditorMode,
}) => {
  const isVisualActive = isEditMode && editorMode === 'visual';
  const isYamlActive = isEditMode && editorMode === 'yaml';

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

      {/* Companion [ Visual | YAML ] Authoring Studio Switcher */}
      <div
        role="group"
        aria-label="Authoring Editor Mode"
        className={UI_TOKENS.button.segmentedGroup}
      >
        <button
          type="button"
          role="button"
          aria-pressed={isVisualActive}
          onClick={() => onSelectEditorMode('visual')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] lg:text-xs font-bold transition-all active:scale-95 cursor-pointer ${
            isVisualActive
              ? 'bg-surface text-amber-600 dark:text-amber-400 shadow-xs ring-1 ring-amber-500/25'
              : 'text-text-muted hover:text-text-main hover:bg-surface-subtle'
          }`}
          title={
            isVisualActive
              ? 'Close Visual Score Editor'
              : 'Open YAML-Mirrored Visual Score Editor'
          }
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Visual</span>
        </button>

        <button
          type="button"
          role="button"
          aria-pressed={isYamlActive}
          onClick={() => onSelectEditorMode('yaml')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] lg:text-xs font-bold transition-all active:scale-95 cursor-pointer ${
            isYamlActive
              ? 'bg-surface text-amber-600 dark:text-amber-400 shadow-xs ring-1 ring-amber-500/25'
              : 'text-text-muted hover:text-text-main hover:bg-surface-subtle'
          }`}
          title={
            isYamlActive
              ? 'Close Live YAML Editor'
              : 'Open Live YAML Code Editor'
          }
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>YAML</span>
        </button>
      </div>
    </div>
  );
};
