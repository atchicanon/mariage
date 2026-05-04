import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Users, DollarSign, CheckSquare, Briefcase, TrendingUp, Pencil, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useWeddingStore } from '../store/weddingStore'
import { format, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { WeddingType } from '../types/database'

interface Stats {
  totalGuests: number
  confirmedGuests: number
  pendingGuests: number
  totalBudget: number
  spentBudget: number
  totalTasks: number
  doneTasks: number
  totalVendors: number
  confirmedVendors: number
}

export default function WeddingOverview() {
  const { weddingId } = useParams<{ weddingId: string }>()
  const { weddings, setActiveWedding, setWeddings, updateWedding } = useWeddingStore()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loadingWedding, setLoadingWedding] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    date: '',
    location: '',
    address: '',
    total_budget: '',
    type: 'civil' as WeddingType,
  })

  const wedding = weddings.find((w) => w.id === weddingId)

  useEffect(() => {
    if (!weddingId) return
    setActiveWedding(weddingId)
    if (weddings.length === 0) {
      setLoadingWedding(true)
      supabase.from('weddings').select('*').order('date').then(({ data }) => {
        if (data) setWeddings(data)
        setLoadingWedding(false)
      })
    }
    fetchStats()
  }, [weddingId])

  async function fetchStats() {
    if (!weddingId) return

    const [guests, budgetItems, tasks, vendors] = await Promise.all([
      supabase.from('guests').select('rsvp_status').eq('wedding_id', weddingId),
      supabase.from('budget_items').select('estimated, actual').eq('wedding_id', weddingId),
      supabase.from('tasks').select('done').eq('wedding_id', weddingId),
      supabase.from('vendors').select('contract_signed').eq('wedding_id', weddingId),
    ])

    const g = guests.data ?? []
    const b = budgetItems.data ?? []
    const t = tasks.data ?? []
    const v = vendors.data ?? []

    setStats({
      totalGuests: g.length,
      confirmedGuests: g.filter((x) => x.rsvp_status === 'confirmed').length,
      pendingGuests: g.filter((x) => x.rsvp_status === 'pending').length,
      totalBudget: b.reduce((sum, x) => sum + x.estimated, 0),
      spentBudget: b.reduce((sum, x) => sum + x.actual, 0),
      totalTasks: t.length,
      doneTasks: t.filter((x) => x.done).length,
      totalVendors: v.length,
      confirmedVendors: v.filter((x) => x.contract_signed).length,
    })
  }

  function openEdit() {
    if (!wedding) return
    setEditForm({
      name: wedding.name,
      date: wedding.date ?? '',
      location: wedding.location,
      address: wedding.address ?? '',
      total_budget: wedding.total_budget?.toString() ?? '0',
      type: wedding.type,
    })
    setShowEdit(true)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!weddingId || !wedding) return
    const payload = {
      name: editForm.name,
      date: editForm.date || null,
      location: editForm.location,
      address: editForm.address || null,
      total_budget: parseFloat(editForm.total_budget) || 0,
      type: editForm.type,
    }
    const { data } = await supabase.from('weddings').update(payload).eq('id', weddingId).select().single()
    if (data) {
      updateWedding(data)
      setShowEdit(false)
    }
  }

  if (loadingWedding) return null
  if (!wedding) return null

  const daysLeft = wedding.date
    ? differenceInDays(new Date(wedding.date), new Date())
    : null

  const mapsUrl = wedding.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(wedding.address)}`
    : null

  const cards = stats
    ? [
        {
          label: 'Invités confirmés',
          value: `${stats.confirmedGuests} / ${stats.totalGuests}`,
          sub: `${stats.pendingGuests} en attente`,
          icon: Users,
          color: 'text-blue-500',
          bg: 'bg-blue-50',
          to: 'invites',
        },
        {
          label: 'Budget utilisé',
          value: `${stats.spentBudget.toLocaleString('fr-FR')} €`,
          sub: `/ ${stats.totalBudget.toLocaleString('fr-FR')} € prévu`,
          icon: DollarSign,
          color: 'text-emerald-500',
          bg: 'bg-emerald-50',
          to: 'budget',
        },
        {
          label: 'Tâches terminées',
          value: `${stats.doneTasks} / ${stats.totalTasks}`,
          sub: `${stats.totalTasks - stats.doneTasks} restantes`,
          icon: CheckSquare,
          color: 'text-orange-500',
          bg: 'bg-orange-50',
          to: 'taches',
        },
        {
          label: 'Prestataires signés',
          value: `${stats.confirmedVendors} / ${stats.totalVendors}`,
          sub: `contrats confirmés`,
          icon: Briefcase,
          color: 'text-purple-500',
          bg: 'bg-purple-50',
          to: 'prestataires',
        },
      ]
    : []

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Countdown */}
      {daysLeft !== null && (
        <div className="card p-6 bg-gradient-to-r from-rose-50 to-pink-50 border-rose-100 text-center">
          <p className="text-gray-500 text-sm mb-1">Compte à rebours</p>
          {daysLeft > 0 ? (
            <>
              <p className="font-serif text-5xl text-rose-600 font-bold">{daysLeft}</p>
              <p className="text-gray-600 mt-1">jours avant le grand jour</p>
            </>
          ) : daysLeft === 0 ? (
            <p className="font-serif text-3xl text-rose-600">C'est aujourd'hui ! 🎉</p>
          ) : (
            <p className="text-gray-500">
              Célébré le {format(new Date(wedding.date!), 'dd MMMM yyyy', { locale: fr })}
            </p>
          )}
        </div>
      )}

      {/* Wedding info + edit */}
      <div className="card p-5 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-serif text-xl text-gray-800">{wedding.name}</h3>
          {wedding.date && (
            <p className="text-sm text-gray-500">
              {format(new Date(wedding.date), 'dd MMMM yyyy', { locale: fr })}
            </p>
          )}
          <p className="text-sm text-gray-500">{wedding.location}</p>
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline mt-0.5"
            >
              <MapPin className="w-3 h-3" />
              {wedding.address}
            </a>
          )}
          {wedding.total_budget > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              Budget global : <span className="font-medium text-gray-700">{wedding.total_budget.toLocaleString('fr-FR')} €</span>
            </p>
          )}
        </div>
        <button onClick={openEdit} className="btn-ghost p-2 shrink-0">
          <Pencil className="w-4 h-4" />
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map(({ label, value, sub, icon: Icon, color, bg, to }) => (
          <Link
            key={to}
            to={to}
            className="card p-5 hover:shadow-md hover:border-gray-300 transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <TrendingUp className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
            </div>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
            <p className="text-sm font-medium text-gray-600 mt-0.5">{label}</p>
            <p className="text-xs text-gray-400 mt-1">{sub}</p>
          </Link>
        ))}
      </div>

      {/* Edit modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="font-serif text-xl mb-5">Modifier le mariage</h2>
            <form onSubmit={saveEdit} className="space-y-4">
              <div>
                <label className="label">Nom</label>
                <input
                  className="input"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Type</label>
                <select
                  className="input"
                  value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value as WeddingType })}
                >
                  <option value="civil">Civil</option>
                  <option value="religious">Religieux</option>
                </select>
              </div>
              <div>
                <label className="label">Date</label>
                <input
                  type="date"
                  className="input"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Lieu</label>
                <input
                  className="input"
                  placeholder="ex : Bordeaux, La Réunion..."
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Adresse (lien Google Maps)</label>
                <input
                  className="input"
                  placeholder="ex : 12 rue de la Paix, 33000 Bordeaux"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Budget global (€)</label>
                <input
                  type="number"
                  className="input"
                  placeholder="0"
                  value={editForm.total_budget}
                  onChange={(e) => setEditForm({ ...editForm, total_budget: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">Enregistrer</button>
                <button type="button" className="btn-secondary" onClick={() => setShowEdit(false)}>
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
