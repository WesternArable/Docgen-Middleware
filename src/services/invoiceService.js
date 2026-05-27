const { querySalesforce } = require('./salesforceService');

function clean(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function escapeSoqlLiteral(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function formatDateDdMmYyyy(value) {
  const raw = clean(value);
  if (!raw) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getUTCFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function parseNumeric(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim().replace(/\s/g, '').replace(/,/g, '');
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function formatSummedNumber(n) {
  if (!Number.isFinite(n)) return '';
  const rounded = Math.round(n * 1e6) / 1e6;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
  return String(rounded);
}

function numericOrZero(value) {
  const n = parseNumeric(value);
  return n === null ? 0 : n;
}

function hideZeroNumber(value) {
  const n = parseNumeric(value);
  if (n !== null && Math.abs(n) < 1e-12) return '';
  return clean(value);
}

function lineTypeToTagSlug(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** 15-char case-insensitive Id for Set lookups (REST may mix 15/18 and casing). */
function normalizeSalesforceId(value) {
  const s = clean(value);
  if (!s) return '';
  const core = s.length === 18 ? s.slice(0, 15) : s;
  return core.toLowerCase();
}

function purchaseInvoiceLineIdFromQaRecord(record) {
  const raw = record?.Purchase_Invoice_Line_ID__c;
  if (raw && typeof raw === 'object' && raw.Id) return clean(raw.Id);
  return clean(raw);
}

/** Picklist API value may differ from label "Commodity". */
function isCommodityPiLineType(piLineType) {
  const s = String(piLineType || '').trim().toLowerCase();
  if (!s) return false;
  if (s === 'commodity' || s === 'commodities') return true;
  const slug = lineTypeToTagSlug(piLineType);
  if (slug === 'commodity') return true;
  if (slug.startsWith('commodity_')) return true;
  return false;
}

function buildDescriptionInvoice(row) {
  const parts = [
    clean(row.commodity),
    row.delivery_address ? 'Delivered to' : '',
    clean(row.delivery_address),
    row.delivery_reference ? 'Del. Ref' : '',
    clean(row.delivery_reference),
    row.booking_reference ? 'Booking Ref' : '',
    clean(row.booking_reference),
    clean(row.w_t_no),
  ].filter(Boolean);
  if (parts.length === 0) {
    return clean(row.line_text);
  }
  return parts.join('\n').trim();
}

function mapInvoiceLineRow(record) {
  return {
    id: clean(record?.Id),
    pi_line_type: clean(record?.PI_Line_Type__c ?? record?.PL_Line_Type__c),
    wtno: clean(record?.WTNo__c),
    haulier_name: clean(record?.Haulier__r?.Name),
    line_text: clean(record?.Line_Text__c),
    pre_vat_total: clean(record?.Pre_VAT_Total__c),
    quantity: clean(record?.Quantity__c),
    reg_no: clean(record?.Reg_No__c),
    unit_price: clean(record?.Unit_Price__c),
    vat: hideZeroNumber(record?.VAT__c),
    vat_amount: hideZeroNumber(record?.VAT_Amount__c),
    delivery_date: formatDateDdMmYyyy(record?.Delivery_Date__c),
    booking_reference: clean(record?.Movement__r?.Booking_Reference_No__c),
    w_t_no: clean(record?.Movement__r?.W_T_No__c),
    tonnage: clean(record?.Movement__r?.Tonnage__c),
    commodity: clean(record?.Movement__r?.Movement_Sheet__r?.Commodity__c),
    delivery_address: clean(
      record?.Movement__r?.Movement_Sheet__r?.Delivery_Address__c
    ),
    delivery_reference: clean(
      record?.Movement__r?.Movement_Sheet__r?.Delivery_Reference__c
    ),
  };
}

async function fetchQualityAdjustmentsByInvoiceLineIds(invoiceLineIds, env) {
  if (!Array.isArray(invoiceLineIds) || invoiceLineIds.length === 0) return [];
  const inClause = invoiceLineIds.map((id) => `'${escapeSoqlLiteral(id)}'`).join(', ');
  const soql = [
    'SELECT Id, Purchase_Invoice_Line_ID__c',
    'FROM Quality_Adjustment__c',
    `WHERE Purchase_Invoice_Line_ID__c IN (${inClause})`,
  ].join(' ');
  const data = await querySalesforce(soql, env);
  return Array.isArray(data?.records) ? data.records : [];
}

function enrichInvoiceLineRowForTemplate(row) {
  const bookingReference = clean(row.booking_reference);
  const qty = clean(row.quantity);
  const descriptionInvoice = buildDescriptionInvoice(row);
  const enriched = {
    ...row,
    quantity: qty,
    description_invoice: descriptionInvoice,
    description: descriptionInvoice,
    Invoice_Line__c: {
      Haulier__c: { Name: clean(row.haulier_name) },
      Line_Text__c: clean(row.line_text),
      Pre_VAT_Total__c: clean(row.pre_vat_total),
      Quantity__c: qty,
      Reg_No__c: clean(row.reg_no),
      Unit_Price__c: clean(row.unit_price),
      VAT__c: clean(row.vat),
      VAT_Amount__c: clean(row.vat_amount),
      Delivery_Date__c: clean(row.delivery_date),
      WTNo__c: clean(row.wtno),
      Movement__c: {
        Booking_Reference__c: bookingReference,
        Booking_Reference_No__c: bookingReference,
        W_T_No__c: clean(row.w_t_no),
        Tonnage__c: clean(row.tonnage),
        Movement_Sheet__c: {
          Commodity__c: clean(row.commodity),
          Delivery_Address__c: clean(row.delivery_address),
          Delivery_Reference__c: clean(row.delivery_reference),
        },
      },
    },
  };
  enriched['Invoice_Line__c.Haulier__c.Name'] = clean(row.haulier_name);
  enriched['Invoice_Line__c.Line_Text__c'] = clean(row.line_text);
  enriched['Invoice_Line__c.Pre_VAT_Total__c'] = clean(row.pre_vat_total);
  enriched['Invoice_Line__c.Quantity__c'] = qty;
  enriched['Invoice_Line__c.Reg_No__c'] = clean(row.reg_no);
  enriched['Invoice_Line__c.Unit_Price__c'] = clean(row.unit_price);
  enriched['Invoice_Line__c.VAT__c'] = clean(row.vat);
  enriched['Invoice_Line__c.VAT_Amount__c'] = clean(row.vat_amount);
  enriched['Invoice_Line__c.Delivery_Date__c'] = clean(row.delivery_date);
  enriched['Invoice_Line__c.WTNo__c'] = clean(row.wtno);
  enriched.description_invoice = descriptionInvoice;
  enriched.description = descriptionInvoice;
  enriched['Invoice_Line__c.Movement__c.Booking_Reference__c'] = bookingReference;
  enriched['Invoice_Line__c.Movement__c.Booking_Reference_No__c'] = bookingReference;
  enriched['Invoice_Line__c.Movement__c.W_T_No__c'] = clean(row.w_t_no);
  enriched['Invoice_Line__c.Movement__c.Tonnage__c'] = clean(row.tonnage);
  enriched['Invoice_Line__c.Movement__c.Movement_Sheet__c.Commodity__c'] = clean(row.commodity);
  enriched['Invoice_Line__c.Movement__c.Movement_Sheet__c.Delivery_Address__c'] =
    clean(row.delivery_address);
  enriched['Invoice_Line__c.Movement__c.Movement_Sheet__c.Delivery_Reference__c'] =
    clean(row.delivery_reference);
  return enriched;
}

function buildLineTypeSumTags(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const lineType = clean(row.pi_line_type);
    if (!lineType) continue;
    if (!grouped.has(lineType)) {
      grouped.set(lineType, {
        unit_price_sum: 0,
        pre_vat_total_sum: 0,
        vat_amount_sum: 0,
        hadUnitPrice: false,
        hadPreVat: false,
        hadVatAmount: false,
      });
    }
    const bucket = grouped.get(lineType);
    const unitPrice = parseNumeric(row.unit_price);
    if (unitPrice !== null) {
      bucket.unit_price_sum += unitPrice;
      bucket.hadUnitPrice = true;
    }
    const preVat = parseNumeric(row.pre_vat_total);
    if (preVat !== null) {
      bucket.pre_vat_total_sum += preVat;
      bucket.hadPreVat = true;
    }
    const vatAmount = parseNumeric(row.vat_amount);
    if (vatAmount !== null) {
      bucket.vat_amount_sum += vatAmount;
      bucket.hadVatAmount = true;
    }
  }

  const tags = {};
  for (const [lineType, sums] of grouped) {
    const slug = lineTypeToTagSlug(lineType);
    if (!slug) continue;
    tags[`invoice_line_type_${slug}_unit_price_sum`] = sums.hadUnitPrice
      ? formatSummedNumber(sums.unit_price_sum)
      : '';
    tags[`invoice_line_type_${slug}_amount_sum`] = sums.hadPreVat
      ? formatSummedNumber(sums.pre_vat_total_sum)
      : '';
    tags[`invoice_line_type_${slug}_vat_sum`] = sums.hadVatAmount
      ? formatSummedNumber(sums.vat_amount_sum)
      : '';
  }
  return tags;
}

async function resolveInvoiceContext(payload, env) {
  const objectApiName = clean(payload?.objectApiName || payload?.sourceObjectApiName);
  const invoiceId = clean(payload?.recordId || payload?.sourceRecordId);
  if (objectApiName !== 'Invoice__c' || !invoiceId) return {};

  const soql = [
    'SELECT Id, PI_Line_Type__c, Haulier__r.Name, Line_Text__c, Pre_VAT_Total__c, Quantity__c, Reg_No__c, Unit_Price__c, VAT__c, VAT_Amount__c,',
    'Delivery_Date__c, Movement__r.Booking_Reference_No__c, Movement__r.W_T_No__c, Movement__r.Tonnage__c, WTNo__c,',
    'Movement__r.Movement_Sheet__r.Commodity__c, Movement__r.Movement_Sheet__r.Delivery_Address__c, Movement__r.Movement_Sheet__r.Delivery_Reference__c',
    'FROM Invoice_Line__c',
    `WHERE Invoice__c = '${escapeSoqlLiteral(invoiceId)}'`,
    'ORDER BY CreatedDate ASC',
  ].join(' ');

  const data = await querySalesforce(soql, env);
  const rows = (Array.isArray(data?.records) ? data.records : []).map(mapInvoiceLineRow);
  const qaRecords = await fetchQualityAdjustmentsByInvoiceLineIds(
    rows.map((r) => r.id).filter(Boolean),
    env
  );
  const qaLinkedIds = new Set(
    qaRecords.map((r) => normalizeSalesforceId(purchaseInvoiceLineIdFromQaRecord(r))).filter(Boolean)
  );
  const templateRows = rows.map(enrichInvoiceLineRowForTemplate);
  const visibleTemplateRows = templateRows.filter(
    (row) => !qaLinkedIds.has(normalizeSalesforceId(row.id))
  );
  const ignoredTemplateRows = templateRows.filter((row) =>
    qaLinkedIds.has(normalizeSalesforceId(row.id))
  );
  const ignoredCommodityQaRows = ignoredTemplateRows.filter((row) =>
    isCommodityPiLineType(row.pi_line_type)
  );
  const commodityRows = templateRows.filter((row) => isCommodityPiLineType(row.pi_line_type));
  const visibleCommodityRows = visibleTemplateRows.filter((row) =>
    isCommodityPiLineType(row.pi_line_type)
  );
  const first = visibleCommodityRows[0] || visibleTemplateRows[0] || {};
  const firstCommodity = visibleCommodityRows[0] || {};
  const qualityAdjustmentRows = ignoredCommodityQaRows.map((row) => ({
    quality_adjustment_invoice_line_id: clean(row.id),
    quality_adjustment_description: clean(row.description_invoice || row.line_text),
    quality_adjustment_unit_price: clean(row.unit_price),
    quality_adjustment_pre_vat_total: clean(row.pre_vat_total),
    quality_adjustment_vat_amount: clean(row.vat_amount),
  }));
  const recalculatedPreVatPurchase = commodityRows.reduce(
    (acc, row) => acc + numericOrZero(row.pre_vat_total),
    0
  );
  const ignoredCommodityQty = ignoredCommodityQaRows.reduce(
    (acc, row) => acc + numericOrZero(row.quantity),
    0
  );
  const invoiceBaseTonnage = numericOrZero(
    payload?.sourceData?.Invoice__c?.Tonnage__c ?? payload?.sourceData?.Tonnage__c
  );
  const recalculatedTonnage = Math.max(0, invoiceBaseTonnage - ignoredCommodityQty);

  const columsSingle = first && Object.keys(first).length > 0 ? [first] : [];
  const context = {
    invoice_line_rows: visibleCommodityRows,
    invoice_line_rows_count: visibleCommodityRows.length,
    colums: visibleCommodityRows,
    colums_count: visibleCommodityRows.length,
    columns: visibleCommodityRows,
    columns_count: visibleCommodityRows.length,
    colums_single: columsSingle,
    colums_single_count: columsSingle.length,
    description_invoice: buildDescriptionInvoice(first),
    description: buildDescriptionInvoice(first),
    quality_adjustment_rows: qualityAdjustmentRows,
    quality_adjustment_rows_count: ignoredCommodityQaRows.length,
    'Invoice__c.Pre_VAT_Total_Purchase__c': formatSummedNumber(recalculatedPreVatPurchase),
    'Invoice__c.Tonnage__c': formatSummedNumber(recalculatedTonnage),
    'Invoice.Pre_VAT_Total_Purchase__c': formatSummedNumber(recalculatedPreVatPurchase),
    'Invoice.Tonnage__c': formatSummedNumber(recalculatedTonnage),
    Invoice_Line__c: {
      Haulier__c: { Name: first.haulier_name || '' },
      Line_Text__c: first.line_text || '',
      Pre_VAT_Total__c: first.pre_vat_total || '',
      Quantity__c: first.quantity || '',
      Reg_No__c: first.reg_no || '',
      Unit_Price__c: first.unit_price || '',
      VAT__c: first.vat || '',
      VAT_Amount__c: first.vat_amount || '',
      Delivery_Date__c: first.delivery_date || '',
      WTNo__c: first.wtno || '',
      Movement__c: {
        Booking_Reference__c: first.booking_reference || '',
        Booking_Reference_No__c: first.booking_reference || '',
        W_T_No__c: first.w_t_no || '',
        Tonnage__c: first.tonnage || '',
        Movement_Sheet__c: {
          Commodity__c: first.commodity || '',
          Delivery_Address__c: first.delivery_address || '',
          Delivery_Reference__c: first.delivery_reference || '',
        },
      },
    },
    'Invoice_Line__c.Haulier__c.Name': first['Invoice_Line__c.Haulier__c.Name'] || '',
    'Invoice_Line__c.Line_Text__c': first['Invoice_Line__c.Line_Text__c'] || '',
    'Invoice_Line__c.Pre_VAT_Total__c': first['Invoice_Line__c.Pre_VAT_Total__c'] || '',
    'Invoice_Line__c.Quantity__c': first['Invoice_Line__c.Quantity__c'] || '',
    'Invoice_Line__c.Reg_No__c': first['Invoice_Line__c.Reg_No__c'] || '',
    'Invoice_Line__c.Unit_Price__c': first['Invoice_Line__c.Unit_Price__c'] || '',
    'Invoice_Line__c.VAT__c': first['Invoice_Line__c.VAT__c'] || '',
    'Invoice_Line__c.VAT_Amount__c': first['Invoice_Line__c.VAT_Amount__c'] || '',
    'Invoice_Line__c.Delivery_Date__c': first['Invoice_Line__c.Delivery_Date__c'] || '',
    'Invoice_Line__c.WTNo__c': first['Invoice_Line__c.WTNo__c'] || '',
    'Invoice_Line__c.Movement__c.Booking_Reference__c':
      first['Invoice_Line__c.Movement__c.Booking_Reference__c'] || '',
    'Invoice_Line__c.Movement__c.Booking_Reference_No__c':
      first['Invoice_Line__c.Movement__c.Booking_Reference_No__c'] || '',
    'Invoice_Line__c.Movement__c.W_T_No__c':
      first['Invoice_Line__c.Movement__c.W_T_No__c'] || '',
    'Invoice_Line__c.Movement__c.Tonnage__c':
      first['Invoice_Line__c.Movement__c.Tonnage__c'] || '',
    'Invoice_Line__c.Movement__c.Movement_Sheet__c.Commodity__c':
      first['Invoice_Line__c.Movement__c.Movement_Sheet__c.Commodity__c'] || '',
    'Invoice_Line__c.Movement__c.Movement_Sheet__c.Delivery_Address__c':
      first['Invoice_Line__c.Movement__c.Movement_Sheet__c.Delivery_Address__c'] || '',
    'Invoice_Line__c.Movement__c.Movement_Sheet__c.Delivery_Reference__c':
      first['Invoice_Line__c.Movement__c.Movement_Sheet__c.Delivery_Reference__c'] || '',
    'Invoice_Line__c.PI_Line_Type__c': first.pi_line_type || '',
    'Invoice_Line__c.Commodity.Unit_Price__c':
      firstCommodity['Invoice_Line__c.Unit_Price__c'] || '',
    'Invoice_Line__c.Commodity.Pre_VAT_Total__c':
      firstCommodity['Invoice_Line__c.Pre_VAT_Total__c'] || '',
    'Invoice_Line__c.Commodity.VAT_Amount__c':
      firstCommodity['Invoice_Line__c.VAT_Amount__c'] || '',
    ...buildLineTypeSumTags(rows),
  };

  const indexedPaths = [
    'Invoice_Line__c.Haulier__c.Name',
    'Invoice_Line__c.Line_Text__c',
    'Invoice_Line__c.Pre_VAT_Total__c',
    'Invoice_Line__c.Quantity__c',
    'Invoice_Line__c.Reg_No__c',
    'Invoice_Line__c.Unit_Price__c',
    'Invoice_Line__c.VAT__c',
    'Invoice_Line__c.VAT_Amount__c',
    'Invoice_Line__c.Delivery_Date__c',
    'Invoice_Line__c.WTNo__c',
    'Invoice_Line__c.Movement__c.Booking_Reference__c',
    'Invoice_Line__c.Movement__c.Booking_Reference_No__c',
    'Invoice_Line__c.Movement__c.W_T_No__c',
    'Invoice_Line__c.Movement__c.Tonnage__c',
    'Invoice_Line__c.Movement__c.Movement_Sheet__c.Commodity__c',
    'Invoice_Line__c.Movement__c.Movement_Sheet__c.Delivery_Address__c',
    'Invoice_Line__c.Movement__c.Movement_Sheet__c.Delivery_Reference__c',
  ];
  visibleCommodityRows.forEach((row, idx) => {
    const i = idx + 1;
    indexedPaths.forEach((path) => {
      context[`${path}_${i}`] = row[path] || '';
    });
  });

  ignoredCommodityQaRows.forEach((row, idx) => {
    const i = idx + 1;
    context[`quality_adjustment_pre_vat_total_${i}`] = clean(row.pre_vat_total);
    context[`quality_adjustment_invoice_line_id_${i}`] = clean(row.id);
  });

  return context;
}

module.exports = { resolveInvoiceContext };
