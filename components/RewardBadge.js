import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, GRADIENTS } from '../utils/constants';

export default function RewardBadge({ label = 'XP', value = 10 }) {
	return (
		<View style={styles.wrap}>
			<LinearGradient colors={GRADIENTS.neonBar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
				<View style={styles.core} />
			</LinearGradient>
			<Text style={styles.text}>{`${value} ${label}`}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
	ring: {
		width: 34,
		height: 34,
		borderRadius: 17,
		alignItems: 'center',
		justifyContent: 'center',
		...require('../utils/shadow').makeShadow(COLORS.neonPurple, 0, 4, 8, 0.35),
		elevation: 4,
	},
	core: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(32,18,42,0.88)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,231,255,0.75)' },
	text: { color: '#F6FBFF', fontWeight: '800', fontSize: 15 },
});
