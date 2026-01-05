import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  FlatList,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { authAPI } from "../utils/api";
import { useTeams } from "../hooks/useTeams";

type RootStackParamList = {
  login: undefined;
  signup: undefined;
  main: undefined;
};

type SignupScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "signup"
>;

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [favoriteTeamId, setFavoriteTeamId] = useState<string>("");
  const [showTeamPicker, setShowTeamPicker] = useState(false);

  const navigation = useNavigation<SignupScreenNavigationProp>();
  const { teams, loading: teamsLoading, getTeamById } = useTeams();

  const handleSignup = async () => {
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    if (!favoriteTeamId) {
      Alert.alert("Error", "Please select your favorite team");
      return;
    }

    try {
      const response = await authAPI.signup(
        email,
        password,
        displayName,
        favoriteTeamId
      );

      console.log("Signup successful:", response);

      if (response.success) {
        // Navigate to main app after successful signup
        navigation.navigate("main");
      } else {
        Alert.alert(
          "Signup Failed",
          response.error || "Failed to create account"
        );
      }
    } catch (error) {
      console.error("Error signing up:", error);
      Alert.alert("Signup Error", "Network error occurred. Please try again.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create an Account</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Display Name (optional)"
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      {/* Favorite Team Selection */}
      <TouchableOpacity
        style={styles.teamSelector}
        onPress={() => setShowTeamPicker(true)}
      >
        <Text style={styles.teamSelectorText}>
          {favoriteTeamId && getTeamById(favoriteTeamId)
            ? `Favorite Team: ${getTeamById(favoriteTeamId)?.displayName}`
            : "Select your favorite team"}
        </Text>
        <Text style={styles.teamSelectorArrow}>▼</Text>
      </TouchableOpacity>

      {/* Team Selection Modal */}
      <Modal
        visible={showTeamPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTeamPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Your Favorite Team</Text>
            <FlatList
              data={Object.entries(teams)}
              keyExtractor={([teamId]) => teamId}
              renderItem={({ item: [teamId, team] }) => (
                <TouchableOpacity
                  style={styles.teamOption}
                  onPress={() => {
                    setFavoriteTeamId(teamId);
                    setShowTeamPicker(false);
                  }}
                >
                  <Text style={styles.teamOptionText}>{team.displayName}</Text>
                </TouchableOpacity>
              )}
              style={styles.teamList}
            />
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowTeamPicker(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Button title="Sign Up" onPress={handleSignup} />
      <TouchableOpacity onPress={() => navigation.navigate("login")}>
        {/* Updated navigation path */}
        <Text style={styles.link}>Already have an account? Log in</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 24,
    color: "#333",
  },
  input: {
    width: "80%",
    height: 50,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  teamSelector: {
    width: "80%",
    height: 50,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  teamSelectorText: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  teamSelectorArrow: {
    fontSize: 16,
    color: "#666",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    width: "90%",
    maxHeight: "70%",
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 20,
  },
  teamList: {
    maxHeight: 300,
  },
  teamOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  teamOptionText: {
    fontSize: 16,
    color: "#333",
  },
  cancelButton: {
    backgroundColor: "#6c757d",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  link: {
    marginTop: 16,
    color: "#007BFF",
    textDecorationLine: "underline",
  },
});

export default Signup;
