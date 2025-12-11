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
	wrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	ring: {
		width: 28,
		height: 28,
		borderRadius: 14,
		alignItems: 'center',
		justifyContent: 'center',
		shadowColor: COLORS.neonPurple,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.35,
		shadowRadius: 8,
		elevation: 4,
	},
	core: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,231,255,0.6)' },
	text: { color: '#E8F9FF', fontWeight: '700', fontSize: 12 },
});
