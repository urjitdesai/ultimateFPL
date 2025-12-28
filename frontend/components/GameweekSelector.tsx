import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";

interface GameweekSelectorProps {
  selectedGameweek: number;
  currentGameweek: number;
  onGameweekChange: (gameweek: number) => void;
}

const GameweekSelector: React.FC<GameweekSelectorProps> = ({
  selectedGameweek,
  currentGameweek,
  onGameweekChange,
}) => {
  return (
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
            onPress={() => onGameweekChange(gw)}
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
  );
};

const styles = StyleSheet.create({
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
});

export default GameweekSelector;
