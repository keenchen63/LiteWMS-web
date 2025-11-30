import React, { useState, useEffect } from 'react';
import { warehousesApi, itemsApi, transactionsApi } from '../services/api';
import { useWarehouse } from '../contexts/WarehouseContext';
import { 
  Building2, Plus, Edit2, Trash2, ArrowLeftRight, Check, X, Search, MapPin, Calendar, User, FileText
} from 'lucide-react';
import { Dialog, DialogType } from './Dialog';
import { MFADialog } from './MFADialog';
import { useMFA } from '../hooks/useMFA';
import type { Warehouse, InventoryItemWithCategory } from '../types';

interface SelectedTransferItem {
  item: InventoryItemWithCategory;
  quantity: number;
}

export const WarehouseManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'settings' | 'transfer'>('settings');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">仓库管理</h2>
          <p className="text-slate-500 text-sm mt-1">管理物理仓库位置及库存调拨</p>
        </div>
        <div className="bg-white p-1 rounded-lg border border-gray-200 shadow-sm flex">
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all 
              ${activeTab === 'settings' 
                ? 'bg-blue-50 text-blue-700 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Building2 size={16} />
            仓库设置
          </button>
          <button 
            onClick={() => setActiveTab('transfer')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all 
              ${activeTab === 'transfer' 
                ? 'bg-blue-50 text-blue-700 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'}`}
          >
            <ArrowLeftRight size={16} />
            库存调拨
          </button>
        </div>
      </div>

      {activeTab === 'settings' ? <WarehouseSettings /> : <TransferView />}
    </div>
  );
};

const WarehouseSettings: React.FC = () => {
  const { requireMFA, showMFADialog, handleMFAVerify, handleMFACancel } = useMFA();
  const { warehouses, refreshWarehouses } = useWarehouse();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [dialog, setDialog] = useState<{ show: boolean; type: DialogType; title: string; message: string; details?: string }>({
    show: false,
    type: 'info',
    title: '',
    message: ''
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; warehouse: Warehouse | null; inputName: string }>({ 
    show: false, 
    warehouse: null,
    inputName: ''
  });

  const handleAdd = async () => {
    if (!newName.trim()) return;
    
    // MFA 验证
    const mfaVerified = await requireMFA('warehouse_create');
    if (!mfaVerified) {
      return; // 用户取消了 MFA 验证
    }
    
    try {
        await warehousesApi.create({ name: newName });
        setNewName('');
        setIsAdding(false);
        await refreshWarehouses();
        
        setDialog({
          show: true,
          type: 'success',
          title: '添加成功',
          message: '仓库已创建'
        });
    } catch (error) {
        console.error(error);
        setDialog({
          show: true,
          type: 'error',
          title: '添加失败',
          message: '创建仓库失败，请稍后重试'
        });
    }
  };

  const startEdit = (id: number, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    
    // MFA 验证
    const mfaVerified = await requireMFA('warehouse_update');
    if (!mfaVerified) {
      return; // 用户取消了 MFA 验证
    }
    
    try {
        await warehousesApi.update(editingId, { name: editName });
        setEditingId(null);
        await refreshWarehouses();
        
        setDialog({
          show: true,
          type: 'success',
          title: '更新成功',
          message: '仓库名称已更新'
        });
    } catch (error) {
        console.error(error);
        setDialog({
          show: true,
          type: 'error',
          title: '更新失败',
          message: '更新仓库失败，请稍后重试'
        });
    }
  };

  const handleDeleteClick = (warehouse: Warehouse) => {
    setDeleteConfirm({ show: true, warehouse, inputName: '' });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.warehouse) return;
    
    // 验证输入的名称是否匹配
    if (deleteConfirm.inputName !== deleteConfirm.warehouse.name) {
      setDialog({
        show: true,
        type: 'warning',
        title: '名称不匹配',
        message: '请输入正确的仓库名称以确认删除'
      });
      return;
    }
    
    // 先关闭确认对话框
    setDeleteConfirm({ show: false, warehouse: null, inputName: '' });
    
    // 等待一小段时间确保对话框关闭动画完成
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // MFA 验证
    const mfaVerified = await requireMFA('warehouse_delete');
    if (!mfaVerified) {
      return; // 用户取消了 MFA 验证
    }
    
    try {
        await warehousesApi.delete(deleteConfirm.warehouse.id!);
        await refreshWarehouses();
        
        setDialog({
          show: true,
          type: 'success',
          title: '删除成功',
          message: '仓库已删除'
        });
    } catch (error: any) {
        if (error.response?.status === 400) {
            setDialog({
              show: true,
              type: 'error',
              title: '删除失败',
              message: error.response.data.detail || '该仓库下仍有库存记录，无法删除。'
            });
        } else {
            setDialog({
              show: true,
              type: 'error',
              title: '删除失败',
              message: '删除仓库失败，请稍后重试'
            });
        }
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Info Dialog */}
      <Dialog
        type={dialog.type}
        title={dialog.title}
        message={dialog.message}
        show={dialog.show}
        onConfirm={() => setDialog({ ...dialog, show: false })}
        onCancel={() => setDialog({ ...dialog, show: false })}
        details={dialog.details}
      />

      {/* MFA Dialog */}
      <MFADialog
        show={showMFADialog}
        onVerify={handleMFAVerify}
        onCancel={handleMFACancel}
        title="MFA 验证"
        message="请输入您的验证码以完成仓库操作"
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirm.show && deleteConfirm.warehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 max-w-md w-full mx-4 animate-in fade-in zoom-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <Trash2 className="text-red-600" size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">确认删除仓库</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-slate-600 mb-4">
                这是一个<strong className="text-red-600">不可恢复</strong>的致命操作。删除仓库将影响所有相关的库存数据。
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="mb-3">
                  <span className="text-sm font-medium text-slate-700">要删除的仓库：</span>
                  <span className="text-sm text-slate-900 ml-2 font-bold">{deleteConfirm.warehouse.name}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  请输入仓库名称 <span className="text-red-500">"{deleteConfirm.warehouse.name}"</span> 以确认删除：
                </label>
                <input
                  type="text"
                  value={deleteConfirm.inputName}
                  onChange={(e) => setDeleteConfirm({ ...deleteConfirm, inputName: e.target.value })}
                  placeholder="输入仓库名称"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                  autoFocus
                />
                {deleteConfirm.inputName && deleteConfirm.inputName !== deleteConfirm.warehouse.name && (
                  <p className="text-xs text-red-600 mt-1">名称不匹配，请重新输入</p>
                )}
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm({ show: false, warehouse: null, inputName: '' })}
                className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteConfirm.inputName !== deleteConfirm.warehouse.name}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} />
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-dashed border-blue-200 flex flex-col items-center justify-center min-h-[160px] transition-all hover:bg-blue-50/50">
         {isAdding ? (
             <div className="w-full space-y-3">
                 <h3 className="font-bold text-slate-700 text-center mb-2">新增仓库</h3>
                 <input 
                   autoFocus
                   type="text"
                   value={newName}
                   onChange={e => setNewName(e.target.value)}
                   placeholder="仓库名称..."
                   className="w-full px-3 py-2 border border-gray-300 rounded outline-none focus:border-blue-500 text-sm"
                 />
                 <div className="flex gap-2">
                     <button onClick={handleAdd} className="flex-1 bg-blue-600 text-white py-1.5 rounded text-sm font-medium hover:bg-blue-700">保存</button>
                     <button onClick={() => setIsAdding(false)} className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded text-sm font-medium hover:bg-gray-200">取消</button>
                 </div>
             </div>
         ) : (
             <button onClick={() => setIsAdding(true)} className="flex flex-col items-center gap-2 text-blue-500 hover:text-blue-700 group">
                 <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                     <Plus size={24} />
                 </div>
                 <span className="font-bold">新增仓库</span>
             </button>
         )}
      </div>

      {warehouses.map(wh => (
          <div key={wh.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 relative group">
              {editingId === wh.id ? (
                <div className="space-y-3">
                    <input 
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="w-full px-3 py-2 border border-blue-300 rounded outline-none focus:ring-1 focus:ring-blue-500 font-bold text-slate-800"
                    />
                     <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:text-gray-600"><X size={18} /></button>
                        <button onClick={saveEdit} className="p-1.5 text-green-600 hover:text-green-700"><Check size={18} /></button>
                    </div>
                </div>
              ) : (
                <>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-slate-100 rounded-lg text-slate-600">
                            <Building2 size={24} />
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEdit(wh.id!, wh.name)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                                <Edit2 size={16} />
                            </button>
                            <button onClick={() => handleDeleteClick(wh)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1">{wh.name}</h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                        <MapPin size={12} /> ID: #{wh.id}
                    </p>
                </>
              )}
          </div>
      ))}
    </div>
  );
};

const TransferView: React.FC = () => {
    const { requireMFA, showMFADialog, handleMFAVerify, handleMFACancel } = useMFA();
    const { activeWarehouseId, activeWarehouseName, warehouses } = useWarehouse();
    const [step, setStep] = useState<1|2>(1);
    const [targetWarehouseId, setTargetWarehouseId] = useState<string>('');
    const [selectedItems, setSelectedItems] = useState<SelectedTransferItem[]>([]);
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
      const selected = selectedItems.find(s => s.item.id === itemId);
      if (!selected) return;
      
      setSelectedItems(selectedItems.map(selected => 
        selected.item.id === itemId 
          ? { ...selected, quantity: Math.max(1, Math.min(quantity, selected.item.quantity)) }
          : selected
      ));
    };

    const handleNextStep = () => {
      if (selectedItems.length === 0) {
        setDialog({
          show: true,
          type: 'warning',
          title: '未选择物品',
          message: '请至少选择一个物品进行调拨'
        });
        return;
      }

      if (!targetWarehouseId) {
        setDialog({
          show: true,
          type: 'warning',
          title: '未选择目标仓库',
          message: '请选择目标仓库'
        });
        return;
      }

      if (Number(targetWarehouseId) === activeWarehouseId) {
        setDialog({
          show: true,
          type: 'warning',
          title: '操作无效',
          message: '不能调拨到同一个仓库'
        });
        return;
      }

      setStep(2);
    };

    const handleTransfer = async (e: React.FormEvent) => {
      e.preventDefault();

      if (selectedItems.length === 0) {
        setDialog({
          show: true,
          type: 'warning',
          title: '未选择物品',
          message: '请至少选择一个物品进行调拨'
        });
        return;
      }

      if (!formData.user || !formData.user.trim()) {
        setDialog({
          show: true,
          type: 'warning',
          title: '操作人必填',
          message: '请填写操作人姓名'
        });
        return;
      }

      if (!formData.notes || !formData.notes.trim()) {
        setDialog({
          show: true,
          type: 'warning',
          title: '备注必填',
          message: '请填写调拨备注信息'
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
          details: '请调整调拨数量'
        });
        return;
      }

      // MFA 验证
      const mfaVerified = await requireMFA('transfer');
      if (!mfaVerified) {
        return; // 用户取消了 MFA 验证
      }

      setLoading(true);
      try {
        const targetWhId = Number(targetWarehouseId);
        const targetWarehouseName = warehouses.find(w => w.id === targetWhId)?.name || '';

        // 批量处理所有调拨记录
        const promises = selectedItems.map(async (selected) => {
          // 1. Deduct from Source
          await itemsApi.update(selected.item.id!, {
            quantity: selected.item.quantity - selected.quantity
          });

          // 2. Check if item exists in target warehouse and add/update
          const targetItems = await itemsApi.getAll(targetWhId, selected.item.category_id);
          
          const existingTargetItem = targetItems.find(item => {
            const keysA = Object.keys(item.specs).sort();
            const keysB = Object.keys(selected.item.specs).sort();
            if (JSON.stringify(keysA) !== JSON.stringify(keysB)) return false;
            return keysA.every(key => item.specs[key] === selected.item.specs[key]);
          });

          if (existingTargetItem) {
            await itemsApi.update(existingTargetItem.id!, {
              quantity: existingTargetItem.quantity + selected.quantity
            });
          } else {
            await itemsApi.create({
              warehouse_id: targetWhId,
              category_id: selected.item.category_id,
              specs: selected.item.specs,
              quantity: selected.quantity
            });
          }

          // 3. Log Transaction
          await transactionsApi.create({
            item_id: selected.item.id!,
            warehouse_id: activeWarehouseId,
            related_warehouse_id: targetWhId,
            item_name_snapshot: `${selected.item.category_name} - ${JSON.stringify(selected.item.specs)}`,
            quantity: -selected.quantity,
            date: new Date(formData.date).toISOString(),
            user: formData.user,
            notes: formData.notes,
            type: 'TRANSFER'
          });
        });

        await Promise.all(promises);

        // Reset
        setStep(1);
        setSelectedItems([]);
        setTargetWarehouseId('');
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
          title: '调拨成功',
          message: `已成功调拨 ${selectedItems.length} 个物品到 ${targetWarehouseName}`
        });
      } catch (e) {
        console.error(e);
        setDialog({
          show: true,
          type: 'error',
          title: '调拨失败',
          message: '库存调拨失败，请稍后重试'
        });
      } finally {
        setLoading(false);
      }
    };
  
    if (loading && step === 1) {
        return (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="text-center text-slate-500 py-8">加载中...</div>
            </div>
        );
    }
  
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        {/* MFA Dialog */}
        <MFADialog
          show={showMFADialog}
          onVerify={handleMFAVerify}
          onCancel={handleMFACancel}
          title="MFA 验证"
          message="请输入您的验证码以完成库存调拨"
        />

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
          <>
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <ArrowLeftRight className="text-blue-500" /> 库存调拨单 - 第一步：选择物品
            </h3>
    
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">源仓库 (Source)</label>
                  <div className="font-bold text-lg text-slate-800 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    {activeWarehouseName}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">选择目标仓库</label>
                  <select
                    value={targetWarehouseId}
                    onChange={e => setTargetWarehouseId(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="">-- 选择目标仓库 --</option>
                    {warehouses.filter(w => w.id !== activeWarehouseId).map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
    
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">选择调拨物品</label>
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
                              <label className="text-xs text-slate-600 whitespace-nowrap">调拨数量:</label>
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
                  onClick={handleNextStep}
                  disabled={selectedItems.length === 0 || !targetWarehouseId}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-lg shadow-lg shadow-blue-100 transition-all flex justify-center items-center gap-2"
                >
                  下一步：填写调拨信息
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 max-w-4xl mx-auto">
            <button 
              onClick={() => setStep(1)}
              className="text-sm text-slate-500 hover:text-slate-800 mb-4 flex items-center gap-1"
            >
              &larr; 返回重新选择
            </button>

            <div className="mb-6 pb-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-slate-900 mb-2">第二步：填写调拨信息</h3>
              <p className="text-sm text-slate-500">已选择 {selectedItems.length} 个物品，请填写调拨信息</p>
            </div>

            <form onSubmit={handleTransfer} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <Calendar size={16}/> 调拨日期
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
                    <User size={16}/> 操作人 <span className="text-red-500">*</span>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <FileText size={16}/> 调拨备注 <span className="text-red-500">*</span>
                </label>
                <textarea 
                  required
                  placeholder="请输入调拨原因、用途等信息..."
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 outline-none resize-none"
                />
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <ArrowLeftRight size={16} /> 调拨清单
                </h4>
                <div className="bg-slate-50 rounded-lg border border-gray-200 p-4 max-h-64 overflow-y-auto">
                  {selectedItems.map((selected) => (
                    <div key={selected.item.id} className="bg-white rounded-lg p-3 mb-2 last:mb-0 border border-gray-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-slate-800">{selected.item.category_name}</span>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                              数量: {selected.quantity}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500">
                            {Object.values(selected.item.specs).join(' ')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-lg shadow-lg shadow-blue-100 transition-all flex justify-center items-center gap-2"
                >
                  {loading ? '调拨中...' : '确认调拨'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  };

