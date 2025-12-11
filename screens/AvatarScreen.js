import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import Avatar from '../components/avatar';
import AvatarCamera from '../components/AvatarCamera';
import BackButton from '../components/BackButton';
import { setProfile } from '../store';
import { GRADIENTS } from '../utils/constants';

const Home = () => {
	const route = useRoute();
	const navigation = useNavigation();
	const { userData = { height: '175', weight: '70' } } = route.params || {};
	const [height, setHeight] = useState(String(userData.height || '175'));
	const [weight, setWeight] = useState(String(userData.weight || '70'));
	const [gender, setGender] = useState('male');
	const dispatch = useDispatch();
	const [pendingPhoto, setPendingPhoto] = useState(null);
	const [usedPhoto, setUsedPhoto] = useState(null);
	const cameraRef = useRef(null);
	const [savedToast, setSavedToast] = useState(false);
	const headerHeight = useHeaderHeight();
	const insets = useSafeAreaInsets();

	const handleUsePhoto = () => {
		if (!pendingPhoto) return;
		dispatch(setProfile({ photoUri: pendingPhoto }));
		setUsedPhoto(pendingPhoto);
		setPendingPhoto(null);
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
	};

	const handleSave = () => {
		dispatch(setProfile({ height, weight, gender, photoUri: usedPhoto }));
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
		setSavedToast(true);
		setTimeout(() => setSavedToast(false), 1200);
		// Navigate back if coming from somewhere else
		if (navigation.canGoBack()) navigation.goBack();
	};

	return (
		<LinearGradient colors={GRADIENTS.futuristic} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
			<View style={styles.header}>
				<BackButton />
				<Text style={styles.greeting}>Hello, User!</Text>
				<TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}>
					<Ionicons name="person-circle-outline" size={36} color="#4F8EF7" />
				</TouchableOpacity>
			</View>

			<View style={styles.avatarContainer}>
				{/* Show VRM avatar with customizable properties */}
							<View style={{ backgroundColor: 'transparent', width: 300, height: 300 }}>
					<Avatar height={height} weight={weight} gender={gender} photoUri={usedPhoto} />
				</View>
			</View>

			{/* Camera controls just below header */}
			<View style={[styles.toolsRow, { marginTop: (headerHeight ? headerHeight + 6 : insets.top + 12) + 12 }]}>
				<AvatarCamera ref={cameraRef} onCapture={setPendingPhoto} />
				{pendingPhoto ? (
					<View style={styles.photoThumbWrap}>
						<Image source={{ uri: pendingPhoto }} style={styles.photoThumb} />
						<TouchableOpacity style={styles.retakeBtn} onPress={() => cameraRef.current?.open?.()}>
							<Text style={styles.retakeBtnText}>Retake</Text>
						</TouchableOpacity>
						<TouchableOpacity style={styles.useBtn} onPress={handleUsePhoto}>
							<Text style={styles.useBtnText}>Use</Text>
						</TouchableOpacity>
					</View>
				) : null}
			</View>

			{/* Avatar Selection Section */}
			<View style={styles.selectorCard}>
				<Text style={styles.selectorTitle}>Customize your avatar</Text>
				<View style={styles.genderRow}>
					<Text style={styles.genderLabel}>Gender</Text>
					<View style={styles.genderPills}>
						{['male', 'female'].map((g) => (
							<TouchableOpacity
								key={g}
								onPress={() => setGender(g)}
								style={[styles.genderPill, gender === g && styles.genderPillSelected]}
							>
								<Text style={[styles.genderPillText, gender === g && styles.genderPillTextSelected]}>
									{g === 'male' ? 'Male' : 'Female'}
								</Text>
							</TouchableOpacity>
						))}
					</View>
				</View>
				<View style={styles.stepRowWrap}>
					<View style={styles.stepRow}>
						<Text style={styles.stepLabel}>Height</Text>
						<View style={styles.stepControls}>
							<TouchableOpacity
								style={styles.stepBtn}
								onPress={() => setHeight((h) => String(Math.max(120, (parseInt(h || '0', 10) || 0) - 1)))}
							>
								<Text style={styles.stepBtnText}>-</Text>
							</TouchableOpacity>
							<Text style={styles.stepValue}>{height} cm</Text>
							<TouchableOpacity
								style={styles.stepBtn}
								onPress={() => setHeight((h) => String(Math.min(220, (parseInt(h || '0', 10) || 0) + 1)))}
							>
								<Text style={styles.stepBtnText}>+</Text>
							</TouchableOpacity>
						</View>
					</View>
					<View style={styles.stepRow}>
						<Text style={styles.stepLabel}>Weight</Text>
						<View style={styles.stepControls}>
							<TouchableOpacity
								style={styles.stepBtn}
								onPress={() => setWeight((w) => String(Math.max(35, (parseInt(w || '0', 10) || 0) - 1)))}
							>
								<Text style={styles.stepBtnText}>-</Text>
							</TouchableOpacity>
							<Text style={styles.stepValue}>{weight} kg</Text>
							<TouchableOpacity
								style={styles.stepBtn}
								onPress={() => setWeight((w) => String(Math.min(180, (parseInt(w || '0', 10) || 0) + 1)))}
							>
								<Text style={styles.stepBtnText}>+</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</View>
			<View style={styles.metricsCard}>
				<Text style={styles.metricLabel}>
					Height: <Text style={styles.metricValue}>{height} cm</Text>
				</Text>
				<Text style={styles.metricLabel}>
					Weight: <Text style={styles.metricValue}>{weight} kg</Text>
				</Text>
			</View>
			<TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
				<Text style={styles.saveBtnText}>Save Avatar</Text>
			</TouchableOpacity>
			{savedToast ? (
				<View style={styles.toast} pointerEvents="none">
					<Text style={styles.toastText}>Saved</Text>
				</View>
			) : null}
		</LinearGradient>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 20,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 18,
	},
	greeting: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
	profileBtn: {
		padding: 4,
	},
	avatarContainer: { alignItems: 'center', marginBottom: 24, height: 220 },
	toolsRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		marginTop: 16,
		marginBottom: 12,
		marginLeft: 8,
	},
	photoThumbWrap: {
		marginTop: 8,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	photoThumb: { width: 40, height: 40, borderRadius: 8 },
	retakeBtn: {
		backgroundColor: '#4F8EF7',
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 8,
	},
	retakeBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
	useBtn: {
		backgroundColor: '#2e7d32',
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 8,
	},
	useBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
	selectorCard: {
		backgroundColor: 'rgba(255,255,255,0.12)',
		borderRadius: 16,
		padding: 14,
		marginBottom: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 3 },
		shadowOpacity: 0.25,
		shadowRadius: 8,
		elevation: 4,
	},
	selectorTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 6 },
	genderRow: { marginBottom: 10 },
	genderLabel: { fontSize: 14, fontWeight: '700', color: '#1a2233', marginBottom: 6 },
	genderPills: { flexDirection: 'row', gap: 8 },
	genderPill: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 20,
		borderWidth: 1.5,
		borderColor: '#b0d0f7',
		backgroundColor: '#f7faff',
	},
	genderPillSelected: { backgroundColor: '#4F8EF7', borderColor: '#4F8EF7' },
	genderPillText: { color: '#1a2233', fontWeight: '600' },
	genderPillTextSelected: { color: '#fff' },
	stepRowWrap: { gap: 8 },
	stepRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		backgroundColor: 'rgba(255,255,255,0.08)',
		borderColor: 'rgba(176,208,247,0.35)',
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	stepLabel: { fontSize: 14, fontWeight: '600', color: '#cfe3ff' },
	stepControls: { flexDirection: 'row', alignItems: 'center' },
	stepBtn: {
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: 'rgba(79,142,247,0.9)',
		alignItems: 'center',
		justifyContent: 'center',
		marginHorizontal: 8,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 6,
		elevation: 3,
	},
	stepBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
	stepValue: { fontSize: 15, fontWeight: '700', color: '#fff' },
	metricsCard: {
		backgroundColor: 'rgba(0,0,0,0.25)',
		borderRadius: 18,
		padding: 24,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.25,
		shadowRadius: 10,
		elevation: 6,
		alignItems: 'center',
	},
	metricLabel: { fontSize: 18, color: '#cfe3ff', marginBottom: 8, fontWeight: '600' },
	metricValue: { color: '#fff', fontWeight: 'bold' },
	saveBtn: {
		marginTop: 14,
		backgroundColor: 'rgba(79,142,247,0.95)',
		paddingVertical: 12,
		borderRadius: 12,
		alignItems: 'center',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 3 },
		shadowOpacity: 0.25,
		shadowRadius: 6,
		elevation: 4,
	},
	saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
	toast: {
		position: 'absolute',
		bottom: 90,
		alignSelf: 'center',
		backgroundColor: 'rgba(0,0,0,0.7)',
		paddingHorizontal: 14,
		paddingVertical: 8,
		borderRadius: 16,
	},
	toastText: { color: '#fff', fontWeight: '700' },
});

export default Home;