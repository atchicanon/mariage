import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Search,
  Trash2,
  UserPlus,
  Download,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Guest, RsvpStatus } from '../types/database'

const RSVP_LABELS: Record<RsvpStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirmé',
  declined: 'Décliné',
}

const RSVP_STYLES: Record<RsvpStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-green-50 text-green-700',
  declined: 'bg-red-50 text-red-700',
}


const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  rsvp_status: 'pending' as RsvpStatus,
  table_number: '',
  menu_choice: '',
  plus_one: false,
  plus_one_name: '',
  notes: '',
}

export default function Guests() {
  const { weddingId } = useParams<{ weddingId: string }>()
  const [guests, setGuests] = useState<Guest[]>([])
  const [search, setSearch] = useState('')
  const [filterRsvp, setFilterRsvp] = useState<RsvpStatus | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [editGuest, setEditGuest] = useState<Guest | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchGuests()
  }, [weddingId])

  async function fetchGuests() {
    if (!weddingId) return
    setLoading(true)
    const { data } = await supabase
      .from('guests')
      .select('*')
      .eq('wedding_id', weddingId)
      .order('last_name')
    setGuests(data ?? [])
    setLoading(false)
  }

  async function saveGuest(e: React.FormEvent) {
    e.preventDefault()
    if (!weddingId) return

    const payload = {
      wedding_id: weddingId,
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || null,
      phone: form.phone || null,
      rsvp_status: form.rsvp_status,
      table_number: form.table_number ? parseInt(form.table_number) : null,
      menu_choice: form.menu_choice || null,
      plus_one: form.plus_one,
      plus_one_name: form.plus_one ? form.plus_one_name || null : null,
      notes: form.notes || null,
    }

    if (editGuest) {
      const { data } = await supabase
        .from('guests')
        .update(payload)
        .eq('id', editGuest.id)
        .select()
        .single()
      if (data) setGuests(guests.map((g) => (g.id === data.id ? data : g)))
    } else {
      const { data } = await supabase.from('guests').insert(payload).select().single()
      if (data) setGuests([...guests, data])
    }

    closeForm()
  }

  async function deleteGuest(id: string) {
    await supabase.from('guests').delete().eq('id', id)
    setGuests(guests.filter((g) => g.id !== id))
  }

  async function updateRsvp(id: string, status: RsvpStatus) {
    const { data } = await supabase
      .from('guests')
      .update({ rsvp_status: status })
      .eq('id', id)
      .select()
      .single()
    if (data) setGuests(guests.map((g) => (g.id === data.id ? data : g)))
  }

  function openEdit(guest: Guest) {
    setEditGuest(guest)
    setForm({
      first_name: guest.first_name,
      last_name: guest.last_name,
      email: guest.email ?? '',
      phone: guest.phone ?? '',
      rsvp_status: guest.rsvp_status,
      table_number: guest.table_number?.toString() ?? '',
      menu_choice: guest.menu_choice ?? '',
      plus_one: guest.plus_one,
      plus_one_name: guest.plus_one_name ?? '',
      notes: guest.notes ?? '',
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditGuest(null)
    setForm(EMPTY_FORM)
  }

  function exportCsv() {
    const headers = ['Nom', 'Prénom', 'Email', 'Téléphone', 'RSVP', 'Table', 'Menu', 'Plus one']
    const rows = guests.map((g) => [
      g.last_name,
      g.first_name,
      g.email ?? '',
      g.phone ?? '',
      RSVP_LABELS[g.rsvp_status],
      g.table_number ?? '',
      g.menu_choice ?? '',
      g.plus_one ? g.plus_one_name ?? 'Oui' : 'Non',
    ])
    const csv = [headers, ...rows].map((r) => r.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'invites.csv'
    a.click()
  }

  const filtered = guests.filter((g) => {
    const matchSearch =
      `${g.first_name} ${g.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      (g.email ?? '').toLowerCase().includes(search.toLowerCase())
    const matchRsvp = filterRsvp === 'all' || g.rsvp_status === filterRsvp
    return matchSearch && matchRsvp
  })

  const counts = {
    total: guests.length,
    confirmed: guests.filter((g) => g.rsvp_status === 'confirmed').length,
    pending: guests.filter((g) => g.rsvp_status === 'pending').length,
    declined: guests.filter((g) => g.rsvp_status === 'declined').length,
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl text-gray-800">Invités</h2>
          <p className="text-sm text-gray-500 mt-0.5">{counts.total} invité(s) au total</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={exportCsv}>
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <UserPlus className="w-4 h-4" />
            Ajouter
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {(['all', 'confirmed', 'pending', 'declined'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterRsvp(s)}
            className={`card p-3 text-center transition-all ${
              filterRsvp === s ? 'border-rose-300 bg-rose-50' : 'hover:border-gray-300'
            }`}
          >
            <p className="text-2xl font-bold text-gray-800">
              {s === 'all' ? counts.total : counts[s]}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {s === 'all' ? 'Total' : RSVP_LABELS[s]}
            </p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Rechercher un invité..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>Aucun invité{search ? ' trouvé' : ''}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Nom</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Contact</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">RSVP</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Table</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Menu</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((guest) => {
                return (
                  <tr key={guest.id} className="hover:bg-gray-50/50 group">
                    <td className="px-4 py-3">
                      <button
                        className="text-left"
                        onClick={() => openEdit(guest)}
                      >
                        <p className="font-medium text-gray-800 hover:text-rose-600 transition-colors">
                          {guest.first_name} {guest.last_name}
                        </p>
                        {guest.plus_one && (
                          <p className="text-xs text-gray-400">
                            +1 {guest.plus_one_name ? `(${guest.plus_one_name})` : ''}
                          </p>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-600">{guest.email ?? '—'}</p>
                      <p className="text-xs text-gray-400">{guest.phone ?? ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={guest.rsvp_status}
                        onChange={(e) => updateRsvp(guest.id, e.target.value as RsvpStatus)}
                        className={`badge cursor-pointer border-0 ${RSVP_STYLES[guest.rsvp_status]}`}
                      >
                        {(Object.keys(RSVP_LABELS) as RsvpStatus[]).map((s) => (
                          <option key={s} value={s}>
                            {RSVP_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {guest.table_number ? `Table ${guest.table_number}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {guest.menu_choice ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => deleteGuest(guest.id)}
                        className="opacity-0 group-hover:opacity-100 btn-ghost text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="font-serif text-xl mb-5">
              {editGuest ? 'Modifier l\'invité' : 'Ajouter un invité'}
            </h2>
            <form onSubmit={saveGuest} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Prénom *</label>
                  <input
                    className="input"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Nom *</label>
                  <input
                    className="input"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Téléphone</label>
                <input
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">RSVP</label>
                  <select
                    className="input"
                    value={form.rsvp_status}
                    onChange={(e) => setForm({ ...form, rsvp_status: e.target.value as RsvpStatus })}
                  >
                    {(Object.keys(RSVP_LABELS) as RsvpStatus[]).map((s) => (
                      <option key={s} value={s}>{RSVP_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Numéro de table</label>
                  <input
                    type="number"
                    className="input"
                    value={form.table_number}
                    onChange={(e) => setForm({ ...form, table_number: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="label">Choix du menu</label>
                <input
                  className="input"
                  placeholder="ex : Végétarien, Poisson, Viande..."
                  value={form.menu_choice}
                  onChange={(e) => setForm({ ...form, menu_choice: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="plus_one"
                  checked={form.plus_one}
                  onChange={(e) => setForm({ ...form, plus_one: e.target.checked })}
                  className="w-4 h-4 accent-rose-500"
                />
                <label htmlFor="plus_one" className="text-sm text-gray-700">
                  Accompagné(e) (plus one)
                </label>
              </div>
              {form.plus_one && (
                <div>
                  <label className="label">Nom de l'accompagnant</label>
                  <input
                    className="input"
                    value={form.plus_one_name}
                    onChange={(e) => setForm({ ...form, plus_one_name: e.target.value })}
                  />
                </div>
              )}
              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  {editGuest ? 'Enregistrer' : 'Ajouter'}
                </button>
                <button type="button" className="btn-secondary" onClick={closeForm}>
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
