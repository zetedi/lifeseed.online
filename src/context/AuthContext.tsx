import React, { createContext, useContext, useEffect, useState } from "react";
import { type Lightseed, type Lifetree } from "@/types/Types";
import { onAuthChange, getMyLifetrees, signInWithGoogle, logout } from "@/lib/firebase";

interface AuthContextType {
  lightseed: Lightseed | null;
  myTrees: Lifetree[];
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshTrees: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [lightseed, setLightseed] = useState<Lightseed | null>(null);
  const [myTrees, setMyTrees] = useState<Lifetree[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      if (user) {
        setLightseed({ 
          uid: user.uid, 
          email: user.email, 
          displayName: user.displayName,
          photoURL: user.photoURL 
        });
        const trees = await getMyLifetrees(user.uid);
        setMyTrees(trees);
      } else {
        setLightseed(null);
        setMyTrees([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const refreshTrees = async () => {
    if (lightseed) {
        const trees = await getMyLifetrees(lightseed.uid);
        setMyTrees(trees);
    }
  }

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      lightseed, 
      myTrees, 
      loading, 
      signIn: handleSignIn, 
      signOut: handleSignOut,
      refreshTrees
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
