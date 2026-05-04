import { useState, useMemo, useEffect } from 'react'
import { Plus, Trash2, Pencil, X, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Guest } from '../types/database'

export interface TableConfig {
  id: number
  name: string
  type: 'round' | 'rectangular'
  capacity: number
}

interface Props {
  weddingId: string
  guests: Guest[]
  onGuestsChange: (guests: Guest[]) => void
}

// ─── SVG: Table ronde ────────────────────────────────────────────────────────
function RoundTableSvg({ seated, capacity }: { seated: Guest[]; capacity: number }) {
  const size = 150
  const cx = size / 2
  const cy = size / 2
  const tableR = 28
  const seatR = 13
  const orbitR = 50
  const display = Math.min(capacity, 12)

  const seats = Array.from({ length: display }, (_, i) => {
    const angle = (i / display) * 2 * Math.PI - Math.PI / 2
    return {
      x: cx + orbitR * Math.cos(angle),
      y: cy + orbitR * Math.sin(angle),
      guest: seated[i] ?? null,
    }
  })

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="w-full h-auto max-w-[150px] mx-auto block"
    >
      {/* Table */}
      <circle cx={cx} cy={cy} r={tableR} fill="#fdf2f8" stroke="#fbcfe8" strokeWidth="2" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="14" fill="#fda4af">
        ♥
      </text>

      {/* Seats */}
      {seats.map(({ x, y, guest }, i) => (
        <g key={i}>
          <circle
            cx={x}
            cy={y}
            r={seatR}
            fill={guest ? '#fce7f3' : '#f9fafb'}
            stroke={guest ? '#f9a8d4' : '#e5e7eb'}
            strokeWidth="1.5"
          />
          {guest ? (
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="7"
              fill="#831843"
              fontWeight="700"
            >
              {guest.first_name[0]?.toUpperCase()}
              {guest.last_name[0]?.toUpperCase()}
            </text>
          ) : (
            <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="#d1d5db">
              ·
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

// ─── SVG: Table rectangulaire (mariés) ───────────────────────────────────────
function RectangularTableSvg({ seated, capacity }: { seated: Guest[]; capacity: number }) {
  const display = Math.min(capacity, 14)
  const topCount = Math.ceil(display / 2)
  const bottomCount = Math.floor(display / 2)
  const seatR = 12

  const cols = Math.max(topCount, bottomCount)
  const svgW = Math.max(cols * 30 + 20, 200)
  const svgH = 120
  const tableW = svgW - 24
  const tableH = 36
  const tableX = 12
  const tableY = (svgH - tableH) / 2

  const topSeats = Array.from({ length: topCount }, (_, i) => ({
    x: tableX + (tableW / (topCount + 1)) * (i + 1),
    y: tableY - seatR - 5,
    guest: seated[i] ?? null,
  }))

  const bottomSeats = Array.from({ length: bottomCount }, (_, i) => ({
    x: tableX + (tableW / (bottomCount + 1)) * (i + 1),
    y: tableY + tableH + seatR + 5,
    guest: seated[topCount + i] ?? null,
  }))

  return (
    <svg
      width={svgW}
      height={svgH}
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="w-full h-auto max-w-full mx-auto block"
    >
      {/* Table */}
      <rect
        x={tableX}
        y={tableY}
        width={tableW}
        height={tableH}
        rx="6"
        fill="#fdf2f8"
        stroke="#fbcfe8"
        strokeWidth="2"
      />
      <text
        x={svgW / 2}
        y={svgH / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="9"
        fill="#be185d"
        fontWeight="600"
      >
        ♥ Mariés ♥
      </text>

      {/* Seats */}
      {[...topSeats, ...bottomSeats].map(({ x, y, guest }, i) => (
        <g key={i}>
          <circle
            cx={x}
            cy={y}
            r={seatR}
            fill={guest ? '#fce7f3' : '#f9fafb'}
            stroke={guest ? '#f9a8d4' : '#e5e7eb'}
            strokeWidth="1.5"
          />
          {guest ? (
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="7"
              fill="#831843"
              fontWeight="700"
            >
              {guest.first_name[0]?.toUpperCase()}
              {guest.last_name[0]?.toUpperCase()}
            </text>
          ) : (
            <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="#d1d5db">
              ·
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function TablePlan({ weddingId, guests, onGuestsChange }: Props) {
  const localKey = `mariage_tables_${weddingId}`

  const [tables, setTables] = useState<TableConfig[]>([])
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editTable, setEditTable] = useState<TableConfig | null>(null)
  const [tableForm, setTableForm] = useState<{ name: string; type: 'round' | 'rectangular'; capacity: number }>({
    name: '',
    type: 'round',
    capacity: 10,
  })
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  useEffect(() => {
    try {
      const stored: TableConfig[] = JSON.parse(localStorage.getItem(localKey) ?? '[]')
      setTables(stored)
    } catch {
      setTables([])
    }
  }, [localKey])

  function saveTables(next: TableConfig[]) {
    setTables(next)
    localStorage.setItem(localKey, JSON.stringify(next))
  }

  // ── Données dérivées ──────────────────────────────────────────────────────
  const guestsByTable = useMemo(() => {
    const map: Record<number, Guest[]> = {}
    for (const g of guests) {
      if (g.table_number !== null) {
        if (!map[g.table_number]) map[g.table_number] = []
        map[g.table_number].push(g)
      }
    }
    return map
  }, [guests])

  const unassigned = useMemo(
    () => guests.filter((g) => g.table_number === null && g.rsvp_status !== 'declined'),
    [guests],
  )

  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null
  const selectedGuests = selectedTableId !== null ? (guestsByTable[selectedTableId] ?? []) : []

  const totalSeats = tables.reduce((s, t) => s + t.capacity, 0)
  const totalAssigned = guests.filter((g) => g.table_number !== null).length

  // ── CRUD tables (localStorage) ────────────────────────────────────────────
  function addTable() {
    const name = tableForm.name.trim()
    if (!name) return
    const nextId = tables.length === 0 ? 1 : Math.max(...tables.map((t) => t.id)) + 1
    saveTables([...tables, { id: nextId, name, type: tableForm.type, capacity: tableForm.capacity }])
    setShowAddModal(false)
    resetForm()
  }

  function updateTable() {
    if (!editTable) return
    const name = tableForm.name.trim()
    if (!name) return
    saveTables(tables.map((t) => (t.id === editTable.id ? { ...t, name, type: tableForm.type, capacity: tableForm.capacity } : t)))
    setEditTable(null)
    resetForm()
  }

  async function deleteTable(tableId: number) {
    const affected = guests.filter((g) => g.table_number === tableId)
    if (affected.length > 0) {
      await supabase.from('guests').update({ table_number: null }).eq('wedding_id', weddingId).eq('table_number', tableId)
      onGuestsChange(guests.map((g) => (g.table_number === tableId ? { ...g, table_number: null } : g)))
    }
    saveTables(tables.filter((t) => t.id !== tableId))
    if (selectedTableId === tableId) setSelectedTableId(null)
    setConfirmDelete(null)
  }

  function resetForm() {
    setTableForm({ name: '', type: 'round', capacity: 10 })
  }

  function openAdd(type: 'round' | 'rectangular' = 'round') {
    resetForm()
    setTableForm({ name: '', type, capacity: type === 'rectangular' ? 12 : 10 })
    setShowAddModal(true)
  }

  function openEdit(table: TableConfig) {
    setEditTable(table)
    setTableForm({ name: table.name, type: table.type, capacity: table.capacity })
  }

  // ── Assignation d'invités (Supabase) ──────────────────────────────────────
  async function assignGuest(guestId: string, tableId: number | null) {
    const { data } = await supabase.from('guests').update({ table_number: tableId }).eq('id', guestId).select().single()
    if (data) onGuestsChange(guests.map((g) => (g.id === data.id ? data : g)))
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-gray-500">
          {tables.length} table(s) · {totalSeats} places · {unassigned.length} invité(s) non placé(s) ·{' '}
          <span className={totalAssigned === 0 && guests.length > 0 ? 'text-amber-500' : 'text-green-600'}>
            {totalAssigned} placé(s)
          </span>
        </p>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-secondary text-xs md:text-sm" onClick={() => openAdd('rectangular')}>
            <Plus className="w-3.5 h-3.5" /> Table rectangulaire
          </button>
          <button className="btn-primary text-xs md:text-sm" onClick={() => openAdd('round')}>
            <Plus className="w-3.5 h-3.5" /> Table ronde
          </button>
        </div>
      </div>

      {/* État vide */}
      {tables.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-5xl mb-4">🪑</div>
          <p className="font-medium text-gray-600 mb-1">Aucune table créée</p>
          <p className="text-sm text-gray-400 mb-6">
            Commencez par la table des mariés (rectangulaire), puis ajoutez les tables rondes pour vos invités.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button className="btn-secondary text-sm" onClick={() => openAdd('rectangular')}>
              ▬ Table des mariés
            </button>
            <button className="btn-primary text-sm" onClick={() => openAdd('round')}>
              ⭕ Table ronde
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Grille de tables ── */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tables.map((table) => {
                const seated = guestsByTable[table.id] ?? []
                const full = seated.length >= table.capacity
                const selected = selectedTableId === table.id

                return (
                  <div
                    key={table.id}
                    onClick={() => setSelectedTableId(selected ? null : table.id)}
                    className={`card p-4 cursor-pointer transition-all select-none ${
                      selected
                        ? 'border-rose-400 shadow-md ring-1 ring-rose-200'
                        : 'hover:border-rose-200 hover:shadow-sm'
                    }`}
                  >
                    {/* En-tête de carte */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0 pr-2">
                        <h3 className="font-semibold text-gray-800 text-sm truncate">{table.name}</h3>
                        <p className={`text-xs mt-0.5 font-medium ${full ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {seated.length}/{table.capacity} places {full ? '· Complet ✓' : ''}
                        </p>
                      </div>
                      <div className="flex gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openEdit(table)}
                          className="btn-ghost p-1.5 text-gray-300 hover:text-blue-500"
                          title="Modifier"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(table.id)}
                          className="btn-ghost p-1.5 text-gray-300 hover:text-red-500"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Visuel SVG */}
                    <div className="py-2">
                      {table.type === 'round' ? (
                        <RoundTableSvg seated={seated} capacity={table.capacity} />
                      ) : (
                        <RectangularTableSvg seated={seated} capacity={table.capacity} />
                      )}
                    </div>

                    {/* Chips d'invités */}
                    {seated.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                        {seated.map((g) => (
                          <span
                            key={g.id}
                            className="inline-flex items-center gap-1 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-full px-2 py-0.5"
                          >
                            {g.first_name} {g.last_name}
                            <button
                              onClick={() => assignGuest(g.id, null)}
                              className="hover:text-red-600 transition-colors"
                              title="Retirer de la table"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {seated.length === 0 && (
                      <p className="text-xs text-gray-300 text-center mt-1 italic">Cliquer pour ajouter des invités</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Panneau latéral ── */}
          <div className="space-y-4">
            {/* Panneau table sélectionnée */}
            {selectedTable && (
              <div className="card p-4 border-rose-200 bg-rose-50/30">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800 text-sm">
                    {selectedTable.name}
                  </h3>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    selectedGuests.length >= selectedTable.capacity
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-rose-100 text-rose-600'
                  }`}>
                    {selectedGuests.length}/{selectedTable.capacity}
                  </span>
                </div>

                {selectedGuests.length >= selectedTable.capacity ? (
                  <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg p-3 text-center">
                    Table complète ✓
                  </p>
                ) : unassigned.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3 italic">
                    Tous les invités confirmés sont placés
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-gray-400 mb-2">Cliquer pour placer à cette table :</p>
                    <div className="space-y-0.5 max-h-60 overflow-y-auto">
                      {unassigned.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => assignGuest(g.id, selectedTable.id)}
                          className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-sm hover:bg-rose-100 transition-colors group"
                        >
                          <span className="text-gray-700 text-xs">
                            {g.first_name} {g.last_name}
                          </span>
                          <span className="text-xs text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            Placer →
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Invités sans table */}
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-gray-400" />
                <h3 className="font-medium text-gray-700 text-sm">
                  Sans table
                  <span className="ml-1 text-gray-400 font-normal">({unassigned.length})</span>
                </h3>
              </div>

              {unassigned.length === 0 ? (
                <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg p-3 text-center">
                  🎉 Tous les invités confirmés sont placés !
                </p>
              ) : (
                <div className="space-y-0.5 max-h-72 overflow-y-auto">
                  {unassigned.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-50 text-xs"
                    >
                      <span className="text-gray-700 truncate mr-2">
                        {g.first_name} {g.last_name}
                      </span>
                      {tables.length > 0 && (
                        <select
                          className="text-xs border border-gray-200 rounded-md py-0.5 px-1 text-rose-500 bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-rose-300 shrink-0"
                          value=""
                          onChange={(e) => {
                            if (e.target.value) assignGuest(g.id, parseInt(e.target.value))
                          }}
                        >
                          <option value="">Placer…</option>
                          {tables
                            .filter((t) => (guestsByTable[t.id]?.length ?? 0) < t.capacity)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal ajouter / modifier ── */}
      {(showAddModal || editTable) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm p-6 space-y-5">
            <h2 className="font-serif text-xl">{editTable ? 'Modifier la table' : 'Nouvelle table'}</h2>

            {/* Type */}
            <div>
              <label className="label">Type de table</label>
              <div className="grid grid-cols-2 gap-2">
                {(['round', 'rectangular'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTableForm((f) => ({ ...f, type, capacity: type === 'rectangular' ? 12 : 10 }))}
                    className={`py-3 rounded-xl border-2 text-sm font-medium transition-all flex flex-col items-center gap-1.5 ${
                      tableForm.type === type
                        ? 'border-rose-400 bg-rose-50 text-rose-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-2xl">{type === 'round' ? '⭕' : '▬'}</span>
                    {type === 'round' ? 'Table ronde' : 'Rectangulaire'}
                  </button>
                ))}
              </div>
            </div>

            {/* Nom */}
            <div>
              <label className="label">Nom de la table</label>
              <input
                className="input"
                placeholder={tableForm.type === 'rectangular' ? 'ex : Table des mariés' : 'ex : Table 1'}
                value={tableForm.name}
                onChange={(e) => setTableForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && (editTable ? updateTable() : addTable())}
              />
            </div>

            {/* Capacité */}
            <div>
              <label className="label">Nombre de places</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setTableForm((f) => ({ ...f, capacity: Math.max(1, f.capacity - 1) }))}
                  className="btn-secondary px-3 py-2 text-lg font-bold"
                >
                  −
                </button>
                <span className="flex-1 text-center text-xl font-semibold text-gray-800">{tableForm.capacity}</span>
                <button
                  type="button"
                  onClick={() => setTableForm((f) => ({ ...f, capacity: Math.min(30, f.capacity + 1) }))}
                  className="btn-secondary px-3 py-2 text-lg font-bold"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={editTable ? updateTable : addTable}
                disabled={!tableForm.name.trim()}
                className="btn-primary flex-1"
              >
                {editTable ? 'Enregistrer' : 'Créer la table'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setEditTable(null); resetForm() }}
                className="btn-secondary"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmation suppression ── */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm p-6 space-y-4">
            <h2 className="font-serif text-xl">Supprimer cette table ?</h2>
            <p className="text-sm text-gray-500">
              Les invités assignés à cette table seront retirés et repasseront en « sans table ».
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => deleteTable(confirmDelete)}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
              >
                Supprimer
              </button>
              <button type="button" onClick={() => setConfirmDelete(null)} className="btn-secondary">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
