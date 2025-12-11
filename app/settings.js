import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import BackButton from '../components/BackButton';

export default function SettingsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <LinearGradient colors={["#5421FF", "#6A00FF", "#00E7FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={{ marginBottom: 12 }}>
          <BackButton />
        </View>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Customize your Bodify experience</Text>
        <View style={styles.separator} />
        <Pressable style={styles.row}><Text style={styles.rowText}>Notifications</Text></Pressable>
        <Pressable style={styles.row}><Text style={styles.rowText}>Theme</Text></Pressable>
        <Pressable style={styles.row}><Text style={styles.rowText}>Privacy</Text></Pressable>
      </LinearGradient>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingTop: 24, paddingHorizontal: 16, paddingBottom: 120, backgroundColor: '#05020B' },
  card: { borderRadius: 18, padding: 16, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', textShadowColor: 'rgba(0,231,255,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  subtitle: { color: 'rgba(255,255,255,0.8)', marginTop: 6, marginBottom: 12 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.3)', marginVertical: 6 },
  row: { backgroundColor: 'rgba(0,0,0,0.25)', borderColor: 'rgba(0,231,255,0.35)', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, marginTop: 10 },
  rowText: { color: '#fff', fontWeight: '600' },
});
