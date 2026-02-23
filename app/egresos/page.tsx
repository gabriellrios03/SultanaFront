'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiService } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Egreso } from '@/lib/types';
import { ArrowLeft, Building2, Calendar, CheckCircle2, Eye, FileText, Loader2, RefreshCw, XCircle } from 'lucide-react';

export default function EgresosPage() {
  const router = useRouter();
  const { token, selectedEmpresa } = useAuth();
  const [egresos, setEgresos] = useState<Egreso[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [comercialFilter, setComercialFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const getFirstValue = (row: Record<string, unknown>, keys: string[]) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
        return row[key];
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

  const formatCellValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const formatTotalValue = (value: unknown) => {
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

  const formatDateOnly = (value: unknown) => {
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

  const parseComercialStatus = (value: unknown) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return ['1', 'true', 'si', 'sí', 'yes', 'enviado'].includes(normalized);
    }
    return false;
  };

  const getSerieFromRfc = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '-';

    const rfc = String(value).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!rfc) return '-';

    const isPersonaFisica = rfc.length >= 13;
    if (isPersonaFisica) {
      const firstFour = rfc.slice(0, 4);
      return firstFour || '-';
    }

    const firstThree = rfc.slice(0, 3);
    if (!firstThree) return '-';
    return `F${firstThree}`;
  };

  const getFolioFromUuid = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '-';

    const uuid = String(value);
    const digits = uuid.replace(/\D/g, '');
    if (!digits) return '-';

    const withoutLeadingZeros = digits.replace(/^0+/, '');
    if (!withoutLeadingZeros) return '-';

    return withoutLeadingZeros.slice(0, 3) || '-';
  };

  const getComercialStatusFromRow = (row: Record<string, unknown>) => {
    const comercialRaw = getFirstValue(row, [
      'enviadaAComercial',
      'EnviadaAComercial',
      'enviadaComercial',
      'EnviadaComercial',
      'enviadoComercial',
      'EnviadoComercial',
      'enviadoAComercial',
      'EnviadoAComercial',
      'comercial',
      'Comercial',
    ]);

    return parseComercialStatus(comercialRaw);
  };

  const getCategoryFromRow = (row: Record<string, unknown>) => {
    const categoryValue = getFirstValue(row, [
      'tipoClasificacion',
      'TipoClasificacion',
    ]);

    if (categoryValue === null || categoryValue === undefined || categoryValue === '') {
      return 'Sin categoría';
    }

    return String(categoryValue);
  };

  const categoryOptions = useMemo(() => {
    const categories = new Set<string>();

    egresos.forEach((egreso) => {
      const row = egreso as Record<string, unknown>;
      categories.add(getCategoryFromRow(row));
    });

    return Array.from(categories).sort((a, b) => a.localeCompare(b, 'es'));
  }, [egresos]);

  useEffect(() => {
    if (categoryFilter !== 'all' && !categoryOptions.includes(categoryFilter)) {
      setCategoryFilter('all');
    }
  }, [categoryFilter, categoryOptions]);

  const filteredEgresos = useMemo(
    () =>
      egresos.filter((egreso) => {
        const row = egreso as Record<string, unknown>;
        const isComercialSent = getComercialStatusFromRow(row);
        const category = getCategoryFromRow(row);

        const matchesComercial =
          comercialFilter === 'all' ||
          (comercialFilter === 'yes' ? isComercialSent : !isComercialSent);
        const matchesCategory = categoryFilter === 'all' || category === categoryFilter;

        return matchesComercial && matchesCategory;
      }),
    [egresos, comercialFilter, categoryFilter]
  );

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
        selectedDate
      );
      setEgresos(data);
    } catch (err) {
      setError('Error al cargar los egresos');
      setEgresos([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDetail = (
    egreso: Egreso,
    resolvedRfc: unknown,
    resolvedUuid: unknown,
    resolvedSerie: string,
    resolvedFolio: string
  ) => {
    if (typeof window !== 'undefined') {
      const detailPayload = {
        ...(egreso as Record<string, unknown>),
        __rfcFuente: resolvedRfc ?? '',
        __uuidFuente: resolvedUuid ?? '',
        __serieCalculada: resolvedSerie,
        __folioCalculado: resolvedFolio,
      };

      sessionStorage.setItem('selectedEgresoDetail', JSON.stringify(detailPayload));
    }

    router.push('/egresos/detalle');
  };

  useEffect(() => {
    if (selectedEmpresa && selectedDate) {
      fetchEgresos();
    }
  }, [selectedDate]);

  if (!selectedEmpresa) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push('/empresas')}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Empresas
          </Button>
          
          <Card className="border-2 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl text-balance">
                    {selectedEmpresa.nombre}
                  </CardTitle>
                  <CardDescription className="text-base">
                    RFC: {selectedEmpresa.rfc}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Filter */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Filtrar Egresos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="date">Fecha</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={fetchEgresos}
                  disabled={isLoading}
                  className="h-11 gap-2 w-full sm:w-auto"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cargando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Actualizar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-destructive font-medium">{error}</p>
          </div>
        )}

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Listado de Egresos
            </CardTitle>
            <CardDescription>
              {filteredEgresos.length > 0 
                ? `${filteredEgresos.length} egreso${filteredEgresos.length !== 1 ? 's' : ''} encontrado${filteredEgresos.length !== 1 ? 's' : ''}`
                : 'No hay egresos para mostrar'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center space-y-4">
                  <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                  <p className="text-muted-foreground">Cargando egresos...</p>
                </div>
              </div>
            ) : egresos.length > 0 ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={comercialFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setComercialFilter('all')}
                  >
                    Todos ({egresos.length})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={comercialFilter === 'yes' ? 'default' : 'outline'}
                    onClick={() => setComercialFilter('yes')}
                  >
                    Comercial Sí
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={comercialFilter === 'no' ? 'default' : 'outline'}
                    onClick={() => setComercialFilter('no')}
                  >
                    Comercial No
                  </Button>

                  <div className="w-full sm:w-[260px] sm:ml-auto">
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Filtrar por categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las categorías</SelectItem>
                        {categoryOptions.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {filteredEgresos.length === 0 ? (
                  <div className="text-center py-10 rounded-md border border-dashed">
                    <p className="text-muted-foreground">
                      No se encontraron egresos para el filtro seleccionado
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Fecha</TableHead>
                      <TableHead className="whitespace-nowrap">Emisor</TableHead>
                      <TableHead className="whitespace-nowrap">Rfc</TableHead>
                      <TableHead className="whitespace-nowrap">Serie</TableHead>
                      <TableHead className="whitespace-nowrap">Folio</TableHead>
                      <TableHead className="whitespace-nowrap">UUID</TableHead>
                      <TableHead className="whitespace-nowrap">Total</TableHead>
                      <TableHead className="whitespace-nowrap">Comercial</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEgresos.map((egreso, index) => {
                      const row = egreso as Record<string, unknown>;
                      const fecha = getFirstValue(row, ['fecha', 'Fecha', 'fechaTimbrado', 'FechaTimbrado']);
                      const emisor = getFirstValue(row, [
                        'nombreEmisor',
                        'NombreEmisor',
                        'emisor',
                        'Emisor',
                        'razonSocialEmisor',
                        'RazonSocialEmisor',
                      ]);
                      const rfc =
                        getFirstValue(row, ['rfc', 'RFC', 'rfcEmisor', 'RfcEmisor']) ??
                        getValueByKeyHint(row, ['rfc']) ??
                        selectedEmpresa.rfc;
                      const uuid =
                        getFirstValue(row, ['uuid', 'UUID', 'Uuid', 'folioFiscal', 'FolioFiscal']) ??
                        getValueByKeyHint(row, ['uuid', 'foliofiscal', 'guiddocument', 'guid']);
                      const serie = getSerieFromRfc(rfc);
                      const folio = getFolioFromUuid(uuid);
                      const total = getFirstValue(row, ['total', 'Total', 'importeTotal', 'ImporteTotal']);
                      const isComercialSent = getComercialStatusFromRow(row);

                      return (
                        <TableRow key={index}>
                          <TableCell className="align-top">
                            <span className="font-mono text-xs break-all">{formatDateOnly(fecha)}</span>
                          </TableCell>
                          <TableCell className="align-top">
                            <span className="font-mono text-xs break-all">{formatCellValue(emisor)}</span>
                          </TableCell>
                          <TableCell className="align-top">
                            <span className="font-mono text-xs break-all">{formatCellValue(rfc)}</span>
                          </TableCell>
                          <TableCell className="align-top">
                            <span className="font-mono text-xs break-all">{serie}</span>
                          </TableCell>
                          <TableCell className="align-top">
                            <span className="font-mono text-xs break-all">{folio}</span>
                          </TableCell>
                          <TableCell className="align-top">
                            <span className="font-mono text-xs break-all">{formatCellValue(uuid)}</span>
                          </TableCell>
                          <TableCell className="align-top">
                            <span className="font-mono text-xs break-all">{formatTotalValue(total)}</span>
                          </TableCell>
                          <TableCell className="align-top">
                            <Badge
                              variant="outline"
                              className={
                                isComercialSent
                                  ? 'gap-1.5 border-chart-4/40 bg-chart-4/15 text-chart-4 animate-pulse'
                                  : 'gap-1.5 border-destructive/40 bg-destructive/10 text-destructive'
                              }
                            >
                              {isComercialSent ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5" />
                              )}
                              {isComercialSent ? 'Sí' : 'No'}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() => handleViewDetail(egreso, rfc, uuid, serie, folio)}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Ver detalle
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16">
                <FileText className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">
                  No se encontraron egresos para la fecha seleccionada
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
