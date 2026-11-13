import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getBoardBySlug } from '../lib/boards'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { PRESET_LABELS, DEFAULT_LABEL_COLOR } from '../lib/labels'
import type { Label } from '../lib/database.types'
import styles from './SettingsPage.module.css'

const PALETTE = [
  '#64748b', '#3b82f6', '#6366f1', '#8b5cf6',
  '#ec4899', '#ef4444', '#f97316', '#f59e0b',
  '#22c55e', '#14b8a6', '#06b6d4', '#a78bfa',
]

interface ColorPickerProps {
  value: string
  onChange: (c: string) => void
}
function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className={styles.palette}>
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          className={`${styles.swatch} ${c === value ? styles.swatchActive : ''}`}
          style={{ '--swatch-color': c } as React.CSSProperties}
          onClick={() => onChange(c)}
          aria-label={c}
        />
      ))}
    </div>
  )
}

export default function SettingsPage() {
  const { slug } = useParams<{ slug: string }>()
  const { userId } = useAuth()

  const [boardId, setBoardId]       = useState<string | null>(null)
  const [labels, setLabels]         = useState<Label[]>([])
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [showAdd, setShowAdd]       = useState(false)
  const [addName, setAddName]       = useState('')
  const [addColor, setAddColor]     = useState(PALETTE[1])

  useEffect(() => {
    if (!slug || !userId) return
    getBoardBySlug(slug).then(async (board) => {
      if (!board) return
      setBoardId(board.id)
      await seedPresetLabels(board.id)
      loadLabels(board.id)
    })
  }, [slug, userId])

  async function seedPresetLabels(id: string) {
    if (!userId) return
    await supabase.from('labels').upsert(
      PRESET_LABELS.map((name) => ({ user_id: userId, board_id: id, name, color: DEFAULT_LABEL_COLOR })),
      { onConflict: 'board_id,name', ignoreDuplicates: true },
    )
  }

  async function loadLabels(id: string) {
    const { data } = await supabase
      .from('labels')
      .select('*')
      .eq('board_id', id)
      .order('name')
    setLabels(data ?? [])
  }

  async function updateColor(labelId: string, color: string) {
    setLabels((prev) => prev.map((l) => l.id === labelId ? { ...l, color } : l))
    await supabase.from('labels').update({ color }).eq('id', labelId)
    setEditingId(null)
  }

  async function deleteLabel(labelId: string) {
    setLabels((prev) => prev.filter((l) => l.id !== labelId))
    await supabase.from('labels').delete().eq('id', labelId)
  }

  async function createLabel() {
    if (!addName.trim() || !userId || !boardId) return
    const { data } = await supabase
      .from('labels')
      .insert({ user_id: userId, board_id: boardId, name: addName.trim(), color: addColor })
      .select()
      .single()
    if (data) setLabels((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setAddName('')
    setAddColor(PALETTE[1])
    setShowAdd(false)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Labels</h1>
      </header>

      <div className={styles.content}>
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Labels</h2>

          {labels.length === 0 && !showAdd && (
            <p className={styles.empty}>No labels yet.</p>
          )}

          <ul className={styles.labelList}>
            {labels.map((label) => (
              <li key={label.id} className={styles.labelItem}>
                <div className={styles.labelRow}>
                  <button
                    className={styles.colorDot}
                    style={{ background: label.color }}
                    onClick={() => setEditingId(editingId === label.id ? null : label.id)}
                    aria-label="Change color"
                  />
                  <span className={styles.labelName}>{label.name}</span>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => deleteLabel(label.id)}
                    aria-label="Delete label"
                  >
                    ✕
                  </button>
                </div>
                {editingId === label.id && (
                  <div className={styles.pickerWrap}>
                    <ColorPicker
                      value={label.color}
                      onChange={(c) => updateColor(label.id, c)}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>

          {showAdd ? (
            <div className={styles.addForm}>
              <div className={styles.addRow}>
                <input
                  className={styles.addInput}
                  type="text"
                  placeholder="Label name…"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') createLabel(); if (e.key === 'Escape') setShowAdd(false) }}
                  autoFocus
                />
                <button
                  className={styles.createBtn}
                  onClick={createLabel}
                  disabled={!addName.trim()}
                >
                  Create
                </button>
                <button className={styles.cancelAddBtn} onClick={() => setShowAdd(false)}>✕</button>
              </div>
              <ColorPicker value={addColor} onChange={setAddColor} />
            </div>
          ) : (
            <button className={styles.addLabelBtn} onClick={() => setShowAdd(true)}>
              + Add label
            </button>
          )}
        </section>
      </div>
    </div>
  )
}
