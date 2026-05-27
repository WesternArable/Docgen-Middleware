const { querySalesforce } = require('./salesforceService');

function clean(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
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

function escapeSoqlLiteral(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function mapMovementRow(record) {
  return {
    movement_date: formatDateDdMmYyyy(record.Movement_Date__c),
    haulier_name: clean(record?.Haulier__r?.Name),
    reg_no: clean(record.Reg_No__c),
    booking_reference: clean(record.Booking_Reference_No__c),
    w_t_no: clean(record.W_T_No__c),
    si_no: clean(record.Si_No__c),
    tonnage: clean(record.Tonnage__c),
    quality_adjustment: clean(record.Quality_Adjustment__c),
    haulage_invoice_receipt: clean(record.Haulage_Invoice_Receipt__c),
    haulage_rate: clean(record.Haulage_Rate__c),
    pi_no: clean(record.Pi_No__c),
  };
}

async function resolveMovementSheetContext(payload, env) {
  const objectApiName = clean(payload?.objectApiName || payload?.sourceObjectApiName);
  const recordId = clean(payload?.recordId || payload?.sourceRecordId);
  if (objectApiName !== 'Movement_Sheet__c' || !recordId) return {};

  const selectFields = [
    'Id',
    'Movement_Date__c',
    'Haulier__r.Name',
    'Reg_No__c',
    'Booking_Reference_No__c',
    'W_T_No__c',
    'Si_No__c',
    'Tonnage__c',
    'Quality_Adjustment__c',
    'Haulage_Invoice_Receipt__c',
    'Haulage_Rate__c',
    'Pi_No__c',
  ];

  const soql = [
    `SELECT ${selectFields.join(', ')}`,
    'FROM Movement__c',
    `WHERE Movement_Sheet__c = '${escapeSoqlLiteral(recordId)}'`,
    'ORDER BY Movement_Date__c NULLS LAST, CreatedDate ASC',
  ].join(' ');

  const data = await querySalesforce(soql, env);
  const rows = (Array.isArray(data?.records) ? data.records : []).map(mapMovementRow);

  const context = {
    movement_rows: rows,
    movement_rows_count: rows.length,
    haulier_columns: rows,
    haulier_columns_count: rows.length,
  };

  const first = rows[0] || {};
  context['Movement__c.Movement_Date__c'] = first.movement_date || '';
  context['Haulier__c.Name'] = first.haulier_name || '';
  context['Movement__c.Reg_No__c'] = first.reg_no || '';
  context['Movement__c.Booking_Reference__c'] = first.booking_reference || '';
  context['Movement__c.W_T_No__c'] = first.w_t_no || '';
  context['Movement__c.Si_No__c'] = first.si_no || '';
  context['Movement__c.Tonnage__c'] = first.tonnage || '';
  context['Movement__c.Quality_Adjustment__c'] = first.quality_adjustment || '';
  context['Movement__c.Haulage_Invoice_Receipt__c'] = first.haulage_invoice_receipt || '';
  context['Movement__c.Haulage_Rate__c'] = first.haulage_rate || '';
  context['Movement__c.Pi_No__c'] = first.pi_no || '';

  rows.forEach((row, idx) => {
    const i = idx + 1;
    context[`Movement__c.Movement_Date__c_${i}`] = row.movement_date;
    context[`Haulier__c.Name_${i}`] = row.haulier_name;
    context[`Movement__c.Reg_No__c_${i}`] = row.reg_no;
    context[`Movement__c.Booking_Reference__c_${i}`] = row.booking_reference;
    context[`Movement__c.W_T_No__c_${i}`] = row.w_t_no;
    context[`Movement__c.Si_No__c_${i}`] = row.si_no;
    context[`Movement__c.Tonnage__c_${i}`] = row.tonnage;
    context[`Movement__c.Quality_Adjustment__c_${i}`] = row.quality_adjustment;
    context[`Movement__c.Haulage_Invoice_Receipt__c_${i}`] = row.haulage_invoice_receipt;
    context[`Movement__c.Haulage_Rate__c_${i}`] = row.haulage_rate;
    context[`Movement__c.Pi_No__c_${i}`] = row.pi_no;
  });

  return context;
}

module.exports = { resolveMovementSheetContext };
