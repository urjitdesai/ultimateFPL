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
  Image,
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
      <Image
        source={require("../assets/fulltimepl-2.png")}
        style={styles.logo}
        resizeMode="contain"
      />
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

      {/* Favorite Team Selection - Inline Dropdown */}
      <View style={styles.dropdownWrapper}>
        <TouchableOpacity
          style={styles.teamSelector}
          onPress={() => setShowTeamPicker(!showTeamPicker)}
        >
          <Text
            style={[
              styles.teamSelectorText,
              !favoriteTeamId && styles.placeholderText,
            ]}
          >
            {favoriteTeamId && getTeamById(favoriteTeamId)
              ? getTeamById(favoriteTeamId)?.displayName
              : "Select your favorite team"}
          </Text>
          <Text style={styles.teamSelectorArrow}>
            {showTeamPicker ? "▲" : "▼"}
          </Text>
        </TouchableOpacity>

        {/* Inline Dropdown List */}
        {showTeamPicker && (
          <View style={styles.dropdownContainer}>
            <ScrollView style={styles.dropdownList} nestedScrollEnabled={true}>
              {Object.entries(teams)
                .sort((a, b) =>
                  a[1].displayName.localeCompare(b[1].displayName)
                )
                .map(([teamId, team]) => (
                  <TouchableOpacity
                    key={teamId}
                    style={[
                      styles.dropdownItem,
                      favoriteTeamId === teamId && styles.dropdownItemSelected,
                    ]}
                    onPress={() => {
                      setFavoriteTeamId(teamId);
                      setShowTeamPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        favoriteTeamId === teamId &&
                          styles.dropdownItemTextSelected,
                      ]}
                    >
                      {team.displayName}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        )}
      </View>

      <Button title="Sign Up" onPress={handleSignup} />
      <TouchableOpacity onPress={() => navigation.navigate("login")}>
        {/* Updated navigation path */}
        <Text style={styles.link}>Already have an account? Log in</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  logo: {
    width: 300,
    height: 300,
    alignSelf: "center",
  },
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
  dropdownWrapper: {
    width: "80%",
    marginBottom: 16,
    zIndex: 1000,
  },
  teamSelector: {
    width: "100%",
    height: 50,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
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
  placeholderText: {
    color: "#999",
  },
  teamSelectorArrow: {
    fontSize: 16,
    color: "#666",
  },
  dropdownContainer: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#ccc",
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: "#fff",
    overflow: "hidden",
    zIndex: 1001,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  dropdownList: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  dropdownItemSelected: {
    backgroundColor: "#e8f4fd",
  },
  dropdownItemText: {
    fontSize: 15,
    color: "#333",
  },
  dropdownItemTextSelected: {
    color: "#007BFF",
    fontWeight: "600",
  },
  link: {
    marginTop: 16,
    color: "#007BFF",
    textDecorationLine: "underline",
  },
});

export default Signup;
