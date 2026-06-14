import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, X, AlertCircle, Image, File, Loader2 } from 'lucide-react'
import WorkflowStatusTracker from '../components/ocr/WorkflowStatusTracker.jsx'
import { uploadDocument, createDocumentRecord, createWorkflowRun, subscribeToWorkflowRun } from '../lib/supabase.js'
import { triggerOcrWorkflow } from '../lib/n8n.js'
import { pdfToJpegs } from '../lib/pdfUtils.js'

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
}
const MAX_SIZE_MB = 30

function FileIcon({ type }) {
  if (type?.startsWith('image/')) return <Image size={20} className="text-blue-400" />
  if (type === 'application/pdf') return <FileText size={20} className="text-red-400" />
  return <File size={20} className="text-slate-400" />
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function UploadPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState(null)
  const [workflowStatus, setWorkflowStatus] = useState('pending')
  const [workflowType, setWorkflowType] = useState('invoice_ocr')
  const [workflowError, setWorkflowError] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [pdfProgress, setPdfProgress] = useState(null) // {current, total}
  const [currentDocumentId, setCurrentDocumentId] = useState(null)

  const validateFile = (f) => {
    if (!Object.keys(ACCEPTED_TYPES).includes(f.type))
      return 'Unsupported file type. Please upload PDF, PNG, JPG, or WebP.'
    if (f.size > MAX_SIZE_MB * 1024 * 1024)
      return `File too large. Maximum ${MAX_SIZE_MB}MB.`
    return null
  }

  const handleFile = useCallback((f) => {
    setError(null)
    const err = validateFile(f)
    if (err) { setError(err); return }
    setFile(f)
    setWorkflowStatus('pending')
    setWorkflowError(null)
    setPdfProgress(null)
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }, [handleFile])

  const onInputChange = (e) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  /* ── Process a single image file (or already-converted JPEG blob) ── */
  async function processImageFile(imageFile, originalName) {
    setWorkflowStatus('uploading')
    const { path, publicUrl } = await uploadDocument(imageFile)
    const doc = await createDocumentRecord({
      fileName: originalName || imageFile.name,
      fileSize: imageFile.size,
      fileType: imageFile.type,
      storagePath: path,
      publicUrl,
    })
    setCurrentDocumentId(doc.id)
    const run = await createWorkflowRun(doc.id, workflowType)
    setWorkflowStatus('triggered')
    await triggerOcrWorkflow({
      documentId: doc.id,
      fileUrl: publicUrl,
      fileName: originalName || imageFile.name,
      workflowType,
      runId: run.id,
    })
    return { doc, run }
  }

  const handleSubmit = async () => {
    if (!file || isUploading) return
    setIsUploading(true)
    setError(null)

    try {
      if (file.type === 'application/pdf') {
        /* ── PDF: convert pages → JPEG, process each ── */
        setWorkflowStatus('converting')
        const pages = await pdfToJpegs(file)
        setPdfProgress({ current: 0, total: pages.length })

        let firstDocId = null
        for (let i = 0; i < pages.length; i++) {
          setPdfProgress({ current: i + 1, total: pages.length })
          const { blob, fileName } = pages[i]
          const jpegFile = new File([blob], fileName, { type: 'image/jpeg' })
          const { doc } = await processImageFile(jpegFile, fileName)
          if (i === 0) firstDocId = doc.id
        }

        /* Navigate to first page results after all pages triggered */
        if (firstDocId) {
          subscribeToWorkflowRun(firstDocId, (status) => {
            if (status === 'completed') navigate(`/app/results/${firstDocId}`)
          })
          pollStatus(firstDocId)
        }
      } else {
        /* ── Image: existing flow ── */
        const { doc, run } = await processImageFile(file, file.name)
        subscribeToWorkflowRun(doc.id, (status) => {
          setWorkflowStatus(status)
          if (status === 'completed') navigate(`/app/results/${doc.id}`)
          if (status === 'failed') setWorkflowError('OCR processing failed.')
        })
        pollStatus(doc.id)
      }
    } catch (err) {
      setError(err.message)
      setWorkflowStatus('failed')
    } finally {
      setIsUploading(false)
    }
  }

  function pollStatus(docId) {
    const interval = setInterval(async () => {
      try {
        const { getWorkflowRun } = await import('../lib/supabase.js')
        const run = await getWorkflowRun(docId)
        if (!run) return
        setWorkflowStatus(run.status)
        if (run.status === 'completed') {
          clearInterval(interval)
          navigate(`/app/results/${docId}`)
        }
        if (run.status === 'failed') {
          clearInterval(interval)
          setWorkflowError(run.error_message || 'Processing failed.')
        }
      } catch { /* ignore */ }
    }, 4000)
  }

  const isProcessing = ['uploading','converting','triggered','processing'].includes(workflowStatus)
  const isPdf = file?.type === 'application/pdf'

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Upload Document</h1>
        <p style={{ color: 'var(--text-secondary)' }} className="text-sm">PDF, PNG, JPG, or WebP · max {MAX_SIZE_MB}MB</p>
      </div>

      {!file ? (
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all duration-200"
          style={{
            borderColor: dragOver ? '#4f54e8' : 'var(--border)',
            background: dragOver ? 'rgba(79,84,232,0.04)' : 'var(--bg-card)',
          }}
        >
          <input ref={fileInputRef} type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            onChange={onInputChange} className="hidden" />
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
               style={{ background: 'rgba(79,84,232,0.1)' }}>
            <Upload size={24} className="text-brand-400" />
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Drop file here</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>or click to browse</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* File preview */}
          <div className="flex items-center gap-4 p-4 rounded-2xl border"
               style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                 style={{ background: 'var(--bg-hover)' }}>
              <FileIcon type={file.type} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{file.name}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {formatBytes(file.size)}{isPdf ? ' · PDF → will convert to JPEG' : ''}
              </p>
            </div>
            {!isProcessing && (
              <button onClick={() => setFile(null)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors">
                <X size={16} className="text-slate-400 hover:text-red-400" />
              </button>
            )}
          </div>

          {/* PDF conversion progress */}
          {workflowStatus === 'converting' && (
            <div className="flex items-center gap-3 p-3 rounded-xl"
                 style={{ background: 'rgba(79,84,232,0.08)', border: '1px solid rgba(79,84,232,0.2)' }}>
              <Loader2 size={16} className="text-brand-400 animate-spin flex-shrink-0" />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Converting PDF to images…
                {pdfProgress ? ` (page ${pdfProgress.current} / ${pdfProgress.total})` : ''}
              </p>
            </div>
          )}

          {/* Workflow type selector */}
          {!isProcessing && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-2 block"
                     style={{ color: 'var(--text-muted)' }}>Document Type</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'invoice_ocr', label: 'Invoice / PL' },
                  { value: 'bl_ocr',      label: 'Bill of Lading' },
                  { value: 'general_ocr', label: 'General' },
                ].map(({ value, label }) => (
                  <button key={value}
                    onClick={() => setWorkflowType(value)}
                    className="py-2 px-3 rounded-xl text-sm font-medium border transition-all"
                    style={{
                      background: workflowType === value ? 'rgba(79,84,232,0.12)' : 'var(--bg-card)',
                      borderColor: workflowType === value ? '#4f54e8' : 'var(--border)',
                      color: workflowType === value ? '#818cf8' : 'var(--text-secondary)',
                    }}
                  >{label}</button>
                ))}
              </div>
            </div>
          )}

          {/* Status tracker */}
          {isProcessing && <WorkflowStatusTracker status={workflowStatus} error={workflowError} />}

          {/* Error */}
          {error && (
            <div className="flex gap-3 p-4 rounded-xl"
                 style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{error}</p>
            </div>
          )}

          {/* Action buttons */}
          {!isProcessing && (
            <div className="flex gap-3">
              <button onClick={() => setFile(null)} className="btn-secondary flex-1">
                Change File
              </button>
              <button onClick={handleSubmit} className="btn-primary flex-1" disabled={isUploading}>
                {isUploading ? <><Loader2 size={14} className="animate-spin mr-2" />Processing…</> : 'Extract Data'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
