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

function normalizeRow(row) {
  if (!row || typeof row !== 'object') return null;
  const deliveryDate = formatDateDdMmYyyy(
    row.deliveryDate ??
    row.delivery_date ??
    row.Delivery_Date__c ??
    row.date
  );
  const bookingReference = clean(
    row.bookingReference ??
    row.booking_reference ??
    row.Booking_Reference__c ??
    row.reference
  );
  if (!deliveryDate && !bookingReference) return null;
  return {
    delivery_date: deliveryDate,
    booking_reference: bookingReference,
  };
}

function resolveHaulageScheduleContext(payload) {
  const instructionNo = clean(
    payload?.instructionNo ??
    payload?.instruction_no ??
    payload?.sourceData?.Instruction_No ??
    payload?.sourceData?.instructionNo
  );

  const rawRows = Array.isArray(payload?.deliveryDates)
    ? payload.deliveryDates
    : Array.isArray(payload?.haulageInstructions)
      ? payload.haulageInstructions
      : [];

  const rows = rawRows
    .map((row) => normalizeRow(row))
    .filter((row) => !!row);

  const fallbackSingle = normalizeRow(payload?.sourceData || {});
  if (rows.length === 0 && fallbackSingle) rows.push(fallbackSingle);

  return {
    instruction_no: instructionNo,
    instruction_no_display: instructionNo,
    delivery_dates: rows,
    delivery_dates_count: rows.length,
  };
}

module.exports = { resolveHaulageScheduleContext };
