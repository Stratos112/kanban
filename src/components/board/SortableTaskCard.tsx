import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import TaskCard, { type TaskCardProps } from './TaskCard'

interface Props extends TaskCardProps {
  id: string
}

export default function SortableTaskCard({ id, ...props }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.25 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      {...attributes}
      {...listeners}
    >
      <TaskCard {...props} />
    </div>
  )
}
