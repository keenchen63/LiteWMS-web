import React, { useState, useEffect } from 'react';
import { categoriesApi, itemsApi, transactionsApi } from '../services/api';
import { 
  Plus, Trash2, Edit2, X, Check, Settings, Boxes, PackagePlus, 
  Save, List, Calendar, Search, ShoppingCart, User, FileText, RotateCcw,
  Package, Layers, Building2
} from 'lucide-react';
import { useWarehouse } from '../contexts/WarehouseContext';
import { Dialog, DialogType } from './Dialog';
import { MFADialog } from './MFADialog';
import { useMFA } from '../hooks/useMFA';
import type { Category, AttributeDefinition, InventoryItemWithCategory } from '../types';

export const CategoryManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'inbound' | 'categories'>('inbound');
  const { activeWarehouseName } = useWarehouse();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">库存管理</h2>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-bold rounded-lg shadow-md shadow-blue-200 border border-blue-800">
              <Building2 size={16} />
              <span>{activeWarehouseName}</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-1 rounded-lg border border-gray-200 shadow-sm flex">
          <button 
            onClick={() => setActiveTab('inbound')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all 
              ${activeTab === 'inbound' 
                ? 'bg-blue-50 text-blue-700 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'}`}
          >
            <PackagePlus size={16} />
            入库管理
          </button>
          <button 
            onClick={() => setActiveTab('categories')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all 
              ${activeTab === 'categories' 
                ? 'bg-blue-50 text-blue-700 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Boxes size={16} />
            品类设置
          </button>
        </div>
      </div>

      {activeTab === 'inbound' ? <InboundPanel /> : <CategoryPanel />}
    </div>
  );
};

const InboundPanel: React.FC = () => {
  const [subTab, setSubTab] = useState<'entry' | 'edit'>('entry');

  return (
    <div className="space-y-6">
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setSubTab('entry')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            subTab === 'entry' 
              ? 'border-blue-500 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          入库录入
        </button>
        <button
          onClick={() => setSubTab('edit')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            subTab === 'edit' 
              ? 'border-blue-500 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          库存调整
        </button>
      </div>

      {subTab === 'entry' ? <InboundEntryView /> : <InventoryEditView />}
    </div>
  );
};

interface SelectedInboundItem {
  item: InventoryItemWithCategory;
  quantity: number;
}

interface CategoryBasedItem {
  category: Category;
  specs: Record<string, string>;
  quantity: number;
}

const InboundEntryView: React.FC = () => {
  const { activeWarehouseId } = useWarehouse();
  const { requireMFA, showMFADialog, handleMFAVerify, handleMFACancel } = useMFA();
  const [step, setStep] = useState<1|2>(1);
  const [mode, setMode] = useState<'inventory' | 'category'>('inventory'); // 两种模式：从库存选择 / 按品类添加
  const [selectedItems, setSelectedItems] = useState<SelectedInboundItem[]>([]);
  const [categoryBasedItems, setCategoryBasedItems] = useState<CategoryBasedItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [inventory, setInventory] = useState<InventoryItemWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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
  // 用于按品类添加模式：当前选中的品类和属性值
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categorySpecs, setCategorySpecs] = useState<Record<string, string>>({});
  const [categoryQuantity, setCategoryQuantity] = useState<number>(1);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [inventoryData, categoriesData] = await Promise.all([
          itemsApi.getWithCategory(activeWarehouseId),
          categoriesApi.getAll()
        ]);
        setInventory(inventoryData);
        setCategories(categoriesData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeWarehouseId]);

  const filteredInventory = inventory.filter(item => {
    const q = searchQuery.toLowerCase();
    const specString = Object.values(item.specs).join(' ');
    return item.category_name.toLowerCase().includes(q) || specString.toLowerCase().includes(q);
  });

  const handleItemQuantityChange = (itemId: number, quantity: number) => {
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;
    
    const validQuantity = Math.max(1, quantity);
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
        quantity: Math.max(1, quantity)
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
        ? { ...selected, quantity: Math.max(1, quantity) }
        : selected
    ));
  };

  const handleAddCategoryItem = () => {
    if (!selectedCategory) {
      setDialog({
        show: true,
        type: 'warning',
        title: '未选择品类',
        message: '请先选择一个品类'
      });
      return;
    }

    // 验证所有属性都已填写
    const missingAttrs = selectedCategory.attributes.filter(attr => !categorySpecs[attr.name] || !categorySpecs[attr.name].trim());
    if (missingAttrs.length > 0) {
      setDialog({
        show: true,
        type: 'warning',
        title: '属性未完整',
        message: `请填写所有属性：${missingAttrs.map(a => a.name).join('、')}`
      });
      return;
    }

    // 检查是否已添加相同规格的物品
    const existingIndex = categoryBasedItems.findIndex(item => 
      item.category.id === selectedCategory.id && 
      JSON.stringify(item.specs) === JSON.stringify(categorySpecs)
    );

    if (existingIndex >= 0) {
      // 更新数量
      const updated = [...categoryBasedItems];
      updated[existingIndex].quantity += categoryQuantity;
      setCategoryBasedItems(updated);
    } else {
      // 添加新物品
      setCategoryBasedItems([...categoryBasedItems, {
        category: selectedCategory,
        specs: { ...categorySpecs },
        quantity: categoryQuantity
      }]);
    }

    // 重置表单
    setSelectedCategory(null);
    setCategorySpecs({});
    setCategoryQuantity(1);
  };

  const handleRemoveCategoryItem = (index: number) => {
    setCategoryBasedItems(categoryBasedItems.filter((_, i) => i !== index));
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const totalItems = mode === 'inventory' ? selectedItems.length : categoryBasedItems.length;
    if (totalItems === 0) {
      setDialog({
        show: true,
        type: 'warning',
        title: '未选择物品',
        message: '请至少选择一个物品进行入库'
      });
      return;
    }

    // 验证操作人必填
    if (!formData.user || formData.user.trim() === '') {
      setDialog({
        show: true,
        type: 'warning',
        title: '操作人必填',
        message: '请填写操作人姓名'
      });
      return;
    }

    // 验证备注必填
    if (!formData.notes || formData.notes.trim() === '') {
      setDialog({
        show: true,
        type: 'warning',
        title: '备注必填',
        message: '请填写入库备注信息',
        details: '备注用于记录供应商、批次等重要信息'
      });
      return;
    }

    // MFA 验证
    const mfaVerified = await requireMFA('inbound');
    if (!mfaVerified) {
      return; // 用户取消了 MFA 验证
    }

    setLoading(true);

    try {
      const inboundItems: Array<{
        category_name: string;
        specs: Record<string, string>;
        quantity: number;
        item_id: number;
      }> = [];
      const inboundDate = new Date(formData.date).toISOString();

      if (mode === 'inventory') {
        // 从库存选择模式：更新现有物品
        for (const selected of selectedItems) {
          // Update item quantity (add to existing)
          await itemsApi.update(selected.item.id!, {
            quantity: selected.item.quantity + selected.quantity
          });

          // 收集物品信息用于合并记录
          inboundItems.push({
            category_name: selected.item.category_name,
            specs: selected.item.specs,
            quantity: selected.quantity,
            item_id: selected.item.id!
          });
        }
      } else {
        // 按品类添加模式：创建新物品或更新现有物品
        for (const categoryItem of categoryBasedItems) {
          // 检查该规格的物品是否已存在
          const existingItems = await itemsApi.getAll(activeWarehouseId, categoryItem.category.id);
          const existingItem = existingItems.find(item => 
            JSON.stringify(item.specs) === JSON.stringify(categoryItem.specs)
          );

          let itemId: number;
          if (existingItem) {
            // 物品已存在，更新数量
            await itemsApi.update(existingItem.id!, {
              quantity: existingItem.quantity + categoryItem.quantity
            });
            itemId = existingItem.id!;
          } else {
            // 物品不存在，创建新物品
            const newItem = await itemsApi.create({
              warehouse_id: activeWarehouseId,
              category_id: categoryItem.category.id!,
              specs: categoryItem.specs,
              quantity: categoryItem.quantity
            });
            itemId = newItem.id!;
          }

          // 收集物品信息用于合并记录
          inboundItems.push({
            category_name: categoryItem.category.name,
            specs: categoryItem.specs,
            quantity: categoryItem.quantity,
            item_id: itemId
          });
        }
      }

      // 创建合并的交易记录
      if (inboundItems.length > 0) {
        // 计算总数量
        const totalQuantity = inboundItems.reduce((sum, item) => sum + item.quantity, 0);
        
        // 构建包含所有物品信息的JSON字符串
        const itemsData = inboundItems.map(item => ({
          category_name: item.category_name,
          specs: item.specs,
          quantity: item.quantity
        }));
        const itemNameSnapshot = JSON.stringify({
          type: 'MULTI_ITEM_INBOUND',
          items: itemsData,
          total_quantity: totalQuantity
        });

        // 使用第一个物品的ID作为主item_id
        const primaryItemId = inboundItems[0].item_id;

        // 创建合并的交易记录
        await transactionsApi.create({
          warehouse_id: activeWarehouseId,
          item_id: primaryItemId,
          item_name_snapshot: itemNameSnapshot,
          quantity: totalQuantity,
          date: inboundDate,
          user: formData.user,
          notes: formData.notes,
          type: 'IN'
        });
      }

      // Reset
      setStep(1);
      setSelectedItems([]);
      setCategoryBasedItems([]);
      setSelectedCategory(null);
      setCategorySpecs({});
      setFormData({
        date: new Date().toISOString().split('T')[0],
        user: '',
        notes: ''
      });
      
      // 刷新库存数据
      const data = await itemsApi.getWithCategory(activeWarehouseId);
      setInventory(data);
      
      setDialog({
        show: true,
        type: 'success',
        title: '入库成功',
        message: `已成功入库 ${totalItems} 个物品`
      });
    } catch (error) {
      console.error(error);
      setDialog({
        show: true,
        type: 'error',
        title: '操作失败',
        message: '入库操作失败，请稍后重试'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
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
        message="请输入您的验证码以完成入库操作"
      />

      {step === 1 ? (
        <div className="space-y-6">
          {/* 模式切换 */}
          <div className="bg-white p-1 rounded-lg border border-gray-200 shadow-sm flex">
            <button
              onClick={() => {
                setMode('inventory');
                setSelectedItems([]);
                setCategoryBasedItems([]);
                setSelectedCategory(null);
                setCategorySpecs({});
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'inventory'
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Package size={16} />
              从库存选择
            </button>
            <button
              onClick={() => {
                setMode('category');
                setSelectedItems([]);
                setCategoryBasedItems([]);
                setSelectedCategory(null);
                setCategorySpecs({});
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'category'
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Layers size={16} />
              按品类添加
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 左侧：物品选择区域 */}
            <div className="space-y-4">
              {mode === 'inventory' ? (
                /* 从库存选择模式 */
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">选择入库物品</label>
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
                          <label className="text-xs text-slate-600 whitespace-nowrap">入库数量:</label>
                          <input
                            type="number"
                            min="1"
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
              ) : (
                /* 按品类添加模式 */
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">选择品类并填写属性</label>
                  
                  {/* 品类选择 */}
                  <div className="mb-3">
                    <select
                      value={selectedCategory?.id || ''}
                      onChange={(e) => {
                        const categoryId = Number(e.target.value);
                        const category = categories.find(c => c.id === categoryId);
                        setSelectedCategory(category || null);
                        setCategorySpecs({});
                        setCategoryQuantity(1);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="">-- 请选择品类 --</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* 属性输入 */}
                  {selectedCategory && (
                    <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="text-sm font-semibold text-slate-800 mb-3">{selectedCategory.name} - 属性设置</h4>
                      {selectedCategory.attributes.map((attr) => (
                        <div key={attr.name}>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            {attr.name} <span className="text-red-500">*</span>
                          </label>
                          {attr.options.length > 0 ? (
                            <select
                              value={categorySpecs[attr.name] || ''}
                              onChange={(e) => setCategorySpecs({ ...categorySpecs, [attr.name]: e.target.value })}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                              required
                            >
                              <option value="">-- 请选择 --</option>
                              {attr.options.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={categorySpecs[attr.name] || ''}
                              onChange={(e) => setCategorySpecs({ ...categorySpecs, [attr.name]: e.target.value })}
                              placeholder={`请输入${attr.name}`}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                              required
                            />
                          )}
                        </div>
                      ))}
                      
                      {/* 数量输入 */}
                      <div className="pt-2 border-t border-blue-200">
                        <label className="block text-xs font-medium text-gray-700 mb-1">入库数量 <span className="text-red-500">*</span></label>
                        <input
                          type="number"
                          min="1"
                          value={categoryQuantity}
                          onChange={(e) => setCategoryQuantity(Math.max(1, Number(e.target.value)))}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>

                      {/* 添加按钮 */}
                      <button
                        onClick={handleAddCategoryItem}
                        className="w-full mt-3 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus size={16} />
                        添加到入库列表
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 右侧：已选择物品列表和下一步按钮 */}
            <div>
              <div className="h-[28px]"></div>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-slate-800">
                    已选择物品 ({mode === 'inventory' ? selectedItems.length : categoryBasedItems.length})
                  </h4>
                  {(mode === 'inventory' ? selectedItems.length : categoryBasedItems.length) > 0 && (
                    <button
                      onClick={() => {
                        if (mode === 'inventory') {
                          setSelectedItems([]);
                        } else {
                          setCategoryBasedItems([]);
                        }
                      }}
                      className="text-xs text-red-600 hover:text-red-700 font-medium"
                    >
                      清空
                    </button>
                  )}
                </div>
                
                {mode === 'inventory' ? (
                  /* 从库存选择模式的已选列表 */
                  selectedItems.length === 0 ? (
                    <div className="text-sm text-slate-500 text-center py-8">暂无选择物品</div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {selectedItems.map((selected) => (
                        <div key={selected.item.id} className="bg-white p-3 rounded-lg border border-gray-200">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="font-medium text-slate-800 text-sm">{selected.item.category_name}</div>
                              <div className="text-xs text-slate-500 mt-1">
                                {Object.values(selected.item.specs).join(' ')}
                              </div>
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
                              value={selected.quantity}
                              onChange={e => handleUpdateItemQuantity(selected.item.id!, Number(e.target.value))}
                              className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  /* 按品类添加模式的已选列表 */
                  categoryBasedItems.length === 0 ? (
                    <div className="text-sm text-slate-500 text-center py-8">暂无选择物品</div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {categoryBasedItems.map((item, index) => (
                        <div key={index} className="bg-white p-3 rounded-lg border border-gray-200">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="font-medium text-slate-800 text-sm">{item.category.name}</div>
                              <div className="text-xs text-slate-500 mt-1">
                                {Object.entries(item.specs).map(([k, v]) => `${k}: ${v}`).join(', ')}
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveCategoryItem(index)}
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
                              value={item.quantity}
                              onChange={e => {
                                const updated = [...categoryBasedItems];
                                updated[index].quantity = Math.max(1, Number(e.target.value));
                                setCategoryBasedItems(updated);
                              }}
                              className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>

              <button
                onClick={() => {
                  const totalItems = mode === 'inventory' ? selectedItems.length : categoryBasedItems.length;
                  if (totalItems === 0) {
                    setDialog({
                      show: true,
                      type: 'warning',
                      title: '未选择物品',
                      message: '请至少选择一个物品进行入库'
                    });
                    return;
                  }
                  setStep(2);
                }}
                disabled={(mode === 'inventory' ? selectedItems.length : categoryBasedItems.length) === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-lg shadow-lg shadow-blue-100 transition-all flex justify-center items-center gap-2"
              >
                下一步：填写入库信息
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 max-w-4xl mx-auto">
          <button 
            onClick={() => setStep(1)}
            className="text-sm text-slate-500 hover:text-slate-800 mb-4 flex items-center gap-1"
          >
            &larr; 返回重新选择
          </button>

          <div className="mb-6 pb-6 border-b border-gray-100">
            <h3 className="text-xl font-bold text-slate-900 mb-2">第二步：填写入库信息</h3>
            <p className="text-sm text-slate-500">已选择 {mode === 'inventory' ? selectedItems.length : categoryBasedItems.length} 个物品，请填写入库信息</p>
          </div>

          <form onSubmit={handleBatchSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Calendar size={16}/> 入库日期
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
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm mb-2">
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
                      入库数量 <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="number" 
                      min="1"
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
                placeholder="供应商、批次等信息..."
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
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-lg shadow-lg shadow-blue-200 transition-all"
              >
                {loading ? '处理中...' : `确认入库 (${selectedItems.length} 个物品)`}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

interface ItemEditState {
  quantity: number;
  isDeleted: boolean;
  originalQuantity: number;
}

const InventoryEditView: React.FC = () => {
  const { activeWarehouseId } = useWarehouse();
  const { requireMFA, showMFADialog, handleMFAVerify, handleMFACancel } = useMFA();
  const [tableSearch, setTableSearch] = useState('');
  const [allItems, setAllItems] = useState<InventoryItemWithCategory[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemEdits, setItemEdits] = useState<Record<number, ItemEditState>>({});
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmFormData, setConfirmFormData] = useState({
    user: '',
    notes: ''
  });
  const [dialog, setDialog] = useState<{ show: boolean; type: DialogType; title: string; message: string; details?: string }>({
    show: false,
    type: 'info',
    title: '',
    message: ''
  });

  useEffect(() => {
    const fetchItems = async () => {
      setItemsLoading(true);
      try {
        const data = await itemsApi.getWithCategory(activeWarehouseId);
        const sorted = data.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        setAllItems(sorted);
        // 初始化编辑状态
        const initialEdits: Record<number, ItemEditState> = {};
        sorted.forEach(item => {
          if (item.id) {
            initialEdits[item.id] = {
              quantity: item.quantity,
              isDeleted: false,
              originalQuantity: item.quantity
            };
          }
        });
        setItemEdits(initialEdits);
      } catch (error) {
        console.error('Failed to fetch items:', error);
      } finally {
        setItemsLoading(false);
      }
    };
    fetchItems();
  }, [activeWarehouseId]);

  const filteredItems = allItems.filter(item => {
    if (!tableSearch) return true;
    const q = tableSearch.toLowerCase();
    const specString = Object.values(item.specs).join(' ');
    return item.category_name.toLowerCase().includes(q) || specString.toLowerCase().includes(q);
  });

  const handleQuantityChange = (itemId: number, quantity: number) => {
    if (quantity < 0) {
      setDialog({
        show: true,
        type: 'warning',
        title: '输入错误',
        message: '数量不能为负数'
      });
      return;
    }
    
    setItemEdits(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        quantity: quantity
      }
    }));
  };

  const handleDeleteClick = (itemId: number) => {
    setItemEdits(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        isDeleted: true
      }
    }));
  };

  const handleRestore = (itemId: number) => {
    setItemEdits(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        isDeleted: false
      }
    }));
  };

  const hasChanges = () => {
    return Object.entries(itemEdits).some(([itemId, editState]) => {
      const item = allItems.find(i => i.id?.toString() === itemId);
      if (!item) return false;
      
      // 检查是否有删除
      if (editState.isDeleted) return true;
      
      // 检查数量是否有变化
      return editState.quantity !== editState.originalQuantity;
    });
  };

  const getChangedItems = () => {
    const changes: Array<{
      item: InventoryItemWithCategory;
      editState: ItemEditState;
      type: 'adjust' | 'delete';
      diff?: number;
    }> = [];

    Object.entries(itemEdits).forEach(([itemIdStr, editState]) => {
      const itemId = Number(itemIdStr);
      const item = allItems.find(i => i.id === itemId);
      
      if (!item) return;

      if (editState.isDeleted) {
        changes.push({
          item,
          editState,
          type: 'delete'
        });
      } else {
        const diff = editState.quantity - editState.originalQuantity;
        if (diff !== 0) {
          changes.push({
            item,
            editState,
            type: 'adjust',
            diff
          });
        }
      }
    });

    return changes;
  };

  const handleSubmitClick = () => {
    if (!hasChanges()) {
      setDialog({
        show: true,
        type: 'warning',
        title: '无变更',
        message: '请先进行数量调整或删除操作'
      });
      return;
    }

    setShowConfirmDialog(true);
  };

  const handleBatchSubmit = async () => {
    if (!confirmFormData.user || !confirmFormData.user.trim()) {
      setDialog({
        show: true,
        type: 'warning',
        title: '操作人必填',
        message: '请填写操作人姓名'
      });
      return;
    }

    if (!confirmFormData.notes || !confirmFormData.notes.trim()) {
      setDialog({
        show: true,
        type: 'warning',
        title: '备注必填',
        message: '请填写调整备注信息'
      });
      return;
    }

    // 先关闭确认对话框，再显示 MFA 验证
    setShowConfirmDialog(false);
    
    // 等待一小段时间确保对话框关闭动画完成
    await new Promise(resolve => setTimeout(resolve, 100));

    // MFA 验证
    const mfaVerified = await requireMFA('adjust');
    if (!mfaVerified) {
      return; // 用户取消了 MFA 验证
    }

    setLoading(true);

    try {
      const promises: Promise<any>[] = [];
      const adjustItems: Array<{
        category_name: string;
        specs: Record<string, string>;
        quantity_diff: number;
        item_id: number;
      }> = [];

      // 第一步：处理数量调整和收集物品信息
      Object.entries(itemEdits).forEach(([itemIdStr, editState]) => {
        const itemId = Number(itemIdStr);
        const item = allItems.find(i => i.id === itemId);
        
        if (!item || editState.isDeleted) return;
        
        const diff = editState.quantity - editState.originalQuantity;
        if (diff === 0) return;

        // 更新库存
        promises.push(
          itemsApi.update(itemId, {
            quantity: editState.quantity
          })
        );

        // 收集物品信息用于合并记录
        adjustItems.push({
          category_name: item.category_name || 'Unknown',
          specs: item.specs,
          quantity_diff: diff,
          item_id: itemId
        });
      });

      // 处理删除
      Object.entries(itemEdits).forEach(([itemIdStr, editState]) => {
        if (editState.isDeleted) {
          const itemId = Number(itemIdStr);
          promises.push(itemsApi.delete(itemId));
        }
      });

      // 等待所有库存更新完成
      await Promise.all(promises);

      // 第二步：如果有调整的物品，创建合并的交易记录
      if (adjustItems.length > 0) {
        // 计算总数量变动（用于显示）
        const totalQuantityDiff = adjustItems.reduce((sum, item) => sum + item.quantity_diff, 0);
        
        // 构建包含所有物品信息的JSON字符串
        const itemsData = adjustItems.map(item => ({
          category_name: item.category_name,
          specs: item.specs,
          quantity_diff: item.quantity_diff
        }));
        const itemNameSnapshot = JSON.stringify({
          type: 'MULTI_ITEM_ADJUST',
          items: itemsData,
          total_quantity_diff: totalQuantityDiff
        });

        // 使用第一个物品的ID作为主item_id
        const primaryItemId = adjustItems[0].item_id;

        // 创建合并的交易记录
        await transactionsApi.create({
          item_id: primaryItemId,
          warehouse_id: activeWarehouseId,
          item_name_snapshot: itemNameSnapshot,
          quantity: totalQuantityDiff,
          date: new Date().toISOString(),
          user: confirmFormData.user,
          notes: confirmFormData.notes,
          type: 'ADJUST'
        });
      }

      // Refresh items
      const data = await itemsApi.getWithCategory(activeWarehouseId);
      const sorted = data.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      setAllItems(sorted);
      
      // 重置编辑状态
      const initialEdits: Record<number, ItemEditState> = {};
      sorted.forEach(item => {
        if (item.id) {
          initialEdits[item.id] = {
            quantity: item.quantity,
            isDeleted: false,
            originalQuantity: item.quantity
          };
        }
      });
      setItemEdits(initialEdits);
      setConfirmFormData({ user: '', notes: '' });
      
      setDialog({
        show: true,
        type: 'success',
        title: '提交成功',
        message: '库存调整已保存'
      });
    } catch (error: any) {
      console.error('提交失败:', error);
      const errorMessage = error.response?.data?.detail || error.message || '提交失败，请稍后重试';
      setDialog({
        show: true,
        type: 'error',
        title: '提交失败',
        message: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
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
        message="请输入您的验证码以完成库存调整"
      />

      {/* Confirm Submit Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Save size={24} className="text-blue-500" />
                确认提交调整
              </h3>
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              {/* 调整项目列表 */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">本次调整项目</h4>
                <div className="bg-slate-50 rounded-lg border border-gray-200 p-4 max-h-64 overflow-y-auto">
                  {getChangedItems().length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">无调整项目</p>
                  ) : (
                    <div className="space-y-3">
                      {getChangedItems().map((change) => (
                        <div key={change.item.id} className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-slate-800">{change.item.category_name}</span>
                                {change.type === 'delete' && (
                                  <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-bold">
                                    删除
                                  </span>
                                )}
                                {change.type === 'adjust' && change.diff && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                    change.diff > 0 
                                      ? 'bg-green-100 text-green-700' 
                                      : 'bg-orange-100 text-orange-700'
                                  }`}>
                                    {change.diff > 0 ? '+' : ''}{change.diff}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 mb-2">
                                {Object.entries(change.item.specs).map(([k, v]) => `${k}: ${v}`).join(', ')}
                              </div>
                              {change.type === 'adjust' && (
                                <div className="text-xs text-slate-600">
                                  <span className="text-slate-400">原数量:</span> {change.editState.originalQuantity} 
                                  <span className="mx-2">→</span>
                                  <span className="text-slate-400">新数量:</span> <span className="font-bold">{change.editState.quantity}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 操作人和备注 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <User size={16} /> 操作人 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="请输入操作人姓名"
                    value={confirmFormData.user}
                    onChange={(e) => setConfirmFormData({ ...confirmFormData, user: e.target.value })}
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
                    placeholder="请输入调整原因、说明等..."
                    value={confirmFormData.notes}
                    onChange={(e) => setConfirmFormData({ ...confirmFormData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  setConfirmFormData({ user: '', notes: '' });
                }}
                className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleBatchSubmit}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {loading ? '提交中...' : '确认提交'}
                <Save size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <List size={20} className="text-slate-500"/>
            当前仓库库存
          </h3>
          <div className="flex items-center gap-4">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="搜索品类、规格..." 
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <button
              onClick={handleSubmitClick}
              disabled={loading || !hasChanges()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              {loading ? '提交中...' : '提交调整'}
              <Save size={16} />
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-100">
              <tr>
                <th className="px-6 py-3 w-20">ID</th>
                <th className="px-6 py-3 w-40">品类</th>
                <th className="px-6 py-3">规格详情</th>
                <th className="px-6 py-3 w-32 text-center">库存数量</th>
                <th className="px-6 py-3 w-32 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {itemsLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">加载中...</td>
                </tr>
              ) : filteredItems.map(item => {
                const editState = item.id ? itemEdits[item.id] : null;
                const currentQuantity = editState?.quantity ?? item.quantity;
                const hasChanged = editState && editState.quantity !== editState.originalQuantity;
                const isDeleted = editState?.isDeleted ?? false;
                
                return (
                  <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${
                    isDeleted ? 'bg-red-50 opacity-60' : hasChanged ? 'bg-blue-50' : ''
                  }`}>
                    <td className={`px-6 py-4 text-slate-400 ${isDeleted ? 'line-through' : ''}`}>
                      #{item.id}
                    </td>
                    <td className={`px-6 py-4 font-semibold ${isDeleted ? 'line-through text-slate-500' : 'text-slate-700'}`}>
                      {item.category_name}
                    </td>
                    <td className={`px-6 py-4 ${isDeleted ? 'line-through' : ''}`}>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(item.specs).map(([k, v]) => (
                          <span key={k} className={`px-2 py-1 rounded text-xs border ${
                            isDeleted 
                              ? 'bg-red-100 text-slate-400 border-red-200' 
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            <span className="opacity-60 mr-1">{k}:</span>{v}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input 
                        type="number"
                        min="0"
                        value={currentQuantity}
                        onChange={(e) => {
                          if (item.id && !isDeleted) {
                            handleQuantityChange(item.id, Number(e.target.value));
                          }
                        }}
                        disabled={isDeleted}
                        className={`w-20 px-2 py-1 border rounded text-center font-bold outline-none focus:ring-2 ${
                          isDeleted
                            ? 'border-red-300 text-slate-400 bg-red-50 cursor-not-allowed'
                            : hasChanged 
                              ? 'border-blue-500 text-blue-600 focus:ring-blue-200 bg-blue-50' 
                              : 'border-gray-300 text-slate-700 focus:ring-blue-200'
                        }`}
                      />
                      {hasChanged && !isDeleted && (
                        <div className="text-xs text-blue-600 mt-1">
                          原: {editState.originalQuantity}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isDeleted ? (
                        <button 
                          onClick={() => item.id && handleRestore(item.id)}
                          className="p-2 text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 rounded transition-colors"
                          title="恢复"
                        >
                          <RotateCcw size={16} />
                        </button>
                      ) : (
                        <button 
                          onClick={() => item.id && handleDeleteClick(item.id)}
                          className="p-2 text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 rounded transition-colors"
                          title="删除"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!itemsLoading && filteredItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    暂无库存数据
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

const CategoryPanel: React.FC = () => {
  const { requireMFA, showMFADialog, handleMFAVerify, handleMFACancel } = useMFA();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([{ name: '', options: [] }]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ show: boolean; type: DialogType; title: string; message: string; details?: string }>({
    show: false,
    type: 'info',
    title: '',
    message: ''
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; category: Category | null }>({ show: false, category: null });

  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      try {
        const data = await categoriesApi.getAll();
        setCategories(data);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const resetForm = () => {
    setName('');
    setAttributes([{ name: '', options: [] }]);
    setIsEditing(null);
  };

  const handleStartEdit = (cat: Category) => {
    setIsEditing(cat.id!);
    setName(cat.name);
    setAttributes(cat.attributes.length > 0 ? cat.attributes : [{ name: '', options: [] }]);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setDialog({
        show: true,
        type: 'warning',
        title: '输入错误',
        message: '品类名称不能为空'
      });
      return;
    }
    
    const cleanAttrs = attributes
      .map(a => ({ name: a.name.trim(), options: a.options }))
      .filter(a => !!a.name);

    if (cleanAttrs.length === 0) {
      setDialog({
        show: true,
        type: 'warning',
        title: '输入错误',
        message: '请至少添加一个属性 (如: 长度, 颜色)'
      });
      return;
    }

    // MFA 验证 - 根据是否编辑判断操作类型
    const operationType = isEditing ? 'category_update' : 'category_create';
    const mfaVerified = await requireMFA(operationType);
    if (!mfaVerified) {
      return; // 用户取消了 MFA 验证
    }

    try {
      if (isEditing) {
        await categoriesApi.update(isEditing, { name, attributes: cleanAttrs });
      } else {
        await categoriesApi.create({ name, attributes: cleanAttrs });
      }
      resetForm();
      
      // Refresh categories
      const data = await categoriesApi.getAll();
      setCategories(data);
      
      setDialog({
        show: true,
        type: 'success',
        title: '保存成功',
        message: isEditing ? '品类已更新' : '品类已创建'
      });
    } catch (error) {
      console.error(error);
      setDialog({
        show: true,
        type: 'error',
        title: '保存失败',
        message: '保存品类失败，请稍后重试'
      });
    }
  };

  const handleDeleteClick = (category: Category) => {
    setDeleteConfirm({ show: true, category });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.category) return;
    
    // 先关闭确认对话框
    setDeleteConfirm({ show: false, category: null });
    
    // 等待一小段时间确保对话框关闭动画完成
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // MFA 验证
    const mfaVerified = await requireMFA('category_delete');
    if (!mfaVerified) {
      return; // 用户取消了 MFA 验证
    }
    
    try {
      await categoriesApi.delete(deleteConfirm.category.id!);
      const data = await categoriesApi.getAll();
      setCategories(data);
      
      setDialog({
        show: true,
        type: 'success',
        title: '删除成功',
        message: '品类已删除'
      });
    } catch (error: any) {
      if (error.response?.status === 400) {
        setDialog({
          show: true,
          type: 'error',
          title: '删除失败',
          message: error.response.data.detail || '该品类下仍有库存记录，无法删除。'
        });
      } else {
        setDialog({
          show: true,
          type: 'error',
          title: '删除失败',
          message: '删除品类失败，请稍后重试'
        });
      }
    }
  };

  const addAttributeField = () => setAttributes([...attributes, { name: '', options: [] }]);
  
  const updateAttributeName = (index: number, val: string) => {
    const newAttrs = [...attributes];
    newAttrs[index].name = val;
    setAttributes(newAttrs);
  };

  const updateAttributeOptions = (index: number, val: string) => {
    const newAttrs = [...attributes];
    newAttrs[index].options = val.split(/[,，]/).map(s => s.trim()).filter(s => s !== '');
    setAttributes(newAttrs);
  };

  const removeAttributeField = (index: number) => {
    const newAttrs = attributes.filter((_, i) => i !== index);
    setAttributes(newAttrs.length ? newAttrs : [{ name: '', options: [] }]);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-full text-center text-slate-500 py-8">加载中...</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
        message="请输入您的验证码以完成品类操作"
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirm.show && deleteConfirm.category && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 max-w-md w-full mx-4 animate-in fade-in zoom-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <Trash2 className="text-red-600" size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">确认删除</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-slate-600 mb-3">确定要删除该品类吗？相关的库存数据可能也会受到影响。此操作不可恢复。</p>
              <div className="bg-slate-50 rounded-lg p-4">
                <div>
                  <span className="text-sm font-medium text-slate-500">品类名称：</span>
                  <span className="text-sm text-slate-800 ml-2 font-bold">{deleteConfirm.category.name}</span>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm({ show: false, category: null })}
                className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} />
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit sticky top-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          {isEditing ? <Edit2 size={18} /> : <Plus size={18} />}
          {isEditing ? '编辑品类' : '新增品类'}
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">品类名称</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：光纤跳线"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">属性定义</label>
              <span className="text-xs text-gray-400">选项用逗号分隔</span>
            </div>
            
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {attributes.map((attr, idx) => (
                <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2 relative group">
                   <button 
                    onClick={() => removeAttributeField(idx)}
                    className="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition-colors"
                    title="删除属性"
                  >
                    <X size={16} />
                  </button>

                  <div>
                    <input 
                      type="text"
                      value={attr.name}
                      onChange={(e) => updateAttributeName(idx, e.target.value)}
                      placeholder="属性名 (如: 长度)"
                      className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded text-sm focus:border-blue-500 outline-none font-medium placeholder:font-normal"
                    />
                  </div>
                  <div>
                    <input 
                      type="text"
                      value={attr.options.join(', ')}
                      onChange={(e) => updateAttributeOptions(idx, e.target.value)}
                      placeholder="预设选项: 1m, 3m, 5m"
                      className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded text-sm focus:border-blue-500 outline-none text-slate-600"
                    />
                  </div>
                </div>
              ))}
            </div>
            <button 
              onClick={addAttributeField}
              className="mt-3 w-full py-2 border border-dashed border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 rounded-lg text-sm font-medium flex justify-center items-center gap-1 transition-all"
            >
              <Plus size={14} /> 添加属性
            </button>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              onClick={handleSave}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors flex justify-center items-center gap-2"
            >
              <Check size={18} /> 保存
            </button>
            {isEditing && (
              <button 
                onClick={resetForm}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors"
              >
                取消
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 h-fit">
        {categories.map((cat) => (
          <div key={cat.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow relative group">
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => handleStartEdit(cat)}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full"
              >
                <Edit2 size={16} />
              </button>
              <button 
                onClick={() => handleDeleteClick(cat)}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded-full"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <h3 className="font-bold text-lg text-slate-800 mb-3 pr-16 border-b border-gray-100 pb-2">{cat.name}</h3>
            
            <div className="space-y-2">
              {cat.attributes.map((attr, i) => {
                const attrName = attr.name;
                const attrOptions = attr.options;
                
                return (
                  <div key={i} className="flex items-start text-sm">
                    <span className="text-slate-500 w-16 shrink-0 pt-0.5">{attrName}:</span>
                    <div className="flex flex-wrap gap-1">
                      {attrOptions.length > 0 ? (
                        attrOptions.map((opt, idx) => (
                           <span key={idx} className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                             {opt}
                           </span>
                        ))
                      ) : (
                        <span className="text-slate-400 italic text-xs pt-0.5">任意输入</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {categories.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
            <Settings size={48} className="mx-auto mb-3 opacity-20" />
            <p>暂无品类数据，请在左侧添加。</p>
          </div>
        )}
      </div>
    </div>
  );
};

