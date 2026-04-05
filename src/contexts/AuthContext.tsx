"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
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
  type Unsubscribe,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export interface UserInfo {
  uid: string;
  email: string;
  name: string;
  plan: string;
  credits: number;
  role?: string;
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

async function fetchWithToken(
  url: string,
  fbUser: FirebaseUser,
  options?: RequestInit,
) {
  const token = await fbUser.getIdToken();
  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

function firebaseUserToInfo(fbUser: FirebaseUser): UserInfo {
  return {
    uid: fbUser.uid,
    email: fbUser.email || "",
    name: fbUser.displayName || "",
    plan: "free",
    credits: 0,
  };
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
        return;
      }
    } catch {
      // API 실패
    }
    setUser(firebaseUserToInfo(fbUser));
  }, []);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe: Unsubscribe = onAuthStateChanged(
      auth,
      async (fbUser) => {
        if (fbUser) {
          setFirebaseUser(fbUser);
          await refreshUser(fbUser);
        } else {
          setFirebaseUser(null);
          setUser(null);
        }
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [refreshUser]);

  const signUp = useCallback(
    async (email: string, password: string, name: string) => {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      setFirebaseUser(cred.user);
      await refreshUser(cred.user);
    },
    [refreshUser],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      setFirebaseUser(cred.user);
      await refreshUser(cred.user);
    },
    [refreshUser],
  );

  const signingInRef = useRef(false);

  const handleGoogleSignIn = useCallback(async () => {
    if (signingInRef.current) return;
    signingInRef.current = true;

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      setFirebaseUser(result.user);
      await refreshUser(result.user);
    } catch (error: unknown) {
      const code = (error as { code?: string }).code;
      if (code === "auth/cancelled-popup-request" || code === "auth/popup-closed-by-user") {
        console.log("[auth] 팝업 취소/닫힘:", code);
        return;
      }
      throw error;
    } finally {
      signingInRef.current = false;
    }
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
