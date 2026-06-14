import { supabase } from './supabase'

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

export function romanMonth(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return ROMAN[d.getMonth()] || 'I'
}

/** Format nomor dokumen. invoice: 003/GMC/VI/2026 · penawaran: PNW-003/GMC/VI/2026 */
export function formatDocNumber(docType: 'invoice' | 'quotation', counter: number, abbr: string, issueDate: string): string {
  const urut = String(counter).padStart(3, '0')
  const a = (abbr || 'INV').toUpperCase()
  const d = new Date(issueDate)
  const month = romanMonth(d)
  const year = d.getFullYear()
  const core = `${urut}/${a}/${month}/${year}`
  return docType === 'quotation' ? `PNW-${core}` : core
}

/**
 * Generate nomor dokumen baru (atomik via RPC next_doc_counter).
 * Return string nomor, atau null kalau gagal.
 */
export async function generateDocNumber(docType: 'invoice' | 'quotation', abbr: string, issueDate: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('next_doc_counter', { p_doc_type: docType })
  if (error || typeof data !== 'number') {
    console.error('next_doc_counter error:', error?.message)
    return null
  }
  return formatDocNumber(docType, data, abbr, issueDate)
}
