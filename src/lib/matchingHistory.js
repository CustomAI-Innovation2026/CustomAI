import { supabase } from './supabase.js'
import { getCurrentUser } from './auth.js'

const STORAGE_KEY = 'docscan_matching_history'
const MAX_ENTRIES = 50

function getUserEmail() {
  return getCurrentUser()?.email ?? null
}

// ── Supabase helpers ──────────────────────────────────────────
async function sbSave(entry) {
  const { error } = await supabase.from('matching_history').upsert({
    id:            entry.id,
    user_email:    entry.userEmail,
    created_at:    entry.timestamp,
    combo_label:   entry.comboLabel,
    combo_types:   entry.comboTypes,
    file_names:    entry.fileNames,
    overall_score: entry.overallScore,
    pairs:         entry.pairs,
  })
  return !error
}

async function sbLoad() {
  const email = getUserEmail()
  let query = supabase
    .from('matching_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(MAX_ENTRIES)

  // Filter by current user if logged in
  if (email) query = query.eq('user_email', email)

  const { data, error } = await query
  if (error || !data) return null
  return data.map(row => ({
    id:           row.id,
    userEmail:    row.user_email,
    timestamp:    row.created_at,
    comboLabel:   row.combo_label,
    comboTypes:   row.combo_types,
    fileNames:    row.file_names,
    overallScore: row.overall_score,
    pairs:        row.pairs,
  }))
}

async function sbDelete(id) {
  const email = getUserEmail()
  let q = supabase.from('matching_history').delete().eq('id', id)
  if (email) q = q.eq('user_email', email)
  await q
}

async function sbClear() {
  const email = getUserEmail()
  let q = supabase.from('matching_history').delete().neq('id', '')
  if (email) q = q.eq('user_email', email)
  await q
}

// ── localStorage helpers (offline fallback) ───────────────────
function lsKey() {
  const email = getUserEmail()
  return email ? `${STORAGE_KEY}_${email}` : STORAGE_KEY
}
function lsGet() {
  try { return JSON.parse(localStorage.getItem(lsKey()) || '[]') } catch { return [] }
}
function lsSet(entries) {
  try { localStorage.setItem(lsKey(), JSON.stringify(entries)) } catch {}
}

// ── Public API ────────────────────────────────────────────────
export async function saveMatchingHistory({ comboLabel, comboTypes, fileNames, overallScore, pairs }) {
  const email = getUserEmail()
  const entry = {
    id:           Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    userEmail:    email,
    timestamp:    new Date().toISOString(),
    comboLabel,
    comboTypes,
    fileNames,
    overallScore,
    pairs,
  }
  await sbSave(entry)
  const existing = lsGet()
  lsSet([entry, ...existing].slice(0, MAX_ENTRIES))
  return entry
}

export async function getMatchingHistory() {
  const remote = await sbLoad()
  if (remote) return remote
  return lsGet()
}

export async function deleteMatchingHistoryEntry(id) {
  await sbDelete(id)
  lsSet(lsGet().filter(e => e.id !== id))
}

export async function clearMatchingHistory() {
  await sbClear()
  localStorage.removeItem(lsKey())
}
