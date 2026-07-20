import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, CheckCircle2, XCircle, GitCompare, ArrowRight, Loader2, TrendingUp, Users, ChevronDown } from 'lucide-react'
import { getDocuments, getDocumentsAdmin } from '../lib/supabase.js'
import { getMatchingHistory, getMatchingHistoryAdmin } from '../lib/matchingHistory.js'
import { getCurrentUser, getAppUsers } from '../lib/auth.js'

// ── helpers ────────────────────────────────────────────────────
const DOC_TYPE_MAP = { bill_of_lading: 'BL', invoice: 'INV', packing_list: 'PL', form_d: 'Form' }
const DOC_TYPE_COLORS = { BL: '#3b82f6', INV: '#f59e0b', PL: '#10b981', Form: '#8b5cf6' }

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

// ── KPI Card ──────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, accent }) {
  const accentMap = {
    blue:   { bg: 'bg-blue-500/15',   text: 'text-blue-400',   icon: 'text-blue-300' },
    green:  { bg: 'bg-green-500/15',  text: 'text-green-400',  icon: 'text-green-300' },
    red:    { bg: 'bg-red-500/15',    text: 'text-red-400',    icon: 'text-red-300' },
    amber:  { bg: 'bg-amber-500/15',  text: 'text-amber-400',  icon: 'text-amber-300' },
    purple: { bg: 'bg-purple-500/15', text: 'text-purple-400', icon: 'text-purple-300' },
  }
  const c = accentMap[accent] || accentMap.blue
  const Icon = icon
  return (
    <div className="card flex items-start gap-3 min-w-0">
      <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={18} className={c.icon} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-xl font-bold ${c.text} leading-tight`}>{value}</p>
        <p className="text-slate-300 text-xs font-medium mt-0.5 leading-tight">{label}</p>
        {sub && <p className="text-slate-500 text-[11px] mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ── Heatmap ────────────────────────────────────────────────────
function HeatmapChart({ docs, matchHistory }) {
  const now = new Date()
  const year = now.getFullYear()
  const currentMonth = now.getMonth() // 0-indexed
  const months = Array.from({ length: currentMonth + 1 }, (_, i) => i)
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  // Count activities per day
  const counts = useMemo(() => {
    const c = {}
    docs.forEach(doc => {
      const d = new Date(doc.created_at)
      if (d.getFullYear() !== year) return
      const key = `${d.getMonth()}-${d.getDate()}`
      c[key] = (c[key] || 0) + 1
    })
    matchHistory.forEach(entry => {
      const d = new Date(entry.timestamp)
      if (d.getFullYear() !== year) return
      const key = `${d.getMonth()}-${d.getDate()}`
      c[key] = (c[key] || 0) + 1
    })
    return c
  }, [docs, matchHistory, year])

  const maxCount = Math.max(1, ...Object.values(counts))

  function cellColor(count) {
    if (!count) return 'rgba(100,130,180,0.07)'
    const intensity = count / maxCount
    if (intensity < 0.25) return 'rgba(59,130,246,0.25)'
    if (intensity < 0.5)  return 'rgba(59,130,246,0.50)'
    if (intensity < 0.75) return 'rgba(59,130,246,0.72)'
    return 'rgba(59,130,246,0.95)'
  }

  const CELL = 16
  const GAP = 2
  const LABEL_W = 36
  const DAYS = 31

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: LABEL_W + (CELL + GAP) * DAYS + 20 }}>
        {/* Day labels */}
        <div className="flex" style={{ marginLeft: LABEL_W }}>
          {[1,5,10,15,20,25,30].map(d => (
            <div key={d} style={{ width: (CELL + GAP) * (d === 1 ? 1 : d === 5 ? 4 : 5), fontSize: 9 }}
              className="text-slate-500 text-left">
              {d}
            </div>
          ))}
        </div>
        {/* Rows */}
        {months.map(m => {
          const days = daysInMonth(year, m)
          return (
            <div key={m} className="flex items-center" style={{ marginBottom: GAP }}>
              <div style={{ width: LABEL_W, fontSize: 10 }} className="text-slate-400 text-right pr-2 flex-shrink-0">
                {MONTH_NAMES[m]}
              </div>
              {Array.from({ length: DAYS }, (_, i) => {
                const day = i + 1
                const valid = day <= days
                const cnt = valid ? (counts[`${m}-${day}`] || 0) : 0
                return (
                  <div
                    key={i}
                    title={valid ? `${MONTH_NAMES[m]} ${day}: ${cnt} activity` : ''}
                    style={{
                      width: CELL, height: CELL, marginRight: GAP,
                      background: valid ? cellColor(cnt) : 'transparent',
                      borderRadius: 3,
                      border: valid ? '1px solid rgba(100,130,180,0.12)' : 'none',
                      flexShrink: 0,
                    }}
                  />
                )
              })}
            </div>
          )
        })}
        {/* Legend */}
        <div className="flex items-center gap-1.5 mt-3" style={{ marginLeft: LABEL_W }}>
          <span className="text-slate-500 text-[10px]">Less</span>
          {[0.07, 0.25, 0.50, 0.72, 0.95].map((op, i) => (
            <div key={i} style={{ width: CELL, height: CELL, background: `rgba(59,130,246,${op})`, borderRadius: 3 }} />
          ))}
          <span className="text-slate-500 text-[10px]">More</span>
        </div>
      </div>
    </div>
  )
}

// ── Donut Chart (SVG) ──────────────────────────────────────────
function DonutChart({ matchCount, mismatchCount }) {
  const total = matchCount + mismatchCount
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-slate-500 text-sm">
        No comparison data yet
      </div>
    )
  }
  const matchPct  = Math.round(matchCount  / total * 1000) / 10
  const mismatchPct = Math.round(mismatchCount / total * 1000) / 10

  const R = 52, CX = 70, CY = 70, stroke = 20
  function arc(pct, offset) {
    const circ = 2 * Math.PI * R
    return { strokeDasharray: `${pct / 100 * circ} ${circ}`, strokeDashoffset: -offset / 100 * circ }
  }
  const matchArc    = arc(matchPct,  0)
  const mismatchArc = arc(mismatchPct, matchPct)

  return (
    <div className="flex items-center gap-4">
      <svg width={140} height={140} viewBox="0 0 140 140">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(100,130,180,0.1)" strokeWidth={stroke} />
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#10b981" strokeWidth={stroke}
          strokeDasharray={matchArc.strokeDasharray} strokeDashoffset={matchArc.strokeDashoffset}
          strokeLinecap="butt" transform={`rotate(-90 ${CX} ${CY})`} />
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#ef4444" strokeWidth={stroke}
          strokeDasharray={mismatchArc.strokeDasharray} strokeDashoffset={mismatchArc.strokeDashoffset}
          strokeLinecap="butt" transform={`rotate(-90 ${CX} ${CY})`} />
        <text x={CX} y={CY - 6} textAnchor="middle" fill="#f0f6ff" fontSize={18} fontWeight="bold">{total}</text>
        <text x={CX} y={CY + 10} textAnchor="middle" fill="#7a9abf" fontSize={9}>Total</text>
        <text x={CX} y={CY + 21} textAnchor="middle" fill="#7a9abf" fontSize={9}>Compare</text>
      </svg>
      <div className="space-y-3 flex-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-green-500 flex-shrink-0" />
          <div>
            <p className="text-xs text-slate-400 font-medium">Match (100%)</p>
            <p className="text-sm font-bold text-green-400">{matchCount} <span className="text-xs font-normal text-slate-500">({matchPct}%)</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-red-500 flex-shrink-0" />
          <div>
            <p className="text-xs text-slate-400 font-medium">Mismatch</p>
            <p className="text-sm font-bold text-red-400">{mismatchCount} <span className="text-xs font-normal text-slate-500">({mismatchPct}%)</span></p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Stacked Bar Chart ──────────────────────────────────────────
function StackedBarChart({ docs, matchHistory }) {
  const DOC_TYPES = ['BL', 'INV', 'PL', 'Form']

  // Count from matching history (each entry contributes its comboTypes)
  const fileCounts = useMemo(() => {
    const c = { BL: 0, INV: 0, PL: 0, Form: 0 }
    matchHistory.forEach(entry => {
      ;(entry.comboTypes ?? []).forEach(t => {
        const label = DOC_TYPE_MAP[t]
        if (label) c[label] = (c[label] || 0) + 1
      })
    })
    return c
  }, [matchHistory])

  const maxVal = Math.max(1, ...Object.values(fileCounts))
  const BAR_H = 120

  return (
    <div>
      <div className="flex items-end gap-6 justify-around" style={{ height: BAR_H + 32 }}>
        {DOC_TYPES.map(type => {
          const fileH = Math.round((fileCounts[type] || 0) / maxVal * BAR_H)
          return (
            <div key={type} className="flex flex-col items-center gap-1" style={{ minWidth: 36 }}>
              <span className="text-xs text-slate-400 font-medium">{fileCounts[type] || 0}</span>
              <div className="flex flex-col-reverse rounded-sm overflow-hidden" style={{ width: 32, height: BAR_H, background: 'rgba(100,130,180,0.08)' }}>
                <div style={{ height: fileH, background: DOC_TYPE_COLORS[type], borderRadius: '2px 2px 0 0', transition: 'height 0.4s' }} />
              </div>
              <span className="text-[11px] text-slate-400">{type}</span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {DOC_TYPES.map(type => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: DOC_TYPE_COLORS[type] }} />
            <span className="text-[10px] text-slate-500">{type}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Pipeline Stats Modal (admin) ───────────────────────────────
function PipelineStatsModal({ onClose }) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return isoDate(d)
  })
  const [endDate, setEndDate] = useState(isoDate(new Date()))

  const daysDiff = Math.round((new Date(endDate) - new Date(startDate)) / 86400000)
  const monthsDiff = Math.round(daysDiff / 30 * 10) / 10

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-2xl mx-4 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl">✕</button>
        <h2 className="font-bold text-white text-lg mb-1">n8n Pipeline Stats</h2>
        <p className="text-slate-400 text-sm mb-5">Monitor workflow execution metrics</p>

        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">Start:</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="input-field py-1.5 px-3 text-sm w-auto" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">Finish:</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="input-field py-1.5 px-3 text-sm w-auto" />
          </div>
          <div className="text-slate-500 text-sm">
            {daysDiff >= 0 && <span>{daysDiff} days / {monthsDiff} months</span>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: '# Succeed', value: '—', color: 'text-green-400', bg: 'bg-green-500/10' },
            { label: '# Error',   value: '—', color: 'text-red-400',   bg: 'bg-red-500/10' },
            { label: '# Running', value: '—', color: 'text-amber-400', bg: 'bg-amber-500/10' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-xl p-4 ${bg} border border-white/5 text-center`}>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-slate-400 text-xs mt-1">{label}</p>
            </div>
          ))}
        </div>

        <p className="text-slate-500 text-xs text-center">
          Connect to n8n API to pull live execution metrics.{' '}
          <a href="https://n8n.scgjwd.com" target="_blank" rel="noopener noreferrer"
            className="text-blue-400 hover:underline">Open n8n Dashboard →</a>
        </p>
      </div>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate()
  const user = getCurrentUser()
  const isAdmin = user?.is_admin === true

  // Date range (default: Jan 1 of this year → today)
  const [startDate, setStartDate] = useState(() => `${new Date().getFullYear()}-01-01`)
  const [endDate, setEndDate] = useState(isoDate(new Date()))
  const [selectedUser, setSelectedUser] = useState('all')  // admin only
  const [users, setUsers] = useState([])
  const [docs, setDocs] = useState([])
  const [matchHistory, setMatchHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [showPipeline, setShowPipeline] = useState(false)

  // Load users list (admin)
  useEffect(() => {
    if (isAdmin) getAppUsers().then(setUsers).catch(() => {})
  }, [isAdmin])

  // Load data
  useEffect(() => {
    setLoading(true)
    const filterEmail = isAdmin ? (selectedUser === 'all' ? null : selectedUser) : (user?.email ?? null)
    Promise.all([
      isAdmin ? getDocumentsAdmin(filterEmail) : getDocuments(500),
      isAdmin ? getMatchingHistoryAdmin(filterEmail) : getMatchingHistory(),
    ])
      .then(([d, mh]) => { setDocs(d); setMatchHistory(mh) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [isAdmin, selectedUser])

  // Filter by date range
  const start = new Date(startDate + 'T00:00:00')
  const end   = new Date(endDate   + 'T23:59:59')

  const filteredDocs = useMemo(() =>
    docs.filter(d => { const t = new Date(d.created_at); return t >= start && t <= end }),
    [docs, startDate, endDate]
  )
  const filteredHistory = useMemo(() =>
    matchHistory.filter(e => { const t = new Date(e.timestamp); return t >= start && t <= end }),
    [matchHistory, startDate, endDate]
  )

  // KPIs
  const totalFiles    = filteredDocs.length
  const totalMatching = filteredHistory.length
  const matchCount    = filteredHistory.filter(e => e.overallScore === 100).length
  const mismatchCount = totalMatching - matchCount
  const matchRate     = totalMatching ? (matchCount / totalMatching * 100).toFixed(1) : '0.0'
  const mismatchRate  = totalMatching ? (mismatchCount / totalMatching * 100).toFixed(1) : '0.0'

  const daysDiff   = Math.round((end - start) / 86400000)
  const monthsDiff = Math.round(daysDiff / 30 * 10) / 10
  const periodLabel = daysDiff > 0 ? `${daysDiff} Days / ${monthsDiff} Months` : 'Today'

  const recent5 = filteredDocs.slice(0, 5)

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm">Overview of your OCR pipeline activity</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <div className="relative">
              <select
                value={selectedUser}
                onChange={e => setSelectedUser(e.target.value)}
                className="input-field py-1.5 px-3 text-sm pr-8 appearance-none cursor-pointer"
              >
                <option value="all">All Users</option>
                {users.map(u => (
                  <option key={u.email} value={u.email}>{u.name} {u.surname} ({u.email})</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-sm">Start:</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="input-field py-1.5 px-3 text-sm w-auto" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-sm">Finish:</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="input-field py-1.5 px-3 text-sm w-auto" />
          </div>
          <button onClick={() => navigate('/app/upload')} className="btn-primary flex items-center gap-2 py-2 px-4 text-sm">
            <Upload size={14} /> New Scan
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 py-4">
          <Loader2 size={16} className="animate-spin" /> Loading data…
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard icon={FileText}     label="Total Document Files"                  value={totalFiles}    accent="blue"   sub={periodLabel} />
          <KpiCard icon={FileText}     label="Total Document Pages"                  value="—"             accent="purple" sub="Not tracked yet" />
          <KpiCard icon={GitCompare}   label="Total Matching Compare (#Testing)"     value={totalMatching} accent="amber"  sub={periodLabel} />
          <KpiCard icon={CheckCircle2} label={`Match all fields matching rate ${matchRate}%`}    value={matchCount}    accent="green"  sub={periodLabel} />
          <KpiCard icon={XCircle}      label={`Mismatch some fields mismatching rate ${mismatchRate}%`} value={mismatchCount} accent="red"    sub={periodLabel} />
        </div>
      )}

      {/* Charts row */}
      {!loading && (
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Heatmap */}
          <div className="card lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white text-sm">Document Matching Usage Overview</h2>
              <span className="text-slate-500 text-xs">{new Date().getFullYear()} YTD</span>
            </div>
            <HeatmapChart docs={docs} matchHistory={matchHistory} />
          </div>

          {/* Right: Donut + Stacked */}
          <div className="space-y-4">
            <div className="card">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Documents Summary</p>
              <DonutChart matchCount={matchCount} mismatchCount={mismatchCount} />
            </div>

            <div className="card">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Analysis by Doc Type</p>
              <StackedBarChart docs={filteredDocs} matchHistory={filteredHistory} />
            </div>
          </div>
        </div>
      )}

      {/* Bottom row: Recent Docs + Quick Start */}
      {!loading && (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Recent Documents */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white text-sm">Recent Documents</h2>
              <button onClick={() => navigate('/app/history')}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                View all <ArrowRight size={11} />
              </button>
            </div>
            {recent5.length === 0 ? (
              <div className="text-center py-8">
                <FileText size={28} className="text-slate-700 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No documents in this period</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {recent5.map(doc => {
                  const run = doc.workflow_runs?.[doc.workflow_runs.length - 1]
                  const isDone = run?.status === 'completed' || doc.status === 'completed'
                  return (
                    <div key={doc.id} onClick={() => isDone && navigate(`/app/results/${doc.id}`)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border border-slate-800/60 transition-all ${isDone ? 'cursor-pointer hover:bg-slate-800/40' : 'opacity-60'}`}>
                      <FileText size={13} className="text-slate-500 flex-shrink-0" />
                      <span className="flex-1 text-sm text-slate-300 truncate">{doc.file_name}</span>
                      <span className={`text-xs font-bold ${isDone ? 'text-green-400' : 'text-slate-500'}`}>
                        {isDone ? '✓' : '⋯'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick Start */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-amber-400">⚡</span>
              <h2 className="font-semibold text-white text-sm">Quick Start</h2>
            </div>
            <div className="space-y-2">
              {/* Upload to OCR */}
              <button onClick={() => navigate('/app/upload')}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/50 border border-transparent hover:border-slate-700/50 transition-all text-left group">
                <div className="w-9 h-9 rounded-lg bg-blue-500/25 flex items-center justify-center flex-shrink-0">
                  <Upload size={16} className="text-blue-300" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Upload Invoice</p>
                  <p className="text-xs text-slate-500">Extract all fields from an invoice or receipt</p>
                </div>
                <ArrowRight size={13} className="text-slate-600 group-hover:text-slate-400" />
              </button>

              {/* Upload Document Matching — yellow accent */}
              <button onClick={() => navigate('/app/matching')}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-amber-500/40 bg-amber-500/8 hover:bg-amber-500/15 hover:border-amber-400/60 transition-all text-left group">
                <div className="w-9 h-9 rounded-lg bg-amber-400/25 flex items-center justify-center flex-shrink-0">
                  <GitCompare size={16} className="text-amber-300" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-200">Upload Document Matching</p>
                  <p className="text-xs text-amber-600/80">Compare data fields among 4 document types (BL, INV, PL, Form)</p>
                </div>
                <ArrowRight size={13} className="text-amber-600 group-hover:text-amber-400" />
              </button>

              {/* View History */}
              <button onClick={() => navigate('/app/history')}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/50 border border-transparent hover:border-slate-700/50 transition-all text-left group">
                <div className="w-9 h-9 rounded-lg bg-purple-500/25 flex items-center justify-center flex-shrink-0">
                  <FileText size={16} className="text-purple-300" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">View History</p>
                  <p className="text-xs text-slate-500">Browse all previously processed documents</p>
                </div>
                <ArrowRight size={13} className="text-slate-600 group-hover:text-slate-400" />
              </button>

              {/* Pipeline Stats — admin only */}
              {isAdmin && (
                <button onClick={() => setShowPipeline(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-red-500/50 bg-red-500/5 hover:bg-red-500/10 transition-all text-left group">
                  <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <TrendingUp size={16} className="text-red-300" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-200">Pipeline Stats</p>
                    <p className="text-xs text-red-500/80">Monitor n8n workflow execution metrics</p>
                  </div>
                  <ArrowRight size={13} className="text-red-600 group-hover:text-red-400" />
                </button>
              )}

              {/* Users (admin) */}
              {isAdmin && (
                <div className="mt-1 pt-2 border-t border-slate-800/60">
                  <div className="flex items-center gap-2 px-1">
                    <Users size={13} className="text-slate-500" />
                    <span className="text-slate-500 text-xs">Registered users: {users.length}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showPipeline && <PipelineStatsModal onClose={() => setShowPipeline(false)} />}
    </div>
  )
}
