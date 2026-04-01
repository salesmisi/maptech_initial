import { useState, useRef } from 'react';

export interface DragItem {
  id: string;
  index: number;
}

export function useDragAndDrop<T extends { id: string }>(
  items: T[],
  onReorder: (items: T[]) => void
) {
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedItem({
      id: items[index].id,
      index,
    });
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (draggedItem && dragOverItem.current !== null && draggedItem.index !== dragOverItem.current) {
      const newItems = [...items];
      const draggedContent = newItems[draggedItem.index];
      
      // Remove dragged item
      newItems.splice(draggedItem.index, 1);
      
      // Insert at new position
      newItems.splice(dragOverItem.current, 0, draggedContent);
      
      onReorder(newItems);
    }
    
    setDraggedItem(null);
    dragOverItem.current = null;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return {
    draggedItem,
    handleDragStart,
    handleDragEnter,
    handleDragEnd,
    handleDragOver,
  };
}
