import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, X, AlertCircle, Image, File } from 'lucide-react'
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

function FileIcon({ type }) {
  if (type?.startsWith('image/')) return <Image size={20} className="text-blue-400" />
  if (type === 'application/pdf') return <FileText size={20} className="text-red-400" />
  return <File size={20} className="text-slate-400" />
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function UploadPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
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
    if (!Object.keys(ACCEPTED_TYPES).includes(f.type)) {
      return 'Unsupported file type. Please upload PDF, PNG, JPG, or WebP.'
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File too large. Maximum size is ${MAX_SIZE_MB}MB.`
    }
    return null
  }

  const handleFile = useCallback((f) => {
    setError(null)
    const validationError = validateFile(f)
    if (validationError) { setError(validationError); return }
    setFile(f)
    setWorkflowStatus('pending')
    setWorkflowError(null)
    setWorkflowErrorId(null)
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }, [handleFile])

  const onInputChange = (e) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  const handleSubmit = async () => {
    if (!file || isUploading) return
    setIsUploading(true)
    setError(null)

    try {
      // Step 1: Upload to Supabase Storage
      setWorkflowStatus('uploading')
      const { path, publicUrl } = await uploadDocument(file)

      // Step 2: Create DB record
      const doc = await createDocumentRecord({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        storagePath: path,
        publicUrl,
      })
      setCurrentDocumentId(doc.id)

      // Step 3: Create workflow run
      const run = await createWorkflowRun(doc.id, workflowType)

      // Step 4: Trigger n8n webhook
      setWorkflowStatus('triggered')
      await triggerOcrWorkflow({
        documentId: doc.id,
        fileUrl: publicUrl,
        fileName: file.name,
        workflowType,
        runId: run.id,
      })
      setWorkflowStatus('processing')

      // Step 5: Subscribe to realtime updates
      const channel = subscribeToWorkflowRun(run.id, (updated) => {
        setWorkflowStatus(updated.status)

        if (updated.status === 'completed') {
          channel.unsubscribe()
          setTimeout(() => navigate(`/app/results/${doc.id}`), 1500)
        }
        if (updated.status === 'failed') {
          channel.unsubscribe()
          setWorkflowError(updated.error_message || 'Unknown error')
          setWorkflowErrorId(`ERR-${run.id.slice(0, 8).toUpperCase()}`)
          setIsUploading(false)
        }
      })

      // Fallback: poll every 4s for environments without realtime
      const pollInterval = setInterval(async () => {
        try {
          const { getWorkflowRun } = await import('../lib/supabase.js')
          const latestRun = await getWorkflowRun(run.id)
          setWorkflowStatus(latestRun.status)

          if (latestRun.status === 'completed') {
            clearInterval(pollInterval)
            channel.unsubscribe()
            setTimeout(() => navigate(`/app/results/${doc.id}`), 1500)
          }
          if (latestRun.status === 'failed') {
            clearInterval(pollInterval)
            channel.unsubscribe()
            setWorkflowError(latestRun.error_message || 'Unknown error')
            setWorkflowErrorId(`ERR-${run.id.slice(0, 8).toUpperCase()}`)
            setIsUploading(false)
          }
        } catch { /* ignore poll errors */ }
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
    if (file) handleSubmit()
  }

  const isProcessing = isUploading && workflowStatus !== 'failed'

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">New Document Scan</h1>
        <p className="text-slate-400">Select document type, upload your file, and let AI extract structured data.</p>
      </div>

      <div className="space-y-5">
        {/* Drop Zone */}
        {!isProcessing && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => !file && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 cursor-pointer ${
              dragOver
                ? 'border-brand-400 bg-brand-900/20 scale-[1.01]'
                : file
                ? 'border-green-500/40 bg-green-900/10'
                : 'border-slate-700 hover:border-slate-600 bg-slate-900/40 hover:bg-slate-800/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={onInputChange}
            />

            {file ? (
              <div className="flex items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                  <FileIcon type={file.type} />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-white text-sm">{file.name}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{formatBytes(file.size)} · {file.type}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); setWorkflowStatus('pending') }}
                  className="ml-auto text-slate-500 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-900/20"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div>
                <div className="w-14 h-14 rounded-2xl bg-brand-600/15 border border-brand-500/20 flex items-center justify-center mx-auto mb-4">
                  <Upload size={24} className="text-brand-400" />
                </div>
                <p className="font-semibold text-white mb-1">Drop your invoice here</p>
                <p className="text-slate-400 text-sm mb-3">or click to browse</p>
                <p className="text-slate-600 text-xs">PDF, PNG, JPG, WebP · Max {MAX_SIZE_MB}MB</p>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && !isProcessing && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-900/20 border border-red-500/30">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Workflow Tracker */}
        <WorkflowStatusTracker
          workflowStatus={workflowStatus}
          error={workflowError}
          errorId={workflowErrorId}
          selectedWorkflow={workflowType}
          onWorkflowChange={setWorkflowType}
          autoCompare={autoCompare}
          onAutoCompareChange={setAutoCompare}
          onRetry={handleRetry}
        />

        {/* Submit Button */}
        {!isProcessing && (
          <button
            onClick={handleSubmit}
            disabled={!file || isUploading}
            className={`w-full py-4 rounded-2xl font-semibold text-base transition-all duration-200 flex items-center justify-center gap-3 ${
              file && !isUploading
                ? 'btn-primary'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Upload size={18} />
            {isUploading ? 'Processing…' : 'Start AI Extraction'}
          </button>
        )}

        {/* Processing hint */}
        {isProcessing && (
          <div className="text-center text-slate-500 text-sm animate-pulse">
            AI is processing your document — you'll be redirected when complete…
          </div>
        )}
      </div>
    </div>
  )
}
