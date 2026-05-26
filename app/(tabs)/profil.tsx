import { View, Text, StyleSheet } from "react-native"
export default function ProfilScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profil</Text>
      <Text style={styles.sub}>Coming soon...</Text>
    </View>
  )
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0F0F", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "600", color: "#FFFFFF" },
  sub: { fontSize: 14, color: "#888780", marginTop: 8 },
})
