import React, { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { 
  Barcode, 
  ShoppingCart, 
  Tag, 
  RotateCcw, 
  Plus, 
  Minus, 
  Trash2, 
  FileSpreadsheet, 
  Search, 
  Sparkles, 
  Clock, 
  Info, 
  Check, 
  PlusCircle, 
  CheckCircle, 
  Database, 
  Volume2, 
  ArrowRightLeft,
  Store as StoreIcon,
  HelpCircle,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Product, CartItem, Store, ScannedItem } from "./types";
import { STORES_CONFIG, StoreConfigEntry } from "./stores.config";
import { getStoreColor } from "./storeColors";

const DEFAULT_PRODUCTS: Product[] = [
  {
    barcode: "7790940133318",
    name: "Terma Serrano x 1,35lt",
    category: "Bebidas",
    prices: { elnene: 1900, eltrebol: 1850, eltrebol_suc2: 1500 }
  },
  {
    barcode: "7792012000392",
    name: "Aceite San Vicente x 900ml",
    category: "Almacén",
    prices: { elnene: 2200, eltrebol: 3500, eltrebol_suc2: 2200 }
  },
  {
    barcode: "7791709025036",
    name: "Café La Morenita x 250g",
    category: "Almacén",
    prices: { elnene: 3800, eltrebol: 4100, eltrebol_suc2: 3100 }
  },
  {
    barcode: "7790070318458",
    name: "Pimentón Dulce Alicante 25g",
    category: "Condimentos",
    prices: { elnene: 950, eltrebol: 850, eltrebol_suc2: 950 }
  },
  {
    barcode: "7790150445365",
    name: "Chimichurri Alicante 25g",
    category: "Condimentos",
    prices: { elnene: 980, eltrebol: 1050, eltrebol_suc2: 950 }
  }
];

const STORES: Record<string, StoreConfigEntry> = STORES_CONFIG.reduce((acc, store) => {
  acc[store.id] = store;
  return acc;
}, {} as Record<string, StoreConfigEntry>);

/**
 * Reads live data from Google Sheets via GViz API endpoint (/gviz/tq?tqx=out:json)
 * using cache-busting timestamp parameters to eliminate stale cache.
 * Loops dynamically over every supermarket configured en stores.config.ts,
 * sin importar cuántos sean.
 */
export async function fetchLiveProductsFromGoogleSheets(): Promise<{ products: Product[]; lastSync: string }> {
  const storeMap = STORES_CONFIG.map(store => ({ key: store.id, name: store.name, sheetId: store.sheetId }));

  const productDict: Record<string, Product> = {};

  await Promise.all(
    storeMap.map(async (store) => {
      try {
        const url = `https://docs.google.com/spreadsheets/d/${store.sheetId}/gviz/tq?tqx=out:json&headers=1&t=${Date.now()}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;

        const text = await res.text();
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1) return;

        const jsonStr = text.substring(jsonStart, jsonEnd + 1);
        const data = JSON.parse(jsonStr);

        if (!data.table || !data.table.rows) return;

        const cols: Array<{ label?: string }> = data.table.cols || [];
        let codeIdx = cols.findIndex(c => c?.label?.toLowerCase().includes('cod'));
        let nameIdx = cols.findIndex(c => c?.label?.toLowerCase().includes('prod') || c?.label?.toLowerCase().includes('nom') || c?.label?.toLowerCase().includes('desc'));
        let priceIdx = cols.findIndex(c => c?.label?.toLowerCase().includes('prec') || c?.label?.toLowerCase().includes('val') || c?.label?.toLowerCase().includes('$'));
        let catIdx = cols.findIndex(c => c?.label?.toLowerCase().includes('cat') || c?.label?.toLowerCase().includes('rub'));

        if (codeIdx === -1) codeIdx = 0;
        if (nameIdx === -1) nameIdx = 1;
        if (priceIdx === -1) priceIdx = 2;
        if (catIdx === -1) catIdx = 3;

        for (const row of data.table.rows) {
          if (!row || !row.c) continue;
          const cells = row.c;

          const rawCode = cells[codeIdx]?.f ?? cells[codeIdx]?.v;
          if (rawCode === null || rawCode === undefined || String(rawCode).trim() === '') continue;

          const barcode = String(rawCode).trim();
          const rawName = cells[nameIdx]?.v ?? cells[nameIdx]?.f;
          const name = rawName ? String(rawName).trim() : `Producto ${barcode}`;
          if (!name) continue;

          const rawPrice = cells[priceIdx]?.v ?? cells[priceIdx]?.f;
          let price = 0;
          if (typeof rawPrice === 'number') {
            price = rawPrice;
          } else if (typeof rawPrice === 'string') {
            const cleaned = rawPrice.replace(/[^0-9.,]/g, '').replace(',', '.');
            price = parseFloat(cleaned) || 0;
          }

          const rawCat = cells[catIdx]?.v ?? cells[catIdx]?.f;
          const category = rawCat ? String(rawCat).trim() : 'Almacén';

          const dictKey = barcode.toLowerCase();

          if (!productDict[dictKey]) {
            productDict[dictKey] = {
              barcode,
              name,
              category,
              prices: Object.fromEntries(STORES_CONFIG.map(s => [s.id, 0]))
            };
          }

          productDict[dictKey].prices[store.key] = price;

          if (name && (!productDict[dictKey].name || productDict[dictKey].name.startsWith('Producto '))) {
            productDict[dictKey].name = name;
          }
          if (category && category !== 'Almacén') {
            productDict[dictKey].category = category;
          }
        }
      } catch (err) {
        console.error(`Error fetching sheet for ${store.name}:`, err);
      }
    })
  );

  const resultList = Object.values(productDict).map(prod => {
    const validPrices = Object.values(prod.prices).filter(p => p > 0);
    const avgPrice = validPrices.length > 0 ? Math.round(validPrices.reduce((a, b) => a + b, 0) / validPrices.length) : 1000;

    const filledPrices: Record<string, number> = {};
    STORES_CONFIG.forEach(s => {
      const val = prod.prices[s.id] || 0;
      filledPrices[s.id] = val > 0 ? val : avgPrice;
    });

    return { ...prod, prices: filledPrices };
  });

  const now = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return { products: resultList, lastSync: now };
}

interface Toast {
  id: string;
  title: string;
  description: string;
  type: 'success' | 'info' | 'error' | 'promo';
}

export default function App() {
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem("precioya_products");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Product[];
        const merged = [...parsed];
        DEFAULT_PRODUCTS.forEach(defProd => {
          if (!merged.some(p => p.barcode === defProd.barcode)) {
            merged.push(defProd);
          }
        });
        return merged;
      } catch (e) {
        return DEFAULT_PRODUCTS;
      }
    }
    return DEFAULT_PRODUCTS;
  });

  const [activeStoreId, setActiveStoreId] = useState<string>(STORES_CONFIG[0]?.id || "elnene");
    const [activeTab, setActiveTab] = useState<'consultar' | 'db'>("consultar");
  const [dbUnlocked, setDbUnlocked] = useState<boolean>(false);
  const ADMIN_PIN = "198228";
  const [barcodeInput, setBarcodeInput] = useState<string>("");
  const [scannedBarcode, setScannedBarcode] = useState<string>("");
  const [recentlyScanned, setRecentlyScanned] = useState<ScannedItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem("precioya_cart");
    return saved ? JSON.parse(saved) : [];
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Live Google Sheets synchronization states
  const [isSyncingSheets, setIsSyncingSheets] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const syncLiveFromGoogleSheets = async (showToast = true) => {
    setIsSyncingSheets(true);
    setSyncError(null);
    try {
      const { products: fetchedProducts, lastSync } = await fetchLiveProductsFromGoogleSheets();
      if (fetchedProducts.length > 0) {
        setProducts(fetchedProducts);
        setLastSyncTime(lastSync);
        if (showToast) {
          addToast("Sincronización en Vivo", `Cargados ${fetchedProducts.length} productos directamente desde Google Sheets (${lastSync})`, "success");
        }
      } else {
        if (showToast) {
          addToast("Aviso de Sincronización", "No se encontraron datos en las planillas de Google Sheets.", "info");
        }
      }
    } catch (err) {
      console.error("Error al sincronizar Google Sheets:", err);
      setSyncError("Error de conexión al cargar planillas.");
      if (showToast) {
        addToast("Error de Sincronización", "No se pudieron obtener los datos de Google Sheets.", "error");
      }
    } finally {
      setIsSyncingSheets(false);
    }
  };

  // Auto-sync real-time data on application startup
  useEffect(() => {
    syncLiveFromGoogleSheets(false);
  }, []);

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Real Camera Scanner States and References
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScanTimeRef = useRef<number>(0);

  // Manage camera scanning lifecycle
  useEffect(() => {
    let isMounted = true;
    let html5QrCode: Html5Qrcode | null = null;

    if (cameraActive) {
      setCameraError(null);
      // Wait a brief tick for the container #camera-reader to be fully rendered
      const timer = setTimeout(() => {
        if (!isMounted) return;
        try {
          html5QrCode = new Html5Qrcode("camera-reader");
          html5QrCodeRef.current = html5QrCode;

          html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: (width, height) => {
                const minSize = Math.min(width, height);
                return {
                  width: Math.floor(minSize * 0.75),
                  height: Math.floor(minSize * 0.75)
                };
              }
            },
            (decodedText) => {
              const now = Date.now();
              if (now - lastScanTimeRef.current > 2000) {
                lastScanTimeRef.current = now;
                handleBarcodeSearch(decodedText);
              }
            },
            () => {
              // Ignore standard scanning frame errors
            }
          ).catch(err => {
            if (isMounted) {
              console.error("Error starting camera", err);
              setCameraError("No se pudo iniciar la cámara. Verificá que concediste los permisos e intentalo de nuevo.");
              setCameraActive(false);
            }
          });
        } catch (err) {
          if (isMounted) {
            console.error("Failed to initialize Html5Qrcode", err);
            setCameraError("Error al inicializar el componente de cámara.");
            setCameraActive(false);
          }
        }
      }, 250);

      return () => {
        clearTimeout(timer);
        isMounted = false;
        if (html5QrCode) {
          if (html5QrCode.isScanning) {
            html5QrCode.stop().catch(err => console.error("Error stopping on cleanup", err));
          }
        }
      };
    }
  }, [cameraActive]);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem("precioya_products", JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem("precioya_cart", JSON.stringify(cart));
  }, [cart]);

  // Audio Beep function
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(1600, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      console.log("Audio not supported or blocked", e);
    }
  };

  const addToast = (title: string, description: string, type: 'success' | 'info' | 'error' | 'promo' = 'success') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, title, description, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const handleStoreChange = (storeId: string) => {
    setActiveStoreId(storeId);
    playBeep();
    setIsScanning(true);
    setTimeout(() => setIsScanning(false), 400);
    addToast("Supermercado Cambiado", `Ahora viendo precios de ${STORES[storeId].name}`, "info");
  };

  const pressKey = (key: string) => {
    setBarcodeInput(prev => prev + key);
  };

  const clearInput = () => {
    setBarcodeInput("");
  };

  const backspaceInput = () => {
    setBarcodeInput(prev => prev.slice(0, -1));
  };

  // Flexible search helper to locate a product in the global database by barcode or name
  const findProductInDatabase = (query: string, productsList: Product[] = products): Product | undefined => {
    if (!query) return undefined;
    const rawQuery = String(query).trim();
    const cleanQuery = rawQuery.toLowerCase();
    if (!cleanQuery) return undefined;

    // 1. Exact string match on barcode
    let found = productsList.find(p => String(p.barcode).trim().toLowerCase() === cleanQuery);
    if (found) return found;

    // 2. Ignore leading zeros (e.g. "0779..." vs "779...")
    const queryNoZeros = cleanQuery.replace(/^0+/, "");
    if (queryNoZeros) {
      found = productsList.find(p => {
        const pCodeNoZeros = String(p.barcode).trim().toLowerCase().replace(/^0+/, "");
        return pCodeNoZeros === queryNoZeros;
      });
      if (found) return found;
    }

    // 3. Numeric match if both query and barcode are numeric digits
    if (/^\d+$/.test(rawQuery)) {
      found = productsList.find(p => {
        const pCode = String(p.barcode).trim();
        if (/^\d+$/.test(pCode)) {
          try {
            return BigInt(pCode) === BigInt(rawQuery);
          } catch {
            return Number(pCode) === Number(rawQuery);
          }
        }
        return false;
      });
      if (found) return found;
    }

    // 4. Substring barcode match
    found = productsList.find(p => String(p.barcode).toLowerCase().includes(cleanQuery));
    if (found) return found;

    // 5. Product name match (case-insensitive substring)
    found = productsList.find(p => p.name.toLowerCase().includes(cleanQuery));
    if (found) return found;

    return undefined;
  };

  const handleBarcodeSearch = (codeToSearch?: string) => {
    const query = (codeToSearch || barcodeInput).trim();
    if (!query) return;

    // Trigger scanning effect
    setIsScanning(true);
    playBeep();
    setTimeout(() => setIsScanning(false), 500);

    const product = findProductInDatabase(query, products);
    if (product) {
      setScannedBarcode(product.barcode);
      // Add to recently scanned list using canonical product barcode
      setRecentlyScanned(prev => {
        const filtered = prev.filter(item => String(item.barcode).trim().toLowerCase() !== String(product.barcode).trim().toLowerCase());
        const newItem: ScannedItem = {
          barcode: product.barcode,
          timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
        return [newItem, ...filtered].slice(0, 4);
      });
      addToast("Producto Escaneado", product.name, "success");
    } else {
      addToast("Código No Encontrado", `"${query}" no coincide con ningún producto en la Base de Datos.`, "error");
    }
    setBarcodeInput("");
  };

  const handleSimulatedScan = (code: string) => {
    handleBarcodeSearch(code);
  };

  const addToCart = (barcode: string) => {
    const product = findProductInDatabase(barcode, products);
    const targetBarcode = product ? product.barcode : barcode;

    setCart(prev => {
      const existing = prev.find(item => String(item.barcode).trim().toLowerCase() === String(targetBarcode).trim().toLowerCase());
      if (existing) {
        return prev.map(item => String(item.barcode).trim().toLowerCase() === String(targetBarcode).trim().toLowerCase() ? { ...item, quantity: item.quantity + 1 } : item);
      } else {
        return [...prev, { barcode: targetBarcode, quantity: 1 }];
      }
    });
    if (product) {
      addToast("Agregado al Carrito", `${product.name} sumado.`, "success");
      playBeep();
    }
  };

  const updateCartQty = (barcode: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.barcode === barcode) {
          const newQty = item.quantity + delta;
          return newQty <= 0 ? null : { ...item, quantity: newQty };
        }
        return item;
      }).filter((item): item is CartItem => item !== null);
    });
    playBeep();
  };

  const clearCart = () => {
    setCart([]);
    addToast("Carrito Vaciado", "Se eliminaron todos los productos de tu carrito.", "info");
    playBeep();
  };

  // Restores default values
  const resetToDefaults = () => {
    if (window.confirm("¿Seguro que deseas restablecer todos los productos y precios de la base de datos a sus valores iniciales?")) {
      setProducts(DEFAULT_PRODUCTS);
      localStorage.removeItem("precioya_products");
      addToast("Base de Datos Restablecida", "Valores por defecto cargados con éxito.", "info");
      playBeep();
    }
  };

  // Calculations for current cart
  const currentScannedProduct = findProductInDatabase(scannedBarcode, products);

  // Promotional discount calculator
  const calculateCartSummary = () => {
    let subtotal = 0;
    let discount = 0;
    const promoBreakdown: { name: string; amount: number }[] = [];

    // Map cart items with active prices
    const itemsWithPrices = cart.map(item => {
      const product = findProductInDatabase(item.barcode, products);
      const price = product ? (product.prices[activeStoreId] || 0) : 0;
      return {
        ...item,
        name: product ? product.name : "Producto Desconocido",
        category: product ? product.category : "General",
        price,
        itemTotal: price * item.quantity
      };
    });

    // Subtotal
    subtotal = itemsWithPrices.reduce((sum, item) => sum + item.itemTotal, 0);

    // Apply store promotions
    if (activeStoreId === "elnene") {
      // 10% OFF en Fideos Tallarín ("7790840110105") llevando 2 o más
      const tallarinItem = itemsWithPrices.find(item => item.barcode === "7790840110105");
      if (tallarinItem && tallarinItem.quantity >= 2) {
        const itemDiscount = tallarinItem.itemTotal * 0.1;
        discount += itemDiscount;
        promoBreakdown.push({
          name: "10% OFF Fideos Tallarín (Súper El Nene)",
          amount: itemDiscount
        });
      }
    } else if (activeStoreId === "eltrebol") {
      // 2x1 en Condimentos Alicante (Pimentón "7790070318458" y Chimichurri "7798159445365")
      // We calculate per product basis
      const pimentonItem = itemsWithPrices.find(item => item.barcode === "7790070318458");
      if (pimentonItem && pimentonItem.quantity >= 2) {
        const freeItems = Math.floor(pimentonItem.quantity / 2);
        const itemDiscount = freeItems * pimentonItem.price;
        discount += itemDiscount;
        promoBreakdown.push({
          name: "2x1 Pimentón Dulce (Súper El Trébol)",
          amount: itemDiscount
        });
      }

      const chimichurriItem = itemsWithPrices.find(item => item.barcode === "7798159445365");
      if (chimichurriItem && chimichurriItem.quantity >= 2) {
        const freeItems = Math.floor(chimichurriItem.quantity / 2);
        const itemDiscount = freeItems * chimichurriItem.price;
        discount += itemDiscount;
        promoBreakdown.push({
          name: "2x1 Chimichurri (Súper El Trébol)",
          amount: itemDiscount
        });
      }
    } else if (activeStoreId === "eltrebol_suc2") {
      // 5% OFF en Pimentón Dulce ("7790070318458") llevando 3 o más
      const pimentonItem = itemsWithPrices.find(item => item.barcode === "7790070318458");
      if (pimentonItem && pimentonItem.quantity >= 3) {
        const itemDiscount = pimentonItem.itemTotal * 0.05;
        discount += itemDiscount;
        promoBreakdown.push({
          name: "5% OFF Pimentón x Cantidad (Súper Avenida)",
          amount: itemDiscount
        });
      }
    }

    const total = Math.max(0, subtotal - discount);

    return {
      items: itemsWithPrices,
      subtotal,
      discount,
      total,
      promoBreakdown
    };
  };

  const cartSummary = calculateCartSummary();

  // Suggested alternatives of the same category
  const suggestedAlternatives = currentScannedProduct
    ? products.filter(p => p.category === currentScannedProduct.category && p.barcode !== currentScannedProduct.barcode)
    : [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans select-none antialiased">
      
      {/* SIMULADOR QR BARRA SUPERIOR */}
      <div className="bg-slate-900 border-b border-slate-800 text-white py-3 px-4 shadow-xl sticky top-0 z-50 transition-all">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div className="flex flex-col">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Simulador de Códigos QR Físicos</p>
              <p className="text-[10px] text-slate-500">Simulá apuntar la cámara al código QR de cada supermercado en la góndola</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 justify-center">
            {STORES_CONFIG.map(store => {
              const colors = getStoreColor(store.color);
              const isActive = activeStoreId === store.id;
              return (
                <button
                  key={store.id}
                  id={`btn-${store.id}`}
                  onClick={() => handleStoreChange(store.id)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-1.5 shadow-sm border ${
                    isActive
                      ? colors.badgeActive
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${colors.dot}`}></span>
                  QR {store.name}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            {/* Sound Toggle */}
            <button 
              onClick={() => setSoundEnabled(!soundEnabled)} 
              title={soundEnabled ? "Silenciar lector" : "Activar bip"}
              className={`p-1.5 rounded-lg border transition-all ${soundEnabled ? 'text-emerald-400 border-slate-700 bg-slate-800 hover:bg-slate-700' : 'text-slate-500 border-slate-800 bg-slate-950'}`}
            >
              <Volume2 className="w-4 h-4" />
            </button>
            
            <div className="text-[10px] font-mono text-slate-400 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-1">
              <span>Parámetro local:</span>
              <span id="url-simulada" className="text-emerald-400 font-bold">?local={activeStoreId}</span>
            </div>
          </div>
        </div>
      </div>

      {/* BANNER DE BIENVENIDA */}
      <div className="bg-emerald-50/70 border-b border-emerald-200/50 py-3.5 px-4 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex gap-3.5 items-start">
          <div className="bg-emerald-600 text-white p-2 rounded-xl shrink-0 shadow-md">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-bold text-emerald-900 tracking-tight uppercase">¡Carrito Multi-Supermercado en Vivo! 🛒</h4>
            <p className="text-xs text-emerald-800 leading-relaxed mt-0.5">
              Cambiá de supermercado arriba mediante los botones QR y mirá cómo el carrito se recalcula en un milisegundo utilizando los precios reales del local activo. ¡Compará precios y ahorrá dinero en tiempo real!
            </p>
          </div>
        </div>
      </div>

      {/* CABECERA PRINCIPAL */}
      <header className="bg-white border-b border-slate-150 py-4 px-6 shadow-sm sticky top-14 md:top-14 z-40 transition-all">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="bg-emerald-600 text-white p-3 rounded-2xl shadow-lg shadow-emerald-600/20">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
                Precio Ya <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">v4.0</span>
              </h1>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Lector de Góndola & Comparador Inteligente</p>
            </div>
          </div>
          
          {/* TABS DE SECCIÓN Y BOTÓN SINCRONIZAR */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => syncLiveFromGoogleSheets(true)}
              disabled={isSyncingSheets}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-60 text-white font-bold py-2 px-3.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 shrink-0"
              title="Cargar productos en tiempo real desde Google Sheets"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheets ? 'animate-spin' : ''}`} />
              <span>{isSyncingSheets ? 'Sincronizando...' : 'Actualizar Sheets'}</span>
            </button>

            <div className="bg-slate-100 p-1 rounded-xl flex border border-slate-200 w-full sm:w-auto">
              <button 
                id="tab-consultar"
                onClick={() => setActiveTab('consultar')} 
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'consultar' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Barcode className="w-3.5 h-3.5 text-emerald-600" />
                Consultar Góndola
              </button>
              <button 
                id="tab-db"
                               onClick={() => {
                  if (dbUnlocked) {
                    setActiveTab('db');
                    return;
                  }
                  const pin = window.prompt("Ingresá el PIN de administrador para ver la Base de Datos:");
                  if (pin === null) return;
                  if (pin.trim() === ADMIN_PIN) {
                    setDbUnlocked(true);
                    setActiveTab('db');
                    addToast("Acceso Autorizado", "Base de Datos desbloqueada.", "success");
                  } else {
                    addToast("PIN Incorrecto", "No tenés permiso para ver la Base de Datos.", "error");
                  }
                }}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'db' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                Base de Datos ({products.length})
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* TOAST SYSTEM CONTAINER */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className={`p-3.5 rounded-2xl shadow-xl border flex gap-2.5 items-start pointer-events-auto w-80 text-white ${
                toast.type === 'success' ? 'bg-emerald-700 border-emerald-600' :
                toast.type === 'error' ? 'bg-rose-700 border-rose-600' :
                toast.type === 'promo' ? 'bg-amber-600 border-amber-500' :
                'bg-slate-800 border-slate-700'
              }`}
            >
              <div className="mt-0.5">
                {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-300 shrink-0" />}
                {toast.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />}
                {toast.type === 'promo' && <Tag className="w-4 h-4 text-amber-200 shrink-0" />}
                {toast.type === 'info' && <Info className="w-4 h-4 text-sky-300 shrink-0" />}
              </div>
              <div className="flex-1">
                <p className="font-bold text-xs leading-tight">{toast.title}</p>
                <p className="text-[11px] text-white/80 leading-normal mt-0.5">{toast.description}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col gap-6">
        
        {/* VISTA CONSULTAR GÓNDOLA */}
        {activeTab === "consultar" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
            
            {/* COLUMNA IZQUIERDA: LECTOR, RESULTADO Y NUMPAD */}
            <section className="lg:col-span-4 flex flex-col gap-6">
              
              {/* LECTOR DE BARRAS INTERACTIVO */}
              <div className="bg-slate-950 text-slate-100 rounded-3xl p-5 flex flex-col items-center justify-center relative overflow-hidden h-auto min-h-44 shadow-lg border border-slate-800">
                <span className="absolute top-3 left-3 text-[9px] font-mono text-emerald-500 uppercase tracking-widest flex items-center gap-1.5 font-bold z-10">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  {cameraActive ? "Cámara Escáner Activa" : "Lector En Línea"}
                </span>
                
                {/* Simulated laser lines */}
                {!cameraActive && (
                  <div className={`absolute left-0 right-0 h-0.5 bg-rose-600/70 shadow-[0_0_8px_rgba(239,68,68,0.8)] transition-all ${
                    isScanning ? 'top-1/2 scale-y-[4] bg-emerald-500/80 shadow-[0_0_12px_rgba(16,185,129,0.9)]' : 'top-1/3 animate-bounce'
                  }`} />
                )}

                <button 
                  onClick={playBeep}
                  title="Escuchar sonido" 
                  className="absolute top-3 right-3 text-slate-500 hover:text-slate-300 p-1 hover:bg-slate-900 rounded-lg transition-all z-10"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                
                {cameraActive ? (
                  <div className="w-full flex flex-col items-center gap-3 mt-6">
                    {/* Camera view container */}
                    <div className="w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 aspect-video relative max-w-[280px]">
                      <div id="camera-reader" className="w-full h-full"></div>
                      <div className="absolute inset-0 border-2 border-emerald-500/30 pointer-events-none rounded-2xl"></div>
                      <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-emerald-400 animate-pulse pointer-events-none shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                    </div>
                    
                    <button
                      onClick={() => setCameraActive(false)}
                      className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold py-1.5 px-4 rounded-xl text-xs transition-all flex items-center gap-1 shadow-md shadow-rose-600/20"
                    >
                      Detener Cámara
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2.5 mt-2 w-full text-center">
                    <Barcode className={`w-14 h-14 text-slate-400 transition-all ${isScanning ? 'text-emerald-400 scale-110' : ''}`} />
                    <div className="text-center px-2">
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Ingresá un código manual o tocá los botones del banco de pruebas a continuación.
                      </p>
                    </div>

                    <button
                      onClick={() => setCameraActive(true)}
                      className="mt-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-2 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 w-full max-w-[220px]"
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-350 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                      </span>
                      Activar Cámara Real
                    </button>
                  </div>
                )}

                {cameraError && (
                  <div className="absolute bottom-2 left-2 right-2 bg-rose-950/90 text-rose-200 border border-rose-800 rounded-xl p-2 text-[10px] text-center z-10 font-medium">
                    {cameraError}
                  </div>
                )}
              </div>

              {/* RESULTADO DE ESCANEO / ÚLTIMO ESCANEO EXITOSO */}
              <div id="panel-resultados" className="flex flex-col gap-6">
                {!currentScannedProduct ? (
                  <div id="result-empty" className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex-grow flex flex-col items-center justify-center text-center gap-4 min-h-[220px]">
                    <div className="bg-slate-50 p-4 rounded-full border border-slate-100 text-slate-400">
                      <Barcode className="w-10 h-10 animate-pulse" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-800">Lector listo para escanear</h2>
                      <p className="text-xs text-slate-400 mt-1 max-w-[240px] mx-auto">
                        Presioná un producto al lado en el banco de pruebas, o ingresá un código en el teclado numérico.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* TARJETA DE PRODUCTO ESCANEADO */
                  <div id="result-card" className="bg-white rounded-3xl p-5 border border-emerald-100 shadow-md flex flex-col gap-5">
                    
                    <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-[9px] text-emerald-600 uppercase tracking-widest font-extrabold flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-emerald-500" />
                          Último Escaneo Exitoso
                        </span>
                        <h2 id="scanned-name" className="text-base font-extrabold text-slate-800 mt-0.5 leading-tight">
                          {currentScannedProduct.name}
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                          <span id="scanned-code" className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                            Cód: {currentScannedProduct.barcode}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold">
                            ({currentScannedProduct.category})
                          </span>
                        </div>
                      </div>
                      <div className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm border border-emerald-200 uppercase shrink-0">
                        {STORES[activeStoreId].name}
                      </div>
                    </div>

                    {/* PRECIO PRINCIPAL DEL LOCAL SELECCIONADO */}
                    <div className="bg-gradient-to-br from-amber-50 to-amber-100/60 border border-amber-200/50 rounded-2xl p-4 flex justify-between items-center shadow-inner">
                      <div>
                        <span className="text-[10px] text-amber-800 uppercase font-bold tracking-wider block">Precio de Góndola Activa</span>
                        <span id="scanned-price" className="text-3xl font-black text-amber-950 tracking-tight block">
                          ${(currentScannedProduct.prices[activeStoreId] || 0).toLocaleString('es-AR')}
                        </span>
                      </div>
                      <div className="bg-amber-400/95 text-amber-950 font-black px-3.5 py-2 rounded-xl text-xs tracking-wider shadow">
                        ARS $
                      </div>
                    </div>

                    {/* COMPARADOR DE PRECIOS CON OTROS LOCALES */}
                    <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-150">
                      <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest block mb-2 flex items-center gap-1.5">
                        <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" />
                        Comparador instantáneo de Góndola
                      </span>
                      
                      <div className="flex flex-col gap-2">
                        {Object.entries(STORES).map(([key, store]) => {
                          const storeKey = key;
                          const price = currentScannedProduct.prices[storeKey] || 0;
                          const isActive = activeStoreId === storeKey;
                          const dotColor = getStoreColor(store.color).dot;
                          
                          // Calculate price diff compared to active store
                          const activePrice = currentScannedProduct.prices[activeStoreId] || 0;
                          const isCheaper = price < activePrice;
                          const isMoreExpensive = price > activePrice;
                          const pctDiff = activePrice > 0 ? ((price - activePrice) / activePrice) * 100 : 0;

                          return (
                            <div 
                              key={key} 
                              onClick={() => handleStoreChange(storeKey)}
                              className={`p-2 rounded-xl flex justify-between items-center text-xs cursor-pointer transition-all ${
                                isActive 
                                  ? 'bg-white border-2 border-emerald-500 shadow-sm' 
                                  : 'bg-slate-100/50 border border-slate-150 hover:bg-slate-100'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                                <span className={`font-semibold ${isActive ? 'text-emerald-950 font-bold' : 'text-slate-600'}`}>
                                  {store.name}
                                </span>
                                {isActive && <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full">Activo</span>}
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 font-mono">
                                  ${price.toLocaleString('es-AR')}
                                </span>
                                {!isActive && (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                                    isCheaper ? 'bg-emerald-100 text-emerald-800' :
                                    isMoreExpensive ? 'bg-rose-100 text-rose-800' :
                                    'bg-slate-100 text-slate-600'
                                  }`}>
                                    {isCheaper && <TrendingDown className="w-3 h-3" />}
                                    {isMoreExpensive && <TrendingUp className="w-3 h-3" />}
                                    {isCheaper ? `-${Math.abs(pctDiff).toFixed(0)}%` : 
                                     isMoreExpensive ? `+${Math.abs(pctDiff).toFixed(0)}%` : 
                                     'Igual'}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* AGREGAR AL CARRITO ACCIÓN */}
                    <button 
                      id="add-to-cart-btn"
                      onClick={() => addToCart(currentScannedProduct.barcode)} 
                      className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold py-3.5 px-4 rounded-2xl shadow-md shadow-emerald-600/10 transition-all flex items-center justify-center gap-2 text-sm uppercase"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Sumar al Carrito de Góndola
                    </button>

                    {/* ALTERNATIVAS SUGERIDAS */}
                    <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
                      <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-spin" style={{ animationDuration: '4s' }} />
                        Alternativas en la Góndola
                      </span>
                      
                      <div id="alternatives-list" className="flex flex-col gap-1.5">
                        {suggestedAlternatives.length === 0 ? (
                          <p className="text-[10px] text-slate-400 italic">No hay alternativas registradas en esta categoría.</p>
                        ) : (
                          suggestedAlternatives.map(alt => (
                            <div 
                              key={alt.barcode}
                              onClick={() => handleSimulatedScan(alt.barcode)}
                              className="flex justify-between items-center bg-slate-50 hover:bg-emerald-50 border border-slate-150 hover:border-emerald-200 p-2.5 rounded-xl cursor-pointer transition-all active:scale-98"
                            >
                              <div className="flex flex-col min-w-0 pr-2">
                                <span className="text-xs font-semibold text-slate-700 truncate">{alt.name}</span>
                                <span className="text-[9px] text-slate-400 font-mono">Cód: {alt.barcode}</span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-xs font-bold text-emerald-700 block">${alt.prices[activeStoreId] || 0}</span>
                                <span className="text-[8px] text-slate-400 block">Escanear</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* TECLADO DE CÓDIGO MANUAL */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Barcode className="w-3.5 h-3.5 text-slate-400" />
                  Escribir Código o Nombre
                </span>
                
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <div className="relative flex-grow">
                      <input 
                        type="text" 
                        id="barcode-input"
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        placeholder="Escribir código o nombre..." 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-10 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-mono"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleBarcodeSearch();
                        }}
                      />
                      {barcodeInput && (
                        <button 
                          onClick={() => setBarcodeInput("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                    
                    <button 
                      onClick={() => handleBarcodeSearch()}
                      className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold px-4 rounded-xl text-xs transition-all flex items-center gap-1 shrink-0 shadow-md shadow-emerald-600/10"
                    >
                      <Search className="w-3.5 h-3.5" />
                      Buscar
                    </button>
                  </div>

                  {/* COINCIDENCIAS EN TIEMPO REAL */}
                  {barcodeInput.trim() && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 max-h-48 overflow-y-auto flex flex-col gap-1 mt-1 shadow-inner">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase px-1">
                        Coincidencias en Base de Datos:
                      </span>
                      {products.filter(p => 
                        String(p.barcode).toLowerCase().includes(barcodeInput.toLowerCase().trim()) ||
                        p.name.toLowerCase().includes(barcodeInput.toLowerCase().trim())
                      ).length === 0 ? (
                        <span className="text-[11px] text-slate-400 italic px-1 py-1">
                          Sin coincidencias en la lista global. Podés presionar "Buscar" para intentar coincidencias numéricas o aproximadas.
                        </span>
                      ) : (
                        products.filter(p => 
                          String(p.barcode).toLowerCase().includes(barcodeInput.toLowerCase().trim()) ||
                          p.name.toLowerCase().includes(barcodeInput.toLowerCase().trim())
                        ).map(p => (
                          <button
                            key={p.barcode}
                            onClick={() => handleBarcodeSearch(p.barcode)}
                            className="flex justify-between items-center text-left p-2 hover:bg-emerald-50 rounded-lg transition-all group border border-transparent hover:border-emerald-200"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="text-xs font-bold text-slate-700 group-hover:text-emerald-800 truncate">{p.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">Cód: {p.barcode} • {p.category}</p>
                            </div>
                            <span className="text-xs font-extrabold text-emerald-600 font-mono shrink-0">
                              ${(p.prices[activeStoreId] || 0).toLocaleString('es-AR')}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* DIGITAL NUMPAD */}
                <div className="grid grid-cols-3 gap-2">
                  {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map(num => (
                    <button 
                      key={num}
                      onClick={() => pressKey(num)} 
                      className="bg-slate-50 hover:bg-slate-100 active:bg-slate-200 py-3 rounded-xl text-sm font-bold text-slate-700 border border-slate-150 transition-all shadow-sm active:scale-95"
                    >
                      {num}
                    </button>
                  ))}
                  <button 
                    onClick={clearInput} 
                    className="bg-rose-50 hover:bg-rose-100 active:bg-rose-200 py-3 rounded-xl text-xs font-bold text-rose-600 border border-rose-100 transition-all active:scale-95"
                  >
                    Borrar Todo
                  </button>
                  <button 
                    onClick={() => pressKey("0")} 
                    className="bg-slate-50 hover:bg-slate-100 active:bg-slate-200 py-3 rounded-xl text-sm font-bold text-slate-700 border border-slate-150 transition-all active:scale-95"
                  >
                    0
                  </button>
                  <button 
                    onClick={backspaceInput} 
                    className="bg-amber-50 hover:bg-amber-100 active:bg-amber-200 py-3 rounded-xl text-sm font-bold text-amber-600 border border-amber-100 transition-all flex justify-center items-center active:scale-95"
                  >
                    <RotateCcw className="w-4 h-4 scale-x-[-1]" />
                  </button>
                </div>
              </div>

            </section>

            {/* COLUMNA CENTRAL: BANCO DE PRUEBAS, OFERTAS E HISTORIAL */}
            <section className="lg:col-span-4 flex flex-col gap-6">
              
              {/* BANCO DE PRUEBAS PRODUCTOS DE BASE DE DATOS */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-600" />
                    Productos de la Base de Datos ({products.length})
                  </h3>
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase">
                    Tocar para Escanear
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Elegí cualquier producto guardado en la tabla de Base de Datos para simular su lectura en el escáner:
                </p>
                <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                  {products.map(prod => (
                    <button
                      key={prod.barcode}
                      onClick={() => handleSimulatedScan(prod.barcode)}
                      className="flex justify-between items-center bg-slate-50 hover:bg-emerald-50 border border-slate-150 hover:border-emerald-200 p-2.5 rounded-xl text-left transition-all active:scale-98 group"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-xs font-bold text-slate-700 group-hover:text-emerald-800 block truncate">{prod.name}</span>
                        <span className="text-[9px] text-slate-400 font-mono">Cód: {prod.barcode} • {prod.category}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-extrabold text-emerald-700 block font-mono">${(prod.prices[activeStoreId] || 0).toLocaleString('es-AR')}</span>
                        <span className="text-[8px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded uppercase">Escanear</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* OFERTAS DEL DÍA */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-amber-500" />
                    Ofertas Activas de Góndola
                  </h3>
                  <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full uppercase">
                    {STORES[activeStoreId].name}
                  </span>
                </div>
                
                <div id="promos-container" className="flex flex-col gap-2">
                  {activeStoreId === "elnene" && (
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 p-3 rounded-xl text-xs font-semibold text-amber-900 flex gap-2.5 items-start">
                      <Sparkles className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-bold text-amber-950">10% de descuento automático</p>
                        <p className="text-amber-800 text-[11px] mt-0.5 font-normal">En Fideos Tallarín Lucchetti llevando 2 o más paquetes.</p>
                      </div>
                    </div>
                  )}
                  {activeStoreId === "eltrebol" && (
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 p-3 rounded-xl text-xs font-semibold text-amber-900 flex gap-2.5 items-start">
                      <Sparkles className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-bold text-amber-950">Beneficio 2x1 Alicante</p>
                        <p className="text-amber-800 text-[11px] mt-0.5 font-normal">Llevás 2 unidades de Pimentón Dulce Alicante o Chimichurri Alicante y pagás solo 1.</p>
                      </div>
                    </div>
                  )}
                  {activeStoreId === "eltrebol_suc2" && (
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 p-3 rounded-xl text-xs font-semibold text-amber-900 flex gap-2.5 items-start">
                      <Sparkles className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-bold text-amber-950">5% OFF acumulado por cantidad</p>
                        <p className="text-amber-800 text-[11px] mt-0.5 font-normal">Llevando 3 o más unidades de Pimentón Dulce Alicante 25g.</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl text-[10px] text-slate-500 text-center leading-tight">
                    * Los descuentos se verán reflejados al instante en el total de tu carrito en la columna derecha.
                  </div>
                </div>
              </div>

              {/* ESCANEOS RECIENTES */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Consultas Recientes
                  </h3>
                  {recentlyScanned.length > 0 && (
                    <button 
                      onClick={() => {
                        setRecentlyScanned([]);
                        addToast("Historial Limpiado", "Se borró el registro de escaneos.", "info");
                        playBeep();
                      }}
                      className="text-slate-400 hover:text-slate-600 text-[10px] font-bold"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
                
                <div id="history-list" className="flex flex-col gap-1.5">
                  {recentlyScanned.length === 0 ? (
                    <div className="text-center py-4 text-[10px] text-slate-400 italic">
                      No has realizado escaneos todavía.
                    </div>
                  ) : (
                    recentlyScanned.map(item => {
                      const prod = products.find(p => p.barcode === item.barcode);
                      if (!prod) return null;
                      return (
                        <div 
                          key={item.barcode + item.timestamp}
                          onClick={() => handleSimulatedScan(item.barcode)} 
                          className="bg-slate-50 hover:bg-slate-100 border border-slate-150 p-2.5 rounded-xl flex justify-between items-center text-xs cursor-pointer transition-all active:scale-98"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-bold text-slate-700 block truncate">{prod.name}</span>
                            <span className="text-[9px] text-slate-400">Escaneado a las {item.timestamp}</span>
                          </div>
                          <span className="font-extrabold text-slate-800 shrink-0 font-mono">
                            ${prod.prices[activeStoreId] || 0}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </section>

            {/* COLUMNA DERECHA: CARRITO DE COMPRAS EN VIVO */}
            <section className="lg:col-span-4 flex flex-col gap-6">
              <div className="bg-white rounded-3xl p-5 shadow-lg border border-emerald-100 flex flex-col gap-4.5 min-h-[460px]">
                
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="bg-emerald-50 text-emerald-700 p-2 rounded-xl border border-emerald-100">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Carrito de Góndola</h3>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">Presupuesto en vivo</p>
                    </div>
                  </div>
                  {cart.length > 0 && (
                    <button 
                      onClick={clearCart} 
                      className="text-rose-500 hover:text-rose-700 active:scale-95 text-xs font-bold transition-all px-2 py-1 rounded-lg hover:bg-rose-50"
                    >
                      Vaciar Carrito
                    </button>
                  )}
                </div>

                {/* ITEMS EN EL CARRITO */}
                <div id="cart-items" className="flex-grow flex flex-col gap-2 overflow-y-auto max-h-[300px] pr-1">
                  {cart.length === 0 ? (
                    <div id="cart-empty-message" className="text-center py-20 flex flex-col items-center gap-2">
                      <ShoppingCart className="w-8 h-8 text-slate-300" />
                      <p className="text-xs text-slate-400 max-w-[180px]">Tu carrito está vacío. Escaneá algún producto para cargarlo.</p>
                    </div>
                  ) : (
                    cartSummary.items.map(item => (
                      <div key={item.barcode} className="bg-slate-50 border border-slate-150 p-2.5 rounded-2xl flex justify-between items-center gap-2 transition-all">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-700 text-xs truncate">{item.name}</p>
                          <p className="text-slate-400 text-[10px] font-semibold">
                            ${item.price.toLocaleString('es-AR')} c/u • <span className="font-mono text-[9px]">{item.barcode}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center border border-slate-200 rounded-xl bg-white shadow-sm">
                            <button 
                              onClick={() => updateCartQty(item.barcode, -1)} 
                              className="px-2.5 py-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 font-bold rounded-l-xl transition-all"
                            >
                              -
                            </button>
                            <span className="px-1 text-xs font-extrabold text-slate-800 min-w-[16px] text-center font-mono">
                              {item.quantity}
                            </span>
                            <button 
                              onClick={() => updateCartQty(item.barcode, 1)} 
                              className="px-2.5 py-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 font-bold rounded-r-xl transition-all"
                            >
                              +
                            </button>
                          </div>
                          
                          <div className="text-right min-w-[65px] shrink-0">
                            <span className="font-extrabold text-xs text-slate-800 font-mono">
                              ${item.itemTotal.toLocaleString('es-AR')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* RESUMEN DE COMPRA */}
                <div className="border-t border-slate-100 pt-3.5 flex flex-col gap-2.5 bg-white">
                  
                  <div className="flex justify-between text-xs text-slate-500 font-semibold px-1">
                    <span>Subtotal de Carrito:</span>
                    <span id="cart-subtotal" className="font-mono">${cartSummary.subtotal.toLocaleString('es-AR')}</span>
                  </div>

                  {cartSummary.discount > 0 && (
                    <div className="flex flex-col gap-1 px-1 py-1.5 bg-amber-50 rounded-xl border border-amber-100">
                      <div className="flex justify-between text-xs text-amber-700 font-bold">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5" />
                          Descuento Promocional:
                        </span>
                        <span id="cart-discount" className="font-mono">-${cartSummary.discount.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="text-[9px] text-amber-600 leading-normal pl-4.5 font-semibold">
                        {cartSummary.promoBreakdown.map((p, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>• {p.name}:</span>
                            <span>-${p.amount.toFixed(0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* GRAND TOTAL */}
                  <div className="bg-slate-900 text-white rounded-2xl p-4 mt-1 shadow-md border border-slate-800 relative overflow-hidden">
                    <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5 pointer-events-none">
                      <ShoppingCart className="w-24 h-24" />
                    </div>
                    
                    <div className="flex justify-between items-center relative z-10">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase tracking-widest block font-bold">Total Final Estimado</span>
                        <span id="cart-store-name" className="text-xs text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                          <StoreIcon className="w-3 h-3" />
                          {STORES[activeStoreId].name}
                        </span>
                      </div>
                      <div className="text-right">
                        <span id="cart-total" className="text-2xl font-black text-emerald-400 tracking-tight font-mono">
                          ${cartSummary.total.toLocaleString('es-AR')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 text-center italic mt-0.5">
                    * El cálculo de precios es simulado basándose en la góndola del súper seleccionado mediante QR.
                  </div>
                </div>

              </div>
            </section>
          </div>
        )}

        {/* VISTA BASE DE DATOS (PLANILLA INTEGRADA) */}
        {activeTab === "db" && (
          <div id="view-db" className="w-full">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm max-w-5xl mx-auto flex flex-col gap-6">
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-2xl border border-emerald-100 shadow-sm">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                      Planillas de Google Sheets Conectadas
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full uppercase flex items-center gap-1 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        GVIZ LIVE STREAM
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">Lectura en tiempo real con el endpoint <code>/gviz/tq?tqx=out:json</code> sin caché</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 w-full sm:w-auto shrink-0">
                  <button 
                    onClick={() => syncLiveFromGoogleSheets(true)}
                    disabled={isSyncingSheets}
                    className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-60 text-white font-bold py-2 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncingSheets ? 'animate-spin' : ''}`} />
                    {isSyncingSheets ? 'Leyendo Sheets...' : 'Sincronizar en Vivo'}
                  </button>
                </div>
              </div>

              {/* SHEET INFO BAR */}
              <div className="flex flex-col gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-150 text-xs">
                <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                  <span className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    URLs de Lectura Configuradas (Formato GViz JSON)
                  </span>
                  <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-emerald-600" />
                    Última actualización: <span className="font-mono">{lastSyncTime || 'Sincronizando...'}</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(Object.keys(STORES) as Array<keyof typeof STORES>).map((key) => {
                    const store = STORES[key];
                    const isActive = activeStoreId === key;
                    return (
                      <div 
                        key={key}
                        onClick={() => handleStoreChange(key)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          isActive 
                            ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/10 shadow-sm' 
                            : 'bg-white/60 border-slate-200 hover:bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-800 text-xs">{store.name}</span>
                          {isActive && (
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded-full">
                              Activo
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] text-slate-400 font-mono break-all select-all font-semibold mt-0.5">
                          ID: {store.sheetId}
                        </p>
                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100">
                          <a 
                            href={`https://docs.google.com/spreadsheets/d/${store.sheetId}/gviz/tq?tqx=out:json`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 hover:text-emerald-800 hover:underline font-mono"
                          >
                            Ver Endpoint GViz JSON ↗
                          </a>
                          <a 
                            href={`https://docs.google.com/spreadsheets/d/${store.sheetId}/edit`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-500 hover:text-slate-800 hover:underline"
                          >
                            Editar Sheet ↗
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* EXPLANATORY ALERT */}
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex gap-3 text-xs text-emerald-900">
                <Sparkles className="w-4.5 h-4.5 text-emerald-600 mt-0.5 shrink-0" />
                <div className="leading-relaxed">
                  <p className="font-bold">¡Lectura Directa en Tiempo Real Conectada!</p>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Cada vez que cargues o modifiques un producto en tus 3 planillas de Google Sheets, la aplicación lee los datos directamente con el formato <code>/gviz/tq?tqx=out:json</code> sin usar caché previa. Hacé clic en <strong>"Sincronizar en Vivo"</strong> para refrescar los precios inmediatamente.
                  </p>
                </div>
              </div>

              {/* PRODUCT SPREADSHEET */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 font-bold">
                      <th className="p-3">Código de Barras (Cód)</th>
                      <th className="p-3">Nombre del Producto</th>
                      <th className="p-3">Categoría</th>
                      {STORES_CONFIG.map(store => (
                        <th key={store.id} className={`p-3 text-center border-x border-slate-200 ${getStoreColor(store.color).thBg}`}>
                          {store.name} ($)
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody id="db-table-body" className="divide-y divide-slate-150">
                    {products.map(prod => (
                      <tr key={prod.barcode} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-mono text-slate-500">{prod.barcode}</td>
                        <td className="p-3 font-semibold text-slate-800">{prod.name}</td>
                        <td className="p-3">
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase text-[9px]">
                            {prod.category}
                          </span>
                        </td>
                        {STORES_CONFIG.map(store => (
                          <td key={store.id} className="p-2 bg-slate-50/60 border-x border-slate-150">
                            <div className="flex items-center justify-center font-bold text-slate-800 font-mono">
                              <span className="text-slate-400 mr-1">$</span>
                              {prod.prices[store.id] || 0}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-400 italic">
                <span>* Total de productos cargados: {products.length} unidades</span>
                <span>* Formato de precios en Pesos Argentinos (ARS)</span>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* BANCO DE PRUEBAS INTERACTIVO */}
      <section className="bg-white border-t border-slate-200 py-5 px-6 shadow-2xl mt-auto z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              Banco de Pruebas Físicas (Toca para escanear en góndola)
            </h3>
            <p className="text-[10px] text-slate-400 italic hidden sm:block">Representa simular el acto físico de pasar un producto por el lector láser</p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {products.map(prod => {
              const activePrice = prod.prices[activeStoreId] || 0;
              return (
                <button 
                  key={prod.barcode}
                  onClick={() => handleSimulatedScan(prod.barcode)} 
                  className="group bg-slate-50 hover:bg-emerald-50/50 hover:border-emerald-300 border border-slate-150 p-3 text-left rounded-2xl transition-all shadow-sm active:scale-95 duration-200 flex flex-col gap-1.5 relative overflow-hidden"
                >
                  <div className="absolute right-2 top-2 w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-emerald-400 transition-colors"></div>
                  <span className="text-[10px] font-bold text-slate-800 line-clamp-1 group-hover:text-emerald-950 transition-colors">
                    {prod.name}
                  </span>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[9px] text-slate-400 font-mono leading-none">Cód: ...{prod.barcode.slice(-4)}</span>
                    <span className="text-xs font-black text-emerald-700 font-mono leading-none">
                      ${activePrice}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* MODAL NUEVO PRODUCTO */}

      {/* FOOTER */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-500 text-[11px] py-4 px-6 text-center">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <p>© 2026 Precio Ya - Lector de Góndola y Carrito Recalculable. Desarrollado en React & Tailwind CSS.</p>
          <div className="flex gap-4">
            <span>Soporte Sheets API</span>
            <span>Planilla Conectada</span>
            <span>Simulador de Presupuestos v4</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
