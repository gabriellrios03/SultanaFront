'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/lib/auth-context';
import { ArrowLeft, Users, LogOut } from 'lucide-react';

export default function AdminPage() {
  const router = useRouter();
  const { token, logout } = useAuth();

  useEffect(() => {
    if (!token) {
      router.push('/login');
    }
  }, [token, router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!token) {
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
              onClick={() => router.push('/empresas')}
              className="gap-1.5 text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Atras</span>
            </Button>
            <Separator orientation="vertical" className="h-5" />
            <span className="text-sm font-semibold text-foreground">Panel de administración</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5 text-muted-foreground">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Administración</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Gestiona usuarios y configuraciones del sistema
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Crear Usuario Card */}
          <button
            onClick={() => router.push('/admin/usuarios')}
            className="group relative rounded-lg border bg-card p-6 hover:border-primary/50 hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-semibold text-foreground">Crear usuarios</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Registra nuevos usuarios en el sistema
                </p>
              </div>
            </div>
          </button>

          {/* More admin options can be added here */}
          <div className="rounded-lg border bg-card/50 p-6 opacity-50">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-muted p-3">
                <div className="h-6 w-6 bg-muted-foreground/30" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-semibold text-foreground">Próximamente</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Más opciones de administración
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
