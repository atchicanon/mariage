export type RsvpStatus = 'pending' | 'confirmed' | 'declined'
export type WeddingType = 'civil' | 'religious'

export interface Wedding {
  id: string
  name: string
  date: string | null
  location: string
  address: string | null
  type: WeddingType
  total_budget: number
  created_at: string
}

export interface Guest {
  id: string
  wedding_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  rsvp_status: RsvpStatus
  table_number: number | null
  menu_choice: string | null
  plus_one: boolean
  plus_one_name: string | null
  children: string[]
  is_child: boolean
  group_name: string | null
  notes: string | null
  created_at: string
}

export interface BudgetCategory {
  id: string
  wedding_id: string
  name: string
  color: string
  created_at: string
}

export interface BudgetItem {
  id: string
  wedding_id: string
  category_id: string | null
  name: string
  estimated: number
  actual: number
  paid: boolean
  notes: string | null
  created_at: string
}

export interface Task {
  id: string
  wedding_id: string
  title: string
  done: boolean
  due_date: string | null
  assigned_to: string | null
  priority: 'low' | 'medium' | 'high'
  created_at: string
}

export interface Vendor {
  id: string
  wedding_id: string
  category: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  price: number | null
  deposit_paid: boolean
  deposit_amount: number | null
  contract_signed: boolean
  notes: string | null
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      weddings: {
        Row: Wedding
        Insert: Omit<Wedding, 'id' | 'created_at'>
        Update: Partial<Omit<Wedding, 'id' | 'created_at'>>
      }
      guests: {
        Row: Guest
        Insert: Omit<Guest, 'id' | 'created_at'>
        Update: Partial<Omit<Guest, 'id' | 'created_at'>>
      }
      budget_categories: {
        Row: BudgetCategory
        Insert: Omit<BudgetCategory, 'id' | 'created_at'>
        Update: Partial<Omit<BudgetCategory, 'id' | 'created_at'>>
      }
      budget_items: {
        Row: BudgetItem
        Insert: Omit<BudgetItem, 'id' | 'created_at'>
        Update: Partial<Omit<BudgetItem, 'id' | 'created_at'>>
      }
      tasks: {
        Row: Task
        Insert: Omit<Task, 'id' | 'created_at'>
        Update: Partial<Omit<Task, 'id' | 'created_at'>>
      }
      vendors: {
        Row: Vendor
        Insert: Omit<Vendor, 'id' | 'created_at'>
        Update: Partial<Omit<Vendor, 'id' | 'created_at'>>
      }
    }
  }
}
