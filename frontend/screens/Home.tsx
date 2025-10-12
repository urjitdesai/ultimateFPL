import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import {
  SafeAreaView,
  SafeAreaProvider,
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import axios from "axios";
import { useTeams } from "../hooks/useTeams";
import type { FixtureData, BackendFixture } from "../types/fixtures";

interface PredictionData {
  [fixtureId: string]: {
    homeScore: string;
    awayScore: string;
  };
}

const Home = () => {
  const [currentGameweek, setCurrentGameweek] = useState(1);
  const [fixtures, setFixtures] = useState<FixtureData[]>([]);
  const [predictions, setPredictions] = useState<PredictionData>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { getTeamById, getTeamLogo, loading: teamsLoading } = useTeams();

  // Fetch fixtures for current gameweek
  const fetchCurrentGameweekFixtures = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/fixtures/${currentGameweek}`
      );

      const transformedFixtures: FixtureData[] = response.data.fixtures.map(
        (fixture: BackendFixture): FixtureData => {
          const kickoffTime = fixture.kickoff_time || fixture.date;
          const fixtureDate = kickoffTime ? new Date(kickoffTime) : new Date();

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
            gameweek: fixture.event || fixture.gameweek || currentGameweek,
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

      // Sort fixtures by time, then by home team ID
      const sortedFixtures = transformedFixtures.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        const timeDiff = dateA.getTime() - dateB.getTime();

        if (timeDiff === 0) {
          const homeTeamIdA = a.homeTeamId || 0;
          const homeTeamIdB = b.homeTeamId || 0;
          return Number(homeTeamIdA) - Number(homeTeamIdB);
        }

        return timeDiff;
      });

      setFixtures(sortedFixtures);
    } catch (err) {
      console.error("Error fetching fixtures:", err);
      setError("Failed to load fixtures");
    } finally {
      setLoading(false);
    }
  };

  // Handle prediction input change
  const handlePredictionChange = (
    fixtureId: string,
    team: "home" | "away",
    score: string
  ) => {
    // Allow empty string for clearing the input
    if (score === "") {
      setPredictions((prev) => ({
        ...prev,
        [fixtureId]: {
          ...prev[fixtureId],
          [team === "home" ? "homeScore" : "awayScore"]: score,
        },
      }));
      return;
    }

    // Validate input: only allow positive numbers less than 100
    const numericValue = parseInt(score, 10);
    if (
      /^\d+$/.test(score) && // Only digits
      numericValue >= 0 && // Non-negative
      numericValue < 100 // Less than 100
    ) {
      setPredictions((prev) => ({
        ...prev,
        [fixtureId]: {
          ...prev[fixtureId],
          [team === "home" ? "homeScore" : "awayScore"]: score,
        },
      }));
    }
    // If validation fails, don't update the state (input is ignored)
  };

  // Submit predictions to backend
  const submitPredictions = async () => {
    setSubmitting(true);
    try {
      const predictionsArray = Object.keys(predictions).map((fixtureId) => ({
        fixtureId,
        homeScore: parseInt(predictions[fixtureId]?.homeScore || "0"),
        awayScore: parseInt(predictions[fixtureId]?.awayScore || "0"),
        gameweek: currentGameweek,
      }));

      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/user-predictions`,
        {
          predictions: predictionsArray,
          gameweek: currentGameweek,
        }
      );

      Alert.alert("Success", "Your predictions have been submitted!");
      console.log("Predictions submitted:", response.data);
    } catch (err) {
      console.error("Error submitting predictions:", err);
      Alert.alert("Error", "Failed to submit predictions. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Load fixtures when component mounts or teams data is ready
  useEffect(() => {
    if (!teamsLoading && Object.keys(getTeamById(1) || {}).length > 0) {
      fetchCurrentGameweekFixtures();
    }
  }, [currentGameweek, teamsLoading]);

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
        <View style={styles.dateTimeContainer}>
          <Text style={styles.dateText}>{formatDate(fixture.date)}</Text>
          <Text style={styles.timeText}>{fixture.time}</Text>
        </View>
      </View>

      <View style={styles.matchContainer}>
        {/* Home Team */}
        <View style={styles.homeTeamSection}>
          <View style={styles.teamInfo}>
            {fixture.homeTeamId && getTeamLogo(fixture.homeTeamId) && (
              <Image
                source={getTeamLogo(fixture.homeTeamId)}
                style={styles.teamLogo}
                resizeMode="contain"
              />
            )}
            <Text style={styles.teamName}>{fixture.homeTeam}</Text>
          </View>
          <TextInput
            style={styles.scoreInput}
            value={predictions[fixture.id]?.homeScore || ""}
            onChangeText={(text) =>
              handlePredictionChange(fixture.id, "home", text)
            }
            placeholder="0"
            placeholderTextColor="#6c757d"
            keyboardType="numeric"
            maxLength={2}
            selectTextOnFocus={true}
          />
        </View>

        {/* VS */}
        <View style={styles.vsContainer}>
          <Text style={styles.vsText}>vs</Text>
        </View>

        {/* Away Team */}
        <View style={styles.awayTeamSection}>
          <TextInput
            style={styles.scoreInput}
            value={predictions[fixture.id]?.awayScore || ""}
            onChangeText={(text) =>
              handlePredictionChange(fixture.id, "away", text)
            }
            placeholder="0"
            placeholderTextColor="#6c757d"
            keyboardType="numeric"
            maxLength={2}
            selectTextOnFocus={true}
          />
          <View style={styles.awayTeamInfo}>
            <Text style={styles.awayTeamName}>{fixture.awayTeam}</Text>
            {fixture.awayTeamId && getTeamLogo(fixture.awayTeamId) && (
              <Image
                source={getTeamLogo(fixture.awayTeamId)}
                style={styles.teamLogo}
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </View>
    </View>
  );
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ultimate FPL</Text>
          <Text style={styles.headerSubtitle}>
            Gameweek {currentGameweek} Predictions
          </Text>
        </View>

        {(loading || teamsLoading) && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007bff" />
            <Text style={styles.loadingText}>Loading fixtures...</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={fetchCurrentGameweekFixtures}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !teamsLoading && !error && fixtures.length > 0 && (
          <View style={styles.content}>
            <Text style={styles.sectionTitle}>Make Your Predictions</Text>
            {fixtures.map(renderFixtureCard)}

            <TouchableOpacity
              style={[
                styles.submitButton,
                submitting && styles.submitButtonDisabled,
              ]}
              onPress={submitPredictions}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Predictions</Text>
              )}
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
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollContent: {
    flexGrow: 1,
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
  content: {
    padding: 20,
  },
  card: {
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
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#212529",
    marginBottom: 8,
  },
  cardContent: {
    fontSize: 14,
    color: "#6c757d",
    lineHeight: 20,
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#212529",
    marginBottom: 16,
  },
  fixtureCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  fixtureHeader: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: 12,
  },
  dateTimeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateText: {
    fontSize: 14,
    color: "#6c757d",
    fontWeight: "500",
    marginRight: 8,
  },
  timeText: {
    fontSize: 14,
    color: "#007bff",
    fontWeight: "600",
  },
  matchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  homeTeamSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flex: 1,
  },
  awayTeamSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    flex: 1,
  },
  teamSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  teamInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
    justifyContent: "flex-end",
  },
  awayTeamInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
    justifyContent: "flex-start",
  },
  teamLogo: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  teamName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#212529",
  },
  awayTeamName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#212529",
    marginRight: 8,
  },
  scoreInput: {
    width: 40,
    height: 32,
    borderWidth: 1,
    borderColor: "#dee2e6",
    borderRadius: 6,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    backgroundColor: "#f8f9fa",
  },
  vsContainer: {
    alignItems: "center",
    marginHorizontal: 16,
  },
  vsText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6c757d",
  },
  submitButton: {
    backgroundColor: "#28a745",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: "#6c757d",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default Home;
