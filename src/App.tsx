import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { WarehouseProvider } from './contexts/WarehouseContext';

// 懒加载主要页面组件，实现代码分割
const InventoryTable = lazy(() => 
  import('./components/InventoryTable').then(module => ({ default: module.InventoryTable }))
);
const CategoryManager = lazy(() => 
  import('./components/CategoryManager').then(module => ({ default: module.CategoryManager }))
);
const OutboundPage = lazy(() => 
  import('./components/OutboundPage').then(module => ({ default: module.OutboundPage }))
);
const WarehouseManager = lazy(() => 
  import('./components/WarehouseManager').then(module => ({ default: module.WarehouseManager }))
);
const TransactionHistoryPage = lazy(() => 
  import('./components/TransactionHistoryPage').then(module => ({ default: module.TransactionHistoryPage }))
);
const MFAPage = lazy(() => 
  import('./components/MFAPage').then(module => ({ default: module.MFAPage }))
);

// 加载中的占位组件
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
      <p className="text-gray-600">加载中...</p>
    </div>
  </div>
);

function App() {
  return (
    <WarehouseProvider>
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/mfa" element={<MFAPage />} />
            <Route
              path="/*"
              element={
                <Layout>
                  <Suspense fallback={<LoadingFallback />}>
                    <Routes>
                      <Route path="/" element={<InventoryTable />} />
                      <Route path="/outbound" element={<OutboundPage />} />
                      <Route path="/categories" element={<CategoryManager />} />
                      <Route path="/warehouses" element={<WarehouseManager />} />
                      <Route path="/transactions" element={<TransactionHistoryPage />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
                </Layout>
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </WarehouseProvider>
  );
}

export default App;

