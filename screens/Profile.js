import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import BackButton from '../components/BackButton';
import MonthlyStepsChart from '../components/MonthlyStepsChart';
import WeeklyStepsChart from '../components/WeeklyStepsChart';
import WeeklyWorkoutsChart from '../components/WeeklyWorkoutsChart';
import { auth, db } from '../services/firebase';
import { setProfile } from '../store';
import { COLORS } from '../utils/constants';
import { getLevelAccent } from '../utils/levelAccent';

const getDateKey = (date) => {
  const current = date instanceof Date ? date : new Date(date);
  return `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
};

const formatNumber = (value) => Number(value || 0).toLocaleString();

const formatDateLabel = (value) => {
  if (!value) return 'No workout logged';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const getBmiCategory = (bmi) => {
  if (!Number.isFinite(bmi)) return 'Add height and weight';
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Healthy range';
  if (bmi < 30) return 'Overweight';
  return 'Obesity range';
};

const formatBodyShape = (value) => {
  if (!value) return 'Not set';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const formatSignedValue = (value, suffix = '') => {
  if (!Number.isFinite(value)) return 'No data';
  if (value === 0) return `0${suffix}`;
  return `${value > 0 ? '+' : ''}${value}${suffix}`;
};

const BODY_SHAPE_OPTIONS = ['athletic', 'lean', 'balanced', 'muscular'];
const GENDER_OPTIONS = ['male', 'female', 'non-binary', 'prefer not to say'];

const getLatestWorkoutDate = (sessionsByDate = {}) => {
  return Object.keys(sessionsByDate)
    .filter((key) => Array.isArray(sessionsByDate[key]) && sessionsByDate[key].length > 0)
    .sort()
    .pop() || null;
};

const ProfileScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const [analysisMode, setAnalysisMode] = useState('weekly');
  const [profileView, setProfileView] = useState('overview');
  const user = useSelector((state) => state.user || {});
  const stepsByDate = useSelector((state) => state.steps?.stepsByDate || {});
  const sessionsByDate = useSelector((state) => state.workouts?.sessionsByDate || {});
  const {
    avatarName,
    height,
    weight,
    bodyShape,
    photoUri,
    gender,
    dailyStepGoal,
    weeklyWorkoutGoal,
    targetWeight,
    level,
    streakCount,
    lastWorkoutDate,
  } = user;
  const [isEditing, setIsEditing] = useState(false);
  const [draftProfile, setDraftProfile] = useState({
    avatarName: '',
    photoUri: '',
    height: '',
    weight: '',
    bodyShape: 'athletic',
    gender: 'male',
    dailyStepGoal: '10000',
    weeklyWorkoutGoal: '5',
    targetWeight: '',
  });
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');

  useEffect(() => {
    navigation.setOptions?.({
      title: 'Profile',
      headerStyle: { backgroundColor: '#4F8EF7' },
      headerTintColor: '#FFF',
    });
  }, [navigation]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser?.uid) return;
      try {
        const ref = doc(db, 'users', currentUser.uid);
        const snapshot = await getDoc(ref);
        if (!snapshot.exists()) return;
        const data = snapshot.data() || {};
        dispatch(setProfile({
          avatarName: data.avatarName ?? avatarName,
          height: data.height ?? height,
          weight: data.weight ?? weight,
          bodyShape: data.bodyShape ?? bodyShape,
          photoUri: data.photoUri ?? photoUri,
          gender: data.gender ?? gender,
          dailyStepGoal: data.dailyStepGoal ?? dailyStepGoal,
          weeklyWorkoutGoal: data.weeklyWorkoutGoal ?? weeklyWorkoutGoal,
          targetWeight: data.targetWeight ?? targetWeight,
        }));
      } catch (error) {
        console.warn('Failed to load profile', error);
      }
    });

    return () => unsubscribe();
  }, [avatarName, bodyShape, dailyStepGoal, dispatch, gender, height, photoUri, targetWeight, weight, weeklyWorkoutGoal]);

  const numericHeight = Number(height);
  const numericWeight = Number(weight);
  const bmi = useMemo(() => {
    if (!numericHeight || !numericWeight) return null;
    const meters = numericHeight / 100;
    const value = numericWeight / (meters * meters);
    if (!Number.isFinite(value)) return null;
    return Math.round(value * 10) / 10;
  }, [numericHeight, numericWeight]);

  const healthyWeightRange = useMemo(() => {
    if (!numericHeight) return null;
    const meters = numericHeight / 100;
    const min = Math.round(18.5 * meters * meters * 10) / 10;
    const max = Math.round(24.9 * meters * meters * 10) / 10;
    return { min, max };
  }, [numericHeight]);

  const todayKey = useMemo(() => getDateKey(new Date()), []);
  const movementMetrics = useMemo(() => {
    const totalSteps = Object.values(stepsByDate).reduce((sum, value) => sum + (Number(value) || 0), 0);
    let weekSteps = 0;
    let monthSteps = 0;
    let activeDays7d = 0;

    const baseDate = new Date(`${todayKey}T00:00:00`);
    for (let i = 0; i < 30; i += 1) {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() - i);
      const key = getDateKey(date);
      const steps = Number(stepsByDate[key] || 0);
      const sessionCount = Array.isArray(sessionsByDate[key]) ? sessionsByDate[key].length : 0;
      monthSteps += steps;
      if (i < 7) {
        weekSteps += steps;
        if (steps > 0 || sessionCount > 0) activeDays7d += 1;
      }
    }

    return {
      todaySteps: Number(stepsByDate[todayKey] || 0),
      weekSteps,
      monthSteps,
      totalSteps,
      averageDailySteps7d: Math.round(weekSteps / 7),
      activeDays7d,
    };
  }, [sessionsByDate, stepsByDate, todayKey]);

  const trainingMetrics = useMemo(() => {
    let totalSessions = 0;
    let totalCalories = 0;
    let totalDuration = 0;

    Object.values(sessionsByDate).forEach((list) => {
      const sessions = Array.isArray(list) ? list : [];
      totalSessions += sessions.length;
      sessions.forEach((session) => {
        totalCalories += Number(session?.calories) || 0;
        totalDuration += Number(session?.durationMin) || 0;
      });
    });

    let weekSessions = 0;
    let weekCalories = 0;
    let weekDuration = 0;
    let monthSessions = 0;

    const baseDate = new Date(`${todayKey}T00:00:00`);
    for (let i = 0; i < 30; i += 1) {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() - i);
      const key = getDateKey(date);
      const sessions = Array.isArray(sessionsByDate[key]) ? sessionsByDate[key] : [];
      monthSessions += sessions.length;
      if (i < 7) {
        weekSessions += sessions.length;
        sessions.forEach((session) => {
          weekCalories += Number(session?.calories) || 0;
          weekDuration += Number(session?.durationMin) || 0;
        });
      }
    }

    return {
      weekSessions,
      monthSessions,
      totalSessions,
      weekCalories,
      averageSessionDuration: totalSessions ? Math.round(totalDuration / totalSessions) : 0,
      averageWorkoutMinutes7d: weekSessions ? Math.round(weekDuration / weekSessions) : 0,
      totalCalories,
      latestWorkoutDate: lastWorkoutDate || getLatestWorkoutDate(sessionsByDate),
    };
  }, [lastWorkoutDate, sessionsByDate, todayKey]);

  const goalMetrics = useMemo(() => {
    const resolvedDailyStepGoal = Math.max(0, Number(dailyStepGoal) || 0) || 10000;
    const resolvedWeeklyWorkoutGoal = Math.max(0, Number(weeklyWorkoutGoal) || 0) || 5;
    const derivedTargetWeight = healthyWeightRange
      ? numericWeight < healthyWeightRange.min
        ? healthyWeightRange.min
        : numericWeight > healthyWeightRange.max
          ? healthyWeightRange.max
          : numericWeight
      : null;
    const resolvedTargetWeight = Number(targetWeight) > 0 ? Math.round(Number(targetWeight) * 10) / 10 : derivedTargetWeight;
    const remainingStepsToday = Math.max(0, resolvedDailyStepGoal - movementMetrics.todaySteps);
    const remainingWorkoutsThisWeek = Math.max(0, resolvedWeeklyWorkoutGoal - trainingMetrics.weekSessions);
    const weightGap = resolvedTargetWeight && numericWeight ? Math.round((resolvedTargetWeight - numericWeight) * 10) / 10 : null;

    return {
      dailyStepGoal: resolvedDailyStepGoal,
      weeklyWorkoutGoal: resolvedWeeklyWorkoutGoal,
      targetWeight: resolvedTargetWeight,
      remainingStepsToday,
      remainingWorkoutsThisWeek,
      stepGoalProgress: resolvedDailyStepGoal > 0 ? Math.min(100, Math.round((movementMetrics.todaySteps / resolvedDailyStepGoal) * 100)) : 0,
      workoutGoalProgress: resolvedWeeklyWorkoutGoal > 0 ? Math.min(100, Math.round((trainingMetrics.weekSessions / resolvedWeeklyWorkoutGoal) * 100)) : 0,
      weightGap,
    };
  }, [dailyStepGoal, healthyWeightRange, movementMetrics.todaySteps, numericWeight, targetWeight, trainingMetrics.weekSessions, weeklyWorkoutGoal]);

  const trendMetrics = useMemo(() => {
    const currentWeekAvgSteps = movementMetrics.averageDailySteps7d;
    const baseDate = new Date(`${todayKey}T00:00:00`);
    let previousWeekSteps = 0;
    let previousMonthSteps = 0;

    for (let i = 7; i < 14; i += 1) {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() - i);
      const key = getDateKey(date);
      previousWeekSteps += Number(stepsByDate[key] || 0);
    }

    for (let i = 30; i < 60; i += 1) {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() - i);
      const key = getDateKey(date);
      previousMonthSteps += Number(stepsByDate[key] || 0);
    }

    let previousWeekSessions = 0;
    for (let i = 7; i < 14; i += 1) {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() - i);
      const key = getDateKey(date);
      previousWeekSessions += Array.isArray(sessionsByDate[key]) ? sessionsByDate[key].length : 0;
    }

    return {
      weeklyStepsDelta: currentWeekAvgSteps - Math.round(previousWeekSteps / 7),
      monthlyStepsDelta: movementMetrics.monthSteps - previousMonthSteps,
      weeklyWorkoutDelta: trainingMetrics.weekSessions - previousWeekSessions,
    };
  }, [movementMetrics.averageDailySteps7d, movementMetrics.monthSteps, sessionsByDate, stepsByDate, todayKey, trainingMetrics.weekSessions]);

  const movementCards = [
    { label: 'Today steps', value: formatNumber(movementMetrics.todaySteps) },
    { label: '7d avg steps', value: formatNumber(movementMetrics.averageDailySteps7d) },
    { label: '30d steps', value: formatNumber(movementMetrics.monthSteps) },
    { label: 'Active days 7d', value: `${movementMetrics.activeDays7d}/7` },
  ];

  const trainingCards = [
    { label: 'Workouts 7d', value: formatNumber(trainingMetrics.weekSessions) },
    { label: 'Workouts 30d', value: formatNumber(trainingMetrics.monthSessions) },
    { label: 'Calories 7d', value: formatNumber(trainingMetrics.weekCalories) },
    { label: 'Avg session', value: trainingMetrics.averageSessionDuration ? `${trainingMetrics.averageSessionDuration} min` : 'No data' },
  ];

  const summaryCards = [
    { label: 'Today', value: formatNumber(movementMetrics.todaySteps), helper: 'steps' },
    { label: 'Workouts', value: formatNumber(trainingMetrics.weekSessions), helper: 'this week' },
    { label: 'BMI', value: bmi ? `${bmi}` : '--', helper: getBmiCategory(bmi) },
    { label: 'Streak', value: `${Number(streakCount || 0)}`, helper: 'days' },
  ];

  const profileRows = [
    { label: 'Height', value: numericHeight ? `${numericHeight} cm` : 'Not set' },
    { label: 'Weight', value: numericWeight ? `${numericWeight} kg` : 'Not set' },
    { label: 'Body type', value: formatBodyShape(bodyShape) },
    { label: 'Gender', value: gender ? `${gender.charAt(0).toUpperCase()}${gender.slice(1)}` : 'Not set' },
    { label: 'Healthy range', value: healthyWeightRange ? `${healthyWeightRange.min}-${healthyWeightRange.max} kg` : 'Add height to calculate' },
    { label: 'Last workout', value: formatDateLabel(trainingMetrics.latestWorkoutDate) },
  ];

  const activityOverviewRows = [
    { label: '7d average steps', value: formatNumber(movementMetrics.averageDailySteps7d) },
    { label: '30d step volume', value: formatNumber(movementMetrics.monthSteps) },
    { label: 'Lifetime steps', value: formatNumber(movementMetrics.totalSteps) },
    { label: 'Calories burned', value: formatNumber(trainingMetrics.totalCalories) },
    { label: 'Avg workout', value: trainingMetrics.averageWorkoutMinutes7d ? `${trainingMetrics.averageWorkoutMinutes7d} min` : 'No recent workouts' },
    { label: 'Weekly workout delta', value: formatSignedValue(trendMetrics.weeklyWorkoutDelta) },
    { label: 'Step trend vs prior week', value: formatSignedValue(trendMetrics.weeklyStepsDelta) },
    { label: '30d trend vs prior month', value: formatSignedValue(trendMetrics.monthlyStepsDelta) },
  ];

  const openEditor = () => {
    setSaveError('');
    setDraftProfile({
      avatarName: avatarName || '',
      photoUri: photoUri || '',
      height: String(height || ''),
      weight: String(weight || ''),
      bodyShape: bodyShape || 'athletic',
      gender: gender || 'male',
      dailyStepGoal: String(dailyStepGoal || 10000),
      weeklyWorkoutGoal: String(weeklyWorkoutGoal || 5),
      targetWeight: String(targetWeight || ''),
    });
    setIsEditing(true);
  };

  const closeEditor = () => {
    if (isSaving) return;
    setIsEditing(false);
    setSaveError('');
  };

  const pickProfilePhoto = async () => {
    try {
      if (Platform.OS === 'web') {
        if (typeof document === 'undefined') return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            setDraftProfile((current) => ({
              ...current,
              photoUri: String(reader.result || ''),
            }));
          };
          reader.readAsDataURL(file);
        };
        input.click();
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        setSaveError('Photo library access is required to change your picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.82,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setDraftProfile((current) => ({
          ...current,
          photoUri: result.assets[0].uri,
        }));
      }
    } catch (_error) {
      setSaveError('Could not open the image picker.');
    }
  };

  const saveEditor = async () => {
    setSaveError('');
    setSyncNotice('');

    const nextName = draftProfile.avatarName.trim();
    const parsedDailyGoal = Math.max(0, Number(draftProfile.dailyStepGoal) || 0);
    const parsedWorkoutGoal = Math.max(0, Number(draftProfile.weeklyWorkoutGoal) || 0);
    const parsedTargetWeight = draftProfile.targetWeight.trim();

    if (!nextName) {
      setSaveError('Name cannot be empty.');
      return;
    }

    if (!parsedDailyGoal || !parsedWorkoutGoal) {
      setSaveError('Step and workout goals must be greater than zero.');
      return;
    }

    const profileUpdate = {
      avatarName: nextName,
      photoUri: draftProfile.photoUri || '',
      height: draftProfile.height.trim(),
      weight: draftProfile.weight.trim(),
      bodyShape: draftProfile.bodyShape,
      gender: draftProfile.gender,
      dailyStepGoal: parsedDailyGoal,
      weeklyWorkoutGoal: parsedWorkoutGoal,
      targetWeight: parsedTargetWeight,
    };

    setIsSaving(true);
    dispatch(setProfile(profileUpdate));
    setIsEditing(false);
    setIsSaving(false);

    const currentUser = auth.currentUser;
    if (currentUser?.uid) {
      (async () => {
        try {
          await setDoc(
            doc(db, 'users', currentUser.uid),
            {
              ...profileUpdate,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          setSyncNotice('Profile updated');
        } catch (error) {
          console.warn('Failed to save profile changes', error);
          setSyncNotice('Saved locally, but cloud sync failed.');
        }
      })();
      return;
    }

    setSyncNotice('Profile updated');
  };

  const displayName = isEditing ? draftProfile.avatarName : (avatarName || 'Your metrics');
  const displayPhotoUri = isEditing ? draftProfile.photoUri : photoUri;
  const displayInitial = (displayName || 'U').slice(0, 1).toUpperCase();
  const levelAccent = useMemo(() => getLevelAccent(level), [level]);

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <LinearGradient colors={['#0B1120', '#1B2339', '#23365A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
          <View style={styles.heroCornerActions}>
            {isEditing ? (
              <>
                <TouchableOpacity onPress={closeEditor} style={styles.editorGhostButton} activeOpacity={0.84} disabled={isSaving}>
                  <Text style={styles.editorGhostButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveEditor} style={[styles.editorPrimaryButton, isSaving && styles.editorPrimaryButtonDisabled]} activeOpacity={0.84} disabled={isSaving}>
                  <Text style={styles.editorPrimaryButtonText}>{isSaving ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity onPress={openEditor} style={styles.heroChangeButton} activeOpacity={0.84}>
                <Text style={styles.heroChangeButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.backRow}>
            <BackButton />
          </View>

          <View style={styles.heroHeader}>
            <View style={styles.avatarShell}>
              {displayPhotoUri ? (
                <Image source={{ uri: displayPhotoUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>{displayInitial}</Text>
                </View>
              )}
            </View>

            <View style={styles.heroCopy}>
              <View style={styles.heroTopRow}>
                <Text style={[styles.heroEyebrow, { color: levelAccent.accentText }]}>Health Profile</Text>
                <View style={[styles.heroLevelChip, { backgroundColor: levelAccent.pillColor, borderColor: levelAccent.borderColor }]}>
                  <Text style={[styles.heroLevelChipText, { color: levelAccent.accentText }]}>{`LV ${Math.max(1, Number(level) || 1)}`}</Text>
                </View>
              </View>
              {isEditing ? (
                <>
                  <TextInput
                    value={draftProfile.avatarName}
                    onChangeText={(value) => setDraftProfile((current) => ({ ...current, avatarName: value }))}
                    placeholder="Enter your display name"
                    placeholderTextColor="#6B7F9F"
                    style={[styles.editorInput, styles.heroNameInput]}
                  />
                  <Text style={styles.heroSubline}>Body composition, movement volume, and training consistency only.</Text>
                  <View style={styles.heroEditActions}>
                    <TouchableOpacity onPress={pickProfilePhoto} style={styles.secondaryButton} activeOpacity={0.84}>
                      <Text style={styles.secondaryButtonText}>Photo</Text>
                    </TouchableOpacity>
                  </View>
                  {saveError ? <Text style={styles.editorError}>{saveError}</Text> : null}
                </>
              ) : (
                <>
                  <Text style={styles.heroName}>{displayName}</Text>
                  <Text style={styles.heroSubline}>Body composition, movement volume, and training consistency only.</Text>
                  {syncNotice ? <Text style={styles.syncNotice}>{syncNotice}</Text> : null}
                </>
              )}
            </View>
          </View>

          <View style={styles.heroMetricRow}>
            <View style={styles.heroMetricCard}>
              <Text style={styles.heroMetricLabel}>BMI status</Text>
              <Text style={styles.heroMetricValue}>{getBmiCategory(bmi)}</Text>
            </View>
            <View style={styles.heroMetricCard}>
              <Text style={styles.heroMetricLabel}>Workout streak</Text>
              <Text style={styles.heroMetricValue}>{`${Number(streakCount || 0)} days`}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Plan</Text>
              <Text style={styles.sectionSubtitle}>Profile basics and targets in one place.</Text>
            </View>
          </View>

          <View style={styles.summaryGrid}>
            {summaryCards.map((card) => (
              <View key={card.label} style={styles.summaryTile}>
                <Text style={styles.summaryTileLabel}>{card.label}</Text>
                <Text style={styles.summaryTileValue}>{card.value}</Text>
                <Text style={styles.summaryTileHelper}>{card.helper}</Text>
              </View>
            ))}
          </View>

          <View style={styles.listPanel}>
            <Text style={styles.groupTitle}>Body details</Text>
            {isEditing ? (
              <View style={styles.editorStack}>
                <View style={styles.editorTwoCol}>
                  <View style={styles.editorField}>
                    <Text style={styles.editorMiniLabel}>Height</Text>
                    <TextInput
                      value={draftProfile.height}
                      onChangeText={(value) => setDraftProfile((current) => ({ ...current, height: value.replace(/[^0-9.]/g, '') }))}
                      keyboardType="numeric"
                      placeholder="175"
                      placeholderTextColor="#6B7F9F"
                      style={[styles.editorInput, styles.metricInput]}
                    />
                  </View>
                  <View style={styles.editorField}>
                    <Text style={styles.editorMiniLabel}>Weight</Text>
                    <TextInput
                      value={draftProfile.weight}
                      onChangeText={(value) => setDraftProfile((current) => ({ ...current, weight: value.replace(/[^0-9.]/g, '') }))}
                      keyboardType="numeric"
                      placeholder="70"
                      placeholderTextColor="#6B7F9F"
                      style={[styles.editorInput, styles.metricInput]}
                    />
                  </View>
                </View>
                <View style={styles.editorField}>
                  <Text style={styles.editorMiniLabel}>Body type</Text>
                  <View style={styles.choiceRowCompact}>
                    {BODY_SHAPE_OPTIONS.map((option) => {
                      const selected = draftProfile.bodyShape === option;
                      return (
                        <Pressable
                          key={option}
                          onPress={() => setDraftProfile((current) => ({ ...current, bodyShape: option }))}
                          style={[styles.choiceChip, styles.choiceChipCompact, selected && styles.choiceChipActive]}
                        >
                          <Text style={[styles.choiceChipText, selected && styles.choiceChipTextActive]}>{formatBodyShape(option)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <View style={styles.editorField}>
                  <Text style={styles.editorMiniLabel}>Gender</Text>
                  <View style={styles.choiceRowCompact}>
                    {GENDER_OPTIONS.map((option) => {
                      const selected = draftProfile.gender === option;
                      return (
                        <Pressable
                          key={option}
                          onPress={() => setDraftProfile((current) => ({ ...current, gender: option }))}
                          style={[styles.choiceChip, styles.choiceChipCompact, selected && styles.choiceChipActive]}
                        >
                          <Text style={[styles.choiceChipText, selected && styles.choiceChipTextActive]}>{formatBodyShape(option)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.listRows}>
                {profileRows.map((row) => (
                  <View key={row.label} style={styles.listRow}>
                    <Text style={styles.listRowLabel}>{row.label}</Text>
                    <Text style={styles.listRowValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.listPanel}>
            <Text style={styles.groupTitle}>Goals</Text>
            <View style={styles.goalStack}>
            <View style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <Text style={styles.goalLabel}>Daily step goal</Text>
                {isEditing ? (
                  <TextInput
                    value={draftProfile.dailyStepGoal}
                    onChangeText={(value) => setDraftProfile((current) => ({ ...current, dailyStepGoal: value.replace(/[^0-9]/g, '') }))}
                    keyboardType="numeric"
                    placeholder="10000"
                    placeholderTextColor="#6B7F9F"
                    style={[styles.editorInput, styles.goalInput]}
                  />
                ) : (
                  <Text style={styles.goalValue}>{`${formatNumber(goalMetrics.dailyStepGoal)} steps`}</Text>
                )}
              </View>
              <Text style={styles.goalHelper}>{goalMetrics.remainingStepsToday > 0 ? `${formatNumber(goalMetrics.remainingStepsToday)} left today` : 'Goal hit today'}</Text>
              <View style={styles.goalProgressTrack}>
                <LinearGradient
                  colors={['#14D8FF', '#3B82F6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.goalProgressFill, { width: `${goalMetrics.stepGoalProgress}%` }]}
                />
              </View>
            </View>
            <View style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <Text style={styles.goalLabel}>Weekly workout goal</Text>
                {isEditing ? (
                  <TextInput
                    value={draftProfile.weeklyWorkoutGoal}
                    onChangeText={(value) => setDraftProfile((current) => ({ ...current, weeklyWorkoutGoal: value.replace(/[^0-9]/g, '') }))}
                    keyboardType="numeric"
                    placeholder="5"
                    placeholderTextColor="#6B7F9F"
                    style={[styles.editorInput, styles.goalInput]}
                  />
                ) : (
                  <Text style={styles.goalValue}>{`${goalMetrics.weeklyWorkoutGoal} workouts`}</Text>
                )}
              </View>
              <Text style={styles.goalHelper}>{goalMetrics.remainingWorkoutsThisWeek > 0 ? `${goalMetrics.remainingWorkoutsThisWeek} left this week` : 'Weekly goal hit'}</Text>
              <View style={styles.goalProgressTrack}>
                <LinearGradient
                  colors={['#14D8FF', '#3B82F6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.goalProgressFill, { width: `${goalMetrics.workoutGoalProgress}%` }]}
                />
              </View>
            </View>
            <View style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <Text style={styles.goalLabel}>Target weight</Text>
                {isEditing ? (
                  <TextInput
                    value={draftProfile.targetWeight}
                    onChangeText={(value) => setDraftProfile((current) => ({ ...current, targetWeight: value.replace(/[^0-9.]/g, '') }))}
                    keyboardType="numeric"
                    placeholder="Optional"
                    placeholderTextColor="#6B7F9F"
                    style={[styles.editorInput, styles.goalInput]}
                  />
                ) : (
                  <Text style={styles.goalValue}>{goalMetrics.targetWeight ? `${goalMetrics.targetWeight} kg` : 'Set from BMI range'}</Text>
                )}
              </View>
              <Text style={styles.goalHelper}>{goalMetrics.weightGap === null ? 'Add body metrics' : goalMetrics.weightGap === 0 ? 'Inside target range' : `${formatSignedValue(goalMetrics.weightGap, ' kg')} to target`}</Text>
            </View>
          </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Activity</Text>
              <Text style={styles.sectionSubtitle}>A single place for movement, training, trends, and charts.</Text>
            </View>
          </View>
          <View style={styles.segmentedControl}>
            <Pressable
              onPress={() => setProfileView('overview')}
              style={[styles.segmentChip, profileView === 'overview' && styles.segmentChipActive]}
            >
              <Text style={[styles.segmentChipText, profileView === 'overview' && styles.segmentChipTextActive]}>Overview</Text>
            </Pressable>
            <Pressable
              onPress={() => setProfileView('charts')}
              style={[styles.segmentChip, profileView === 'charts' && styles.segmentChipActive]}
            >
              <Text style={[styles.segmentChipText, profileView === 'charts' && styles.segmentChipTextActive]}>Charts</Text>
            </Pressable>
          </View>

          {profileView === 'overview' ? (
            <>
              <View style={styles.summaryGrid}>
                {[...movementCards.slice(0, 2), ...trainingCards.slice(0, 2)].map((card) => (
                  <View key={card.label} style={styles.summaryTile}>
                    <Text style={styles.summaryTileLabel}>{card.label}</Text>
                    <Text style={styles.summaryTileValue}>{card.value}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.listPanel}>
                <Text style={styles.groupTitle}>Signals</Text>
                <View style={styles.listRows}>
                  {activityOverviewRows.map((row) => (
                    <View key={row.label} style={styles.listRow}>
                      <Text style={styles.listRowLabel}>{row.label}</Text>
                      <Text style={styles.listRowValue}>{row.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.analysisHeader}>
                <View>
                  <Text style={styles.groupTitle}>Progress charts</Text>
                  <Text style={styles.analysisSubtitle}>Switch between weekly and monthly step views below.</Text>
                </View>
              </View>
              {analysisMode === 'weekly' ? (
                <WeeklyStepsChart weeksBack={8} onPressMonthly={() => setAnalysisMode('monthly')} />
              ) : (
                <MonthlyStepsChart monthsTotal={12} monthsPerPage={6} onPressWeekly={() => setAnalysisMode('weekly')} />
              )}
              <Text style={styles.chartHint}>
                {analysisMode === 'weekly' ? 'Swipe horizontally to compare weekly step patterns.' : 'Monthly totals show longer-term movement trends.'}
              </Text>
              <WeeklyWorkoutsChart weeksBack={8} />
              <Text style={styles.chartHint}>Weekly workout completion is shown directly under step trends.</Text>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#070C18',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 88,
  },
  heroCard: {
    marginHorizontal: 14,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
    position: 'relative',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(117, 171, 255, 0.18)',
    shadowColor: COLORS.neonPurple,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 8,
  },
  backRow: {
    marginBottom: 8,
  },
  heroCornerActions: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarShell: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.24)',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#F7FBFF',
    fontSize: 28,
    fontWeight: '800',
  },
  heroCopy: {
    flex: 1,
    marginLeft: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroEyebrow: {
    color: '#14D8FF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroLevelChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroLevelChipText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  heroName: {
    color: '#F5F8FE',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  heroSubline: {
    color: '#B4C3DD',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  syncNotice: {
    color: '#9CE6B8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  heroMetricRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  heroMetricCard: {
    flex: 1,
    backgroundColor: 'rgba(8, 13, 24, 0.38)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.14)',
  },
  heroMetricLabel: {
    color: '#8EA9CB',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  heroMetricValue: {
    color: '#F4FAFF',
    fontSize: 16,
    fontWeight: '800',
  },
  sectionCard: {
    backgroundColor: 'rgba(9, 15, 28, 0.92)',
    marginHorizontal: 14,
    marginTop: 14,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(109, 145, 197, 0.18)',
  },
  sectionTitle: {
    color: '#F3F8FE',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 14,
  },
  sectionHeaderRow: {
    marginBottom: 14,
  },
  sectionSubtitle: {
    color: '#8EA3C5',
    fontSize: 12,
    marginTop: -6,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  summaryTile: {
    width: '48.3%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
    backgroundColor: 'rgba(17, 28, 48, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(22, 216, 255, 0.12)',
  },
  summaryTileLabel: {
    color: '#92A6C6',
    fontSize: 11,
    fontWeight: '700',
  },
  summaryTileValue: {
    color: '#F7FBFF',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 8,
  },
  summaryTileHelper: {
    color: '#8EA3C5',
    fontSize: 11,
    marginTop: 4,
  },
  listPanel: {
    borderRadius: 18,
    backgroundColor: 'rgba(12, 20, 34, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(104, 132, 176, 0.16)',
    padding: 14,
    marginBottom: 14,
  },
  groupTitle: {
    color: '#F3F8FE',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  listRows: {
    gap: 2,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(124, 149, 191, 0.14)',
  },
  listRowLabel: {
    color: '#8EA3C5',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  listRowValue: {
    color: '#F3F8FE',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 12,
    textAlign: 'right',
    maxWidth: '56%',
  },
  editorStack: {
    gap: 12,
  },
  editorTwoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  editorField: {
    flex: 1,
  },
  editorMiniLabel: {
    color: '#8EA3C5',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  changeButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(20, 216, 255, 0.32)',
    backgroundColor: 'rgba(20, 216, 255, 0.08)',
  },
  changeButtonText: {
    color: '#DDF7FF',
    fontSize: 12,
    fontWeight: '800',
  },
  heroChangeButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(20, 216, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(20, 216, 255, 0.26)',
  },
  heroChangeButtonText: {
    color: '#F7FBFF',
    fontSize: 12,
    fontWeight: '800',
  },
  inlineEditorCard: {
    borderRadius: 18,
    backgroundColor: 'rgba(12, 20, 34, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(104, 132, 176, 0.18)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 8,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricTile: {
    width: '48.3%',
    minHeight: 88,
    backgroundColor: 'rgba(17, 28, 48, 0.9)',
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(22, 216, 255, 0.12)',
    justifyContent: 'space-between',
  },
  metricLabel: {
    color: '#92A6C6',
    fontSize: 11,
    fontWeight: '600',
  },
  metricValue: {
    color: '#F7FBFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 10,
  },
  metricTileWide: {
    width: '100%',
    minHeight: 88,
    backgroundColor: 'rgba(17, 28, 48, 0.9)',
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(22, 216, 255, 0.12)',
    justifyContent: 'space-between',
  },
  insightPanel: {
    marginTop: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(12, 20, 34, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(104, 132, 176, 0.16)',
    overflow: 'hidden',
  },
  insightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(124, 149, 191, 0.14)',
  },
  insightLabel: {
    color: '#8EA3C5',
    fontSize: 12,
    fontWeight: '600',
  },
  insightValue: {
    color: '#F3F8FE',
    fontSize: 12,
    fontWeight: '700',
    maxWidth: '56%',
    textAlign: 'right',
  },
  trendStrip: {
    marginTop: 4,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(16, 28, 49, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(73, 103, 147, 0.18)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendItem: {
    flex: 1,
  },
  trendLabel: {
    color: '#91A7CA',
    fontSize: 11,
    fontWeight: '600',
  },
  trendValue: {
    color: '#F4F9FF',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 7,
  },
  trendDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(123, 147, 188, 0.18)',
    marginHorizontal: 14,
  },
  goalStack: {
    gap: 10,
  },
  goalCard: {
    borderRadius: 16,
    backgroundColor: 'rgba(17, 28, 48, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(22, 216, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  goalLabel: {
    color: '#D8E4F5',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  goalValue: {
    color: '#F7FBFF',
    fontSize: 14,
    fontWeight: '800',
  },
  goalHelper: {
    color: '#94A9C8',
    fontSize: 12,
    marginTop: 8,
  },
  goalProgressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 10,
    overflow: 'hidden',
  },
  goalProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  analysisHeader: {
    marginBottom: 6,
  },
  analysisSubtitle: {
    color: '#90A6C7',
    fontSize: 12,
    marginTop: -6,
    marginBottom: 6,
  },
  segmentedControl: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  segmentChip: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: 'rgba(12, 20, 34, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(120, 151, 193, 0.2)',
    alignItems: 'center',
  },
  segmentChipActive: {
    backgroundColor: 'rgba(20, 216, 255, 0.14)',
    borderColor: 'rgba(20, 216, 255, 0.32)',
  },
  segmentChipText: {
    color: '#AFC2DF',
    fontSize: 12,
    fontWeight: '700',
  },
  segmentChipTextActive: {
    color: '#F7FBFF',
  },
  chartHint: {
    color: '#9BB0CF',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  editorLabel: {
    color: '#DCE9F7',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 10,
  },
  editorInput: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(120, 151, 193, 0.2)',
    backgroundColor: 'rgba(14, 24, 41, 0.96)',
    color: '#F7FBFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  photoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  editorAvatarShell: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.24)',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editorAvatarImage: {
    width: '100%',
    height: '100%',
  },
  secondaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(20, 216, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(20, 216, 255, 0.24)',
  },
  secondaryButtonText: {
    color: '#E7F9FF',
    fontSize: 12,
    fontWeight: '700',
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(120, 151, 193, 0.2)',
    backgroundColor: 'rgba(14, 24, 41, 0.96)',
  },
  choiceChipActive: {
    borderColor: 'rgba(20, 216, 255, 0.38)',
    backgroundColor: 'rgba(20, 216, 255, 0.14)',
  },
  choiceChipText: {
    color: '#CFE0F4',
    fontSize: 12,
    fontWeight: '700',
  },
  choiceChipTextActive: {
    color: '#F7FBFF',
  },
  editorError: {
    color: '#FF9FB0',
    fontSize: 12,
    marginTop: 12,
  },
  inlineEditorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  editorGhostButton: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  editorGhostButtonText: {
    color: '#D6E4F6',
    fontSize: 13,
    fontWeight: '700',
  },
  editorPrimaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: '#1D9BF0',
  },
  editorPrimaryButtonDisabled: {
    opacity: 0.7,
  },
  editorPrimaryButtonText: {
    color: '#F7FBFF',
    fontSize: 13,
    fontWeight: '800',
  },
});

export default ProfileScreen;