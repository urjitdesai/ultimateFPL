import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import {
  SafeAreaView,
  SafeAreaProvider,
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import axios from "axios";
import type {
  FixtureData,
  BackendFixture,
  FixturesResponse,
} from "../types/fixtures";
import { useTeams } from "../hooks/useTeams";

const Fixtures = () => {
  const [selectedGameweek, setSelectedGameweek] = useState(1);
  const [currentGameweek, setCurrentGameweek] = useState<number | null>(null);
  const [fixtures, setFixtures] = useState<FixtureData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use teams hook for team data and logos
  const { teams, getTeamById, getTeamLogo, loading: teamsLoading } = useTeams();

  // Fetch fixtures for a specific gameweek
  const fetchFixtures = async (gameweek: number) => {
    setLoading(true);
    setError(null);

    console.log(`Fetching fixtures for gameweek ${gameweek}...`);

    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/fixtures/${gameweek}`
      );

      console.log("Fixtures API response:", response.data);

      // Transform the data to match our interface
      const transformedFixtures: FixtureData[] = response.data.fixtures.map(
        (fixture: BackendFixture): FixtureData => {
          const kickoffTime = fixture.kickoff_time || fixture.date;
          const fixtureDate = kickoffTime ? new Date(kickoffTime) : new Date();

          // Get team names from our teams data or fallback to API data
          const homeTeam = fixture.team_h ? getTeamById(fixture.team_h) : null;
          const awayTeam = fixture.team_a ? getTeamById(fixture.team_a) : null;

          return {
            id: fixture.id || fixture._id || String(Math.random()),
            homeTeam: homeTeam?.displayName || "Home Team",
            awayTeam: awayTeam?.displayName || "Away Team",
            homeTeamId: fixture.team_h,
            awayTeamId: fixture.team_a,
            date: fixtureDate.toISOString(),
            time: fixtureDate.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            gameweek: fixture.event || fixture.gameweek || gameweek,
            status: fixture.finished
              ? "finished"
              : fixture.started
              ? "live"
              : "upcoming",
            homeScore: fixture.team_h_score,
            awayScore: fixture.team_a_score,
          };
        }
      );

      // Sort fixtures by time in ascending order, then by home team ID if dates are same
      const sortedFixtures = transformedFixtures.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        const timeDiff = dateA.getTime() - dateB.getTime();

        // If dates are the same, sort by home team ID
        if (timeDiff === 0) {
          const homeTeamIdA = a.homeTeamId || 0;
          const homeTeamIdB = b.homeTeamId || 0;
          return Number(homeTeamIdA) - Number(homeTeamIdB);
        }

        return timeDiff;
      });

      setFixtures(sortedFixtures);
      console.log(
        `Successfully loaded ${sortedFixtures.length} fixtures for gameweek ${gameweek}`
      );
    } catch (err) {
      console.error("Error fetching fixtures:", err);

      // More detailed error handling
      if (axios.isAxiosError(err)) {
        if (err.response) {
          setError(
            `Server error: ${err.response.status} - ${err.response.statusText}`
          );
        } else if (err.request) {
          setError(
            "Network error: Please check your connection and backend server"
          );
        } else {
          setError(`Request error: ${err.message}`);
        }
      } else {
        setError("Failed to load fixtures");
      }

      setFixtures([]);
    } finally {
      setLoading(false);
    }
  };

  // Get current gameweek from API
  const getCurrentGameweek = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/fixtures/gameweek/current`
      );
      const gameweek = response.data.currentGameweek;
      setCurrentGameweek(gameweek);
      return gameweek;
    } catch (err) {
      console.error("Error fetching current gameweek:", err);
      // Fallback to gameweek 1 if API fails
      setCurrentGameweek(1);
      return 1;
    }
  };

  // Initialize with current gameweek and fetch fixtures
  const initializeWithCurrentGameweek = async () => {
    if (!teamsLoading && Object.keys(teams).length > 0) {
      const gameweek = await getCurrentGameweek();
      setSelectedGameweek(gameweek);
      fetchFixtures(gameweek);
    }
  };

  // Initialize with current gameweek when component mounts and teams are loaded
  useEffect(() => {
    if (
      !teamsLoading &&
      Object.keys(teams).length > 0 &&
      currentGameweek === null
    ) {
      initializeWithCurrentGameweek();
    }
  }, [teamsLoading, teams, currentGameweek]);

  // Fetch fixtures when selected gameweek changes (after initialization)
  useEffect(() => {
    if (
      !teamsLoading &&
      Object.keys(teams).length > 0 &&
      currentGameweek !== null &&
      selectedGameweek !== currentGameweek
    ) {
      fetchFixtures(selectedGameweek);
    }
  }, [selectedGameweek, teamsLoading, teams, currentGameweek]);

  const handleGameweekChange = (gameweek: number) => {
    setSelectedGameweek(gameweek);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "upcoming":
        return "#007bff";
      case "live":
        return "#dc3545";
      case "finished":
        return "#28a745";
      default:
        return "#6c757d";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "upcoming":
        return "UPCOMING";
      case "live":
        return "LIVE";
      case "finished":
        return "FINISHED";
      default:
        return status.toUpperCase();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const renderFixtureCard = (fixture: FixtureData) => (
    <View key={fixture.id} style={styles.fixtureCard}>
      <View style={styles.fixtureHeader}>
        <Text style={styles.dateText}>{formatDate(fixture.date)}</Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(fixture.status) },
          ]}
        >
          <Text style={styles.statusText}>{getStatusText(fixture.status)}</Text>
        </View>
      </View>

      <View style={styles.matchInfo}>
        <View style={styles.teamContainer}>
          <View style={styles.teamInfoContainer}>
            {fixture.homeTeamId && getTeamLogo(fixture.homeTeamId) && (
              <Image
                source={getTeamLogo(fixture.homeTeamId)}
                style={styles.teamLogo}
                resizeMode="contain"
              />
            )}
            <Text style={styles.teamName}>{fixture.homeTeam}</Text>
          </View>
          {fixture.status === "finished" && (
            <Text style={styles.scoreText}>{fixture.homeScore}</Text>
          )}
        </View>

        <View style={styles.vsContainer}>
          {fixture.status === "finished" ? (
            <Text style={styles.vsText}>-</Text>
          ) : (
            <View style={styles.vsContentContainer}>
              <Text style={styles.vsText}>vs</Text>
              <Text style={styles.timeText}>{fixture.time}</Text>
            </View>
          )}
        </View>

        <View style={styles.teamContainer}>
          <View style={styles.teamInfoContainer}>
            {fixture.awayTeamId && getTeamLogo(fixture.awayTeamId) && (
              <Image
                source={getTeamLogo(fixture.awayTeamId)}
                style={styles.teamLogo}
                resizeMode="contain"
              />
            )}
            <Text style={styles.teamName}>{fixture.awayTeam}</Text>
          </View>
          {fixture.status === "finished" && (
            <Text style={styles.scoreText}>{fixture.awayScore}</Text>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Fixtures</Text>
        <Text style={styles.headerSubtitle}>Premier League matches</Text>
      </View>

      <View style={styles.gameweekSelector}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.gameweekScroll}
        >
          {Array.from({ length: 38 }, (_, i) => i + 1).map((gw) => (
            <TouchableOpacity
              key={gw}
              style={[
                styles.gameweekButton,
                selectedGameweek === gw && styles.selectedGameweekButton,
                currentGameweek === gw && styles.currentGameweekButton,
              ]}
              onPress={() => handleGameweekChange(gw)}
            >
              <Text
                style={[
                  styles.gameweekButtonText,
                  selectedGameweek === gw && styles.selectedGameweekButtonText,
                  currentGameweek === gw && styles.currentGameweekButtonText,
                ]}
              >
                GW {gw}
                {currentGameweek === gw && (
                  <Text style={styles.currentIndicator}> •</Text>
                )}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>
          Gameweek {selectedGameweek}
          {currentGameweek === selectedGameweek && (
            <Text style={styles.currentIndicator}> (Current)</Text>
          )}
        </Text>

        {(loading || teamsLoading) && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007bff" />
            <Text style={styles.loadingText}>
              {teamsLoading ? "Loading teams..." : "Loading fixtures..."}
            </Text>
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => fetchFixtures(selectedGameweek)}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !teamsLoading && !error && fixtures.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No fixtures available for this gameweek
            </Text>
          </View>
        )}

        {!loading &&
          !teamsLoading &&
          !error &&
          fixtures.length > 0 &&
          fixtures.map(renderFixtureCard)}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    backgroundColor: "#fff",
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#212529",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#6c757d",
  },
  gameweekSelector: {
    backgroundColor: "#fff",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  gameweekScroll: {
    paddingHorizontal: 20,
  },
  gameweekButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#dee2e6",
  },
  selectedGameweekButton: {
    backgroundColor: "#007bff",
    borderColor: "#007bff",
  },
  gameweekButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6c757d",
  },
  selectedGameweekButtonText: {
    color: "#fff",
  },
  currentGameweekButton: {
    borderColor: "#28a745",
    borderWidth: 2,
  },
  currentGameweekButtonText: {
    color: "#28a745",
    fontWeight: "600",
  },
  currentIndicator: {
    color: "#28a745",
    fontSize: 16,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#212529",
    marginBottom: 16,
  },
  fixtureCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  fixtureHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  dateText: {
    fontSize: 14,
    color: "#6c757d",
    fontWeight: "500",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  matchInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  teamContainer: {
    flex: 1,
    alignItems: "center",
  },
  teamName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212529",
    textAlign: "center",
    marginBottom: 4,
  },
  scoreText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#007bff",
  },
  vsContainer: {
    alignItems: "center",
    marginHorizontal: 16,
  },
  vsText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6c757d",
  },
  timeText: {
    fontSize: 12,
    color: "#6c757d",
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: "#6c757d",
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  errorText: {
    fontSize: 16,
    color: "#dc3545",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#007bff",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#6c757d",
    textAlign: "center",
  },
  teamInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  teamLogo: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  vsContentContainer: {
    alignItems: "center",
  },
});

export default Fixtures;
