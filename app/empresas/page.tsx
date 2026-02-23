'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiService } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Empresa } from '@/lib/types';
import { Building2, ChevronRight, Loader2, LogOut } from 'lucide-react';

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
      } catch (err) {
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Cargando empresas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-balance mb-2">Seleccione una Empresa</h1>
            <p className="text-muted-foreground text-lg">
              Elija la empresa con la que desea trabajar
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-destructive font-medium">{error}</p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {empresas.map((empresa) => (
            <Card
              key={empresa.guidDsl}
              className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 group"
              onClick={() => handleSelectEmpresa(empresa)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-balance leading-tight">
                        {empresa.nombre}
                      </CardTitle>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">RFC:</span>
                  <span className="font-medium font-mono">{empresa.rfc}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base de Datos:</span>
                  <span className="font-medium text-xs truncate max-w-[200px]">
                    {empresa.baseDatos}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {empresas.length === 0 && !error && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Building2 className="w-16 h-16 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground text-lg">No hay empresas disponibles</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
