import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://yhpxqnkcltdocwqrcbcv.supabase.co'
// Anon key is a public key safe to commit — replace with real key from Supabase > Settings > API
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'anon-key-placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export const isConfigured = !!import.meta.env.VITE_SUPABASE_ANON_KEY

// Upload file to Supabase Storage
export async function uploadDocument(file, userId = 'anonymous') {
  const fileExt = file.name.split('.').pop()
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`

  const { data, error } = await supabase.storage
    .from('documents')
    .upload(fileName, file, { cacheControl: '3600', upsert: false })

  if (error) throw error

  const { data: { publicUrl } } = supabase.storage
    .from('documents')
    .getPublicUrl(fileName)

  return { path: fileName, publicUrl }
}

// Save document record to DB
export async function createDocumentRecord({ fileName, fileSize, fileType, storagePath, publicUrl }) {
  const { data, error } = await supabase
    .from('documents')
    .insert({
      file_name: fileName,
      file_size: fileSize,
      file_type: fileType,
      storage_path: storagePath,
      public_url: publicUrl,
      status: 'uploaded'
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Create workflow run record
export async function createWorkflowRun(documentId, workflowType) {
  const { data, error } = await supabase
    .from('workflow_runs')
    .insert({
      document_id: documentId,
      workflow_type: workflowType,
      status: 'pending'
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Poll workflow run status
export async function getWorkflowRun(runId) {
  const { data, error } = await supabase
    .from('workflow_runs')
    .select('*, ocr_results(*)')
    .eq('id', runId)
    .single()

  if (error) throw error
  return data
}

// Get all documents (history)
export async function getDocuments(limit = 20) {
  const { data, error } = await supabase
    .from('documents')
    .select('*, workflow_runs(id, status, created_at), ocr_results(id)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data
}

// Get OCR result
export async function getOcrResult(documentId) {
  const { data, error } = await supabase
    .from('ocr_results')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

// Subscribe to workflow run updates (realtime)
export function subscribeToWorkflowRun(runId, callback) {
  return supabase
    .channel(`workflow_run_${runId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'workflow_runs', filter: `id=eq.${runId}` },
      (payload) => callback(payload.new)
    )
    .subscribe()
}
