import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { generateSchedule, computeStats } from '@/lib/scheduleEngine';
import { ScheduleData } from '@/lib/types';

// Shared state so Analytics tab can access the schedule
let sharedScheduleData: ScheduleData | null = null;
let scheduleListeners: (() => void)[] = [];

export function getScheduleData(): ScheduleData | null {
  return sharedScheduleData;
}

export function onScheduleChange(listener: () => void) {
  scheduleListeners.push(listener);
  return () => {
    scheduleListeners = scheduleListeners.filter((l) => l !== listener);
  };
}

export default function ScheduleScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [numPlayers, setNumPlayers] = useState('17');
  const [numWeeks, setNumWeeks] = useState('16');
  const [playerNames, setPlayerNames] = useState<string[]>(
    Array.from({ length: 17 }, () => '')
  );
  const [byeAssignments, setByeAssignments] = useState<Record<number, string>>({});
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSetup, setShowSetup] = useState(true);

  const playerCount = parseInt(numPlayers) || 0;
  const weekCount = parseInt(numWeeks) || 0;

  const handlePlayerCountChange = useCallback((text: string) => {
    setNumPlayers(text);
    const count = parseInt(text) || 0;
    setPlayerNames((prev) => {
      const next = Array.from({ length: count }, (_, i) => prev[i] || '');
      return next;
    });
    setByeAssignments({});
  }, []);

  const handlePlayerNameChange = useCallback((index: number, name: string) => {
    setPlayerNames((prev) => {
      const next = [...prev];
      next[index] = name;
      return next;
    });
  }, []);

  const handleByeChange = useCallback((playerIndex: number, weekStr: string) => {
    setByeAssignments((prev) => {
      const next = { ...prev };
      if (weekStr === '') {
        delete next[playerIndex];
      } else {
        next[playerIndex] = weekStr;
      }
      return next;
    });
  }, []);

  const getDisplayName = (index: number) =>
    playerNames[index]?.trim() || `Player ${index + 1}`;

  const handleGenerate = useCallback(() => {
    if (playerCount < 4) return;
    setIsGenerating(true);

    setTimeout(() => {
      try {
        const players = Array.from({ length: playerCount }, (_, i) =>
          playerNames[i]?.trim() || `Player ${i + 1}`
        );

        const assignedByes: Record<number, number[]> = {};
        Object.entries(byeAssignments).forEach(([playerIdx, weekStr]) => {
          const week = parseInt(weekStr);
          if (week && week >= 1 && week <= weekCount) {
            const wIdx = week - 1;
            if (!assignedByes[wIdx]) assignedByes[wIdx] = [];
            assignedByes[wIdx].push(parseInt(playerIdx));
          }
        });

        const data = generateSchedule(players, weekCount, assignedByes);
        setScheduleData(data);
        sharedScheduleData = data;
        scheduleListeners.forEach((l) => l());
        setShowSetup(false);
      } catch (e: any) {
        if (Platform.OS === 'web') {
          alert(e.message);
        }
      } finally {
        setIsGenerating(false);
      }
    }, 50);
  }, [playerCount, weekCount, playerNames, byeAssignments]);

  const stats = scheduleData ? computeStats(scheduleData) : null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Header Banner */}
      <View style={[styles.banner, { backgroundColor: Colors.golfGreen }]}>
        <FontAwesome name="trophy" size={32} color="#FFD700" />
        <Text style={styles.bannerTitle}>Tuesday Golf League</Text>
        <Text style={styles.bannerSub}>Schedule Generator</Text>
      </View>

      {showSetup ? (
        <View style={styles.setupSection}>
          {/* Player count & weeks */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>League Setup</Text>
            <View style={styles.row}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.muted }]}>Players</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={numPlayers}
                  onChangeText={handlePlayerCountChange}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.muted }]}>Weeks</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={numWeeks}
                  onChangeText={setNumWeeks}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>
            </View>
          </View>

          {/* Player Names */}
          {playerCount > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Player Names</Text>
              {Array.from({ length: playerCount }, (_, i) => (
                <TextInput
                  key={i}
                  style={[styles.nameInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  placeholder={`Player ${i + 1}`}
                  placeholderTextColor={colors.muted}
                  value={playerNames[i] || ''}
                  onChangeText={(text) => handlePlayerNameChange(i, text)}
                />
              ))}
            </View>
          )}

          {/* Bye Week Assignments */}
          {playerCount > 0 && weekCount > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Bye Week Assignments</Text>
              <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
                Pre-assign bye weeks for players who know they'll be gone
              </Text>
              {Array.from({ length: playerCount }, (_, i) => (
                <View key={i} style={styles.byeRow}>
                  <Text style={[styles.byeName, { color: colors.text }]} numberOfLines={1}>
                    {getDisplayName(i)}
                  </Text>
                  <TextInput
                    style={[styles.byeInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                    placeholder="Week #"
                    placeholderTextColor={colors.muted}
                    value={byeAssignments[i] || ''}
                    onChangeText={(text) => handleByeChange(i, text)}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                </View>
              ))}
            </View>
          )}

          {/* Generate Button */}
          <TouchableOpacity
            style={[styles.generateBtn, { opacity: playerCount < 4 ? 0.5 : 1 }]}
            onPress={handleGenerate}
            disabled={playerCount < 4 || isGenerating}
          >
            {isGenerating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <FontAwesome name="magic" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.generateBtnText}>Generate Schedule</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.resultsSection}>
          {/* Stats Summary */}
          {stats && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Schedule Summary</Text>
              <View style={styles.statsGrid}>
                <View style={[styles.statChip, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.statValue, { color: Colors.golfGreen }]}>
                    {stats.pairsExactlyOnce}/{stats.totalPairs}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>Unique 1v1</Text>
                </View>
                <View style={[styles.statChip, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.statValue, { color: Colors.golfGreen }]}>
                    {stats.matchupMin}-{stats.matchupMax}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>1v1 Range</Text>
                </View>
                <View style={[styles.statChip, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.statValue, { color: Colors.golfGreen }]}>
                    {stats.foursomeMin}-{stats.foursomeMax}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>Foursome Range</Text>
                </View>
                <View style={[styles.statChip, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.statValue, { color: Colors.golfGreen }]}>
                    {stats.byeMin}-{stats.byeMax}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>Byes/Player</Text>
                </View>
              </View>
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: Colors.golfGreen }]}
              onPress={handleGenerate}
              disabled={isGenerating}
            >
              <FontAwesome name="refresh" size={14} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.actionBtnText}>Regenerate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.accent }]}
              onPress={() => setShowSetup(true)}
            >
              <FontAwesome name="pencil" size={14} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.actionBtnText}>Edit Setup</Text>
            </TouchableOpacity>
          </View>

          {/* Weekly Schedule Cards */}
          {scheduleData?.weeks.map((week, weekIndex) => (
            <View
              key={weekIndex}
              style={[styles.weekCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.weekHeader}>
                <Text style={[styles.weekTitle, { color: colors.text }]}>
                  Week {weekIndex + 1}
                </Text>
                {week.byePlayers.length > 0 && (
                  <View style={[styles.byeTag, { backgroundColor: '#FFF3E0' }]}>
                    <Text style={{ color: '#E65100', fontSize: 12, fontWeight: '600' }}>
                      Bye: {week.byePlayers.map((i) => scheduleData.players[i]).join(', ')}
                    </Text>
                  </View>
                )}
              </View>

              {week.foursomes.map((foursome, fIdx) => (
                <View
                  key={fIdx}
                  style={[styles.foursomeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Text style={[styles.foursomeTitle, { color: colors.accent }]}>
                    Foursome {fIdx + 1}
                  </Text>
                  {foursome.matchups.map(([a, b], mIdx) => (
                    <View key={mIdx} style={styles.matchupRow}>
                      <Text style={[styles.matchLabel, { color: colors.muted }]}>
                        Match {mIdx + 1}
                      </Text>
                      <View style={styles.matchPlayers}>
                        <Text style={[styles.playerName, { color: colors.text }]}>
                          {scheduleData.players[a]}
                        </Text>
                        <View style={[styles.vsBadge, { backgroundColor: Colors.golfGreen }]}>
                          <Text style={styles.vsText}>VS</Text>
                        </View>
                        <Text style={[styles.playerName, { color: colors.text }]}>
                          {scheduleData.players[b]}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  banner: {
    padding: 24,
    alignItems: 'center',
    gap: 4,
  },
  bannerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginTop: 8,
  },
  bannerSub: {
    fontSize: 14,
    color: '#C8E6C9',
    fontWeight: '500',
  },
  setupSection: {
    padding: 16,
    gap: 16,
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  inputGroup: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  nameInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    marginBottom: 8,
  },
  byeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  byeName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  byeInput: {
    width: 80,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  generateBtn: {
    backgroundColor: '#1B5E20',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  resultsSection: {
    padding: 16,
    gap: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statChip: {
    borderRadius: 8,
    padding: 12,
    flex: 1,
    minWidth: '45%' as any,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  weekCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  weekTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  byeTag: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  foursomeCard: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  foursomeTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  matchupRow: {
    marginBottom: 6,
  },
  matchLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  matchPlayers: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  vsBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  vsText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
});
