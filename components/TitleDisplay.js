import { StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';

export default function TitleDisplay() {
  const selectedTitle = useSelector((s: any) => s.user?.selectedTitle);
  const unlockedTitles = useSelector((s: any) => s.user?.unlockedTitles || []);

  if (!selectedTitle) return null;

  const titleItem = (Array.isArray(unlockedTitles) ? unlockedTitles : []).find(
    (t: any) => t && t.id === selectedTitle
  );

  if (!titleItem) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⭐</Text>
      <Text style={styles.title}>{titleItem.title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  icon: {
    fontSize: 14,
  },
  title: {
    color: '#C7A3FF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
