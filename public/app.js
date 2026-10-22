// Estado de la aplicación
let allItems = [];
let currentFilter = 'pending';
let selectedProductData = null;
let searchDebounceTimeout = null;

// Elementos del DOM
const itemsList = document.getElementById('itemsList');
const emptyState = document.getElementById('emptyState');
const productInput = document.getElementById('productInput');
const noteInput = document.getElementById('noteInput');
const addBtn = document.getElementById('addBtn');
const suggestionsBox = document.getElementById('suggestionsBox');
const userSelector = document.getElementById('userSelector');
const voiceBtn = document.getElementById('voiceBtn');
const voiceBtnText = document.getElementById('voiceBtnText');
const pendingCountSpan = document.getElementById('pendingCount');
const boughtCountSpan = document.getElementById('boughtCount');
const pendingCostDisplay = document.getElementById('pendingCostDisplay');
const totalItemsBadge = document.getElementById('totalItemsBadge');

// 1. Inicialización
document.addEventListener('DOMContentLoaded', () => {
  const savedUser = localStorage.getItem('familyUser');
  if (savedUser && userSelector.querySelector(`option[value="${savedUser}"]`)) {
    userSelector.value = savedUser;
  }

  userSelector.addEventListener('change', (e) => {
    localStorage.setItem('familyUser', e.target.value);
  });

  fetchItems();
  setInterval(fetchItems, 3500);

  addBtn.addEventListener('click', handleAddItem);
  productInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAddItem();
  });
  noteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAddItem();
  });

  productInput.addEventListener('input', handleProductSearch);

  document.addEventListener('click', (e) => {
    if (!suggestionsBox.contains(e.target) && e.target !== productInput) {
      suggestionsBox.classList.add('d-none');
    }
  });

  initVoiceRecognition();
});

// 2. Cargar productos desde la API
async function fetchItems() {
  try {
    const res = await fetch('/api/items');
    const data = await res.json();
    if (data.success) {
      allItems = data.data;
      renderItems();
    }
  } catch (err) {
    console.warn('Error al sincronizar:', err);
  }
}

// 3. Renderizar la lista 100% Mercadona
function renderItems() {
  const pendingItems = allItems.filter(i => !i.bought);
  const boughtItems = allItems.filter(i => i.bought);

  pendingCountSpan.textContent = pendingItems.length;
  boughtCountSpan.textContent = boughtItems.length;

  // Cálculo del Coste Total de Mercadona
  let totalCost = 0;
  pendingItems.forEach(item => {
    if (item.price) {
      const num = parseFloat(item.price.replace('€', '').replace(',', '.').trim());
      if (!isNaN(num)) totalCost += num;
    }
  });

  if (pendingCostDisplay) {
    pendingCostDisplay.textContent = totalCost.toFixed(2) + ' €';
  }
  if (totalItemsBadge) {
    totalItemsBadge.textContent = `${pendingItems.length} pendientes`;
  }

  let visibleItems = allItems;
  if (currentFilter === 'pending') visibleItems = pendingItems;
  if (currentFilter === 'bought') visibleItems = boughtItems;

  if (visibleItems.length === 0) {
    itemsList.innerHTML = '';
    emptyState.classList.remove('d-none');
    return;
  }

  emptyState.classList.add('d-none');
  itemsList.innerHTML = visibleItems.map(item => `
    <div class="card border-0 shadow-sm rounded-4 p-3 product-card ${item.bought ? 'bg-light opacity-50' : 'bg-white'}">
      <div class="d-flex align-items-center gap-3">
        
        <!-- FOTO OFICIAL MERCADONA (prod-mercadona.imgix.net) -->
        <div 
          onclick="openImageModal('${escapeQuotes(item.name)}', '${escapeQuotes(item.imageUrl || '')}', '${escapeQuotes(item.price || '')}')" 
          class="position-relative flex-shrink-0 cursor-pointer" 
          title="Toca para ver la foto oficial en grande"
        >
          <img 
            src="${item.imageUrl || 'https://prod-mercadona.imgix.net/images/048866170d10f274cb3be9f395f5be94.jpg?fit=crop&h=300&w=300'}" 
            alt="${item.name}" 
            class="rounded-3 border p-1 bg-white shadow-2xs" 
            style="width: 78px; height: 78px; object-fit: contain;"
            loading="lazy"
          >
          <span class="badge bg-dark bg-opacity-75 position-absolute bottom-0 end-0 m-1" style="font-size: 0.6rem;">
            🔍
          </span>
        </div>

        <!-- Detalles del Producto Oficial -->
        <div class="flex-grow-1 min-w-0">
          <div class="d-flex align-items-start justify-content-between gap-1">
            <h5 class="h6 mb-0 fw-bold text-dark text-truncate ${item.bought ? 'text-decoration-line-through text-muted' : ''}">
              ${escapeHtml(item.name)}
            </h5>
            
            <button 
              onclick="deleteItem('${item.id}')" 
              class="btn btn-link btn-sm text-secondary p-0 text-decoration-none" 
              title="Eliminar de la lista"
            >
              <i class="bi bi-x-lg" style="font-size: 0.8rem;"></i>
            </button>
          </div>

          <!-- Badges Oficiales de Mercadona: Precio y Envase -->
          <div class="d-flex align-items-center gap-1.5 mt-1 flex-wrap">
            <span class="badge bg-success-subtle text-success border border-success-subtle fw-semibold" style="font-size: 0.68rem;">
              🟢 Mercadona
            </span>

            ${item.price ? `
              <span class="badge bg-success text-white fw-bold" style="font-size: 0.75rem;">
                ${escapeHtml(item.price)}
              </span>
            ` : ''}

            ${item.packaging ? `
              <span class="badge bg-light text-dark border" style="font-size: 0.68rem;">
                ${escapeHtml(item.packaging)}
              </span>
            ` : ''}
          </div>

          <!-- Nota o Encargo Especial de la familia -->
          ${item.note ? `
            <div class="mt-1">
              <span class="badge bg-warning-subtle text-dark border border-warning-subtle text-wrap text-start fw-normal" style="font-size: 0.72rem;">
                💬 ${escapeHtml(item.note)}
              </span>
            </div>
          ` : ''}

          <!-- Pie de tarjeta: Quién lo pidió y botón de tachar -->
          <div class="d-flex align-items-center justify-content-between mt-2 pt-1 border-top border-light-subtle">
            <small class="text-muted fw-semibold" style="font-size: 0.7rem;">
              <i class="bi bi-person"></i> ${escapeHtml(item.addedBy)}
            </small>

            <button 
              onclick="toggleItem('${item.id}', ${!item.bought})" 
              class="btn btn-sm py-1 px-3 rounded-pill fw-bold checkbox-touch ${item.bought ? 'btn-success text-white shadow-2xs' : 'btn-outline-secondary'}"
              style="font-size: 0.75rem;"
            >
              ${item.bought ? '<i class="bi bi-check-circle-fill"></i> Comprado' : '<i class="bi bi-circle"></i> Tachar'}
            </button>
          </div>

        </div>

      </div>
    </div>
  `).join('');
}

// 4. Añadir Producto de Mercadona
async function handleAddItem() {
  const name = productInput.value.trim();
  const note = noteInput.value.trim();
  const addedBy = userSelector.value;

  if (!name) {
    productInput.focus();
    return;
  }

  const payload = {
    name: selectedProductData ? selectedProductData.name : name,
    note,
    addedBy,
    price: selectedProductData ? selectedProductData.price : '',
    packaging: selectedProductData ? selectedProductData.packaging : '',
    imageUrl: selectedProductData ? selectedProductData.image : ''
  };

  try {
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      productInput.value = '';
      noteInput.value = '';
      selectedProductData = null;
      suggestionsBox.classList.add('d-none');
      productInput.focus();
      await fetchItems();
    } else {
      alert(data.error || 'Por favor, selecciona un producto del catálogo de Mercadona.');
    }
  } catch (err) {
    alert('No se pudo conectar con el servidor.');
  }
}

// 5. Tachar con vibración háptica
async function toggleItem(id, bought) {
  if (navigator.vibrate) {
    try { navigator.vibrate(35); } catch (e) {}
  }

  try {
    const res = await fetch(`/api/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bought })
    });
    if (res.ok) fetchItems();
  } catch (err) {
    console.error('Error al actualizar item:', err);
  }
}

// 6. Eliminar
async function deleteItem(id) {
  try {
    const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
    if (res.ok) fetchItems();
  } catch (err) {
    console.error('Error al borrar item:', err);
  }
}

// 7. Limpiar comprados
async function clearBoughtItems() {
  if (!confirm('¿Deseas quitar todos los productos marcados como comprados?')) return;
  try {
    const res = await fetch('/api/items/clear-bought', { method: 'POST' });
    if (res.ok) fetchItems();
  } catch (err) {
    console.error('Error limpiando comprados:', err);
  }
}

// 8. Búsqueda instantánea oficial en tienda.mercadona.es
function handleProductSearch() {
  clearTimeout(searchDebounceTimeout);
  const q = productInput.value.trim();

  if (q.length < 2) {
    suggestionsBox.classList.add('d-none');
    selectedProductData = null;
    return;
  }

  searchDebounceTimeout = setTimeout(async () => {
    try {
      const res = await fetch(`/api/search-products?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      
      if (data.success && data.results.length > 0) {
        suggestionsBox.innerHTML = data.results.map((prod, idx) => `
          <div 
            onclick="selectSuggestion(${idx})" 
            class="p-2 border-bottom d-flex align-items-center gap-2.5 cursor-pointer suggestion-item hover-bg-light"
          >
            <img 
              src="${prod.thumbnail || prod.image}" 
              class="rounded border p-1 bg-white flex-shrink-0" 
              style="width: 52px; height: 52px; object-fit: contain;"
            >
            <div class="flex-grow-1 min-w-0">
              <p class="mb-0 small fw-bold text-dark text-truncate">${escapeHtml(prod.name)}</p>
              <div class="d-flex align-items-center gap-2 mt-0.5">
                <span class="badge bg-success text-white fw-bold" style="font-size: 0.7rem;">${escapeHtml(prod.price || '')}</span>
                <small class="text-muted" style="font-size: 0.7rem;">${escapeHtml(prod.packaging || '')}</small>
                <small class="text-secondary fw-semibold" style="font-size: 0.68rem;">${escapeHtml(prod.brand)}</small>
              </div>
            </div>
          </div>
        `).join('');

        window.currentSuggestions = data.results;
        suggestionsBox.classList.remove('d-none');
      } else {
        suggestionsBox.classList.add('d-none');
      }
    } catch (err) {
      console.warn('Error en autocompletado:', err);
    }
  }, 120);
}

function selectSuggestion(idx) {
  const prod = window.currentSuggestions && window.currentSuggestions[idx];
  if (!prod) return;

  productInput.value = prod.name;
  selectedProductData = prod;
  suggestionsBox.classList.add('d-none');
  noteInput.focus();
}

// 9. Dictado por voz
function initVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    voiceBtn.style.display = 'none';
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'es-ES';
  recognition.continuous = false;
  recognition.interimResults = false;

  voiceBtn.addEventListener('click', () => {
    try {
      recognition.start();
      voiceBtn.classList.add('listening');
      voiceBtnText.textContent = 'Oído...';
    } catch (e) {
      recognition.stop();
    }
  });

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    if (transcript) {
      productInput.value = transcript.trim();
      handleProductSearch();
      noteInput.focus();
    }
  };

  recognition.onend = () => {
    voiceBtn.classList.remove('listening');
    voiceBtnText.textContent = 'Dictar';
  };

  recognition.onerror = () => {
    voiceBtn.classList.remove('listening');
    voiceBtnText.textContent = 'Dictar';
  };
}

// 10. Modal Foto Grande Oficial Mercadona
function openImageModal(name, imageUrl, price) {
  if (!imageUrl) return;
  const modalEl = document.getElementById('imageModal');
  const img = document.getElementById('modalProductImg');
  const title = document.getElementById('modalProductName');
  const priceDisplay = document.getElementById('modalProductPrice');
  
  img.src = imageUrl;
  title.textContent = name;
  if (priceDisplay) priceDisplay.textContent = price || '';
  
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

// 11. Compartir por WhatsApp (100% Mercadona)
function shareOnWhatsApp() {
  const pendingItems = allItems.filter(i => !i.bought);
  const currentUser = userSelector ? userSelector.value : 'Mamá 🌸';
  
  const appUrl = (window.location.origin && !window.location.origin.includes('localhost')) 
    ? window.location.origin 
    : 'https://familia-barbado.onrender.com';
    
  let text = '';

  // CASO 1: La lista está vacía
  if (pendingItems.length === 0) {
    text = `🛒 *¡Familia, voy a ir a Mercadona!* 🟢\n\n` +
           `La lista está vacía ahora mismo. Entrad desde el móvil y apuntad lo que queráis que traiga:\n\n` +
           `👉 ${appUrl}\n\n` +
           `_¡Avisadme antes de que pase por caja!_ ✨ [Enviado por ${currentUser}]`;
  } 
  // CASO 2: La lista tiene productos
  else {
    text = `🛒 *Lista de la Compra Mercadona* 🟢\n\n`;

    pendingItems.forEach(item => {
      text += `• ${item.name}`;
      if (item.price) text += ` (${item.price})`;
      if (item.note) text += ` - _"${item.note}"_`;
      text += ` [${item.addedBy}]\n`;
    });
    text += `\n`;

    let totalCost = 0;
    pendingItems.forEach(i => {
      if (i.price) {
        const num = parseFloat(i.price.replace('€', '').replace(',', '.').trim());
        if (!isNaN(num)) totalCost += num;
      }
    });

    if (totalCost > 0) {
      text += `💶 *Total estimado Mercadona:* ${totalCost.toFixed(2)} €\n\n`;
    }

    text += `¿Falta algo más? Apuntadlo aquí:\n👉 ${appUrl}\n\n`;
    text += `_[Enviado por ${currentUser}]_`;
  }

  // Abrir WhatsApp
  if (navigator.share) {
    navigator.share({ title: 'Lista Mercadona', text }).catch(() => {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    });
  } else {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  }
}

// 12. Filtros por Estado
function setFilter(filter) {
  currentFilter = filter;
  const btnPending = document.getElementById('filterPending');
  const btnBought = document.getElementById('filterBought');
  const btnAll = document.getElementById('filterAll');

  btnPending.className = filter === 'pending' ? 'btn btn-sm btn-dark rounded-pill fw-bold px-3' : 'btn btn-sm text-secondary rounded-pill fw-semibold px-3';
  btnBought.className = filter === 'bought' ? 'btn btn-sm btn-dark rounded-pill fw-bold px-3' : 'btn btn-sm text-secondary rounded-pill fw-semibold px-3';
  btnAll.className = filter === 'all' ? 'btn btn-sm btn-dark rounded-pill fw-bold px-3' : 'btn btn-sm text-secondary rounded-pill fw-semibold px-3';

  renderItems();
}

// Utilidades
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function escapeQuotes(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'");
}
