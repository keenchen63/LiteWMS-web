import React, { useState, useEffect } from 'react';
import { transactionsApi } from '../services/api';
import { Calendar, Filter, Building2, Search, X } from 'lucide-react';
import { useWarehouse } from '../contexts/WarehouseContext';
import type { Transaction } from '../types';

type TransactionTypeFilter = 'ALL' | 'IN' | 'OUT' | 'ADJUST' | 'TRANSFER_IN' | 'TRANSFER_OUT';

export const TransactionHistoryPage: React.FC = () => {
  const [filterDate, setFilterDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const { activeWarehouseId, activeWarehouseName } = useWarehouse();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const data = await transactionsApi.getAll(activeWarehouseId);
        // Filter by type and date
        // 对于调拨记录，只显示 warehouse_id === activeWarehouseId 的记录
        // 这样确保每个仓库只看到自己作为主仓库的记录（调拨出或调拨入）
        let filtered = data.filter(t => {
          if (t.type === 'IN' && t.warehouse_id === activeWarehouseId) return true;
          if (t.type === 'OUT' && t.warehouse_id === activeWarehouseId) return true;
          if (t.type === 'ADJUST' && t.warehouse_id === activeWarehouseId) return true;
          if (t.type === 'TRANSFER' && t.warehouse_id === activeWarehouseId) return true; 
          // 不再包含 related_warehouse_id === activeWarehouseId 的调拨记录
          // 因为那些记录属于其他仓库，不应该在当前仓库显示
          return false;
        });
        
        // 应用类型筛选
        if (typeFilter !== 'ALL') {
          filtered = filtered.filter(t => {
            if (typeFilter === 'IN') return t.type === 'IN';
            if (typeFilter === 'OUT') return t.type === 'OUT';
            if (typeFilter === 'ADJUST') return t.type === 'ADJUST';
            if (typeFilter === 'TRANSFER_IN') return t.type === 'TRANSFER' && t.quantity > 0;
            if (typeFilter === 'TRANSFER_OUT') return t.type === 'TRANSFER' && t.quantity < 0;
            return false;
          });
        }
        
        if (filterDate) {
          const filterDt = new Date(filterDate);
          filtered = filtered.filter(t => {
            const tDate = new Date(t.date);
            return tDate.toDateString() === filterDt.toDateString();
          });
        }
        
        // 应用快速搜索
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          filtered = filtered.filter(t => {
            // 搜索操作人
            if (t.user.toLowerCase().includes(query)) return true;
            
            // 搜索备注
            if (t.notes.toLowerCase().includes(query)) return true;
            
            // 搜索物品详情（品类名称和规格）
            try {
              const parsed = JSON.parse(t.item_name_snapshot);
              if (parsed.items && Array.isArray(parsed.items)) {
                return parsed.items.some((item: any) => {
                  const categoryMatch = item.category_name?.toLowerCase().includes(query);
                  const specsMatch = Object.values(item.specs || {}).some((val: any) => 
                    String(val).toLowerCase().includes(query)
                  );
                  return categoryMatch || specsMatch;
                });
              }
            } catch (e) {
              // 旧格式：直接搜索字符串
              if (t.item_name_snapshot.toLowerCase().includes(query)) return true;
            }
            
            return false;
          });
        }
        
        // 按日期降序，同一天按ID升序（生产顺序）
        filtered.sort((a, b) => {
          const dateA = new Date(a.date).toDateString();
          const dateB = new Date(b.date).toDateString();
          if (dateA !== dateB) {
            return new Date(b.date).getTime() - new Date(a.date).getTime();
          }
          // 同一天按ID升序（生产顺序）
          return a.id! - b.id!;
        });
        setTransactions(filtered);
      } catch (error) {
        console.error('Failed to fetch transactions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, [filterDate, activeWarehouseId, typeFilter, searchQuery]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setTypeFilter('ALL');
    setFilterDate('');
  };

  const hasActiveFilters = searchQuery.trim() || typeFilter !== 'ALL' || filterDate;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">操作记录</h2>
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
            {/* 快速搜索 */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">快速搜索</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text"
                  placeholder="例如：光纤、10m、蓝色、张三、供应商"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none bg-white"
                />
              </div>
            </div>

            {/* 筛选器 */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">精确筛选</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2">
                  <Filter size={14} className="text-gray-400" />
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as TransactionTypeFilter)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none text-sm bg-white font-medium"
                  >
                    <option value="ALL">-- 全部类型 --</option>
                    <option value="IN">入库</option>
                    <option value="OUT">出库</option>
                    <option value="ADJUST">调整</option>
                    <option value="TRANSFER_IN">调拨入</option>
                    <option value="TRANSFER_OUT">调拨出</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-gray-400" />
                  <input 
                    type="date" 
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none bg-white"
                  />
                </div>
                {hasActiveFilters && (
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
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-center text-slate-500 py-12">
            加载中...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-medium">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap text-center border-r border-gray-100">日期</th>
                  <th className="px-4 py-3 whitespace-nowrap min-w-[80px] text-center border-r border-gray-100">类型</th>
                  <th className="px-4 py-3 min-w-[250px] md:min-w-[350px] text-center border-r border-gray-100">物品详情</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap border-r border-gray-100">数量变动</th>
                  <th className="px-4 py-3 whitespace-nowrap text-center border-r border-gray-100">操作人</th>
                  <th className="px-4 py-3 min-w-[100px] max-w-[150px] text-center">备注</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
              {transactions.map(t => {
                // 解析物品信息（支持新格式：JSON多物品，和旧格式：单物品字符串）
                let items: Array<{ category_name: string; specs: Record<string, string>; quantity_diff?: number; quantity?: number }> = [];
                let totalQuantity = t.quantity;
                
                try {
                  // 尝试解析为新格式（JSON多物品）
                  const parsed = JSON.parse(t.item_name_snapshot);
                  if (parsed.type === 'MULTI_ITEM_ADJUST' && Array.isArray(parsed.items)) {
                    items = parsed.items;
                    totalQuantity = parsed.total_quantity_diff || t.quantity;
                  } else if (parsed.type === 'MULTI_ITEM_TRANSFER' && Array.isArray(parsed.items)) {
                    items = parsed.items;
                    totalQuantity = parsed.total_quantity || t.quantity;
                  } else if (parsed.type === 'MULTI_ITEM_INBOUND' && Array.isArray(parsed.items)) {
                    items = parsed.items;
                    totalQuantity = parsed.total_quantity || t.quantity;
                  } else if (parsed.type === 'MULTI_ITEM_OUTBOUND' && Array.isArray(parsed.items)) {
                    items = parsed.items;
                    totalQuantity = parsed.total_quantity || t.quantity;
                  } else {
                    throw new Error('Not multi-item format');
                  }
                } catch (e) {
                  // 旧格式：单物品字符串 "品类名 - {...specs...}"
                  try {
                    const [cat, specsStr] = t.item_name_snapshot.split(' - ');
                    const specs = JSON.parse(specsStr);
                    items = [{
                      category_name: cat,
                      specs: specs,
                      quantity: t.quantity,
                      quantity_diff: t.quantity
                    }];
                    totalQuantity = t.quantity;
                  } catch (e2) {
                    // 如果解析失败，使用原始字符串
                    items = [{
                      category_name: t.item_name_snapshot,
                      specs: {},
                      quantity: t.quantity,
                      quantity_diff: t.quantity
                    }];
                    totalQuantity = t.quantity;
                  }
                }

                // 对于调拨记录，由于我们只显示 warehouse_id === activeWarehouseId 的记录
                // 所以：
                // - 如果 quantity < 0，这是调拨出（当前仓库调出到其他仓库）
                // - 如果 quantity > 0，这是调拨入（从其他仓库调入到当前仓库）
                const isTransferOut = t.type === 'TRANSFER' && t.quantity < 0;
                const isTransferIn = t.type === 'TRANSFER' && t.quantity > 0;
                
                let typeBadge = <span className="text-gray-500">Unknown</span>;
                let qtyDisplay = <span className="">{t.quantity}</span>;

                if (t.type === 'IN') {
                  typeBadge = <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold">入库</span>;
                  qtyDisplay = <span className="text-green-600 font-bold">+{totalQuantity}</span>;
                } else if (t.type === 'OUT') {
                  typeBadge = <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">出库</span>;
                  qtyDisplay = <span className="text-red-600 font-bold">-{totalQuantity}</span>;
                } else if (t.type === 'ADJUST') {
                  typeBadge = <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs font-bold">调整</span>;
                  qtyDisplay = <span className={totalQuantity > 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>{totalQuantity > 0 ? '+' : ''}{totalQuantity}</span>;
                } else if (isTransferOut) {
                  typeBadge = <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-bold">调拨出</span>;
                  qtyDisplay = <span className="text-red-600 font-bold">-{totalQuantity}</span>; 
                } else if (isTransferIn) {
                  typeBadge = <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">调拨入</span>;
                  qtyDisplay = <span className="text-green-600 font-bold">+{totalQuantity}</span>;
                }

                return (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-center border-r border-gray-100">
                      {new Date(t.date).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center border-r border-gray-100">
                      {typeBadge}
                    </td>
                    <td className="px-4 py-3 border-r border-gray-100">
                      <div className="space-y-2">
                        {items.map((item, itemIndex) => {
                          // 对于调拨出，数量应该显示为负数
                          let itemQty = item.quantity_diff !== undefined ? item.quantity_diff : (item.quantity || 0);
                          if (t.type === 'TRANSFER' && isTransferOut) {
                            // 调拨出时，确保数量为负数
                            itemQty = itemQty < 0 ? itemQty : -Math.abs(itemQty);
                          } else if (t.type === 'TRANSFER' && isTransferIn) {
                            // 调拨入时，确保数量为正数
                            itemQty = itemQty > 0 ? itemQty : Math.abs(itemQty);
                          }
                          
                          return (
                            <div key={itemIndex} className="border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                              <div className="font-medium text-slate-800 mb-1.5 text-left">{item.category_name}</div>
                              {Object.keys(item.specs).length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-1.5 justify-start">
                                  {Object.entries(item.specs).map(([key, val]) => (
                                    <span key={key} className="inline-flex items-center px-2 py-0.5 rounded text-xs border bg-slate-100 text-slate-600 border-slate-200">
                                      <span className="font-medium mr-1 opacity-70">{key}:</span> {val}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {(t.type === 'ADJUST' || t.type === 'TRANSFER' || t.type === 'IN' || t.type === 'OUT') && (
                                <div className="text-xs text-slate-600 mt-1 text-left">
                                  {t.type === 'ADJUST' ? '变动' : '数量'}: <span className={`font-bold ${itemQty > 0 ? 'text-green-600' : itemQty < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                                    {itemQty > 0 ? '+' : ''}{itemQty}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center border-r border-gray-100">
                      {qtyDisplay}
                    </td>
                    <td className="px-4 py-3 text-slate-700 text-center border-r border-gray-100">
                      {t.user}
                    </td>
                    <td className="px-4 py-3 text-slate-500 truncate text-center" title={t.notes}>
                      {t.notes}
                    </td>
                  </tr>
                );
              })}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="text-gray-400 text-sm">
                          {hasActiveFilters ? '没有找到匹配的记录' : '暂无操作记录'}
                        </div>
                        {hasActiveFilters && (
                          <button
                            onClick={clearAllFilters}
                            className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            清除筛选条件
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

