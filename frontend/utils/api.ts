import axios from "axios";

// Token storage utilities - works with both web localStorage and React Native AsyncStorage
const TOKEN_KEY = "ultimatefpl_token";

// Simple in-memory fallback for when storage isn't available
let memoryToken: string | null = null;

const tokenStorage = {
  get: () => {
    try {
      // Try localStorage first (web)
      if (typeof localStorage !== "undefined") {
        return localStorage.getItem(TOKEN_KEY);
      }
      // Fallback to memory storage
      return memoryToken;
    } catch (error) {
      console.warn("Storage not available, using memory:", error);
      return memoryToken;
    }
  },

  set: (token: string) => {
    try {
      // Try localStorage first (web)
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(TOKEN_KEY, token);
      }
      // Always set in memory as backup
      memoryToken = token;
    } catch (error) {
      console.warn("Storage not available, using memory:", error);
      memoryToken = token;
    }
  },

  remove: () => {
    try {
      // Try localStorage first (web)
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(TOKEN_KEY);
      }
      // Always clear memory
      memoryToken = null;
    } catch (error) {
      console.warn("Storage not available, clearing memory:", error);
      memoryToken = null;
    }
  },
};

// Create axios instance with default configuration
const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_BACKEND_URL,
  timeout: 10000,
});

// Request interceptor to add JWT token to all requests
api.interceptors.request.use(
  (config) => {
    const token = tokenStorage.get();
    console.log("token in interceptor= ", token);

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
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, clear stored token
      //   tokenStorage.remove();
      //   console.log("Authenticati
      // on required - token cleared");
      // TODO: Navigate to login screen
    }
    return Promise.reject(error);
  }
);

// Auth API functions
export const authAPI = {
  // Login user
  login: async (email: string, password: string) => {
    const response = await api.post("/api/users/login", { email, password });

    // Store token from response in localStorage
    if (response.data.success && response.data.token) {
      tokenStorage.set(response.data.token);
    }

    return response.data;
  },

  // Register user
  signup: async (email: string, password: string, displayName?: string) => {
    const response = await api.post("/api/users/signup", {
      email,
      password,
      displayName,
    });

    // Store token from response in localStorage
    if (response.data.success && response.data.token) {
      tokenStorage.set(response.data.token);
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
      // Always clear local token, even if backend call fails
      tokenStorage.remove();
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
};

// Export the configured axios instance for custom requests
export default api;
