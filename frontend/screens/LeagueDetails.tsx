import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../types/navigation";
import { leaguesAPI, fixturesAPI } from "../utils/api";
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
}

interface LeagueMember {
  userId: string;
  userName: string;
  userEmail?: string;
  rank: number;
  previousRank: number | null;
  rankChange: number;
  gameweekScore: number;
  totalScore: number;
  isNewMember: boolean;
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
  const { leagueId, leagueName } = route.params as LeagueDetailsParams;

  const [leagueData, setLeagueData] = useState<LeagueData | null>(null);
  const [leagueTable, setLeagueTable] = useState<LeagueMember[]>([]);
  const [currentUserEntry, setCurrentUserEntry] = useState<LeagueMember | null>(
    null
  );
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedGameweek, setSelectedGameweek] = useState<number>(1);
  const [currentGameweek, setCurrentGameweek] = useState<number>(1);
  const [availableGameweeks, setAvailableGameweeks] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"table" | "history">("table");

  useEffect(() => {
    fetchLeagueDetails();
    fetchCurrentGameweek();
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
        50
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
      fetchLeagueTable(selectedGameweek, currentPage),
    ]);
    setRefreshing(false);
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
    });
  };

  const handleCalculateScores = async () => {
    console.log("Calculate GW button pressed");
    console.log("Selected gameweek:", selectedGameweek);
    console.log("League ID:", leagueId);

    try {
      console.log("Starting score calculation...");
      setTableLoading(true);

      const response = await leaguesAPI.calculateLeagueScores(
        leagueId,
        selectedGameweek
      );
      console.log("Calculate scores response:", response);

      // Refresh the league table to show updated scores
      await fetchLeagueTable(selectedGameweek);
      console.log("League table refreshed");
    } catch (error) {
      console.error("Error calculating scores:", error);
    } finally {
      setTableLoading(false);
    }
  };

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
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* League Header - moved to navigation bar */}
        {/* {leagueData && (
          <View style={styles.leagueHeader}>
            <View style={styles.leagueInfo}>
              <Text style={styles.leagueName}>{leagueData.name}</Text>
              {leagueData.description && (
                <Text style={styles.leagueDescription}>
                  {leagueData.description}
                </Text>
              )}
              <View style={styles.leagueStats}>
                <View style={styles.statItem}>
                  <Ionicons name="people" size={16} color="#6c757d" />
                  <Text style={styles.statText}>
                    {leagueData.memberCount} members
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="key" size={16} color="#6c757d" />
                  <Text style={styles.statText}>{leagueData.leagueCode}</Text>
                </View>
              </View>
            </View>
          </View>
        )} */}

        {/* Temporarily commented out tabs since we only have one tab */}
        {/* <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "table" && styles.activeTab]}
            onPress={() => setActiveTab("table")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "table" && styles.activeTabText,
              ]}
            >
              Table
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "history" && styles.activeTab]}
            onPress={() => setActiveTab("history")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "history" && styles.activeTabText,
              ]}
            >
              History
            </Text>
          </TouchableOpacity>
        </View> */}

        {/* {activeTab === "table" && ( */}
        {/* Removed tab condition since we only show table content now */}
        <>
          {/* Gameweek Selector */}
          <LeagueGameweekSelector
            selectedGameweek={selectedGameweek}
            currentGameweek={currentGameweek}
            availableGameweeks={availableGameweeks}
            onGameweekChange={handleGameweekChange}
          />

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.calculateButton}
              onPress={() => {
                console.log("Button pressed - calling handleCalculateScores");
                handleCalculateScores();
              }}
              disabled={tableLoading}
              activeOpacity={0.7}
            >
              <Ionicons name="calculator" size={16} color="#fff" />
              <Text style={styles.calculateButtonText}>
                Calculate GW{selectedGameweek}
              </Text>
            </TouchableOpacity>
          </View>

          {/* League Table */}
          <View style={styles.tableContainer}>
            <LeagueTable
              members={leagueTable}
              gameweek={selectedGameweek}
              onMemberPress={handleMemberPress}
              loading={tableLoading}
              emptyMessage={`No data available for gameweek ${selectedGameweek}`}
              currentUserEntry={currentUserEntry}
            />

            {/* Pagination Controls */}
            {pagination && pagination.totalPages > 1 && (
              <View style={styles.paginationContainer}>
                <TouchableOpacity
                  style={[
                    styles.pageButton,
                    !pagination.hasPrevPage && styles.pageButtonDisabled,
                  ]}
                  onPress={() => handlePageChange(currentPage - 1)}
                  disabled={!pagination.hasPrevPage || tableLoading}
                >
                  <Ionicons
                    name="chevron-back"
                    size={20}
                    color={pagination.hasPrevPage ? "#007bff" : "#ccc"}
                  />
                </TouchableOpacity>

                <View style={styles.pageInfo}>
                  <Text style={styles.pageInfoText}>
                    {pagination.startRank}-{pagination.endRank} of{" "}
                    {pagination.totalMembers}
                  </Text>
                  <Text style={styles.pageNumberText}>
                    Page {currentPage} of {pagination.totalPages}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.pageButton,
                    !pagination.hasNextPage && styles.pageButtonDisabled,
                  ]}
                  onPress={() => handlePageChange(currentPage + 1)}
                  disabled={!pagination.hasNextPage || tableLoading}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={pagination.hasNextPage ? "#007bff" : "#ccc"}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </>

        {/* Temporarily commented out history tab content */}
        {/* {activeTab === "history" && (
          <View style={styles.historyContainer}>
            <Text style={styles.comingSoonText}>
              History view coming soon...
            </Text>
          </View>
        )} */}
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
  actionButtons: {
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
    alignItems: "flex-end",
  },
  calculateButton: {
    backgroundColor: "#007bff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  calculateButtonText: {
    color: "#fff",
    fontSize: 14,
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
});

export default LeagueDetails;
