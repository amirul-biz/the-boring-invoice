import { createHash } from 'crypto';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import {
  CalculatedInvoiceDto,
  InvoiceItemDTO,
  RecipientDTO,
  SupplierDTO,
} from '../invoice-dto';

// ToyyibPay Configuration
interface ToyyibPayConfig {
  secretKey: string;
  categoryCode: string;
  baseUrl: string;
  returnUrl?: string;
  callbackUrl?: string;
}

// ToyyibPay Bill Request
interface ToyyibPayBillRequest {
  userSecretKey: string;
  categoryCode: string;
  billName: string;
  billDescription: string;
  billPriceSetting: number;
  billPayorInfo: number;
  billAmount: number;
  billReturnUrl: string;
  billCallbackUrl: string;
  billExternalReferenceNo: string;
  billTo: string;
  billEmail: string;
  billPhone: string;
  billSplitPayment: number;
  billPaymentChannel: number;
  billDisplayMerchant: number;
  billContentEmail?: string;
  billChargeToCustomer?: number;
}

// ToyyibPay Bill Response
interface ToyyibPayBillResponse {
  BillCode: string;
}

// Result interface
export interface ToyyibPayCreateBillResult {
  success: boolean;
  billCode: string;
  paymentUrl: string;
  externalReferenceNo: string;
}

// Get Bill Transactions Response
export interface ToyyibPayTransaction {
  billName: string;
  billDescription: string;
  billTo: string;
  billEmail: string;
  billPhone: string;
  billStatus: string;
  billpaymentStatus: string;
  billpaymentChannel: string;
  billpaymentAmount: string;
  billpaymentInvoiceNo: string;
  billSplitPayment: string;
  billSplitPaymentArgs: string;
  billpaymentSettlement: string;
  billpaymentSettlementDate: string;
  SettlementReferenceNo: string;
  billPaymentDate: string;
  billExternalReferenceNo: string;
}

/**
 * ToyyibPay Utility Class.
 * Handles payment bill creation and management with ToyyibPay API.
 */
export class ToyyibPayUtil {
  private readonly logger = new Logger(ToyyibPayUtil.name);
  private readonly config: ToyyibPayConfig;

  constructor(config?: Partial<ToyyibPayConfig>) {
    this.config = {
      secretKey: config?.secretKey || '',
      categoryCode: config?.categoryCode || '',
      baseUrl: config?.baseUrl || process.env.PAYMENT_API_BASE_URL || 'https://toyyibpay.com',
      returnUrl: config?.returnUrl || process.env.PAYMENT_RETURN_URL || '',
      callbackUrl: config?.callbackUrl || '',
    };

    this.validateConfig();
  }

  /**
   * Create a payment bill from invoice output DTO.
   */
  async createBillFromCalculatedInvoiceData(invoiceOutput: CalculatedInvoiceDto): Promise<ToyyibPayCreateBillResult> {
    try {
      const externalReferenceData = this.createExternalReference(invoiceOutput);
      const billRequest = this.mapInvoiceToBillRequest(invoiceOutput, externalReferenceData);
      const formData = this.buildBillRequestFormData(billRequest);

      const raw = await this.postFormData<ToyyibPayBillResponse | ToyyibPayBillResponse[]>(
        '/index.php/api/createBill',
        formData,
      );

      // ToyyibPay returns array with single object
      let response: ToyyibPayBillResponse;
      if (Array.isArray(raw) && raw.length > 0) {
        response = raw[0];
      } else if ((raw as any).error) {
        throw new HttpException(`ToyyibPay error: ${(raw as any).error}`, HttpStatus.BAD_REQUEST);
      } else {
        response = raw as ToyyibPayBillResponse;
      }

      if (!response?.BillCode) {
        throw new HttpException('Failed to create ToyyibPay bill - Invalid response', HttpStatus.BAD_GATEWAY);
      }

      const billCode = response.BillCode;
      const paymentUrl = `${this.config.baseUrl}/${billCode}`;

      this.logger.log(`ToyyibPay bill created successfully: ${billCode}`);

      return {
        success: true,
        billCode,
        paymentUrl,
        externalReferenceNo: externalReferenceData,
      };
    } catch (error) {
      this.logger.error(`Failed to create ToyyibPay bill: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get bill transactions by bill code.
   * Useful for checking payment status.
   */
  async getBillTransactions(billCode: string, paymentStatus?: number): Promise<ToyyibPayTransaction[]> {
    const formData = new URLSearchParams();
    formData.append('billCode', billCode);
    if (paymentStatus !== undefined) {
      formData.append('billpaymentStatus', String(paymentStatus));
    }

    try {
      return await this.postFormData<ToyyibPayTransaction[]>('/index.php/api/getBillTransactions', formData);
    } catch (error) {
      this.logger.error(`Failed to get bill transactions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse callback/return URL parameters from ToyyibPay.
   * Call this in your callback/return endpoint.
   */
  parseCallbackParams(params: Record<string, string>): {
    refNo: string;
    status: 'success' | 'pending' | 'failed';
    reason: string;
    billCode: string;
    orderId: string;
    amount: number;
  } {
    const statusMap: Record<string, 'success' | 'pending' | 'failed'> = {
      '1': 'success',
      '2': 'pending',
      '3': 'failed',
    };

    return {
      refNo: params.refno || '',
      status: statusMap[params.status] || statusMap[params.status_id] || 'failed',
      reason: params.reason || '',
      billCode: params.billcode || '',
      orderId: params.order_id || '',
      amount: parseInt(params.amount || '0', 10) / 100,
    };
  }

  /**
   * Verify ToyyibPay callback hash signature.
   * Formula: MD5(secretKey + billCode + status_id)
   */
  static verifyCallbackHash(secretKey: string, receivedHash: string, billCode: string, statusId: string): boolean {
    const expected = createHash('md5')
      .update(secretKey.trim() + billCode + statusId)
      .digest('hex');
    return expected === receivedHash;
  }

  /**
   * Parse return URL parameters (simpler version for redirect).
   */
  parseReturnParams(params: Record<string, string>): {
    statusId: number;
    billCode: string;
    orderId: string;
  } {
    return {
      statusId: parseInt(params.status_id || '0', 10),
      billCode: params.billcode || '',
      orderId: params.order_id || '',
    };
  }

  /**
   * Deactivate a ToyyibPay bill so the payment link stops working.
   */
  static async deactivateBill(
    billCode: string,
    secretKey: string,
    baseUrl = process.env.PAYMENT_API_BASE_URL || 'https://toyyibpay.com',
  ): Promise<void> {
    const url = `${baseUrl}/index.php/api/inactiveBill`;
    const formData = new URLSearchParams();
    formData.append('secretKey', secretKey);
    formData.append('billCode', billCode);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    const logger = new Logger(ToyyibPayUtil.name);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
        signal: controller.signal,
      });

      if (!response.ok) {
        logger.warn(`deactivateBill HTTP error for ${billCode}: ${response.statusText}`);
        return;
      }

      const text = await response.text();
      logger.log(`deactivateBill response for ${billCode}: ${text}`);
    } catch (error) {
      if (error.name === 'AbortError') {
        logger.warn(`deactivateBill timed out for ${billCode}`);
        return;
      }
      logger.warn(`deactivateBill failed for ${billCode}: ${error.message}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fetch bill transactions directly from ToyyibPay API (no authentication required).
   * Use this to verify payment status authoritatively instead of trusting callback hash.
   */
  static async fetchBillTransactions(
    billCode: string,
    baseUrl = process.env.PAYMENT_API_BASE_URL || 'https://toyyibpay.com',
  ): Promise<ToyyibPayTransaction[]> {
    const url = `${baseUrl}/index.php/api/getBillTransactions`;
    const formData = new URLSearchParams();
    formData.append('billCode', billCode);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new HttpException(
          `ToyyibPay getBillTransactions error: ${response.statusText}`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      const text = await response.text();
      return JSON.parse(text) as ToyyibPayTransaction[];
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('ToyyibPay getBillTransactions timed out after 10s', HttpStatus.GATEWAY_TIMEOUT);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * @private
   */
  private validateConfig(): void {
    if (!this.config.secretKey) {
      throw new Error('ToyyibPay secret key is required');
    }
    if (!this.config.categoryCode) {
      throw new Error('ToyyibPay category code is required');
    }
  }

  /**
   * Shared HTTP POST helper — builds URL, posts form data, parses JSON response.
   * @private
   */
  private async postFormData<T>(path: string, formData: URLSearchParams): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    if (!response.ok) {
      throw new HttpException(`ToyyibPay API error: ${response.statusText}`, HttpStatus.BAD_GATEWAY);
    }

    const responseText = await response.text();
    try {
      return JSON.parse(responseText) as T;
    } catch {
      this.logger.error(`ToyyibPay API returned non-JSON response: ${responseText}`);
      throw new HttpException(`ToyyibPay API error: ${responseText}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Build URLSearchParams from a bill request object.
   * @private
   */
  private buildBillRequestFormData(billRequest: ToyyibPayBillRequest): URLSearchParams {
    const formData = new URLSearchParams();
    Object.entries(billRequest).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });
    return formData;
  }

  /**
   * Use invoice number as the primary external reference.
   * @private
   */
  private createExternalReference(invoiceOutput: CalculatedInvoiceDto): string {
    return invoiceOutput.invoiceNo;
  }

  /**
   * Map invoice output DTO to ToyyibPay bill request format.
   * @private
   */
  private mapInvoiceToBillRequest(
    invoiceOutput: CalculatedInvoiceDto,
    externalReferenceNo: string,
  ): ToyyibPayBillRequest {
    // Generate bill name (max 30 chars, alphanumeric + space + underscore only)
    const billName = this.sanitizeBillName(`INV ${invoiceOutput.invoiceNo.slice(-20)}`);

    // Generate bill description (max 100 chars)
    const billDescription = this.sanitizeBillDescription(this.generateBillDescription(invoiceOutput));

    // Convert amount to cents (ToyyibPay expects amount in cents)
    const billAmountInCents = Math.round(invoiceOutput.totalPayableAmount * 100);

    // Format phone number (remove any non-numeric characters except +)
    const formattedPhone = this.formatPhoneNumber(invoiceOutput.recipient.phone);

    return {
      userSecretKey: this.config.secretKey,
      categoryCode: this.config.categoryCode,
      billName,
      billDescription,
      billPriceSetting: 1, // Fixed amount
      billPayorInfo: 1, // Require payer info
      billAmount: billAmountInCents,
      billReturnUrl: this.config.returnUrl || '',
      billCallbackUrl: this.config.callbackUrl || '',
      billExternalReferenceNo: externalReferenceNo,
      billTo: this.sanitizeCustomerName(invoiceOutput.recipient.name),
      billEmail: invoiceOutput.recipient.email || '',
      billPhone: formattedPhone,
      billSplitPayment: 0, // No split payment
      billPaymentChannel: 2, // Both FPX and Credit Card
      billDisplayMerchant: 1, // Display merchant info
      billContentEmail: this.generateEmailContent(invoiceOutput),
    };
  }

  /**
   * Generate bill description from invoice items.
   * @private
   */
  private generateBillDescription(invoiceOutput: CalculatedInvoiceDto): string {
    const itemNames = invoiceOutput.items.map((item) => item.itemName).join(', ');
    return `Payment for ${itemNames} - Invoice ${invoiceOutput.invoiceNo}`;
  }

  /**
   * Generate additional email content for customer.
   * @private
   */
  private generateEmailContent(invoiceOutput: CalculatedInvoiceDto): string {
    const itemsList = invoiceOutput.items
      .map((item) => `${item.itemName} x${item.quantity}: ${invoiceOutput.currency} ${(item.unitPrice * item.quantity).toFixed(2)}`)
      .join('\n');

    return `
Invoice Details:
----------------
Invoice No: ${invoiceOutput.invoiceNo}
Issued Date: ${invoiceOutput.issuedDate}
Due Date: ${invoiceOutput.dueDate}

Items:
${itemsList}

Net Amount: ${invoiceOutput.currency} ${invoiceOutput.totalNetAmount.toFixed(2)}
Total Tax: ${invoiceOutput.currency} ${invoiceOutput.totalTaxAmount.toFixed(2)}
Total: ${invoiceOutput.currency} ${invoiceOutput.totalPayableAmount.toFixed(2)}

From: ${invoiceOutput.supplier.name}
    `.trim();
  }

  /**
   * Sanitize bill name (max 30 chars, alphanumeric + space + underscore).
   * @private
   */
  private sanitizeBillName(name: string): string {
    return name.replace(/[^a-zA-Z0-9\s_]/g, '').substring(0, 30).trim();
  }

  /**
   * Sanitize bill description (max 100 chars, alphanumeric + space + underscore).
   * @private
   */
  private sanitizeBillDescription(description: string): string {
    return description.replace(/[^a-zA-Z0-9\s_]/g, '').substring(0, 100).trim();
  }

  /**
   * Sanitize customer name for ToyyibPay.
   * @private
   */
  private sanitizeCustomerName(name: string): string {
    return name.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 50).trim();
  }

  /**
   * Format phone number for ToyyibPay (numeric only, Malaysia format).
   * @private
   */
  private formatPhoneNumber(phone: string): string {
    let formatted = phone.replace(/[^\d+]/g, '');

    if (formatted.startsWith('+')) {
      formatted = formatted.substring(1);
    }

    if (formatted.startsWith('0')) {
      formatted = '60' + formatted.substring(1);
    }

    return formatted;
  }
}

/**
 * Factory function for easy instantiation.
 */
export function generateToyyibpayBill(config?: Partial<ToyyibPayConfig>): ToyyibPayUtil {
  return new ToyyibPayUtil(config);
}

export default ToyyibPayUtil;
