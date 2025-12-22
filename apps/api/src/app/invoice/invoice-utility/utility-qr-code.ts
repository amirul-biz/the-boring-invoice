import * as QRCode from 'qrcode';

export interface QRCodeOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

/**
 * QR Code Utility for generating payment QR codes
 * Serverless-compatible - no binary dependencies
 */
export class QRCodeUtil {
  private readonly defaultOptions: QRCodeOptions = {
    width: 120,
    margin: 1,
    color: {
      dark: '#1a365d',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'H',
  };

  /**
   * Generate QR code as buffer for PDF embedding
   */
  async toBuffer(content: string, options?: QRCodeOptions): Promise<Buffer> {
    const mergedOptions = { ...this.defaultOptions, ...options };

    const qrOptions: QRCode.QRCodeToBufferOptions = {
      width: mergedOptions.width,
      margin: mergedOptions.margin,
      color: mergedOptions.color,
      errorCorrectionLevel: mergedOptions.errorCorrectionLevel,
      type: 'png',
    };

    return QRCode.toBuffer(content, qrOptions);
  }

  /**
   * Generate QR code as data URL (for web display)
   */
  async toDataUrl(content: string, options?: QRCodeOptions): Promise<string> {
    const mergedOptions = { ...this.defaultOptions, ...options };

    const qrOptions: QRCode.QRCodeToDataURLOptions = {
      width: mergedOptions.width,
      margin: mergedOptions.margin,
      color: mergedOptions.color,
      errorCorrectionLevel: mergedOptions.errorCorrectionLevel,
    };

    return QRCode.toDataURL(content, qrOptions);
  }

  /**
   * Generate QR code for a payment bill URL
   */
  async generatePaymentQR(billUrl: string, size: number = 120): Promise<Buffer> {
    return this.toBuffer(billUrl, {
      width: size,
      margin: 1,
      color: {
        dark: '#1a365d',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    });
  }
}

export function createQRCodeUtil(): QRCodeUtil {
  return new QRCodeUtil();
}

export default QRCodeUtil;