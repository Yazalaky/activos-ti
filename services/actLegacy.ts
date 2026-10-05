import type { Act, ActPdfFile } from '../types';

/**
 * A legacy act is an old record that has a single PDF pointer but has not yet
 * been assigned the generated/signed PDF model introduced later.
 */
export const isLegacyActPending = (act: Act) => Boolean(
  act.pdfUrl
    && !act.generatedPdf
    && !act.signedPdf
    && !act.signatureMethod
    && act.legacyClassification !== 'issued'
    && act.legacyClassification !== 'signed_uploaded',
);

/**
 * Reuses the existing Storage object. Classification should never require a
 * second upload, but strict Firestore rules require complete PDF metadata.
 */
export const getLegacyPdfFile = (act: Act): ActPdfFile | null => {
  if (!act.pdfUrl || !act.pdfPath || !act.pdfName || !act.pdfSize || act.pdfSize <= 0) return null;
  const size = Number(act.pdfSize);
  if (!Number.isFinite(size) || size <= 0) return null;

  const file: ActPdfFile = {
    url: act.pdfUrl,
    path: act.pdfPath,
    name: act.pdfName,
    contentType: 'application/pdf',
    size,
    createdAt: act.issuedAt ?? act.createdAt ?? Date.now(),
  };
  if (act.createdByUid) file.createdByUid = act.createdByUid;
  return file;
};
