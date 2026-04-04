export const INVOICE_QUEUE_CONFIG = {
  /** Maximum number of retry attempts before routing to failed queue */
  MAX_RETRY_ATTEMPTS: 5,
  /** Attempt number assigned when first entering the retry queue */
  INITIAL_RETRY_ATTEMPT: 1,
  /** Delay in milliseconds between retry attempts (1 minute) */
  RETRY_DELAY_MS: 60_000,
  /** Delay in milliseconds between invoices in a batch (1.5 seconds) */
  BATCH_DELAY_MS: 1_500,
  /** Timeout in ms for emitting a single message to the queue (fail-fast on reconnect) */
  QUEUE_EMIT_TIMEOUT_MS: 5_000,
} as const;

export const INVOICE_QUEUE_PATTERNS = {
  // Invoice creation queue
  CREATE_INVOICE:                  'create-invoice',
  RETRY_CREATE_INVOICE:            'retry-create-invoice',
  FAILED_CREATE_INVOICE:           'failed-create-invoice',

  // Notify invoice via email queue
  NOTIFY_INVOICE_VIA_EMAIL:        'notify-invoice-via-email',

  // Deactivate bill queue
  DEACTIVATE_INVOICE_BILL:         'deactivate-invoice-bill',
  RETRY_DEACTIVATE_INVOICE_BILL:   'retry-deactivate-invoice-bill',
  FAILED_DEACTIVATE_INVOICE_BILL:  'failed-deactivate-invoice-bill',

  // Mark invoice as paid queue
  MARK_INVOICE_AS_PAID:            'mark-invoice-as-paid',
  RETRY_MARK_INVOICE_AS_PAID:      'retry-mark-invoice-as-paid',
  FAILED_MARK_INVOICE_AS_PAID:     'failed-mark-invoice-as-paid',

  // Payment callback queue
  UPDATE_INVOICE_PAYMENT_STATUS:   'update-invoice-payment-status',
  RETRY_INVOICE_PAYMENT_CALLBACK:  'retry-invoice-payment-callback',
  FAILED_INVOICE_PAYMENT_CALLBACK: 'failed-invoice-payment-callback',
} as const;
