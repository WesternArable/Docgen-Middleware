const objectApiName = 'Contract__c';

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
  'Quantity__c',
  'Contract_Date__c',
  'Price_Value__c',
  'Quality__c',
  'Position__c',
  'Delivery__c',
  'Payment_terms__c',
  'Account__c.Name',
  'Account__c.AccountNumber',
  'Broker__c',
  'Commodity__c.Name',
  'Account__c.BillingStreet',
  'Account__c.BillingPostalCode'
];

function map(data) {
  const contractRoot = data.Contract__c || {};
  const account = data.Account__c || contractRoot.Account__c || {};
  const commodity = data.Commodity__c || contractRoot.Commodity__c || {};
  const location = data.Location__c || contractRoot.Location__c || {};
  return {
    'Contract__c.Name': contractRoot.Name ?? data.Name ?? '',
    'Contract__c.Quantity__c': contractRoot.Quantity__c ?? data.Quantity__c ?? '',
    'Contract__c.Contract_Date__c': formatDateDdMmYyyy(
      contractRoot.Contract_Date__c ?? data.Contract_Date__c ?? ''
    ),
    'Contract__c.Price_Value__c': contractRoot.Price_Value__c ?? data.Price_Value__c ?? '',
    'Contract__c.Quality__c': contractRoot.Quality__c ?? data.Quality__c ?? '',
    'Contract__c.Position__c': contractRoot.Position__c ?? data.Position__c ?? '',
    'Contract__c.Delivery__c': contractRoot.Delivery__c ?? data.Delivery__c ?? '',
    'Contract__c.Payment_terms__c': contractRoot.Payment_terms__c ?? data.Payment_terms__c ?? '',
    'Account__c.Name': account.Name ?? '',
    'Account__c.AccountNumber': account.AccountNumber ?? '',
    'Contract__c.Broker__c': contractRoot.Broker__c ?? '',
    'Commodity__c.Name': commodity.Name ?? '',
    'Account__c.BillingStreet': account.BillingStreet ?? '',
    'Account__c.BillingPostalCode': account.BillingPostalCode ?? '',
  };
}

module.exports = { objectApiName, fieldPaths, map };
