import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, X, AlertCircle, Image, File, Plus } from 'lucide-react'
import WorkflowStatusTracker from '../components/ocr/WorkflowStatusTracker.jsx'
import { uploadDocument, createDocumentRecord, createWorkflowRun, subscribeToWorkflowRun } from '../lib/supabase.js'
import { triggerOcrWorkflow } from '../lib/n8n.js'

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
}
const MAX_SIZE_MB = 20
const MAX_FILES = 10

function FileIcon({ type }) {
  if (type?.startsWith('image/')) return <Image size={18} className="text-blue-400" />
  if (type === 'application/pdf') return <FileText size={18} className="text-red-400" />
  return <File size={18} className="text-slate-400" />
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function UploadPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const addFileInputRef = useRef(null)
  const [files, setFiles] = useState([])          // array of File objects
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState(null)
  const [workflowStatus, setWorkflowStatus] = useState('pending')
  const [workflowType, setWorkflowType] = useState('bill_of_lading')
  const [autoCompare, setAutoCompare] = useState(false)
  const [workflowError, setWorkflowError] = useState(null)
  const [workflowErrorId, setWorkflowErrorId] = useState(null)
  const [currentDocumentId, setCurrentDocumentId] = useState(null)
  const [isUploading, setIsUploading] = useState(false)

  const validateFile = (f) => {
    if (!Object.keys(ACCEPTED_TYPES).includes(f.type))
      return 'Unsupported file type. Please upload PDF, PNG, JPG, or WebP.'
    if (f.size > MAX_SIZE_MB * 1024 * 1024)
      return `File too large. Maximum size is ${MAX_SIZE_MB}MB.`
    return null
  }

  const addFiles = useCallback((newFiles) => {
    setError(null)
    const toAdd = []
    for (const f of newFiles) {
      if (files.length + toAdd.length >= MAX_FILES) {
        setError(`Maximum ${MAX_FILES} files allowed.`)
        break
      }
      const err = validateFile(f)
      if (err) { setError(err); continue }
      // deduplicate by name+size
      const dup = [...files, ...toAdd].find(x => x.name === f.name && x.size === f.size)
      if (!dup) toAdd.push(f)
    }
    if (toAdd.length > 0) {
      setFiles(prev => [...prev, ...toAdd])
      setWorkflowStatus('pending')
      setWorkflowError(null)
      setWorkflowErrorId(null)
    }
  }, [files])

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx))
    if (files.length <= 1) {
      setWorkflowStatus('pending')
      setWorkflowError(null)
    }
  }

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = Array.from(e.dataTransfer.files)
    addFiles(dropped)
  }, [addFiles])

  const onInputChange = (e) => {
    addFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  const handleSubmit = async () => {
    if (files.length === 0 || isUploading) return
    setIsUploading(true)
    setError(null)

    try {
      // Phase 1: Upload ALL files + create DB records + create workflow runs
      setWorkflowStatus('uploading')
      const allDocs = []
      for (const file of files) {
        const { path, publicUrl } = await uploadDocument(file)
        const doc = await createDocumentRecord({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          storagePath: path,
          publicUrl,
        })
        const run = await createWorkflowRun(doc.id, workflowType)
        allDocs.push({ doc, run, file, publicUrl })
      }

      // Phase 2: Trigger ALL n8n workflows
      setWorkflowStatus('triggered')
      for (const { doc, run, file, publicUrl } of allDocs) {
        await triggerOcrWorkflow({
          documentId: doc.id,
          fileUrl: publicUrl,
          fileName: file.name,
          workflowType,
          runId: run.id,
        })
      }
      setWorkflowStatus('processing')

      // Poll primary (first) file; navigate with ALL doc IDs when it completes
      const primary = allDocs[0]
      const otherIds = allDocs.slice(1).map(d => d.doc.id)
      const batchParam = otherIds.length > 0 ? `?batch=${otherIds.join(',')}` : ''
      setCurrentDocumentId(primary.doc.id)

      const goToResults = () => navigate(`/app/results/${primary.doc.id}${batchParam}`)

      const channel = subscribeToWorkflowRun(primary.run.id, (updated) => {
        setWorkflowStatus(updated.status)
        if (updated.status === 'completed') {
          channel.unsubscribe()
          setTimeout(goToResults, 1500)
        }
        if (updated.status === 'failed') {
          channel.unsubscribe()
          setWorkflowError(updated.error_message || 'Unknown error')
          setWorkflowErrorId(`ERR-${primary.run.id.slice(0, 8).toUpperCase()}`)
          setIsUploading(false)
        }
      })

      const pollInterval = setInterval(async () => {
        try {
          const { getWorkflowRun } = await import('../lib/supabase.js')
          const latestRun = await getWorkflowRun(primary.run.id)
          setWorkflowStatus(latestRun.status)
          if (latestRun.status === 'completed') {
            clearInterval(pollInterval)
            channel.unsubscribe()
            setTimeout(goToResults, 1500)
          }
          if (latestRun.status === 'failed') {
            clearInterval(pollInterval)
            channel.unsubscribe()
            setWorkflowError(latestRun.error_message || 'Unknown error')
            setWorkflowErrorId(`ERR-${primary.run.id.slice(0, 8).toUpperCase()}`)
            setIsUploading(false)
          }
        } catch { /* ignore */ }
      }, 4000)

    } catch (err) {
      console.error('Upload error:', err)
      setError(err.message || 'Failed to process document. Please try again.')
      setWorkflowStatus('failed')
      setWorkflowError(err.message)
      setWorkflowErrorId(`ERR-${Date.now().toString(36).toUpperCase()}`)
      setIsUploading(false)
    }
  }

  const handleRetry = () => {
    setWorkflowStatus('pending')
    setWorkflowError(null)
    setWorkflowErrorId(null)
    setIsUploading(false)
    if (files.length > 0) handleSubmit()
  }

  const isProcessing = isUploading && workflowStatus !== 'failed'
  const canAddMore = files.length < MAX_FILES && !isProcessing

  return (
    <div className="h-full flex flex-col p-6 gap-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-0.5">
          New Document Scan
          <span className="ml-3 text-sm font-normal text-slate-400">(Max {MAX_FILES} Files)</span>
        </h1>
        <p className="text-slate-400 text-sm">Select document type, upload your file, and let AI extract structured data.</p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-900/20 border border-red-500/30">
          <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* 2-column layout */}
      <div className="flex-1 flex gap-4 min-h-0">

        {/* ── LEFT: File list ──────────────────────────── */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">

          {files.length === 0 ? (
            /* Empty drop zone */
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
                dragOver
                  ? 'border-brand-400 bg-brand-900/20 scale-[1.01]'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-900/40 hover:bg-slate-800/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                multiple
                className="hidden"
                onChange={onInputChange}
              />
              <div className="w-14 h-14 rounded-2xl bg-brand-600/15 border border-brand-500/20 flex items-center justify-center mb-4">
                <Upload size={24} className="text-brand-400" />
              </div>
              <p className="font-semibold text-white mb-1">Drop your files here</p>
              <p className="text-slate-400 text-sm mb-3">or click to browse</p>
              <p className="text-slate-600 text-xs">PDF, PNG, JPG, WebP · Max {MAX_SIZE_MB}MB · Up to {MAX_FILES} files</p>
            </div>
          ) : (
            <>
              {/* Scrollable file list */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`flex-1 overflow-y-auto rounded-2xl border-2 border-dashed transition-all duration-200 ${
                  dragOver
                    ? 'border-brand-400 bg-brand-900/10'
                    : 'border-slate-700/60 bg-slate-900/20'
                } p-3 space-y-2`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  multiple
                  className="hidden"
                  onChange={onInputChange}
                />
                {files.map((f, idx) => (
                  <div
                    key={`${f.name}-${f.size}-${idx}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <FileIcon type={f.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-sm truncate">{f.name}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{formatBytes(f.size)} · {f.type}</p>
                    </div>
                    {!isProcessing && (
                      <button
                        onClick={() => removeFile(idx)}
                        className="text-slate-600 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-900/20 opacity-0 group-hover:opacity-100"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add More button */}
              {canAddMore && (
                <button
                  onClick={() => addFileInputRef.current?.click()}
                  className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-700 hover:border-brand-500/50 hover:bg-brand-600/5 text-slate-400 hover:text-brand-400 text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200"
                >
                  <input
                    ref={addFileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    multiple
                    className="hidden"
                    onChange={onInputChange}
                  />
                  <Plus size={16} />
                  + Add File More ({files.length}/{MAX_FILES})
                </button>
              )}
            </>
          )}

          {/* Processing hint */}
          {isProcessing && (
            <div className="text-center text-slate-500 text-sm animate-pulse">
              AI is processing your document — you'll be redirected when complete…
            </div>
          )}
        </div>

        {/* ── RIGHT: Tracker + Submit ───────────────────── */}
        <div className="w-[480px] flex-shrink-0 flex flex-col gap-3">
          <WorkflowStatusTracker
            workflowStatus={workflowStatus}
            error={workflowError}
            errorId={workflowErrorId}
            selectedWorkflow={workflowType}
            onWorkflowChange={setWorkflowType}
            autoCompare={autoCompare}
            onAutoCompareChange={setAutoCompare}
            onRetry={handleRetry}
            className="flex-1"
          />

          {/* Submit */}
          {!isProcessing && (
            <button
              onClick={handleSubmit}
              disabled={files.length === 0 || isUploading}
              className={`w-full py-4 rounded-2xl font-semibold text-base transition-all duration-200 flex items-center justify-center gap-3 ${
                files.length > 0 && !isUploading
                  ? 'btn-primary'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Upload size={18} />
              {isUploading ? 'Processing…' : 'Start AI Extraction'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
