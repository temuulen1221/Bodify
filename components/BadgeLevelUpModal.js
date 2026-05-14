import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { dismissBadgeLevelUpModal } from '../store';
import { buildBadgeData } from '../utils/badgeSystem';

export default function BadgeLevelUpModal() {
  const router = useRouter();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user || {});
  const stepsByDate = useSelector((state) => state.steps?.stepsByDate || {});
  const sessionsByDate = useSelector((state) => state.workouts?.sessionsByDate || {});
  const { lastBadgeLevelUpAt, lastBadgeLevelUpReward, lastBadgeLevelUpSeenAt } = user;

  const visible = Boolean(
    lastBadgeLevelUpAt
    && lastBadgeLevelUpReward
    && lastBadgeLevelUpReward.createdAt === lastBadgeLevelUpAt
    && lastBadgeLevelUpSeenAt !== lastBadgeLevelUpAt
  );

  const todayKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const { badgeConfigs } = useMemo(
    () => buildBadgeData({ user, stepsByDate, sessionsByDate, todayKey }),
    [sessionsByDate, stepsByDate, todayKey, user]
  );

  const rewardCards = useMemo(() => {
    const rewards = Array.isArray(lastBadgeLevelUpReward?.rewards) ? lastBadgeLevelUpReward.rewards : [];
    return rewards.map((reward) => {
      const badge = badgeConfigs.find((entry) => entry.key === reward.key);
      return {
        ...reward,
        label: badge?.label || reward.label,
        rank: badge?.rank || 'D',
        tone: badge?.tone || 'cyan',
        progress: badge?.progress || 0,
      };
    });
  }, [badgeConfigs, lastBadgeLevelUpReward?.rewards]);

  const handleClose = () => {
    dispatch(dismissBadgeLevelUpModal());
  };

  const handleOpenAchievements = () => {
    dispatch(dismissBadgeLevelUpModal());
    router.push('/(tabs)/achievements');
  };

  if (!visible || rewardCards.length === 0) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <LinearGradient colors={['#081220', '#102338', '#123A52']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.eyebrow}>Badge Level Up</Text>
              <Text style={styles.title}>Category progress increased</Text>
              <Text style={styles.subtitle}>Your recent activity pushed these badges to a new level.</Text>
            </View>
            <View style={styles.countChip}>
              <Text style={styles.countChipText}>{rewardCards.length}</Text>
            </View>
          </View>

          <View style={styles.rewardList}>
            {rewardCards.map((reward) => (
              <View key={`${reward.key}-${reward.level}`} style={styles.rewardCard}>
                <View style={styles.rewardLead}>
                  <View style={styles.rewardIconWrap}>
                    <Icon name="shield-star" size={18} color="#12D9FF" />
                  </View>
                  <View style={styles.rewardCopy}>
                    <Text style={styles.rewardTitle}>{reward.label}</Text>
                    <Text style={styles.rewardSubtitle}>Level {reward.level} · Rank {reward.rank}</Text>
                  </View>
                </View>
                <View style={styles.rewardMeta}>
                  <Text style={styles.rewardXp}>+{reward.xp} XP</Text>
                  <Text style={styles.rewardTotal}>{reward.totalXp} total</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.actionRow}>
            <Pressable onPress={handleClose} style={[styles.actionButton, styles.secondaryButton]}>
              <Text style={styles.secondaryButtonText}>Continue</Text>
            </Pressable>
            <Pressable onPress={handleOpenAchievements} style={[styles.actionButton, styles.primaryButton]}>
              <Text style={styles.primaryButtonText}>View Badges</Text>
            </Pressable>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(4, 10, 24, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 22,
    borderWidth: 1,
    borderColor: 'rgba(18,217,255,0.24)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  eyebrow: {
    color: '#8FDBFF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  title: {
    color: '#F8FBFF',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
  },
  subtitle: {
    color: '#9CB2D1',
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 280,
  },
  countChip: {
    minWidth: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,18,33,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(18,217,255,0.24)',
  },
  countChipText: {
    color: '#F8FBFF',
    fontSize: 16,
    fontWeight: '800',
  },
  rewardList: {
    gap: 10,
  },
  rewardCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(140,170,210,0.18)',
    backgroundColor: 'rgba(8,14,26,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rewardLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  rewardIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18,217,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(18,217,255,0.2)',
  },
  rewardCopy: {
    flex: 1,
  },
  rewardTitle: {
    color: '#F5F8FE',
    fontSize: 13,
    fontWeight: '700',
  },
  rewardSubtitle: {
    color: '#8FA7C9',
    fontSize: 11,
    marginTop: 2,
  },
  rewardMeta: {
    alignItems: 'flex-end',
  },
  rewardXp: {
    color: '#12D9FF',
    fontSize: 12,
    fontWeight: '800',
  },
  rewardTotal: {
    color: '#8FA7C9',
    fontSize: 10,
    marginTop: 3,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  actionButton: {
    flex: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  secondaryButton: {
    backgroundColor: 'rgba(67, 85, 115, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(140,170,210,0.2)',
  },
  primaryButton: {
    backgroundColor: '#169DFF',
  },
  secondaryButtonText: {
    color: '#F8FBFF',
    fontSize: 13,
    fontWeight: '700',
  },
  primaryButtonText: {
    color: '#F8FBFF',
    fontSize: 13,
    fontWeight: '800',
  },
});