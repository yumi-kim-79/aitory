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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);

  // /api/auth/me 호출 → 유저 문서 없으면 자동 생성됨 (ensureUserDoc)
  const refreshUser = useCallback(async (fbUser: FirebaseUser) => {
    try {
      const res = await fetchWithToken("/api/auth/me", fbUser);
      const data = await res.json();
      if (data.user) setUser(data.user);
    } catch {
      // API 실패해도 Firebase Auth 상태는 유지
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    // 구글 redirect 로그인 결과 처리
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          setFirebaseUser(result.user);
          await refreshUser(result.user);
        }
      })
      .catch((e) => {
        console.error("getRedirectResult 에러:", e);
      });

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
      // /api/auth/me 호출 시 유저 문서 자동 생성됨
      // name은 별도 업데이트 필요하면 추후 구현
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
