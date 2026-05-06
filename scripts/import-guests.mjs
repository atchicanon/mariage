// Import guests from data/guests.csv into Supabase
// Usage: node scripts/import-guests.mjs [--dry-run]
//
// The CSV has columns:
//   N° ; Nom / Prénom ; Téléphone ; Bordeaux invité ; Bordeaux présence ; La Réunion invité ; La Réunion présence
//
// Architecture cible :
//   people        – données de la personne (partagées, dédupliquées)
//   wedding_guests – participation par mariage (RSVP, table, menu…)
//
// Les personnes invitées aux deux mariages ne donnent qu'une seule ligne
// dans people (données Bordeaux en priorité).

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN = process.argv.includes('--dry-run')

// ---------- .env loader ----------
function loadEnv() {
  const path = join(__dirname, '..', '.env')
  const env = {}
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const eq = line.indexOf('=')
      if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
    }
  } catch { /* ignore */ }
  return env
}

// ---------- Name parser ----------
function parseName(raw) {
  const plusMatch = raw.match(/\s*\+\d+\s*$/)
  const plus_one = !!plusMatch
  const cleaned = raw.replace(/\s*\+\d+\s*$/, '').trim()
  const words = cleaned.split(/\s+/)

  const lastNameWords = []
  let i = 0
  while (i < words.length) {
    const w = words[i]
    if (w.length > 1 && w === w.toUpperCase() && /^[A-ZÀÂÄÉÈÊËÎÏÔÙÛÜÇŒ\-]+$/.test(w)) {
      lastNameWords.push(w)
      i++
    } else {
      break
    }
  }

  const last_name = lastNameWords.length ? lastNameWords.join(' ') : words[0] ?? '?'
  const first_name = words.slice(lastNameWords.length || 1).join(' ')
  return { last_name, first_name: first_name || '', plus_one }
}

// ---------- CSV parser ----------
function parseRow(line) {
  const cols = line.split(';')
  if (cols.length < 6) return null

  const nameRaw = cols[1]?.trim()
  if (!nameRaw) return null

  const phone = cols[2]?.trim().replace(/\s+/g, '') || null

  const reuOffset = cols.length >= 8 ? 1 : 0
  const bdxInvite   = cols[3]?.trim().toUpperCase() === 'X'
  const bdxPresence = cols[4]?.trim().toUpperCase() === 'X'
  const reuInvite   = cols[5 + reuOffset]?.trim().toUpperCase() === 'X'
  const reuPresence = cols[6 + reuOffset]?.trim().toUpperCase() === 'X'

  if (!bdxInvite && !reuInvite) return null

  const { last_name, first_name, plus_one } = parseName(nameRaw)

  return { last_name, first_name, phone, plus_one, bdxInvite, bdxPresence, reuInvite, reuPresence }
}

// ---------- Main ----------
async function main() {
  const env = loadEnv()
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
    process.exit(1)
  }

  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

  // Fetch weddings
  const { data: weddings, error: wErr } = await supabase.from('weddings').select('id, type, name')
  if (wErr || !weddings?.length) {
    console.error('Could not fetch weddings:', wErr?.message ?? 'empty list')
    process.exit(1)
  }

  console.log('Weddings found:')
  weddings.forEach((w) => console.log(`  [${w.type}] ${w.name}  →  ${w.id}`))

  const civil    = weddings.find((w) => /bordeaux|civil/i.test(w.name))
  const religious = weddings.find((w) => /réunion|reunion|religieux/i.test(w.name))
  if (!civil) {
    console.error('Cannot find civil/Bordeaux wedding. Wedding names:', weddings.map(w => w.name).join(', '))
    process.exit(1)
  }
  if (!religious) {
    console.error('Cannot find Réunion/religious wedding. Wedding names:', weddings.map(w => w.name).join(', '))
    process.exit(1)
  }

  // Parse CSV
  const csvPath = join(__dirname, '..', 'data', 'guests.csv')
  const lines = readFileSync(csvPath, 'utf8').trim().split('\n').slice(1)

  // Map: key = "LAST_NAME|first_name" → person data + which weddings
  const peopleMap = new Map()
  const warnings = []

  for (const line of lines) {
    const row = parseRow(line)
    if (!row) continue
    if (!row.first_name) warnings.push(`⚠  No first name parsed for: "${line.split(';')[1]}"`)

    const key = `${row.last_name.toLowerCase()}|${row.first_name.toLowerCase()}`

    if (!peopleMap.has(key)) {
      peopleMap.set(key, {
        // Person data – Bordeaux is processed first so its phone takes priority when present
        last_name: row.last_name,
        first_name: row.first_name || '?',
        phone: row.phone,
        group_name: row.last_name,
        children: [],
        email: null,
        notes: null,
        // Per-wedding participation
        weddings: [],
      })
    } else if (row.phone && !peopleMap.get(key).phone) {
      // Bordeaux phone fills in if missing
      peopleMap.get(key).phone = row.phone
    }

    const person = peopleMap.get(key)
    if (row.bdxInvite) {
      person.weddings.push({
        wedding_id: civil.id,
        rsvp_status: row.bdxPresence ? 'confirmed' : 'pending',
        plus_one: row.plus_one,
      })
    }
    if (row.reuInvite) {
      person.weddings.push({
        wedding_id: religious.id,
        rsvp_status: row.reuPresence ? 'confirmed' : 'pending',
        plus_one: row.plus_one,
      })
    }
  }

  const uniquePeople = [...peopleMap.values()]
  const totalWeddingGuests = uniquePeople.reduce((s, p) => s + p.weddings.length, 0)

  console.log(`\n── Import summary ──────────────────────────`)
  console.log(`  Personnes uniques  : ${uniquePeople.length}`)
  console.log(`  Lignes wedding_guests : ${totalWeddingGuests}`)
  if (warnings.length) {
    console.log(`\nWarnings:`)
    warnings.forEach((w) => console.log(' ', w))
  }

  // Group breakdown
  const groups = new Map()
  for (const p of uniquePeople) {
    groups.set(p.group_name, (groups.get(p.group_name) ?? 0) + 1)
  }
  console.log(`\nFamily groups detected (${groups.size}):`)
  for (const [name, count] of [...groups.entries()].sort()) {
    console.log(`  ${name.padEnd(25)} ${count}`)
  }

  if (DRY_RUN) {
    console.log('\n[dry-run] No data written.')
    return
  }

  console.log('\nInserting people...')
  const personRecords = uniquePeople.map(({ last_name, first_name, phone, group_name, children, email, notes }) => ({
    last_name, first_name, phone, group_name, children, email, notes,
  }))

  const { data: insertedPeople, error: peopleErr } = await supabase
    .from('people')
    .insert(personRecords)
    .select('id')
  if (peopleErr) {
    console.error('People insert error:', peopleErr.message)
    process.exit(1)
  }
  console.log(`✓ ${insertedPeople.length} people inserted`)

  // Build wedding_guests rows
  const wgRows = []
  for (let i = 0; i < uniquePeople.length; i++) {
    const person = uniquePeople[i]
    const personId = insertedPeople[i].id
    for (const w of person.weddings) {
      wgRows.push({
        wedding_id: w.wedding_id,
        person_id: personId,
        rsvp_status: w.rsvp_status,
        plus_one: w.plus_one,
        plus_one_name: null,
        table_number: null,
        menu_choice: null,
      })
    }
  }

  console.log('Inserting wedding_guests...')
  const { error: wgErr } = await supabase.from('wedding_guests').insert(wgRows)
  if (wgErr) {
    console.error('wedding_guests insert error:', wgErr.message)
    process.exit(1)
  }
  console.log(`✓ ${wgRows.length} wedding_guest rows inserted`)

  console.log('\nDone.')
}

main().catch((err) => { console.error(err); process.exit(1) })
