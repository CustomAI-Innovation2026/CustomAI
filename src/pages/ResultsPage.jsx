import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  CheckCircle2, Copy, Download, ArrowLeft, FileText,
  Building2, Calendar, DollarSign, Hash, Tag, Table2,
  Loader2, AlertCircle, ExternalLink, ChevronLeft, ChevronRight,
  Eye, EyeOff, MapPin, Package, Anchor, Ship, Globe, CreditCard, ChevronDown, ChevronUp
} from 'lucide-react'
import { getOcrResult, supabase } from '../lib/supabase.js'
import { useTheme } from '../lib/theme.jsx'

// ── Field Schemas per Document Type ─────────────────────────
const FIELD_SCHEMAS = {
  bill_of_lading: [
    { key: 'bl_number',             label: 'BL Number',           icon: Hash,       color: 'text-purple-400' },
    { key: 'document_number',       label: 'Document Number',     icon: Hash,       color: 'text-purple-400' },
    { key: 'bl_issue_date',         label: 'Issue Date',          icon: Calendar,   color: 'text-yellow-400' },
    { key: 'laden_on_board_date',   label: 'Laden on Board',      icon: Calendar,   color: 'text-orange-400' },
    { key: 'original_bl_count',     label: 'Original BL Count',   icon: FileText,   color: 'text-slate-400' },
    { key: 'service_type',          label: 'Service Type',        icon: Tag,        color: 'text-cyan-400' },
    { key: 'freight_terms',         label: 'Freight Terms',       icon: FileText,   color: 'text-amber-400' },
    { key: 'shipper_name',          label: 'Shipper',             icon: Building2,  color: 'text-blue-400' },
    { key: 'shipper_address',       label: 'Shipper Address',     icon: MapPin,     color: 'text-blue-400' },
    { key: 'consignee_name',        label: 'Consignee',           icon: Building2,  color: 'text-green-400' },
    { key: 'consignee_address',     label: 'Consignee Address',   icon: MapPin,     color: 'text-green-400' },
    { key: 'notify_party_name',     label: 'Notify Party',        icon: Building2,  color: 'text-teal-400' },
    { key: 'notify_party_email',    label: 'Notify Email',        icon: Tag,        color: 'text-teal-400' },
    { key: 'vessel_name',           label: 'Vessel',              icon: Ship,       color: 'text-indigo-400' },
    { key: 'voyage_number',         label: 'Voyage Number',       icon: Hash,       color: 'text-indigo-400' },
    { key: 'place_of_receipt',      label: 'Place of Receipt',    icon: MapPin,     color: 'text-slate-400' },
    { key: 'port_of_loading',       label: 'Port of Loading',     icon: Anchor,     color: 'text-blue-400' },
    { key: 'port_of_discharge',     label: 'Port of Discharge',   icon: Anchor,     color: 'text-blue-400' },
    { key: 'place_of_delivery',     label: 'Place of Delivery',   icon: MapPin,     color: 'text-blue-400' },
    { key: 'container_number',       label: 'Container Number',    icon: Package,    color: 'text-slate-400' },
    { key: 'container_volume_type', label: 'Container Type',      icon: Package,    color: 'text-slate-400' },
    { key: 'container_size_type',   label: 'Container Size',      icon: Tag,        color: 'text-slate-400' },
    { key: 'seal_number',           label: 'Seal Number',         icon: Tag,        color: 'text-slate-400' },
    { key: 'total_packages_count',  label: 'Total Packages',      icon: Package,    color: 'text-green-400' },
    { key: 'total_packages_unit',   label: 'Package Unit',        icon: Tag,        color: 'text-green-400' },
    { key: 'total_containers_count',label: 'Total Containers',    icon: Package,    color: 'text-green-400' },
    { key: 'gross_weight_kgs',      label: 'Gross Weight (KGS)',  icon: Package,    color: 'text-green-400' },
    { key: 'net_weight_kgs',        label: 'Net Weight (KGS)',    icon: Package,    color: 'text-green-400' },
    { key: 'measurement_cbm',       label: 'Measurement (CBM)',   icon: Package,    color: 'text-green-400' },
    { key: 'hs_code',               label: 'HS Code',             icon: Hash,       color: 'text-violet-400' },
    { key: 'cargo_description',     label: 'Cargo Description',   icon: FileText,   color: 'text-slate-400' },
    { key: 'country_of_origin',     label: 'Country of Origin',   icon: Globe,      color: 'text-slate-400' },
    { key: 'marks_and_numbers',      label: 'Marks & Numbers',     icon: Hash,       color: 'text-slate-400' },
    { key: 'cargo_item_1',          label: 'Product Item 1',      icon: Package,    color: 'text-slate-300' },
    { key: 'cargo_item_2',          label: 'Product Item 2',      icon: Package,    color: 'text-slate-300' },
    { key: 'cargo_item_3',          label: 'Product Item 3',      icon: Package,    color: 'text-slate-300' },
    { key: 'cargo_item_4',          label: 'Product Item 4',      icon: Package,    color: 'text-slate-300' },
    { key: 'cargo_item_5',          label: 'Product Item 5',      icon: Package,    color: 'text-slate-300' },
    { key: 'cargo_item_6',          label: 'Product Item 6',      icon: Package,    color: 'text-slate-300' },
    { key: 'signatory_company',     label: 'Signatory Company',   icon: Building2,  color: 'text-amber-400' },
    { key: 'signatory_name',        label: 'Signatory',           icon: FileText,   color: 'text-amber-400' },
    { key: 'prepaid_at',            label: 'Prepaid At',          icon: MapPin,     color: 'text-slate-400' },
    { key: 'collect_at',            label: 'Collect At',          icon: MapPin,     color: 'text-slate-400' },
  ],
  invoice: [
    { key: 'invoice_number',        label: 'Invoice #',           icon: Hash,       color: 'text-purple-400' },
    { key: 'invoice_date',          label: 'Invoice Date',        icon: Calendar,   color: 'text-yellow-400' },
    { key: 'sales_order_number',    label: 'Sales Order #',       icon: Hash,       color: 'text-violet-400' },
    { key: 'lc_number',             label: 'LC Number',           icon: Hash,       color: 'text-violet-400' },
    { key: 'lc_date',               label: 'LC Date',             icon: Calendar,   color: 'text-orange-400' },
    { key: 'po_number',             label: 'PO Number',           icon: Hash,       color: 'text-violet-400' },
    { key: 'booking_number',        label: 'Booking Number',      icon: Hash,       color: 'text-slate-400' },
    { key: 'shipper_name',          label: 'Shipper',             icon: Building2,  color: 'text-blue-400' },
    { key: 'shipper_address',       label: 'Shipper Address',     icon: MapPin,     color: 'text-blue-400' },
    { key: 'buyer_name',            label: 'Buyer',               icon: Building2,  color: 'text-green-400' },
    { key: 'buyer_address',         label: 'Buyer Address',       icon: MapPin,     color: 'text-green-400' },
    { key: 'notify_party_name',     label: 'Notify Party',        icon: Building2,  color: 'text-teal-400' },
    { key: 'vessel_name',           label: 'Vessel',              icon: Ship,       color: 'text-indigo-400' },
    { key: 'voyage_number',         label: 'Voyage Number',       icon: Hash,       color: 'text-indigo-400' },
    { key: 'port_of_loading',       label: 'Port of Loading',     icon: Anchor,     color: 'text-blue-400' },
    { key: 'final_destination',     label: 'Final Destination',   icon: MapPin,     color: 'text-blue-400' },
    { key: 'sailing_date',          label: 'Sailing Date',        icon: Calendar,   color: 'text-orange-400' },
    { key: 'incoterm',              label: 'Incoterm',            icon: Tag,        color: 'text-cyan-400' },
    { key: 'incoterm_destination',  label: 'Incoterm Dest.',      icon: MapPin,     color: 'text-cyan-400' },
    { key: 'payment_term',          label: 'Payment Term',        icon: FileText,   color: 'text-amber-400' },
    { key: 'container_number',      label: 'Container #',         icon: Package,    color: 'text-slate-400' },
    { key: 'container_volume_type', label: 'Container Type',      icon: Package,    color: 'text-slate-400' },
    { key: 'container_size_type',   label: 'Container Size',      icon: Tag,        color: 'text-slate-400' },
    { key: 'seal_number',           label: 'Seal Number',         icon: Tag,        color: 'text-slate-400' },
    { key: 'currency',              label: 'Currency',            icon: Tag,        color: 'text-cyan-400' },
    { key: 'total_quantity_pcs',    label: 'Total Qty (PCS)',     icon: Package,    color: 'text-green-400' },
    { key: 'total_cartons',         label: 'Total Cartons',       icon: Package,    color: 'text-green-400' },
    { key: 'total_net_weight_kgs',  label: 'Net Weight (KGS)',    icon: Package,    color: 'text-green-400' },
    { key: 'total_gross_weight_kgs',label: 'Gross Weight (KGS)',  icon: Package,    color: 'text-green-400' },
    { key: 'total_amount',          label: 'Total Amount',        icon: DollarSign, color: 'text-green-300' },
    { key: 'fob_value',             label: 'FOB Value',           icon: DollarSign, color: 'text-green-400' },
    { key: 'bank_name',             label: 'Bank Name',           icon: CreditCard, color: 'text-teal-400' },
    { key: 'bank_account_number',   label: 'Bank Account',        icon: CreditCard, color: 'text-teal-400' },
    { key: 'bank_swift_code',       label: 'SWIFT Code',          icon: CreditCard, color: 'text-teal-400' },
    { key: 'marks_and_numbers',     label: 'Marks & Numbers',     icon: Hash,       color: 'text-slate-400' },
    { key: 'signatory_name',        label: 'Signatory',           icon: FileText,   color: 'text-amber-400' },
  ],
  packing_list: [
    { key: 'invoice_number',        label: 'Invoice #',           icon: Hash,       color: 'text-purple-400' },
    { key: 'invoice_date',          label: 'Invoice Date',        icon: Calendar,   color: 'text-yellow-400' },
    { key: 'sales_order',           label: 'Sales Order',         icon: Hash,       color: 'text-violet-400' },
    { key: 'po_number',             label: 'PO Number',           icon: Hash,       color: 'text-violet-400' },
    { key: 'booking_number',        label: 'Booking Number',      icon: Hash,       color: 'text-slate-400' },
    { key: 'shipper_name',          label: 'Shipper',             icon: Building2,  color: 'text-blue-400' },
    { key: 'ship_to_name',          label: 'Ship To',             icon: Building2,  color: 'text-green-400' },
    { key: 'ship_to_address',       label: 'Ship To Address',     icon: MapPin,     color: 'text-green-400' },
    { key: 'notify_party_name',     label: 'Notify Party',        icon: Building2,  color: 'text-teal-400' },
    { key: 'vessel_name',           label: 'Vessel',              icon: Ship,       color: 'text-indigo-400' },
    { key: 'voyage_number',         label: 'Voyage Number',       icon: Hash,       color: 'text-indigo-400' },
    { key: 'port_of_loading',       label: 'Port of Loading',     icon: Anchor,     color: 'text-blue-400' },
    { key: 'final_destination',     label: 'Final Destination',   icon: MapPin,     color: 'text-blue-400' },
    { key: 'sailing_date',          label: 'Sailing Date',        icon: Calendar,   color: 'text-orange-400' },
    { key: 'container_number',      label: 'Container #',         icon: Package,    color: 'text-slate-400' },
    { key: 'container_volume_type', label: 'Container Type',      icon: Package,    color: 'text-slate-400' },
    { key: 'container_size_type',   label: 'Container Size',      icon: Tag,        color: 'text-slate-400' },
    { key: 'seal_number',           label: 'Seal Number',         icon: Tag,        color: 'text-slate-400' },
    { key: 'rot_number',            label: 'ROT Number',          icon: Hash,       color: 'text-slate-400' },
    { key: 'delivery_order_number', label: 'Delivery Order #',    icon: Hash,       color: 'text-slate-400' },
    { key: 'port',                  label: 'Port',                icon: Anchor,     color: 'text-blue-400' },
    { key: 'total_pallets',         label: 'Total Pallets',       icon: Package,    color: 'text-green-400' },
    { key: 'total_quantity_pcs',    label: 'Total Qty (PCS)',     icon: Package,    color: 'text-green-400' },
    { key: 'total_cartons',         label: 'Total Cartons (C/T)', icon: Package,    color: 'text-green-400' },
    { key: 'total_net_weight_kgs',  label: 'Net Weight (KGS)',    icon: Package,    color: 'text-green-400' },
    { key: 'total_gross_weight_kgs',label: 'Gross Weight (KGS)',  icon: Package,    color: 'text-green-400' },
    { key: 'total_measurement_cbm', label: 'Total CBM',           icon: Package,    color: 'text-green-400' },
    { key: 'marks_and_numbers',     label: 'Marks & Numbers',     icon: Hash,       color: 'text-slate-400' },
    { key: 'signatory_name',        label: 'Signatory',           icon: FileText,   color: 'text-amber-400' },
  ],
  form_d: [
    { key: 'reference_no',              label: 'Reference No.',        icon: Hash,      color: 'text-purple-400' },
    { key: 'form_type',                 label: 'Form Type',            icon: FileText,  color: 'text-slate-400' },
    { key: 'issuing_country',           label: 'Issuing Country',      icon: Globe,     color: 'text-blue-400' },
    { key: 'importing_country',         label: 'Importing Country',    icon: Globe,     color: 'text-blue-400' },
    { key: 'exporter_name',             label: 'Exporter',             icon: Building2, color: 'text-blue-400' },
    { key: 'exporter_address',          label: 'Exporter Address',     icon: MapPin,    color: 'text-blue-400' },
    { key: 'consignee_name',            label: 'Consignee',            icon: Building2, color: 'text-green-400' },
    { key: 'consignee_address',         label: 'Consignee Address',    icon: MapPin,    color: 'text-green-400' },
    { key: 'vessel_name',               label: 'Vessel / Transport',   icon: Ship,      color: 'text-indigo-400' },
    { key: 'departure_date',            label: 'Departure Date',       icon: Calendar,  color: 'text-yellow-400' },
    { key: 'port_of_discharge',         label: 'Port of Discharge',    icon: Anchor,    color: 'text-blue-400' },
    { key: 'declaration_place_date',    label: 'Declaration Date',     icon: Calendar,  color: 'text-orange-400' },
    { key: 'certification_place_date',  label: 'Cert. Date',           icon: Calendar,  color: 'text-orange-400' },
    { key: 'issuing_office',            label: 'Issuing Office',       icon: Building2, color: 'text-teal-400' },
    { key: 'hs_code',                    label: 'HS Code',              icon: Hash,      color: 'text-violet-400' },
    { key: 'origin_criterion',           label: 'Origin Criterion',     icon: Tag,       color: 'text-cyan-400' },
    { key: 'goods_description',          label: 'Goods Description',    icon: FileText,  color: 'text-slate-400' },
    { key: 'marks_and_numbers',          label: 'Marks & Numbers',      icon: Hash,      color: 'text-slate-400' },
    { key: 'third_country_invoicing',    label: 'Third Country',        icon: Tag,       color: 'text-amber-400' },
    { key: 'accumulation',               label: 'Accumulation',         icon: Tag,       color: 'text-amber-400' },
    { key: 'back_to_back_co',            label: 'Back-to-Back C/O',    icon: Tag,       color: 'text-amber-400' },
    { key: 'issued_retroactively',       label: 'Issued Retroactively', icon: Tag,       color: 'text-amber-400' },
    { key: 'exporter_declaration_country', label: 'Decl. Country',     icon: Globe,     color: 'text-slate-400' },
    { key: 'container_number',           label: 'Container Number',     icon: Package,   color: 'text-slate-400' },
  ],
}

// ── 6-Section groupings per document type ───────────────────
const FIELD_SECTIONS = {
  bill_of_lading: [
    { num: '1', title: 'Shipper',            emoji: '🏭',
      keys: ['shipper_name','shipper_address'] },
    { num: '2', title: 'Consignee (Bill To)', emoji: '🏢',
      keys: ['consignee_name','consignee_address','notify_party_name','notify_party_email'] },
    { num: '3', title: 'Vessel & Port',       emoji: '⚓',
      keys: ['vessel_name','voyage_number','place_of_receipt','port_of_loading','port_of_discharge','place_of_delivery'] },
    { num: '4', title: 'Container',           emoji: '📦',
      keys: ['container_number','container_volume_type','container_size_type','seal_number','total_containers_count'] },
    { num: '5', title: 'Product & Volume',    emoji: '📊',
      keys: ['total_packages_count','total_packages_unit','gross_weight_kgs','net_weight_kgs','measurement_cbm','hs_code','country_of_origin','cargo_item_1','cargo_item_2','cargo_item_3','cargo_item_4','cargo_item_5','cargo_item_6'] },
    { num: '6', title: 'Mark & Reference',    emoji: '🔖',
      keys: ['marks_and_numbers','bl_number','document_number','bl_issue_date','laden_on_board_date','original_bl_count','service_type','freight_terms','signatory_company','signatory_name','prepaid_at','collect_at'] },
  ],
  invoice: [
    { num: '1', title: 'Shipper',            emoji: '🏭',
      keys: ['shipper_name','shipper_address'] },
    { num: '2', title: 'Consignee (Bill To)', emoji: '🏢',
      keys: ['buyer_name','buyer_address','notify_party_name'] },
    { num: '3', title: 'Vessel & Port',       emoji: '⚓',
      keys: ['vessel_name','voyage_number','port_of_loading','final_destination','sailing_date'] },
    { num: '4', title: 'Container',           emoji: '📦',
      keys: ['container_number','container_volume_type','container_size_type','seal_number'] },
    { num: '5', title: 'Product & Volume',    emoji: '📊',
      keys: ['incoterm','incoterm_destination','payment_term','currency','total_quantity_pcs','total_cartons','total_net_weight_kgs','total_gross_weight_kgs','total_amount','fob_value','bank_name','bank_account_number','bank_swift_code'] },
    { num: '6', title: 'Mark & Reference',    emoji: '🔖',
      keys: ['marks_and_numbers','invoice_number','invoice_date','sales_order_number','lc_number','lc_date','po_number','booking_number','signatory_name'] },
  ],
  packing_list: [
    { num: '1', title: 'Shipper',              emoji: '🏭',
      keys: ['shipper_name'] },
    { num: '2', title: 'Consignee (Ship To)',   emoji: '🏢',
      keys: ['ship_to_name','ship_to_address','notify_party_name'] },
    { num: '3', title: 'Vessel & Port',         emoji: '⚓',
      keys: ['vessel_name','voyage_number','port_of_loading','final_destination','sailing_date'] },
    { num: '4', title: 'Container',             emoji: '📦',
      keys: ['container_number','container_volume_type','container_size_type','seal_number','rot_number','delivery_order_number'] },
    { num: '5', title: 'Product & Volume',      emoji: '📊',
      keys: ['total_pallets','total_quantity_pcs','total_cartons','total_net_weight_kgs','total_gross_weight_kgs','total_measurement_cbm'] },
    { num: '6', title: 'Mark & Reference',      emoji: '🔖',
      keys: ['marks_and_numbers','invoice_number','invoice_date','sales_order','po_number','booking_number','signatory_name'] },
  ],
  form_d: [
    { num: '1', title: 'Exporter',           emoji: '🏭',
      keys: ['exporter_name','exporter_address'] },
    { num: '2', title: 'Consignee',           emoji: '🏢',
      keys: ['consignee_name','consignee_address'] },
    { num: '3', title: 'Vessel & Port',       emoji: '⚓',
      keys: ['vessel_name','departure_date','port_of_discharge','issuing_country','importing_country','exporter_declaration_country'] },
    { num: '4', title: 'Container',           emoji: '📦',
      keys: ['container_number'] },
    { num: '5', title: 'Product & Volume',    emoji: '📊',
      keys: ['hs_code','origin_criterion','goods_description'] },
    { num: '6', title: 'Mark & Reference',    emoji: '🔖',
      keys: ['reference_no','form_type','marks_and_numbers','declaration_place_date','certification_place_date','issuing_office','third_country_invoicing','accumulation','back_to_back_co','issued_retroactively'] },
  ],
}

// BL document layout template — defines visual zones matching BL paper layout
// Used in Pages tab to position field groups spatially
const DOC_LAYOUT_ZONES = {
  bill_of_lading: [
    { zone: 'top-right',    label: 'Voyage & Reference',  keys: ['vessel_name','voyage_number','bl_number','bl_issue_date','freight_terms','service_type'] },
    { zone: 'mid-left',     label: 'Shipper',             keys: ['shipper_name','shipper_address'] },
    { zone: 'mid-right',    label: 'Port Routing',        keys: ['place_of_receipt','port_of_loading','port_of_discharge','place_of_delivery','laden_on_board_date'] },
    { zone: 'mid-left-2',   label: 'Consignee',           keys: ['consignee_name','consignee_address'] },
    { zone: 'mid-left-3',   label: 'Notify Party',        keys: ['notify_party_name','notify_party_email'] },
    { zone: 'cargo',        label: 'Container & Cargo',   keys: ['total_containers_count','total_packages_count','total_packages_unit','gross_weight_kgs','measurement_cbm'] },
    { zone: 'bottom',       label: 'Cargo Description',   keys: ['cargo_description','country_of_origin','original_bl_count'] },
    { zone: 'footer',       label: 'Signatory',           keys: ['signatory_company','signatory_name','prepaid_at','collect_at'] },
  ],
  invoice: [
    { zone: 'top-right',    label: 'Invoice Reference',   keys: ['invoice_number','invoice_date','po_number','sales_order_number','lc_number'] },
    { zone: 'mid-left',     label: 'Shipper / Seller',    keys: ['shipper_name','shipper_address'] },
    { zone: 'mid-right',    label: 'Vessel & Shipment',   keys: ['vessel_name','voyage_number','port_of_loading','final_destination','sailing_date'] },
    { zone: 'mid-left-2',   label: 'Buyer / Consignee',   keys: ['buyer_name','buyer_address','notify_party_name'] },
    { zone: 'mid-right-2',  label: 'Terms',               keys: ['incoterm','incoterm_destination','payment_term','currency','booking_number'] },
    { zone: 'mid-left-3',   label: 'Container',           keys: ['container_number','container_volume_type'] },
    { zone: 'cargo',        label: 'Totals',              keys: ['total_quantity_pcs','total_cartons','total_amount','fob_value'] },
    { zone: 'footer',       label: 'Bank & Signatory',    keys: ['bank_name','bank_account_number','bank_swift_code','signatory_name'] },
  ],
  packing_list: [
    { zone: 'top-right',    label: 'Reference',           keys: ['invoice_number','invoice_date','po_number','sales_order','booking_number'] },
    { zone: 'mid-left',     label: 'Shipper',             keys: ['shipper_name'] },
    { zone: 'mid-right',    label: 'Vessel & Port',       keys: ['vessel_name','voyage_number','port_of_loading','final_destination','sailing_date'] },
    { zone: 'mid-left-2',   label: 'Ship To',             keys: ['ship_to_name','ship_to_address','notify_party_name'] },
    { zone: 'mid-right-2',  label: 'Container',           keys: ['container_number','container_volume_type'] },
    { zone: 'cargo',        label: 'Totals',              keys: ['total_pallets','total_quantity_pcs','total_cartons','total_net_weight_kgs','total_gross_weight_kgs','total_measurement_cbm'] },
    { zone: 'footer',       label: 'Signatory',           keys: ['signatory_name'] },
  ],
  form_d: [
    { zone: 'top-right',    label: 'Reference',           keys: ['reference_no','form_type','issuing_country','importing_country'] },
    { zone: 'mid-left',     label: 'Exporter',            keys: ['exporter_name','exporter_address'] },
    { zone: 'mid-right',    label: 'Vessel & Departure',  keys: ['vessel_name','departure_date','port_of_discharge'] },
    { zone: 'mid-left-2',   label: 'Consignee',           keys: ['consignee_name','consignee_address'] },
    { zone: 'cargo',        label: 'Certification',       keys: ['declaration_place_date','certification_place_date','issuing_office','exporter_declaration_country'] },
    { zone: 'footer',       label: 'Options',             keys: ['third_country_invoicing','accumulation','back_to_back_co','issued_retroactively'] },
  ],
}

// Bounding boxes per field per doc type, as % of document width/height
// Used BOTH to position the field in the left "field map" AND to highlight the area on the right image
const FIELD_ZONES = {
  bill_of_lading: {
    // ── Top-left: Shipper block ──────────────────────────────────────
    shipper_name:           { x: 0,  y: 0,   w: 50, h: 6   },
    shipper_address:        { x: 0,  y: 5.5, w: 50, h: 9   },
    // ── Top-right: Voyage / BL reference ────────────────────────────
    voyage_number:          { x: 74, y: 0,   w: 26, h: 5   },
    bl_number:              { x: 74, y: 5,   w: 26, h: 5   },
    document_number:        { x: 74, y: 5,   w: 26, h: 5   },
    prepaid_at:             { x: 74, y: 10,  w: 26, h: 4   },
    collect_at:             { x: 74, y: 10,  w: 26, h: 4   },
    original_bl_count:      { x: 74, y: 14,  w: 26, h: 4   },
    // ── Middle row: PRE-CARRIAGE | PLACE OF RECEIPT | FREIGHT | ORIGINAL BL ──
    laden_on_board_date:    { x: 0,  y: 14,  w: 18, h: 4   },
    place_of_receipt:       { x: 18, y: 14,  w: 18, h: 4   },
    freight_terms:          { x: 36, y: 14,  w: 20, h: 4   },
    service_type:           { x: 56, y: 14,  w: 18, h: 4   },
    bl_issue_date:          { x: 0,  y: 88,  w: 50, h: 4   },
    // ── Ports row: VESSEL | PORT OF LOADING | DISCHARGE | DELIVERY ──
    vessel_name:            { x: 0,  y: 19,  w: 22, h: 4   },
    port_of_loading:        { x: 22, y: 19,  w: 22, h: 4   },
    port_of_discharge:      { x: 44, y: 19,  w: 22, h: 4   },
    place_of_delivery:      { x: 66, y: 19,  w: 34, h: 4   },
    // ── Consignee block ─────────────────────────────────────────────
    consignee_name:         { x: 0,  y: 24,  w: 74, h: 5   },
    consignee_address:      { x: 0,  y: 29,  w: 74, h: 8   },
    // ── Notify Party block ──────────────────────────────────────────
    notify_party_name:      { x: 0,  y: 38,  w: 74, h: 5   },
    notify_party_email:     { x: 0,  y: 43,  w: 74, h: 3   },
    // ── Cargo table ─────────────────────────────────────────────────
    total_containers_count: { x: 0,  y: 48,  w: 7,  h: 5   },
    total_packages_count:   { x: 7,  y: 48,  w: 19, h: 5   },
    total_packages_unit:    { x: 7,  y: 53,  w: 19, h: 3   },
    cargo_description:      { x: 26, y: 48,  w: 44, h: 22  },
    gross_weight_kgs:       { x: 70, y: 48,  w: 15, h: 5   },
    measurement_cbm:        { x: 85, y: 48,  w: 15, h: 5   },
    // ── Footer ──────────────────────────────────────────────────────
    country_of_origin:      { x: 0,  y: 83,  w: 50, h: 4   },
    signatory_company:      { x: 50, y: 87,  w: 50, h: 4   },
    signatory_name:         { x: 50, y: 91,  w: 50, h: 4   },
  },
  invoice: {
    // ── Header reference row ─────────────────────────────────────────
    invoice_number:         { x: 0,  y: 0,   w: 50, h: 5   },
    invoice_date:           { x: 50, y: 0,   w: 50, h: 5   },
    sales_order_number:     { x: 0,  y: 5,   w: 50, h: 5   },
    po_number:              { x: 50, y: 5,   w: 50, h: 5   },
    lc_number:              { x: 0,  y: 10,  w: 50, h: 5   },
    lc_date:                { x: 50, y: 10,  w: 50, h: 5   },
    booking_number:         { x: 0,  y: 15,  w: 50, h: 5   },
    // ── Party blocks ─────────────────────────────────────────────────
    shipper_name:           { x: 0,  y: 21,  w: 50, h: 5   },
    shipper_address:        { x: 0,  y: 26,  w: 50, h: 8   },
    buyer_name:             { x: 50, y: 21,  w: 50, h: 5   },
    buyer_address:          { x: 50, y: 26,  w: 50, h: 8   },
    notify_party_name:      { x: 0,  y: 35,  w: 100,h: 4   },
    // ── Shipment row ─────────────────────────────────────────────────
    vessel_name:            { x: 0,  y: 40,  w: 33, h: 4   },
    voyage_number:          { x: 33, y: 40,  w: 33, h: 4   },
    port_of_loading:        { x: 66, y: 40,  w: 34, h: 4   },
    final_destination:      { x: 0,  y: 44,  w: 50, h: 4   },
    sailing_date:           { x: 50, y: 44,  w: 50, h: 4   },
    // ── Terms row ────────────────────────────────────────────────────
    incoterm:               { x: 0,  y: 49,  w: 33, h: 4   },
    incoterm_destination:   { x: 33, y: 49,  w: 33, h: 4   },
    payment_term:           { x: 66, y: 49,  w: 34, h: 4   },
    container_number:       { x: 0,  y: 54,  w: 50, h: 4   },
    container_volume_type:  { x: 50, y: 54,  w: 50, h: 4   },
    currency:               { x: 0,  y: 59,  w: 33, h: 4   },
    // ── Totals row ───────────────────────────────────────────────────
    total_quantity_pcs:     { x: 0,  y: 80,  w: 33, h: 4   },
    total_cartons:          { x: 33, y: 80,  w: 33, h: 4   },
    total_amount:           { x: 66, y: 80,  w: 34, h: 4   },
    fob_value:              { x: 66, y: 80,  w: 34, h: 4   },
    // ── Bank & Footer ────────────────────────────────────────────────
    bank_name:              { x: 0,  y: 87,  w: 50, h: 4   },
    bank_account_number:    { x: 0,  y: 91,  w: 50, h: 4   },
    bank_swift_code:        { x: 50, y: 91,  w: 50, h: 4   },
    signatory_name:         { x: 50, y: 95,  w: 50, h: 4   },
  },
  packing_list: {
    // ── Header reference ─────────────────────────────────────────────
    invoice_number:         { x: 0,  y: 0,   w: 50, h: 5   },
    invoice_date:           { x: 50, y: 0,   w: 50, h: 5   },
    sales_order:            { x: 0,  y: 5,   w: 50, h: 5   },
    po_number:              { x: 50, y: 5,   w: 50, h: 5   },
    booking_number:         { x: 0,  y: 10,  w: 50, h: 5   },
    // ── Party blocks ─────────────────────────────────────────────────
    shipper_name:           { x: 0,  y: 16,  w: 50, h: 5   },
    ship_to_name:           { x: 50, y: 16,  w: 50, h: 5   },
    ship_to_address:        { x: 50, y: 21,  w: 50, h: 8   },
    notify_party_name:      { x: 0,  y: 30,  w: 100,h: 4   },
    // ── Shipment row ─────────────────────────────────────────────────
    vessel_name:            { x: 0,  y: 35,  w: 33, h: 4   },
    voyage_number:          { x: 33, y: 35,  w: 33, h: 4   },
    port_of_loading:        { x: 66, y: 35,  w: 34, h: 4   },
    final_destination:      { x: 0,  y: 40,  w: 50, h: 4   },
    sailing_date:           { x: 50, y: 40,  w: 50, h: 4   },
    container_number:       { x: 0,  y: 45,  w: 50, h: 4   },
    container_volume_type:  { x: 50, y: 45,  w: 50, h: 4   },
    // ── Totals row ───────────────────────────────────────────────────
    total_pallets:          { x: 0,  y: 76,  w: 25, h: 4   },
    total_quantity_pcs:     { x: 25, y: 76,  w: 25, h: 4   },
    total_cartons:          { x: 50, y: 76,  w: 25, h: 4   },
    total_net_weight_kgs:   { x: 0,  y: 81,  w: 33, h: 4   },
    total_gross_weight_kgs: { x: 33, y: 81,  w: 33, h: 4   },
    total_measurement_cbm:  { x: 66, y: 81,  w: 34, h: 4   },
    signatory_name:         { x: 50, y: 95,  w: 50, h: 4   },
  },
  form_d: {
    // ── Top: reference / form info ───────────────────────────────────
    reference_no:               { x: 0,  y: 0,   w: 50, h: 3   },
    form_type:                  { x: 50, y: 0,   w: 50, h: 5   },
    issuing_country:            { x: 50, y: 5,   w: 50, h: 3   },
    importing_country:          { x: 0,  y: 2,   w: 50, h: 3   },
    // ── Box 1 (left): Exporter ───────────────────────────────────────
    exporter_name:              { x: 0,  y: 5,   w: 50, h: 6   },
    exporter_address:           { x: 0,  y: 11,  w: 50, h: 10  },
    // ── Box 2 (right): Consignee ─────────────────────────────────────
    consignee_name:             { x: 50, y: 8,   w: 50, h: 6   },
    consignee_address:          { x: 50, y: 14,  w: 50, h: 7   },
    // ── Box 3: Transport ─────────────────────────────────────────────
    departure_date:             { x: 0,  y: 22,  w: 25, h: 4   },
    vessel_name:                { x: 25, y: 22,  w: 25, h: 4   },
    port_of_discharge:          { x: 50, y: 22,  w: 50, h: 4   },
    // ── Options (checkboxes) ─────────────────────────────────────────
    third_country_invoicing:    { x: 0,  y: 27,  w: 50, h: 3.5 },
    accumulation:               { x: 50, y: 27,  w: 50, h: 3.5 },
    back_to_back_co:            { x: 0,  y: 30.5,w: 50, h: 3.5 },
    issued_retroactively:       { x: 50, y: 30.5,w: 50, h: 3.5 },
    // ── Footer: Declaration / Certification ──────────────────────────
    exporter_declaration_country: { x: 0, y: 82, w: 50, h: 4   },
    declaration_place_date:     { x: 0,  y: 87,  w: 50, h: 5   },
    certification_place_date:   { x: 50, y: 87,  w: 50, h: 5   },
    issuing_office:             { x: 50, y: 92,  w: 50, h: 5   },
  },
}

// ── Document Layout Templates (field order matching physical document) ──
const DOCUMENT_LAYOUT = {
  form_d: [
    { title: 'Document Header', layout: 'row', fields: [
      { key: 'form_type',         label: 'Form Type' },
      { key: 'reference_no',      label: 'Reference No.' },
      { key: 'issuing_country',   label: 'Issuing Country' },
      { key: 'importing_country', label: 'Importing Country' },
    ]},
    { title: 'Exporter & Consignee', layout: 'two-col',
      left: [
        { key: 'exporter_name',                label: 'Exporter' },
        { key: 'exporter_address',             label: 'Exporter Address' },
        { key: 'exporter_declaration_country', label: 'Country' },
      ],
      right: [
        { key: 'consignee_name',    label: 'Consignee' },
        { key: 'consignee_address', label: 'Consignee Address' },
      ],
    },
    { title: 'Transport', layout: 'row', fields: [
      { key: 'vessel_name',      label: 'Vessel / Aircraft' },
      { key: 'departure_date',   label: 'Departure Date' },
      { key: 'port_of_discharge',label: 'Port of Discharge' },
    ]},
    // Box 5: Goods / Product info (HS code, origin criterion, description)
    { title: 'Product & Goods', layout: 'row', fields: [
      { key: 'hs_code',           label: 'HS Code' },
      { key: 'origin_criterion',  label: 'Origin Criterion' },
      { key: 'goods_description', label: 'Goods Description' },
      { key: 'marks_and_numbers', label: 'Marks & Numbers' },
    ]},
    { title: 'Certificate Criteria', layout: 'flags', fields: [
      { key: 'de_minimis',              label: 'De Minimis' },
      { key: 'exhibition',              label: 'Exhibition' },
      { key: 'accumulation',            label: 'Accumulation' },
      { key: 'back_to_back_co',         label: 'Back-to-Back C/O' },
      { key: 'issued_retroactively',    label: 'Issued Retroactively' },
      { key: 'partial_cumulation',      label: 'Partial Cumulation' },
      { key: 'third_country_invoicing', label: 'Third Country Invoicing' },
    ]},
    { title: 'Declaration & Certification', layout: 'row', fields: [
      { key: 'declaration_place_date',   label: 'Declaration Place & Date' },
      { key: 'certification_place_date', label: 'Certification Place & Date' },
      { key: 'issuing_office',           label: 'Issuing Office' },
    ]},
    { title: 'Line Items', layout: 'table' },
  ],
  bill_of_lading: [
    // Box: Document reference & terms (top header strip)
    { title: 'Document Info', layout: 'row', fields: [
      { key: 'bl_number',          label: 'BL Number' },
      { key: 'bl_issue_date',      label: 'Issue Date' },
      { key: 'voyage_number',      label: 'Voyage Number' },
      { key: 'original_bl_count',  label: 'Original BL Count' },
      { key: 'freight_terms',      label: 'Freight Terms' },
      { key: 'service_type',       label: 'Service Type' },
    ]},
    // Box 1: Shipper (top-left box on physical BL)
    { title: 'Shipper', layout: 'row', fields: [
      { key: 'shipper_name',    label: 'Shipper Name' },
      { key: 'shipper_address', label: 'Shipper Address' },
    ]},
    // Box 2: Consignee (separate box below Shipper on physical BL)
    { title: 'Consignee', layout: 'row', fields: [
      { key: 'consignee_name',    label: 'Consignee Name' },
      { key: 'consignee_address', label: 'Consignee Address' },
    ]},
    // Box 3: Notify Party (separate box below Consignee on physical BL)
    { title: 'Notify Party', layout: 'row', fields: [
      { key: 'notify_party_name',    label: 'Notify Party Name' },
      { key: 'notify_party_address', label: 'Notify Party Address' },
      { key: 'notify_party_email',   label: 'Notify Party Email' },
    ]},
    // Box 4: Vessel & Port info
    { title: 'Vessel & Port', layout: 'row', fields: [
      { key: 'vessel_name',         label: 'Vessel' },
      { key: 'port_of_loading',     label: 'Port of Loading' },
      { key: 'port_of_discharge',   label: 'Port of Discharge' },
      { key: 'place_of_delivery',   label: 'Place of Delivery' },
      { key: 'place_of_receipt',    label: 'Place of Receipt' },
      { key: 'laden_on_board_date', label: 'Laden on Board' },
      { key: 'sailing_date',        label: 'Sailing Date' },
      { key: 'prepaid_at',          label: 'Prepaid At' },
      { key: 'collect_at',          label: 'Collect At' },
    ]},
    // Box 5: Container details (BL always carries container data)
    { title: 'Container', layout: 'row', fields: [
      { key: 'container_number',       label: 'Container Number' },
      { key: 'container_volume_type',  label: 'Container Type' },
      { key: 'container_size_type',    label: 'Container Size' },
      { key: 'seal_number',            label: 'Seal Number' },
      { key: 'total_containers_count', label: 'Total Containers' },
    ]},
    // Box 6: Cargo description & measurements
    { title: 'Cargo & Weight', layout: 'row', fields: [
      { key: 'cargo_description',    label: 'Cargo Description' },
      { key: 'total_packages_count', label: 'Total Packages' },
      { key: 'total_packages_unit',  label: 'Package Unit' },
      { key: 'gross_weight_kgs',     label: 'Gross Weight (KGS)' },
      { key: 'measurement_cbm',      label: 'Measurement (CBM)' },
      { key: 'country_of_origin',    label: 'Country of Origin' },
    ]},
    // Box 7: Signatory (bottom of BL)
    { title: 'Signatory', layout: 'row', fields: [
      { key: 'signatory_company', label: 'Signatory Company' },
      { key: 'signatory_name',    label: 'Signatory' },
      { key: 'signatory_role',    label: 'Signatory Role' },
    ]},
    { title: 'Line Items', layout: 'table' },
  ],
  invoice: [
    // Top: Seller/Shipper company block (letterhead area)
    { title: 'Seller / Shipper', layout: 'row', fields: [
      { key: 'shipper_name',    label: 'Shipper Name' },
      { key: 'shipper_address', label: 'Shipper Address' },
    ]},
    // Invoice reference block (top-right on physical invoice)
    { title: 'Invoice Info', layout: 'row', fields: [
      { key: 'invoice_number',     label: 'Invoice #' },
      { key: 'invoice_date',       label: 'Invoice Date' },
      { key: 'po_number',          label: 'PO Number' },
      { key: 'sales_order_number', label: 'Sales Order #' },
      { key: 'booking_number',     label: 'Booking Number' },
      { key: 'lc_number',          label: 'LC Number' },
      { key: 'lc_date',            label: 'LC Date' },
      { key: 'currency',           label: 'Currency' },
      { key: 'payment_term',       label: 'Payment Term' },
      { key: 'incoterm',           label: 'Incoterm' },
    ]},
    // Buyer / Consignee block (below invoice header)
    { title: 'Buyer / Consignee', layout: 'row', fields: [
      { key: 'buyer_name',    label: 'Buyer Name' },
      { key: 'buyer_address', label: 'Buyer Address' },
    ]},
    // Notify Party block (below buyer on invoice)
    { title: 'Notify Party', layout: 'row', fields: [
      { key: 'notify_party_name', label: 'Notify Party' },
      { key: 'final_destination', label: 'Final Destination' },
    ]},
    // Vessel & shipping info
    { title: 'Vessel & Port', layout: 'row', fields: [
      { key: 'vessel_name',           label: 'Vessel' },
      { key: 'voyage_number',         label: 'Voyage Number' },
      { key: 'port_of_loading',       label: 'Port of Loading' },
      { key: 'sailing_date',          label: 'Sailing Date' },
      { key: 'container_number',      label: 'Container Number' },
      { key: 'container_volume_type', label: 'Container Type' },
    ]},
    // Totals row (bottom of invoice, above signatures)
    { title: 'Totals', layout: 'row', fields: [
      { key: 'total_cartons',      label: 'Total Cartons' },
      { key: 'total_quantity_pcs', label: 'Total Qty (PCS)' },
      { key: 'total_amount',       label: 'Total Amount' },
      { key: 'fob_value',          label: 'FOB Value' },
    ]},
    { title: 'Line Items', layout: 'table' },
  ],
  packing_list: [
    // Top: Shipper / Exporter block
    { title: 'Shipper', layout: 'row', fields: [
      { key: 'shipper_name',    label: 'Shipper Name' },
      { key: 'shipper_address', label: 'Shipper Address' },
    ]},
    // Ship To block (consignee equivalent in PL)
    { title: 'Ship To', layout: 'row', fields: [
      { key: 'ship_to_name',    label: 'Ship To Name' },
      { key: 'ship_to_address', label: 'Ship To Address' },
    ]},
    // Notify Party
    { title: 'Notify Party', layout: 'row', fields: [
      { key: 'notify_party_name', label: 'Notify Party' },
    ]},
    // Document reference fields
    { title: 'Document Info', layout: 'row', fields: [
      { key: 'invoice_number',        label: 'Invoice #' },
      { key: 'invoice_date',          label: 'Invoice Date' },
      { key: 'po_number',             label: 'PO Number' },
      { key: 'booking_number',        label: 'Booking Number' },
      { key: 'container_number',      label: 'Container Number' },
      { key: 'container_volume_type', label: 'Container Type' },
      { key: 'seal_number',           label: 'Seal Number' },
      { key: 'rot_number',            label: 'ROT Number' },
      { key: 'delivery_order_number', label: 'D/O Number' },
    ]},
    // Vessel & Port
    { title: 'Vessel & Port', layout: 'row', fields: [
      { key: 'vessel_name',       label: 'Vessel' },
      { key: 'voyage_number',     label: 'Voyage Number' },
      { key: 'port_of_loading',   label: 'Port of Loading' },
      { key: 'final_destination', label: 'Final Destination' },
      { key: 'sailing_date',      label: 'Sailing Date' },
      { key: 'port',              label: 'Port' },
    ]},
    // Totals & Weight summary (bottom of packing list)
    { title: 'Totals & Weight', layout: 'row', fields: [
      { key: 'total_cartons',          label: 'Total Cartons' },
      { key: 'total_quantity_pcs',     label: 'Total Qty (PCS)' },
      { key: 'total_pallets',          label: 'Total Pallets' },
      { key: 'total_net_weight_kgs',   label: 'Net Weight (KGS)' },
      { key: 'total_gross_weight_kgs', label: 'Gross Weight (KGS)' },
      { key: 'total_measurement_cbm',  label: 'Measurement (CBM)' },
      { key: 'signatory_company',      label: 'Signatory Company' },
      { key: 'signatory_name',         label: 'Signatory' },
    ]},
    { title: 'Line Items', layout: 'table' },
  ],
}

// ── ZoomPanImage — drag-to-pan, scroll-to-zoom, no scrollbars ─
function ZoomPanImage({ src, alt }) {
  const containerRef = useRef(null)
  const stateRef     = useRef({ scale: 1, x: 0, y: 0 })
  const dragRef      = useRef(null)
  const touchRef     = useRef(null)
  const [transform,  setTransform]  = useState({ scale: 1, x: 0, y: 0 })
  const [dragging,   setDragging]   = useState(false)

  function apply(next) {
    stateRef.current = next
    setTransform({ ...next })
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const rect   = el.getBoundingClientRect()
      const cx     = e.clientX - rect.left
      const cy     = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      const prev   = stateRef.current
      const s      = Math.max(0.5, Math.min(5, prev.scale * factor))
      const r      = s / prev.scale
      apply({ scale: s, x: cx - (cx - prev.x) * r, y: cy - (cy - prev.y) * r })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onMouseDown = (e) => {
    e.preventDefault()
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: stateRef.current.x, oy: stateRef.current.y }
    setDragging(true)
  }
  const onMouseMove = (e) => {
    if (!dragRef.current) return
    apply({ ...stateRef.current, x: dragRef.current.ox + e.clientX - dragRef.current.sx, y: dragRef.current.oy + e.clientY - dragRef.current.sy })
  }
  const onMouseUp = () => { dragRef.current = null; setDragging(false) }

  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      const [a, b] = e.touches
      touchRef.current = { type: 'pinch', dist: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY), midX: (a.clientX + b.clientX) / 2, midY: (a.clientY + b.clientY) / 2, ...stateRef.current }
    } else {
      touchRef.current = { type: 'pan', sx: e.touches[0].clientX, sy: e.touches[0].clientY, ox: stateRef.current.x, oy: stateRef.current.y }
    }
  }
  const onTouchMove = (e) => {
    e.preventDefault()
    const t = touchRef.current
    if (!t) return
    if (e.touches.length === 2 && t.type === 'pinch') {
      const [a, b] = e.touches
      const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)
      const s    = Math.max(0.5, Math.min(5, t.scale * (dist / t.dist)))
      const rect = containerRef.current.getBoundingClientRect()
      const cx   = t.midX - rect.left
      const cy   = t.midY - rect.top
      const r    = s / t.scale
      apply({ scale: s, x: cx - (cx - t.x) * r, y: cy - (cy - t.y) * r })
    } else if (e.touches.length === 1 && t.type === 'pan') {
      apply({ ...stateRef.current, x: t.ox + e.touches[0].clientX - t.sx, y: t.oy + e.touches[0].clientY - t.sy })
    }
  }
  const onTouchEnd = () => { touchRef.current = null }

  const isDirty = transform.scale !== 1 || transform.x !== 0 || transform.y !== 0
  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      style={{ cursor: dragging ? 'grabbing' : 'grab', minHeight: 'calc(100% * 1.414)' }}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
    >
      <img
        src={src} alt={alt} draggable={false}
        onLoad={e => { const img = e.currentTarget; const con = containerRef.current; if (con) con.style.minHeight = img.naturalHeight + 'px' }}
        style={{ width: '100%', display: 'block', transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.scale})`, transformOrigin: '0 0', userSelect: 'none', pointerEvents: 'none', willChange: 'transform' }}
      />
      <div className="absolute bottom-2 right-2 flex flex-col items-end gap-1">
        <div className="flex items-center gap-1 bg-black/50 rounded-lg px-2 py-1">
          <button onMouseDown={e=>e.stopPropagation()} onClick={()=>{ const prev=stateRef.current; apply({...prev, scale: Math.min(5, prev.scale*1.25)}) }} className="text-white text-sm w-5 h-5 flex items-center justify-center hover:text-yellow-300">+</button>
          <span className="text-white text-[10px] w-10 text-center">{Math.round(transform.scale*100)}%</span>
          <button onMouseDown={e=>e.stopPropagation()} onClick={()=>{ const prev=stateRef.current; apply({...prev, scale: Math.max(0.5, prev.scale/1.25)}) }} className="text-white text-sm w-5 h-5 flex items-center justify-center hover:text-yellow-300">−</button>
        </div>
        {isDirty && (
          <button onMouseDown={e=>e.stopPropagation()} onClick={()=>apply({scale:1,x:0,y:0})} className="text-[10px] px-2 py-0.5 rounded-lg bg-black/50 text-white hover:bg-black/70">Reset</button>
        )}
      </div>
    </div>
  )
}

function detectDocType(data, workflowType) {
  if (workflowType && FIELD_SCHEMAS[workflowType]) return workflowType
  if (data.bl_number || data.laden_on_board_date) return 'bill_of_lading'
  if (data.reference_no && data.origin_criterion) return 'form_d'
  if (data.total_measurement_cbm || data.total_net_weight_kgs) return 'packing_list'
  return 'invoice'
}

// ── FieldCard ────────────────────────────────────────────────
function FieldCard({ icon: Icon, label, value, color = 'text-brand-400', isLight, compact = false }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(String(value ?? ''))
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  const hasValue = value != null && value !== '' && value !== 'null'

  return (
    <div className={`rounded-xl group hover:scale-[1.01] transition-all border ${compact ? 'p-2.5' : 'p-4'} ${
      isLight
        ? 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300'
        : 'bg-slate-800/50 border-slate-700/60 hover:border-slate-600'
    }`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Icon size={compact ? 11 : 13} className={color} />
          <span className={`${compact ? 'text-[10px]' : 'text-xs'} font-medium uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
            {label}
          </span>
        </div>
        {hasValue && (
          <button onClick={handleCopy} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-200 p-0.5 rounded">
            <Copy size={10} />
          </button>
        )}
      </div>
      <p className={`${compact ? 'text-xs' : 'text-sm'} font-semibold ${hasValue ? (isLight ? 'text-slate-800' : 'text-white') : ''}`}>
        {hasValue
          ? String(value)
          : <span className={`font-normal italic text-xs ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>Not found</span>
        }
      </p>
      {copied && <p className="text-[10px] text-green-400 mt-0.5">Copied!</p>}
    </div>
  )
}

// ── Section Header ───────────────────────────────────────────
function SectionHeader({ num, title, emoji, filled, total, isLight, collapsible, collapsed, onToggle }) {
  const pct = total > 0 ? Math.round(filled / total * 100) : 0
  const pctColor = pct === 100 ? 'text-green-500' : pct >= 50 ? 'text-amber-500' : 'text-red-400'
  return (
    <div
      className={`flex items-center gap-2.5 py-2 px-1 ${collapsible ? 'cursor-pointer select-none' : ''}`}
      onClick={collapsible ? onToggle : undefined}
    >
      <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 ${
        isLight ? 'bg-brand-100 text-brand-700' : 'bg-brand-500/20 text-brand-300'
      }`}>{num}</span>
      <span className="text-base leading-none">{emoji}</span>
      <span className={`text-sm font-semibold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{title}</span>
      <div className={`flex-1 h-px ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
      {total > 0 && (
        <span className={`text-xs font-medium tabular-nums ${pctColor}`}>
          {filled}/{total} <span className={`${isLight ? 'text-slate-400' : 'text-slate-600'}`}>fields</span>
        </span>
      )}
      {collapsible && (
        collapsed ? <ChevronDown size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
                  : <ChevronUp   size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
      )}
    </div>
  )
}

// ── LineItemsTable ────────────────────────────────────────────
function LineItemsTable({ items = [], isLight }) {
  if (!items?.length) return (
    <p className={`text-sm italic px-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>No line items extracted</p>
  )
  const columns = Object.keys(items[0] || {}).filter(k => k !== 'raw_text')
  return (
    <div className={`overflow-x-auto rounded-xl border ${isLight ? 'border-slate-200' : 'border-slate-700/60'}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className={`border-b ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/60 border-slate-700/60'}`}>
            {columns.map(col => (
              <th key={col} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider first:pl-5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {col.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className={`border-b transition-colors ${isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-slate-800/60 hover:bg-slate-800/30'}`}>
              {columns.map(col => (
                <td key={col} className={`px-4 py-3 first:pl-5 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
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

// ── Main Page ────────────────────────────────────────────────
export default function ResultsPage() {
  const { documentId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const batchParam = searchParams.get('batch') || ''
  const batchIds   = batchParam ? batchParam.split(',').filter(Boolean) : []
  const allDocIds  = [documentId, ...batchIds]
  const isBatch    = allDocIds.length > 1

  const [activeDocId, setActiveDocId]     = useState(documentId)
  const [result, setResult]               = useState(null)
  const [docMeta, setDocMeta]             = useState(null)
  const [workflowRun, setWorkflowRun]     = useState(null)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [activeTab, setActiveTab]         = useState('fields')
  const [selectedPage, setSelectedPage]   = useState('all')
  const [showRawText, setShowRawText]     = useState(false)
  const [collapsedSections, setCollapsedSections] = useState({})
  const [activeField, setActiveField]     = useState(null)
  const [batchItems, setBatchItems]       = useState([])
  const pollRef = useRef({})

  useEffect(() => {
    setActiveTab('fields')
    setSelectedPage('all')
    setCollapsedSections({})
    setActiveField(null)
    loadResults()
  }, [activeDocId])

  useEffect(() => {
    if (!isBatch) return
    loadBatchItems()
    return () => { Object.values(pollRef.current).forEach(clearInterval); pollRef.current = {} }
  }, [batchParam, documentId])

  async function loadResults() {
    try {
      setLoading(true); setError(null)
      const [{ data: doc }, ocrResult] = await Promise.all([
        supabase.from('documents').select('*').eq('id', activeDocId).single(),
        getOcrResult(activeDocId),
      ])
      setDocMeta(doc); setResult(ocrResult)
      if (doc) {
        const { data: runs } = await supabase.from('workflow_runs').select('workflow_type, status').eq('document_id', doc.id).order('created_at', { ascending: false }).limit(1)
        if (runs?.[0]) setWorkflowRun(runs[0])
      }
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function loadBatchItems() {
    const { data: docs } = await supabase.from('documents').select('id, file_name, workflow_runs(id, status, created_at)').in('id', allDocIds)
    if (!docs) return
    const ordered = allDocIds.map(id => docs.find(d => d.id === id)).filter(Boolean)
    setBatchItems(ordered.map(d => {
      const runs = (d.workflow_runs || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      return { id: d.id, fileName: d.file_name, runId: runs[0]?.id, status: runs[0]?.status || 'pending' }
    }))
    ordered.forEach(d => {
      const runs = (d.workflow_runs || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      const r = runs[0]
      if (r && ['pending','processing','triggered'].includes(r.status)) startPollBatchItem(d.id, r.id)
    })
  }

  function startPollBatchItem(docId, runId) {
    if (pollRef.current[docId]) return
    pollRef.current[docId] = setInterval(async () => {
      try {
        const { data: run } = await supabase.from('workflow_runs').select('status').eq('id', runId).single()
        if (!run) return
        setBatchItems(prev => prev.map(item => item.id === docId ? { ...item, status: run.status } : item))
        if (['completed','failed'].includes(run.status)) { clearInterval(pollRef.current[docId]); delete pollRef.current[docId] }
      } catch { /* ignore */ }
    }, 4000)
  }

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(result?.extracted_data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const a = window.document.createElement('a')
    a.href = url; a.download = `ocr-${documentId?.slice(0,8)}.json`; a.click(); URL.revokeObjectURL(url)
  }
  const handleExportCSV = () => {
    const data = result?.extracted_data; if (!data) return
    const rows = [['Field','Value'], ...Object.entries(data).filter(([k]) => k !== 'line_items').map(([k,v]) => [k, String(v ?? '')])]
    const csv  = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob)
    const a = window.document.createElement('a'); a.href = url; a.download = `ocr-${documentId?.slice(0,8)}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  const card      = `rounded-2xl border transition-colors ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800'}`
  const titleCls  = isLight ? 'text-slate-900' : 'text-white'
  const subCls    = isLight ? 'text-slate-500' : 'text-slate-400'
  const tabBg     = isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900 border-slate-800'
  const tabActive = isLight ? 'bg-white text-slate-900 shadow-sm' : 'bg-slate-800 text-white shadow-sm'
  const tabInact  = isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-white'

  function BatchSidebar() {
    return (
      <div className={`w-56 flex-shrink-0 rounded-2xl border flex flex-col overflow-hidden ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800'}`}>
        <div className={`px-4 py-3 border-b flex-shrink-0 ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wider ${subCls}`}>Select File to View</p>
          <p className={`text-[11px] mt-0.5 ${subCls}`}>{allDocIds.length} files in batch</p>
        </div>
        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {batchItems.map(item => {
            const isSelected = item.id === activeDocId
            return (
              <button key={item.id} onClick={() => { if (!isSelected && item.status === 'completed') setActiveDocId(item.id) }}
                disabled={item.status !== 'completed'}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-150 ${
                  isSelected ? isLight ? 'bg-brand-50 border border-brand-200' : 'bg-brand-600/15 border border-brand-500/30'
                  : item.status !== 'completed' ? 'opacity-35 cursor-not-allowed border border-transparent'
                  : isLight ? 'opacity-50 hover:opacity-100 hover:bg-slate-50 border border-transparent hover:border-slate-200'
                            : 'opacity-40 hover:opacity-100 hover:bg-slate-800 border border-transparent hover:border-slate-700'
                }`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected ? isLight ? 'bg-brand-100' : 'bg-brand-500/20' : isLight ? 'bg-slate-100' : 'bg-slate-800'}`}>
                  <FileText size={14} className={isSelected ? 'text-brand-500' : 'text-red-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate leading-tight ${isSelected ? isLight ? 'text-brand-700' : 'text-brand-300' : isLight ? 'text-slate-700' : 'text-slate-300'}`}>{item.fileName}</p>
                  <p className={`text-[10px] mt-0.5 capitalize ${item.status === 'completed' ? 'text-green-500' : item.status === 'failed' ? 'text-red-400' : isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    {item.status === 'completed' ? 'Ready' : item.status === 'failed' ? 'Failed' : 'Processing…'}
                  </p>
                </div>
                {item.status === 'completed' ? <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
                 : item.status === 'failed'  ? <AlertCircle  size={13} className="text-red-400  flex-shrink-0" />
                 : <Loader2 size={13} className={`animate-spin flex-shrink-0 ${subCls}`} />}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  function MainContent() {
    if (loading) return (
      <div className="flex items-center justify-center flex-1 py-20">
        <div className="text-center"><Loader2 size={32} className="text-brand-400 animate-spin mx-auto mb-3" /><p className={subCls}>Loading results…</p></div>
      </div>
    )
    if (error || !result) return (
      <div className="flex-1 py-8">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle size={16} className="text-red-500 mt-0.5" /><p className="text-red-600 text-sm">{error || 'Results not found.'}</p>
        </div>
      </div>
    )

    const mergedData = result.extracted_data || {}
    const rawPages   = result.metadata?.pages || null
    const totalPages = result.metadata?.total_pages || rawPages?.length || 1
    const pages      = rawPages || [{ page: 1, extracted_data: mergedData, raw_text: result.raw_text || '', image_url: null }]
    const currentPage = selectedPage !== 'all' ? pages[selectedPage] : null
    const _data       = currentPage ? (currentPage.extracted_data || {}) : mergedData
    const currentRawText = currentPage
      ? currentPage.raw_text
      : pages.map(p => `--- Page ${p.page} ---\n${p.raw_text || ''}`).join('\n\n')

    const docType      = detectDocType(mergedData, workflowRun?.workflow_type)

    // Parse BL cargo_description text into structured fields
    function parseBLCargo(desc) {
      if (!desc || typeof desc !== 'string') return {}
      const out = {}
      const poM = desc.match(/PO\s+NUMBER\s*:\s*([A-Z0-9\-]+)/i)
      if (poM) out.cargo_po_number = poM[1]
      const hsM = desc.match(/HS\s+CODE\s*:\s*([\d.]+)/i)
      if (hsM) out.cargo_hs_code = hsM[1]
      const nwM = desc.match(/NET\s+WEIGHT\s*:\s*([\d,]+\.?\d*)\s*KGS?/i)
      if (nwM) out.cargo_net_weight_text = nwM[1].replace(/,/g, '') + ' KGS'
      // product items: text before each "(PC : XXXXX)"
      const afterPO = poM ? desc.slice(desc.indexOf(poM[0]) + poM[0].length).trim() : desc
      const pcPat = /([\s\S]+?)\s*\(\s*PC\s*:\s*(\d+)\s*\)/gi
      let m; let idx = 1
      while ((m = pcPat.exec(afterPO)) !== null && idx <= 6) {
        const name = m[1].trim().replace(/^[,\s]+/, '').replace(/\s+/g, ' ')
        const pc   = m[2]
        if (name && pc) { out[`cargo_item_${idx}`] = `PC: ${pc} — ${name}`; idx++ }
      }
      return out
    }

    // Normalize a raw n8n value: unwrap arrays, reconstruct character-map objects back to strings
    function coerceField(val) {
      if (val == null || val === '' || val === 'null') return null
      if (Array.isArray(val)) {
        const first = val[0]
        if (first == null) return null
        if (typeof first === 'string') return first || null
        return coerceField(first)
      }
      if (typeof val === 'object') {
        const keys = Object.keys(val)
        if (keys.length > 0 && keys.every(k => !isNaN(Number(k)))) {
          // n8n bug: string serialised as {"0":"R","1":"T",...} — reconstruct it
          return keys.sort((a, b) => Number(a) - Number(b)).map(k => val[k]).join('') || null
        }
        return null // don't JSON.stringify real objects into a field card
      }
      return val != null ? String(val) : null
    }

    // Merge containers[0] and line_items[0] into top-level data; normalise plural/array fields
    const data = (() => {
      const c0  = Array.isArray(_data.containers)  && _data.containers[0]  ? _data.containers[0]  : {}
      const li0 = Array.isArray(_data.line_items)  && _data.line_items[0]  ? _data.line_items[0]  : {}

      // Fields n8n sometimes returns as plural arrays
      const poNumber      = _data.po_number      || coerceField(_data.po_numbers)      || c0.po_number || null
      const invoiceNumber = _data.invoice_number || coerceField(_data.invoice_numbers) || null

      const marksVal = _data.marks_and_numbers || c0.marks || li0.marks || null

      const containerBase = {
        container_number:      _data.container_number      || c0.container_number || null,
        container_volume_type: _data.container_volume_type || c0.container_type   || null,
        container_size_type:   _data.container_size_type   || c0.container_size   || null,
        seal_number:           _data.seal_number           || c0.seal_number      || null,
      }

      if (docType === 'bill_of_lading') {
        const parsed = parseBLCargo(_data.cargo_description)
        return {
          ..._data, ...containerBase,
          po_number:     poNumber     || parsed.cargo_po_number || null,
          invoice_number: invoiceNumber,
          marks_and_numbers: marksVal,
          hs_code:        _data.hs_code       || parsed.cargo_hs_code       || null,
          net_weight_kgs: _data.net_weight_kgs || parsed.cargo_net_weight_text || null,
          // product items from parsed cargo text
          cargo_item_1:  parsed.cargo_item_1 || null,
          cargo_item_2:  parsed.cargo_item_2 || null,
          cargo_item_3:  parsed.cargo_item_3 || null,
          cargo_item_4:  parsed.cargo_item_4 || null,
          cargo_item_5:  parsed.cargo_item_5 || null,
          cargo_item_6:  parsed.cargo_item_6 || null,
        }
      }
      if (docType === 'invoice') {
        // compute weight totals from line_items if not in top-level data
        const items   = Array.isArray(_data.line_items) ? _data.line_items : []
        const sumNW   = items.reduce((s, li) => s + (parseFloat(li.net_weight_kgs  || li.net_weight  || 0)), 0)
        const sumGW   = items.reduce((s, li) => s + (parseFloat(li.gross_weight_kgs || li.gross_weight || 0)), 0)
        return {
          ..._data, ...containerBase,
          po_number: poNumber, invoice_number: invoiceNumber, marks_and_numbers: marksVal,
          total_net_weight_kgs:   _data.total_net_weight_kgs   || (sumNW  > 0 ? sumNW.toFixed(3)  : null),
          total_gross_weight_kgs: _data.total_gross_weight_kgs || (sumGW  > 0 ? sumGW.toFixed(3)  : null),
        }
      }
      if (docType === 'packing_list') {
        const items   = Array.isArray(_data.line_items) ? _data.line_items : []
        const sumNW   = items.reduce((s, li) => s + (parseFloat(li.net_weight_kgs  || li.net_weight  || 0)), 0)
        const sumGW   = items.reduce((s, li) => s + (parseFloat(li.gross_weight_kgs || li.gross_weight || 0)), 0)
        return {
          ..._data, ...containerBase,
          po_number: poNumber, invoice_number: invoiceNumber, marks_and_numbers: marksVal,
          total_net_weight_kgs:   _data.total_net_weight_kgs   || (sumNW  > 0 ? sumNW.toFixed(3)  : null),
          total_gross_weight_kgs: _data.total_gross_weight_kgs || (sumGW  > 0 ? sumGW.toFixed(3)  : null),
        }
      }
      if (docType === 'form_d') {
        return {
          ..._data,
          marks_and_numbers: marksVal,
          hs_code:           _data.hs_code           || li0.hs_code           || null,
          origin_criterion:  _data.origin_criterion  || li0.origin_criterion  || li0.origin_criteria  || null,
          goods_description: _data.goods_description || li0.description       || li0.goods_description || li0.name || null,
        }
      }
      return { ..._data, po_number: poNumber, invoice_number: invoiceNumber }
    })()

    const fieldSchema  = FIELD_SCHEMAS[docType] || FIELD_SCHEMAS.invoice
    const sections     = FIELD_SECTIONS[docType] || []
    const docTypeLabel = { bill_of_lading: 'Bill of Lading', invoice: 'Invoice', packing_list: 'Packing List', form_d: 'Form D' }[docType]
    const docTypeIcon  = { bill_of_lading: '🚢', invoice: '🧾', packing_list: '📦', form_d: '📋' }[docType]
    const filledFields = fieldSchema.filter(f => { const v = data[f.key]; return v != null && v !== '' && v !== 'null' }).length

    // Page image: prefer per-page image_url, fall back to original file
    const isImgFile = /\.(png|jpg|jpeg|webp)$/i.test(docMeta?.file_name || '')
    const isPdfFile = /\.pdf$/i.test(docMeta?.file_name || '')
    const pageImgUrl = currentPage?.image_url
      || (totalPages === 1 ? (pages[0]?.image_url || null) : null)

    function SectionedFields({ compact = false }) {
      return (
        <div className="space-y-5">
          {sections.map(section => {
            const sFields = section.keys.map(k => fieldSchema.find(f => f.key === k)).filter(Boolean)
            if (sFields.length === 0) return null
            const filled = sFields.filter(f => { const v = data[f.key]; return v != null && v !== '' && v !== 'null' }).length
            const isCollapsed = collapsedSections[section.num]
            return (
              <div key={section.num}>
                <SectionHeader
                  num={section.num} title={section.title} emoji={section.emoji}
                  filled={filled} total={sFields.length} isLight={isLight}
                  collapsible onToggle={() => setCollapsedSections(prev => ({ ...prev, [section.num]: !prev[section.num] }))}
                  collapsed={isCollapsed}
                />
                {!isCollapsed && (
                  <div className={`grid gap-2 mt-2 ${compact ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'}`}>
                    {sFields.map(({ key, label, icon, color }) => (
                      <FieldCard key={key} icon={icon} label={label} value={data[key]} color={color} isLight={isLight} compact={compact} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {/* any fields not in any section */}
          {(() => {
            const allSectionKeys = new Set(sections.flatMap(s => s.keys))
            const extras = fieldSchema.filter(f => !allSectionKeys.has(f.key))
            if (!extras.length) return null
            return (
              <div>
                <div className={`flex items-center gap-2 py-2 px-1`}>
                  <span className={`text-xs font-semibold uppercase tracking-widest ${subCls}`}>Other Fields</span>
                  <div className={`flex-1 h-px ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
                </div>
                <div className={`grid gap-2 mt-2 ${compact ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'}`}>
                  {extras.map(({ key, label, icon, color }) => (
                    <FieldCard key={key} icon={icon} label={label} value={data[key]} color={color} isLight={isLight} compact={compact} />
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      )
    }

    return (
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'bg-green-100' : 'bg-green-500/15 border border-green-500/20'}`}>
              <CheckCircle2 size={20} className="text-green-500" />
            </div>
            <div>
              <h1 className={`text-xl font-bold ${titleCls}`}>{docMeta?.file_name || 'Document'}</h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isLight ? 'bg-brand-100 text-brand-700' : 'bg-brand-600/20 text-brand-300'}`}>
                  {docTypeIcon} {docTypeLabel}
                </span>
                <span className={`text-sm ${subCls}`}>
                  {filledFields}/{fieldSchema.length} fields extracted ·{' '}
                  Confidence <span className="text-green-500 font-medium">{result.confidence_score ? `${Math.round(result.confidence_score * 100)}%` : '95%'}</span>
                  {' · '}<span className="text-brand-400 font-medium">{totalPages} {totalPages === 1 ? 'page' : 'pages'}</span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {docMeta?.public_url && (
              <a href={docMeta.public_url} target="_blank" rel="noopener noreferrer"
                className={`text-sm py-2 px-3 rounded-xl flex items-center gap-1.5 border transition-colors font-medium ${isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
                <ExternalLink size={14} /> View File
              </a>
            )}
            <button onClick={handleExportCSV} className={`text-sm py-2 px-3 rounded-xl flex items-center gap-1.5 border transition-colors font-medium ${isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
              <Download size={14} /> CSV
            </button>
            <button onClick={handleExportJSON} className={`text-sm py-2 px-3 rounded-xl flex items-center gap-1.5 border transition-colors font-medium ${isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
              <Download size={14} /> JSON
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className={`flex gap-1 rounded-xl p-1 border w-fit ${tabBg}`}>
          {[
            { id: 'fields',      label: 'Extracted Fields' },
            { id: 'line_items',  label: 'Line Items' },
            { id: 'pages',       label: `Pages (${totalPages})` },
            { id: 'raw',         label: 'Raw JSON' },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${activeTab === id ? tabActive : tabInact}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Extracted Fields Tab — 6 Sections ───────────── */}
        {activeTab === 'fields' && <SectionedFields />}

        {/* ── Line Items Tab ───────────────────────────────── */}
        {activeTab === 'line_items' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Table2 size={16} className="text-brand-400" />
              <p className={`text-sm font-medium ${titleCls}`}>{data.line_items?.length || 0} line items extracted</p>
            </div>
            <LineItemsTable items={data.line_items} isLight={isLight} />
          </div>
        )}

        {/* ── Pages Tab — image LEFT (sticky) + document-layout text RIGHT ── */}
        {activeTab === 'pages' && (() => {
          const lineItems = Array.isArray(data.line_items) ? data.line_items : []
          const liKeys    = lineItems.length > 0
            ? Array.from(new Set(lineItems.flatMap(li => Object.keys(li)))).filter(k => k !== 'item_no')
            : []
          const layout    = DOCUMENT_LAYOUT[docType] || []
          const valCls2   = isLight ? 'text-slate-900' : 'text-slate-100'
          const nilCls2   = isLight ? 'text-slate-400' : 'text-slate-600'
          const labelCls  = `text-[9px] uppercase tracking-wider font-semibold ${subCls}`
          const valStyle  = { wordBreak: 'break-word' }

          // Track which keys have been covered by the layout so we can show "Other" at end
          const coveredKeys = new Set(['line_items','containers','raw_text','workflow_type','document_type','page_count','po_numbers','invoice_numbers','packing_list_numbers'])
          layout.forEach(sec => {
            if (sec.layout === 'table') return
            ;(sec.fields || []).forEach(f => coveredKeys.add(f.key))
            ;(sec.left   || []).forEach(f => coveredKeys.add(f.key))
            ;(sec.right  || []).forEach(f => coveredKeys.add(f.key))
          })
          const extraEntries = Object.entries(data).filter(([k]) => !coveredKeys.has(k))

          function FieldPair({ label, value }) {
            const has = value != null && value !== '' && value !== 'null'
            const disp = has ? (typeof value === 'object' ? JSON.stringify(value) : String(value)) : null
            return (
              <div className="mb-2">
                <p className={labelCls}>{label}</p>
                <p className={`text-[11px] font-medium leading-snug mt-0.5 ${has ? valCls2 : nilCls2}`} style={valStyle}>{disp ?? '—'}</p>
              </div>
            )
          }

          function renderSection(sec) {
            if (sec.layout === 'table') {
              if (!lineItems.length) return null
              return (
                <div key="table" className={`mt-4 border-t pt-3 ${isLight ? 'border-slate-200' : 'border-slate-700'}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${subCls}`}>{sec.title}</p>
                  <div className="overflow-x-auto">
                    <table className="min-w-max text-[10px]">
                      <thead>
                        <tr className={isLight ? 'bg-slate-100' : 'bg-slate-800'}>
                          <th className={`px-2 py-1.5 text-left font-semibold uppercase whitespace-nowrap ${subCls}`}>No.</th>
                          {liKeys.map(k => (
                            <th key={k} className={`px-2 py-1.5 text-left font-semibold uppercase whitespace-nowrap ${subCls}`}>{k.replace(/_/g,' ')}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.map((li, idx) => (
                          <tr key={idx} className={`border-t ${isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-slate-800 hover:bg-slate-800/40'}`}>
                            <td className={`px-2 py-1.5 font-medium whitespace-nowrap ${subCls}`}>{li.item_no ?? idx + 1}</td>
                            {liKeys.map(k => {
                              const v = li[k]; const has = v != null && v !== '' && v !== 'null'
                              return <td key={k} className={`px-2 py-1.5 ${has ? valCls2 : nilCls2}`} style={{ maxWidth: 200 }}>{has ? String(v) : '—'}</td>
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            }
            if (sec.layout === 'two-col') {
              return (
                <div key={sec.title} className={`mt-3 border-t pt-3 ${isLight ? 'border-slate-200' : 'border-slate-700'}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${subCls}`}>{sec.title}</p>
                  <div className="grid grid-cols-2 gap-x-4">
                    <div>{(sec.left || []).map(f => <FieldPair key={f.key} label={f.label} value={data[f.key]} />)}</div>
                    <div>{(sec.right || []).map(f => <FieldPair key={f.key} label={f.label} value={data[f.key]} />)}</div>
                  </div>
                </div>
              )
            }
            if (sec.layout === 'flags') {
              return (
                <div key={sec.title} className={`mt-3 border-t pt-3 ${isLight ? 'border-slate-200' : 'border-slate-700'}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${subCls}`}>{sec.title}</p>
                  <div className="flex flex-wrap gap-2">
                    {(sec.fields || []).map(f => {
                      const v = data[f.key]
                      const isTrue = v === true || v === 'true' || v === 'TRUE'
                      return (
                        <div key={f.key} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-medium ${
                          isTrue
                            ? isLight ? 'bg-green-50 border-green-200 text-green-700' : 'bg-green-500/10 border-green-500/20 text-green-400'
                            : isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-slate-800/30 border-slate-700/50 text-slate-500'
                        }`}>
                          <span>{isTrue ? '✓' : '○'}</span>
                          <span>{f.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            }
            // default: 'row' — multi-column grid of fields
            return (
              <div key={sec.title} className={`mt-3 border-t pt-3 ${isLight ? 'border-slate-200' : 'border-slate-700'}`}>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${subCls}`}>{sec.title}</p>
                <div className="grid grid-cols-3 gap-x-4">
                  {(sec.fields || []).map(f => <FieldPair key={f.key} label={f.label} value={data[f.key]} />)}
                </div>
              </div>
            )
          }

          return (
            <div className="flex flex-col gap-2">

              {/* Page selector toolbar */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-xs mr-1 ${subCls}`}>Viewing:</span>
                {totalPages > 1 && (
                  <button onClick={() => setSelectedPage('all')}
                    className={`px-3 h-7 rounded-lg text-xs font-medium transition-colors ${selectedPage === 'all' ? 'bg-brand-600 text-white' : isLight ? 'text-slate-500 hover:bg-slate-200' : 'text-slate-400 hover:bg-slate-800'}`}>
                    All
                  </button>
                )}
                {totalPages > 1 && (
                  <button onClick={() => setSelectedPage(i => i === 'all' ? 0 : Math.max(0, i - 1))} disabled={selectedPage === 'all'}
                    className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 ${isLight ? 'text-slate-500 hover:bg-slate-200' : 'text-slate-400 hover:bg-slate-800'}`}>
                    <ChevronLeft size={14} />
                  </button>
                )}
                {pages.map((p, i) => (
                  <button key={p.page} onClick={() => setSelectedPage(i)}
                    className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${selectedPage === i || (totalPages === 1 && selectedPage === 'all') ? 'bg-brand-600 text-white' : isLight ? 'text-slate-500 hover:bg-slate-200' : 'text-slate-400 hover:bg-slate-800'}`}>
                    {p.page}
                  </button>
                ))}
                {totalPages > 1 && (
                  <button onClick={() => setSelectedPage(i => i === 'all' ? pages.length - 1 : Math.min(pages.length - 1, i + 1))} disabled={selectedPage === pages.length - 1}
                    className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 ${isLight ? 'text-slate-500 hover:bg-slate-200' : 'text-slate-400 hover:bg-slate-800'}`}>
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>

              {/* ── Main: image LEFT (sticky, larger) + text RIGHT (scrollable) ── */}
              <div className="flex gap-4 items-start">

                {/* ═══ LEFT: document image — sticky, 45% width ═══ */}
                <div className="flex-shrink-0 sticky top-4" style={{ width: '45%' }}>
                  <div className={`rounded-xl border overflow-hidden ${isLight ? 'border-slate-200 shadow-sm' : 'border-slate-700'}`}>
                    <div className={`px-3 py-1.5 flex items-center gap-2 border-b text-xs font-medium ${isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                      <FileText size={11} />
                      <span>{currentPage ? `Page ${currentPage.page} / ${totalPages}` : `All ${totalPages} page${totalPages > 1 ? 's' : ''}`}</span>
                    </div>
                    {pageImgUrl ? (
                      <ZoomPanImage src={pageImgUrl} alt={`Page ${currentPage?.page || 1}`} />
                    ) : isImgFile && docMeta?.public_url ? (
                      <ZoomPanImage src={docMeta.public_url} alt="Document" />
                    ) : isPdfFile && docMeta?.public_url ? (
                      <iframe src={`${docMeta.public_url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                        title="Document preview" className="w-full"
                        style={{ height: 'calc(45vw * 1.414)', border: 'none', display: 'block' }} />
                    ) : (
                      <div className={`p-10 text-center ${isLight ? 'bg-slate-50' : 'bg-slate-800/40'}`}>
                        <FileText size={28} className={`mx-auto mb-3 ${subCls}`} />
                        <p className={`text-sm mb-3 ${subCls}`}>No preview available</p>
                        {docMeta?.public_url && (
                          <a href={docMeta.public_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-brand-400 hover:text-brand-300 hover:underline">
                            <ExternalLink size={13} /> Open file
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ═══ RIGHT: structured text matching document layout ═══ */}
                <div className="flex-1 min-w-0">
                  <div className={`rounded-xl border p-4 ${isLight ? 'border-slate-200 shadow-sm bg-white' : 'border-slate-700 bg-slate-900/50'}`}>
                    {/* Page summary */}
                    <p className={`text-[10px] font-semibold uppercase tracking-widest mb-3 ${subCls}`}>
                      {currentPage ? `Page ${currentPage.page} of ${totalPages}` : `All ${totalPages} page${totalPages > 1 ? 's' : ''} (merged)`}
                      {lineItems.length > 0 && ` · ${lineItems.length} line item${lineItems.length > 1 ? 's' : ''}`}
                    </p>

                    {/* Render each section from document layout template */}
                    {layout.map(sec => renderSection(sec))}

                    {/* Extra fields not in template */}
                    {extraEntries.length > 0 && (
                      <div className={`mt-3 border-t pt-3 ${isLight ? 'border-slate-200' : 'border-slate-700'}`}>
                        <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${subCls}`}>Other Fields</p>
                        <div className="grid grid-cols-3 gap-x-4">
                          {extraEntries.map(([key, val]) => {
                            const has = val != null && val !== '' && val !== 'null'
                            const disp = has ? (typeof val === 'object' ? JSON.stringify(val) : String(val)) : null
                            return (
                              <div key={key} className="mb-2">
                                <p className={labelCls}>{key.replace(/_/g, ' ')}</p>
                                <p className={`text-[11px] font-medium leading-snug mt-0.5 ${has ? valCls2 : nilCls2}`} style={valStyle}>{disp ?? '—'}</p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )
        })()}

        {/* ── Raw JSON Tab ─────────────────────────────────── */}
        {activeTab === 'raw' && (
          <div>
            <p className={`text-xs mb-2 ${subCls}`}>{currentPage ? `Page ${currentPage.page} of ${totalPages}` : 'All pages merged'}</p>
            <pre className={`rounded-2xl p-5 text-sm overflow-x-auto font-mono leading-relaxed max-h-[60vh] overflow-y-auto ${isLight ? 'bg-white border border-slate-200 text-slate-700 shadow-sm' : 'bg-slate-900 border border-slate-700/60 text-slate-300'}`}>
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`h-full flex flex-col ${isLight ? 'bg-[#f0f4f8]' : 'bg-slate-950'}`}>
      <div className="flex-shrink-0 px-6 pt-5 pb-3">
        <button onClick={() => navigate('/app/history')}
          className={`flex items-center gap-2 text-sm transition-colors ${isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-white'}`}>
          <ArrowLeft size={14} /> All documents
        </button>
      </div>
      <div className="flex-1 flex gap-4 min-h-0">
        {isBatch && <BatchSidebar />}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="px-6 pb-6">
            <MainContent />
          </div>
        </div>
      </div>
    </div>
  )
}
