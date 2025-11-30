import axios from 'axios';
import type { 
  Category, 
  Warehouse, 
  InventoryItem, 
  InventoryItemWithCategory,
  Transaction 
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Categories API
export const categoriesApi = {
  getAll: async (): Promise<Category[]> => {
    const response = await api.get('/api/categories/');
    return response.data;
  },
  
  getById: async (id: number): Promise<Category> => {
    const response = await api.get(`/api/categories/${id}`);
    return response.data;
  },
  
  create: async (category: Omit<Category, 'id'>): Promise<Category> => {
    const response = await api.post('/api/categories/', category);
    return response.data;
  },
  
  update: async (id: number, category: Omit<Category, 'id'>): Promise<Category> => {
    const response = await api.put(`/api/categories/${id}`, category);
    return response.data;
  },
  
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/categories/${id}`);
  },
};

// Warehouses API
export const warehousesApi = {
  getAll: async (): Promise<Warehouse[]> => {
    const response = await api.get('/api/warehouses/');
    return response.data;
  },
  
  getById: async (id: number): Promise<Warehouse> => {
    const response = await api.get(`/api/warehouses/${id}`);
    return response.data;
  },
  
  create: async (warehouse: Omit<Warehouse, 'id'>): Promise<Warehouse> => {
    const response = await api.post('/api/warehouses/', warehouse);
    return response.data;
  },
  
  update: async (id: number, warehouse: Omit<Warehouse, 'id'>): Promise<Warehouse> => {
    const response = await api.put(`/api/warehouses/${id}`, warehouse);
    return response.data;
  },
  
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/warehouses/${id}`);
  },
};

// Items API
export const itemsApi = {
  getAll: async (warehouseId?: number, categoryId?: number): Promise<InventoryItem[]> => {
    const params = new URLSearchParams();
    if (warehouseId) params.append('warehouse_id', warehouseId.toString());
    if (categoryId) params.append('category_id', categoryId.toString());
    const response = await api.get(`/api/items/?${params.toString()}`);
    return response.data;
  },
  
  getWithCategory: async (warehouseId?: number, categoryId?: number): Promise<InventoryItemWithCategory[]> => {
    const params = new URLSearchParams();
    if (warehouseId) params.append('warehouse_id', warehouseId.toString());
    if (categoryId) params.append('category_id', categoryId.toString());
    const response = await api.get(`/api/items/with-category?${params.toString()}`);
    return response.data;
  },
  
  getById: async (id: number): Promise<InventoryItem> => {
    const response = await api.get(`/api/items/${id}`);
    return response.data;
  },
  
  create: async (item: Omit<InventoryItem, 'id' | 'updated_at'>): Promise<InventoryItem> => {
    const response = await api.post('/api/items/', item);
    return response.data;
  },
  
  update: async (id: number, item: Partial<InventoryItem>): Promise<InventoryItem> => {
    const response = await api.put(`/api/items/${id}`, item);
    return response.data;
  },
  
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/items/${id}`);
  },
};

// Transactions API
export const transactionsApi = {
  getAll: async (
    warehouseId?: number, 
    transactionType?: string, 
    filterDate?: string
  ): Promise<Transaction[]> => {
    const params = new URLSearchParams();
    if (warehouseId) params.append('warehouse_id', warehouseId.toString());
    if (transactionType) params.append('transaction_type', transactionType);
    if (filterDate) params.append('filter_date', filterDate);
    const response = await api.get(`/api/transactions/?${params.toString()}`);
    return response.data;
  },
  
  getById: async (id: number): Promise<Transaction> => {
    const response = await api.get(`/api/transactions/${id}`);
    return response.data;
  },
  
  create: async (transaction: Omit<Transaction, 'id'>): Promise<Transaction> => {
    const response = await api.post('/api/transactions/', transaction);
    return response.data;
  },
  
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/transactions/${id}`);
  },
};

// MFA API
export interface AdminStatus {
  password_set: boolean;
  mfa_set: boolean;
  mfa_count: number;
  mfa_enabled: boolean;
  mfa_settings: {
    inbound: boolean;
    outbound: boolean;
    transfer: boolean;
    adjust: boolean;
    category_create: boolean;
    category_update: boolean;
    category_delete: boolean;
    warehouse_create: boolean;
    warehouse_update: boolean;
    warehouse_delete: boolean;
  };
}

export interface MFASetupResponse {
  secret: string;
  qr_code_url: string;
  device_id: string;
  device_name: string;
}

export interface MFADeviceInfo {
  id: string;
  name: string;
  secret: string;
  created_at: string;
}

export interface MFADeviceListResponse {
  devices: MFADeviceInfo[];
}

export interface MFAVerifyRequest {
  totp_code: string;
}

export interface MFAVerifyResponse {
  verified: boolean;
}

export interface LoginRequest {
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export const mfaApi = {
  getStatus: async (): Promise<AdminStatus> => {
    const response = await api.get('/api/mfa/status');
    return response.data;
  },
  
  setPassword: async (password: string): Promise<void> => {
    await api.post('/api/mfa/set-password', { password });
  },
  
  changePassword: async (oldPassword: string, newPassword: string): Promise<void> => {
    const token = mfaApi.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    await api.post('/api/mfa/change-password', {
      old_password: oldPassword,
      new_password: newPassword
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  
  setupMFA: async (deviceName: string): Promise<MFASetupResponse> => {
    const token = mfaApi.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const response = await api.post(`/api/mfa/mfa/setup?device_name=${encodeURIComponent(deviceName)}`, {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  },
  
  verifyMFA: async (totpCode: string): Promise<MFAVerifyResponse> => {
    const response = await api.post('/api/mfa/mfa/verify', {
      totp_code: totpCode
    });
    return response.data;
  },
  
  login: async (password: string): Promise<LoginResponse> => {
    const response = await api.post('/api/mfa/login', {
      password: password
    });
    // Store token in localStorage
    if (response.data.access_token) {
      localStorage.setItem('mfa_admin_token', response.data.access_token);
    }
    return response.data;
  },
  
  getToken: (): string | null => {
    return localStorage.getItem('mfa_admin_token');
  },
  
  clearToken: (): void => {
    localStorage.removeItem('mfa_admin_token');
  },
  
  getDevices: async (): Promise<MFADeviceListResponse> => {
    const token = mfaApi.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const response = await api.get('/api/mfa/mfa/devices', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  },
  
  deleteDevice: async (deviceId: string): Promise<void> => {
    const token = mfaApi.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    await api.delete(`/api/mfa/mfa/devices/${deviceId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },

  toggleMFA: async (enabled: boolean): Promise<{ message: string; mfa_enabled: boolean }> => {
    const token = mfaApi.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const response = await api.post('/api/mfa/toggle', {
      enabled: enabled
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  },

  getSettings: async (): Promise<{ settings: AdminStatus['mfa_settings'] }> => {
    const token = mfaApi.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const response = await api.get('/api/mfa/settings', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  },

  updateSettings: async (settings: Partial<AdminStatus['mfa_settings']>): Promise<{ message: string; settings: AdminStatus['mfa_settings'] }> => {
    const token = mfaApi.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const response = await api.post('/api/mfa/settings', {
      settings: settings
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  },
};

export default api;

