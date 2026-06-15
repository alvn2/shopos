export enum UserRole {
  ADMIN = 'admin',
  COUNTER = 'counter',
  WORKER = 'worker'
}

export interface User {
  username: string;
  shop_id?: string;
  password_hash?: string;  // For local storage (mock)
  role: UserRole;
  full_name: string;
  created_at?: string;
  last_login?: string | null;
  is_active?: boolean;
}

export interface Session {
  session_id: string;
  username: string;
  device_info: string;
  ip_address: string;
  created_at: string;
  last_active: string;
  expires_at: string;
  is_current?: boolean; // Helper for UI
}

export type PartMake = string; // Allows arbitrary company/brand names like "MK", "Taiho", etc.

export interface InventoryItem {
  uuid: string;
  part_number: string;
  name: string;
  tags: string; // comma-separated
  make: PartMake;
  aed_buying_price: number;
  ksh_buying_price: number; // Optional direct KSH buying price
  selling_price: number;
  stock_qty: number;
  min_stock: number;
  last_updated: string;
  updated_by: string;
}

export interface CartItem extends InventoryItem {
  cartQty: number;
}

export interface SaleRecord {
  date: string;
  batch_id: string;
  items_json: string;
  total_kes: number;
  payment_method: 'Cash' | 'M-Pesa' | 'Credit';
  customer_name?: string;
  customer_id?: string;
  notes?: string;
  sold_by: string;
  discount_type?: 'percent' | 'fixed';
  discount_value?: number;
  discount_amount?: number;
  payments?: Array<{ method: string; amount: number }>;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  total_purchases: number;
  total_credit: number;
  created_at: string;
  created_by: string;
}

export interface CustomerLedgerEntry {
  id: string;
  customer_id: string;
  type: 'purchase' | 'payment' | 'credit';
  amount: number;
  balance: number;
  reference: string;
  date: string;
  recorded_by: string;
}

export interface Settings {
  aed_rate: number;           // KES per 1 AED (e.g., 36.5)
  conversion_percent: number; // Import/overhead percentage (e.g., 13)
  default_min_stock: number;
}

export interface LoginResponse {
  session_id: string;
  user: User;
}

export interface AuthState {
  user: User | null;
  session_id: string | null;
  isAuthenticated: boolean;
}