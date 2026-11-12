import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import styles from './ProfilePage.module.css'

const PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4',
]

interface PendingInvite {
  id: string
  inviterId: string
  inviterName: string
  inviterColor: string
}

interface TeamMember {
  id: string
  name: string
  color: string
}

export default function ProfilePage() {
  const { profile, userId, loading, isGuest, setProfile, hideOthers, setHideOthers, signOut, refreshTeammates } = useAuth()
  const [name, setName] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null)
  const avatarRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  const [activeTab, setActiveTab] = useState<'identity' | 'team'>('identity')

  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [showInvitePopup, setShowInvitePopup] = useState(false)
  const [teammates, setTeammates] = useState<TeamMember[]>([])
  const [boardMembers, setBoardMembers] = useState<TeamMember[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (profile) setName(profile.display_name)
  }, [profile])

  useEffect(() => {
    if (!pickerOpen) return
    function onDown(e: MouseEvent) {
      const target = e.target as Node
      if (
        pickerRef.current && !pickerRef.current.contains(target) &&
        avatarRef.current && !avatarRef.current.contains(target)
      ) {
        setPickerOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPickerOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [pickerOpen])

  // Check for pending invites on load
  useEffect(() => {
    if (!userId) return
    async function checkInvites() {
      const { data } = await (supabase as any)
        .from('team_invites')
        .select('id, inviter_id, inviter_color')
        .eq('invitee_id', userId!)
        .eq('status', 'pending')
      if (!(data as any[])?.length) return
      const rows = data as { id: string; inviter_id: string; inviter_color: string }[]
      const ids = rows.map((d) => d.inviter_id)
      const { data: profiles } = await supabase
        .from('profiles').select('id, display_name').in('id', ids)
      const invites: PendingInvite[] = rows.map((d) => ({
        id: d.id,
        inviterId: d.inviter_id,
        inviterName: profiles?.find((p) => p.id === d.inviter_id)?.display_name ?? 'Someone',
        inviterColor: d.inviter_color,
      }))
      setPendingInvites(invites)
      setShowInvitePopup(true)
    }
    checkInvites()
  }, [userId])

  useEffect(() => {
    if (!userId || activeTab !== 'team') return
    loadTeamTabData()
  }, [userId, activeTab])

  async function loadTeamTabData() {
    if (!userId) return
    setTeamLoading(true)

    const db = supabase as any
    const [{ data: acceptedRaw }, { data: outgoingRaw }, { data: myTasks }] = await Promise.all([
      db
        .from('team_invites')
        .select('inviter_id, invitee_id')
        .or(`inviter_id.eq.${userId},invitee_id.eq.${userId}`)
        .eq('status', 'accepted'),
      db
        .from('team_invites')
        .select('invitee_id')
        .eq('inviter_id', userId)
        .eq('status', 'pending'),
      supabase
        .from('tasks').select('board_id').eq('user_id', userId).limit(1),
    ])
    const accepted = acceptedRaw as { inviter_id: string; invitee_id: string }[] | null
    const outgoing = outgoingRaw as { invitee_id: string }[] | null

    const teammateIdList = (accepted ?? []).map((r) =>
      r.inviter_id === userId ? r.invitee_id : r.inviter_id
    )
    const pendingOutgoing = new Set((outgoing ?? []).map((r) => r.invitee_id as string))
    const boardId = (myTasks as { board_id: string }[] | null)?.[0]?.board_id

    let potentialIds: string[] = []
    if (boardId) {
      const { data: memberRows } = await supabase
        .from('tasks').select('user_id').eq('board_id', boardId).neq('user_id', userId)
      potentialIds = [...new Set((memberRows ?? []).map((r) => (r as { user_id: string }).user_id))]
    }

    const allIds = [...new Set([...teammateIdList, ...potentialIds])]
    const profileMap = new Map<string, { name: string; color: string }>()
    if (allIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles').select('id, display_name, avatar_color').in('id', allIds)
      for (const p of profiles ?? []) {
        profileMap.set(p.id, { name: p.display_name, color: p.avatar_color })
      }
    }

    const teammateSet = new Set(teammateIdList)

    setTeammates(
      teammateIdList.map((id) => ({
        id,
        name: profileMap.get(id)?.name ?? 'Unknown',
        color: profileMap.get(id)?.color ?? '#6366f1',
      }))
    )
    setBoardMembers(
      potentialIds
        .filter((id) => !teammateSet.has(id) && !pendingOutgoing.has(id))
        .map((id) => ({
          id,
          name: profileMap.get(id)?.name ?? 'Unknown',
          color: profileMap.get(id)?.color ?? '#6366f1',
        }))
    )
    setInvitedIds(pendingOutgoing)
    setTeamLoading(false)
  }

  async function saveName() {
    if (!userId || !name.trim() || name === profile?.display_name) return
    await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', userId)
  }

  async function pickColor(color: string) {
    if (!userId || !profile) return
    setProfile({ ...profile, avatar_color: color })
    setPickerOpen(false)
    await supabase.from('profiles').update({ avatar_color: color }).eq('id', userId)
  }

  async function handleInvite(memberId: string) {
    if (!userId || !profile) return
    setInvitedIds((prev) => new Set([...prev, memberId]))
    const { data: myTasks } = await supabase
      .from('tasks').select('board_id').eq('user_id', userId).limit(1)
    const boardId = (myTasks as { board_id: string }[] | null)?.[0]?.board_id ?? null
    await (supabase as any).from('team_invites').insert({
      inviter_id: userId,
      invitee_id: memberId,
      inviter_color: profile.avatar_color,
      board_id: boardId,
    })
  }

  async function handleAcceptInvite(invite: PendingInvite) {
    if (!userId || !profile) return
    await (supabase as any).from('team_invites').update({ status: 'accepted' }).eq('id', invite.id)
    const newProfile = { ...profile, avatar_color: invite.inviterColor }
    setProfile(newProfile)
    await supabase.from('profiles').update({ avatar_color: invite.inviterColor }).eq('id', userId)
    await refreshTeammates()
    const remaining = pendingInvites.filter((i) => i.id !== invite.id)
    setPendingInvites(remaining)
    if (remaining.length === 0) setShowInvitePopup(false)
    if (activeTab === 'team') loadTeamTabData()
  }

  async function handleDeclineInvite(inviteId: string) {
    await (supabase as any).from('team_invites').update({ status: 'declined' }).eq('id', inviteId)
    const remaining = pendingInvites.filter((i) => i.id !== inviteId)
    setPendingInvites(remaining)
    if (remaining.length === 0) setShowInvitePopup(false)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Profile</h1>
      </header>

      <div className={styles.content}>
        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'identity' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('identity')}
          >
            Identity
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'team' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('team')}
          >
            Team
            {teammates.length > 0 && (
              <span className={styles.tabBadge}>{teammates.length}</span>
            )}
            {pendingInvites.length > 0 && (
              <span className={styles.tabAlert} />
            )}
          </button>
        </div>

        {/* Identity tab */}
        {activeTab === 'identity' && (
          <>
            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>Your identity</h2>
              {loading ? (
                <p className={styles.empty}>Loading…</p>
              ) : (
                <div className={styles.identity}>
                  <div className={styles.avatarWrap}>
                    <div
                      ref={avatarRef}
                      className={styles.avatar}
                      style={{ background: profile?.avatar_color ?? '#6366f1' }}
                      aria-label="Pick avatar color"
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (pickerOpen) { setPickerOpen(false); return }
                        const rect = avatarRef.current?.getBoundingClientRect()
                        if (rect) setPickerPos({ top: rect.bottom + 10, left: rect.left + rect.width / 2 })
                        setPickerOpen(true)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          const rect = avatarRef.current?.getBoundingClientRect()
                          if (rect) setPickerPos({ top: rect.bottom + 10, left: rect.left + rect.width / 2 })
                          setPickerOpen((o) => !o)
                        }
                      }}
                    />
                    {pickerOpen && pickerPos && (
                      <div
                        ref={pickerRef}
                        className={styles.picker}
                        style={{ top: pickerPos.top, left: pickerPos.left }}
                      >
                        {PALETTE.map((c) => (
                          <button
                            key={c}
                            className={styles.swatch}
                            style={{ background: c }}
                            aria-label={c}
                            aria-pressed={profile?.avatar_color === c}
                            onClick={() => pickColor(c)}
                          >
                            {profile?.avatar_color === c && <span className={styles.swatchCheck}>✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={styles.nameWrap}>
                    <label className={styles.fieldLabel} htmlFor="display-name">
                      Display name
                    </label>
                    <input
                      id="display-name"
                      className={styles.nameInput}
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={saveName}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                      placeholder="Your name"
                    />
                  </div>
                </div>
              )}
            </section>

            <section className={`${styles.focusCard} ${hideOthers ? styles.focusOn : ''}`}>
              <div className={styles.focusRow}>
                <div className={styles.focusText}>
                  <span className={styles.focusTitle}>Focus mode</span>
                  <span className={styles.focusDesc}>
                    Hide tasks assigned to other team members. Unassigned tasks and your own tasks always stay visible.
                  </span>
                </div>
                <label className={styles.toggleLabel}>
                  <input
                    type="checkbox"
                    className={styles.toggleInput}
                    checked={hideOthers}
                    onChange={(e) => setHideOthers(e.target.checked)}
                  />
                  <span className={styles.toggleTrack}>
                    <span className={styles.toggleThumb} />
                  </span>
                </label>
              </div>
              <span className={`${styles.focusStatus} ${hideOthers ? styles.on : styles.off}`}>
                {hideOthers ? 'On — showing your tasks only' : 'Off — showing all tasks'}
              </span>
            </section>

            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>Stats</h2>
              <div className={styles.stats}>
                <div className={styles.stat}>
                  <span className={styles.statValue}>0</span>
                  <span className={styles.statLabel}>Assigned</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>0</span>
                  <span className={styles.statLabel}>Completed</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>0</span>
                  <span className={styles.statLabel}>Questions asked</span>
                </div>
              </div>
            </section>

            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>Recent activity</h2>
              <p className={styles.empty}>No activity yet.</p>
            </section>

            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>Account</h2>
              {isGuest ? (
                <div className={styles.accountRow}>
                  <span className={styles.guestNote}>Signed in as guest — your session is tied to this browser.</span>
                  <button
                    type="button"
                    className={styles.googleBtn}
                    onClick={() => supabase.auth.linkIdentity({ provider: 'google' })}
                  >
                    <GoogleIcon />
                    Sign in with Google
                  </button>
                </div>
              ) : (
                <div className={styles.accountRow}>
                  <span className={styles.signedInNote}>Signed in with Google</span>
                  <button type="button" className={styles.signOutBtn} onClick={signOut}>
                    Sign out
                  </button>
                </div>
              )}
            </section>
          </>
        )}

        {/* Team tab */}
        {activeTab === 'team' && (
          <>
            {teamLoading ? (
              <p className={styles.empty}>Loading…</p>
            ) : (
              <>
                {teammates.length > 0 && (
                  <section className={styles.card}>
                    <h2 className={styles.sectionTitle}>Your teammates</h2>
                    <div className={styles.memberList}>
                      {teammates.map((m) => (
                        <div key={m.id} className={styles.memberRow}>
                          <div className={styles.memberAvatar} style={{ background: m.color }} />
                          <span className={styles.memberName}>{m.name}</span>
                          <span className={styles.memberTeamChip}>Teammate</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className={styles.card}>
                  <h2 className={styles.sectionTitle}>Invite board members</h2>
                  {boardMembers.length === 0 && invitedIds.size === 0 ? (
                    <p className={styles.empty}>No other users on your boards yet.</p>
                  ) : (
                    <div className={styles.memberList}>
                      {boardMembers.map((m) => (
                        <div key={m.id} className={styles.memberRow}>
                          <div className={styles.memberAvatar} style={{ background: m.color }} />
                          <span className={styles.memberName}>{m.name}</span>
                          {invitedIds.has(m.id) ? (
                            <span className={styles.memberSentChip}>Sent</span>
                          ) : (
                            <button
                              type="button"
                              className={styles.memberInviteBtn}
                              onClick={() => handleInvite(m.id)}
                            >
                              Invite
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </div>

      {/* Pending invite popup */}
      {showInvitePopup && pendingInvites.length > 0 && (
        <div className={styles.inviteOverlay} onClick={() => setShowInvitePopup(false)}>
          <div className={styles.invitePopup} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.invitePopupTitle}>Team Invitation</h2>
            <p className={styles.invitePopupSub}>
              Accepting will sync your avatar color with your teammate.
            </p>
            <div className={styles.inviteList}>
              {pendingInvites.map((invite) => (
                <div key={invite.id} className={styles.inviteCard}>
                  <div className={styles.inviteCardAvatar} style={{ background: invite.inviterColor }} />
                  <div className={styles.inviteCardText}>
                    <span className={styles.inviteCardName}>{invite.inviterName}</span>
                    <span className={styles.inviteCardMsg}>invited you to their team</span>
                  </div>
                  <div className={styles.inviteCardActions}>
                    <button
                      type="button"
                      className={styles.inviteAcceptBtn}
                      onClick={() => handleAcceptInvite(invite)}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className={styles.inviteDeclineBtn}
                      onClick={() => handleDeclineInvite(invite.id)}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}
