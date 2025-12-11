import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

const BackButton = ({ label: _label = 'Back', onPress = undefined }) => {
  const nav = useNavigation();
  const router = useRouter?.();

  const handlePress = () => {
    if (typeof onPress === 'function') {
      onPress();
      return;
    }
    if (router?.canGoBack?.()) {
      router.back();
      return;
    }
    if (nav?.canGoBack?.()) {
      nav.goBack();
      return;
    }
    router?.push?.('/') || nav?.navigate?.('Home');
  };

  return (
    <Pressable style={styles.touch} onPress={handlePress} accessibilityLabel="Go back">
      <LinearGradient colors={["#0e162c", "#111b36"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.circle}>
        <Text style={styles.chevronText}>←</Text>
      </LinearGradient>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  touch: {
    alignSelf: 'flex-start',
  },
  circle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.45)',
  },
  chevronText: {
    color: '#00E7FF',
    fontSize: 16,
    fontWeight: '800',
  },
});

export default BackButton;
