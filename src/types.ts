export interface Product {
  barcode: string;
  name: string;
  category: string;
  prices: {
    elnene: number;
    eltrebol: number;
    eltrebol_suc2: number;
  };
}

export interface Promo {
  description: string;
  eligibleBarcodes: string[];
}

export interface Store {
  id: 'elnene' | 'eltrebol' | 'eltrebol_suc2';
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
