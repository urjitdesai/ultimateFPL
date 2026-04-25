import React, { useState, useEffect, useRef } from "react";
import { MaterialIcons } from "@expo/vector-icons";
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
  Animated,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  authAPI,
  fixturesAPI,
  predictionsAPI,
  constantsAPI,
  leaguesAPI,
  h2hAPI,
} from "../utils/api";
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
      correct_result: number;
    };
    total_score?: number;
    scoreBreakdown?: {
      correct_result: boolean;
      correct_home_score: boolean;
      correct_away_score: boolean;
      goals_scored: string[];
      assists: string[];
    };
  };
}

interface GameweekScoreData {
  totalScore: number;
  hasScores: boolean;
}

interface User {
  id: string;
  email: string;
  display_name: string;
  favorite_team_id?: string;
}

const Home = () => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [currentGameweek, setCurrentGameweek] = useState<number>(0);
  const [selectedGameweek, setSelectedGameweek] = useState<number>(0);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [fixtures, setFixtures] = useState<FixtureData[]>([]);
  const [predictions, setPredictions] = useState<PredictionData>({});
  const [captainFixture, setCaptainFixture] = useState<string | null>(null);
  const [gameweekScores, setGameweekScores] = useState<GameweekScoreData>({
    totalScore: 0,
    hasScores: false,
  });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [hasExistingPredictions, setHasExistingPredictions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [showScoringModal, setShowScoringModal] = useState(false);
  const [scoringRules, setScoringRules] = useState<any>(null);
  const [scoringLoading, setScoringLoading] = useState(false);
  const [scoringError, setScoringError] = useState<string | null>(null);
  // H2H wager state
  const [h2hLeagues, setH2HLeagues] = useState<any[]>([]);
  const [h2hWagers, setH2HWagers] = useState<{ [fixtureId: string]: any }>({});
  const [h2hWagersLoading, setH2HWagersLoading] = useState(false);
  const [h2hWagerSummary, setH2HWagerSummary] = useState<{
    [leagueId: string]: { totalWagered: number; remainingCap: number };
  }>({});
  // Per-fixture H2H wager form state: { [fixtureId]: { leagueId, outcome, amount, open } }
  const [h2hWagerForm, setH2HWagerForm] = useState<{
    [fixtureId: string]: {
      leagueId: string;
      outcome: "home" | "draw" | "away" | null;
      amount: number;
      open: boolean;
    };
  }>({});
  const [h2hSubmitting, setH2HSubmitting] = useState<{
    [fixtureId: string]: boolean;
  }>({});
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const { getTeamById, getTeamLogo, loading: teamsLoading } = useTeams();
  const navigation = useNavigation();

  // Show toast message with fade animation
  const showToast = (
    message: string,
    type: "success" | "error" = "success",
    duration: number = 3000,
  ) => {
    setToastMessage(message);
    setToastType(type);
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(duration),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setToastMessage(null));
  };

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

  // Get user data from stored data
  const getUserData = () => {
    const userData = authAPI.getUser();
    if (userData) {
      setUser(userData as User);
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
        },
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
    setHasExistingPredictions(false);
    try {
      const response = await predictionsAPI.getUserPredictions(gameweek);

      // Transform predictions to match our state structure
      const predictionsMap: PredictionData = {};
      let hasCalculatedScores = false;
      let foundCaptain: string | null = null;

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

            // Check if this prediction is captain
            if (prediction.captain) {
              foundCaptain = fixtureId;
            }
          }
        });
      }

      // Set captain fixture state
      setCaptainFixture(foundCaptain);

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
      // Mark that we have existing predictions from the backend
      if (Object.keys(predictionsMap).length > 0) {
        setHasExistingPredictions(true);
      }
      console.log("User predictions loaded with scores");
    } catch (err) {
      console.error("Error fetching user predictions:", err);
      // If predictions don't exist or error occurs, just clear predictions
      setPredictions({});
      setCaptainFixture(null);
      setHasExistingPredictions(false);
      setGameweekScores({ totalScore: 0, hasScores: false });
    } finally {
      setLoadingPredictions(false);
    }
  };

  // Handle prediction input change
  const handlePredictionChange = (
    fixtureId: string,
    team: "home" | "away",
    score: string,
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

  // Handle captain selection
  const handleCaptainChange = (fixtureId: string) => {
    if (selectedGameweek > currentGameweek) {
      return;
    }

    if (captainFixture === fixtureId) {
      setCaptainFixture(null);
    } else {
      setCaptainFixture(fixtureId);
    }
  };

  // Submit predictions to backend
  const submitPredictions = async () => {
    setSubmitting(true);
    try {
      // Create predictions for all fixtures, not just ones with scores
      const predictionsArray = fixtures.map((fixture) => ({
        fixtureId: fixture.id,
        homeScore: parseInt(predictions[fixture.id]?.homeScore || "0"),
        awayScore: parseInt(predictions[fixture.id]?.awayScore || "0"),
        captain: captainFixture === fixture.id, // Determine captain at submission time
        gameweek: selectedGameweek,
      }));

      const response = await predictionsAPI.submitPredictions(
        predictionsArray,
        selectedGameweek,
      );

      showToast("✓ Predictions submitted successfully!", "success");
      console.log("Predictions submitted:", response);
    } catch (err) {
      console.error("Error submitting predictions:", err);
      showToast("✗ Failed to submit predictions. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const getCurrentGameweek = async () => {
    try {
      const response = await fixturesAPI.getCurrentGameweek();
      const newGameweek = response.currentGameweek;
      setCurrentGameweek(newGameweek);
      if (response.deadline) {
        setDeadline(response.deadline);
      }
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
    setCaptainFixture(null);
    setHasExistingPredictions(false);

    if (!teamsLoading && getTeamById(1)) {
      fetchFixturesForGameweek(gameweek);
      fetchUserPredictions(gameweek);
      // if (captainFixture == null) {
      //   setCaptainFixture(user?.favorite_team_id || null);
      // }
    }
  };

  // Load current gameweek and fixtures when component mounts and teams are loaded
  useEffect(() => {
    if (!teamsLoading && getTeamById(1)) {
      fetchCurrentGameweekAndFixtures();
    }
  }, [teamsLoading]);

  // Get user data when component mounts
  useEffect(() => {
    getUserData();
    fetchH2HLeagues();
  }, []);

  // Fetch H2H wagers when gameweek or h2h leagues change
  useEffect(() => {
    if (selectedGameweek && h2hLeagues.length > 0) {
      fetchH2HWagersForGameweek(selectedGameweek);
    }
  }, [selectedGameweek, h2hLeagues.length]);

  // Fetch fixtures when current gameweek changes and teams are loaded
  useEffect(() => {
    if (currentGameweek && !teamsLoading && getTeamById(1)) {
      fetchFixturesForGameweek(currentGameweek);
    }
  }, [currentGameweek, teamsLoading]);

  // Fetch scoring rules from backend
  const fetchScoringRules = async () => {
    setScoringLoading(true);
    setScoringError(null);
    try {
      const data = await constantsAPI.getScoringRules();
      if (data.success) {
        setScoringRules(data.data);
      } else {
        setScoringError("Failed to load scoring rules");
      }
    } catch (err) {
      setScoringError("Failed to load scoring rules");
    } finally {
      setScoringLoading(false);
    }
  };

  // Fetch user's H2H leagues
  const fetchH2HLeagues = async () => {
    try {
      const response = await leaguesAPI.getUserLeagues();
      const leagues = response.success ? response.leagues : [];
      const h2h = leagues.filter((l: any) => l.leagueType === "h2h");
      setH2HLeagues(h2h);
      // Pre-select first H2H league in each fixture form
      if (h2h.length > 0) {
        // initialise wager forms lazily per fixture
      }
    } catch (err) {
      // Silently fail - H2H is optional
    }
  };

  // Fetch existing H2H wagers for the current gameweek across all H2H leagues
  const fetchH2HWagersForGameweek = async (gameweek: number) => {
    if (h2hLeagues.length === 0) return;
    setH2HWagersLoading(true);
    try {
      const summaries: { [leagueId: string]: any } = {};
      const wagersByFixture: { [fixtureId: string]: any } = {};

      await Promise.all(
        h2hLeagues.map(async (league: any) => {
          try {
            const data = await h2hAPI.getMyWagersForGameweek(
              league.id,
              gameweek,
            );
            summaries[league.id] = {
              totalWagered: data.totalWagered || 0,
              remainingCap: data.remainingCap ?? 100,
            };
            (data.wagers || []).forEach((wager: any) => {
              const key = `${league.id}_${wager.fixtureId}`;
              wagersByFixture[key] = wager;
            });
          } catch {
            // League may have no wagers
          }
        }),
      );

      setH2HWagerSummary(summaries);
      setH2HWagers(wagersByFixture);
    } catch (err) {
      // Silent fail
    } finally {
      setH2HWagersLoading(false);
    }
  };

  // Open / close wager panel for a fixture
  const toggleH2HPanel = (fixtureId: string) => {
    const defaultLeague = h2hLeagues[0]?.id || "";
    setH2HWagerForm((prev) => ({
      ...prev,
      [fixtureId]: prev[fixtureId]
        ? { ...prev[fixtureId], open: !prev[fixtureId].open }
        : { leagueId: defaultLeague, outcome: null, amount: 10, open: true },
    }));
  };

  // Submit an H2H wager
  const submitH2HWager = async (fixtureId: string) => {
    const form = h2hWagerForm[fixtureId];
    if (!form || !form.outcome || !form.leagueId) {
      showToast("Please select a league and outcome.", "error");
      return;
    }
    setH2HSubmitting((prev) => ({ ...prev, [fixtureId]: true }));
    try {
      await h2hAPI.placeWager(
        form.leagueId,
        Number(fixtureId),
        selectedGameweek,
        form.outcome,
        form.amount,
      );
      showToast("✓ H2H wager placed!", "success");
      // Refresh wager data
      await fetchH2HWagersForGameweek(selectedGameweek);
      // Close the panel
      setH2HWagerForm((prev) => ({
        ...prev,
        [fixtureId]: { ...prev[fixtureId], open: false },
      }));
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Failed to place wager.";
      showToast(`✗ ${msg}`, "error");
    } finally {
      setH2HSubmitting((prev) => ({ ...prev, [fixtureId]: false }));
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

  const formatDeadline = (deadlineString: string) => {
    const deadlineDate = new Date(deadlineString);
    const now = new Date();
    const diffMs = deadlineDate.getTime() - now.getTime();

    if (diffMs <= 0) {
      return "Deadline passed";
    }

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(
      (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    const dateStr = deadlineDate.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    if (diffDays > 0) {
      return `${dateStr} (${diffDays}d ${diffHours}h)`;
    } else if (diffHours > 0) {
      return `${dateStr} (${diffHours}h ${diffMins}m)`;
    } else {
      return `${dateStr} (${diffMins}m)`;
    }
  };

  const renderFixtureCard = (fixture: FixtureData) => (
    <View key={fixture.id}>
      <View
        style={[
          styles.fixtureCard,
          captainFixture === fixture.id && styles.fixtureCardCaptain,
        ]}
      >
        {/* Captain Toggle - Show when scores can be edited */}
        {selectedGameweek <= currentGameweek && (
          <TouchableOpacity
            style={[
              styles.captainToggle,
              captainFixture === fixture.id && {
                backgroundColor: "#ffd700",
                borderColor: "#ffd700",
              },
            ]}
            onPress={() => handleCaptainChange(fixture.id)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.captainToggleText,
                captainFixture === fixture.id &&
                  styles.captainToggleTextSelected,
              ]}
            >
              {captainFixture === fixture.id ? "⭐" : "C"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Captain Badge */}
        {captainFixture === fixture.id && (
          <View style={styles.captainBadge}>
            <Text style={styles.captainBadgeText}>⭐ CAPTAIN</Text>
          </View>
        )}

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

        <View style={styles.matchWrapper}>
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
              <View style={styles.scoreInputContainer}>
                <TextInput
                  style={[
                    styles.scoreInput,
                    selectedGameweek > currentGameweek &&
                      styles.scoreInputDisabled,
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
            </View>

            {/* VS */}
            <View style={styles.vsContainer}>
              <Text style={styles.vsText}>-</Text>
            </View>

            {/* Away Team */}
            <View style={styles.awayTeamSection}>
              <View style={styles.scoreInputContainer}>
                <TextInput
                  style={[
                    styles.scoreInput,
                    selectedGameweek > currentGameweek &&
                      styles.scoreInputDisabled,
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
              </View>
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
          {selectedGameweek < currentGameweek &&
            fixture.homeScore !== undefined &&
            fixture.homeScore !== null && (
              <View style={styles.actualScoresSection}>
                <Text style={styles.actualScoreText}>{fixture.homeScore}</Text>
                <Text
                  style={[
                    styles.actualScoreText,
                    { marginLeft: 30, marginRight: 30 },
                  ]}
                >
                  {" "}
                  -{" "}
                </Text>
                <Text style={styles.actualScoreText}>{fixture.awayScore}</Text>
              </View>
            )}
        </View>

        {/* H2H Wager Panel - only for current gameweek, only if in H2H leagues */}
        {selectedGameweek === currentGameweek &&
          h2hLeagues.length > 0 &&
          !fixture.started &&
          !fixture.finished &&
          (() => {
            const form = h2hWagerForm[fixture.id];
            const activeLeagueId = form?.leagueId || h2hLeagues[0]?.id;
            const existingWager = h2hWagers[`${activeLeagueId}_${fixture.id}`];
            const cap = h2hWagerSummary[activeLeagueId];

            return (
              <View style={styles.h2hContainer}>
                <TouchableOpacity
                  style={styles.h2hToggleButton}
                  onPress={() => toggleH2HPanel(fixture.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.h2hToggleText}>
                    {existingWager
                      ? `⚔  H2H Wager: ${existingWager.totalAmount} pts (${existingWager.status})`
                      : "⚔  Place H2H Wager"}
                  </Text>
                  <Text style={styles.h2hToggleArrow}>
                    {form?.open ? "▲" : "▼"}
                  </Text>
                </TouchableOpacity>

                {form?.open && (
                  <View style={styles.h2hPanel}>
                    {/* League selector (if multiple H2H leagues) */}
                    {h2hLeagues.length > 1 && (
                      <View style={styles.h2hLabelRow}>
                        <Text style={styles.h2hLabel}>League:</Text>
                        <View style={styles.h2hLeagueRow}>
                          {h2hLeagues.map((league: any) => (
                            <TouchableOpacity
                              key={league.id}
                              style={[
                                styles.h2hLeagueChip,
                                form.leagueId === league.id &&
                                  styles.h2hLeagueChipActive,
                              ]}
                              onPress={() =>
                                setH2HWagerForm((prev) => ({
                                  ...prev,
                                  [fixture.id]: {
                                    ...prev[fixture.id],
                                    leagueId: league.id,
                                  },
                                }))
                              }
                            >
                              <Text
                                style={[
                                  styles.h2hLeagueChipText,
                                  form.leagueId === league.id &&
                                    styles.h2hLeagueChipTextActive,
                                ]}
                              >
                                {league.name}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Outcome buttons */}
                    <Text style={styles.h2hLabel}>Predict outcome:</Text>
                    <View style={styles.h2hOutcomeRow}>
                      {(["home", "draw", "away"] as const).map((o) => (
                        <TouchableOpacity
                          key={o}
                          style={[
                            styles.h2hOutcomeBtn,
                            form?.outcome === o && styles.h2hOutcomeBtnActive,
                          ]}
                          onPress={() =>
                            setH2HWagerForm((prev) => ({
                              ...prev,
                              [fixture.id]: { ...prev[fixture.id], outcome: o },
                            }))
                          }
                        >
                          <Text
                            style={[
                              styles.h2hOutcomeText,
                              form?.outcome === o &&
                                styles.h2hOutcomeTextActive,
                            ]}
                          >
                            {o === "home"
                              ? fixture.homeTeam
                              : o === "away"
                                ? fixture.awayTeam
                                : "Draw"}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Amount stepper */}
                    <Text style={styles.h2hLabel}>
                      Wager amount (10–100 pts):
                    </Text>
                    <View style={styles.h2hAmountRow}>
                      <TouchableOpacity
                        style={styles.h2hStepBtn}
                        onPress={() =>
                          setH2HWagerForm((prev) => ({
                            ...prev,
                            [fixture.id]: {
                              ...prev[fixture.id],
                              amount: Math.max(
                                10,
                                (prev[fixture.id]?.amount || 10) - 10,
                              ),
                            },
                          }))
                        }
                      >
                        <Text style={styles.h2hStepText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.h2hAmountText}>
                        {form?.amount || 10} pts
                      </Text>
                      <TouchableOpacity
                        style={styles.h2hStepBtn}
                        onPress={() => {
                          const currentAmount = form?.amount || 10;
                          const remaining = cap?.remainingCap ?? 100;
                          const maxAllowed = Math.min(
                            100,
                            currentAmount + remaining,
                          );
                          setH2HWagerForm((prev) => ({
                            ...prev,
                            [fixture.id]: {
                              ...prev[fixture.id],
                              amount: Math.min(maxAllowed, currentAmount + 10),
                            },
                          }));
                        }}
                      >
                        <Text style={styles.h2hStepText}>+</Text>
                      </TouchableOpacity>
                    </View>

                    {cap && (
                      <Text style={styles.h2hCapText}>
                        Gameweek cap: {cap.totalWagered}/100 pts used •{" "}
                        {cap.remainingCap} pts remaining
                      </Text>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.h2hSubmitBtn,
                        (!form?.outcome || h2hSubmitting[fixture.id]) &&
                          styles.h2hSubmitBtnDisabled,
                      ]}
                      onPress={() => submitH2HWager(fixture.id)}
                      disabled={!form?.outcome || !!h2hSubmitting[fixture.id]}
                    >
                      {h2hSubmitting[fixture.id] ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.h2hSubmitText}>
                          {existingWager ? "Update Wager" : "Place Wager"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })()}
      </View>
    </View>
  );
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLogoRow}>
            <Image
              source={require("../assets/fulltimepl-2.png")}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.headerTitle}>Fulltime PL</Text>
              <Text style={styles.headerSubtitle}>
                Gameweek {selectedGameweek} Predictions
              </Text>
            </View>
          </View>
          <View style={styles.headerRightRow}>
            {selectedGameweek === currentGameweek && (
              <TouchableOpacity
                style={styles.scoringInfoButton}
                onPress={() => {
                  setShowScoringModal(true);
                  if (!scoringRules && !scoringLoading) fetchScoringRules();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.scoringInfoText}>How do we score?</Text>
              </TouchableOpacity>
            )}
            <View style={styles.userSection}>
              {user && (
                <View style={styles.userMenuWrapper}>
                  <TouchableOpacity
                    onPress={() => setShowUserMenu((v) => !v)}
                    activeOpacity={0.7}
                    style={styles.displayNameMenuRow}
                  >
                    <Text style={styles.displayName}>
                      {user.display_name || user.email || "User"}
                    </Text>
                    <MaterialIcons
                      name="arrow-drop-down"
                      size={22}
                      color="#333"
                      style={styles.menuArrowIcon}
                    />
                  </TouchableOpacity>
                  {showUserMenu && (
                    <View style={styles.userMenuDropdown}>
                      <TouchableOpacity
                        style={styles.userMenuItem}
                        onPress={() => {
                          setShowUserMenu(false);
                          handleLogout();
                        }}
                      >
                        <Text style={styles.userMenuItemText}>Logout</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
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
          <ScrollView
            style={styles.fixtureScrollView}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.content}>
              <View style={styles.sectionTitleContainer}>
                <View style={styles.gameweekTitleRow}>
                  <Text style={styles.sectionTitle}>
                    Gameweek {selectedGameweek}
                    {currentGameweek === selectedGameweek && (
                      <Text style={styles.currentIndicator}> (Current)</Text>
                    )}
                  </Text>
                  {/* Deadline display for current gameweek - inline */}
                  {selectedGameweek === currentGameweek && deadline && (
                    <Text style={styles.deadlineInline}>
                      ⏰ Deadline: {formatDeadline(deadline)}
                    </Text>
                  )}
                </View>
                {selectedGameweek < currentGameweek &&
                  gameweekScores.hasScores && (
                    <Text style={styles.gameweekTotalScore}>
                      Total: {gameweekScores.totalScore} pts
                    </Text>
                  )}
              </View>

              {hasExistingPredictions &&
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
          </ScrollView>
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

      {/* Toast Message */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.toast,
            toastType === "error" ? styles.toastError : styles.toastSuccess,
            { opacity: toastOpacity },
          ]}
        >
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
      {/* Scoring Modal */}
      <Modal
        visible={showScoringModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowScoringModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>How do we score?</Text>
            {scoringLoading ? (
              <ActivityIndicator size="large" color="#007bff" />
            ) : scoringError ? (
              <Text style={styles.modalError}>{scoringError}</Text>
            ) : scoringRules ? (
              <View style={styles.scoringList}>
                <Text style={styles.scoringItem}>
                  <Text style={styles.scoringLabel}>Correct Result:</Text>{" "}
                  {scoringRules.correct_result} pts
                </Text>
                <Text style={styles.scoringItem}>
                  <Text style={styles.scoringLabel}>Correct Scoreline:</Text>{" "}
                  {scoringRules.correct_scoreline} pts
                </Text>
                <Text style={styles.scoringItem}>
                  <Text style={styles.scoringLabel}>Goals Scored:</Text>{" "}
                  {scoringRules.goals_scored} pts
                </Text>
                <Text style={styles.scoringItem}>
                  <Text style={styles.scoringLabel}>Assists:</Text>{" "}
                  {scoringRules.assists} pts
                </Text>
              </View>
            ) : (
              <Text style={styles.modalError}>No scoring rules found.</Text>
            )}
            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowScoringModal(false)}
            >
              <Text style={styles.closeModalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  headerLogoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  headerLogo: {
    width: 80,
    height: 80,
    marginRight: 16,
  },
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollContent: {
    flexGrow: 1,
  },
  fixtureScrollView: {
    flex: 1,
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
    flexWrap: "wrap",
  },
  gameweekTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  deadlineInline: {
    fontSize: 12,
    color: "#856404",
    backgroundColor: "#fff3cd",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ffc107",
    overflow: "hidden",
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
  matchWrapper: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
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
  actualScoresSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5,
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
  scoreInputContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  actualScoreText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#007bff",
    marginTop: 4,
    textAlign: "center",
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
  userMenuWrapper: {
    position: "relative",
    zIndex: 100,
  },
  userMenuDropdown: {
    position: "absolute",
    top: 36,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e9ecef",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 6,
    minWidth: 120,
  },
  userMenuItem: {
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  userMenuItemText: {
    fontSize: 15,
    color: "#dc3545",
    fontWeight: "500",
  },
  userSection: {
    alignItems: "flex-end",
    gap: 8,
  },
  displayName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  displayNameMenuRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuArrowIcon: {
    marginLeft: 4,
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
  captainToggle: {
    position: "absolute",
    top: -8,
    left: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#dee2e6",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 4,
  },
  captainToggleText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#6c757d",
  },
  captainToggleTextSelected: {
    color: "#856404",
  },
  toast: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  toastSuccess: {
    backgroundColor: "#28a745",
  },
  toastError: {
    backgroundColor: "#dc3545",
  },
  toastText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  headerRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  scoringInfoButton: {
    backgroundColor: "#e7f3ff",
    borderColor: "#b8daff",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  scoringInfoText: {
    color: "#007bff",
    fontWeight: "600",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "80%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 18,
    color: "#007bff",
  },
  scoringList: {
    alignItems: "flex-start",
    marginBottom: 18,
    width: "100%",
  },
  scoringItem: {
    fontSize: 16,
    marginBottom: 10,
    color: "#212529",
  },
  scoringLabel: {
    fontWeight: "bold",
    color: "#007bff",
  },
  modalError: {
    color: "#dc3545",
    fontSize: 16,
    marginBottom: 18,
    textAlign: "center",
  },
  closeModalButton: {
    backgroundColor: "#007bff",
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: 8,
  },
  closeModalButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  // ─── H2H Wager Panel ───────────────────────────────────────────────────────
  h2hContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e9ecef",
    paddingTop: 10,
  },
  h2hToggleButton: {
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
  h2hToggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#e65100",
  },
  h2hToggleArrow: {
    fontSize: 11,
    color: "#e65100",
  },
  h2hPanel: {
    marginTop: 10,
    padding: 12,
    backgroundColor: "#fffbf5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ffe0b2",
  },
  h2hLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6c757d",
    marginBottom: 6,
    marginTop: 4,
  },
  h2hLabelRow: {
    marginBottom: 4,
  },
  h2hLeagueRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  h2hLeagueChip: {
    borderWidth: 1,
    borderColor: "#dee2e6",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#f8f9fa",
  },
  h2hLeagueChipActive: {
    borderColor: "#fd7e14",
    backgroundColor: "#fff3e0",
  },
  h2hLeagueChipText: {
    fontSize: 12,
    color: "#6c757d",
  },
  h2hLeagueChipTextActive: {
    color: "#e65100",
    fontWeight: "600",
  },
  h2hOutcomeRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
  },
  h2hOutcomeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#dee2e6",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  h2hOutcomeBtnActive: {
    borderColor: "#fd7e14",
    backgroundColor: "#fd7e14",
  },
  h2hOutcomeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6c757d",
    textAlign: "center",
  },
  h2hOutcomeTextActive: {
    color: "#fff",
  },
  h2hAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginBottom: 8,
  },
  h2hStepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fd7e14",
    alignItems: "center",
    justifyContent: "center",
  },
  h2hStepText: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "bold",
    lineHeight: 22,
  },
  h2hAmountText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#212529",
    minWidth: 70,
    textAlign: "center",
  },
  h2hCapText: {
    fontSize: 11,
    color: "#6c757d",
    textAlign: "center",
    marginBottom: 10,
  },
  h2hSubmitBtn: {
    backgroundColor: "#fd7e14",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 4,
  },
  h2hSubmitBtnDisabled: {
    backgroundColor: "#adb5bd",
  },
  h2hSubmitText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});

export default Home;
