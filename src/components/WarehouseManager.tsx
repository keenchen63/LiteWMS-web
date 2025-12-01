import React, { useState, useEffect } from 'react';
import { warehousesApi, itemsApi, transactionsApi } from '../services/api';
import { useWarehouse } from '../contexts/WarehouseContext';
import { 
  Building2, Plus, Edit2, Trash2, ArrowLeftRight, Check, X, Search, MapPin, Calendar, User, FileText, ClipboardList
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
    const [transferTab, setTransferTab] = useState<'entry' | 'history'>('entry');
    
    return (
      <div className="space-y-6">
        <div className="bg-white p-1 rounded-lg border border-gray-200 shadow-sm flex w-fit">
          <button 
            onClick={() => setTransferTab('entry')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2
              ${transferTab === 'entry' 
                ? 'bg-blue-50 text-blue-700 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'}`}
          >
            <ArrowLeftRight size={16} />
            调拨录入
          </button>
          <button 
            onClick={() => setTransferTab('history')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2
              ${transferTab === 'history' 
                ? 'bg-blue-50 text-blue-700 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'}`}
          >
            <ClipboardList size={16} />
            调拨记录
          </button>
        </div>

        {transferTab === 'entry' ? <TransferForm /> : <TransferHistory />}
      </div>
    );
};

const TransferForm: React.FC = () => {
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
    const [warehouseConfirmDialog, setWarehouseConfirmDialog] = useState(false);
    const [formData, setFormData] = useState({
      date: new Date().toISOString().split('T')[0],
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
        handleUpdateItemQuantity(item.id!, validQuantity);
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

      // 显示仓库确认对话框
      setWarehouseConfirmDialog(true);
    };

    const handleWarehouseConfirm = async () => {
      setWarehouseConfirmDialog(false);

      // MFA 验证
      const mfaVerified = await requireMFA('transfer');
      if (!mfaVerified) {
        return; // 用户取消了 MFA 验证
      }

      setLoading(true);
      try {
        const targetWhId = Number(targetWarehouseId);
        const targetWarehouseName = warehouses.find(w => w.id === targetWhId)?.name || '';
        const transferDate = new Date(formData.date).toISOString();

        // 第一步：处理所有物品的库存更新（源仓库扣减，目标仓库增加）
        const transferItems: Array<{
          category_name: string;
          specs: Record<string, string>;
          quantity: number;
          source_item_id: number;
          target_item_id: number;
        }> = [];

        for (const selected of selectedItems) {
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

          let targetItemId: number;
          if (existingTargetItem) {
            await itemsApi.update(existingTargetItem.id!, {
              quantity: existingTargetItem.quantity + selected.quantity
            });
            targetItemId = existingTargetItem.id!;
          } else {
            // Create new item in target warehouse and get the returned ID
            const newTargetItem = await itemsApi.create({
              warehouse_id: targetWhId,
              category_id: selected.item.category_id,
              specs: selected.item.specs,
              quantity: selected.quantity
            });
            if (!newTargetItem.id) {
              throw new Error('Failed to create target item');
            }
            targetItemId = newTargetItem.id;
          }

          // 收集物品信息用于合并记录
          transferItems.push({
            category_name: selected.item.category_name,
            specs: selected.item.specs,
            quantity: selected.quantity,
            source_item_id: selected.item.id!,
            target_item_id: targetItemId
          });
        }

        // 第二步：创建合并的交易记录（一条记录包含所有物品）
        // 计算总数量（用于显示）
        const totalQuantity = transferItems.reduce((sum, item) => sum + item.quantity, 0);
        
        // 构建包含所有物品信息的JSON字符串
        const itemsData = transferItems.map(item => ({
          category_name: item.category_name,
          specs: item.specs,
          quantity: item.quantity
        }));
        const itemNameSnapshot = JSON.stringify({
          type: 'MULTI_ITEM_TRANSFER',
          items: itemsData,
          total_quantity: totalQuantity
        });

        // 使用第一个物品的ID作为主item_id
        const primaryItemId = transferItems[0].source_item_id;

        // 3a. Source warehouse transaction (outbound, negative total quantity)
        await transactionsApi.create({
          item_id: primaryItemId,
          warehouse_id: activeWarehouseId,
          related_warehouse_id: targetWhId,
          item_name_snapshot: itemNameSnapshot,
          quantity: -totalQuantity,
          date: transferDate,
          user: formData.user,
          notes: formData.notes,
          type: 'TRANSFER'
        });

        // 3b. Target warehouse transaction (inbound, positive total quantity)
        await transactionsApi.create({
          item_id: transferItems[0].target_item_id,
          warehouse_id: targetWhId,
          related_warehouse_id: activeWarehouseId,
          item_name_snapshot: itemNameSnapshot,
          quantity: totalQuantity,
          date: transferDate,
          user: formData.user,
          notes: formData.notes,
          type: 'TRANSFER'
        });

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
                              <label className="text-xs text-slate-600 whitespace-nowrap">调拨数量:</label>
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

interface MergedTransferRecord {
  date: string;
  item_name_snapshot: string;
  quantity: number;
  source_warehouse_id: number;
  target_warehouse_id: number;
  user: string;
  notes: string;
}

const TransferHistory: React.FC = () => {
  const { activeWarehouseId, warehouses } = useWarehouse();
  const [mergedRecords, setMergedRecords] = useState<MergedTransferRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const data = await transactionsApi.getAll(
          activeWarehouseId,
          'TRANSFER',
          filterDate || undefined
        );
        
        // 处理调拨记录：根据当前仓库视角显示调出或调入
        // 根据调拨创建逻辑：
        // - 调拨出：warehouse_id = 源仓库，quantity < 0，related_warehouse_id = 目标仓库
        // - 调拨入：warehouse_id = 目标仓库，quantity > 0，related_warehouse_id = 源仓库
        // 
        // 当查询某个仓库的调拨记录时，API 会返回：
        // 1. warehouse_id === activeWarehouseId 的记录（该仓库作为主仓库的记录）
        // 2. related_warehouse_id === activeWarehouseId 的记录（该仓库作为相关仓库的记录）
        //
        // 对于仓库 A 调拨到仓库 B：
        // - 仓库 A 会收到：warehouse_id = A, quantity < 0（调拨出）和 related_warehouse_id = A, quantity > 0（不存在，因为调拨入的 warehouse_id = B）
        // - 仓库 B 会收到：warehouse_id = B, quantity > 0（调拨入）和 related_warehouse_id = B, quantity < 0（调拨出，但 warehouse_id = A）
        //
        // 所以正确的逻辑是：
        // - 如果 warehouse_id === activeWarehouseId 且 quantity < 0：调拨出
        // - 如果 warehouse_id === activeWarehouseId 且 quantity > 0：调拨入
        // - 如果 related_warehouse_id === activeWarehouseId 且 quantity < 0：这是其他仓库的调拨出，不应该在当前仓库显示
        // - 如果 related_warehouse_id === activeWarehouseId 且 quantity > 0：这是其他仓库的调拨入，不应该在当前仓库显示
        const merged: MergedTransferRecord[] = [];
        const processed = new Set<number>();
        
        data.forEach((t) => {
          if (processed.has(t.id!)) return;
          
          // 只处理 warehouse_id === activeWarehouseId 的记录
          // 这样确保每个仓库只看到自己作为主仓库的记录
          if (t.warehouse_id === activeWarehouseId) {
            if (t.quantity < 0) {
              // 调拨出：当前仓库调出到其他仓库
              merged.push({
                date: t.date,
                item_name_snapshot: t.item_name_snapshot,
                quantity: Math.abs(t.quantity),
                source_warehouse_id: t.warehouse_id,
                target_warehouse_id: t.related_warehouse_id || 0,
                user: t.user,
                notes: t.notes
              });
              processed.add(t.id!);
            } else if (t.quantity > 0 && t.related_warehouse_id) {
              // 调拨入：从其他仓库调入到当前仓库
              merged.push({
                date: t.date,
                item_name_snapshot: t.item_name_snapshot,
                quantity: t.quantity,
                source_warehouse_id: t.related_warehouse_id,
                target_warehouse_id: t.warehouse_id,
                user: t.user,
                notes: t.notes
              });
              processed.add(t.id!);
            }
          }
          // 忽略 related_warehouse_id === activeWarehouseId 的记录
          // 因为这些记录属于其他仓库，不应该在当前仓库显示
        });
        
        // 按日期倒序排序
        merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setMergedRecords(merged);
      } catch (error) {
        console.error('Failed to fetch transfer transactions:', error);
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
          <ClipboardList size={20} className="text-blue-500" /> 调拨记录
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
              <th className="px-4 py-3">物品详情及数量</th>
              <th className="px-4 py-3">来源仓库</th>
              <th className="px-4 py-3">目的仓库</th>
              <th className="px-4 py-3">操作人</th>
              <th className="px-4 py-3">备注</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {mergedRecords.map((record, index) => {
              // 解析物品信息（支持新格式：JSON多物品，和旧格式：单物品字符串）
              let items: Array<{ category_name: string; specs: Record<string, string>; quantity: number }> = [];
              let totalQuantity = record.quantity;
              
              try {
                // 尝试解析为新格式（JSON多物品）
                const parsed = JSON.parse(record.item_name_snapshot);
                if (parsed.type === 'MULTI_ITEM_TRANSFER' && Array.isArray(parsed.items)) {
                  items = parsed.items;
                  totalQuantity = parsed.total_quantity || record.quantity;
                } else {
                  throw new Error('Not multi-item format');
                }
              } catch (e) {
                // 旧格式：单物品字符串 "品类名 - {...specs...}"
                try {
                  const [cat, specsStr] = record.item_name_snapshot.split(' - ');
                  const specs = JSON.parse(specsStr);
                  items = [{
                    category_name: cat,
                    specs: specs,
                    quantity: record.quantity
                  }];
                  totalQuantity = record.quantity;
                } catch (e2) {
                  // 如果解析失败，使用原始字符串
                  items = [{
                    category_name: record.item_name_snapshot,
                    specs: {},
                    quantity: record.quantity
                  }];
                  totalQuantity = record.quantity;
                }
              }

              const sourceWarehouse = warehouses.find(w => w.id === record.source_warehouse_id);
              const targetWarehouse = warehouses.find(w => w.id === record.target_warehouse_id);

              return (
                <tr key={`${record.date}-${record.source_warehouse_id}-${record.target_warehouse_id}-${index}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {new Date(record.date).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-2">
                      {items.map((item, itemIndex) => (
                        <div key={itemIndex} className="border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                          <div className="font-medium text-slate-800">{item.category_name}</div>
                          {Object.keys(item.specs).length > 0 && (
                            <div className="text-xs text-slate-500 mt-1">
                              {Object.values(item.specs).join(' ')}
                            </div>
                          )}
                          <div className="text-xs text-slate-600 mt-1">
                            数量: <span className="font-bold text-blue-600">{item.quantity}</span>
                          </div>
                        </div>
                      ))}
                      {items.length > 1 && (
                        <div className="pt-2 mt-2 border-t border-gray-200">
                          <div className="text-sm font-bold text-slate-700">
                            总计: <span className="text-blue-600">{totalQuantity}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {sourceWarehouse ? sourceWarehouse.name : `仓库 #${record.source_warehouse_id}`}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {targetWarehouse ? targetWarehouse.name : `仓库 #${record.target_warehouse_id}`}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {record.user}
                  </td>
                  <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={record.notes}>
                    {record.notes}
                  </td>
                </tr>
              );
            })}
            {mergedRecords.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400">
                  无调拨记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

