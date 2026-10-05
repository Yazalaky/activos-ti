import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Act, ActSignaturePlacement, ActTemplate, Site } from '../types';

const assetTypeLabel: Record<string, string> = {
  laptop: 'Laptop',
  desktop: 'Desktop',
  monitor: 'Monitor',
  keyboard: 'Teclado',
  mouse: 'Mouse',
  printer: 'Impresora',
  scanner: 'Escáner',
  network: 'Red',
  other: 'Otro',
};

const formatDate = () => new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}).format(new Date());

const dataUrlToBytes = (dataUrl: string) => {
  const [, encoded] = dataUrl.split(',', 2);
  if (!encoded) throw new Error('La firma electrónica no tiene un formato válido.');
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const setOptionalText = (form: ReturnType<PDFDocument['getForm']>, fieldName: string, value: string) => {
  try {
    form.getTextField(fieldName).setText(value);
    return true;
  } catch {
    return false;
  }
};

const setOptionalCheckbox = (form: ReturnType<PDFDocument['getForm']>, fieldName: string, checked: boolean) => {
  try {
    const field = form.getCheckBox(fieldName);
    if (checked) field.check();
    else field.uncheck();
    return true;
  } catch {
    return false;
  }
};

export const loadActTemplatePdf = async (template: ActTemplate) => {
  if (!template.pdfTemplateUrl) {
    throw new Error('La empresa aún no tiene un PDF de plantilla cargado. Un administrador debe configurarlo.');
  }
  const response = await fetch(template.pdfTemplateUrl);
  if (!response.ok) throw new Error('No se pudo descargar la plantilla PDF de la empresa.');
  return PDFDocument.load(await response.arrayBuffer());
};

export const generateActPdf = async (act: Act, site: Site, template: ActTemplate) => {
  const pdf = await loadActTemplatePdf(template);
  const form = pdf.getForm();
  const asset = act.assetSnapshot;
  const values: Record<string, string> = {
    recipient_full_name: act.recipient.fullName,
    recipient_position: act.recipient.position,
    recipient_email: act.recipient.email || '',
    recipient_document: act.recipient.documentNumber || '',
    recipient_area: act.recipient.area || '',
    recipient_phone: act.recipient.phone || '',
    recipient_extension: act.recipient.extension || '',
    recipient_network_user: act.recipient.networkUser || '',
    act_date: formatDate(),
    site_name: site.name,
    company_nit: template.nit || '',
    asset_type: assetTypeLabel[asset.type] || asset.type,
    asset_fixed_id: act.fixedAssetIdSnapshot,
    asset_brand: asset.brand,
    asset_model: asset.model,
    asset_serial: asset.serial,
    asset_processor: asset.processor || '',
    asset_ram: asset.ram || '',
    asset_storage: asset.storage || '',
    asset_os: asset.os || '',
    observations: act.observations || '',
  };

  let fieldsFilled = 0;
  Object.entries(values).forEach(([fieldName, value]) => {
    if (setOptionalText(form, fieldName, value)) fieldsFilled += 1;
  });

  const typeField = `asset_type_${String(asset.type).toLowerCase()}`;
  if (setOptionalCheckbox(form, typeField, true)) fieldsFilled += 1;

  if (fieldsFilled === 0) {
    throw new Error('La plantilla PDF no tiene campos rellenables compatibles. Debe prepararse con los nombres estándar del sistema.');
  }

  form.flatten();
  const bytes = await pdf.save();
  return new File([bytes], `acta-${act.fixedAssetIdSnapshot}.pdf`, { type: 'application/pdf' });
};

export const signActPdfElectronically = async (
  act: Act,
  template: ActTemplate,
  signatureDataUrl: string,
) => {
  if (!act.pdfUrl) throw new Error('El acta aún no tiene un PDF emitido para firmar.');
  const response = await fetch(act.pdfUrl);
  if (!response.ok) throw new Error('No se pudo abrir el PDF emitido para firmarlo.');

  const pdf = await PDFDocument.load(await response.arrayBuffer());
  const signatureBytes = dataUrlToBytes(signatureDataUrl);
  const image = signatureDataUrl.startsWith('data:image/jpeg')
    ? await pdf.embedJpg(signatureBytes)
    : await pdf.embedPng(signatureBytes);
  const placement: ActSignaturePlacement = template.signaturePlacement || {
    page: 1,
    x: 70,
    y: 120,
    width: 170,
    height: 58,
  };
  const pageIndex = Math.max(0, Math.min(pdf.getPageCount() - 1, placement.page - 1));
  const page = pdf.getPage(pageIndex);
  page.drawImage(image, {
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
  });

  // A small audit marker makes the simple electronic signature distinguishable
  // from a blank printed signature area without claiming cryptographic validity.
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText(`Firmado electrónicamente · ${formatDate()}`, {
    x: placement.x,
    y: Math.max(8, placement.y - 12),
    size: 7,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });

  const bytes = await pdf.save();
  return new File([bytes], `acta-${act.fixedAssetIdSnapshot}-firmada.pdf`, { type: 'application/pdf' });
};

export const signatureFileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('No se pudo leer la imagen de firma.'));
  reader.readAsDataURL(file);
});
