import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Trash2, Check, DollarSign } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { BudgetCategory, BudgetItem } from '../types/database'

const CATEGORY_COLORS = [
  '#f43f5e', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
]

interface ItemWithCategory extends BudgetItem {
  category?: BudgetCategory
}

export default function Budget() {
  const { weddingId } = useParams<{ weddingId: string }>()
  const [categories, setCategories] = useState<BudgetCategory[]>([])
  const [items, setItems] = useState<ItemWithCategory[]>([])
  const [showCatForm, setShowCatForm] = useState(false)
  const [showItemForm, setShowItemForm] = useState(false)
  const [catForm, setCatForm] = useState({ name: '', color: CATEGORY_COLORS[0] })
  const [itemForm, setItemForm] = useState({
    name: '',
    category_id: '',
    estimated: '',
    actual: '',
    paid: false,
    notes: '',
  })

  useEffect(() => {
    fetchAll()
  }, [weddingId])

  async function fetchAll() {
    if (!weddingId) return
    const [cats, its] = await Promise.all([
      supabase.from('budget_categories').select('*').eq('wedding_id', weddingId).order('name'),
      supabase.from('budget_items').select('*').eq('wedding_id', weddingId).order('name'),
    ])
    const catData = cats.data ?? []
    const itemData = its.data ?? []
    setCategories(catData)
    setItems(
      itemData.map((item) => ({
        ...item,
        category: catData.find((c) => c.id === item.category_id),
      })),
    )
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!weddingId) return
    const { data } = await supabase
      .from('budget_categories')
      .insert({ wedding_id: weddingId, name: catForm.name, color: catForm.color })
      .select()
      .single()
    if (data) {
      setCategories([...categories, data])
      setShowCatForm(false)
      setCatForm({ name: '', color: CATEGORY_COLORS[0] })
    }
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    if (!weddingId) return
    const payload = {
      wedding_id: weddingId,
      category_id: itemForm.category_id || null,
      name: itemForm.name,
      estimated: parseFloat(itemForm.estimated) || 0,
      actual: parseFloat(itemForm.actual) || 0,
      paid: itemForm.paid,
      notes: itemForm.notes || null,
    }
    const { data } = await supabase.from('budget_items').insert(payload).select().single()
    if (data) {
      setItems([
        ...items,
        { ...data, category: categories.find((c) => c.id === data.category_id) },
      ])
      setShowItemForm(false)
      setItemForm({ name: '', category_id: '', estimated: '', actual: '', paid: false, notes: '' })
    }
  }

  async function togglePaid(item: BudgetItem) {
    const { data } = await supabase
      .from('budget_items')
      .update({ paid: !item.paid })
      .eq('id', item.id)
      .select()
      .single()
    if (data)
      setItems(
        items.map((i) =>
          i.id === data.id
            ? { ...data, category: categories.find((c) => c.id === data.category_id) }
            : i,
        ),
      )
  }

  async function deleteItem(id: string) {
    await supabase.from('budget_items').delete().eq('id', id)
    setItems(items.filter((i) => i.id !== id))
  }

  const totalEstimated = items.reduce((s, i) => s + i.estimated, 0)
  const totalActual = items.reduce((s, i) => s + i.actual, 0)
  const totalPaid = items.filter((i) => i.paid).reduce((s, i) => s + i.actual, 0)
  const pct = totalEstimated > 0 ? Math.min((totalActual / totalEstimated) * 100, 100) : 0

  const byCategory = categories.map((cat) => {
    const catItems = items.filter((i) => i.category_id === cat.id)
    return {
      cat,
      estimated: catItems.reduce((s, i) => s + i.estimated, 0),
      actual: catItems.reduce((s, i) => s + i.actual, 0),
      items: catItems,
    }
  })

  const uncategorized = items.filter((i) => !i.category_id)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl text-gray-800">Budget</h2>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowCatForm(true)}>
            <Plus className="w-4 h-4" />
            Catégorie
          </button>
          <button className="btn-primary" onClick={() => setShowItemForm(true)}>
            <Plus className="w-4 h-4" />
            Dépense
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="card p-6">
        <div className="grid grid-cols-3 gap-6 mb-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Budget prévu</p>
            <p className="text-2xl font-bold text-gray-800">
              {totalEstimated.toLocaleString('fr-FR')} €
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Dépensé</p>
            <p className={`text-2xl font-bold ${totalActual > totalEstimated ? 'text-red-600' : 'text-gray-800'}`}>
              {totalActual.toLocaleString('fr-FR')} €
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Payé</p>
            <p className="text-2xl font-bold text-green-600">
              {totalPaid.toLocaleString('fr-FR')} €
            </p>
          </div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all"
            style={{
              width: `${pct}%`,
              backgroundColor: pct > 100 ? '#ef4444' : '#f43f5e',
            }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">{pct.toFixed(0)}% du budget utilisé</p>
      </div>

      {/* Items by category */}
      {[...byCategory, ...(uncategorized.length ? [{ cat: null, estimated: 0, actual: 0, items: uncategorized }] : [])].map(
        ({ cat, estimated, actual, items: catItems }) => (
          <div key={cat?.id ?? 'none'} className="card overflow-hidden">
            <div
              className="px-5 py-3 flex items-center justify-between"
              style={{ borderLeft: `4px solid ${cat?.color ?? '#94a3b8'}` }}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-700">{cat?.name ?? 'Sans catégorie'}</span>
                <span className="badge bg-gray-100 text-gray-500">{catItems.length}</span>
              </div>
              <div className="text-sm text-gray-500">
                {actual.toLocaleString('fr-FR')} € / {estimated.toLocaleString('fr-FR')} €
              </div>
            </div>
            <table className="w-full">
              <tbody className="divide-y divide-gray-50">
                {catItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 group">
                    <td className="px-5 py-3">
                      <p className={`text-sm font-medium ${item.paid ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {item.name}
                      </p>
                      {item.notes && <p className="text-xs text-gray-400">{item.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 text-right">
                      {item.estimated.toLocaleString('fr-FR')} €
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800 text-right">
                      {item.actual.toLocaleString('fr-FR')} €
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => togglePaid(item)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          item.paid
                            ? 'bg-green-500 border-green-500'
                            : 'border-gray-300 hover:border-green-400'
                        }`}
                      >
                        {item.paid && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 btn-ghost text-red-400 hover:text-red-600 hover:bg-red-50 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      )}

      {items.length === 0 && (
        <div className="card p-8 text-center text-gray-400">
          <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>Aucune dépense pour l'instant</p>
        </div>
      )}

      {/* Category modal */}
      {showCatForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm p-6">
            <h2 className="font-serif text-xl mb-4">Nouvelle catégorie</h2>
            <form onSubmit={addCategory} className="space-y-4">
              <div>
                <label className="label">Nom</label>
                <input
                  className="input"
                  placeholder="ex : Traiteur, Fleurs, Photos..."
                  value={catForm.name}
                  onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Couleur</label>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORY_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCatForm({ ...catForm, color: c })}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        catForm.color === c ? 'border-gray-800 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary flex-1">Créer</button>
                <button type="button" className="btn-secondary" onClick={() => setShowCatForm(false)}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item modal */}
      {showItemForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="font-serif text-xl mb-4">Nouvelle dépense</h2>
            <form onSubmit={addItem} className="space-y-4">
              <div>
                <label className="label">Intitulé *</label>
                <input
                  className="input"
                  placeholder="ex : Traiteur repas de mariage"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Catégorie</label>
                <select
                  className="input"
                  value={itemForm.category_id}
                  onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value })}
                >
                  <option value="">Sans catégorie</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Budget prévu (€)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="0"
                    value={itemForm.estimated}
                    onChange={(e) => setItemForm({ ...itemForm, estimated: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Montant réel (€)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="0"
                    value={itemForm.actual}
                    onChange={(e) => setItemForm({ ...itemForm, actual: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="paid"
                  checked={itemForm.paid}
                  onChange={(e) => setItemForm({ ...itemForm, paid: e.target.checked })}
                  className="w-4 h-4 accent-rose-500"
                />
                <label htmlFor="paid" className="text-sm text-gray-700">Déjà payé</label>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  value={itemForm.notes}
                  onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })}
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary flex-1">Ajouter</button>
                <button type="button" className="btn-secondary" onClick={() => setShowItemForm(false)}>
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
