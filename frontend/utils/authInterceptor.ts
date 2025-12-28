import { AxiosInstance } from "axios";

// Token storage utilities - works with both web localStorage and React Native AsyncStorage
const TOKEN_KEY = "ultimatefpl_token";

// Simple in-memory fallback for when storage isn't available
let memoryToken: string | null = null;

export const tokenStorage = {
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

// Setup auth interceptors for an axios instance
export const setupAuthInterceptors = (axiosInstance: AxiosInstance) => {
  // Request interceptor to add JWT token to all requests
  axiosInstance.interceptors.request.use(
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
  axiosInstance.interceptors.response.use(
    (response) => {
      return response;
    },
    (error) => {
      if (error.response?.status === 401) {
        // Token expired or invalid, clear stored token
        // tokenStorage.remove();
        // console.log("Authentication required - token cleared");
        // TODO: Navigate to login screen
      }
      return Promise.reject(error);
    }
  );

  return axiosInstance;
};
