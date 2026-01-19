import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";

interface LeagueGameweekSelectorProps {
  selectedGameweek: number;
  currentGameweek: number;
  availableGameweeks: number[];
  onGameweekChange: (gameweek: number) => void;
  loading?: boolean;
  minGameweek?: number; // Gameweeks before this will be disabled
}

const LeagueGameweekSelector: React.FC<LeagueGameweekSelectorProps> = ({
  selectedGameweek,
  currentGameweek,
  availableGameweeks,
  onGameweekChange,
  loading = false,
  minGameweek = 1,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to selected gameweek when it changes
  useEffect(() => {
    const scrollToSelected = () => {
      if (scrollViewRef.current && availableGameweeks.length > 0) {
        const selectedIndex = availableGameweeks.findIndex(
          (gw) => gw === selectedGameweek
        );

        if (selectedIndex >= 0) {
          const buttonWidth = 72;
          const containerWidth = 300;
          const scrollPosition =
            selectedIndex * buttonWidth - containerWidth / 2 + buttonWidth / 2;

          scrollViewRef.current.scrollTo({
            x: Math.max(0, scrollPosition),
            animated: true,
          });
        }
      }
    };

    const timeoutId = setTimeout(scrollToSelected, 100);
    return () => clearTimeout(timeoutId);
  }, [selectedGameweek, availableGameweeks]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading gameweeks...</Text>
      </View>
    );
  }

  if (availableGameweeks.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No gameweeks available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {availableGameweeks.map((gw) => {
          const isDisabled = gw < minGameweek;
          return (
            <TouchableOpacity
              key={gw}
              style={[
                styles.gameweekButton,
                selectedGameweek === gw && styles.selectedGameweekButton,
                currentGameweek === gw && styles.currentGameweekButton,
                isDisabled && styles.disabledGameweekButton,
              ]}
              onPress={() => !isDisabled && onGameweekChange(gw)}
              activeOpacity={isDisabled ? 1 : 0.7}
              disabled={isDisabled}
            >
              <Text
                style={[
                  styles.gameweekButtonText,
                  selectedGameweek === gw && styles.selectedGameweekButtonText,
                  currentGameweek === gw && styles.currentGameweekButtonText,
                  isDisabled && styles.disabledGameweekButtonText,
                ]}
              >
                GW {gw}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  loadingText: {
    fontSize: 14,
    color: "#6c757d",
    fontWeight: "500",
  },
  emptyContainer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#6c757d",
  },
  scrollView: {
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingRight: 16,
  },
  gameweekButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#dee2e6",
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  selectedGameweekButton: {
    backgroundColor: "#f8f9fa",
    borderColor: "#007bff",
    borderWidth: 2,
  },
  currentGameweekButton: {
    borderColor: "#28a745",
    borderWidth: 2,
  },
  gameweekButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6c757d",
  },
  selectedGameweekButtonText: {
    color: "#007bff",
    fontWeight: "600",
  },
  currentGameweekButtonText: {
    color: "#28a745",
    fontWeight: "600",
  },
  disabledGameweekButton: {
    backgroundColor: "#e9ecef",
    borderColor: "#dee2e6",
    opacity: 0.5,
  },
  disabledGameweekButtonText: {
    color: "#adb5bd",
  },
});

export default LeagueGameweekSelector;
