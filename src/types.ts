export interface AttributeDefinition {
  name: string;
  options: string[]; // Array of allowed values. If empty, allows free text.
}

export interface Category {
  id?: number;
  name: string;
  attributes: AttributeDefinition[]; // Changed from string[] to detailed definitions
}

export interface Warehouse {
  id?: number;
  name: string;
}

export interface InventoryItem {
  id?: number;
  warehouse_id: number; // Changed from warehouseId to warehouse_id for API consistency
  category_id: number; // Changed from categoryId to category_id
  // Dynamic attributes stored as key-value pairs (e.g., { "Length": "3m", "Type": "OM3" })
  specs: Record<string, string>; 
  quantity: number;
  updated_at: string; // Changed from Date to string (ISO format from API)
}

export interface Transaction {
  id?: number;
  warehouse_id: number; // The warehouse where the action occurred (or source for transfer)
  related_warehouse_id?: number; // Target warehouse for transfers
  item_id: number; // Changed from itemId to item_id
  item_name_snapshot: string; // To keep record even if item is deleted
  quantity: number; // Negative for outbound, Positive for inbound/transfer-in
  date: string; // Changed from Date to string (ISO format from API)
  user: string;
  notes: string;
  type: 'IN' | 'OUT' | 'ADJUST' | 'TRANSFER';
}

// Helper type for joining tables
export interface InventoryItemWithCategory extends InventoryItem {
  category_name: string;
}

