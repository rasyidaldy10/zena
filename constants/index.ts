export const APP_NAME = 'Zena'

export const PERSONA_CONFIG = {
  bestie: {
    name: 'Si Bestie',
    icon: '😎',
    desc: 'Teman gaul yang paham finansial',
    color: '#E1F5EE',
  },
  advisor: {
    name: 'Pak/Bu Advisor',
    icon: '👔',
    desc: 'Financial advisor profesional',
    color: '#E6F1FB',
  },
  kakak: {
    name: 'Kak Zena',
    icon: '🧡',
    desc: 'Kakak yang bijak & perhatian',
    color: '#FAEEDA',
  },
  adek: {
    name: 'Dek Zena',
    icon: '😊',
    desc: 'Adek semangat yang selalu support',
    color: '#FCEBEB',
  },
  pacar: {
    name: 'Si Sayang',
    icon: '🥰',
    desc: 'Pasangan yang perhatiin keuangan',
    color: '#FBEAF0',
  },
  stoic: {
    name: 'Mentor Zen',
    icon: '🧘',
    desc: 'Mentor stoik yang to the point',
    color: '#F1EFE8',
  },
}

export const LANGUAGE_CONFIG = {
  id: { label: 'Indonesia', flag: '🇮🇩' },
  en: { label: 'English',   flag: '🇬🇧' },
  my: { label: 'Malaysia',  flag: '🇲🇾' },
  zh: { label: '中文',       flag: '🇨🇳' },
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
      { label: 'Makan',    pct: 30, color: '#1D9E75' },
      { label: 'Transport',pct: 15, color: '#BA7517' },
      { label: 'Tagihan',  pct: 20, color: '#E24B4A' },
      { label: 'Tabungan', pct: 20, color: '#534AB7' },
      { label: 'Hiburan',  pct: 15, color: '#888780' },
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