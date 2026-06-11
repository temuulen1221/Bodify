import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';

export default function KudosCounter() {
  const kudosAvailable = useSelector((s) => s.user?.kudosAvailable ?? 0);
  const kudosReceived = useSelector((s) => s.user?.kudosReceived ?? 0);

  return (
    <LinearGradient
      colors={['rgba(196,163,255,0.12)', 'rgba(18,217,255,0.08)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.row}>
        <Text style={styles.label}>Daily</Text>
        <Text style={styles.value}>👏 {kudosAvailable}/5</Text>
        <Text style={styles.separator}>•</Text>
        <Text style={styles.label}>Lifetime</Text>
        <Text style={styles.valueReceived}>🌟 {kudosReceived}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(196,163,255,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginVertical: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  label: {
    color: '#A7B5CD',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  value: {
    color: '#C7A3FF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  separator: {
    color: 'rgba(196,163,255,0.45)',
    fontSize: 10,
    fontWeight: '700',
  },
  valueReceived: {
    color: '#12D9FF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
});
