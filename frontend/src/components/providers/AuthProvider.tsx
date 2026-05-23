"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // This tells Next.js: "Okay, we are safely on the client now. 
    // Zustand has loaded the tokens from localStorage."
    setIsHydrated(true);
  }, []);

  // Show nothing (or a full screen dark background) while checking localStorage
  // This prevents the "flash of unauthenticated state" that kicks you to login
  if (!isHydrated) {
    return <div className="min-h-screen bg-bg-dark" />; 
  }

  return <>{children}</>;
}