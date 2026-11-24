/**
 * Directorial Transport Bar Component.
 * Composes:
 *   1. DirectorialTimelineTrack: Proportional razor edit ticks, hover preview tooltip, and emerald loop brackets
 *   2. DirectorialShotChipsStrip: Auto-centering shot chip row with edge fade masks and clean free-peeking
 *   3. DirectorialTransportDeck: Unified centered playback controls island
 * Enforces strictly decoupled architecture (each submodule <= 200 lines).
 */

import React from 'react';
import { Camera, Eye, EyeOff, Loader2 } from 'lucide-react';
import type { StageFrame, StageScore } from '../core/types';
import { DirectorialTimelineTrack } from './transport/DirectorialTimelineTrack';
import { DirectorialShotChipsStrip } from './transport/DirectorialShotChipsStrip';
import { DirectorialTransportDeck } from './transport/DirectorialTransportDeck';

export interface DirectorialTransportBarProps {
  score: StageScore;
  frame: StageFrame;
  durationSec: number;
  isPlaying: boolean;
  playbackRate: number;
  isMuted: boolean;
  loopActiveShot: boolean;
  isCapturingSnapshot?: boolean;
  showDioramaHud?: boolean;
  onTogglePlay: () => void;
  onPause?: () => void;
  onSeek: (targetSec: number) => void;
  onStepFrames: (frames: number) => void;
  onSetPlaybackRate: (rate: number) => void;
  onToggleMute: () => void;
  onToggleLoopActiveShot: () => void;
  onCaptureStageCamSnapshot?: () => void;
  onToggleDioramaHud?: () => void;
}

export const DirectorialTransportBar: React.FC<
  DirectorialTransportBarProps
> = ({
  score,
  frame,
  durationSec,
  isPlaying,
  playbackRate,
  isMuted,
  loopActiveShot,
  isCapturingSnapshot = false,
  showDioramaHud = true,
  onTogglePlay,
  onPause,
  onSeek,
  onStepFrames,
  onSetPlaybackRate,
  onToggleMute,
  onToggleLoopActiveShot,
  onCaptureStageCamSnapshot,
  onToggleDioramaHud,
}) => {
  const safeDuration = Math.max(0.1, durationSec);
  const currentSec = frame.timestampSec;

  return (
    <footer className="shrink-0 bg-surface border-t border-border-main px-2 py-1.5 md:px-3 md:py-2 flex flex-col gap-1 md:gap-1.5 select-none z-20 text-text-main shadow-xs">
      {/* Row 1: Scrubber Track with Visual Cut Markers, Hover Tooltip & Emerald Loop Brackets */}
      <DirectorialTimelineTrack
        score={score}
        frame={frame}
        safeDuration={safeDuration}
        currentSec={currentSec}
        loopActiveShot={loopActiveShot}
        isPlaying={isPlaying}
        onSeek={onSeek}
        onPause={onPause}
      />

      {/* Row 2: Auto-Centering Shot Chips (Hidden on narrow/mobile viewports < md) */}
      <div className="hidden md:block">
        <DirectorialShotChipsStrip
          shots={score.shots}
          activeShotId={frame.activeShot?.id ?? null}
          onSeek={onSeek}
        />
      </div>

      {/* Row 3: Unified Centered Transport Island + Desktop Bottom-Left Stage Cam Snapshot & Diorama HUD Toggle */}
      <div className="w-full flex items-center justify-center md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-3">
        <div className="hidden md:flex items-center justify-start gap-1.5">
          {onCaptureStageCamSnapshot && (
            <button
              type="button"
              onClick={onCaptureStageCamSnapshot}
              disabled={isCapturingSnapshot}
              className="p-1.5 rounded-xl bg-surface hover:bg-surface-hover border border-border-main text-text-muted hover:text-text-main transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50 disabled:cursor-wait"
              title="Download clean 1080p Stage Cam PNG snapshot"
              aria-label="Download clean 1080p Stage Cam PNG snapshot"
            >
              {isCapturingSnapshot ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
              ) : (
                <Camera className="w-3.5 h-3.5 text-amber-500" />
              )}
            </button>
          )}
          {onToggleDioramaHud && (
            <button
              type="button"
              onClick={onToggleDioramaHud}
              aria-pressed={!showDioramaHud}
              className={`p-1.5 rounded-xl border transition-all cursor-pointer shadow-2xs active:scale-95 ${
                showDioramaHud
                  ? 'bg-surface hover:bg-surface-hover border-border-main text-text-muted hover:text-text-main'
                  : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/50 text-amber-500'
              }`}
              title={
                showDioramaHud
                  ? 'Hide 3D Diorama HUD [Hotkey: H]'
                  : 'Show 3D Diorama HUD [Hotkey: H]'
              }
              aria-label={
                showDioramaHud
                  ? 'Hide 3D Diorama HUD'
                  : 'Show 3D Diorama HUD'
              }
            >
              {showDioramaHud ? (
                <Eye className="w-3.5 h-3.5" />
              ) : (
                <EyeOff className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        <DirectorialTransportDeck
          currentSec={currentSec}
          safeDuration={safeDuration}
          isPlaying={isPlaying}
          playbackRate={playbackRate}
          isMuted={isMuted}
          loopActiveShot={loopActiveShot}
          onTogglePlay={onTogglePlay}
          onSeek={onSeek}
          onStepFrames={onStepFrames}
          onSetPlaybackRate={onSetPlaybackRate}
          onToggleMute={onToggleMute}
          onToggleLoopActiveShot={onToggleLoopActiveShot}
        />

        {/* Right balancing spacer so Transport Deck stays mathematically centered */}
        <div className="hidden md:block" aria-hidden="true" />
      </div>
    </footer>
  );
};
