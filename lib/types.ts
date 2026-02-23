export interface LoginCredentials {
  usuario: string;
  contrasena: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
}

export interface Empresa {
  nombre: string;
  baseDatos: string;
  rfc: string;
  guidDsl: string;
}

export interface Egreso {
  [key: string]: any;
}
