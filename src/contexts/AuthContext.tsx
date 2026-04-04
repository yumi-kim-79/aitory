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
  signInWithRedirect,
  getRedirectResult,
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

// Firebase user 정보로 fallback UserInfo 생성
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

  // /api/auth/me → 성공하면 setUser, 실패하면 Firebase user fallback
  const refreshUser = useCallback(
    async (fbUser: FirebaseUser) => {
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
      // fallback: Firebase Auth 정보로 최소한의 user 상태 설정
      setUser(firebaseUserToInfo(fbUser));
    },
    [],
  );

  // 앱 마운트: getRedirectResult 먼저 → 그 다음 onAuthStateChanged
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    let unsubscribe: Unsubscribe | undefined;

    const init = async () => {
      // 1. redirect 결과 먼저 처리
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          console.log("getRedirectResult 성공:", result.user.email);
          setFirebaseUser(result.user);
          await refreshUser(result.user);
        }
      } catch (error) {
        console.error("getRedirectResult 에러:", error);
      }

      // 2. 그 다음 onAuthStateChanged 등록
      unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          setFirebaseUser(fbUser);
          await refreshUser(fbUser);
        } else {
          setFirebaseUser(null);
          setUser(null);
        }
        setLoading(false);
      });
    };

    init();
    return () => unsubscribe?.();
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

  const handleGoogleSignIn = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    await signInWithRedirect(auth, provider);
  }, []);

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
