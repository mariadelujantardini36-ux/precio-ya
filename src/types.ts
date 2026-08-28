export interface Product {
  barcode: string;
  name: string;
  category: string;
  prices: Record<string, number>;
}

export interface Promo {
  description: string;
  eligibleBarcodes: string[];
}

export interface Store {
  id: string;
  name: string;
  sheetId: string;
  sheetName: string;
  promos: Promo[];
}

export interface CartItem {
  barcode: string;
  quantity: number;
}

export interface ScannedItem {
  barcode: string;
  timestamp: string;
}
