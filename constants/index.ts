export const APP_NAME = 'Zena'
export const PERSONA_CONFIG = {
  bestie: {
    name: 'Si Bestie',
    icon: '😎',
    desc: 'Teman deket yang ngerti finansial, ngobrolnya santai',
    color: '#E1F5EE',
  },
  advisor: {
    name: 'Pak/Bu Advisor',
    icon: '👔',
    desc: 'Profesional, terstruktur, dan selalu berbasis data',
    color: '#E6F1FB',
  },
  kakak: {
    name: 'Kak Zena',
    icon: '🧡',
    desc: 'Kakak kandung yang care, nggak menghakimi, selalu support',
    color: '#FAEEDA',
  },
  adek: {
    name: 'Dek Zena',
    icon: '😊',
    desc: 'Adek kandung yang semangat, polos, dan bikin ketawa',
    color: '#FCEBEB',
  },
  pacar: {
    name: 'Si Sayang',
    icon: '🥰',
    desc: 'Partner hidup yang perhatiin keuangan bareng',
    color: '#FBEAF0',
  },
  stoic: {
    name: 'Mentor Zen',
    icon: '🧘',
    desc: 'Singkat, tajam, to the point. No basa-basi',
    color: '#F1EFE8',
  },
}
export const LANGUAGE_CONFIG = {
  id: { label: 'Indonesia', flag: '🇮🇩', desc: 'Bahasa Indonesia' },
  en: { label: 'English', flag: '🇬🇧', desc: 'English' },
  my: { label: 'Malaysia', flag: '🇲🇾', desc: 'Bahasa Melayu' },
  zh: { label: '中文', flag: '🇨🇳', desc: '中文 (简体)' },
}
export const BUDGET_METHODS = {
  '503020': {
    name: '50/30/20',
    desc: '50% kebutuhan, 30% keinginan, 20% tabungan',
    allocations: [
      { label: 'Kebutuhan', pct: 50, color: '#1D9E75' },
      { label: 'Keinginan', pct: 30, color: '#BA7517' },
      { label: 'Tabungan',  pct: 20, color: '#534AB7' },
    ],
  },
  '703010': {
    name: '70/20/10',
    desc: '70% hidup, 20% tabungan, 10% investasi',
    allocations: [
      { label: 'Biaya hidup', pct: 70, color: '#1D9E75' },
      { label: 'Tabungan',    pct: 20, color: '#534AB7' },
      { label: 'Investasi',   pct: 10, color: '#BA7517' },
    ],
  },
  zero: {
    name: 'Zero-based',
    desc: 'Setiap rupiah punya tujuan',
    allocations: [
      { label: 'Kebutuhan', pct: 45, color: '#1D9E75' },
      { label: 'Cicilan',   pct: 15, color: '#E24B4A' },
      { label: 'Tabungan',  pct: 20, color: '#534AB7' },
      { label: 'Investasi', pct: 10, color: '#185FA5' },
      { label: 'Hiburan',   pct: 10, color: '#BA7517' },
    ],
  },
  envelope: {
    name: 'Envelope',
    desc: 'Bagi ke amplop per kategori',
    allocations: [
      { label: 'Makan',     pct: 30, color: '#1D9E75' },
      { label: 'Transport', pct: 15, color: '#BA7517' },
      { label: 'Tagihan',   pct: 20, color: '#E24B4A' },
      { label: 'Tabungan',  pct: 20, color: '#534AB7' },
      { label: 'Hiburan',   pct: 15, color: '#888780' },
    ],
  },
  payfirst: {
    name: 'Pay Yourself First',
    desc: 'Tabung dulu, sisa untuk hidup',
    allocations: [
      { label: 'Tabungan & Investasi', pct: 25, color: '#534AB7' },
      { label: 'Kebutuhan',            pct: 50, color: '#1D9E75' },
      { label: 'Keinginan',            pct: 25, color: '#BA7517' },
    ],
  },
  custom: {
    name: 'Custom (AI suggest)',
    desc: 'AI rekomendasikan alokasi untuk kamu',
    allocations: [],
  },
}
export const COLORS = {
  primary:   '#185FA5',
  secondary: '#534AB7',
  amber:     '#BA7517',
  coral:     '#D85A30',
  red:       '#E24B4A',
  gray:      '#888780',
}