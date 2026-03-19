// types/index.ts — Dream OS

export interface Project {
  id: string
  user_id: string
  name: string
  icon: string
  color: string
  blueprint?: string
  xp: number
  archived: boolean
  sort_order: number
  created_at: string
  updated_at: string
  // joined
  phases?: Phase[]
}

export interface Phase {
  id: string
  project_id: string
  user_id: string
  name: string
  description?: string
  status: 'done' | 'active' | 'next' | 'locked'
  sort_order: number
  created_at: string
  // joined
  tasks?: Task[]
}

export interface Task {
  id: string
  phase_id: string
  project_id: string
  user_id: string
  title: string
  done: boolean
  in_sprint: boolean
  priority: 'normal' | 'high'
  due_date?: string
  category: 'task' | 'marketing' | 'finance' | 'ops'
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Habit {
  id: string
  user_id: string
  name: string
  icon: string
  sort_order: number
  created_at: string
  // joined from habit_logs
  done_today?: boolean
}

export interface HabitLog {
  id: string
  habit_id: string
  user_id: string
  date: string
  done: boolean
}

export interface PomoSession {
  id: string
  user_id: string
  project_id?: string
  task_title?: string
  duration: number
  completed: boolean
  started_at: string
  ended_at?: string
}

// ── Blueprint templates ──────────────────

export interface Blueprint {
  key: string
  icon: string
  name: string
  color: string
  phases: {
    name: string
    description: string
    tasks: string[]
  }[]
}

export const BLUEPRINTS: Blueprint[] = [
  {
    key: 'blank', icon: '📝', name: 'Blank Project',
    color: '#C4E8F4',
    phases: [{ name: 'Phase 1', description: 'เริ่มต้น', tasks: [] }]
  },
  {
    key: 'bakery', icon: '🍞', name: 'Bakery / Café Launch',
    color: '#FDFACC',
    phases: [
      { name: 'Concept & DNA', description: 'สรุป brand, เมนูหลัก, Financial projection',
        tasks: ['สรุป Brand DNA (ชื่อ, สี, Positioning)', 'วิจัยตลาดและคู่แข่ง', 'ร่างเมนู Signature Items', 'ประเมิน Financial Projection เบื้องต้น'] },
      { name: 'R&D & Sourcing', description: 'พัฒนาสูตร, หา Supplier, ออกแบบ Packaging',
        tasks: ['ทดสอบสูตรหลัก (R&D)', 'ติดต่อ Supplier วัตถุดิบ', 'ออกแบบ Packaging', 'ทำ Cost calculation ต่อชิ้น'] },
      { name: 'Setup', description: 'ตกแต่งร้าน, อุปกรณ์, SOP',
        tasks: ['ตกแต่งภายในร้าน', 'สั่งซื้อและติดตั้งอุปกรณ์', 'เขียน SOP พนักงาน', 'เทรนทีม'] },
      { name: 'Pre-Launch', description: 'Social media, Teaser, Soft opening',
        tasks: ['สร้าง Social Media accounts', 'ถ่าย Content ก่อน launch', 'ปล่อย Teaser series', 'Soft Opening ทดสอบระบบ'] },
      { name: 'Launch 🚀', description: 'Grand Opening',
        tasks: ['Grand Opening', 'ยิง Ads แรก', 'Monitor ยอดและ feedback', 'สรุป Week 1 report'] },
    ]
  },
  {
    key: 'aiapp', icon: '🤖', name: 'AI App Development',
    color: '#E8F7FC',
    phases: [
      { name: 'Ideation', description: 'กำหนด use case, เลือก stack',
        tasks: ['กำหนด Problem ที่จะแก้', 'ทดสอบ Prompt Engineering', 'เลือก Tech Stack + API', 'สร้าง Prototype ใน Claude/ChatGPT'] },
      { name: 'Development', description: 'Build MVP',
        tasks: ['Setup project (Next.js + Supabase)', 'เชื่อมต่อ AI API', 'Build UI หลัก', 'Error handling + Edge cases'] },
      { name: 'Testing', description: 'ทดสอบและปรับ',
        tasks: ['ทดสอบ accuracy ของ AI', 'User testing กับ 3-5 คน', 'Optimize prompt + token', 'Bug fixes'] },
      { name: 'Deploy', description: 'ขึ้น production',
        tasks: ['Deploy บน Vercel', 'Setup domain', 'Beta test กลุ่มเล็ก', 'Collect feedback'] },
    ]
  },
  {
    key: 'brand', icon: '📣', name: 'Brand & Content Strategy',
    color: '#FFE4E6',
    phases: [
      { name: 'Strategy', description: 'กำหนด Target, Tone, Content Pillars',
        tasks: ['สรุป Target Audience', 'กำหนด Brand Voice + Keywords', 'กำหนด Content Pillars 3-4 แกน', 'วาง Content Calendar เดือนแรก'] },
      { name: 'Setup', description: 'Templates, อุปกรณ์, Knowledge Base',
        tasks: ['สร้าง Canva Templates', 'Setup Claude Project + Brand KB', 'เตรียมอุปกรณ์ถ่ายทำ', 'เขียน Brand Book'] },
      { name: 'Production', description: 'Batch shoot, Content sprint',
        tasks: ['Batch shoot Content เดือนแรก', 'ตัดต่อและ edit', 'เขียน Captions ชุดแรก', 'Schedule โพสต์'] },
      { name: 'Measure', description: 'วัดผลและปรับ',
        tasks: ['ดู Analytics สัปดาห์แรก', 'ปรับ Content ตาม data', 'สรุป Monthly report', 'วาง Plan เดือนถัดไป'] },
    ]
  },
  {
    key: 'interior', icon: '🏠', name: 'Interior Design Project',
    color: '#F0FDF4',
    phases: [
      { name: 'Brief & Concept', description: 'รับ brief, กำหนด mood',
        tasks: ['รับ Brief จากลูกค้า', 'กำหนด Style + Mood Board', 'วาง Budget เบื้องต้น', 'Concept presentation รอบแรก'] },
      { name: 'Design Development', description: 'แบบ 2D/3D, Materials',
        tasks: ['วาด Floor Plan', 'Render 3D perspective หลัก', 'เลือก Materials + Finishes', 'ปรับแก้ตาม Feedback'] },
      { name: 'Documentation', description: 'แบบก่อสร้าง, BOQ',
        tasks: ['ทำ Construction Drawing', 'จัดทำ BOQ รายละเอียด', 'ประสานงาน Contractor', 'ส่งแบบ final'] },
      { name: 'Construction', description: 'ก่อสร้างและ site visit',
        tasks: ['Kick-off กับ Contractor', 'Site visit สัปดาห์ละครั้ง', 'Monitor งานตาม timeline', 'QC ก่อนส่งมอบ'] },
    ]
  },
]

// ── Nekoro CI ────────────────────────────
export const CI = {
  nb: '#C4E8F4',
  nb_d: '#7BC8DF',
  nb_t: '#E8F7FC',
  nb_tt: '#F4FAFE',
  nc: '#2E1A0E',
  nc_m: '#5C3D26',
  nc_l: '#A07850',
  ny: '#FDFACC',
  ny_d: '#F5EF8A',
  bg: '#F4FAFE',
  white: '#FFFFFF',
}

export const LEVEL_NAMES = [
  'Apprentice', 'Bakery Builder', 'Craft Master',
  'Brand Architect', 'Launch Expert', 'Nekoro Legend'
]

export const XP_PER_TASK = 30
export const XP_LEVELS = [0, 300, 700, 1200, 2000, 3000]
