const { querySalesforce } = require('./salesforceService');

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function escapeSoqlLiteral(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function normalizeFieldPaths(raw) {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v || '').trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function relationshipSegment(segment) {
  if (segment.endsWith('__c')) return `${segment.slice(0, -3)}__r`;
  if (segment.endsWith('Id') && segment.length > 2) return segment.slice(0, -2);
  return segment;
}

function toSoqlPath(path) {
  const parts = String(path || '').split('.').filter(Boolean);
  if (parts.length <= 1) return path;
  return parts
    .map((part, idx) => (idx < parts.length - 1 ? relationshipSegment(part) : part))
    .join('.');
}

function getByPath(obj, path) {
  const parts = String(path || '').split('.').filter(Boolean);
  let current = obj;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

function setByPath(obj, path, value) {
  const parts = String(path || '').split('.').filter(Boolean);
  if (parts.length === 0) return;
  let current = obj;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const isLast = i === parts.length - 1;
    if (isLast) {
      current[part] = value;
      return;
    }
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }
}

function resolveRecordIdList(resolver, payload) {
  const fromResolver = resolver.recordIds;
  if (Array.isArray(fromResolver) && fromResolver.length > 0) {
    return fromResolver.map((v) => cleanText(v)).filter(Boolean);
  }
  const resolverOne = cleanText(resolver.recordId || resolver.id);
  if (resolverOne) return [resolverOne];

  const fromPayload = payload?.sourceRecordIds ?? payload?.recordIds;
  if (Array.isArray(fromPayload) && fromPayload.length > 0) {
    return fromPayload.map((v) => cleanText(v)).filter(Boolean);
  }
  const payloadOne = cleanText(payload?.sourceRecordId || payload?.recordId);
  return payloadOne ? [payloadOne] : [];
}

function buildResolvedFromSalesforceRecord(record, fieldPaths, soqlFields) {
  const resolved = {};
  for (let i = 0; i < fieldPaths.length; i += 1) {
    const originalPath = fieldPaths[i];
    const soqlPath = soqlFields[i];
    const value = getByPath(record, soqlPath);
    setByPath(resolved, originalPath, value === undefined ? '' : value);
  }
  return resolved;
}

function wrapSourceResult(resolved, recordId, objectApiName, targetRoot) {
  const result = {
    ...resolved,
    source_record_id: recordId,
    source_object_api_name: objectApiName,
  };
  if (targetRoot) {
    result[targetRoot] = resolved;
  }
  return result;
}

const SOQL_IN_MAX = 200;

async function resolveAutoSourceData(payload, env) {
  const resolver = payload?.dataResolver || payload?.sourceResolver || {};
  const objectApiName = cleanText(
    resolver.objectApiName || resolver.objectType || payload?.sourceObjectApiName
  );
  const fieldPaths = normalizeFieldPaths(
    resolver.fieldPaths || payload?.sourceFieldPaths
  );
  const targetRoot = cleanText(resolver.targetRoot || objectApiName);

  const idList = resolveRecordIdList(resolver, payload);
  if (!objectApiName || idList.length === 0 || fieldPaths.length === 0) return {};

  const ids = idList.slice(0, SOQL_IN_MAX);
  const soqlFields = fieldPaths.map((path) => toSoqlPath(path));
  const inList = ids.map((id) => `'${escapeSoqlLiteral(id)}'`).join(', ');
  const soql = [
    `SELECT Id, ${soqlFields.join(', ')}`,
    `FROM ${objectApiName}`,
    `WHERE Id IN (${inList})`,
  ].join(' ');

  const queryResult = await querySalesforce(soql, env);
  const sfRecords = Array.isArray(queryResult?.records) ? queryResult.records : [];
  const byId = new Map(sfRecords.map((r) => [r.Id, r]));
  const orderedSf = ids.map((id) => byId.get(id)).filter(Boolean);

  if (orderedSf.length === 0) return {};

  const multiResults = orderedSf.map((sfRec) =>
    wrapSourceResult(
      buildResolvedFromSalesforceRecord(sfRec, fieldPaths, soqlFields),
      sfRec.Id,
      objectApiName,
      targetRoot
    )
  );

  const first = multiResults[0];
  if (multiResults.length === 1) {
    return first;
  }

  return {
    ...first,
    multi_source_records: multiResults,
  };
}

module.exports = { resolveAutoSourceData };
