import * as XLSX from 'xlsx';
import { IRecipient, ICreateInvoiceItem } from './invoice-interface';

export interface ParsedExcelData {
  recipients: IRecipient[];
  items: ICreateInvoiceItem[];
}

function extractCode(value: string | undefined | null): string {
  if (!value) return '';
  const str = String(value);
  const dashIndex = str.indexOf(' - ');
  return dashIndex > -1 ? str.substring(0, dashIndex).trim() : str.trim();
}

export function parseInvoiceTemplate(buffer: ArrayBuffer): ParsedExcelData {
  const wb = XLSX.read(buffer, { type: 'array' });

  // Parse Recipients sheet
  const recipientSheet = wb.Sheets['Recipients'];
  const recipientRows: Record<string, any>[] = recipientSheet
    ? XLSX.utils.sheet_to_json(recipientSheet)
    : [];

  const recipients: IRecipient[] = recipientRows
    .filter((row) => row['name'])
    .map((row) => ({
      name: String(row['name'] ?? ''),
      email: row['email'] ? String(row['email']) : undefined,
      phone: String(row['phone'] ?? ''),
      tin: String(row['tin'] ?? ''),
      registrationNumber: String(row['registrationNumber'] ?? ''),
      addressLine1: String(row['addressLine1'] ?? ''),
      postcode: String(row['postcode'] ?? ''),
      city: String(row['city'] ?? ''),
      state: extractCode(row['state']),
      countryCode: extractCode(row['countryCode']),
    }));

  // Parse Items sheet
  const itemSheet = wb.Sheets['Items'];
  const itemRows: Record<string, any>[] = itemSheet
    ? XLSX.utils.sheet_to_json(itemSheet)
    : [];

  const items: ICreateInvoiceItem[] = itemRows
    .filter((row) => row['itemName'])
    .map((row) => ({
      itemName: String(row['itemName'] ?? ''),
      quantity: Number(row['quantity'] ?? 1),
      unitPrice: Number(row['unitPrice'] ?? 0),
      classificationCode: extractCode(row['classificationCode']),
    }));

  return { recipients, items };
}
