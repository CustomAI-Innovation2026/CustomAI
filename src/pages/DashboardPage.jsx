import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, FileText, CheckCircle2, XCircle, GitCompare,
  ArrowRight, Loader2, TrendingUp, Users, ChevronDown, History, Activity
} from 'lucide-react'
import { getDocuments, getDocumentsAdmin, getN8nExecutions } from '../lib/supabase.js'
import { getMatchingHistory, getMatchingHistoryAdmin } from '../lib/matchingHistory.js'
import { getCurrentUser, getAppUsers } from '../lib/auth.js'

// ── helpers ────────────────────────────────────────────────────
const DOC_TYPE_MAP = { bill_of_lading: 'BL', invoice: 'INV', packing_list: 'PL', form_d: 'Form' }
// SCGJWD CI colors: soft blue + intense orange
const SCGJWD_BLUE   = '#2e7dd4'
const SCGJWD_ORANGE = '#f47920'
const ADMIN_EMAIL   = 'witsawsi@scgjwd.com'

function isoDate(d) { return d.toISOString().slice(0, 10) }
function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate() }

// ── KPI Card ──────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, accent }) {
  const accentMap = {
    blue:   { bg: 'bg-blue-500/20',   border: 'border-blue-500/25',   text: 'text-blue-400',   icon: 'text-blue-300' },
    green:  { bg: 'bg-green-500/20',  border: 'border-green-500/25',  text: 'text-green-400',  icon: 'text-green-300' },
    red:    { bg: 'bg-red-500/20',    border: 'border-red-500/25',    text: 'text-red-400',    icon: 'text-red-300' },
    amber:  { bg: 'bg-amber-500/20',  border: 'border-amber-500/25',  text: 'text-amber-400',  icon: 'text-amber-300' },
    purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/25', text: 'text-purple-400', icon: 'text-purple-300' },
  }
  const c = accentMap[accent] || accentMap.blue
  return (
    <div className="card flex items-center gap-4 min-w-0 p-4">
      <div className={`w-12 h-12 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center flex-shrink-0`}>
        <Icon size={22} className={c.icon} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-2xl font-black ${c.text} leading-tight tabular-nums`}>{value}</p>
        <p className="text-slate-400 text-[11px] font-medium mt-0.5 leading-snug">{label}</p>
        {sub && <p className="text-slate-500 text-[10px] mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Heatmap ────────────────────────────────────────────────────
function HeatmapChart({ docs, matchHistory }) {
  const now = new Date()
  const year = now.getFullYear()
  const currentMonth = now.getMonth()
  const months = Array.from({ length: currentMonth + 1 }, (_, i) => i)
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

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
    if (!count) return 'rgba(46,125,212,0.07)'
    const i = count / maxCount
    if (i < 0.2)  return 'rgba(46,125,212,0.20)'
    if (i < 0.4)  return 'rgba(46,125,212,0.40)'
    if (i < 0.6)  return 'rgba(46,125,212,0.58)'
    if (i < 0.8)  return 'rgba(46,125,212,0.76)'
    return 'rgba(46,125,212,0.95)'
  }

  // Bigger cells
  const CELL = 20, GAP = 3, LABEL_W = 34, DAYS = 31

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: LABEL_W + (CELL + GAP) * DAYS }}>
        {/* Day labels */}
        <div className="flex" style={{ marginLeft: LABEL_W }}>
          {[1,5,10,15,20,25,30].map((d, i) => {
            const prevD = [0,1,5,10,15,20,25][i]
            const w = (d - prevD) * (CELL + GAP)
            return (
              <div key={d} style={{ width: w, fontSize: 9, color: '#64748b' }}>{d}</div>
            )
          })}
        </div>
        {/* Month rows */}
        {months.map(m => {
          const days = daysInMonth(year, m)
          return (
            <div key={m} className="flex items-center" style={{ marginBottom: GAP }}>
              <div style={{ width: LABEL_W, fontSize: 10, color: '#94a3b8', textAlign: 'right', paddingRight: 8, flexShrink: 0 }}>
                {MONTH_NAMES[m]}
              </div>
              {Array.from({ length: DAYS }, (_, i) => {
                const day = i + 1, valid = day <= days
                const cnt = valid ? (counts[`${m}-${day}`] || 0) : 0
                return (
                  <div key={i} title={valid ? `${MONTH_NAMES[m]} ${day}: ${cnt}` : ''}
                    style={{
                      width: CELL, height: CELL, marginRight: GAP, flexShrink: 0,
                      background: valid ? cellColor(cnt) : 'transparent',
                      borderRadius: 4,
                      border: valid ? '1px solid rgba(46,125,212,0.14)' : 'none',
                    }}
                  />
                )
              })}
            </div>
          )
        })}
        {/* Legend */}
        <div className="flex items-center gap-2 mt-3" style={{ marginLeft: LABEL_W }}>
          <span style={{ fontSize: 10, color: '#64748b' }}>Less</span>
          {[0.07,0.20,0.40,0.58,0.76,0.95].map((op, i) => (
            <div key={i} style={{ width: CELL, height: CELL, background: `rgba(46,125,212,${op})`, borderRadius: 4 }} />
          ))}
          <span style={{ fontSize: 10, color: '#64748b' }}>More</span>
        </div>
      </div>
    </div>
  )
}

// ── Donut Chart ────────────────────────────────────────────────
function DonutChart({ matchCount, mismatchCount }) {
  const total = matchCount + mismatchCount
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-500 text-sm">
        No comparison data yet
      </div>
    )
  }
  const matchPct    = Math.round(matchCount    / total * 1000) / 10
  const mismatchPct = Math.round(mismatchCount / total * 1000) / 10

  const R = 56, CX = 76, CY = 76, SW = 22
  function arc(pct, offset) {
    const circ = 2 * Math.PI * R
    return { strokeDasharray: `${pct / 100 * circ} ${circ}`, strokeDashoffset: -offset / 100 * circ }
  }
  const mA = arc(matchPct, 0)
  const xA = arc(mismatchPct, matchPct)

  return (
    <div className="flex items-center gap-5">
      <svg width={152} height={152} viewBox="0 0 152 152" style={{ flexShrink: 0 }}>
        {/* Track */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(100,130,180,0.10)" strokeWidth={SW} />
        {/* Match arc — SCGJWD blue */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={SCGJWD_BLUE} strokeWidth={SW}
          strokeDasharray={mA.strokeDasharray} strokeDashoffset={mA.strokeDashoffset}
          strokeLinecap="butt" transform={`rotate(-90 ${CX} ${CY})`} />
        {/* Mismatch arc — SCGJWD orange */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={SCGJWD_ORANGE} strokeWidth={SW}
          strokeDasharray={xA.strokeDasharray} strokeDashoffset={xA.strokeDashoffset}
          strokeLinecap="butt" transform={`rotate(-90 ${CX} ${CY})`} />
        {/* White circle bg so center text is always legible */}
        <circle cx={CX} cy={CY} r={R - SW / 2 - 2} fill="white" opacity="0.92" />
        <text x={CX} y={CY - 8} textAnchor="middle" fontSize={26} fontWeight="900" style={{ fill: '#0f172a' }}>{total}</text>
        <text x={CX} y={CY + 8}  textAnchor="middle" fontSize={10} style={{ fill: '#475569' }}>Total</text>
        <text x={CX} y={CY + 20} textAnchor="middle" fontSize={10} style={{ fill: '#475569' }}>Compare</text>
      </svg>
      <div className="space-y-3 flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <div className="w-3 h-3 rounded-sm mt-0.5 flex-shrink-0" style={{ background: SCGJWD_BLUE }} />
          <div>
            <p className="text-xs text-slate-400 font-medium leading-tight">Match (100%)</p>
            <p className="text-base font-black" style={{ color: SCGJWD_BLUE }}>
              {matchCount} <span className="text-xs font-normal text-slate-500">({matchPct}%)</span>
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-3 h-3 rounded-sm mt-0.5 flex-shrink-0" style={{ background: SCGJWD_ORANGE }} />
          <div>
            <p className="text-xs text-slate-400 font-medium leading-tight">Mismatch</p>
            <p className="text-base font-black" style={{ color: SCGJWD_ORANGE }}>
              {mismatchCount} <span className="text-xs font-normal text-slate-500">({mismatchPct}%)</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Analysis Bar Chart (by doc type, 2 series) ─────────────────
function DocTypeBarChart({ matchHistory }) {
  const DOC_TYPES = ['BL', 'INV', 'PL', 'Form']

  // Total Document Files per type (from matching history entries)
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

  // Total Document Pages — placeholder (not tracked yet per doc type)
  const pageCounts = { BL: 0, INV: 0, PL: 0, Form: 0 }

  const maxVal = Math.max(1, ...Object.values(fileCounts), ...Object.values(pageCounts))
  const BAR_H = 110
  const BAR_W = 18
  const GROUP_GAP = 28

  return (
    <div>
      {/* Chart */}
      <div className="flex items-end justify-around" style={{ height: BAR_H + 40 }}>
        {DOC_TYPES.map(type => {
          const fH = Math.round((fileCounts[type] || 0) / maxVal * BAR_H)
          const pH = Math.round((pageCounts[type] || 0) / maxVal * BAR_H)
          return (
            <div key={type} className="flex flex-col items-center gap-1">
              <div className="flex items-end gap-1" style={{ height: BAR_H + 20 }}>
                {/* Files bar */}
                <div className="flex flex-col items-center">
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginBottom: 2 }}>
                    {fileCounts[type] || 0}
                  </span>
                  <div style={{ width: BAR_W, height: BAR_H, background: 'rgba(46,125,212,0.10)', borderRadius: '3px 3px 0 0', display: 'flex', flexDirection: 'column-reverse' }}>
                    <div style={{ height: fH, background: SCGJWD_BLUE, borderRadius: '3px 3px 0 0', transition: 'height 0.5s ease' }} />
                  </div>
                </div>
                {/* Pages bar */}
                <div className="flex flex-col items-center">
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginBottom: 2 }}>
                    {pageCounts[type] || 0}
                  </span>
                  <div style={{ width: BAR_W, height: BAR_H, background: 'rgba(244,121,32,0.10)', borderRadius: '3px 3px 0 0', display: 'flex', flexDirection: 'column-reverse' }}>
                    <div style={{ height: pH, background: SCGJWD_ORANGE, borderRadius: '3px 3px 0 0', transition: 'height 0.5s ease' }} />
                  </div>
                </div>
              </div>
              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{type}</span>
            </div>
          )
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: SCGJWD_BLUE }} />
          <span style={{ fontSize: 10, color: '#64748b' }}>Total Document Files</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: SCGJWD_ORANGE }} />
          <span style={{ fontSize: 10, color: '#64748b' }}>Total Document Pages</span>
        </div>
      </div>
    </div>
  )
}

// ── Pipeline Stats Modal (admin) ───────────────────────────────
const WORKFLOWS = [
  { id: 'qN5KDFqloUJjyS28', name: 'OCR Workflow',      icon: '🔍' },
  { id: 'KQE9Dcfka2IDDVqd', name: 'Matching Workflow', icon: '🔄' },
]

function PipelineStatsModal({ onClose }) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return isoDate(d)
  })
  const [endDate, setEndDate] = useState(isoDate(new Date()))
  const [activeWf, setActiveWf] = useState(WORKFLOWS[0].id)
  const [execs, setExecs] = useState([])
  const [loadingExecs, setLoadingExecs] = useState(false)

  useEffect(() => {
    setLoadingExecs(true)
    getN8nExecutions({ workflowId: activeWf, startDate, endDate })
      .then(setExecs)
      .finally(() => setLoadingExecs(false))
  }, [activeWf, startDate, endDate])

  const daysDiff   = Math.max(0, Math.round((new Date(endDate) - new Date(startDate)) / 86400000))
  const monthsDiff = Math.round(daysDiff / 30 * 10) / 10

  const succeed = execs.filter(e => e.status === 'success').length
  const errored = execs.filter(e => e.status === 'error').length
  const running = execs.filter(e => e.status === 'running').length

  const hasData = execs.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-2xl mx-4 relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg leading-none">✕</button>
        <div className="flex items-center gap-2 mb-1">
          <Activity size={18} className="text-green-400" />
          <h2 className="font-bold text-white text-lg">n8n Pipeline Stats</h2>
        </div>
        <p className="text-slate-400 text-sm mb-4">Monitor workflow execution metrics</p>

        {/* Workflow tabs */}
        <div className="flex gap-2 mb-4">
          {WORKFLOWS.map(wf => (
            <button key={wf.id} onClick={() => setActiveWf(wf.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeWf === wf.id
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : 'text-slate-400 hover:text-slate-200 border border-slate-700/50'
              }`}>
              {wf.icon} {wf.name}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
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
          <span className="text-slate-500 text-sm font-medium">{daysDiff} days / {monthsDiff} months</span>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            { label: '# Succeed', value: hasData ? succeed : '—', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
            { label: '# Error',   value: hasData ? errored : '—', color: 'text-red-400',   bg: 'bg-red-500/10',   border: 'border-red-500/20' },
            { label: '# Running', value: hasData ? running : '—', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
          ].map(({ label, value, color, bg, border }) => (
            <div key={label} className={`rounded-xl p-4 ${bg} border ${border} text-center`}>
              <p className={`text-3xl font-black ${color}`}>{loadingExecs ? '…' : value}</p>
              <p className="text-slate-400 text-xs mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Execution list */}
        {hasData ? (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {execs.slice(0, 20).map(ex => (
              <div key={ex.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/50 text-sm">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  ex.status === 'success' ? 'bg-green-400' :
                  ex.status === 'error'   ? 'bg-red-400' : 'bg-amber-400'}`} />
                <span className="text-slate-300 flex-1 truncate">
                  {ex.started_at ? new Date(ex.started_at).toLocaleString() : '—'}
                </span>
                <span className={`text-xs font-medium capitalize ${
                  ex.status === 'success' ? 'text-green-400' :
                  ex.status === 'error'   ? 'text-red-400' : 'text-amber-400'}`}>
                  {ex.status}
                </span>
                {ex.duration_ms != null && (
                  <span className="text-slate-500 text-xs">{(ex.duration_ms / 1000).toFixed(1)}s</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-700 p-5 text-center">
            <p className="text-slate-400 text-sm mb-1">No execution logs found</p>
            <p className="text-slate-500 text-xs">
              Configure n8n to save executions to Supabase <code className="text-green-400">n8n_executions</code> table via HTTP node at workflow end.
            </p>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <a href="https://n8n.scgjwd.com" target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:underline flex items-center gap-1">
            Open n8n Dashboard <ArrowRight size={11} />
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Quick Start Item ───────────────────────────────────────────
function QuickItem({ icon: Icon, iconBg, iconColor, title, desc, onClick, dashed }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left group
        ${dashed
          ? 'border border-dashed border-green-500/50 bg-green-500/5 hover:bg-green-500/10'
          : 'border border-transparent hover:border-slate-700/50 hover:bg-slate-800/50'}`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon size={16} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight text-white">{title}</p>
        <p className="text-xs mt-0.5 text-slate-500">{desc}</p>
      </div>
      <ArrowRight size={13} className="flex-shrink-0 text-slate-600 group-hover:text-slate-400" />
    </button>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────
export default function DashboardPage() {
  const navigate  = useNavigate()
  const user      = getCurrentUser()
  // Fallback: check email directly so admin works even if localStorage is stale
  const isAdmin   = user?.is_admin === true || user?.email === ADMIN_EMAIL

  const [startDate,    setStartDate]    = useState(() => `${new Date().getFullYear()}-01-01`)
  const [endDate,      setEndDate]      = useState(isoDate(new Date()))
  const [selectedUser, setSelectedUser] = useState('all')
  const [users,        setUsers]        = useState([])
  const [docs,         setDocs]         = useState([])
  const [matchHistory, setMatchHistory] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showPipeline, setShowPipeline] = useState(false)

  useEffect(() => {
    if (isAdmin) getAppUsers().then(setUsers).catch(() => {})
  }, [isAdmin])

  useEffect(() => {
    setLoading(true)
    const filterEmail = isAdmin
      ? (selectedUser === 'all' ? null : selectedUser)
      : (user?.email ?? null)
    Promise.all([
      isAdmin ? getDocumentsAdmin(filterEmail) : getDocuments(500),
      isAdmin ? getMatchingHistoryAdmin(filterEmail) : getMatchingHistory(),
    ])
      .then(([d, mh]) => { setDocs(d); setMatchHistory(mh) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [isAdmin, selectedUser])

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

  const totalFiles    = filteredDocs.length
  const totalMatching = filteredHistory.length
  const matchCount    = filteredHistory.filter(e => e.overallScore === 100).length
  const mismatchCount = totalMatching - matchCount
  const matchRate     = totalMatching ? (matchCount    / totalMatching * 100).toFixed(1) : '0.0'
  const mismatchRate  = totalMatching ? (mismatchCount / totalMatching * 100).toFixed(1) : '0.0'

  const daysDiff    = Math.round((end - start) / 86400000)
  const monthsDiff  = Math.round(daysDiff / 30 * 10) / 10
  const periodLabel = daysDiff > 0 ? `${daysDiff} Days / ${monthsDiff} Months` : 'Today'
  const recent5     = filteredDocs.slice(0, 5)

  return (
    <div className="p-6 space-y-4">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm">Overview of your OCR pipeline activity</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* User filter (admin only) */}
          {isAdmin && (
            <div className="relative">
              <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
                className="input-field py-1.5 pl-3 pr-8 text-sm appearance-none cursor-pointer">
                <option value="all">All Users</option>
                {users.map(u => (
                  <option key={u.email} value={u.email}>
                    {u.name} {u.surname} ({u.email})
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
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

      {/* ── KPI Cards ──────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 py-4">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard icon={FileText}     accent="blue"   value={totalFiles}    label="Total Document Files"           sub={periodLabel} />
          <KpiCard icon={FileText}     accent="purple" value="—"             label="Total Document Pages"           sub="Not tracked yet" />
          <KpiCard icon={GitCompare}   accent="amber"  value={totalMatching} label="Total Matching Compare (#Testing)" sub={periodLabel} />
          <KpiCard icon={CheckCircle2} accent="green"  value={matchCount}    label={`Match all fields · ${matchRate}%`} sub={periodLabel} />
          <KpiCard icon={XCircle}      accent="red"    value={mismatchCount} label={`Mismatch some fields · ${mismatchRate}%`} sub={periodLabel} />
        </div>
      )}

      {/* ── Middle row: Heatmap (2/3) + Charts stacked (1/3) ── */}
      {!loading && (
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Heatmap — col-span-2 */}
          <div className="card lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white text-sm">Document Matching Usage Overview</h2>
              <span className="text-slate-500 text-xs">{new Date().getFullYear()} YTD</span>
            </div>
            <HeatmapChart docs={docs} matchHistory={matchHistory} />
          </div>
          {/* Right column — donut + bar stacked */}
          <div className="flex flex-col gap-4">
            <div className="card flex-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Documents Summary</p>
              <DonutChart matchCount={matchCount} mismatchCount={mismatchCount} />
            </div>
            <div className="card flex-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Analysis by Doc Type</p>
              <DocTypeBarChart matchHistory={filteredHistory} />
            </div>
          </div>
        </div>
      )}

      {/* ── Recent Docs + Quick Start ───────────────────────── */}
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
                  const run   = doc.workflow_runs?.[doc.workflow_runs.length - 1]
                  const isDone = run?.status === 'completed' || doc.status === 'completed'
                  return (
                    <div key={doc.id} onClick={() => isDone && navigate(`/app/results/${doc.id}`)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border border-slate-800/60 transition-all
                        ${isDone ? 'cursor-pointer hover:bg-slate-800/40' : 'opacity-60'}`}>
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
              <span className="text-amber-400 text-base">⚡</span>
              <h2 className="font-semibold text-white text-sm">Quick Start</h2>
            </div>
            <div className="space-y-1.5">
              {/* 1. Upload OCR */}
              <QuickItem
                icon={Upload}
                iconBg="bg-blue-500/20"
                iconColor="text-blue-300"
                title="Upload OCR Document"
                desc="Extract all fields from an invoice or receipt"
                onClick={() => navigate('/app/upload')}
              />

              {/* 2. Upload Document Matching — amber/yellow style */}
              <QuickItem
                icon={GitCompare}
                iconBg="bg-amber-400/20"
                iconColor="text-amber-400"
                title="Upload Document Matching"
                desc="Compare data fields among 4 document types (BL, INV, PL, Form)"
                onClick={() => navigate('/app/matching')}
              />

              {/* 3. View History */}
              <QuickItem
                icon={History}
                iconBg="bg-purple-500/20"
                iconColor="text-purple-300"
                title="View History"
                desc="Browse all previously processed documents"
                onClick={() => navigate('/app/history')}
              />

              {/* 4. Pipeline Stats — admin only, green dashed */}
              {isAdmin && (
                <QuickItem
                  icon={Activity}
                  iconBg="bg-green-500/20"
                  iconColor="text-green-400"
                  title="Pipeline Stats"
                  desc="Monitor n8n workflow execution metrics"
                  onClick={() => setShowPipeline(true)}
                  dashed
                />
              )}

              {isAdmin && users.length > 0 && (
                <div className="flex items-center gap-2 px-3 pt-2 border-t border-slate-800/40">
                  <Users size={12} className="text-slate-500" />
                  <span className="text-slate-500 text-[11px]">Registered users: {users.length}</span>
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
