import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { computeAnalytics, pairKey } from '@/lib/scheduleEngine';
import { ScheduleData, AnalyticsData } from '@/lib/types';
import { getScheduleData, onScheduleChange } from './index';

export default function AnalyticsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(getScheduleData());
  const [selectedPlayer, setSelectedPlayer] = useState(0);
  const [showPlayerPicker, setShowPlayerPicker] = useState(false);

  useEffect(() => {
    const unsub = onScheduleChange(() => {
      setScheduleData(getScheduleData());
      setSelectedPlayer(0);
    });
    return unsub;
  }, []);

  if (!scheduleData) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <FontAwesome name="bar-chart" size={64} color={colors.muted} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No Schedule Yet</Text>
        <Text style={[styles.emptyText, { color: colors.muted }]}>
          Generate a schedule on the Schedule tab to view analytics
        </Text>
      </View>
    );
  }

  const analytics = computeAnalytics(scheduleData);
  const { players } = scheduleData;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Player Selector */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Player View</Text>
        <TouchableOpacity
          style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setShowPlayerPicker(!showPlayerPicker)}
        >
          <Text style={[styles.pickerText, { color: colors.text }]}>
            {players[selectedPlayer]}
          </Text>
          <FontAwesome name={showPlayerPicker ? 'chevron-up' : 'chevron-down'} size={14} color={colors.muted} />
        </TouchableOpacity>
        {showPlayerPicker && (
          <View style={[styles.pickerDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
              {players.map((name, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.pickerOption,
                    i === selectedPlayer && { backgroundColor: colors.surface },
                  ]}
                  onPress={() => {
                    setSelectedPlayer(i);
                    setShowPlayerPicker(false);
                  }}
                >
                  <Text style={[styles.pickerOptionText, { color: colors.text }]}>{name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Weekly Table */}
      <PlayerWeeklyTable
        playerIdx={selectedPlayer}
        analytics={analytics}
        players={players}
        colors={colors}
      />

      {/* 1v1 Matchup Frequency */}
      <FrequencyBars
        title="1v1 Matchup Frequency"
        playerIdx={selectedPlayer}
        players={players}
        pairCount={analytics.matchupPairCount}
        colors={colors}
        barColor={Colors.golfGreen}
      />

      {/* Foursome Frequency */}
      <FrequencyBars
        title="Foursome Frequency"
        playerIdx={selectedPlayer}
        players={players}
        pairCount={analytics.foursomePairCount}
        colors={colors}
        barColor={Colors.golfGreenLight}
      />

      {/* Full Foursome Matrix */}
      <FoursomeMatrix
        players={players}
        pairCount={analytics.foursomePairCount}
        colors={colors}
      />
    </ScrollView>
  );
}

function PlayerWeeklyTable({
  playerIdx,
  analytics,
  players,
  colors,
}: {
  playerIdx: number;
  analytics: AnalyticsData;
  players: string[];
  colors: any;
}) {
  const entries = [...analytics.playerWeekly[playerIdx]].sort((a, b) => a.week - b.week);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.text }]}>Weekly Breakdown</Text>
      <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.tableHeaderCell, styles.weekCol, { color: colors.muted }]}>Week</Text>
        <Text style={[styles.tableHeaderCell, styles.oppCol, { color: colors.muted }]}>Opponent</Text>
        <Text style={[styles.tableHeaderCell, styles.partnerCol, { color: colors.muted }]}>Partners</Text>
      </View>
      {entries.map((entry, idx) => (
        <View
          key={idx}
          style={[
            styles.tableRow,
            { borderBottomColor: colors.border },
            idx % 2 === 0 && { backgroundColor: colors.surface },
          ]}
        >
          <Text style={[styles.tableCell, styles.weekCol, { color: colors.text }]}>
            Wk {entry.week}
          </Text>
          <View style={[styles.oppCol]}>
            {entry.bye ? (
              <View style={[styles.byeBadge, { backgroundColor: '#FFF3E0' }]}>
                <Text style={{ color: '#E65100', fontSize: 12, fontWeight: '700' }}>BYE</Text>
              </View>
            ) : (
              <Text style={[styles.tableCell, { color: colors.text }]}>
                {players[entry.opponent!]}
              </Text>
            )}
          </View>
          <Text style={[styles.tableCell, styles.partnerCol, { color: colors.muted }]}>
            {entry.bye ? '—' : entry.partners.map((p) => players[p]).join(', ')}
          </Text>
        </View>
      ))}
    </View>
  );
}

function FrequencyBars({
  title,
  playerIdx,
  players,
  pairCount,
  colors,
  barColor,
}: {
  title: string;
  playerIdx: number;
  players: string[];
  pairCount: Record<string, number>;
  colors: any;
  barColor: string;
}) {
  const entries: { player: number; count: number }[] = [];
  for (let i = 0; i < players.length; i++) {
    if (i === playerIdx) continue;
    entries.push({ player: i, count: pairCount[pairKey(playerIdx, i)] || 0 });
  }
  entries.sort((a, b) => b.count - a.count);
  const max = Math.max(...entries.map((e) => e.count), 1);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
      {entries.map((entry) => {
        const pct = (entry.count / max) * 100;
        return (
          <View key={entry.player} style={styles.freqRow}>
            <Text style={[styles.freqName, { color: colors.text }]} numberOfLines={1}>
              {players[entry.player]}
            </Text>
            <View style={[styles.freqTrack, { backgroundColor: colors.surface }]}>
              <View
                style={[styles.freqFill, { width: `${pct}%`, backgroundColor: barColor }]}
              />
            </View>
            <Text style={[styles.freqVal, { color: colors.text }]}>{entry.count}</Text>
          </View>
        );
      })}
    </View>
  );
}

function FoursomeMatrix({
  players,
  pairCount,
  colors,
}: {
  players: string[];
  pairCount: Record<string, number>;
  colors: any;
}) {
  const n = players.length;

  const getShortName = (name: string) => {
    if (name.length <= 6) return name;
    return name.slice(0, 5) + '.';
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.text }]}>Foursome Matrix</Text>
      <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
        Red = outside ideal range (2-4), Green = ideal
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          {/* Header row */}
          <View style={styles.matrixRow}>
            <View style={[styles.matrixCorner, { borderColor: colors.border }]} />
            {players.map((name, j) => (
              <View key={j} style={[styles.matrixColHeader, { borderColor: colors.border }]}>
                <Text style={[styles.matrixHeaderText, { color: colors.muted }]}>
                  {getShortName(name)}
                </Text>
              </View>
            ))}
          </View>

          {/* Data rows */}
          {players.map((name, i) => (
            <View key={i} style={styles.matrixRow}>
              <View style={[styles.matrixRowHeader, { borderColor: colors.border }]}>
                <Text style={[styles.matrixRowHeaderText, { color: colors.text }]} numberOfLines={1}>
                  {getShortName(name)}
                </Text>
              </View>
              {players.map((_, j) => {
                if (i === j) {
                  return (
                    <View
                      key={j}
                      style={[styles.matrixCell, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    >
                      <Text style={[styles.matrixCellText, { color: colors.muted }]}>—</Text>
                    </View>
                  );
                }
                const count = pairCount[pairKey(i, j)] || 0;
                let bgColor: string;
                let textColor: string;

                if (count < 2 || count > 4) {
                  // Red for out of range
                  const severity = count < 2 ? 2 - count : count - 4;
                  const lightness = Math.max(50, 85 - severity * 15);
                  bgColor = `hsl(0, 65%, ${lightness}%)`;
                  textColor = lightness < 65 ? '#fff' : '#7f1d1d';
                } else {
                  // Green for ideal range
                  const t = (count - 2) / 2;
                  bgColor = `hsl(140, ${35 + t * 25}%, ${88 - t * 20}%)`;
                  textColor = Colors.golfGreen;
                }

                return (
                  <View
                    key={j}
                    style={[styles.matrixCell, { backgroundColor: bgColor, borderColor: colors.border }]}
                  >
                    <Text style={[styles.matrixCellText, { color: textColor }]}>{count}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  cardSubtitle: {
    fontSize: 13,
    marginBottom: 12,
    marginTop: -4,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  pickerText: {
    fontSize: 16,
    fontWeight: '600',
  },
  pickerDropdown: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 8,
    overflow: 'hidden',
  },
  pickerOption: {
    padding: 12,
  },
  pickerOptionText: {
    fontSize: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    paddingBottom: 8,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tableCell: {
    fontSize: 14,
  },
  weekCol: {
    width: 50,
  },
  oppCol: {
    width: 100,
  },
  partnerCol: {
    flex: 1,
  },
  byeBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  freqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  freqName: {
    width: 80,
    fontSize: 13,
    fontWeight: '500',
  },
  freqTrack: {
    flex: 1,
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  freqFill: {
    height: '100%',
    borderRadius: 8,
  },
  freqVal: {
    width: 24,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  matrixRow: {
    flexDirection: 'row',
  },
  matrixCorner: {
    width: 70,
    height: 36,
    borderWidth: 0.5,
  },
  matrixColHeader: {
    width: 44,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
  },
  matrixHeaderText: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  matrixRowHeader: {
    width: 70,
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 0.5,
  },
  matrixRowHeaderText: {
    fontSize: 10,
    fontWeight: '600',
  },
  matrixCell: {
    width: 44,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
  },
  matrixCellText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
