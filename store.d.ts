import type { EnhancedStore } from '@reduxjs/toolkit';

// Root slices state shape inferred from store.js; kept broad for now.
export interface UserState {
  level: number;
  points: number;
  pointsMax: number;
  totalXP: number;
  energy: number;
  discountTickets: number;
  streakShields: number;
  ownedShopItems: string[];
  streakCount: number;
  bestStreak: number;
  lastWorkoutDate: string | null;
  recentRewards: any[];
  lastRewardAt: number | null;
  lastLevelUpAt: number | null;
  lastLevelUpReward: any | null;
  lastLevelUpModalSeenAt: number | null;
  lastBadgeLevelUpAt: number | null;
  lastBadgeLevelUpReward: any | null;
  lastBadgeLevelUpSeenAt: number | null;
  levelUpPreviewReward: any | null;
  avatarName: string;
  height: string;
  weight: string;
  bodyShape: string;
  photoUri: string;
  gender: string;
  avatarSetupComplete: boolean;
  dailyStepGoal: number;
  weeklyWorkoutGoal: number;
  targetWeight: string;
  avatarModel: string;
  hairstyle: string;
  eyeColor: string;
  skinTone: string;
  clothingStyle: string;
  accessoryStyle: string;
  hatStyle: string;
  selectedBadgeKey: string | null;
  badgeXPByCategory: Record<string, number>;
  avatar: any;
}
export interface QuestsState {
  dailyCompletion: Record<string, true>;
  xpAwardedByDate: Record<string, Record<string, true>>;
  weeklySquatRepsByWeek: Record<string, number>;
  weeklyXPAwardedByWeek: Record<string, true>;
}
export interface WorkoutSession {
  id: string;
  title: string;
  durationMin: number;
  calories: number;
  notes: string;
  type: string;
  awardedXP?: number;
  exerciseDetails?: Array<{ label?: string; type?: string; reps?: number; seconds?: number }>;
  createdAt?: number;
  distanceKm?: number;
}
export interface WorkoutsState {
  sessionsByDate: Record<string, WorkoutSession[]>;
  xpAwardedSessionIdsByDate: Record<string, Record<string, true>>;
}
export interface StepsState {
  stepsByDate: Record<string, number>;
}
export interface RootState {
  user: UserState;
  quests: QuestsState;
  workouts: WorkoutsState;
  steps: StepsState;
  pose: {
    currentExercise: string;
    currentReps: number;
    startedAt: number | null;
    cameraTrackingEnabled: boolean;
    privacyAccepted: boolean;
    formFeedback: string;
  };
}

declare const store: EnhancedStore<RootState>;
export default store;

// Named action creators exported from store.js (user slice)
export declare const hydrateUser: (payload: Partial<UserState>) => any;
export declare const addXP: ((payload: number) => any) & ((payload: { amount: number; source?: string; title?: string; subtitle?: string }) => any);
export declare const addBadgeXP: (payload: { amount: number; category?: string; categories?: string[]; source?: string; title?: string; subtitle?: string }) => any;
export declare const markDayComplete: (payload: string) => any;
export declare const resetDay: (payload: string) => any;
export declare const categorizeWorkoutSessionForBadgeXp: (session?: Record<string, any>) => string[];
export declare const registerWorkoutDay: (payload: string) => any;
export declare const setPoints: (payload: number) => any;
export declare const setLevel: (payload: number) => any;
export declare const setPointsMax: (payload: number) => any;
export declare const setEnergy: (payload: number) => any;
export declare const setProfile: (payload: Partial<UserState>) => any;
export declare const setAvatar: (payload: any) => any;
export declare const addOwnedShopItem: (payload: string) => any;
export declare const consumeDiscountTicket: () => any;
export declare const spendEnergy: (payload: number) => any;
export declare const showLevelUpPreview: (payload?: any) => any;
export declare const dismissLevelUpModal: () => any;
export declare const dismissBadgeLevelUpModal: () => any;
export declare const setSelectedBadgeKey: (payload: string | null) => any;
export declare const hydrateQuests: (payload: Partial<QuestsState>) => any;
export declare const hydrateWorkouts: (payload: Partial<WorkoutsState>) => any;
export declare const hydrateSteps: (payload: Partial<StepsState>) => any;
export declare const markQuestXPAwarded: (payload: { date: string; key: string }) => any;
export declare const markSessionXPAwarded: (payload: { date: string; sessionId: string }) => any;
export declare const addWorkoutSession: (payload: { date: string; session: Partial<WorkoutSession> & { reps?: string | number } }) => any;
export declare const clearDayWorkouts: (payload: string) => any;
export declare const addWeeklySquatReps: (payload: { date: string; reps: number }) => any;
export declare const markWeeklyXPAwarded: (payload: { weekKey: string }) => any;
export declare const setPoseExercise: (payload: string) => any;
export declare const incrementPoseRep: () => any;
export declare const resetPoseSession: () => any;
export declare const setCameraTrackingEnabled: (payload: boolean) => any;
export declare const acceptPrivacy: () => any;
export declare const setFormFeedback: (payload: string) => any;
