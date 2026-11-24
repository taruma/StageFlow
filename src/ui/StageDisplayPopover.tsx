/**
 * Top-right [ View ▾ ] Popover for wide viewports (>= 768px).
 * Houses session-only pure-visual 3D diorama display options
 * (Stage Floor mode, Scene Objects, Per-Character visibility, Entity Cues).
 */

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import {
  hasCustomStageDisplayOptions,
  type StageDisplayFlagKey,
} from '../core/stageDisplayOptions';
import type {
  StageDisplayOptions,
  StageFloorMode,
  StageScore,
} from '../core/types';
import { StageDisplayControlsSection } from './StageDisplayControlsSection';

export interface StageDisplayPopoverProps {
  score: StageScore;
  stageDisplay: StageDisplayOptions;
  onSelectFloorMode: (mode: StageFloorMode) => void;
  onToggleStageDisplayFlag: (key: StageDisplayFlagKey) => void;
  onToggleCharacterVisible: (characterId: string) => void;
  onResetStageDisplay: () => void;
}

export const StageDisplayPopover: React.FC<StageDisplayPopoverProps> = ({
  score,
  stageDisplay,
  onSelectFloorMode,
  onToggleStageDisplayFlag,
  onToggleCharacterVisible,
  onResetStageDisplay,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isModified = hasCustomStageDisplayOptions(stageDisplay);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDownOutside = (e: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDownOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative pointer-events-auto select-none">
      <div className="flex items-center p-0.5 rounded-xl bg-surface border border-border-main shadow-xs">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          title="Stage View & Visual Layer Filters (Floor, Objects, Entity Cues)"
          className={`px-2 py-0.5 rounded-lg text-[10px] font-mono flex items-center gap-1 transition-colors duration-100 cursor-pointer focus:outline-none ${
            isOpen
              ? 'bg-btn-primary-bg text-btn-primary-text font-semibold shadow-2xs'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          <SlidersHorizontal className="w-3 h-3" />
          <span className="hidden sm:inline">View</span>
          {isModified && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
              aria-label="Custom view filters active"
            />
          )}
          <ChevronDown className="w-3 h-3 opacity-75" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1.5 w-56 max-h-[75vh] overflow-y-auto bg-surface border border-border-main rounded-2xl p-2.5 shadow-2xl z-30">
          <StageDisplayControlsSection
            score={score}
            stageDisplay={stageDisplay}
            onSelectFloorMode={onSelectFloorMode}
            onToggleStageDisplayFlag={onToggleStageDisplayFlag}
            onToggleCharacterVisible={onToggleCharacterVisible}
            onResetStageDisplay={onResetStageDisplay}
          />
        </div>
      )}
    </div>
  );
};
