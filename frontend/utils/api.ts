import axios from "axios";

// Create axios instance with default configuration
const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_BACKEND_URL,
  timeout: 10000,
  withCredentials: true, // Enable cookies to be sent with requests
});

// Request interceptor - cookies are automatically included by axios
api.interceptors.request.use(
  (config) => {
    // With cookies, we don't need to manually add Authorization headers
    // The JWT token will be automatically sent via the httpOnly cookie
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
      // Token expired or invalid
      console.log("Authentication required - redirecting to login");
      // TODO: Navigate to login screen
      // With cookies, the server will automatically clear the cookie on logout
    }
    return Promise.reject(error);
  }
);

// Auth API functions
export const authAPI = {
  // Login user
  login: async (email: string, password: string) => {
    const response = await api.post("/api/users/login", { email, password });

    // With cookies, the server automatically sets the JWT token as an httpOnly cookie
    // No need to manually store the token
    return response.data;
  },

  // Register user
  signup: async (email: string, password: string, displayName?: string) => {
    const response = await api.post("/api/users/signup", {
      email,
      password,
      displayName,
    });

    // With cookies, the server automatically sets the JWT token as an httpOnly cookie
    // No need to manually store the token
    return response.data;
  },

  // Logout user
  logout: async () => {
    // Call the backend logout endpoint to clear the cookie
    const response = await api.post("/api/users/logout");
    return response.data;
  },

  // Check if user is authenticated by making a test request
  isAuthenticated: async () => {
    try {
      // Make a request to a protected endpoint to check if token is valid
      await api.post("/api/leagues/user-leagues");
      return true;
    } catch (error) {
      return false;
    }
  },

  // These methods are no longer needed with cookies, but keeping for compatibility
  setToken: (token: string) => {
    console.warn("setToken is not needed when using cookies");
  },

  getToken: () => {
    console.warn("getToken is not needed when using cookies");
    return null;
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
