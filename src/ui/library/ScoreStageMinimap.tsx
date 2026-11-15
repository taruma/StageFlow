/**
 * Procedural 2D Vector SVG Stage Minimap.
 * Renders an architectural top-down schematic of character positions,
 * facing chevrons, and camera trajectory cones derived purely from in-memory StageScore data.
 * Zero WebGL overhead, zero asset downloads, executes in < 0.1ms.
 */

import React, { useMemo } from 'react';
import type { StageScore } from '../../core/types';
import { computeOrientedBoundingBox } from '../../core/entityKinematicUtils';
import { computeMinimapLayout } from './scoreMinimapUtils';

export interface ScoreStageMinimapProps {
  score: StageScore;
  className?: string;
}

export const ScoreStageMinimap: React.FC<ScoreStageMinimapProps> = ({
  score,
  className = '',
}) => {
  const { viewBox, entities, cameraPos, cameraTarget, cameraConePath, cameraTrackPath } =
    useMemo(() => computeMinimapLayout(score), [score]);

  return (
    <div
      className={`relative w-full aspect-square bg-surface-muted/50 rounded-xl overflow-hidden border border-border-subtle select-none flex items-center justify-center ${className}`}
    >
      <svg
        viewBox={viewBox}
        className="w-full h-full p-2"
        style={{ transform: 'scaleY(-1)' }} // Invert SVG Y so +Z (downstage) is at bottom
      >
        <defs>
          <pattern
            id="minimap-grid"
            width="2"
            height="2"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 2 0 L 0 0 0 2"
              fill="none"
              stroke="var(--border-subtle)"
              strokeWidth="0.08"
              strokeDasharray="0.3 0.3"
            />
          </pattern>
        </defs>

        {/* Metric Floor Grid */}
        <rect
          x="-50"
          y="-50"
          width="100"
          height="100"
          fill="url(#minimap-grid)"
          opacity="0.65"
        />

        {/* Center Crosshairs */}
        <line
          x1="-40"
          y1="0"
          x2="40"
          y2="0"
          stroke="var(--border-main)"
          strokeWidth="0.08"
          opacity="0.4"
        />
        <line
          x1="0"
          y1="-40"
          x2="0"
          y2="40"
          stroke="var(--border-main)"
          strokeWidth="0.08"
          opacity="0.4"
        />

        {/* Origin Reticle */}
        <circle
          cx="0"
          cy="0"
          r="0.4"
          fill="none"
          stroke="var(--text-faint)"
          strokeWidth="0.08"
          opacity="0.5"
        />

        {/* Multi-Shot Camera Trajectory Line */}
        {cameraTrackPath && (
          <path
            d={cameraTrackPath}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="0.16"
            strokeDasharray="0.5 0.3"
            opacity="0.75"
          />
        )}

        {/* Camera Viewing Cone */}
        <path
          d={cameraConePath}
          fill="#f59e0b"
          fillOpacity="0.12"
          stroke="#f59e0b"
          strokeWidth="0.12"
          strokeDasharray="0.4 0.2"
        />

        {/* Camera Sightline Tether */}
        <line
          x1={cameraPos.x}
          y1={cameraPos.z}
          x2={cameraTarget.x}
          y2={cameraTarget.z}
          stroke="#f59e0b"
          strokeWidth="0.09"
          strokeDasharray="0.3 0.2"
          opacity="0.6"
        />

        {/* Camera Glyph */}
        <circle
          cx={cameraPos.x}
          cy={cameraPos.z}
          r="0.55"
          fill="#f59e0b"
          stroke="var(--surface)"
          strokeWidth="0.14"
        />

        {/* Entities (Characters, Props) */}
        {entities.map((ent) => {
          const facingLen = 0.85;
          // Facing angle: rotationYRad = 0 faces +Z
          const facingX = ent.x + Math.sin(ent.rotationYRad) * facingLen;
          const facingZ = ent.z + Math.cos(ent.rotationYRad) * facingLen;

          return (
            <g key={ent.id}>
              {/* Ground Chevron / Directional Heading */}
              <line
                x1={ent.x}
                y1={ent.z}
                x2={facingX}
                y2={facingZ}
                stroke={ent.color}
                strokeWidth="0.18"
                strokeLinecap="round"
              />
              <circle
                cx={facingX}
                cy={facingZ}
                r="0.12"
                fill={ent.color}
              />

              {/* Entity Base Body Geometry (Box polygon, ellipse, or circle) */}
              {ent.kind === 'prop' && (ent.shape ?? 'box') === 'box' ? (
                <polygon
                  points={computeOrientedBoundingBox(
                    { x: ent.x, z: ent.z },
                    Math.max(0.6, ent.width),
                    Math.max(0.6, ent.depth),
                    ent.rotationYRad
                  )
                    .map((c) => `${c.x.toFixed(2)},${c.z.toFixed(2)}`)
                    .join(' ')}
                  fill={ent.color}
                  fillOpacity="0.85"
                  stroke="var(--surface)"
                  strokeWidth="0.14"
                />
              ) : Math.abs(ent.width - ent.depth) > 0.05 ? (
                <ellipse
                  cx={ent.x}
                  cy={ent.z}
                  rx={Math.max(0.25, ent.width * 0.5)}
                  ry={Math.max(0.25, ent.depth * 0.5)}
                  transform={`rotate(${((ent.rotationYRad * 180) / Math.PI).toFixed(1)} ${ent.x} ${ent.z})`}
                  fill={ent.color}
                  fillOpacity="0.85"
                  stroke="var(--surface)"
                  strokeWidth="0.14"
                />
              ) : (
                <circle
                  cx={ent.x}
                  cy={ent.z}
                  r={Math.max(0.3, ent.width * 0.5)}
                  fill={ent.color}
                  fillOpacity="0.85"
                  stroke="var(--surface)"
                  strokeWidth="0.14"
                />
              )}

              {/* Entity Inner Dot */}
              <circle
                cx={ent.x}
                cy={ent.z}
                r="0.16"
                fill="#ffffff"
              />
            </g>
          );
        })}
      </svg>

      {/* Floating Cardinal Orientation Indicators */}
      <span className="absolute top-1.5 left-2 text-[8px] font-mono font-bold tracking-widest text-text-faint uppercase pointer-events-none opacity-60">
        -Z UPSTAGE
      </span>
      <span className="absolute bottom-1.5 left-2 text-[8px] font-mono font-bold tracking-widest text-text-faint uppercase pointer-events-none opacity-60">
        +Z DOWNSTAGE
      </span>
      <span className="absolute bottom-1.5 right-2 text-[8px] font-mono font-bold tracking-wider text-amber-500 uppercase pointer-events-none flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
        CAM
      </span>
    </div>
  );
};
