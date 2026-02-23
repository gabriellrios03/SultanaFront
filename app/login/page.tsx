'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiService } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { setToken } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await ApiService.login({ usuario, contrasena });

      if (response.success) {
        setToken(response.token);
        router.push('/empresas');
      } else {
        setError(response.message || 'Error al iniciar sesion');
      }
    } catch {
      setError('Error de conexion. Intente nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
            GS
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground text-balance">
            Grupo Sultana Connect
          </h1>
          <p className="text-sm text-muted-foreground">
            Ingresa tus credenciales para continuar
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="usuario" className="text-xs font-medium">
              Usuario
            </Label>
            <Input
              id="usuario"
              type="email"
              placeholder="usuario@ejemplo.com"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              required
              disabled={isLoading}
              className="h-10 bg-card"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contrasena" className="text-xs font-medium">
              Contrasena
            </Label>
            <Input
              id="contrasena"
              type="password"
              placeholder="••••••••"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              required
              disabled={isLoading}
              className="h-10 bg-card"
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
              <p className="text-xs text-destructive font-medium">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full h-10" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Iniciando sesion...
              </>
            ) : (
              'Iniciar Sesion'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
