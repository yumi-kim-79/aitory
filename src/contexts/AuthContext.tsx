"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export interface UserInfo {
  uid: string;
  email: string;
  name: string;
  plan: string;
  credits: number;
}

interface AuthContextType {
  user: UserInfo | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchWithToken(url: string, fbUser: FirebaseUser, options?: RequestInit) {
  const token = await fbUser.getIdToken();
  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);

  const refreshUser = useCallback(async (fbUser: FirebaseUser) => {
    try {
      const res = await fetchWithToken("/api/auth/me", fbUser);
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
      }
    } catch {
      // API 실패해도 Firebase Auth 상태는 유지
    }
  }, []);

  // onAuthStateChanged — 앱 전체에서 1번만 등록
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        await refreshUser(fbUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, [refreshUser]);

  const signUp = useCallback(
    async (email: string, password: string, name: string) => {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      try {
        await fetchWithToken("/api/auth/register", cred.user, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
      } catch (e) {
        console.error("register 실패, 로그인은 유지:", e);
      }
      setFirebaseUser(cred.user);
      await refreshUser(cred.user);
    },
    [refreshUser],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await refreshUser(cred.user);
      setFirebaseUser(cred.user);
    },
    [refreshUser],
  );

  const handleGoogleSignIn = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    // register 실패해도 로그인 상태는 유지
    try {
      await fetchWithToken("/api/auth/register", cred.user, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cred.user.displayName || "" }),
      });
    } catch (e) {
      console.error("register 실패, 로그인은 유지:", e);
    }
    // 즉시 user 상태 반영 (onAuthStateChanged를 기다리지 않음)
    setFirebaseUser(cred.user);
    await refreshUser(cred.user);
  }, [refreshUser]);

  const handleSignOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setFirebaseUser(null);
  }, []);

  const getIdToken = useCallback(async () => {
    return firebaseUser ? firebaseUser.getIdToken() : null;
  }, [firebaseUser]);

  const triggerRefresh = useCallback(() => {
    if (firebaseUser) refreshUser(firebaseUser);
  }, [firebaseUser, refreshUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signUp,
        signIn,
        signInWithGoogle: handleGoogleSignIn,
        signOut: handleSignOut,
        getIdToken,
        refreshUser: triggerRefresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
