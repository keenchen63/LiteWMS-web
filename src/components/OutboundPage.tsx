import React, { useState, useEffect } from 'react';
import { itemsApi, transactionsApi } from '../services/api';
import { Search, ShoppingCart, User, Calendar, X, FileText, Building2 } from 'lucide-react';
import { useWarehouse } from '../contexts/WarehouseContext';
import { Dialog, DialogType } from './Dialog';
import type { InventoryItemWithCategory } from '../types';

export const OutboundPage: React.FC = () => {
  const { activeWarehouseName } = useWarehouse();

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">出库管理</h2>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-bold rounded-lg shadow-md shadow-blue-200 border border-blue-800">
              <Building2 size={16} />
              <span>{activeWarehouseName}</span>
            </div>
          </div>
        </div>
      </div>

      <OutboundForm />
    </div>
  );
};

interface SelectedOutboundItem {
  item: InventoryItemWithCategory;
  quantity: number;
}

const OutboundForm: React.FC = () => {
  const { activeWarehouseId, activeWarehouseName } = useWarehouse();
  const [step, setStep] = useState<1|2>(1);
  const [selectedItems, setSelectedItems] = useState<SelectedOutboundItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [inventory, setInventory] = useState<InventoryItemWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ show: boolean; type: DialogType; title: string; message: string; details?: string }>({
    show: false,
    type: 'info',
    title: '',
    message: ''
  });
  const [warehouseConfirmDialog, setWarehouseConfirmDialog] = useState(false);

  const [formData, setFormData] = useState({
    date: '',
    user: '',
    notes: ''
  });
  // 用于存储左侧列表中每个物品的临时数量
  const [itemQuantities, setItemQuantities] = useState<Record<number, number | undefined>>({});
  // 用于跟踪哪个物品被选中（显示输入框和按钮）
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  useEffect(() => {
    const fetchInventory = async () => {
      setLoading(true);
      try {
        const data = await itemsApi.getWithCategory(activeWarehouseId);
        setInventory(data.filter(i => i.quantity > 0));
      } catch (error) {
        console.error('Failed to fetch inventory:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchInventory();
  }, [activeWarehouseId]);

  const filteredInventory = inventory.filter(item => {
    const q = searchQuery.toLowerCase();
    const specString = Object.values(item.specs).join(' ');
    return item.category_name.toLowerCase().includes(q) || specString.toLowerCase().includes(q);
  });

  const handleItemQuantityChange = (itemId: number, value: string) => {
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;
    
    // 允许空字符串，用于删除输入框内容
    if (value === '') {
      setItemQuantities({
        ...itemQuantities,
        [itemId]: undefined
      });
      return;
    }
    
    const numValue = Number(value);
    // 如果输入无效（NaN），保持原值或设为空
    if (isNaN(numValue)) {
      return;
    }
    
    // 只验证范围，不强制设置
    const validQuantity = Math.max(1, Math.min(numValue, item.quantity));
    setItemQuantities({
      ...itemQuantities,
      [itemId]: validQuantity
    });
  };

  const handleAddItem = (item: InventoryItemWithCategory) => {
    const rawQuantity = itemQuantities[item.id!];
    const quantity = (rawQuantity === undefined || rawQuantity === null) ? 1 : rawQuantity;
    const validQuantity = Math.max(1, Math.min(quantity, item.quantity));
    
    // 检查是否已添加
    if (selectedItems.some(selected => selected.item.id === item.id)) {
      // 如果已添加，更新数量
      handleUpdateItemQuantity(item.id!, quantity);
    } else {
      // 添加到列表
      setSelectedItems([...selectedItems, {
        item,
        quantity: validQuantity
      }]);
    }
    
    // 清空该物品的数量输入和选中状态
    const newQuantities = { ...itemQuantities };
    delete newQuantities[item.id!];
    setItemQuantities(newQuantities);
    setSelectedItemId(null);
  };

  const handleItemClick = (item: InventoryItemWithCategory) => {
    // 如果已添加到右侧列表，不处理点击
    if (selectedItems.some(s => s.item.id === item.id)) {
      return;
    }
    // 切换选中状态
    if (selectedItemId === item.id) {
      setSelectedItemId(null);
    } else {
      setSelectedItemId(item.id!);
      // 不自动设置默认值，让用户自己输入
    }
  };

  const handleRemoveItem = (itemId: number) => {
    setSelectedItems(selectedItems.filter(selected => selected.item.id !== itemId));
  };

  const handleUpdateItemQuantity = (itemId: number, quantity: number) => {
    setSelectedItems(selectedItems.map(selected => 
      selected.item.id === itemId 
        ? { ...selected, quantity: Math.max(1, Math.min(quantity, selected.item.quantity)) }
        : selected
    ));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedItems.length === 0) {
      setDialog({
        show: true,
        type: 'warning',
        title: '未选择物品',
        message: '请至少选择一个物品进行出库'
      });
      return;
    }

    // 验证日期必填
    if (!formData.date || formData.date.trim() === '') {
      setDialog({
        show: true,
        type: 'warning',
        title: '日期必填',
        message: '请选择出库日期'
      });
      return;
    }

    // 验证备注必填
    if (!formData.notes || formData.notes.trim() === '') {
      setDialog({
        show: true,
        type: 'warning',
        title: '备注必填',
        message: '请填写出库备注信息',
        details: '备注用于记录项目名称、用途等重要信息'
      });
      return;
    }

    // 显示仓库确认对话框
    setWarehouseConfirmDialog(true);
  };

  const handleWarehouseConfirm = async () => {
    setWarehouseConfirmDialog(false);

    // 验证库存是否充足
    const insufficientItems = selectedItems.filter(selected => selected.quantity > selected.item.quantity);
    if (insufficientItems.length > 0) {
      const itemNames = insufficientItems.map(s => s.item.category_name).join('、');
      setDialog({
        show: true,
        type: 'warning',
        title: '库存不足',
        message: `以下物品库存不足: ${itemNames}`,
        details: '请调整出库数量'
      });
      return;
    }

    try {
      const outboundItems: Array<{
        category_name: string;
        specs: Record<string, string>;
        quantity: number;
        item_id: number;
      }> = [];
      const outboundDate = new Date(formData.date).toISOString();

      // 第一步：处理所有物品的库存更新
      for (const selected of selectedItems) {
        // Update Inventory
        await itemsApi.update(selected.item.id!, {
          quantity: selected.item.quantity - selected.quantity
        });

        // 收集物品信息用于合并记录
        outboundItems.push({
          category_name: selected.item.category_name,
          specs: selected.item.specs,
          quantity: selected.quantity,
          item_id: selected.item.id!
        });
      }

      // 第二步：创建合并的交易记录
      if (outboundItems.length > 0) {
        // 计算总数量
        const totalQuantity = outboundItems.reduce((sum, item) => sum + item.quantity, 0);
        
        // 构建包含所有物品信息的JSON字符串
        const itemsData = outboundItems.map(item => ({
          category_name: item.category_name,
          specs: item.specs,
          quantity: item.quantity
        }));
        const itemNameSnapshot = JSON.stringify({
          type: 'MULTI_ITEM_OUTBOUND',
          items: itemsData,
          total_quantity: totalQuantity
        });

        // 使用第一个物品的ID作为主item_id
        const primaryItemId = outboundItems[0].item_id;

        // 创建合并的交易记录
        await transactionsApi.create({
          warehouse_id: activeWarehouseId,
          item_id: primaryItemId,
          item_name_snapshot: itemNameSnapshot,
          quantity: -totalQuantity,
          date: outboundDate,
          user: formData.user,
          notes: formData.notes,
          type: 'OUT'
        });
      }

      // Reset
      setStep(1);
      setSelectedItems([]);
      setFormData({ 
        date: '',
        user: '',
        notes: ''
      });
      
      // Refresh inventory
      const data = await itemsApi.getWithCategory(activeWarehouseId);
      setInventory(data.filter(i => i.quantity > 0));
      
      setDialog({
        show: true,
        type: 'success',
        title: '出库成功',
        message: '已成功出库'
      });
    } catch (err) {
      console.error(err);
      setDialog({
        show: true,
        type: 'error',
        title: '操作失败',
        message: '出库操作失败，请稍后重试'
      });
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[400px] flex items-center justify-center">
        <div className="text-slate-500">加载中...</div>
      </div>
    );
  }

  return (
    <>
      <Dialog
        type={dialog.type}
        title={dialog.title}
        message={dialog.message}
        show={dialog.show}
        onConfirm={() => setDialog({ ...dialog, show: false })}
        onCancel={() => setDialog({ ...dialog, show: false })}
        details={dialog.details}
      />

      {/* Warehouse Confirm Dialog */}
      <Dialog
        type="confirm"
        title="确认仓库"
        message={`请确认当前操作仓库：${activeWarehouseName}`}
        show={warehouseConfirmDialog}
        onConfirm={handleWarehouseConfirm}
        onCancel={() => setWarehouseConfirmDialog(false)}
        confirmText="确认无误"
        cancelText="取消"
      />

      {step === 1 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">选择出库物品</label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text"
                  placeholder="多个关键词使用空格分隔"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="border border-gray-200 rounded-lg max-h-[400px] overflow-y-auto">
                {filteredInventory.map(item => {
                  const isSelected = selectedItems.some(s => s.item.id === item.id);
                  const isActive = selectedItemId === item.id;
                  const tempQuantity = itemQuantities[item.id!];
                  const displayValue = tempQuantity === undefined ? '' : tempQuantity;
                  return (
                    <div 
                      key={item.id}
                      className={`p-3 border-b border-gray-100 last:border-0 transition-colors cursor-pointer
                        ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : isActive ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}
                      `}
                      onClick={() => handleItemClick(item)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-700">{item.category_name}</span>
                            {isSelected && (
                              <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">已选择</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {Object.entries(item.specs).map(([k, v]) => `${k}: ${v}`).join(', ')}
                          </div>
                        </div>
                        <span className="text-xs font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-600 ml-2">库存: {item.quantity}</span>
                      </div>
                      {isActive && !isSelected && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200" onClick={e => e.stopPropagation()}>
                          <label className="text-xs text-slate-600 whitespace-nowrap">出库数量:</label>
                          <input
                            type="number"
                            min="1"
                            max={item.quantity}
                            value={displayValue}
                            onChange={e => handleItemQuantityChange(item.id!, e.target.value)}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="数量"
                            autoFocus
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddItem(item);
                            }}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
                          >
                            添加
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {filteredInventory.length === 0 && <div className="p-4 text-center text-gray-400 text-sm">无可用库存</div>}
              </div>
            </div>
          </div>

          <div>
            <div className="h-[28px]"></div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-slate-800">已选择物品 ({selectedItems.length})</h4>
                {selectedItems.length > 0 && (
                  <button
                    onClick={() => setSelectedItems([])}
                    className="text-xs text-red-600 hover:text-red-700 font-medium"
                  >
                    清空
                  </button>
                )}
              </div>
              
              {selectedItems.length === 0 ? (
                <div className="text-sm text-slate-500 text-center py-8">暂无选择物品</div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {selectedItems.map((selected) => (
                    <div key={selected.item.id} className="bg-white p-3 rounded-lg border border-gray-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-medium text-slate-800 text-sm">{selected.item.category_name}</div>
                          <div className="text-xs text-slate-500 mt-1">{Object.entries(selected.item.specs).map(([k, v]) => `${k}: ${v}`).join(', ')}</div>
                        </div>
                        <button
                          onClick={() => handleRemoveItem(selected.item.id!)}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <label className="text-xs text-slate-600">数量:</label>
                        <input
                          type="number"
                          min="1"
                          max={selected.item.quantity}
                          value={selected.quantity}
                          onChange={e => handleUpdateItemQuantity(selected.item.id!, Number(e.target.value))}
                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                        <span className="text-xs text-slate-500">/ {selected.item.quantity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 总数量合计 */}
              {selectedItems.length > 0 && (
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">总数量合计：</span>
                    <span className="text-lg font-bold text-blue-700">
                      {selectedItems.reduce((sum, item) => sum + item.quantity, 0)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                if (selectedItems.length === 0) {
                  setDialog({
                    show: true,
                    type: 'warning',
                    title: '未选择物品',
                    message: '请至少选择一个物品进行出库'
                  });
                  return;
                }
                setStep(2);
              }}
              disabled={selectedItems.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-lg shadow-lg shadow-blue-100 transition-all flex justify-center items-center gap-2"
            >
              下一步：填写出库信息
            </button>
          </div>
        </div>
      ) : (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-4xl mx-auto">
      <button 
        onClick={() => setStep(1)}
        className="text-sm text-slate-500 hover:text-slate-800 mb-4 flex items-center gap-1"
      >
        &larr; 返回重新选择
      </button>

      <div className="mb-6 pb-6 border-b border-gray-100">
        <h3 className="text-xl font-bold text-slate-900 mb-2">第二步：填写出库信息</h3>
        <p className="text-sm text-slate-500">已选择 {selectedItems.length} 个物品，请填写出库信息</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
               <Calendar size={16}/> 出库日期
             </label>
             <input 
               type="date" 
               required
               value={formData.date}
               onChange={e => setFormData({...formData, date: e.target.value})}
               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 outline-none"
             />
          </div>
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
               <User size={16}/> 领用人/出库人
             </label>
             <input 
               type="text" 
               required
               placeholder="姓名"
               value={formData.user}
               onChange={e => setFormData({...formData, user: e.target.value})}
               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 outline-none"
             />
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <ShoppingCart size={16}/> 物品清单
          </h4>
          {selectedItems.map((selected) => (
            <div key={selected.item.id} className="border border-gray-200 rounded-lg p-4 bg-slate-50">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg font-bold text-slate-800">{selected.item.category_name}</span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold">
                      可用库存: {selected.item.quantity}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {Object.entries(selected.item.specs).map(([k, v]) => (
                      <span key={k} className="bg-slate-200 text-slate-600 px-2 py-1 rounded">
                        {k}: {v}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(selected.item.id!)}
                  className="ml-4 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="移除"
                >
                  <X size={18} />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  出库数量 <span className="text-red-500">*</span>
                </label>
                <input 
                  type="number" 
                  min="1"
                  max={selected.item.quantity}
                  required
                  value={selected.quantity}
                  onChange={e => handleUpdateItemQuantity(selected.item.id!, Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 outline-none text-lg font-bold"
                />
              </div>
            </div>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
            <FileText size={16}/> 备注 <span className="text-red-500">*</span>
          </label>
          <textarea 
            rows={3}
            required
            placeholder="项目名称、用途等..."
            value={formData.notes}
            onChange={e => setFormData({...formData, notes: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 outline-none"
          />
        </div>

        <div className="flex gap-4 pt-4 border-t border-gray-200">
          <button 
            type="button"
            onClick={() => setStep(1)}
            className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
          >
            返回选择
          </button>
          <button 
            type="submit" 
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-lg shadow-lg shadow-blue-200 transition-all"
          >
            确认出库
          </button>
        </div>
      </form>
    </div>
      )}
    </>
  );
};


