/**
 * Pure CSS/SVG Composition Guides Overlay for Storyboard Frame Thumbnails.
 * Matches StageCamViewfinderOverlay's visual language (Rule of Thirds,
 * 90% Safe-Action box, and Center Crosshair Reticle) with 0ms WebGL cost.
 */

import React from 'react';
import type { StoryboardGuideMode } from '../core/storyboardMath';

export interface StoryboardGuideOverlayProps {
  guideMode: StoryboardGuideMode;
}

export const StoryboardGuideOverlay: React.FC<StoryboardGuideOverlayProps> = ({
  guideMode,
}) => {
  if (guideMode === 'off') return null;

  const showThirds = guideMode === 'thirds' || guideMode === 'all';
  const showSafe = guideMode === 'safe' || guideMode === 'all';
  const showCrosshair = guideMode === 'all';

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none select-none overflow-hidden"
    >
      {/* 90% Safe-Action Guide Frame */}
      {showSafe && (
        <div className="absolute inset-[5%] border border-dashed border-amber-500/65 shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" />
      )}

      {/* Rule-of-Thirds 3x3 Grid */}
      {showThirds && (
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
          <div className="border-r border-b border-amber-500/50" />
          <div className="border-r border-b border-amber-500/50" />
          <div className="border-b border-amber-500/50" />
          <div className="border-r border-b border-amber-500/50" />
          <div className="border-r border-b border-amber-500/50" />
          <div className="border-b border-amber-500/50" />
          <div className="border-r border-amber-500/50" />
          <div className="border-r border-amber-500/50" />
          <div />
        </div>
      )}

      {/* Center Crosshair Reticle */}
      {(showCrosshair || showSafe) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-4 h-4 rounded-full border border-amber-500/75 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-amber-500/90" />
            <div className="absolute -top-1.5 w-[1px] h-1.5 bg-amber-500/75" />
            <div className="absolute -bottom-1.5 w-[1px] h-1.5 bg-amber-500/75" />
            <div className="absolute -left-1.5 h-[1px] w-1.5 bg-amber-500/75" />
            <div className="absolute -right-1.5 h-[1px] w-1.5 bg-amber-500/75" />
          </div>
        </div>
      )}
    </div>
  );
};
