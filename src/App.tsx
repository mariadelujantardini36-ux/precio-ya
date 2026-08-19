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
  RefreshCw,
  Lock,
  ShieldCheck,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Product, CartItem, Store, ScannedItem } from "./types";

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

const STORES: Record<'elnene' | 'eltrebol' | 'eltrebol_suc2', { name: string; description: string }> = {
  eltrebol_suc2: {
    name: "Súper 1: Súper Avenida",
    description: "Sucursal céntrica conectada."
  },
  eltrebol: {
    name: "Súper 2: Súper El Trébol",
    description: "Excelente variedad en condimentos."
  },
  elnene: {
    name: "Súper 3: Súper El Nene",
    description: "Precios locales competitivos."
  }
};

/**
 * Calls backend API /api/sync-sheets passing the admin PIN for server-side Google Sheets synchronization.
 */
export async function syncSheetsFromBackend(pin: string): Promise<{ products: Product[]; lastSync: string }> {
  const res = await fetch('/api/sync-sheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin })
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Error de autorización o sincronización.');
  }

  return { products: data.products, lastSync: data.lastSync };
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

  const [activeStoreId, setActiveStoreId] = useState<'elnene' | 'eltrebol' | 'eltrebol_suc2'>("elnene");
  const [activeTab, setActiveTab] = useState<'consultar' | 'db'>("consultar");
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

  // Admin PIN Modal States
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [adminPinInput, setAdminPinInput] = useState<string>("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState<boolean>(false);

  const handleOpenSyncModal = () => {
    setAdminPinInput("");
    setPinError(null);
    setShowPinModal(true);
  };

  const handleAdminSyncSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!adminPinInput.trim()) {
      setPinError("Por favor ingresá el PIN de administrador.");
      return;
    }

    setIsVerifyingPin(true);
    setPinError(null);
    setIsSyncingSheets(true);
    setSyncError(null);

    try {
      const { products: fetchedProducts, lastSync } = await syncSheetsFromBackend(adminPinInput.trim());
      if (fetchedProducts.length > 0) {
        setProducts(fetchedProducts);
        setLastSyncTime(lastSync);
        addToast("Sincronización Exitosa", `Precios actualizados (${fetchedProducts.length} productos) a las ${lastSync}`, "success");
        setShowPinModal(false);
        setAdminPinInput("");
      } else {
        addToast("Aviso de Sincronización", "No se encontraron productos en las planillas.", "info");
        setShowPinModal(false);
        setAdminPinInput("");
      }
    } catch (err: any) {
      const errorMsg = err.message || "Error al sincronizar datos.";
      setPinError(errorMsg);
      setSyncError(errorMsg);
      addToast("Acceso Denegado", errorMsg, "error");
    } finally {
      setIsVerifyingPin(false);
      setIsSyncingSheets(false);
    }
  };

  // New product form states
  const [showAddProductModal, setShowAddProductModal] = useState<boolean>(false);
  const [newBarcode, setNewBarcode] = useState<string>("");
  const [newName, setNewName] = useState<string>("");
  const [newCategory, setNewCategory] = useState<string>("Condimentos");
  const [newPriceNene, setNewPriceNene] = useState<number>(1000);
  const [newPriceTrebol, setNewPriceTrebol] = useState<number>(1000);
  const [newPriceAvenida, setNewPriceAvenida] = useState<number>(1000);

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
            () => {}
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

  const handleStoreChange = (storeId: 'elnene' | 'eltrebol' | 'eltrebol_suc2') => {
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

  const findProductInDatabase = (query: string, productsList: Product[] = products): Product | undefined => {
    if (!query) return undefined;
    const rawQuery = String(query).trim();
    const cleanQuery = rawQuery.toLowerCase();
    if (!cleanQuery) return undefined;

    let found = productsList.find(p => String(p.barcode).trim().toLowerCase() === cleanQuery);
    if (found) return found;

    const queryNoZeros = cleanQuery.replace(/^0+/, "");
    if (queryNoZeros) {
      found = productsList.find(p => {
        const pCodeNoZeros = String(p.barcode).trim().toLowerCase().replace(/^0+/, "");
        return pCodeNoZeros === queryNoZeros;
      });
      if (found) return found;
    }

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

    found = productsList.find(p => String(p.barcode).toLowerCase().includes(cleanQuery));
    if (found) return found;

    found = productsList.find(p => p.name.toLowerCase().includes(cleanQuery));
    if (found) return found;

    return undefined;
  };

  const handleBarcodeSearch = (codeToSearch?: string) => {
    const query = (codeToSearch || barcodeInput).trim();
    if (!query) return;

    setIsScanning(true);
    playBeep();
    setTimeout(() => setIsScanning(false), 500);

    const product = findProductInDatabase(query, products);
    if (product) {
      setScannedBarcode(product.barcode);
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

  const handleAddProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBarcode || !newName) {
      addToast("Error", "Por favor completa el nombre y el código de barras.", "error");
      return;
    }

    if (products.some(p => p.barcode === newBarcode)) {
      addToast("Error", "Este código de barras ya existe.", "error");
      return;
    }

    const created: Product = {
      barcode: newBarcode,
      name: newName,
      category: newCategory,
      prices: {
        elnene: Number(newPriceNene),
        eltrebol: Number(newPriceTrebol),
        eltrebol_suc2: Number(newPriceAvenida)
      }
    };

    setProducts(prev => [...prev, created]);
    addToast("Producto Creado", `${newName} agregado a las góndolas.`, "success");
    playBeep();

    setNewBarcode("");
    setNewName("");
    setNewCategory("Condimentos");
    setNewPriceNene(1000);
    setNewPriceTrebol(1000);
    setNewPriceAvenida(1000);
    setShowAddProductModal(false);
  };

  const handlePriceChange = (barcode: string, storeKey: 'elnene' | 'eltrebol' | 'eltrebol_suc2', val: number) => {
    setProducts(prev => prev.map(p => {
      if (p.barcode === barcode) {
        return {
          ...p,
          prices: {
            ...p.prices,
            [storeKey]: Math.max(0, val)
          }
        };
      }
      return p;
    }));
  };

  const deleteProduct = (barcode: string) => {
    const prod = products.find(p => p.barcode === barcode);
    if (prod && window.confirm(`¿Seguro que deseas eliminar permanentemente a "${prod.name}" de la Base de Datos?`)) {
      setProducts(prev => prev.filter(p => p.barcode !== barcode));
      setCart(prev => prev.filter(item => item.barcode !== barcode));
      if (scannedBarcode === barcode) {
        setScannedBarcode("");
      }
      addToast("Producto Eliminado", "Se removió de la base de datos y de los carritos.", "info");
      playBeep();
    }
  };

  const currentScannedProduct = findProductInDatabase(scannedBarcode, products);

  const calculateCartSummary = () => {
    let subtotal = 0;
    let discount = 0;
    const promoBreakdown: { name: string; amount: number }[] = [];

    const itemsWithPrices = cart.map(item => {
      const product = findProductInDatabase(item.barcode, products);
      const price = product ? product.prices[activeStoreId] : 0;
      return {
        ...item,
        name: product ? product.name : "Producto Desconocido",
        category: product ? product.category : "General",
        price,
        itemTotal: price * item.quantity
      };
    });

    subtotal = itemsWithPrices.reduce((sum, item) => sum + item.itemTotal, 0);

    if (activeStoreId === "elnene") {
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
            <button 
              id="btn-elnene"
              onClick={() => handleStoreChange('elnene')} 
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-1.5 shadow-sm border ${
                activeStoreId === 'elnene' 
                  ? 'bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-500/30' 
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              QR Súper El Nene
            </button>
            <button 
              id="btn-eltrebol"
              onClick={() => handleStoreChange('eltrebol')} 
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-1.5 shadow-sm border ${
                activeStoreId === 'eltrebol' 
                  ? 'bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-500/30' 
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-sky-400"></span>
              QR Súper El Trébol
            </button>
            <button 
              id="btn-eltrebol_suc2"
              onClick={() => handleStoreChange('eltrebol_suc2')} 
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-1.5 shadow-sm border ${
                activeStoreId === 'eltrebol_suc2' 
                  ? 'bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-500/30' 
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              QR Súper Avenida
            </button>
          </div>

          <div className="flex items-center gap-3">
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
              onClick={handleOpenSyncModal}
              disabled={isSyncingSheets}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-60 text-white font-bold py-2 px-3.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 shrink-0"
              title="Cargar precios actualizados mediante PIN de administrador"
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
                  setActiveTab('db');
                  addToast("Base de Datos", "Listado de Productos Sincronizados", "info");
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

                    <div className="bg-gradient-to-br from-amber-50 to-amber-100/60 border border-amber-200/50 rounded-2xl p-4 flex justify-between items-center shadow-inner">
                      <div>
                        <span className="text-[10px] text-amber-800 uppercase font-bold tracking-wider block">Precio de Góndola Activa</span>
                        <span id="scanned-price" className="text-3xl font-black text-amber-950 tracking-tight block">
                          ${currentScannedProduct.prices[activeStoreId].toLocaleString('es-AR')}
                        </span>
                      </div>
                      <div className="bg-amber-400/95 text-amber-950 font-black px-3.5 py-2 rounded-xl text-xs tracking-wider shadow">
                        ARS $
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-150">
                      <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest block mb-2 flex items-center gap-1.5">
                        <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" />
                        Comparador instantáneo de Góndola
                      </span>
                      
                      <div className="flex flex-col gap-2">
                        {Object.entries(STORES).map(([key, store]) => {
                          const storeKey = key as 'elnene' | 'eltrebol' | 'eltrebol_suc2';
                          const price = currentScannedProduct.prices[storeKey];
                          const isActive = activeStoreId === storeKey;
                          
                          const activePrice = currentScannedProduct.prices[activeStoreId];
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
                                <span className={`w-2 h-2 rounded-full ${
                                  storeKey === 'elnene' ? 'bg-emerald-400' :
                                  storeKey === 'eltrebol' ? 'bg-sky-400' : 'bg-amber-400'
                                }`}></span>
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

                    <button 
                      id="add-to-cart-btn"
                      onClick={() => addToCart(currentScannedProduct.barcode)} 
                      className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold py-3.5 px-4 rounded-2xl shadow-md shadow-emerald-600/10 transition-all flex items-center justify-center gap-2 text-sm uppercase"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Sumar al Carrito de Góndola
                    </button>

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
                                <span className="text-xs font-bold text-emerald-700 block">${alt.prices[activeStoreId]}</span>
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
                              ${p.prices[activeStoreId].toLocaleString('es-AR')}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

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
                        <span className="text-xs font-extrabold text-emerald-700 block font-mono">${prod.prices[activeStoreId].toLocaleString('es-AR')}</span>
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
                            ${prod.prices[activeStoreId]}
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

        {/* VISTA BASE DE DATOS */}
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
                      Base de Datos de Productos
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full uppercase flex items-center gap-1 font-mono">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        SISTEMA PROTEGIDO
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">Sincronización segura protegida con clave de administrador</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 w-full sm:w-auto shrink-0">
                  <button 
                    onClick={handleOpenSyncModal}
                    disabled={isSyncingSheets}
                    className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-60 text-white font-bold py-2 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncingSheets ? 'animate-spin' : ''}`} />
                    {isSyncingSheets ? 'Leyendo...' : 'Actualizar Sheets'}
                  </button>
                  <button 
                    onClick={() => setShowAddProductModal(true)}
                    className="flex-1 sm:flex-none border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4 text-emerald-600" />
                    Nuevo Producto
                  </button>
                </div>
              </div>

              {/* STORE STATUS BAR (PRIVACY PROTECTED) */}
              <div className="flex flex-col gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-150 text-xs">
                <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                  <span className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider flex items-center gap-1.5">
                    <StoreIcon className="w-3.5 h-3.5 text-emerald-600" />
                    Supermercados Vinculados al Sistema
                  </span>
                  <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-emerald-600" />
                    Última actualización: <span className="font-mono">{lastSyncTime || 'Pendiente'}</span>
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
                        <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                          {store.description}
                        </p>
                        <div className="mt-2 pt-1 border-t border-slate-100 flex items-center gap-1 text-[9px] text-emerald-700 font-semibold">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>Conexión Servidor Protegida</span>
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
                  <p className="font-bold">Actualización de Precios Segura</p>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Los precios de Súper El Nene, Súper El Trébol y Súper Avenida son gestionados de manera independiente desde sus respectivas planillas. Hacé clic en <strong>"Actualizar Sheets"</strong> e ingresá el PIN de administrador para refrescar los valores en tiempo real.
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
                      <th className="p-3 text-center bg-emerald-50/50 text-emerald-850 border-x border-slate-200">Súper El Nene ($)</th>
                      <th className="p-3 text-center bg-sky-50/50 text-sky-850 border-x border-slate-200">Súper El Trébol ($)</th>
                      <th className="p-3 text-center bg-amber-50/50 text-amber-850 border-x border-slate-200">Súper Avenida ($)</th>
                      <th className="p-3 text-center">Acciones</th>
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
                        <td className="p-2 bg-emerald-50/25 border-x border-slate-150">
                          <div className="flex items-center justify-center">
                            <span className="text-slate-400 mr-1 font-bold">$</span>
                            <input 
                              type="number" 
                              value={prod.prices.elnene}
                              onChange={(e) => handlePriceChange(prod.barcode, 'elnene', Number(e.target.value))}
                              className="w-20 bg-white border border-slate-200 rounded px-1.5 py-1 text-center font-bold text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                        </td>
                        <td className="p-2 bg-sky-50/25 border-x border-slate-150">
                          <div className="flex items-center justify-center">
                            <span className="text-slate-400 mr-1 font-bold">$</span>
                            <input 
                              type="number" 
                              value={prod.prices.eltrebol}
                              onChange={(e) => handlePriceChange(prod.barcode, 'eltrebol', Number(e.target.value))}
                              className="w-20 bg-white border border-slate-200 rounded px-1.5 py-1 text-center font-bold text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                          </div>
                        </td>
                        <td className="p-2 bg-amber-50/25 border-x border-slate-150">
                          <div className="flex items-center justify-center">
                            <span className="text-slate-400 mr-1 font-bold">$</span>
                            <input 
                              type="number" 
                              value={prod.prices.eltrebol_suc2}
                              onChange={(e) => handlePriceChange(prod.barcode, 'eltrebol_suc2', Number(e.target.value))}
                              className="w-20 bg-white border border-slate-200 rounded px-1.5 py-1 text-center font-bold text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <button 
                            onClick={() => deleteProduct(prod.barcode)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all"
                            title="Eliminar producto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
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
              const activePrice = prod.prices[activeStoreId];
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

      {/* MODAL DE PIN DE ADMINISTRADOR */}
      {showPinModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-4 relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setShowPinModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="bg-emerald-100 text-emerald-700 p-3 rounded-2xl border border-emerald-200 shadow-sm">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Acceso Administrador</h3>
                <p className="text-xs text-slate-500 mt-0.5">Sincronización segura de Google Sheets</p>
              </div>
            </div>

            <form onSubmit={handleAdminSyncSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                  PIN General de Administrador
                </label>
                <input 
                  type="password"
                  required
                  autoFocus
                  maxLength={10}
                  placeholder="Ingresá la clave de acceso..."
                  value={adminPinInput}
                  onChange={(e) => setAdminPinInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Este PIN autorizará al servidor a consultar los precios actualizados de Súper El Nene, Súper El Trébol y Súper Avenida.
                </p>
              </div>

              {pinError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{pinError}</span>
                </div>
              )}

              <div className="flex gap-2 justify-end mt-2">
                <button 
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-xs transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isVerifyingPin}
                  className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-60 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingPin ? 'animate-spin' : ''}`} />
                  <span>{isVerifyingPin ? 'Verificando y Cargando...' : 'Confirmar y Actualizar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NUEVO PRODUCTO */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-600" />
                Agregar Nuevo Producto a Góndola
              </h3>
              <button 
                onClick={() => setShowAddProductModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded-lg hover:bg-slate-100 transition-all"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleAddProductSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Código de Barras (Único)</label>
                <input 
                  type="text"
                  required
                  placeholder="Ej: 7791234567890"
                  value={newBarcode}
                  onChange={(e) => setNewBarcode(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Nombre del Producto</label>
                <input 
                  type="text"
                  required
                  placeholder="Ej: Sal Fina Dos Anclas 250g"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Categoría</label>
                  <select 
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="Condimentos">Condimentos</option>
                    <option value="Fideos">Fideos</option>
                    <option value="Almacén">Almacén</option>
                    <option value="Bebidas">Bebidas</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Precios en Góndolas ($ ARS)</span>
                
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Súper El Nene</label>
                    <input 
                      type="number"
                      required
                      min="0"
                      value={newPriceNene}
                      onChange={(e) => setNewPriceNene(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Súper El Trébol</label>
                    <input 
                      type="number"
                      required
                      min="0"
                      value={newPriceTrebol}
                      onChange={(e) => setNewPriceTrebol(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Súper Avenida</label>
                    <input 
                      type="number"
                      required
                      min="0"
                      value={newPriceAvenida}
                      onChange={(e) => setNewPriceAvenida(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold font-mono text-slate-800"
                    />
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md shadow-emerald-600/10 mt-2"
              >
                Dar de Alta Producto
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-500 text-[11px] py-4 px-6 text-center">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <p>© 2026 Precio Ya - Lector de Góndola y Carrito Recalculable. Desarrollado en React & Tailwind CSS.</p>
          <div className="flex gap-4">
            <span>Base de Datos Protegida</span>
            <span>Sincronización Segura v4</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
