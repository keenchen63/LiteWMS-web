import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { InventoryTable } from './components/InventoryTable';
import { CategoryManager } from './components/CategoryManager';
import { OutboundPage } from './components/OutboundPage';
import { WarehouseManager } from './components/WarehouseManager';
import { MFAPage } from './components/MFAPage';
import { WarehouseProvider } from './contexts/WarehouseContext';

function App() {
  return (
    <WarehouseProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/mfa" element={<MFAPage />} />
          <Route
            path="/*"
            element={
              <Layout>
                <Routes>
                  <Route path="/" element={<InventoryTable />} />
                  <Route path="/outbound" element={<OutboundPage />} />
                  <Route path="/categories" element={<CategoryManager />} />
                  <Route path="/warehouses" element={<WarehouseManager />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            }
          />
        </Routes>
      </BrowserRouter>
    </WarehouseProvider>
  );
}

export default App;

