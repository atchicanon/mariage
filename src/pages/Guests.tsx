import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  Search, Trash2, UserPlus, Download, Upload, Clock,
  ChevronDown, ChevronRight, Users, Pencil, Check, X,
  ArrowUp, ArrowDown, Plus, ArrowRight,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Guest, RsvpStatus } from '../types/database'

type GroupType = 'famille' | 'amis'
interface GroupMeta { type: GroupType; position: number }

const RSVP_LABELS: Record<RsvpStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirmé',
  declined: 'Décliné',
}


const RSVP_ICON = {
  pending:   { Icon: Clock, cls: 'text-amber-400 hover:text-amber-600' },
  confirmed: { Icon: Check, cls: 'text-green-500 hover:text-green-700' },
  declined:  { Icon: X,     cls: 'text-red-400 hover:text-red-600' },
}
const RSVP_CYCLE: Record<RsvpStatus, RsvpStatus> = {
  pending: 'confirmed', confirmed: 'declined', declined: 'pending',
}

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  rsvp_status: 'pending' as RsvpStatus,
  table_number: '',
  menu_choice: 'Pas de restriction',
  children: [] as string[],
  group_name: '',
  notes: '',
}

export default function Guests() {
  const { weddingId } = useParams<{ weddingId: string }>()
  const localKey = `mariage_groups_${weddingId}`

  const [guests, setGuests] = useState<Guest[]>([])
  const [groupsMeta, setGroupsMeta] = useState<Record<string, GroupMeta>>({})
  const [search, setSearch] = useState('')
  const [filterRsvp, setFilterRsvp] = useState<RsvpStatus | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editGuest, setEditGuest] = useState<Guest | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [importText, setImportText] = useState('')
  const [importGroup, setImportGroup] = useState('')
  const [importError, setImportError] = useState('')
  const [loading, setLoading] = useState(true)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [groupEditModal, setGroupEditModal] = useState<{ name: string; newName: string; type: GroupType } | null>(null)
  const [movingGuest, setMovingGuest] = useState<string | null>(null)
  const [quickAddGroup, setQuickAddGroup] = useState<string | null>(null)
  const [quickAddForm, setQuickAddForm] = useState({ first_name: '', last_name: '' })
  const [newGroupType, setNewGroupType] = useState<GroupType | null>(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [importCsvRows, setImportCsvRows] = useState<string[][] | null>(null)

  // ---------- localStorage helpers ----------
  const loadMeta = useCallback((): Record<string, GroupMeta> => {
    try { return JSON.parse(localStorage.getItem(localKey) ?? '{}') }
    catch { return {} }
  }, [localKey])

  const saveMeta = useCallback((meta: Record<string, GroupMeta>) => {
    setGroupsMeta(meta)
    localStorage.setItem(localKey, JSON.stringify(meta))
  }, [localKey])

  // ---------- Fetch ----------
  useEffect(() => { fetchGuests() }, [weddingId])

  async function fetchGuests() {
    if (!weddingId) return
    setLoading(true)
    const { data } = await supabase
      .from('guests').select('*').eq('wedding_id', weddingId).order('last_name')
    const list = data ?? []
    setGuests(list)

    // Auto-register unknown groups in meta
    const meta = loadMeta()
    const fromGuests = [...new Set(list.map((g) => g.group_name).filter(Boolean))] as string[]
    const missing = fromGuests.filter((n) => !meta[n])
    if (missing.length) {
      const maxPos = Object.values(meta).reduce((m, v) => Math.max(m, v.position), -1) + 1
      missing.forEach((name, i) => { meta[name] = { type: 'famille', position: maxPos + i } })
      localStorage.setItem(localKey, JSON.stringify(meta))
    }
    setGroupsMeta(meta)
    setLoading(false)
  }

  // ---------- Guest CRUD ----------
  async function saveGuest(e: React.FormEvent) {
    e.preventDefault()
    if (!weddingId) return
    const children = form.children.map((c) => c.trim()).filter(Boolean)
    const payload = {
      wedding_id: weddingId,
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || null,
      phone: form.phone || null,
      rsvp_status: form.rsvp_status,
      table_number: form.table_number ? parseInt(form.table_number) : null,
      menu_choice: form.menu_choice || 'Pas de restriction',
      children,
      plus_one: children.length > 0,
      plus_one_name: children[0] ?? null,
      group_name: form.group_name || null,
      notes: form.notes || null,
    }
    if (editGuest) {
      const { data } = await supabase.from('guests').update(payload).eq('id', editGuest.id).select().single()
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
    const { data } = await supabase.from('guests').update({ rsvp_status: status }).eq('id', id).select().single()
    if (data) setGuests(guests.map((g) => (g.id === data.id ? data : g)))
  }

  async function resetMenuChoices() {
    if (!weddingId) return
    await supabase.from('guests').update({ menu_choice: 'Pas de restriction' }).eq('wedding_id', weddingId)
    setGuests(guests.map((g) => ({ ...g, menu_choice: 'Pas de restriction' })))
  }

  // ---------- Group management ----------
  async function saveGroupEdit() {
    if (!groupEditModal || !weddingId) return
    const { name, newName, type } = groupEditModal
    const trimmed = newName.trim()
    if (!trimmed) return
    if (trimmed !== name) {
      await supabase.from('guests')
        .update({ group_name: trimmed })
        .eq('wedding_id', weddingId)
        .eq('group_name', name)
      setGuests(guests.map((g) => g.group_name === name ? { ...g, group_name: trimmed } : g))
    }
    const next = { ...groupsMeta }
    const existing = next[name]
    if (trimmed !== name) {
      next[trimmed] = { ...existing, type }
      delete next[name]
    } else {
      next[name] = { ...existing, type }
    }
    saveMeta(next)
    setGroupEditModal(null)
  }

  async function confirmAllGroup(groupName: string) {
    if (!weddingId) return
    await supabase.from('guests')
      .update({ rsvp_status: 'confirmed' })
      .eq('wedding_id', weddingId)
      .eq('group_name', groupName)
    setGuests(guests.map((g) => g.group_name === groupName ? { ...g, rsvp_status: 'confirmed' } : g))
    setGroupEditModal(null)
  }

  function moveGroupOrder(groupName: string, dir: 'up' | 'down', siblings: string[]) {
    const idx = siblings.indexOf(groupName)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= siblings.length) return
    const swapName = siblings[swapIdx]
    const next = { ...groupsMeta }
    const posA = next[groupName].position
    next[groupName] = { ...next[groupName], position: next[swapName].position }
    next[swapName] = { ...next[swapName], position: posA }
    saveMeta(next)
  }

  function createGroup(name: string, type: GroupType) {
    const trimmed = name.trim()
    if (!trimmed) return
    const maxPos = Object.values(groupsMeta).reduce((m, v) => Math.max(m, v.position), -1) + 1
    saveMeta({ ...groupsMeta, [trimmed]: { type, position: maxPos } })
    setNewGroupType(null)
    setNewGroupName('')
  }

  function deleteGroup(groupName: string) {
    const next = { ...groupsMeta }
    delete next[groupName]
    saveMeta(next)
  }

  // ---------- Guest moves ----------
  async function moveGuest(guestId: string, newGroup: string) {
    const group_name = newGroup || null
    const { data } = await supabase.from('guests')
      .update({ group_name }).eq('id', guestId).select().single()
    if (data) setGuests(guests.map((g) => (g.id === data.id ? data : g)))
    setMovingGuest(null)
  }

  async function quickAdd(groupName: string) {
    if (!weddingId || !quickAddForm.first_name.trim() || !quickAddForm.last_name.trim()) return
    const { data } = await supabase.from('guests').insert({
      wedding_id: weddingId,
      first_name: quickAddForm.first_name.trim(),
      last_name: quickAddForm.last_name.trim(),
      group_name: groupName,
      rsvp_status: 'pending',
      menu_choice: 'Pas de restriction',
      children: [],
      plus_one: false,
      email: null, phone: null, table_number: null, plus_one_name: null, notes: null,
    }).select().single()
    if (data) setGuests([...guests, data])
    setQuickAddGroup(null)
    setQuickAddForm({ first_name: '', last_name: '' })
  }

  // ---------- Import ----------
  async function importGuests(e: React.FormEvent) {
    e.preventDefault()
    setImportError('')
    if (!weddingId) return
    const toInsert: object[] = []
    const errors: string[] = []

    if (importCsvRows) {
      // CSV export format: Groupe;Nom;Prénom;Téléphone;RSVP;Table;Restrictions;Plus one
      const RSVP_REVERSE: Record<string, string> = { 'Confirmé': 'confirmed', 'Décliné': 'declined', 'En attente': 'pending' }
      for (const cols of importCsvRows) {
        const last_name = cols[1]?.trim()
        const first_name = cols[2]?.trim()
        if (!last_name || !first_name) continue
        toInsert.push({
          wedding_id: weddingId,
          group_name: cols[0]?.trim() || null,
          last_name,
          first_name,
          phone: cols[3]?.trim() || null,
          rsvp_status: RSVP_REVERSE[cols[4]?.trim()] ?? 'pending',
          table_number: cols[5]?.trim() ? parseInt(cols[5]) : null,
          menu_choice: cols[6]?.trim() || 'Pas de restriction',
          children: cols[7]?.trim() ? cols[7].trim().split('|').map((s) => s.trim()).filter(Boolean) : [],
          plus_one: !!cols[7]?.trim() && cols[7].trim() !== 'Non',
          plus_one_name: cols[7]?.trim().split('|')[0]?.trim() || null,
          email: null, notes: null,
        })
      }
    } else {
      for (const line of importText.split('\n').map((l) => l.trim()).filter(Boolean)) {
        for (const person of line.split(',').map((p) => p.trim()).filter(Boolean)) {
          const parts = person.split(/\s+/)
          if (parts.length < 2) { errors.push(`Format invalide : "${person}"`); continue }
          toInsert.push({
            wedding_id: weddingId,
            first_name: parts[0],
            last_name: parts.slice(1).join(' '),
            rsvp_status: 'pending',
            menu_choice: 'Pas de restriction',
            group_name: importGroup || null,
            children: [],
            plus_one: false,
            email: null, phone: null, table_number: null, plus_one_name: null, notes: null,
          })
        }
      }
    }

    if (errors.length && !toInsert.length) { setImportError(errors.join('\n')); return }
    const { data } = await supabase.from('guests').insert(toInsert).select()
    if (data) {
      setGuests([...guests, ...data])
      setShowImport(false)
      setImportText(''); setImportGroup(''); setImportError(''); setImportCsvRows(null)
    }
  }

  // ---------- Misc ----------
  function openEdit(guest: Guest) {
    setEditGuest(guest)
    setForm({
      first_name: guest.first_name,
      last_name: guest.last_name,
      email: guest.email ?? '',
      phone: guest.phone ?? '',
      rsvp_status: guest.rsvp_status,
      table_number: guest.table_number?.toString() ?? '',
      menu_choice: guest.menu_choice ?? 'Pas de restriction',
      children: guest.children ?? [],
      group_name: guest.group_name ?? '',
      notes: guest.notes ?? '',
    })
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditGuest(null); setForm(EMPTY_FORM) }

  function toggleGroup(name: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  function exportCsv() {
    const headers = ['Groupe', 'Nom', 'Prénom', 'Téléphone', 'RSVP', 'Table', 'Restrictions', 'Enfants']
    const rows = guests.map((g) => [
      g.group_name ?? '', g.last_name, g.first_name, g.phone ?? '',
      RSVP_LABELS[g.rsvp_status], g.table_number ?? '',
      g.menu_choice ?? 'Pas de restriction',
      (g.children ?? []).join('|'),
    ])
    const csv = '\uFEFF' + [headers, ...rows].map((r) => r.join(';')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = 'invites.csv'; a.click()
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = (ev.target?.result as string ?? '').replace(/^\uFEFF/, '')
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
      if (!lines.length) return
      // Detect export format: header starts with "Groupe;Nom;Prénom"
      const isExportFormat = lines[0].startsWith('Groupe;Nom;') || lines[0].startsWith('Groupe;')
      if (isExportFormat) {
        setImportCsvRows(lines.slice(1).map((l) => l.split(';')))
        setImportText('')
      } else {
        setImportText(text)
        setImportCsvRows(null)
      }
    }
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }

  // ---------- Computed ----------
  const allGroupNames = useMemo(() => {
    const fromGuests = new Set(guests.map((g) => g.group_name).filter(Boolean) as string[])
    return [...new Set([...fromGuests, ...Object.keys(groupsMeta)])]
  }, [guests, groupsMeta])

  const sortedByPosition = useMemo(
    () => [...allGroupNames].sort((a, b) =>
      (groupsMeta[a]?.position ?? 999) - (groupsMeta[b]?.position ?? 999)),
    [allGroupNames, groupsMeta],
  )

  const familleGroups = sortedByPosition.filter((n) => (groupsMeta[n]?.type ?? 'famille') === 'famille')
  const amisGroups = sortedByPosition.filter((n) => (groupsMeta[n]?.type ?? 'famille') === 'amis')

  const filtered = guests.filter((g) => {
    const q = search.toLowerCase()
    const match = `${g.first_name} ${g.last_name}`.toLowerCase().includes(q)
      || (g.email ?? '').toLowerCase().includes(q)
      || (g.group_name ?? '').toLowerCase().includes(q)
    return match && (filterRsvp === 'all' || g.rsvp_status === filterRsvp)
  })

  const guestsInGroup = (name: string) => filtered.filter((g) => g.group_name === name)
  const realGuestsInGroup = (name: string) => guests.filter((g) => g.group_name === name)
  // All known groups (includes empty ones from meta) for move-to dropdowns
  const allGroups = sortedByPosition

  const counts = {
    total: guests.length,
    confirmed: guests.filter((g) => g.rsvp_status === 'confirmed').length,
    pending: guests.filter((g) => g.rsvp_status === 'pending').length,
    declined: guests.filter((g) => g.rsvp_status === 'declined').length,
  }

  // ---------- Group block renderer ----------
  function GroupBlock({ groupName, siblings }: { groupName: string; siblings: string[] }) {
    const list = guestsInGroup(groupName)
    const realCount = realGuestsInGroup(groupName).length
    const isCollapsed = collapsedGroups.has(groupName)
    const idx = siblings.indexOf(groupName)
    const confirmedCnt = list.filter((g) => g.rsvp_status === 'confirmed').length

    return (
      <div className="card overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-1 px-3 py-2.5 bg-gray-50 border-b border-gray-100">
          {/* Up/down */}
          <div className="flex flex-col shrink-0 mr-0.5">
            <button
              onClick={() => moveGroupOrder(groupName, 'up', siblings)}
              disabled={idx === 0}
              className="p-0.5 text-gray-300 hover:text-gray-500 disabled:invisible"
            >
              <ArrowUp className="w-3 h-3" />
            </button>
            <button
              onClick={() => moveGroupOrder(groupName, 'down', siblings)}
              disabled={idx === siblings.length - 1}
              className="p-0.5 text-gray-300 hover:text-gray-500 disabled:invisible"
            >
              <ArrowDown className="w-3 h-3" />
            </button>
          </div>

          {/* Collapse */}
          <button onClick={() => toggleGroup(groupName)} className="shrink-0 mr-1">
            {isCollapsed
              ? <ChevronRight className="w-4 h-4 text-gray-400" />
              : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {/* Name + badges */}
          <button
            className="flex items-center gap-2 flex-1 min-w-0 text-left"
            onClick={() => toggleGroup(groupName)}
          >
            <span className="font-medium text-gray-700 text-sm truncate">{groupName}</span>
            <span className="badge bg-gray-200 text-gray-600 text-xs shrink-0">{list.length}</span>
            {confirmedCnt > 0 && (
              <span className="badge bg-green-100 text-green-700 text-xs shrink-0">{confirmedCnt} ✓</span>
            )}
          </button>

          {/* Actions */}
          <div className="flex items-center gap-0.5 ml-1 shrink-0">
            {/* Edit group modal */}
            <button
              onClick={() => setGroupEditModal({ name: groupName, newName: groupName, type: groupsMeta[groupName]?.type ?? 'famille' })}
              className="btn-ghost p-1 text-gray-400 hover:text-gray-600"
              title="Modifier le groupe"
            >
              <Pencil className="w-3 h-3" />
            </button>
            {/* Quick add */}
            <button
              onClick={() => setQuickAddGroup(quickAddGroup === groupName ? null : groupName)}
              className="btn-ghost p-1 text-gray-400 hover:text-rose-500"
              title="Ajouter dans ce groupe"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            {/* Delete (only when truly empty) */}
            {realCount === 0 && (
              <button
                onClick={() => deleteGroup(groupName)}
                className="btn-ghost p-1 text-red-300 hover:text-red-500"
                title="Supprimer le groupe vide"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Quick add row */}
        {quickAddGroup === groupName && (
          <div className="px-4 py-2 bg-rose-50 border-b border-rose-100 flex items-center gap-2">
            <input
              autoFocus
              className="input py-1 text-sm flex-1"
              placeholder="Prénom"
              value={quickAddForm.first_name}
              onChange={(e) => setQuickAddForm({ ...quickAddForm, first_name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && quickAdd(groupName)}
            />
            <input
              className="input py-1 text-sm flex-1"
              placeholder="Nom"
              value={quickAddForm.last_name}
              onChange={(e) => setQuickAddForm({ ...quickAddForm, last_name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && quickAdd(groupName)}
            />
            <button onClick={() => quickAdd(groupName)} className="btn-primary py-1 px-3 text-sm shrink-0">
              Ajouter
            </button>
            <button onClick={() => setQuickAddGroup(null)} className="btn-ghost p-1 text-gray-400 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Guests table */}
        {!isCollapsed && list.length > 0 && (
          <table className="w-full table-fixed">
            <tbody className="divide-y divide-gray-50">
              {list.map((guest) => {
                const { Icon: RsvpIcon, cls: rsvpCls } = RSVP_ICON[guest.rsvp_status]
                return (
                  <tr key={guest.id} className="hover:bg-gray-50/50">
                    {/* Name — takes all remaining width */}
                    <td className="px-3 py-2 w-full min-w-0">
                      <button className="text-left w-full min-w-0" onClick={() => openEdit(guest)}>
                        <p className="font-medium text-gray-800 hover:text-rose-600 text-xs truncate">
                          {guest.first_name} {guest.last_name}
                        </p>
                        {(guest.children ?? []).length > 0 && (
                          <p className="text-[10px] text-gray-400 truncate">
                            {(guest.children ?? []).join(', ')}
                          </p>
                        )}
                      </button>
                    </td>
                    {/* Phone — desktop only */}
                    <td className="py-2 text-xs text-gray-400 hidden lg:table-cell w-28 truncate">
                      {guest.phone ?? '—'}
                    </td>
                    {/* Restrictions — desktop only */}
                    <td className="py-2 text-xs text-gray-400 hidden md:table-cell w-32 truncate">
                      {guest.menu_choice ?? 'Pas de restriction'}
                    </td>
                    {/* RSVP icon — cycles on click */}
                    <td className="py-2 w-8 text-center">
                      <button
                        onClick={() => updateRsvp(guest.id, RSVP_CYCLE[guest.rsvp_status])}
                        title={RSVP_LABELS[guest.rsvp_status]}
                        className={`btn-ghost p-1 ${rsvpCls}`}
                      >
                        <RsvpIcon className="w-3.5 h-3.5" />
                      </button>
                    </td>
                    {/* Move to group */}
                    <td className="py-2 w-8 text-center">
                      {movingGuest === guest.id ? (
                        <select
                          autoFocus
                          className="input py-0.5 text-xs absolute z-10"
                          defaultValue={guest.group_name ?? ''}
                          onChange={(e) => moveGuest(guest.id, e.target.value)}
                          onBlur={() => setMovingGuest(null)}
                        >
                          <option value="">— Sans groupe —</option>
                          {allGroups.map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      ) : (
                        <button
                          onClick={() => setMovingGuest(guest.id)}
                          title="Changer de groupe"
                          className="btn-ghost p-1 text-gray-400 hover:text-blue-500"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                    {/* Delete */}
                    <td className="py-2 pr-2 w-8 text-center">
                      <button
                        onClick={() => deleteGuest(guest.id)}
                        className="btn-ghost p-1 text-red-400 hover:text-red-600 hover:bg-red-50"
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
        {!isCollapsed && list.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4 italic">Groupe vide</p>
        )}
      </div>
    )
  }

  // ---------- Section renderer ----------
  function Section({ title, emoji, groups, type }: {
    title: string; emoji: string; groups: string[]; type: GroupType
  }) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <span>{emoji}</span> {title}
            <span className="badge bg-gray-100 text-gray-500 normal-case tracking-normal font-normal">
              {groups.length}
            </span>
          </h3>
          <button
            onClick={() => { setNewGroupType(type); setNewGroupName('') }}
            className={`btn-ghost text-xs gap-1 ${type === 'famille' ? 'text-rose-500' : 'text-blue-500'}`}
          >
            <Plus className="w-3.5 h-3.5" />
            {type === 'famille' ? 'Nouvelle famille' : 'Nouveau groupe'}
          </button>
        </div>
        {groups.length === 0 ? (
          <p className="text-sm text-gray-400 italic pl-1">Aucun groupe</p>
        ) : (
          <div className="space-y-3">
            {groups.map((name) => (
              <GroupBlock key={name} groupName={name} siblings={groups} />
            ))}
          </div>
        )}
      </div>
    )
  }

  const ungrouped = filtered.filter((g) => !g.group_name)

  // ---------- JSX ----------
  return (
    <div className="max-w-5xl mx-auto space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-xl md:text-2xl text-gray-800">Invités</h2>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">
            {counts.total} invité(s) · {allGroupNames.length} groupe(s)
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-secondary text-xs hidden md:inline-flex" onClick={resetMenuChoices} title="Mettre tous les menus à Pas de restriction">
            Tout "Pas de restriction"
          </button>
          <button className="btn-secondary text-xs md:text-sm" onClick={exportCsv}>
            <Download className="w-3.5 h-3.5 md:w-4 md:h-4" /> <span className="hidden sm:inline">Export</span>
          </button>
          <button className="btn-secondary text-xs md:text-sm" onClick={() => setShowImport(true)}>
            <Upload className="w-3.5 h-3.5 md:w-4 md:h-4" /> <span className="hidden sm:inline">Importer</span>
          </button>
          <button className="btn-primary text-xs md:text-sm" onClick={() => setShowForm(true)}>
            <UserPlus className="w-3.5 h-3.5 md:w-4 md:h-4" /> Ajouter
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {(['all', 'confirmed', 'pending', 'declined'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterRsvp(s)}
            className={`card p-3 text-center transition-all ${filterRsvp === s ? 'border-rose-300 bg-rose-50' : 'hover:border-gray-300'}`}
          >
            <p className="text-xl md:text-2xl font-bold text-gray-800">{s === 'all' ? counts.total : counts[s]}</p>
            <p className="text-[10px] md:text-xs text-gray-500 mt-0.5">{s === 'all' ? 'Total' : RSVP_LABELS[s]}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Rechercher un invité ou un groupe..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="card p-8 text-center text-gray-400">Chargement...</div>
      ) : allGroupNames.length === 0 && ungrouped.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>Aucun invité pour l'instant</p>
        </div>
      ) : (
        <div className="space-y-10">
          <Section title="Famille" emoji="👨‍👩‍👧" groups={familleGroups} type="famille" />
          <Section title="Amis" emoji="👥" groups={amisGroups} type="amis" />

          {ungrouped.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Sans groupe</h3>
              <div className="card overflow-hidden">
                <table className="w-full table-fixed">
                  <tbody className="divide-y divide-gray-50">
                    {ungrouped.map((guest) => {
                      const { Icon: RsvpIcon, cls: rsvpCls } = RSVP_ICON[guest.rsvp_status]
                      return (
                        <tr key={guest.id} className="hover:bg-gray-50/50">
                          <td className="px-3 py-2 w-full min-w-0">
                            <button className="text-left w-full min-w-0" onClick={() => openEdit(guest)}>
                              <p className="font-medium text-gray-800 text-xs truncate">
                                {guest.first_name} {guest.last_name}
                              </p>
                            </button>
                          </td>
                          <td className="py-2 w-8 text-center">
                            <button
                              onClick={() => updateRsvp(guest.id, RSVP_CYCLE[guest.rsvp_status])}
                              title={RSVP_LABELS[guest.rsvp_status]}
                              className={`btn-ghost p-1 ${rsvpCls}`}
                            >
                              <RsvpIcon className="w-3.5 h-3.5" />
                            </button>
                          </td>
                          <td className="py-2 w-8 text-center">
                            {movingGuest === guest.id ? (
                              <select
                                autoFocus
                                className="input py-0.5 text-xs absolute z-10"
                                defaultValue=""
                                onChange={(e) => moveGuest(guest.id, e.target.value)}
                                onBlur={() => setMovingGuest(null)}
                              >
                                <option value="">— Sans groupe —</option>
                                {allGroups.map((g) => <option key={g} value={g}>{g}</option>)}
                              </select>
                            ) : (
                              <button
                                onClick={() => setMovingGuest(guest.id)}
                                className="btn-ghost p-1 text-gray-400 hover:text-blue-500"
                                title="Assigner un groupe"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                          <td className="py-2 pr-2 w-8 text-center">
                            <button
                              onClick={() => deleteGuest(guest.id)}
                              className="btn-ghost p-1 text-red-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Group edit modal */}
      {groupEditModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm p-6 space-y-5">
            <h2 className="font-serif text-xl">Modifier le groupe</h2>

            {/* Rename */}
            <div>
              <label className="label">Nom du groupe</label>
              <input
                autoFocus
                className="input"
                value={groupEditModal.newName}
                onChange={(e) => setGroupEditModal({ ...groupEditModal, newName: e.target.value })}
              />
            </div>

            {/* Type toggle */}
            <div>
              <label className="label">Catégorie</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setGroupEditModal({ ...groupEditModal, type: 'famille' })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    groupEditModal.type === 'famille'
                      ? 'bg-rose-50 border-rose-300 text-rose-700'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  👨‍👩‍👧 Famille
                </button>
                <button
                  type="button"
                  onClick={() => setGroupEditModal({ ...groupEditModal, type: 'amis' })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    groupEditModal.type === 'amis'
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  👥 Amis
                </button>
              </div>
            </div>

            {/* Confirm all */}
            <button
              type="button"
              onClick={() => confirmAllGroup(groupEditModal.name)}
              className="w-full py-2 rounded-lg text-sm font-medium bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition-colors flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              Confirmer toute la présence du groupe
            </button>

            {/* Save / Cancel */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={saveGroupEdit}
                disabled={!groupEditModal.newName.trim()}
                className="btn-primary flex-1"
              >
                Enregistrer
              </button>
              <button
                type="button"
                onClick={() => setGroupEditModal(null)}
                className="btn-secondary"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New group modal */}
      {newGroupType && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm p-6">
            <h2 className="font-serif text-xl mb-4">
              {newGroupType === 'famille' ? 'Nouvelle famille' : "Nouveau groupe d'amis"}
            </h2>
            <form onSubmit={(e) => { e.preventDefault(); createGroup(newGroupName, newGroupType) }} className="space-y-4">
              <div>
                <label className="label">Nom du groupe</label>
                <input
                  autoFocus
                  className="input"
                  placeholder={newGroupType === 'famille' ? 'ex : Famille Martin' : 'ex : Amis du lycée'}
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary flex-1">Créer</button>
                <button type="button" className="btn-secondary" onClick={() => setNewGroupType(null)}>Annuler</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="font-serif text-xl mb-5">
              {editGuest ? "Modifier l'invité" : 'Ajouter un invité'}
            </h2>
            <form onSubmit={saveGuest} className="space-y-4">
              <div>
                <label className="label">Groupe / Famille</label>
                <input
                  className="input"
                  placeholder="ex : Famille Atchicanon"
                  value={form.group_name}
                  onChange={(e) => setForm({ ...form, group_name: e.target.value })}
                  list="groups-datalist"
                />
                <datalist id="groups-datalist">
                  {allGroups.map((g) => <option key={g} value={g} />)}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Prénom *</label>
                  <input className="input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Nom *</label>
                  <input className="input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="label">Téléphone</label>
                  <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">RSVP</label>
                  <select className="input" value={form.rsvp_status} onChange={(e) => setForm({ ...form, rsvp_status: e.target.value as RsvpStatus })}>
                    {(Object.keys(RSVP_LABELS) as RsvpStatus[]).map((s) => (
                      <option key={s} value={s}>{RSVP_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Table</label>
                  <input type="number" className="input" value={form.table_number} onChange={(e) => setForm({ ...form, table_number: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Restrictions alimentaires</label>
                <input
                  className="input"
                  placeholder="Pas de restriction"
                  value={form.menu_choice}
                  onChange={(e) => setForm({ ...form, menu_choice: e.target.value })}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Enfants</label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, children: [...form.children, ''] })}
                    className="btn-ghost text-xs text-rose-500 gap-1 py-0.5"
                  >
                    <Plus className="w-3 h-3" /> Ajouter
                  </button>
                </div>
                {form.children.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Aucun enfant</p>
                ) : (
                  <div className="space-y-1.5">
                    {form.children.map((child, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          className="input py-1 text-sm flex-1"
                          placeholder={`Prénom enfant ${idx + 1}`}
                          value={child}
                          onChange={(e) => {
                            const next = [...form.children]
                            next[idx] = e.target.value
                            setForm({ ...form, children: next })
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, children: form.children.filter((_, i) => i !== idx) })}
                          className="btn-ghost p-1 text-red-400 hover:text-red-600 shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">{editGuest ? 'Enregistrer' : 'Ajouter'}</button>
                <button type="button" className="btn-secondary" onClick={closeForm}>Annuler</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg p-6">
            <h2 className="font-serif text-xl mb-2">Importer des invités</h2>
            <p className="text-sm text-gray-500 mb-4">
              Importe un CSV exporté depuis l'appli, ou colle une liste texte.
            </p>
            <form onSubmit={importGuests} className="space-y-4">
              {/* File upload */}
              <div>
                <label className="label">Fichier CSV (UTF-8)</label>
                <label className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-300 rounded-lg px-4 py-3 hover:border-rose-300 hover:bg-rose-50/50 transition-colors">
                  <Upload className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-500">
                    {importCsvRows
                      ? <span className="text-green-600 font-medium">{importCsvRows.length} lignes chargées depuis le fichier</span>
                      : 'Choisir un fichier CSV…'}
                  </span>
                  <input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleImportFile} />
                </label>
              </div>

              {!importCsvRows && (
                <>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="flex-1 border-t" /> ou coller une liste texte <div className="flex-1 border-t" />
                  </div>
                  <div>
                    <label className="label">Groupe / Famille (optionnel)</label>
                    <input
                      className="input"
                      placeholder="ex : Famille Atchicanon"
                      value={importGroup}
                      onChange={(e) => setImportGroup(e.target.value)}
                      list="groups-import-datalist"
                    />
                    <datalist id="groups-import-datalist">
                      {allGroups.map((g) => <option key={g} value={g} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="label">Liste d'invités</label>
                    <textarea
                      className="input resize-none font-mono text-sm"
                      rows={6}
                      placeholder="Jean-Yves Atchicanon&#10;Guylene Atchicanon&#10;Monique Atchicanon, Laure Atchicanon"
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                    />
                  </div>
                </>
              )}

              {importError && (
                <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{importError}</p>
              )}
              <div className="flex gap-3">
                <button type="submit" className="btn-primary flex-1" disabled={!importCsvRows && !importText.trim()}>
                  <Upload className="w-4 h-4" /> Importer
                </button>
                <button type="button" className="btn-secondary" onClick={() => {
                  setShowImport(false); setImportText(''); setImportGroup(''); setImportError(''); setImportCsvRows(null)
                }}>
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
