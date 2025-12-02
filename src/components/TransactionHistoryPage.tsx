import React, { useState, useEffect, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { transactionsApi } from '../services/api';
import { Calendar, Filter, Building2, Search, X, RotateCcw, User, FileText } from 'lucide-react';
import { useWarehouse } from '../contexts/WarehouseContext';
import { useMFA } from '../hooks/useMFA';
import { MFADialog } from './MFADialog';
import { Dialog, DialogType } from './Dialog';
import type { Transaction } from '../types';

// 撤销确认对话框组件（独立组件，使用 memo 优化）
interface RevertConfirmDialogProps {
  show: boolean;
  user: string;
  notes: string;
  onUserChange: (user: string) => void;
  onNotesChange: (notes: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const RevertConfirmDialog = memo<RevertConfirmDialogProps>(({
  show,
  user,
  notes,
  onUserChange,
  onNotesChange,
  onConfirm,
  onCancel
}) => {
  // 当对话框显示时，防止背景滚动
  useEffect(() => {
    if (show) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [show]);

  if (!show) return null;

  const dialogContent = (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" 
      style={{ 
        margin: 0, 
        padding: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%'
      }}
    >
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 max-w-md w-full mx-4 animate-in fade-in zoom-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-orange-100 rounded-full">
            <RotateCcw className="text-orange-600" size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">确认撤销操作</h3>
        </div>
        
        <div className="mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <User size={16} /> 操作人 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="请输入操作人姓名"
              value={user}
              onChange={(e) => onUserChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 outline-none"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <FileText size={16} /> 备注 <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              placeholder="请输入撤销原因、说明等..."
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 outline-none"
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <RotateCcw size={16} />
            确认撤销
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
});

RevertConfirmDialog.displayName = 'RevertConfirmDialog';

type TransactionTypeFilter = 'ALL' | 'IN' | 'OUT' | 'ADJUST' | 'TRANSFER_IN' | 'TRANSFER_OUT';

export const TransactionHistoryPage: React.FC = () => {
  const [filterDate, setFilterDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const { activeWarehouseId, activeWarehouseName } = useWarehouse();
  const { requireMFA, showMFADialog, handleMFAVerify, handleMFACancel } = useMFA();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [revertingId, setRevertingId] = useState<number | null>(null);
  const [revertConfirm, setRevertConfirm] = useState<{ show: boolean; transactionId: number | null; user: string; notes: string }>({
    show: false,
    transactionId: null,
    user: '',
    notes: ''
  });
  const [dialog, setDialog] = useState<{ show: boolean; type: DialogType; title: string; message: string }>({
    show: false,
    type: 'info',
    title: '',
    message: ''
  });
  
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
        
        // 按日期降序，同一天按ID降序（晚生成的排在前面）
        filtered.sort((a, b) => {
          const dateA = new Date(a.date).toDateString();
          const dateB = new Date(b.date).toDateString();
          if (dateA !== dateB) {
            return new Date(b.date).getTime() - new Date(a.date).getTime();
          }
          // 同一天按ID降序（晚生成的排在前面）
          return b.id! - a.id!;
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

  const handleRevertClick = useCallback((transaction: Transaction) => {
    if (!transaction.id) return;
    
    // 检查是否为撤销记录（通过解析item_name_snapshot）
    try {
      const parsed = JSON.parse(transaction.item_name_snapshot);
      if (parsed.type && parsed.type.startsWith('MULTI_ITEM_REVERT_')) {
        setDialog({
          show: true,
          type: 'warning',
          title: '无法撤销',
          message: '该记录已经是撤销操作，无法再次撤销'
        });
        return;
      }
      if (parsed.reverted === true) {
        setDialog({
          show: true,
          type: 'warning',
          title: '无法撤销',
          message: '该记录已经被撤销，无法再次撤销'
        });
        return;
      }
    } catch (e) {
      // 解析失败，继续执行（可能是旧格式）
    }
    
    // 显示撤销确认对话框（只存储 ID，不存储整个对象）
    setRevertConfirm({
      show: true,
      transactionId: transaction.id!,
      user: '',
      notes: ''
    });
  }, []);

  const handleRevertCancel = useCallback(() => {
    setRevertConfirm({ show: false, transactionId: null, user: '', notes: '' });
  }, []);

  const handleUserChange = useCallback((user: string) => {
    setRevertConfirm(prev => ({ ...prev, user }));
  }, []);

  const handleNotesChange = useCallback((notes: string) => {
    setRevertConfirm(prev => ({ ...prev, notes }));
  }, []);

  const handleRevertConfirm = async () => {
    if (!revertConfirm.transactionId) return;
    
    // 从 transactions 中找到对应的记录
    const transaction = transactions.find(t => t.id === revertConfirm.transactionId);
    if (!transaction || !transaction.id) return;
    
    // 验证操作人和备注
    if (!revertConfirm.user || !revertConfirm.user.trim()) {
      setDialog({
        show: true,
        type: 'warning',
        title: '输入错误',
        message: '请输入操作人姓名'
      });
      return;
    }
    
    if (!revertConfirm.notes || !revertConfirm.notes.trim()) {
      setDialog({
        show: true,
        type: 'warning',
        title: '输入错误',
        message: '请输入撤销备注'
      });
      return;
    }
    
    setRevertingId(transaction.id);
    setRevertConfirm({ show: false, transactionId: null, user: '', notes: '' });
    
    try {
      // MFA 验证
      const mfaVerified = await requireMFA('transaction_revert');
      if (!mfaVerified) {
        setRevertingId(null);
        return;
      }

      // 执行撤销操作
      await transactionsApi.revert(
        transaction.id,
        revertConfirm.user.trim(),
        revertConfirm.notes.trim()
      );

      // 刷新列表（不需要重新获取，因为记录已更新，但为了确保数据同步，还是重新获取）
      const data = await transactionsApi.getAll(activeWarehouseId);
      let filtered = data.filter(t => {
        if (t.type === 'IN' && t.warehouse_id === activeWarehouseId) return true;
        if (t.type === 'OUT' && t.warehouse_id === activeWarehouseId) return true;
        if (t.type === 'ADJUST' && t.warehouse_id === activeWarehouseId) return true;
        if (t.type === 'TRANSFER' && t.warehouse_id === activeWarehouseId) return true;
        return false;
      });
      
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
      
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        filtered = filtered.filter(t => {
          if (t.user.toLowerCase().includes(query)) return true;
          if (t.notes.toLowerCase().includes(query)) return true;
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
            if (t.item_name_snapshot.toLowerCase().includes(query)) return true;
          }
          return false;
        });
      }
      
      filtered.sort((a, b) => {
        const dateA = new Date(a.date).toDateString();
        const dateB = new Date(b.date).toDateString();
        if (dateA !== dateB) {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
        return b.id! - a.id!;
      });
      
      setTransactions(filtered);
      
      setDialog({
        show: true,
        type: 'success',
        title: '撤销成功',
        message: '操作记录已成功撤销'
      });
    } catch (error: any) {
      setDialog({
        show: true,
        type: 'error',
        title: '撤销失败',
        message: error.response?.data?.detail || error.message || '撤销操作失败，请稍后重试'
      });
    } finally {
      setRevertingId(null);
    }
  };

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
                  placeholder="多个关键词使用空格分隔"
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
                  <th className="px-4 py-3 min-w-[220px] md:min-w-[320px] text-center border-r border-gray-100">物品详情</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap border-r border-gray-100">数量</th>
                  <th className="px-4 py-3 whitespace-nowrap text-center border-r border-gray-100">操作人</th>
                  <th className="px-4 py-3 min-w-[90px] max-w-[130px] text-center border-r border-gray-100">备注</th>
                  <th className="px-4 py-3 whitespace-nowrap text-center min-w-[90px]">撤销操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
              {transactions.map(t => {
                // 解析物品信息（支持新格式：JSON多物品，和旧格式：单物品字符串）
                let items: Array<{ category_name: string; specs: Record<string, string>; quantity_diff?: number; quantity?: number }> = [];
                let totalQuantity = t.quantity;
                let isReverted = false; // 标记是否为撤销记录
                
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
                  } else if (parsed.type && parsed.type.startsWith('MULTI_ITEM_REVERT_')) {
                    // 撤销记录格式：使用原始数据来显示，但数量要反转
                    isReverted = true;
                    // 优先使用 original_items（原始数据），如果没有则使用 items（撤销操作数据）
                    if (parsed.original_items && Array.isArray(parsed.original_items)) {
                      items = parsed.original_items;
                      // 撤销后：使用 t.quantity（后端已经更新为反向数量）
                      totalQuantity = t.quantity;
                    } else if (Array.isArray(parsed.items)) {
                      items = parsed.items;
                      // 撤销后：使用 t.quantity（后端已经更新为反向数量）
                      totalQuantity = t.quantity;
                    } else {
                      throw new Error('Invalid revert format');
                    }
                  } else if (parsed.reverted === true) {
                    // 新格式的撤销记录（使用 reverted 标志）
                    isReverted = true;
                    if (parsed.original_items && Array.isArray(parsed.original_items)) {
                      items = parsed.original_items;
                      // 撤销后：使用 t.quantity（后端已经更新为反向数量）
                      totalQuantity = t.quantity;
                    } else if (Array.isArray(parsed.items)) {
                      items = parsed.items;
                      // 撤销后：使用 t.quantity（后端已经更新为反向数量）
                      totalQuantity = t.quantity;
                    } else {
                      throw new Error('Invalid revert format');
                    }
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

                // 如果是撤销记录，在类型标签前添加"撤销"前缀
                const revertPrefix = isReverted ? '撤销' : '';
                
                if (t.type === 'IN') {
                  typeBadge = <span className={`px-2 py-0.5 rounded text-xs font-bold ${isReverted ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-700'}`}>
                    {revertPrefix}入库
                  </span>;
                  // 入库：正常显示正数，撤销后显示负数（反转）
                  qtyDisplay = <span className={isReverted ? "text-gray-600 font-bold" : "text-green-600 font-bold"}>
                    {totalQuantity > 0 ? '+' : ''}{totalQuantity}
                  </span>;
                } else if (t.type === 'OUT') {
                  typeBadge = <span className={`px-2 py-0.5 rounded text-xs font-bold ${isReverted ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'}`}>
                    {revertPrefix}出库
                  </span>;
                  // 出库：正常显示负数，撤销后显示正数（反转）
                  qtyDisplay = <span className={isReverted ? "text-gray-600 font-bold" : "text-red-600 font-bold"}>
                    {totalQuantity < 0 ? totalQuantity : '-' + Math.abs(totalQuantity)}
                  </span>;
                } else if (t.type === 'ADJUST') {
                  typeBadge = <span className={`px-2 py-0.5 rounded text-xs font-bold ${isReverted ? 'bg-gray-100 text-gray-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {revertPrefix}调整
                  </span>;
                  // 调整：撤销后数量反转（正变负，负变正）
                  qtyDisplay = <span className={isReverted ? "text-gray-600 font-bold" : (totalQuantity > 0 ? "text-green-600 font-bold" : "text-red-600 font-bold")}>
                    {totalQuantity > 0 ? '+' : ''}{totalQuantity}
                  </span>;
                } else if (isTransferOut) {
                  typeBadge = <span className={`px-2 py-0.5 rounded text-xs font-bold ${isReverted ? 'bg-gray-100 text-gray-700' : 'bg-orange-100 text-orange-700'}`}>
                    {revertPrefix}调拨出
                  </span>;
                  // 调拨出：正常显示负数，撤销后显示正数（反转）
                  qtyDisplay = <span className={isReverted ? "text-gray-600 font-bold" : "text-red-600 font-bold"}>
                    {totalQuantity < 0 ? totalQuantity : '-' + Math.abs(totalQuantity)}
                  </span>; 
                } else if (isTransferIn) {
                  typeBadge = <span className={`px-2 py-0.5 rounded text-xs font-bold ${isReverted ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>
                    {revertPrefix}调拨入
                  </span>;
                  // 调拨入：正常显示正数，撤销后显示负数（反转）
                  qtyDisplay = <span className={isReverted ? "text-gray-600 font-bold" : "text-green-600 font-bold"}>
                    {totalQuantity > 0 ? '+' : ''}{totalQuantity}
                  </span>;
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
                          // 对于撤销记录，优先使用quantity_diff（包含正确的符号）
                          // 对于普通记录，根据类型和quantity_diff/quantity来确定显示值
                          let itemQty: number;
                          if (isReverted) {
                            // 撤销记录：数量要反转（正变负，负变正）
                            // 使用原始数据中的quantity_diff或quantity，然后反转
                            const originalQty = item.quantity_diff !== undefined ? item.quantity_diff : (item.quantity || 0);
                            itemQty = -originalQty; // 反转符号
                          } else {
                            // 普通记录：根据类型处理
                            itemQty = item.quantity_diff !== undefined ? item.quantity_diff : (item.quantity || 0);
                            if (t.type === 'OUT') {
                              // 出库时，确保数量为负数
                              itemQty = itemQty < 0 ? itemQty : -Math.abs(itemQty);
                            } else if (t.type === 'TRANSFER' && isTransferOut) {
                              // 调拨出时，确保数量为负数
                              itemQty = itemQty < 0 ? itemQty : -Math.abs(itemQty);
                            } else if (t.type === 'TRANSFER' && isTransferIn) {
                              // 调拨入时，确保数量为正数
                              itemQty = itemQty > 0 ? itemQty : Math.abs(itemQty);
                            }
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
                                  {t.type === 'ADJUST' ? '变动' : '数量'}: <span className={`font-bold ${
                                    isReverted 
                                      ? 'text-gray-500' 
                                      : (() => {
                                          // 根据交易类型判断颜色
                                          if (t.type === 'OUT' || isTransferOut) {
                                            // 出库和调拨出：红色（负数）
                                            return 'text-red-600';
                                          } else if (t.type === 'IN' || isTransferIn) {
                                            // 入库和调拨入：绿色（正数）
                                            return 'text-green-600';
                                          } else if (t.type === 'ADJUST') {
                                            // 调整：根据数量正负判断
                                            return itemQty > 0 ? 'text-green-600' : itemQty < 0 ? 'text-red-600' : 'text-slate-600';
                                          }
                                          return 'text-slate-600';
                                        })()
                                  }`}>
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
                    <td className="px-4 py-3 text-slate-500 truncate text-center border-r border-gray-100" title={t.notes}>
                      {t.notes}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {isReverted ? (
                        <span className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg whitespace-nowrap">
                          已撤销
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRevertClick(t)}
                          disabled={revertingId === t.id}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 mx-auto whitespace-nowrap ${
                            revertingId === t.id
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                          }`}
                          title="撤销此操作"
                        >
                          <RotateCcw size={14} />
                          {revertingId === t.id ? '撤销中...' : '撤销'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
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

      {/* Revert Confirm Dialog */}
      <RevertConfirmDialog
        show={revertConfirm.show && revertConfirm.transactionId !== null}
        user={revertConfirm.user}
        notes={revertConfirm.notes}
        onUserChange={handleUserChange}
        onNotesChange={handleNotesChange}
        onConfirm={handleRevertConfirm}
        onCancel={handleRevertCancel}
      />

      {/* MFA Dialog */}
      <MFADialog
        show={showMFADialog}
        onVerify={handleMFAVerify}
        onCancel={handleMFACancel}
        title="MFA 验证"
        message="请输入您的验证码以完成撤销操作"
      />

      {/* Info Dialog */}
      <Dialog
        type={dialog.type}
        title={dialog.title}
        message={dialog.message}
        show={dialog.show}
        onConfirm={() => setDialog({ ...dialog, show: false })}
        onCancel={() => setDialog({ ...dialog, show: false })}
      />
    </div>
  );
};

