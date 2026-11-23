/**
 * Live 2D Top-Down SVG Stage Minimap Overlay for the 3D Diorama.
 * Zero extra WebGL contexts; delegates 60fps imperative SVG attribute updates
 * to dioramaMinimapRenderer.ts with 0 React re-renders during playback.
 * Layer 5 UI Component.
 */

import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import { computeDioramaMinimapBounds } from '../core/minimapMath';
import type {
  CameraViewMode,
  SphericalPose,
  StageFrame,
  StageScore,
} from '../core/types';
import {
  applyStageFrameToMinimapRefs,
  type MinimapEntityDomRefs,
  type MinimapSvgRefs,
} from './dioramaMinimapRenderer';

export interface DioramaMinimapProps {
  score: StageScore;
  frameRef: React.RefObject<StageFrame>;
  liveViewportPoseRef?: React.RefObject<SphericalPose>;
  uiFrame: StageFrame;
  liveViewportPose: SphericalPose;
  cameraMode: CameraViewMode;
  isPlaying: boolean;
  variant?: 'hud' | 'panel';
  onClose?: () => void;
}

export const MINIMAP_PLAYBACK_INTERVAL_MS = 40; // ~25 Hz SVG updates during playback

export function shouldDrawMinimapTick(
  nowMs: number,
  lastDrawMs: number,
  intervalMs = MINIMAP_PLAYBACK_INTERVAL_MS
): boolean {
  return !Number.isFinite(lastDrawMs) || nowMs - lastDrawMs >= intervalMs;
}

export function areDioramaMinimapPropsEqual(
  prev: DioramaMinimapProps,
  next: DioramaMinimapProps
): boolean {
  if (
    prev.score !== next.score ||
    prev.frameRef !== next.frameRef ||
    prev.liveViewportPoseRef !== next.liveViewportPoseRef ||
    prev.cameraMode !== next.cameraMode ||
    prev.isPlaying !== next.isPlaying ||
    prev.variant !== next.variant ||
    prev.onClose !== next.onClose
  ) {
    return false;
  }

  // During active playback, the rAF loop reads frameRef/liveViewportPoseRef directly;
  // skip 10Hz React uiFrame/liveViewportPose churn unless liveViewportPoseRef is absent.
  if (next.isPlaying) {
    return next.liveViewportPoseRef
      ? true
      : prev.liveViewportPose === next.liveViewportPose;
  }

  return (
    prev.uiFrame === next.uiFrame &&
    prev.liveViewportPose === next.liveViewportPose
  );
}

const DioramaMinimapComponent: React.FC<DioramaMinimapProps> = ({
  score,
  frameRef,
  liveViewportPoseRef,
  uiFrame,
  liveViewportPose,
  cameraMode,
  isPlaying,
  variant = 'hud',
  onClose,
}) => {
  const gridPatternId = useId();
  const bounds = useMemo(() => computeDioramaMinimapBounds(score), [score]);
  const { minX, minZ, span, viewBox, gridStepM, unitScale } = bounds;

  const svgRefs = useRef<MinimapSvgRefs>({
    obsGroup: null,
    obsLine: null,
    obsDot: null,
    camCone: null,
    camSightLine: null,
    camFocusBar: null,
    camFocusDot: null,
    camDot: null,
    entities: {},
  });

  const getEntityRefBucket = (id: string): MinimapEntityDomRefs => {
    if (!svgRefs.current.entities[id]) {
      svgRefs.current.entities[id] = {
        group: null,
        halo: null,
        circle: null,
        ellipse: null,
        polygon: null,
        facing: null,
        marker: null,
      };
    }
    return svgRefs.current.entities[id];
  };

  const fallbackUiFrameRef = useRef(uiFrame);
  fallbackUiFrameRef.current = uiFrame;
  const fallbackPoseRef = useRef(liveViewportPose);
  fallbackPoseRef.current = liveViewportPose;

  const syncDom = useCallback(() => {
    applyStageFrameToMinimapRefs(
      svgRefs.current,
      frameRef.current ?? fallbackUiFrameRef.current,
      liveViewportPoseRef?.current ?? fallbackPoseRef.current,
      score,
      bounds,
      cameraMode
    );
  }, [frameRef, liveViewportPoseRef, score, bounds, cameraMode]);

  useLayoutEffect(() => {
    if (isPlaying) return;
    syncDom();
  }, [isPlaying, uiFrame, liveViewportPose, syncDom]);

  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;
    let lastDrawMs = -Infinity;
    const tick = (nowMs: number) => {
      if (shouldDrawMinimapTick(nowMs, lastDrawMs)) {
        lastDrawMs = nowMs;
        syncDom();
      }
      rafId = requestAnimationFrame(tick);
    };
    syncDom();
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, syncDom]);

  const strokeThin = (0.08 * unitScale).toFixed(3);
  const strokeMed = (0.13 * unitScale).toFixed(3);
  const strokeFocus = (0.18 * unitScale).toFixed(3);
  const markerArm = (0.28 * unitScale).toFixed(2);
  const markerPath = `M -${markerArm} -${markerArm} L ${markerArm} ${markerArm} M ${markerArm} -${markerArm} L -${markerArm} ${markerArm}`;

  const isPanel = variant === 'panel';

  const card = (
    <div
      aria-label="Top-down stage minimap"
      className={
        isPanel
          ? 'relative w-full h-full max-w-full max-h-full aspect-square rounded-xl bg-surface border border-border-main shadow-xs overflow-hidden select-none'
          : 'relative w-[160px] h-[160px] lg:w-[180px] lg:h-[180px] rounded-2xl bg-surface/85 hover:bg-surface/95 opacity-80 hover:opacity-100 border border-border-main/80 shadow-lg overflow-hidden pointer-events-auto select-none transition-all duration-150'
      }
    >
      {/* Top micro header overlay */}
      <div className="absolute top-1.5 inset-x-2 z-10 flex items-center justify-between pointer-events-none">
        <span className="text-[8.5px] font-mono font-bold uppercase tracking-wider text-text-muted">
          Plan · {gridStepM}m
        </span>
        <span className="text-[8px] font-mono text-text-faint">-Z</span>
        {!isPanel && onClose ? (
          <button
            type="button"
            onClick={onClose}
            title="Hide Top-Down Minimap [Hotkey: M]"
            className="pointer-events-auto p-0.5 rounded-md text-text-muted hover:text-text-main hover:bg-surface-subtle transition-colors cursor-pointer"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        ) : (
          <span className="w-2.5" />
        )}
      </div>

      {/* Bottom micro legend & +Z orientation tag */}
      <div className="absolute bottom-1 inset-x-2 z-10 flex items-center justify-between pointer-events-none text-[8px] font-mono">
        <span className="flex items-center gap-1.5 text-text-muted">
          <span className="inline-flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>CAM</span>
          </span>
          {cameraMode !== 'stage-pov' && (
            <span className="inline-flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span>OBS</span>
            </span>
          )}
        </span>
        <span className="text-text-faint">+Z</span>
      </div>

      <svg viewBox={viewBox} className="w-full h-full">
        <defs>
          <pattern
            id={gridPatternId}
            width={gridStepM}
            height={gridStepM}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${gridStepM} 0 L 0 0 0 ${gridStepM}`}
              fill="none"
              stroke="var(--border-main)"
              strokeWidth={strokeThin}
              opacity="0.35"
            />
          </pattern>
        </defs>

        <rect x={minX} y={minZ} width={span} height={span} fill={`url(#${gridPatternId})`} />
        <line x1={minX} y1={0} x2={minX + span} y2={0} stroke="var(--border-main)" strokeWidth={strokeThin} opacity="0.45" />
        <line x1={0} y1={minZ} x2={0} y2={minZ + span} stroke="var(--border-main)" strokeWidth={strokeThin} opacity="0.45" />
        <circle cx={0} cy={0} r={0.35 * unitScale} fill="none" stroke="var(--text-faint)" strokeWidth={strokeThin} opacity="0.5" />

        {score.entities.map((ent) => {
          const bucket = getEntityRefBucket(ent.id);
          const color = ent.color || '#38bdf8';

          if (ent.kind === 'marker') {
            return (
              <g key={ent.id} ref={(el) => { bucket.group = el; }}>
                <path ref={(el) => { bucket.marker = el; }} d={markerPath} stroke={color} strokeWidth={strokeMed} strokeLinecap="round" opacity="0.8" />
              </g>
            );
          }

          if (ent.kind === 'prop') {
            const isCircular = ent.shape === 'sphere' || ent.shape === 'cylinder' || ent.shape === 'capsule';
            return (
              <g key={ent.id} ref={(el) => { bucket.group = el; }}>
                {isCircular ? (
                  <ellipse ref={(el) => { bucket.ellipse = el; }} fill={color} fillOpacity="0.18" stroke={color} strokeWidth={strokeMed} />
                ) : (
                  <polygon ref={(el) => { bucket.polygon = el; }} fill={color} fillOpacity="0.18" stroke={color} strokeWidth={strokeMed} />
                )}
              </g>
            );
          }

          return (
            <g key={ent.id} ref={(el) => { bucket.group = el; }}>
              <circle ref={(el) => { bucket.halo = el; }} fill="none" stroke={color} strokeWidth={strokeThin} opacity="0" />
              <line ref={(el) => { bucket.facing = el; }} stroke={color} strokeWidth={strokeMed} strokeLinecap="round" />
              <circle ref={(el) => { bucket.circle = el; }} fill={color} stroke="var(--surface)" strokeWidth={strokeThin} />
            </g>
          );
        })}

        <g ref={(el) => { svgRefs.current.obsGroup = el; }}>
          <line ref={(el) => { svgRefs.current.obsLine = el; }} stroke="#38bdf8" strokeWidth={strokeThin} strokeDasharray={`${0.25 * unitScale} ${0.2 * unitScale}`} opacity="0.85" />
          <circle ref={(el) => { svgRefs.current.obsDot = el; }} r={0.32 * unitScale} fill="#38bdf8" stroke="var(--surface)" strokeWidth={strokeThin} />
        </g>

        <g>
          <path ref={(el) => { svgRefs.current.camCone = el; }} fill="#f59e0b" fillOpacity="0.14" stroke="#f59e0b" strokeWidth={strokeThin} strokeDasharray={`${0.35 * unitScale} ${0.2 * unitScale}`} />
          <line ref={(el) => { svgRefs.current.camSightLine = el; }} stroke="#f59e0b" strokeWidth={strokeThin} strokeDasharray={`${0.25 * unitScale} ${0.2 * unitScale}`} opacity="0.65" />
          <line ref={(el) => { svgRefs.current.camFocusBar = el; }} stroke="#10b981" strokeWidth={strokeFocus} strokeLinecap="round" />
          <circle ref={(el) => { svgRefs.current.camFocusDot = el; }} r={0.18 * unitScale} fill="#10b981" />
          <circle ref={(el) => { svgRefs.current.camDot = el; }} r={0.42 * unitScale} fill="#f59e0b" stroke="var(--surface)" strokeWidth={strokeThin} />
        </g>
      </svg>
    </div>
  );

  if (isPanel) {
    return (
      <div className="w-full h-full min-h-0 p-2 flex items-center justify-center overflow-hidden">
        {card}
      </div>
    );
  }

  return card;
};

export const DioramaMinimap = React.memo(
  DioramaMinimapComponent,
  areDioramaMinimapPropsEqual
);
