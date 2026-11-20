import { Bytes, deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth } from '../firebaseAuth';
import { db } from '../firebaseDb';

const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const MAX_SIGNATURE_BYTES = 250_000;

const signatureRef = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Debes iniciar sesión para administrar tu firma.');
  return { uid, reference: doc(db, 'users', uid, 'private', 'actSignature') };
};

export const getMySignature = async (): Promise<Blob | null> => {
  const { reference } = signatureRef();
  const snapshot = await getDoc(reference);
  if (!snapshot.exists()) return null;
  const value = snapshot.data();
  if (!(value.image instanceof Bytes) || value.contentType !== 'image/png' || value.authorized !== true) {
    throw new Error('La firma guardada tiene un formato no válido.');
  }
  return new Blob([value.image.toUint8Array()], { type: 'image/png' });
};

export const prepareSignature = async (file: File): Promise<Blob> => {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > MAX_SOURCE_BYTES || file.size === 0) {
    throw new Error('Selecciona una imagen PNG, JPG o WEBP de máximo 5 MB.');
  }
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) {
      throw new Error('Las dimensiones de la imagen no son válidas.');
    }
    const scale = Math.min(1, 1200 / image.naturalWidth, 500 / image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar la imagen.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob || blob.size === 0 || blob.size > MAX_SIGNATURE_BYTES) {
      throw new Error('La firma procesada supera el tamaño permitido. Usa una imagen más sencilla.');
    }
    return blob;
  } finally {
    URL.revokeObjectURL(source);
  }
};

export const saveMySignature = async (blob: Blob): Promise<void> => {
  const { uid, reference } = signatureRef();
  if (blob.type !== 'image/png' || !blob.size || blob.size > MAX_SIGNATURE_BYTES) throw new Error('Firma no válida.');
  await setDoc(reference, {
    image: Bytes.fromUint8Array(new Uint8Array(await blob.arrayBuffer())),
    contentType: 'image/png', authorized: true, updatedAt: serverTimestamp(), updatedByUid: uid,
  });
};

export const deleteMySignature = async (): Promise<void> => {
  const { reference } = signatureRef();
  await deleteDoc(reference);
};
