import axios from "axios";
import { tokenStorage, fixturesCache, currentGameweekCache } from "./storage";

// Create axios instance with default configuration
const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_BACKEND_URL,
  timeout: 10000,
});

// Setup auth interceptors
const setupAuthInterceptors = () => {
  // Request interceptor to add JWT token to all requests
  api.interceptors.request.use(
    (config) => {
      // Use synchronous get (from memory) for interceptors
      const token = tokenStorage.get();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor to handle token expiration
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        console.warn("Unauthorized request - token may be expired");
      }
      return Promise.reject(error);
    }
  );
};

setupAuthInterceptors();

// Auth API functions
export const authAPI = {
  // Login user
  login: async (email: string, password: string) => {
    const response = await api.post("/api/users/login", { email, password });

    if (response.data.success) {
      if (response.data.token) {
        await tokenStorage.set(response.data.token);
      }
      if (response.data.user) {
        await tokenStorage.setUser(response.data.user);
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

    if (response.data.success) {
      if (response.data.token) {
        await tokenStorage.set(response.data.token);
      }
      if (response.data.user) {
        await tokenStorage.setUser(response.data.user);
      }
    }

    return response.data;
  },

  // Logout user
  logout: async () => {
    try {
      const response = await api.post("/api/users/logout");
      return response.data;
    } finally {
      await tokenStorage.remove();
      await tokenStorage.removeUser();
    }
  },

  // Check if user is authenticated (sync - uses memory)
  isAuthenticated: () => {
    const token = tokenStorage.get();
    return !!token;
  },

  // Initialize auth state from storage (call on app start)
  initialize: async () => {
    await tokenStorage.initialize();
  },

  // Set token manually
  setToken: async (token: string) => {
    await tokenStorage.set(token);
  },

  // Get current token (sync)
  getToken: () => {
    return tokenStorage.get();
  },

  // Clear token
  clearToken: async () => {
    await tokenStorage.remove();
  },

  // Get stored user data (sync - uses memory)
  getUser: () => {
    return tokenStorage.getUser();
  },

  // Set user data
  setUser: async (user: any) => {
    await tokenStorage.setUser(user);
  },

  // Clear user data
  clearUser: async () => {
    await tokenStorage.removeUser();
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
  getLeagueTable: async (
    leagueId: string,
    gameweek?: number,
    page: number = 1,
    pageSize: number = 50
  ) => {
    const url = `/api/leagues/${leagueId}/table`;
    const params: Record<string, any> = { page, pageSize };
    if (gameweek) params.gameweek = gameweek;
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
  // Get fixtures for a specific gameweek (with caching)
  getFixturesForGameweek: async (gameweek: number) => {
    // Check cache first
    const cached = await fixturesCache.get(gameweek);
    if (cached) {
      console.log(`Using cached fixtures for GW${gameweek}`);
      return cached;
    }

    // Fetch from API
    const response = await api.get(`/api/fixtures/${gameweek}`);

    // Cache the result
    await fixturesCache.set(gameweek, response.data);
    console.log(`Cached fixtures for GW${gameweek}`);

    return response.data;
  },

  // Get current gameweek (with caching)
  getCurrentGameweek: async () => {
    // Check cache first
    const cached = await currentGameweekCache.get();
    if (cached) {
      console.log(`Using cached current gameweek: GW${cached.currentGameweek}`);
      return cached;
    }

    // Fetch from API
    const response = await api.get("/api/fixtures/gameweek/current");

    // Cache the result
    await currentGameweekCache.set(response.data);
    console.log(`Cached current gameweek: GW${response.data.currentGameweek}`);

    return response.data;
  },

  // Force refresh fixtures (bypasses cache)
  refreshFixtures: async (gameweek: number) => {
    await fixturesCache.remove(gameweek);
    return fixturesAPI.getFixturesForGameweek(gameweek);
  },

  // Force refresh current gameweek (bypasses cache)
  refreshCurrentGameweek: async () => {
    await currentGameweekCache.remove();
    return fixturesAPI.getCurrentGameweek();
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

  // Get any user's predictions by userId and gameweek
  getUserPredictionsByUserId: async (userId: string, gameweek: number) => {
    const response = await api.get(
      `/api/user-predictions/user/${userId}/gameweek/${gameweek}`
    );
    return response.data;
  },
};

// Export the configured axios instance for custom requests
export default api;
