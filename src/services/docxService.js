const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const { resolveFieldsData, buildContext } = require('./contextService');
const { resolveHeaderContext, resolveHeaderImages } = require('./headerService');
const { createImageModule } = require('./imageModuleService');
const { createValidationError } = require('./validationService');
const { downloadContentVersion } = require('./salesforceService');
const { resolveCompanyInfoContext } = require('./companyInfoService');
const { resolveTermsInfoContext } = require('./termsInfoService');
const { resolveAutoSourceData } = require('./autoSourceDataService');
const { resolveHaulageScheduleContext } = require('./haulageScheduleService');
const { resolveMovementSheetContext } = require('./movementSheetService');
const { resolveFooterContext } = require('./footerService');
const { resolveSampleResultContext } = require('./sampleResultService');
const { resolveInvoiceContext } = require('./invoiceService');
const { getMappingByObjectApiName } = require('../mappings');

function deepMerge(base, override) {
  if (!base || typeof base !== 'object' || Array.isArray(base)) return override;
  if (!override || typeof override !== 'object' || Array.isArray(override)) return base;

  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      merged[key] &&
      typeof merged[key] === 'object' &&
      !Array.isArray(merged[key])
    ) {
      merged[key] = deepMerge(merged[key], value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function stripSampleResultConflictingRootFlatKeys(context) {
  const rows = context?.sample_instruction_rows;
  if (!Array.isArray(rows) || rows.length <= 1) return;
  for (const key of Object.keys(context)) {
    const keepInstructionAccountName = key === 'Instruction__c.Account__c.Name';
    if (key.startsWith('Instruction__c.') && !keepInstructionAccountName) {
      delete context[key];
    } else if (key.startsWith('Sample_Result__c.')) {
      delete context[key];
    }
  }
}

function sanitizeTemplateZip(zip) {
  const files = Object.keys(zip.files || {});
  files
    .filter((name) => /^word\/.*\.xml$/i.test(name))
    .forEach((name) => {
      const file = zip.file(name);
      if (!file) return;
      const xml = file.asText();
      if (!xml || xml.indexOf('<w:proofErr') === -1) return;
      const sanitized = xml.replace(/<w:proofErr\b[^>]*\/>/g, '');
      zip.file(name, sanitized);
    });
}

async function generateDocx(payload) {
  const { env, docVersionId } = payload || {};
  if (!env) {
    throw createValidationError('env is required');
  }
  if (!docVersionId) {
    throw createValidationError('docVersionId is required');
  }
  const templateBuffer = await downloadContentVersion(docVersionId, env);

  const zip = new PizZip(templateBuffer);
  sanitizeTemplateZip(zip);
  const mappingByApiName = getMappingByObjectApiName(payload?.objectApiName);
  const payloadWithResolver = {
    ...payload,
    objectType: payload?.objectType || mappingByApiName?.objectType,
  };

  if (!payloadWithResolver?.dataResolver) {
    const sourceObjectApiName = payload?.objectApiName;
    const fieldPaths = mappingByApiName?.mapping?.fieldPaths;
    const fromArray = payload?.sourceRecordIds ?? payload?.recordIds;
    const idList = Array.isArray(fromArray) && fromArray.length > 0
      ? fromArray.map((id) => String(id || '').trim()).filter(Boolean)
      : [];
    const sourceRecordId = String(payload?.recordId || payload?.sourceRecordId || '').trim();
    const recordIds =
      idList.length > 0 ? idList : sourceRecordId ? [sourceRecordId] : [];

    if (recordIds.length > 0 && sourceObjectApiName && Array.isArray(fieldPaths) && fieldPaths.length > 0) {
      payloadWithResolver.dataResolver = {
        objectApiName: sourceObjectApiName,
        recordIds,
        fieldPaths,
      };
    }
  }

  const autoSourceData = await resolveAutoSourceData(payloadWithResolver, env);
  const payloadWithAutoSource = {
    ...payloadWithResolver,
    sourceData: deepMerge(autoSourceData || {}, (payload && payload.sourceData) || {}),
  };
  const resolvedFieldsData = resolveFieldsData(payloadWithAutoSource);
  const {
    headerContext,
    imageById,
  } = await resolveHeaderImages(resolveHeaderContext(payload), env);
  const companyInfoContext = await resolveCompanyInfoContext(payload, env);
  const termsInfoContext = await resolveTermsInfoContext(payload, env);
  const haulageScheduleContext = resolveHaulageScheduleContext(payloadWithAutoSource);
  const movementSheetContext = await resolveMovementSheetContext(payloadWithAutoSource, env);
  const sampleResultContext = await resolveSampleResultContext(payloadWithAutoSource, env);
  const invoiceContext = await resolveInvoiceContext(payloadWithAutoSource, env);
  const footerContext = await resolveFooterContext(payload, env);
  const imageModule = createImageModule(payloadWithAutoSource, imageById);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
    modules: [imageModule],
  });
  const context = buildContext({
    ...resolvedFieldsData,
    ...headerContext,
    ...companyInfoContext,
    ...termsInfoContext,
    ...haulageScheduleContext,
    ...movementSheetContext,
    ...sampleResultContext,
    ...invoiceContext,
    ...footerContext,
  });
  stripSampleResultConflictingRootFlatKeys(context);

  doc.render(context);

  return doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });
}

module.exports = { generateDocx };