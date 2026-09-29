import { deleteObject, ref } from 'firebase/storage';
import { storage } from '../firebaseStorage';

const resolveStoragePath = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('gs://')) {
    const withoutScheme = trimmed.slice('gs://'.length);
    const separatorIndex = withoutScheme.indexOf('/');
    return separatorIndex >= 0 ? decodeURIComponent(withoutScheme.slice(separatorIndex + 1)) : '';
  }

  try {
    const url = new URL(trimmed);
    const encodedObjectPath = url.pathname.match(/\/o\/(.*)$/)?.[1];
    if (encodedObjectPath) return decodeURIComponent(encodedObjectPath);
  } catch {
    // The value may already be a Storage object path.
  }

  return trimmed.replace(/^\/+/, '');
};

export const deleteStoragePath = async (path: string) => {
  const clean = resolveStoragePath(String(path || ''));
  if (!clean) return;
  await deleteObject(ref(storage, clean));
};
