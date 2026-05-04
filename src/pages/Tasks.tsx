import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Trash2, CheckSquare, Calendar } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Task } from '../types/database'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

type Priority = 'low' | 'medium' | 'high'

const PRIORITY_STYLES: Record<Priority, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-amber-50 text-amber-700',
  high: 'bg-red-50 text-red-700',
}

const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
}

const DEFAULT_TASKS = [
  { title: 'Réserver la salle de réception', priority: 'high' as Priority },
  { title: 'Choisir le traiteur', priority: 'high' as Priority },
  { title: 'Envoyer les faire-parts', priority: 'high' as Priority },
  { title: 'Réserver le photographe', priority: 'high' as Priority },
  { title: 'Choisir les tenues', priority: 'medium' as Priority },
  { title: 'Organiser le voyage de noces', priority: 'medium' as Priority },
  { title: 'Commander le gâteau', priority: 'medium' as Priority },
  { title: 'Créer la playlist', priority: 'low' as Priority },
  { title: 'Préparer les décorations', priority: 'low' as Priority },
]

export default function Tasks() {
  const { weddingId } = useParams<{ weddingId: string }>()
  const [tasks, setTasks] = useState<Task[]>([])
  const [showForm, setShowForm] = useState(false)
  const [filterDone, setFilterDone] = useState<'all' | 'todo' | 'done'>('all')
  const [form, setForm] = useState({
    title: '',
    priority: 'medium' as Priority,
    due_date: '',
    assigned_to: '',
  })

  useEffect(() => {
    fetchTasks()
  }, [weddingId])

  async function fetchTasks() {
    if (!weddingId) return
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('wedding_id', weddingId)
      .order('done')
      .order('priority', { ascending: false })
    setTasks(data ?? [])
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!weddingId) return
    const { data } = await supabase
      .from('tasks')
      .insert({
        wedding_id: weddingId,
        title: form.title,
        done: false,
        priority: form.priority,
        due_date: form.due_date || null,
        assigned_to: form.assigned_to || null,
      })
      .select()
      .single()
    if (data) {
      setTasks([...tasks, data])
      setShowForm(false)
      setForm({ title: '', priority: 'medium', due_date: '', assigned_to: '' })
    }
  }

  async function toggleTask(task: Task) {
    const { data } = await supabase
      .from('tasks')
      .update({ done: !task.done })
      .eq('id', task.id)
      .select()
      .single()
    if (data) setTasks(tasks.map((t) => (t.id === data.id ? data : t)))
  }

  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(tasks.filter((t) => t.id !== id))
  }

  async function addDefaultTasks() {
    if (!weddingId) return
    const inserts = DEFAULT_TASKS.map((t) => ({
      wedding_id: weddingId,
      title: t.title,
      done: false,
      priority: t.priority,
      due_date: null,
      assigned_to: null,
    }))
    const { data } = await supabase.from('tasks').insert(inserts).select()
    if (data) setTasks([...tasks, ...data])
  }

  const filtered = tasks.filter((t) => {
    if (filterDone === 'todo') return !t.done
    if (filterDone === 'done') return t.done
    return true
  })

  const doneCount = tasks.filter((t) => t.done).length
  const pct = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl text-gray-800">Tâches</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {doneCount} / {tasks.length} terminées
          </p>
        </div>
        <div className="flex gap-2">
          {tasks.length === 0 && (
            <button className="btn-secondary" onClick={addDefaultTasks}>
              Utiliser le modèle
            </button>
          )}
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" />
            Tâche
          </button>
        </div>
      </div>

      {/* Progress */}
      {tasks.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Progression</span>
            <span className="text-sm font-bold text-rose-600">{pct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-rose-400 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'todo', 'done'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilterDone(f)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filterDone === f
                ? 'bg-rose-100 text-rose-700 font-medium'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {f === 'all' ? 'Toutes' : f === 'todo' ? 'À faire' : 'Terminées'}
          </button>
        ))}
      </div>

      {/* Tasks list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="card p-8 text-center text-gray-400">
            <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>Aucune tâche</p>
          </div>
        ) : (
          filtered.map((task) => (
            <div
              key={task.id}
              className={`card px-4 py-3 flex items-center gap-3 group transition-opacity ${
                task.done ? 'opacity-60' : ''
              }`}
            >
              <button
                onClick={() => toggleTask(task)}
                className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  task.done
                    ? 'bg-rose-400 border-rose-400'
                    : 'border-gray-300 hover:border-rose-400'
                }`}
              >
                {task.done && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${task.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                  {task.title}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className={`badge ${PRIORITY_STYLES[task.priority]}`}>
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                  {task.due_date && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(task.due_date), 'dd MMM yyyy', { locale: fr })}
                    </span>
                  )}
                  {task.assigned_to && (
                    <span className="text-xs text-gray-400">→ {task.assigned_to}</span>
                  )}
                </div>
              </div>

              <button
                onClick={() => deleteTask(task.id)}
                className="opacity-0 group-hover:opacity-100 btn-ghost text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="font-serif text-xl mb-4">Nouvelle tâche</h2>
            <form onSubmit={addTask} className="space-y-4">
              <div>
                <label className="label">Titre *</label>
                <input
                  className="input"
                  placeholder="ex : Réserver la salle..."
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Priorité</label>
                  <select
                    className="input"
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
                  >
                    {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
                      <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Échéance</label>
                  <input
                    type="date"
                    className="input"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="label">Assigné à</label>
                <input
                  className="input"
                  placeholder="ex : Marie, Thomas..."
                  value={form.assigned_to}
                  onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary flex-1">Ajouter</button>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
