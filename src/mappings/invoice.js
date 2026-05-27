const objectApiName = 'Invoice__c';

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function formatDateDdMmYyyy(value) {
  const raw = cleanText(value);
  if (!raw) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getUTCFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function buildDescriptionInvoice(invoiceLine) {
  const movement = invoiceLine?.Movement__c || {};
  const movementSheet = movement?.Movement_Sheet__c || {};
  const commodity = cleanText(movementSheet?.Commodity__c);
  const deliveryAddress = cleanText(movementSheet?.Delivery_Address__c);
  const deliveryReference = cleanText(movementSheet?.Delivery_Reference__c);
  const bookingReference = cleanText(
    movement?.Booking_Reference__c ?? movement?.Booking_Reference_No__c
  );
  const wtNo = cleanText(movement?.W_T_No__c);

  return [
    commodity,
    deliveryAddress ? `Delivered to ${deliveryAddress}` : '',
    deliveryReference ? `Del. Ref ${deliveryReference}` : '',
    bookingReference ? `Booking Ref ${bookingReference}` : '',
    wtNo,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
}

const fieldPaths = [
  'Name',
  'Account_Number__c',
  'Buyer__c',
  'Buyer_Address__c',
  'Buyer_Post_Code__c',
  'Due_Date__c',
  'Grower_Address__c',
  'Grower_Post_Code__c',
  'Invoice_Total__c',
  'Line_Total_Sum__c',
  'Pre_VAT_Total_Purchase__c',
  'Supplier_VAT_Number__c',
  'Tax_Point__c',
  'Tonnage__c',
  'Total_Due_1__c',
  'VAT_Amt_Total__c',
  'Movement_Sheet__c.Name',
  'Movement_Sheet__c.Buyer_Reference__c',
  'Contract_Lookup__c.Name',
  'Contract_Lookup__c.Account__c.BACS_Code__c',
  'Contract_Lookup__c.Account__c.Bank_Account_Number__c',
  'Contract_Lookup__c.Account__c.Bank_Address__c',
  'Contract_Lookup__c.Account__c.Bank_Name__c',
  'Contract_Lookup__c.Account__c.Bank_Sort_Code__c',
  'Contract_Lookup__c.Account__c.Name',
];

function map(data) {
  const root = data.Invoice__c || data || {};
  const movementSheet = data.Movement_Sheet__c || root.Movement_Sheet__c || {};
  const contractLookup = data.Contract_Lookup__c || root.Contract_Lookup__c || {};
  const contractLookupAccount =
    data.Account__c ||
    contractLookup.Account__c ||
    contractLookup.Account__r ||
    {};
  const invoiceLine = data.Invoice_Line__c || root.Invoice_Line__c || {};
  const descriptionInvoice = buildDescriptionInvoice(invoiceLine);

  return {
    'Invoice__c.Name': root.Name ?? '',
    'Invoice__c.Account_Number__c': root.Account_Number__c ?? '',
    'Invoice__c.Buyer__c': root.Buyer__c ?? '',
    'Invoice__c.Buyer_Address__c': root.Buyer_Address__c ?? '',
    'Invoice__c.Buyer_Post_Code__c': root.Buyer_Post_Code__c ?? '',
    'Invoice__c.Due_Date__c': formatDateDdMmYyyy(root.Due_Date__c ?? ''),
    'Invoice__c.Grower_Address__c': root.Grower_Address__c ?? '',
    'Invoice__c.Grower_Post_Code__c': root.Grower_Post_Code__c ?? '',
    'Invoice__c.Invoice_Total__c': root.Invoice_Total__c ?? '',
    'Invoice__c.Line_Total_Sum__c': root.Line_Total_Sum__c ?? '',
    'Invoice__c.Pre_VAT_Total_Purchase__c': root.Pre_VAT_Total_Purchase__c ?? '',
    'Invoice__c.Supplier_VAT_Number__c': root.Supplier_VAT_Number__c ?? '',
    'Invoice__c.Tax_Point__c': formatDateDdMmYyyy(root.Tax_Point__c ?? ''),
    'Invoice__c.Tonnage__c': root.Tonnage__c ?? '',
    'Invoice__c.Total_Due_1__c': root.Total_Due_1__c ?? '',
    'Invoice__c.VAT_Amt_Total__c': root.VAT_Amt_Total__c ?? '',

    'Invoice.Name': root.Name ?? '',
    'Invoice.Account_Number__c': root.Account_Number__c ?? '',
    'Invoice.Tonnage__c': root.Tonnage__c ?? '',

    'Movement_Sheet__c.Name': movementSheet.Name ?? '',
    'Movement_Sheet__c.Buyer_Reference__c': movementSheet.Buyer_Reference__c ?? '',

    'Contract_Lookup__c.Name': contractLookup.Name ?? '',
    'Contract_Lookup__c.Grower__c.Name': contractLookup?.Grower__c?.Name ?? '',
    'Invoice_Line__c.Haulier__c.Name': invoiceLine?.Haulier__c?.Name ?? '',

    'Contract_Lookup__c.Account__c.BACS_Code__c': contractLookupAccount.BACS_Code__c ?? '',
    'Contract_Lookup__c.Account__c.Bank_Account_Number__c':
      contractLookupAccount.Bank_Account_Number__c ?? '',
    'Contract_Lookup__c.Account__c.Bank_Address__c': contractLookupAccount.Bank_Address__c ?? '',
    'Contract_Lookup__c.Account__c.Bank_Name__c': contractLookupAccount.Bank_Name__c ?? '',
    'Contract_Lookup__c.Account__c.Bank_Sort_Code__c':
      contractLookupAccount.Bank_Sort_Code__c ?? '',

    'Invoice_Line__c': invoiceLine,
    description_invoice: descriptionInvoice,
    'Invoice_Line__c.Movement__c.Booking_Reference__c':
     invoiceLine?.Movement__c?.Booking_Reference__c ?? '',
    'Invoice_Line__c.Movement__c.Booking_Reference_No__c':
     invoiceLine?.Movement__c?.Booking_Reference_No__c ?? '',
    'Invoice_Line__c.Movement__c.Delivery_Date__c':
     invoiceLine?.Movement__c?.Delivery_Date__c ?? '',
    'Invoice_Line__c.Movement__c.Movement_Sheet__c.Commodity__c':
     invoiceLine?.Movement__c?.Movement_Sheet__c?.Commodity__c ?? '',
    'Invoice_Line__c.Movement__c.Movement_Sheet__c.Delivery_Address__c':
     invoiceLine?.Movement__c?.Movement_Sheet__c?.Delivery_Address__c ?? '',
    'Invoice_Line__c.Movement__c.Movement_Sheet__c.Delivery_Reference__c':
     invoiceLine?.Movement__c?.Movement_Sheet__c?.Delivery_Reference__c ?? '',
    'Invoice_Line__c.Movement__c.W_T_No__c': invoiceLine?.Movement__c?.W_T_No__c ?? '',
    'Invoice_Line__c.WTNo__c': invoiceLine?.WTNo__c ?? '',
    'Invoice_Line__c.Line_Text__c': invoiceLine.Line_Text__c ?? '',
    'Invoice_Line__c.Pre_VAT_Total__c': invoiceLine.Pre_VAT_Total__c ?? '',
    'Invoice_Line__c.Movement__c.Tonnage__c': invoiceLine?.Movement__c?.Tonnage__c ?? '',
    'Invoice_Line__c.Reg_No__c': invoiceLine.Reg_No__c ?? '',
    'Invoice_Line__c.Unit_Price__c': invoiceLine.Unit_Price__c ?? '',
    'Invoice_Line__c.VAT__c': invoiceLine.VAT__c ?? '',
    'Invoice_Line__c.VAT_Amount__c': invoiceLine.VAT_Amount__c ?? '',
  };
}

module.exports = { objectApiName, fieldPaths, map };
