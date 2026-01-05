import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../firebaseStorage';

export type UploadResult = {
  url: string;
  path: string;
  name: string;
  size: number;
  contentType: string;
};

const sanitizeFilename = (name: string) =>
  name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '');

export const uploadFileToStorage = (
  storagePath: string,
  file: File,
  onProgress?: (progressPct: number) => void
) =>
  new Promise<UploadResult>((resolve, reject) => {
    const safePath = storagePath.replace(/\/+/g, '/');
    const storageRef = ref(storage, safePath);

    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || undefined,
      customMetadata: {
        originalName: sanitizeFilename(file.name) || file.name,
      },
    });

    task.on(
      'state_changed',
      (snapshot) => {
        if (!snapshot.totalBytes) return;
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        onProgress?.(pct);
      },
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve({
          url,
          path: safePath,
          name: file.name,
          size: file.size,
          contentType: file.type || task.snapshot.metadata.contentType || '',
        });
      }
    );
  });
