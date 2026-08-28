/**
 * LISTA DE SUPERMERCADOS
 * ======================
 * Este es el ÚNICO lugar que hay que tocar para agregar un supermercado nuevo.
 *
 * Para sumar un supermercado:
 * 1. Creá una planilla de Google Sheets nueva para ese supermercado (podés
 *    duplicar cualquiera de las que ya existen: Archivo > Hacer una copia).
 *    Tiene que tener columnas con estos nombres (en cualquier orden):
 *      - Una columna con "Código" en el título (código de barras)
 *      - Una columna con "Producto" o "Nombre" en el título
 *      - Una columna con "Precio" en el título
 *      - (Opcional) una columna con "Categoría" en el título
 * 2. Compartí esa planilla como "Cualquier persona con el enlace puede ver".
 * 3. Copiá el ID de la planilla: es la parte de la URL entre "/d/" y "/edit".
 *    Ejemplo: https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit
 * 4. Agregá un bloque nuevo acá abajo, copiando y pegando uno de los que ya
 *    existen, y cambiando: id, name, sheetId, sheetName y color.
 * 5. El "color" tiene que ser uno de esta lista, sin repetir con otro
 *    supermercado ya cargado, para que se distingan bien en pantalla:
 *    emerald, sky, amber, rose, violet, cyan, lime, fuchsia, orange, teal,
 *    indigo, pink, yellow, blue, red
 *
 * No hace falta tocar ningún otro archivo: toda la app (botones, tabla de
 * precios, comparador, colores) se arma sola a partir de esta lista.
 */

export interface StoreConfigEntry {
  id: string;
  name: string;
  sheetId: string;
  sheetName: string;
  description: string;
  color: string;
}

export const STORES_CONFIG: StoreConfigEntry[] = [
  {
    id: "eltrebol_suc2",
    name: "Súper Avenida",
    sheetId: "15WS5l_44Fzbwe5mopUXUb_7kihpHY5RTiuTZmUJ9VX0",
    sheetName: "DB - Súper Avenida",
    description: "Sucursal céntrica conectada a Google Sheets en tiempo real.",
    color: "amber",
  },
  {
    id: "eltrebol",
    name: "Súper El Trébol",
    sheetId: "1VHKH9XZGlnT7AlGgqh9Du0hqhJ7bPWPhBsADkCfp8OU",
    sheetName: "DB - Súper El Trébol",
    description: "Excelente variedad en condimentos con catálogo en vivo.",
    color: "sky",
  },
  {
    id: "elnene",
    name: "Súper El Nene",
    sheetId: "1_0M9qogKPSpVBYTLcx8m7MXcUHmDH1N4dTllIFCREAU",
    sheetName: "DB - Súper El Nene",
    description: "Precios locales competitivos sincronizados por la API GViz.",
    color: "emerald",
  },

  // 👇 Copiá este bloque y completalo para agregar un supermercado nuevo:
  // {
  //   id: "nombre_unico_sin_espacios",
  //   name: "Nombre para mostrar en pantalla",
  //   sheetId: "PEGAR_AQUI_EL_ID_DE_LA_PLANILLA",
  //   sheetName: "DB - Nombre del súper",
  //   description: "Una frase corta describiendo este local.",
  //   color: "violet",
  // },
];
