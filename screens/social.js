import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import BackButton from '../components/BackButton';

export default function SocialScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <LinearGradient colors={["#5421FF", "#6A00FF", "#00E7FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={{ marginBottom: 12 }}>
          <BackButton />
        </View>
        <Text style={styles.title}>Social</Text>
        <Text style={styles.subtitle}>Connect with friends and share your progress</Text>
        <View style={styles.feedPlaceholder}>
          <Text style={styles.placeholderText}>Feed coming soon...</Text>
        </View>
      </LinearGradient>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingTop: 24, paddingHorizontal: 16, paddingBottom: 120, backgroundColor: '#05020B' },
  card: { borderRadius: 18, padding: 16, boxShadow: '0px 10px 18px #00059', elevation: 6 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', boxShadow: '0px 1px 6px rgba(0,231,255,0.5)' },
  subtitle: { color: 'rgba(255,255,255,0.8)', marginTop: 6, marginBottom: 12 },
  feedPlaceholder: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,231,255,0.35)', backgroundColor: 'rgba(0,0,0,0.25)', padding: 20, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: 'rgba(255,255,255,0.8)' },
});
