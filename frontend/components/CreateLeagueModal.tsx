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
import { Ionicons } from "@expo/vector-icons";
import { leaguesAPI } from "../utils/api";

interface CreateLeagueModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void; // Called when league is created successfully
}

const CreateLeagueModal: React.FC<CreateLeagueModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [leagueName, setLeagueName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdLeague, setCreatedLeague] = useState<any>(null);

  const handleCreateLeague = async () => {
    if (!leagueName.trim()) {
      Alert.alert("Error", "Please enter a league name");
      return;
    }

    try {
      setLoading(true);
      const response = await leaguesAPI.createLeague(
        leagueName.trim(),
        "",
        isPrivate
      );

      if (response.success) {
        setCreatedLeague(response.league);
        setShowSuccess(true);
        // Don't close the main modal yet, let success modal handle it
      }
    } catch (error: any) {
      console.error("Error creating league:", error);
      let errorMessage = "Failed to create league";
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setLeagueName("");
    setIsPrivate(false);
    setLoading(false);
    setShowSuccess(false);
    setCreatedLeague(null);
    onClose();
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    handleClose();
    onSuccess();
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Create New League</Text>
            <Text style={styles.modalSubtitle}>
              Enter a name for your league:
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="League name"
              value={leagueName}
              onChangeText={setLeagueName}
              maxLength={50}
              autoFocus={true}
            />

            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setIsPrivate(!isPrivate)}
            >
              <View
                style={[styles.checkbox, isPrivate && styles.checkboxChecked]}
              >
                {isPrivate && (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                )}
              </View>
              <View style={styles.checkboxTextContainer}>
                <Text style={styles.checkboxLabel}>
                  Make this league private
                </Text>
                <Text style={styles.checkboxDescription}>
                  Private leagues require a code to join
                </Text>
              </View>
            </TouchableOpacity>

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
                  styles.createButton,
                  (!leagueName.trim() || loading) &&
                    styles.createButtonDisabled,
                ]}
                onPress={handleCreateLeague}
                disabled={!leagueName.trim() || loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.createButtonText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccess}
        transparent={true}
        animationType="fade"
        onRequestClose={handleSuccessClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModalContainer}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={60} color="#28a745" />
            </View>

            <Text style={styles.successTitle}>League Created!</Text>
            <Text style={styles.successSubtitle}>
              {createdLeague?.name} has been created successfully
            </Text>

            <View style={styles.codeContainer}>
              <Text style={styles.codeLabel}>League Code:</Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeText}>{createdLeague?.leagueCode}</Text>
              </View>
              <Text style={styles.codeDescription}>
                Share this code with others so they can join your league
              </Text>
            </View>

            <TouchableOpacity
              style={styles.successButton}
              onPress={handleSuccessClose}
            >
              <Text style={styles.successButtonText}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
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
  createButton: {
    backgroundColor: "#007bff",
  },
  createButtonDisabled: {
    backgroundColor: "#6c757d",
    opacity: 0.6,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#dee2e6",
    backgroundColor: "#fff",
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#007bff",
    borderColor: "#007bff",
  },
  checkboxLabel: {
    fontSize: 16,
    color: "#212529",
    fontWeight: "500",
    marginBottom: 2,
  },
  checkboxTextContainer: {
    flex: 1,
  },
  checkboxDescription: {
    fontSize: 14,
    color: "#6c757d",
    lineHeight: 18,
  },

  // Success Modal Styles
  successModalContainer: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 30,
    margin: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  successIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#28a745",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  successSubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  codeContainer: {
    width: "100%",
    marginBottom: 20,
  },
  codeLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  codeBox: {
    borderWidth: 2,
    borderColor: "#007bff",
    borderRadius: 8,
    padding: 15,
    backgroundColor: "#f8f9fa",
    alignItems: "center",
    marginBottom: 10,
  },
  codeText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#007bff",
    letterSpacing: 2,
  },
  codeDescription: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  successButton: {
    backgroundColor: "#007bff",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
  },
  successButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
});

export default CreateLeagueModal;
