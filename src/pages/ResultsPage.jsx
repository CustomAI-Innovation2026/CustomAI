import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CheckCircle2, Copy, Download, ArrowLeft, FileText,
  Building2, Calendar, DollarSign, Hash, Tag, Table2,
  Loader2, AlertCircle, ExternalLink, ChevronLeft, ChevronRight, Eye, EyeOff
} from 'lucide-react'
import { getOcrResult, supabase } from '../lib/supabase.js'

function FieldCard({ icon: Icon, label, value, color = 'text-brand-400' }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(String(value || ''))
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 group hover:border-slate-600 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={14} className={color} />
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
        </div>
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-slate-200 p-1 rounded"
        >
          <Copy size={12} />
        </button>
      </div>
      <p className="text-white font-semibold text-base truncate">
        {value != null && value !== '' ? String(value) : <span className="text-slate-500 font-normal italic">Not found</span>}
      </p>
      {copied && <p className="text-xs text-green-400 mt-1">Copied!</p>}
    </div>
  )
}

function LineItemsTable({ items = [] }) {
  if (!items?.length) return (
    <p className="text-slate-500 text-sm italic px-1">No line items extracted</p>
  )

  const columns = Object.keys(items[0] || {})

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700/60 bg-slate-800/60">
            {columns.map(col => (
              <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider first:pl-5">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
              {columns.map(col => (
                <td key={col} className="px-4 py-3 text-slate-300 first:pl-5">
                  {item[col] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ResultsPage() {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [document, setDocument] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('fields')
  const [selectedPage, setSelectedPage] = useState('all') // 'all' or a page index (0-based)
  const [showRawText, setShowRawText] = useState(false)

  useEffect(() => {
    loadResults()
  }, [documentId])

  async function loadResults() {
    try {
      setLoading(true)

      const [{ data: doc }, ocrResult] = await Promise.all([
        supabase.from('documents').select('*').eq('id', documentId).single(),
        getOcrResult(documentId),
      ])

      setDocument(doc)
      setResult(ocrResult)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(result?.extracted_data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ocr-${documentId?.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportCSV = () => {
    const data = result?.extracted_data
    if (!data) return
    const rows = [
      ['Field', 'Value'],
      ...Object.entries(data)
        .filter(([k]) => k !== 'line_items')
        .map(([k, v]) => [k, String(v ?? '')])
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ocr-${documentId?.slice(0, 8)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 size={32} className="text-brand-400 animate-spin mx-auto mb-3" />
          <p className="text-slate-400">Loading results…</p>
        </div>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="p-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-white mb-6">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-900/20 border border-red-500/30">
          <AlertCircle size={16} className="text-red-400 mt-0.5" />
          <div>
            <p className="text-red-300 font-medium">Results not found</p>
            <p className="text-slate-400 text-sm mt-1">{error || 'The extraction may still be processing.'}</p>
          </div>
        </div>
      </div>
    )
  }

  const mergedData = result.extracted_data || {}
  const pages = result.metadata?.pages || null
  const totalPages = result.metadata?.total_pages || pages?.length || 1
  const isMultiPage = totalPages > 1

  const currentPage = selectedPage !== 'all' && pages ? pages[selectedPage] : null
  const data = currentPage ? (currentPage.extracted_data || {}) : mergedData
  const currentRawText = currentPage ? currentPage.raw_text : (pages || []).map(p => `--- Page ${p.page} ---\n${p.raw_text || ''}`).join('\n\n')

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Back + Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/app/history')}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-4 transition-colors"
        >
          <ArrowLeft size={14} /> All documents
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/15 border border-green-500/20 flex items-center justify-center">
              <CheckCircle2 size={20} className="text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{document?.file_name || 'Document'}</h1>
              <p className="text-slate-400 text-sm">
                Extracted {Object.keys(data).length} fields ·{' '}
                Confidence: <span className="text-green-400 font-medium">{result.confidence_score ? `${Math.round(result.confidence_score * 100)}%` : 'N/A'}</span>
                {isMultiPage && <> · <span className="text-brand-400 font-medium">{totalPages} pages</span></>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {document?.public_url && (
              <a
                href={document.public_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-sm py-2 px-3 flex items-center gap-1.5"
              >
                <ExternalLink size={14} /> View File
              </a>
            )}
            <button onClick={handleExportCSV} className="btn-secondary text-sm py-2 px-3 flex items-center gap-1.5">
              <Download size={14} /> CSV
            </button>
            <button onClick={handleExportJSON} className="btn-secondary text-sm py-2 px-3 flex items-center gap-1.5">
              <Download size={14} /> JSON
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-900 rounded-xl p-1 border border-slate-800 w-fit">
        {['fields', 'line_items', ...(isMultiPage ? ['pages'] : []), 'raw'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
              activeTab === tab
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab === 'fields' ? 'Extracted Fields' : tab === 'line_items' ? 'Line Items' : tab === 'pages' ? `Pages (${totalPages})` : 'Raw JSON'}
          </button>
        ))}
      </div>

      {/* Shared page selector — applies to every tab above */}
      {isMultiPage && pages && (
        <div className="flex items-center gap-1.5 mb-6 flex-wrap">
          <span className="text-xs text-slate-500 mr-1">Viewing:</span>
          <button
            onClick={() => { setSelectedPage('all'); setShowRawText(false) }}
            className={`px-3 h-8 rounded-lg text-sm font-medium transition-colors ${
              selectedPage === 'all' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            All pages
          </button>
          <button
            onClick={() => setSelectedPage(i => i === 'all' ? 0 : Math.max(0, i - 1))}
            disabled={selectedPage === 'all'}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
          </button>
          {pages.map((p, i) => (
            <button
              key={p.page}
              onClick={() => { setSelectedPage(i); setShowRawText(false) }}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                selectedPage === i ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {p.page}
            </button>
          ))}
          <button
            onClick={() => setSelectedPage(i => i === 'all' ? pages.length - 1 : Math.min(pages.length - 1, i + 1))}
            disabled={selectedPage === pages.length - 1}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Tab content */}
      {activeTab === 'fields' && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in">
          <FieldCard icon={Building2}  label="Vendor"        value={data.vendor_name}     color="text-blue-400" />
          <FieldCard icon={Hash}       label="Invoice #"     value={data.invoice_number}  color="text-purple-400" />
          <FieldCard icon={Calendar}   label="Invoice Date"  value={data.invoice_date}    color="text-yellow-400" />
          <FieldCard icon={Calendar}   label="Due Date"      value={data.due_date}        color="text-orange-400" />
          <FieldCard icon={DollarSign} label="Subtotal"      value={data.subtotal}        color="text-green-400" />
          <FieldCard icon={DollarSign} label="Tax"           value={data.tax_amount}      color="text-red-400" />
          <FieldCard icon={DollarSign} label="Total"         value={data.total_amount}    color="text-green-300" />
          <FieldCard icon={Tag}        label="Currency"      value={data.currency}        color="text-cyan-400" />
          <FieldCard icon={Building2}  label="Vendor Address" value={data.vendor_address} color="text-slate-400" />
          <FieldCard icon={Hash}       label="PO Number"     value={data.po_number}       color="text-violet-400" />
          <FieldCard icon={FileText}   label="Payment Term"  value={data.payment_term}    color="text-amber-400" />
          <FieldCard icon={Hash}       label="Bank Name"     value={data.bank_name}       color="text-teal-400" />
          <FieldCard icon={Hash}       label="Bank Account"  value={data.bank_account_number} color="text-teal-400" />
          <FieldCard icon={Hash}       label="Sales Order #" value={data.sales_order_number} color="text-violet-400" />
          <FieldCard icon={FileText}   label="Signatory"     value={data.signatory_name}  color="text-amber-400" />
        </div>
      )}

      {activeTab === 'line_items' && (
        <div className="animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Table2 size={16} className="text-brand-400" />
            <p className="text-sm font-medium text-slate-300">
              {data.line_items?.length || 0} line items extracted
            </p>
          </div>
          <LineItemsTable items={data.line_items} />
        </div>
      )}

      {activeTab === 'pages' && pages && (
        <div className="animate-fade-in space-y-4">
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-brand-400" />
                <span className="text-sm font-semibold text-white">
                  {currentPage ? `Page ${currentPage.page} of ${totalPages}` : `All ${totalPages} pages (merged)`}
                </span>
                <span className="text-xs text-slate-500">· {data.line_items?.length || 0} line items</span>
              </div>
              <button
                onClick={() => setShowRawText(v => !v)}
                className="btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1.5"
              >
                {showRawText ? <EyeOff size={13} /> : <Eye size={13} />}
                {showRawText ? 'Hide full text' : 'Show full text'}
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
              {Object.entries(data)
                .filter(([k]) => k !== 'line_items' && k !== 'raw_text')
                .map(([k, v]) => (
                  <div key={k} className="text-xs">
                    <span className="text-slate-500 uppercase tracking-wider">{k}: </span>
                    <span className="text-slate-200">{v != null && v !== '' ? String(v) : '—'}</span>
                  </div>
                ))}
            </div>

            {data.line_items?.length > 0 && (
              <LineItemsTable items={data.line_items} />
            )}

            {showRawText && (
              <pre className="mt-3 text-xs text-slate-300 whitespace-pre-wrap font-mono bg-slate-900 border border-slate-700/60 rounded-lg p-3 max-h-96 overflow-y-auto">{currentRawText}</pre>
            )}
          </div>
        </div>
      )}

      {activeTab === 'raw' && (
        <div className="animate-fade-in">
          <p className="text-xs text-slate-500 mb-2">
            {currentPage ? `Page ${currentPage.page} of ${totalPages}` : 'All pages merged'}
          </p>
          <pre className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5 text-sm text-slate-300 overflow-x-auto font-mono leading-relaxed max-h-[60vh] overflow-y-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
