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

const contentTypeByExtension: Record<string, string> = {
  avif: 'image/avif',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
  webp: 'image/webp',
};

const resolveContentType = (file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  // Browsers may report application/octet-stream or application/x-pdf for
  // files with a .pdf extension; Storage rules require the canonical MIME.
  if (extension === 'pdf') return 'application/pdf';
  if (file.type) return file.type;
  return contentTypeByExtension[extension] || '';
};

export const uploadFileToStorage = (
  storagePath: string,
  file: File,
  onProgress?: (progressPct: number) => void,
  customMetadata: Record<string, string> = {}
) =>
  new Promise<UploadResult>((resolve, reject) => {
    const safePath = storagePath.replace(/\/+/g, '/');
    const storageRef = ref(storage, safePath);
    const contentType = resolveContentType(file);

    const task = uploadBytesResumable(storageRef, file, {
      contentType: contentType || undefined,
      customMetadata: {
        ...customMetadata,
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
          contentType: contentType || task.snapshot.metadata.contentType || '',
        });
      }
    );
  });
