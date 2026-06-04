// Marketing Dashboard - Admin only (Rasyid)
// Generate marketing content untuk Zena dengan Higgsfield AI

import { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import {
  generateMarketingContent,
  generateCampaign,
  predictVirality,
  type MarketingContent,
  type Campaign,
  type ContentType,
  type Platform,
  type CampaignGoal,
} from '../lib/marketing-manager'

const PRIMARY = '#185FA5'
const GREEN = '#1D9E75'
const BG = '#F4F7FA'
const CARD_BG = '#FFFFFF'

export default function MarketingDashboard() {
  const [loading, setLoading] = useState(false)
  const [currentContent, setCurrentContent] = useState<MarketingContent | null>(
    null
  )
  const [currentCampaign, setCurrentCampaign] = useState<Campaign | null>(null)
  const [history, setHistory] = useState<MarketingContent[]>([])

  const handleGenerate = async (type: ContentType, platform: Platform) => {
    setLoading(true)
    try {
      const content = await generateMarketingContent(type, platform)
      setCurrentContent(content)
      setHistory((prev) => [content, ...prev])

      if (content.status === 'completed') {
        Alert.alert('✅ Success!', `${type} untuk ${platform} berhasil dibuat!`)
      } else {
        Alert.alert('❌ Failed', 'Gagal generate content. Coba lagi.')
      }
    } catch (error: any) {
      Alert.alert('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateCampaign = async (goal: CampaignGoal) => {
    setLoading(true)
    try {
      const campaign = await generateCampaign(goal)
      setCurrentCampaign(campaign)
      setHistory((prev) => [...campaign.contents, ...prev])
      Alert.alert(
        '✅ Campaign Ready!',
        `${campaign.contents.length} konten telah dibuat untuk goal: ${goal}`
      )
    } catch (error: any) {
      Alert.alert('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyzeVirality = async (videoUrl: string) => {
    setLoading(true)
    try {
      const score = await predictVirality(videoUrl)
      Alert.alert(
        '🧠 Virality Analysis',
        `Hook Strength: ${score.hookStrength}%\n` +
          `Engagement: ${score.engagementPotential}%\n` +
          `Retention Risk: ${score.retentionRisk}%\n` +
          `Creative Score: ${score.creativeScore}%\n\n` +
          `${score.recommendation}`
      )
    } catch (error: any) {
      Alert.alert('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Marketing Manager</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Generate Buttons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Generate</Text>

          <View style={styles.buttonGrid}>
            <TouchableOpacity
              style={[styles.genBtn, { backgroundColor: PRIMARY }]}
              onPress={() => handleGenerate('poster', 'instagram')}
              disabled={loading}
            >
              <Text style={styles.genBtnIcon}>📸</Text>
              <Text style={styles.genBtnText}>IG Poster</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.genBtn, { backgroundColor: '#E1306C' }]}
              onPress={() => handleGenerate('story', 'instagram')}
              disabled={loading}
            >
              <Text style={styles.genBtnIcon}>📱</Text>
              <Text style={styles.genBtnText}>IG Story</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.genBtn, { backgroundColor: '#000000' }]}
              onPress={() => handleGenerate('video', 'tiktok')}
              disabled={loading}
            >
              <Text style={styles.genBtnIcon}>🎥</Text>
              <Text style={styles.genBtnText}>TikTok Video</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.genBtn, { backgroundColor: '#25D366' }]}
              onPress={() => handleGenerate('poster', 'whatsapp')}
              disabled={loading}
            >
              <Text style={styles.genBtnIcon}>💬</Text>
              <Text style={styles.genBtnText}>WA Poster</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Campaign Generator */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Generate Campaign (5 Content)</Text>

          <TouchableOpacity
            style={[styles.campaignBtn, { borderColor: PRIMARY }]}
            onPress={() => handleGenerateCampaign('awareness')}
            disabled={loading}
          >
            <Text style={styles.campaignIcon}>🎯</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.campaignTitle}>Awareness Campaign</Text>
              <Text style={styles.campaignDesc}>
                Kenalkan Zena ke audience baru
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.campaignBtn, { borderColor: GREEN }]}
            onPress={() => handleGenerateCampaign('download')}
            disabled={loading}
          >
            <Text style={styles.campaignIcon}>📥</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.campaignTitle}>Download Campaign</Text>
              <Text style={styles.campaignDesc}>
                Dorong download app dengan CTA kuat
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.campaignBtn, { borderColor: '#E24B4A' }]}
            onPress={() => handleGenerateCampaign('retention')}
            disabled={loading}
          >
            <Text style={styles.campaignIcon}>🔄</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.campaignTitle}>Retention Campaign</Text>
              <Text style={styles.campaignDesc}>
                Re-engage existing users dengan fitur baru
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Loading State */}
        {loading && (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.loadingText}>
              Generating content dengan Higgsfield AI...
            </Text>
            <Text style={styles.loadingSubtext}>Ini bisa 30-60 detik</Text>
          </View>
        )}

        {/* Current Content Preview */}
        {currentContent && !loading && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Latest Generated</Text>

            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <Text style={styles.previewType}>
                  {currentContent.type.toUpperCase()} - {currentContent.platform}
                </Text>
                <Text
                  style={[
                    styles.previewStatus,
                    {
                      color:
                        currentContent.status === 'completed' ? GREEN : '#888',
                    },
                  ]}
                >
                  {currentContent.status}
                </Text>
              </View>

              {currentContent.url && (
                <Image
                  source={{ uri: currentContent.url }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              )}

              <Text style={styles.previewPrompt} numberOfLines={3}>
                {currentContent.prompt}
              </Text>

              {currentContent.viralityScore && (
                <View style={styles.viralityCard}>
                  <Text style={styles.viralityTitle}>🧠 Virality Score</Text>
                  <View style={styles.viralityRow}>
                    <Text style={styles.viralityLabel}>Hook Strength:</Text>
                    <Text style={styles.viralityValue}>
                      {currentContent.viralityScore.hookStrength}%
                    </Text>
                  </View>
                  <View style={styles.viralityRow}>
                    <Text style={styles.viralityLabel}>Engagement:</Text>
                    <Text style={styles.viralityValue}>
                      {currentContent.viralityScore.engagementPotential}%
                    </Text>
                  </View>
                  <View style={styles.viralityRow}>
                    <Text style={styles.viralityLabel}>Retention Risk:</Text>
                    <Text style={styles.viralityValue}>
                      {currentContent.viralityScore.retentionRisk}%
                    </Text>
                  </View>
                  <View style={styles.viralityRow}>
                    <Text style={styles.viralityLabel}>Creative:</Text>
                    <Text style={styles.viralityValue}>
                      {currentContent.viralityScore.creativeScore}%
                    </Text>
                  </View>
                  <Text style={styles.viralityRec}>
                    {currentContent.viralityScore.recommendation}
                  </Text>
                </View>
              )}

              {currentContent.url && (
                <TouchableOpacity
                  style={styles.openBtn}
                  onPress={() => {
                    // Open URL in browser (or copy to clipboard)
                    Alert.alert('URL', currentContent.url!, [
                      { text: 'Copy', onPress: () => {} },
                      { text: 'OK' },
                    ])
                  }}
                >
                  <Text style={styles.openBtnText}>Open URL</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Campaign Preview */}
        {currentCampaign && !loading && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Campaign: {currentCampaign.goal.toUpperCase()}
            </Text>

            <View style={styles.campaignSummary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Contents:</Text>
                <Text style={styles.summaryValue}>
                  {currentCampaign.contents.length}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Avg Virality:</Text>
                <Text style={styles.summaryValue}>
                  {currentCampaign.totalViralityScore.toFixed(1)}%
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Created:</Text>
                <Text style={styles.summaryValue}>
                  {currentCampaign.createdAt.toLocaleTimeString()}
                </Text>
              </View>
            </View>

            {currentCampaign.contents.map((content, idx) => (
              <View key={content.id} style={styles.contentItem}>
                <Text style={styles.contentIndex}>{idx + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contentType}>
                    {content.type} - {content.platform}
                  </Text>
                  <Text style={styles.contentStatus}>{content.status}</Text>
                </View>
                {content.viralityScore && (
                  <Text style={styles.contentScore}>
                    {content.viralityScore.engagementPotential}% 🧠
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* History */}
        {history.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              History ({history.length} contents)
            </Text>

            {history.slice(0, 10).map((content) => (
              <View key={content.id} style={styles.historyItem}>
                <Text style={styles.historyIcon}>
                  {content.type === 'poster'
                    ? '📸'
                    : content.type === 'video'
                    ? '🎥'
                    : '📱'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyType}>
                    {content.type} - {content.platform}
                  </Text>
                  <Text style={styles.historyTime}>
                    {content.createdAt.toLocaleTimeString()}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.historyStatus,
                    {
                      color: content.status === 'completed' ? GREEN : '#888',
                    },
                  ]}
                >
                  {content.status === 'completed' ? '✓' : '⏳'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 20,
  },
  backText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1 },
  section: { marginHorizontal: 20, marginTop: 24 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0D1B3E',
    marginBottom: 12,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  genBtn: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  genBtnIcon: { fontSize: 40, marginBottom: 8 },
  genBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  campaignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
  },
  campaignIcon: { fontSize: 32 },
  campaignTitle: { fontSize: 14, fontWeight: '700', color: '#0D1B3E' },
  campaignDesc: { fontSize: 12, color: '#888', marginTop: 4 },
  loadingCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 24,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D1B3E',
    marginTop: 16,
  },
  loadingSubtext: { fontSize: 12, color: '#888', marginTop: 4 },
  previewCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewType: { fontSize: 12, fontWeight: '700', color: PRIMARY },
  previewStatus: { fontSize: 12, fontWeight: '600' },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    marginBottom: 12,
  },
  previewPrompt: { fontSize: 12, color: '#666', marginBottom: 12 },
  viralityCard: {
    backgroundColor: '#F0F4F8',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  viralityTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D1B3E',
    marginBottom: 8,
  },
  viralityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  viralityLabel: { fontSize: 12, color: '#666' },
  viralityValue: { fontSize: 12, fontWeight: '600', color: '#0D1B3E' },
  viralityRec: {
    fontSize: 12,
    color: PRIMARY,
    marginTop: 8,
    fontStyle: 'italic',
  },
  openBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  openBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  campaignSummary: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: { fontSize: 13, color: '#666' },
  summaryValue: { fontSize: 13, fontWeight: '700', color: '#0D1B3E' },
  contentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD_BG,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  contentIndex: {
    fontSize: 16,
    fontWeight: '700',
    color: PRIMARY,
    width: 24,
  },
  contentType: { fontSize: 13, fontWeight: '600', color: '#0D1B3E' },
  contentStatus: { fontSize: 11, color: '#888', marginTop: 2 },
  contentScore: { fontSize: 13, fontWeight: '700', color: GREEN },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD_BG,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  historyIcon: { fontSize: 24 },
  historyType: { fontSize: 13, fontWeight: '600', color: '#0D1B3E' },
  historyTime: { fontSize: 11, color: '#888', marginTop: 2 },
  historyStatus: { fontSize: 20, fontWeight: '700' },
})
