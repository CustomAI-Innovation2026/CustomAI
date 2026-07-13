const STORAGE_KEY = 'docscan_matching_history'
const MAX_ENTRIES = 50

export function saveMatchingHistory({ comboLabel, comboTypes, fileNames, overallScore, pairs }) {
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    comboLabel,
    comboTypes,
    fileNames,   // { [docType]: string[] }
    overallScore,
    pairs,       // full pairs array from n8n
  }
  try {
    const existing = getMatchingHistory()
    const next = [entry, ...existing].slice(0, MAX_ENTRIES)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // storage full — drop oldest half and retry
    try {
      const existing = getMatchingHistory()
      const half = [entry, ...existing.slice(0, Math.floor(MAX_ENTRIES / 2))]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(half))
    } catch { /* ignore */ }
  }
  return entry
}

export function getMatchingHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export function deleteMatchingHistoryEntry(id) {
  const entries = getMatchingHistory().filter(e => e.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export function clearMatchingHistory() {
  localStorage.removeItem(STORAGE_KEY)
}
