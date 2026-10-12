import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { Act, ActDocumentDetails, ActTemplate } from '../types';
import aliadosPdf from '../assets/act-templates/pdf/Acta Aliados.pdf?url';
import cmiPdf from '../assets/act-templates/pdf/Acta CMI.pdf?url';
import gestionarPdf from '../assets/act-templates/pdf/Acta Gestionar.pdf?url';
import logrosPdf from '../assets/act-templates/pdf/Acta Logros.pdf?url';
import medicucPdf from '../assets/act-templates/pdf/Acta Medicuc.pdf?url';
import redinsaludPdf from '../assets/act-templates/pdf/Acta Redinsalud.pdf?url';
import rehabilitdemosPdf from '../assets/act-templates/pdf/Acta Rehabilitdemos.pdf?url';
import saludFamiliaPdf from '../assets/act-templates/pdf/Acta Salud Familia.pdf?url';
import aliadosHeaderOne from '../assets/act-templates/headers/Acta Aliados - page1.png?url';
import aliadosHeaderTwo from '../assets/act-templates/headers/Acta Aliados - page2.png?url';
import cmiHeaderOne from '../assets/act-templates/headers/Acta CMI - page1.png?url';
import cmiHeaderTwo from '../assets/act-templates/headers/Acta CMI - page2.png?url';
import gestionarHeaderOne from '../assets/act-templates/headers/Acta Gestionar - page1.png?url';
import gestionarHeaderTwo from '../assets/act-templates/headers/Acta Gestionar - page2.png?url';
import logrosHeaderOne from '../assets/act-templates/headers/Acta Logros - page1.png?url';
import logrosHeaderTwo from '../assets/act-templates/headers/Acta Logros - page2.png?url';
import medicucHeaderOne from '../assets/act-templates/headers/Acta Medicuc - page1.png?url';
import medicucHeaderTwo from '../assets/act-templates/headers/Acta Medicuc - page2.png?url';
import redinsaludHeaderOne from '../assets/act-templates/headers/Acta Redinsalud - page1.png?url';
import redinsaludHeaderTwo from '../assets/act-templates/headers/Acta Redinsalud - page2.png?url';
import rehabilitdemosHeaderOne from '../assets/act-templates/headers/Acta Rehabilitdemos - page1.png?url';
import rehabilitdemosHeaderTwo from '../assets/act-templates/headers/Acta Rehabilitdemos - page2.png?url';
import saludFamiliaHeaderOne from '../assets/act-templates/headers/Acta Salud Familia - page1.png?url';
import saludFamiliaHeaderTwo from '../assets/act-templates/headers/Acta Salud Familia - page2.png?url';

const companyTemplateById: Record<string, {
  pdfUrl: string;
  headerOneUrl: string;
  headerTwoUrl: string;
  headerRect: { x: number; top: number; width: number; height: number };
}> = {
  aliados: { pdfUrl: aliadosPdf, headerOneUrl: aliadosHeaderOne, headerTwoUrl: aliadosHeaderTwo, headerRect: { x: 67.5, top: 31.45, width: 161.25, height: 24.45 } },
  cmi: { pdfUrl: cmiPdf, headerOneUrl: cmiHeaderOne, headerTwoUrl: cmiHeaderTwo, headerRect: { x: 85.05, top: 15.3, width: 103.2, height: 60.85 } },
  gestionbienestar: { pdfUrl: gestionarPdf, headerOneUrl: gestionarHeaderOne, headerTwoUrl: gestionarHeaderTwo, headerRect: { x: 51.3, top: 19.8, width: 183.75, height: 48 } },
  logros: { pdfUrl: logrosPdf, headerOneUrl: logrosHeaderOne, headerTwoUrl: logrosHeaderTwo, headerRect: { x: 79.8, top: 20, width: 125.2, height: 51.6 } },
  medicuc: { pdfUrl: medicucPdf, headerOneUrl: medicucHeaderOne, headerTwoUrl: medicucHeaderTwo, headerRect: { x: 50.65, top: 23.85, width: 169.2, height: 42.1 } },
  redinsalud: { pdfUrl: redinsaludPdf, headerOneUrl: redinsaludHeaderOne, headerTwoUrl: redinsaludHeaderTwo, headerRect: { x: 49.05, top: 5.65, width: 392.9, height: 132.35 } },
  rehabilitdemos: { pdfUrl: rehabilitdemosPdf, headerOneUrl: rehabilitdemosHeaderOne, headerTwoUrl: rehabilitdemosHeaderTwo, headerRect: { x: 57.75, top: 18.7, width: 169.5, height: 50.6 } },
  saludfamilia: { pdfUrl: saludFamiliaPdf, headerOneUrl: saludFamiliaHeaderOne, headerTwoUrl: saludFamiliaHeaderTwo, headerRect: { x: 80.55, top: 23.2, width: 121.95, height: 47.7 } },
};

const formatDate = (date = new Date()) => new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}).format(date);

const drawTextTop = (
  page: PDFPage,
  text: string,
  x: number,
  top: number,
  width: number,
  font: PDFFont,
  size = 8.5,
  align: 'left' | 'center' = 'left',
) => {
  const value = String(text || '').trim();
  if (!value || width <= 0) return;

  let fontSize = size;
  while (fontSize > 5.4 && font.widthOfTextAtSize(value, fontSize) > width) fontSize -= 0.25;
  let fitted = value;
  if (font.widthOfTextAtSize(fitted, fontSize) > width) {
    while (fitted.length > 1 && font.widthOfTextAtSize(`${fitted}…`, fontSize) > width) fitted = fitted.slice(0, -1);
    fitted = `${fitted}…`;
  }
  const textWidth = font.widthOfTextAtSize(fitted, fontSize);
  const textX = align === 'center' ? x + Math.max(0, (width - textWidth) / 2) : x;
  page.drawText(fitted, {
    x: textX,
    y: page.getHeight() - top - fontSize,
    size: fontSize,
    font,
    color: rgb(0.08, 0.08, 0.08),
  });
};

const coverField = (
  page: PDFPage,
  x: number,
  top: number,
  width: number,
  height: number,
) => page.drawRectangle({
  x,
  y: page.getHeight() - top - height,
  width,
  height,
  color: rgb(1, 1, 1),
});

const drawCheck = (
  page: PDFPage,
  x: number,
  top: number,
  size = 6,
) => {
  const toPdfY = (value: number) => page.getHeight() - value;
  page.drawLine({
    start: { x: x + 1, y: toPdfY(top + size * 0.52) },
    end: { x: x + size * 0.38, y: toPdfY(top + size - 1) },
    thickness: 1.15,
    color: rgb(0.05, 0.05, 0.05),
  });
  page.drawLine({
    start: { x: x + size * 0.38, y: toPdfY(top + size - 1) },
    end: { x: x + size - 0.8, y: toPdfY(top + 1) },
    thickness: 1.15,
    color: rgb(0.05, 0.05, 0.05),
  });
};

const drawBox = (
  page: PDFPage,
  x: number,
  top: number,
  checked: boolean,
  size = 6,
) => {
  page.drawRectangle({
    x,
    y: page.getHeight() - top - size,
    width: size,
    height: size,
    borderWidth: 0.7,
    borderColor: rgb(0.1, 0.1, 0.1),
  });
  if (checked) drawCheck(page, x, top, size);
};

const wrapText = (text: string, width: number, font: PDFFont, fontSize: number) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [] as string[];
  const lines: string[] = [];
  let line = '';
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines;
};

const drawWrappedText = (
  page: PDFPage,
  text: string,
  x: number,
  top: number,
  width: number,
  maxHeight: number,
  font: PDFFont,
) => {
  const fontSize = 8.2;
  const lineHeight = 10.5;
  const lines = wrapText(text, width, font, fontSize);

  const linesPerPage = Math.max(1, Math.floor(maxHeight / lineHeight));
  const firstPageLines = lines.slice(0, linesPerPage);
  firstPageLines.forEach((item, index) => {
    drawTextTop(page, item, x, top + index * lineHeight, width, font, fontSize);
  });
  return lines.slice(linesPerPage);
};

const defaultDocumentDetails = (act: Act): ActDocumentDetails => ({
  deviceTypes: {
    desktop: act.assetSnapshot.type === 'desktop',
    laptop: act.assetSnapshot.type === 'laptop',
    printer: act.assetSnapshot.type === 'printer',
    tablet: false,
    cellphone: false,
    other: !['desktop', 'laptop', 'printer'].includes(act.assetSnapshot.type),
  },
  otherDeviceType: act.assetSnapshot.type,
  standardSoftware: { office365: false, antivirus: false, adobeReader: false, sevenZip: false, chrome: false, mozilla: false },
  requestedSoftware: { tns: false, tipificador: false, progsalud: false, ccleaner: false, ipscan: false, anydesk: false },
  discountSources: { fees: false, salary: false, benefits: false },
});

const drawHardwareType = (
  page: PDFPage,
  details: ActDocumentDetails,
  font: PDFFont,
) => {
  // Normalize minor differences among the old company files (including one pre-checked laptop).
  coverField(page, 50.5, 189, 110.8, 43.7);
  const firstLineTop = 191.5;
  drawTextTop(page, 'Desktop', 53.2, firstLineTop, 25, font, 7.2);
  drawBox(page, 79.5, 194.2, details.deviceTypes.desktop, 6);
  drawTextTop(page, 'Laptop', 90, firstLineTop, 24, font, 7.2);
  drawBox(page, 115, 194.2, details.deviceTypes.laptop, 6);

  const secondLineTop = 204.2;
  drawTextTop(page, 'Celular', 53.2, secondLineTop, 22, font, 6.8);
  drawBox(page, 76, 206.9, details.deviceTypes.cellphone, 6);
  drawTextTop(page, 'Tablet', 88, secondLineTop, 18, font, 6.8);
  drawBox(page, 107, 206.9, details.deviceTypes.tablet, 6);

  const thirdLineTop = 216.8;
  drawTextTop(page, 'Impresora', 53.2, thirdLineTop, 29, font, 6.8);
  drawBox(page, 83, 219.5, details.deviceTypes.printer, 6);
  const otherTypeLabel = details.deviceTypes.other ? (details.otherDeviceType?.trim() || 'Otro') : 'Otro';
  drawTextTop(page, otherTypeLabel, 94, thirdLineTop, 47, font, 6.8);
  drawBox(page, 145, 219.5, details.deviceTypes.other, 6);
};

const drawSoftwareChecks = (page: PDFPage, details: ActDocumentDetails, font: PDFFont) => {
  const centers = [372, 387.5, 403, 418.5, 434, 449.5];
  const standard = Object.values(details.standardSoftware);
  const requested = Object.values(details.requestedSoftware);
  standard.forEach((checked, index) => {
    coverField(page, 225.3, centers[index] - 4.5, 9, 9);
    drawBox(page, 226.3, centers[index] - 3.5, checked, 7);
  });
  requested.forEach((checked, index) => {
    coverField(page, 339.2, centers[index] - 4.5, 9, 9);
    drawBox(page, 340.2, centers[index] - 3.5, checked, 7);
  });

  const otherEntries = String(details.otherSoftware || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 6);
  centers.forEach((center, index) => {
    const rowTop = 365.3 + index * 15.5;
    // Clear any company-specific prefilled software text (e.g. "PDF 24")
    // without erasing the table's grid lines.
    coverField(page, 357, rowTop - 1.5, 74.5, 13);
    coverField(page, 458, rowTop + 1.8, 9, 9);
    drawBox(page, 459, rowTop + 2.8, Boolean(otherEntries[index]), 7);
    if (otherEntries[index]) drawTextTop(page, otherEntries[index], 357.5, rowTop, 76, font, 7.4);
  });
  // Restore the software table separators where a legacy PDF had prefilled text.
  centers.forEach((_, index) => {
    const y = page.getHeight() - (364.5 + index * 15.5);
    page.drawLine({
      start: { x: 49.8, y },
      end: { x: 491.2, y },
      thickness: 0.45,
      color: rgb(0.3, 0.3, 0.3),
    });
  });
};

const drawActPageOne = (
  page: PDFPage,
  act: Act,
  details: ActDocumentDetails,
  delivererName: string,
  font: PDFFont,
) => {
  const recipient = act.recipient;
  drawTextTop(page, recipient.fullName, 96, 106.5, 132, font, 9);
  // The legacy files split this label as "Carg\no" because its cell is narrow.
  coverField(page, 236.5, 99, 24, 24);
  drawTextTop(page, 'Cargo', 237.5, 107, 22, font, 6.8);
  drawTextTop(page, recipient.position, 263, 106.5, 60, font, 8.5);
  drawTextTop(page, recipient.networkUser || '', 389, 106.5, 98, font, 8.3);
  drawTextTop(page, recipient.email || '', 96, 132, 132, font, 8.2);
  drawTextTop(page, recipient.area || '', 263, 132, 60, font, 8.3);
  const phone = [recipient.phone, recipient.extension ? `Ext. ${recipient.extension}` : ''].filter(Boolean).join(' ');
  drawTextTop(page, phone, 389, 132, 98, font, 8.2);

  drawHardwareType(page, details, font);
  const asset = act.assetSnapshot;
  drawTextTop(page, act.fixedAssetIdSnapshot, 166, 203, 62, font, 8);
  drawTextTop(page, asset.brand, 236, 203, 86, font, 8);
  drawTextTop(page, asset.model, 331, 203, 68, font, 8);
  drawTextTop(page, asset.serial, 408, 203, 78, font, 8);
  drawTextTop(page, asset.processor || '', 53, 258.8, 104, font, 7.3);
  drawTextTop(page, asset.ram || '', 166, 258.8, 61, font, 7.3);
  drawTextTop(page, asset.storage || '', 236, 258.8, 86, font, 7.3);
  drawTextTop(page, details.charger || '', 331, 258.8, 68, font, 7.3);
  drawTextTop(page, details.mouse || '', 408, 258.8, 78, font, 7.3);
  drawTextTop(page, details.monitor || '', 53, 296.5, 104, font, 7.3);
  drawTextTop(page, details.license || '', 166, 296.5, 61, font, 7.3);
  drawTextTop(page, details.keyboard || '', 236, 296.5, 86, font, 7.3);
  drawTextTop(page, details.phoneSerial || '', 331, 296.5, 68, font, 7.3);
  drawTextTop(page, details.phoneImei || '', 408, 296.5, 78, font, 7.3);

  drawSoftwareChecks(page, details, font);
  drawTextTop(page, recipient.fullName, 112, 654.8, 150, font, 8.3);
  drawTextTop(page, delivererName, 330, 654.8, 154, font, 8.3);
};

const drawActPageTwo = (
  page: PDFPage,
  act: Act,
  details: ActDocumentDetails,
  companyName: string,
  nit: string,
  date: string,
  font: PDFFont,
) => {
  const recipient = act.recipient;
  drawTextTop(page, date, 100, 94, 155, font, 9, 'center');
  drawTextTop(page, date, 285, 94, 200, font, 9, 'center');

  // Recompose this legal block so variable-length names and company data never
  // collide with the original underline placeholders or wrap unpredictably.
  coverField(page, 80, 189, 456, 218);
  const party = details.partyType === 'contractor' ? 'Contratista' : 'trabajador';
  const liability = `El ${party} se hará responsable de los daños ocasionados por mal uso de los dispositivos electrónicos, tales como: golpes, dejar conectado el dispositivo por más de 4 horas continuas a la energía (equipos móviles y portátiles), inmersión en líquidos que puedan causar daño o pérdida total de los equipos y periféricos. Asimismo, será responsable de la custodia y seguridad de los equipos o dispositivos entregados.`;
  const deductionSources = [
    `honorarios ${details.discountSources.fees ? '(X)' : '( )'}`,
    `salarios ${details.discountSources.salary ? '(X)' : '( )'}`,
    `prestaciones sociales ${details.discountSources.benefits ? '(X)' : '( )'}`,
  ].join(', ');
  const amountWords = details.discountAmountWords?.trim() || '________________________';
  const amountValue = details.discountAmountValue?.trim() || '________________';
  const authorization = `En tal virtud: Yo, ${recipient.fullName}, identificado(a) con C.C. N° ${recipient.documentNumber || '________________'}, de manera expresa AUTORIZO a ${companyName}, distinguida con el NIT ${nit}, para que sea descontado de ${deductionSources} o de cualquier otra suma de dinero que por cualquier concepto me adeude la empresa el valor de ${amountWords} ($ ${amountValue}), por concepto de daños o pérdida de los equipos y/o instrumentos que me están siendo entregados por medio de la presente acta y que se encuentran bajo mi responsabilidad.`;
  const legalFontSize = 8.2;
  const legalLineHeight = 10.5;
  const legalWidth = 444;
  const liabilityLines = wrapText(liability, legalWidth, font, legalFontSize);
  liabilityLines.forEach((line, index) => drawTextTop(page, line, 85, 193 + index * legalLineHeight, legalWidth, font, legalFontSize));
  const authorizationTop = 200 + liabilityLines.length * legalLineHeight;
  const authorizationLines = wrapText(authorization, legalWidth, font, legalFontSize);
  authorizationLines.forEach((line, index) => drawTextTop(page, line, 85, authorizationTop + index * legalLineHeight, legalWidth, font, legalFontSize));

  coverField(page, 120, 530.5, 168, 15);
  drawTextTop(page, recipient.fullName, 122, 531, 164, font, 8.4);
  coverField(page, 120, 552.5, 169, 15);
  drawTextTop(page, recipient.documentNumber || '', 122, 553, 165, font, 8.4);

  const observations = String(act.observations || '').trim();
  if (observations) {
    const left = 49.6;
    const boxTop = 600;
    const boxHeight = 106;
    page.drawRectangle({
      x: left,
      y: page.getHeight() - boxTop - boxHeight,
      width: 441.9,
      height: boxHeight,
      borderWidth: 0.7,
      borderColor: rgb(0.45, 0.45, 0.45),
    });
    drawTextTop(page, 'OBSERVACIONES ADICIONALES', left + 7, boxTop + 6, 426, font, 8.5);
    page.drawLine({
      start: { x: left, y: page.getHeight() - (boxTop + 20) },
      end: { x: left + 441.9, y: page.getHeight() - (boxTop + 20) },
      thickness: 0.5,
      color: rgb(0.6, 0.6, 0.6),
    });
    return drawWrappedText(page, observations, left + 7, boxTop + 27, 426, boxHeight - 33, font);
  }
  return [] as string[];
};

export const generateActPdf = async (
  act: Act,
  companyTemplate: ActTemplate,
  delivererName = '',
) => {
  const companyTemplateFiles = companyTemplateById[act.companyId];
  if (!companyTemplateFiles) throw new Error('No hay un formato de acta interno para la empresa seleccionada.');
  const [response, headerOneResponse, headerTwoResponse] = await Promise.all([
    fetch(companyTemplateFiles.pdfUrl),
    fetch(companyTemplateFiles.headerOneUrl),
    fetch(companyTemplateFiles.headerTwoUrl),
  ]);
  if (!response.ok || !headerOneResponse.ok || !headerTwoResponse.ok) throw new Error('No se pudo cargar el formato interno del acta.');

  const pdf = await PDFDocument.create();
  const [backgroundOne, backgroundTwo] = await pdf.embedPdf(await response.arrayBuffer(), [0, 1]);
  const [flattenedHeaderOne, flattenedHeaderTwo] = await Promise.all([
    pdf.embedPng(await headerOneResponse.arrayBuffer()),
    pdf.embedPng(await headerTwoResponse.arrayBuffer()),
  ]);
  if (!backgroundOne || !backgroundTwo) throw new Error('El formato interno del acta no tiene las dos páginas esperadas.');
  const pageOne = pdf.addPage([backgroundOne.width, backgroundOne.height]);
  const pageTwo = pdf.addPage([backgroundTwo.width, backgroundTwo.height]);
  pageOne.drawPage(backgroundOne, { x: 0, y: 0, width: backgroundOne.width, height: backgroundOne.height });
  pageTwo.drawPage(backgroundTwo, { x: 0, y: 0, width: backgroundTwo.width, height: backgroundTwo.height });
  const { x: headerX, top: headerTop, width: headerWidth, height: headerHeight } = companyTemplateFiles.headerRect;
  const headerY = pageOne.getHeight() - headerTop - headerHeight;
  pageOne.drawImage(flattenedHeaderOne, { x: headerX, y: headerY, width: headerWidth, height: headerHeight });
  pageTwo.drawImage(flattenedHeaderTwo, { x: headerX, y: headerY, width: headerWidth, height: headerHeight });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const defaults = defaultDocumentDetails(act);
  const details: ActDocumentDetails = {
    ...defaults,
    ...act.documentDetails,
    deviceTypes: { ...defaults.deviceTypes, ...act.documentDetails?.deviceTypes },
    standardSoftware: { ...defaults.standardSoftware, ...act.documentDetails?.standardSoftware },
    requestedSoftware: { ...defaults.requestedSoftware, ...act.documentDetails?.requestedSoftware },
    discountSources: { ...defaults.discountSources, ...act.documentDetails?.discountSources },
  };
  const date = formatDate();
  const companyName = companyTemplate.companyName || act.companyId;
  const nit = act.companyNitSnapshot || companyTemplate.nit || '';
  drawActPageOne(pageOne, act, details, delivererName, font);
  const remainingObservations = drawActPageTwo(pageTwo, act, details, companyName, nit, date, font);
  if (remainingObservations.length) {
    const extraPage = pdf.addPage([612, 792]);
    drawTextTop(extraPage, `OBSERVACIONES · ${act.fixedAssetIdSnapshot}`, 50, 48, 510, font, 12);
    remainingObservations.forEach((line, index) => drawTextTop(extraPage, line, 50, 75 + index * 11, 510, font, 8.2));
  }

  const bytes = await pdf.save();
  const safeFixedAssetId = act.fixedAssetIdSnapshot.replace(/[^a-zA-Z0-9-]/g, '-');
  return new File([bytes], `acta-${safeFixedAssetId}.pdf`, { type: 'application/pdf' });
};
