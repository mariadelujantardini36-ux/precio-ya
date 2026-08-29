import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

export async function processSheetsSync(providedPin) {
  const adminPin = process.env.ADMIN_PIN || "198228";
  if (!providedPin || String(providedPin).trim() !== String(adminPin).trim()) {
    return { authorized: false, message: "PIN de administrador incorrecto. Acceso denegado." };
  }

  const storeMap = [
    { key: 'eltrebol_suc2', name: 'Súper Avenida', sheetId: process.env.SHEET_ID_AVENIDA },
    { key: 'eltrebol', name: 'Súper El Trébol', sheetId: process.env.SHEET_ID_TREBOL },
    { key: 'elnene', name: 'Súper El Nene', sheetId: process.env.SHEET_ID_ELNENE },
  ];

  const productDict = {};

  await Promise.all(
    storeMap.map(async (store) => {
      if (!store.sheetId) return;
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

        const cols = data.table.cols || [];
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
              prices: {
                elnene: 0,
                eltrebol: 0,
                eltrebol_suc2: 0,
              }
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
        console.error(`Error procesando planilla para ${store.name}:`, err);
      }
    })
  );

  const resultList = Object.values(productDict).map(prod => {
    const validPrices = Object.values(prod.prices).filter(p => p > 0);
    const avgPrice = validPrices.length > 0 ? Math.round(validPrices.reduce((a, b) => a + b, 0) / validPrices.length) : 1000;

    return {
      ...prod,
      prices: {
        elnene: prod.prices.elnene > 0 ? prod.prices.elnene : avgPrice,
        eltrebol: prod.prices.eltrebol > 0 ? prod.prices.eltrebol : avgPrice,
        eltrebol_suc2: prod.prices.eltrebol_suc2 > 0 ? prod.prices.eltrebol_suc2 : avgPrice,
      }
    };
  });

  const now = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return { authorized: true, products: resultList, lastSync: now };
}

app.post('/api/sync-sheets', async (req, res) => {
  try {
    const { pin } = req.body || {};
    const result = await processSheetsSync(pin);
    if (!result.authorized) {
      return res.status(401).json({ success: false, message: result.message });
    }
    return res.json({ success: true, products: result.products, lastSync: result.lastSync });
  } catch (error) {
    console.error("Error en servidor al sincronizar planillas:", error);
    return res.status(500).json({ success: false, message: "Error interno en el servidor." });
  }
});

// Serve static assets in production if dist directory exists
app.use(express.static(path.join(__dirname, 'dist')));

const PORT = process.env.PORT || 3000;
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  app.listen(PORT, () => {
    console.log(`Servidor iniciado en puerto ${PORT}`);
  });
}
export default app;
