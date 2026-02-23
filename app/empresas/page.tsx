'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ApiService } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Empresa } from '@/lib/types';
import { ChevronRight, Loader2, LogOut } from 'lucide-react';

export default function EmpresasPage() {
  const router = useRouter();
  const { token, setSelectedEmpresa, logout } = useAuth();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    const fetchEmpresas = async () => {
      try {
        const data = await ApiService.getEmpresas();
        setEmpresas(data);
      } catch {
        setError('Error al cargar las empresas');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmpresas();
  }, [token, router]);

  const handleSelectEmpresa = (empresa: Empresa) => {
    setSelectedEmpresa(empresa);
    router.push('/egresos');
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Cargando empresas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
              GS
            </div>
            <span className="text-sm font-semibold text-foreground">Grupo Sultana Connect</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5 text-muted-foreground">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Selecciona una empresa</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Elige la empresa con la que deseas trabajar
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
            <p className="text-sm font-medium text-destructive">{error}</p>
          </div>
        )}

        <div className="space-y-2">
          {empresas.map((empresa) => (
            <button
              key={empresa.guidDsl}
              type="button"
              className="group flex w-full items-center gap-4 rounded-lg border bg-card px-4 py-4 text-left transition-all hover:border-primary/40 hover:shadow-sm"
              onClick={() => handleSelectEmpresa(empresa)}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold text-muted-foreground">
                {empresa.nombre.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {empresa.nombre}
                </p>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  <span className="font-mono">{empresa.rfc}</span>
                  <span>{'|'}</span>
                  <span className="truncate">{empresa.baseDatos}</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </button>
          ))}
        </div>

        {empresas.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-muted-foreground">No hay empresas disponibles</p>
          </div>
        )}
      </main>
    </div>
  );
}
