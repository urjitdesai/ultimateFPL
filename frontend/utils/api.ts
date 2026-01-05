import axios from "axios";
import { setupAuthInterceptors, tokenStorage } from "./authInterceptor";

// Create axios instance with default configuration
const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_BACKEND_URL,
  timeout: 10000,
});

// Setup auth interceptors
setupAuthInterceptors(api);

// Auth API functions
export const authAPI = {
  // Login user
  login: async (email: string, password: string) => {
    const response = await api.post("/api/users/login", { email, password });

    // Store token from response in localStorage
    if (response.data.success) {
      if (response.data.token) tokenStorage.set(response.data.token);

      if (response.data.user) {
        tokenStorage.setUser(response.data.user);
      }
    }

    return response.data;
  },

  // Register user
  signup: async (
    email: string,
    password: string,
    displayName?: string,
    favoriteTeamId?: string
  ) => {
    const response = await api.post("/api/users/signup", {
      email,
      password,
      displayName,
      favoriteTeamId,
    });

    // Store token from response in localStorage
    if (response.data.success) {
      if (response.data.token) tokenStorage.set(response.data.token);

      if (response.data.user) {
        tokenStorage.setUser(response.data.user);
      }
    }

    return response.data;
  },

  // Logout user
  logout: async () => {
    try {
      // Call the backend logout endpoint
      const response = await api.post("/api/users/logout");
      return response.data;
    } finally {
      // Always clear local token and user data, even if backend call fails
      tokenStorage.remove();
      tokenStorage.removeUser();
    }
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    const token = tokenStorage.get();
    return !!token;
  },

  // Set token manually
  setToken: (token: string) => {
    tokenStorage.set(token);
  },

  // Get current token
  getToken: () => {
    return tokenStorage.get();
  },

  // Clear token
  clearToken: () => {
    tokenStorage.remove();
  },

  // Get stored user data
  getUser: () => {
    return tokenStorage.getUser();
  },

  // Set user data
  setUser: (user: any) => {
    tokenStorage.setUser(user);
  },

  // Clear user data
  clearUser: () => {
    tokenStorage.removeUser();
  },
};

// Leagues API functions
export const leaguesAPI = {
  // Get user's leagues (authenticated)
  getUserLeagues: async () => {
    const response = await api.post("/api/leagues/user-leagues");
    return response.data;
  },

  // Join a league (authenticated)
  joinLeague: async (leagueCode: string) => {
    const response = await api.post("/api/leagues/join", {
      league_code: leagueCode,
    });
    return response.data;
  },

  // Create a league (authenticated)
  createLeague: async (
    name: string,
    description?: string,
    isPrivate: boolean = false
  ) => {
    const response = await api.post("/api/leagues/create", {
      name,
      description,
      is_private: isPrivate,
    });
    return response.data;
  },

  // Get all public leagues
  getAllLeagues: async () => {
    const response = await api.get("/api/leagues");
    return response.data;
  },

  // Get league by ID
  getLeagueById: async (leagueId: string) => {
    const response = await api.get(`/api/leagues/${leagueId}`);
    return response.data;
  },

  // League scores functions
  getLeagueTable: async (leagueId: string, gameweek?: number) => {
    const url = `/api/leagues/${leagueId}/table`;
    const params = gameweek ? { gameweek } : {};
    const response = await api.get(url, { params });
    return response.data;
  },

  getGameweekRankings: async (leagueId: string, gameweek: number) => {
    const response = await api.get(
      `/api/leagues/${leagueId}/gameweek/${gameweek}`
    );
    return response.data;
  },

  getUserLeagueHistory: async (
    leagueId: string,
    userId: string,
    limit?: number
  ) => {
    const url = `/api/leagues/${leagueId}/history/${userId}`;
    const params = limit ? { limit } : {};
    const response = await api.get(url, { params });
    return response.data;
  },

  calculateLeagueScores: async (leagueId: string, gameweek: number) => {
    const response = await api.post(`/api/leagues/${leagueId}/calculate`, {
      gameweek,
    });
    return response.data;
  },

  calculateAllLeagueScores: async (gameweek: number) => {
    const response = await api.post("/api/leagues/calculate-all", { gameweek });
    return response.data;
  },
};

// Fixtures API functions
export const fixturesAPI = {
  // Get fixtures for a specific gameweek
  getFixturesForGameweek: async (gameweek: number) => {
    const response = await api.get(`/api/fixtures/${gameweek}`);
    return response.data;
  },

  // Get current gameweek
  getCurrentGameweek: async () => {
    const response = await api.get("/api/fixtures/gameweek/current");
    return response.data;
  },
};

// Predictions API functions
export const predictionsAPI = {
  // Submit or update user predictions for a gameweek
  submitPredictions: async (
    predictions: Array<{
      fixtureId: string;
      homeScore: number;
      awayScore: number;
      captain: boolean;
      gameweek: number;
    }>,
    gameweek: number
  ) => {
    const response = await api.post("/api/user-predictions", {
      predictions,
      gameweek,
    });
    return response.data;
  },

  // Get user predictions for a specific gameweek
  getUserPredictions: async (gameweek: number) => {
    const response = await api.post("/api/user-predictions/get-predictions", {
      event: gameweek,
    });
    return response.data;
  },
};

// Export the configured axios instance for custom requests
export default api;
