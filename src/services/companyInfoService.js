const { querySalesforce } = require('./salesforceService');

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toSnakeCase(value) {
  return String(value || '')
    .replace(/__c$/i, '')
    .replace(/__r$/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function escapeSoqlLiteral(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function mapDynamicCompanyInfo(companyInfoRaw = {}, developerName = '') {
  const result = {
    company_info_name: cleanText(
      developerName ||
      companyInfoRaw.Name ||
      companyInfoRaw.DeveloperName
    ),
    company_info_raw: companyInfoRaw,
  };

  for (const [key, value] of Object.entries(companyInfoRaw || {})) {
    if (key === 'attributes') continue;
    if (value !== null && typeof value === 'object') continue;
    const normalizedKey = toSnakeCase(key);
    if (!normalizedKey) continue;
    result[`company_info_${normalizedKey}`] = cleanText(value);
  }

  const addressLines = [];
  const addressText =
    result.company_info_address ||
    result.company_info_street;
  if (addressText) {
    addressLines.push(
      ...String(addressText)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    );
  }
  if (result.company_info_postcode) addressLines.push(result.company_info_postcode);
  else if (result.company_info_postal_code) addressLines.push(result.company_info_postal_code);

  result.company_info_address_lines = addressLines;
  result.company_info_address_block = addressLines.join('\n');
  result.company_info_contact_block = [
    result.company_info_telephone
      ? `Telephone: ${result.company_info_telephone}`
      : '',
    result.company_info_fax ? `Fax: ${result.company_info_fax}` : '',
    result.company_info_email ? `Email: ${result.company_info_email}` : '',
    result.company_info_web ? `Web: ${result.company_info_web}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return result;
}

function buildDisplayLines(companyInfo) {
  const lines = [];
  if (companyInfo.address) {
    lines.push(
      ...companyInfo.address
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    );
  }
  if (companyInfo.postcode) lines.push(companyInfo.postcode);
  else if (companyInfo.postal_code) lines.push(companyInfo.postal_code);
  return lines;
}

function mapCompanyInfoRecord(record) {
  const companyInfo = {
    company_info_name: cleanText(record.Name || record.DeveloperName),
    organization_name: cleanText(record.Company_Name__c || record.Organization_Name__c),
    address: cleanText(record.Address__c),
    street: cleanText(record.Street__c),
    city: cleanText(record.City__c),
    county: cleanText(record.County__c),
    postcode: cleanText(record.Postcode__c),
    postal_code: cleanText(record.Postal_Code__c),
    telephone: cleanText(record.Telephone__c),
    fax: cleanText(record.Fax__c),
    email: cleanText(record.Email__c),
    web: cleanText(record.Web__c),
  };

  const addressLines = buildDisplayLines(companyInfo);

  return {
    company_info_name: companyInfo.company_info_name,
    company_info_organization_name: companyInfo.organization_name,
    company_info_address: companyInfo.address,
    company_info_street: companyInfo.street,
    company_info_city: companyInfo.city,
    company_info_county: companyInfo.county,
    company_info_postcode: companyInfo.postcode,
    company_info_postal_code: companyInfo.postal_code,
    company_info_telephone: companyInfo.telephone,
    company_info_fax: companyInfo.fax,
    company_info_email: companyInfo.email,
    company_info_web: companyInfo.web,
    company_info_address_lines: addressLines,
    company_info_address_block: addressLines.join('\n'),
    company_info_contact_block: [
      companyInfo.telephone ? `Telephone: ${companyInfo.telephone}` : '',
      companyInfo.fax ? `Fax: ${companyInfo.fax}` : '',
      companyInfo.email ? `Email: ${companyInfo.email}` : '',
      companyInfo.web ? `Web: ${companyInfo.web}` : '',
    ].filter(Boolean).join('\n'),
  };
}

function resolveCompanyInfoName(payload) {
  return (
    payload?.header?.companyInfoName ||
    payload?.companyInfoName ||
    payload?.companyMetadataName ||
    ''
  );
}

function resolveCompanyInfoInput(payload) {
  const companyInfo = payload?.header?.companyInfo || payload?.companyInfo;
  if (!companyInfo || typeof companyInfo !== 'object') return {};
  return companyInfo;
}

async function resolveCompanyInfoContext(payload, env) {
  const companyInfoInput = resolveCompanyInfoInput(payload);
  if (Object.keys(companyInfoInput).length > 0) {
    return mapDynamicCompanyInfo(companyInfoInput);
  }

  const companyInfoName = cleanText(resolveCompanyInfoName(payload));
  if (!companyInfoName) return {};

  const metadataObjectApiName =
    cleanText(payload?.header?.companyInfoObjectApiName) ||
    cleanText(payload?.companyInfoObjectApiName) ||
    'Western_Arable_information__c';

  const soql = [
    'SELECT Id, Name, Company_Name__c, Address__c, Postcode__c, Telephone__c, Fax__c, Email__c, Web__c',
    `FROM ${metadataObjectApiName}`,
    `WHERE Name = '${escapeSoqlLiteral(companyInfoName)}'`,
    'LIMIT 1',
  ].join(' ');

  const data = await querySalesforce(soql, env);
  const record = Array.isArray(data?.records) ? data.records[0] : null;
  if (!record) return { company_info_name: companyInfoName };

  return {
    ...mapCompanyInfoRecord(record),
    ...mapDynamicCompanyInfo(record, companyInfoName),
  };
}

module.exports = { resolveCompanyInfoContext };
