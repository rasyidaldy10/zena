import { View, Text, StyleSheet } from 'react-native'
import Svg, { Path, Defs, LinearGradient as SvgGrad, Stop, Circle } from 'react-native-svg'
import { COLORS } from '../constants/theme'

interface Props {
  value: number       // 0..100
  size?: number
  label?: string
}

// Helper: titik di lingkaran
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = (angleDeg - 180) * (Math.PI / 180)
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, startDeg)
  const end = polar(cx, cy, r, endDeg)
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

/** Gauge setengah lingkaran (0..100). Arc gradient + jarum angka di tengah. */
export default function Gauge({ value, size = 220, label = '/100' }: Props) {
  const v = Math.max(0, Math.min(100, value))
  const stroke = 16
  const r = (size - stroke) / 2
  const cx = size / 2
  const cy = size / 2
  const height = size / 2 + stroke
  const endDeg = (v / 100) * 180
  const tip = polar(cx, cy, r, endDeg)
  const color = v >= 70 ? COLORS.success : v >= 40 ? COLORS.warning : COLORS.danger

  return (
    <View style={{ width: size, height: height + 10, alignItems: 'center' }}>
      <Svg width={size} height={height}>
        <Defs>
          <SvgGrad id="gauge-grad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={COLORS.danger} />
            <Stop offset="0.5" stopColor={COLORS.warning} />
            <Stop offset="1" stopColor={COLORS.success} />
          </SvgGrad>
        </Defs>
        {/* track */}
        <Path d={arcPath(cx, cy, r, 0, 180)} stroke="#EDF0F5" strokeWidth={stroke} fill="none" strokeLinecap="round" />
        {/* value arc */}
        {v > 0 && (
          <Path d={arcPath(cx, cy, r, 0, Math.max(endDeg, 1))} stroke="url(#gauge-grad)" strokeWidth={stroke} fill="none" strokeLinecap="round" />
        )}
        {/* tip dot */}
        <Circle cx={tip.x} cy={tip.y} r={stroke / 2 + 1} fill="#fff" stroke={color} strokeWidth={3} />
      </Svg>
      <View style={[styles.center, { top: height - 64 }]}>
        <Text style={[styles.value, { color }]}>{Math.round(v)}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { position: 'absolute', alignItems: 'center' },
  value: { fontSize: 44, fontWeight: '800', color: COLORS.text, lineHeight: 46 },
  label: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
})
