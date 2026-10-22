import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseFunctions';
import type { InvoicePaymentReceipt } from '../types';

type ConfirmInvoicePaymentReceiptRequest = {
  invoiceId: string;
  storagePath: string;
};

type ConfirmInvoicePaymentReceiptResponse = {
  paymentReceipt: InvoicePaymentReceipt;
};

export const confirmInvoicePaymentReceipt = async (invoiceId: string, storagePath: string) => {
  const confirm = httpsCallable<ConfirmInvoicePaymentReceiptRequest, ConfirmInvoicePaymentReceiptResponse>(
    functions,
    'confirmInvoicePaymentReceipt',
  );
  const response = await confirm({ invoiceId, storagePath });
  return response.data.paymentReceipt;
};
