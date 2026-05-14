import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { dismissLevelUpModal } from '../store';
import RewardBadge from './RewardBadge';

const REWARD_ITEM_LABELS = {
  a1: 'Cyber Jacket',
  a4: 'Visor Glasses',
  a5: 'Badge: Achiever',
  o2: 'Full Workout Course',
};

export default function LevelUpRewardModal() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { lastLevelUpAt, lastLevelUpReward, lastLevelUpModalSeenAt, levelUpPreviewReward, energy, discountTickets, streakShields } = useSelector((state) => state.user || {});
  const pulse = useRef(new Animated.Value(0.92)).current;
  const cardRise = useRef(new Animated.Value(18)).current;
  const confetti = useRef([...Array(10)].map(() => new Animated.Value(0))).current;

  const activeReward = levelUpPreviewReward || lastLevelUpReward;
  const visible = Boolean(
    levelUpPreviewReward || (
      lastLevelUpAt
      && lastLevelUpReward
      && lastLevelUpReward.createdAt === lastLevelUpAt
      && lastLevelUpModalSeenAt !== lastLevelUpAt
    )
  );
  const level = Math.max(1, Number(activeReward?.level) || 1);
  const energyAwarded = Math.max(0, Number(activeReward?.energyAwarded) || 0);
  const levelsGained = Math.max(1, Number(activeReward?.levelsGained) || 1);
  const milestoneRewards = Array.isArray(activeReward?.milestoneRewards) ? activeReward.milestoneRewards : [];
  const rewardHighlights = useMemo(() => milestoneRewards.flatMap((reward) => {
    const entries = [];
    (reward.items || []).forEach((itemId) => {
      entries.push(`Unlocked ${REWARD_ITEM_LABELS[itemId] || itemId}`);
    });
    if (reward.tickets > 0) entries.push(`${reward.tickets} discount ticket${reward.tickets === 1 ? '' : 's'}`);
    if (reward.shields > 0) entries.push(`${reward.shields} streak shield${reward.shields === 1 ? '' : 's'}`);
    return entries;
  }), [milestoneRewards]);

  useEffect(() => {
    if (!visible) return undefined;

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 820, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.95, duration: 820, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );

    const intro = Animated.timing(cardRise, {
      toValue: 0,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    const confettiAnimation = confetti.map((value, index) => Animated.timing(value, {
      toValue: 1,
      duration: 850 + (index * 60),
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }));

    pulseLoop.start();
    intro.start();
    Animated.stagger(35, confettiAnimation).start();

    return () => {
      pulseLoop.stop();
      pulse.setValue(0.92);
      cardRise.setValue(18);
      confetti.forEach((value) => value.setValue(0));
    };
  }, [cardRise, confetti, pulse, visible]);

  const handleClose = () => {
    dispatch(dismissLevelUpModal());
  };

  const handleOpenShop = () => {
    dispatch(dismissLevelUpModal());
    router.push('/Shop');
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={handleClose}>
      <View style={styles.overlay}>
        {confetti.map((value, index) => (
          <Animated.View
            key={`confetti-${index}`}
            pointerEvents="none"
            style={[
              styles.confettiPiece,
              {
                left: `${8 + index * 8}%`,
                backgroundColor: index % 3 === 0 ? '#00E7FF' : index % 3 === 1 ? '#7C3AED' : '#FDE047',
                opacity: value.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
                transform: [
                  { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [-40, 420] }) },
                  { rotate: value.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${140 + index * 6}deg`] }) },
                ],
              },
            ]}
          />
        ))}
        <Animated.View style={[styles.cardWrap, { transform: [{ translateY: cardRise }] }]}>
        <LinearGradient colors={['#5B321E', '#704021', '#C95A06', '#F06A07']} locations={[0, 0.46, 0.82, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
          <Animated.View style={[styles.glowBurst, { transform: [{ scale: pulse }] }]} />
          <View style={styles.eyebrowRow}>
            <Text style={styles.eyebrow}>{levelUpPreviewReward ? 'LEVEL UP PREVIEW' : 'LEVEL UP'}</Text>
            <Text style={styles.levelChip}>LV {level}</Text>
          </View>

          <View style={styles.heroRow}>
            <View style={styles.levelOrb}>
              <Text style={styles.levelOrbValue}>{level}</Text>
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.title}>Level Up</Text>
              <Text style={styles.subtitle}>
                {levelsGained > 1 ? `+${levelsGained} levels` : 'New tier unlocked'}
              </Text>
            </View>
          </View>

          <View style={styles.rewardPanel}>
            <RewardBadge label="Energy" value={energyAwarded} />
            <Text style={styles.balanceText}>{`Balance ${Math.max(0, Number(energy) || 0)} energy`}</Text>
            {(Number(discountTickets) || 0) > 0 || (Number(streakShields) || 0) > 0 ? (
              <Text style={styles.balanceMeta}>{`${Math.max(0, Number(discountTickets) || 0)} ticket${Number(discountTickets) === 1 ? '' : 's'} • ${Math.max(0, Number(streakShields) || 0)} shield${Number(streakShields) === 1 ? '' : 's'}`}</Text>
            ) : null}
          </View>

          {milestoneRewards.length > 0 ? (
            <View style={styles.milestonePanel}>
              {rewardHighlights.map((entry) => (
                <View key={entry} style={styles.rewardChip}>
                  <Text style={styles.rewardChipText}>{entry}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <Pressable onPress={handleClose} style={[styles.actionButton, styles.secondaryButton]}>
              <Text style={styles.secondaryButtonText}>Continue</Text>
            </Pressable>
            <Pressable onPress={handleOpenShop} style={[styles.actionButton, styles.primaryButton]}>
              <Text style={styles.primaryButtonText}>Open Shop</Text>
            </Pressable>
          </View>
        </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(4, 10, 24, 0.68)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  cardWrap: {
    width: '100%',
    maxWidth: 452,
  },
  card: {
    width: '100%',
    borderRadius: 28,
    paddingHorizontal: 26,
    paddingTop: 28,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 189, 122, 0.45)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 14,
    overflow: 'hidden',
  },
  glowBurst: {
    position: 'absolute',
    top: -108,
    left: 92,
    width: 268,
    height: 268,
    borderRadius: 134,
    backgroundColor: 'rgba(171, 110, 55, 0.34)',
  },
  confettiPiece: {
    position: 'absolute',
    top: -24,
    width: 8,
    height: 16,
    borderRadius: 4,
  },
  eyebrowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  eyebrow: {
    color: '#B9F4FF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  levelChip: {
    color: '#FFE6C8',
    fontSize: 13,
    fontWeight: '800',
    backgroundColor: 'rgba(95, 59, 31, 0.9)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 198, 143, 0.24)',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 22,
  },
  levelOrb: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 1,
    borderColor: 'rgba(244, 196, 151, 0.45)',
    backgroundColor: 'rgba(54, 39, 35, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelOrbValue: {
    color: '#FDE8CC',
    fontSize: 42,
    fontWeight: '900',
  },
  heroCopy: {
    flex: 1,
  },
  title: {
    color: '#FFF8F1',
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 4,
  },
  subtitle: {
    color: '#FFD7B3',
    fontSize: 14,
    fontWeight: '800',
  },
  rewardPanel: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: 'rgba(110, 82, 67, 0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255, 228, 205, 0.14)',
    gap: 8,
    marginBottom: 18,
  },
  balanceText: {
    color: '#A8F2FF',
    fontSize: 13,
    fontWeight: '800',
  },
  balanceMeta: {
    color: 'rgba(255, 237, 221, 0.72)',
    fontSize: 11,
    fontWeight: '700',
  },
  milestonePanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 22,
  },
  rewardChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(104, 84, 75, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 226, 198, 0.16)',
  },
  rewardChipText: {
    color: '#FFF6EE',
    fontSize: 12,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  actionButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: 'rgba(121, 84, 59, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 205, 165, 0.18)',
  },
  primaryButton: {
    backgroundColor: '#19C2F2',
  },
  secondaryButtonText: {
    color: '#FFF8F1',
    fontSize: 15,
    fontWeight: '800',
  },
  primaryButtonText: {
    color: '#081018',
    fontSize: 15,
    fontWeight: '900',
  },
});