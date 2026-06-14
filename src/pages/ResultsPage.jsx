import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CheckCircle2, Copy, Download, ArrowLeft, FileText,
  Building2, Calendar, DollarSign, Hash, Tag, Table2,
  Loader2, AlertCircle, ExternalLink, Ship, MapPin, Anchor
} from 'lucide-react'
import { getOcrResult, supabase } from '../lib/supabase.js'

function FieldCard({ icon: Icon, label, value, color = 'text-brand-400' }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(String(value || ''))
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="border rounded-xl p-4 group transition-colors"
         style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={14} className={color} />
          <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
        </div>
        <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
                style={{ color: 'var(--text-muted)' }}>
          <Copy size={12} />
        </button>
      </div>
      <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
        {value != null && value !== ''
          ? String(value)
          : <span style={{ color: 'var(--text-muted)' }} className="italic font-normal">Not found</span>}
      </p>
      {copied && <p className="text-xs text-green-400 mt-1">Copied!</p>}
    </div>
  )
}

function LineItemsTable({ items = [] }) {
  if (!items?.length) return (
    <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>No line items extracted</p>
  )
  const columns = Object.keys(items[0] || {})
  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
            {columns.map(col => (
              <th key={col} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider first:pl-5"
                  style={{ color: 'var(--text-secondary)' }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b transition-colors"
                style={{ borderColor: 'var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
              {columns.map(col => (
                <td key={col} className="px-4 py-3 first:pl-5" style={{ color: 'var(--text-secondary)' }}>
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

/* ── Field configs per document type ── */
const INVOICE_FIELDS = [
  { icon: Building2,  label: 'Vendor',           key: 'vendor_name',      color: 'text-blue-400' },
  { icon: Hash,       label: 'Invoice #',         key: 'invoice_number',   color: 'text-purple-400' },
  { icon: Calendar,   label: 'Invoice Date',      key: 'invoice_date',     color: 'text-yellow-400' },
  { icon: Calendar,   label: 'Due Date',          key: 'due_date',         color: 'text-orange-400' },
  { icon: DollarSign, label: 'Total',             key: 'total_amount',     color: 'text-green-300' },
  { icon: Tag,        label: 'Currency',          key: 'currency',         color: 'text-cyan-400' },
  { icon: Building2,  label: 'Consignee',         key: 'consignee_name',   color: 'text-violet-400' },
  { icon: Hash,       label: 'PO Number',         key: 'po_number',        color: 'text-violet-400' },
  { icon: Building2,  label: 'Vendor Address',    key: 'vendor_address',   color: 'text-slate-400' },
  { icon: DollarSign, label: 'Subtotal',          key: 'subtotal',         color: 'text-green-400' },
  { icon: DollarSign, label: 'Tax',               key: 'tax_amount',       color: 'text-red-400' },
  { icon: FileText,   label: 'Payment Terms',     key: 'payment_terms',    color: 'text-amber-400' },
]

const BL_FIELDS = [
  { icon: Hash,       label: 'B/L Number',        key: 'bl_number',        color: 'text-purple-400' },
  { icon: Ship,       label: 'Vessel',             key: 'vessel_name',      color: 'text-blue-400' },
  { icon: Anchor,     label: 'Port of Loading',    key: 'port_of_loading',  color: 'text-cyan-400' },
  { icon: MapPin,     label: 'Port of Discharge',  key: 'port_of_discharge',color: 'text-orange-400' },
  { icon: Building2,  label: 'Shipper / Vendor',   key: 'vendor_name',      color: 'text-green-400' },
  { icon: Building2,  label: 'Consignee',          key: 'consignee_name',   color: 'text-violet-400' },
  { icon: Building2,  label: 'Shipper Address',    key: 'vendor_address',   color: 'text-slate-400' },
  { icon: Building2,  label: 'Consignee Address',  key: 'consignee_address',color: 'text-slate-400' },
  { icon: Hash,       label: 'Invoice #',          key: 'invoice_number',   color: 'text-yellow-400' },
  { icon: Calendar,   label: 'Date',               key: 'invoice_date',     color: 'text-yellow-400' },
  { icon: DollarSign, label: 'Total Amount',       key: 'total_amount',     color: 'text-green-300' },
  { icon: Tag,        label: 'Currency',           key: 'currency',         color: 'text-cyan-400' },
]

function getFieldConfig(docType) {
  const t = (docType || '').toUpperCase()
  if (t.includes('LADING') || t.includes('BL') || t.includes('BOL')) return BL_FIELDS
  return INVOICE_FIELDS
}

export default function ResultsPage() {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('fields')

  useEffect(() => { loadResults() }, [documentId])

  async function loadResults() {
    try {
      setLoading(true)
      const [{ data: d }, ocrResult] = await Promise.all([
        supabase.from('documents').select('*').eq('id', documentId).single(),
        getOcrResult(documentId),
      ])
      setDoc(d); setResult(ocrResult)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(result?.extracted_data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: `ocr-${documentId?.slice(0,8)}.json` })
    a.click(); URL.revokeObjectURL(url)
  }

  const handleExportCSV = () => {
    const data = result?.extracted_data; if (!data) return
    const rows = [['Field','Value'], ...Object.entries(data).filter(([k]) => k !== 'line_items').map(([k,v]) => [k, String(v ?? '')])]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: `ocr-${documentId?.slice(0,8)}.csv` })
    a.click(); URL.revokeObjectURL(url)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <Loader2 size={32} className="text-brand-400 animate-spin mx-auto mb-3" />
        <p style={{ color: 'var(--text-secondary)' }}>Loading results…</p>
      </div>
    </div>
  )

  if (error || !result) return (
    <div className="p-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm mb-6"
              style={{ color: 'var(--text-secondary' }}>
        <ArrowLeft size={16} /> Back
      </button>
      <div className="flex gap-3 p-4 rounded-xl"
           style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
        <AlertCircle size={16} className="text-red-400 mt-0.5" />
        <div>
          <p className="text-red-300 font-medium">Results not found</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{error || 'Still processing.'}</p>
        </div>
      </div>
    </div>
  )

  const data = result.extracted_data || {}
  const fieldConfig = getFieldConfig(data.document_type)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <button onClick={() => navigate('/app/history')}
                className="flex items-center gap-2 text-sm mb-4 transition-colors"
                style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={14} /> All documents
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                 style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <CheckCircle2 size={20} className="text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {doc?.file_name || 'Document'}
              </h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary' }}>
                {data.document_type && <span className="font-medium text-brand-400 mr-2">{data.document_type}</span>}
                {Object.keys(data).length} fields ·{'+ '}
                Confidence: <span className="text-green-400 font-medium">
                  {result.confidence_score ? `${Math.round(result.confidence_score * 100)}%` : 'N/A'}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {doc?.public_url && (
              <a href={doc.public_url} target="_blank" rel="noopener noreferrer"
                 className="btn-secondary text-sm py-2 px-3 flex items-center gap-1.5">
                <ExternalLink size={14} /> View File
              </a>
            )}
            <button onClick={handleExportCSV} className="btn-secondary text-sm py-2 px-3 flex items-center gap-1.5">
              <Download size={14} /> CSX
            </button>
            <button onClick={handleExportJSON} className="btn-secondary text-sm py-2 px-3 flex items-center gap-1.5">
              <Download size={14} /> JSON
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 rounded-xl p-1 w-fit border"
           style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        {['fields','line_items','raw'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: activeTab === tab ? 'var(--bg-hover)' : 'transparent',
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
            }}>
            {tab === 'fields' ? 'Extracted Fields' : tab === 'line_items' ? 'Line Items' : 'Raw JSON'}
          </button>
        ))}
      </div>

      {activeTab === 'fields' && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in">
          {fieldConfig.map(({ icon, label, key, color }) => (
            <FieldCard key={key} icon={icon} label={label} value={data[key]} color={color} />
          ))}
        </div>
      )}

      {activeTab === 'line_items' && (
        <div className="animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Table2 size={16} className="text-brand-400" />
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary' }}>
              {data.line_items?.length || 0} line items
            </p>
          </div>
          <LineItemsTable items={data.line_items} />
        </div>
      )}

      {activeTab === 'raw' && (
        <div className="animate-fade-in">
          <pre className="rounded-2xl p-5 text-sm overflow-x-auto font-mono leading-relaxed max-h-[60vh] overflow-y-auto border"
               style={{ background: 'var(--bg-card)', color: 'var(--text-secondary')', borderColor: 'var(--border)' }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
