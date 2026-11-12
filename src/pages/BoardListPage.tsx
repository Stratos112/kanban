import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listBoards, createBoard } from '../lib/boards'
import type { Board } from '../lib/database.types'
import styles from './BoardListPage.module.css'

export default function BoardListPage() {
  const [boards, setBoards]       = useState<Board[]>([])
  const [loading, setLoading]     = useState(true)
  const [creating, setCreating]   = useState(false)
  const [newName, setNewName]     = useState('')
  const [working, setWorking]     = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    listBoards()
      .then(setBoards)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (creating) inputRef.current?.focus()
  }, [creating])

  async function handleCreate() {
    if (working) return
    setWorking(true)
    try {
      const board = await createBoard(newName)
      navigate(`/board/${board.invite_code}`)
    } catch (err) {
      console.error(err)
      setWorking(false)
      setCreating(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleCreate()
    if (e.key === 'Escape') { setCreating(false); setNewName('') }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.logo}>K</div>

        <div className={styles.section}>
          <span className={styles.sectionLabel}>Boards</span>

          <div className={styles.list}>
            {loading && (
              <span className={styles.empty}>Loading…</span>
            )}
            {!loading && boards.length === 0 && !creating && (
              <span className={styles.empty}>No boards yet.</span>
            )}
            {boards.map((b) => (
              <Link
                key={b.id}
                to={`/board/${b.invite_code}`}
                className={styles.boardRow}
              >
                <span className={styles.boardName}>{b.name}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            ))}

            {creating && (
              <div className={styles.newRow}>
                <input
                  ref={inputRef}
                  className={styles.newInput}
                  placeholder="Board name…"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={() => { if (!newName.trim()) { setCreating(false) } }}
                  disabled={working}
                />
                <button
                  className={styles.confirmBtn}
                  onClick={handleCreate}
                  disabled={working}
                  aria-label="Create board"
                >
                  {working ? '…' : '↵'}
                </button>
              </div>
            )}
          </div>

          {!creating && (
            <button
              className={styles.addBtn}
              onClick={() => { setNewName(''); setCreating(true) }}
              aria-label="New board"
            >
              +
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
