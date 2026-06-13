import { Tabs } from 'expo-router'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { COLORS } from '../../constants/theme'

const PRIMARY = COLORS.primary

function TabIcon({ focused, icon, label }: { focused: boolean; icon: string; label: string }) {
  return (
    <View style={styles.tabItem}>
      <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>{icon}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="🏠" label="Home" />
          ),
        }}
      />
      <Tabs.Screen
        name="laporan"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="📊" label="Laporan" />
          ),
        }}
      />
      <Tabs.Screen
        name="tambah-tab"
        options={{
          tabBarIcon: () => null,
          tabBarButton: (props) => (
            <TouchableOpacity
              style={styles.addBtnWrap}
              onPress={() => router.push('/tambah-transaksi')}
            >
              <View style={styles.addBtn}>
                <Text style={styles.addBtnPlus}>+</Text>
              </View>
              <Text style={styles.zenaBtnLabel}>Catat</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="reminder"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="🔔" label="Reminder" />
          ),
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="👤" label="Profil" />
          ),
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    height: 80,
    paddingBottom: 8,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#1A1D26',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  tabItem: { alignItems: 'center', justifyContent: 'center', paddingTop: 8 },
  tabIcon: { fontSize: 22, opacity: 0.4 },
  tabIconActive: { opacity: 1 },
  tabLabel: { fontSize: 10, color: '#888888', marginTop: 4 },
  tabLabelActive: { color: PRIMARY, fontWeight: '600' },
  addBtnWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -30,
  },
  addBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PRIMARY,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  addBtnPlus: { fontSize: 34, color: '#fff', fontWeight: '300', marginTop: -2 },
  zenaBtnLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: PRIMARY,
    marginTop: 6,
  },
})
