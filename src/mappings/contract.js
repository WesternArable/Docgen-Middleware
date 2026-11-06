const { querySalesforce } = require('../services/salesforceService');

const objectApiName = 'Contract__c';
const growerInfoObjectApiName = 'Grower_Info__c';

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

function farmAssuredLabel(value) {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  if (raw === 'assured') return 'Assured';
  if (raw === 'non assured') return 'Non-Assured';
  return '';
}

function formatPricePerTonne(value) {
  if (value === null || value === undefined || value === '') return '';
  const raw = String(value)
    .trim()
    .replace(/,/g, '')
    .replace(/^£/, '')
    .replace(/\s*per tonne\s*$/i, '')
    .trim();
  if (!raw) return '';
  const amount = Number.parseFloat(raw);
  if (!Number.isFinite(amount)) return String(value).trim();
  const sign = amount < 0 ? '-' : '';
  return `${sign}£${Math.abs(amount).toFixed(2)} per tonne`;
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
  'Account__c.BillingPostalCode',
  'Account__c.Id'
];

function map(data) {
  const contractRoot = data.Contract__c || {};
  const account = data.Account__c || contractRoot.Account__c || {};
  const commodity = data.Commodity__c || contractRoot.Commodity__c || {};
  const growerInfo = data.Grower_Info__c || contractRoot.Grower_Info__c || {};
  const location = data.Location__c || contractRoot.Location__c || {};
  const farmAssuredStatus = farmAssuredLabel(growerInfo.Farm_Assured_Status__c);
  return {
    'Contract__c.Name': contractRoot.Name ?? data.Name ?? '',
    'Contract__c.Quantity__c': contractRoot.Quantity__c ?? data.Quantity__c ?? '',
    'Contract__c.Contract_Date__c': formatDateDdMmYyyy(
      contractRoot.Contract_Date__c ?? data.Contract_Date__c ?? ''
    ),
    'Contract__c.Price_Value__c': formatPricePerTonne(
      contractRoot.Price_Value__c ?? data.Price_Value__c ?? ''
    ),
    'Contract__c.Quality__c': contractRoot.Quality__c ?? data.Quality__c ?? '',
    'Contract__c.Position__c': contractRoot.Position__c ?? data.Position__c ?? '',
    'Contract__c.Delivery__c': contractRoot.Delivery__c ?? data.Delivery__c ?? '',
    'Contract__c.Payment_terms__c': contractRoot.Payment_terms__c ?? data.Payment_terms__c ?? '',
    'Account__c.Name': account.Name ?? '',
    'Account__c.AccountNumber': account.AccountNumber ?? '',
    'Contract__c.Broker__c': contractRoot.Broker__c ?? '',
    'Commodity__c.Name': commodity.Name ?? '',
    farm_assured_status: farmAssuredStatus,
    'Account__c.BillingStreet': account.BillingStreet ?? '',
    'Account__c.BillingPostalCode': account.BillingPostalCode ?? '',
  };
}

function escapeSoqlLiteral(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function accountIdFromSource(sourceData) {
  const contractRoot = sourceData?.Contract__c || {};
  const account = sourceData?.Account__c || contractRoot.Account__c || {};
  if (typeof account === 'string') return account.trim();
  const id = account.Id || contractRoot.Account__c;
  return typeof id === 'string' ? id.trim() : '';
}

async function resolveGrowerInfo(sourceData, env, objectName) {
  if (!sourceData || String(objectName || '') !== objectApiName) return sourceData || {};
  const accountId = accountIdFromSource(sourceData);
  if (!accountId) return sourceData;

  const soql = [
    'SELECT Farm_Assured_Status__c',
    `FROM ${growerInfoObjectApiName}`,
    `WHERE Grower__c = '${escapeSoqlLiteral(accountId)}'`,
    'ORDER BY LastModifiedDate DESC',
    'LIMIT 1',
  ].join(' ');
  const data = await querySalesforce(soql, env);
  const record = Array.isArray(data?.records) ? data.records[0] : null;
  const growerInfo = {
    Farm_Assured_Status__c: record?.Farm_Assured_Status__c ?? '',
  };
  const contractRoot = sourceData.Contract__c || {};
  return {
    ...sourceData,
    Grower_Info__c: growerInfo,
    Contract__c: {
      ...contractRoot,
      Grower_Info__c: growerInfo,
    },
  };
}

module.exports = { objectApiName, fieldPaths, map, resolveGrowerInfo };
