export type TaskType = 'task' | 'context'
export type TaskStatus = 'backlog' | 'ready' | 'in_progress' | 'in_review' | 'completed' | 'context'
export type TaskPriority = 'low' | 'normal' | 'high'
export type RelationshipType = 'blocks' | 'blocked_by' | 'parent_of' | 'child_of' | 'waiting_on' | 'completes'

export interface Database {
  public: {
    Tables: {
      boards: {
        Row: {
          id:          string
          name:        string
          invite_code: string
          created_at:  string
        }
        Insert: {
          id?:          string
          name?:        string
          invite_code:  string
          created_at?:  string
        }
        Update: {
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          display_name: string
          avatar_color: string
          created_at: string
        }
        Insert: {
          id: string
          display_name: string
          avatar_color?: string
          created_at?: string
        }
        Update: {
          display_name?: string
          avatar_color?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          ref_key: number
          type: TaskType
          title: string | null
          description: string | null
          question: string | null
          answer: string | null
          status: TaskStatus
          priority: TaskPriority | null
          due_date: string | null
          position: number
          assignee_id: string | null
          user_id: string
          board_id: string | null
          parent_task_id: string | null
          context_relation_type: string | null
          parent_link_type: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          type?: TaskType
          title?: string | null
          description?: string | null
          question?: string | null
          answer?: string | null
          status: TaskStatus
          priority?: TaskPriority | null
          due_date?: string | null
          position?: number
          assignee_id?: string | null
          user_id: string
          board_id?: string | null
          parent_task_id?: string | null
          context_relation_type?: string | null
          parent_link_type?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          type?: TaskType
          title?: string | null
          description?: string | null
          question?: string | null
          answer?: string | null
          status?: TaskStatus
          priority?: TaskPriority | null
          due_date?: string | null
          position?: number
          assignee_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      labels: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color?: string
          created_at?: string
        }
        Update: {
          name?: string
          color?: string
        }
        Relationships: []
      }
      task_labels: {
        Row: {
          task_id: string
          label_id: string
        }
        Insert: {
          task_id: string
          label_id: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      task_relationships: {
        Row: {
          id: string
          from_task_id: string
          to_task_id: string
          type: RelationshipType
          board_id: string
          created_at: string
        }
        Insert: {
          id?: string
          from_task_id: string
          to_task_id: string
          type: RelationshipType
          board_id: string
          created_at?: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      activity_log: {
        Row: {
          id: string
          task_id: string
          actor_id: string | null
          action: string
          payload: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          actor_id?: string | null
          action: string
          payload?: Record<string, unknown> | null
          created_at?: string
        }
        Update: Record<string, never>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Convenience row types
export type Board   = Database['public']['Tables']['boards']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']
export type Label = Database['public']['Tables']['labels']['Row']
export type TaskLabel = Database['public']['Tables']['task_labels']['Row']
export type TaskRelationship = Database['public']['Tables']['task_relationships']['Row']
export type ActivityLogEntry = Database['public']['Tables']['activity_log']['Row']

// Enriched types used in the UI
export type TaskWithRelations = Task & {
  assignee: Profile | null
  labels: Label[]
}
