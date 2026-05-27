const { querySalesforce } = require('./salesforceService');

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function escapeSoqlLiteral(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function resolveFooterConfig(payload) {
  return {
    objectApiName: cleanText(payload?.footerObjectApiName) || 'Footer__c',
    recordName: cleanText(payload?.footerRecordName) || 'Sample_Instruction',
    fieldName: cleanText(payload?.footerFieldName) || 'Footer_text__c',
  };
}

function isValidApiName(value) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(value || ''));
}

function isInvoicePayload(payload) {
  const api = cleanText(payload?.objectApiName || payload?.sourceObjectApiName);
  return api === 'Invoice__c';
}

async function resolveInvoiceFooterContext(env) {
  const salesSoql = [
    'SELECT Sales_Invoice_footer__c',
    'FROM Invoice_Footer__mdt',
    "WHERE DeveloperName = 'Sales'",
    'LIMIT 1',
  ].join(' ');
  const text1Soql = [
    'SELECT text_1__c',
    'FROM text_1_for_purchase_invoice_template__c',
    "WHERE Name = 'Text_1'",
    'LIMIT 1',
  ].join(' ');
  const text2Soql = [
    'SELECT text_2__c',
    'FROM text_2_for_purchase_invoice_template__c',
    "WHERE Name = 'Text_2'",
    'LIMIT 1',
  ].join(' ');

  const [salesData, text1Data, text2Data] = await Promise.all([
    querySalesforce(salesSoql, env),
    querySalesforce(text1Soql, env),
    querySalesforce(text2Soql, env),
  ]);

  const sales = Array.isArray(salesData?.records) ? salesData.records[0] || {} : {};
  const text1 = Array.isArray(text1Data?.records) ? text1Data.records[0] || {} : {};
  const text2 = Array.isArray(text2Data?.records) ? text2Data.records[0] || {} : {};

  return {
    sales_invoice_footer: cleanText(sales.Sales_Invoice_footer__c),
    text_1: cleanText(text1.text_1__c),
    text_2: cleanText(text2.text_2__c),
  };
}

async function resolveFooterContext(payload, env) {
  const invoiceFooterContext = isInvoicePayload(payload)
    ? await resolveInvoiceFooterContext(env)
    : {};

  const directFooterText = cleanText(payload?.footer_text || payload?.footerText);
  if (directFooterText) {
    return { ...invoiceFooterContext, footer_text: directFooterText };
  }

  const { objectApiName, recordName, fieldName } = resolveFooterConfig(payload);
  if (!isValidApiName(objectApiName) || !isValidApiName(fieldName)) {
    throw new Error(`Invalid footer config: ${objectApiName}.${fieldName}`);
  }

  const soql = [
    `SELECT ${fieldName}`,
    `FROM ${objectApiName}`,
    `WHERE Name = '${escapeSoqlLiteral(recordName)}'`,
    'LIMIT 1',
  ].join(' ');

  const data = await querySalesforce(soql, env);
  const record = Array.isArray(data?.records) ? data.records[0] : null;
  return {
    ...invoiceFooterContext,
    footer_text: cleanText(record ? record[fieldName] : ''),
  };
}

module.exports = { resolveFooterContext };
