export interface Profile {
  id: string
  first_name: string | null
  big_why: string | null
  notification_time: string | null
  onboarding_complete: boolean
  created_at: string
}

export interface LifeArea {
  id: string
  user_id: string
  name: string
  is_custom: boolean
  created_at: string
}

export interface CheckIn {
  id: string
  user_id: string
  date: string
  scores: Record<string, number>
  focus_text: string | null
  created_at: string
}

export interface Goal {
  id: string
  user_id: string
  life_area_id: string
  title: string
  target_date: string
  progress: number
  created_at: string
  life_area?: LifeArea
  actions?: GoalAction[]
}

export interface GoalAction {
  id: string
  goal_id: string
  week_number: number
  action_text: string
  completed: boolean
  due_date: string | null
  created_at: string
}

export interface FocusSession {
  id: string
  user_id: string
  task_name: string
  life_area_id: string | null
  duration_minutes: number
  completed_at: string
}

export interface CoachConversation {
  id: string
  user_id: string
  messages: ChatMessage[]
  created_at: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

export const DEFAULT_LIFE_AREAS = [
  'Health & Fitness',
  'Family & Relationships',
  'Faith & Spirituality',
  'Finance & Wealth',
  'Career & Business',
  'Personal Growth',
  'Social Life',
  'Rest & Recreation',
]

export const SCORE_LABELS: Record<number, string> = {
  1: '😔 Struggling',
  2: '😕 Below par',
  3: '😐 Okay',
  4: '😊 Good',
  5: '🌟 Thriving',
}
