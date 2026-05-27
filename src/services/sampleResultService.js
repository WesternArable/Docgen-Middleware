const { querySalesforce, getSalesforceServerDate } = require('./salesforceService');

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function comparableSalesforceId(id) {
  const s = cleanText(id);
  if (!s) return '';
  return s.length >= 15 ? s.slice(0, 15).toUpperCase() : s.toUpperCase();
}

function dedupeSampleResultIdsPreservingOrder(ids) {
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    const t = cleanText(id);
    if (!t) continue;
    const k = comparableSalesforceId(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function escapeSoqlLiteral(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function formatDateDdMmYyyy(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getUTCFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function percentageWithPercentSign(value) {
  const raw = cleanText(value);
  if (!raw) return '';
  if (raw.endsWith('%')) return raw;
  return `${raw}%`;
}

function buildAdmixtureText(record) {
  const percentage = percentageWithPercentSign(record?.Percentage__c);
  const comment = cleanText(record?.Comments__c);
  const line = [percentage, comment].filter(Boolean).join(' ');
  return line;
}

function readInstructionId(payload) {
  return cleanText(
    payload?.sourceData?.Instruction__c ||
      payload?.sourceData?.Sample_Result__c?.Instruction__c ||
      payload?.fieldsData?.Instruction__c
  );
}

function normalizeSampleResultIds(payload) {
  const raw =
    payload?.sampleResultIds ||
    payload?.sampleResultsIds ||
    payload?.sample_result_ids;
  if (Array.isArray(raw)) {
    return raw
      .map((item) =>
        typeof item === 'object'
          ? item?.id || item?.recordId || item?.sampleResultId
          : item
      )
      .map((value) => cleanText(value))
      .filter(Boolean);
  }
  const single = cleanText(payload?.sampleResultId || payload?.sample_result_id);
  if (single) return [single];
  const fallbackRecordId = cleanText(payload?.recordId || payload?.sourceRecordId);
  return fallbackRecordId ? [fallbackRecordId] : [];
}

async function fetchSampleResultsByIds(sampleResultIds, env) {
  if (!Array.isArray(sampleResultIds) || sampleResultIds.length === 0) return [];
  const inClause = sampleResultIds
    .map((id) => `'${escapeSoqlLiteral(id)}'`)
    .join(', ');
  const soql = [
    'SELECT Id, Name, Sample_location__c, Moisture__c, Specific_Weight__c, Nitrogen__c, Protein__c,',
    'Admixture_Sum__c, SCR_S_20__c, SCR_S_225__c, SCR_S_25__c, Hagberg__c,',
    'Germination__c, Broken_Grains__c, Skinned__c, Hardness__c,',
    'Instruction__c, Instruction__r.Name, Instruction__r.Variety__c, Instruction__r.Variety__r.Name,',
    'Instruction__r.Commodity__c, Instruction__r.Commodity__r.Name,',
    'Instruction__r.Account__c, Instruction__r.Account__r.Name',
    'FROM Sample_Result__c',
    `WHERE Id IN (${inClause})`,
  ].join(' ');
  const data = await querySalesforce(soql, env);
  return Array.isArray(data?.records) ? data.records : [];
}

function parseNumeric(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim().replace(/\s/g, '');
  if (!raw) return null;
  const normalized = raw.replace(/,/g, '.');
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

function sumNumericAcrossRows(rows, fieldKey) {
  let sum = 0;
  let hadAny = false;
  for (const row of rows) {
    const n = parseNumeric(row?.[fieldKey]);
    if (n !== null) {
      sum += n;
      hadAny = true;
    }
  }
  return hadAny ? sum : null;
}

function formatSummedNumber(n) {
  if (!Number.isFinite(n)) return '';
  const rounded = Math.round(n * 1e6) / 1e6;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
    return String(Math.round(rounded));
  }
  return String(rounded);
}

function buildAdmixtureFieldSummaryFromRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  const parts = [
    sumNumericAcrossRows(rows, 'admixture_sum'),
    sumNumericAcrossRows(rows, 'scr_s_20'),
    sumNumericAcrossRows(rows, 'scr_s_225'),
    sumNumericAcrossRows(rows, 'scr_s_25'),
  ];
  let total = 0;
  let any = false;
  for (const p of parts) {
    if (p !== null) {
      total += p;
      any = true;
    }
  }
  if (!any) return '';
  return formatSummedNumber(total);
}

function mapSampleResultRow(record) {
  const instruction = record?.Instruction__r || {};
  const commodity = instruction?.Commodity__r || {};
  const varietyRel = instruction?.Variety__r || {};
  const account = instruction?.Account__r || {};
  const varietyDisplayName = cleanText(
    varietyRel?.Name || instruction?.Variety__c
  );
  return {
    id: cleanText(record?.Id),
    instruction_id: cleanText(record?.Instruction__c),
    instruction_name: cleanText(instruction?.Name),
    sample_result_name: cleanText(record?.Name),
    commodity_name: cleanText(commodity?.Name || instruction?.Commodity__c),
    hagberg: cleanText(record?.Hagberg__c),
    instruction_variety: cleanText(instruction?.Variety__c),
    instruction_variety_name: varietyDisplayName,
    account_name: cleanText(account?.Name),
    sample_location: cleanText(record?.Sample_location__c),
    moisture: cleanText(record?.Moisture__c),
    specific_weight: cleanText(record?.Specific_Weight__c),
    nitrogen: cleanText(record?.Nitrogen__c ?? record?.Protein__c),
    protein: cleanText(record?.Protein__c ?? record?.Nitrogen__c),
    admixture_sum: cleanText(record?.Admixture_Sum__c),
    scr_s_20: cleanText(record?.SCR_S_20__c),
    scr_s_225: cleanText(record?.SCR_S_225__c),
    scr_s_25: cleanText(record?.SCR_S_25__c),
    germination: cleanText(record?.Germination__c),
    broken_grains: cleanText(record?.Broken_Grains__c),
    skinned: cleanText(record?.Skinned__c),
    hardness: cleanText(record?.Hardness__c),
  };
}

function varietyDisplayForRow(row) {
  return cleanText(row?.instruction_variety_name) || cleanText(row?.instruction_variety);
}

function enrichSampleResultRow(row) {
  const vd = varietyDisplayForRow(row);
  const accountName = row.account_name || '';
  return {
    ...row,
    Account__c: { Name: accountName },
    Instruction__c: {
      Name: row.instruction_name,
      Commodity__c: { Name: row.commodity_name },
      Variety__c: { Name: vd },
      Account__c: { Name: accountName },
    },
    Sample_Result__c: {
      Name: row.sample_result_name,
      Sample_location__c: row.sample_location,
      Moisture__c: row.moisture,
      Specific_Weight__c: row.specific_weight,
      Nitrogen__c: row.nitrogen,
      Protein__c: row.protein,
      Hagberg__c: row.hagberg,
      SCR_S_20__c: row.scr_s_20,
      SCR_S_225__c: row.scr_s_225,
      SCR_S_25__c: row.scr_s_25,
      Admixture_Sum__c: row.admixture_sum,
      Germination__c: row.germination,
      Broken_Grains__c: row.broken_grains,
      Skinned__c: row.skinned,
      Hardness__c: row.hardness,
    },
  };
}

function addDottedPathAliasesForRow(enriched, row) {
  const vd = varietyDisplayForRow(row);
  enriched['Instruction__c.Name'] = row.instruction_name || '';
  enriched['Instruction__c.Commodity__c.Name'] = row.commodity_name || '';
  enriched['Instruction__c.Variety__c.Name'] = vd;
  enriched['Instruction__c.Account__c.Name'] = row.account_name || '';
  enriched['Account__c.Name'] = row.account_name || '';
  enriched['Sample_Result__c.Name'] = row.sample_result_name || '';
  enriched['Sample_Result__c.Sample_location__c'] = row.sample_location || '';
  enriched['Sample_Result__c.Moisture__c'] = row.moisture || '';
  enriched['Sample_Result__c.Specific_Weight__c'] = row.specific_weight || '';
  enriched['Sample_Result__c.Nitrogen__c'] = row.nitrogen || '';
  enriched['Sample_Result__c.Protein__c'] = row.protein || '';
  enriched['Sample_Result__c.Hagberg__c'] = row.hagberg || '';
  enriched['Sample_Result__c.SCR_S_20__c'] = row.scr_s_20 || '';
  enriched['Sample_Result__c.SCR_S_225__c'] = row.scr_s_225 || '';
  enriched['Sample_Result__c.SCR_S_25__c'] = row.scr_s_25 || '';
  enriched['Sample_Result__c.Admixture_Sum__c'] = row.admixture_sum || '';
  enriched['Sample_Result__c.Germination__c'] = row.germination || '';
  enriched['Sample_Result__c.Broken_Grains__c'] = row.broken_grains || '';
  enriched['Sample_Result__c.Skinned__c'] = row.skinned || '';
  enriched['Sample_Result__c.Hardness__c'] = row.hardness || '';
  return enriched;
}

function enrichSampleResultRowWithAdmixtures(row, admixturesBySampleId) {
  const map = admixturesBySampleId instanceof Map ? admixturesBySampleId : new Map();
  const enriched = enrichSampleResultRow(row);
  enriched.admixtures = map.get(row.id) || '';
  enriched.admix_combined = buildAdmixtureFieldSummaryFromRows([row]);
  addDottedPathAliasesForRow(enriched, row);
  return enriched;
}

function sampleLinkIdFromAdmixtureRecord(record) {
  return cleanText(record?.Sample_ID__c || record?.Sample_Id__c);
}

function sortAdmixturesBySampleResultIdOrder(records, sampleResultIds) {
  const orderMap = new Map(sampleResultIds.map((id, i) => [cleanText(id), i]));
  return [...records].sort((a, b) => {
    const la = sampleLinkIdFromAdmixtureRecord(a);
    const lb = sampleLinkIdFromAdmixtureRecord(b);
    const ia = orderMap.has(la) ? orderMap.get(la) : 9999;
    const ib = orderMap.has(lb) ? orderMap.get(lb) : 9999;
    if (ia !== ib) return ia - ib;
    return new Date(a?.CreatedDate || 0).getTime() - new Date(b?.CreatedDate || 0).getTime();
  });
}

function buildAdmixturesMultilineText(records) {
  return records.map(buildAdmixtureText).filter(Boolean).join('\n');
}


function buildAdmixturesLinesBySampleResultIdMap(sortedRecords, primarySampleResultId) {
  const bySample = new Map();
  for (const rec of sortedRecords) {
    const sid = sampleLinkIdFromAdmixtureRecord(rec);
    if (!sid) continue;
    if (!bySample.has(sid)) bySample.set(sid, []);
    bySample.get(sid).push(rec);
  }
  const out = new Map();
  for (const [sid, list] of bySample) {
    list.sort(
      (a, b) =>
        new Date(a?.CreatedDate || 0).getTime() - new Date(b?.CreatedDate || 0).getTime()
    );
    out.set(sid, buildAdmixturesMultilineText(list));
  }
  if (
    out.size === 0 &&
    sortedRecords.length > 0 &&
    cleanText(primarySampleResultId)
  ) {
    out.set(
      cleanText(primarySampleResultId),
      buildAdmixturesMultilineText(sortedRecords)
    );
  }
  return out;
}

async function fetchAdmixturesBySampleIds(sampleResultIds, env) {
  if (!Array.isArray(sampleResultIds) || sampleResultIds.length === 0) return [];
  const inClause = sampleResultIds.map((id) => `'${escapeSoqlLiteral(id)}'`).join(', ');
  const attempts = [
    [
      'SELECT Id, Sample_ID__c, Percentage__c, Comments__c, CreatedDate',
      `WHERE Sample_ID__c IN (${inClause})`,
    ],
    [
      'SELECT Id, Sample_Id__c, Percentage__c, Comments__c, CreatedDate',
      `WHERE Sample_Id__c IN (${inClause})`,
    ],
  ];
  for (const [selectPart, wherePart] of attempts) {
    const fullSoql = [selectPart, 'FROM Admixture__c', wherePart, 'ORDER BY CreatedDate ASC'].join(' ');
    try {
      const data = await querySalesforce(fullSoql, env);
      return Array.isArray(data?.records) ? data.records : [];
    } catch (error) {
      const sfErrors = Array.isArray(error?.response?.data) ? error.response.data : [];
      const badField = sfErrors.some((entry) =>
        ['INVALID_FIELD', 'MALFORMED_QUERY', 'INVALID_TYPE'].includes(entry?.errorCode)
      );
      if (!badField) throw error;
    }
  }
  return [];
}

async function fetchAdmixturesByField(linkField, linkId, env) {
  if (!linkField || !linkId) return [];
  const soql = [
    'SELECT Id, Percentage__c, Comments__c, CreatedDate',
    'FROM Admixture__c',
    `WHERE ${linkField} = '${escapeSoqlLiteral(linkId)}'`,
    'ORDER BY CreatedDate ASC',
  ].join(' ');

  const data = await querySalesforce(soql, env);
  return Array.isArray(data?.records) ? data.records : [];
}

async function resolveSampleResultContext(payload, env) {
  const objectApiName = cleanText(payload?.objectApiName || payload?.sourceObjectApiName);
  if (objectApiName !== 'Sample_Result__c') return {};

  const orgNow = await getSalesforceServerDate(env);
  const context = {
    today: formatDateDdMmYyyy(orgNow),
  };

  const sampleResultIdsRaw = normalizeSampleResultIds(payload);
  const sampleResultIds = dedupeSampleResultIdsPreservingOrder(sampleResultIdsRaw);
  if (sampleResultIds.length === 0) return context;

  const records = await fetchSampleResultsByIds(sampleResultIds, env);
  const byId = new Map(
    records.map((record) => [comparableSalesforceId(record?.Id), record])
  );
  const rows = sampleResultIds
    .map((id) => byId.get(comparableSalesforceId(id)))
    .filter(Boolean)
    .map(mapSampleResultRow);

  const firstRow = rows[0] || {};
  const primarySampleResultId = firstRow.id || sampleResultIds[0] || '';
  const instructionId = firstRow.instruction_id || readInstructionId(payload);

  let admixtureRecords = await fetchAdmixturesBySampleIds(sampleResultIds, env);

  if (admixtureRecords.length === 0) {
    const candidates = [
      ['Sample_Result__c', primarySampleResultId],
      ['Sample_ID__c', primarySampleResultId],
      ['Sample_Id__c', primarySampleResultId],
      ['Instruction__c', instructionId],
      ['Sample_Instruction__c', instructionId],
    ];

    for (const [field, idValue] of candidates) {
      if (!idValue) continue;
      try {
        admixtureRecords = await fetchAdmixturesByField(field, idValue, env);
        if (admixtureRecords.length > 0) break;
      } catch (error) {
        const sfErrors = Array.isArray(error?.response?.data) ? error.response.data : [];
        const badField = sfErrors.some((entry) =>
          ['INVALID_FIELD', 'MALFORMED_QUERY', 'INVALID_TYPE'].includes(entry?.errorCode)
        );
        if (!badField) throw error;
      }
    }
  }

  const sortedAdmix = sortAdmixturesBySampleResultIdOrder(admixtureRecords, sampleResultIds);
  const admixturesBySampleId = buildAdmixturesLinesBySampleResultIdMap(
    sortedAdmix,
    primarySampleResultId
  );

  const resultTableRows = rows.map((r) =>
    enrichSampleResultRowWithAdmixtures(r, admixturesBySampleId)
  );
  context.sample_results_rows = resultTableRows;
  context.sample_results_count = resultTableRows.length;
  context.sample_instruction_rows = resultTableRows;
  context.sample_instruction_rows_count = resultTableRows.length;

 
  if (rows.length <= 1) {
    context['Instruction__c.Name'] = firstRow.instruction_name || '';
    context['Instruction__c.Commodity__c.Name'] = firstRow.commodity_name || '';
    context['Instruction__c.Variety__c'] = firstRow.instruction_variety || '';
    context['Instruction__c.Variety__c.Name'] = varietyDisplayForRow(firstRow) || '';
    context['Instruction__c.Account__c.Name'] = firstRow.account_name || '';
    context['Account__c.Name'] = firstRow.account_name || '';
    context['Sample_Result__c.Name'] = firstRow.sample_result_name || '';
    context['Sample_Result__c.Sample_location__c'] = firstRow.sample_location || '';
    context['Sample_Result__c.Moisture__c'] = firstRow.moisture || '';
    context['Sample_Result__c.Specific_Weight__c'] = firstRow.specific_weight || '';
    context['Sample_Result__c.Nitrogen__c'] = firstRow.nitrogen || '';
    context['Sample_Result__c.Protein__c'] = firstRow.protein || '';
    context['Sample_Result__c.Hagberg__c'] = firstRow.hagberg || '';
    context['Sample_Result__c.SCR_S_20__c'] = firstRow.scr_s_20 || '';
    context['Sample_Result__c.SCR_S_225__c'] = firstRow.scr_s_225 || '';
    context['Sample_Result__c.SCR_S_25__c'] = firstRow.scr_s_25 || '';
    context['Sample_Result__c.Admixture_Sum__c'] = firstRow.admixture_sum || '';
    context['Sample_Result__c.Germination__c'] = firstRow.germination || '';
    context['Sample_Result__c.Broken_Grains__c'] = firstRow.broken_grains || '';
    context['Sample_Result__c.Skinned__c'] = firstRow.skinned || '';
    context['Sample_Result__c.Hardness__c'] = firstRow.hardness || '';
    context.Account__c = { Name: firstRow.account_name || '' };
  } else {
    const growerName = firstRow.account_name || '';
    context['Instruction__c.Account__c.Name'] = growerName;
    context['Account__c.Name'] = growerName;
    context.Account__c = { Name: growerName };
  }

  const admixtureChildRows = sortedAdmix
    .map((record) => ({
      percentage: percentageWithPercentSign(record?.Percentage__c),
      comment: cleanText(record?.Comments__c),
      text: buildAdmixtureText(record),
    }))
    .filter((entry) => entry.text);

  context.admix_combined = buildAdmixtureFieldSummaryFromRows(rows);
  context.admixtures = buildAdmixturesMultilineText(sortedAdmix);
  context.admixtures_list = admixtureChildRows;
  context.admixtures_count = admixtureChildRows.length;

  return context;
}

module.exports = { resolveSampleResultContext };
