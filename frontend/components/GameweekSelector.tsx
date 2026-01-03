import React, { useRef, useEffect } from "react";
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
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to selected gameweek when it changes
  useEffect(() => {
    const scrollToSelected = () => {
      if (scrollViewRef.current) {
        // Calculate the x position for the selected gameweek
        // Button width (64px) + margin (8px) + padding (32px total horizontal)
        const buttonWidth = 72; // Approximate width including margin
        const selectedIndex = selectedGameweek - 1;
        const containerWidth = 300; // Approximate visible width
        const scrollPosition =
          selectedIndex * buttonWidth - containerWidth / 2 + buttonWidth / 2;

        scrollViewRef.current.scrollTo({
          x: Math.max(0, scrollPosition),
          animated: true,
        });
      }
    };

    // Small delay to ensure component is rendered
    const timeoutId = setTimeout(scrollToSelected, 100);

    return () => clearTimeout(timeoutId);
  }, [selectedGameweek]);

  return (
    <View style={styles.gameweekSelector}>
      <ScrollView
        ref={scrollViewRef}
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
    backgroundColor: "#f8f9fa", // Keep same background as default
    borderColor: "#007bff",
    borderWidth: 2,
  },
  gameweekButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6c757d",
  },
  selectedGameweekButtonText: {
    color: "#007bff", // Change to blue text instead of white
    fontWeight: "600", // Make it bolder when selected
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
