import React, { useState } from "react";
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
interface Fixture {
  id: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  gameweek: number;
  status: "upcoming" | "live" | "finished";
  homeScore?: number;
  awayScore?: number;
}

const Fixtures = () => {
  const [selectedGameweek, setSelectedGameweek] = useState(1);

  const fixtures: Fixture[] = [
    {
      id: "1",
      homeTeam: "Arsenal",
      awayTeam: "Liverpool",
      date: "2025-10-15",
      time: "15:00",
      gameweek: 1,
      status: "upcoming",
    },
    {
      id: "2",
      homeTeam: "Manchester City",
      awayTeam: "Chelsea",
      date: "2025-10-15",
      time: "17:30",
      gameweek: 1,
      status: "upcoming",
    },
    {
      id: "3",
      homeTeam: "Manchester United",
      awayTeam: "Tottenham",
      date: "2025-10-14",
      time: "14:00",
      gameweek: 1,
      status: "finished",
      homeScore: 2,
      awayScore: 1,
    },
    {
      id: "4",
      homeTeam: "Brighton",
      awayTeam: "Newcastle",
      date: "2025-10-13",
      time: "16:00",
      gameweek: 1,
      status: "finished",
      homeScore: 0,
      awayScore: 3,
    },
  ];

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

  const renderFixtureCard = (fixture: Fixture) => (
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
          <Text style={styles.teamName}>{fixture.homeTeam}</Text>
          {fixture.status === "finished" && (
            <Text style={styles.scoreText}>{fixture.homeScore}</Text>
          )}
        </View>

        <View style={styles.vsContainer}>
          {fixture.status === "finished" ? (
            <Text style={styles.vsText}>-</Text>
          ) : (
            <View>
              <Text style={styles.vsText}>vs</Text>
              <Text style={styles.timeText}>{fixture.time}</Text>
            </View>
          )}
        </View>

        <View style={styles.teamContainer}>
          <Text style={styles.teamName}>{fixture.awayTeam}</Text>
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
              ]}
              onPress={() => setSelectedGameweek(gw)}
            >
              <Text
                style={[
                  styles.gameweekButtonText,
                  selectedGameweek === gw && styles.selectedGameweekButtonText,
                ]}
              >
                GW {gw}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Gameweek {selectedGameweek}</Text>
        {fixtures
          .filter((fixture) => fixture.gameweek === selectedGameweek)
          .map(renderFixtureCard)}
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
});

export default Fixtures;
