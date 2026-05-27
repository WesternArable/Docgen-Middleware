const { getMapping } = require('../mappings');

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function sanitizeText(text) {
  if (!text) return '';
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\t/g, '\u00A0\u00A0\u00A0\u00A0')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[^\x20-\x7E\u00A0-\uFFFF\n]/g, '')
    .split(/\n+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .join('\n');
}

function flattenObject(input, prefix = '', out = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return out;
  }

  for (const [key, value] of Object.entries(input)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenObject(value, fullKey, out);
      continue;
    }
    if (value === null || value === undefined) {
      out[fullKey] = '';
    } else if (typeof value === 'string') {
      out[fullKey] = sanitizeText(value);
    } else {
      out[fullKey] = value;
    }
  }

  return out;
}

function resolveFieldsData(payload) {
  const { objectType, sourceData, fieldsData } = payload || {};
  const mapping = objectType ? getMapping(objectType) : null;

  if (mapping && typeof mapping.map === 'function') {
    if (!sourceData || typeof sourceData !== 'object') {
      throw new Error(
        `sourceData is required for mapped object type "${objectType}"`
      );
    }
    return {
      ...sourceData,
      ...mapping.map(sourceData),
    };
  }

  if (fieldsData && typeof fieldsData === 'object') return fieldsData;
  if (sourceData && typeof sourceData === 'object') return sourceData;
  if (objectType && !mapping) {
    throw new Error(`No mapping found for object type "${objectType}"`);
  }

  throw new Error(
    'No input data provided. Pass sourceData, fieldsData, or objectType with sourceData.'
  );
}

function buildContext(data) {
  const context = {};

  Object.assign(context, flattenObject(data));
  for (const key of Object.keys(data)) {
    const value = data[key];
    if (value === null || value === undefined) {
      context[key] = '';
      continue;
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      context[key] = value;
      continue;
    }
    context[key] = typeof value === 'string' ? sanitizeText(value) : value;
  }

  context.generated_date = formatDate(new Date());
  return context;
}

module.exports = { resolveFieldsData, buildContext, sanitizeText };
