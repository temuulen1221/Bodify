import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { COLORS } from '../utils/constants';

export default function QuestProgress({ value = 0, max = 100, height = 6 }) {
	const pct = Math.max(0, Math.min(100, Math.round((value / Math.max(1, max)) * 100)));
	return (
		<View style={[styles.bg, { height }]}> 
			<LinearGradient
				colors={[COLORS.neonCyan, COLORS.neonPurple]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 0 }}
				style={[styles.fill, { width: `${pct}%` }]}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	bg: {
		width: '100%',
		backgroundColor: 'rgba(0,0,0,0.32)',
		borderRadius: 4,
		overflow: 'hidden',
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: 'rgba(0,231,255,0.35)'
	},
	fill: {
		height: '100%',
		borderRadius: 4,
	},
});
