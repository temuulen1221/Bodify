import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ComponentType, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackButton from '../components/BackButton';
import InteractiveAvatar from '../components/InteractiveAvatar';
import { BattleEvent, BattleParticipantInput, BattleResult, buildParticipantFromWorkout, generateBattleScript, mockBattleExample } from '../utils/battleScript';
import { fallbackFriends, fetchFriendsForBattle } from '../utils/friendsData';

const playDelayMs = 1100;

type InteractiveAvatarProps = {
  gender?: string;
  sizeMultiplier?: number;
  alignFootToBottom?: boolean;
  bottomPadding?: number;
  enableVoice?: boolean;
  enableTTS?: boolean;
  model?: string | null;
  photoUri?: string | null;
};

const InteractiveAvatarComponent = InteractiveAvatar as unknown as ComponentType<InteractiveAvatarProps>;

type BattleParams = {
  userName?: string;
  opponentName?: string;
  userPushups?: string;
  userPlankSec?: string;
  oppPushups?: string;
  oppPlankSec?: string;
  seed?: string;
};

const useParticipants = (params: BattleParams) => {
  return useMemo<{ userInput: BattleParticipantInput; opponentInput: BattleParticipantInput; seed?: number }>(() => {
    const hasCustom = params.userName || params.opponentName;
    if (!hasCustom) {
      const mock = mockBattleExample();
      return {
        userInput: buildParticipantFromWorkout('Temuulen', { pushups: 30, plankSec: 60 }, { id: 'user' }),
        opponentInput: buildParticipantFromWorkout('Alex', { pushups: 20, plankSec: 30 }, { id: 'opponent' }),
        seed: mock.seed,
      };
    }
    const userInput = buildParticipantFromWorkout(
      params.userName || 'You',
      {
        pushups: Number(params.userPushups ?? 0) || 0,
        plankSec: Number(params.userPlankSec ?? 0) || 0,
      },
      { id: 'user' }
    );
    const opponentInput = buildParticipantFromWorkout(
      params.opponentName || 'Rival',
      {
        pushups: Number(params.oppPushups ?? 0) || 0,
        plankSec: Number(params.oppPlankSec ?? 0) || 0,
      },
      { id: 'opponent' }
    );
    const seed = params.seed ? Number(params.seed) || undefined : undefined;
    return { userInput, opponentInput, seed };
  }, [params.userName, params.opponentName, params.userPushups, params.userPlankSec, params.oppPushups, params.oppPlankSec, params.seed]);
};


const HPBar = ({ label, hp, max, color, progressAnim }: { label: string; hp: number; max: number; color: string; progressAnim?: Animated.Value }) => {
  const pct = Math.max(0, Math.min(1, hp / max));
  const widthPct = `${(pct * 100).toFixed(0)}%` as `${number}%`;
  const widthStyle = progressAnim
    ? { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }
    : { width: widthPct };
  return (
    <View style={styles.hpRow}>
      <Text style={styles.hpLabel}>{label}</Text>
      <View style={styles.hpBarShell}>
        <Animated.View style={[styles.hpBarFill, widthStyle, { backgroundColor: color }]} />
      </View>
      <Text style={styles.hpValue}>{hp}/{max}</Text>
    </View>
  );
};

const ScriptLog = ({ script, cursor }: { script: BattleEvent[]; cursor: number }) => {
  const recent = script.slice(Math.max(0, cursor - 5), cursor + 1);
  return (
    <View style={styles.logBox}>
      <Text style={styles.sectionLabel}>Turn Log</Text>
      {recent.length === 0 ? (
        <Text style={styles.logLine}>Ready…</Text>
      ) : (
        recent.map((evt, idx) => {
          const rowIndex = script.length - recent.length + idx;
          const icon = evt.action === 'crit' ? '⚡' : evt.action === 'miss' ? '🛡️' : '➡️';
          const actor = evt.actor === 'user' ? 'You' : 'Rival';
          const target = evt.actor === 'user' ? 'opponent' : 'you';
          const hp = evt.hpAfter;
          return (
            <Text key={rowIndex} style={styles.logLine}>
              {icon} {actor} {evt.action} ({evt.damage}) → HP you {hp.user} / rival {hp.opponent}
            </Text>
          );
        })
      )}
    </View>
  );
};

const BattleReplay = () => {
  const params = useLocalSearchParams<BattleParams>();
  const router = useRouter();
  const { userInput, opponentInput, seed } = useParticipants(params);
  const [battle, setBattle] = useState<BattleResult>(() => generateBattleScript(userInput, opponentInput, { seed }));
  const [friends, setFriends] = useState(fallbackFriends);
  const [cursor, setCursor] = useState(-1);
  const [hpUser, setHpUser] = useState(battle.entities.user.maxHp);
  const [hpOpp, setHpOpp] = useState(battle.entities.opponent.maxHp);
  const [status, setStatus] = useState('Ready');
  const [actionDetail, setActionDetail] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shake = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const hpUserAnim = useRef(new Animated.Value(1)).current;
  const hpOppAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const next = generateBattleScript(userInput, opponentInput, { seed });
    setBattle(next);
    setCursor(-1);
    setHpUser(next.entities.user.maxHp);
    setHpOpp(next.entities.opponent.maxHp);
    setStatus('Ready');
  }, [userInput, opponentInput, seed]);

  const stopPlayback = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    let mounted = true;
    fetchFriendsForBattle().then((res) => {
      if (mounted && Array.isArray(res) && res.length) {
        setFriends(res);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const challengeFriend = (friendId: string) => {
    const friend = friends.find((f) => f.id === friendId);
    if (!friend) return;
    stopPlayback();
    const newOpp = buildParticipantFromWorkout(friend.name, { pushups: friend.pushups, plankSec: friend.plankSec }, { id: 'opponent' });
    const nextBattle = generateBattleScript(userInput, newOpp, { seed: Math.floor(Math.random() * 1000000) });
    setBattle(nextBattle);
    setStatus(`Challenging ${friend.name}...`);
    setActionDetail('');
  };

  const playTurn = (i: number, script: BattleEvent[], winner: BattleResult['winner'], opponentName: string) => {
    if (i >= script.length) {
      const winText = winner === 'tie' ? 'Tie' : winner === 'user' ? 'You win!' : `${opponentName} wins!`;
      setStatus(winText);
      setActionDetail('');
      timerRef.current = null;
      return;
    }
    const evt = script[i];
    setCursor(i);
    setStatus(evt.action === 'crit' ? 'Critical hit!' : evt.action === 'miss' ? 'Dodged!' : 'Attack!');
    setActionDetail(`${evt.actor === 'user' ? 'You' : opponentName} dealt ${evt.damage} dmg`);
    const isCrit = evt.action === 'crit';
    const isHit = evt.action !== 'miss';
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: isCrit ? 280 : 180, easing: Easing.bounce, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true })
    ]).start();
    if (isHit) {
      flash.setValue(0.8);
      Animated.timing(flash, { toValue: 0, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }
    if (evt.actor === 'user') setHpOpp(evt.hpAfter.opponent);
    else setHpUser(evt.hpAfter.user);

    timerRef.current = setTimeout(() => playTurn(i + 1, script, winner, opponentName), playDelayMs);
  };

  useEffect(() => {
    if (!battle.script.length) return;
    stopPlayback();
    setCursor(-1);
    setHpUser(battle.entities.user.maxHp);
    setHpOpp(battle.entities.opponent.maxHp);
    hpUserAnim.setValue(1);
    hpOppAnim.setValue(1);
    setStatus('Ready');
    setActionDetail('');
    timerRef.current = setTimeout(() => playTurn(0, battle.script, battle.winner, battle.entities.opponent.name), 400);
    return stopPlayback;
  }, [battle]);

  const replay = () => {
    stopPlayback();
    const newSeed = Math.floor(Math.random() * 1000000);
    setBattle(generateBattleScript(userInput, opponentInput, { seed: newSeed }));
  };

  const user = battle.entities.user;
  const rival = battle.entities.opponent;

  useEffect(() => {
    Animated.timing(hpUserAnim, { toValue: Math.max(0, Math.min(1, hpUser / user.maxHp)), duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [hpUser, hpUserAnim, user.maxHp]);

  useEffect(() => {
    Animated.timing(hpOppAnim, { toValue: Math.max(0, Math.min(1, hpOpp / rival.maxHp)), duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [hpOpp, hpOppAnim, rival.maxHp]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <BackButton />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.title}>Fake Real-Time Battle</Text>
            <Text style={styles.subtitle}>Precomputed script → played like a movie.</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Battle a Friend</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendRow}>
            {friends.map((f) => (
              <Pressable key={f.id} style={styles.friendChip} onPress={() => challengeFriend(f.id)}>
                <Text style={styles.friendName}>{f.name}</Text>
                <Text style={styles.friendMeta}>{f.tag} · PU {f.pushups} · Plank {f.plankSec}s</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Battle Arena</Text>
          <Animated.View
            style={[
              styles.arena,
              {
                transform: [
                  {
                    translateX: shake.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.avatarSide}>
              <View style={styles.avatarFrame}>
                <InteractiveAvatarComponent
                  gender="male"
                  sizeMultiplier={1.05}
                  alignFootToBottom={true}
                  bottomPadding={0.04}
                  enableVoice={false}
                  enableTTS={false}
                  model={null}
                  photoUri={null}
                />
              </View>
              <Text style={styles.sideLabel}>{user.name}</Text>
            </View>
            <View style={styles.vsBadge}>
              <Text style={styles.vsText}>VS</Text>
            </View>
            <View style={styles.avatarSide}>
              <View style={styles.avatarFrame}>
                <InteractiveAvatarComponent
                  gender="female"
                  sizeMultiplier={1.05}
                  alignFootToBottom={true}
                  bottomPadding={0.04}
                  enableVoice={false}
                  enableTTS={false}
                  model={null}
                  photoUri={null}
                />
              </View>
              <Text style={styles.sideLabel}>{rival.name}</Text>
            </View>
            <Animated.View style={[styles.hitFlash, { opacity: flash, pointerEvents: 'none' }]} />
          </Animated.View>
          <HPBar label={user.name} hp={hpUser} max={user.maxHp} color="#6A00FF" progressAnim={hpUserAnim} />
          <HPBar label={rival.name} hp={hpOpp} max={rival.maxHp} color="#00E7FF" progressAnim={hpOppAnim} />
        </View>

        <View style={styles.card}>
          <Text style={styles.banner}>{status}</Text>
          {actionDetail ? <Text style={styles.bannerSub}>{actionDetail}</Text> : null}
          <ScriptLog script={battle.script} cursor={cursor} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Stats</Text>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>You</Text>
            <Text style={styles.statValue}>ATK {user.atk} · SPD {user.speed} · CRIT {(user.critChance * 100).toFixed(0)}%</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Rival</Text>
            <Text style={styles.statValue}>ATK {rival.atk} · SPD {rival.speed} · CRIT {(rival.critChance * 100).toFixed(0)}%</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.button} onPress={replay}>
            <Text style={styles.buttonText}>Replay</Text>
          </Pressable>
          <Pressable style={styles.buttonSecondary} onPress={() => router.replace('/(tabs)/Home')}>
            <Text style={styles.buttonSecondaryText}>Back Home</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default BattleReplay;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0c0f1a',
  },
  container: {
    padding: 16,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    color: '#9fb4ff',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#13182a',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.2)',
  },
  sectionLabel: {
    color: '#9fb4ff',
    marginBottom: 8,
    fontWeight: '600',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 10,
  },
  avatarBubble: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  vsText: {
    color: '#9fb4ff',
    fontWeight: 'bold',
  },
  hpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  hpLabel: {
    width: 80,
    color: '#fff',
    fontWeight: '600',
  },
  hpBarShell: {
    flex: 1,
    height: 12,
    backgroundColor: '#1f2740',
    borderRadius: 8,
    overflow: 'hidden',
  },
  hpBarFill: {
    height: '100%',
    borderRadius: 8,
  },
  hpValue: {
    color: '#9fb4ff',
    width: 70,
    textAlign: 'right',
  },
  banner: {
    textAlign: 'center',
    color: '#00e7ff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  bannerSub: {
    textAlign: 'center',
    color: '#b6c9ff',
    marginBottom: 6,
  },
  arena: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f1324',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.15)',
    marginBottom: 10,
    overflow: 'hidden',
  },
  avatarSide: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  avatarFrame: {
    width: 140,
    height: 170,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#0a1020',
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.2)',
  },
  sideLabel: {
    color: '#d4ddff',
    fontWeight: '700',
  },
  vsBadge: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(106,0,255,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.4)',
  },
  hitFlash: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  logBox: {
    backgroundColor: '#0f1324',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.12)',
    gap: 6,
  },
  logLine: {
    color: '#d4ddff',
    fontSize: 13,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statLabel: {
    color: '#fff',
    fontWeight: '600',
  },
  statValue: {
    color: '#9fb4ff',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    backgroundColor: '#6A00FF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  buttonSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#6A00FF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonSecondaryText: {
    color: '#6A00FF',
    fontWeight: '700',
  },
  friendRow: {
    flexDirection: 'row',
    gap: 10,
  },
  friendChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#0f1324',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.2)',
  },
  friendName: {
    color: '#e8f1ff',
    fontWeight: '700',
  },
  friendMeta: {
    color: '#8fa3c5',
    fontSize: 12,
    marginTop: 2,
  },
});
