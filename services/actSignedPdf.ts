import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseFunctions';
import type { ActPdfFile } from '../types';

export type SignedActUploadMode = 'signed' | 'replace_signed';

type ConfirmSignedActPdfRequest = {
  actId: string;
  storagePath: string;
  mode: SignedActUploadMode;
  replacementReason?: string;
};

type ConfirmSignedActPdfResponse = {
  signedPdf: ActPdfFile;
};

const confirmSignedActPdfCallable = httpsCallable<ConfirmSignedActPdfRequest, ConfirmSignedActPdfResponse>(
  functions,
  'confirmSignedActPdf',
  { timeout: 60_000 },
);

export const confirmSignedActPdf = async (
  actId: string,
  storagePath: string,
  mode: SignedActUploadMode,
  replacementReason?: string,
) => {
  const response = await confirmSignedActPdfCallable({ actId, storagePath, mode, replacementReason });
  return response.data.signedPdf;
};
