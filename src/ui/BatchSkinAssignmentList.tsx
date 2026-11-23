/**
 * Batch Target Assignment List for Multiple Dropped / Picked .GLB / .GLTF Skins.
 */

import React, { useMemo } from 'react';
import { RotateCcw, X } from 'lucide-react';
import {
  findDuplicateBatchTargetIds,
  type BatchSkinAssignmentInput,
} from '../core/skinMath';
import type { SceneEntityDef } from '../core/types';
import type { ActiveSkinEntry, PendingSkinDrop } from '../hooks/useStageSkins';

export const SKIP_SKIN_TARGET = '__skip__';

export interface BatchSkinAssignmentListProps {
  pendingDrops: PendingSkinDrop[];
  assignments: Record<string, string>;
  entities: SceneEntityDef[];
  stageSkin: ActiveSkinEntry | null;
  entitySkins: Record<string, ActiveSkinEntry>;
  onChangeTarget: (url: string, targetId: string) => void;
}

export const BatchSkinAssignmentList: React.FC<BatchSkinAssignmentListProps> = ({
  pendingDrops,
  assignments,
  entities,
  stageSkin,
  entitySkins,
  onChangeTarget,
}) => {
  const characters = useMemo(
    () => entities.filter((e) => (e.kind ?? 'character') === 'character'),
    [entities]
  );
  const props = useMemo(
    () => entities.filter((e) => e.kind === 'prop'),
    [entities]
  );
  const markers = useMemo(
    () => entities.filter((e) => e.kind === 'marker'),
    [entities]
  );

  const duplicateSet = useMemo(() => {
    const inputs: BatchSkinAssignmentInput[] = pendingDrops.map((item) => {
      const target = assignments[item.url] ?? item.suggestedTargetId ?? 'stage';
      return {
        url: item.url,
        name: item.name,
        targetId: target === SKIP_SKIN_TARGET ? null : target,
      };
    });
    return new Set(findDuplicateBatchTargetIds(inputs));
  }, [pendingDrops, assignments]);

  return (
    <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
      {pendingDrops.map((item) => {
        const currentTarget =
          assignments[item.url] ?? item.suggestedTargetId ?? 'stage';
        const isSkipped = currentTarget === SKIP_SKIN_TARGET;
        const isMatched =
          !isSkipped &&
          item.suggestedTargetId !== 'stage' &&
          currentTarget === item.suggestedTargetId;
        const isDuplicate = !isSkipped && duplicateSet.has(currentTarget);
        const existing = isSkipped
          ? null
          : currentTarget === 'stage'
          ? stageSkin
          : entitySkins[currentTarget] ?? null;

        return (
          <div
            key={item.url}
            className={`rounded-xl border px-3 py-2.5 transition-colors ${
              isSkipped
                ? 'bg-surface-subtle/50 border-border-subtle opacity-60'
                : isDuplicate
                ? 'bg-amber-500/5 border-amber-500/40'
                : 'bg-surface border-border-main'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`text-xs font-mono font-semibold truncate ${
                    isSkipped ? 'line-through text-text-muted' : 'text-text-main'
                  }`}
                  title={item.name}
                >
                  {item.name}
                </span>
                {isMatched && (
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-mono font-bold uppercase shrink-0">
                    Match
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <select
                  aria-label={`Target for ${item.name}`}
                  value={currentTarget}
                  onChange={(e) => onChangeTarget(item.url, e.target.value)}
                  className="max-w-[190px] rounded-lg border border-border-main bg-surface-subtle px-2 py-1 text-[11px] font-mono text-text-main focus:outline-none focus:ring-1 focus:ring-accent-primary/50 cursor-pointer"
                >
                  <option value="stage">Stage Environment</option>
                  {characters.length > 0 && (
                    <optgroup label={`Cast (${characters.length})`}>
                      {characters.map((ent) => (
                        <option key={ent.id} value={ent.id}>
                          {ent.label || ent.id} (#{ent.id})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {props.length > 0 && (
                    <optgroup label={`Set Props (${props.length})`}>
                      {props.map((ent) => (
                        <option key={ent.id} value={ent.id}>
                          {ent.label || ent.id} (#{ent.id})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {markers.length > 0 && (
                    <optgroup label={`Spike Marks (${markers.length})`}>
                      {markers.map((ent) => (
                        <option key={ent.id} value={ent.id}>
                          {ent.label || ent.id} (#{ent.id})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value={SKIP_SKIN_TARGET}>Skip file</option>
                </select>

                <button
                  type="button"
                  onClick={() =>
                    onChangeTarget(
                      item.url,
                      isSkipped
                        ? item.suggestedTargetId || 'stage'
                        : SKIP_SKIN_TARGET
                    )
                  }
                  title={isSkipped ? 'Include file' : 'Skip file'}
                  className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-muted transition-colors cursor-pointer"
                >
                  {isSkipped ? (
                    <RotateCcw className="w-3.5 h-3.5" />
                  ) : (
                    <X className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {(isDuplicate || existing) && (
              <div className="mt-1 flex items-center gap-2 text-[10px] font-mono text-amber-500">
                {isDuplicate && (
                  <span>Duplicate target — later row overwrites</span>
                )}
                {existing && (
                  <span className="truncate">Replaces {existing.name}</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
