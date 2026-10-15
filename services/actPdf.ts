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

export const generateActPdf = async (actId: string) => {
  const { data } = await generateActPdfCallable({ actId });
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
