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
import { SafeAreaView } from "react-native-safe-area-context";
import { authAPI, fixturesAPI, predictionsAPI } from "../utils/api";
import { useNavigation } from "@react-navigation/native";
import { useTeams } from "../hooks/useTeams";
import GameweekSelector from "../components/GameweekSelector";
import type { FixtureData, BackendFixture } from "../types/fixtures";

interface PredictionData {
  [fixtureId: string]: {
    homeScore: string;
    awayScore: string;
    score?: {
      goals_scored: number;
      assists: number;
      correct_scoreline: number;
    };
    total_score?: number;
  };
}

interface GameweekScoreData {
  totalScore: number;
  hasScores: boolean;
}

const Home = () => {
  const [currentGameweek, setCurrentGameweek] = useState(1);
  const [selectedGameweek, setSelectedGameweek] = useState(1);
  const [fixtures, setFixtures] = useState<FixtureData[]>([]);
  const [predictions, setPredictions] = useState<PredictionData>({});
  const [gameweekScores, setGameweekScores] = useState<GameweekScoreData>({
    totalScore: 0,
    hasScores: false,
  });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { getTeamById, getTeamLogo, loading: teamsLoading } = useTeams();
  const navigation = useNavigation();

  // Handle logout
  const handleLogout = async () => {
    try {
      await authAPI.logout();
      Alert.alert("Success", "Logged out successfully");
      // Navigate to login screen (you might need to adjust this based on your navigation structure)
      navigation.navigate("login" as never);
    } catch (error) {
      console.error("Logout error:", error);
      Alert.alert("Error", "Failed to logout");
    }
  };

  // Fetch fixtures for a specific gameweek
  const fetchFixturesForGameweek = async (gameweek: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fixturesAPI.getFixturesForGameweek(gameweek);

      const transformedFixtures: FixtureData[] = response.fixtures.map(
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
      console.log("sortedFixtures= ", sortedFixtures);

      setFixtures(sortedFixtures);
    } catch (err) {
      console.error("Error fetching fixtures:", err);
      setError("Failed to load fixtures");
    } finally {
      setLoading(false);
    }
  };

  // Fetch user predictions for a specific gameweek
  const fetchUserPredictions = async (gameweek: number) => {
    if (gameweek > currentGameweek) return; // Don't fetch predictions for future gameweeks
    setLoadingPredictions(true);
    try {
      const response = await predictionsAPI.getUserPredictions(gameweek);

      // Transform predictions to match our state structure
      const predictionsMap: PredictionData = {};
      let hasCalculatedScores = false;

      if (response.predictions && Array.isArray(response.predictions)) {
        response.predictions.forEach((prediction: any) => {
          const fixtureId = prediction.fixture_id || prediction.id;
          if (fixtureId) {
            predictionsMap[fixtureId] = {
              homeScore: String(prediction.team_h_score || 0),
              awayScore: String(prediction.team_a_score || 0),
              score: prediction.score || undefined,
              total_score: prediction.total_score,
            };
          }
        });
      }

      // Update gameweek scores if this is a previous gameweek with calculated scores
      if (gameweek < currentGameweek || hasCalculatedScores) {
        setGameweekScores({
          totalScore: response.total_score,
          hasScores: true,
        });
      } else {
        setGameweekScores({
          totalScore: 0,
          hasScores: false,
        });
      }

      setPredictions(predictionsMap);
      console.log("User predictions loaded with scores");
    } catch (err) {
      console.error("Error fetching user predictions:", err);
      // If predictions don't exist or error occurs, just clear predictions
      setPredictions({});
      setGameweekScores({ totalScore: 0, hasScores: false });
    } finally {
      setLoadingPredictions(false);
    }
  };

  // Handle prediction input change
  const handlePredictionChange = (
    fixtureId: string,
    team: "home" | "away",
    score: string
  ) => {
    // Don't allow changes for future gameweeks
    if (selectedGameweek > currentGameweek) {
      return;
    }

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
        gameweek: selectedGameweek,
      }));

      const response = await predictionsAPI.submitPredictions(
        predictionsArray,
        selectedGameweek
      );

      Alert.alert("Success", "Your predictions have been submitted!");
      console.log("Predictions submitted:", response);
    } catch (err) {
      console.error("Error submitting predictions:", err);
      Alert.alert("Error", "Failed to submit predictions. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const getCurrentGameweek = async () => {
    try {
      const response = await fixturesAPI.getCurrentGameweek();
      const newGameweek = response.currentGameweek;
      setCurrentGameweek(newGameweek);
      return newGameweek;
    } catch (err) {
      console.error("Error fetching current gameweek:", err);
      return null;
    }
  };

  // Fetch current gameweek and immediately fetch fixtures for it
  const fetchCurrentGameweekAndFixtures = async () => {
    const gameweek = await getCurrentGameweek();
    if (gameweek && !teamsLoading && getTeamById(1)) {
      setSelectedGameweek(gameweek); // Set selected gameweek to current
      fetchFixturesForGameweek(gameweek);
      fetchUserPredictions(gameweek);
    }
  };

  // Handle gameweek selection change
  const handleGameweekChange = (gameweek: number) => {
    setSelectedGameweek(gameweek);
    // Clear existing predictions when switching gameweeks
    setPredictions({});

    if (!teamsLoading && getTeamById(1)) {
      fetchFixturesForGameweek(gameweek);
      fetchUserPredictions(gameweek);
    }
  };

  // Load current gameweek and fixtures when component mounts and teams are loaded
  useEffect(() => {
    if (!teamsLoading && getTeamById(1)) {
      fetchCurrentGameweekAndFixtures();
    }
  }, [teamsLoading]);

  // Fetch fixtures when current gameweek changes and teams are loaded
  useEffect(() => {
    if (currentGameweek && !teamsLoading && getTeamById(1)) {
      fetchFixturesForGameweek(currentGameweek);
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
        {selectedGameweek < currentGameweek &&
          predictions[fixture.id] &&
          predictions[fixture.id].total_score !== undefined && (
            <View
              style={[
                styles.fixtureScoreContainer,
                predictions[fixture.id].total_score === 0 &&
                  styles.zeroScoreContainer,
              ]}
            >
              <Text
                style={[
                  styles.fixtureScoreText,
                  predictions[fixture.id].total_score === 0 &&
                    styles.zeroScoreText,
                ]}
              >
                {predictions[fixture.id].total_score} pts
              </Text>
            </View>
          )}
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
            style={[
              styles.scoreInput,
              selectedGameweek > currentGameweek && styles.scoreInputDisabled,
            ]}
            value={predictions[fixture.id]?.homeScore || ""}
            onChangeText={(text) =>
              handlePredictionChange(fixture.id, "home", text)
            }
            placeholder="0"
            placeholderTextColor="#6c757d"
            keyboardType="numeric"
            maxLength={2}
            selectTextOnFocus={selectedGameweek <= currentGameweek}
            editable={selectedGameweek <= currentGameweek}
            pointerEvents={
              selectedGameweek <= currentGameweek ? "auto" : "none"
            }
          />
        </View>

        {/* VS */}
        <View style={styles.vsContainer}>
          <Text style={styles.vsText}>-</Text>
        </View>

        {/* Away Team */}
        <View style={styles.awayTeamSection}>
          <TextInput
            style={[
              styles.scoreInput,
              selectedGameweek > currentGameweek && styles.scoreInputDisabled,
            ]}
            value={predictions[fixture.id]?.awayScore || ""}
            onChangeText={(text) =>
              handlePredictionChange(fixture.id, "away", text)
            }
            placeholder="0"
            placeholderTextColor="#6c757d"
            keyboardType="numeric"
            maxLength={2}
            selectTextOnFocus={selectedGameweek <= currentGameweek}
            editable={selectedGameweek <= currentGameweek}
            pointerEvents={
              selectedGameweek <= currentGameweek ? "auto" : "none"
            }
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
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Ultimate FPL</Text>
              <Text style={styles.headerSubtitle}>
                Gameweek {selectedGameweek} Predictions
              </Text>
            </View>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        <GameweekSelector
          selectedGameweek={selectedGameweek}
          currentGameweek={currentGameweek}
          onGameweekChange={handleGameweekChange}
        />

        {(loading || teamsLoading || loadingPredictions) && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007bff" />
            <Text style={styles.loadingText}>
              {loadingPredictions
                ? "Loading predictions..."
                : "Loading fixtures..."}
            </Text>
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={fetchCurrentGameweekAndFixtures}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading &&
          !teamsLoading &&
          !loadingPredictions &&
          !error &&
          fixtures.length > 0 && (
            <View style={styles.content}>
              <View style={styles.sectionTitleContainer}>
                <Text style={styles.sectionTitle}>
                  Gameweek {selectedGameweek}
                  {currentGameweek === selectedGameweek && (
                    <Text style={styles.currentIndicator}> (Current)</Text>
                  )}
                </Text>
                {selectedGameweek < currentGameweek &&
                  gameweekScores.hasScores && (
                    <Text style={styles.gameweekTotalScore}>
                      Total: {gameweekScores.totalScore} pts
                    </Text>
                  )}
              </View>

              {Object.keys(predictions).length > 0 &&
                selectedGameweek <= currentGameweek && (
                  <View style={styles.predictionStatus}>
                    <Text style={styles.predictionStatusText}>
                      ✓ Existing predictions loaded - you can update them below
                    </Text>
                  </View>
                )}

              {selectedGameweek > currentGameweek && (
                <View style={styles.futureGameweekInfo}>
                  <Text style={styles.futureGameweekInfoText}>
                    📅 This is a future gameweek - predictions will be enabled
                    closer to the start date
                  </Text>
                </View>
              )}

              {fixtures.map(renderFixtureCard)}

              {selectedGameweek <= currentGameweek && (
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
                    <Text style={styles.submitButtonText}>
                      Submit Predictions
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

        {!loading &&
          !teamsLoading &&
          !loadingPredictions &&
          !error &&
          fixtures.length === 0 && (
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
    fontSize: 18,
    fontWeight: "600",
    color: "#212529",
  },
  sectionTitleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  gameweekTotalScore: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#28a745",
    backgroundColor: "#e8f5e8",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#c3e6cb",
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
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  fixtureScoreContainer: {
    backgroundColor: "#e8f5e8",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c3e6cb",
  },
  fixtureScoreText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#155724",
  },
  zeroScoreContainer: {
    backgroundColor: "#f8d7da",
    borderColor: "#dc3545",
    borderWidth: 2,
  },
  zeroScoreText: {
    color: "#dc3545",
    fontWeight: "bold",
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
  scoreInputDisabled: {
    backgroundColor: "#e9ecef",
    borderColor: "#ced4da",
    color: "#6c757d",
    opacity: 0.6,
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
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logoutButton: {
    backgroundColor: "#dc3545",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  logoutButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  currentIndicator: {
    color: "#28a745",
    fontSize: 16,
    fontWeight: "bold",
  },
  predictionStatus: {
    backgroundColor: "#d4edda",
    borderWidth: 1,
    borderColor: "#c3e6cb",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  predictionStatusText: {
    color: "#155724",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  futureGameweekNotice: {
    backgroundColor: "#fff3cd",
    borderWidth: 1,
    borderColor: "#ffeaa7",
    borderRadius: 8,
    padding: 16,
    marginTop: 20,
    alignItems: "center",
  },
  futureGameweekNoticeText: {
    color: "#856404",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
  },
  futureGameweekInfo: {
    backgroundColor: "#e7f3ff",
    borderWidth: 1,
    borderColor: "#b8daff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  futureGameweekInfoText: {
    color: "#004085",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
  },
});

export default Home;
