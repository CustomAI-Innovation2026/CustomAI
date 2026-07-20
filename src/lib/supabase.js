import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from './auth.js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://yhpxqnkcltdocwqrcbcv.supabase.co'
// anon key is public — safe to commit
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlocHhxbmtjbHRkb2N3cXJjYmN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMDA2NDgsImV4cCI6MjA5Njg3NjY0OH0.LxQpWg5jVHIJfL9Q_VAN1XBUcylFUqWeCQ0oVNbGpWA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export const isConfigured = true

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
  const userEmail = getCurrentUser()?.email ?? null
  const { data, error } = await supabase
    .from('documents')
    .insert({
      file_name: fileName,
      file_size: fileSize,
      file_type: fileType,
      storage_path: storagePath,
      public_url: publicUrl,
      status: 'uploaded',
      user_email: userEmail,
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

// Get documents — scoped to the logged-in user
export async function getDocuments(limit = 20) {
  const userEmail = getCurrentUser()?.email ?? null
  let query = supabase
    .from('documents')
    .select('*, workflow_runs(id, status, created_at), ocr_results(id)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (userEmail) query = query.eq('user_email', userEmail)

  const { data, error } = await query
  if (error) throw error
  return data
}

// Admin: get documents for all users or filtered by email
export async function getDocumentsAdmin(filterEmail = null, limit = 500) {
  let query = supabase
    .from('documents')
    .select('*, workflow_runs(id, status, created_at), ocr_results(id)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (filterEmail) query = query.eq('user_email', filterEmail)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
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
