import React, { useState, useEffect } from 'react';
import { itemsApi, transactionsApi } from '../services/api';
import { Search, ShoppingCart, User, Calendar, ClipboardList, X, FileText } from 'lucide-react';
import { useWarehouse } from '../contexts/WarehouseContext';
import { Dialog, DialogType } from './Dialog';
import type { InventoryItemWithCategory, Transaction } from '../types';

export const OutboundPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'entry' | 'history'>('entry');
  const { activeWarehouseName } = useWarehouse();

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">出库管理</h2>
          <div className="flex items-center gap-2 mt-1">
             <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold rounded border border-blue-200">
                {activeWarehouseName}
            </span>
            <p className="text-slate-500 text-sm">处理线材领用与历史记录查询</p>
          </div>
        </div>
        <div className="bg-white p-1 rounded-lg border border-gray-200 shadow-sm flex">
          <button 
            onClick={() => setActiveTab('entry')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'entry' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            出库录入
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'history' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            出库查询
          </button>
        </div>
      </div>

      {activeTab === 'entry' ? <OutboundForm /> : <OutboundHistory />}
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

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    user: '',
    notes: ''
  });
  // 用于存储左侧列表中每个物品的临时数量
  const [itemQuantities, setItemQuantities] = useState<Record<number, number>>({});
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

  const handleItemQuantityChange = (itemId: number, quantity: number) => {
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;
    
    const validQuantity = Math.max(1, Math.min(quantity, item.quantity));
    setItemQuantities({
      ...itemQuantities,
      [itemId]: validQuantity
    });
  };

  const handleAddItem = (item: InventoryItemWithCategory) => {
    const quantity = itemQuantities[item.id!] || 1;
    
    // 检查是否已添加
    if (selectedItems.some(selected => selected.item.id === item.id)) {
      // 如果已添加，更新数量
      handleUpdateItemQuantity(item.id!, quantity);
    } else {
      // 添加到列表
      setSelectedItems([...selectedItems, {
        item,
        quantity: Math.max(1, Math.min(quantity, item.quantity))
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
      // 如果该物品还没有数量，设置默认值为1
      if (!itemQuantities[item.id!]) {
        setItemQuantities({
          ...itemQuantities,
          [item.id!]: 1
        });
      }
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
      // 批量处理所有出库记录
      const promises = selectedItems.map(async (selected) => {
        // 1. Update Inventory
        await itemsApi.update(selected.item.id!, {
          quantity: selected.item.quantity - selected.quantity
        });

        // 2. Add Transaction Record
        await transactionsApi.create({
          warehouse_id: activeWarehouseId,
          item_id: selected.item.id!,
          item_name_snapshot: `${selected.item.category_name} - ${JSON.stringify(selected.item.specs)}`,
          quantity: -selected.quantity,
          date: new Date(formData.date).toISOString(),
          user: formData.user,
          notes: formData.notes,
          type: 'OUT'
        });
      });

      await Promise.all(promises);

      // Reset
      setStep(1);
      setSelectedItems([]);
      setFormData({ 
        date: new Date().toISOString().split('T')[0],
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
        message: `已成功出库 ${selectedItems.length} 个物品`
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

      {step === 1 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">当前仓库</label>
              <div className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                {activeWarehouseName}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">选择出库物品</label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text"
                  placeholder="快速搜索"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="border border-gray-200 rounded-lg max-h-[400px] overflow-y-auto">
                {filteredInventory.map(item => {
                  const isSelected = selectedItems.some(s => s.item.id === item.id);
                  const isActive = selectedItemId === item.id;
                  const tempQuantity = itemQuantities[item.id!] || 1;
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
                            {Object.values(item.specs).join(' ')}
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
                            value={tempQuantity}
                            onChange={e => handleItemQuantityChange(item.id!, Number(e.target.value))}
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

          <div className="space-y-4">
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
                          <div className="text-xs text-slate-500 mt-1">{Object.values(selected.item.specs).join(' ')}</div>
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
            确认出库 ({selectedItems.length} 个物品)
          </button>
        </div>
      </form>
    </div>
      )}
    </>
  );
};

const OutboundHistory: React.FC = () => {
  const [filterDate, setFilterDate] = useState('');
  const { activeWarehouseId } = useWarehouse();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const data = await transactionsApi.getAll(
          activeWarehouseId,
          'OUT',
          filterDate || undefined
        );
        setTransactions(data);
      } catch (error) {
        console.error('Failed to fetch transactions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, [filterDate, activeWarehouseId]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="text-center text-slate-500 py-8">加载中...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
          <ClipboardList size={20} className="text-blue-500" /> 出库记录
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">按日期筛选:</span>
          <input 
            type="date" 
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
          />
          {filterDate && (
             <button onClick={() => setFilterDate('')} className="text-xs text-blue-600 hover:underline">清除</button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 font-medium">
            <tr>
              <th className="px-4 py-3">日期</th>
              <th className="px-4 py-3">物品详情</th>
              <th className="px-4 py-3 text-center">数量</th>
              <th className="px-4 py-3">领用人</th>
              <th className="px-4 py-3">备注</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transactions.map(t => {
                let details = t.item_name_snapshot;
                try {
                    const [cat, specs] = details.split(' - ');
                    const specObj = JSON.parse(specs);
                    details = `${cat} (${Object.values(specObj).join(', ')})`;
                } catch(e) {}

                return (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {new Date(t.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {details}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-red-600">
                    {t.quantity}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {t.user}
                  </td>
                  <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                    {t.notes}
                  </td>
                </tr>
            )})}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-400">
                  无相关记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

