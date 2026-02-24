'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
} from '@/lib/egreso-helpers';
import type { Egreso } from '@/lib/types';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
} from 'lucide-react';

export default function EgresosPage() {
  const router = useRouter();
  const { token, selectedEmpresa, logout } = useAuth();
  const [egresos, setEgresos] = useState<Egreso[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [comercialFilter, setComercialFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSent, setShowSent] = useState(true);

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
        const fields = extractEgresoFields(row, selectedEmpresa?.rfc ?? '');

        const matchesComercial =
          comercialFilter === 'all' ||
          (comercialFilter === 'yes' ? isComercialSent : !isComercialSent);
        const matchesCategory = categoryFilter === 'all' || category === categoryFilter;
        const matchesSentToggle = showSent || !isComercialSent;

        if (!searchQuery.trim()) return matchesComercial && matchesCategory && matchesSentToggle;

        const q = searchQuery.toLowerCase();
        const matchesSearch =
          formatCellValue(fields.emisor).toLowerCase().includes(q) ||
          formatCellValue(fields.rfc).toLowerCase().includes(q) ||
          formatCellValue(fields.uuid).toLowerCase().includes(q) ||
          fields.serie.toLowerCase().includes(q);

        return matchesComercial && matchesCategory && matchesSentToggle && matchesSearch;
      }),
    [egresos, comercialFilter, categoryFilter, searchQuery, selectedEmpresa?.rfc, showSent]
  );

  const sentCount = useMemo(
    () => egresos.filter((e) => getComercialStatusFromRow(e as Record<string, unknown>)).length,
    [egresos]
  );
  const pendingCount = egresos.length - sentCount;

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
      localStorage.setItem('selectedEgresoDetail', JSON.stringify(detailPayload));
    }
    if (typeof window !== 'undefined') {
      window.open('/egresos/detalle', '_blank', 'noopener');
      return;
    }
    router.push('/egresos/detalle');
  };

  useEffect(() => {
    if (selectedEmpresa && fromDate && toDate) {
      fetchEgresos();
    }
  }, [fromDate, toDate]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!selectedEmpresa) {
    return null;
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
              onClick={() => router.push('/empresas')}
              className="gap-1.5 text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Empresas</span>
            </Button>
            <Separator orientation="vertical" className="h-5" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{selectedEmpresa.nombre}</span>
              <span className="hidden text-xs text-muted-foreground font-mono sm:inline">
                {selectedEmpresa.rfc}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5 text-muted-foreground">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Page heading */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Egresos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Revisa, filtra y envia tus egresos a CONTPAQi
          </p>
        </div>

        {/* Stats strip */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => setComercialFilter('all')}
            className={`flex flex-col items-center rounded-lg border px-4 py-3 text-center transition-colors ${
              comercialFilter === 'all'
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:bg-accent'
            }`}
          >
            <span className="text-2xl font-bold text-foreground">{egresos.length}</span>
            <span className="text-xs text-muted-foreground">Total</span>
          </button>
          <button
            type="button"
            onClick={() => setComercialFilter('yes')}
            className={`flex flex-col items-center rounded-lg border px-4 py-3 text-center transition-colors ${
              comercialFilter === 'yes'
                ? 'border-success bg-success/5'
                : 'border-border bg-card hover:bg-accent'
            }`}
          >
            <span className="text-2xl font-bold text-foreground">{sentCount}</span>
            <span className="text-xs text-muted-foreground">Enviados</span>
          </button>
          <button
            type="button"
            onClick={() => setComercialFilter('no')}
            className={`flex flex-col items-center rounded-lg border px-4 py-3 text-center transition-colors ${
              comercialFilter === 'no'
                ? 'border-destructive bg-destructive/5'
                : 'border-border bg-card hover:bg-accent'
            }`}
          >
            <span className="text-2xl font-bold text-foreground">{pendingCount}</span>
            <span className="text-xs text-muted-foreground">Pendientes</span>
          </button>
          <div className="flex flex-col items-center rounded-lg border border-dashed px-4 py-3 text-center bg-card/50">
            <span className="text-2xl font-bold text-muted-foreground">-</span>
            <span className="text-xs text-muted-foreground">Cancelados</span>
            <span className="mt-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
              En Desarrollo
            </span>
          </div>
        </div>

        {/* Filters row */}
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
            <div className="w-44">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-9 bg-card">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorias</SelectItem>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5">
              <Switch checked={showSent} onCheckedChange={setShowSent} />
              <span className="text-xs text-muted-foreground">Mostrar enviados a CONTPAQi</span>
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
            <Button size="sm" onClick={() => router.push('/egresos/rapido')} className="h-9">
              Envio rapido
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
            <p className="text-sm font-medium text-destructive">{error}</p>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Cargando egresos...</p>
            </div>
          </div>
        ) : filteredEgresos.length > 0 ? (
          <div className="space-y-2">
            {filteredEgresos.map((egreso, index) => {
              const row = egreso as Record<string, unknown>;
              const fields = extractEgresoFields(row, selectedEmpresa.rfc);

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() =>
                    handleViewDetail(egreso, fields.rfc, fields.uuid, fields.serie, fields.folio)
                  }
                  className="group flex w-full items-center gap-4 rounded-lg border bg-card px-4 py-3 text-left transition-all hover:border-primary/40 hover:shadow-sm"
                >
                  {/* Status indicator */}
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      fields.isComercialSent
                        ? 'bg-success/10 text-success'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {fields.isComercialSent ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Clock className="h-4 w-4" />
                    )}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {formatCellValue(fields.emisor)}
                      </span>
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-[10px] px-1.5 py-0 ${
                          fields.isComercialSent
                            ? 'border-success/40 text-success bg-success/5'
                            : 'border-border text-muted-foreground'
                        }`}
                      >
                        {fields.isComercialSent ? 'Enviado' : 'Pendiente'}
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono">{formatCellValue(fields.rfc)}</span>
                      <span className="hidden sm:inline">{'|'}</span>
                      <span className="hidden sm:inline font-mono">
                        Serie: {fields.serie} / Folio: {fields.folio}
                      </span>
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="hidden shrink-0 flex-col items-end gap-0.5 sm:flex">
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      {formatTotalValue(fields.total)}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatDateOnly(fields.fecha)}
                    </span>
                  </div>

                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              );
            })}
          </div>
        ) : egresos.length > 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              No se encontraron egresos para el filtro seleccionado
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
