import { View } from 'react-native'
import Svg, { Polyline, Polygon, Line, Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg'
import { COLORS } from '../constants/theme'

interface Props {
  data: number[]            // nilai per titik
  width?: number
  height?: number
  color?: string
  fill?: boolean            // area gradient di bawah garis
}

/**
 * Line chart sederhana berbasis SVG (no extra chart lib).
 * Auto-scale ke min/max data.
 */
export default function LineChart({ data, width = 320, height = 140, color = COLORS.primary, fill = true }: Props) {
  const padX = 8
  const padY = 12
  const w = width - padX * 2
  const h = height - padY * 2

  const safe = data.length > 0 ? data : [0, 0]
  const max = Math.max(...safe)
  const min = Math.min(...safe)
  const range = max - min || 1
  const stepX = safe.length > 1 ? w / (safe.length - 1) : w

  const points = safe.map((v, i) => {
    const x = padX + i * stepX
    const y = padY + h - ((v - min) / range) * h
    return { x, y }
  })

  const lineStr = points.map((p) => `${p.x},${p.y}`).join(' ')
  const areaStr = `${padX},${padY + h} ${lineStr} ${padX + (safe.length - 1) * stepX},${padY + h}`

  return (
    <View>
      <Svg width={width} height={height}>
        <Defs>
          <SvgGrad id="lc-grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.22} />
            <Stop offset="1" stopColor={color} stopOpacity={0.02} />
          </SvgGrad>
        </Defs>
        {/* grid baseline */}
        <Line x1={padX} y1={padY + h} x2={padX + w} y2={padY + h} stroke={COLORS.border} strokeWidth={1} />
        {fill && <Polygon points={areaStr} fill="url(#lc-grad)" />}
        <Polyline points={lineStr} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 4 : 2.5} fill={color} />
        ))}
      </Svg>
    </View>
  )
}
