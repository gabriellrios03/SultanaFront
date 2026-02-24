/**
 * Shared helpers for extracting and formatting egreso data from dynamic API responses.
 */

export const getFirstValue = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  return undefined;
};

export const getValueByKeyHint = (row: Record<string, unknown>, hints: string[]) => {
  const entries = Object.entries(row);
  for (const [key, value] of entries) {
    if (value === undefined || value === null || value === '') continue;
    const normalizedKey = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const hasHint = hints.some((hint) => normalizedKey.includes(hint));
    if (hasHint) return value;
  }
  return undefined;
};

export const formatCellValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export const formatTotalValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isNaN(parsed)) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(parsed);
  }
  return String(value);
};

export const formatDateOnly = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  const raw = String(value);
  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const spaceMatch = raw.match(/^(\d{4}-\d{2}-\d{2})\s/);
  if (spaceMatch) return spaceMatch[1];
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return raw;
};

export const parseComercialStatus = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['1', 'true', 'si', 'sí', 'yes', 'enviado'].includes(normalized);
  }
  return false;
};

export const getSerieFromRfc = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  const rfc = String(value).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (!rfc) return '-';
  if (rfc.length >= 13) {
    return rfc.slice(0, 4) || '-';
  }
  const firstThree = rfc.slice(0, 3);
  return firstThree ? `F${firstThree}` : '-';
};

export const getFolioFromUuid = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '-';
  const withoutLeadingZeros = digits.replace(/^0+/, '');
  if (!withoutLeadingZeros) return '-';
  return withoutLeadingZeros.slice(0, 4) || '-';
};

export const getComercialStatusFromRow = (row: Record<string, unknown>) => {
  const comercialRaw = getFirstValue(row, [
    'enviadaAComercial', 'EnviadaAComercial',
    'enviadaComercial', 'EnviadaComercial',
    'enviadoComercial', 'EnviadoComercial',
    'enviadoAComercial', 'EnviadoAComercial',
    'comercial', 'Comercial',
  ]);
  return parseComercialStatus(comercialRaw);
};

export const getCategoryFromRow = (row: Record<string, unknown>) => {
  const categoryValue = getFirstValue(row, ['tipoClasificacion', 'TipoClasificacion']);
  if (categoryValue === null || categoryValue === undefined || categoryValue === '') {
    return 'Sin categoria';
  }
  return String(categoryValue);
};

export const extractEgresoFields = (row: Record<string, unknown>, fallbackRfc: string) => {
  const fecha = getFirstValue(row, ['fecha', 'Fecha', 'fechaTimbrado', 'FechaTimbrado']);
  const emisor = getFirstValue(row, [
    'nombreEmisor', 'NombreEmisor', 'emisor', 'Emisor',
    'razonSocialEmisor', 'RazonSocialEmisor',
  ]);
  const rfc =
    getFirstValue(row, ['rfc', 'RFC', 'rfcEmisor', 'RfcEmisor']) ??
    getValueByKeyHint(row, ['rfc']) ??
    fallbackRfc;
  const uuid =
    getFirstValue(row, ['uuid', 'UUID', 'Uuid', 'folioFiscal', 'FolioFiscal']) ??
    getValueByKeyHint(row, ['uuid', 'foliofiscal', 'guiddocument', 'guid']);
  const serie = getSerieFromRfc(rfc);
  const folio = getFolioFromUuid(uuid);
  const total = getFirstValue(row, ['total', 'Total', 'importeTotal', 'ImporteTotal']);
  const isComercialSent = getComercialStatusFromRow(row);

  return { fecha, emisor, rfc, uuid, serie, folio, total, isComercialSent };
};
