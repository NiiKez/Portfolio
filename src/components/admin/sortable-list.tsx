'use client';

import { useEffect, useId, useState } from 'react';
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
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVerticalIcon } from 'lucide-react';

type WithId = { id: string };

type RowProps = {
  ref: (node: HTMLElement | null) => void;
  style: React.CSSProperties;
};

type SortableListProps<T extends WithId> = {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (
    item: T,
    dragHandle: React.ReactNode,
    rowProps: RowProps,
  ) => React.ReactNode;
};

type SortableItemProps<T extends WithId> = {
  item: T;
  renderItem: SortableListProps<T>['renderItem'];
};

function SortableItem<T extends WithId>({
  item,
  renderItem,
}: SortableItemProps<T>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: isDragging ? 'relative' : undefined,
    zIndex: isDragging ? 1 : undefined,
  };

  const dragHandle = (
    <button
      type="button"
      className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
      aria-label="Drag to reorder"
      {...attributes}
      {...listeners}
    >
      <GripVerticalIcon className="h-4 w-4" />
    </button>
  );

  return <>{renderItem(item, dragHandle, { ref: setNodeRef, style })}</>;
}

export function SortableList<T extends WithId>({
  items,
  onReorder,
  renderItem,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Give DndContext a hydration-stable id. Without one, @dnd-kit derives its
  // `aria-describedby` ("DndDescribedBy-N") from a module-level counter that
  // drifts on the server across requests but resets to 0 on the client,
  // causing a hydration mismatch. useId() is identical on server and client.
  const dndId = useId();

  // Render the DndContext accessibility announcer into <body> so it is never
  // injected as a sibling of <tr> or <td> elements (invalid HTML in <tbody>).
  const [announcer, setAnnouncer] = useState<HTMLElement | undefined>(
    undefined,
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- document is only available on the client; capture after mount
    setAnnouncer(document.body);
  }, []);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{ container: announcer }}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        {items.map((item) => (
          <SortableItem key={item.id} item={item} renderItem={renderItem} />
        ))}
      </SortableContext>
    </DndContext>
  );
}
