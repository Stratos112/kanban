import { useEffect, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import TaskCard, { type TaskCardProps } from './TaskCard'

interface Props extends TaskCardProps {
  id: string
  onOpen?: () => void
  isSelectable?: boolean
  onSelect?: () => void
}

export default function SortableTaskCard({ id, onOpen, isSelectable, onSelect, ...props }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const didDrag = useRef(false)

  useEffect(() => {
    if (isDragging) didDrag.current = true
  }, [isDragging])

  function handleClick() {
    if (isSelectable) {
      onSelect?.()
      return
    }
    if (didDrag.current) { didDrag.current = false; return }
    onOpen?.()
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.25 : 1,
        cursor: isDragging ? 'grabbing' : isSelectable ? 'crosshair' : 'grab',
      }}
      onClick={handleClick}
      {...attributes}
      {...listeners}
    >
      <TaskCard {...props} isSelectable={isSelectable} onSelect={onSelect} />
    </div>
  )
}
