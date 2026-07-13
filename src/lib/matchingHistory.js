import { supabase } from './supabase.js'

const STORAGE_KEY = 'docscan_matching_history'
const MAX_ENTRIES = 50

// ── Supabase helpers ──────────────────────────────────────────
async function sbSave(entry) {
  const { error } = await supabase.from('matching_history').upsert({
    id:            entry.id,
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
  const { data, error } = await supabase
    .from('matching_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(MAX_ENTRIES)
  if (error || !data) return null
  return data.map(row => ({
    id:           row.id,
    timestamp:    row.created_at,
    comboLabel:   row.combo_label,
    comboTypes:   row.combo_types,
    fileNames:    row.file_names,
    overallScore: row.overall_score,
    pairs:        row.pairs,
  }))
}

async function sbDelete(id) {
  await supabase.from('matching_history').delete().eq('id', id)
}

async function sbClear() {
  await supabase.from('matching_history').delete().neq('id', '')
}

// ── localStorage helpers (fallback + migration source) ────────
function lsGet() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function lsSet(entries) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)) } catch {}
}

// ── One-time migration: push localStorage entries to Supabase ─
let _migrated = false
async function migrateIfNeeded() {
  if (_migrated) return
  _migrated = true
  const local = lsGet()
  if (!local.length) return
  // Check if Supabase already has entries
  const { count } = await supabase
    .from('matching_history')
    .select('*', { count: 'exact', head: true })
  if (count > 0) return // already migrated
  // Push all local entries
  const rows = local.map(e => ({
    id:            e.id,
    created_at:    e.timestamp,
    combo_label:   e.comboLabel,
    combo_types:   e.comboTypes  ?? [],
    file_names:    e.fileNames   ?? {},
    overall_score: e.overallScore ?? 0,
    pairs:         e.pairs        ?? [],
  }))
  await supabase.from('matching_history').upsert(rows)
}

// ── Public API ────────────────────────────────────────────────
export async function saveMatchingHistory({ comboLabel, comboTypes, fileNames, overallScore, pairs }) {
  const entry = {
    id:           Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp:    new Date().toISOString(),
    comboLabel,
    comboTypes,
    fileNames,
    overallScore,
    pairs,
  }
  // Save to Supabase (primary)
  const ok = await sbSave(entry)
  // Always keep localStorage in sync as offline cache
  const existing = lsGet()
  lsSet([entry, ...existing].slice(0, MAX_ENTRIES))
  return entry
}

export async function getMatchingHistory() {
  await migrateIfNeeded()
  const remote = await sbLoad()
  if (remote) return remote
  // Supabase unavailable — fall back to localStorage
  return lsGet()
}

export async function deleteMatchingHistoryEntry(id) {
  await sbDelete(id)
  lsSet(lsGet().filter(e => e.id !== id))
}

export async function clearMatchingHistory() {
  await sbClear()
  localStorage.removeItem(STORAGE_KEY)
}
