import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, LabelList,
} from 'recharts'
import { getBoardBySlug } from '../lib/boards'
import { supabase } from '../lib/supabase'
import styles from './ReviewPage.module.css'

/* ── Types ───────────────────────────────────────────── */
interface SummaryData {
  totalCreated: number
  totalCompleted: number
  firstCreated: string | null
  lastEvent: string | null
  hasOpenTasks: boolean
}

interface DayPoint { date: string; completed: number; cumulative: number }

interface AssigneePoint {
  name: string
  color: string
  open: number
  completed: number
}

/* ── Helpers ─────────────────────────────────────────── */
function formatDuration(from: string, to: string): string {
  const days = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000)
  if (days < 1)   return 'Less than a day'
  if (days === 1) return '1 day'
  if (days < 7)   return `${days} days`
  const weeks = Math.floor(days / 7)
  const rem   = days % 7
  if (weeks < 4)  return rem ? `${weeks}w ${rem}d` : `${weeks} week${weeks > 1 ? 's' : ''}`
  const months = Math.floor(days / 30)
  return `${months} month${months > 1 ? 's' : ''}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/* ── Stat card ───────────────────────────────────────── */
function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
      {sub && <span className={styles.statSub}>{sub}</span>}
    </div>
  )
}

/* ── Page ────────────────────────────────────────────── */
export default function ReviewPage() {
  const { slug } = useParams<{ slug: string }>()
  const [boardId, setBoardId]           = useState<string | null>(null)
  const [summary, setSummary]           = useState<SummaryData | null>(null)
  const [dayData, setDayData]           = useState<DayPoint[]>([])
  const [assigneeData, setAssigneeData] = useState<AssigneePoint[]>([])
  const [activeTab, setActiveTab]       = useState<'timeline' | 'assignees'>('timeline')
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    if (!slug) return
    getBoardBySlug(slug).then((board) => { if (board) setBoardId(board.id) })
  }, [slug])

  useEffect(() => {
    if (!boardId) return
    load(boardId)
  }, [boardId])

  async function load(id: string) {
    setLoading(true)

    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, status, assignee_id')
      .eq('board_id', id)
      .neq('status', 'context')

    const taskIds = (tasks ?? []).map((t) => t.id)

    const { data: statusLog } = taskIds.length
      ? await supabase
          .from('activity_log')
          .select('task_id, action, payload, created_at')
          .in('task_id', taskIds)
          .order('created_at', { ascending: true })
      : { data: [] as { task_id: string; action: string; payload: unknown; created_at: string }[] }

    const assigneeIds = [...new Set((tasks ?? []).filter((t) => t.assignee_id).map((t) => t.assignee_id as string))]
    const { data: profiles } = assigneeIds.length
      ? await supabase.from('profiles').select('id, display_name, avatar_color').in('id', assigneeIds)
      : { data: [] as { id: string; display_name: string; avatar_color: string }[] }

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

    /* ── Summary ── */
    const creations  = (statusLog ?? []).filter((e) => e.action === 'task_created')
    const completedTasks = (tasks ?? []).filter((t) => t.status === 'completed')
    const openTasks      = (tasks ?? []).filter((t) => t.status !== 'completed')

    const completionEvents = (statusLog ?? []).filter((e) => {
      const p = e.payload as Record<string, unknown> | null
      return e.action === 'status_changed' && p?.to === 'completed'
    })

    const firstCreated   = creations[0]?.created_at ?? null
    const lastCompletion = completionEvents.length ? completionEvents[completionEvents.length - 1].created_at : null
    const lastEvent      = openTasks.length > 0 ? new Date().toISOString() : lastCompletion

    setSummary({
      totalCreated:   tasks?.length ?? 0,
      totalCompleted: completedTasks.length,
      firstCreated,
      lastEvent,
      hasOpenTasks:   openTasks.length > 0,
    })

    /* ── Completion over time ── */
    const dayCounts: Record<string, number> = {}
    for (const e of completionEvents) {
      const day = (e.created_at as string).slice(0, 10)
      dayCounts[day] = (dayCounts[day] ?? 0) + 1
    }

    if (Object.keys(dayCounts).length > 0) {
      const sorted = Object.keys(dayCounts).sort()
      const start  = new Date(sorted[0])
      const end    = new Date()
      const points: DayPoint[] = []
      let cumulative = 0
      for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10)
        const completed = dayCounts[key] ?? 0
        cumulative += completed
        points.push({ date: key, completed, cumulative })
      }
      setDayData(points)
    } else {
      setDayData([])
    }

    /* ── Work by assignee ── */
    const assigneeMap: Record<string, { open: number; completed: number }> = {}
    for (const t of tasks ?? []) {
      const key = t.assignee_id ?? '__unassigned__'
      if (!assigneeMap[key]) assigneeMap[key] = { open: 0, completed: 0 }
      if (t.status === 'completed') assigneeMap[key].completed++
      else assigneeMap[key].open++
    }

    const assigneePoints: AssigneePoint[] = Object.entries(assigneeMap)
      .map(([id, counts]) => {
        const p = profileMap.get(id)
        return { name: p?.display_name ?? 'Unassigned', color: p?.avatar_color ?? '#64748b', ...counts }
      })
      .sort((a, b) => (b.open + b.completed) - (a.open + a.completed))

    setAssigneeData(assigneePoints)
    setLoading(false)
  }

  const duration = summary?.firstCreated && summary?.lastEvent
    ? formatDuration(summary.firstCreated, summary.lastEvent)
    : '—'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Review</h1>
      </header>

      <div className={styles.content}>
        {loading ? (
          <p className={styles.empty}>Loading…</p>
        ) : (
          <>
            <div className={styles.summaryStrip}>
              <Stat label="Tasks created"   value={summary?.totalCreated  ?? 0} />
              <div className={styles.statDivider} />
              <Stat label="Tasks completed" value={summary?.totalCompleted ?? 0} />
              <div className={styles.statDivider} />
              <Stat
                label="Project duration"
                value={duration}
                sub={
                  summary?.hasOpenTasks
                    ? 'ongoing'
                    : summary?.lastEvent
                      ? `ended ${fmtDate(summary.lastEvent)}`
                      : undefined
                }
              />
            </div>

            <div className={styles.chartCard}>
              <div className={styles.tabs}>
                <button
                  className={`${styles.tab} ${activeTab === 'timeline' ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab('timeline')}
                >
                  Completion over time
                </button>
                <button
                  className={`${styles.tab} ${activeTab === 'assignees' ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab('assignees')}
                >
                  Work by assignee
                </button>
              </div>

              <div className={styles.chartArea}>
                {activeTab === 'timeline' && (
                  dayData.length === 0 ? (
                    <p className={styles.empty}>No completions recorded yet.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={dayData} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="cumulativeGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="var(--color-accent)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="date"
                          tickFormatter={fmtDate}
                          tick={{ fontSize: 11, fill: 'var(--color-text-subtle)' }}
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: 'var(--color-text-subtle)' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--color-surface-raised)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 6,
                            fontSize: 12,
                          }}
                          labelFormatter={(label) => fmtDate(String(label))}
                          formatter={(val, name) => [
                            val,
                            name === 'cumulative' ? 'Total completed' : 'Completed that day',
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="cumulative"
                          stroke="var(--color-accent)"
                          strokeWidth={2}
                          fill="url(#cumulativeGrad)"
                          dot={false}
                          name="cumulative"
                        />
                        <Area
                          type="monotone"
                          dataKey="completed"
                          stroke="var(--color-col-ready, #22c55e)"
                          strokeWidth={1.5}
                          fill="none"
                          dot={false}
                          strokeDasharray="4 2"
                          name="completed"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )
                )}

                {activeTab === 'assignees' && (
                  assigneeData.length === 0 ? (
                    <p className={styles.empty}>No assignee data yet.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(180, assigneeData.length * 52)}>
                      <BarChart
                        data={assigneeData}
                        layout="vertical"
                        margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
                        barCategoryGap="28%"
                      >
                        <XAxis
                          type="number"
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: 'var(--color-text-subtle)' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={90}
                          tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--color-surface-raised)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 6,
                            fontSize: 12,
                          }}
                          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        />
                        <Bar dataKey="completed" name="Completed" stackId="a" radius={[0, 0, 0, 0]}>
                          {assigneeData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} fillOpacity={0.9} />
                          ))}
                          <LabelList
                            dataKey="completed"
                            position="insideLeft"
                            style={{ fontSize: 11, fill: '#fff', fontWeight: 700 }}
                            formatter={(v: unknown) => Number(v) > 0 ? String(v) : ''}
                          />
                        </Bar>
                        <Bar dataKey="open" name="Open" stackId="a" radius={[0, 3, 3, 0]}>
                          {assigneeData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} fillOpacity={0.25} />
                          ))}
                          <LabelList
                            dataKey="open"
                            position="right"
                            style={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                            formatter={(v: unknown) => Number(v) > 0 ? `+${v}` : ''}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
