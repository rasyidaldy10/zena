// Angka → kata dalam bahasa Indonesia, untuk DIBACAKAN oleh Zena.
// "150000" dibaca mesin TTS sebagai "seratus lima puluh titik nol nol nol";
// "seratus lima puluh ribu" terdengar seperti orang beneran.
// Diporting dari generator PDF (supabase/functions/generate-document-pdf).

const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas']

function kata(x: number): string {
  if (x < 12) return SATUAN[x]
  if (x < 20) return kata(x - 10) + ' belas'
  if (x < 100) return kata(Math.floor(x / 10)) + ' puluh' + (x % 10 ? ' ' + SATUAN[x % 10] : '')
  if (x < 200) return 'seratus' + (x - 100 ? ' ' + kata(x - 100) : '')
  if (x < 1000) return SATUAN[Math.floor(x / 100)] + ' ratus' + (x % 100 ? ' ' + kata(x % 100) : '')
  if (x < 2000) return 'seribu' + (x - 1000 ? ' ' + kata(x - 1000) : '')
  if (x < 1e6) return kata(Math.floor(x / 1000)) + ' ribu' + (x % 1000 ? ' ' + kata(x % 1000) : '')
  if (x < 1e9) return kata(Math.floor(x / 1e6)) + ' juta' + (x % 1e6 ? ' ' + kata(x % 1e6) : '')
  if (x < 1e12) return kata(Math.floor(x / 1e9)) + ' miliar' + (x % 1e9 ? ' ' + kata(x % 1e9) : '')
  return kata(Math.floor(x / 1e12)) + ' triliun' + (x % 1e12 ? ' ' + kata(x % 1e12) : '')
}

/** 150000 -> "seratus lima puluh ribu". Tanpa "rupiah", biar pemanggil yang menentukan. */
export function terbilang(num: number): string {
  const n = Math.floor(Math.abs(Number(num) || 0))
  if (n === 0) return 'nol'
  return kata(n).replace(/\s+/g, ' ').trim()
}
