/**
 * Reusable Up / Down / Delete action buttons shared across Visual Score Editor card headers.
 */

import React from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';

export interface CardReorderActionsProps {
  disabled?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDelete?: boolean;
  moveUpTitle?: string;
  moveDownTitle?: string;
  deleteTitle: string;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

export const CardReorderActions: React.FC<CardReorderActionsProps> =
  React.memo(
    ({
      disabled = false,
      canMoveUp,
      canMoveDown,
      canDelete = true,
      moveUpTitle = 'Move up',
      moveDownTitle = 'Move down',
      deleteTitle,
      onMoveUp,
      onMoveDown,
      onDelete,
    }) => {
      if (disabled) return null;

      return (
        <div className="flex items-center gap-0.5 shrink-0">
          {canMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              className="p-0.5 rounded text-text-faint hover:text-text-main cursor-pointer"
              title={moveUpTitle}
            >
              <ArrowUp className="w-3 h-3" />
            </button>
          )}
          {canMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              className="p-0.5 rounded text-text-faint hover:text-text-main cursor-pointer"
              title={moveDownTitle}
            >
              <ArrowDown className="w-3 h-3" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-0.5 rounded text-text-faint hover:text-rose-500 cursor-pointer"
              title={deleteTitle}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      );
    }
  );
