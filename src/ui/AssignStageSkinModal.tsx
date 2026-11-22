/**
 * Direct Assignment Modal for Dropped / Picked .GLB / .GLTF 3D Skins.
 * Single file: 1-click target picker.
 * Multiple files (2+): Batch assignment list with auto-matched targets & Apply All.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Check, Layers, MapPin, User, X } from 'lucide-react';
import type { SceneEntityDef } from '../core/types';
import type { ActiveSkinEntry, PendingSkinDrop } from '../hooks/useStageSkins';
import {
  BatchSkinAssignmentList,
  SKIP_SKIN_TARGET,
} from './BatchSkinAssignmentList';
import { UI_TOKENS } from './tokens/ui';

export interface AssignStageSkinModalProps {
  pendingDrops: PendingSkinDrop[];
  entities: SceneEntityDef[];
  stageSkin: ActiveSkinEntry | null;
  entitySkins: Record<string, ActiveSkinEntry>;
  onAssign: (targetId: string) => void;
  onAssignBatch: (
    assignments: ReadonlyArray<{ url: string; targetId: string | null }>
  ) => void;
  onCancel: () => void;
  onCancelAll: () => void;
}

export const AssignStageSkinModal: React.FC<AssignStageSkinModalProps> = ({
  pendingDrops,
  entities,
  stageSkin,
  entitySkins,
  onAssign,
  onAssignBatch,
  onCancel,
  onCancelAll,
}) => {
  const isBatchMode = pendingDrops.length > 1;
  const singleDrop = pendingDrops.length === 1 ? pendingDrops[0] : null;

  const [selectedId, setSelectedId] = useState<string>('stage');
  const [batchTargets, setBatchTargets] = useState<Record<string, string>>({});

  useEffect(() => {
    if (singleDrop) {
      setSelectedId(singleDrop.suggestedTargetId || 'stage');
    }
  }, [singleDrop]);

  useEffect(() => {
    if (pendingDrops.length <= 1) {
      setBatchTargets({});
      return;
    }
    setBatchTargets((prev) => {
      const next: Record<string, string> = {};
      for (const item of pendingDrops) {
        next[item.url] = prev[item.url] ?? (item.suggestedTargetId || 'stage');
      }
      return next;
    });
  }, [pendingDrops]);

  const handleBatchTargetChange = useCallback(
    (url: string, targetId: string) => {
      setBatchTargets((prev) => ({ ...prev, [url]: targetId }));
    },
    []
  );

  const batchAssignments = useMemo(
    () =>
      pendingDrops.map((item) => {
        const raw = batchTargets[item.url] ?? item.suggestedTargetId ?? 'stage';
        return {
          url: item.url,
          targetId: raw === SKIP_SKIN_TARGET ? null : raw,
        };
      }),
    [pendingDrops, batchTargets]
  );

  const applyCount = useMemo(
    () => batchAssignments.filter((item) => item.targetId !== null).length,
    [batchAssignments]
  );

  const handleConfirmBatch = useCallback(() => {
    if (applyCount === 0) {
      onCancelAll();
      return;
    }
    onAssignBatch(batchAssignments);
  }, [applyCount, batchAssignments, onAssignBatch, onCancelAll]);

  useEffect(() => {
    if (pendingDrops.length === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isBatchMode) {
          onCancelAll();
        } else {
          onCancel();
        }
      } else if (e.key === 'Enter') {
        const activeTag = (e.target as HTMLElement | null)?.tagName;
        if (activeTag === 'SELECT') return;
        e.preventDefault();
        if (isBatchMode) {
          handleConfirmBatch();
        } else {
          onAssign(selectedId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    pendingDrops.length,
    isBatchMode,
    selectedId,
    onAssign,
    onCancel,
    onCancelAll,
    handleConfirmBatch,
  ]);

  if (pendingDrops.length === 0) return null;

  const characters = entities.filter(
    (e) => (e.kind ?? 'character') === 'character'
  );
  const props = entities.filter((e) => e.kind === 'prop');
  const markers = entities.filter((e) => e.kind === 'marker');

  const renderEntityRow = (
    ent: SceneEntityDef,
    Icon: React.FC<{ className?: string }>
  ) => {
    const isSuggested = singleDrop?.suggestedTargetId === ent.id;
    const isSelected = selectedId === ent.id;
    const existing = entitySkins[ent.id];

    return (
      <button
        key={ent.id}
        type="button"
        role="radio"
        aria-checked={isSelected}
        onClick={() => setSelectedId(ent.id)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition-colors cursor-pointer ${
          isSelected
            ? 'bg-surface-subtle border-text-main text-text-main ring-1 ring-text-main/15'
            : 'bg-surface border-border-main text-text-body hover:bg-surface-subtle'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: ent.color || '#38bdf8' }}
          />
          <Icon className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <span className="text-xs font-semibold truncate">
            {ent.label || ent.id}
          </span>
          <span className="text-[10px] font-mono text-text-faint shrink-0">
            #{ent.id}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {existing && (
            <span className="text-[10px] font-mono text-amber-500 truncate max-w-[90px]">
              replaces {existing.name}
            </span>
          )}
          {isSuggested && (
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-mono font-bold uppercase">
              Match
            </span>
          )}
          <span
            aria-hidden="true"
            className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
              isSelected
                ? 'bg-btn-primary-bg border-btn-primary-bg text-btn-primary-text'
                : 'border-border-main bg-surface'
            }`}
          >
            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
          </span>
        </div>
      </button>
    );
  };

  const dismissModal = isBatchMode ? onCancelAll : onCancel;

  return (
    <div
      className={UI_TOKENS.modal.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dismissModal();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-skin-title"
        className={`bg-surface w-full ${
          isBatchMode ? 'max-w-lg' : 'max-w-md'
        } rounded-2xl shadow-2xl overflow-hidden border border-border-main text-text-main animate-in zoom-in-95 duration-200`}
      >
        {/* Header */}
        <div className={UI_TOKENS.modal.header}>
          <div className="min-w-0">
            <h2
              id="assign-skin-title"
              className="text-sm font-bold text-text-main truncate"
            >
              {isBatchMode
                ? `Assign ${pendingDrops.length} 3D .GLB Skins`
                : 'Assign 3D .GLB Skin'}
            </h2>
            <p className="text-[11px] font-mono text-text-muted truncate mt-0.5">
              {isBatchMode
                ? 'Auto-matched by filename · Adjust targets or skip before applying'
                : singleDrop?.name}
            </p>
          </div>
          <button
            type="button"
            onClick={dismissModal}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-muted transition-colors cursor-pointer"
            title="Cancel (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: Batch List or Radio Target Picker */}
        {isBatchMode ? (
          <BatchSkinAssignmentList
            pendingDrops={pendingDrops}
            assignments={batchTargets}
            entities={entities}
            stageSkin={stageSkin}
            entitySkins={entitySkins}
            onChangeTarget={handleBatchTargetChange}
          />
        ) : (
          <div
            role="radiogroup"
            aria-label="Target assignment"
            className="p-4 space-y-3 max-h-[60vh] overflow-y-auto"
          >
            <button
              type="button"
              role="radio"
              aria-checked={selectedId === 'stage'}
              onClick={() => setSelectedId('stage')}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                selectedId === 'stage'
                  ? 'bg-surface-subtle border-text-main text-text-main ring-1 ring-text-main/15'
                  : 'bg-surface border-border-main text-text-body hover:bg-surface-subtle'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Layers className="w-4 h-4 text-emerald-500 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold">Stage Environment</div>
                  <div className="text-[10px] font-mono text-text-muted">
                    Full set / architecture at world origin (0, 0, 0)
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {stageSkin && (
                  <span className="text-[10px] font-mono text-amber-500 truncate max-w-[90px]">
                    replaces {stageSkin.name}
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                    selectedId === 'stage'
                      ? 'bg-btn-primary-bg border-btn-primary-bg text-btn-primary-text'
                      : 'border-border-main bg-surface'
                  }`}
                >
                  {selectedId === 'stage' && (
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  )}
                </span>
              </div>
            </button>

            {characters.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-text-faint font-bold px-1">
                  Cast ({characters.length})
                </div>
                <div className="space-y-1">
                  {characters.map((ent) => renderEntityRow(ent, User))}
                </div>
              </div>
            )}

            {props.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-text-faint font-bold px-1">
                  Set Props ({props.length})
                </div>
                <div className="space-y-1">
                  {props.map((ent) => renderEntityRow(ent, Box))}
                </div>
              </div>
            )}

            {markers.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-text-faint font-bold px-1">
                  Spike Marks ({markers.length})
                </div>
                <div className="space-y-1">
                  {markers.map((ent) => renderEntityRow(ent, MapPin))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border-subtle bg-surface-subtle flex items-center justify-between gap-2 text-[10px] font-mono text-text-muted">
          <span>Session-only overlay</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={dismissModal}
              className="px-2.5 py-1 rounded-lg hover:bg-surface text-text-body cursor-pointer"
            >
              {isBatchMode ? 'Cancel All' : 'Cancel'}
            </button>
            {isBatchMode ? (
              <button
                type="button"
                onClick={handleConfirmBatch}
                disabled={applyCount === 0}
                className="px-3 py-1.5 rounded-lg bg-btn-primary-bg text-btn-primary-text font-bold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {applyCount === 0
                  ? 'Nothing Selected'
                  : `Apply ${applyCount} Skin${applyCount === 1 ? '' : 's'}`}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onAssign(selectedId)}
                className="px-3 py-1.5 rounded-lg bg-btn-primary-bg text-btn-primary-text font-bold hover:opacity-90 transition-opacity cursor-pointer"
              >
                Apply Skin
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
