import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebaseDb';
import type { AccessScope, Role, UserProfile } from '../types';

export const listUsers = async (): Promise<UserProfile[]> => {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => {
    const data = d.data() as Omit<UserProfile, 'uid'>;
    return {
      uid: d.id,
      ...data,
      active: data.active !== false,
      accessScope: data.accessScope === 'sites' ? 'sites' : 'global',
      siteIds: Array.isArray(data.siteIds) ? data.siteIds : [],
    };
  });
};

export const updateUserRole = async (uid: string, role: Role) => {
  await updateDoc(doc(db, 'users', uid), { role });
};

export const updateUserAccess = async (
  uid: string,
  accessScope: AccessScope,
  siteIds: string[] = [],
) => {
  await updateDoc(doc(db, 'users', uid), {
    accessScope,
    siteIds: accessScope === 'sites' ? [...new Set(siteIds)] : [],
  });
};
