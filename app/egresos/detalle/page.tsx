'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, ChevronDown, Code2, FileCheck, Loader2, Send, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ApiService } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  getFirstValue,
  getValueByKeyHint,
  getSerieFromRfc,
  getFolioFromUuid,
  formatTotalValue,
  formatDateOnly,
  formatCellValue,
  getComercialStatusFromRow,
} from '@/lib/egreso-helpers';

type EgresoDetail = Record<string, unknown>;

const FIELD_LABELS: Record<string, string> = {
  __serieCalculada: 'Serie',
  __folioCalculado: 'Folio',
  uuid: 'UUID',
  Uuid: 'UUID',
  UUID: 'UUID',
  guid: 'GUID',
  Guid: 'GUID',
  guidDocument: 'GUID del documento',
  GuidDocument: 'GUID del documento',
  guidDocumento: 'GUID del documento',
  GuidDocumento: 'GUID del documento',
  fecha: 'Fecha',
  Fecha: 'Fecha',
  fechaTimbrado: 'Fecha de timbrado',
  FechaTimbrado: 'Fecha de timbrado',
  nombreEmisor: 'Nombre del emisor',
  NombreEmisor: 'Nombre del emisor',
  emisor: 'Emisor',
  Emisor: 'Emisor',
  rfc: 'RFC',
  RFC: 'RFC',
  rfcEmisor: 'RFC emisor',
  RfcEmisor: 'RFC emisor',
  total: 'Total',
  Total: 'Total',
  importeTotal: 'Importe total',
  ImporteTotal: 'Importe total',
  tipoClasificacion: 'Tipo de clasificacion',
  TipoClasificacion: 'Tipo de clasificacion',
  enviadaAComercial: 'Enviada a comercial',
  EnviadaAComercial: 'Enviada a comercial',
};

export default function EgresoDetallePage() {
  const router = useRouter();
  const { selectedEmpresa } = useAuth();
  const [detail, setDetail] = useState<EgresoDetail | null>(null);
  const [xmlDetail, setXmlDetail] = useState<unknown>(null);
  const [xmlError, setXmlError] = useState('');
  const [isLoadingXml, setIsLoadingXml] = useState(false);
  const [xmlOpen, setXmlOpen] = useState(false);
  const [subtotalFromXml, setSubtotalFromXml] = useState('');
  const [descuentoFromXml, setDescuentoFromXml] = useState('');
  const [trasladosFromXml, setTrasladosFromXml] = useState<Array<{ nombre: string; tasa: string; valor: string }>>([]);
  const [retencionesFromXml, setRetencionesFromXml] = useState<Array<{ nombre: string; valor: string }>>([]);
  const [totalImpuestosTrasladados, setTotalImpuestosTrasladados] = useState('');
  const [totalImpuestosRetenidos, setTotalImpuestosRetenidos] = useState('');

  // CONTPAQi data
  const [conceptos, setConceptos] = useState<Record<string, unknown>[]>([]);
  const [proveedoresRfc, setProveedoresRfc] = useState<Record<string, unknown>[]>([]);
  const [proveedoresTodos, setProveedoresTodos] = useState<Record<string, unknown>[]>([]);
  const [isLoadingContpaqi, setIsLoadingContpaqi] = useState(false);
  const [contpaqiError, setContpaqiError] = useState('');

  const [selectedConcepto, setSelectedConcepto] = useState('');
  const [selectedProveedorRfc, setSelectedProveedorRfc] = useState('');
  const [selectedProveedorManual, setSelectedProveedorManual] = useState('');
  const [providerTab, setProviderTab] = useState<'rfc' | 'todos'>('rfc');

  // Load detail from sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = sessionStorage.getItem('selectedEgresoDetail');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as EgresoDetail;
      setDetail(parsed);
    } catch {
      setDetail(null);
    }
  }, []);

  // Document GUID extraction
  const getDocumentGuid = (row: EgresoDetail | null) => {
    if (!row) return '';
    const candidates = ['guidDocument', 'GuidDocument', 'guidDocumento', 'GuidDocumento', 'guid', 'Guid'];
    for (const candidate of candidates) {
      const value = row[candidate];
      if (value !== undefined && value !== null && value !== '') {
        return String(value);
      }
    }
    return '';
  };

  // Fetch XML
  const fetchXmlDetail = async () => {
    if (!selectedEmpresa || !detail) return;
    const guidDocument = getDocumentGuid(detail);
    if (!guidDocument) {
      setXmlError('No se encontro guidDocument en este egreso');
      setXmlDetail(null);
      return;
    }
    setIsLoadingXml(true);
    setXmlError('');
    try {
      const data = await ApiService.getDetalleXml(selectedEmpresa.guidDsl, guidDocument);
      setXmlDetail(data);
    } catch {
      setXmlError('No se pudo cargar el detalle XML');
      setXmlDetail(null);
    } finally {
      setIsLoadingXml(false);
    }
  };

  useEffect(() => {
    if (!detail || !selectedEmpresa) return;
    fetchXmlDetail();
  }, [detail, selectedEmpresa]);

  // XML content extraction
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

  // Extract subtotal from XML
  const extractSubtotalFromXml = (value: unknown): string => {
    const xmlString = getDisplayXml(value);
    if (!xmlString || typeof xmlString !== 'string') return '';
    
    const match = xmlString.match(/subtotal\s*=\s*["']([^"']+)["']/i) || 
                  xmlString.match(/<[^>]*subtotal[^>]*>([^<]+)<\/[^>]*>/i);
    if (match && match[1]) {
      return String(match[1]);
    }
    return '';
  };

  // Extract Descuento from XML
  const extractDescuentoFromXml = (value: unknown): string => {
    const xmlString = getDisplayXml(value);
    if (!xmlString || typeof xmlString !== 'string') return '';
    // Match Descuento attribute on cfdi:Comprobante or similar root element
    const match = xmlString.match(/Descuento\s*=\s*["']([^"']+)["']/i);
    if (match && match[1]) return String(match[1]);
    return '';
  };

  const impuestosMap: Record<string, string> = {
    '001': 'ISR',
    '002': 'IVA',
    '003': 'IEPS',
  };

  // Extract Traslados from XML with TasaOCuota
  const extractTrasladosFromXml = (value: unknown): Array<{ nombre: string; tasa: string; valor: string }> => {
    const xmlString = getDisplayXml(value);
    if (!xmlString || typeof xmlString !== 'string') return [];

    const traslados: Array<{ nombre: string; tasa: string; valor: string }> = [];
    const trasladosRegex = /<(?:cfdi:)?Traslado\b([^>]*)\/?\s*>/gi;
    let match;
    while ((match = trasladosRegex.exec(xmlString)) !== null) {
      const attrs = match[1];
      const impuestoMatch = attrs.match(/Impuesto\s*=\s*["']([^"']+)["']/);
      const importeMatch = attrs.match(/Importe\s*=\s*["']([^"']+)["']/);
      const tasaMatch = attrs.match(/TasaOCuota\s*=\s*["']([^"']+)["']/);

      if (impuestoMatch && importeMatch) {
        const code = impuestoMatch[1];
        const importe = importeMatch[1];
        const tasa = tasaMatch ? tasaMatch[1] : '';
        const nombre = impuestosMap[code] || `Impuesto ${code}`;
        traslados.push({ nombre, tasa, valor: importe });
      }
    }
    return traslados;
  };

  // Extract Retenciones from XML
  const extractRetencionesFromXml = (value: unknown): Array<{ nombre: string; valor: string }> => {
    const xmlString = getDisplayXml(value);
    if (!xmlString || typeof xmlString !== 'string') return [];

    const retenciones: Array<{ nombre: string; valor: string }> = [];
    const retencionesRegex = /<(?:cfdi:)?Retencion\b([^>]*)\/?\s*>/gi;
    let match;
    while ((match = retencionesRegex.exec(xmlString)) !== null) {
      const attrs = match[1];
      const impuestoMatch = attrs.match(/Impuesto\s*=\s*["']([^"']+)["']/);
      const importeMatch = attrs.match(/Importe\s*=\s*["']([^"']+)["']/);

      if (impuestoMatch && importeMatch) {
        const code = impuestoMatch[1];
        const importe = importeMatch[1];
        const nombre = impuestosMap[code] || `Impuesto ${code}`;
        retenciones.push({ nombre, valor: importe });
      }
    }
    return retenciones;
  };

  // Extract TotalImpuestosTrasladados and TotalImpuestosRetenidos
  const extractImpuestosTotals = (value: unknown): { totalTrasladados: string; totalRetenidos: string } => {
    const xmlString = getDisplayXml(value);
    if (!xmlString || typeof xmlString !== 'string') return { totalTrasladados: '', totalRetenidos: '' };

    const trasladosMatch = xmlString.match(/TotalImpuestosTrasladados\s*=\s*["']([^"']+)["']/i);
    const retenidosMatch = xmlString.match(/TotalImpuestosRetenidos\s*=\s*["']([^"']+)["']/i);

    return {
      totalTrasladados: trasladosMatch ? trasladosMatch[1] : '',
      totalRetenidos: retenidosMatch ? retenidosMatch[1] : '',
    };
  };

  // Extract subtotal, descuento, traslados, retenciones from XML
  useEffect(() => {
    if (!xmlDetail) {
      setSubtotalFromXml('');
      setDescuentoFromXml('');
      setTrasladosFromXml([]);
      setRetencionesFromXml([]);
      setTotalImpuestosTrasladados('');
      setTotalImpuestosRetenidos('');
      return;
    }
    const subtotal = extractSubtotalFromXml(xmlDetail);
    const descuento = extractDescuentoFromXml(xmlDetail);
    const traslados = extractTrasladosFromXml(xmlDetail);
    const retenciones = extractRetencionesFromXml(xmlDetail);
    const totals = extractImpuestosTotals(xmlDetail);

    setSubtotalFromXml(subtotal);
    setDescuentoFromXml(descuento);
    setTrasladosFromXml(traslados);
    setRetencionesFromXml(retenciones);
    setTotalImpuestosTrasladados(totals.totalTrasladados);
    setTotalImpuestosRetenidos(totals.totalRetenidos);
  }, [xmlDetail]);

  // Field formatting
  const formatFieldLabel = (key: string) => {
    if (FIELD_LABELS[key]) return FIELD_LABELS[key];
    const normalized = key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .trim();
    if (!normalized) return key;
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  const formatValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  // Select value helpers
  const getSelectValue = (item: Record<string, unknown>, fallbackPrefix: string, index: number) => {
    const value = getFirstValue(item, [
      'id', 'Id', 'ID', 'guid', 'Guid', 'codigo', 'Codigo', 'cId', 'CId', 'rfc', 'RFC',
    ]);
    if (value === undefined || value === null || value === '') return `${fallbackPrefix}-${index}`;
    return String(value);
  };

  const getConceptoNombre = (item: Record<string, unknown>) => {
    const nombre = getFirstValue(item, [
      'cNombreConcepto', 'CNombreConcepto', 'nombre', 'Nombre', 'concepto', 'Concepto', 'nombreConcepto', 'NombreConcepto',
      'descripcion', 'Descripcion',
    ]);
    if (nombre === undefined || nombre === null || nombre === '') return JSON.stringify(item);
    return String(nombre);
  };

  const getConceptoCode = (item: Record<string, unknown>) => {
    const code = getFirstValue(item, [
      'cCodigoConcepto', 'CCodigoConcepto', 'codigoConcepto', 'CodigoConcepto',
      'codigo', 'Codigo', 'idConcepto', 'IdConcepto',
    ]);
    if (code === undefined || code === null || code === '') return '';
    return String(code);
  };

  const getProveedorCodigoCliente = (item: Record<string, unknown>) => {
    const code = getFirstValue(item, [
      'codigoCliente', 'CodigoCliente', 'cCodigoCliente', 'CCodigoCliente',
      'codigo', 'Codigo', 'idProveedor', 'IdProveedor',
    ]);
    if (code === undefined || code === null || code === '') return 'Sin codigo';
    return String(code);
  };

  const getProveedorRazonSocial = (item: Record<string, unknown>) => {
    const razon = getFirstValue(item, [
      'crAzonSocial', 'CrAzonSocial', 'razonSocial', 'RazonSocial', 'nombre', 'Nombre', 'nombreComercial', 'NombreComercial',
    ]);
    if (razon === undefined || razon === null || razon === '') return 'Sin razon social';
    return String(razon);
  };

  const getProveedorLabel = (item: Record<string, unknown>) => {
    const codigo = getProveedorCodigoCliente(item);
    const razonSocial = getProveedorRazonSocial(item);
    return `${codigo} - ${razonSocial}`;
  };

  const getProveedorSegmento = (item: Record<string, unknown>) => {
    const segmento = getFirstValue(item, ['segmento', 'Segmento', 'cSegmento', 'CSegmento']);
    if (segmento === undefined || segmento === null || segmento === '') return 'Sin segmento';
    return String(segmento);
  };

  const getProveedorSucursal = (item: Record<string, unknown>) => {
    const sucursal = getFirstValue(item, ['sucursal', 'Sucursal', 'cSucursal', 'CSucursal']);
    if (sucursal === undefined || sucursal === null || sucursal === '') return 'Sin sucursal';
    return String(sucursal);
  };

  // Compute derived fields
  const getComputedFields = () => {
    if (!detail) return { serie: '-', folio: '-', rfc: '', uuid: '', emisor: '', total: '', fecha: '', isSent: false };
    const rfc =
      detail.__rfcFuente ??
      getFirstValue(detail, ['rfc', 'RFC', 'rfcEmisor', 'RfcEmisor']) ??
      getValueByKeyHint(detail, ['rfc']) ??
      selectedEmpresa?.rfc;
    const uuid =
      detail.__uuidFuente ??
      getFirstValue(detail, ['uuid', 'UUID', 'Uuid', 'folioFiscal', 'FolioFiscal']) ??
      getValueByKeyHint(detail, ['uuid', 'foliofiscal', 'guiddocument', 'guid']);
    const serieFromPayload = detail.__serieCalculada;
    const folioFromPayload = detail.__folioCalculado;
    const serie =
      serieFromPayload && serieFromPayload !== '-' ? String(serieFromPayload) : getSerieFromRfc(rfc);
    const folio =
      folioFromPayload && folioFromPayload !== '-' ? String(folioFromPayload) : getFolioFromUuid(uuid);
    const emisor = getFirstValue(detail, [
      'nombreEmisor', 'NombreEmisor', 'emisor', 'Emisor', 'razonSocialEmisor', 'RazonSocialEmisor',
    ]);
    const total = getFirstValue(detail, ['total', 'Total', 'importeTotal', 'ImporteTotal']);
    const fecha = getFirstValue(detail, ['fecha', 'Fecha', 'fechaTimbrado', 'FechaTimbrado']);
    const isSent = getComercialStatusFromRow(detail);

    return { serie, folio, rfc, uuid, emisor, total, fecha, isSent };
  };

  const computed = getComputedFields();

  // Detail entries for the collapsible full detail
  const getDetailEntries = (row: EgresoDetail) => {
    const hiddenKeys = new Set([
      '__serieCalculada', '__folioCalculado', '__rfcFuente', '__uuidFuente',
      'serie', 'Serie', 'folio', 'Folio', 'noSerie', 'NoSerie',
      'numeroSerie', 'NumeroSerie', 'numSerie', 'NumSerie',
      'noFolio', 'NoFolio', 'numeroFolio', 'NumeroFolio', 'numFolio', 'NumFolio',
    ]);
    return Object.entries(row).filter(([key]) => !hiddenKeys.has(key));
  };

  // Load CONTPAQi data
  useEffect(() => {
    if (!detail || !selectedEmpresa) return;
    const loadContpaqiData = async () => {
      const databaseName = selectedEmpresa.baseDatos;
      const rfcProveedor =
        getFirstValue(detail, ['rfc', 'RFC', 'rfcEmisor', 'RfcEmisor']) ??
        getValueByKeyHint(detail, ['rfc']);

      setContpaqiError('');
      setIsLoadingContpaqi(true);

      const [conceptosResult, proveedoresRfcResult, proveedoresTodosResult] = await Promise.allSettled([
        ApiService.getConceptosCompras(databaseName),
        ApiService.getProveedores(databaseName, rfcProveedor ? String(rfcProveedor) : undefined),
        ApiService.getProveedores(databaseName),
      ]);

      if (conceptosResult.status === 'fulfilled') {
        setConceptos((conceptosResult.value ?? []) as Record<string, unknown>[]);
      } else {
        setConceptos([]);
        setContpaqiError('No se pudieron cargar los datos de CONTPAQi');
      }

      if (proveedoresRfcResult.status === 'fulfilled') {
        setProveedoresRfc((proveedoresRfcResult.value ?? []) as Record<string, unknown>[]);
      } else {
        setProveedoresRfc([]);
      }

      if (proveedoresTodosResult.status === 'fulfilled') {
        setProveedoresTodos((proveedoresTodosResult.value ?? []) as Record<string, unknown>[]);
      } else {
        setProveedoresTodos([]);
      }

      setIsLoadingContpaqi(false);
    };

    loadContpaqiData();
  }, [detail, selectedEmpresa]);

  // Auto-select first concepto
  useEffect(() => {
    if (selectedConcepto || conceptos.length === 0) return;
    const firstItem = conceptos[0] as Record<string, unknown>;
    setSelectedConcepto(getSelectValue(firstItem, 'concepto', 0));
  }, [conceptos, selectedConcepto]);

  // Auto-select first proveedor by RFC if available
  useEffect(() => {
    if (selectedProveedorRfc || proveedoresRfc.length === 0) return;
    const firstItem = proveedoresRfc[0] as Record<string, unknown>;
    setSelectedProveedorRfc(getSelectValue(firstItem, 'prov-rfc', 0));
  }, [proveedoresRfc, selectedProveedorRfc]);

  const activeProvider = providerTab === 'rfc' ? selectedProveedorRfc : selectedProveedorManual;

  const selectedProviderRecord =
    (providerTab === 'rfc' ? proveedoresRfc : proveedoresTodos).find((item, index) => {
      const option = item as Record<string, unknown>;
      const value = getSelectValue(option, providerTab === 'rfc' ? 'prov-rfc' : 'prov-all', index);
      return value === activeProvider;
    }) as Record<string, unknown> | undefined;

  const selectedSegmento = selectedProviderRecord ? getProveedorSegmento(selectedProviderRecord) : '';
  const selectedSucursal = selectedProviderRecord ? getProveedorSucursal(selectedProviderRecord) : '';

  const selectedConceptoRecord = conceptos.find((item, index) => {
    const option = item as Record<string, unknown>;
    return getSelectValue(option, 'concepto', index) === selectedConcepto;
  }) as Record<string, unknown> | undefined;

  const selectedConceptoLabel = selectedConceptoRecord ? getConceptoNombre(selectedConceptoRecord) : '';
  const selectedConceptoCode = selectedConceptoRecord ? getConceptoCode(selectedConceptoRecord) : '';

  const canSend = !!selectedConcepto && !!activeProvider;

  if (!detail) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <FileCheck className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">
            No hay un egreso seleccionado.
          </p>
          <Button variant="outline" onClick={() => router.push('/egresos')}>
            Ir a egresos
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
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
            <span className="text-sm font-semibold text-foreground truncate max-w-[200px] sm:max-w-none">
              {formatCellValue(computed.emisor)}
            </span>
          </div>
          <Badge
            variant="outline"
            className={`text-xs ${
              computed.isSent
                ? 'border-success/40 text-success bg-success/5'
                : 'border-border text-muted-foreground'
            }`}
          >
            {computed.isSent ? 'Enviado' : 'Pendiente'}
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Two-column layout on desktop */}
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* LEFT COLUMN - Egreso data */}
          <div className="flex-1 space-y-4">
            {/* Key data card */}
            <div className="rounded-lg border bg-card">
              <div className="border-b px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">Datos del egreso</h2>
              </div>
              <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
                <DataCell label="Serie" value={computed.serie} mono />
                <DataCell label="Folio" value={computed.folio} mono />
                <DataCell label="Total" value={formatTotalValue(computed.total)} bold />
                <DataCell label="Fecha" value={formatDateOnly(computed.fecha)} mono />
              </div>
              <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
                <DataCell label="RFC" value={formatCellValue(computed.rfc)} mono />
                <DataCell label="UUID" value={formatCellValue(computed.uuid)} mono small />
              </div>
              {(subtotalFromXml || trasladosFromXml.length > 0 || retencionesFromXml.length > 0 || descuentoFromXml) && (
                <div className="border-t px-4 py-4">
                  <div className="font-mono text-sm space-y-1.5">
                    {/* Subtotal */}
                    {subtotalFromXml && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="text-foreground font-semibold">{formatTotalValue(subtotalFromXml)}</span>
                      </div>
                    )}

                    {/* Descuento */}
                    {descuentoFromXml && (
                      <div className="flex items-center justify-between">
                        <span className="text-red-500">- Descuento</span>
                        <span className="text-red-500 font-semibold">{formatTotalValue(descuentoFromXml)}</span>
                      </div>
                    )}

                    {/* Traslados (IVA, IEPS, etc.) */}
                    {trasladosFromXml.length > 0 && (
                      <>
                        <div className="border-b border-dashed border-border my-2" />
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground pt-0.5">
                          Impuestos trasladados
                        </p>
                        {trasladosFromXml.map((tax, index) => {
                          const tasaPercent = tax.tasa ? `${(parseFloat(tax.tasa) * 100).toFixed(2)}%` : '';
                          return (
                            <div key={`traslado-${index}`} className="flex items-center justify-between">
                              <span className="text-muted-foreground">
                                + {tax.nombre}{tasaPercent ? ` (${tasaPercent})` : ''}
                              </span>
                              <span className="text-foreground font-semibold">{formatTotalValue(tax.valor)}</span>
                            </div>
                          );
                        })}
                        {totalImpuestosTrasladados && (
                          <div className="flex items-center justify-between text-xs pt-0.5">
                            <span className="text-muted-foreground italic">Total trasladados</span>
                            <span className="text-foreground font-medium">{formatTotalValue(totalImpuestosTrasladados)}</span>
                          </div>
                        )}
                      </>
                    )}

                    {/* Retenciones (ISR, IVA retenido, etc.) */}
                    {retencionesFromXml.length > 0 && (
                      <>
                        <div className="border-b border-dashed border-border my-2" />
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground pt-0.5">
                          Retenciones
                        </p>
                        {retencionesFromXml.map((ret, index) => (
                          <div key={`retencion-${index}`} className="flex items-center justify-between">
                            <span className="text-orange-500">- Ret. {ret.nombre}</span>
                            <span className="text-orange-500 font-semibold">{formatTotalValue(ret.valor)}</span>
                          </div>
                        ))}
                        {totalImpuestosRetenidos && (
                          <div className="flex items-center justify-between text-xs pt-0.5">
                            <span className="text-muted-foreground italic">Total retenidos</span>
                            <span className="text-foreground font-medium">{formatTotalValue(totalImpuestosRetenidos)}</span>
                          </div>
                        )}
                      </>
                    )}

                    {/* Separator and Total */}
                    <div className="border-b-2 border-border my-2" />
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-foreground font-bold">Total</span>
                      <span className="text-lg font-bold text-primary">{formatTotalValue(computed.total)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* XML Detail - collapsible */}
            <Collapsible open={xmlOpen} onOpenChange={setXmlOpen}>
              <div className="rounded-lg border bg-card">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent/50 transition-colors rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Code2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold text-foreground">Detalle XML</span>
                      {isLoadingXml && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                      {xmlError && (
                        <span className="text-xs text-destructive">{xmlError}</span>
                      )}
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        xmlOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t px-4 py-3">
                    {xmlDetail !== null ? (
                      <pre className="font-mono text-xs leading-5 whitespace-pre-wrap break-all text-muted-foreground max-h-80 overflow-y-auto">
                        {getDisplayXml(xmlDetail) || 'No se encontro contenido XML en la respuesta'}
                      </pre>
                    ) : !isLoadingXml && !xmlError ? (
                      <p className="text-xs text-muted-foreground">Esperando respuesta del XML...</p>
                    ) : null}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Full detail - collapsible */}
            <Collapsible>
              <div className="rounded-lg border bg-card">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent/50 transition-colors rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold text-foreground">Todos los campos</span>
                      <span className="text-xs text-muted-foreground">
                        ({getDetailEntries(detail).length})
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t divide-y">
                    {getDetailEntries(detail).map(([key, value]) => (
                      <div key={key} className="flex gap-4 px-4 py-2">
                        <span className="w-40 shrink-0 text-xs font-medium text-muted-foreground">
                          {formatFieldLabel(key)}
                        </span>
                        <span className="text-xs font-mono text-foreground break-all">
                          {formatValue(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>

          {/* RIGHT COLUMN - Send to CONTPAQi */}
          <div className="w-full lg:w-80 xl:w-96 shrink-0">
            <div className="rounded-lg border bg-card lg:sticky lg:top-20">
              <div className="border-b px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">Enviar a CONTPAQi</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Revisa los datos y envia con un clic
                </p>
              </div>

              <div className="p-4 space-y-4">
                {contpaqiError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    {contpaqiError}
                  </div>
                )}

                {isLoadingContpaqi ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    {/* Concepto */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Concepto</Label>
                      <Select value={selectedConcepto} onValueChange={setSelectedConcepto}>
                        <SelectTrigger className="h-9 bg-background text-sm">
                          <SelectValue placeholder="Selecciona concepto" />
                        </SelectTrigger>
                        <SelectContent>
                          {conceptos.map((item, index) => {
                            const option = item as Record<string, unknown>;
                            const value = getSelectValue(option, 'concepto', index);
                            const label = getConceptoNombre(option);
                            const code = getConceptoCode(option);
                            return (
                              <SelectItem key={`${value}-${index}`} value={value}>
                                {code ? `${code} - ${label}` : label}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Proveedor */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Proveedor</Label>
                        <div className="flex rounded-md border bg-muted p-0.5">
                          <button
                            type="button"
                            onClick={() => setProviderTab('rfc')}
                            className={`rounded-sm px-2 py-0.5 text-[10px] font-medium transition-colors ${
                              providerTab === 'rfc'
                                ? 'bg-card text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Por RFC ({proveedoresRfc.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setProviderTab('todos')}
                            className={`rounded-sm px-2 py-0.5 text-[10px] font-medium transition-colors ${
                              providerTab === 'todos'
                                ? 'bg-card text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Todos ({proveedoresTodos.length})
                          </button>
                        </div>
                      </div>

                      {providerTab === 'rfc' ? (
                        <Select
                          value={selectedProveedorRfc}
                          onValueChange={(val) => {
                            setSelectedProveedorRfc(val);
                            setProviderTab('rfc');
                          }}
                        >
                          <SelectTrigger className="h-9 bg-background text-sm">
                            <SelectValue placeholder="Selecciona proveedor" />
                          </SelectTrigger>
                          <SelectContent>
                            {proveedoresRfc.map((item, index) => {
                              const option = item as Record<string, unknown>;
                              const value = getSelectValue(option, 'prov-rfc', index);
                              const label = getProveedorLabel(option);
                              return (
                                <SelectItem key={`${value}-${index}`} value={value}>
                                  {label}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Select
                          value={selectedProveedorManual}
                          onValueChange={(val) => {
                            setSelectedProveedorManual(val);
                            setProviderTab('todos');
                          }}
                        >
                          <SelectTrigger className="h-9 bg-background text-sm">
                            <SelectValue placeholder="Selecciona proveedor" />
                          </SelectTrigger>
                          <SelectContent>
                            {proveedoresTodos.map((item, index) => {
                              const option = item as Record<string, unknown>;
                              const value = getSelectValue(option, 'prov-all', index);
                              const label = getProveedorLabel(option);
                              return (
                                <SelectItem key={`${value}-${index}`} value={value}>
                                  {label}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <Separator />

                    {/* Auto-populated fields */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Datos automaticos (del proveedor)
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-md border bg-muted/50 px-3 py-2">
                          <p className="text-[10px] text-muted-foreground">Segmento</p>
                          <p className="text-xs font-medium text-foreground truncate">
                            {selectedSegmento || '-'}
                          </p>
                        </div>
                        <div className="rounded-md border bg-muted/50 px-3 py-2">
                          <p className="text-[10px] text-muted-foreground">Sucursal</p>
                          <p className="text-xs font-medium text-foreground truncate">
                            {selectedSucursal || '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Summary */}
                    {canSend && (
                      <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Check className="h-3 w-3 text-primary" />
                          <span className="text-[10px] font-medium text-primary">Listo para enviar</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground space-y-0.5">
                          <p>Concepto: {selectedConceptoCode ? `${selectedConceptoCode} - ${selectedConceptoLabel}` : selectedConceptoLabel}</p>
                          <p>Segmento: {selectedSegmento || '-'}</p>
                          <p>Sucursal: {selectedSucursal || '-'}</p>
                        </div>
                      </div>
                    )}

                    <Button className="w-full gap-2" disabled={!canSend}>
                      <Send className="h-4 w-4" />
                      Enviar a CONTPAQi
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* Reusable data cell for the key fields grid */
function DataCell({
  label,
  value,
  mono,
  bold,
  small,
}: {
  label: string;
  value: string;
  mono?: boolean;
  bold?: boolean;
  small?: boolean;
}) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">
        {label}
      </p>
      <p
        className={`text-sm text-foreground truncate ${mono ? 'font-mono' : ''} ${
          bold ? 'font-semibold' : ''
        } ${small ? 'text-xs' : ''}`}
      >
        {value}
      </p>
    </div>
  );
}
