import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Animated, Easing,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { speak, stopSpeaking } from '../lib/speech'
import { timeAgo } from '../lib/date-utils'
import { ZenaNotification, AIInsight, AgentLog, NotificationType } from '../types'

const CYAN = '#00D4FF'
const CYAN_DIM = '#006688'
const GREEN = '#00FF88'
const RED = '#FF4444'
const DARK = '#050B18'
const CARD = '#080F1E'
const BORDER = '#0A2040'

const AGENTS = [
  { id: 'budget-monitor',       name: 'Budget Monitor',       icon: '🛡️', shortName: 'BUDGET' },
  { id: 'anomaly-detector',     name: 'Anomaly Detector',     icon: '🔍', shortName: 'ANOMALY' },
  { id: 'weekly-insight',       name: 'Weekly Insight',       icon: '📊', shortName: 'INSIGHT' },
  { id: 'gmail-parser',         name: 'Gmail Parser',         icon: '📧', shortName: 'GMAIL' },
  { id: 'daily-summary',        name: 'Daily Summary',        icon: '📋', shortName: 'DAILY' },
  { id: 'smart-categorization', name: 'Smart Categorize',     icon: '🏷️', shortName: 'SMART' },
] as const

type AgentStatus = 'active' | 'standby' | 'processing'

const TYPE_ICON: Record<NotificationType, string> = {
  budget_alert: '💰', anomaly: '🔍', weekly_insight: '📊',
  daily_summary: '📋', gmail: '📧', categorization: '🏷️',
}

const getStatus = (logs: AgentLog[], id: string): AgentStatus => {
  const latest = logs.find(l => l.agent_name === id)
  if (!latest) return 'standby'
  const diff = (Date.now() - new Date(latest.created_at).getTime()) / 1000
  if (diff < 120) return 'processing'
  if (diff < 86400) return 'active'
  return 'standby'
}

// ── Jarvis Orb ──────────────────────────────────────────────────
function JarvisOrb({ activeCount }: { activeCount: number }) {
  const rot1 = useRef(new Animated.Value(0)).current
  const rot2 = useRef(new Animated.Value(0)).current
  const rot3 = useRef(new Animated.Value(0)).current
  const pulse = useRef(new Animated.Value(1)).current
  const glow = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    const a1 = Animated.loop(Animated.timing(rot1, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: true }))
    const a2 = Animated.loop(Animated.timing(rot2, { toValue: 1, duration: 5500, easing: Easing.linear, useNativeDriver: true }))
    const a3 = Animated.loop(Animated.timing(rot3, { toValue: 1, duration: 12000, easing: Easing.linear, useNativeDriver: true }))
    const p = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.06, duration: 1800, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.96, duration: 1800, useNativeDriver: true }),
    ]))
    const g = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 2000, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0.4, duration: 2000, useNativeDriver: true }),
    ]))
    a1.start(); a2.start(); a3.start(); p.start(); g.start()
    return () => { a1.stop(); a2.stop(); a3.stop(); p.stop(); g.stop() }
  }, [rot1, rot2, rot3, pulse, glow])

  const spin1 = rot1.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  const spin2 = rot2.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] })
  const spin3 = rot3.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

  return (
    <View style={orbS.container}>
      {/* Outermost ring */}
      <Animated.View style={[orbS.ring, orbS.ring4, { transform: [{ rotate: spin3 }] }]} />
      {/* Outer arc ring */}
      <Animated.View style={[orbS.ring, orbS.ring3, { transform: [{ rotate: spin1 }] }]} />
      {/* Mid ring */}
      <Animated.View style={[orbS.ring, orbS.ring2, { transform: [{ rotate: spin2 }] }]} />
      {/* Inner ring */}
      <Animated.View style={[orbS.ring, orbS.ring1, { transform: [{ rotate: spin1 }] }]} />
      {/* Central orb */}
      <Animated.View style={[orbS.orb, { transform: [{ scale: pulse }], opacity: glow }]}>
        <View style={orbS.orbInner}>
          <Text style={orbS.orbLabel}>ZENA</Text>
          <Text style={orbS.orbSub}>AI SYSTEM</Text>
          <Text style={orbS.orbCount}>{activeCount} ACTIVE</Text>
        </View>
      </Animated.View>
    </View>
  )
}

const orbS = StyleSheet.create({
  container: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginVertical: 20 },
  ring: { position: 'absolute', borderRadius: 200 },
  ring4: { width: 210, height: 210, borderWidth: 0.5, borderColor: CYAN + '20', borderTopColor: 'transparent', borderRightColor: 'transparent' },
  ring3: { width: 180, height: 180, borderWidth: 1, borderColor: CYAN + '40', borderBottomColor: 'transparent', borderLeftColor: 'transparent' },
  ring2: { width: 150, height: 150, borderWidth: 1.5, borderColor: CYAN + '60', borderTopColor: 'transparent', borderRightColor: 'transparent' },
  ring1: { width: 120, height: 120, borderWidth: 2, borderColor: CYAN, borderBottomColor: 'transparent', borderLeftColor: 'transparent' },
  orb: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: DARK, borderWidth: 1.5, borderColor: CYAN,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: CYAN, shadowOpacity: 0.8, shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
  },
  orbInner: { alignItems: 'center' },
  orbLabel: { fontSize: 16, fontWeight: '800', color: CYAN, letterSpacing: 3 },
  orbSub: { fontSize: 7, color: CYAN + '80', letterSpacing: 2, marginTop: 1 },
  orbCount: { fontSize: 9, color: GREEN, fontWeight: '700', marginTop: 4, letterSpacing: 1 },
})

// ── Pulsing status dot ───────────────────────────────────────────
function StatusDot({ status }: { status: AgentStatus }) {
  const scale = useRef(new Animated.Value(1)).current
  const opacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (status === 'standby') return
    const loop = Animated.loop(Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.8, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    ]))
    loop.start()
    return () => loop.stop()
  }, [status, scale, opacity])

  const color = status === 'active' ? GREEN : status === 'processing' ? CYAN : '#334455'
  return (
    <View style={dotS.wrap}>
      {status !== 'standby' && (
        <Animated.View style={[dotS.ring, { borderColor: color, transform: [{ scale }], opacity }]} />
      )}
      <View style={[dotS.dot, { backgroundColor: color }]} />
    </View>
  )
}

const dotS = StyleSheet.create({
  wrap: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 3.5, position: 'absolute' },
  ring: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, position: 'absolute' },
})

// ── Main Screen ──────────────────────────────────────────────────
export default function ZenaIntelligenceScreen() {
  const [logs, setLogs] = useState<AgentLog[]>([])
  const [alerts, setAlerts] = useState<ZenaNotification[]>([])
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [voiceOn, setVoiceOn] = useState(false)
  const voiceOnRef = useRef(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const headerAnim = useRef(new Animated.Value(0)).current

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    try {
      const [{ data: l }, { data: a }, { data: i }] = await Promise.all([
        supabase.from('agent_logs').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(30),
        supabase.from('notifications').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(15),
        supabase.from('ai_insights').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(2),
      ])
      setLogs((l ?? []) as AgentLog[])
      setAlerts((a ?? []) as ZenaNotification[])
      setInsights((i ?? []) as AIInsight[])
    } catch { /* tables belum ada */ }
  }

  useFocusEffect(useCallback(() => {
    fetchData()
    Animated.timing(headerAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start()
  }, [headerAnim]))

  useEffect(() => {
    voiceOnRef.current = voiceOn
  }, [voiceOn])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return

      // Setup realtime channel with proper error handling
      const channel = supabase
        .channel(`jarvis-${session.user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` }, (p) => {
          const notif = p.new as ZenaNotification
          setAlerts(prev => [notif, ...prev.slice(0, 14)])
          if (voiceOnRef.current) speak(`Alert baru: ${notif.title}. ${notif.message}`)
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_logs', filter: `user_id=eq.${session.user.id}` }, (p) => {
          setLogs(prev => [p.new as AgentLog, ...prev.slice(0, 29)])
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Intelligence realtime: connected')
          }
          if (status === 'CHANNEL_ERROR') {
            console.error('Intelligence realtime: error')
          }
        })

      channelRef.current = channel
    }).catch((error) => {
      console.error('Intelligence realtime setup error:', error)
    })

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current).catch((err) => {
          console.error('Intelligence channel cleanup error:', err)
        })
      }
    }
  }, [])

  const activeCount = AGENTS.filter(a => getStatus(logs, a.id) !== 'standby').length

  const headerOpacity = headerAnim
  const headerTranslate = headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] })

  return (
    <View style={s.container}>
      {/* Header */}
      <Animated.View style={[s.header, { opacity: headerOpacity, transform: [{ translateY: headerTranslate }] }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>← BACK</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerZena}>ZENA</Text>
          <Text style={s.headerSub}>INTELLIGENCE SYSTEM v1.0</Text>
        </View>
        <TouchableOpacity
          style={[s.voiceBtn, voiceOn && s.voiceBtnOn]}
          onPress={() => { setVoiceOn(v => !v); if (voiceOn) stopSpeaking() }}
        >
          <Text style={s.voiceBtnText}>{voiceOn ? '🔊' : '🔇'}</Text>
        </TouchableOpacity>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* Jarvis Orb */}
        <JarvisOrb activeCount={activeCount} />

        {/* System status bar */}
        <View style={s.statusBar}>
          <View style={s.statusItem}>
            <View style={[s.statusDot, { backgroundColor: GREEN }]} />
            <Text style={s.statusText}>SYSTEM ONLINE</Text>
          </View>
          <Text style={s.statusSep}>|</Text>
          <Text style={s.statusText}>{activeCount}/6 AGENTS</Text>
          <Text style={s.statusSep}>|</Text>
          <View style={s.statusItem}>
            <View style={[s.statusDot, { backgroundColor: RED }]} />
            <Text style={s.statusText}>LIVE</Text>
          </View>
        </View>

        {/* Agent Grid */}
        <Text style={s.sectionLabel}>◈ AGENT STATUS MATRIX</Text>
        <View style={s.agentGrid}>
          {AGENTS.map(agent => {
            const status = getStatus(logs, agent.id)
            const agentLogs = logs.filter(l => l.agent_name === agent.id).slice(0, 2)
            const last = agentLogs[0]
            const statusColor = status === 'active' ? GREEN : status === 'processing' ? CYAN : '#334455'
            const statusLabel = status.toUpperCase()
            return (
              <View key={agent.id} style={[s.agentCard, status !== 'standby' && s.agentCardActive]}>
                <View style={s.agentCardTop}>
                  <Text style={s.agentIcon}>{agent.icon}</Text>
                  <View style={s.agentStatusRow}>
                    <StatusDot status={status} />
                    <Text style={[s.agentStatusLabel, { color: statusColor }]}>{statusLabel}</Text>
                  </View>
                </View>
                <Text style={s.agentShort}>{agent.shortName}</Text>
                <Text style={s.agentName}>{agent.name}</Text>
                <View style={[s.agentDivider, { backgroundColor: statusColor + '40' }]} />
                {last ? (
                  <>
                    <Text style={s.agentLastRun}>⟳ {timeAgo(last.created_at, 'en')}</Text>
                    {agentLogs.map((l, i) => (
                      <Text key={i} style={s.agentLog} numberOfLines={1}>› {l.result ?? l.action}</Text>
                    ))}
                  </>
                ) : (
                  <Text style={s.agentLog}>› Awaiting trigger...</Text>
                )}
              </View>
            )
          })}
        </View>

        {/* Live Feed */}
        <View style={s.sectionRow}>
          <Text style={s.sectionLabel}>◈ LIVE ALERT FEED</Text>
          <View style={s.liveBadge}>
            <Animated.View style={s.liveDot} />
            <Text style={s.liveText}>LIVE</Text>
          </View>
        </View>

        {alerts.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>[ NO ALERTS — ALL SYSTEMS NOMINAL ]</Text>
          </View>
        ) : (
          alerts.map(notif => {
            const icon = TYPE_ICON[notif.type as NotificationType] ?? '⚡'
            const isUnread = !notif.is_read
            return (
              <View key={notif.id} style={[s.alertRow, isUnread && s.alertRowUnread]}>
                <Text style={s.alertIcon}>{icon}</Text>
                <View style={s.alertBody}>
                  <Text style={s.alertTime}>[{timeAgo(notif.created_at, 'en')}]</Text>
                  <Text style={[s.alertTitle, isUnread && { color: CYAN }]}>{notif.title}</Text>
                  <Text style={s.alertMsg} numberOfLines={2}>{notif.message}</Text>
                </View>
                {isUnread && <View style={s.alertUnreadDot} />}
              </View>
            )
          })
        )}

        {/* AI Insights */}
        <Text style={s.sectionLabel}>◈ AI INTELLIGENCE REPORTS</Text>
        {insights.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>[ WEEKLY INSIGHT AGENT — CRON SCHEDULED SABTU 09:00 WIB ]</Text>
          </View>
        ) : (
          insights.map(ins => (
            <View key={ins.id} style={s.insightCard}>
              <Text style={s.insightHeader}>◈ WEEKLY REPORT — {ins.week_start}</Text>
              <Text style={s.insightText}>{ins.insight_text}</Text>
            </View>
          ))
        )}

        {/* Quick Actions */}
        <Text style={s.sectionLabel}>◈ AGENT CONTROLS</Text>
        <View style={s.controlRow}>
          <TouchableOpacity style={s.controlBtn} onPress={() => router.push('/notifications')}>
            <Text style={s.controlIcon}>🔔</Text>
            <Text style={s.controlLabel}>ALERTS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.controlBtn} onPress={() => router.push('/chat')}>
            <Text style={s.controlIcon}>🤖</Text>
            <Text style={s.controlLabel}>AI CHAT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.controlBtn} onPress={fetchData}>
            <Text style={s.controlIcon}>⟳</Text>
            <Text style={s.controlLabel}>REFRESH</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 0.5, borderBottomColor: CYAN + '30',
  },
  backBtn: { width: 70 },
  backText: { fontSize: 11, color: CYAN, fontWeight: '700', letterSpacing: 1 },
  headerCenter: { alignItems: 'center' },
  headerZena: { fontSize: 28, fontWeight: '900', color: CYAN, letterSpacing: 8, textShadowColor: CYAN, textShadowRadius: 10 },
  headerSub: { fontSize: 8, color: CYAN_DIM, letterSpacing: 2, marginTop: 2 },
  voiceBtn: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: CARD,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: BORDER,
  },
  voiceBtnOn: { backgroundColor: CYAN + '30', borderColor: CYAN },
  voiceBtnText: { fontSize: 16 },
  statusBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: BORDER,
  },
  statusItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 5, height: 5, borderRadius: 2.5 },
  statusText: { fontSize: 9, color: CYAN_DIM, fontWeight: '700', letterSpacing: 1 },
  statusSep: { color: BORDER, fontSize: 10 },
  sectionLabel: {
    fontSize: 10, fontWeight: '800', color: CYAN_DIM, letterSpacing: 2,
    marginHorizontal: 16, marginTop: 20, marginBottom: 10,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 16 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: RED },
  liveText: { fontSize: 9, color: RED, fontWeight: '800', letterSpacing: 1 },
  agentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  agentCard: {
    width: '47%', backgroundColor: CARD, borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: BORDER,
  },
  agentCardActive: { borderColor: CYAN + '50', shadowColor: CYAN, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  agentCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  agentIcon: { fontSize: 18 },
  agentStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  agentStatusLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  agentShort: { fontSize: 11, fontWeight: '900', color: CYAN, letterSpacing: 2, marginBottom: 2 },
  agentName: { fontSize: 10, color: '#8899AA', marginBottom: 6 },
  agentDivider: { height: 0.5, marginBottom: 6 },
  agentLastRun: { fontSize: 9, color: CYAN_DIM, marginBottom: 3 },
  agentLog: { fontSize: 9, color: '#445566', lineHeight: 14 },
  alertRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: CARD, borderRadius: 10, padding: 12,
    marginHorizontal: 16, marginBottom: 6, borderWidth: 0.5, borderColor: BORDER,
  },
  alertRowUnread: { borderColor: CYAN + '50', backgroundColor: '#050F20' },
  alertIcon: { fontSize: 18, marginTop: 2 },
  alertBody: { flex: 1 },
  alertTime: { fontSize: 9, color: CYAN_DIM, marginBottom: 3, letterSpacing: 0.5 },
  alertTitle: { fontSize: 12, fontWeight: '700', color: '#8899BB', marginBottom: 3 },
  alertMsg: { fontSize: 11, color: '#445566', lineHeight: 16 },
  alertUnreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: CYAN, marginTop: 4 },
  emptyCard: {
    backgroundColor: CARD, borderRadius: 10, padding: 16,
    marginHorizontal: 16, marginBottom: 8, borderWidth: 0.5, borderColor: BORDER,
    alignItems: 'center',
  },
  emptyText: { fontSize: 9, color: '#334455', letterSpacing: 1 },
  insightCard: {
    backgroundColor: '#050F20', borderRadius: 12, padding: 16,
    marginHorizontal: 16, marginBottom: 8, borderWidth: 1, borderColor: CYAN + '30',
  },
  insightHeader: { fontSize: 9, color: CYAN, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 },
  insightText: { fontSize: 13, color: '#8899AA', lineHeight: 22 },
  controlRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 16 },
  controlBtn: {
    flex: 1, backgroundColor: CARD, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: BORDER,
  },
  controlIcon: { fontSize: 22, marginBottom: 6 },
  controlLabel: { fontSize: 9, color: CYAN_DIM, fontWeight: '800', letterSpacing: 1 },
})
