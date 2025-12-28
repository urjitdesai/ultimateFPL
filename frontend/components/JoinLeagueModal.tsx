import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { leaguesAPI } from "../utils/api";

interface JoinLeagueModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void; // Called when league is joined successfully
}

const JoinLeagueModal: React.FC<JoinLeagueModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [leagueCode, setLeagueCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoinLeague = async () => {
    if (!leagueCode.trim()) {
      Alert.alert("Error", "Please enter a league code");
      return;
    }

    try {
      setLoading(true);
      const response = await leaguesAPI.joinLeague(
        leagueCode.trim().toUpperCase()
      );

      if (response.success) {
        handleClose();
        Alert.alert(
          "Success!",
          `You've successfully joined ${response.league.name}!`,
          [
            {
              text: "OK",
              onPress: onSuccess,
            },
          ]
        );
      }
    } catch (error: any) {
      console.error("Error joining league:", error);

      let errorMessage = "Failed to join league";
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }

      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setLeagueCode("");
    setLoading(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Join a League</Text>
          <Text style={styles.modalSubtitle}>
            Enter the league code to join an existing league
          </Text>

          <TextInput
            style={styles.modalInput}
            placeholder="Enter league code (e.g., ABC123)"
            value={leagueCode}
            onChangeText={setLeagueCode}
            autoCapitalize="characters"
            maxLength={6}
            autoFocus={true}
          />

          <View style={styles.modalButtonContainer}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalButton,
                styles.joinButton,
                (!leagueCode.trim() || loading) && styles.joinButtonDisabled,
              ]}
              onPress={handleJoinLeague}
              disabled={!leagueCode.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.joinButtonText}>Join</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    margin: 20,
    width: "90%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#212529",
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 16,
    color: "#6c757d",
    marginBottom: 20,
    textAlign: "center",
    lineHeight: 22,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#dee2e6",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#f8f9fa",
    marginBottom: 24,
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#6c757d",
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  joinButton: {
    backgroundColor: "#007bff",
  },
  joinButtonDisabled: {
    backgroundColor: "#6c757d",
    opacity: 0.6,
  },
  joinButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default JoinLeagueModal;
