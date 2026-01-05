import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Role, UserProfile } from '../types';

export const listUsers = async (): Promise<UserProfile[]> => {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, 'uid'>) }));
};

export const updateUserRole = async (uid: string, role: Role) => {
  await updateDoc(doc(db, 'users', uid), { role });
};

