import { HttpException, HttpStatus, Logger } from '@nestjs/common';

// Import your DTO (adjust path as needed)
// import { CalculatedInvoiceDto } from './dto/create-invoice.dto';

// Re-declare for standalone use - replace with actual import
interface InvoiceItemDTO {
  itemName: string;
  quantity: number;
  unitPrice: number;
  classificationCode: string;
}

interface RecipientDTO {
  name: string;
  email: string;
  phone: string;
  tin: string;
  registrationNumber: string;
  addressLine1: string;
  postcode: string;
  city: string;
  state: string;
  countryCode: string;
}

interface SupplierDTO {
  name: string;
  tin: string;
  registrationNumber: string;
  msicCode: string;
  businessActivityDescription: string;
}

interface CalculatedInvoiceDto {
  invoiceType: string;
  currency: string;
  supplier: SupplierDTO;
  recipient: RecipientDTO;
  taxRate: number;
  dueDate: string;
  items: InvoiceItemDTO[];
  invoiceNo: string;
  issuedDate: string;
  totalExcludingTax: number;
  totalIncludingTax: number;
}

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
 * ToyyibPay Utility Class
 * Handles payment bill creation and management with ToyyibPay API
 */
export class ToyyibPayUtil {
  private readonly logger = new Logger(ToyyibPayUtil.name);
  private readonly config: ToyyibPayConfig;

  constructor(config?: Partial<ToyyibPayConfig>) {
    this.config = {
      secretKey: config?.secretKey || process.env.PAYMENT_API_SECRET_URL || '',
      categoryCode: config?.categoryCode || process.env.PAYMENT_API_CATEGORY_CODE || '',
      baseUrl: config?.baseUrl || process.env.PAYMENT_API_BASE_URL || 'https://toyyibpay.com',
      returnUrl: config?.returnUrl || process.env.PAYMENT_API_RETURN_URL || '',
      callbackUrl: config?.callbackUrl || process.env.PAYMENT_API_CALLBACK_URL || '',
    };

    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.config.secretKey) {
      throw new Error('ToyyibPay secret key is required');
    }
    if (!this.config.categoryCode) {
      throw new Error('ToyyibPay category code is required');
    }
  }

  /**
   * Create a payment bill from invoice output DTO
   * @param invoiceOutput - The invoice output DTO containing invoice details
   * @returns ToyyibPayCreateBillResult with bill code and payment URL
   */
  async createBillFromCalculatedInvoiceData(invoiceOutput: CalculatedInvoiceDto): Promise<ToyyibPayCreateBillResult> {
    try {
      // Store invoice data as external reference (JSON stringified for retrieval)
      const externalReferenceData = this.createExternalReference(invoiceOutput);

      // Build bill request from invoice data
      const billRequest = this.mapInvoiceToBillRequest(invoiceOutput, externalReferenceData);

      // Create bill via API
      const response = await this.createBill(billRequest);

      if (!response || !response.BillCode) {
        throw new HttpException(
          'Failed to create ToyyibPay bill - Invalid response',
          HttpStatus.BAD_GATEWAY,
        );
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
   * Create external reference string from invoice output
   * Uses invoice number as primary reference with encoded data
   */
  private createExternalReference(invoiceOutput: CalculatedInvoiceDto): string {
    // Use invoice number as the primary external reference
     return invoiceOutput.invoiceNo;
  }

  /**
   * Map invoice output DTO to ToyyibPay bill request format
   */
  private mapInvoiceToBillRequest(
    invoiceOutput: CalculatedInvoiceDto,
    externalReferenceNo: string,
  ): ToyyibPayBillRequest {
    // Generate bill name (max 30 chars, alphanumeric + space + underscore only)
    const billName = this.sanitizeBillName(
      `INV ${invoiceOutput.invoiceNo.slice(-20)}`,
    );

    // Generate bill description (max 100 chars)
    const billDescription = this.sanitizeBillDescription(
      this.generateBillDescription(invoiceOutput),
    );

    // Convert amount to cents (ToyyibPay expects amount in cents)
    const billAmountInCents = Math.round(invoiceOutput.totalIncludingTax * 100);

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
   * Generate bill description from invoice items
   */
  private generateBillDescription(invoiceOutput: CalculatedInvoiceDto): string {
    const itemNames = invoiceOutput.items.map((item) => item.itemName).join(', ');
    return `Payment for ${itemNames} - Invoice ${invoiceOutput.invoiceNo}`;
  }

  /**
   * Generate additional email content for customer
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

Subtotal: ${invoiceOutput.currency} ${invoiceOutput.totalExcludingTax.toFixed(2)}
Tax (${invoiceOutput.taxRate}%): ${invoiceOutput.currency} ${(invoiceOutput.totalIncludingTax - invoiceOutput.totalExcludingTax).toFixed(2)}
Total: ${invoiceOutput.currency} ${invoiceOutput.totalIncludingTax.toFixed(2)}

From: ${invoiceOutput.supplier.name}
    `.trim();
  }

  /**
   * Sanitize bill name (max 30 chars, alphanumeric + space + underscore)
   */
  private sanitizeBillName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9\s_]/g, '')
      .substring(0, 30)
      .trim();
  }

  /**
   * Sanitize bill description (max 100 chars, alphanumeric + space + underscore)
   */
  private sanitizeBillDescription(description: string): string {
    return description
      .replace(/[^a-zA-Z0-9\s_]/g, '')
      .substring(0, 100)
      .trim();
  }

  /**
   * Sanitize customer name for ToyyibPay
   */
  private sanitizeCustomerName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .substring(0, 50)
      .trim();
  }

  /**
   * Format phone number for ToyyibPay (numeric only)
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters except +
    let formatted = phone.replace(/[^\d+]/g, '');
    
    // If starts with +60, remove the +
    if (formatted.startsWith('+')) {
      formatted = formatted.substring(1);
    }
    
    // Ensure it starts with country code for Malaysia
    if (formatted.startsWith('0')) {
      formatted = '60' + formatted.substring(1);
    }
    
    return formatted;
  }

  /**
   * Make API call to create bill on ToyyibPay
   */
  private async createBill(billRequest: ToyyibPayBillRequest): Promise<ToyyibPayBillResponse> {
    const url = `${this.config.baseUrl}/index.php/api/createBill`;

    // Convert request to form data
    const formData = new URLSearchParams();
    Object.entries(billRequest).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        throw new HttpException(
          `ToyyibPay API error: ${response.statusText}`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      const data = await response.json();

      // ToyyibPay returns array with single object
      if (Array.isArray(data) && data.length > 0) {
        return data[0] as ToyyibPayBillResponse;
      }

      // Handle error response
      if (data.error) {
        throw new HttpException(
          `ToyyibPay error: ${data.error}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      return data as ToyyibPayBillResponse;
    } catch (error) {
      this.logger.error(`ToyyibPay API call failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get bill transactions by bill code
   * Useful for checking payment status
   */
  async getBillTransactions(billCode: string, paymentStatus?: number): Promise<ToyyibPayTransaction[]> {
    const url = `${this.config.baseUrl}/index.php/api/getBillTransactions`;

    const formData = new URLSearchParams();
    formData.append('billCode', billCode);
    if (paymentStatus !== undefined) {
      formData.append('billpaymentStatus', String(paymentStatus));
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        throw new HttpException(
          `ToyyibPay API error: ${response.statusText}`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      const data = await response.json();
      return data as ToyyibPayTransaction[];
    } catch (error) {
      this.logger.error(`Failed to get bill transactions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse callback/return URL parameters from ToyyibPay
   * Call this in your callback/return endpoint
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
      orderId: params.order_id || '', // This is your invoiceNo
      amount: parseInt(params.amount || '0', 10) / 100, // Convert from cents
    };
  }

  /**
   * Parse return URL parameters (simpler version for redirect)
   */
  parseReturnParams(params: Record<string, string>): {
    statusId: number;
    billCode: string;
    orderId: string;
  } {
    return {
      statusId: parseInt(params.status_id || '0', 10),
      billCode: params.billcode || '',
      orderId: params.order_id || '', // This is your invoiceNo
    };
  }
}

// Factory function for easy instantiation
export function generateToyyibpayBill(config?: Partial<ToyyibPayConfig>): ToyyibPayUtil {
  return new ToyyibPayUtil(config);
}

// Alias for backward compatibility
export const createToyyibPayUtil = generateToyyibpayBill;

// Default export for convenience
export default ToyyibPayUtil;