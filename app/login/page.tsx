'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ApiService } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Building2, Loader2 } from 'lucide-react';

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
        setError(response.message || 'Error al iniciar sesión');
      }
    } catch (err) {
      setError('Error de conexión. Por favor intente nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md shadow-xl border-2">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
            <Building2 className="w-10 h-10 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl font-bold text-balance">
            Grupo Sultana Connect
          </CardTitle>
          <CardDescription className="text-base">
            Ingrese sus credenciales para acceder al sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="usuario" className="text-sm font-medium">
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
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contrasena" className="text-sm font-medium">
                Contraseña
              </Label>
              <Input
                id="contrasena"
                type="password"
                placeholder="••••••••"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                required
                disabled={isLoading}
                className="h-11"
              />
            </div>
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive font-medium">{error}</p>
              </div>
            )}
            <Button 
              type="submit" 
              className="w-full h-11 text-base font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
