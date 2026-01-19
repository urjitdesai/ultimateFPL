import AsyncStorage from "@react-native-async-storage/async-storage";

// Storage keys
const KEYS = {
  TOKEN: "ultimatefpl_token",
  USER: "ultimatefpl_user",
  FIXTURES_PREFIX: "ultimatefpl_fixtures_",
  CURRENT_GAMEWEEK: "ultimatefpl_current_gameweek",
};

// Cache TTL in milliseconds
const TTL = {
  FIXTURES: 24 * 60 * 60 * 1000, // 24 hours
  CURRENT_GAMEWEEK: 5 * 60 * 1000, // 5 minutes
};

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// ============================================
// Token Storage (for authentication)
// ============================================

// In-memory token for synchronous access (needed for axios interceptors)
let memoryToken: string | null = null;
let memoryUser: any = null;

export const tokenStorage = {
  // Async get - use for initial load
  getAsync: async (): Promise<string | null> => {
    try {
      const token = await AsyncStorage.getItem(KEYS.TOKEN);
      memoryToken = token;
      return token;
    } catch (error) {
      console.warn("Error getting token:", error);
      return null;
    }
  },

  // Sync get - use for interceptors (returns memory cache)
  get: (): string | null => {
    return memoryToken;
  },

  set: async (token: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(KEYS.TOKEN, token);
      memoryToken = token;
    } catch (error) {
      console.warn("Error setting token:", error);
      memoryToken = token; // Still set in memory
    }
  },

  remove: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(KEYS.TOKEN);
      memoryToken = null;
    } catch (error) {
      console.warn("Error removing token:", error);
      memoryToken = null;
    }
  },

  // User data
  getUserAsync: async (): Promise<any> => {
    try {
      const user = await AsyncStorage.getItem(KEYS.USER);
      const parsed = user ? JSON.parse(user) : null;
      memoryUser = parsed;
      return parsed;
    } catch (error) {
      console.warn("Error getting user:", error);
      return null;
    }
  },

  getUser: (): any => {
    return memoryUser;
  },

  setUser: async (user: any): Promise<void> => {
    try {
      await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
      memoryUser = user;
    } catch (error) {
      console.warn("Error setting user:", error);
      memoryUser = user;
    }
  },

  removeUser: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(KEYS.USER);
      memoryUser = null;
    } catch (error) {
      console.warn("Error removing user:", error);
      memoryUser = null;
    }
  },

  // Initialize - call on app start to load token/user into memory
  initialize: async (): Promise<void> => {
    await tokenStorage.getAsync();
    await tokenStorage.getUserAsync();
  },
};

// ============================================
// Cache Storage (for fixtures, gameweek, etc.)
// ============================================

const cacheStorage = {
  get: async <T>(key: string): Promise<T | null> => {
    try {
      const stored = await AsyncStorage.getItem(key);
      if (!stored) return null;

      const entry: CacheEntry<T> = JSON.parse(stored);
      const now = Date.now();

      // Check if cache has expired
      if (now - entry.timestamp > entry.ttl) {
        await AsyncStorage.removeItem(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.warn("Cache get error:", error);
      return null;
    }
  },

  set: async <T>(key: string, data: T, ttl: number): Promise<void> => {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      };
      await AsyncStorage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      console.warn("Cache set error:", error);
    }
  },

  remove: async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.warn("Cache remove error:", error);
    }
  },
};

// ============================================
// Fixtures Cache
// ============================================

export const fixturesCache = {
  get: async (gameweek: number) => {
    return cacheStorage.get<any>(`${KEYS.FIXTURES_PREFIX}${gameweek}`);
  },

  set: async (gameweek: number, data: any) => {
    await cacheStorage.set(
      `${KEYS.FIXTURES_PREFIX}${gameweek}`,
      data,
      TTL.FIXTURES
    );
  },

  remove: async (gameweek: number) => {
    await cacheStorage.remove(`${KEYS.FIXTURES_PREFIX}${gameweek}`);
  },
};

// ============================================
// Current Gameweek Cache
// ============================================

export const currentGameweekCache = {
  get: async () => {
    return cacheStorage.get<{
      currentGameweek: number;
      deadline: string | null;
    }>(KEYS.CURRENT_GAMEWEEK);
  },

  set: async (data: { currentGameweek: number; deadline: string | null }) => {
    await cacheStorage.set(KEYS.CURRENT_GAMEWEEK, data, TTL.CURRENT_GAMEWEEK);
  },

  remove: async () => {
    await cacheStorage.remove(KEYS.CURRENT_GAMEWEEK);
  },
};

// ============================================
// Clear All Storage
// ============================================

export const clearAllStorage = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const appKeys = keys.filter((key) => key.startsWith("ultimatefpl_"));
    await AsyncStorage.multiRemove(appKeys);
    memoryToken = null;
    memoryUser = null;
  } catch (error) {
    console.warn("Error clearing storage:", error);
  }
};

export default {
  tokenStorage,
  fixturesCache,
  currentGameweekCache,
  clearAllStorage,
};
