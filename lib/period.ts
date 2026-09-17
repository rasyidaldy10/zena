// Kunci periode: transaksi hanya boleh diubah/dihapus kalau masih dalam
// jendela "bulan ini + 2 bulan sebelumnya" (bulan kalender, bukan 60 hari).
// Contoh: 17 Sep 2026 -> Jul, Agu, Sep terbuka; 1 Okt -> Agu, Sep, Okt.
//
// Tujuannya melindungi laporan bulan-bulan lalu dari perubahan tak sengaja.
// Semua perbandingan memakai teks 'YYYY-MM' dari tanggal LOKAL — sengaja
// tidak lewat toISOString(), karena di WIB konversi UTC bisa memundurkan
// tanggal sehari (bug yang pernah kena di filter bulan riwayat).

/** Berapa bulan ke belakang (selain bulan berjalan) yang masih boleh diedit. */
export const EDITABLE_MONTHS_BACK = 2

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                   'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function ym(year: number, monthIndex: number): string {
  // monthIndex boleh negatif/lewat 11; Date menormalkan tahunnya.
  const d = new Date(year, monthIndex, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Bulan paling awal yang masih boleh diedit, format 'YYYY-MM'. */
export function editableFromMonth(today: Date = new Date()): string {
  return ym(today.getFullYear(), today.getMonth() - EDITABLE_MONTHS_BACK)
}

/**
 * Apakah transaksi bertanggal `date` ('YYYY-MM-DD') masih boleh diedit.
 * Tanggal kosong/rusak dianggap TIDAK bisa diedit — lebih aman daripada
 * membuka kunci karena data tak terbaca.
 */
export function isEditablePeriod(date: string | null | undefined, today: Date = new Date()): boolean {
  if (!date || date.length < 7) return false
  return date.slice(0, 7) >= editableFromMonth(today)
}

/** Label manusiawi, mis. "Juli 2026" — dipakai di pesan "periode sudah ditutup". */
export function editableFromLabel(today: Date = new Date()): string {
  const [y, m] = editableFromMonth(today).split('-').map(Number)
  return `${MONTHS_ID[m - 1]} ${y}`
}
