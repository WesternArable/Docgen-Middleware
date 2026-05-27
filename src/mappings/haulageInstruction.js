const objectApiName = 'Haulage_Instruction__c';

function formatDateDdMmYyyy(value) {
  if (value === null || value === undefined || value === '') return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getUTCFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

const fieldPaths = [
  'Name',
  'Delivery_Date__c',
  'Haulier__c.Name',
  'Grower__c',
  'Contact_Name__c',
  'Telephone__c',
  'Variety__c.Name',
  'Commodity__c.Name',
  'Tonnage__c',
  'Buyer__c',
  'Booking_Reference_No__c',
  'Delivery_Instruction__c.Date_Created__c',
  'Delivery_Instruction__c.Delivery_Reference_No__c',
  'Haulage_Rate__c',
  'Movement_Sheet__c.Name',
];

function deliveryRowFromSourceEntry(entry) {
  const hiRoot = entry.Haulage_Instruction__c || entry || {};
  const deliveryInstruction =
    entry.Delivery_Instruction__c ||
    hiRoot.Delivery_Instruction__c ||
    {};
  const delivery_date = formatDateDdMmYyyy(hiRoot.Delivery_Date__c ?? '');
  const booking_reference = String(hiRoot.Booking_Reference_No__c ?? '').trim();
  const delivery_ref = String(deliveryInstruction.Delivery_Reference_No__c ?? '').trim();
  const instruction_created_date = formatDateDdMmYyyy(
    deliveryInstruction.Date_Created__c ?? ''
  );
  return {
    delivery_date,
    booking_reference,
    Delivery_Instruction__c: {
      Date_Created__c: instruction_created_date,
      Delivery_Reference_No__c: delivery_ref,
    },
    Haulage_Instruction__c: {
      Booking_Reference_No__c: booking_reference,
      Delivery_Date__c: delivery_date,
    },
  };
}

function map(data) {
  const multi =
    Array.isArray(data.multi_source_records) && data.multi_source_records.length > 1
      ? data.multi_source_records
      : null;
  const baseData = multi ? multi[0] : data;

  const root = baseData.Haulage_Instruction__c || baseData || {};
  const movementSheet = baseData.Movement_Sheet__c || root.Movement_Sheet__c || {};
  const deliveryInstruction =
    baseData.Delivery_Instruction__c || root.Delivery_Instruction__c || {};
  const commodity = root.Commodity__c || {};
  const variety = root.Variety__c || {};
  const haulier = root.Haulier__c || {};
  const commodityName =
    commodity.Name ??
    root.Commodity__r?.Name ??
    '';
  const varietyName =
    variety.Name ??
    root.Variety__r?.Name ??
    '';

  const haulage_instruction_delivery_rows = multi
    ? multi.map((row) => deliveryRowFromSourceEntry(row))
    : [deliveryRowFromSourceEntry(data)];

  return {
    'Haulier__c.Name': haulier.Name ?? '',
    'Haulage_Instruction__c.Grower__c': root.Grower__c ?? '',
    'Haulage_Instruction__c.Contact_Name__c': root.Contact_Name__c ?? '',
    'Haulage_Instruction__c.Telephone__c': root.Telephone__c ?? '',
    'Haulage_Instruction__c.Variety__c.Name': varietyName,
    'Haulage_Instruction__c.Commodity__c.Name': commodityName,
    'Haulage_Instruction__c.Variety__c': varietyName,
    'Haulage_Instruction__c.Commodity__c': commodityName,
    'Haulage_Instruction__c.Tonnage__c': root.Tonnage__c ?? '',
    'Haulage_Instruction__c.Buyer__c': root.Buyer__c ?? '',
    'Haulage_Instruction__c.Haulage_Rate__c': root.Haulage_Rate__c ?? '',
    'Haulage_Instruction__c.Booking_Reference_No__c': root.Booking_Reference_No__c ?? '',
    'Haulage_Instruction__c.Delivery_Date__c': formatDateDdMmYyyy(root.Delivery_Date__c ?? ''),
    'Delivery_Instruction__c.Date_Created__c': formatDateDdMmYyyy(
      deliveryInstruction.Date_Created__c ?? ''
    ),
    'Delivery_Instruction__c.Delivery_Reference_No__c':
      deliveryInstruction.Delivery_Reference_No__c ?? '',
    'Movement_Sheet__c.Name': movementSheet.Name ?? '',
    haulage_instruction_delivery_rows,
    haulage_instruction_delivery_rows_count: haulage_instruction_delivery_rows.length,
  };
}

module.exports = { objectApiName, fieldPaths, map };
