// Invoice Types as per LHDN requirements
export const INVOICE_TYPES = [
  { value: 'INVOICE',     label: 'Invoice' },
  { value: 'CREDIT_NOTE', label: 'Credit Note' },
  { value: 'DEBIT_NOTE',  label: 'Debit Note' },
] as const;

export const INVOICE_TYPE_LABEL: Record<string, string> =
  Object.fromEntries(INVOICE_TYPES.map(t => [t.value, t.label]));

// Tax Types as per LHDN requirements
export const TAX_TYPES = [
  { value: 'SST',                  label: 'SST',                  rate: 6 },
  { value: 'SERVICE_TAX',          label: 'Service Tax',          rate: 8 },
  { value: 'TOURISM_TAX',          label: 'Tourism Tax',          rate: 0 },
  { value: 'HIGH_VALUE_GOODS_TAX', label: 'High-Value Goods Tax', rate: 0 },
  { value: 'NOT_APPLICABLE',       label: 'Not Applicable',       rate: 0 },
  { value: 'EXEMPT',               label: 'Exempt',               rate: 0 },
] as const;

export const TAX_TYPE_LABEL: Record<string, string> =
  Object.fromEntries(TAX_TYPES.map(t => [t.value, t.label]));

// Malaysian State Codes as per LHDN requirements
export const MALAYSIAN_STATES = [
  { code: '01', name: 'Johor' },
  { code: '02', name: 'Kedah' },
  { code: '03', name: 'Kelantan' },
  { code: '04', name: 'Melaka' },
  { code: '05', name: 'Negeri Sembilan' },
  { code: '06', name: 'Pahang' },
  { code: '07', name: 'Pulau Pinang' },
  { code: '08', name: 'Perak' },
  { code: '09', name: 'Perlis' },
  { code: '10', name: 'Selangor' },
  { code: '11', name: 'Terengganu' },
  { code: '12', name: 'Sabah' },
  { code: '13', name: 'Sarawak' },
  { code: '14', name: 'Wilayah Persekutuan Kuala Lumpur' },
  { code: '15', name: 'Wilayah Persekutuan Labuan' },
  { code: '16', name: 'Wilayah Persekutuan Putrajaya' },
] as const;

// LHDN Classification Codes (Based on UNSPSC - United Nations Standard Products and Services Code)
// These are commonly used categories for Malaysian e-Invoice
export const CLASSIFICATION_CODES = [
  // General Services
  { code: '001', description: 'General Goods/Services' },

  // Business and Professional Services
  { code: '80101500', description: 'Management advisory services' },
  { code: '80101501', description: 'Business management consulting services' },
  { code: '80101600', description: 'Human resources services' },
  { code: '80111500', description: 'Accounting services' },
  { code: '80111600', description: 'Auditing services' },
  { code: '80141600', description: 'Legal services' },
  { code: '81101500', description: 'Computer services' },
  { code: '81111500', description: 'Software or hardware engineering' },
  { code: '81112000', description: 'IT consulting and support' },
  { code: '81161500', description: 'Marketing services' },
  { code: '81161600', description: 'Advertising services' },

  // Construction and Maintenance
  { code: '72101500', description: 'Building construction services' },
  { code: '72102000', description: 'Civil engineering services' },
  { code: '72131500', description: 'Interior design services' },
  { code: '72151500', description: 'Building maintenance and repair services' },

  // Transportation and Logistics
  { code: '78101500', description: 'Transportation and storage services' },
  { code: '78111500', description: 'Air transport services of passengers' },
  { code: '78121500', description: 'Road freight transportation' },
  { code: '78181500', description: 'Courier and messenger services' },

  // Food and Beverage
  { code: '90101500', description: 'Restaurant services' },
  { code: '90111500', description: 'Catering services' },
  { code: '50202200', description: 'Bakery products' },
  { code: '50201700', description: 'Confectionery products' },

  // Retail Goods
  { code: '42000000', description: 'Medical equipment and accessories' },
  { code: '43000000', description: 'IT equipment' },
  { code: '44000000', description: 'Office equipment and accessories' },
  { code: '46000000', description: 'Defense and law enforcement equipment' },
  { code: '47000000', description: 'Cleaning equipment and supplies' },
  { code: '48000000', description: 'Service industry machinery' },
  { code: '49000000', description: 'Sports and recreational equipment' },
  { code: '50000000', description: 'Food, beverage and tobacco products' },
  { code: '51000000', description: 'Drugs and pharmaceutical products' },
  { code: '52000000', description: 'Domestic appliances and supplies' },
  { code: '53000000', description: 'Apparel and luggage' },
  { code: '54000000', description: 'Timepieces and jewelry' },
  { code: '55000000', description: 'Publishing and printing' },
  { code: '56000000', description: 'Furniture and furnishings' },
  { code: '60000000', description: 'Musical instruments' },

  // Education and Training
  { code: '86101500', description: 'Educational services' },
  { code: '86111500', description: 'Training and development services' },
  { code: '86121500', description: 'Educational institution services' },

  // Healthcare
  { code: '85101500', description: 'Healthcare services' },
  { code: '85111500', description: 'Medical practice services' },
  { code: '85121500', description: 'Dental services' },

  // Accommodation
  { code: '90111600', description: 'Hotel or motel services' },
  { code: '90111700', description: 'Resort or spa services' },

  // Rental Services
  { code: '70101500', description: 'Real estate rental services' },
  { code: '76101500', description: 'Equipment rental services' },
  { code: '84111500', description: 'Motor vehicle rental services' },

  // Utilities
  { code: '27111500', description: 'Electricity distribution' },
  { code: '27112000', description: 'Water distribution' },
  { code: '27113000', description: 'Gas distribution' },

  // Telecommunications
  { code: '82101500', description: 'Telecommunications services' },
  { code: '82111500', description: 'Internet services' },

  // Financial Services
  { code: '83101500', description: 'Banking and investment services' },
  { code: '83111500', description: 'Insurance services' },
] as const;

// Page size options for paginated lists
export const PAGE_SIZES = [10, 50, 100] as const;

// Invoice status options
export const INVOICE_STATUSES = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'PAID', label: 'Paid' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'DRAFT', label: 'Draft' },
] as const;
