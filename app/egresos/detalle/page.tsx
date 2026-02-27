'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, ChevronDown, Code2, FileCheck, Loader2, Send, Tag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
  getCategoryFromRow,
} from '@/lib/egreso-helpers';
import { getRentasDefaultsForEmpresa } from '@/lib/ArrendamientoSettings';
import { getRegimenFiscalDescription } from '@/lib/regimen-fiscal-catalog';

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
  const [totalImpuestosTrasladados, setTotalImpuestosTrasladados] = useState('');
  const [totalImpuestosRetenidos, setTotalImpuestosRetenidos] = useState('');

  // CONTPAQi data
  const [conceptos, setConceptos] = useState<Record<string, unknown>[]>([]);
  const [productos, setProductos] = useState<Record<string, unknown>[]>([]);
  const [proveedoresRfc, setProveedoresRfc] = useState<Record<string, unknown>[]>([]);
  const [proveedoresTodos, setProveedoresTodos] = useState<Record<string, unknown>[]>([]);
  const [isLoadingContpaqi, setIsLoadingContpaqi] = useState(false);
  const [contpaqiError, setContpaqiError] = useState('');

  const [selectedConcepto, setSelectedConcepto] = useState('');
  const [selectedProducto, setSelectedProducto] = useState('');
  const [selectedProveedorRfc, setSelectedProveedorRfc] = useState('');
  const [selectedProveedorManual, setSelectedProveedorManual] = useState('');
  const [providerTab, setProviderTab] = useState<'rfc' | 'todos'>('rfc');
  const [conceptoQuery, setConceptoQuery] = useState('');
  const [productoQuery, setProductoQuery] = useState('');
  const [proveedorRfcQuery, setProveedorRfcQuery] = useState('');
  const [proveedorTodosQuery, setProveedorTodosQuery] = useState('');
  const [manualSegmento, setManualSegmento] = useState('');
  const [manualSucursal, setManualSucursal] = useState('');
  const [isSendingContpaqi, setIsSendingContpaqi] = useState(false);
  const [sendContpaqiError, setSendContpaqiError] = useState('');
  const [sendContpaqiSuccess, setSendContpaqiSuccess] = useState('');

  // Load detail from sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = sessionStorage.getItem('selectedEgresoDetail') || localStorage.getItem('selectedEgresoDetail');
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

  // Extract TotalImpuestosTrasladados and TotalImpuestosRetenidos from global nodo <cfdi:Impuestos>
  // IMPORTANTE: Solo usamos los totales globales del SAT, NO los impuestos por concepto
  const extractImpuestosTotals = (value: unknown): { totalTrasladados: string; totalRetenidos: string } => {
    const xmlString = getDisplayXml(value);
    if (!xmlString || typeof xmlString !== 'string') return { totalTrasladados: '', totalRetenidos: '' };

    // Buscar en el nodo global <cfdi:Impuestos> (no en los de cada concepto)
    const trasladosMatch = xmlString.match(/TotalImpuestosTrasladados\s*=\s*["']([^"']+)["']/i);
    const retenidosMatch = xmlString.match(/TotalImpuestosRetenidos\s*=\s*["']([^"']+)["']/i);

    return {
      totalTrasladados: trasladosMatch ? trasladosMatch[1] : '',
      totalRetenidos: retenidosMatch ? retenidosMatch[1] : '',
    };
  };

  // Extract subtotal, descuento, and total impuestos from XML (global level only per CFDI 4.0)
  useEffect(() => {
    if (!xmlDetail) {
      setSubtotalFromXml('');
      setDescuentoFromXml('');
      setTotalImpuestosTrasladados('');
      setTotalImpuestosRetenidos('');
      return;
    }
    const subtotal = extractSubtotalFromXml(xmlDetail);
    const descuento = extractDescuentoFromXml(xmlDetail);
    const totals = extractImpuestosTotals(xmlDetail);

    setSubtotalFromXml(subtotal);
    setDescuentoFromXml(descuento);
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

  const matchesQuery = (label: string, query: string) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return true;
    return label.toLowerCase().includes(normalizedQuery);
  };

  const getTagAttributes = (xml: string, tag: string) => {
    const match = xml.match(new RegExp(`<\s*(?:cfdi:)?${tag}\\b([^>]*)>`, 'i'));
    return match ? match[1] : '';
  };

  const getAttrValue = (attrs: string, attr: string) => {
    const match = attrs.match(new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, 'i'));
    return match ? match[1] : '';
  };

  const getComprobanteAttr = (xml: string, attr: string) => {
    const attrs = getTagAttributes(xml, 'Comprobante');
    return getAttrValue(attrs, attr);
  };

  const getGlobalImpuestosSection = (xml: string) => {
    const matches = Array.from(
      xml.matchAll(/<(?:[a-zA-Z_][\w.-]*:)?Impuestos\b[\s\S]*?<\/(?:[a-zA-Z_][\w.-]*:)?Impuestos>/gi)
    );
    return matches.length > 0 ? matches[matches.length - 1][0] : '';
  };

  const formatTasaPercent = (tasa: string) => {
    const value = Number(tasa);
    if (!Number.isFinite(value)) return '';
    return `${(value * 100).toFixed(2)}%`;
  };

  const formatXmlRateToPercent = (tasaRaw: string) => {
    const cleaned = String(tasaRaw || '').trim();
    if (!cleaned) return '';

    const value = Number(cleaned);
    if (!Number.isFinite(value)) return '';

    if (Math.abs(value) <= 1) {
      const decimalPart = cleaned.split('.')[1] || '';
      const scaledDecimals = Math.max(0, decimalPart.length - 2);
      const scaled = (value * 100).toFixed(scaledDecimals).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
      return `${scaled}%`;
    }

    const normalized = cleaned.replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
    return `${normalized}%`;
  };

  const getRetencionesFromXml = (xml: string) => {
    if (!xml) return [] as Array<{ impuesto: string; tasa: string; importe: string; impuestoCodigo: string }>;
    return Array.from(xml.matchAll(/<(?:[a-zA-Z_][\w.-]*:)?Retencion\b([^>]*)\/?>/gi)).map((match) => {
      const attrs = match[1] || '';
      const impuestoCodigo = getAttrValue(attrs, 'Impuesto');
      return {
        impuestoCodigo,
        impuesto: impuestosMap[impuestoCodigo] || impuestoCodigo,
        tasa: formatXmlRateToPercent(getAttrValue(attrs, 'TasaOCuota')),
        importe: getAttrValue(attrs, 'Importe'),
      };
    });
  };

  const getRetencionTasaMap = (xml: string) => {
    const tasaMap = new Map<string, string>();
    getRetencionesFromXml(xml).forEach((retencion) => {
      if (!retencion.tasa) return;
      if (retencion.impuestoCodigo && !tasaMap.has(retencion.impuestoCodigo)) {
        tasaMap.set(retencion.impuestoCodigo, retencion.tasa);
      }
      if (retencion.impuesto && !tasaMap.has(retencion.impuesto)) {
        tasaMap.set(retencion.impuesto, retencion.tasa);
      }
    });
    return tasaMap;
  };

  const impuestosMap: Record<string, string> = {
    '001': 'ISR',
    '002': 'IVA',
    '003': 'IEPS',
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

  const getProductoNombre = (item: Record<string, unknown>) => {
    const nombre = getFirstValue(item, [
      'cNombreProducto', 'CNombreProducto', 'cnombreproducto', 'nombreProducto', 'NombreProducto', 'nombre', 'Nombre',
      'descripcion', 'Descripcion',
    ]);
    if (nombre === undefined || nombre === null || nombre === '') return JSON.stringify(item);
    return String(nombre);
  };

  const getProductoCode = (item: Record<string, unknown>) => {
    const code = getFirstValue(item, [
      'cCodigoProducto', 'CCodigoProducto', 'ccodigoproducto', 'codigoProducto', 'CodigoProducto', 'codigo', 'Codigo',
      'idProducto', 'IdProducto',
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
    if (segmento === undefined || segmento === null || segmento === '') return '';
    return String(segmento);
  };

  const getProveedorSucursal = (item: Record<string, unknown>) => {
    const sucursal = getFirstValue(item, ['sucursal', 'Sucursal', 'cSucursal', 'CSucursal']);
    if (sucursal === undefined || sucursal === null || sucursal === '') return '';
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
  const categoria = detail ? getCategoryFromRow(detail) : 'Sin categoria';
  const categoriaLower = categoria.toLowerCase();
  const getCategoriaClasses = (value: string) => {
    const normalized = value.toLowerCase();
    if (normalized.includes('servicio')) return 'border-primary/40 text-primary bg-primary/10';
    if (normalized.includes('compra')) return 'border-amber-500/40 text-amber-600 bg-amber-500/10';
    if (normalized.includes('gasto')) return 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10';
    return 'border-border text-muted-foreground bg-muted/30';
  };

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

      const [conceptosResult, productosResult, proveedoresRfcResult, proveedoresTodosResult] = await Promise.allSettled([
        ApiService.getConceptosCompras(databaseName),
        ApiService.getProductos(databaseName),
        ApiService.getProveedores(databaseName, rfcProveedor ? String(rfcProveedor) : undefined),
        ApiService.getProveedores(databaseName),
      ]);

      if (conceptosResult.status === 'fulfilled') {
        setConceptos((conceptosResult.value ?? []) as Record<string, unknown>[]);
      } else {
        setConceptos([]);
        setContpaqiError('No se pudieron cargar los datos de CONTPAQi');
      }

      if (productosResult.status === 'fulfilled') {
        setProductos((productosResult.value ?? []) as Record<string, unknown>[]);
      } else {
        setProductos([]);
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

  const emisorRegimenFiscal = useMemo(() => {
    const xmlString = getDisplayXml(xmlDetail);
    if (!xmlString) return '';
    const emisorAttrs = getTagAttributes(xmlString, 'Emisor');
    return (
      getAttrValue(emisorAttrs, 'RegimenFiscal') ||
      ''
    );
  }, [xmlDetail]);

  const hasIva08 = useMemo(() => {
    const xmlString = getDisplayXml(xmlDetail);
    if (!xmlString) return false;
    const globalImpuestos = getGlobalImpuestosSection(xmlString);
    if (!globalImpuestos) return false;
    const traslados = Array.from(globalImpuestos.matchAll(/<(?:cfdi:)?Traslado\b([^>]*)>/gi));
    return traslados.some((match) => {
      const attrs = match[1] || '';
      const impuesto = getAttrValue(attrs, 'Impuesto');
      const tasa = getAttrValue(attrs, 'TasaOCuota');
      const rate = Number(tasa);
      const isIva = impuesto === '002' || impuesto.toUpperCase() === 'IVA';
      return isIva && Number.isFinite(rate) && Math.abs(rate - 0.08) < 0.0001;
    });
  }, [xmlDetail]);

  const rentasDefaults = useMemo(() => {
    if (categoriaLower !== 'rentas') return null;
    return getRentasDefaultsForEmpresa(
      selectedEmpresa?.baseDatos ?? '',
      emisorRegimenFiscal,
      hasIva08
    );
  }, [categoriaLower, selectedEmpresa?.baseDatos, emisorRegimenFiscal, hasIva08]);

  // Auto-select first concepto
  useEffect(() => {
    if (categoriaLower === 'rentas') return;
    if (selectedConcepto || conceptos.length === 0) return;
    const firstItem = conceptos[0] as Record<string, unknown>;
    setSelectedConcepto(getSelectValue(firstItem, 'concepto', 0));
  }, [categoriaLower, conceptos, selectedConcepto]);

  // Auto-select first producto
  useEffect(() => {
    if (categoriaLower === 'rentas') return;
    if (selectedProducto || productos.length === 0) return;
    const firstItem = productos[0] as Record<string, unknown>;
    setSelectedProducto(getSelectValue(firstItem, 'producto', 0));
  }, [categoriaLower, productos, selectedProducto]);

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
  const displaySegmento = selectedSegmento || manualSegmento;
  const displaySucursal = selectedSucursal || manualSucursal;

  useEffect(() => {
    if (manualSegmento === '' && selectedSegmento) {
      setManualSegmento(selectedSegmento);
    }
  }, [manualSegmento, selectedSegmento]);

  useEffect(() => {
    if (manualSucursal === '' && selectedSucursal) {
      setManualSucursal(selectedSucursal);
    }
  }, [manualSucursal, selectedSucursal]);

  const selectedConceptoRecord = conceptos.find((item, index) => {
    const option = item as Record<string, unknown>;
    return getSelectValue(option, 'concepto', index) === selectedConcepto;
  }) as Record<string, unknown> | undefined;

  const selectedConceptoLabel = selectedConceptoRecord ? getConceptoNombre(selectedConceptoRecord) : '';
  const selectedConceptoCode = selectedConceptoRecord ? getConceptoCode(selectedConceptoRecord) : '';

  const findSelectValueByCode = (
    items: Record<string, unknown>[],
    code: string,
    kind: 'concepto' | 'producto',
    getCode: (item: Record<string, unknown>) => string
  ) => {
    for (let index = 0; index < items.length; index += 1) {
      const option = items[index] as Record<string, unknown>;
      if (getCode(option) === code) {
        return getSelectValue(option, kind, index);
      }
    }
    return '';
  };

  const selectedProductoRecord = productos.find((item, index) => {
    const option = item as Record<string, unknown>;
    return getSelectValue(option, 'producto', index) === selectedProducto;
  }) as Record<string, unknown> | undefined;

  const selectedProductoCode = selectedProductoRecord ? getProductoCode(selectedProductoRecord) : '';

  const productosFiltrados = useMemo(() => {
    return productos
      .map((item, index) => {
        const option = item as Record<string, unknown>;
        const value = getSelectValue(option, 'producto', index);
        const label = getProductoNombre(option);
        const code = getProductoCode(option);
        const displayLabel = code ? `${code} - ${label}` : label;
        return { value, displayLabel, index };
      })
      .filter((item) => matchesQuery(item.displayLabel, productoQuery));
  }, [productos, productoQuery]);

  const canSend =
    !!selectedConcepto &&
    !!activeProvider &&
    displaySegmento.trim() !== '' &&
    displaySucursal.trim() !== '';

  useEffect(() => {
    if (categoriaLower !== 'rentas') return;
    if (!rentasDefaults) return;

    if (!selectedConcepto && rentasDefaults.concepto) {
      const value = findSelectValueByCode(conceptos, rentasDefaults.concepto, 'concepto', getConceptoCode);
      if (value) setSelectedConcepto(value);
    }

    if (!selectedProducto && rentasDefaults.producto) {
      const value = findSelectValueByCode(productos, rentasDefaults.producto, 'producto', getProductoCode);
      if (value) setSelectedProducto(value);
    }
  }, [
    categoriaLower,
    rentasDefaults,
    conceptos,
    productos,
    selectedConcepto,
    selectedProducto,
  ]);
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

  const tasaRetencionIVA = useMemo(() => {
    const xmlString = getDisplayXml(xmlDetail);
    if (!xmlString) return 0;

    const globalImpuestos = getGlobalImpuestosSection(xmlString);
    const tasasPorImpuesto = getRetencionTasaMap(xmlString);
    const retencionesGlobales = getRetencionesFromXml(globalImpuestos);
    const retenciones = retencionesGlobales.length > 0 ? retencionesGlobales : getRetencionesFromXml(xmlString);
    const ivaRetenido = retenciones.find((retencion) => retencion.impuestoCodigo === '002' || retencion.impuesto === 'IVA');
    const tasaIva = ivaRetenido?.tasa || tasasPorImpuesto.get('002') || tasasPorImpuesto.get('IVA') || '';
    if (!tasaIva) return 0;

    const tasa = Number(tasaIva.replace('%', ''));
    if (Number.isFinite(tasa)) return tasa;

    return 0;
  }, [xmlDetail]);

  const subtotalValue = subtotalFromXml || computed.total;
  const contpaqiPayload = useMemo(() => {
    const folioNumber = normalizeNumber(String(computed.folio ?? ''));
    const fechaOriginal = String(computed.fecha ?? '');
    const subtotalNormalizado =
      typeof subtotalValue === 'string' || typeof subtotalValue === 'number'
        ? subtotalValue
        : String(subtotalValue ?? '');
    return {
      empresaRutaOrName: selectedEmpresa?.baseDatos || '',
      codConcepto: selectedConceptoCode || selectedConceptoLabel || '',
      serie: computed.serie || '',
      folio: typeof folioNumber === 'number' ? folioNumber : 0,
      fecha: normalizeDate(fechaOriginal) || normalizeDate(formatDateOnly(fechaOriginal)) || '',
      codigoCteProv: selectedProviderRecord ? getProveedorCodigoCliente(selectedProviderRecord) : '',
      referencia: displaySucursal || '',
      asociarUUID: computed.uuid || '',
      asociarBaseDb: selectedEmpresa?.guidDsl || '',
      movimientos: [
        {
          unidades: 1,
          precio: normalizeNumber(subtotalNormalizado),
          tasaRetencionIVA,
          codProdSer: selectedProductoCode || '',
          referencia: displaySucursal || '',
          segmento: displaySegmento || '',
        },
      ],
    };
  }, [
    computed.folio,
    computed.serie,
    computed.fecha,
    computed.uuid,
    displaySegmento,
    displaySucursal,
    selectedConceptoCode,
    selectedConceptoLabel,
    selectedProductoCode,
    selectedEmpresa?.baseDatos,
    selectedEmpresa?.guidDsl,
    selectedProviderRecord,
    subtotalValue,
    tasaRetencionIVA,
  ]);

  const handleSendContpaqi = async () => {
    if (!canSend || computed.isSent) return;
    setIsSendingContpaqi(true);
    setSendContpaqiError('');
    setSendContpaqiSuccess('');
    try {
      await ApiService.crearDocumento(contpaqiPayload as Record<string, unknown>);
      setSendContpaqiSuccess('Documento enviado a CONTPAQi');
    } catch {
      setSendContpaqiError('No se pudo enviar el documento a CONTPAQi');
    } finally {
      setIsSendingContpaqi(false);
    }
  };
  const cfdiVisual = useMemo(() => {
    const xmlString = getDisplayXml(xmlDetail);
    if (!xmlString) {
      return {
        emisor: { rfc: '-', nombre: '-', regimen: '-' },
        receptor: { rfc: '-', nombre: '-', usoCfdi: '-', domicilio: '-', regimen: '-' },
        comprobante: { subtotal: '-', descuento: '-', total: '-', fecha: '-', metodoPago: '-' },
        conceptos: [],
        traslados: [],
        retenciones: [],
      };
    }

    const emisorAttrs = getTagAttributes(xmlString, 'Emisor');
    const receptorAttrs = getTagAttributes(xmlString, 'Receptor');
    const comprobanteAttrs = getTagAttributes(xmlString, 'Comprobante');
    const globalImpuestos = getGlobalImpuestosSection(xmlString);
    const tasasPorImpuesto = getRetencionTasaMap(xmlString);

    const conceptos = Array.from(xmlString.matchAll(/<(?:cfdi:)?Concepto\b([^>]*)>/gi)).map((match) => {
      const attrs = match[1] || '';
      return {
        clave: getAttrValue(attrs, 'ClaveProdServ'),
        cantidad: getAttrValue(attrs, 'Cantidad'),
        unidad: getAttrValue(attrs, 'Unidad') || getAttrValue(attrs, 'ClaveUnidad'),
        descripcion: getAttrValue(attrs, 'Descripcion'),
        valorUnitario: getAttrValue(attrs, 'ValorUnitario'),
        importe: getAttrValue(attrs, 'Importe'),
        descuento: getAttrValue(attrs, 'Descuento'),
      };
    });

    const traslados = Array.from(globalImpuestos.matchAll(/<(?:cfdi:)?Traslado\b([^>]*)>/gi)).map((match) => {
      const attrs = match[1] || '';
      const impuesto = getAttrValue(attrs, 'Impuesto');
      return {
        impuesto: impuestosMap[impuesto] || impuesto,
        tasa: formatTasaPercent(getAttrValue(attrs, 'TasaOCuota')),
        importe: getAttrValue(attrs, 'Importe'),
      };
    });

    const retencionesGlobales = getRetencionesFromXml(globalImpuestos);
    const retenciones = (retencionesGlobales.length > 0 ? retencionesGlobales : getRetencionesFromXml(xmlString)).map((retencion) => ({
      ...retencion,
      tasa:
        retencion.tasa ||
        tasasPorImpuesto.get(retencion.impuestoCodigo) ||
        tasasPorImpuesto.get(retencion.impuesto) ||
        '',
    }));

    return {
      emisor: {
        rfc: getAttrValue(emisorAttrs, 'Rfc') || '-',
        nombre: getAttrValue(emisorAttrs, 'Nombre') || '-',
        regimen: getAttrValue(emisorAttrs, 'RegimenFiscal') || '-',
      },
      receptor: {
        rfc: getAttrValue(receptorAttrs, 'Rfc') || '-',
        nombre: getAttrValue(receptorAttrs, 'Nombre') || '-',
        usoCfdi: getAttrValue(receptorAttrs, 'UsoCFDI') || '-',
        domicilio: getAttrValue(receptorAttrs, 'DomicilioFiscalReceptor') || '-',
        regimen: getAttrValue(receptorAttrs, 'RegimenFiscalReceptor') || getAttrValue(receptorAttrs, 'RegimenFiscal') || '-',
      },
      comprobante: {
        subtotal: getAttrValue(comprobanteAttrs, 'SubTotal') || getAttrValue(comprobanteAttrs, 'Subtotal') || '-',
        descuento: getAttrValue(comprobanteAttrs, 'Descuento') || '-',
        total: getAttrValue(comprobanteAttrs, 'Total') || '-',
        fecha: getAttrValue(comprobanteAttrs, 'Fecha') || '-',
        metodoPago: getAttrValue(comprobanteAttrs, 'MetodoPago') || '-',
      },
      conceptos,
      traslados,
      retenciones,
    };
  }, [xmlDetail]);

  const retencionesSeparadas = useMemo(() => {
    const totalsByImpuesto = new Map<string, { impuesto: string; tasa: string; importe: number }>();

    cfdiVisual.retenciones.forEach((retencion) => {
      const impuesto = String(retencion.impuesto || '').trim() || 'Retención';
      const tasa = String(retencion.tasa || '').trim();
      const importeRaw =
        typeof retencion.importe === 'string' || typeof retencion.importe === 'number'
          ? retencion.importe
          : String(retencion.importe ?? '');
      const importe = normalizeNumber(importeRaw);
      if (!Number.isFinite(importe)) return;
      const key = `${impuesto}|${tasa}`;
      const current = totalsByImpuesto.get(key);
      if (current) {
        totalsByImpuesto.set(key, {
          ...current,
          importe: current.importe + importe,
        });
        return;
      }
      totalsByImpuesto.set(key, { impuesto, tasa, importe });
    });

    return Array.from(totalsByImpuesto.values());
  }, [cfdiVisual.retenciones]);

  if (!detail) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <FileCheck className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">
            No hay un egreso seleccionado.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.close();
                if (!window.closed) {
                  router.back();
                }
              } else {
                router.back();
              }
            }}
          >
            Cerrar
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
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.close();
                  if (!window.closed) {
                    router.back();
                  }
                } else {
                  router.back();
                }
              }}
              className="gap-1.5 text-muted-foreground"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Cerrar</span>
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
              <div className="border-b px-4 py-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">Datos del egreso</h2>
                <Badge variant="outline" className={`text-[10px] uppercase tracking-wide ${getCategoriaClasses(categoria)}`}>
                  {categoria}
                </Badge>
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
              <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
                <DataCell label="Regimen fiscal" value={getRegimenFiscalDescription(cfdiVisual.emisor.regimen)} small />
                <DataCell label="Metodo de pago" value={cfdiVisual.comprobante.metodoPago || '-'} mono />
              </div>
              {(subtotalFromXml || totalImpuestosTrasladados || totalImpuestosRetenidos || descuentoFromXml || retencionesSeparadas.length > 0) && (
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

                    {/* Total Traslados (global del CFDI, no por concepto) */}
                    {totalImpuestosTrasladados && (
                      <>
                        <div className="border-b border-dashed border-border my-2" />
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">+ IVA (16%)</span>
                          <span className="text-foreground font-semibold">{formatTotalValue(totalImpuestosTrasladados)}</span>
                        </div>
                      </>
                    )}

                    {/* Retenciones separadas por impuesto (global del CFDI) */}
                    {(retencionesSeparadas.length > 0 || totalImpuestosRetenidos) && (
                      <>
                        <div className="border-b border-dashed border-border my-2" />
                        {retencionesSeparadas.length > 0 ? (
                          retencionesSeparadas.map((retencion) => (
                            <div key={`retencion-resumen-${retencion.impuesto}-${retencion.tasa}`} className="flex items-center justify-between">
                              <span className="text-orange-500">
                                - Retención {retencion.impuesto}{retencion.tasa ? ` (${retencion.tasa})` : ''}
                              </span>
                              <span className="text-orange-500 font-semibold">{formatTotalValue(retencion.importe)}</span>
                            </div>
                          ))
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="text-orange-500">- Retenciones</span>
                            <span className="text-orange-500 font-semibold">{formatTotalValue(totalImpuestosRetenidos)}</span>
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

            {/* CFDI Visual - collapsible */}
            <Collapsible>
              <div className="rounded-lg border bg-card">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent/50 transition-colors rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold text-foreground">Vista CFDI 4.0</span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t px-4 py-4 space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-md border bg-muted/30 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Emisor</p>
                        <p className="text-sm font-semibold text-foreground truncate">{cfdiVisual.emisor.nombre}</p>
                        <p className="text-xs text-muted-foreground font-mono">RFC: {cfdiVisual.emisor.rfc}</p>
                        <p className="text-xs text-muted-foreground">Regimen: {cfdiVisual.emisor.regimen}</p>
                      </div>
                      <div className="rounded-md border bg-muted/30 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Receptor</p>
                        <p className="text-sm font-semibold text-foreground truncate">{cfdiVisual.receptor.nombre}</p>
                        <p className="text-xs text-muted-foreground font-mono">RFC: {cfdiVisual.receptor.rfc}</p>
                        <p className="text-xs text-muted-foreground">Uso CFDI: {cfdiVisual.receptor.usoCfdi}</p>
                        <p className="text-xs text-muted-foreground">Domicilio: {cfdiVisual.receptor.domicilio}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-md border bg-muted/30 px-3 py-2">
                        <p className="text-[10px] text-muted-foreground">Serie</p>
                        <p className="text-xs font-mono text-foreground">{computed.serie || '-'}</p>
                      </div>
                      <div className="rounded-md border bg-muted/30 px-3 py-2">
                        <p className="text-[10px] text-muted-foreground">Folio</p>
                        <p className="text-xs font-mono text-foreground">{computed.folio || '-'}</p>
                      </div>
                      <div className="rounded-md border bg-muted/30 px-3 py-2">
                        <p className="text-[10px] text-muted-foreground">UUID</p>
                        <p className="text-xs font-mono text-foreground truncate" title={formatCellValue(computed.uuid)}>
                          {formatCellValue(computed.uuid)}
                        </p>
                      </div>
                      <div className="rounded-md border bg-muted/30 px-3 py-2">
                        <p className="text-[10px] text-muted-foreground">Fecha timbrado</p>
                        <p className="text-xs font-mono text-foreground">{formatCellValue(cfdiVisual.comprobante.fecha)}</p>
                      </div>
                    </div>

                    <div className="rounded-md border overflow-hidden">
                      <div className="bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
                        Conceptos
                      </div>
                      <div className="divide-y">
                        {cfdiVisual.conceptos.length === 0 ? (
                          <div className="px-3 py-3 text-xs text-muted-foreground">-</div>
                        ) : (
                          cfdiVisual.conceptos.map((concepto, index) => (
                            <div key={`concepto-${index}`} className="px-3 py-2 grid grid-cols-1 gap-2 sm:grid-cols-5">
                              <div className="sm:col-span-2">
                                <p className="text-xs text-muted-foreground">Descripcion</p>
                                <p className="text-sm text-foreground">{concepto.descripcion || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Cantidad</p>
                                <p className="text-sm font-mono text-foreground">{concepto.cantidad || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Valor unitario</p>
                                <p className="text-sm font-mono text-foreground">{concepto.valorUnitario || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Importe</p>
                                <p className="text-sm font-mono text-foreground">{concepto.importe || '-'}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-md border px-3 py-3 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">Impuestos globales</p>
                      {cfdiVisual.traslados.length === 0 && cfdiVisual.retenciones.length === 0 ? (
                        <p className="text-xs text-muted-foreground">-</p>
                      ) : (
                        <>
                          {cfdiVisual.traslados.map((tax, index) => (
                            <div key={`traslado-${index}`} className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {tax.impuesto}{tax.tasa ? ` (${tax.tasa})` : ''}
                              </span>
                              <span className="text-xs font-mono text-foreground">{tax.importe || '-'}</span>
                            </div>
                          ))}
                          {cfdiVisual.retenciones.map((tax, index) => (
                            <div key={`retencion-${index}`} className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                Retencion {tax.impuesto}{tax.tasa ? ` (${tax.tasa})` : ''}
                              </span>
                              <span className="text-xs font-mono text-foreground">{tax.importe || '-'}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div className="rounded-md border bg-muted/30 px-3 py-2">
                        <p className="text-[10px] text-muted-foreground">Subtotal</p>
                        <p className="text-sm font-mono text-foreground">{cfdiVisual.comprobante.subtotal}</p>
                      </div>
                      <div className="rounded-md border bg-muted/30 px-3 py-2">
                        <p className="text-[10px] text-muted-foreground">Descuento</p>
                        <p className="text-sm font-mono text-foreground">{cfdiVisual.comprobante.descuento}</p>
                      </div>
                      <div className="rounded-md border bg-muted/30 px-3 py-2">
                        <p className="text-[10px] text-muted-foreground">Total</p>
                        <p className="text-sm font-mono text-foreground">{cfdiVisual.comprobante.total}</p>
                      </div>
                    </div>
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
                  <div className="border-t">
                    <div className="px-4 py-3 border-b">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Preview CONTPAQi
                      </p>
                      <pre className="mt-2 max-h-64 overflow-y-auto rounded-md border bg-muted/40 px-3 py-2 text-[11px] leading-5 text-muted-foreground whitespace-pre-wrap break-all">
                        {JSON.stringify(contpaqiPayload, null, 2)}
                      </pre>
                    </div>
                    <div className="divide-y">
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

                {sendContpaqiError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    {sendContpaqiError}
                  </div>
                )}

                {sendContpaqiSuccess && (
                  <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-600">
                    {sendContpaqiSuccess}
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
                        <SelectTrigger className="h-9 bg-background text-sm overflow-hidden">
                          <SelectValue className="truncate" placeholder="Selecciona concepto" />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="px-2 pb-2">
                            <Input
                              value={conceptoQuery}
                              onChange={(event) => setConceptoQuery(event.target.value)}
                              placeholder="Buscar por nombre o codigo"
                              className="h-8 bg-background text-xs"
                              onKeyDown={(event) => event.stopPropagation()}
                            />
                          </div>
                          {conceptos.map((item, index) => {
                            const option = item as Record<string, unknown>;
                            const value = getSelectValue(option, 'concepto', index);
                            const label = getConceptoNombre(option);
                            const code = getConceptoCode(option);
                            const displayLabel = code ? `${code} - ${label}` : label;
                            if (!matchesQuery(displayLabel, conceptoQuery)) return null;
                            return (
                              <SelectItem key={`${value}-${index}`} value={value}>
                                <span className="block max-w-full truncate" title={displayLabel}>
                                  {displayLabel}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Producto */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Producto</Label>
                      <Select value={selectedProducto} onValueChange={setSelectedProducto}>
                        <SelectTrigger className="h-9 bg-background text-sm overflow-hidden">
                          <SelectValue className="truncate" placeholder="Selecciona producto" />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="px-2 pb-2">
                            <Input
                              value={productoQuery}
                              onChange={(event) => setProductoQuery(event.target.value)}
                              placeholder="Buscar por nombre o codigo"
                              className="h-8 bg-background text-xs"
                              onKeyDown={(event) => event.stopPropagation()}
                            />
                          </div>
                          {productosFiltrados.length === 0 ? (
                            <div className="px-2 py-1 text-xs text-muted-foreground">Sin resultados</div>
                          ) : (
                            productosFiltrados.map((item) => (
                              <SelectItem key={`${item.value}-${item.index}`} value={item.value}>
                                <span className="block max-w-full truncate" title={item.displayLabel}>
                                  {item.displayLabel}
                                </span>
                              </SelectItem>
                            ))
                          )}
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
                          <SelectTrigger className="h-9 bg-background text-sm overflow-hidden">
                            <SelectValue className="truncate" placeholder="Selecciona proveedor" />
                          </SelectTrigger>
                          <SelectContent>
                            <div className="px-2 pb-2">
                              <Input
                                value={proveedorRfcQuery}
                                onChange={(event) => setProveedorRfcQuery(event.target.value)}
                                placeholder="Buscar por nombre o codigo"
                                className="h-8 bg-background text-xs"
                                onKeyDown={(event) => event.stopPropagation()}
                              />
                            </div>
                            {proveedoresRfc.map((item, index) => {
                              const option = item as Record<string, unknown>;
                              const value = getSelectValue(option, 'prov-rfc', index);
                              const label = getProveedorLabel(option);
                              if (!matchesQuery(label, proveedorRfcQuery)) return null;
                              return (
                                <SelectItem key={`${value}-${index}`} value={value}>
                                  <span className="block max-w-full truncate" title={label}>
                                    {label}
                                  </span>
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
                          <SelectTrigger className="h-9 bg-background text-sm overflow-hidden">
                            <SelectValue className="truncate" placeholder="Selecciona proveedor" />
                          </SelectTrigger>
                          <SelectContent>
                            <div className="px-2 pb-2">
                              <Input
                                value={proveedorTodosQuery}
                                onChange={(event) => setProveedorTodosQuery(event.target.value)}
                                placeholder="Buscar por nombre o codigo"
                                className="h-8 bg-background text-xs"
                                onKeyDown={(event) => event.stopPropagation()}
                              />
                            </div>
                            {proveedoresTodos.map((item, index) => {
                              const option = item as Record<string, unknown>;
                              const value = getSelectValue(option, 'prov-all', index);
                              const label = getProveedorLabel(option);
                              if (!matchesQuery(label, proveedorTodosQuery)) return null;
                              return (
                                <SelectItem key={`${value}-${index}`} value={value}>
                                  <span className="block max-w-full truncate" title={label}>
                                    {label}
                                  </span>
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
                          <Input
                            value={manualSegmento}
                            onChange={(event) => setManualSegmento(event.target.value)}
                            placeholder={selectedSegmento ? 'Editar segmento' : 'Escribe segmento'}
                            className="h-7 bg-background text-xs"
                          />
                        </div>
                        <div className="rounded-md border bg-muted/50 px-3 py-2">
                          <p className="text-[10px] text-muted-foreground">Sucursal</p>
                          <Input
                            value={manualSucursal}
                            onChange={(event) => setManualSucursal(event.target.value)}
                            placeholder={selectedSucursal ? 'Editar sucursal' : 'Escribe sucursal'}
                            className="h-7 bg-background text-xs"
                          />
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
                          <p>Segmento: {displaySegmento || '-'}</p>
                          <p>Sucursal: {displaySucursal || '-'}</p>
                        </div>
                      </div>
                    )}

                    <Button
                      className="w-full gap-2"
                      disabled={!canSend || computed.isSent || isSendingContpaqi}
                      onClick={handleSendContpaqi}
                    >
                      {isSendingContpaqi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {computed.isSent ? 'Enviada a CONTPAQi' : 'Enviar a CONTPAQi'}
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
