import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, CheckCircle2, Clock, XCircle, Loader2,
  Image, File, Search, ChevronRight, RefreshCw, Upload,
  GitCompare, Trash2, ScanLine
} from 'lucide-react'
import { getDocuments } from '../lib/supabase.js'
import { getMatchingHistory, deleteMatchingHistoryEntry, clearMatchingHistory } from '../lib/matchingHistory.js'

const STATUS_CONFIG = {
  completed:  { label: 'Completed', icon: CheckCircle2, color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20' },
  processing: { label: 'Processing', icon: Loader2,     color: 'text-brand-400', bg: 'bg-brand-500/10', border: 'border-brand-500/20' },
  failed:     { label: 'Failed',     icon: XCircle,     color: 'text-red-400',   bg: 'bg-red-500/10',   border: 'border-red-500/20' },
  uploaded:   { label: 'Uploaded',   icon: Clock,       color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  pending:    { label: 'Pending',    icon: Clock,       color: 'text-slate-400', bg: 'bg-slate-700/30', border: 'border-slate-600/30' },
}

const DOC_TYPE_LABELS = {
  bill_of_lading: 'BL',
  invoice: 'INV',
  packing_list: 'PL',
  form_d: 'FORM',
}

function FileTypeIcon({ type }) {
  if (type?.startsWith('image/')) return <Image size={18} className="text-blue-400" />
  if (type === 'application/pdf') return <FileText size={18} className="text-red-400" />
  return <File size={18} className="text-slate-400" />
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ScorePill({ score }) {
  const color = score >= 80 ? 'bg-green-500/20 text-green-700 border-green-500/40'
    : score >= 50 ? 'bg-amber-500/20 text-amber-700 border-amber-500/40'
    : 'bg-red-500/20 text-red-700 border-red-600/50'
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${color}`}>
      {score}%
    </span>
  )
}

// ── OCR History tab ────────────────────────────────────────────
function OcrHistoryTab({ search }) {
  const navigate = useNavigate()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      setLoading(true); setError(null)
      setDocuments(await getDocuments(50))
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const filtered = documents.filter(d =>
    d.file_name?.toLowerCase().includes(search.toLowerCase())
  )

  const getDocStatus = (doc) => {
    if (doc.workflow_runs?.length) {
      return doc.workflow_runs[doc.workflow_runs.length - 1].status || 'pending'
    }
    return doc.status || 'uploaded'
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={28} className="text-brand-400 animate-spin" />
    </div>
  )
  if (error) return <div className="text-center py-20 text-red-400">{error}</div>
  if (filtered.length === 0) return (
    <div className="text-center py-20">
      <ScanLine size={40} className="text-slate-700 mx-auto mb-4" />
      <p className="text-slate-400 font-medium mb-2">
        {search ? 'No matching documents' : 'No OCR scans yet'}
      </p>
      {!search && (
        <button onClick={() => navigate('/app/upload')} className="btn-primary text-sm mt-4">
          Upload your first document
        </button>
      )}
    </div>
  )

  return (
    <div className="space-y-2">
      {filtered.map(doc => {
        const status = getDocStatus(doc)
        const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending
        const StatusIcon = cfg.icon
        const isComplete = status === 'completed'
        const hasResults = doc.ocr_results?.length > 0 || isComplete

        return (
          <div
            key={doc.id}
            onClick={() => hasResults && navigate(`/app/results/${doc.id}`)}
            className={`flex items-center gap-4 p-4 rounded-2xl border bg-slate-900/60 transition-all duration-200 ${
              hasResults
                ? 'cursor-pointer hover:bg-slate-800/60 hover:border-slate-700 border-slate-800'
                : 'border-slate-800/60 opacity-70'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
              <FileTypeIcon type={doc.file_type} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white text-sm truncate">{doc.file_name}</p>
              <p className="text-slate-500 text-xs mt-0.5">
                {formatDate(doc.created_at)} · {formatBytes(doc.file_size)}
              </p>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color} ${cfg.border} flex-shrink-0`}>
              <StatusIcon size={12} className={status === 'processing' ? 'animate-spin' : ''} />
              {cfg.label}
            </div>
            {hasResults && <ChevronRight size={16} className="text-slate-600 flex-shrink-0" />}
          </div>
        )
      })}
    </div>
  )
}

// ── Matching History tab ───────────────────────────────────────
function MatchingHistoryTab({ search }) {
  const navigate = useNavigate()
  const [entries, setEntries] = useState([])

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getMatchingHistory().then(data => { setEntries(data); setLoading(false) })
  }, [])

  const filtered = entries.filter(e =>
    e.comboLabel?.toLowerCase().includes(search.toLowerCase()) ||
    Object.values(e.fileNames ?? {}).flat().some(n => n.toLowerCase().includes(search.toLowerCase()))
  )

  async function handleDelete(e, id) {
    e.stopPropagation()
    await deleteMatchingHistoryEntry(id)
    setEntries(prev => prev.filter(en => en.id !== id))
  }

  async function handleClearAll() {
    if (!confirm('Clear all matching history?')) return
    await clearMatchingHistory()
    setEntries([])
  }

  function viewEntry(entry) {
    navigate('/app/matching', {
      state: {
        historyEntry: {
          pairs: entry.pairs,
          selectedCombo: { label: entry.comboLabel, types: entry.comboTypes },
          fileNames: entry.fileNames,
        },
      },
    })
  }

  if (loading) return (
    <div className="text-center py-20">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-slate-400 text-sm">Loading history from cloud…</p>
    </div>
  )

  if (filtered.length === 0) return (
    <div className="text-center py-20">
      <GitCompare size={40} className="text-slate-700 mx-auto mb-4" />
      <p className="text-slate-400 font-medium mb-2">
        {search ? 'No matching results' : 'No matching history yet'}
      </p>
      {!search && (
        <button onClick={() => navigate('/app/matching')} className="btn-primary text-sm mt-4">
          Start a comparison
        </button>
      )}
    </div>
  )

  return (
    <div>
      {entries.length > 0 && !search && (
        <div className="flex justify-end mb-3">
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors"
          >
            <Trash2 size={12} /> Clear all
          </button>
        </div>
      )}
      <div className="space-y-2">
        {filtered.map(entry => {
          // Collect all file names across doc types
          const allFiles = Object.values(entry.fileNames ?? {}).flat()
          const typeLabels = (entry.comboTypes ?? []).map(t => DOC_TYPE_LABELS[t] || t).join(' vs ')

          return (
            <div
              key={entry.id}
              onClick={() => viewEntry(entry)}
              className="matching-row flex items-center gap-4 p-4 rounded-2xl border cursor-pointer
                bg-white/8 border-slate-700/60
                hover:bg-white/12 hover:border-slate-600/80
                transition-all duration-200 group"
            >
              {/* Icon — yellow wrap, dark icon */}
              <div className="matching-icon-wrap w-10 h-10 rounded-xl bg-slate-700/70 flex items-center justify-center flex-shrink-0">
                <GitCompare size={18} className="text-slate-600" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-white text-sm truncate">{entry.comboLabel}</p>
                  <span className="matching-badge text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-300 border border-slate-600/50 font-medium flex-shrink-0">
                    {typeLabels}
                  </span>
                </div>
                <p className="text-slate-500 text-xs truncate">
                  {formatDate(entry.timestamp)} · {allFiles.slice(0, 2).join(', ')}{allFiles.length > 2 ? ` +${allFiles.length - 2}` : ''}
                </p>
              </div>

              {/* Score badge */}
              <ScorePill score={entry.overallScore} />

              {/* Delete */}
              <button
                onClick={e => handleDelete(e, entry.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/15 text-slate-500 hover:text-red-400 transition-all flex-shrink-0"
              >
                <Trash2 size={13} />
              </button>

              <ChevronRight size={16} className="text-slate-500 flex-shrink-0" />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function HistoryPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('ocr')   // 'ocr' | 'matching'
  const [search, setSearch] = useState('')
  const [matchCount, setMatchCount] = useState(0)
  const [ocrCount,   setOcrCount]   = useState(0)

  useEffect(() => {
    getMatchingHistory().then(data => setMatchCount(data.length))
    getDocuments(500).then(data => setOcrCount(data.length))
  }, [])

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">History</h1>
          <p className="text-slate-400 text-sm">OCR scans and document comparisons</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/app/upload')}
            className="btn-secondary text-sm py-2 px-3 flex items-center gap-2"
          >
            <Upload size={14} /> New Scan
          </button>
          <button
            onClick={() => navigate('/app/matching')}
            className="btn-primary text-sm py-2 px-4 flex items-center gap-2"
          >
            <GitCompare size={14} /> New Compare
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 p-1 rounded-xl bg-slate-900 border border-slate-800 w-fit">
        <button
          onClick={() => setTab('ocr')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'ocr'
              ? 'bg-slate-700 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ScanLine size={14} />
          OCR Scans
          {ocrCount > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
              tab === 'ocr'
                ? 'bg-slate-300 text-slate-700'
                : 'bg-slate-700/60 text-slate-400'
            }`}>
              {ocrCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('matching')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'matching'
              ? 'bg-slate-700 text-slate-100 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <GitCompare size={14} />
          Matching
          {matchCount > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
              tab === 'matching'
                ? 'bg-slate-300 text-slate-700'
                : 'bg-slate-700/60 text-slate-400'
            }`}>
              {matchCount}
            </span>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder={tab === 'ocr' ? 'Search documents…' : 'Search comparisons…'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Tab content */}
      {tab === 'ocr'
        ? <OcrHistoryTab search={search} />
        : <MatchingHistoryTab search={search} />
      }
    </div>
  )
}
