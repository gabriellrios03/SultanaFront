export interface LoginCredentials {
  usuario: string;
  contrasena: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
}

export interface RegisterCredentials {
  usuario: string;
  contrasena: string;
  rol: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
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
