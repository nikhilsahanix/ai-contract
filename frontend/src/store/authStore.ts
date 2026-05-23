// frontend/src/store/authStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  email: string;
  role: string;
  org: {
    name: string;
    slug: string;
    plan: "SOLO" | "FIRM" | "API_WHITELABEL";
    analysisCount: number;
    analysisLimit: number;
  };
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: User, access: string, refresh: string) => void;
  updateTokens: (access: string, refresh: string) => void;
  setAccessToken: (access: string) => void;        // 👈 new
  clearAuth: () => void;                           // 👈 new
  logout: () => void;                              // keep existing
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
      updateTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setAccessToken: (accessToken) => set({ accessToken }),          // for silent refresh
      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: "auth-storage" }
  )
);