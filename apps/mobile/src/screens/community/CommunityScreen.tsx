import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../../types/navigation';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import {
  AppText,
  Avatar,
  Card,
  EmptyState,
  IconButton,
  Input,
  ProgressBar,
} from '../../components/common';
import { useTabBarScrollPadding } from '../../hooks/useTabBarScrollPadding';

type Props = NativeStackScreenProps<HomeStackParamList, 'Community'>;

/**
 * Datos locales de demostración: todavía no hay tablas de comunidad en la DB.
 * Cuando exista el backend de equipos, reemplazar por un store/servicio real.
 */
const MY_TEAM = {
  name: 'Lima Squad',
  subtitle: 'Desafío 30 días · Semana 3',
  progress: 0.68,
  members: ['Franco Crossetto', 'Maru Gómez', 'Leo Paredes', 'Sofi Ríos'],
  extraMembers: 9,
} as const;

interface RankingTeam {
  id: string;
  flag: string;
  name: string;
  points: number;
  trend: 'up' | 'down';
}

const WEEKLY_RANKING: RankingTeam[] = [
  { id: '1', flag: '🇦🇷', name: 'Lima Squad', points: 12480, trend: 'up' },
  { id: '2', flag: '🇧🇷', name: 'Sampa Runners', points: 11930, trend: 'up' },
  { id: '3', flag: '🇺🇾', name: 'Montevideo Beasts', points: 11210, trend: 'down' },
  { id: '4', flag: '🇨🇱', name: 'Andes Power', points: 10540, trend: 'up' },
  { id: '5', flag: '🇲🇽', name: 'CDMX Titans', points: 9870, trend: 'down' },
  { id: '6', flag: '🇨🇴', name: 'Bogotá Fit Club', points: 9320, trend: 'up' },
  { id: '7', flag: '🇪🇸', name: 'Madrid Hustle', points: 8760, trend: 'down' },
  { id: '8', flag: '🇵🇪', name: 'Inca Warriors', points: 8140, trend: 'up' },
  { id: '9', flag: '🇦🇷', name: 'Córdoba Crew', points: 7690, trend: 'up' },
  { id: '10', flag: '🇺🇸', name: 'Miami Grind', points: 7050, trend: 'down' },
];

export function CommunityScreen({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const insets = useSafeAreaInsets();
  const scrollBottom = useTabBarScrollPadding();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return WEEKLY_RANKING;
    return WEEKLY_RANKING.filter((t) => t.name.toLowerCase().includes(q));
  }, [query]);

  const renderTeam = ({ item }: { item: RankingTeam }) => {
    const position = WEEKLY_RANKING.indexOf(item) + 1;
    const topThree = position <= 3;
    return (
      <View style={[styles.teamCard, topThree && styles.teamCardTop]}>
        <AppText variant="metricSmall" color={topThree ? colors.primary.default : colors.text.tertiary} style={styles.position}>
          {position}
        </AppText>
        <AppText variant="h2" style={styles.flag}>
          {item.flag}
        </AppText>
        <View style={styles.teamInfo}>
          <AppText variant="body16SemiBold" color={colors.text.primary} numberOfLines={1}>
            {item.name}
          </AppText>
          <AppText variant="body13" color={colors.text.secondary}>
            {item.points.toLocaleString('es-AR')} pts
          </AppText>
        </View>
        <Ionicons
          name={item.trend === 'up' ? 'caret-up' : 'caret-down'}
          size={18}
          color={item.trend === 'up' ? colors.states.success : colors.text.tertiary}
          accessibilityLabel={item.trend === 'up' ? 'Subiendo' : 'Bajando'}
        />
      </View>
    );
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel="Volver" />
        <AppText variant="h3" color={colors.text.primary} style={styles.headerTitle}>
          Comunidad
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(t) => t.id}
        renderItem={renderTeam}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.listContent, { paddingBottom: scrollBottom }]}
        ListHeaderComponent={
          <View>
            {/* Mi equipo */}
            <Card elevated style={styles.myTeamCard}>
              <AppText variant="caps12" color={colors.primary.default}>
                Mi equipo
              </AppText>
              <AppText variant="h2" color={colors.text.primary} style={styles.myTeamName}>
                {MY_TEAM.name}
              </AppText>
              <AppText variant="body13" color={colors.text.secondary}>
                {MY_TEAM.subtitle}
              </AppText>
              <ProgressBar progress={MY_TEAM.progress} style={styles.myTeamBar} />
              <View style={styles.myTeamFooter}>
                <View style={styles.avatarsRow}>
                  {MY_TEAM.members.map((member, i) => (
                    <View key={member} style={[styles.avatarWrap, i > 0 && styles.avatarOverlap]}>
                      <Avatar name={member} size={36} />
                    </View>
                  ))}
                  <View style={[styles.avatarWrap, styles.avatarOverlap, styles.moreMembers]}>
                    <AppText variant="body12SemiBold" color={colors.text.secondary}>
                      +{MY_TEAM.extraMembers}
                    </AppText>
                  </View>
                </View>
                <AppText variant="body13SemiBold" color={colors.primary.default}>
                  {Math.round(MY_TEAM.progress * 100)}%
                </AppText>
              </View>
            </Card>

            {/* Buscador */}
            <Input
              icon="search"
              placeholder="Buscar equipos"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              containerStyle={styles.search}
            />

            <AppText variant="caps13" color={colors.text.tertiary} style={styles.rankingTitle}>
              Ranking semanal
            </AppText>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            pillar="generic"
            title="No encontramos equipos"
            message="Probá con otro nombre o limpiá la búsqueda."
            compact
          />
        }
      />
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  headerTitle: { flex: 1, textAlign: 'center' },
  headerSpacer: { width: layout.minHitTarget },
  listContent: {
    paddingHorizontal: layout.screenPadding,
  },
  myTeamCard: { marginBottom: spacing.md },
  myTeamName: { marginTop: spacing.xxs },
  myTeamBar: { marginTop: spacing.md },
  myTeamFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  avatarsRow: { flexDirection: 'row', alignItems: 'center' },
  avatarWrap: {
    borderWidth: 2,
    borderColor: colors.surface.elevated,
    borderRadius: radius.pill,
  },
  avatarOverlap: { marginLeft: -spacing.sm },
  moreMembers: {
    width: 36,
    height: 36,
    backgroundColor: colors.surface.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: { marginBottom: spacing.xs },
  rankingTitle: { marginTop: spacing.md, marginBottom: spacing.sm },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  teamCardTop: {
    borderColor: colors.primary.muted,
    backgroundColor: colors.surface.elevated,
  },
  position: { width: 28, textAlign: 'center' },
  flag: { width: 32, textAlign: 'center' },
  teamInfo: { flex: 1 },
});
