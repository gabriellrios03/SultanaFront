'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ApiService } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  extractEgresoFields,
  formatDateOnly,
  formatTotalValue,
  formatCellValue,
  getComercialStatusFromRow,
  getCategoryFromRow,
  getFirstValue,
  getValueByKeyHint,
} from '@/lib/egreso-helpers';
import { getRentasDefaultsForEmpresa } from '@/lib/ArrendamientoSettings';
import type { Egreso } from '@/lib/types';
import {
  ArrowLeft,
  Calendar,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Download,
} from 'lucide-react';

export default function EgresosRapidoPage() {
  const router = useRouter();
  const { token, selectedEmpresa } = useAuth();
  const [egresos, setEgresos] = useState<Egreso[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSent, setShowSent] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isQuickSending, setIsQuickSending] = useState(false);
  const [isLoadingAllData, setIsLoadingAllData] = useState(false);
  const [quickSendSummary, setQuickSendSummary] = useState<
    | {
        sent: number;
        skipped: number;
        errors: string[];
      }
    | null
  >(null);
  const [previewData, setPreviewData] = useState<
    Record<
      string,
      {
        concepto?: string;
        producto?: string;
        sucursal?: string;
        segmento?: string;
        regimenFiscal?: string;
        metodoPago?: string;
        status: 'loading' | 'success' | 'error';
        error?: string;
      }
    >
  >({});

  const getDefaultWeekRange = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const toDateString = (date: Date) => date.toISOString().split('T')[0];
    return { from: toDateString(monday), to: toDateString(sunday) };
  };

  const [fromDate, setFromDate] = useState(() => getDefaultWeekRange().from);
  const [toDate, setToDate] = useState(() => getDefaultWeekRange().to);

  const getDateStorageKey = (empresaGuid?: string) =>
    empresaGuid ? `egresosDateRange:${empresaGuid}` : 'egresosDateRange';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!selectedEmpresa?.guidDsl) return;
    const stored = sessionStorage.getItem(getDateStorageKey(selectedEmpresa.guidDsl));
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { from?: string; to?: string };
        if (parsed.from) setFromDate(parsed.from);
        if (parsed.to) setToDate(parsed.to);
        return;
      } catch {
        // ignore stored value
      }
    }
    const fallback = getDefaultWeekRange();
    setFromDate(fallback.from);
    setToDate(fallback.to);
  }, [selectedEmpresa?.guidDsl]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!selectedEmpresa?.guidDsl) return;
    if (!fromDate || !toDate) return;
    sessionStorage.setItem(
      getDateStorageKey(selectedEmpresa.guidDsl),
      JSON.stringify({ from: fromDate, to: toDate })
    );
  }, [fromDate, toDate, selectedEmpresa?.guidDsl]);

  const filteredEgresos = useMemo(
    () =>
      egresos
        .map((egreso, sourceIndex) => ({
          egreso,
          row: egreso as Record<string, unknown>,
          sourceIndex,
        }))
        .filter(({ row }) => {
          const category = getCategoryFromRow(row).toLowerCase();
          if (!(category === 'rentas' || category === 'arrendamiento')) return false;
          const isComercialSent = getComercialStatusFromRow(row);
          const fields = extractEgresoFields(row, selectedEmpresa?.rfc ?? '');

          const matchesSentToggle = showSent || !isComercialSent;
          if (!searchQuery.trim()) return matchesSentToggle;

          const q = searchQuery.toLowerCase();
          const matchesSearch =
            formatCellValue(fields.emisor).toLowerCase().includes(q) ||
            formatCellValue(fields.rfc).toLowerCase().includes(q) ||
            formatCellValue(fields.uuid).toLowerCase().includes(q) ||
            fields.serie.toLowerCase().includes(q);

          return matchesSentToggle && matchesSearch;
        }),
    [egresos, searchQuery, selectedEmpresa?.rfc, showSent]
  );

  const getRowId = (row: Record<string, unknown>, index: number) => {
    const idCandidate =
      getFirstValue(row, [
        'guidDocument', 'GuidDocument', 'guidDocumento', 'GuidDocumento', 'guid', 'Guid',
        'uuid', 'UUID', 'Uuid', 'folioFiscal', 'FolioFiscal',
      ]) ?? getValueByKeyHint(row, ['guiddocument', 'guid', 'uuid', 'foliofiscal']);
    if (idCandidate !== undefined && idCandidate !== null && idCandidate !== '') {
      return String(idCandidate);
    }
    return `row-${index}`;
  };

  const getDocumentGuid = (row: Record<string, unknown>) => {
    const guid = getFirstValue(row, ['guidDocument', 'GuidDocument', 'guidDocumento', 'GuidDocumento', 'guid', 'Guid']);
    if (guid !== undefined && guid !== null && guid !== '') return String(guid);
    const hinted = getValueByKeyHint(row, ['guiddocument', 'guid']);
    if (hinted !== undefined && hinted !== null && hinted !== '') return String(hinted);
    return '';
  };

  const extractXmlContent = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    const priorityKeys = ['content', 'Content', 'xml', 'XML', 'xmlContent', 'XmlContent'];
    const visited = new WeakSet<object>();
    const walk = (node: unknown): string => {
      if (typeof node === 'string') {
        const trimmed = node.trim();
        if (trimmed.startsWith('<')) return node;
        return '';
      }
      if (!node || typeof node !== 'object') return '';
      if (visited.has(node as object)) return '';
      visited.add(node as object);
      if (Array.isArray(node)) {
        for (const item of node) {
          const found = walk(item);
          if (found) return found;
        }
        return '';
      }
      const record = node as Record<string, unknown>;
      for (const key of priorityKeys) {
        const valueByKey = record[key];
        if (typeof valueByKey === 'string' && valueByKey.trim() !== '') return valueByKey;
      }
      for (const child of Object.values(record)) {
        const found = walk(child);
        if (found) return found;
      }
      return '';
    };
    return walk(value);
  };

  const getDisplayXml = (value: unknown) => {
    const extracted = extractXmlContent(value);
    if (extracted) return extracted;
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') return JSON.stringify(value, null, 2);
    return '';
  };

  const getTagAttributes = (xml: string, tag: string) => {
    const match = xml.match(new RegExp(`<\s*(?:cfdi:)?${tag}\\b([^>]*)>`, 'i'));
    return match ? match[1] : '';
  };

  const getAttrValue = (attrs: string, attr: string) => {
    const match = attrs.match(new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, 'i'));
    return match ? match[1] : '';
  };

  const getGlobalImpuestosSection = (xml: string) => {
    const matches = Array.from(xml.matchAll(/<(?:cfdi:)?Impuestos\b[\s\S]*?<\/(?:cfdi:)?Impuestos>/gi));
    return matches.length > 0 ? matches[matches.length - 1][0] : '';
  };

  const normalizeNumber = (value: string | number | undefined) => {
    if (value === undefined || value === null || value === '') return 0;
    if (typeof value === 'number') return value;
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const parsed = Number(cleaned);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const normalizeDate = (value: string) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString();
  };

  const getProveedorCodigoCliente = (item: Record<string, unknown>) => {
    const code = getFirstValue(item, [
      'codigoCliente', 'CodigoCliente', 'cCodigoCliente', 'CCodigoCliente',
      'codigo', 'Codigo', 'idProveedor', 'IdProveedor',
    ]);
    if (code === undefined || code === null || code === '') return '';
    return String(code);
  };

  const getProveedorSegmento = (item: Record<string, unknown>) => {
    const segmento = getFirstValue(item, ['segmento', 'Segmento', 'cSegmento', 'CSegmento']);
    if (segmento === undefined || segmento === null || segmento === '') return '';
    return String(segmento);
  };

  const getProveedorSucursal = (item: Record<string, unknown>) => {
    const sucursal = getFirstValue(item, ['sucursal', 'Sucursal', 'cSucursal', 'CSucursal']);
    if (sucursal === undefined || sucursal === null || sucursal === '') return '';
    return String(sucursal);
  };

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    if (!selectedEmpresa) {
      router.push('/empresas');
      return;
    }
  }, [token, selectedEmpresa, router]);

  const fetchEgresos = async () => {
    if (!selectedEmpresa) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await ApiService.getEgresos(
        selectedEmpresa.guidDsl,
        selectedEmpresa.rfc,
        fromDate,
        toDate
      );
      setEgresos(data);
    } catch {
      setError('Error al cargar los egresos');
      setEgresos([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedEmpresa && fromDate && toDate) {
      fetchEgresos();
    }
  }, [fromDate, toDate]);

  const handleToggleSelected = (rowId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(rowId);
      } else {
        next.delete(rowId);
      }
      return next;
    });
  };

  const loadDataForAllVisible = async () => {
    if (filteredEgresos.length === 0) return;
    setIsLoadingAllData(true);
    try {
      for (const { row, sourceIndex } of filteredEgresos) {
        const rowId = getRowId(row, sourceIndex);
        if (!previewData[rowId]) {
          await calculatePreviewForRow(rowId);
        }
      }
    } finally {
      setIsLoadingAllData(false);
    }
  };

  const getEgresoByRowId = (rowId: string) => {
    for (let index = 0; index < egresos.length; index += 1) {
      const egreso = egresos[index];
      const row = egreso as Record<string, unknown>;
      if (getRowId(row, index) === rowId) {
        return { egreso, row, index };
      }
    }
    return null;
  };

  const calculatePreviewForRow = async (rowId: string) => {
    setPreviewData((prev) => ({
      ...prev,
      [rowId]: { status: 'loading' },
    }));

    try {
      const target = getEgresoByRowId(rowId);

      if (!target) {
        setPreviewData((prev) => ({
          ...prev,
          [rowId]: { status: 'error', error: 'Egreso no encontrado' },
        }));
        return;
      }

      const { row } = target;
      const fields = extractEgresoFields(row, selectedEmpresa!.rfc);
      const guidDocument = getDocumentGuid(row);

      if (!guidDocument) {
        setPreviewData((prev) => ({
          ...prev,
          [rowId]: { status: 'error', error: 'Sin GUID del documento' },
        }));
        return;
      }

      const xmlDetail = await ApiService.getDetalleXml(selectedEmpresa!.guidDsl, guidDocument);
      const xmlString = getDisplayXml(xmlDetail);

      if (!xmlString) {
        setPreviewData((prev) => ({
          ...prev,
          [rowId]: { status: 'error', error: 'XML vacío' },
        }));
        return;
      }

      const emisorAttrs = getTagAttributes(xmlString, 'Emisor');
      const regimenFiscal =
        getAttrValue(emisorAttrs, 'RegimenFiscal') ||
        '';

      const globalImpuestos = getGlobalImpuestosSection(xmlString);
      const traslados = Array.from(globalImpuestos.matchAll(/<(?:cfdi:)?Traslado\b([^>]*)>/gi));
      const hasIva08 = traslados.some((match) => {
        const attrs = match[1] || '';
        const impuesto = getAttrValue(attrs, 'Impuesto');
        const tasa = getAttrValue(attrs, 'TasaOCuota');
        const rate = Number(tasa);
        const isIva = impuesto === '002' || impuesto.toUpperCase() === 'IVA';
        return isIva && Number.isFinite(rate) && Math.abs(rate - 0.08) < 0.0001;
      });

      const defaults = getRentasDefaultsForEmpresa(
        selectedEmpresa!.baseDatos,
        regimenFiscal,
        hasIva08
      );

      if (!defaults) {
        setPreviewData((prev) => ({
          ...prev,
          [rowId]: { status: 'error', error: 'Sin defaults para regimen fiscal' },
        }));
        return;
      }

      const proveedores = await ApiService.getProveedores(
        selectedEmpresa!.baseDatos,
        String(fields.rfc)
      );
      const proveedor = (proveedores?.[0] as Record<string, unknown> | undefined) ?? undefined;

      if (!proveedor) {
        setPreviewData((prev) => ({
          ...prev,
          [rowId]: { status: 'error', error: 'Proveedor no encontrado' },
        }));
        return;
      }

      const segmento = getProveedorSegmento(proveedor);
      const sucursal = getProveedorSucursal(proveedor);

      if (!segmento || !sucursal) {
        setPreviewData((prev) => ({
          ...prev,
          [rowId]: { status: 'error', error: 'Falta segmento o sucursal' },
        }));
        return;
      }

      const comprobanteAttrs = getTagAttributes(xmlString, 'Comprobante');
      const metodoPago = getAttrValue(comprobanteAttrs, 'MetodoPago') || '';

      setPreviewData((prev) => ({
        ...prev,
        [rowId]: {
          status: 'success',
          concepto: defaults.concepto,
          producto: defaults.producto,
          sucursal,
          segmento,
          regimenFiscal,
          metodoPago,
        },
      }));
    } catch (err) {
      setPreviewData((prev) => ({
        ...prev,
        [rowId]: {
          status: 'error',
          error: err instanceof Error ? err.message : 'Error al cargar datos',
        },
      }));
    }
  };

  const handleToggleAllVisible = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredEgresos.forEach(({ row, sourceIndex }) => {
        const rowId = getRowId(row, sourceIndex);
        if (checked) {
          next.add(rowId);
        } else {
          next.delete(rowId);
        }
      });
      return next;
    });

    if (!checked) {
      setPreviewData((prev) => {
        const next = { ...prev };
        filteredEgresos.forEach(({ row, sourceIndex }) => {
          delete next[getRowId(row, sourceIndex)];
        });
        return next;
      });
    }
  };

  const handleQuickSend = async () => {
    if (!selectedEmpresa) return;
    if (selectedIds.size === 0) return;
    setIsQuickSending(true);
    setQuickSendSummary(null);

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let index = 0; index < egresos.length; index += 1) {
      const egreso = egresos[index];
      const row = egreso as Record<string, unknown>;
      const rowId = getRowId(row, index);
      if (!selectedIds.has(rowId)) continue;

      const category = getCategoryFromRow(row).toLowerCase();
      if (!(category === 'rentas' || category === 'arrendamiento')) {
        skipped += 1;
        errors.push(`${rowId}: categoria no es rentas`);
        continue;
      }

      if (getComercialStatusFromRow(row)) {
        skipped += 1;
        errors.push(`${rowId}: ya enviado`);
        continue;
      }

      const fields = extractEgresoFields(row, selectedEmpresa.rfc);
      const guidDocument = getDocumentGuid(row);
      if (!guidDocument) {
        skipped += 1;
        errors.push(`${rowId}: sin guid del documento`);
        continue;
      }

      try {
        const xmlDetail = await ApiService.getDetalleXml(selectedEmpresa.guidDsl, guidDocument);
        const xmlString = getDisplayXml(xmlDetail);
        if (!xmlString) {
          skipped += 1;
          errors.push(`${rowId}: XML vacio`);
          continue;
        }

        const emisorAttrs = getTagAttributes(xmlString, 'Emisor');
        const comprobanteAttrs = getTagAttributes(xmlString, 'Comprobante');
        const regimenFiscal =
          getAttrValue(emisorAttrs, 'RegimenFiscal') ||
          '';

        const globalImpuestos = getGlobalImpuestosSection(xmlString);
        const traslados = Array.from(globalImpuestos.matchAll(/<(?:cfdi:)?Traslado\b([^>]*)>/gi));
        const hasIva08 = traslados.some((match) => {
          const attrs = match[1] || '';
          const impuesto = getAttrValue(attrs, 'Impuesto');
          const tasa = getAttrValue(attrs, 'TasaOCuota');
          const rate = Number(tasa);
          const isIva = impuesto === '002' || impuesto.toUpperCase() === 'IVA';
          return isIva && Number.isFinite(rate) && Math.abs(rate - 0.08) < 0.0001;
        });

        const defaults = getRentasDefaultsForEmpresa(
          selectedEmpresa.baseDatos,
          regimenFiscal,
          hasIva08
        );
        if (!defaults) {
          skipped += 1;
          errors.push(`${rowId}: sin defaults de rentas`);
          continue;
        }

        const proveedores = await ApiService.getProveedores(selectedEmpresa.baseDatos, String(fields.rfc));
        const proveedor = (proveedores?.[0] as Record<string, unknown> | undefined) ?? undefined;
        if (!proveedor) {
          skipped += 1;
          errors.push(`${rowId}: proveedor no encontrado`);
          continue;
        }

        const segmento = getProveedorSegmento(proveedor);
        const sucursal = getProveedorSucursal(proveedor);
        const codigoCteProv = getProveedorCodigoCliente(proveedor);

        if (!segmento || !sucursal) {
          skipped += 1;
          errors.push(`${rowId}: falta segmento o sucursal`);
          continue;
        }

        const subtotal =
          getAttrValue(comprobanteAttrs, 'SubTotal') ||
          getAttrValue(comprobanteAttrs, 'Subtotal') ||
          String(fields.total ?? '');

        const payload = {
          empresaRutaOrName: selectedEmpresa.baseDatos || '',
          codConcepto: defaults.concepto,
          serie: fields.serie || '',
          folio: normalizeNumber(fields.folio),
          fecha: normalizeDate(String(fields.fecha)) || normalizeDate(formatDateOnly(fields.fecha)),
          codigoCteProv: codigoCteProv || '',
          referencia: sucursal,
          asociarUUID: String(fields.uuid ?? ''),
          asociarBaseDb: selectedEmpresa.guidDsl || '',
          movimientos: [
            {
              unidades: 1,
              precio: normalizeNumber(subtotal),
              codProdSer: defaults.producto,
              referencia: sucursal,
              segmento,
            },
          ],
        };

        await ApiService.crearDocumento(payload as Record<string, unknown>);
        sent += 1;
      } catch {
        skipped += 1;
        errors.push(`${rowId}: error al enviar`);
      }
    }

    setQuickSendSummary({ sent, skipped, errors });
    setSelectedIds(new Set());
    setPreviewData({});
    setIsQuickSending(false);
    await fetchEgresos();
  };

  if (!selectedEmpresa) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/egresos')}
              className="gap-1.5 text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Egresos</span>
            </Button>
            <Separator orientation="vertical" className="h-5" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Envio rapido</span>
            </div>
          </div>
          <div className="hidden text-xs text-muted-foreground font-mono sm:inline">
            {selectedEmpresa.nombre}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Envio rapido</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Solo muestra egresos de Rentas/Arrendamiento para envio masivo.
          </p>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar emisor, RFC, UUID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 bg-card"
              />
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5">
              <Switch checked={showSent} onCheckedChange={setShowSent} />
              <span className="text-xs text-muted-foreground">Mostrar enviados a CONTPAQi</span>
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5">
              <Checkbox
                checked={
                  filteredEgresos.length > 0 &&
                  filteredEgresos.every(({ row, sourceIndex }) =>
                    selectedIds.has(getRowId(row, sourceIndex))
                  )
                }
                onCheckedChange={(value) => handleToggleAllVisible(Boolean(value))}
              />
              <span className="text-xs text-muted-foreground">Seleccionar visibles</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-9 w-40 pl-9 bg-card font-mono text-sm"
                />
              </div>
              <span className="text-xs text-muted-foreground">a</span>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-9 w-40 pl-9 bg-card font-mono text-sm"
                />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchEgresos}
              disabled={isLoading}
              className="h-9 gap-1.5"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Actualizar</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadDataForAllVisible}
              disabled={isLoadingAllData || filteredEgresos.length === 0}
              className="h-9 gap-1.5"
              title="Carga datos de régimen, segmento, sucursal y método de pago para todos los registros visibles"
            >
              {isLoadingAllData ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Cargar datos</span>
            </Button>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="mb-4 rounded-lg border bg-card px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Seleccionados: {selectedIds.size}</p>
              <p className="text-xs text-muted-foreground">Solo se enviaran Rentas/Arrendamiento con datos completos.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleQuickSend} disabled={isQuickSending} className="gap-2">
                {isQuickSending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Envio rapido
              </Button>
            </div>
          </div>
        )}

        {quickSendSummary && (
          <div className="mb-4 rounded-lg border bg-card px-4 py-3">
            <p className="text-sm font-medium text-foreground">
              Envio rapido: {quickSendSummary.sent} enviados, {quickSendSummary.skipped} omitidos
            </p>
            {quickSendSummary.errors.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {quickSendSummary.errors.slice(0, 5).join(' | ')}
                {quickSendSummary.errors.length > 5 ? ' | ...' : ''}
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
            <p className="text-sm font-medium text-destructive">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Cargando egresos...</p>
            </div>
          </div>
        ) : filteredEgresos.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-12 px-3 py-2">
                    <span className="sr-only">Seleccionar</span>
                  </th>
                  <th className="px-3 py-2">Serie</th>
                  <th className="px-3 py-2">Folio</th>
                  <th className="px-3 py-2">Razon social</th>
                  <th className="px-3 py-2">Monto</th>
                  <th className="px-3 py-2">Metodo pago</th>
                  <th className="px-3 py-2">Regimen fiscal</th>
                  <th className="px-3 py-2">Segmento</th>
                  <th className="px-3 py-2">Sucursal</th>
                </tr>
              </thead>
              <tbody>
                {filteredEgresos.map(({ row, sourceIndex }) => {
                  const fields = extractEgresoFields(row, selectedEmpresa.rfc);
                  const rowId = getRowId(row, sourceIndex);
                  const preview = previewData[rowId];

                  return (
                    <tr key={rowId} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={selectedIds.has(rowId)}
                          onCheckedChange={(value) => handleToggleSelected(rowId, Boolean(value))}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{fields.serie || '-'}</td>
                      <td className="px-3 py-2 font-mono text-xs">{fields.folio || '-'}</td>
                      <td className="px-3 py-2">{formatCellValue(fields.emisor)}</td>
                      <td className="px-3 py-2 font-medium">{formatTotalValue(fields.total)}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {preview?.metodoPago || (preview?.status === 'loading' ? 'Cargando...' : '-')}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {preview?.regimenFiscal || (preview?.status === 'loading' ? 'Cargando...' : '-')}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {preview?.segmento || (preview?.status === 'loading' ? 'Cargando...' : '-')}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {preview?.sucursal || (preview?.status === 'loading' ? 'Cargando...' : '-')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : egresos.length > 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              No se encontraron egresos de Rentas/Arrendamiento para el filtro seleccionado
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              No hay egresos para la fecha seleccionada
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
