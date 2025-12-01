import React, { useMemo, useState, useEffect } from 'react';
import { itemsApi, categoriesApi } from '../services/api';
import { Archive, ArrowUpDown, X, Building2 } from 'lucide-react';
import { useWarehouse } from '../contexts/WarehouseContext';
import type { InventoryItemWithCategory, Category } from '../types';

export const InventoryTable: React.FC = () => {
  const { activeWarehouseId, activeWarehouseName } = useWarehouse();
  
  // State for specific filters
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>('');
  const [specFilters, setSpecFilters] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState(''); // 搜索框筛选
  const [inventory, setInventory] = useState<InventoryItemWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch Categories
  useEffect(() => {
    categoriesApi.getAll().then(setCategories).catch(console.error);
  }, []);

  // Fetch Inventory Data with Category Names - FILTER BY WAREHOUSE
  useEffect(() => {
    setLoading(true);
    itemsApi.getWithCategory(activeWarehouseId)
      .then(data => {
        setInventory(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Failed to fetch inventory:', error);
        setLoading(false);
      });
  }, [activeWarehouseId]);

  // Derived State: Current Selected Category Object
  const currentCategory = useMemo(() => 
    categories.find(c => c.name === selectedCategoryName), 
  [categories, selectedCategoryName]);

  // Derived State: Available Attributes for the selected category
  const categoryAttributes = useMemo(() => {
    if (!currentCategory) return [];
    return currentCategory.attributes;
  }, [currentCategory]);

  // Helper: Get unique values for an attribute
  const getFilterOptions = (attrName: string, predefinedOptions: string[]) => {
    if (!inventory) return predefinedOptions;
    
    // Get values actually used in the DB for this category
    const usedValues = new Set<string>();
    inventory.forEach(item => {
      if (item.category_name === selectedCategoryName && item.specs[attrName]) {
        usedValues.add(item.specs[attrName]);
      }
    });

    // Merge with predefined
    const combined = new Set([...predefinedOptions, ...Array.from(usedValues)]);
    return Array.from(combined).sort((a, b) => {
      // Try numeric sort first
      const numA = parseFloat(a);
      const numB = parseFloat(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b, 'zh-CN');
    });
  };

  // Helper to extract numeric length from specs for sorting
  const getNumericLength = (specs: Record<string, string>) => {
    const entry = Object.entries(specs).find(([key]) => /length|长度/i.test(key));
    if (!entry) return 999999; 
    const match = entry[1].match(/(\d+(\.\d+)?)/);
    return match ? parseFloat(match[0]) : 999999;
  };

  // Filtering and Sorting Logic
  const processedData = useMemo(() => {
    if (!inventory) return [];

    // 1. Filter
    let data = inventory.filter(item => {
      // 搜索框筛选（品类名称或规格值）
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const specString = Object.values(item.specs).join(' ');
        const matchesSearch = item.category_name.toLowerCase().includes(q) || specString.toLowerCase().includes(q);
        if (!matchesSearch) {
          return false;
        }
      }

      // Category Filter
      if (selectedCategoryName && item.category_name !== selectedCategoryName) {
        return false;
      }

      // Spec Filters (AND logic)
      for (const [key, value] of Object.entries(specFilters)) {
        if (!value) continue; // Skip empty filters
        if (item.specs[key] !== value) {
          return false;
        }
      }

      return true;
    });

    // 2. Sort: Category Name ASC -> Length ASC
    data.sort((a, b) => {
      const catDiff = a.category_name.localeCompare(b.category_name, 'zh-CN');
      if (catDiff !== 0) return catDiff;

      const lenA = getNumericLength(a.specs);
      const lenB = getNumericLength(b.specs);
      return lenA - lenB;
    });

    return data;
  }, [inventory, searchQuery, selectedCategoryName, specFilters]);

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategoryName(e.target.value);
    setSpecFilters({}); // Reset spec filters when category changes
  };

  const handleSpecFilterChange = (attrName: string, value: string) => {
    setSpecFilters(prev => ({
      ...prev,
      [attrName]: value
    }));
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCategoryName('');
    setSpecFilters({});
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">库存查询</h2>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-bold rounded-lg shadow-md shadow-blue-200 border border-blue-800">
              <Building2 size={16} />
              <span>{activeWarehouseName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* 筛选方式一：快速搜索 */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">快速搜索</label>
              <input 
                type="text"
                placeholder="例如：光纤、10m、蓝色"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none bg-white"
              />
            </div>

            {/* 筛选方式二：精确筛选 */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">精确筛选</label>
              <div className="flex items-center gap-2">
                <select 
                  value={selectedCategoryName}
                  onChange={handleCategoryChange}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none text-sm bg-white font-medium"
                >
                  <option value="">-- 显示所有品类 --</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
                
                {(searchQuery || selectedCategoryName || Object.keys(specFilters).length > 0) && (
                  <button 
                    onClick={clearAllFilters}
                    className="px-2.5 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors flex items-center gap-1"
                    title="清除所有筛选"
                  >
                    <X size={14} />
                    <span>清除</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Filters (Dynamic Attributes) */}
        {selectedCategoryName && categoryAttributes.length > 0 && (
          <div className="px-3 pb-3 bg-white border-t border-gray-100 animate-in slide-in-from-top-2 fade-in duration-200">
            <div className="mb-2 pt-2">
              <span className="text-xs font-semibold text-slate-600">规格属性筛选</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {categoryAttributes.map((attr) => {
                const attrName = attr.name;
                const definedOptions = attr.options;
                const options = getFilterOptions(attrName, definedOptions);

                return (
                  <div key={attrName} className="space-y-1">
                    <label className="text-xs text-slate-500 font-medium truncate block" title={attrName}>
                      {attrName}
                    </label>
                    <select
                      value={specFilters[attrName] || ''}
                      onChange={(e) => handleSpecFilterChange(attrName, e.target.value)}
                      className={`
                        w-full px-2 py-1.5 border rounded text-sm outline-none focus:ring-1 focus:ring-blue-500
                        ${specFilters[attrName] ? 'border-blue-500 bg-blue-50/50 text-blue-700 font-medium' : 'border-gray-200 bg-white text-slate-700'}
                      `}
                    >
                      <option value="">全部</option>
                      {options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap w-24 text-center border-r border-gray-100">序号</th>
                <th className="px-4 py-3 whitespace-nowrap w-48 text-center border-r border-gray-100">
                  <div className="flex items-center justify-center gap-1">
                    品类 <ArrowUpDown size={14} className="text-gray-400" />
                  </div>
                </th>
                <th className="px-4 py-3 whitespace-nowrap min-w-[300px] text-center border-r border-gray-100">规格详情</th>
                <th className="px-4 py-3 whitespace-nowrap w-32 text-center border-r border-gray-100">当前库存</th>
                <th className="px-4 py-3 whitespace-nowrap w-40 text-center">最后更新</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {processedData.map((item, index) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-500 font-mono text-center border-r border-gray-100">{index + 1}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800 text-center border-r border-gray-100">{item.category_name}</td>
                  <td className="px-4 py-3 border-r border-gray-100">
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(item.specs).map(([key, val]) => (
                        <span key={key} className={`
                          inline-flex items-center px-2 py-1 rounded text-xs border
                          ${specFilters[key] === val 
                            ? 'bg-blue-100 text-blue-700 border-blue-200 ring-1 ring-blue-200' 
                            : 'bg-slate-100 text-slate-600 border-slate-200'}
                        `}>
                          <span className="font-medium mr-1 opacity-70">{key}:</span> {val}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center border-r border-gray-100">
                    <span className={`
                      inline-block px-3 py-1 rounded-full font-bold text-xs
                      ${item.quantity > 10 ? 'bg-green-100 text-green-700' : 
                        item.quantity > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}
                    `}>
                      {item.quantity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-500">
                    {new Date(item.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {processedData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                    <Archive className="mx-auto mb-2 opacity-20" size={40} />
                    <p>当前仓库 ({activeWarehouseName}) 没有找到相关库存</p>
                    {(searchQuery || selectedCategoryName || Object.keys(specFilters).length > 0) && (
                      <p className="text-xs mt-1 text-blue-500 cursor-pointer" onClick={clearAllFilters}>
                        清除筛选条件重试
                      </p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

