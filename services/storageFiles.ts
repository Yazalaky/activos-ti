import { deleteObject, ref } from 'firebase/storage';
import { storage } from '../firebaseStorage';

export const deleteStoragePath = async (path: string) => {
  const clean = String(path || '').trim().replace(/^\/+/, '');
  if (!clean) return;
  await deleteObject(ref(storage, clean));
};
