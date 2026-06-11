import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import BackButton from '../components/BackButton';

export default function TrophiesScreen() {
  const unlockedTrophies = useSelector((s: any) => s.user?.unlockedTrophies || []);
  const skillBadges = useSelector((s: any) => s.user?.skillBadges || []);
  const unlockedTitles = useSelector((s: any) => s.user?.unlockedTitles || []);
  const selectedTitle = useSelector((s: any) => s.user?.selectedTitle);

  const sortedTrophies = useMemo(
    () => [...(Array.isArray(unlockedTrophies) ? unlockedTrophies : [])].sort(
      (a, b) => (b.unlockedAt || 0) - (a.unlockedAt || 0)
    ),
    [unlockedTrophies]
  );

  const sortedSkillBadges = useMemo(
    () => [...(Array.isArray(skillBadges) ? skillBadges : [])].sort(
      (a, b) => (b.unlockedAt || 0) - (a.unlockedAt || 0)
    ),
    [skillBadges]
  );

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'Recently';
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <LinearGradient
        colors={['#0B1120', '#1B2339', '#3A3D53']}
        start={{ x: 0, y: 0.1 }}
        end={{ x: 1, y: 0.9 }}
        style={[styles.pageChrome, { maxWidth: '100%' }]}
      >
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.title}>🏆 Trophies & Titles</Text>
        </View>

        {/* Titles Section */}
        {Array.isArray(unlockedTitles) && unlockedTitles.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⭐ Titles ({unlockedTitles.length})</Text>
            <View style={styles.titlesGrid}>
              {unlockedTitles.map((titleItem) => (
                <LinearGradient
                  key={titleItem.id}
                  colors={selectedTitle === titleItem.id
                    ? ['#12D9FF', '#7F00FF']
                    : ['rgba(18,217,255,0.08)', 'rgba(127,0,255,0.04)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.titleCard, selectedTitle === titleItem.id && styles.titleCardSelected]}
                >
                  <View style={styles.titleCardInner}>
                    <Text style={[styles.titleCardText, selectedTitle === titleItem.id && styles.titleCardTextActive]}>
                      {titleItem.title}
                    </Text>
                    {selectedTitle === titleItem.id && (
                      <Text style={styles.titleBadgeLabel}>Currently displayed</Text>
                    )}
                  </View>
                </LinearGradient>
              ))}
            </View>
          </View>
        )}

        {/* Trophies Section */}
        {sortedTrophies.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏆 Trophies ({sortedTrophies.length})</Text>
            <View style={styles.trophyList}>
              {sortedTrophies.map((trophy) => (
                <LinearGradient
                  key={trophy.id}
                  colors={['rgba(18,217,255,0.12)', 'rgba(127,0,255,0.08)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.trophyCard}
                >
                  <View style={styles.trophyIcon}>
                    <Text style={styles.trophyEmoji}>🏆</Text>
                  </View>
                  <View style={styles.trophyContent}>
                    <Text style={styles.trophyTitle}>{trophy.title}</Text>
                    <Text style={styles.trophyDescription}>{trophy.description}</Text>
                    <Text style={styles.trophyDate}>{formatDate(trophy.unlockedAt)}</Text>
                  </View>
                </LinearGradient>
              ))}
            </View>
          </View>
        )}

        {/* Skill Badges Section */}
        {sortedSkillBadges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎖️ Skill Badges ({sortedSkillBadges.length})</Text>
            <View style={styles.skillGrid}>
              {sortedSkillBadges.map((badge) => (
                <LinearGradient
                  key={badge.id}
                  colors={['rgba(196, 163, 255, 0.15)', 'rgba(18, 217, 255, 0.08)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.skillCard}
                >
                  <Text style={styles.skillBadgeEmoji}>🎖️</Text>
                  <Text style={styles.skillCategory}>{badge.category}</Text>
                  <Text style={styles.skillLevel}>Level {badge.level}</Text>
                  <Text style={styles.skillDate}>{formatDate(badge.unlockedAt)}</Text>
                </LinearGradient>
              ))}
            </View>
          </View>
        )}

        {/* Empty State */}
        {sortedTrophies.length === 0 && unlockedTitles.length === 0 && sortedSkillBadges.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={styles.emptyTitle}>No Trophies Yet</Text>
            <Text style={styles.emptySubtitle}>Level up and achieve milestones to unlock trophies and titles!</Text>
          </View>
        )}
      </LinearGradient>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#070C18',
  },
  container: {
    flexGrow: 1,
    paddingTop: 12,
    paddingBottom: 156,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  pageChrome: {
    width: '100%',
    alignSelf: 'center',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(132,185,255,0.14)',
    overflow: 'hidden',
  },
  header: {
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    color: '#12D9FF',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#12D9FF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  titlesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  titleCard: {
    flex: 1,
    minWidth: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(18,217,255,0.16)',
    padding: 12,
    alignItems: 'center',
  },
  titleCardSelected: {
    borderColor: 'rgba(18,217,255,0.4)',
  },
  titleCardInner: {
    alignItems: 'center',
    gap: 4,
  },
  titleCardText: {
    color: '#CFF7FF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  titleCardTextActive: {
    color: '#F8FBFF',
    fontSize: 15,
  },
  titleBadgeLabel: {
    color: '#12D9FF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  trophyList: {
    gap: 10,
  },
  trophyCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(18,217,255,0.12)',
    padding: 14,
    alignItems: 'flex-start',
    gap: 12,
  },
  trophyIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(18,217,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(18,217,255,0.2)',
  },
  trophyEmoji: {
    fontSize: 24,
  },
  trophyContent: {
    flex: 1,
    gap: 2,
  },
  trophyTitle: {
    color: '#F8FBFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  trophyDescription: {
    color: '#A7B5CD',
    fontSize: 12,
    lineHeight: 16,
  },
  trophyDate: {
    color: '#7287A9',
    fontSize: 11,
    marginTop: 4,
  },
  skillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  skillCard: {
    flex: 1,
    minWidth: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(196,163,255,0.16)',
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
  },
  skillBadgeEmoji: {
    fontSize: 28,
  },
  skillCategory: {
    color: '#C7A3FF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  skillLevel: {
    color: '#12D9FF',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  skillDate: {
    color: '#7287A9',
    fontSize: 10,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    color: '#F8FBFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  emptySubtitle: {
    color: '#A7B5CD',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
});
