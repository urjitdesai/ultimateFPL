import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../types/navigation";
import { predictionsAPI, fixturesAPI } from "../utils/api";
import { useTeams } from "../hooks/useTeams";
import LeagueGameweekSelector from "../components/LeagueGameweekSelector";

interface UserPredictionsParams {
  userId: string;
  userName: string;
  initialGameweek?: number;
}

interface PredictionStat {
  identifier: string;
  element: number;
  value: number;
}

interface Prediction {
  id: string;
  fixture_id?: string;
  team_h_score: number;
  team_a_score: number;
  captain?: boolean;
  stats?: PredictionStat[];
  score?: {
    goals_scored: number;
    assists: number;
    correct_scoreline: number;
    correct_result: number;
  };
  total_score?: number;
}

interface FixtureInfo {
  id: string;
  team_h: number;
  team_a: number;
  team_h_score?: number;
  team_a_score?: number;
  kickoff_time?: string;
  finished?: boolean;
  started?: boolean;
}

const UserPredictions: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { userId, userName, initialGameweek } =
    route.params as UserPredictionsParams;

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [fixtures, setFixtures] = useState<Record<string, FixtureInfo>>({});
  const [selectedGameweek, setSelectedGameweek] = useState<number>(
    initialGameweek || 1
  );
  const [currentGameweek, setCurrentGameweek] = useState<number>(1);
  const [availableGameweeks, setAvailableGameweeks] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalScore, setTotalScore] = useState<number>(0);

  const { teams, getTeamById, getTeamLogo, loading: teamsLoading } = useTeams();

  useEffect(() => {
    // Set navigation header
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{userName}'s Predictions</Text>
        </View>
      ),
    });

    fetchCurrentGameweek();
  }, [userName]);

  useEffect(() => {
    if (selectedGameweek && !teamsLoading) {
      fetchPredictions(selectedGameweek);
    }
  }, [selectedGameweek, teamsLoading]);

  const fetchCurrentGameweek = async () => {
    try {
      const response = await fixturesAPI.getCurrentGameweek();
      const current = response.currentGameweek || 20;
      setCurrentGameweek(current);

      // If no initial gameweek was provided, use current
      if (!initialGameweek) {
        setSelectedGameweek(current);
      }

      // Generate available gameweeks (1 to current)
      const gameweeks = Array.from({ length: current }, (_, i) => i + 1);
      setAvailableGameweeks(gameweeks);
    } catch (error) {
      console.error("Error fetching current gameweek:", error);
      // Fallback
      const fallbackGameweeks = Array.from({ length: 38 }, (_, i) => i + 1);
      setAvailableGameweeks(fallbackGameweeks);
    }
  };

  const fetchPredictions = async (gameweek: number) => {
    setLoading(true);
    setError(null);

    try {
      console.log(
        `Fetching predictions for user ${userId}, gameweek ${gameweek}`
      );

      // Fetch predictions for the user
      const predictionsResponse =
        await predictionsAPI.getUserPredictionsByUserId(userId, gameweek);

      console.log("Predictions API response:", predictionsResponse);

      // Fetch fixtures for the gameweek
      const fixturesResponse = await fixturesAPI.getFixturesForGameweek(
        gameweek
      );

      console.log("Fixtures API response:", fixturesResponse);

      // Create a map of fixtures for easy lookup
      const fixturesMap: Record<string, FixtureInfo> = {};
      if (fixturesResponse.fixtures) {
        fixturesResponse.fixtures.forEach((fixture: FixtureInfo) => {
          fixturesMap[fixture.id] = fixture;
        });
      }

      console.log("Fixtures map created with keys:", Object.keys(fixturesMap));

      setFixtures(fixturesMap);

      // The API returns the document directly with a 'predictions' array field
      const predictionsData = predictionsResponse.predictions || [];

      console.log(`Found ${predictionsData.length} predictions`);
      if (predictionsData.length > 0) {
        console.log("First prediction:", predictionsData[0]);
      }

      if (predictionsData.length > 0) {
        setPredictions(predictionsData);

        // Calculate total score
        const total = predictionsData.reduce(
          (sum: number, pred: Prediction) => sum + (pred.total_score || 0),
          0
        );
        setTotalScore(total);
      } else {
        setPredictions([]);
        setTotalScore(0);
      }
    } catch (err: any) {
      console.error("Error fetching predictions:", err);
      console.error("Error response:", err.response?.data);
      if (err.response?.status === 404) {
        setPredictions([]);
        setTotalScore(0);
        setError("No predictions found for this gameweek");
      } else {
        setError("Failed to load predictions");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPredictions(selectedGameweek);
    setRefreshing(false);
  };

  const handleGameweekChange = (gameweek: number) => {
    setSelectedGameweek(gameweek);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderPredictionCard = (prediction: Prediction) => {
    // Get fixture using either fixture_id or id field
    const fixtureId = prediction.fixture_id || prediction.id;
    const fixture = fixtures[fixtureId];

    // Get team info from the fixture, not the prediction
    const homeTeam = fixture ? getTeamById(fixture.team_h) : null;
    const awayTeam = fixture ? getTeamById(fixture.team_a) : null;
    const isCaptain = prediction.captain;
    const predictionScore = prediction.total_score;

    return (
      <View
        key={prediction.id || prediction.fixture_id}
        style={[styles.fixtureCard, isCaptain && styles.fixtureCardCaptain]}
      >
        {/* Captain Badge */}
        {isCaptain && (
          <View style={styles.captainBadge}>
            <Text style={styles.captainBadgeText}>⭐ CAPTAIN</Text>
          </View>
        )}

        {/* Header with date/time and score */}
        <View style={styles.fixtureHeader}>
          <View style={styles.dateTimeContainer}>
            <Text style={styles.dateText}>
              {formatDate(fixture?.kickoff_time)}
            </Text>
            <Text style={styles.timeText}>
              {formatTime(fixture?.kickoff_time)}
            </Text>
          </View>
          {fixture?.finished && predictionScore !== undefined && (
            <View
              style={[
                styles.fixtureScoreContainer,
                predictionScore === 0 && styles.zeroScoreContainer,
              ]}
            >
              <Text
                style={[
                  styles.fixtureScoreText,
                  predictionScore === 0 && styles.zeroScoreText,
                ]}
              >
                {predictionScore} pts
              </Text>
            </View>
          )}
        </View>

        {/* Match Container */}
        <View style={styles.matchContainer}>
          {/* Home Team */}
          <View style={styles.homeTeamSection}>
            <View style={styles.teamInfo}>
              {fixture?.team_h && getTeamLogo(fixture.team_h) && (
                <Image
                  source={getTeamLogo(fixture.team_h)}
                  style={styles.teamLogo}
                  resizeMode="contain"
                />
              )}
              <Text style={styles.teamName}>
                {homeTeam?.displayName || "Home"}
              </Text>
            </View>
            <View style={styles.scoreInputContainer}>
              <Text style={styles.scoreText}>{prediction.team_h_score}</Text>
              {fixture?.finished && fixture.team_h_score !== undefined && (
                <Text style={styles.actualScoreText}>
                  {fixture.team_h_score}
                </Text>
              )}
            </View>
          </View>

          {/* VS */}
          <View style={styles.vsContainer}>
            <Text style={styles.vsText}>-</Text>
          </View>

          {/* Away Team */}
          <View style={styles.awayTeamSection}>
            <View style={styles.scoreInputContainer}>
              <Text style={styles.scoreText}>{prediction.team_a_score}</Text>
              {fixture?.finished && fixture.team_a_score !== undefined && (
                <Text style={styles.actualScoreText}>
                  {fixture.team_a_score}
                </Text>
              )}
            </View>
            <View style={styles.awayTeamInfo}>
              <Text style={styles.awayTeamName}>
                {awayTeam?.displayName || "Away"}
              </Text>
              {fixture?.team_a && getTeamLogo(fixture.team_a) && (
                <Image
                  source={getTeamLogo(fixture.team_a)}
                  style={styles.teamLogo}
                  resizeMode="contain"
                />
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {/* Gameweek Selector */}
      <LeagueGameweekSelector
        selectedGameweek={selectedGameweek}
        currentGameweek={currentGameweek}
        availableGameweeks={availableGameweeks}
        onGameweekChange={handleGameweekChange}
        loading={false}
      />

      {/* Score Summary */}
      <View style={styles.scoreSummary}>
        <View style={styles.scoreSummaryItem}>
          <Text style={styles.scoreSummaryLabel}>
            Gameweek {selectedGameweek}
          </Text>
          <Text style={styles.scoreSummaryValue}>{totalScore} pts</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{
          paddingBottom: 20,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {(loading || teamsLoading) && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007bff" />
            <Text style={styles.loadingText}>
              {teamsLoading ? "Loading teams..." : "Loading predictions..."}
            </Text>
          </View>
        )}

        {!loading && !teamsLoading && error && predictions.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color="#6c757d" />
            <Text style={styles.emptyText}>{error}</Text>
          </View>
        )}

        {!loading && !teamsLoading && !error && predictions.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color="#6c757d" />
            <Text style={styles.emptyText}>
              No predictions for this gameweek
            </Text>
          </View>
        )}

        {!loading &&
          !teamsLoading &&
          predictions.length > 0 &&
          predictions.map(renderPredictionCard)}

        {/* <View style={styles.bottomPadding} /> */}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    flexBasis: 1,
  },
  headerTitleContainer: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  scoreSummary: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreSummaryItem: {
    alignItems: "center",
    flex: 1,
  },
  scoreSummaryLabel: {
    fontSize: 14,
    color: "#6c757d",
    marginBottom: 4,
  },
  scoreSummaryValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#212529",
  },
  scoreSummaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#e9ecef",
    marginHorizontal: 20,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  // Fixture Card Styles (matching Home page)
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
  fixtureCardCaptain: {
    borderColor: "#ffd700",
    borderWidth: 3,
    shadowColor: "#ffd700",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  captainBadge: {
    position: "absolute",
    top: -8,
    right: 8,
    backgroundColor: "#ffd700",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    zIndex: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  captainBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#856404",
  },
  fixtureHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
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
  scoreInputContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: {
    width: 40,
    height: 32,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#dee2e6",
    borderRadius: 6,
    lineHeight: 30,
    overflow: "hidden",
  },
  actualScoreText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#007bff",
    marginTop: 4,
    textAlign: "center",
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
  // Loading & Empty States
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: "#6c757d",
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: "#6c757d",
    textAlign: "center",
    marginTop: 12,
  },
});

export default UserPredictions;
