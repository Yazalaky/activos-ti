import React from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../firebaseAuth';
import { app } from '../firebaseApp';
import type { Role, UserProfile } from '../types';

export type AuthState = {
  user: User | null;
  profile: UserProfile | null;
  role: Role | null;
  loading: boolean;
};

const AuthContext = React.createContext<AuthState | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = React.useState<AuthState>({
    user: null,
    profile: null,
    role: null,
    loading: true,
  });

  React.useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (!user) {
        setState({ user: null, profile: null, role: null, loading: false });
        return;
      }

      setState((prev) => ({ ...prev, user, loading: true }));

      (async () => {
        const uid = user.uid;
        const { doc, getFirestore, onSnapshot } = await import('firebase/firestore');
        if (auth.currentUser?.uid !== uid) return;
        const db = getFirestore(app);
        const profileRef = doc(db, 'users', uid);
        unsubscribeProfile = onSnapshot(
          profileRef,
          (snap) => {
            if (auth.currentUser?.uid !== uid) return;
            if (!snap.exists()) {
              setState({ user, profile: null, role: null, loading: false });
              return;
            }
            const data = snap.data() as Omit<UserProfile, 'uid'>;
            const profile: UserProfile = { uid, ...data };
            setState({ user, profile, role: profile.role, loading: false });
          },
          () => setState({ user, profile: null, role: null, loading: false })
        );
      })().catch(() => setState({ user, profile: null, role: null, loading: false }));
    });

    return () => {
      if (unsubscribeProfile) unsubscribeProfile();
      unsubscribeAuth();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
