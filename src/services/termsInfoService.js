const { querySalesforce } = require('./salesforceService');

function toSnakeCase(value) {
  return String(value || '')
    .replace(/__c$/i, '')
    .replace(/__r$/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function buildTermsInfoFlat(entry, suffix = '') {
  const flat = {};
  for (const [key, value] of Object.entries(entry || {})) {
    if (key === 'attributes') continue;
    if (value !== null && typeof value === 'object') continue;
    const normalizedKey = toSnakeCase(key);
    if (!normalizedKey) continue;
    flat[`terms_info_${normalizedKey}${suffix}`] = cleanText(value);
  }
  return flat;
}

function escapeSoqlLiteral(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function getRequestedTermsField(payload) {
  return cleanText(
    payload?.termsFieldName ||
    payload?.termsInfoFieldName ||
    payload?.header?.termsFieldName ||
    ''
  );
}

function isValidApiFieldName(fieldName) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(fieldName);
}

function resolveTermsFromObject(rawTermsInfo, fieldName) {
  if (!rawTermsInfo || typeof rawTermsInfo !== 'object' || Array.isArray(rawTermsInfo)) {
    return '';
  }
  const value = rawTermsInfo[fieldName];
  return cleanText(value);
}

async function resolveTermsFieldContext(payload, env) {
  const fieldName = getRequestedTermsField(payload);
  if (!fieldName) return null;
  if (!isValidApiFieldName(fieldName)) {
    throw new Error(`Invalid terms field name: "${fieldName}"`);
  }

  const rawTermsInfo = payload?.termsInfo;
  const fromObject = resolveTermsFromObject(rawTermsInfo, fieldName);
  if (fromObject) {
    return {
      terms: fromObject,
      terms_field_name: fieldName,
      terms_field_value: fromObject,
    };
  }

  const termsObjectApiName = cleanText(
    payload?.termsObjectApiName ||
    payload?.termsInfoObjectApiName ||
    'Terms_Info__mdt'
  );
  const termsRecordName = cleanText(
    payload?.termsRecordName ||
    payload?.termsInfoName ||
    payload?.header?.termsRecordName ||
    ''
  );

  const soql = termsRecordName
    ? `SELECT ${fieldName} FROM ${termsObjectApiName} WHERE DeveloperName = '${escapeSoqlLiteral(termsRecordName)}' LIMIT 1`
    : `SELECT ${fieldName} FROM ${termsObjectApiName} LIMIT 1`;

  const data = await querySalesforce(soql, env);
  const record = Array.isArray(data?.records) ? data.records[0] : null;
  const value = cleanText(record ? record[fieldName] : '');

  return {
    terms: value,
    terms_field_name: fieldName,
    terms_field_value: value,
  };
}

async function resolveTermsInfoContext(payload, env) {
  const termsFieldContext = await resolveTermsFieldContext(payload, env);
  if (termsFieldContext) {
    return termsFieldContext;
  }

  const rawTermsInfo = payload?.termsInfo;
  if (!rawTermsInfo || typeof rawTermsInfo !== 'object') {
    return {};
  }

  if (!Array.isArray(rawTermsInfo)) {
    return {
      termsInfo: rawTermsInfo,
      ...buildTermsInfoFlat(rawTermsInfo),
    };
  }

  const termsInfos = rawTermsInfo.filter((v) => v && typeof v === 'object');
  const result = {
    termsInfo: termsInfos[0] || {},
    terms_infos_count: termsInfos.length,
  };

  termsInfos.forEach((entry, idx) => {
    const index = idx + 1;
    result[`termsInfo_${index}`] = entry;
    Object.assign(result, buildTermsInfoFlat(entry, `_${index}`));
  });

  return result;
}

module.exports = { resolveTermsInfoContext };
