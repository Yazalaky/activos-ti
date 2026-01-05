import React from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
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
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setState((prev) => ({ ...prev, user, loading: !!user }));

      if (!user) {
        setState({ user: null, profile: null, role: null, loading: false });
        return;
      }

      const profileRef = doc(db, 'users', user.uid);
      const unsubscribeProfile = onSnapshot(
        profileRef,
        (snap) => {
          if (!snap.exists()) {
            setState({ user, profile: null, role: null, loading: false });
            return;
          }
          const data = snap.data() as Omit<UserProfile, 'uid'>;
          const profile: UserProfile = { uid: user.uid, ...data };
          setState({ user, profile, role: profile.role, loading: false });
        },
        () => setState({ user, profile: null, role: null, loading: false })
      );

      return unsubscribeProfile;
    });

    return () => unsubscribeAuth();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

