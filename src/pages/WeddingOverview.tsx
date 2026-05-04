import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Users, DollarSign, CheckSquare, Briefcase, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useWeddingStore } from '../store/weddingStore'
import { format, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'

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
  const { weddings, setActiveWedding } = useWeddingStore()
  const [stats, setStats] = useState<Stats | null>(null)

  const wedding = weddings.find((w) => w.id === weddingId)

  useEffect(() => {
    if (weddingId) {
      setActiveWedding(weddingId)
      fetchStats()
    }
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

  if (!wedding) return null

  const daysLeft = wedding.date
    ? differenceInDays(new Date(wedding.date), new Date())
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
    </div>
  )
}
