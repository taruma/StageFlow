/**
 * Sortable item wrapper powered by `@dnd-kit/sortable`.
 * Pointer/keyboard drag listeners are attached strictly to the `dragHandle` element
 * so inline Figma number scrubbers and buttons never trigger unintended drags.
 */

import React from 'react';
import { GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface SortableItemRenderProps {
  dragHandle: React.ReactNode;
  isDragging: boolean;
}

export interface SortableItemProps {
  id: string;
  disabled?: boolean;
  handleTitle?: string;
  handleClassName?: string;
  children: (props: SortableItemRenderProps) => React.ReactNode;
}

export const SortableItem: React.FC<SortableItemProps> = React.memo(
  ({
    id,
    disabled = false,
    handleTitle = 'Drag to reorder',
    handleClassName = '',
    children,
  }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id, disabled });

    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    const dragHandle = disabled ? null : (
      <button
        type="button"
        {...attributes}
        {...listeners}
        className={`p-0.5 rounded text-text-faint hover:text-amber-500 cursor-grab active:cursor-grabbing touch-none shrink-0 transition-colors ${handleClassName}`}
        title={handleTitle}
        aria-label={handleTitle}
      >
        <GripVertical className="w-3 h-3" />
      </button>
    );

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={
          isDragging
            ? 'relative z-30 rounded-lg ring-1 ring-amber-500/50 bg-surface/95 shadow-md opacity-95'
            : undefined
        }
      >
        {children({ dragHandle, isDragging })}
      </div>
    );
  }
);
