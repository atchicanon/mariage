import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Heart, MapPin, Calendar, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useWeddingStore } from '../store/weddingStore'
import type { Wedding, WeddingType } from '../types/database'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function Dashboard() {
  const navigate = useNavigate()
  const { weddings, setWeddings, setActiveWedding } = useWeddingStore()
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [guestCounts, setGuestCounts] = useState<Record<string, number>>({})

  const [form, setForm] = useState({
    name: '',
    date: '',
    location: '',
    type: 'civil' as WeddingType,
  })

  useEffect(() => {
    fetchWeddings()
  }, [])

  async function fetchWeddings() {
    setLoading(true)
    const { data } = await supabase.from('weddings').select('*').order('date')
    if (data) {
      setWeddings(data)
      await fetchGuestCounts(data)
    }
    setLoading(false)
  }

  async function fetchGuestCounts(ws: Wedding[]) {
    const counts: Record<string, number> = {}
    await Promise.all(
      ws.map(async (w) => {
        const { count } = await supabase
          .from('guests')
          .select('*', { count: 'exact', head: true })
          .eq('wedding_id', w.id)
        counts[w.id] = count ?? 0
      }),
    )
    setGuestCounts(counts)
  }

  async function createWedding(e: React.FormEvent) {
    e.preventDefault()
    const { data } = await supabase.from('weddings').insert(form).select().single()
    if (data) {
      setWeddings([...weddings, data])
      setShowForm(false)
      setForm({ name: '', date: '', location: '', type: 'civil' })
      navigate(`/mariage/${data.id}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Heart className="w-8 h-8 text-rose-400 animate-pulse fill-rose-400" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero */}
      <div className="text-center mb-10">
        <Heart className="w-12 h-12 text-rose-400 fill-rose-400 mx-auto mb-4" />
        <h1 className="font-serif text-4xl text-gray-800 mb-2">Notre Mariage</h1>
        <p className="text-gray-500">Gérez vos deux cérémonies au même endroit</p>
      </div>

      {/* Wedding cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {weddings.map((wedding) => (
          <button
            key={wedding.id}
            onClick={() => {
              setActiveWedding(wedding.id)
              navigate(`/mariage/${wedding.id}`)
            }}
            className="card p-6 text-left hover:shadow-md hover:border-rose-200 transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <span className="text-4xl">{wedding.type === 'civil' ? '🏛️' : '⛪'}</span>
              <span className="badge bg-rose-50 text-rose-700">
                {wedding.type === 'civil' ? 'Mairie' : 'Église'}
              </span>
            </div>
            <h2 className="font-serif text-xl text-gray-800 mb-3 group-hover:text-rose-700 transition-colors">
              {wedding.name}
            </h2>
            <div className="space-y-1.5">
              {wedding.date && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Calendar className="w-3.5 h-3.5" />
                  {format(new Date(wedding.date), 'dd MMMM yyyy', { locale: fr })}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <MapPin className="w-3.5 h-3.5" />
                {wedding.location}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Users className="w-3.5 h-3.5" />
                {guestCounts[wedding.id] ?? 0} invité(s)
              </div>
            </div>
          </button>
        ))}

        {/* Add wedding card */}
        <button
          onClick={() => setShowForm(true)}
          className="card p-6 border-dashed hover:border-rose-300 hover:bg-rose-50/30 transition-all flex flex-col items-center justify-center gap-3 text-gray-400 hover:text-rose-500 min-h-[180px]"
        >
          <Plus className="w-8 h-8" />
          <span className="text-sm font-medium">Ajouter une cérémonie</span>
        </button>
      </div>

      {/* Add form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="font-serif text-xl mb-5">Nouvelle cérémonie</h2>
            <form onSubmit={createWedding} className="space-y-4">
              <div>
                <label className="label">Nom de la cérémonie</label>
                <input
                  className="input"
                  placeholder="ex : Mariage civil Bordeaux"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Type</label>
                <select
                  className="input"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as WeddingType })}
                >
                  <option value="civil">🏛️ Mairie (civil)</option>
                  <option value="religious">⛪ Église (religieux)</option>
                </select>
              </div>
              <div>
                <label className="label">Lieu</label>
                <input
                  className="input"
                  placeholder="ex : Bordeaux, Gironde"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Date</label>
                <input
                  type="date"
                  className="input"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  <Plus className="w-4 h-4" />
                  Créer
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowForm(false)}
                >
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
