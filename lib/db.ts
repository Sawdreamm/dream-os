// lib/db.ts — Dream OS data layer
// ทุก query อยู่ที่นี่ vibe code ง่ายๆ

import { createClient } from '@/lib/supabase/client'
import type { Project, Phase, Task, Habit, Blueprint } from '@/types'
import { BLUEPRINTS } from '@/types'

const sb = () => createClient()

// ══════════ PROJECTS ══════════

export async function getProjects(): Promise<Project[]> {
  const { data } = await sb()
    .from('projects')
    .select('*, phases(*, tasks(*))')
    .eq('archived', false)
    .order('sort_order')
  return data || []
}

export async function createProject(payload: {
  name: string; icon: string; color: string; blueprint?: string
}): Promise<Project> {
  const supabase = sb()
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data, error } = await supabase
    .from('projects')
    .insert({ ...payload, user_id: user!.id })
    .select().single()
  if (error) throw error

  // ถ้ามี blueprint — สร้าง phases + tasks ให้อัตโนมัติ
  if (payload.blueprint && payload.blueprint !== 'blank') {
    const bp = BLUEPRINTS.find(b => b.key === payload.blueprint)
    if (bp) {
      for (let i = 0; i < bp.phases.length; i++) {
        const ph = bp.phases[i]
        const { data: phase } = await supabase.from('phases').insert({
          project_id: data.id,
          user_id: user!.id,
          name: ph.name,
          description: ph.description,
          status: i === 0 ? 'active' : 'locked',
          sort_order: i,
        }).select().single()

        if (phase) {
          for (let j = 0; j < ph.tasks.length; j++) {
            await supabase.from('tasks').insert({
              phase_id: phase.id,
              project_id: data.id,
              user_id: user!.id,
              title: ph.tasks[j],
              sort_order: j,
            })
          }
        }
      }
    }
  }
  return data
}

export async function archiveProject(id: string) {
  await sb().from('projects').update({ archived: true }).eq('id', id)
}

// ══════════ PHASES ══════════

export async function addPhase(projectId: string, name: string, sortOrder: number) {
  const supabase = sb()
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase.from('phases')
    .insert({ project_id: projectId, user_id: user!.id, name, sort_order: sortOrder, status: 'locked' })
    .select().single()
  if (error) throw error
  return data
}

export async function updatePhaseStatus(id: string, status: Phase['status']) {
  await sb().from('phases').update({ status }).eq('id', id)
}

// ══════════ TASKS ══════════

export async function addTask(payload: {
  phase_id: string; project_id: string; title: string
  priority?: Task['priority']; due_date?: string; category?: Task['category']
  sort_order?: number
}) {
  const supabase = sb()
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase.from('tasks')
    .insert({ ...payload, user_id: user!.id })
    .select().single()
  if (error) throw error
  return data as Task
}

export async function toggleTask(id: string, done: boolean) {
  const supabase = sb()
  await supabase.from('tasks').update({ done }).eq('id', id)
  // XP: เพิ่ม/ลด ที่ project level
  const { data: task } = await supabase.from('tasks').select('project_id').eq('id', id).single()
  if (task) {
    const { data: proj } = await supabase.from('projects').select('xp').eq('id', task.project_id).single()
    if (proj) {
      await supabase.from('projects').update({ xp: proj.xp + (done ? 30 : -30) }).eq('id', task.project_id)
    }
  }
}

export async function toggleSprint(id: string, inSprint: boolean) {
  await sb().from('tasks').update({ in_sprint: inSprint }).eq('id', id)
}

export async function deleteTask(id: string) {
  await sb().from('tasks').delete().eq('id', id)
}

export async function updateTaskTitle(id: string, title: string) {
  await sb().from('tasks').update({ title }).eq('id', id)
}

export async function getSprintTasks(): Promise<Task[]> {
  const { data } = await sb()
    .from('tasks')
    .select('*')
    .eq('in_sprint', true)
    .eq('done', false)
    .order('created_at')
  return data || []
}

// ══════════ HABITS ══════════

export async function getHabitsToday(): Promise<Habit[]> {
  const supabase = sb()
  const today = new Date().toISOString().split('T')[0]
  const { data: habits } = await supabase
    .from('habits')
    .select('*, habit_logs(done, date)')
    .order('sort_order')

  return (habits || []).map(h => ({
    ...h,
    done_today: h.habit_logs?.some((l: any) => l.date === today && l.done) || false,
    habit_logs: undefined,
  }))
}

export async function addHabit(name: string, icon: string) {
  const supabase = sb()
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase.from('habits')
    .insert({ user_id: user!.id, name, icon })
    .select().single()
  return data
}

export async function toggleHabit(habitId: string, done: boolean) {
  const supabase = sb()
  const { data: { user } } = await supabase.auth.getUser()
  const today = new Date().toISOString().split('T')[0]
  await supabase.from('habit_logs').upsert({
    habit_id: habitId,
    user_id: user!.id,
    date: today,
    done,
  }, { onConflict: 'habit_id,date' })
}

export async function deleteHabit(id: string) {
  await sb().from('habits').delete().eq('id', id)
}

// ══════════ POMO ══════════

export async function logPomoSession(payload: {
  project_id?: string; task_title?: string
  duration: number; completed: boolean; ended_at: string
}) {
  const supabase = sb()
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('pomo_sessions').insert({ ...payload, user_id: user!.id })
}

export async function getPomoStats(): Promise<{ today: number; week: number; total: number }> {
  const supabase = sb()
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString()

  const { data } = await supabase
    .from('pomo_sessions')
    .select('started_at, completed')
    .eq('completed', true)

  if (!data) return { today: 0, week: 0, total: 0 }
  return {
    today: data.filter(s => s.started_at.startsWith(today)).length,
    week: data.filter(s => s.started_at > weekAgo).length,
    total: data.length,
  }
}
