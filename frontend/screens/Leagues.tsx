import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
} from "react-native";
import {
  SafeAreaView,
  SafeAreaProvider,
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
interface League {
  id: string;
  name: string;
  type: "public" | "private";
  members: number;
  rank: number;
}

const Leagues = () => {
  const [activeTab, setActiveTab] = useState<"joined" | "available">("joined");

  useEffect(() => {
    return () => {};
  }, []);

  const joinedLeagues: League[] = [
    // {
    //   id: "1",
    //   name: "Premier League Legends",
    //   type: "public",
    //   members: 1250,
    //   rank: 42,
    // },
    // {
    //   id: "2",
    //   name: "Friends & Family",
    //   type: "private",
    //   members: 12,
    //   rank: 3,
    // },
    // {
    //   id: "3",
    //   name: "Office Champions",
    //   type: "private",
    //   members: 28,
    //   rank: 8,
    // },
  ];

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
        {activeTab === "joined"
          ? joinedLeagues.map(renderLeagueCard)
          : availableLeagues.map(renderLeagueCard)}
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
});

export default Leagues;
