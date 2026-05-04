import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Trash2, Briefcase, Phone, Mail } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Vendor } from '../types/database'

const VENDOR_CATEGORIES = [
  'Photographe',
  'Vidéaste',
  'Traiteur',
  'DJ / Orchestre',
  'Fleuriste',
  'Pâtisserie',
  'Coiffeur / Maquillage',
  'Lieu de réception',
  'Officiant',
  'Transport',
  'Autre',
]

const CATEGORY_EMOJIS: Record<string, string> = {
  'Photographe': '📸',
  'Vidéaste': '🎥',
  'Traiteur': '🍽️',
  'DJ / Orchestre': '🎵',
  'Fleuriste': '💐',
  'Pâtisserie': '🎂',
  'Coiffeur / Maquillage': '💄',
  'Lieu de réception': '🏰',
  'Officiant': '📜',
  'Transport': '🚗',
  'Autre': '📋',
}

const EMPTY_FORM = {
  category: 'Photographe',
  name: '',
  contact_name: '',
  email: '',
  phone: '',
  price: '',
  deposit_paid: false,
  deposit_amount: '',
  contract_signed: false,
  notes: '',
}

export default function Vendors() {
  const { weddingId } = useParams<{ weddingId: string }>()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    fetchVendors()
  }, [weddingId])

  async function fetchVendors() {
    if (!weddingId) return
    const { data } = await supabase
      .from('vendors')
      .select('*')
      .eq('wedding_id', weddingId)
      .order('category')
    setVendors(data ?? [])
  }

  async function saveVendor(e: React.FormEvent) {
    e.preventDefault()
    if (!weddingId) return
    const payload = {
      wedding_id: weddingId,
      category: form.category,
      name: form.name,
      contact_name: form.contact_name || null,
      email: form.email || null,
      phone: form.phone || null,
      price: form.price ? parseFloat(form.price) : null,
      deposit_paid: form.deposit_paid,
      deposit_amount: form.deposit_amount ? parseFloat(form.deposit_amount) : null,
      contract_signed: form.contract_signed,
      notes: form.notes || null,
    }
    const { data } = await supabase.from('vendors').insert(payload).select().single()
    if (data) {
      setVendors([...vendors, data])
      setShowForm(false)
      setForm(EMPTY_FORM)
    }
  }

  async function toggleField(vendor: Vendor, field: 'contract_signed' | 'deposit_paid') {
    const { data } = await supabase
      .from('vendors')
      .update({ [field]: !vendor[field] })
      .eq('id', vendor.id)
      .select()
      .single()
    if (data) setVendors(vendors.map((v) => (v.id === data.id ? data : v)))
  }

  async function deleteVendor(id: string) {
    await supabase.from('vendors').delete().eq('id', id)
    setVendors(vendors.filter((v) => v.id !== id))
  }

  const byCategory = VENDOR_CATEGORIES.map((cat) => ({
    cat,
    items: vendors.filter((v) => v.category === cat),
  })).filter(({ items }) => items.length > 0)

  const totalBudget = vendors.reduce((s, v) => s + (v.price ?? 0), 0)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl text-gray-800">Prestataires</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Budget total : {totalBudget.toLocaleString('fr-FR')} €
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" />
          Ajouter
        </button>
      </div>

      {/* Vendors by category */}
      {vendors.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">
          <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>Aucun prestataire pour l'instant</p>
        </div>
      ) : (
        <div className="space-y-4">
          {byCategory.map(({ cat, items }) => (
            <div key={cat}>
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <span>{CATEGORY_EMOJIS[cat] ?? '📋'}</span>
                {cat}
              </h3>
              <div className="space-y-2">
                {items.map((vendor) => (
                  <div key={vendor.id} className="card p-4 group">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium text-gray-800">{vendor.name}</h4>
                          {vendor.price && (
                            <span className="badge bg-gray-100 text-gray-600">
                              {vendor.price.toLocaleString('fr-FR')} €
                            </span>
                          )}
                        </div>
                        {vendor.contact_name && (
                          <p className="text-sm text-gray-500 mb-1">{vendor.contact_name}</p>
                        )}
                        <div className="flex items-center gap-4">
                          {vendor.email && (
                            <a
                              href={`mailto:${vendor.email}`}
                              className="flex items-center gap-1 text-xs text-blue-500 hover:underline"
                            >
                              <Mail className="w-3 h-3" />
                              {vendor.email}
                            </a>
                          )}
                          {vendor.phone && (
                            <a
                              href={`tel:${vendor.phone}`}
                              className="flex items-center gap-1 text-xs text-gray-500"
                            >
                              <Phone className="w-3 h-3" />
                              {vendor.phone}
                            </a>
                          )}
                        </div>
                        {vendor.notes && (
                          <p className="text-xs text-gray-400 mt-2">{vendor.notes}</p>
                        )}
                      </div>

                      {/* Status badges + actions */}
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => toggleField(vendor, 'deposit_paid')}
                          className={`badge cursor-pointer transition-colors ${
                            vendor.deposit_paid
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500 hover:bg-amber-50 hover:text-amber-700'
                          }`}
                        >
                          {vendor.deposit_paid ? '✓ Acompte' : 'Acompte'}
                        </button>
                        <button
                          onClick={() => toggleField(vendor, 'contract_signed')}
                          className={`badge cursor-pointer transition-colors ${
                            vendor.contract_signed
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-700'
                          }`}
                        >
                          {vendor.contract_signed ? '✓ Contrat' : 'Contrat'}
                        </button>
                        <button
                          onClick={() => deleteVendor(vendor.id)}
                          className="opacity-0 group-hover:opacity-100 btn-ghost text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="font-serif text-xl mb-4">Nouveau prestataire</h2>
            <form onSubmit={saveVendor} className="space-y-4">
              <div>
                <label className="label">Catégorie</label>
                <select
                  className="input"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {VENDOR_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_EMOJIS[c]} {c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Nom *</label>
                <input
                  className="input"
                  placeholder="ex : Studio Photo Martin"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Contact</label>
                <input
                  className="input"
                  placeholder="Nom de la personne"
                  value={form.contact_name}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
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
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Prix total (€)</label>
                  <input
                    type="number"
                    className="input"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Acompte (€)</label>
                  <input
                    type="number"
                    className="input"
                    value={form.deposit_amount}
                    onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.deposit_paid}
                    onChange={(e) => setForm({ ...form, deposit_paid: e.target.checked })}
                    className="w-4 h-4 accent-rose-500"
                  />
                  Acompte payé
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.contract_signed}
                    onChange={(e) => setForm({ ...form, contract_signed: e.target.checked })}
                    className="w-4 h-4 accent-rose-500"
                  />
                  Contrat signé
                </label>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
