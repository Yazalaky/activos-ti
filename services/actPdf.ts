import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseFunctions';

interface GenerateActPdfResponse {
  fileName: string;
  pdfBase64: string;
  issuedAt: number;
}

const generateActPdfCallable = httpsCallable<{ actId: string }, GenerateActPdfResponse>(
  functions,
  'generateActPdf',
  { timeout: 180_000 },
);
const generateSharedActPdfCallable = httpsCallable<{ actId: string }, GenerateActPdfResponse>(
  functions,
  'generateSharedActPdf',
  { timeout: 180_000 },
);

export const generateActPdf = async (actId: string, signatureCount = 1) => {
  let data: GenerateActPdfResponse;
  try {
    ({ data } = await (signatureCount > 1 ? generateSharedActPdfCallable : generateActPdfCallable)({ actId }));
  } catch (error) {
    if (signatureCount > 1 && error && typeof error === 'object' && 'code' in error && (error.code === 'functions/not-found' || error.code === 'functions/unimplemented')) {
      throw new Error('El servicio de impresión todavía no admite varias firmas. El acta no se emitió; contacta al administrador.');
    }
    throw error;
  }
  if (!data.pdfBase64 || !data.fileName || !Number.isFinite(data.issuedAt)) {
    throw new Error('El servicio de impresión devolvió una respuesta incompleta.');
  }

  const binary = atob(data.pdfBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const file = new File([bytes], data.fileName, { type: 'application/pdf' });
  return { file, issuedAt: data.issuedAt };
};
