'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiService } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';

const ROLES = ['admin', 'user', 'editor', 'viewer'];

export default function CrearUsuarioPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [rol, setRol] = useState('user');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!token) {
    router.push('/login');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!usuario.trim()) {
      setError('El nombre de usuario es requerido');
      return;
    }

    if (!contrasena.trim()) {
      setError('La contraseña es requerida');
      return;
    }

    if (contrasena.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (!rol) {
      setError('El rol es requerido');
      return;
    }

    setIsLoading(true);

    try {
      const response = await ApiService.register({
        usuario: usuario.trim(),
        contrasena,
        rol,
      });

      if (response.success) {
        setSuccess(`Usuario "${usuario}" creado exitosamente con rol "${rol}"`);
        setUsuario('');
        setContrasena('');
        setRol('user');
      } else {
        setError(response.message || 'Error al crear el usuario');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el usuario');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
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
            <span className="text-sm font-semibold text-foreground">Crear Usuario</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Crear nuevo usuario</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Registra un nuevo usuario en el sistema con el rol asignado
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-card border rounded-lg p-6">
          {/* Error Alert */}
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Error</p>
                <p className="text-sm text-destructive/80 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Success Alert */}
          {success && (
            <div className="rounded-lg border border-success/30 bg-success/5 px-4 py-3 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-success">Éxito</p>
                <p className="text-sm text-success/80 mt-0.5">{success}</p>
              </div>
            </div>
          )}

          {/* Usuario Field */}
          <div className="space-y-2">
            <label htmlFor="usuario" className="text-sm font-medium text-foreground">
              Nombre de usuario
            </label>
            <Input
              id="usuario"
              type="text"
              placeholder="ej: juan.Lopez"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              disabled={isLoading}
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">
              Debe ser único en el sistema
            </p>
          </div>

          {/* Contraseña Field */}
          <div className="space-y-2">
            <label htmlFor="contrasena" className="text-sm font-medium text-foreground">
              Contraseña
            </label>
            <div className="relative">
              <Input
                id="contrasena"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 6 caracteres"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                disabled={isLoading}
                className="h-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Mínimo 6 caracteres
            </p>
          </div>

          {/* Rol Field */}
          <div className="space-y-2">
            <label htmlFor="rol" className="text-sm font-medium text-foreground">
              Rol
            </label>
            <Select value={rol} onValueChange={setRol} disabled={isLoading}>
              <SelectTrigger id="rol" className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    <span className="capitalize">{role}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Define los permisos del usuario en el sistema
            </p>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading || !usuario || !contrasena}
            className="w-full h-10 gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creando usuario...
              </>
            ) : (
              'Crear usuario'
            )}
          </Button>
        </form>

        {/* Info Box */}
        <div className="mt-8 rounded-lg border border-blue-200/30 bg-blue-50/30 dark:bg-blue-950/20 px-4 py-3">
          <p className="text-sm text-foreground/80">
            <strong>Nota:</strong> Los usuarios creados podrán acceder al sistema con sus credenciales.
            Asegúrate de asignar el rol correcto según sus responsabilidades.
          </p>
        </div>
      </main>
    </div>
  );
}
