import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import AvatarCamera from '../components/AvatarCamera';
import BackButton from '../components/BackButton';
import InteractiveAvatar from '../components/InteractiveAvatar';
import { auth, db } from '../services/firebase';
import { setProfile } from '../store';
import { getAvatarModelOptionsForGender, resolveAvatarModelSelection } from '../utils/avatarModels';
import { GRADIENTS } from '../utils/constants';

const MALE_HAIRSTYLE_OPTIONS = [
	{ id: 'short_fade', label: 'Short Fade', hint: 'Clean and sharp' },
	{ id: 'messy_crop', label: 'Messy Crop', hint: 'Easygoing style' },
	{ id: 'long_flow', label: 'Long Flow', hint: 'Loose and athletic' },
	{ id: 'buzz_cut', label: 'Buzz Cut', hint: 'Minimal and bold' },
];

const FEMALE_HAIRSTYLE_OPTIONS = [
	{ id: 'long_layers', label: 'Long Layers', hint: 'Flowy and polished' },
	{ id: 'wavy_bob', label: 'Wavy Bob', hint: 'Soft and stylish' },
	{ id: 'ponytail', label: 'Ponytail', hint: 'Active and clean' },
	{ id: 'high_bun', label: 'High Bun', hint: 'Neat and elevated' },
];

const EYE_COLOR_OPTIONS = [
	{ id: 'blue', label: 'Blue' },
	{ id: 'green', label: 'Green' },
	{ id: 'brown', label: 'Brown' },
	{ id: 'gray', label: 'Gray' },
];

const SKIN_TONE_OPTIONS = [
	{ id: 'fair', label: 'Fair' },
	{ id: 'medium', label: 'Medium' },
	{ id: 'tan', label: 'Tan' },
	{ id: 'deep', label: 'Deep' },
];

const CLOTHING_OPTIONS = [
	{ id: 'starter_armor', label: 'Starter Armor', hint: 'Light adventurer gear', badge: '🛡️' },
	{ id: 'training_top', label: 'Training Top', hint: 'Sporty and practical', badge: '🧥' },
	{ id: 'combat_vest', label: 'Combat Vest', hint: 'RPG frontline look', badge: '⚔️' },
	{ id: 'stealth_suit', label: 'Stealth Suit', hint: 'Silent mission style', badge: '🖤' },
];

const ACCESSORY_OPTIONS = [
	{ id: 'adventurer_pack', label: 'Adventurer Pack', hint: 'Utility backpack', badge: '🎒' },
	{ id: 'wrist_wraps', label: 'Wrist Wraps', hint: 'Training and agility', badge: '🤲' },
	{ id: 'utility_belt', label: 'Utility Belt', hint: 'Quick item storage', badge: '🧰' },
	{ id: 'none', label: 'No Accessory', hint: 'Clean silhouette', badge: '•' },
];

const HAT_OPTIONS = [
	{ id: 'none', label: 'No Hat', hint: 'Barehead view', badge: '○' },
	{ id: 'cap', label: 'Cap', hint: 'Modern casual', badge: '🧢' },
	{ id: 'hood', label: 'Hood', hint: 'Shadowed RPG feel', badge: '🖤' },
	{ id: 'helm', label: 'Light Helm', hint: 'Fantasy battle style', badge: '⛑️' },
];

const EDITOR_TABS = [
	{ id: 'body', label: 'Body', icon: 'person-outline' },
	{ id: 'hair', label: 'Hair', icon: 'cut-outline' },
	{ id: 'face', label: 'Face', icon: 'eye-outline' },
	{ id: 'gear', label: 'Gear', icon: 'shield-outline' },
	{ id: 'photo', label: 'Photo', icon: 'camera-outline' },
];

const Home = () => {
	const route = useRoute();
	const navigation = useNavigation();
	const persistedUser = useSelector((state: any) => state.user || {});
	const userData = (route.params as any)?.userData || persistedUser;
	const avatarHeight = String(persistedUser.height || userData.height || '175');
	const avatarWeight = String(persistedUser.weight || userData.weight || '70');
	const [gender, setGender] = useState(String(userData.gender || 'male'));
	const [avatarModel, setAvatarModel] = useState(resolveAvatarModelSelection(userData.avatarModel, userData.gender || 'male'));
	const [hairstyle, setHairstyle] = useState(String(userData.hairstyle || 'short_fade'));
	const [eyeColor, setEyeColor] = useState(String(userData.eyeColor || 'blue'));
	const [skinTone, setSkinTone] = useState(String(userData.skinTone || 'medium'));
	const [clothingStyle, setClothingStyle] = useState(String(userData.clothingStyle || 'starter_armor'));
	const [accessoryStyle, setAccessoryStyle] = useState(String(userData.accessoryStyle || 'adventurer_pack'));
	const [hatStyle, setHatStyle] = useState(String(userData.hatStyle || 'none'));
	const [activeTab, setActiveTab] = useState('body');
	const dispatch = useDispatch();
	const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
	const [usedPhoto, setUsedPhoto] = useState<string | null>(null);
	const cameraRef = useRef<any>(null);
	const [savedToast, setSavedToast] = useState(false);
	const insets = useSafeAreaInsets();
	const selectedModelOption = useMemo(
		() => getAvatarModelOptionsForGender(gender).find((option) => option.id === avatarModel),
		[avatarModel, gender]
	);
	const previewPhotoLabel = usedPhoto ? 'Custom photo applied' : pendingPhoto ? 'Photo ready to use' : 'No photo yet';
	const activeTabLabel = EDITOR_TABS.find((tab) => tab.id === activeTab)?.label || 'Body';
	const hairstyleOptions = useMemo(
		() => (gender === 'female' ? FEMALE_HAIRSTYLE_OPTIONS : MALE_HAIRSTYLE_OPTIONS),
		[gender]
	);

	useEffect(() => {
		const availableModelIds = getAvatarModelOptionsForGender(gender).map((modelOption) => modelOption.id);
		if (!availableModelIds.includes(avatarModel)) {
			setAvatarModel(resolveAvatarModelSelection(null, gender));
		}
	}, [avatarModel, gender]);

	useEffect(() => {
		const hasSelectedHair = hairstyleOptions.some((option) => option.id === hairstyle);
		if (!hasSelectedHair) {
			setHairstyle(hairstyleOptions[0]?.id || '');
		}
	}, [gender, hairstyle, hairstyleOptions]);

	const handleUsePhoto = () => {
		if (!pendingPhoto) return;
		dispatch(setProfile({ photoUri: pendingPhoto }));
		setUsedPhoto(pendingPhoto);
		setPendingPhoto(null);
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
	};

		const handleSave = async () => {
			const profileUpdate = { gender, photoUri: usedPhoto, avatarModel, hairstyle, eyeColor, skinTone, clothingStyle, accessoryStyle, hatStyle };
			dispatch((setProfile as any)(profileUpdate));

			const currentUser = auth.currentUser;
			if (currentUser?.uid) {
				try {
					await setDoc(
						doc(db, 'users', currentUser.uid),
						{
							...profileUpdate,
							avatarSetupComplete: true,
							updatedAt: serverTimestamp(),
						},
						{ merge: true }
					);
				} catch (error) {
					console.warn('[AvatarScreen] Failed to save avatar profile to Firestore', error);
				}
			}

			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
			setSavedToast(true);
			setTimeout(() => setSavedToast(false), 1200);
			if (navigation.canGoBack()) navigation.goBack();
		};

	return (
		<LinearGradient colors={GRADIENTS.futuristic as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
			<View style={styles.header}>
				<BackButton />
				<Text style={styles.greeting}>Hello, User!</Text>
					<TouchableOpacity style={styles.profileBtn} onPress={() => (navigation as any).navigate('Profile')}>
					<Ionicons name="person-circle-outline" size={36} color="#4F8EF7" />
				</TouchableOpacity>
			</View>

			<ScrollView
				style={styles.scroll}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: Math.max(24, insets.bottom + 12) },
				]}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.summaryCard}>
					<View style={styles.summaryTopRow}>
						<View>
							<Text style={styles.summaryEyebrow}>Avatar Studio</Text>
							<Text style={styles.summaryTitle}>Character Creator</Text>
						</View>
						<View style={styles.summaryBadge}>
							<Text style={styles.summaryBadgeText}>{gender === 'female' ? 'Female' : 'Male'}</Text>
						</View>
					</View>
					<View style={styles.summaryMetaRow}>
						<View style={styles.summaryMetaPill}>
							<Text style={styles.summaryMetaLabel}>Model</Text>
							<Text style={styles.summaryMetaValue}>{selectedModelOption?.label || 'Unknown'}</Text>
						</View>
						<View style={styles.summaryMetaPill}>
							<Text style={styles.summaryMetaLabel}>Photo</Text>
							<Text style={styles.summaryMetaValue}>{previewPhotoLabel}</Text>
						</View>
					</View>
				</View>

				<View style={styles.editorShell}>
					<View style={styles.stageCard}>
						<View style={styles.stageHeader}>
							<View>
								<Text style={styles.stageEyebrow}>Live preview</Text>
								<Text style={styles.stageTitle}>Tap a category to customize</Text>
							</View>
							<View style={styles.stagePill}>
								<Text style={styles.stagePillText}>{activeTabLabel}</Text>
							</View>
						</View>

						<View style={styles.stageContentRow}>
							<View style={styles.avatarContainer}>
								<View style={styles.avatarPreviewWrap}>
									<InteractiveAvatar {...{ model: avatarModel, height: avatarHeight, weight: avatarWeight, gender, photoUri: usedPhoto, enableVoice: false, enableTTS: false, preserveTPose: true, playAnimation: false, sizeMultiplier: 0.98, yOffset: -0.04, alignFootToBottom: true, bottomPadding: 0.02, headMargin: 0.16, focus: 'full', fitMode: 'shrink', targetFill: 0.88 } as any} />
								</View>
							</View>
							<View style={styles.editorRail}>
								{EDITOR_TABS.map((tab) => {
									const selected = activeTab === tab.id;
									return (
										<TouchableOpacity key={tab.id} onPress={() => setActiveTab(tab.id)} activeOpacity={0.86} style={[styles.railButton, selected && styles.railButtonSelected]}>
											<Ionicons name={tab.icon as any} size={20} color={selected ? '#fff' : 'rgba(255,255,255,0.72)'} />
											<Text style={[styles.railButtonText, selected && styles.railButtonTextSelected]}>{tab.label}</Text>
										</TouchableOpacity>
									);
								})}
							</View>
						</View>
					</View>

					<View style={styles.trayCard}>
						{activeTab === 'body' ? (
							<View>
								<Text style={styles.trayTitle}>Body setup</Text>
								<Text style={styles.traySubtitle}>Choose the base model here. Height and weight stay in your profile.</Text>
								<View style={styles.genderPills}>
									{['male', 'female'].map((g) => (
										<TouchableOpacity key={g} onPress={() => setGender(g)} style={[styles.genderPill, gender === g && styles.genderPillSelected]}>
											<Text style={[styles.genderPillText, gender === g && styles.genderPillTextSelected]}>{g === 'male' ? 'Male' : 'Female'}</Text>
										</TouchableOpacity>
									))}
								</View>
								<View style={styles.modelGridCompact}>
									{getAvatarModelOptionsForGender(gender).map((modelOption) => {
										const selected = avatarModel === modelOption.id;
										return (
											<TouchableOpacity key={modelOption.id} onPress={() => setAvatarModel(modelOption.id)} style={[styles.assetCard, selected && styles.assetCardSelected]}>
												<Text style={[styles.assetTitle, selected && styles.assetTitleSelected]}>{modelOption.label}</Text>
												<Text style={[styles.assetHint, selected && styles.assetHintSelected]}>{modelOption.description}</Text>
											</TouchableOpacity>
										);
									})}
								</View>
							</View>
						) : null}

						{activeTab === 'hair' ? (
							<View>
								<Text style={styles.trayTitle}>Hair style</Text>
								<Text style={styles.traySubtitle}>Placeholder slots for later hair assets.</Text>
								<View style={styles.assetGrid}>
									{hairstyleOptions.map((option) => {
										const selected = hairstyle === option.id;
										return (
											<TouchableOpacity key={option.id} onPress={() => setHairstyle(option.id)} style={[styles.assetCard, selected && styles.assetCardSelected]}>
												<Text style={[styles.assetTitle, selected && styles.assetTitleSelected]}>{option.label}</Text>
												<Text style={[styles.assetHint, selected && styles.assetHintSelected]}>{option.hint}</Text>
											</TouchableOpacity>
										);
									})}
								</View>
							</View>
						) : null}

						{activeTab === 'face' ? (
							<View>
								<Text style={styles.trayTitle}>Face details</Text>
								<Text style={styles.traySubtitle}>Eyes and skin tone keep the character readable in battle UI.</Text>
								<View style={styles.subSection}>
									<Text style={styles.sectionLabel}>Eye color</Text>
									<View style={styles.swatchRow}>
										{EYE_COLOR_OPTIONS.map((option) => {
											const selected = eyeColor === option.id;
											return (
												<TouchableOpacity key={option.id} onPress={() => setEyeColor(option.id)} style={[styles.swatchCard, selected && styles.swatchCardSelected]}>
													<View style={[styles.swatchDot, (styles as any)[`swatchDot_${option.id}`]]} />
													<Text style={[styles.swatchLabel, selected && styles.swatchLabelSelected]}>{option.label}</Text>
												</TouchableOpacity>
											);
										})}
									</View>
								</View>
								<View style={styles.subSection}>
									<Text style={styles.sectionLabel}>Skin tone</Text>
									<View style={styles.swatchRow}>
										{SKIN_TONE_OPTIONS.map((option) => {
											const selected = skinTone === option.id;
											return (
												<TouchableOpacity key={option.id} onPress={() => setSkinTone(option.id)} style={[styles.swatchCard, selected && styles.swatchCardSelected]}>
													<View style={[styles.skinToneChip, (styles as any)[`skinTone_${option.id}`]]} />
													<Text style={[styles.swatchLabel, selected && styles.swatchLabelSelected]}>{option.label}</Text>
												</TouchableOpacity>
											);
										})}
									</View>
								</View>
							</View>
						) : null}

						{activeTab === 'gear' ? (
							<View>
								<Text style={styles.trayTitle}>Gear loadout</Text>
								<Text style={styles.traySubtitle}>Clothing, accessories, and hats are grouped like a game inventory.</Text>
								<View style={styles.subSection}>
									<Text style={styles.sectionLabel}>Clothing</Text>
									<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gearStrip}>
										{CLOTHING_OPTIONS.map((option) => {
											const selected = clothingStyle === option.id;
											return (
												<TouchableOpacity key={option.id} onPress={() => setClothingStyle(option.id)} style={[styles.gearCard, selected && styles.gearCardSelected]} activeOpacity={0.88}>
													<View style={[styles.gearPreview, selected && styles.gearPreviewSelected]}>
														<Text style={styles.gearPreviewText}>{option.badge}</Text>
													</View>
													<Text style={[styles.assetTitle, styles.gearCardTitle, selected && styles.assetTitleSelected]}>{option.label}</Text>
													<Text style={[styles.assetHint, styles.gearCardHint, selected && styles.assetHintSelected]}>{option.hint}</Text>
												</TouchableOpacity>
											);
										})}
									</ScrollView>
								</View>
								<View style={styles.subSection}>
									<Text style={styles.sectionLabel}>Accessories</Text>
									<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gearStrip}>
										{ACCESSORY_OPTIONS.map((option) => {
											const selected = accessoryStyle === option.id;
											return (
												<TouchableOpacity key={option.id} onPress={() => setAccessoryStyle(option.id)} style={[styles.gearCard, selected && styles.gearCardSelected]} activeOpacity={0.88}>
													<View style={[styles.gearPreview, selected && styles.gearPreviewSelected]}>
														<Text style={styles.gearPreviewText}>{option.badge}</Text>
													</View>
													<Text style={[styles.assetTitle, styles.gearCardTitle, selected && styles.assetTitleSelected]}>{option.label}</Text>
													<Text style={[styles.assetHint, styles.gearCardHint, selected && styles.assetHintSelected]}>{option.hint}</Text>
												</TouchableOpacity>
											);
										})}
									</ScrollView>
								</View>
								<View style={styles.subSection}>
									<Text style={styles.sectionLabel}>Hat</Text>
									<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gearStrip}>
										{HAT_OPTIONS.map((option) => {
											const selected = hatStyle === option.id;
											return (
												<TouchableOpacity key={option.id} onPress={() => setHatStyle(option.id)} style={[styles.gearCard, selected && styles.gearCardSelected]} activeOpacity={0.88}>
													<View style={[styles.gearPreview, selected && styles.gearPreviewSelected]}>
														<Text style={styles.gearPreviewText}>{option.badge}</Text>
													</View>
													<Text style={[styles.assetTitle, styles.gearCardTitle, selected && styles.assetTitleSelected]}>{option.label}</Text>
													<Text style={[styles.assetHint, styles.gearCardHint, selected && styles.assetHintSelected]}>{option.hint}</Text>
												</TouchableOpacity>
											);
										})}
									</ScrollView>
								</View>
							</View>
						) : null}

						{activeTab === 'photo' ? (
							<View>
								<Text style={styles.trayTitle}>Profile photo</Text>
								<Text style={styles.traySubtitle}>Capture a selfie to give the avatar a more personal feel.</Text>
								<View style={styles.toolsRow}>
									<AvatarCamera ref={cameraRef} onCapture={setPendingPhoto} />
									{pendingPhoto ? (
										<View style={styles.photoThumbWrap}>
											<Image source={{ uri: pendingPhoto }} style={styles.photoThumb} />
											<TouchableOpacity style={styles.retakeBtn} onPress={() => cameraRef.current?.open?.()}><Text style={styles.retakeBtnText}>Retake</Text></TouchableOpacity>
											<TouchableOpacity style={styles.useBtn} onPress={handleUsePhoto}><Text style={styles.useBtnText}>Use</Text></TouchableOpacity>
										</View>
									) : null}
								</View>
							</View>
						) : null}
					</View>
				</View>

				<View style={styles.saveSection}>
					<Text style={styles.saveHint}>Changes are saved to your profile and used across the app.</Text>
					<TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.88}>
						<LinearGradient colors={['#4F8EF7', '#6A00FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saveBtnInner}>
							<Text style={styles.saveBtnText}>Save avatar</Text>
						</LinearGradient>
					</TouchableOpacity>
				</View>
			</ScrollView>
			{savedToast ? (
				<View style={styles.toast}>
					<Text style={styles.toastText}>Saved</Text>
				</View>
			) : null}
	</LinearGradient>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		paddingHorizontal: 20,
		paddingTop: 12,
	},
	scroll: {
		flex: 1,
	},
	scrollContent: {
		paddingBottom: 32,
	},
	editorShell: {
		gap: 12,
	},
	stageCard: {
		backgroundColor: 'rgba(255,255,255,0.11)',
		borderRadius: 22,
		padding: 14,
		borderWidth: 1,
		borderColor: 'rgba(255,255,255,0.16)',
	},
	stageHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		gap: 10,
		marginBottom: 12,
	},
	stageEyebrow: {
		color: 'rgba(255,255,255,0.72)',
		fontSize: 11,
		fontWeight: '800',
		textTransform: 'uppercase',
		letterSpacing: 1,
	},
	stageTitle: {
		color: '#fff',
		fontSize: 17,
		fontWeight: '800',
		marginTop: 2,
	},
	stagePill: {
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 999,
		backgroundColor: 'rgba(79,142,247,0.24)',
		borderWidth: 1,
		borderColor: 'rgba(79,142,247,0.38)',
	},
	stagePillText: {
		color: '#fff',
		fontSize: 11,
		fontWeight: '800',
	},
	stageContentRow: {
		flexDirection: 'row',
		gap: 12,
		alignItems: 'stretch',
	},
	editorRail: {
		width: 92,
		justifyContent: 'space-between',
		gap: 8,
	},
	railButton: {
		flex: 1,
		minHeight: 56,
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 8,
		backgroundColor: 'rgba(255,255,255,0.08)',
		borderWidth: 1,
		borderColor: 'rgba(255,255,255,0.14)',
		gap: 4,
	},
	railButtonSelected: {
		backgroundColor: 'rgba(79,142,247,0.24)',
		borderColor: 'rgba(79,142,247,0.4)',
	},
	railButtonText: {
		fontSize: 10,
		color: 'rgba(255,255,255,0.75)',
		fontWeight: '800',
	},
	railButtonTextSelected: {
		color: '#fff',
	},
	trayCard: {
		backgroundColor: 'rgba(11,17,32,0.7)',
		borderRadius: 22,
		padding: 14,
		borderWidth: 1,
		borderColor: 'rgba(255,255,255,0.1)',
		boxShadow: '0px 10px 16px #000',
		elevation: 5,
	},
	trayTitle: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '800',
	},
	traySubtitle: {
		color: 'rgba(255,255,255,0.72)',
		fontSize: 12,
		marginTop: 3,
		marginBottom: 12,
	},
	modelGridCompact: {
		gap: 8,
		marginTop: 10,
		marginBottom: 10,
	},
	assetGrid: {
		gap: 8,
	},
	gearStrip: {
		gap: 10,
		paddingRight: 6,
	},
	gearCard: {
		width: 146,
		borderRadius: 16,
		paddingHorizontal: 12,
		paddingVertical: 12,
		borderWidth: 1,
		borderColor: 'rgba(176,208,247,0.32)',
		backgroundColor: 'rgba(255,255,255,0.07)',
	},
	gearCardSelected: {
		borderColor: '#4F8EF7',
		backgroundColor: 'rgba(79,142,247,0.22)',
	},
	gearPreview: {
		width: 40,
		height: 40,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'rgba(255,255,255,0.12)',
		borderWidth: 1,
		borderColor: 'rgba(255,255,255,0.14)',
		marginBottom: 10,
	},
	gearPreviewSelected: {
		backgroundColor: 'rgba(255,255,255,0.18)',
		borderColor: 'rgba(255,255,255,0.22)',
	},
	gearPreviewText: {
		fontSize: 16,
	},
	gearCardTitle: {
		fontSize: 14,
		marginBottom: 2,
	},
	gearCardHint: {
		fontSize: 11,
		lineHeight: 15,
	},
	assetCard: {
		paddingHorizontal: 12,
		paddingVertical: 11,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: 'rgba(176,208,247,0.32)',
		backgroundColor: 'rgba(255,255,255,0.07)',
	},
	assetCardSelected: {
		borderColor: '#4F8EF7',
		backgroundColor: 'rgba(79,142,247,0.22)',
	},
	assetTitle: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '800',
	},
	assetTitleSelected: {
		color: '#f5faff',
	},
	assetHint: {
		color: 'rgba(255,255,255,0.72)',
		fontSize: 11,
		marginTop: 3,
	},
	assetHintSelected: {
		color: '#fff',
	},
	subSection: {
		marginTop: 12,
	},
	summaryCard: {
		backgroundColor: 'rgba(255,255,255,0.12)',
		borderRadius: 16,
		padding: 10,
		marginBottom: 10,
		borderWidth: 1,
		borderColor: 'rgba(255,255,255,0.16)',
	},
	summaryTopRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		gap: 12,
	},
	summaryEyebrow: {
		color: 'rgba(255,255,255,0.7)',
		fontSize: 10,
		fontWeight: '800',
		textTransform: 'uppercase',
		letterSpacing: 1,
	},
	summaryTitle: {
		color: '#fff',
		fontSize: 15,
		fontWeight: '800',
		marginTop: 1,
	},
	summaryBadge: {
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 999,
		backgroundColor: 'rgba(255,255,255,0.14)',
	},
	summaryBadgeText: {
		color: '#fff',
		fontSize: 10,
		fontWeight: '800',
	},
	summaryMetaRow: {
		flexDirection: 'row',
		gap: 8,
		marginTop: 8,
	},
	summaryMetaPill: {
		flex: 1,
		borderRadius: 12,
		paddingHorizontal: 10,
		paddingVertical: 8,
		backgroundColor: 'rgba(0,0,0,0.16)',
	},
	summaryMetaLabel: {
		color: 'rgba(255,255,255,0.68)',
		fontSize: 9,
		fontWeight: '800',
		textTransform: 'uppercase',
		letterSpacing: 0.8,
	},
	summaryMetaValue: {
		color: '#fff',
		fontSize: 12,
		fontWeight: '700',
		marginTop: 3,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 10,
	},
	greeting: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
	profileBtn: {
		padding: 4,
	},
	avatarContainer: {
		alignItems: 'center',
		justifyContent: 'center',
		flex: 1,
	},
	avatarPreviewWrap: {
		backgroundColor: 'transparent',
		width: '100%',
		maxWidth: 280,
		height: 320,
	},
	toolsRow: {
		flexDirection: 'row',
		alignItems: 'center',
		flexWrap: 'wrap',
		gap: 10,
		marginTop: 4,
		marginBottom: 12,
		marginLeft: 0,
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
		backgroundColor: 'rgba(255,255,255,0.11)',
		borderRadius: 18,
		padding: 14,
		marginBottom: 14,
		width: '100%',
		borderWidth: 1,
		borderColor: 'rgba(255,255,255,0.16)',
		boxShadow: '0px 3px 8px #000',
		elevation: 4,
	},
	selectorTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
	selectorSubtitle: { color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 4, marginBottom: 12 },
	genderRow: { marginBottom: 10 },
	sectionLabel: { fontSize: 13, fontWeight: '800', color: '#dce9ff', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
	genderPills: { flexDirection: 'row', gap: 8 },
	modelRow: { marginBottom: 12 },
	modelGrid: { gap: 8 },
	modelCard: {
		paddingHorizontal: 12,
		paddingVertical: 10,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: 'rgba(176,208,247,0.45)',
		backgroundColor: 'rgba(255,255,255,0.08)',
	},
	modelCardSelected: {
		borderColor: '#4F8EF7',
		backgroundColor: 'rgba(79,142,247,0.22)',
	},
	modelCardTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 2 },
	modelCardTitleSelected: { color: '#dce9ff' },
	modelCardDescription: { color: '#cfe3ff', fontSize: 12 },
	modelCardDescriptionSelected: { color: '#fff' },
	appearanceSection: {
		marginTop: 12,
	},
	appearanceGrid: {
		gap: 8,
	},
	appearanceCard: {
		paddingHorizontal: 12,
		paddingVertical: 10,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: 'rgba(176,208,247,0.35)',
		backgroundColor: 'rgba(255,255,255,0.07)',
	},
	appearanceCardSelected: {
		borderColor: '#4F8EF7',
		backgroundColor: 'rgba(79,142,247,0.22)',
	},
	appearanceCardTitle: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '800',
	},
	appearanceCardTitleSelected: {
		color: '#f5faff',
	},
	appearanceCardHint: {
		color: 'rgba(255,255,255,0.72)',
		fontSize: 11,
		marginTop: 3,
	},
	appearanceCardHintSelected: {
		color: '#fff',
	},
	swatchRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	swatchCard: {
		minWidth: 72,
		paddingHorizontal: 10,
		paddingVertical: 10,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: 'rgba(176,208,247,0.35)',
		backgroundColor: 'rgba(255,255,255,0.07)',
		alignItems: 'center',
	},
	swatchCardSelected: {
		borderColor: '#4F8EF7',
		backgroundColor: 'rgba(79,142,247,0.22)',
	},
	swatchDot: {
		width: 20,
		height: 20,
		borderRadius: 10,
		marginBottom: 6,
		borderWidth: 1,
		borderColor: 'rgba(255,255,255,0.25)',
	},
	swatchDot_blue: { backgroundColor: '#3B82F6' },
	swatchDot_green: { backgroundColor: '#22C55E' },
	swatchDot_brown: { backgroundColor: '#8B5A2B' },
	swatchDot_gray: { backgroundColor: '#94A3B8' },
	swatchLabel: {
		color: 'rgba(255,255,255,0.82)',
		fontSize: 11,
		fontWeight: '700',
	},
	swatchLabelSelected: {
		color: '#fff',
	},
	skinToneChip: {
		width: 20,
		height: 20,
		borderRadius: 10,
		marginBottom: 6,
		borderWidth: 1,
		borderColor: 'rgba(255,255,255,0.22)',
	},
	skinTone_fair: { backgroundColor: '#F2D6C2' },
	skinTone_medium: { backgroundColor: '#D3A07A' },
	skinTone_tan: { backgroundColor: '#B97C4C' },
	skinTone_deep: { backgroundColor: '#7A4B2A' },
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
		boxShadow: '0px 2px 6px #000',
		elevation: 3,
	},
	stepBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
	stepValue: { fontSize: 15, fontWeight: '700', color: '#fff' },
	metricsCard: {
		backgroundColor: 'rgba(0,0,0,0.22)',
		borderRadius: 18,
		padding: 16,
		width: '100%',
		marginBottom: 12,
		borderWidth: 1,
		borderColor: 'rgba(255,255,255,0.12)',
		boxShadow: '0px 4px 10px #000',
		elevation: 6,
	},
	metricsTitle: { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 12 },
	metricsRow: { flexDirection: 'row', gap: 10 },
	metricChip: {
		flex: 1,
		borderRadius: 14,
		padding: 12,
		backgroundColor: 'rgba(255,255,255,0.08)',
		borderWidth: 1,
		borderColor: 'rgba(255,255,255,0.12)',
	},
	metricLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 6, fontWeight: '700', textTransform: 'uppercase' },
	metricValue: { color: '#fff', fontWeight: '800', fontSize: 16 },
	saveSection: { marginTop: 4, marginBottom: 4 },
	saveHint: { color: 'rgba(255,255,255,0.72)', fontSize: 12, marginBottom: 10, lineHeight: 17 },
	saveBtn: {
		borderRadius: 14,
		overflow: 'hidden',
		boxShadow: '0px 3px 6px #000',
		elevation: 4,
	},
	saveBtnInner: {
		paddingVertical: 14,
		paddingHorizontal: 20,
		borderRadius: 12,
		alignItems: 'center',
		width: '100%',
	},
	saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
	toast: {
		position: 'absolute',
		bottom: 90,
		alignSelf: 'center',
		backgroundColor: 'rgba(0,0,0,0.7)',
		paddingHorizontal: 14,
		paddingVertical: 8,
		borderRadius: 16,
		pointerEvents: 'none',
	},
	toastText: { color: '#fff', fontWeight: '700' },
}) as unknown as Record<string, any>;

export default Home;