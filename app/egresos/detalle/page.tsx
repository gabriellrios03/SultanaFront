'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiService } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
  tipoClasificacion: 'Tipo de clasificación',
  TipoClasificacion: 'Tipo de clasificación',
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
  const [conceptos, setConceptos] = useState<Record<string, unknown>[]>([]);
  const [proveedoresRfc, setProveedoresRfc] = useState<Record<string, unknown>[]>([]);
  const [proveedoresTodos, setProveedoresTodos] = useState<Record<string, unknown>[]>([]);
  const [isLoadingConceptos, setIsLoadingConceptos] = useState(false);
  const [isLoadingProveedoresRfc, setIsLoadingProveedoresRfc] = useState(false);
  const [isLoadingProveedoresTodos, setIsLoadingProveedoresTodos] = useState(false);
  const [contpaqiError, setContpaqiError] = useState('');
  const [selectedConcepto, setSelectedConcepto] = useState('');
  const [selectedProveedorRfc, setSelectedProveedorRfc] = useState('');
  const [selectedProveedorManual, setSelectedProveedorManual] = useState('');
  const [providerTab, setProviderTab] = useState<'rfc' | 'todos'>('rfc');

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

  const fetchXmlDetail = async () => {
    if (!selectedEmpresa || !detail) return;

    const guidDocument = getDocumentGuid(detail);
    if (!guidDocument) {
      setXmlError('No se encontró guidDocument en este egreso');
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
        if (typeof valueByKey === 'string' && valueByKey.trim() !== '') {
          return valueByKey;
        }
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

  const getFirstValue = (row: Record<string, unknown>, keys: string[]) => {
    for (const key of keys) {
      const value = row[key];
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
    return undefined;
  };

  const getValueByKeyHint = (row: Record<string, unknown>, hints: string[]) => {
    const entries = Object.entries(row);
    for (const [key, value] of entries) {
      if (value === undefined || value === null || value === '') continue;

      const normalizedKey = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const hasHint = hints.some((hint) => normalizedKey.includes(hint));
      if (hasHint) return value;
    }
    return undefined;
  };

  const getSelectValue = (item: Record<string, unknown>, fallbackPrefix: string, index: number) => {
    const value = getFirstValue(item, [
      'id',
      'Id',
      'ID',
      'guid',
      'Guid',
      'codigo',
      'Codigo',
      'cId',
      'CId',
      'rfc',
      'RFC',
    ]);

    if (value === undefined || value === null || value === '') {
      return `${fallbackPrefix}-${index}`;
    }

    return String(value);
  };

  const getConceptoNombre = (item: Record<string, unknown>) => {
    const nombre = getFirstValue(item, [
      'nombre',
      'Nombre',
      'concepto',
      'Concepto',
      'nombreConcepto',
      'NombreConcepto',
      'descripcion',
      'Descripcion',
    ]);

    if (nombre === undefined || nombre === null || nombre === '') {
      return JSON.stringify(item);
    }

    return String(nombre);
  };

  const getProveedorCodigoCliente = (item: Record<string, unknown>) => {
    const code = getFirstValue(item, [
      'codigoCliente',
      'CodigoCliente',
      'cCodigoCliente',
      'CCodigoCliente',
      'codigo',
      'Codigo',
      'idProveedor',
      'IdProveedor',
    ]);

    if (code === undefined || code === null || code === '') {
      return 'Sin código';
    }

    return String(code);
  };

  const getProveedorRazonSocial = (item: Record<string, unknown>) => {
    const razon = getFirstValue(item, [
      'razonSocial',
      'RazonSocial',
      'nombre',
      'Nombre',
      'nombreComercial',
      'NombreComercial',
    ]);

    if (razon === undefined || razon === null || razon === '') {
      return 'Sin razón social';
    }

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

  const getConceptoCode = (item: Record<string, unknown>) => {
    const code = getFirstValue(item, [
      'cCodigoConcepto',
      'CCodigoConcepto',
      'codigoConcepto',
      'CodigoConcepto',
      'codigo',
      'Codigo',
      'idConcepto',
      'IdConcepto',
    ]);

    if (code === undefined || code === null || code === '') {
      return 'Sin código';
    }

    return String(code);
  };

  const getSerieFromRfc = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '-';

    const rfc = String(value).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!rfc) return '-';

    if (rfc.length >= 13) {
      return rfc.slice(0, 4) || '-';
    }

    const firstThree = rfc.slice(0, 3);
    return firstThree ? `F${firstThree}` : '-';
  };

  const getFolioFromUuid = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '-';

    const digits = String(value).replace(/\D/g, '');
    if (!digits) return '-';

    const withoutLeadingZeros = digits.replace(/^0+/, '');
    if (!withoutLeadingZeros) return '-';

    return withoutLeadingZeros.slice(0, 3) || '-';
  };

  const getDetailEntries = (row: EgresoDetail) => {
    const serieFromPayload = row.__serieCalculada;
    const folioFromPayload = row.__folioCalculado;
    const rfc =
      row.__rfcFuente ??
      getFirstValue(row, ['rfc', 'RFC', 'rfcEmisor', 'RfcEmisor']) ??
      getValueByKeyHint(row, ['rfc']) ??
      selectedEmpresa?.rfc;
    const uuid =
      row.__uuidFuente ??
      getFirstValue(row, ['uuid', 'UUID', 'Uuid', 'folioFiscal', 'FolioFiscal']) ??
      getValueByKeyHint(row, ['uuid', 'foliofiscal', 'guiddocument', 'guid']);
    const serie =
      serieFromPayload !== undefined &&
      serieFromPayload !== null &&
      serieFromPayload !== '' &&
      serieFromPayload !== '-'
        ? serieFromPayload
        : getSerieFromRfc(rfc);
    const folio =
      folioFromPayload !== undefined &&
      folioFromPayload !== null &&
      folioFromPayload !== '' &&
      folioFromPayload !== '-'
        ? folioFromPayload
        : getFolioFromUuid(uuid);

    const hiddenKeys = new Set([
      '__serieCalculada',
      '__folioCalculado',
      '__rfcFuente',
      '__uuidFuente',
      'serie',
      'Serie',
      'folio',
      'Folio',
      'noSerie',
      'NoSerie',
      'numeroSerie',
      'NumeroSerie',
      'numSerie',
      'NumSerie',
      'noFolio',
      'NoFolio',
      'numeroFolio',
      'NumeroFolio',
      'numFolio',
      'NumFolio',
    ]);

    const visibleEntries = Object.entries(row).filter(([key]) => !hiddenKeys.has(key));

    return [
      ['__serieCalculada', serie] as [string, unknown],
      ['__folioCalculado', folio] as [string, unknown],
      ...visibleEntries,
    ];
  };

  useEffect(() => {
    if (!detail || !selectedEmpresa) return;

    const loadContpaqiData = async () => {
      const databaseName = selectedEmpresa.baseDatos;
      const rfcProveedor =
        getFirstValue(detail, ['rfc', 'RFC', 'rfcEmisor', 'RfcEmisor']) ??
        getValueByKeyHint(detail, ['rfc']);

      setContpaqiError('');
      setIsLoadingConceptos(true);
      setIsLoadingProveedoresRfc(true);
      setIsLoadingProveedoresTodos(true);

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
        setContpaqiError('No se pudieron cargar los datos de CONTPAQi');
      }

      if (proveedoresTodosResult.status === 'fulfilled') {
        setProveedoresTodos((proveedoresTodosResult.value ?? []) as Record<string, unknown>[]);
      } else {
        setProveedoresTodos([]);
        setContpaqiError('No se pudieron cargar los datos de CONTPAQi');
      }

      setIsLoadingConceptos(false);
      setIsLoadingProveedoresRfc(false);
      setIsLoadingProveedoresTodos(false);
    };

    loadContpaqiData();
  }, [detail, selectedEmpresa]);

  useEffect(() => {
    if (selectedConcepto || conceptos.length === 0) return;

    const firstItem = conceptos[0] as Record<string, unknown>;
    const firstValue = getSelectValue(firstItem, 'concepto', 0);
    setSelectedConcepto(firstValue);
  }, [conceptos, selectedConcepto]);

  const selectedProvider = providerTab === 'rfc' ? selectedProveedorRfc : selectedProveedorManual;

  const selectedConceptoRecord = conceptos.find((item, index) => {
    const option = item as Record<string, unknown>;
    const value = getSelectValue(option, 'concepto', index);
    return value === selectedConcepto;
  }) as Record<string, unknown> | undefined;

  const selectedConceptoLabel = selectedConceptoRecord
    ? getConceptoNombre(selectedConceptoRecord)
    : '';

  const selectedProviderRecord =
    (providerTab === 'rfc' ? proveedoresRfc : proveedoresTodos).find((item, index) => {
      const option = item as Record<string, unknown>;
      const value = getSelectValue(option, providerTab === 'rfc' ? 'prov-rfc' : 'prov-all', index);
      return value === selectedProvider;
    }) as Record<string, unknown> | undefined;

  const selectedSegmento = selectedProviderRecord ? getProveedorSegmento(selectedProviderRecord) : '';
  const selectedSucursal = selectedProviderRecord ? getProveedorSucursal(selectedProviderRecord) : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => router.push('/egresos')}
          className="mb-4 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Egresos
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              XML del egreso
            </CardTitle>
            <CardDescription>
              {detail
                ? 'Se carga automáticamente el XML del documento seleccionado'
                : 'No hay un egreso seleccionado para mostrar'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!detail ? (
              <div className="text-center py-10 rounded-md border border-dashed">
                <p className="text-muted-foreground mb-4">
                  Abre un egreso desde la tabla y toca “Ver detalle” para ver toda su información.
                </p>
                <Button onClick={() => router.push('/egresos')}>Ir a egresos</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {isLoadingXml && (
                  <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                    Cargando XML...
                  </div>
                )}

                {!isLoadingXml && !xmlError && xmlDetail === null && (
                  <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                    Esperando respuesta del XML...
                  </div>
                )}

                {xmlError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {xmlError}
                  </div>
                )}

                {xmlDetail !== null && (
                  <div className="rounded-md border bg-muted/20 p-3">
                    <pre className="font-mono text-xs whitespace-pre-wrap break-all leading-5">
                      {getDisplayXml(xmlDetail) || 'No se encontró contenido XML en la respuesta'}
                    </pre>
                  </div>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Detalle completo</CardTitle>
                    <CardDescription>
                      Información completa del egreso con nombres de campo legibles
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[240px]">Campo</TableHead>
                            <TableHead>Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getDetailEntries(detail).map(([key, value]) => (
                            <TableRow key={key}>
                              <TableCell className="font-medium whitespace-nowrap align-top">
                                {formatFieldLabel(key)}
                              </TableCell>
                              <TableCell className="align-top">
                                <pre className="font-mono text-xs whitespace-pre-wrap break-all leading-5">
                                  {formatValue(value)}
                                </pre>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Mandar a CONTPAQi</CardTitle>
                    <CardDescription>
                      Llena las pestañas antes de mandar: Concepto, Proveedor por RFC o Proveedor manual
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {contpaqiError && (
                      <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {contpaqiError}
                      </div>
                    )}

                    <Tabs defaultValue="concepto" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="concepto">Concepto</TabsTrigger>
                        <TabsTrigger value="proveedor-rfc">Proveedor RFC</TabsTrigger>
                        <TabsTrigger value="proveedor-todos">Todos proveedores</TabsTrigger>
                      </TabsList>

                      <TabsContent value="concepto" className="mt-3">
                        <div className="space-y-2">
                          <Label>Concepto</Label>
                          <Select value={selectedConcepto} onValueChange={setSelectedConcepto}>
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={isLoadingConceptos ? 'Cargando conceptos...' : 'Selecciona concepto'}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {conceptos.map((item, index) => {
                                const option = item as Record<string, unknown>;
                                const value = getSelectValue(option, 'concepto', index);
                                const label = getConceptoNombre(option);

                                return (
                                  <SelectItem key={`${value}-${index}`} value={value}>
                                    {label}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      </TabsContent>

                      <TabsContent value="proveedor-rfc" className="mt-3">
                        <div className="space-y-2">
                          <Label>Proveedor (filtrado por RFC)</Label>
                          <Select
                            value={selectedProveedorRfc}
                            onValueChange={(value) => {
                              setSelectedProveedorRfc(value);
                              setProviderTab('rfc');
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={
                                  isLoadingProveedoresRfc
                                    ? 'Cargando proveedores por RFC...'
                                    : 'Selecciona proveedor por RFC'
                                }
                              />
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
                        </div>
                      </TabsContent>

                      <TabsContent value="proveedor-todos" className="mt-3">
                        <div className="space-y-2">
                          <Label>Proveedor (lista completa)</Label>
                          <Select
                            value={selectedProveedorManual}
                            onValueChange={(value) => {
                              setSelectedProveedorManual(value);
                              setProviderTab('todos');
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={
                                  isLoadingProveedoresTodos
                                    ? 'Cargando todos los proveedores...'
                                    : 'Selecciona cualquier proveedor'
                                }
                              />
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
                        </div>
                      </TabsContent>
                    </Tabs>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                        <p className="text-muted-foreground">Segmento (automático)</p>
                        <p className="font-medium">{selectedSegmento || 'Sin seleccionar proveedor'}</p>
                      </div>
                      <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                        <p className="text-muted-foreground">Sucursal (automática)</p>
                        <p className="font-medium">{selectedSucursal || 'Sin seleccionar proveedor'}</p>
                      </div>
                    </div>

                    <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                      Concepto: {selectedConceptoLabel || 'Sin seleccionar'} • Proveedor: {selectedProvider || 'Sin seleccionar'} • Segmento: {selectedSegmento || 'Sin seleccionar'} • Sucursal: {selectedSucursal || 'Sin seleccionar'}
                    </div>

                    <Button className="w-full sm:w-auto" disabled={!selectedConcepto || !selectedProvider}>
                      Mandar a CONTPAQi
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
