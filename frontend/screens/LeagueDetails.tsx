import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../types/navigation";
import { leaguesAPI, fixturesAPI, h2hAPI } from "../utils/api";
import { tokenStorage } from "../utils/storage";
import { useTeams } from "../hooks/useTeams";
import LeagueTable from "../components/LeagueTable";
import LeagueGameweekSelector from "../components/LeagueGameweekSelector";

interface LeagueDetailsParams {
  leagueId: string;
  leagueName: string;
}

interface LeagueData {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  leagueCode: string;
  createdAt: Date;
  createdAtGameweek?: number;
}

interface LeagueMember {
  userId: string;
  userName: string;
  userEmail?: string;
  rank: number | null;
  previousRank: number | null;
  rankChange: number;
  gameweekScore: number;
  totalScore: number;
  isNewMember: boolean;
  joinedGameweek?: number;
  calculatedAt?: Date;
  position?: "above" | "below"; // For current user outside page
}

interface Pagination {
  page: number;
  pageSize: number;
  totalMembers: number;
  totalPages: number;
  startRank: number;
  endRank: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const LeagueDetails: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { leagueId } = route.params as LeagueDetailsParams;

  const [leagueData, setLeagueData] = useState<LeagueData | null>(null);
  const [leagueTable, setLeagueTable] = useState<LeagueMember[]>([]);
  const [currentUserEntry, setCurrentUserEntry] = useState<LeagueMember | null>(
    null,
  );
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedGameweek, setSelectedGameweek] = useState<number>(1);
  const [currentGameweek, setCurrentGameweek] = useState<number>(1);
  const [availableGameweeks, setAvailableGameweeks] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"table" | "history" | "h2h">(
    "table",
  );
  const [h2hTable, setH2HTable] = useState<any[]>([]);
  const [h2hTableLoading, setH2HTableLoading] = useState(false);
  const [isH2HLeague, setIsH2HLeague] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // H2H wager state
  const [h2hFixtures, setH2HFixtures] = useState<any[]>([]);
  const [wagers, setWagers] = useState<{ [fixtureId: string]: any }>({});
  const [wagerSummary, setWagerSummary] = useState<{ totalWagered: number; remainingCap: number } | null>(null);
  const [wagerForm, setWagerForm] = useState<{
    [fixtureId: string]: { outcome: "home" | "draw" | "away" | null; amount: number; open: boolean };
  }>({});
  const [wagerSubmitting, setWagerSubmitting] = useState<{ [fixtureId: string]: boolean }>({});

  const { getTeamById, getTeamLogo, loading: teamsLoading } = useTeams();

  useEffect(() => {
    fetchLeagueDetails();
    fetchCurrentGameweek();
    tokenStorage.getUserAsync().then((user: any) => {
      if (user?.id) setCurrentUserId(user.id);
    });
  }, [leagueId]);

  useEffect(() => {
    if (selectedGameweek) {
      fetchLeagueTable(selectedGameweek);
    }
  }, [selectedGameweek]);

  const fetchLeagueDetails = async () => {
    try {
      const response = await leaguesAPI.getLeagueById(leagueId);
      if (response.success && response.league) {
        setLeagueData(response.league);
        const isH2H = response.league.leagueType === "h2h";
        setIsH2HLeague(isH2H);
        if (isH2H) {
          setActiveTab("h2h");
          fetchH2HTable();
        }
        // Set the navigation header with league info
        navigation.setOptions({
          headerTitle: () => (
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>{response.league.name}</Text>
              {response.league.description && (
                <Text style={styles.headerSubtitle}>
                  {" "}
                  - {response.league.description}
                </Text>
              )}
            </View>
          ),
          headerRight: () => (
            <View style={styles.headerInfo}>
              <View style={styles.headerStatItem}>
                <Ionicons name="people" size={14} color="#fff" />
                <Text style={styles.headerStatText}>
                  {response.league.memberCount}
                </Text>
              </View>
              <View style={styles.headerStatItem}>
                <Ionicons name="key" size={14} color="#fff" />
                <Text style={styles.headerStatText}>
                  {response.league.leagueCode}
                </Text>
              </View>
            </View>
          ),
        });
      }
    } catch (error) {
      console.error("Error fetching league details:", error);
      Alert.alert("Error", "Failed to load league details");
    }
  };

  const fetchCurrentGameweek = async () => {
    try {
      // Use the cached fixturesAPI to get current gameweek
      const response = await fixturesAPI.getCurrentGameweek();
      const current = response.currentGameweek || 1;
      setCurrentGameweek(current);
      setSelectedGameweek(current);

      // Generate available gameweeks (1 to current)
      const gameweeks = Array.from({ length: current }, (_, i) => i + 1);
      setAvailableGameweeks(gameweeks);
    } catch (error) {
      console.error("Error fetching current gameweek:", error);
      // Fallback to default
      setCurrentGameweek(1);
      setSelectedGameweek(1);
      setAvailableGameweeks([1]);
    }
  };

  const fetchLeagueTable = async (gameweek: number, page: number = 1) => {
    setTableLoading(true);
    try {
      const response = await leaguesAPI.getLeagueTable(
        leagueId,
        gameweek,
        page,
        50,
      );
      if (response.success && response.data?.table) {
        setLeagueTable(response.data.table);
        setPagination(response.data.pagination || null);
        setCurrentUserEntry(response.data.currentUserEntry || null);
        setCurrentPage(page);
      } else {
        setLeagueTable([]);
        setPagination(null);
        setCurrentUserEntry(null);
      }
    } catch (error) {
      console.error("Error fetching league table:", error);
      setLeagueTable([]);
      setPagination(null);
      setCurrentUserEntry(null);
      Alert.alert("Error", "Failed to load league table");
    } finally {
      setTableLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchLeagueDetails(),
      isH2HLeague
        ? Promise.all([fetchH2HTable(), fetchH2HFixtures(), fetchWagersForGameweek()])
        : fetchLeagueTable(selectedGameweek, currentPage),
    ]);
    setRefreshing(false);
  };

  const fetchH2HTable = async () => {
    setH2HTableLoading(true);
    try {
      const response = await h2hAPI.getH2HLeagueTable(leagueId);
      if (response.success) {
        setH2HTable(response.table || []);
      }
    } catch (error) {
      console.error("Error fetching H2H table:", error);
    } finally {
      setH2HTableLoading(false);
    }
  };

  const fetchH2HFixtures = async () => {
    try {
      const response = await fixturesAPI.getFixturesForGameweek(currentGameweek);
      const raw: any[] = response.fixtures || [];
      const mapped = raw
        .filter((f: any) => !f.finished)
        .map((f: any) => {
          const home = getTeamById(f.team_h);
          const away = getTeamById(f.team_a);
          const kickoff = f.kickoff_time || f.date;
          const d = kickoff ? new Date(kickoff) : new Date();
          return {
            id: String(f.id || f._id),
            homeTeam: home?.displayName || "Home",
            awayTeam: away?.displayName || "Away",
            homeTeamId: f.team_h,
            awayTeamId: f.team_a,
            time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
            date: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
          };
        });
      setH2HFixtures(mapped);
    } catch (err) {
      console.error("Error fetching H2H fixtures:", err);
    }
  };

  const fetchWagersForGameweek = async () => {
    try {
      const data = await h2hAPI.getMyWagersForGameweek(leagueId, currentGameweek);
      setWagerSummary({ totalWagered: data.totalWagered || 0, remainingCap: data.remainingCap ?? 100 });
      const byFixture: { [id: string]: any } = {};
      (data.wagers || []).forEach((w: any) => { byFixture[String(w.fixtureId)] = w; });
      setWagers(byFixture);
    } catch {
      // no wagers yet
    }
  };

  const toggleWagerPanel = (fixtureId: string) => {
    setWagerForm((prev) => ({
      ...prev,
      [fixtureId]: prev[fixtureId]
        ? { ...prev[fixtureId], open: !prev[fixtureId].open }
        : { outcome: null, amount: 10, open: true },
    }));
  };

  const submitWager = async (fixtureId: string) => {
    const form = wagerForm[fixtureId];
    if (!form?.outcome) { Alert.alert("Select an outcome first."); return; }
    setWagerSubmitting((prev) => ({ ...prev, [fixtureId]: true }));
    try {
      await h2hAPI.placeWager(leagueId, Number(fixtureId), currentGameweek, form.outcome, form.amount);
      await fetchWagersForGameweek();
      setWagerForm((prev) => ({ ...prev, [fixtureId]: { ...prev[fixtureId], open: false } }));
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "Failed to place wager.");
    } finally {
      setWagerSubmitting((prev) => ({ ...prev, [fixtureId]: false }));
    }
  };

  const handleGameweekChange = (gameweek: number) => {
    setSelectedGameweek(gameweek);
    setCurrentPage(1); // Reset to first page when changing gameweek
  };

  const handlePageChange = (newPage: number) => {
    fetchLeagueTable(selectedGameweek, newPage);
  };

  const handleMemberPress = (member: LeagueMember) => {
    // Navigate to UserPredictions screen to view this member's predictions
    navigation.navigate("UserPredictions", {
      userId: member.userId,
      userName: member.userName,
      initialGameweek: selectedGameweek,
      joinedGameweek: member.joinedGameweek || 1,
    });
  };

  // Fetch fixtures and wagers when currentGameweek becomes known and it's an H2H league
  useEffect(() => {
    if (isH2HLeague && currentGameweek > 0 && !teamsLoading) {
      fetchH2HFixtures();
      fetchWagersForGameweek();
    }
  }, [isH2HLeague, currentGameweek, teamsLoading]);

  useEffect(() => {
    setLoading(false);
  }, [leagueData, availableGameweeks]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading league...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {/* Tabs — only shown for standard leagues */}
      {!isH2HLeague && (
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "table" && styles.activeTab]}
            onPress={() => setActiveTab("table")}
          >
            <Text style={[styles.tabText, activeTab === "table" && styles.activeTabText]}>
              Table
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Gameweek selector — always OUTSIDE the ScrollView so it never nests */}
      <LeagueGameweekSelector
        selectedGameweek={selectedGameweek}
        currentGameweek={currentGameweek}
        availableGameweeks={availableGameweeks}
        onGameweekChange={handleGameweekChange}
        loading={isH2HLeague ? h2hTableLoading : false}
        minGameweek={leagueData?.createdAtGameweek || 1}
      />

      {/* H2H tab: wager cap bar outside ScrollView */}
      {activeTab === "h2h" && wagerSummary && (
        <View style={styles.wagerCapBar}>
          <Text style={styles.wagerCapBarText}>
            ⚔ GW{currentGameweek} cap: {wagerSummary.totalWagered}/100 pts used · {wagerSummary.remainingCap} remaining
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        nestedScrollEnabled
        directionalLockEnabled
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Standard League Table */}
        {activeTab === "table" && (
          <View style={styles.tableContainer}>
            <LeagueTable
              members={leagueTable}
              gameweek={selectedGameweek}
              onMemberPress={handleMemberPress}
              loading={tableLoading}
              emptyMessage={`No data available for gameweek ${selectedGameweek}`}
              currentUserEntry={currentUserEntry}
              scrollEnabled={false}
            />

            {/* Pagination Controls */}
            {pagination && pagination.totalPages > 1 && (
              <View style={styles.paginationContainer}>
                <TouchableOpacity
                  style={[styles.pageButton, !pagination.hasPrevPage && styles.pageButtonDisabled]}
                  onPress={() => handlePageChange(currentPage - 1)}
                  disabled={!pagination.hasPrevPage || tableLoading}
                >
                  <Ionicons name="chevron-back" size={20} color={pagination.hasPrevPage ? "#007bff" : "#ccc"} />
                </TouchableOpacity>
                <View style={styles.pageInfo}>
                  <Text style={styles.pageInfoText}>
                    {pagination.startRank}-{pagination.endRank} of {pagination.totalMembers}
                  </Text>
                  <Text style={styles.pageNumberText}>
                    Page {currentPage} of {pagination.totalPages}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.pageButton, !pagination.hasNextPage && styles.pageButtonDisabled]}
                  onPress={() => handlePageChange(currentPage + 1)}
                  disabled={!pagination.hasNextPage || tableLoading}
                >
                  <Ionicons name="chevron-forward" size={20} color={pagination.hasNextPage ? "#007bff" : "#ccc"} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* H2H Tab */}
        {activeTab === "h2h" && (() => {
          const h2hMembers = [...h2hTable]
            .map((entry) => ({
              ...entry,
              gwScore: (entry.gameweekScores?.[selectedGameweek] ?? 0) as number,
            }))
            .sort((a, b) => b.gwScore - a.gwScore || b.totalScore - a.totalScore)
            .map((entry, idx) => ({
              userId: entry.userId,
              userName: entry.userName,
              userEmail: `W${entry.wagersWon} / L${entry.wagersLost}${entry.wagersVoided > 0 ? ` / V${entry.wagersVoided}` : ""}`,
              rank: idx + 1,
              previousRank: null,
              rankChange: 0,
              gameweekScore: entry.gwScore,
              totalScore: entry.totalScore,
              isNewMember: false,
              joinedGameweek: entry.joinedGameweek,
            }));

          return (
            <>
              {/* Place Wagers section */}
              {h2hFixtures.length > 0 && (
                <View style={styles.wagerSection}>
                  <Text style={styles.wagerSectionTitle}>Place Wagers — GW{currentGameweek}</Text>
                  {h2hFixtures.map((fixture) => {
                    const form = wagerForm[fixture.id];
                    const existing = wagers[fixture.id];
                    return (
                      <View key={fixture.id} style={styles.wagerFixtureCard}>
                        <View style={styles.wagerFixtureRow}>
                          <View style={styles.wagerTeamSide}>
                            {fixture.homeTeamId && getTeamLogo(fixture.homeTeamId) && (
                              <Image source={getTeamLogo(fixture.homeTeamId)} style={styles.wagerTeamLogo} resizeMode="contain" />
                            )}
                            <Text style={styles.wagerTeamName} numberOfLines={1}>{fixture.homeTeam}</Text>
                          </View>
                          <View style={styles.wagerVsBox}>
                            <Text style={styles.wagerVs}>vs</Text>
                            <Text style={styles.wagerTime}>{fixture.time}</Text>
                          </View>
                          <View style={[styles.wagerTeamSide, styles.wagerAwayTeam]}>
                            <Text style={styles.wagerTeamName} numberOfLines={1}>{fixture.awayTeam}</Text>
                            {fixture.awayTeamId && getTeamLogo(fixture.awayTeamId) && (
                              <Image source={getTeamLogo(fixture.awayTeamId)} style={styles.wagerTeamLogo} resizeMode="contain" />
                            )}
                          </View>
                        </View>

                        <TouchableOpacity
                          style={styles.wagerToggleBtn}
                          onPress={() => toggleWagerPanel(fixture.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.wagerToggleText}>
                            {existing
                              ? `Wager placed: ${existing.totalAmount} pts (${existing.outcome}, ${existing.status})`
                              : "+ Place Wager"}
                          </Text>
                          <Text style={styles.wagerToggleArrow}>{form?.open ? "▲" : "▼"}</Text>
                        </TouchableOpacity>

                        {form?.open && (
                          <View style={styles.wagerPanel}>
                            <Text style={styles.wagerLabel}>Predict outcome:</Text>
                            <View style={styles.wagerOutcomeRow}>
                              {(["home", "draw", "away"] as const).map((o) => (
                                <TouchableOpacity
                                  key={o}
                                  style={[styles.wagerOutcomeBtn, form.outcome === o && styles.wagerOutcomeBtnActive]}
                                  onPress={() => setWagerForm((prev) => ({ ...prev, [fixture.id]: { ...prev[fixture.id], outcome: o } }))}
                                >
                                  <Text style={[styles.wagerOutcomeText, form.outcome === o && styles.wagerOutcomeTextActive]}>
                                    {o === "home" ? fixture.homeTeam : o === "away" ? fixture.awayTeam : "Draw"}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>

                            <Text style={styles.wagerLabel}>Amount (10–100 pts):</Text>
                            <View style={styles.wagerAmountRow}>
                              <TouchableOpacity
                                style={styles.wagerStepBtn}
                                onPress={() => setWagerForm((prev) => ({ ...prev, [fixture.id]: { ...prev[fixture.id], amount: Math.max(10, (prev[fixture.id]?.amount || 10) - 10) } }))}
                              >
                                <Text style={styles.wagerStepText}>−</Text>
                              </TouchableOpacity>
                              <Text style={styles.wagerAmountText}>{form.amount} pts</Text>
                              <TouchableOpacity
                                style={styles.wagerStepBtn}
                                onPress={() => {
                                  const cap = wagerSummary?.remainingCap ?? 100;
                                  const cur = form.amount || 10;
                                  setWagerForm((prev) => ({ ...prev, [fixture.id]: { ...prev[fixture.id], amount: Math.min(Math.min(100, cur + cap), cur + 10) } }));
                                }}
                              >
                                <Text style={styles.wagerStepText}>+</Text>
                              </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                              style={[styles.wagerSubmitBtn, (!form.outcome || wagerSubmitting[fixture.id]) && styles.wagerSubmitBtnDisabled]}
                              onPress={() => submitWager(fixture.id)}
                              disabled={!form.outcome || !!wagerSubmitting[fixture.id]}
                            >
                              {wagerSubmitting[fixture.id] ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Text style={styles.wagerSubmitText}>{existing ? "Update Wager" : "Place Wager"}</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Standings */}
              <View style={styles.tableContainer}>
                <LeagueTable
                  members={h2hMembers}
                  gameweek={selectedGameweek}
                  onMemberPress={handleMemberPress}
                  loading={h2hTableLoading}
                  emptyMessage="No H2H data yet. Place wagers to see standings."
                  currentUserId={currentUserId ?? undefined}
                  scrollEnabled={false}
                />
              </View>
            </>
          );
        })()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 16,
    color: "#6c757d",
    fontWeight: "500",
  },
  leagueHeader: {
    backgroundColor: "#fff",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  leagueInfo: {
    alignItems: "center",
  },
  leagueName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#212529",
    textAlign: "center",
    marginBottom: 8,
  },
  leagueDescription: {
    fontSize: 14,
    color: "#6c757d",
    textAlign: "center",
    marginBottom: 16,
  },
  leagueStats: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: "#6c757d",
    fontWeight: "500",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#007bff",
  },
  tabText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6c757d",
  },
  activeTabText: {
    color: "#007bff",
    fontWeight: "600",
  },
  tableContainer: {
    padding: 16,
  },
  // Pagination styles
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e9ecef",
    marginTop: 8,
    borderRadius: 8,
  },
  pageButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#f8f9fa",
  },
  pageButtonDisabled: {
    opacity: 0.5,
  },
  pageInfo: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  pageInfoText: {
    fontSize: 14,
    color: "#495057",
    fontWeight: "500",
  },
  pageNumberText: {
    fontSize: 12,
    color: "#6c757d",
    marginTop: 2,
  },
  historyContainer: {
    padding: 40,
    alignItems: "center",
  },
  comingSoonText: {
    fontSize: 16,
    color: "#6c757d",
    fontStyle: "italic",
  },
  // Header styles for navigation bar
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    maxWidth: 500,
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#fff",
    opacity: 0.8,
    fontWeight: "400",
  },
  headerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginRight: 8,
  },
  headerStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerStatText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "500",
  },
  wagerSection: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  wagerCapBar: {
    backgroundColor: "#fff3e0",
    borderBottomWidth: 1,
    borderBottomColor: "#ffe0b2",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  wagerCapBarText: {
    fontSize: 12,
    color: "#e65100",
    fontWeight: "600",
  },
  wagerSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  wagerSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#e65100",
  },
  wagerCapText: {
    fontSize: 11,
    color: "#6c757d",
  },
  wagerFixtureCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: 10,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  wagerFixtureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  wagerTeamSide: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  wagerAwayTeam: {
    justifyContent: "flex-end",
  },
  wagerTeamLogo: {
    width: 22,
    height: 22,
  },
  wagerTeamName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#212529",
    flexShrink: 1,
  },
  wagerVsBox: {
    alignItems: "center",
    paddingHorizontal: 8,
  },
  wagerVs: {
    fontSize: 12,
    color: "#6c757d",
    fontWeight: "500",
  },
  wagerTime: {
    fontSize: 11,
    color: "#adb5bd",
  },
  wagerToggleBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff3e0",
    borderWidth: 1,
    borderColor: "#fd7e14",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  wagerToggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#e65100",
    flex: 1,
  },
  wagerToggleArrow: {
    fontSize: 11,
    color: "#e65100",
    marginLeft: 8,
  },
  wagerPanel: {
    marginTop: 10,
    padding: 12,
    backgroundColor: "#fffbf5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ffe0b2",
  },
  wagerLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6c757d",
    marginBottom: 6,
    marginTop: 4,
  },
  wagerOutcomeRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
  },
  wagerOutcomeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#dee2e6",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  wagerOutcomeBtnActive: {
    borderColor: "#fd7e14",
    backgroundColor: "#fd7e14",
  },
  wagerOutcomeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6c757d",
    textAlign: "center",
  },
  wagerOutcomeTextActive: {
    color: "#fff",
  },
  wagerAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginBottom: 8,
  },
  wagerStepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fd7e14",
    alignItems: "center",
    justifyContent: "center",
  },
  wagerStepText: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "bold",
    lineHeight: 22,
  },
  wagerAmountText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#212529",
    minWidth: 70,
    textAlign: "center",
  },
  wagerSubmitBtn: {
    backgroundColor: "#fd7e14",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 4,
  },
  wagerSubmitBtnDisabled: {
    backgroundColor: "#adb5bd",
  },
  wagerSubmitText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});

export default LeagueDetails;
