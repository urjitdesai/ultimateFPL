import React, { useRef, useEffect, useState } from "react";
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
  const [currentScrollPosition, setCurrentScrollPosition] = useState(0);
  const [containerWidth, setContainerWidth] = useState(300);

  // Auto-scroll to selected gameweek when it changes (only if not in view)
  useEffect(() => {
    const scrollToSelected = () => {
      if (scrollViewRef.current) {
        // Calculate the x position for the selected gameweek
        const buttonWidth = 72; // Approximate width including margin
        const selectedIndex = selectedGameweek - 1;
        const selectedButtonPosition = selectedIndex * buttonWidth;

        // Check if the selected button is currently visible
        const leftBoundary = currentScrollPosition;
        const rightBoundary = currentScrollPosition + containerWidth;
        const buttonLeftEdge = selectedButtonPosition;
        const buttonRightEdge = selectedButtonPosition + buttonWidth;

        // Only scroll if the button is not fully visible
        const isButtonVisible =
          buttonLeftEdge >= leftBoundary && buttonRightEdge <= rightBoundary;

        if (!isButtonVisible) {
          // Calculate optimal scroll position to center the selected gameweek
          const scrollPosition =
            selectedButtonPosition - containerWidth / 2 + buttonWidth / 2;

          scrollViewRef.current.scrollTo({
            x: Math.max(0, scrollPosition),
            animated: true,
          });
        }
      }
    };

    // Small delay to ensure component is rendered
    const timeoutId = setTimeout(scrollToSelected, 100);

    return () => clearTimeout(timeoutId);
  }, [selectedGameweek, currentScrollPosition, containerWidth]);

  return (
    <View style={styles.gameweekSelector}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.gameweekScroll}
        onScroll={(event) => {
          setCurrentScrollPosition(event.nativeEvent.contentOffset.x);
        }}
        onLayout={(event) => {
          setContainerWidth(event.nativeEvent.layout.width);
        }}
        scrollEventThrottle={16}
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
