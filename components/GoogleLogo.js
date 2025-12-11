import { Image } from 'react-native';

export default function GoogleLogo({ size = 26, style }) {
	return (
		<Image source={require('../assets/icons/google.png')} style={[{ width: size, height: size, resizeMode: 'contain' }, style]} />
	);
}
