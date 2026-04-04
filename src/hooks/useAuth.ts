"use client";

import { useState, useEffect, useCallback } from "react";
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

interface UserInfo {
  uid: string;
  email: string;
  name: string;
  plan: string;
  credits: number;
}

async function fetchWithToken(url: string, firebaseUser: FirebaseUser) {
  const token = await firebaseUser.getIdToken();
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

export function useAuth() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);

  // 서버에서 유저 문서 가져오기
  const refreshUser = useCallback(async (fbUser: FirebaseUser) => {
    try {
      const res = await fetchWithToken("/api/auth/me", fbUser);
      const data = await res.json();
      if (data.user) setUser(data.user);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
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

  const signUp = async (email: string, password: string, name: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // 서버에 유저 문서 생성 요청
    const token = await cred.user.getIdToken();
    await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name }),
    });
    await refreshUser(cred.user);
  };

  const signIn = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await refreshUser(cred.user);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const token = await cred.user.getIdToken();
    await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: cred.user.displayName || "" }),
    });
    await refreshUser(cred.user);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
  };

  const getIdToken = async () => {
    return firebaseUser ? firebaseUser.getIdToken() : null;
  };

  return { user, loading, signUp, signIn, signInWithGoogle, signOut, getIdToken, refreshUser: () => firebaseUser && refreshUser(firebaseUser) };
}
