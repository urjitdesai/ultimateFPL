import React, { useEffect, useState } from "react";
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

type LoginScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "login"
>;

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigation = useNavigation<LoginScreenNavigationProp>();

  useEffect(() => {
    console.log("backend url= ", process.env.EXPO_PUBLIC_BACKEND_URL);
  }, []);

  const handleLogin = async () => {
    try {
      const response = await authAPI.login(email, password);

      console.log("Login successful:", response);

      if (response.success) {
        // Navigate to main app after successful login
        navigation.navigate("main");
      } else {
        Alert.alert("Login Failed", response.error || "Invalid credentials");
      }
    } catch (error) {
      console.error("Error logging in:", error);
      Alert.alert("Login Error", "Network error occurred. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Back!</Text>
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
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button title="Login" onPress={handleLogin} />
      <TouchableOpacity onPress={() => navigation.navigate("signup")}>
        <Text style={styles.link}>{`Don&apos;t have an account? Sign up`}</Text>
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

export default Login;
