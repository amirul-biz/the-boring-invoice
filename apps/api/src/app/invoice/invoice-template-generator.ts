import ExcelJS from 'exceljs';

const MALAYSIAN_STATES = [
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
];

const CLASSIFICATION_CODES = [
  { code: '001', description: 'General Goods/Services' },
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
  { code: '72101500', description: 'Building construction services' },
  { code: '72102000', description: 'Civil engineering services' },
  { code: '72131500', description: 'Interior design services' },
  { code: '72151500', description: 'Building maintenance and repair services' },
  { code: '78101500', description: 'Transportation and storage services' },
  { code: '78111500', description: 'Air transport services of passengers' },
  { code: '78121500', description: 'Road freight transportation' },
  { code: '78181500', description: 'Courier and messenger services' },
  { code: '90101500', description: 'Restaurant services' },
  { code: '90111500', description: 'Catering services' },
  { code: '50202200', description: 'Bakery products' },
  { code: '50201700', description: 'Confectionery products' },
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
  { code: '86101500', description: 'Educational services' },
  { code: '86111500', description: 'Training and development services' },
  { code: '86121500', description: 'Educational institution services' },
  { code: '85101500', description: 'Healthcare services' },
  { code: '85111500', description: 'Medical practice services' },
  { code: '85121500', description: 'Dental services' },
  { code: '90111600', description: 'Hotel or motel services' },
  { code: '90111700', description: 'Resort or spa services' },
  { code: '70101500', description: 'Real estate rental services' },
  { code: '76101500', description: 'Equipment rental services' },
  { code: '84111500', description: 'Motor vehicle rental services' },
  { code: '27111500', description: 'Electricity distribution' },
  { code: '27112000', description: 'Water distribution' },
  { code: '27113000', description: 'Gas distribution' },
  { code: '82101500', description: 'Telecommunications services' },
  { code: '82111500', description: 'Internet services' },
  { code: '83101500', description: 'Banking and investment services' },
  { code: '83111500', description: 'Insurance services' },
];

const COUNTRY_OPTIONS = [
  'MY - Malaysia',
  'SG - Singapore',
  'ID - Indonesia',
  'TH - Thailand',
  'PH - Philippines',
  'BN - Brunei',
];

export async function generateInvoiceTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  const stateOptions = MALAYSIAN_STATES.map((s) => `${s.code} - ${s.name}`);
  const classificationOptions = CLASSIFICATION_CODES.map((c) => `${c.code} - ${c.description}`);

  // Sheet 1: Recipients
  const recipientSheet = wb.addWorksheet('Recipients');
  recipientSheet.columns = [
    { header: 'name', key: 'name', width: 25 },
    { header: 'email', key: 'email', width: 25 },
    { header: 'phone', key: 'phone', width: 18 },
    { header: 'tin', key: 'tin', width: 18 },
    { header: 'registrationNumber', key: 'registrationNumber', width: 22 },
    { header: 'addressLine1', key: 'addressLine1', width: 35 },
    { header: 'postcode', key: 'postcode', width: 12 },
    { header: 'city', key: 'city', width: 15 },
    { header: 'state', key: 'state', width: 35 },
    { header: 'countryCode', key: 'countryCode', width: 20 },
  ];

  recipientSheet.getRow(1).font = { bold: true };

  recipientSheet.addRow({
    name: 'Ahmad Bin Ali',
    email: 'ahmad@email.com',
    phone: '60196643494',
    tin: 'E100000000010',
    registrationNumber: '900101015555',
    addressLine1: 'No 50 Jalan Seri Putra 3/9',
    postcode: '43000',
    city: 'Kajang',
    state: `${MALAYSIAN_STATES[9].code} - ${MALAYSIAN_STATES[9].name}`,
    countryCode: 'MY - Malaysia',
  });

  // State & country dropdowns for rows 2-100
  const stateFormula = `"${stateOptions.join(',')}"`;
  const countryFormula = `"${COUNTRY_OPTIONS.join(',')}"`;

  for (let row = 2; row <= 100; row++) {
    recipientSheet.getCell(`I${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [stateFormula],
      showErrorMessage: true,
      errorTitle: 'Invalid State',
      error: 'Please select a valid state from the dropdown.',
    };
    recipientSheet.getCell(`J${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [countryFormula],
      showErrorMessage: true,
      errorTitle: 'Invalid Country',
      error: 'Please select a valid country from the dropdown.',
    };
  }

  // Sheet 2: Items
  const itemSheet = wb.addWorksheet('Items');
  itemSheet.columns = [
    { header: 'itemName',           key: 'itemName',           width: 40 },
    { header: 'quantity',           key: 'quantity',           width: 12 },
    { header: 'unitPrice',          key: 'unitPrice',          width: 15 },
    { header: 'classificationCode', key: 'classificationCode', width: 45 },
    { header: 'taxType',            key: 'taxType',            width: 20 },
    { header: 'taxRate',            key: 'taxRate',            width: 12 },
  ];

  itemSheet.getRow(1).font = { bold: true };

  itemSheet.addRow({
    itemName: 'Monthly Taekwondo Tuition (Junior Class)',
    quantity: 1,
    unitPrice: 150.00,
    classificationCode: `${CLASSIFICATION_CODES[0].code} - ${CLASSIFICATION_CODES[0].description}`,
    taxType: 'NOT_APPLICABLE',
    taxRate: 0,
  });

  // Classification codes — too many for inline formula, use hidden reference sheet
  const refSheet = wb.addWorksheet('_Ref');
  refSheet.state = 'veryHidden';
  classificationOptions.forEach((val, i) => {
    refSheet.getCell(`A${i + 1}`).value = val;
  });

  const classificationFormula = `'_Ref'!$A$1:$A$${classificationOptions.length}`;

  for (let row = 2; row <= 100; row++) {
    itemSheet.getCell(`D${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [classificationFormula],
      showErrorMessage: true,
      errorTitle: 'Invalid Code',
      error: 'Please select a valid classification code from the dropdown.',
    };
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
