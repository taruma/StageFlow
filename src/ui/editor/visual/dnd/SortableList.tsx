/**
 * Reusable vertical sortable container powered by `@dnd-kit`.
 * Uses a 4px PointerSensor activation threshold so clicks and scrub drags remain responsive.
 */

import React, { useCallback } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

export interface SortableListProps {
  items: readonly string[];
  disabled?: boolean;
  onReorder: (fromIndex: number, toIndex: number) => void;
  children: React.ReactNode;
}

export const SortableList: React.FC<SortableListProps> = React.memo(
  ({ items, disabled = false, onReorder, children }) => {
    const sensors = useSensors(
      useSensor(PointerSensor, {
        activationConstraint: { distance: 4 },
      }),
      useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
      })
    );

    const handleDragEnd = useCallback(
      (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const fromIndex = items.indexOf(String(active.id));
        const toIndex = items.indexOf(String(over.id));
        if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
          onReorder(fromIndex, toIndex);
        }
      },
      [items, onReorder]
    );

    if (disabled) {
      return <>{children}</>;
    }

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={[...items]}
          strategy={verticalListSortingStrategy}
        >
          {children}
        </SortableContext>
      </DndContext>
    );
  }
);
