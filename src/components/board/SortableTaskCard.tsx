import { useEffect, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import TaskCard, { type TaskCardProps } from './TaskCard'
import styles from './SortableTaskCard.module.css'

interface Props extends TaskCardProps {
  id: string
  onOpen?: () => void
  isSelectable?: boolean
  onSelect?: () => void
  onAccept?: () => void
  isParent?: boolean
  isWaitingOnTask?: boolean
  isCompleted?: boolean
  isCascading?: boolean
}

export default function SortableTaskCard({ id, onOpen, isSelectable, onSelect, onAccept, isParent, isWaitingOnTask, isCompleted, isCascading, ...props }: Props) {
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
      className={isCascading ? styles.cascadeArriving : undefined}
      style={{
        transform: isCascading ? undefined : CSS.Transform.toString(transform),
        transition: isCascading ? undefined : transition,
        opacity: isDragging ? 0.25 : 1,
        cursor: isDragging ? 'grabbing' : isSelectable ? 'crosshair' : 'grab',
        ...(isSelectable ? { position: 'relative' as const, zIndex: 2 } : {}),
      }}
      onClick={handleClick}
      {...attributes}
      {...listeners}
    >
      <TaskCard {...props} isSelectable={isSelectable} onSelect={onSelect} onAccept={onAccept} isParent={isParent} isWaitingOnTask={isWaitingOnTask} isCompleted={isCompleted} />
    </div>
  )
}
