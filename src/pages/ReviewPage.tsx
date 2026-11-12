import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
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

interface TimePoint { date: string; created: number; inProgress: number; completed: number }

interface AssigneePoint {
  name: string
  color: string
  open: number
  completed: number
}

type LogEntry = { action: string; payload: unknown; created_at: string }

type Granularity = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month'
const GRANULARITIES: Granularity[] = ['second', 'minute', 'hour', 'day', 'week', 'month']
const GRAN_LABELS = ['Second', 'Minute', 'Hour', 'Day', 'Week', 'Month']

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

function bucketKey(iso: string, gran: Granularity): string {
  switch (gran) {
    case 'second': return iso.slice(0, 19)
    case 'minute': return iso.slice(0, 16)
    case 'hour':   return iso.slice(0, 13)
    case 'day':    return iso.slice(0, 10)
    case 'week': {
      const d = new Date(iso)
      const dow = d.getUTCDay()
      const offset = dow === 0 ? 6 : dow - 1
      const mon = new Date(d)
      mon.setUTCDate(d.getUTCDate() - offset)
      return mon.toISOString().slice(0, 10)
    }
    case 'month': return iso.slice(0, 7)
  }
}

function fmtBucket(key: string, gran: Granularity): string {
  switch (gran) {
    case 'second': return key.slice(11, 19)
    case 'minute': return key.slice(11, 16)
    case 'hour': {
      const d = new Date(key + ':00:00Z')
      return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${d.getUTCHours()}h`
    }
    case 'day':   return fmtDate(key)
    case 'week':  return `Wk ${fmtDate(key)}`
    case 'month': return new Date(key + '-01T00:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }
}

function buildTimeData(log: LogEntry[], gran: Granularity): TimePoint[] {
  const created:    Record<string, number> = {}
  const inProgress: Record<string, number> = {}
  const completed:  Record<string, number> = {}

  for (const e of log) {
    const key = bucketKey(e.created_at, gran)
    if (e.action === 'task_created') {
      created[key] = (created[key] ?? 0) + 1
    } else if (e.action === 'status_changed') {
      const p = e.payload as Record<string, unknown> | null
      if (p?.to === 'in_progress') inProgress[key] = (inProgress[key] ?? 0) + 1
      if (p?.to === 'completed')   completed[key]  = (completed[key]  ?? 0) + 1
    }
  }

  const allKeys = [...new Set([
    ...Object.keys(created),
    ...Object.keys(inProgress),
    ...Object.keys(completed),
  ])].sort()

  let cumCreated = 0, cumInProgress = 0, cumCompleted = 0
  return allKeys.map((key) => {
    cumCreated    += created[key]    ?? 0
    cumInProgress += inProgress[key] ?? 0
    cumCompleted  += completed[key]  ?? 0
    return { date: key, created: cumCreated, inProgress: cumInProgress, completed: cumCompleted }
  })
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
  const [rawLog, setRawLog]             = useState<LogEntry[]>([])
  const [timeData, setTimeData]         = useState<TimePoint[]>([])
  const [granularity, setGranularity]   = useState<Granularity>('day')
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

  useEffect(() => {
    setTimeData(buildTimeData(rawLog, granularity))
  }, [rawLog, granularity])

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
      : { data: [] as LogEntry[] }

    const assigneeIds = [...new Set((tasks ?? []).filter((t) => t.assignee_id).map((t) => t.assignee_id as string))]
    const { data: profiles } = assigneeIds.length
      ? await supabase.from('profiles').select('id, display_name, avatar_color').in('id', assigneeIds)
      : { data: [] as { id: string; display_name: string; avatar_color: string }[] }

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

    /* ── Summary ── */
    const creations        = (statusLog ?? []).filter((e) => e.action === 'task_created')
    const completedTasks   = (tasks ?? []).filter((t) => t.status === 'completed')
    const openTasks        = (tasks ?? []).filter((t) => t.status !== 'completed')
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

    setRawLog((statusLog ?? []) as LogEntry[])

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

  const granIdx = GRANULARITIES.indexOf(granularity)

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
                  timeData.length === 0 ? (
                    <p className={styles.empty}>No activity recorded yet.</p>
                  ) : (
                    <div className={styles.timelineWrap}>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={timeData} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
                        <XAxis
                          dataKey="date"
                          tickFormatter={(key) => fmtBucket(key, granularity)}
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
                          labelFormatter={(label) => fmtBucket(String(label), granularity)}
                        />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                        <Line
                          type="stepAfter"
                          dataKey="created"
                          name="Created"
                          stroke="rgba(255,255,255,0.25)"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="stepAfter"
                          dataKey="inProgress"
                          name="In Progress"
                          stroke="var(--color-col-in-progress, #f59e0b)"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="stepAfter"
                          dataKey="completed"
                          name="Completed"
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className={styles.granControl}>
                      <input
                        type="range"
                        min={0}
                        max={5}
                        step={1}
                        value={granIdx}
                        onChange={(e) => setGranularity(GRANULARITIES[Number(e.target.value)])}
                        className={styles.granSlider}
                      />
                      <div className={styles.granLabels}>
                        {GRAN_LABELS.map((l, i) => (
                          <span
                            key={l}
                            className={`${styles.granLabel} ${i === granIdx ? styles.granLabelActive : ''}`}
                            style={{ left: `calc(${i / 5} * (100% - 11px) + 5.5px)` }}
                          >
                            {l}
                          </span>
                        ))}
                      </div>
                    </div>
                    </div>
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
