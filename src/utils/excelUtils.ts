import * as XLSX from 'xlsx';

/**
 * 生成入库导入模板
 */
export const generateInboundTemplate = () => {
  const ws = XLSX.utils.aoa_to_sheet([
    ['品类名称', '属性1名称', '属性1值', '属性2名称', '属性2值', '属性3名称', '属性3值', '属性4名称', '属性4值', '数量', '备注'],
    ['示例：光纤跳线', '模式 (Mode)', 'OM3', '接口类型 (Interface)', 'LC-LC', '长度 (Length)', '3m', '极性 (Polarity)', 'A-B', '10', '供应商：华为'],
    ['示例：网线', '类型 (Cat)', 'Cat6', '长度 (Length)', '1m', '颜色 (Color)', '蓝色', '屏蔽 (Shielding)', 'UTP', '20', '采购订单：PO-12345'],
    ['', '', '', '', '', '', '', '', '', '', ''],
    ['说明：1. 如果属性少于4个，可直接留空多余的列，无需删除；2. 如果属性超过4个，可添加"属性5名称"、"属性5值"等列；3. 属性列必须成对出现', '', '', '', '', '', '', '', '', ''],
  ]);

  // 设置列宽
  ws['!cols'] = [
    { wch: 20 }, // 品类名称
    { wch: 18 }, // 属性1名称
    { wch: 15 }, // 属性1值
    { wch: 18 }, // 属性2名称
    { wch: 15 }, // 属性2值
    { wch: 18 }, // 属性3名称
    { wch: 15 }, // 属性3值
    { wch: 18 }, // 属性4名称
    { wch: 15 }, // 属性4值
    { wch: 10 }, // 数量
    { wch: 30 }, // 备注
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '入库模板');
  XLSX.writeFile(wb, '入库导入模板.xlsx');
};

/**
 * 生成品类导入模板
 */
export const generateCategoryTemplate = () => {
  const ws = XLSX.utils.aoa_to_sheet([
    ['品类名称', '属性名称1', '属性选项1（用逗号分隔）', '属性名称2', '属性选项2（用逗号分隔）', '属性名称3', '属性选项3（用逗号分隔）'],
    ['示例：光纤跳线', '模式 (Mode)', '单模 (SM),多模 (MM),OM3,OM4,OS2', '接口类型 (Interface)', 'LC-LC,SC-SC,LC-SC,FC-FC,ST-ST', '长度 (Length)', '1m,2m,3m,5m,10m,15m,20m,30m'],
    ['示例：网线', '类型 (Cat)', 'Cat5e,Cat6,Cat6a,Cat7,Cat8', '长度 (Length)', '0.5m,1m,2m,3m,5m,10m,15m,20m', '颜色 (Color)', '蓝色,黄色,灰色,红色,绿色,黑色'],
    ['', '', '', '', '', '', ''],
    ['说明：1. 如果属性少于3个，可直接留空多余的列，无需删除；2. 如果属性超过3个，可添加"属性名称4"、"属性选项4"等列；3. 属性列必须成对出现', '', '', '', '', '', ''],
  ]);

  // 设置列宽
  ws['!cols'] = [
    { wch: 20 }, // 品类名称
    { wch: 20 }, // 属性名称1
    { wch: 40 }, // 属性选项1
    { wch: 20 }, // 属性名称2
    { wch: 40 }, // 属性选项2
    { wch: 20 }, // 属性名称3
    { wch: 40 }, // 属性选项3
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '品类模板');
  XLSX.writeFile(wb, '品类导入模板.xlsx');
};

/**
 * 解析入库 Excel 文件
 */
export interface InboundImportRow {
  categoryName: string;
  specs: Record<string, string>;
  quantity: number;
  notes?: string;
}

export const parseInboundExcel = (file: File): Promise<InboundImportRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' }) as any[][];
        
        if (rows.length < 2) {
          reject(new Error('Excel 文件至少需要包含表头和数据行'));
          return;
        }

        const header = rows[0] as string[];
        const categoryIndex = header.findIndex(h => h.includes('品类') || h.includes('名称'));
        const quantityIndex = header.findIndex(h => h.includes('数量'));
        const notesIndex = header.findIndex(h => h.includes('备注'));
        
        // 查找属性名称和属性值列对（成对出现：属性1名称、属性1值、属性2名称、属性2值...）
        // 支持任意数量的属性列对，用户可以自行添加属性5名称、属性5值等
        // 支持的格式：
        // - 属性1名称、属性1值
        // - 属性2名称、属性2值
        // - 属性名称1、属性值1
        // - 等等
        const attributePairs: Array<{ nameIndex: number; valueIndex: number }> = [];
        const processedIndices = new Set<number>();
        
        for (let i = 0; i < header.length; i++) {
          if (i === categoryIndex || i === quantityIndex || i === notesIndex || processedIndices.has(i)) continue;
          
          const headerName = String(header[i] || '').trim();
          if (!headerName) continue;
          
          // 检查是否是属性名称列（包含"属性"和"名称"，但不包含"品类"）
          // 匹配：属性1名称、属性2名称、属性名称1、属性名称2 等格式
          const isAttributeNameColumn = 
            !headerName.includes('品类') && 
            headerName.includes('属性') && 
            headerName.includes('名称');
          
          if (isAttributeNameColumn) {
            // 查找对应的属性值列（下一列）
            if (i + 1 < header.length && 
                i + 1 !== categoryIndex && 
                i + 1 !== quantityIndex && 
                i + 1 !== notesIndex &&
                !processedIndices.has(i + 1)) {
              const nextHeaderName = String(header[i + 1] || '').trim();
              // 检查下一列是否是属性值列（包含"值"和"属性"，但不包含"品类"）
              const isAttributeValueColumn = 
                nextHeaderName && 
                !nextHeaderName.includes('品类') &&
                nextHeaderName.includes('属性') &&
                nextHeaderName.includes('值');
              
              if (isAttributeValueColumn) {
                attributePairs.push({ nameIndex: i, valueIndex: i + 1 });
                processedIndices.add(i);
                processedIndices.add(i + 1);
              }
            }
          }
        }

        // 如果没有找到成对的列，尝试兼容旧格式（属性名: 属性值）
        let useOldFormat = attributePairs.length === 0;
        if (!useOldFormat) {
          // 检查是否所有列都是成对的
          const specIndices: number[] = [];
          header.forEach((h, index) => {
            if (index !== categoryIndex && index !== quantityIndex && index !== notesIndex && h) {
              specIndices.push(index);
            }
          });
          // 如果找到的列数不是偶数，可能混用了格式
          if (specIndices.length % 2 !== 0) {
            useOldFormat = true;
          }
        }

        if (categoryIndex === -1) {
          reject(new Error('未找到品类名称列'));
          return;
        }

        if (quantityIndex === -1) {
          reject(new Error('未找到数量列'));
          return;
        }

        const result: InboundImportRow[] = [];
        
        // 从第二行开始解析数据（跳过表头）
        // 跳过最后一行说明（如果第一列包含"说明"关键词）
        const lastRowIndex = rows.length - 1;
        const shouldSkipLastRow = lastRowIndex >= 1 && 
          String(rows[lastRowIndex]?.[categoryIndex] || '').trim().includes('说明');
        
        for (let i = 1; i < rows.length; i++) {
          // 跳过最后一行说明
          if (shouldSkipLastRow && i === lastRowIndex) continue;
          
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          const categoryName = String(row[categoryIndex] || '').trim();
          const quantity = Number(row[quantityIndex] || 0);
          const notes = notesIndex >= 0 ? String(row[notesIndex] || '').trim() : '';
          
          // 跳过空行和说明行
          if (!categoryName || categoryName.includes('说明')) continue;
          if (isNaN(quantity) || quantity <= 0) {
            reject(new Error(`第 ${i + 1} 行：数量必须是大于 0 的数字`));
            return;
          }

          // 解析规格属性
          const specs: Record<string, string> = {};
          
          if (useOldFormat) {
            // 旧格式：属性名: 属性值（兼容旧模板）
            const specIndices: number[] = [];
            header.forEach((h, index) => {
              if (index !== categoryIndex && index !== quantityIndex && index !== notesIndex && h) {
                specIndices.push(index);
              }
            });
            
            specIndices.forEach(specIndex => {
              const specValue = String(row[specIndex] || '').trim();
              if (specValue) {
                const colonIndex = specValue.indexOf(':');
                if (colonIndex > 0) {
                  const key = specValue.substring(0, colonIndex).trim();
                  const value = specValue.substring(colonIndex + 1).trim();
                  if (key && value) {
                    specs[key] = value;
                  }
                } else {
                  const headerName = header[specIndex];
                  if (headerName) {
                    specs[headerName] = specValue;
                  }
                }
              }
            });
          } else {
            // 新格式：属性名称列和属性值列分开
            attributePairs.forEach(pair => {
              const attrName = String(row[pair.nameIndex] || '').trim();
              const attrValue = String(row[pair.valueIndex] || '').trim();
              if (attrName && attrValue) {
                specs[attrName] = attrValue;
              }
            });
          }

          result.push({
            categoryName,
            specs,
            quantity,
            notes: notes || undefined
          });
        }

        if (result.length === 0) {
          reject(new Error('Excel 文件中没有有效的数据行'));
          return;
        }

        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('读取文件失败'));
    };

    reader.readAsArrayBuffer(file);
  });
};

/**
 * 解析品类 Excel 文件
 */
export interface CategoryImportRow {
  name: string;
  attributes: Array<{ name: string; options: string[] }>;
}

export const parseCategoryExcel = (file: File): Promise<CategoryImportRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' }) as any[][];
        
        if (rows.length < 2) {
          reject(new Error('Excel 文件至少需要包含表头和数据行'));
          return;
        }

        const header = rows[0] as string[];
        const nameIndex = header.findIndex(h => h.includes('品类') || h.includes('名称'));
        
        if (nameIndex === -1) {
          reject(new Error('未找到品类名称列'));
          return;
        }

        // 查找属性列（属性名称和属性选项成对出现）
        // 支持任意数量的属性列对，用户可以自行添加属性名称4、属性选项4等
        // 支持的格式：
        // - 属性名称1、属性选项1
        // - 属性名称2、属性选项2
        // - 属性1名称、属性1选项
        // - 等等
        const attributePairs: Array<{ nameIndex: number; optionsIndex: number }> = [];
        const processedIndices = new Set<number>();
        
        for (let i = 0; i < header.length; i++) {
          if (i === nameIndex || processedIndices.has(i)) continue;
          
          const headerName = String(header[i] || '').trim();
          if (!headerName) continue;
          
          // 检查是否是属性名称列（包含"属性"和"名称"，但不包含"品类"）
          const isAttributeNameColumn = 
            !headerName.includes('品类') && 
            headerName.includes('属性') && 
            headerName.includes('名称');
          
          if (isAttributeNameColumn) {
            // 查找对应的属性选项列（下一列）
            if (i + 1 < header.length && !processedIndices.has(i + 1)) {
              const nextHeaderName = String(header[i + 1] || '').trim();
              // 检查下一列是否是属性选项列（包含"属性"和"选项"，但不包含"品类"）
              const isAttributeOptionsColumn = 
                nextHeaderName && 
                !nextHeaderName.includes('品类') &&
                nextHeaderName.includes('属性') &&
                nextHeaderName.includes('选项');
              
              if (isAttributeOptionsColumn) {
                attributePairs.push({ nameIndex: i, optionsIndex: i + 1 });
                processedIndices.add(i);
                processedIndices.add(i + 1);
              }
            }
          }
        }

        const result: CategoryImportRow[] = [];
        
        // 从第二行开始解析数据（跳过表头）
        // 跳过最后一行说明（如果第一列包含"说明"关键词）
        const lastRowIndex = rows.length - 1;
        const shouldSkipLastRow = lastRowIndex >= 1 && 
          String(rows[lastRowIndex]?.[nameIndex] || '').trim().includes('说明');
        
        for (let i = 1; i < rows.length; i++) {
          // 跳过最后一行说明
          if (shouldSkipLastRow && i === lastRowIndex) continue;
          
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          const name = String(row[nameIndex] || '').trim();
          // 跳过空行和说明行
          if (!name || name.includes('说明')) continue;

          const attributes: Array<{ name: string; options: string[] }> = [];
          
          attributePairs.forEach(pair => {
            const attrName = String(row[pair.nameIndex] || '').trim();
            const attrOptionsStr = String(row[pair.optionsIndex] || '').trim();
            
            if (attrName) {
              const options = attrOptionsStr
                ? attrOptionsStr.split(',').map(opt => opt.trim()).filter(opt => opt)
                : [];
              attributes.push({ name: attrName, options });
            }
          });

          if (attributes.length === 0) {
            reject(new Error(`第 ${i + 1} 行：至少需要定义一个属性`));
            return;
          }

          result.push({ name, attributes });
        }

        if (result.length === 0) {
          reject(new Error('Excel 文件中没有有效的数据行'));
          return;
        }

        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('读取文件失败'));
    };

    reader.readAsArrayBuffer(file);
  });
};

