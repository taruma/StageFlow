/**
 * Subtle hover-revealed "+" insertion seam between Visual Editor cards
 * (inspired by ScriptFlow's HoverInsertSeam).
 */

import React from 'react';
import { Plus } from 'lucide-react';

export interface InsertBetweenSeamProps {
  label: string;
  disabled?: boolean;
  onInsert: () => void;
}

export const InsertBetweenSeam: React.FC<InsertBetweenSeamProps> = React.memo(
  ({ label, disabled = false, onInsert }) => {
    if (disabled) return null;

    return (
      <div className="group/seam relative h-3 flex items-center justify-center my-0.5">
        <div className="w-full h-px bg-transparent group-hover/seam:bg-amber-500/40 transition-colors" />
        <button
          type="button"
          onClick={onInsert}
          className="absolute inline-flex items-center gap-1 px-2 py-0.2 rounded-full bg-surface border border-border-main group-hover/seam:border-amber-500/60 text-[9px] font-mono font-semibold text-text-faint group-hover/seam:text-amber-600 dark:group-hover/seam:text-amber-300 opacity-0 group-hover/seam:opacity-100 focus:opacity-100 transition-all shadow-2xs cursor-pointer"
          title={label}
        >
          <Plus className="w-2.5 h-2.5" />
          <span>{label}</span>
        </button>
      </div>
    );
  }
);
