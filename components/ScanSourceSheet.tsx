import { Modal, View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

const PRIMARY = '#185FA5'

type Source = 'camera' | 'gallery'

/**
 * Bottom sheet pilihan sumber gambar buat scan struk.
 * Jalan di web & native (pengganti Alert.alert yang gak jalan di web).
 */
export default function ScanSourceSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean
  onClose: () => void
  onPick: (source: Source) => void
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Scan Struk</Text>
          <Text style={styles.subtitle}>Pilih sumber gambar</Text>

          <TouchableOpacity style={styles.option} activeOpacity={0.8} onPress={() => onPick('camera')}>
            <View style={[styles.iconWrap, { backgroundColor: PRIMARY }]}>
              <Ionicons name="camera-outline" size={22} color="#fff" />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Kamera</Text>
              <Text style={styles.optionDesc}>Foto struk langsung</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#555" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} activeOpacity={0.8} onPress={() => onPick('gallery')}>
            <View style={[styles.iconWrap, { backgroundColor: '#2A2A2A' }]}>
              <Ionicons name="image-outline" size={22} color="#fff" />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Galeri / Upload</Text>
              <Text style={styles.optionDesc}>Pilih foto yang sudah ada</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#555" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.7} onPress={onClose}>
            <Text style={styles.cancelText}>Batal</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#161616',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    alignSelf: 'stretch',
    maxWidth: 520,
    width: '100%',
    marginHorizontal: 'auto',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#333', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 13, color: '#888780', marginTop: 2, marginBottom: 16 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 14,
  },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  optionDesc: { fontSize: 12, color: '#888780', marginTop: 2 },
  cancelBtn: { marginTop: 6, paddingVertical: 14, alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#888780' },
})
