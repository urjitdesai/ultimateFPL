import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  SafeAreaView,
  SafeAreaProvider,
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { leaguesAPI } from "../utils/api";
interface League {
  id: string;
  name: string;
  type: "public" | "private";
  members: number;
  rank: number;
}

const Leagues = () => {
  const [activeTab, setActiveTab] = useState<"joined" | "available">("joined");
  const [joinedLeagues, setJoinedLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's leagues using cookie-based authentication
  const fetchUserLeagues = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await leaguesAPI.getUserLeagues();

      console.log("User leagues response:", response);

      // Handle the new response format
      const leagues = response.success ? response.leagues : response;

      // Transform the data to match our League interface
      const transformedLeagues: League[] = leagues.map((league: any) => ({
        id: league.id,
        name: league.name,
        type: league.is_private ? "private" : "public",
        members: league.members ? league.members.length : 0,
        rank: 0, // TODO: Calculate actual rank based on user's position
      }));
      setJoinedLeagues(transformedLeagues);
    } catch (err) {
      console.error("Error fetching user leagues:", err);
      setError("Failed to load your leagues");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserLeagues();
  }, []);

  const availableLeagues: League[] = [
    {
      id: "4",
      name: "Global Elite",
      type: "public",
      members: 5000,
      rank: 0,
    },
    {
      id: "5",
      name: "Weekend Warriors",
      type: "public",
      members: 2300,
      rank: 0,
    },
  ];

  const renderLeagueCard = (league: League) => (
    <View key={league.id} style={styles.leagueCard}>
      <View style={styles.leagueHeader}>
        <Text style={styles.leagueName}>{league.name}</Text>
        <View
          style={[
            styles.typeTag,
            {
              backgroundColor:
                league.type === "private" ? "#e3f2fd" : "#f3e5f5",
            },
          ]}
        >
          <Text
            style={[
              styles.typeText,
              { color: league.type === "private" ? "#1976d2" : "#7b1fa2" },
            ]}
          >
            {league.type.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.leagueStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Members</Text>
          <Text style={styles.statValue}>
            {league.members.toLocaleString()}
          </Text>
        </View>
        {league.rank > 0 && (
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Your Rank</Text>
            <Text style={styles.statValue}>#{league.rank}</Text>
          </View>
        )}
      </View>

      {activeTab === "available" && (
        <TouchableOpacity style={styles.joinButton}>
          <Text style={styles.joinButtonText}>Join League</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  useEffect(() => {
    return () => {};
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leagues</Text>
        <Text style={styles.headerSubtitle}>
          Compete with friends and rivals
        </Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "joined" && styles.activeTab]}
          onPress={() => setActiveTab("joined")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "joined" && styles.activeTabText,
            ]}
          >
            My Leagues
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "available" && styles.activeTab]}
          onPress={() => setActiveTab("available")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "available" && styles.activeTabText,
            ]}
          >
            Discover
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === "joined" ? (
          <>
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007bff" />
                <Text style={styles.loadingText}>Loading your leagues...</Text>
              </View>
            )}

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={fetchUserLeagues}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {!loading && !error && joinedLeagues.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>No Leagues Joined</Text>
                <Text style={styles.emptyText}>
                  You haven't joined any leagues yet. Tap "Discover" to find
                  leagues to join!
                </Text>
              </View>
            )}

            {!loading && !error && joinedLeagues.map(renderLeagueCard)}
          </>
        ) : (
          availableLeagues.map(renderLeagueCard)
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
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: "center",
  },
  activeTab: {
    backgroundColor: "#007bff",
  },
  tabText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6c757d",
  },
  activeTabText: {
    color: "#fff",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  leagueCard: {
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
  leagueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  leagueName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#212529",
    flex: 1,
  },
  typeTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 12,
  },
  typeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  leagueStats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 14,
    color: "#6c757d",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#212529",
  },
  joinButton: {
    backgroundColor: "#28a745",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  joinButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
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
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#212529",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#6c757d",
    textAlign: "center",
    lineHeight: 24,
  },
});

export default Leagues;
