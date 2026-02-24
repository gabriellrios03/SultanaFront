import type { LoginCredentials, LoginResponse, Empresa, Egreso } from './types';

const API_BASE_URL = 'https://notable-special-caiman.ngrok-free.app/api';

export class ApiService {
  private static getAuthHeader(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'accept': '*/*',
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  }

  static async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'accept': '*/*',
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      throw new Error('Error en el login');
    }

    const data: LoginResponse = await response.json();
    if (data.success && data.token) {
      localStorage.setItem('token', data.token);
    }
    return data;
  }

  static async getEmpresas(): Promise<Empresa[]> {
    const response = await fetch(`${API_BASE_URL}/Empresas`, {
      method: 'GET',
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error('Error al obtener empresas');
    }

    return response.json();
  }

  static async getEgresos(guid: string, rfc: string, from: string, to: string): Promise<Egreso[]> {
    const url = `${API_BASE_URL}/AddEgresos?Guid=${encodeURIComponent(guid)}&From=${encodeURIComponent(from)}&To=${encodeURIComponent(to)}&Rfc=${encodeURIComponent(rfc)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error('Error al obtener egresos');
    }

    return response.json();
  }

  static async getDetalleXml(guidDb: string, guidDocument: string): Promise<unknown> {
    const url = `${API_BASE_URL}/DetalleXml?guidDb=${encodeURIComponent(guidDb)}&guidDocument=${encodeURIComponent(guidDocument)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error('Error al obtener detalle XML');
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }

    return response.text();
  }

  static async getConceptosCompras(databaseName: string): Promise<unknown[]> {
    const url = `${API_BASE_URL}/Conceptos/compras?databaseName=${encodeURIComponent(databaseName)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error('Error al obtener conceptos de compras');
    }

    return response.json();
  }

  static async getProveedores(databaseName: string, rfc?: string): Promise<unknown[]> {
    const params = new URLSearchParams({
      databaseName,
    });

    if (rfc && rfc.trim() !== '') {
      params.set('rfc', rfc.trim());
    }

    const url = `${API_BASE_URL}/Proveedores?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error('Error al obtener proveedores');
    }

    return response.json();
  }

  static async getProductos(databaseName: string): Promise<unknown[]> {
    const url = `${API_BASE_URL}/Productos?databaseName=${encodeURIComponent(databaseName)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error('Error al obtener productos');
    }

    return response.json();
  }

  static async crearDocumento(payload: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/Documentos`, {
      method: 'POST',
      headers: this.getAuthHeader(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Error al enviar documento a CONTPAQi');
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }

    return response.text();
  }

  static logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('selectedEmpresa');
  }
}
