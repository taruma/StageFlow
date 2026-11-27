/**
 * Target & Entity Reference picker supporting:
 * - Single entity ID (or preset like "center") populated from `activeScore.entities`
 * - Multi-entity array framing (e.g. ["protagonist", "interlocutor"])
 * - 3D [x, y, z] coordinate anchor via Vec3ScrubRow
 */

import React, { useCallback } from 'react';
import type { SceneEntityDef } from '../../../core/types';
import type { YamlPath } from '../../../core/schema/scoreSchemaTypes';
import type { ScalarFormatHint } from '../../../core/scoreYamlMutator';
import { Vec3ScrubRow, normalizeVec3Tuple } from './Vec3ScrubRow';

export interface TargetAnchorControlProps {
  yamlPath: YamlPath;
  value: unknown;
  allowVec3: boolean;
  entities: readonly SceneEntityDef[];
  disabled?: boolean;
  onScrubPreview: (
    path: YamlPath,
    rawHumanValue: unknown,
    format?: ScalarFormatHint
  ) => void;
  onCommit: (
    path: YamlPath,
    finalValue: unknown,
    format?: ScalarFormatHint
  ) => void;
  onCancelScrub: () => void;
}

export const TargetAnchorControl: React.FC<TargetAnchorControlProps> = React.memo(
  ({
    yamlPath,
    value,
    allowVec3,
    entities,
    disabled = false,
    onScrubPreview,
    onCommit,
    onCancelScrub,
  }) => {
    const isVec3 =
      Array.isArray(value) &&
      value.length >= 3 &&
      value.every((v) => typeof v === 'number');

    const isMultiEntity =
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((v) => typeof v === 'string');

    const handleModeSwitch = useCallback(
      (nextMode: 'entity' | 'vec3') => {
        if (disabled) return;
        if (nextMode === 'vec3') {
          onCommit(yamlPath, [0, 1.25, 0], 'vec3-flow');
        } else {
          const fallback = entities[0]?.id ?? 'center';
          onCommit(yamlPath, fallback, 'plain');
        }
      },
      [disabled, entities, onCommit, yamlPath]
    );

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {isVec3 ? (
          <Vec3ScrubRow
            value={normalizeVec3Tuple(value)}
            step={0.05}
            disabled={disabled}
            onScrubPreview={(v) => onScrubPreview(yamlPath, v, 'vec3-flow')}
            onCommit={(v) => onCommit(yamlPath, v, 'vec3-flow')}
            onCancelScrub={onCancelScrub}
          />
        ) : isMultiEntity ? (
          <div className="flex flex-wrap items-center gap-1">
            {entities.map((ent) => {
              const selected = (value as string[]).includes(ent.id);
              return (
                <button
                  key={ent.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    const prev = value as string[];
                    const next = selected
                      ? prev.filter((id) => id !== ent.id)
                      : [...prev, ent.id];
                    if (next.length === 1) {
                      onCommit(yamlPath, next[0], 'plain');
                    } else if (next.length > 1) {
                      onCommit(yamlPath, next, 'vec3-flow');
                    }
                  }}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                    selected
                      ? 'bg-sky-500/15 border-sky-500/40 text-text-main font-semibold'
                      : 'bg-surface-subtle border-border-main text-text-muted hover:text-text-main'
                  }`}
                >
                  {ent.id}
                </button>
              );
            })}
          </div>
        ) : (
          <select
            disabled={disabled}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onCommit(yamlPath, e.target.value, 'plain')}
            className="px-2 py-0.5 rounded-md bg-surface-subtle border border-border-main text-[11px] font-mono text-text-main outline-none focus:border-amber-500/60 max-w-[165px]"
          >
            {typeof value === 'string' &&
              value !== '' &&
              value !== 'center' &&
              !entities.some((e) => e.id === value) && (
                <option value={value}>{value}</option>
              )}
            <option value="center">center (stage)</option>
            {entities.map((ent) => (
              <option key={ent.id} value={ent.id}>
                {ent.id} · {ent.label}
              </option>
            ))}
          </select>
        )}

        {allowVec3 && !disabled && (
          <button
            type="button"
            onClick={() => handleModeSwitch(isVec3 ? 'entity' : 'vec3')}
            className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-surface-subtle hover:bg-surface-hover border border-border-subtle text-text-muted hover:text-text-main cursor-pointer"
            title={
              isVec3
                ? 'Switch target to an Entity ID'
                : 'Switch target to [X, Y, Z] coordinates'
            }
          >
            {isVec3 ? 'ID' : 'XYZ'}
          </button>
        )}
      </div>
    );
  }
);
