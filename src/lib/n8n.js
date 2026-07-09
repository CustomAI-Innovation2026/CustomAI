const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://n8n.scgjwd.com/webhook/ocr-trigger'

/**
 * Trigger the n8n OCR workflow
 * @param {object} payload - { documentId, fileUrl, fileName, workflowType, runId }
 */
export async function triggerOcrWorkflow(payload) {
  const response = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      documentId: payload.documentId,
      fileUrl: payload.fileUrl,
      fileName: payload.fileName,
      workflowType: payload.workflowType || 'bill_of_lading',
      runId: payload.runId,
      callbackUrl: `${window.location.origin}/api/ocr-callback`,
      timestamp: new Date().toISOString(),
    })
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`n8n webhook failed: ${response.status} – ${text}`)
  }

  const result = await response.json().catch(() => ({ status: 'triggered' }))
  return result
}

/**
 * Poll n8n execution status (fallback if realtime isn't available)
 */
export async function pollWorkflowStatus(runId, maxAttempts = 60, intervalMs = 3000) {
  return new Promise((resolve, reject) => {
    let attempts = 0

    const poll = async () => {
      attempts++
      if (attempts > maxAttempts) {
        reject(new Error('Workflow timed out after 3 minutes'))
        return
      }

      try {
        // Check Supabase for status update (n8n callbacks update the DB)
        const { getWorkflowRun } = await import('./supabase.js')
        const run = await getWorkflowRun(runId)

        if (run.status === 'completed') {
          resolve(run)
        } else if (run.status === 'failed') {
          reject(new Error(run.error_message || 'Workflow failed'))
        } else {
          setTimeout(poll, intervalMs)
        }
      } catch (err) {
        reject(err)
      }
    }

    setTimeout(poll, intervalMs)
  })
}

export const WORKFLOW_TYPES = {
  BILL_OF_LADING: {
    id: 'bill_of_lading',
    label: 'Bill of Lading',
    description: 'BL#, containers, cargo, parties — 46 fields',
    icon: '🚢',
    estimatedSeconds: 20,
  },
  INVOICE: {
    id: 'invoice',
    label: 'Invoice',
    description: 'Amounts, line items, bank details — 50+ fields',
    icon: '🧾',
    estimatedSeconds: 20,
  },
  PACKING_LIST: {
    id: 'packing_list',
    label: 'Packing List',
    description: 'Weight, CBM, cartons per lot — 33+ fields',
    icon: '📦',
    estimatedSeconds: 15,
  },
  FORM_D: {
    id: 'form_d',
    label: 'Form D',
    description: 'ATIGA C/O, origin criterion — 26 fields',
    icon: '📋',
    estimatedSeconds: 15,
  },
}
