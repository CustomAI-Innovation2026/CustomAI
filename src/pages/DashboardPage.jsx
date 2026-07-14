import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, FileText, CheckCircle2, XCircle, Clock, Zap,
  TrendingUp, BarChart3, ArrowRight, Loader2
} from 'lucide-react'
import { getDocuments } from '../lib/supabase.js'

function StatCard({ icon: Icon, label, value, color, subtext }) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-slate-400 text-sm">{label}</p>
        {subtext && <p className="text-slate-600 text-xs mt-0.5">{subtext}</p>}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDocuments(20)
      .then(setDocs)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const total = docs.length
  const completed = docs.filter(d => d.workflow_runs?.some(r => r.status === 'completed')).length
  const failed = docs.filter(d => d.workflow_runs?.some(r => r.status === 'failed')).length
  const pending = total - completed - failed
  const recent = docs.slice(0, 5)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
          <p className="text-slate-400">Overview of your OCR pipeline activity</p>
        </div>
        <button
          onClick={() => navigate('/app/upload')}
          className="btn-primary flex items-center gap-2"
        >
          <Upload size={16} /> New Scan
        </button>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 mb-8">
          <Loader2 size={16} className="animate-spin" />
          Loading stats…
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard icon={FileText}     label="Total Documents"  value={total}     color="bg-brand-500"    subtext="All time" />
          <StatCard icon={CheckCircle2} label="Completed"        value={completed} color="bg-green-500"    subtext={`${total ? Math.round(completed/total*100) : 0}% success rate`} />
          <StatCard icon={XCircle}      label="Failed"           value={failed}    color="bg-red-500"      subtext="Retryable" />
          <StatCard icon={Clock}        label="In Progress"      value={pending}   color="bg-amber-500"    subtext="Processing" />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-brand-400" />
              <h2 className="font-semibold text-white">Recent Documents</h2>
            </div>
            <button
              onClick={() => navigate('/app/history')}
              className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
            >
              View all <ArrowRight size={12} />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          ) : recent.length === 0 ? (
            <div className="text-center py-8">
              <FileText size={32} className="text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No documents yet</p>
              <button onClick={() => navigate('/app/upload')} className="btn-primary text-xs mt-3 py-1.5 px-4">
                Upload first invoice
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map(doc => {
                const run = doc.workflow_runs?.[doc.workflow_runs.length - 1]
                const status = run?.status || doc.status
                const isComplete = status === 'completed'

                return (
                  <div
                    key={doc.id}
                    onClick={() => isComplete && navigate(`/app/results/${doc.id}`)}
                    className={`flex items-center gap-3 p-3 rounded-xl border border-slate-800/60 transition-all ${
                      isComplete ? 'cursor-pointer hover:bg-slate-800/40 hover:border-slate-700' : 'opacity-70'
                    }`}
                  >
                    <FileText size={14} className="text-slate-500 flex-shrink-0" />
                    <span className="flex-1 text-sm text-slate-300 truncate">{doc.file_name}</span>
                    <span className={`text-xs font-medium ${
                      isComplete ? 'text-green-400' : status === 'failed' ? 'text-red-400' : 'text-yellow-400'
                    }`}>
                      {isComplete ? '✓' : status === 'failed' ? '✗' : '⋯'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <Zap size={16} className="text-brand-400" />
            <h2 className="font-semibold text-white">Quick Start</h2>
          </div>

          <div className="space-y-3">
            {[
              {
                title: 'Upload Invoice',
                desc: 'Extract all fields from an invoice or receipt',
                icon: Upload,
                color: 'bg-brand-500/30 text-brand-300',
                action: () => navigate('/app/upload'),
              },
              {
                title: 'View History',
                desc: 'Browse all previously processed documents',
                icon: FileText,
                color: 'bg-purple-500/30 text-purple-300',
                action: () => navigate('/app/history'),
              },
              {
                title: 'Pipeline Stats',
                desc: 'Monitor n8n workflow execution metrics',
                icon: TrendingUp,
                color: 'bg-green-500/30 text-green-300',
                action: () => window.open('https://n8n.scgjwd.com', '_blank'),
              },
            ].map(({ title, desc, icon: Icon, color, action }) => (
              <button
                key={title}
                onClick={action}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/50 border border-transparent hover:border-slate-700/50 transition-all text-left group"
              >
                <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{title}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
                <ArrowRight size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
