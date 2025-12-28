import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { authAPI } from "../utils/api";

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
  const navigation = useNavigation<SignupScreenNavigationProp>();

  const handleSignup = async () => {
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    try {
      const response = await authAPI.signup(email, password, displayName);

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
    <View style={styles.container}>
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
      <Button title="Sign Up" onPress={handleSignup} />
      <TouchableOpacity onPress={() => navigation.navigate("login")}>
        {/* Updated navigation path */}
        <Text style={styles.link}>Already have an account? Log in</Text>
      </TouchableOpacity>
    </View>
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
  link: {
    marginTop: 16,
    color: "#007BFF",
    textDecorationLine: "underline",
  },
});

export default Signup;
