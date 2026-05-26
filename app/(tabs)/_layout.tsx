import { Tabs } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'

const PRIMARY = '#185FA5'

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
    backgroundColor: '#111111',
    borderTopColor: '#2A2A2A',
    borderTopWidth: 0.5,
    height: 64,
    paddingBottom: 8,
  },
  tabItem: { alignItems: 'center', justifyContent: 'center', paddingTop: 6 },
  tabIcon: { fontSize: 20, opacity: 0.4 },
  tabIconActive: { opacity: 1 },
  tabLabel: { fontSize: 10, color: '#888780', marginTop: 2 },
  tabLabelActive: { color: PRIMARY, fontWeight: '600' },
})