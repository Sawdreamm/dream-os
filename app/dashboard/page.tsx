'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Project, Phase, Task, Habit } from '@/types'
import { BLUEPRINTS, LEVEL_NAMES, XP_PER_TASK, XP_LEVELS } from '@/types'
import {
  getProjects,
  createProject,
  addTask,
  toggleTask,
  toggleSprint,
  deleteTask,
  updateTaskTitle,
  updatePhaseStatus,
  getHabitsToday,
  addHabit,
  toggleHabit,
  deleteHabit,
  logPomoSession,
  getPomoStats,
} from '@/lib/db'

// ─────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────
const POMO_FOCUS = 25 * 60
const POMO_BREAK = 5 * 60

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function getLevelInfo(xp: number) {
  let level = 0
  for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= XP_LEVELS[i]) { level = i; break }
  }
  const prevXp = XP_LEVELS[level] ?? 0
  const nextXp = XP_LEVELS[level + 1] ?? XP_LEVELS[XP_LEVELS.length - 1]
  const progress = nextXp === prevXp ? 100 : Math.min(((xp - prevXp) / (nextXp - prevXp)) * 100, 100)
  return {
    level,
    name: LEVEL_NAMES[level] ?? LEVEL_NAMES[LEVEL_NAMES.length - 1],
    progress,
    nextXp,
  }
}

function getProjectStats(project: Project) {
  const phases = project.phases ?? []
  const allTasks = phases.flatMap(p => p.tasks ?? [])
  const doneTasks = allTasks.filter(t => t.done).length
  const inSprint = allTasks.filter(t => t.in_sprint).length
  const donePhases = phases.filter(p => p.status === 'done').length
  const pct = allTasks.length ? Math.round((doneTasks / allTasks.length) * 100) : 0
  return { totalTasks: allTasks.length, doneTasks, inSprint, donePhases, totalPhases: phases.length, pct }
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 1.2)
  } catch { /* silent fail */ }
}

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
interface ToastItem { id: number; msg: string; type: 'ok' | 'err' }
type TabId = 'quest' | 'board' | 'pomo' | 'habits'

// ─────────────────────────────────────────
// DASHBOARD PAGE
// ─────────────────────────────────────────
export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [habits, setHabits] = useState<Habit[]>([])
  const [pomoStats, setPomoStats] = useState({ today: 0, week: 0, total: 0 })
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('quest')
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [showNewProject, setShowNewProject] = useState(false)
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set())

  // Pomo state
  const [pomoTime, setPomoTime] = useState(POMO_FOCUS)
  const [pomoRunning, setPomoRunning] = useState(false)
  const [pomoMode, setPomoMode] = useState<'focus' | 'break'>('focus')
  const pomoInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  const activeProject = projects.find(p => p.id === activeProjectId) ?? null

  // ── Toast helper ───────────────────────
  const toast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])

  // ── Initial data load ──────────────────
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth/login'; return }
      setUser(user)

      const [projs, habs, stats] = await Promise.all([
        getProjects(),
        getHabitsToday(),
        getPomoStats(),
      ])
      setProjects(projs)
      setHabits(habs)
      setPomoStats(stats)

      if (projs.length > 0) {
        setActiveProjectId(projs[0].id)
        const ids = new Set<string>()
        projs.forEach(p => p.phases?.forEach(ph => { if (ph.status === 'active') ids.add(ph.id) }))
        setExpandedPhases(ids)
      }
      setLoading(false)
    }
    load()
  }, [])

  // ── Pomodoro timer ─────────────────────
  useEffect(() => {
    if (pomoInterval.current) clearInterval(pomoInterval.current)
    if (!pomoRunning) return

    pomoInterval.current = setInterval(() => {
      setPomoTime(prev => {
        if (prev <= 1) {
          clearInterval(pomoInterval.current!)
          setPomoRunning(false)
          playBeep()
          if (pomoMode === 'focus') {
            logPomoSession({ duration: POMO_FOCUS, completed: true, ended_at: new Date().toISOString() })
              .then(() => getPomoStats().then(setPomoStats))
            toast('🍅 Focus complete! Take a break.')
            setPomoMode('break')
            return POMO_BREAK
          } else {
            toast('☕ Break over! Time to focus.')
            setPomoMode('focus')
            return POMO_FOCUS
          }
        }
        return prev - 1
      })
    }, 1000)

    return () => { if (pomoInterval.current) clearInterval(pomoInterval.current) }
  }, [pomoRunning, pomoMode, toast])

  function pomoReset() {
    setPomoRunning(false)
    setPomoTime(pomoMode === 'focus' ? POMO_FOCUS : POMO_BREAK)
  }

  // ── Task mutations (optimistic) ────────
  async function handleToggleTask(taskId: string, phaseId: string, done: boolean) {
    const updated = projects.map(p => ({
      ...p,
      xp: p.phases?.some(ph => ph.tasks?.some(t => t.id === taskId))
        ? Math.max(0, p.xp + (done ? XP_PER_TASK : -XP_PER_TASK))
        : p.xp,
      phases: p.phases?.map(ph => ({
        ...ph,
        tasks: ph.tasks?.map(t => t.id === taskId ? { ...t, done } : t),
      })),
    }))
    setProjects(updated)

    try {
      await toggleTask(taskId, done)
      // Auto-complete phase when all tasks done
      if (done) {
        const phase = updated.flatMap(p => p.phases ?? []).find(ph => ph.id === phaseId)
        if (phase?.status === 'active') {
          const allDone = (phase.tasks ?? []).length > 0 && (phase.tasks ?? []).every(t => t.done)
          if (allDone) {
            await updatePhaseStatus(phaseId, 'done')
            setProjects(prev => prev.map(p => ({
              ...p,
              phases: p.phases?.map(ph => ph.id === phaseId ? { ...ph, status: 'done' as const } : ph),
            })))
            toast('⚔️ Phase complete!')
          }
        }
      }
    } catch {
      toast('Failed to update task', 'err')
      setProjects(projects)
    }
  }

  async function handleToggleSprint(taskId: string, inSprint: boolean) {
    setProjects(prev => prev.map(p => ({
      ...p,
      phases: p.phases?.map(ph => ({
        ...ph,
        tasks: ph.tasks?.map(t => t.id === taskId ? { ...t, in_sprint: inSprint } : t),
      })),
    })))
    try {
      await toggleSprint(taskId, inSprint)
    } catch {
      toast('Failed to update sprint', 'err')
      setProjects(prev => prev.map(p => ({
        ...p,
        phases: p.phases?.map(ph => ({
          ...ph,
          tasks: ph.tasks?.map(t => t.id === taskId ? { ...t, in_sprint: !inSprint } : t),
        })),
      })))
    }
  }

  async function handleClearDone() {
    const doneSprint = (activeProject?.phases ?? [])
      .flatMap(ph => ph.tasks ?? [])
      .filter(t => t.in_sprint && t.done)

    setProjects(prev => prev.map(p => ({
      ...p,
      phases: p.phases?.map(ph => ({
        ...ph,
        tasks: ph.tasks?.map(t => (t.in_sprint && t.done) ? { ...t, in_sprint: false } : t),
      })),
    })))
    try {
      await Promise.all(doneSprint.map(t => toggleSprint(t.id, false)))
      toast('Sprint cleared ✨')
    } catch {
      toast('Failed to clear sprint', 'err')
    }
  }

  async function handleToggleHabit(habitId: string, done: boolean) {
    setHabits(prev => prev.map(h => h.id === habitId ? { ...h, done_today: done } : h))
    try {
      await toggleHabit(habitId, done)
    } catch {
      toast('Failed to update habit', 'err')
      setHabits(prev => prev.map(h => h.id === habitId ? { ...h, done_today: !done } : h))
    }
  }

  async function handleCreateProject(name: string, icon: string, blueprint: string) {
    const bp = BLUEPRINTS.find(b => b.key === blueprint)
    try {
      await createProject({ name, icon, color: bp?.color ?? '#C4E8F4', blueprint })
      const projs = await getProjects()
      setProjects(projs)
      const newest = projs[projs.length - 1]
      if (newest) {
        setActiveProjectId(newest.id)
        const ids = new Set<string>()
        newest.phases?.forEach(ph => { if (ph.status === 'active') ids.add(ph.id) })
        setExpandedPhases(ids)
      }
      toast(`🎯 "${name}" created!`)
      setShowNewProject(false)
      setActiveTab('quest')
    } catch {
      toast('Failed to create project', 'err')
    }
  }

  // ── Derived ────────────────────────────
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'
  const displayName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'Dream'

  // ── Loading screen ─────────────────────
  if (loading) {
    return (
      <div
        style={{ background: '#F4FAFE', fontFamily: "'Outfit', sans-serif" }}
        className="min-h-dvh flex items-center justify-center"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-[3px] border-[#E8F7FC] border-t-[#7BC8DF] animate-spin" />
          <p style={{ color: '#A07850', fontSize: '13px', fontWeight: 500 }}>Loading Dream OS…</p>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{ background: '#F4FAFE', fontFamily: "'Outfit', sans-serif" }}
      className="min-h-dvh max-w-[42rem] mx-auto relative border-x border-[rgba(196,232,244,0.35)]"
    >
      {/* Toast stack */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 240 }}>
        {toasts.map(t => (
          <div
            key={t.id}
            className="px-4 py-2.5 rounded-2xl text-sm font-semibold shadow-xl"
            style={{
              background: t.type === 'ok' ? '#2E1A0E' : '#dc2626',
              color: t.type === 'ok' ? '#FDFACC' : '#fff',
              animation: 'slideIn 0.25s ease',
            }}
          >{t.msg}</div>
        ))}
      </div>

      {/* Header */}
      <header
        className="sticky top-0 z-30 px-5 py-3 flex items-center justify-between"
        style={{
          background: 'rgba(244,250,254,0.96)',
          backdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(196,232,244,0.45)',
          boxShadow: '0 1px 10px rgba(46,26,14,0.04)',
        }}
      >
        <div>
          <p style={{ color: '#A07850', fontSize: '11px', fontWeight: 500 }}>{greeting},</p>
          <h1 style={{ color: '#2E1A0E', fontSize: '18px', fontWeight: 700, lineHeight: 1.2 }}>{displayName}</h1>
        </div>

        <div className="flex items-center gap-2">
          {projects.length > 0 && (
            <div className="relative">
              <select
                value={activeProjectId ?? ''}
                onChange={e => {
                  setActiveProjectId(e.target.value)
                  const proj = projects.find(p => p.id === e.target.value)
                  const ids = new Set<string>()
                  proj?.phases?.forEach(ph => { if (ph.status === 'active') ids.add(ph.id) })
                  setExpandedPhases(ids)
                }}
                className="appearance-none pl-3 pr-7 py-2 rounded-xl text-sm font-semibold outline-none cursor-pointer"
                style={{
                  background: '#fff',
                  color: '#2E1A0E',
                  boxShadow: '0 1px 8px rgba(46,26,14,0.08)',
                  maxWidth: '156px',
                }}
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
                ))}
              </select>
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[10px]" style={{ color: '#A07850' }}>▾</span>
            </div>
          )}
          <button
            onClick={() => setShowNewProject(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg active:opacity-70 transition-opacity"
            style={{ background: '#2E1A0E', color: '#FDFACC', boxShadow: '0 2px 8px rgba(46,26,14,0.2)' }}
          >+</button>
        </div>
      </header>

      {/* Main content */}
      <main className="px-4 pt-4 pb-32">
        {activeTab === 'quest' && (
          <QuestView
            project={activeProject}
            expandedPhases={expandedPhases}
            setExpandedPhases={setExpandedPhases}
            onToggleTask={handleToggleTask}
            onToggleSprint={handleToggleSprint}
            toast={toast}
            setProjects={setProjects}
          />
        )}
        {activeTab === 'board' && (
          <BoardView
            project={activeProject}
            onToggleSprint={handleToggleSprint}
            onToggleTask={handleToggleTask}
            onClearDone={handleClearDone}
          />
        )}
        {activeTab === 'pomo' && (
          <PomoView
            pomoTime={pomoTime}
            pomoRunning={pomoRunning}
            pomoMode={pomoMode}
            stats={pomoStats}
            onToggle={() => setPomoRunning(r => !r)}
            onReset={pomoReset}
          />
        )}
        {activeTab === 'habits' && (
          <HabitsView
            habits={habits}
            setHabits={setHabits}
            onToggle={handleToggleHabit}
            toast={toast}
          />
        )}
      </main>

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[42rem] flex justify-around items-center px-3 pt-2 pb-8"
        style={{
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(196,232,244,0.4)',
          boxShadow: '0 -4px 20px rgba(46,26,14,0.06)',
        }}
      >
        {([
          { id: 'quest',  icon: '⚔️', label: 'Quest'  },
          { id: 'board',  icon: '📋', label: 'Board'  },
          { id: 'pomo',   icon: '🍅', label: 'Pomo'   },
          { id: 'habits', icon: '🌿', label: 'Habits' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl transition-all active:scale-95"
            style={{
              background: activeTab === tab.id ? '#2E1A0E' : 'transparent',
              color: activeTab === tab.id ? '#FDFACC' : '#A07850',
              transform: activeTab === tab.id ? 'translateY(-1px)' : 'none',
            }}
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.03em' }}>{tab.label}</span>
          </button>
        ))}
      </nav>

      {showNewProject && (
        <NewProjectModal
          onClose={() => setShowNewProject(false)}
          onCreate={handleCreateProject}
        />
      )}

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}

// ─────────────────────────────────────────
// QUEST VIEW
// ─────────────────────────────────────────
function QuestView({
  project, expandedPhases, setExpandedPhases,
  onToggleTask, onToggleSprint, toast, setProjects,
}: {
  project: Project | null
  expandedPhases: Set<string>
  setExpandedPhases: React.Dispatch<React.SetStateAction<Set<string>>>
  onToggleTask: (id: string, phaseId: string, done: boolean) => void
  onToggleSprint: (id: string, inSprint: boolean) => void
  toast: (msg: string, type?: 'ok' | 'err') => void
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>
}) {
  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <span className="text-6xl">⚔️</span>
        <p style={{ color: '#A07850', fontWeight: 600 }}>No projects yet.</p>
        <p style={{ color: '#A07850', fontSize: '13px', opacity: 0.7 }}>Tap + to create your first quest.</p>
      </div>
    )
  }

  const stats    = getProjectStats(project)
  const lvl      = getLevelInfo(project.xp)
  const phases   = [...(project.phases ?? [])].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="flex flex-col gap-4">

      {/* ── Hero card ── */}
      <div
        className="rounded-[1.375rem] p-5 relative overflow-hidden"
        style={{ background: '#2E1A0E', boxShadow: '0 6px 28px rgba(46,26,14,0.22)' }}
      >
        {/* Ambient glow */}
        <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full pointer-events-none"
          style={{ background: '#C4E8F4', opacity: 0.08, filter: 'blur(36px)' }} />

        <div className="flex justify-between items-start mb-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{project.icon}</span>
              <h2 style={{ color: '#FDFACC', fontSize: '18px', fontWeight: 700 }}>{project.name}</h2>
            </div>
            <p style={{ color: '#A07850', fontSize: '12px', fontWeight: 500 }}>
              {lvl.name} · Level {lvl.level + 1}
            </p>
          </div>
          <div className="text-right">
            <p style={{ color: '#C4E8F4', fontSize: '13px', fontWeight: 700 }}>{project.xp} XP</p>
            <p style={{ color: '#5C3D26', fontSize: '10px' }}>→ {lvl.nextXp}</p>
          </div>
        </div>

        {/* XP bar */}
        <div className="h-2 rounded-full mb-4 relative z-10" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${lvl.progress}%`, background: 'linear-gradient(90deg, #7BC8DF, #C4E8F4)' }}
          />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2 relative z-10">
          {[
            { label: 'Phases', value: `${stats.donePhases}/${stats.totalPhases}` },
            { label: 'Tasks',  value: `${stats.doneTasks}/${stats.totalTasks}`   },
            { label: 'Sprint', value: stats.inSprint                             },
            { label: 'Done',   value: `${stats.pct}%`                            },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <p style={{ color: '#C4E8F4', fontSize: '14px', fontWeight: 700 }}>{s.value}</p>
              <p style={{ color: '#5C3D26', fontSize: '9px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quest chain ── */}
      <div className="flex flex-col gap-3">
        {phases.map(phase => (
          <PhaseCard
            key={phase.id}
            phase={phase}
            isExpanded={expandedPhases.has(phase.id)}
            onToggle={() => setExpandedPhases(prev => {
              const next = new Set(prev)
              if (next.has(phase.id)) next.delete(phase.id); else next.add(phase.id)
              return next
            })}
            onToggleTask={onToggleTask}
            onToggleSprint={onToggleSprint}
            toast={toast}
            project={project}
            setProjects={setProjects}
          />
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// PHASE CARD
// ─────────────────────────────────────────
function PhaseCard({
  phase, isExpanded, onToggle,
  onToggleTask, onToggleSprint, toast, project, setProjects,
}: {
  phase: Phase
  isExpanded: boolean
  onToggle: () => void
  onToggleTask: (id: string, phaseId: string, done: boolean) => void
  onToggleSprint: (id: string, inSprint: boolean) => void
  toast: (msg: string, type?: 'ok' | 'err') => void
  project: Project
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>
}) {
  const [newTitle, setNewTitle] = useState('')
  const [addingTask, setAddingTask] = useState(false)

  const tasks    = [...(phase.tasks ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const doneCnt  = tasks.filter(t => t.done).length
  const isLocked = phase.status === 'locked'

  const S = {
    done:   { bg: '#E8F7FC', border: '#7BC8DF',                   badge: '#7BC8DF', badgeTxt: '#fff',     label: '✓ Done'   },
    active: { bg: '#FDFACC', border: '#F5EF8A',                   badge: '#2E1A0E', badgeTxt: '#FDFACC',  label: '⚡ Active' },
    next:   { bg: '#fff',    border: 'rgba(196,232,244,0.5)',      badge: '#C4E8F4', badgeTxt: '#2E1A0E',  label: '→ Next'   },
    locked: { bg: 'rgba(244,250,254,0.6)', border: 'rgba(196,232,244,0.2)', badge: '#e5e7eb', badgeTxt: '#9ca3af', label: '🔒 Locked' },
  }[phase.status]

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    try {
      const task = await addTask({
        phase_id: phase.id,
        project_id: project.id,
        title: newTitle.trim(),
        sort_order: tasks.length,
      })
      setProjects(prev => prev.map(p => p.id !== project.id ? p : {
        ...p,
        phases: p.phases?.map(ph => ph.id !== phase.id ? ph : {
          ...ph, tasks: [...(ph.tasks ?? []), task],
        }),
      }))
      setNewTitle('')
      setAddingTask(false)
      toast('Task added')
    } catch {
      toast('Failed to add task', 'err')
    }
  }

  return (
    <div
      className="rounded-[1.375rem] border overflow-hidden transition-all duration-200"
      style={{
        background: S.bg,
        borderColor: S.border,
        opacity: isLocked ? 0.42 : 1,
        boxShadow: phase.status === 'active'
          ? '0 4px 18px rgba(245,239,138,0.4)'
          : '0 2px 8px rgba(46,26,14,0.04)',
      }}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        disabled={isLocked}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <div className="flex items-center gap-3">
          <span
            className="text-[10px] font-bold px-2 py-1 rounded-lg flex-shrink-0"
            style={{ background: S.badge, color: S.badgeTxt }}
          >{S.label}</span>
          <div>
            <p style={{ color: '#2E1A0E', fontSize: '14px', fontWeight: 700 }}>{phase.name}</p>
            {phase.description && (
              <p style={{ color: '#A07850', fontSize: '11px', marginTop: '1px' }}>{phase.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {tasks.length > 0 && (
            <span style={{ color: '#A07850', fontSize: '11px', fontWeight: 500 }}>{doneCnt}/{tasks.length}</span>
          )}
          {!isLocked && (
            <span style={{ color: '#A07850', fontSize: '11px' }}>{isExpanded ? '▲' : '▼'}</span>
          )}
        </div>
      </button>

      {/* Mini progress bar */}
      {tasks.length > 0 && !isLocked && (
        <div className="mx-4 mb-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(46,26,14,0.08)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(doneCnt / tasks.length) * 100}%`,
              background: phase.status === 'done' ? '#7BC8DF' : '#2E1A0E',
            }}
          />
        </div>
      )}

      {/* Tasks */}
      {isExpanded && !isLocked && (
        <div className="px-3 pb-4 flex flex-col gap-2">
          {tasks.length === 0 && !addingTask && (
            <p className="text-center py-3 text-xs border-2 border-dashed rounded-xl"
              style={{ color: '#A07850', borderColor: 'rgba(196,232,244,0.4)' }}>
              No tasks yet
            </p>
          )}
          {tasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              phaseId={phase.id}
              projectId={project.id}
              onToggleTask={onToggleTask}
              onToggleSprint={onToggleSprint}
              toast={toast}
              setProjects={setProjects}
            />
          ))}

          {addingTask ? (
            <form onSubmit={handleAddTask} className="flex gap-2 mt-1">
              <input
                autoFocus
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Escape' && setAddingTask(false)}
                placeholder="Task name…"
                className="flex-1 px-3 py-2 rounded-xl text-sm outline-none border"
                style={{ background: '#fff', borderColor: 'rgba(196,232,244,0.7)', color: '#2E1A0E' }}
              />
              <button type="submit" className="px-3 py-2 rounded-xl text-sm font-bold"
                style={{ background: '#2E1A0E', color: '#FDFACC' }}>Add</button>
              <button type="button" onClick={() => setAddingTask(false)} className="px-3 py-2 rounded-xl text-sm"
                style={{ background: 'rgba(46,26,14,0.07)', color: '#A07850' }}>✕</button>
            </form>
          ) : (
            <button
              onClick={() => setAddingTask(true)}
              className="w-full py-2.5 rounded-xl text-xs font-semibold border-2 border-dashed active:opacity-60"
              style={{ borderColor: 'rgba(196,232,244,0.5)', color: '#A07850' }}
            >+ Add task</button>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────
// TASK ROW
// ─────────────────────────────────────────
function TaskRow({
  task, phaseId, projectId,
  onToggleTask, onToggleSprint, toast, setProjects,
}: {
  task: Task
  phaseId: string
  projectId: string
  onToggleTask: (id: string, phaseId: string, done: boolean) => void
  onToggleSprint: (id: string, inSprint: boolean) => void
  toast: (msg: string, type?: 'ok' | 'err') => void
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>
}) {
  const [editing, setEditing]     = useState(false)
  const [editVal, setEditVal]     = useState(task.title)

  async function saveEdit() {
    const val = editVal.trim()
    setEditing(false)
    if (!val || val === task.title) { setEditVal(task.title); return }
    setProjects(prev => prev.map(p => ({
      ...p,
      phases: p.phases?.map(ph => ({
        ...ph,
        tasks: ph.tasks?.map(t => t.id === task.id ? { ...t, title: val } : t),
      })),
    })))
    try { await updateTaskTitle(task.id, val) }
    catch { toast('Failed to rename task', 'err') }
  }

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
      style={{
        background: task.done ? 'rgba(46,26,14,0.03)' : '#fff',
        opacity: task.done ? 0.55 : 1,
        boxShadow: task.done ? 'none' : '0 1px 6px rgba(46,26,14,0.06)',
      }}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggleTask(task.id, phaseId, !task.done)}
        className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
        style={{
          borderColor: task.done ? '#7BC8DF' : 'rgba(196,232,244,0.9)',
          background: task.done ? '#7BC8DF' : 'transparent',
        }}
      >
        {task.done && <span style={{ color: '#fff', fontSize: '9px', fontWeight: 700 }}>✓</span>}
      </button>

      {/* Title — double-click to edit */}
      {editing ? (
        <input
          autoFocus
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={e => {
            if (e.key === 'Enter') saveEdit()
            if (e.key === 'Escape') { setEditing(false); setEditVal(task.title) }
          }}
          className="flex-1 px-2 py-0.5 rounded-lg text-sm outline-none border"
          style={{ borderColor: '#C4E8F4', color: '#2E1A0E', background: '#F4FAFE' }}
        />
      ) : (
        <span
          onDoubleClick={() => { if (!task.done) setEditing(true) }}
          className="flex-1 text-sm font-medium leading-snug select-none cursor-default"
          style={{ color: '#2E1A0E', textDecoration: task.done ? 'line-through' : 'none' }}
        >{task.title}</span>
      )}

      {/* High priority badge */}
      {task.priority === 'high' && !task.done && (
        <span style={{ fontSize: '10px', background: '#fef2f2', color: '#dc2626', padding: '2px 6px', borderRadius: '6px', fontWeight: 700, flexShrink: 0 }}>!</span>
      )}

      {/* Sprint toggle */}
      <button
        onClick={() => onToggleSprint(task.id, !task.in_sprint)}
        title={task.in_sprint ? 'Remove from sprint' : 'Add to sprint'}
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
        style={{
          background: task.in_sprint ? '#2E1A0E' : 'rgba(196,232,244,0.35)',
          color: task.in_sprint ? '#FDFACC' : '#A07850',
          fontSize: '11px',
          fontWeight: 700,
        }}
      >S</button>
    </div>
  )
}

// ─────────────────────────────────────────
// BOARD VIEW
// ─────────────────────────────────────────
function BoardView({
  project, onToggleSprint, onToggleTask, onClearDone,
}: {
  project: Project | null
  onToggleSprint: (id: string, inSprint: boolean) => void
  onToggleTask: (id: string, phaseId: string, done: boolean) => void
  onClearDone: () => void
}) {
  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <span className="text-6xl">📋</span>
        <p style={{ color: '#A07850', fontWeight: 500 }}>Select a project to see the board.</p>
      </div>
    )
  }

  const phases = [...(project.phases ?? [])].sort((a, b) => a.sort_order - b.sort_order)

  type SprintTask = Task & { phaseName: string; phaseId: string }
  const sprintTasks: SprintTask[] = phases.flatMap(ph =>
    (ph.tasks ?? []).filter(t => t.in_sprint).map(t => ({ ...t, phaseName: ph.name, phaseId: ph.id }))
  )
  const doneSprint = sprintTasks.filter(t => t.done)

  return (
    <div className="flex flex-col gap-4">

      {/* Current Sprint */}
      <div className="rounded-[1.375rem] p-5" style={{ background: '#fff', boxShadow: '0 2px 12px rgba(46,26,14,0.06)' }}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold flex items-center gap-2" style={{ color: '#2E1A0E', fontSize: '15px' }}>
            🔥 Current Sprint
            {sprintTasks.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: '#E8F7FC', color: '#5C3D26' }}>
                {doneSprint.length}/{sprintTasks.length}
              </span>
            )}
          </h2>
          {doneSprint.length > 0 && (
            <button
              onClick={onClearDone}
              className="text-xs font-semibold px-3 py-1.5 rounded-full active:opacity-60"
              style={{ background: '#f3f4f6', color: '#6b7280' }}
            >Clear Done</button>
          )}
        </div>

        {sprintTasks.length === 0 ? (
          <p className="text-center py-8 text-sm border-2 border-dashed rounded-2xl"
            style={{ color: '#A07850', borderColor: 'rgba(196,232,244,0.45)' }}>
            No tasks in sprint.<br />
            <span style={{ fontSize: '12px', opacity: 0.7 }}>Tap [S] on Quest tasks to pull them in.</span>
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {sprintTasks.map(task => (
              <div
                key={task.id}
                className="flex items-center gap-3 px-3 py-3 rounded-xl"
                style={{
                  background: task.done ? 'rgba(46,26,14,0.03)' : '#F4FAFE',
                  opacity: task.done ? 0.55 : 1,
                }}
              >
                <button
                  onClick={() => onToggleTask(task.id, task.phaseId, !task.done)}
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                  style={{
                    borderColor: task.done ? '#7BC8DF' : 'rgba(196,232,244,0.9)',
                    background: task.done ? '#7BC8DF' : 'transparent',
                  }}
                >
                  {task.done && <span style={{ color: '#fff', fontSize: '9px', fontWeight: 700 }}>✓</span>}
                </button>
                <span
                  className="flex-1 text-sm font-medium"
                  style={{ color: '#2E1A0E', textDecoration: task.done ? 'line-through' : 'none' }}
                >{task.title}</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: '#E8F7FC', color: '#5C3D26', fontSize: '10px' }}
                >{task.phaseName}</span>
                <button
                  onClick={() => onToggleSprint(task.id, false)}
                  className="text-xs px-2 py-1 rounded-lg flex-shrink-0 active:opacity-60"
                  style={{ background: 'rgba(46,26,14,0.06)', color: '#A07850' }}
                  title="Remove from sprint"
                >↑</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Roadmap */}
      <div className="rounded-[1.375rem] p-5" style={{ background: '#fff', boxShadow: '0 2px 12px rgba(46,26,14,0.06)' }}>
        <h2 className="font-bold mb-4" style={{ color: '#2E1A0E', fontSize: '15px' }}>🗺 Roadmap</h2>
        <div className="flex flex-col gap-4">
          {phases.map(phase => {
            const tasks = phase.tasks ?? []
            const done  = tasks.filter(t => t.done).length
            const pct   = tasks.length ? (done / tasks.length) * 100 : 0
            const color = { done: '#7BC8DF', active: '#2E1A0E', next: '#A07850', locked: '#d1d5db' }[phase.status]
            const icon  = { done: '✓', active: '⚡', next: '→', locked: '🔒' }[phase.status]
            return (
              <div key={phase.id} style={{ opacity: phase.status === 'locked' ? 0.45 : 1 }}>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: color + '25', color, letterSpacing: '0.05em', textTransform: 'uppercase' }}
                    >{icon}</span>
                    <span className="text-sm font-semibold" style={{ color: '#2E1A0E' }}>{phase.name}</span>
                  </div>
                  <span style={{ color: '#A07850', fontSize: '11px' }}>{done}/{tasks.length}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(196,232,244,0.3)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// POMO VIEW
// ─────────────────────────────────────────
function PomoView({
  pomoTime, pomoRunning, pomoMode, stats, onToggle, onReset,
}: {
  pomoTime: number
  pomoRunning: boolean
  pomoMode: 'focus' | 'break'
  stats: { today: number; week: number; total: number }
  onToggle: () => void
  onReset: () => void
}) {
  const total    = pomoMode === 'focus' ? POMO_FOCUS : POMO_BREAK
  const progress = ((total - pomoTime) / total) * 100
  const mm = String(Math.floor(pomoTime / 60)).padStart(2, '0')
  const ss = String(pomoTime % 60).padStart(2, '0')

  const r    = 90
  const circ = 2 * Math.PI * r
  const dash = circ - (progress / 100) * circ

  const trackColor = pomoMode === 'focus' ? 'rgba(46,26,14,0.1)' : 'rgba(196,232,244,0.25)'
  const fillColor  = pomoMode === 'focus' ? '#2E1A0E' : '#7BC8DF'

  return (
    <div className="flex flex-col items-center gap-6 pt-2">

      <p
        className="font-bold tracking-widest uppercase"
        style={{ color: pomoMode === 'focus' ? '#2E1A0E' : '#7BC8DF', fontSize: '11px', letterSpacing: '0.18em' }}
      >
        {pomoMode === 'focus' ? '⚔️ Focus Session' : '☕ Break Time'}
      </p>

      {/* SVG ring timer */}
      <div className="relative" style={{ width: 228, height: 228 }}>
        <svg viewBox="0 0 228 228" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
          <circle cx="114" cy="114" r={r} fill="none" strokeWidth="10" stroke={trackColor} />
          <circle
            cx="114" cy="114" r={r} fill="none" strokeWidth="10"
            stroke={fillColor}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={dash}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.4s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            style={{ color: '#2E1A0E', fontSize: '44px', fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}
          >{mm}:{ss}</span>
          <span style={{ color: '#A07850', fontSize: '11px', fontWeight: 500, marginTop: '4px' }}>
            {pomoRunning ? 'Running…' : 'Paused'}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-5">
        <button
          onClick={onReset}
          className="w-12 h-12 rounded-full flex items-center justify-center text-xl active:opacity-60"
          style={{ background: 'rgba(46,26,14,0.07)', color: '#5C3D26' }}
          title="Reset"
        >↺</button>
        <button
          onClick={onToggle}
          className="flex items-center justify-center rounded-full active:scale-95 transition-transform"
          style={{
            width: 68, height: 68,
            background: '#2E1A0E',
            color: '#FDFACC',
            fontSize: '26px',
            boxShadow: '0 6px 24px rgba(46,26,14,0.28)',
          }}
        >{pomoRunning ? '⏸' : '▶'}</button>
        <div style={{ width: 48, height: 48 }} />
      </div>

      {/* Mode pills */}
      <div className="flex gap-3 w-full">
        {(['focus', 'break'] as const).map(m => (
          <div
            key={m}
            className="flex-1 rounded-2xl py-3 text-center text-sm font-semibold"
            style={{
              background: pomoMode === m ? (m === 'focus' ? '#2E1A0E' : '#E8F7FC') : 'rgba(46,26,14,0.04)',
              color: pomoMode === m ? (m === 'focus' ? '#FDFACC' : '#2E1A0E') : '#A07850',
              transition: 'all 0.35s ease',
            }}
          >
            {m === 'focus' ? '⚔️ 25 min Focus' : '☕ 5 min Break'}
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="w-full rounded-[1.375rem] p-5" style={{ background: '#fff', boxShadow: '0 2px 12px rgba(46,26,14,0.06)' }}>
        <p style={{ color: '#A07850', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '16px' }}>
          Sessions Completed 🍅
        </p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Today',     value: stats.today },
            { label: 'This Week', value: stats.week  },
            { label: 'All Time',  value: stats.total },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center gap-1">
              <span style={{ color: '#2E1A0E', fontSize: '28px', fontWeight: 700, lineHeight: 1 }}>{s.value}</span>
              <span style={{ color: '#A07850', fontSize: '10px', fontWeight: 500, textAlign: 'center' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// HABITS VIEW
// ─────────────────────────────────────────
function HabitsView({
  habits, setHabits, onToggle, toast,
}: {
  habits: Habit[]
  setHabits: React.Dispatch<React.SetStateAction<Habit[]>>
  onToggle: (id: string, done: boolean) => void
  toast: (msg: string, type?: 'ok' | 'err') => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('✨')

  const doneCount = habits.filter(h => h.done_today).length
  const pct = habits.length ? Math.round((doneCount / habits.length) * 100) : 0

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      const h = await addHabit(newName.trim(), newIcon || '✨')
      if (h) setHabits(prev => [...prev, { ...h, done_today: false }])
      setNewName('')
      setNewIcon('✨')
      setShowAdd(false)
      toast('Habit added 🌿')
    } catch {
      toast('Failed to add habit', 'err')
    }
  }

  async function handleDelete(id: string) {
    setHabits(prev => prev.filter(h => h.id !== id))
    try { await deleteHabit(id) }
    catch { toast('Failed to delete habit', 'err') }
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div
        className="rounded-[1.375rem] p-5 relative overflow-hidden"
        style={{ background: '#2E1A0E', boxShadow: '0 4px 20px rgba(46,26,14,0.18)' }}
      >
        <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full pointer-events-none"
          style={{ background: '#C4E8F4', opacity: 0.1, filter: 'blur(24px)' }} />
        <div className="flex justify-between items-start mb-3 relative z-10">
          <div>
            <h2 style={{ color: '#FDFACC', fontSize: '17px', fontWeight: 700 }}>Daily Routine 🌿</h2>
            <p style={{ color: '#5C3D26', fontSize: '11px', marginTop: '2px' }}>Auto-resets every midnight</p>
          </div>
          <span style={{ color: '#C4E8F4', fontSize: '28px', fontWeight: 700, lineHeight: 1 }}>{pct}%</span>
        </div>
        <div className="h-2 rounded-full relative z-10" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #7BC8DF, #C4E8F4)' }}
          />
        </div>
        <p style={{ color: '#A07850', fontSize: '11px', marginTop: '8px', position: 'relative', zIndex: 10 }}>
          {doneCount}/{habits.length} habits done today
        </p>
      </div>

      {/* List */}
      <div className="flex flex-col gap-2.5">
        {habits.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed rounded-2xl"
            style={{ borderColor: 'rgba(196,232,244,0.4)', color: '#A07850' }}>
            <p className="text-3xl mb-2">🌿</p>
            <p className="text-sm font-medium">No habits yet.</p>
            <p className="text-xs mt-1 opacity-70">Build your daily routines below.</p>
          </div>
        )}
        {habits.map(habit => (
          <div
            key={habit.id}
            className="flex items-center gap-3 p-4 rounded-[1.375rem] border transition-all"
            style={{
              background: habit.done_today ? '#E8F7FC' : '#fff',
              borderColor: habit.done_today ? '#7BC8DF' : 'rgba(196,232,244,0.4)',
              boxShadow: habit.done_today ? 'none' : '0 2px 8px rgba(46,26,14,0.05)',
              opacity: habit.done_today ? 0.78 : 1,
            }}
          >
            <button
              onClick={() => onToggle(habit.id, !habit.done_today)}
              className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
              style={{
                borderColor: habit.done_today ? '#7BC8DF' : 'rgba(196,232,244,0.9)',
                background: habit.done_today ? '#7BC8DF' : 'transparent',
              }}
            >
              {habit.done_today && <span style={{ color: '#fff', fontSize: '10px', fontWeight: 700 }}>✓</span>}
            </button>
            <span className="text-2xl leading-none">{habit.icon}</span>
            <span
              className="flex-1 font-semibold"
              style={{ color: '#2E1A0E', fontSize: '14px', textDecoration: habit.done_today ? 'line-through' : 'none' }}
            >{habit.name}</span>
            <button
              onClick={() => handleDelete(habit.id)}
              className="opacity-25 hover:opacity-60 transition-opacity p-1"
              style={{ color: '#A07850', fontSize: '14px' }}
              title="Delete habit"
            >✕</button>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showAdd ? (
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-3 p-4 rounded-[1.375rem] border"
          style={{ background: '#fff', borderColor: 'rgba(196,232,244,0.5)', boxShadow: '0 2px 12px rgba(46,26,14,0.06)' }}
        >
          <div className="flex gap-2">
            <input
              value={newIcon}
              onChange={e => setNewIcon(e.target.value)}
              className="text-center text-xl py-2 outline-none border rounded-xl"
              style={{ width: '56px', borderColor: 'rgba(196,232,244,0.6)', flexShrink: 0 }}
              maxLength={2}
            />
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Habit name…"
              className="flex-1 px-3 py-2 rounded-xl text-sm outline-none border"
              style={{ borderColor: 'rgba(196,232,244,0.6)', color: '#2E1A0E' }}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!newName.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-opacity disabled:opacity-40"
              style={{ background: '#2E1A0E', color: '#FDFACC' }}
            >Add Habit</button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-4 py-2.5 rounded-xl text-sm"
              style={{ background: 'rgba(46,26,14,0.06)', color: '#A07850' }}
            >Cancel</button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-3.5 rounded-[1.375rem] text-sm font-semibold border-2 border-dashed active:opacity-60"
          style={{ borderColor: 'rgba(196,232,244,0.45)', color: '#A07850' }}
        >+ Add Habit</button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────
// NEW PROJECT MODAL
// ─────────────────────────────────────────
function NewProjectModal({
  onClose, onCreate,
}: {
  onClose: () => void
  onCreate: (name: string, icon: string, blueprint: string) => void
}) {
  const [step, setStep]         = useState<'blueprint' | 'name'>('blueprint')
  const [selectedBp, setSelectedBp] = useState('')
  const [name, setName]         = useState('')
  const [icon, setIcon]         = useState('🎯')

  function selectBp(key: string) {
    const bp = BLUEPRINTS.find(b => b.key === key)
    setSelectedBp(key)
    setIcon(bp?.icon ?? '🎯')
    setName('')
    setStep('name')
  }

  const chosenBp = BLUEPRINTS.find(b => b.key === selectedBp)

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-[42rem] rounded-t-[1.75rem] sm:rounded-[1.75rem] p-6 pb-12 sm:pb-6"
        style={{ background: '#fff', boxShadow: '0 -12px 48px rgba(46,26,14,0.18)' }}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 style={{ color: '#2E1A0E', fontSize: '20px', fontWeight: 700 }}>
              {step === 'blueprint' ? '📋 Choose Blueprint' : '✏️ Name Your Project'}
            </h2>
            {step === 'blueprint' && (
              <p style={{ color: '#A07850', fontSize: '12px', marginTop: '2px' }}>
                Research-backed roadmaps to jump-start your project
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
            style={{ background: 'rgba(46,26,14,0.06)', color: '#A07850' }}
          >✕</button>
        </div>

        {step === 'blueprint' ? (
          /* Blueprint grid */
          <div className="flex flex-col gap-2.5 overflow-y-auto" style={{ maxHeight: '62vh' }}>
            {BLUEPRINTS.map(bp => (
              <button
                key={bp.key}
                onClick={() => selectBp(bp.key)}
                className="flex items-center gap-4 p-4 rounded-2xl border text-left active:scale-[0.99] transition-transform"
                style={{ borderColor: bp.color, background: `${bp.color}30` }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: bp.color }}
                >{bp.icon}</div>
                <div>
                  <p style={{ color: '#2E1A0E', fontSize: '14px', fontWeight: 700 }}>{bp.name}</p>
                  <p style={{ color: '#A07850', fontSize: '11px', marginTop: '2px' }}>
                    {bp.phases.length} phases · {bp.phases.reduce((a, p) => a + p.tasks.length, 0)} tasks ready
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* Name form */
          <form
            onSubmit={e => { e.preventDefault(); if (name.trim() && selectedBp) onCreate(name.trim(), icon, selectedBp) }}
            className="flex flex-col gap-4"
          >
            {chosenBp && (
              <div
                className="flex items-center gap-3 p-3 rounded-2xl"
                style={{ background: `${chosenBp.color}30`, border: `1px solid ${chosenBp.color}` }}
              >
                <span className="text-xl">{chosenBp.icon}</span>
                <div>
                  <p style={{ color: '#2E1A0E', fontSize: '13px', fontWeight: 600 }}>{chosenBp.name}</p>
                  <p style={{ color: '#A07850', fontSize: '11px' }}>
                    {chosenBp.phases.length} phases · {chosenBp.phases.reduce((a, p) => a + p.tasks.length, 0)} tasks
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <input
                value={icon}
                onChange={e => setIcon(e.target.value)}
                className="text-center text-2xl py-3 outline-none border rounded-xl"
                style={{ width: '64px', borderColor: 'rgba(196,232,244,0.6)', flexShrink: 0 }}
                maxLength={2}
              />
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Project name…"
                className="flex-1 px-4 py-3 rounded-xl outline-none border"
                style={{ borderColor: 'rgba(196,232,244,0.6)', color: '#2E1A0E', fontSize: '15px' }}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('blueprint')}
                className="px-4 py-3 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(46,26,14,0.06)', color: '#A07850' }}
              >← Back</button>
              <button
                type="submit"
                disabled={!name.trim()}
                className="flex-1 py-3 rounded-xl text-sm font-bold transition-opacity disabled:opacity-40"
                style={{ background: '#2E1A0E', color: '#FDFACC' }}
              >Create Project 🚀</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
