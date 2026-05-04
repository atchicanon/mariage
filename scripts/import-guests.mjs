// Import guests from data/guests.csv into Supabase
// Usage: node scripts/import-guests.mjs [--dry-run]
//
// The CSV has columns:
//   N° ; Nom / Prénom ; Téléphone ; Bordeaux invité ; Bordeaux présence ; La Réunion invité ; La Réunion présence
//
// - group_name is derived from the family name (uppercase part)
// - plus_one is set when "+N" appears in the name
// - rsvp_status = "confirmed" if presence col is X, else "pending"
// - People invited to both weddings get one record per wedding

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
// Input:  "BILLAUD Jean-Yves"  →  { last_name: "BILLAUD", first_name: "Jean-Yves", plus_one: false }
// Input:  "BEN MCHAREK Yousra +1" → { last_name: "BEN MCHAREK", first_name: "Yousra", plus_one: true }
// Input:  "Shaynae"           → { last_name: "Shaynae", first_name: "", plus_one: false }
function parseName(raw) {
  // Strip trailing +N
  const plusMatch = raw.match(/\s*\+\d+\s*$/)
  const plus_one = !!plusMatch
  const cleaned = raw.replace(/\s*\+\d+\s*$/, '').trim()

  const words = cleaned.split(/\s+/)

  // Last name = leading words that are fully uppercase (letters + hyphens only, length > 1)
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

  // Some rows (Réunion-only) have an extra empty column, shifting REU cols right by 1
  const reuOffset = cols.length >= 8 ? 1 : 0
  const bdxInvite   = cols[3]?.trim().toUpperCase() === 'X'
  const bdxPresence = cols[4]?.trim().toUpperCase() === 'X'
  const reuInvite   = cols[5 + reuOffset]?.trim().toUpperCase() === 'X'
  const reuPresence = cols[6 + reuOffset]?.trim().toUpperCase() === 'X'

  if (!bdxInvite && !reuInvite) return null

  const { last_name, first_name, plus_one } = parseName(nameRaw)

  return {
    last_name,
    first_name,
    phone,
    plus_one,
    group_name: last_name,
    bdxInvite,
    bdxPresence,
    reuInvite,
    reuPresence,
  }
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

  // Match by name keywords (case-insensitive)
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
  const lines = readFileSync(csvPath, 'utf8').trim().split('\n').slice(1) // skip header

  const civilGuests    = []
  const religiousGuests = []
  const warnings = []

  for (const line of lines) {
    const row = parseRow(line)
    if (!row) continue

    if (!row.first_name) {
      warnings.push(`⚠  No first name parsed for: "${line.split(';')[1]}"`)
    }

    const base = {
      first_name: row.first_name || '?',
      last_name: row.last_name,
      phone: row.phone,
      email: null,
      plus_one: row.plus_one,
      plus_one_name: null,
      group_name: row.group_name,
      table_number: null,
      menu_choice: null,
      notes: null,
    }

    if (row.bdxInvite) {
      civilGuests.push({
        ...base,
        wedding_id: civil.id,
        rsvp_status: row.bdxPresence ? 'confirmed' : 'pending',
      })
    }

    if (row.reuInvite) {
      religiousGuests.push({
        ...base,
        wedding_id: religious.id,
        rsvp_status: row.reuPresence ? 'confirmed' : 'pending',
      })
    }
  }

  // Summary
  console.log(`\n── Import summary ──────────────────────────`)
  console.log(`  Civil (Bordeaux)   : ${civilGuests.length} guests`)
  console.log(`  Religious (Réunion): ${religiousGuests.length} guests`)
  if (warnings.length) {
    console.log(`\nWarnings:`)
    warnings.forEach((w) => console.log(' ', w))
  }

  // Family group breakdown
  const groups = new Map()
  for (const g of [...civilGuests, ...religiousGuests]) {
    groups.set(g.group_name, (groups.get(g.group_name) ?? 0) + 1)
  }
  console.log(`\nFamily groups detected (${groups.size}):`)
  for (const [name, count] of [...groups.entries()].sort()) {
    console.log(`  ${name.padEnd(25)} ${count}`)
  }

  if (DRY_RUN) {
    console.log('\n[dry-run] No data written.')
    return
  }

  console.log('\nInserting...')

  if (civilGuests.length) {
    const { error } = await supabase.from('guests').insert(civilGuests)
    if (error) console.error('Civil insert error:', error.message)
    else console.log(`✓ ${civilGuests.length} guests inserted → civil wedding`)
  }

  if (religiousGuests.length) {
    const { error } = await supabase.from('guests').insert(religiousGuests)
    if (error) console.error('Religious insert error:', error.message)
    else console.log(`✓ ${religiousGuests.length} guests inserted → religious wedding`)
  }

  console.log('\nDone.')
}

main().catch((err) => { console.error(err); process.exit(1) })
