import { StyleSheet, Text, View } from 'react-native';
import BackButton from '../components/BackButton';

export default function Theme() {
  return (
    <View style={styles.container}>
      <View style={{ alignSelf: 'flex-start', marginLeft: 16, marginTop: 12 }}>
        <BackButton />
      </View>
      <Text style={styles.title}>Theme</Text>
      <Text style={styles.text}>Customize your app theme here!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4F8EF7',
    marginBottom: 16,
  },
  text: {
    fontSize: 18,
    color: '#222',
  },
});
