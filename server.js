const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'items.json');
const MERCADONA_FILE = path.join(__dirname, 'data', 'mercadona_catalog.json');

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Cargar catálogo oficial exclusivo de Mercadona (https://tienda.mercadona.es/)
let mercadonaCatalog = [];
try {
  if (fs.existsSync(MERCADONA_FILE)) {
    mercadonaCatalog = JSON.parse(fs.readFileSync(MERCADONA_FILE, 'utf8'));
    console.log(`✅ Catálogo 100% oficial de Mercadona cargado: ${mercadonaCatalog.length} productos.`);
  }
} catch (err) {
  console.error('Error cargando mercadona_catalog.json:', err);
}

// Helpers para persistencia de datos
function readItems() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, '[]', 'utf8');
      return [];
    }
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(content || '[]');
  } catch (err) {
    console.error('Error leyendo items.json:', err);
    return [];
  }
}

function saveItems(items) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error guardando items.json:', err);
    return false;
  }
}

// Obtener IP local de la red
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  
  for (const name of Object.keys(interfaces)) {
    const lowerName = name.toLowerCase();
    const isVirtual = lowerName.includes('virtual') || lowerName.includes('vethernet') || lowerName.includes('vmware') || lowerName.includes('wsl');

    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        if (!isVirtual) {
          candidates.unshift(net.address);
        } else {
          candidates.push(net.address);
        }
      }
    }
  }
  return candidates[0] || 'localhost';
}

// Eliminar acentos para búsquedas insensibles
function removeAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Normalizar términos comunes (ej: nesquick -> nesquik, pasta de dientes -> dentífrico)
function normalizeSearchQuery(q) {
  let s = removeAccents(q.toLowerCase());
  s = s.replace(/\bpasta (de )?dientes\b/g, 'dentifrico');
  s = s.replace(/\bpasta dental\b/g, 'dentifrico');
  s = s.replace(/\bpapel (del )?vater\b/g, 'papel higienico');
  s = s.replace(/\bfairy\b/g, 'lavavajillas');
  s = s.replace(/\bnesquick\b/g, 'nesquik');
  s = s.replace(/\bcola cao\b/g, 'colacao');
  s = s.replace(/\bchocokrispies\b/g, 'choco krispies');
  return s.trim();
}

// Buscar exclusivamente en el catálogo oficial de Mercadona
function searchMercadona(query) {
  const normalized = normalizeSearchQuery(query);
  const words = normalized.split(/\s+/).filter(w => w.length > 1);

  if (words.length === 0) return [];

  const matches = mercadonaCatalog.filter(p => {
    const pNorm = removeAccents(p.name);
    return words.every(w => pNorm.includes(w));
  });

  return matches.slice(0, 10).map(p => {
    let brand = 'Mercadona';
    if (p.name.includes('Hacendado')) brand = 'Hacendado';
    else if (p.name.includes('Bosque Verde')) brand = 'Bosque Verde 🧼';
    else if (p.name.includes('Deliplus')) brand = 'Deliplus 🧴';

    return {
      id: p.id,
      name: p.name,
      brand,
      price: p.price,
      packaging: p.packaging,
      image: p.image,
      thumbnail: p.thumbnail,
      mercadonaUrl: `https://tienda.mercadona.es/product/${p.id}/`
    };
  });
}

// --- ENDPOINTS DE LA API ---

// 1. Obtener todos los productos de la lista
app.get('/api/items', (req, res) => {
  const items = readItems();
  res.json({ success: true, count: items.length, data: items });
});

// 2. Añadir un producto nuevo (Mercadona o Tienda local / Carnicería)
app.post('/api/items', (req, res) => {
  const { name, note, addedBy, category, price, packaging, store, quantity, customIcon } = req.body;
  let { imageUrl } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'El nombre del producto es obligatorio.' });
  }

  const isLocalStore = Boolean(store && store !== 'Mercadona');

  // Si es de Mercadona y no tiene foto, buscamos en el catálogo oficial
  if (!isLocalStore && !imageUrl) {
    const mercaMatches = searchMercadona(name);
    if (mercaMatches.length > 0) {
      imageUrl = mercaMatches[0].image;
      if (!price) price = mercaMatches[0].price;
      if (!packaging) packaging = mercaMatches[0].packaging;
    }
  }

  const items = readItems();
  const newItem = {
    id: Date.now().toString(),
    name: name.trim(),
    note: (note || '').trim(),
    addedBy: addedBy || 'Familia 🏠',
    category: category || (isLocalStore ? store : 'Mercadona'),
    store: store || 'Mercadona',
    quantity: (quantity || '').trim(),
    customIcon: customIcon || (isLocalStore ? '🏪' : ''),
    price: price || '',
    packaging: packaging || '',
    bought: false,
    imageUrl: imageUrl || '',
    createdAt: new Date().toISOString()
  };

  items.unshift(newItem);
  saveItems(items);

  res.status(201).json({ success: true, data: newItem });
});

// 3. Modificar un producto (tachar como comprado, cambiar notas, etc.)
app.patch('/api/items/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const items = readItems();
  const index = items.findIndex(i => i.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Producto no encontrado.' });
  }

  items[index] = { ...items[index], ...updates };
  saveItems(items);

  res.json({ success: true, data: items[index] });
});

// 4. Eliminar un producto
app.delete('/api/items/:id', (req, res) => {
  const { id } = req.params;
  let items = readItems();
  const initialLength = items.length;

  items = items.filter(i => i.id !== id);

  if (items.length === initialLength) {
    return res.status(404).json({ success: false, error: 'Producto no encontrado.' });
  }

  saveItems(items);
  res.json({ success: true, message: 'Producto eliminado.' });
});

// 5. Limpiar todos los productos comprados
app.post('/api/items/clear-bought', (req, res) => {
  let items = readItems();
  items = items.filter(i => !i.bought);
  saveItems(items);
  res.json({ success: true, message: 'Productos comprados limpiados con éxito.' });
});

// 6. Información de red
app.get('/api/network-info', (req, res) => {
  const ip = getLocalIp();
  res.json({
    ip,
    port: PORT,
    publicUrl: 'https://familia-barbado.onrender.com',
    mobileUrl: 'https://familia-barbado.onrender.com',
    localWifiUrl: `http://${ip}:${PORT}`
  });
});

// 7. Búsqueda instantánea en el catálogo oficial de Mercadona
app.get('/api/search-products', (req, res) => {
  const rawQuery = (req.query.q || '').trim();

  if (!rawQuery || rawQuery.length < 2) {
    return res.json({ success: true, results: [] });
  }

  const results = searchMercadona(rawQuery);
  res.json({ success: true, results });
});

// Arrancar el servidor
app.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIp();
  console.log(`\n======================================================`);
  console.log(`🛒 SERVIDOR DESPENSA FAMILIAR 100% MERCADONA`);
  console.log(`💻 Catálogo: https://tienda.mercadona.es/`);
  console.log(`======================================================\n`);
});
