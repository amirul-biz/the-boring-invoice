export const INVOICE_QUEUE_CONFIG = {
  /** Maximum number of retry attempts before routing to failed queue */
  MAX_RETRY_ATTEMPTS: 5,
  /** Attempt number assigned when first entering the retry queue */
  INITIAL_RETRY_ATTEMPT: 1,
  /** Delay in milliseconds between retry attempts (1 minute) */
  RETRY_DELAY_MS: 60_000,
  /** Delay in milliseconds between invoices in a batch (1.5 seconds) */
  BATCH_DELAY_MS: 1_500,
} as const;

export const INVOICE_QUEUE_PATTERNS = {
  // Invoice creation queue
  CREATE:        'receiver-create-invoice',
  RETRY:         'retry-invoice',
  FAILED:        'failed-invoice',

  // Payment callback queue
  CALLBACK:      'receiver-update-invoice',
  CALLBACK_RETRY: 'retry-payment-callback',
  CALLBACK_FAILED: 'failed-payment-callback',
} as const;
