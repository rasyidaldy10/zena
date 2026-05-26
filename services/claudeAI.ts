/**
 * services/claudeAI.ts
 * Semua request Claude API melewati Supabase Edge Function proxy
 * API key aman di server, tidak expose ke client
 */

import { supabase } from '../lib/supabase';

const PROXY_URL = 'https://lcvenmsxauasaemjjxtc.supabase.co/functions/v1/claude-proxy';

export type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export type TransactionContext = {
  totalPemasukan: number;
  totalPengeluaran: number;
  saldo: number;
  transaksiTerakhir: {
    nama: string;
    jumlah: number;
    kategori: string;
    tanggal: string;
  }[];
  bulan: string;
};

// ─── HELPER: call proxy ───────────────────────────────────────────────────────
async function callClaude(payload: object): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) throw new Error(data.error ?? 'Claude API error');

  const textBlock = data.content?.find((b: { type: string }) => b.type === 'text');
  return textBlock?.text ?? 'Maaf, terjadi kesalahan.';
}

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const buildSystemPrompt = (ctx?: TransactionContext): string => {
  const contextBlock = ctx
    ? `
Berikut data keuangan user saat ini (${ctx.bulan}):
- Total Pemasukan: Rp ${ctx.totalPemasukan.toLocaleString('id-ID')}
- Total Pengeluaran: Rp ${ctx.totalPengeluaran.toLocaleString('id-ID')}
- Saldo Tersisa: Rp ${ctx.saldo.toLocaleString('id-ID')}
- 5 Transaksi Terakhir:
${ctx.transaksiTerakhir
  .map(
    (t) =>
      `  • ${t.nama} - Rp ${t.jumlah.toLocaleString('id-ID')} (${t.kategori}, ${t.tanggal})`
  )
  .join('\n')}
`
    : '';

  return `Kamu adalah Zena AI, asisten keuangan personal yang ramah dan cerdas dalam aplikasi Zena.
Kamu berbicara dalam Bahasa Indonesia yang natural, santai tapi tetap informatif.
Keahlianmu adalah membantu user memahami kondisi keuangan mereka, memberikan saran hemat,
menganalisis pengeluaran, dan memotivasi kebiasaan finansial yang sehat.

${contextBlock}

Panduan:
- Jawab singkat dan langsung ke poin (max 3-4 kalimat untuk pertanyaan sederhana)
- Gunakan emoji secukupnya agar terasa friendly 💰
- Jika diminta saran, berikan yang konkret dan actionable
- Jangan menyebut kamu sebagai Claude atau AI dari Anthropic — kamu adalah Zena AI
- Jika user tanya di luar topik keuangan, arahkan kembali ke topik keuangan dengan ramah
- Format angka dalam Rupiah (Rp) dengan titik pemisah ribuan`;
};

// ─── CHAT ────────────────────────────────────────────────────────────────────
export async function chatWithZena(
  messages: Message[],
  context?: TransactionContext
): Promise<string> {
  return callClaude({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: buildSystemPrompt(context),
    messages,
  });
}

// ─── ANALISIS STRUK ──────────────────────────────────────────────────────────
export type StrukResult = {
  nama_toko: string;
  tanggal: string;
  items: { nama: string; harga: number; qty: number }[];
  total: number;
  kategori_saran: string;
};

export async function analisisStruk(base64Image: string, mimeType: string = 'image/jpeg'): Promise<StrukResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: `Ekstrak data dari struk/nota ini dan kembalikan HANYA JSON dengan format berikut, tanpa teks lain:
{
  "nama_toko": "string",
  "tanggal": "YYYY-MM-DD",
  "items": [{"nama": "string", "harga": number, "qty": number}],
  "total": number,
  "kategori_saran": "Makanan|Belanja|Transportasi|Kesehatan|Hiburan|Lainnya"
}

Jika tanggal tidak ada, gunakan hari ini. Jika tidak bisa membaca struk, kembalikan JSON dengan field kosong/0.`,
            },
          ],
        },
      ],
    }),
  });

  const data = await response.json();
  const textBlock = data.content?.find((b: { type: string }) => b.type === 'text');
  const raw = textBlock?.text ?? '{}';

  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned) as StrukResult;
  } catch {
    return {
      nama_toko: 'Tidak Terbaca',
      tanggal: new Date().toISOString().split('T')[0],
      items: [],
      total: 0,
      kategori_saran: 'Lainnya',
    };
  }
}

// ─── VOICE NOTE → TRANSAKSI ──────────────────────────────────────────────────
export type VoiceTransactionResult = {
  deskripsi: string;
  jumlah: number;
  kategori: string;
  tipe: 'pemasukan' | 'pengeluaran';
  tanggal: string;
};

export async function parseVoiceNote(transcribedText: string): Promise<VoiceTransactionResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: `Kamu adalah parser transaksi keuangan. Ekstrak informasi transaksi dari teks lisan Bahasa Indonesia. Kembalikan HANYA JSON tanpa teks lain.`,
      messages: [
        {
          role: 'user',
          content: `Teks voice note: "${transcribedText}"

Ekstrak transaksi dan kembalikan JSON:
{
  "deskripsi": "string (nama transaksi)",
  "jumlah": number (nominal angka saja),
  "kategori": "Makanan|Transportasi|Belanja|Hiburan|Kesehatan|Gaji|Lainnya",
  "tipe": "pemasukan" atau "pengeluaran",
  "tanggal": "YYYY-MM-DD"
}`,
        },
      ],
    }),
  });

  const data = await response.json();
  const textBlock = data.content?.find((b: { type: string }) => b.type === 'text');
  const raw = textBlock?.text ?? '{}';

  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned) as VoiceTransactionResult;
  } catch {
    return {
      deskripsi: transcribedText,
      jumlah: 0,
      kategori: 'Lainnya',
      tipe: 'pengeluaran',
      tanggal: new Date().toISOString().split('T')[0],
    };
  }
}

// ─── SARAN BULANAN ────────────────────────────────────────────────────────────
export async function getSaranBulanan(ctx: TransactionContext): Promise<string> {
  return callClaude({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    system: buildSystemPrompt(ctx),
    messages: [
      {
        role: 'user',
        content: 'Berikan 3 saran keuangan singkat dan spesifik berdasarkan data keuanganku bulan ini. Format: bullet point emoji.',
      },
    ],
  });
}