import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { Platform } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";

// Import screen components
import Home from "../screens/Home";
import Leagues from "../screens/Leagues";
import Fixtures from "../screens/Fixtures";

const Tab = createBottomTabNavigator();

type TabParamList = {
  Home: undefined;
  Leagues: undefined;
  Fixtures: undefined;
};

interface TabBarIconProps {
  focused: boolean;
  color: string;
  size: number;
}

const getTabBarIcon = (routeName: string) => {
  return ({ focused, color, size }: TabBarIconProps) => {
    let iconName: keyof typeof Ionicons.glyphMap;

    switch (routeName) {
      case "Home":
        iconName = focused ? "home" : "home-outline";
        break;
      case "Leagues":
        iconName = focused ? "trophy" : "trophy-outline";
        break;
      case "Fixtures":
        iconName = focused ? "calendar" : "calendar-outline";
        break;
      default:
        iconName = "home-outline";
    }

    return <Ionicons name={iconName} size={size} color={color} />;
  };
};

const MainApp = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: { name: string } }) => ({
        tabBarIcon: getTabBarIcon(route.name),
        tabBarActiveTintColor: "#007bff",
        tabBarInactiveTintColor: "#6c757d",
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopWidth: 1,
          borderTopColor: "#e9ecef",
          paddingBottom: Platform.OS === "ios" ? 20 : 5,
          paddingTop: 5,
          height: Platform.OS === "ios" ? 90 : 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
        tabBarIconStyle: {
          marginBottom: Platform.OS === "ios" ? 0 : 5,
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={Home}
        options={{
          tabBarLabel: "Home",
        }}
      />
      <Tab.Screen
        name="Leagues"
        component={Leagues}
        options={{
          tabBarLabel: "Leagues",
        }}
      />
      <Tab.Screen
        name="Fixtures"
        component={Fixtures}
        options={{
          tabBarLabel: "Fixtures",
        }}
      />
    </Tab.Navigator>
  );
};

export default MainApp;
