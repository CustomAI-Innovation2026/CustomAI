import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  GitCompare, Plus, X, CheckCircle2, XCircle, MinusCircle,
  FileText, Loader2, Upload, AlertCircle, Image, File, ChevronDown
} from 'lucide-react'
import { useTheme } from '../lib/theme.jsx'
import {
  supabase,
  uploadDocument, createDocumentRecord, createWorkflowRun,
  subscribeToWorkflowRun, getWorkflowRun, getOcrResult
} from '../lib/supabase.js'
import { triggerOcrWorkflow, triggerMatchingWorkflow } from '../lib/n8n.js'
import { saveMatchingHistory } from '../lib/matchingHistory.js'

// ── Constants ──────────────────────────────────────────────────
const DOC_TYPES = [
  { id: 'bill_of_lading', label: 'Bill of Lading', short: 'BL',   emoji: '🚢', color: 'blue' },
  { id: 'invoice',        label: 'Invoice',        short: 'INV',  emoji: '🧾', color: 'amber' },
  { id: 'packing_list',   label: 'Packing List',   short: 'PL',   emoji: '📦', color: 'green' },
  { id: 'form_d',         label: 'Form D',         short: 'FORM', emoji: '📋', color: 'violet' },
]

const COLOR_MAP = {
  blue:   { active: 'border-blue-500 bg-blue-500/15 text-blue-400',       inactive: 'border-slate-700 text-slate-600' },
  amber:  { active: 'border-amber-500 bg-amber-500/15 text-amber-400',    inactive: 'border-slate-700 text-slate-600' },
  green:  { active: 'border-green-500 bg-green-500/15 text-green-400',    inactive: 'border-slate-700 text-slate-600' },
  violet: { active: 'border-violet-500 bg-violet-500/15 text-violet-400', inactive: 'border-slate-700 text-slate-600' },
}
const COLOR_MAP_LIGHT = {
  blue:   { active: 'border-blue-500 bg-blue-50 text-blue-700',       inactive: 'border-slate-300 text-slate-400' },
  amber:  { active: 'border-amber-500 bg-amber-50 text-amber-700',    inactive: 'border-slate-300 text-slate-400' },
  green:  { active: 'border-green-500 bg-green-50 text-green-700',    inactive: 'border-slate-300 text-slate-400' },
  violet: { active: 'border-violet-500 bg-violet-50 text-violet-700', inactive: 'border-slate-300 text-slate-400' },
}

// Combination options — ordered by BL > INV > PL > FORM priority
const COMBINATION_OPTIONS = {
  2: [
    { label: '1. BL vs Invoice',           types: ['bill_of_lading', 'invoice'] },
    { label: '2. BL vs Packing List',       types: ['bill_of_lading', 'packing_list'] },
    { label: '3. BL vs Form',              types: ['bill_of_lading', 'form_d'] },
    { label: '4. Invoice vs Packing List',  types: ['invoice', 'packing_list'] },
    { label: '5. Invoice vs Form',          types: ['invoice', 'form_d'] },
    { label: '6. Packing List vs Form',     types: ['packing_list', 'form_d'] },
  ],
  3: [
    { label: '7. BL vs Invoice vs Packing List',    types: ['bill_of_lading', 'invoice', 'packing_list'] },
    { label: '8. BL vs Invoice vs Form',             types: ['bill_of_lading', 'invoice', 'form_d'] },
    { label: '9. BL vs Packing List vs Form',        types: ['bill_of_lading', 'packing_list', 'form_d'] },
    { label: '10. Invoice vs Packing List vs Form',  types: ['invoice', 'packing_list', 'form_d'] },
  ],
  4: [
    { label: '11. BL vs Invoice vs Packing List vs Form', types: ['bill_of_lading', 'invoice', 'packing_list', 'form_d'] },
  ],
}

const MATCH_FIELDS = {
  bill_of_lading: [
    'bl_number','document_number','bl_issue_date','laden_on_board_date',
    'shipper_name','consignee_name','notify_party_name',
    'vessel_name','voyage_number',
    'port_of_loading','port_of_discharge','place_of_delivery',
    'freight_terms','service_type',
    'total_packages_count','total_containers_count','gross_weight_kgs','measurement_cbm',
  ],
  invoice: [
    'invoice_number','invoice_date','po_number','sales_order_number','booking_number',
    'shipper_name','buyer_name','notify_party_name',
    'vessel_name','voyage_number',
    'port_of_loading','final_destination','sailing_date',
    'incoterm','payment_term','currency',
    'total_quantity_pcs','total_cartons','total_amount','fob_value',
  ],
  packing_list: [
    'invoice_number','invoice_date','po_number','sales_order','booking_number',
    'shipper_name','ship_to_name',
    'vessel_name','voyage_number',
    'port_of_loading','final_destination','sailing_date',
    'container_number','container_volume_type',
    'total_quantity_pcs','total_cartons',
    'total_net_weight_kgs','total_gross_weight_kgs','total_measurement_cbm',
  ],
  form_d: [
    'reference_no','exporter_name','consignee_name',
    'vessel_name','port_of_discharge',
    'importing_country','issuing_country','departure_date','declaration_place_date',
  ],
}

const CROSS_MATCH = {
  'bill_of_lading:invoice': [
    { L: 'bl_number',           R: null,                 label: 'BL Number' },
    { L: null,                  R: 'invoice_number',     label: 'Invoice Number' },
    { L: null,                  R: 'invoice_date',       label: 'Invoice Date' },
    { L: 'laden_on_board_date', R: 'sailing_date',       label: 'On Board / Sailing Date' },
    { L: 'shipper_name',        R: 'shipper_name',       label: 'Shipper Name' },
    { L: 'consignee_name',      R: 'buyer_name',         label: 'Consignee / Buyer' },
    { L: 'notify_party_name',   R: 'notify_party_name',  label: 'Notify Party' },
    { L: 'vessel_name',         R: 'vessel_name',        label: 'Vessel Name' },
    { L: 'voyage_number',       R: 'voyage_number',      label: 'Voyage Number' },
    { L: 'port_of_loading',     R: 'port_of_loading',    label: 'Port of Loading' },
    { L: 'port_of_discharge',   R: 'final_destination',  label: 'Port of Discharge / Destination' },
    { L: 'freight_terms',       R: 'incoterm',           label: 'Freight Terms / Incoterm' },
    { L: null,                  R: 'po_number',          label: 'PO Number' },
    { L: null,                  R: 'booking_number',     label: 'Booking Number' },
    { L: null,                  R: 'currency',           label: 'Currency' },
    { L: null,                  R: 'total_amount',       label: 'Total Amount' },
    { L: 'total_packages_count',R: 'total_cartons',      label: 'Total Packages / Cartons' },
    { L: 'gross_weight_kgs',    R: null,                 label: 'Gross Weight (KGS)' },
    { L: 'measurement_cbm',     R: null,                 label: 'Measurement (CBM)' },
  ],
  'bill_of_lading:packing_list': [
    { L: 'bl_number',           R: null,                      label: 'BL Number' },
    { L: null,                  R: 'invoice_number',          label: 'Invoice Number' },
    { L: 'laden_on_board_date', R: 'sailing_date',            label: 'On Board / Sailing Date' },
    { L: 'shipper_name',        R: 'shipper_name',            label: 'Shipper Name' },
    { L: 'consignee_name',      R: 'ship_to_name',            label: 'Consignee / Ship To' },
    { L: 'notify_party_name',   R: 'notify_party_name',       label: 'Notify Party' },
    { L: 'vessel_name',         R: 'vessel_name',             label: 'Vessel Name' },
    { L: 'voyage_number',       R: 'voyage_number',           label: 'Voyage Number' },
    { L: 'port_of_loading',     R: 'port_of_loading',         label: 'Port of Loading' },
    { L: 'place_of_delivery',   R: 'final_destination',       label: 'Place of Delivery / Destination' },
    { L: null,                  R: 'po_number',               label: 'PO Number' },
    { L: null,                  R: 'booking_number',          label: 'Booking Number' },
    { L: null,                  R: 'container_number',        label: 'Container Number' },
    { L: null,                  R: 'container_volume_type',   label: 'Container Type' },
    { L: 'total_packages_count',R: 'total_cartons',           label: 'Total Packages / Cartons' },
    { L: 'gross_weight_kgs',    R: 'total_gross_weight_kgs',  label: 'Gross Weight (KGS)' },
    { L: 'measurement_cbm',     R: 'total_measurement_cbm',   label: 'Measurement (CBM)' },
  ],
  'invoice:packing_list': [
    { L: 'invoice_number',    R: 'invoice_number',        label: 'Invoice Number' },
    { L: 'invoice_date',      R: 'invoice_date',          label: 'Invoice Date' },
    { L: 'po_number',         R: 'po_number',             label: 'PO Number' },
    { L: 'sales_order_number',R: 'sales_order',           label: 'Sales Order' },
    { L: 'booking_number',    R: 'booking_number',        label: 'Booking Number' },
    { L: 'shipper_name',      R: 'shipper_name',          label: 'Shipper Name' },
    { L: 'buyer_name',        R: 'ship_to_name',          label: 'Buyer / Ship To' },
    { L: 'vessel_name',       R: 'vessel_name',           label: 'Vessel Name' },
    { L: 'voyage_number',     R: 'voyage_number',         label: 'Voyage Number' },
    { L: 'port_of_loading',   R: 'port_of_loading',       label: 'Port of Loading' },
    { L: 'final_destination', R: 'final_destination',     label: 'Final Destination' },
    { L: 'sailing_date',      R: 'sailing_date',          label: 'Sailing Date' },
    { L: 'container_number',  R: 'container_number',      label: 'Container Number' },
    { L: 'container_volume_type', R: 'container_volume_type', label: 'Container Type' },
    { L: 'total_cartons',     R: 'total_cartons',         label: 'Total Quantity' },
    { L: null,                R: 'total_net_weight_kgs',  label: 'Net Weight (KGS)' },
    { L: null,                R: 'total_gross_weight_kgs',label: 'Gross Weight (KGS)' },
    { L: null,                R: 'total_measurement_cbm', label: 'Measurement (CBM)' },
  ],
  'bill_of_lading:form_d': [
    { L: 'bl_number',           R: 'reference_no',      label: 'BL / Reference No.' },
    { L: 'shipper_name',        R: 'exporter_name',     label: 'Shipper / Exporter' },
    { L: 'consignee_name',      R: 'consignee_name',    label: 'Consignee' },
    { L: 'vessel_name',         R: 'vessel_name',       label: 'Vessel Name' },
    { L: 'port_of_discharge',   R: 'port_of_discharge', label: 'Port of Discharge' },
    { L: null,                  R: 'importing_country', label: 'Importing Country' },
    { L: null,                  R: 'issuing_country',   label: 'Issuing Country' },
    { L: 'laden_on_board_date', R: 'departure_date',    label: 'On Board / Departure Date' },
  ],
}

function getCrossMatch(leftType, rightType) {
  const key    = `${leftType}:${rightType}`
  const revKey = `${rightType}:${leftType}`
  if (CROSS_MATCH[key])    return CROSS_MATCH[key].map(m => ({ L: m.L, R: m.R, label: m.label }))
  if (CROSS_MATCH[revKey]) return CROSS_MATCH[revKey].map(m => ({ L: m.R, R: m.L, label: m.label }))
  return null
}

// ── 6-Part section definitions ────────────────────────────────
const SECTION_NAMES = [
  { num: '1', title: 'Shipper',              emoji: '🏭' },
  { num: '2', title: 'Consignee (Bill To)',  emoji: '🏢' },
  { num: '3', title: 'Vessel & Port',        emoji: '⚓' },
  { num: '4', title: 'Container',            emoji: '📦' },
  { num: '5', title: 'Product & Volume',     emoji: '📊' },
  { num: '6', title: 'Mark & Reference',     emoji: '🔖' },
]

function getFieldSection(label) {
  const l = label.toLowerCase()
  if (/shipper|exporter/.test(l)) return 0
  if (/consignee|buyer|notify|bill to|ship to/.test(l)) return 1
  if (/vessel|voyage|port|sailing|departure|on board|delivery|destination|loading|discharge|import/.test(l)) return 2
  if (/container/.test(l)) return 3
  if (/weight|carton|package|quantity|measurement|po number|po#|sales order|booking|amount|fob|incoterm|freight|payment|currency/.test(l)) return 4
  return 5
}

const ACCEPTED_TYPES = { 'application/pdf': true, 'image/png': true, 'image/jpeg': true, 'image/webp': true }
const MAX_SIZE_MB = 20

function formatLabel(k) { return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }

function normalize(v) {
  if (v == null || v === '') return ''
  return String(v).trim().toLowerCase()
    .replace(/,/g, ' ').replace(/\s+/g, ' ').trim()
}

// ── Deep normalization: strips V. prefix, brackets, punctuation ──
function normalizeDeep(v) {
  return String(v ?? '').trim().toLowerCase()
    .replace(/\bv\./gi, '')           // V.0503-054N → 0503-054N
    .replace(/[\[\](){}]/g, ' ')      // remove all brackets
    .replace(/[,\.;:\/]/g, ' ')       // punctuation → space
    .replace(/\s+/g, ' ').trim()
}

// Sorted-token compare: "BANGKOK, THAILAND" == "THAILAND, BANGKOK"
function sortedTokenMatch(a, b) {
  const sort = s => normalizeDeep(s).split(' ').filter(Boolean).sort().join(' ')
  return sort(a) === sort(b)
}

// Containment: "PORT KLANG, MALAYSIA" contains all tokens of "PORT KLANG"
function tokenSetContains(larger, smaller) {
  const setL = new Set(normalizeDeep(larger).split(' ').filter(Boolean))
  const toksS = normalizeDeep(smaller).split(' ').filter(Boolean)
  return toksS.length > 0 && toksS.every(t => setL.has(t))
}

// Container list: BL may have "EMCU8626404, EGSU9260392, ..." — check if other is in list
function containerListMatch(a, b) {
  const split = s => String(s).split(/[\s,;\/]+/).map(x => x.trim().toLowerCase()).filter(Boolean)
  const listA = split(a)
  const listB = split(b)
  // any element of listA matches any element of listB
  return listA.some(x => listB.some(y => x === y || x.includes(y) || y.includes(x)))
}

// Reference/ID match: "760243297[380K]" == "(760243297(380K))" == "760243297"
function idMatch(a, b) {
  const clean = s => normalizeDeep(s)
  const ca = clean(a), cb = clean(b)
  if (ca === cb) return true
  if (ca.includes(cb) || cb.includes(ca)) return true
  // Compare leading numeric sequence
  const num = s => (s.match(/\d{5,}/) || [''])[0]
  return num(ca) && num(ca) === num(cb)
}

// Company name: jaccard on meaningful tokens
function tokenize(s) {
  return normalizeDeep(s)
    .replace(/\b(co|ltd|inc|corp|corporation|limited|llc|gmbh|sdn|bhd|pte|energy|m|the|of|and|or|an|by|in|on|at)\b/gi, '')
    .split(/\s+/).filter(t => t.length > 1)
}
function jaccardSim(a, b) {
  const setA = new Set(tokenize(a))
  const setB = new Set(tokenize(b))
  if (!setA.size || !setB.size) return 0
  const inter = [...setA].filter(t => setB.has(t)).length
  return inter / new Set([...setA, ...setB]).size
}

// ── Field-type classification ──
// stripKey: remove all separators so "Shipper Name" == "shipper_name" == "shippername"
function stripKey(s) { return (s ?? '').toLowerCase().replace(/[\s_\-\/&().#,]+/g, '') }

const FIELD_TYPE_MAP = [
  { type: 'name',      tokens: ['shippername','consigneename','notifypartyname','notifyparty'] },
  { type: 'address',   tokens: ['shipperaddress','consigneeaddress','notifypartyaddress'] },
  { type: 'location',  tokens: ['placeofreceip','portofloading','portofdischarge','placeofdelivery','finaldestin','portofdestin'] },
  { type: 'voyage',    tokens: ['voyagenumber','voyageno','voyage'] },
  { type: 'container', tokens: ['containernumber','containerno','container'] },
  { type: 'reference', tokens: ['ponumber','bookingnumber','blnumber','invoicenumber','salesorder','lcnumber','referenceno'] },
  { type: 'date',      tokens: ['sailingdate','blissuedate','ladenonboard','invoicedate','departuredate','dateofissue'] },
]
function fieldType(k) {
  const key = stripKey(k)
  for (const { type, tokens } of FIELD_TYPE_MAP) {
    if (tokens.some(t => key.includes(t) || t.includes(key))) return type
  }
  return 'generic'
}

// Pairwise check: all pairs must satisfy predicate
function allPairs(vals, fn) {
  for (let i = 0; i < vals.length; i++)
    for (let j = i + 1; j < vals.length; j++)
      if (!fn(vals[i], vals[j])) return false
  return true
}

// ── Master status computer ──
function computeStatus(fieldKey, rawVals) {
  const present = rawVals.filter(Boolean)
  if (present.length === 0) return 'empty'
  if (present.length < rawVals.length) return 'missing'

  // 1. Exact match after deep normalize
  const deepNorm = present.map(normalizeDeep)
  if (deepNorm.every((v, _, a) => v === a[0])) return 'match'

  const type = fieldType(fieldKey)

  // 2. Container: BL may list multiple — check any element matches
  if (type === 'container') {
    return allPairs(present, (a, b) => containerListMatch(a, b)) ? 'fuzzy_match' : 'mismatch'
  }
  // 3. Reference/ID: strip brackets, compare core number
  if (type === 'reference') {
    return allPairs(present, (a, b) => idMatch(a, b)) ? 'fuzzy_match' : 'mismatch'
  }
  // 4. Location/port: sorted tokens + containment
  if (type === 'location') {
    return allPairs(present, (a, b) =>
      sortedTokenMatch(a, b) || tokenSetContains(a, b) || tokenSetContains(b, a)
    ) ? 'fuzzy_match' : 'mismatch'
  }
  // 5. Voyage: V. prefix already handled by normalizeDeep above; re-check sorted tokens
  if (type === 'voyage') {
    return allPairs(present, (a, b) => sortedTokenMatch(a, b)) ? 'fuzzy_match' : 'mismatch'
  }
  // 6. Company names: jaccard on meaningful tokens
  if (type === 'name') {
    return allPairs(present, (a, b) => jaccardSim(a, b) >= 0.3) ? 'fuzzy_match' : 'mismatch'
  }
  // 7. Addresses: containment or jaccard
  if (type === 'address') {
    return allPairs(present, (a, b) =>
      tokenSetContains(a, b) || tokenSetContains(b, a) || jaccardSim(a, b) >= 0.25
    ) ? 'fuzzy_match' : 'mismatch'
  }
  // 8. Date: sorted token (handles "MAY 13, 2026" vs "MAY.13,2026")
  if (type === 'date') {
    return allPairs(present, (a, b) => sortedTokenMatch(a, b)) ? 'fuzzy_match' : 'mismatch'
  }

  // 9. Generic fallback — try all methods so unknown field names still get fuzzy treatment
  if (allPairs(present, (a, b) => sortedTokenMatch(a, b))) return 'fuzzy_match'
  if (allPairs(present, (a, b) => tokenSetContains(a, b) || tokenSetContains(b, a))) return 'fuzzy_match'
  if (allPairs(present, (a, b) => idMatch(a, b))) return 'fuzzy_match'
  if (allPairs(present, (a, b) => containerListMatch(a, b))) return 'fuzzy_match'
  if (allPairs(present, (a, b) => jaccardSim(a, b) >= 0.4)) return 'fuzzy_match'

  return 'mismatch'
}

function matchStatus(a, b) {
  if (!a && !b) return 'empty'
  if (!a || !b) return 'missing'
  if (normalizeDeep(a) === normalizeDeep(b)) return 'match'
  return computeStatus(null, [a, b])
}

// Generate 3-doc sub-group combinations for N-doc mode (N=4 → 4 groups of 3)
function getGroupViews(types) {
  if (!types || types.length < 4) return []
  const groups = []
  for (let i = types.length - 1; i >= 0; i--) {
    groups.push(types.filter((_, j) => j !== i))
  }
  return groups // [BL,INV,PL], [BL,INV,FORM], [BL,PL,FORM], [INV,PL,FORM]
}

// Build unified N-doc field list from all cross-match pairs
function buildUnifiedFields(types, docDataMap) {
  // docDataMap: { [docTypeId]: ocrData object }
  const labelKeyMap = {} // label -> { [docTypeId]: fieldKey }
  for (let i = 0; i < types.length; i++) {
    for (let j = i + 1; j < types.length; j++) {
      const crossMap = getCrossMatch(types[i], types[j])
      if (!crossMap) continue
      crossMap.forEach(m => {
        if (!labelKeyMap[m.label]) labelKeyMap[m.label] = {}
        if (m.L) labelKeyMap[m.label][types[i]] = m.L
        if (m.R) labelKeyMap[m.label][types[j]] = m.R
      })
    }
  }
  return Object.entries(labelKeyMap).map(([label, typeKeyMap]) => {
    const values = {}
    types.forEach(t => {
      const key = typeKeyMap[t]
      values[t] = key ? (docDataMap[t]?.[key] ?? null) : null
    })
    const nonNull = types.map(t => values[t]).filter(v => v != null && v !== '')
    const status = computeStatus(label, types.map(t => values[t] ?? null))
    return { label, values, status, sectionIdx: getFieldSection(label) }
  })
}

// Build per-docType value table from n8n pair results (uses Gemini-analyzed values)
function buildMultiDocTableFromPairs(pairs, comboTypes, fileIdx = 0) {
  const fieldMap = {}
  ;(pairs || []).forEach(pair => {
    const fp = pair?.filePairs?.[fileIdx] ?? pair?.filePairs?.[0]
    if (!fp) return
    fp.fields.forEach(f => {
      const key = f.field
      if (!fieldMap[key]) {
        fieldMap[key] = {
          label: key,
          sectionIdx: f.sectionIdx ?? 4,
          sectionName: f.sectionName ?? '',
          values: Object.fromEntries(comboTypes.map(t => [t, null]))
        }
      }
      if (f.leftVal  != null) fieldMap[key].values[pair.leftType]  = f.leftVal
      if (f.rightVal != null) fieldMap[key].values[pair.rightType] = f.rightVal
    })
  })
  return Object.values(fieldMap).map(entry => {
    const rawVals = comboTypes.map(t => entry.values[t] ?? null)
    return { ...entry, status: computeStatus(entry.label, rawVals) }
  })
}

// Shared table renderer — multi-doc (N columns) or pair (2 columns)
function CompareTable({ fields, colDefs, isLight }) {
  const bc      = isLight ? '#e2e8f0' : '#1e293b'
  const bg2     = isLight ? 'bg-slate-100/80' : 'bg-slate-800/60'
  const subCls  = isLight ? 'text-slate-500' : 'text-slate-400'
  const valCls  = isLight ? 'text-slate-800'  : 'text-white'
  const nilCls  = isLight ? 'text-slate-400 italic' : 'text-slate-600 italic'

  const STATUS_CFG = {
    match:       { text: '✓ Match',       cls: 'bg-green-500/15 text-green-400 border border-green-500/30' },
    fuzzy_match: { text: '~ Fuzzy Match', cls: 'bg-teal-500/15 text-teal-400 border border-teal-500/30' },
    mismatch:    { text: '✗ Mismatch',    cls: 'bg-red-500/15 text-red-400 border border-red-500/30' },
    missing:     { text: '◐ Missing',     cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
    empty:       { text: 'N/A',           cls: 'bg-slate-500/10 text-slate-500 border border-slate-500/20' },
  }

  return (
    <table className="w-full border-collapse" style={{ minWidth: `${180 + colDefs.length * 150}px` }}>
      <thead className={`sticky top-0 z-10 ${isLight ? 'bg-white' : 'bg-slate-900'}`}>
        <tr>
          <th className={`text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider border-b border-r ${subCls}`}
              style={{ borderColor: bc, width: '160px' }}>Field</th>
          {colDefs.map(col => (
            <th key={col.key} className={`text-left px-3 py-2 text-[10px] font-semibold border-b border-r ${subCls}`}
                style={{ borderColor: bc }}>
              <span className="flex items-center gap-1 uppercase tracking-wider">
                {col.emoji && <span>{col.emoji}</span>}
                <span>{col.label}</span>
              </span>
            </th>
          ))}
          <th className={`text-center px-3 py-2 text-[10px] font-semibold uppercase tracking-wider border-b ${subCls}`}
              style={{ borderColor: bc, width: '92px' }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {SECTION_NAMES.map((section, si) => {
          const sFields = fields.filter(f => f.sectionIdx === si)
          if (sFields.length === 0) return null
          const tot  = sFields.filter(f => f.status !== 'empty').length
          const ok   = sFields.filter(f => f.status === 'match' || f.status === 'fuzzy_match').length
          const pct  = tot > 0 ? Math.round(ok / tot * 100) : null
          const pctC = pct === null ? subCls : pct === 100 ? 'text-green-500' : pct >= 50 ? 'text-amber-500' : 'text-red-500'
          return (
            <React.Fragment key={si}>
              <tr className={bg2}>
                <td colSpan={colDefs.length + 2} className="px-3 py-1.5 border-b" style={{ borderColor: bc }}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{section.emoji}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                      {section.num}. {section.title}
                    </span>
                    {pct !== null && (
                      <span className={`ml-auto text-[10px] font-bold ${pctC}`}>{ok}/{tot} · {pct}%</span>
                    )}
                  </div>
                </td>
              </tr>
              {sFields.map((f, fi) => {
                const rowBg = f.status === 'mismatch'
                  ? (isLight ? 'bg-red-50/50' : 'bg-red-500/5')
                  : f.status === 'missing'
                  ? (isLight ? 'bg-amber-50/30' : 'bg-amber-500/5')
                  : ''
                const sCfg = STATUS_CFG[f.status] ?? STATUS_CFG.empty
                return (
                  <tr key={fi} className={`border-b ${rowBg} ${isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-slate-800/60 hover:bg-slate-800/20'}`}>
                    <td className={`px-3 py-2 text-[11px] font-semibold border-r align-top ${subCls}`} style={{ borderColor: bc }}>
                      {f.field ?? f.label}
                    </td>
                    {colDefs.map(col => {
                      const val = f.values ? f.values[col.key] : (col.key === 'left' ? f.leftVal : f.rightVal)
                      return (
                        <td key={col.key} className="px-3 py-2 text-[11px] border-r align-top" style={{ borderColor: bc }}>
                          <span className={val ? valCls : nilCls}>{val || '—'}</span>
                        </td>
                      )
                    })}
                    <td className="px-2 py-2 text-center align-top">
                      {(() => {
                        if (f.status === 'missing' && f.values) {
                          const missingLabels = colDefs.filter(col => !f.values[col.key]).map(col => col.label)
                          return (
                            <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold ${sCfg.cls}`}>
                              ◐ Missing: {missingLabels.join(', ')}
                            </span>
                          )
                        }
                        return (
                          <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold ${sCfg.cls}`}>
                            {sCfg.text}
                          </span>
                        )
                      })()}
                    </td>
                  </tr>
                )
              })}
            </React.Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

// Re-apply smart status to pair fields that came directly from n8n
function applyFuzzyToFields(fields) {
  if (!fields) return fields
  return fields.map(f => {
    if (f.status === 'empty' || f.status === 'match') return f
    const a = f.leftVal ?? null
    const b = f.rightVal ?? null
    const newStatus = computeStatus(f.field, [a, b])
    return newStatus !== f.status ? { ...f, status: newStatus } : f
  })
}

// ── SummaryBlock ──────────────────────────────────────────────
function SummaryBlock({ fields, colDefs, isLight }) {
  const subCls     = isLight ? 'text-slate-500' : 'text-slate-400'
  const mismatches = fields.filter(f => f.status === 'mismatch')
  const missing    = fields.filter(f => f.status === 'missing')
  const matches    = fields.filter(f => f.status === 'match' || f.status === 'fuzzy_match')
  const total      = fields.length

  const mismatchNames = mismatches.map(f => f.field ?? f.label).join(', ')
  const missingNames  = missing.map(f => f.field ?? f.label).join(', ')

  return (
    <div className={`mt-2 px-3 py-2.5 rounded-xl border text-[11px] leading-relaxed ${
      isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-800/40 border-slate-700/50 text-slate-300'
    }`}>
      {mismatches.length === 0 && missing.length === 0 ? (
        <span className="font-semibold text-green-500">✓ All {total} fields match — no issues found.</span>
      ) : (
        <>
          <div>
            {mismatches.length > 0 && (
              <><span className="font-semibold text-red-400">⚠ {mismatches.length} Mismatch:</span>{' '}
              <span className={subCls}>{mismatchNames}</span></>
            )}
            {mismatches.length > 0 && missing.length > 0 && <span className={subCls}> · </span>}
            {missing.length > 0 && (
              <><span className="font-semibold text-amber-400">◌ {missing.length} Missing:</span>{' '}
              <span className={subCls}>{missingNames}</span></>
            )}
          </div>
          {matches.length > 0 && (
            <div className="mt-0.5">
              <span className="font-semibold text-green-500">✓ {matches.length} Matched:</span>{' '}
              <span className={subCls}>{matches.map(f => f.field ?? f.label).join(', ')}</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function computeStats(fields) {
  const tot  = fields.filter(f => f.status !== 'empty').length
  const ok   = fields.filter(f => f.status === 'match' || f.status === 'fuzzy_match').length
  const mm   = fields.filter(f => f.status === 'mismatch').length
  const ms   = fields.filter(f => f.status === 'missing').length
  const rate = tot > 0 ? Math.round(mm / tot * 100) : 0
  return { tot, ok, mm, ms, rate }
}

function StatsCards({ tot, ok, mm, ms, rate, subCls, isLight }) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {[
        { label: 'Fields',     val: tot,        color: subCls },
        { label: 'Match',      val: ok,         color: 'text-green-500' },
        { label: 'Mismatch',   val: mm,         color: 'text-red-500' },
        { label: 'Missing',    val: ms,         color: 'text-amber-500' },
        { label: '% Mismatch', val: `${rate}%`, color: 'text-red-500' },
      ].map(({ label, val, color }) => (
        <div key={label} className={`rounded-xl p-2 text-center border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/50 border-slate-700'}`}>
          <p className={`text-base font-bold ${color}`}>{val}</p>
          <p className={`text-[10px] mt-0.5 ${subCls}`}>{label}</p>
        </div>
      ))}
    </div>
  )
}

function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileTypeIcon({ type }) {
  if (type?.startsWith('image/')) return <Image size={14} className="text-blue-400" />
  if (type === 'application/pdf') return <FileText size={14} className="text-red-400" />
  return <File size={14} className="text-slate-400" />
}

// ── DocTypeSelector ─── locked = display only, no interaction
function DocTypeSelector({ value, isLight, locked }) {
  const cmap = isLight ? COLOR_MAP_LIGHT : COLOR_MAP
  return (
    <div className="grid grid-cols-4 gap-1">
      {DOC_TYPES.map(dt => {
        const isActive = value === dt.id
        const cls = cmap[dt.color][isActive ? 'active' : 'inactive']
        return (
          <div
            key={dt.id}
            title={dt.label}
            className={`flex flex-col items-center gap-0.5 py-1.5 rounded-xl border-2 text-xs font-bold select-none ${cls} ${
              locked ? 'cursor-default' : 'cursor-pointer'
            } ${locked && !isActive ? 'opacity-25' : ''}`}
          >
            <span className="text-sm leading-none">{dt.emoji}</span>
            <span className="text-[10px] leading-none">{dt.short}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── StatusBadge ───────────────────────────────────────────────
function StatusBadge({ status, error }) {
  if (status === 'uploading') return (
    <div className="flex items-center gap-1 text-blue-400 flex-shrink-0">
      <Loader2 size={11} className="animate-spin" />
      <span className="text-[9px]">Uploading…</span>
    </div>
  )
  if (status === 'processing') return (
    <div className="flex items-center gap-1 text-amber-400 flex-shrink-0">
      <Loader2 size={11} className="animate-spin" />
      <span className="text-[9px]">OCR…</span>
    </div>
  )
  if (status === 'completed') return <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
  if (status === 'failed') return (
    <div title={error} className="flex items-center gap-1 text-red-400 flex-shrink-0">
      <AlertCircle size={11} />
      <span className="text-[9px]">Failed</span>
    </div>
  )
  return null
}

// ── PanelColumn ───────────────────────────────────────────────
function PanelColumn({ title, emoji, docType, files, isLight, disabled, onAddFiles, onRemoveFile, onClearAll }) {
  const fileInputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const card     = isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800'
  const titleCls = isLight ? 'text-slate-900' : 'text-white'
  const subCls   = isLight ? 'text-slate-500' : 'text-slate-400'
  const divider  = isLight ? 'border-slate-100' : 'border-slate-800'
  const itemCls  = isLight
    ? 'bg-slate-50 border-slate-200 hover:border-slate-300'
    : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'

  const handleFiles = useCallback((rawFiles) => {
    const valid = Array.from(rawFiles).filter(f =>
      ACCEPTED_TYPES[f.type] && f.size <= MAX_SIZE_MB * 1024 * 1024
    )
    if (valid.length > 0) onAddFiles(valid)
  }, [onAddFiles])

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (!disabled) handleFiles(e.dataTransfer.files)
  }

  return (
    <div
      className={`h-full rounded-2xl border flex flex-col overflow-hidden transition-all duration-300 ${card} ${
        disabled ? 'opacity-30 pointer-events-none select-none' : ''
      }`}
      style={{ minHeight: 0 }}
    >
      {/* Header */}
      <div className={`px-3 pt-3 pb-2 border-b ${divider} flex-shrink-0`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{emoji}</span>
            <span className={`text-xs font-bold ${titleCls}`}>{title}</span>
          </div>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
            isLight ? 'bg-slate-100 text-slate-500' : 'bg-slate-800 text-slate-400'
          }`}>
            {files.length}/10
          </span>
        </div>
        <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${subCls}`}>Document Type</p>
        <DocTypeSelector value={docType} isLight={isLight} locked={true} />
      </div>

      {/* File list */}
      <div
        className={`flex-1 overflow-y-auto px-2.5 py-2 space-y-1.5 min-h-0 transition-colors ${
          dragOver ? (isLight ? 'bg-brand-50/60' : 'bg-brand-900/10') : ''
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {files.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center h-full min-h-[80px] py-4 text-center cursor-pointer rounded-xl border-2 border-dashed transition-colors ${
              isLight
                ? 'border-slate-200 hover:border-brand-300 hover:bg-brand-50/30'
                : 'border-slate-800 hover:border-brand-600/40 hover:bg-brand-900/5'
            }`}
          >
            <Upload size={18} className={`mb-1 ${isLight ? 'text-slate-300' : 'text-slate-700'}`} />
            <p className={`text-xs font-medium ${subCls}`}>Drop files here</p>
            <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>or click to browse</p>
          </div>
        ) : (
          files.map((item, idx) => (
            <div
              key={item.id}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-colors group ${itemCls}`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isLight ? 'bg-slate-100' : 'bg-slate-800'
              }`}>
                <FileTypeIcon type={item.file?.type} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-medium truncate ${titleCls}`}>{item.file?.name || '—'}</p>
                <p className={`text-[10px] ${subCls}`}>{formatBytes(item.file?.size)}</p>
              </div>
              <StatusBadge status={item.status} error={item.error} />
              <button
                onClick={() => onRemoveFile(idx)}
                className={`flex-shrink-0 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
                  isLight ? 'hover:bg-red-50 text-slate-400 hover:text-red-500' : 'hover:bg-red-500/10 text-slate-600 hover:text-red-400'
                }`}
              >
                <X size={11} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className={`px-2.5 pb-2.5 pt-2 flex-shrink-0 flex items-center gap-1.5 border-t ${divider}`}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          multiple
          className="hidden"
          onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
        />
        {files.length < 10 ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl text-xs font-medium border-2 border-dashed transition-all ${
              isLight
                ? 'border-slate-300 hover:border-brand-400 text-slate-500 hover:text-brand-600 hover:bg-brand-50/40'
                : 'border-slate-700 hover:border-brand-500/60 text-slate-400 hover:text-brand-400 hover:bg-brand-600/5'
            }`}
          >
            <Plus size={11} />
            + Add File ({files.length}/10)
          </button>
        ) : (
          <p className={`flex-1 text-[10px] text-center ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>Max 10 files</p>
        )}
        {files.length > 0 && (
          <button
            onClick={onClearAll}
            title="Clear all"
            className={`flex-shrink-0 p-1.5 rounded-xl border transition-colors ${
              isLight ? 'border-slate-200 hover:border-red-300 hover:bg-red-50 text-slate-400 hover:text-red-500' : 'border-slate-700 hover:border-red-500/40 hover:bg-red-500/10 text-slate-500 hover:text-red-400'
            }`}
          >
            <X size={11} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── MatchRow ──────────────────────────────────────────────────
function MatchRow({ field, leftVal, rightVal, isLight }) {
  const status = matchStatus(leftVal, rightVal)
  const cfg = {
    match:    { Icon: CheckCircle2, color: 'text-green-500', bg: isLight ? 'bg-green-50' : 'bg-green-500/5',   border: isLight ? 'border-green-200' : 'border-green-500/20' },
    mismatch: { Icon: XCircle,      color: 'text-red-500',   bg: isLight ? 'bg-red-50'   : 'bg-red-500/5',     border: isLight ? 'border-red-200'   : 'border-red-500/20' },
    missing:  { Icon: MinusCircle,  color: 'text-amber-500', bg: isLight ? 'bg-amber-50' : 'bg-amber-500/5',   border: isLight ? 'border-amber-200' : 'border-amber-500/20' },
    empty:    { Icon: MinusCircle,  color: 'text-slate-400', bg: '',                                             border: isLight ? 'border-slate-200' : 'border-slate-700/40' },
  }[status]

  const valCls  = isLight ? 'text-slate-800' : 'text-white'
  const metaCls = isLight ? 'text-slate-500' : 'text-slate-500'

  return (
    <div className={`grid grid-cols-[1fr_auto_1fr] gap-3 items-center px-3 py-2.5 rounded-xl border mb-2 ${cfg.bg} ${cfg.border}`}>
      <div>
        <p className={`text-[10px] font-medium mb-0.5 ${metaCls}`}>{field}</p>
        <p className={`text-xs font-semibold ${valCls}`}>
          {leftVal || <span className={`font-normal italic ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>—</span>}
        </p>
      </div>
      <div className="flex flex-col items-center gap-0.5 w-14">
        <cfg.Icon size={14} className={cfg.color} />
      </div>
      <div className="text-right">
        <p className={`text-[10px] font-medium mb-0.5 ${metaCls}`}>{field}</p>
        <p className={`text-xs font-semibold ${valCls}`}>
          {rightVal || <span className={`font-normal italic ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>—</span>}
        </p>
      </div>
    </div>
  )
}

// Compute row-level status + "present in" label for multi-doc
function getMultiDocRowStatus(types, values) {
  const present = types.filter(t => values[t])
  if (present.length === 0) return { status: 'empty', label: 'N/A' }
  const norms = present.map(t => normalize(values[t]))
  const allSame = norms.every(n => n === norms[0])
  if (!allSame) return { status: 'mismatch', label: '✗ Mismatch' }
  if (present.length === types.length) return { status: 'match', label: '✓ Match' }
  // some docs have value, all agreeing
  const shorts = present.map(t => DOC_TYPES.find(d => d.id === t)?.short ?? t)
  return { status: 'partial', label: shorts.join(' · ') + ' only' }
}

// ── MultiDocRow ── N-column field row for all-docs view ───────
function MultiDocRow({ label, docTypes, values, isLight }) {
  const { status: rowStatus, label: statusLabel } = getMultiDocRowStatus(docTypes, values)

  const rowBorder = {
    match:   isLight ? 'border-green-200 bg-green-50/40'    : 'border-green-500/20 bg-green-500/5',
    mismatch:isLight ? 'border-red-200 bg-red-50/40'        : 'border-red-500/20 bg-red-500/5',
    partial: isLight ? 'border-amber-200 bg-amber-50/40'    : 'border-amber-500/20 bg-amber-500/5',
    empty:   isLight ? 'border-slate-200 bg-slate-50/50'    : 'border-slate-700/30 bg-slate-800/20',
  }[rowStatus]
  const statusCls = { match: 'text-green-500', mismatch: 'text-red-400', partial: 'text-amber-400', empty: 'text-slate-400' }[rowStatus]

  return (
    <div className={`rounded-xl border mb-1.5 px-2.5 py-2 ${rowBorder}`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className={`text-[10px] font-semibold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{label}</p>
        {(() => {
          const badgeCls = {
            match:    'bg-green-500/15 text-green-400 border border-green-500/30',
            mismatch: 'bg-red-500/15 text-red-400 border border-red-500/30',
            partial:  'bg-amber-500/15 text-amber-400 border border-amber-500/30',
            empty:    'bg-slate-500/10 text-slate-500 border border-slate-500/20',
          }[rowStatus] ?? 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
          const badgeText = rowStatus === 'match' ? '✓ Match' : rowStatus === 'mismatch' ? '✗ Mismatch' : rowStatus === 'partial' ? `◐ ${statusLabel}` : 'N/A'
          return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${badgeCls}`}>{badgeText}</span>
        })()}
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${docTypes.length}, 1fr)` }}>
        {docTypes.map(t => {
          const val = values[t]
          return (
            <div key={t} className={`rounded-lg px-2 py-1 ${isLight ? 'bg-white/80' : 'bg-slate-900/60'}`}>
              <span className={`text-[11px] font-semibold leading-tight ${val ? (isLight ? 'text-slate-800' : 'text-white') : (isLight ? 'text-slate-400 italic font-normal' : 'text-slate-600 italic font-normal')}`}>
                {val || '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── PairSummaryCard ───────────────────────────────────────────
function PairSummaryCard({ pair, isLight, active, onClick }) {
  const titleCls = isLight ? 'text-slate-900' : 'text-white'
  const subCls   = isLight ? 'text-slate-500' : 'text-slate-400'
  const fp = { ...pair.filePairs[0], fields: applyFuzzyToFields(pair.filePairs[0]?.fields) }
  if (!fp) return null
  const { total, matched, pct } = fp.summary
  const pctColor = pct >= 80 ? 'text-green-500' : pct >= 50 ? 'text-amber-500' : 'text-red-500'
  const pctBg    = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'

  // mini section bars
  const sectionData = SECTION_NAMES.map((s, si) => {
    const rows = fp.fields.filter(f => f.sectionIdx === si)
    const tot  = rows.filter(r => r.status !== 'empty').length
    const ok   = rows.filter(r => r.status === 'match' || r.status === 'fuzzy_match').length
    return { ...s, tot, ok, pct: tot > 0 ? Math.round(ok / tot * 100) : null }
  })

  const border = active
    ? 'border-brand-500 ring-1 ring-brand-500/30'
    : isLight ? 'border-slate-200' : 'border-slate-700/60'

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border p-3 cursor-pointer transition-all ${border} ${
        isLight ? 'bg-white hover:border-brand-400' : 'bg-slate-900 hover:border-brand-500/60'
      }`}
    >
      {/* Pair header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-base">{pair.leftEmoji}</span>
          <span className={`text-xs font-bold ${titleCls}`}>{pair.label}</span>
          <span className="text-base">{pair.rightEmoji}</span>
        </div>
        <span className={`text-lg font-black ${pctColor}`}>{pct}%</span>
      </div>
      {/* Progress bar */}
      <div className={`h-1.5 rounded-full mb-3 ${isLight ? 'bg-slate-100' : 'bg-slate-800'}`}>
        <div className={`h-full rounded-full ${pctBg}`} style={{ width: `${pct}%` }} />
      </div>
      {/* Section mini scores */}
      <div className="grid grid-cols-6 gap-1">
        {sectionData.map(s => {
          const c = s.pct === null ? 'text-slate-500 bg-slate-800/30' : s.pct === 100 ? 'text-green-400 bg-green-500/10' : s.pct >= 50 ? 'text-amber-400 bg-amber-500/10' : 'text-red-400 bg-red-500/10'
          return (
            <div key={s.num} className={`rounded-lg p-1 text-center ${c}`}>
              <div className="text-[10px]">{s.emoji}</div>
              <div className="text-[9px] font-bold leading-none mt-0.5">{s.num}</div>
              <div className="text-[9px] leading-none mt-0.5">{s.pct !== null ? `${s.pct}%` : '—'}</div>
            </div>
          )
        })}
      </div>
      <div className={`text-[10px] mt-2 ${subCls}`}>{matched}/{total} fields matched</div>
    </div>
  )
}

// ── DetailsModal ──────────────────────────────────────────────
function DetailsModal({ pairResults, panels, selectedCombo, isLight, onClose }) {
  const showAll = pairResults.length > 1
  const groupViews = getGroupViews(selectedCombo?.types ?? [])
  // activePair: -1=ALL, -100 to -103 = group view (-(gi+100)), 0+=pair
  const [activePair, setActivePair] = useState(showAll ? -1 : 0)
  const isGroupView = activePair <= -100
  const groupIdx    = isGroupView ? -(activePair + 100) : null
  const titleCls = isLight ? 'text-slate-900' : 'text-white'
  const subCls   = isLight ? 'text-slate-500' : 'text-slate-400'
  const divider  = isLight ? 'border-slate-200' : 'border-slate-800'
  const surfCls  = isLight ? 'bg-white' : 'bg-slate-900'
  const surf2    = isLight ? 'bg-slate-50'  : 'bg-slate-800/50'

  const pair = (activePair >= 0) ? pairResults[activePair] : null
  const [activeFileIdx, setActiveFileIdx] = useState(0)
  // Reset file index when switching pair tabs
  const prevPairRef = React.useRef(activePair)
  if (prevPairRef.current !== activePair) { prevPairRef.current = activePair; if (activeFileIdx !== 0) setActiveFileIdx(0) }

  const _fp  = pair?.filePairs?.[activeFileIdx] ?? pair?.filePairs?.[0]
  const fp   = _fp ? { ..._fp, fields: applyFuzzyToFields(_fp.fields) } : undefined

  const sectionedFields = fp
    ? SECTION_NAMES.map((s, si) => ({
        ...s,
        fields: fp.fields.filter(f => f.sectionIdx === si),
      }))
    : []

  const statusMeta = {
    match:    { icon: '✓', label: 'Match',    bg: isLight ? 'bg-green-50 border-green-200' : 'bg-green-500/8 border-green-500/20', dot: 'bg-green-500' },
    mismatch: { icon: '✗', label: 'Mismatch', bg: isLight ? 'bg-red-50 border-red-200'     : 'bg-red-500/8 border-red-500/20',     dot: 'bg-red-500' },
    missing:  { icon: '–', label: 'Missing',  bg: isLight ? 'bg-amber-50 border-amber-200' : 'bg-amber-500/8 border-amber-500/20', dot: 'bg-amber-500' },
    empty:    { icon: '·', label: 'N/A',      bg: isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/40 border-slate-700/30',dot: 'bg-slate-500' },
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className={`relative w-full max-w-[96vw] max-h-[96vh] flex flex-col rounded-3xl border shadow-2xl ${surfCls} ${isLight ? 'border-slate-200' : 'border-slate-700'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b flex-shrink-0 ${divider}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-600/20 flex items-center justify-center">
              <GitCompare size={15} className="text-brand-500" />
            </div>
            <div>
              <h2 className={`font-bold text-sm ${titleCls}`}>Detailed Comparison — 6 Parts</h2>
              <p className={`text-[11px] ${subCls}`}>Field-by-field breakdown per document section</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
              isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs — ALL · 3-doc groups · pairs */}
        <div className={`flex flex-wrap gap-2 px-6 py-3 border-b flex-shrink-0 ${divider} ${surf2}`}>
          {showAll && (
            <button
              onClick={() => setActivePair(-1)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                activePair === -1
                  ? 'bg-violet-600 text-white'
                  : isLight ? 'bg-violet-50 border border-violet-200 text-violet-700 hover:border-violet-400' : 'bg-violet-900/30 text-violet-300 border border-violet-700/40 hover:bg-violet-800/40'
              }`}
            >
              📊 {selectedCombo?.types?.map(t => DOC_TYPES.find(d => d.id === t)?.short).join('·')}
            </button>
          )}
          {groupViews.map((gTypes, gi) => (
            <button
              key={`mg${gi}`}
              onClick={() => setActivePair(-(gi + 100))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                activePair === -(gi + 100)
                  ? 'bg-indigo-600 text-white'
                  : isLight ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 hover:border-indigo-400' : 'bg-indigo-900/30 text-indigo-300 border border-indigo-700/40 hover:bg-indigo-800/40'
              }`}
            >
              📊 {gTypes.map(t => DOC_TYPES.find(d => d.id === t)?.short).join('·')}
            </button>
          ))}
          {pairResults.map((pr, i) => (
            <button
              key={i}
              onClick={() => setActivePair(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                activePair === i
                  ? 'bg-brand-600 text-white'
                  : isLight ? 'bg-white border border-slate-200 text-slate-600 hover:border-brand-300' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {pr.leftEmoji} {pr.label} {pr.rightEmoji}
              <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${activePair === i ? 'bg-white/20' : isLight ? 'bg-slate-100' : 'bg-slate-700'}`}>
                {pr.filePairs[0]?.summary.pct ?? 0}%
              </span>
            </button>
          ))}
        </div>

        {/* File-pair sub-tabs — shown when a pair has multiple file pairs */}
        {activePair >= 0 && pair?.filePairs?.length > 1 && (
          <div className={`flex items-center gap-2 px-6 py-2 border-b flex-shrink-0 overflow-x-auto ${divider}`}
            style={{ scrollbarWidth: 'thin' }}>
            <span className={`text-[10px] font-semibold uppercase tracking-wider flex-shrink-0 ${subCls}`}>File pair:</span>
            {pair.filePairs.map((fp2, fi) => {
              const pct = fp2.summary?.pct ?? 0
              const isActive = fi === activeFileIdx
              return (
                <button
                  key={fi}
                  onClick={() => setActiveFileIdx(fi)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex-shrink-0 ${
                    isActive
                      ? 'bg-brand-600 text-white'
                      : isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <span className="max-w-[120px] truncate">{fp2.rightDoc ?? fp2.leftDoc}</span>
                  <span className={`text-[10px] font-bold px-1 rounded ${isActive ? 'bg-white/20' : pct >= 70 ? 'text-green-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                    {pct}%
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Legend — only for pair view */}
        {activePair >= 0 && (
          <div className={`flex items-center gap-4 px-6 py-2 border-b flex-shrink-0 ${divider} ${surf2}`}>
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${subCls}`}>Legend:</span>
            {Object.entries(statusMeta).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${v.dot}`} />
                <span className={`text-[10px] ${subCls}`}>{v.label}</span>
              </div>
            ))}
            <div className="ml-auto flex items-center gap-1">
              <span className={`text-[10px] ${subCls}`}>Left:</span>
              <span className={`text-[10px] font-bold ${titleCls}`}>{pair?.leftEmoji} {pair?.label?.split(' vs ')[0]}</span>
              <span className={`text-[10px] mx-1 ${subCls}`}>Right:</span>
              <span className={`text-[10px] font-bold ${titleCls}`}>{fp?.rightDoc ?? pair?.label?.split(' vs ')[1]}</span>
            </div>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {(activePair === -1 || isGroupView) && selectedCombo ? (() => {
            const types = isGroupView ? groupViews[groupIdx] : selectedCombo.types
            const relevantPairs = pairResults.filter(pr =>
              types.includes(pr.leftType) && types.includes(pr.rightType)
            )
            const tableFields = buildMultiDocTableFromPairs(relevantPairs, types)
            const colDefs = types.map(t => {
              const dt = DOC_TYPES.find(d => d.id === t)
              return { key: t, label: dt?.short ?? t, emoji: dt?.emoji }
            })
            const { tot, ok, mm, ms, rate } = computeStats(tableFields)
            return (
              <>
                <StatsCards tot={tot} ok={ok} mm={mm} ms={ms} rate={rate} subCls={subCls} isLight={isLight} />
                <SummaryBlock fields={tableFields} colDefs={colDefs} isLight={isLight} />
                <div className="overflow-x-auto">
                  <CompareTable fields={tableFields} colDefs={colDefs} isLight={isLight} />
                </div>
              </>
            )
          })() : (() => {
            if (!fp) return null
            const leftDT  = DOC_TYPES.find(d => d.id === pair?.leftType)
            const rightDT = DOC_TYPES.find(d => d.id === pair?.rightType)
            const pairColDefs = [
              { key: 'left',  label: leftDT?.short  ?? 'Left',  emoji: pair?.leftEmoji },
              { key: 'right', label: rightDT?.short ?? 'Right', emoji: pair?.rightEmoji },
            ]
            const { tot, ok, mm, ms, rate } = computeStats(fp.fields || [])
            return (
              <>
                <StatsCards tot={tot} ok={ok} mm={mm} ms={ms} rate={rate} subCls={subCls} isLight={isLight} />
                <SummaryBlock fields={fp.fields || []} colDefs={pairColDefs} isLight={isLight} />
                <div className="overflow-x-auto">
                  <CompareTable fields={fp.fields} colDefs={pairColDefs} isLight={isLight} />
                </div>
              </>
            )
          })()}
        </div>

        {/* Modal footer */}
        <div className={`flex items-center justify-between px-6 py-3 border-t flex-shrink-0 ${divider} ${surf2}`}>
          <span className={`text-[11px] ${subCls}`}>
            {activePair >= 0 && fp ? `${fp.summary.matched} matched · ${fp.summary.total - fp.summary.matched} issues · ${fp.summary.pct}% overall` : ''}
          </span>
          <button
            onClick={onClose}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function MatchingPage() {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const location = useLocation()

  // Dropdown state
  const [numDocs,       setNumDocs]       = useState(null)   // 2 | 3 | 4
  const [selectedCombo, setSelectedCombo] = useState(null)   // { label, types }
  // panels[i] = { docType: string, files: [] }
  const [panels,        setPanels]        = useState([])
  // Results
  const [matchResults,   setMatchResults]   = useState(null)
  const [activePairIdx,  setActivePairIdx]  = useState(0)
  const [activeGroupIdx, setActiveGroupIdx] = useState(null) // null=pair/ALL, 0+= sub-group view
  const [activeFileIdx,  setActiveFileIdx]  = useState(0)
  const [comparing,      setComparing]      = useState(false)
  const [aiComparing,    setAiComparing]    = useState(false)
  const [matchError,     setMatchError]     = useState(null)  // error message from workflow
  const [detailsOpen,    setDetailsOpen]    = useState(false)
  const [historyMode,    setHistoryMode]    = useState(false) // viewing a saved history entry

  const isConfigured = numDocs !== null && selectedCombo !== null

  // ── Restore from history navigation state ─────────────────
  useEffect(() => {
    const entry = location.state?.historyEntry
    if (!entry) return
    const { pairs, selectedCombo: combo, fileNames } = entry
    setMatchResults(pairs)
    setSelectedCombo(combo)
    setNumDocs(combo?.types?.length ?? 2)
    // Build lightweight panels (no file data, just enough for labels)
    setPanels((combo?.types ?? []).map(dt => ({
      docType: dt,
      files: (fileNames?.[dt] ?? []).map(name => ({
        file: { name },
        status: 'completed',
        data: {},
      })),
    })))
    setActivePairIdx(pairs.length > 1 ? -1 : 0)
    setActiveGroupIdx(null)
    setActiveFileIdx(0)
    setHistoryMode(true)
    // Clear location state so refresh doesn't re-apply it
    window.history.replaceState({}, '')
  }, [location.state]) // re-run whenever navigation state changes (e.g. history entry clicked while already on this page)

  // ── Dropdown handlers ──────────────────────────────────────
  function handleNumDocsChange(n) {
    setNumDocs(n)
    setSelectedCombo(null)
    setPanels([])
    setMatchResults(null)
  }

  function handleComboChange(comboIdx) {
    if (comboIdx === -1) {
      setSelectedCombo(null)
      setPanels([])
      setMatchResults(null)
      return
    }
    const combo = COMBINATION_OPTIONS[numDocs][comboIdx]
    setSelectedCombo(combo)
    setPanels(combo.types.map(docType => ({ docType, files: [] })))
    setMatchResults(null)
  }

  // ── File processing ────────────────────────────────────────
  async function processFiles(panelIdx, rawFiles) {
    const docType = panels[panelIdx]?.docType

    for (const file of rawFiles) {
      const itemId = Date.now() + Math.random()

      setPanels(prev => prev.map((p, i) => {
        if (i !== panelIdx || p.files.length >= 10) return p
        return { ...p, files: [...p.files, { id: itemId, file, status: 'uploading', data: null, error: null }] }
      }))

      const updateFile = (fn) => setPanels(prev => prev.map((p, i) =>
        i !== panelIdx ? p : { ...p, files: p.files.map(f => f.id === itemId ? fn(f) : f) }
      ))

      try {
        // Always trigger fresh OCR (no cache) so OCR workflow runs and user can verify in n8n.
        // Full upload + OCR pipeline
        const { path, publicUrl } = await uploadDocument(file)
        const doc = await createDocumentRecord({ fileName: file.name, fileSize: file.size, fileType: file.type, storagePath: path, publicUrl })
        const run = await createWorkflowRun(doc.id, docType)
        updateFile(f => ({ ...f, status: 'processing' }))

        await triggerOcrWorkflow({ documentId: doc.id, fileUrl: publicUrl, fileName: file.name, workflowType: docType, runId: run.id })

        await new Promise((resolve, reject) => {
          const channel = subscribeToWorkflowRun(run.id, (updated) => {
            if (updated.status === 'completed' || updated.status === 'failed') {
              channel.unsubscribe(); clearInterval(poll)
              updated.status === 'failed' ? reject(new Error(updated.error_message || 'OCR failed')) : resolve()
            }
          })
          const poll = setInterval(async () => {
            try {
              const latest = await getWorkflowRun(run.id)
              if (latest.status === 'completed') { clearInterval(poll); channel.unsubscribe(); resolve() }
              if (latest.status === 'failed')    { clearInterval(poll); channel.unsubscribe(); reject(new Error(latest.error_message || 'OCR failed')) }
            } catch { }
          }, 4000)
        })

        const ocrResult = await getOcrResult(doc.id)
        updateFile(f => ({ ...f, status: 'completed', data: ocrResult?.extracted_data || {}, docId: doc.id }))
      } catch (err) {
        console.error('[MatchingPage] processFiles ERROR:', err?.message, err)
        updateFile(f => ({ ...f, status: 'failed', error: err.message }))
      }
    }
  }

  function removeFile(panelIdx, fileIdx) {
    setPanels(prev => prev.map((p, i) =>
      i !== panelIdx ? p : { ...p, files: p.files.filter((_, fi) => fi !== fileIdx) }
    ))
    setMatchResults(null)
  }

  function clearFiles(panelIdx) {
    setPanels(prev => prev.map((p, i) => i !== panelIdx ? p : { ...p, files: [] }))
    setMatchResults(null)
  }

  // ── Local compare (instant, exact-match) ──────────────────
  function buildLocalPairResults() {
    const pairResults = []
    for (let i = 0; i < panels.length; i++) {
      for (let j = i + 1; j < panels.length; j++) {
        const LP = panels[i], RP = panels[j]
        const maxLen = Math.max(LP.files.length, RP.files.length)
        const filePairs = []

        for (let fi = 0; fi < maxLen; fi++) {
          const L = LP.files[fi], R = RP.files[fi]
          if (!L?.data && !R?.data) continue

          const crossMap = getCrossMatch(LP.docType, RP.docType)
          let fieldResults
          if (crossMap) {
            fieldResults = crossMap.map(m => {
              const lv = m.L ? (L?.data?.[m.L] ?? null) : null
              const rv = m.R ? (R?.data?.[m.R] ?? null) : null
              return { field: m.label, leftVal: lv, rightVal: rv, status: matchStatus(lv, rv), sectionIdx: getFieldSection(m.label) }
            })
          } else {
            const fields = MATCH_FIELDS[LP.docType] || []
            fieldResults = fields.map(f => {
              const label = formatLabel(f)
              return { field: label, leftVal: L?.data?.[f] ?? null, rightVal: R?.data?.[f] ?? null, status: matchStatus(L?.data?.[f], R?.data?.[f]), sectionIdx: getFieldSection(label) }
            })
          }
          const total   = fieldResults.filter(r => r.status !== 'empty').length
          const matched = fieldResults.filter(r => r.status === 'match' || r.status === 'fuzzy_match').length
          filePairs.push({ leftDoc: L?.file?.name || '—', rightDoc: R?.file?.name || '—', fields: fieldResults, summary: { total, matched, pct: total > 0 ? Math.round(matched / total * 100) : 0 } })
        }

        if (filePairs.length > 0) {
          const LDT = DOC_TYPES.find(d => d.id === LP.docType)
          const RDT = DOC_TYPES.find(d => d.id === RP.docType)
          pairResults.push({ label: `${LDT?.short || 'L'} vs ${RDT?.short || 'R'}`, leftEmoji: LDT?.emoji || '📄', rightEmoji: RDT?.emoji || '📄', filePairs })
        }
      }
    }
    return pairResults
  }

  // ── Compare ─── always re-run OCR fresh, then fuzzy match ────
  async function runCompare() {
    setComparing(true)
    setAiComparing(false)
    setMatchResults(null)
    setMatchError(null)

    try {
      // ── Step 1: OCR all files — reuse completed data, only re-run if needed ──
      const freshPanelsPayload = []
      const freshFileNamesMap = {}

      for (let panelIdx = 0; panelIdx < panels.length; panelIdx++) {
        const panel = panels[panelIdx]
        const docType = panel.docType
        const filesToProcess = panel.files.filter(f => f.file) // only real File objects

        if (filesToProcess.length === 0) continue

        const freshFiles = []

        for (const panelFile of filesToProcess) {
          const fileId = panelFile.id
          const updateFile = (fn) => setPanels(prev => prev.map((p, i) =>
            i !== panelIdx ? p : { ...p, files: p.files.map(f => f.id === fileId ? fn(f) : f) }
          ))

          // Reuse existing OCR result if already completed — avoids double-triggering OCR
          if (panelFile.status === 'completed' && panelFile.data) {
            freshFiles.push({ fileName: panelFile.file.name, data: panelFile.data })
            continue
          }

          // File not yet OCR'd (e.g. still uploading or failed) — run OCR now
          updateFile(f => ({ ...f, status: 'processing', data: null, error: null }))

          const { path, publicUrl } = await uploadDocument(panelFile.file)
          const doc = await createDocumentRecord({
            fileName: panelFile.file.name,
            fileSize: panelFile.file.size,
            fileType: panelFile.file.type,
            storagePath: path,
            publicUrl,
          })
          const run = await createWorkflowRun(doc.id, docType)

          await triggerOcrWorkflow({
            documentId: doc.id,
            fileUrl: publicUrl,
            fileName: panelFile.file.name,
            workflowType: docType,
            runId: run.id,
          })

          // Wait for OCR workflow to complete
          await new Promise((resolve, reject) => {
            const channel = subscribeToWorkflowRun(run.id, (updated) => {
              if (updated.status === 'completed' || updated.status === 'failed') {
                channel.unsubscribe(); clearInterval(poll)
                updated.status === 'failed'
                  ? reject(new Error(updated.error_message || 'OCR failed'))
                  : resolve()
              }
            })
            const poll = setInterval(async () => {
              try {
                const latest = await getWorkflowRun(run.id)
                if (latest.status === 'completed') { clearInterval(poll); channel.unsubscribe(); resolve() }
                if (latest.status === 'failed')    { clearInterval(poll); channel.unsubscribe(); reject(new Error(latest.error_message || 'OCR failed')) }
              } catch { /* ignore transient poll errors */ }
            }, 4000)
          })

          const ocrResult = await getOcrResult(doc.id)
          const freshData = ocrResult?.extracted_data || {}

          updateFile(f => ({ ...f, status: 'completed', data: freshData, docId: doc.id, publicUrl }))
          freshFiles.push({ fileName: panelFile.file.name, data: freshData })
        }

        if (freshFiles.length > 0) {
          freshPanelsPayload.push({ docType, files: freshFiles })
          freshFileNamesMap[docType] = freshFiles.map(f => f.fileName)
        }
      }

      if (freshPanelsPayload.length < 2) {
        throw new Error('Need at least 2 panels with OCR-completed files to compare')
      }

      // ── Step 2: Send fresh OCR data to fuzzy matching workflow ──
      setAiComparing(true)
      const result = await triggerMatchingWorkflow(freshPanelsPayload)

      if (result?.success && Array.isArray(result.pairs) && result.pairs.length > 0) {
        setMatchResults(result.pairs)
        setActivePairIdx(result.pairs.length > 1 ? -1 : 0)
        setActiveGroupIdx(null)
        setActiveFileIdx(0)
        setHistoryMode(false)

        const allFilePairs = result.pairs.flatMap(p => p.filePairs ?? [])
        const overallScore = allFilePairs.length
          ? Math.round(allFilePairs.reduce((s, fp) => s + (fp.summary?.pct ?? 0), 0) / allFilePairs.length)
          : 0

        await saveMatchingHistory({
          comboLabel: selectedCombo?.label ?? '',
          comboTypes: selectedCombo?.types ?? [],
          fileNames: freshFileNamesMap,
          overallScore,
          pairs: result.pairs,
        })
      } else {
        const detail = result?.error || result?.message || 'No comparison results returned'
        setMatchError('n8n workflow returned no results — ' + detail)
      }
    } catch (err) {
      setMatchError(err.message || 'Failed to reach matching workflow')
    } finally {
      setComparing(false)
      setAiComparing(false)
    }
  }

  const canCompare = isConfigured &&
    panels.length >= 2 &&
    panels[0].files.some(f => f.status === 'completed' && f.data) &&
    panels.slice(1).some(p => p.files.some(f => f.status === 'completed' && f.data))

  const activePair     = matchResults?.[activePairIdx]
  const activeFilePair = activePair?.filePairs?.[activeFileIdx]

  // Styles
  const card     = `rounded-2xl border ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800'}`
  const titleCls = isLight ? 'text-slate-900' : 'text-white'
  const subCls   = isLight ? 'text-slate-500' : 'text-slate-400'
  const divider  = isLight ? 'border-slate-100' : 'border-slate-800'
  const selectCls = isLight
    ? 'bg-white border-slate-200 text-slate-700 focus:border-brand-500'
    : 'bg-slate-800 border-slate-700 text-slate-200 focus:border-brand-500'
  const selectDisabledCls = isLight
    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
    : 'bg-slate-800/50 border-slate-700/50 text-slate-600 cursor-not-allowed'

  // Panel grid config
  const showBottomRow   = isConfigured && numDocs >= 3
  const panelCount      = isConfigured ? numDocs : 2
  const panelTitles     = ['Source Documents', 'Compare Documents', 'Compare Documents', 'Compare Documents']
  const panelEmojis     = ['📂', '🔍', '🔍', '🔍']
  const visibleIndices  = isConfigured
    ? Array.from({ length: numDocs }, (_, i) => i)
    : [0, 1]

  const comboOptions = numDocs ? COMBINATION_OPTIONS[numDocs] : []
  const selectedComboIdx = selectedCombo
    ? comboOptions.findIndex(c => c.label === selectedCombo.label)
    : -1

  // ── Panel renderer helper ────────────────────────────────────
  const renderPanel = (panelIdx, disabled = false) => (
    <PanelColumn
      key={panelIdx}
      title={panelTitles[panelIdx]}
      emoji={panelEmojis[panelIdx]}
      docType={panels[panelIdx]?.docType ?? null}
      files={panels[panelIdx]?.files ?? []}
      isLight={isLight}
      disabled={disabled}
      onAddFiles={files => processFiles(panelIdx, files)}
      onRemoveFile={i => removeFile(panelIdx, i)}
      onClearAll={() => clearFiles(panelIdx)}
    />
  )

  return (
    <div className={`h-full flex flex-col p-5 gap-3 ${isLight ? 'bg-[#f0f4f8]' : 'bg-slate-950'}`}>

      {/* ── Header ── */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isLight ? 'bg-brand-100' : 'bg-brand-600/20'}`}>
          <GitCompare size={18} className="text-brand-500" />
        </div>
        <div>
          <h1 className={`text-xl font-bold leading-none ${titleCls}`}>Document Matching</h1>
          <p className={`text-xs mt-0.5 ${subCls}`}>Upload local files, run OCR, then compare fields — green = match, red = mismatch</p>
        </div>
      </div>

      {/* ── Body: 2-col grid — left = dropdowns + panels, right = results ── */}
      <div className="flex-1 grid gap-4 min-h-0" style={{ gridTemplateColumns: '1fr 1.4fr' }}>

        {/* ── LEFT COLUMN: dropdowns on top, panels fill remaining height ── */}
        <div className="flex flex-col gap-2.5 min-h-0">

          {/* Dropdowns row — constrained to left column width */}
          <div className="flex gap-2.5 flex-shrink-0">
            {/* Dropdown 1 — narrow fixed width */}
            <div className="flex-shrink-0 w-48">
              <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${subCls}`}>
                No. of Document Type
              </p>
              <div className="relative">
                <select
                  value={numDocs ?? ''}
                  onChange={e => handleNumDocsChange(e.target.value ? Number(e.target.value) : null)}
                  className={`w-full appearance-none pl-3 pr-8 py-2 rounded-xl border text-sm font-medium transition-all outline-none cursor-pointer ${selectCls}`}
                >
                  <option value="">Select (2 / 3 / 4)</option>
                  <option value="2">2 Document Types</option>
                  <option value="3">3 Document Types</option>
                  <option value="4">4 Document Types</option>
                </select>
                <ChevronDown size={13} className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${subCls}`} />
              </div>
            </div>

            {/* Dropdown 2 — fills remaining left-column space */}
            <div className="flex-1 min-w-0">
              <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${subCls}`}>
                Document Types Matching Combination
              </p>
              <div className="relative">
                <select
                  value={selectedComboIdx === -1 ? '' : selectedComboIdx}
                  onChange={e => handleComboChange(e.target.value === '' ? -1 : Number(e.target.value))}
                  disabled={!numDocs}
                  className={`w-full appearance-none pl-3 pr-8 py-2 rounded-xl border text-sm font-medium transition-all outline-none ${
                    numDocs ? `cursor-pointer ${selectCls}` : selectDisabledCls
                  }`}
                >
                  <option value="">Select Matching Combination</option>
                  {comboOptions.map((combo, i) => (
                    <option key={i} value={i}>{combo.label}</option>
                  ))}
                </select>
                <ChevronDown size={13} className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${numDocs ? subCls : 'text-slate-600'}`} />
              </div>
            </div>
          </div>

          {/* Panel grid — flex-1 so it fills all remaining height */}
          <div className="flex-1 min-h-0">
            {isConfigured && numDocs === 3 ? (
              /* 3-doc: Source spans full height left, 2 Compare stacked right */
              <div className="h-full grid gap-2.5" style={{ gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
                <div style={{ gridRow: '1 / 3' }} className="min-h-0">{renderPanel(0)}</div>
                {renderPanel(1)}
                {renderPanel(2)}
              </div>
            ) : isConfigured && numDocs === 4 ? (
              /* 4-doc: 2×2 grid */
              <div className="h-full grid gap-2.5" style={{ gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
                {[0, 1, 2, 3].map(i => renderPanel(i))}
              </div>
            ) : (
              /* 2-doc or pre-config: side by side */
              <div className="h-full grid gap-2.5" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {[0, 1].map(i => renderPanel(i, !isConfigured))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN: results + compare button ── */}
        <div className="flex flex-col gap-3 min-h-0 overflow-hidden">
          {comparing ? (
            /* ── Loading state ── */
            <div className={`flex-1 ${card} flex flex-col items-center justify-center p-8 text-center gap-5`}>
              <div className="relative">
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${isLight ? 'bg-brand-50' : 'bg-brand-500/10'}`}>
                  <GitCompare size={32} className="text-brand-500" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center">
                  <Loader2 size={14} className="animate-spin text-white" />
                </div>
              </div>
              <div>
                <p className={`font-bold text-sm mb-1 ${titleCls}`}>
                  {aiComparing ? 'Waiting for AI Processing…' : 'Preparing comparison…'}
                </p>
                <p className={`text-[11px] leading-relaxed ${subCls}`}>
                  {aiComparing
                    ? <>Sending documents to n8n AI matching workflow<br />Gemini is performing fuzzy comparison across all file pairs</>
                    : <>Building comparison jobs…</>
                  }
                </p>
                {aiComparing && (
                  <p className={`text-[10px] mt-2 ${subCls} opacity-60`}>
                    This may take 30–90 seconds for multiple files
                  </p>
                )}
              </div>
              {/* Animated progress dots */}
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-brand-500"
                    style={{ animation: `pulse 1.2s ease-in-out ${i * 0.4}s infinite` }} />
                ))}
              </div>
            </div>
          ) : matchError ? (
            /* ── Error state ── */
            <div className={`flex-1 ${card} flex flex-col items-center justify-center p-8 text-center gap-4`}>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isLight ? 'bg-red-50' : 'bg-red-500/10'}`}>
                <AlertCircle size={28} className="text-red-400" />
              </div>
              <div>
                <p className="font-bold text-sm text-red-400 mb-2">Workflow Error</p>
                <p className={`text-[11px] leading-relaxed max-w-xs mx-auto ${subCls}`}>{matchError}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={runCompare}
                  disabled={!canCompare}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-colors"
                >
                  <GitCompare size={12} /> Retry
                </button>
                <button
                  onClick={() => setMatchError(null)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-slate-800 hover:bg-slate-700 text-slate-400'}`}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : !matchResults ? (
            /* ── Empty / ready state ── */
            <div className={`flex-1 ${card} flex flex-col items-center justify-center p-8 text-center`}>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${isLight ? 'bg-slate-100' : 'bg-slate-800'}`}>
                <GitCompare size={28} className={isLight ? 'text-slate-300' : 'text-slate-600'} />
              </div>
              <p className={`font-semibold text-sm ${titleCls}`}>Upload &amp; compare documents</p>
              <p className={`text-xs mt-2 leading-relaxed ${subCls}`}>
                {!isConfigured
                  ? <>Select document count &amp; combination<br />from the dropdowns on the left</>
                  : <>Add files on both sides<br />Wait for OCR to complete<br />Then click <strong>Compare Now</strong></>
                }
              </p>
            </div>
          ) : (
            <div className={`flex-1 ${card} flex flex-col overflow-hidden`}>
              {/* ── Results header ── */}
              {historyMode && (
                <div className={`px-4 py-2 flex items-center gap-2 text-xs font-medium border-b ${isLight ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'}`}>
                  <span>🕒</span>
                  <span>Viewing saved matching history — configure and compare new documents above</span>
                  <button onClick={() => { setMatchResults(null); setHistoryMode(false) }} className="ml-auto underline">Clear</button>
                </div>
              )}
              <div className={`px-4 pt-3 pb-2 border-b flex-shrink-0 ${divider}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <GitCompare size={14} className="text-brand-500" />
                    <h2 className={`font-bold text-sm ${titleCls}`}>Comparison Results</h2>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-slate-800 text-slate-400'}`}>
                      {matchResults.length} pairs
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-green-400 font-semibold">
                      ✨ AI
                    </span>
                  </div>
                  <button
                    onClick={() => setDetailsOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-colors"
                  >
                    <FileText size={11} />
                    See more Details
                  </button>
                </div>

                {/* Pair toggle tabs — ALL · 3-doc groups · pairs */}
                {(() => {
                  const showAll = matchResults.length > 1
                  const comboTypes = selectedCombo?.types ?? []
                  const groupViews = getGroupViews(comboTypes)
                  const isAllActive   = activePairIdx === -1 && activeGroupIdx === null
                  const isGroupActive = (gi) => activeGroupIdx === gi
                  const isPairActive  = (pi) => activePairIdx === pi && activeGroupIdx === null
                  return (
                    <>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {/* ALL tab */}
                      {showAll && (
                        <button
                          onClick={() => { setActivePairIdx(-1); setActiveGroupIdx(null) }}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all ${
                            isAllActive
                              ? 'bg-violet-600 text-white shadow-sm'
                              : isLight ? 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200' : 'bg-violet-900/30 text-violet-300 hover:bg-violet-800/40 border border-violet-700/40'
                          }`}
                        >
                          📊 {comboTypes.map(t => DOC_TYPES.find(d => d.id === t)?.short).join('·')}
                        </button>
                      )}
                      {/* 3-doc group tabs (4-doc mode only) */}
                      {groupViews.map((gTypes, gi) => (
                        <button
                          key={`g${gi}`}
                          onClick={() => setActiveGroupIdx(gi)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all ${
                            isGroupActive(gi)
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : isLight ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200' : 'bg-indigo-900/30 text-indigo-300 hover:bg-indigo-800/40 border border-indigo-700/40'
                          }`}
                        >
                          📊 {gTypes.map(t => DOC_TYPES.find(d => d.id === t)?.short).join('·')}
                        </button>
                      ))}
                      {/* Pair tabs */}
                      {matchResults.map((pair, i) => {
                        const fp = pair.filePairs[activeFileIdx] ?? pair.filePairs[0]
                        const pct = fp?.summary.pct ?? 0
                        const pctColor = pct >= 80 ? 'text-green-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400'
                        return (
                          <button
                            key={i}
                            onClick={() => { setActivePairIdx(i); setActiveGroupIdx(null) }}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all ${
                              isPairActive(i)
                                ? 'bg-brand-600 text-white shadow-sm'
                                : isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            {pair.leftEmoji} {pair.label} {pair.rightEmoji}
                            {fp && (
                              <span className={`text-[10px] font-bold ml-0.5 ${isPairActive(i) ? 'text-white/80' : pctColor}`}>
                                {pct}%
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {/* File-pair sub-tabs — shown when there are multiple file pairs */}
                    {(() => {
                      const maxFP = Math.max(...matchResults.map(p => p.filePairs?.length ?? 1))
                      if (maxFP <= 1) return null
                      // Use first pair to derive labels (rightDoc names)
                      const refPair = matchResults.find(p => p.filePairs?.length > 1) ?? matchResults[0]
                      return (
                        <div className={`flex items-center gap-1.5 px-1 py-2 border-t flex-wrap ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                          <span className={`text-[10px] font-semibold uppercase tracking-wider flex-shrink-0 mr-1 ${subCls}`}>คู่เอกสาร:</span>
                          {refPair.filePairs.map((fp2, fi) => {
                            const pct = fp2.summary?.pct ?? 0
                            const pctColor = pct >= 70 ? 'text-green-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400'
                            const label = fp2.rightDoc?.replace(/\.[^.]+$/, '').replace(/^\(R\)/, '').trim() ?? `Pair ${fi + 1}`
                            const shortLabel = label.length > 20 ? label.slice(0, 20) + '…' : label
                            const isActive = fi === activeFileIdx
                            return (
                              <button
                                key={fi}
                                onClick={() => setActiveFileIdx(fi)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all flex-shrink-0 ${
                                  isActive
                                    ? 'bg-brand-600 text-white shadow-sm'
                                    : isLight
                                      ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                              >
                                <span className="max-w-[140px] truncate">{shortLabel}</span>
                                <span className={`font-bold ${isActive ? 'text-white/80' : pctColor}`}>{pct}%</span>
                              </button>
                            )
                          })}
                        </div>
                      )
                    })()}
                    </>
                  )
                })()}

                {/* Summary stats + summary text */}
                {(() => {
                  const docDataMap = Object.fromEntries(panels.map(p => [p.docType, p.files.find(f => f.status === 'completed')?.data ?? {}]))
                  const groupViews = getGroupViews(selectedCombo?.types ?? [])

                  const multiTypes = activeGroupIdx !== null
                    ? groupViews[activeGroupIdx]
                    : activePairIdx === -1 ? selectedCombo?.types : null

                  if (multiTypes) {
                    const relevantPairs = (matchResults || []).filter(pr =>
                      multiTypes.includes(pr.leftType) && multiTypes.includes(pr.rightType)
                    )
                    const statsFields = relevantPairs.length > 0
                      ? buildMultiDocTableFromPairs(relevantPairs, multiTypes, activeFileIdx)
                      : buildUnifiedFields(multiTypes, docDataMap)
                    const { tot, ok, mm, ms, rate } = computeStats(statsFields)
                    const colDefs = multiTypes.map(t => {
                      const dt = DOC_TYPES.find(d => d.id === t)
                      return { key: t, label: dt?.short ?? t, emoji: dt?.emoji }
                    })
                    return (
                      <>
                        <StatsCards tot={tot} ok={ok} mm={mm} ms={ms} rate={rate} subCls={subCls} isLight={isLight} />
                        <SummaryBlock fields={statsFields} colDefs={colDefs} isLight={isLight} />
                      </>
                    )
                  }
                  // Pair view
                  const _fp0 = matchResults[activePairIdx]?.filePairs?.[activeFileIdx] ?? matchResults[activePairIdx]?.filePairs?.[0]
                  const pair = matchResults[activePairIdx]
                  if (!_fp0 || !pair) return null
                  const fp = { ..._fp0, fields: applyFuzzyToFields(_fp0.fields || []) }
                  const { tot, ok, mm, ms, rate } = computeStats(fp.fields)
                  const leftDT  = DOC_TYPES.find(d => d.id === pair.leftType)
                  const rightDT = DOC_TYPES.find(d => d.id === pair.rightType)
                  const pairColDefs = [
                    { key: 'left',  label: leftDT?.short  ?? 'Left',  emoji: pair.leftEmoji },
                    { key: 'right', label: rightDT?.short ?? 'Right', emoji: pair.rightEmoji },
                  ]
                  return (
                    <>
                      <StatsCards tot={tot} ok={ok} mm={mm} ms={ms} rate={rate} subCls={subCls} isLight={isLight} />
                      <SummaryBlock fields={fp.fields} colDefs={pairColDefs} isLight={isLight} />
                    </>
                  )
                })()}
              </div>

              {/* ── Scrollable field list with 6-section headers ── */}
              {(() => {
                const docDataMap = Object.fromEntries(
                  panels.map(p => [p.docType, p.files.find(f => f.status === 'completed')?.data ?? {}])
                )
                const groupViews = getGroupViews(selectedCombo?.types ?? [])
                const multiTypes = activeGroupIdx !== null
                  ? groupViews[activeGroupIdx]
                  : activePairIdx === -1 ? selectedCombo?.types : null

                // ── Multi-doc view (ALL or 3-doc group) — TABLE ──
                if (multiTypes) {
                  const relevantPairs = (matchResults || []).filter(pr =>
                    multiTypes.includes(pr.leftType) && multiTypes.includes(pr.rightType)
                  )
                  const tableFields = buildMultiDocTableFromPairs(relevantPairs, multiTypes, activeFileIdx)
                  const colDefs = multiTypes.map(t => {
                    const dt = DOC_TYPES.find(d => d.id === t)
                    return { key: t, label: dt?.short ?? t, emoji: dt?.emoji }
                  })
                  return (
                    <div className="flex-1 overflow-auto min-h-0">
                      <CompareTable fields={tableFields} colDefs={colDefs} isLight={isLight} />
                    </div>
                  )
                }

                // ── Pair view (2-column) — TABLE ──
                const _fpRaw = matchResults[activePairIdx]?.filePairs?.[activeFileIdx] ?? matchResults[activePairIdx]?.filePairs?.[0]
                if (!_fpRaw) return null
                const pair = matchResults[activePairIdx]
                const fuzzyPairFields = applyFuzzyToFields(_fpRaw.fields || [])
                const leftDT  = DOC_TYPES.find(d => d.id === pair.leftType)
                const rightDT = DOC_TYPES.find(d => d.id === pair.rightType)
                const pairColDefs = [
                  { key: 'left',  label: leftDT?.short  ?? pair.label?.split(' vs ')[0] ?? 'Left',  emoji: pair.leftEmoji },
                  { key: 'right', label: rightDT?.short ?? pair.label?.split(' vs ')[1] ?? 'Right', emoji: pair.rightEmoji },
                ]
                return (
                  <div className="flex-1 overflow-auto min-h-0">
                    <CompareTable
                      fields={fuzzyPairFields.map(f => ({ ...f, field: f.field, sectionIdx: f.sectionIdx }))}
                      colDefs={pairColDefs}
                      isLight={isLight}
                    />
                  </div>
                )
              })()}
            </div>
          )}

          {/* Compare Now button */}
          <button
            onClick={runCompare}
            disabled={!canCompare || comparing}
            className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all duration-200 flex-shrink-0 ${
              canCompare && !comparing
                ? 'btn-primary'
                : isLight ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {comparing ? <Loader2 size={18} className="animate-spin" /> : <GitCompare size={18} />}
            {comparing
              ? (aiComparing ? 'Waiting for AI Processing…' : 'Preparing…')
              : matchError ? 'Retry Compare'
              : 'Compare Now'}
          </button>
        </div>
      </div>

      {/* ── Details Modal ── */}
      {detailsOpen && matchResults && (
        <DetailsModal
          pairResults={matchResults}
          panels={panels}
          selectedCombo={selectedCombo}
          isLight={isLight}
          onClose={() => setDetailsOpen(false)}
        />
      )}
    </div>
  )
}
