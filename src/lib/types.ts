export type Role = 'coach' | 'player'
export type Availability = 'available' | 'injured' | 'temporary_leave'
export type ActivityKind = 'training' | 'friendly' | 'league' | 'other'
export type AttendanceResponse = 'yes' | 'no'

export interface Profile {
  id: string
  team_id: string
  full_name: string
  role: Role
}

export interface Player {
  id: string
  team_id: string
  user_id: string | null
  full_name: string
  jersey_number: number | null
  position: string | null
  availability: Availability
  photo_path: string | null
  created_at: string
}

export interface Activity {
  id: string
  team_id: string
  title: string
  activity_type: ActivityKind
  activity_date: string
  start_time: string | null
  location: string | null
  description: string | null
  objectives: string | null
}

export interface MatchRecord {
  id: string
  team_id: string
  opponent: string
  match_date: string
  start_time: string | null
  location: string | null
  round: string | null
  home_score: number | null
  away_score: number | null
  status: 'pending' | 'finished'
}

export interface LineupPlayer {
  id?: string
  player_id: string
  slot_type: 'starter' | 'bench'
  x: number
  y: number
  position_label: string | null
  player?: Pick<Player, 'id' | 'full_name' | 'jersey_number' | 'position'>
}

export interface Lineup {
  id: string
  team_id: string
  match_id: string | null
  name: string
  formation: string
  published: boolean
  created_at: string
  lineup_players?: LineupPlayer[]
}

export interface PlayToken {
  id: string
  player_id: string | null
  label: string
  number: number | null
  x: number
  y: number
}

export interface PlayPath {
  id: string
  kind: 'run' | 'pass'
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface PlayZone {
  id: string
  x: number
  y: number
  width: number
  height: number
  label: string
}

export interface PlayNote {
  id: string
  x: number
  y: number
  text: string
}

export interface PlayStep {
  title: string
  players: PlayToken[]
  paths: PlayPath[]
  zones: PlayZone[]
  notes: PlayNote[]
}

export interface TacticalPlay {
  id: string
  team_id: string
  title: string
  category: string
  steps: PlayStep[]
  published: boolean
  updated_at: string
}

export interface Announcement {
  id: string
  team_id: string
  title: string
  body: string
  created_at: string
}
