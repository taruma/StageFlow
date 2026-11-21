/**
 * Minimal Direct Assignment Modal for Dropped .GLB / .GLTF 3D Skins.
 * Appears only when a user drops a .glb/.gltf file, letting them assign it
 * in 1 click to the Stage Environment or any active entity (Actor / Prop / Marker).
 */

import React, { useEffect, useState } from 'react';
import { Box, Check, Layers, MapPin, User, X } from 'lucide-react';
import type { SceneEntityDef } from '../core/types';
import type { ActiveSkinEntry, PendingSkinDrop } from '../hooks/useStageSkins';
import { UI_TOKENS } from './tokens/ui';

export interface AssignStageSkinModalProps {
  pendingDrop: PendingSkinDrop | null;
  entities: SceneEntityDef[];
  stageSkin: ActiveSkinEntry | null;
  entitySkins: Record<string, ActiveSkinEntry>;
  onAssign: (targetId: string) => void;
  onCancel: () => void;
}

export const AssignStageSkinModal: React.FC<AssignStageSkinModalProps> = ({
  pendingDrop,
  entities,
  stageSkin,
  entitySkins,
  onAssign,
  onCancel,
}) => {
  const [selectedId, setSelectedId] = useState<string>('stage');

  useEffect(() => {
    if (pendingDrop) {
      setSelectedId(pendingDrop.suggestedTargetId || 'stage');
    }
  }, [pendingDrop]);

  useEffect(() => {
    if (!pendingDrop) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onAssign(selectedId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingDrop, selectedId, onAssign, onCancel]);

  if (!pendingDrop) return null;

  const characters = entities.filter((e) => (e.kind ?? 'character') === 'character');
  const props = entities.filter((e) => e.kind === 'prop');
  const markers = entities.filter((e) => e.kind === 'marker');

  const renderEntityRow = (
    ent: SceneEntityDef,
    Icon: React.FC<{ className?: string }>
  ) => {
    const isSuggested = pendingDrop.suggestedTargetId === ent.id;
    const isSelected = selectedId === ent.id;
    const existing = entitySkins[ent.id];

    return (
      <button
        key={ent.id}
        type="button"
        onClick={() => onAssign(ent.id)}
        onMouseEnter={() => setSelectedId(ent.id)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition-colors cursor-pointer ${
          isSelected
            ? 'bg-surface-subtle border-text-main text-text-main'
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

        <div className="flex items-center gap-1.5 shrink-0">
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
          {isSelected && <Check className="w-3.5 h-3.5 text-text-main" />}
        </div>
      </button>
    );
  };

  return (
    <div
      className={UI_TOKENS.modal.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-skin-title"
        className="bg-surface w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-border-main text-text-main animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className={UI_TOKENS.modal.header}>
          <div className="min-w-0">
            <h2
              id="assign-skin-title"
              className="text-sm font-bold text-text-main truncate"
            >
              Assign 3D .GLB Skin
            </h2>
            <p className="text-[11px] font-mono text-text-muted truncate mt-0.5">
              {pendingDrop.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-muted transition-colors cursor-pointer"
            title="Cancel (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target List */}
        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {/* Stage Environment Target */}
          <button
            type="button"
            onClick={() => onAssign('stage')}
            onMouseEnter={() => setSelectedId('stage')}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
              selectedId === 'stage'
                ? 'bg-surface-subtle border-text-main text-text-main'
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
            <div className="flex items-center gap-1.5 shrink-0">
              {stageSkin && (
                <span className="text-[10px] font-mono text-amber-500 truncate max-w-[90px]">
                  replaces {stageSkin.name}
                </span>
              )}
              {selectedId === 'stage' && (
                <Check className="w-3.5 h-3.5 text-text-main" />
              )}
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

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border-subtle bg-surface-subtle flex items-center justify-between text-[10px] font-mono text-text-muted">
          <span>Session-only overlay · Press Enter to apply</span>
          <button
            type="button"
            onClick={onCancel}
            className="px-2.5 py-1 rounded-lg hover:bg-surface text-text-body cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
