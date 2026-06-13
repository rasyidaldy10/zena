// Theme constants for Zena app
// Design system v2 (2026-06) — token lowercase baru + legacy uppercase (backward-compat)

export const COLORS = {
  // ── Design system v2 (lowercase) ──
  primary: '#1763D6',        // biru utama (pribadi)
  primaryDark: '#0F4FB5',
  business: '#16A06A',       // hijau (bisnis)
  businessDark: '#0E8A58',
  bg: '#F5F7FA',
  card: '#FFFFFF',
  text: '#1A1D26',
  textMuted: '#8A93A6',
  border: '#EDF0F5',
  success: '#16A06A',
  danger: '#E5484D',
  warning: '#F5A623',
  income: '#16A06A',
  expense: '#E5484D',

  // ── Legacy (uppercase) — dipakai screen lama, nilai disamakan ke palet baru ──
  PRIMARY: '#1763D6',
  SECONDARY: '#16A06A',
  SUCCESS: '#16A06A',
  WARNING: '#F5A623',
  DANGER: '#E5484D',
  INFO: '#1763D6',
  BACKGROUND: '#F5F7FA',
  CARD: '#FFFFFF',
  WHITE: '#FFFFFF',
  TEXT: '#1A1D26',
  TEXT_LIGHT: '#8A93A6',
  BORDER: '#EDF0F5',
  DIVIDER: '#EDF0F5',
}

export const RADIUS = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 }

export const SHADOW = {
  card: {
    shadowColor: '#1A1D26',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
}

export const SPACING = {
  // lowercase (baru)
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24,
  // legacy uppercase
  XS: 4, SM: 8, MD: 12, LG: 16, XL: 20, XXL: 24,
}

export const BORDER_RADIUS = {
  SM: 8,
  MD: 12,
  LG: 16,
  XL: 20,
  FULL: 9999,
}

export const FONT_SIZES = {
  XS: 11,
  SM: 12,
  MD: 14,
  LG: 16,
  XL: 18,
  XXL: 20,
  XXXL: 24,
}

export const FONT_WEIGHTS = {
  REGULAR: '400',
  MEDIUM: '500',
  SEMIBOLD: '600',
  BOLD: '700',
}
