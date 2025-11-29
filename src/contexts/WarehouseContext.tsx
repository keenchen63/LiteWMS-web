import React, { createContext, useContext, useState, useEffect } from 'react';
import { warehousesApi } from '../services/api';
import { Warehouse } from '../types';

interface WarehouseContextType {
  activeWarehouseId: number;
  setActiveWarehouseId: (id: number) => void;
  warehouses: Warehouse[];
  activeWarehouseName: string;
  refreshWarehouses: () => Promise<void>;
}

const WarehouseContext = createContext<WarehouseContextType | undefined>(undefined);

export const WarehouseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeWarehouseId, setActiveWarehouseId] = useState<number>(1);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  
  const refreshWarehouses = async () => {
    try {
      const data = await warehousesApi.getAll();
      setWarehouses(data);
      if (data.length > 0 && !data.find(w => w.id === activeWarehouseId)) {
        setActiveWarehouseId(data[0].id || 1);
      }
    } catch (error) {
      console.error('Failed to fetch warehouses:', error);
    }
  };

  // Load warehouses on mount
  useEffect(() => {
    refreshWarehouses();
  }, []);

  // Load from local storage or default to first warehouse
  useEffect(() => {
    const savedId = localStorage.getItem('activeWarehouseId');
    if (savedId && warehouses.length > 0) {
      const id = Number(savedId);
      if (warehouses.find(w => w.id === id)) {
        setActiveWarehouseId(id);
      }
    }
  }, [warehouses]);

  // Save to local storage when changed
  useEffect(() => {
    if (activeWarehouseId) {
      localStorage.setItem('activeWarehouseId', activeWarehouseId.toString());
    }
  }, [activeWarehouseId]);

  const activeWarehouseName = warehouses.find(w => w.id === activeWarehouseId)?.name || 'Loading...';

  return (
    <WarehouseContext.Provider value={{ 
      activeWarehouseId, 
      setActiveWarehouseId, 
      warehouses, 
      activeWarehouseName,
      refreshWarehouses
    }}>
      {children}
    </WarehouseContext.Provider>
  );
};

export const useWarehouse = () => {
  const context = useContext(WarehouseContext);
  if (!context) {
    throw new Error('useWarehouse must be used within a WarehouseProvider');
  }
  return context;
};

