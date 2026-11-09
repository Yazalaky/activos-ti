import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseFunctions';
import type { Invoice, InvoicePaymentReceipt } from '../types';

type ConfirmInvoicePaymentReceiptRequest = {
  invoiceId: string;
  storagePath: string;
  action: 'add' | 'replace';
  replacePath?: string;
};

type ConfirmInvoicePaymentReceiptResponse = {
  paymentReceipt: InvoicePaymentReceipt;
  paymentReceipts: InvoicePaymentReceipt[];
};

export const getInvoicePaymentReceipts = (invoice: Invoice): InvoicePaymentReceipt[] => {
  const receipts = Array.isArray(invoice.paymentReceipts) ? invoice.paymentReceipts : [];
  const result: InvoicePaymentReceipt[] = [];
  for (const receipt of [...receipts, invoice.paymentReceipt]) {
    if (receipt?.path && !result.some((item) => item.path === receipt.path)) result.push(receipt);
  }
  return result;
};

export const ensureMultiplePaymentReceiptsSupported = async () => {
  const check = httpsCallable<{ action: 'capabilities' }, { supportsMultipleReceipts?: boolean }>(
    functions,
    'confirmInvoicePaymentReceipt',
  );
  const response = await check({ action: 'capabilities' });
  if (response.data.supportsMultipleReceipts !== true) throw new Error('Backend sin soporte para múltiples comprobantes.');
};

export const confirmInvoicePaymentReceipt = async (invoiceId: string, storagePath: string, replacePath?: string) => {
  const confirm = httpsCallable<ConfirmInvoicePaymentReceiptRequest, ConfirmInvoicePaymentReceiptResponse>(
    functions,
    'confirmInvoicePaymentReceipt',
  );
  const response = await confirm({ invoiceId, storagePath, action: replacePath ? 'replace' : 'add', ...(replacePath ? { replacePath } : {}) });
  return response.data;
};
