/**
 * QUÉ HUEVONES: ¡Hay que tener de estos!
 * Lógica interactiva de catálogo, cálculo de subtotales en tiempo real,
 * historia interactiva, prueba de la yema y pedidos directos por WhatsApp.
 */

const WHATSAPP_NUMBER = '56987654321';

// Catálogo oficial de productos (Formatos 12, 30 y 60 en Campo y Blanco Seleccionado)
const PRODUCTS = [
  {
    id: 'campo-12',
    category: 'campo',
    typeLabel: 'Huevos de Campo (Color)',
    name: 'Docena de Campo',
    format: 'Docena (12 un.)',
    eggsCount: 12,
    caliberBadge: 'Tamaño Extra / Tremendo Huevo',
    weightRange: '63g – 68g por huevo',
    price: 4200,
    badge: 'Ideal para Probar',
    popular: false,
    description: '12 huevos de campo de cáscara marrón firme y yema dorada intensa. Recolectados a mano de gallinas 100% libres.',
    features: ['Gallinas de libre pastoreo', 'Yema color sol natural', 'Empaque de pulpa ecológica']
  },
  {
    id: 'campo-30',
    category: 'campo',
    typeLabel: 'Huevos de Campo (Color)',
    name: 'Bandeja Familiar de Campo',
    format: 'Bandeja Familiar (30 un.)',
    eggsCount: 30,
    caliberBadge: 'Tamaño Extra / Tremendo Huevo',
    weightRange: '64g – 69g por huevo',
    price: 8900,
    badge: '🔥 El Más Vendido',
    popular: true,
    description: 'Nuestra bandeja campeona de 30 huevos de campo calibre Extra. El formato favorito para desayunos potentes toda la semana.',
    features: ['Mejor relación precio/calidad', 'Calibre Extra seleccionado', 'Recolección del día (<24 hrs)']
  },
  {
    id: 'campo-60',
    category: 'campo',
    typeLabel: 'Huevos de Campo (Color)',
    name: 'Caja Mayorista de Campo',
    format: 'Caja Mayorista (60 un.)',
    eggsCount: 60,
    caliberBadge: 'Tamaño Extra / Tremendo Huevo',
    weightRange: '64g – 69g por huevo',
    price: 16900,
    badge: '🚚 Envío Gratis Incluido',
    popular: false,
    description: '2 bandejas completas (60 unidades) de huevos de campo peso pesado. Pensado para familias deportistas, repostería o negocios.',
    features: ['Ahorro mayorista directo', 'Despacho prioritario gratis', 'Garantía Cero Quebrados']
  },
  {
    id: 'blanco-12',
    category: 'blanco',
    typeLabel: 'Huevos Seleccionados (Blancos)',
    name: 'Docena Blanca Seleccionada',
    format: 'Docena (12 un.)',
    eggsCount: 12,
    caliberBadge: 'Tamaño Extra / Tremendo Huevo',
    weightRange: '63g – 68g por huevo',
    price: 3600,
    badge: 'Frescura Total',
    popular: false,
    description: '12 huevos blancos seleccionados uno a uno por tamaño y frescura. Clara densa ideal para batidos, merengues y sartén.',
    features: ['Alimentación 100% grano natural', 'Clara firme de alta proteína', 'Empaque protector reciclable']
  },
  {
    id: 'blanco-30',
    category: 'blanco',
    typeLabel: 'Huevos Seleccionados (Blancos)',
    name: 'Bandeja Familiar Blanca',
    format: 'Bandeja Familiar (30 un.)',
    eggsCount: 30,
    caliberBadge: 'Tamaño Extra / Tremendo Huevo',
    weightRange: '63g – 68g por huevo',
    price: 7600,
    badge: '⭐ Favorito en Cocina',
    popular: false,
    description: '30 huevos blancos calibre Extra con yema firme y sabor limpio. Rinden el doble que un huevo pequeño de supermercado.',
    features: ['30 unidades peso pesado', 'Sin jaulas ni hormonas', 'Frescura garantizada 24/48h']
  },
  {
    id: 'blanco-60',
    category: 'blanco',
    typeLabel: 'Huevos Seleccionados (Blancos)',
    name: 'Caja Mayorista Blanca',
    format: 'Caja Mayorista (60 un.)',
    eggsCount: 60,
    caliberBadge: 'Tamaño Extra / Tremendo Huevo',
    weightRange: '63g – 68g por huevo',
    price: 14500,
    badge: '💪 Rendimiento Máximo',
    popular: false,
    description: 'Pack ahorro de 60 huevos blancos seleccionados calibre Extra (2 bandejas de 30 un.) con despacho gratis a tu puerta.',
    features: ['Precio mayorista conveniente', 'Despacho gratis incluido', 'Reposición 2x1 ante roturas']
  }
];

// Estado de cantidades en las tarjetas del catálogo (por defecto 1 en cada tarjeta para ver subtotal inmediato)
const cardQuantities = {
  'campo-12': 1,
  'campo-30': 1,
  'campo-60': 1,
  'blanco-12': 1,
  'blanco-30': 1,
  'blanco-60': 1
};

// Estado del Pedido / Canasta del usuario (inicia con 1 Bandeja Familiar de Campo sugerida)
let orderCart = {
  'campo-30': 1
};

let activeFilter = 'all';

// Frases rotativas del Badge del 80% en el Hero
const CUSTOMER_QUOTES = [
  '"¡Tremendo huevo al conocer!"',
  '"¡Dos de estos llenan toda la paila al desayuno!"',
  '"¡La yema es tan dorada que parece sol de campo!"',
  '"¡No vuelvo más a los huevos chicos de supermercado!"'
];
let currentQuoteIdx = 0;

// Datos de las 3 etapas de "Nuestra Historia & Huevos Felices"
const STORY_STEPS = [
  {
    badge: 'Etapa 1 de 3 • Libertad Total',
    stat: '☀️ +8 horas diarias de pastoreo al aire libre',
    title: 'Gallinas que viven como gallinas, no en jaulas',
    description:
      'Abren las puertas del gallinero al amanecer y nuestras aves salen a caminar, escarbar la tierra, picotear tréboles y tomar sol. Sin hacinamiento ni luz artificial forzada. Una gallina sin estrés tiene un sistema inmunológico fuerte y pone huevos naturalmente extraordinarios.',
    bullets: [
      {
        title: '🌱 Pastoreo Libre en Pradera',
        text: 'Espacio abierto real para correr, aletear y comportarse de forma 100% natural.'
      },
      {
        title: '☀️ Sol y Baños de Tierra Diarios',
        text: 'Sintetizan vitamina D de forma natural y mantienen su plumaje sano sin químicos.'
      }
    ],
    metrics: ['+40%', 'Extra Firme', '< 24 hrs']
  },
  {
    badge: 'Etapa 2 de 3 • Bienestar & Nutrición Real',
    stat: '🌽 Dieta 100% maíz, granos limpios y pasto fresco',
    title: 'La felicidad de la gallina se nota al partir el huevo',
    description:
      'El color dorado intenso de nuestras yemas no viene de colorantes sintéticos: nace del maíz entero, brotes verdes e insectos que las gallinas encuentran en el campo. Eso produce claras densas que no parecen agua y cáscaras resistentes.',
    bullets: [
      {
        title: '🍳 Yemas Altas y Cremosas',
        text: 'Mayor concentración de antioxidantes, omega-3 natural y proteínas de alto valor.'
      },
      {
        title: '🛡️ Cáscara Firme Natural',
        text: 'Aporte equilibrado de calcio natural y cero estrés, evitando huevos débiles.'
      }
    ],
    metrics: ['100% Natural', 'Alta Densidad', '0% Jaulas']
  },
  {
    badge: 'Etapa 3 de 3 • Recolección Artesanal & Eco-Despacho',
    stat: '🧺 Recolección manual cada mañana y selección calibre XL',
    title: 'Del nido a tu puerta en 24/48 horas sin intermediarios',
    description:
      'Mientras un huevo industrial puede pasar semanas en bodegas antes de llegar a tu mesa, en Qué Huevones recolectamos a mano cada mañana, seleccionamos solo los de tamaño Extra ("Tremendo Huevo") y despachamos en bandejas biodegradables.',
    bullets: [
      {
        title: '♻️ Bandejas de Pulpa Retornables',
        text: 'Embalaje ecológico anti-golpes. Recibimos tus bandejas limpias para darles nueva vida.'
      },
      {
        title: '🚚 Ruta Directa Sin Intermediarios',
        text: 'Trato directo con nuestra granja familiar y garantía de reposición inmediata.'
      }
    ],
    metrics: ['Calibre XL', '100% Eco', '24/48 hrs']
  }
];

/**
 * Formatea números a pesos chilenos ($8.900)
 */
function formatCLP(amount) {
  return '$' + Number(amount).toLocaleString('es-CL');
}

/**
 * Cambia la cita interactiva del Hero Section
 */
function cycleCustomerQuote() {
  currentQuoteIdx = (currentQuoteIdx + 1) % CUSTOMER_QUOTES.length;
  const quoteEl = document.getElementById('dynamic-quote-text');
  if (!quoteEl) return;
  quoteEl.style.opacity = '0';
  setTimeout(() => {
    quoteEl.textContent = CUSTOMER_QUOTES[currentQuoteIdx];
    quoteEl.style.opacity = '1';
  }, 150);
}

/**
 * Micro-laboratorio interactivo en el Hero: Prueba de la Yema (Qué Huevones vs Industrial)
 */
function switchYolkTest(mode) {
  const btnQh = document.getElementById('yolk-btn-qh');
  const btnInd = document.getElementById('yolk-btn-ind');
  const circle = document.getElementById('yolk-circle');
  const title = document.getElementById('yolk-title');
  const tag = document.getElementById('yolk-tag');
  const desc = document.getElementById('yolk-desc');

  if (mode === 'qh') {
    btnQh.className = 'px-3 py-1.5 rounded-lg text-xs font-extrabold bg-qh-brown text-white transition';
    btnInd.className = 'px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition';

    circle.className = 'w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 shadow-lg shadow-orange-500/50 flex items-center justify-center animate-yolk-pop';
    title.textContent = 'Yema Dorada Firme y Alta';
    title.className = 'font-display font-extrabold text-sm text-amber-400';
    tag.textContent = '100% Campo Libre';
    tag.className = 'px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px]';
    desc.textContent = 'Clara densa que no se desparrama en la paila y yema color naranja intenso gracias al pastoreo libre al sol.';
  } else {
    btnInd.className = 'px-3 py-1.5 rounded-lg text-xs font-extrabold bg-slate-600 text-white transition';
    btnQh.className = 'px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition';

    circle.className = 'w-8 h-8 rounded-full bg-yellow-200 border border-yellow-300 flex items-center justify-center animate-yolk-pop';
    title.textContent = 'Yema Pálida y Clara Aguada';
    title.className = 'font-display font-extrabold text-sm text-slate-300';
    tag.textContent = 'Jaula / Bodega';
    tag.className = 'px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-bold text-[10px]';
    desc.textContent = 'Semanas de almacenamiento en frío: la clara se abre como agua en el sartén y la yema se rompe con mirarla.';
  }
}

/**
 * Cambia la pestaña activa en "Nuestra Historia & Huevos Felices"
 */
function selectStoryStep(index) {
  const step = STORY_STEPS[index];
  if (!step) return;

  // Actualizar estilos de los botones tab
  [0, 1, 2].forEach((i) => {
    const tabBtn = document.getElementById(`story-tab-${i}`);
    if (!tabBtn) return;
    const badgeSpan = tabBtn.querySelector('span');
    const subtitleSpan = tabBtn.querySelector('div > span');
    const pText = tabBtn.querySelector('p');

    if (i === index) {
      tabBtn.className = 'story-tab text-left p-5 sm:p-6 rounded-2xl border-2 border-qh-brown bg-qh-navy text-white shadow-xl transition-all';
      if (badgeSpan) badgeSpan.className = 'w-11 h-11 rounded-xl bg-qh-brown text-white font-display font-extrabold text-lg flex items-center justify-center flex-shrink-0';
      if (subtitleSpan) subtitleSpan.className = 'text-xs font-bold uppercase tracking-wider text-qh-brownLight';
      if (pText) pText.className = 'text-xs sm:text-sm text-slate-300 mt-1.5';
    } else {
      tabBtn.className = 'story-tab text-left p-5 sm:p-6 rounded-2xl border-2 border-slate-200 bg-white text-qh-navy hover:border-qh-brown/60 shadow-sm transition-all';
      if (badgeSpan) badgeSpan.className = 'w-11 h-11 rounded-xl bg-qh-navy/10 text-qh-navy font-display font-extrabold text-lg flex items-center justify-center flex-shrink-0';
      if (subtitleSpan) subtitleSpan.className = 'text-xs font-bold uppercase tracking-wider text-qh-brown';
      if (pText) pText.className = 'text-xs sm:text-sm text-slate-600 mt-1.5';
    }
  });

  // Actualizar contenido del panel derecho
  document.getElementById('story-detail-badge').textContent = step.badge;
  document.getElementById('story-detail-stat').textContent = step.stat;
  document.getElementById('story-detail-title').textContent = step.title;
  document.getElementById('story-detail-description').textContent = step.description;

  const bulletsContainer = document.getElementById('story-detail-bullets');
  bulletsContainer.innerHTML = step.bullets
    .map(
      (b) => `
      <div class="p-4 rounded-2xl bg-white/5 border border-white/10">
        <p class="font-display font-bold text-qh-brownLight text-sm">${b.title}</p>
        <p class="text-xs text-slate-300 mt-1">${b.text}</p>
      </div>
    `
    )
    .join('');

  document.getElementById('story-metric-1').textContent = step.metrics[0];
  document.getElementById('story-metric-2').textContent = step.metrics[1];
  document.getElementById('story-metric-3').textContent = step.metrics[2];
}

/**
 * Filtra el catálogo por categoría ('all' | 'campo' | 'blanco')
 */
function filterCatalog(category) {
  activeFilter = category;

  const tabs = {
    all: document.getElementById('filter-btn-all'),
    campo: document.getElementById('filter-btn-campo'),
    blanco: document.getElementById('filter-btn-blanco')
  };

  Object.keys(tabs).forEach((key) => {
    const btn = tabs[key];
    if (!btn) return;
    if (key === category) {
      btn.className =
        'catalog-tab px-4 py-2.5 rounded-xl font-display font-bold text-xs sm:text-sm bg-qh-navy text-white shadow transition-all flex items-center gap-2';
    } else {
      btn.className =
        'catalog-tab px-4 py-2.5 rounded-xl font-display font-bold text-xs sm:text-sm text-qh-navy hover:bg-white transition-all flex items-center gap-2';
    }
  });

  renderCatalog();
}

/**
 * Renderiza las tarjetas de producto interactivas en #catalog-grid
 */
function renderCatalog() {
  const grid = document.getElementById('catalog-grid');
  if (!grid) return;

  const filteredProducts =
    activeFilter === 'all'
      ? PRODUCTS
      : PRODUCTS.filter((item) => item.category === activeFilter);

  grid.innerHTML = filteredProducts
    .map((product) => {
      const qty = cardQuantities[product.id] || 1;
      const subtotal = product.price * qty;
      const unitPrice = Math.round(product.price / product.eggsCount);
      const isCampo = product.category === 'campo';

      return `
      <article class="product-card rounded-3xl bg-qh-bone border-2 ${
        product.popular ? 'border-qh-brown ring-4 ring-qh-brown/15' : 'border-slate-200/90'
      } p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden">
        
        <!-- Cinta superior de Destacado -->
        <div>
          <div class="flex items-center justify-between gap-2 mb-4">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${
              isCampo
                ? 'bg-qh-brown/15 text-qh-brown border border-qh-brown/30'
                : 'bg-qh-navy/10 text-qh-navy border border-qh-navy/20'
            }">
              <span class="w-2.5 h-2.5 rounded-full ${isCampo ? 'bg-qh-brown' : 'bg-white border border-qh-navy'}"></span>
              ${product.typeLabel}
            </span>
            <span class="px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${
              product.popular ? 'bg-qh-brown text-white' : 'bg-white text-qh-navy border border-slate-200'
            }">
              ${product.badge}
            </span>
          </div>

          <!-- Cabecera con Ilustración 3D del Huevo y Formato -->
          <div class="flex items-center gap-4 mb-4">
            <div class="w-14 h-16 ${isCampo ? 'egg-shape-campo' : 'egg-shape-blanco'} flex-shrink-0 flex items-center justify-center">
              <span class="font-display font-extrabold text-xs ${
                isCampo ? 'text-white/90' : 'text-qh-navy'
              } bg-black/15 px-1.5 py-0.5 rounded-md backdrop-blur-xs">
                ${product.eggsCount}u
              </span>
            </div>
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-slate-500 block">${product.format}</span>
              <h3 class="font-display font-extrabold text-2xl text-qh-navy leading-tight">${product.name}</h3>
            </div>
          </div>

          <!-- Indicador de Calibre: "Tamaño Extra / Tremendo Huevo" -->
          <div class="mb-4 p-3 rounded-2xl bg-white border border-slate-200/90 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="text-base">🥊</span>
              <div>
                <span class="text-xs font-extrabold text-qh-navy block">${product.caliberBadge}</span>
                <span class="text-[11px] text-slate-500">Peso certificado: ${product.weightRange}</span>
              </div>
            </div>
            <span class="px-2.5 py-1 rounded-lg bg-amber-400/20 text-amber-900 font-display font-extrabold text-xs">
              XL
            </span>
          </div>

          <!-- Descripción y bullets -->
          <p class="text-sm text-slate-600 leading-relaxed mb-4">
            ${product.description}
          </p>

          <ul class="space-y-1.5 mb-6 text-xs font-semibold text-slate-700">
            ${product.features
              .map(
                (feat) => `
              <li class="flex items-center gap-2">
                <span class="w-4 h-4 rounded-full bg-qh-brown/20 text-qh-brown flex items-center justify-center text-[10px] font-bold">✓</span>
                <span>${feat}</span>
              </li>
            `
              )
              .join('')}
          </ul>
        </div>

        <!-- Bloque Inferior: Precio, Selector de Cantidad con Subtotal en Tiempo Real y Botón "Pedir al tiro" -->
        <div class="pt-5 border-t border-slate-200/90 space-y-4">
          
          <!-- Precio base y valor por unidad -->
          <div class="flex items-baseline justify-between">
            <div>
              <span class="text-xs font-bold text-slate-500 block">Precio por formato:</span>
              <span class="font-display font-extrabold text-2xl text-qh-navy">${formatCLP(product.price)}</span>
            </div>
            <span class="text-xs font-bold text-qh-brown bg-qh-brown/10 px-2.5 py-1 rounded-lg">
              ${formatCLP(unitPrice)} c/huevo
            </span>
          </div>

          <!-- Selector interactivo de cantidad + Subtotal en tiempo real -->
          <div class="p-3.5 rounded-2xl bg-white border border-slate-200 flex items-center justify-between gap-3">
            <div>
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Cantidad</span>
              <div class="inline-flex items-center gap-2 mt-1">
                <button type="button" onclick="updateCardQty('${product.id}', -1)"
                        class="w-8 h-8 rounded-lg bg-qh-bone hover:bg-qh-navy hover:text-white text-qh-navy font-extrabold text-base flex items-center justify-center transition"
                        aria-label="Disminuir cantidad">
                  −
                </button>
                <span id="card-qty-${product.id}" class="w-7 text-center font-display font-extrabold text-base text-qh-navy">
                  ${qty}
                </span>
                <button type="button" onclick="updateCardQty('${product.id}', 1)"
                        class="w-8 h-8 rounded-lg bg-qh-bone hover:bg-qh-navy hover:text-white text-qh-navy font-extrabold text-base flex items-center justify-center transition"
                        aria-label="Aumentar cantidad">
                  +
                </button>
              </div>
            </div>

            <div class="text-right">
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Subtotal (${qty * product.eggsCount} huevos)
              </span>
              <span id="card-subtotal-${product.id}" class="font-display font-extrabold text-xl text-qh-brown">
                ${formatCLP(subtotal)}
              </span>
            </div>
          </div>

          <!-- Botón por producto: "Pedir al tiro" -->
          <div class="grid grid-cols-5 gap-2">
            <button type="button" onclick="orderImmediately('${product.id}')"
                    class="col-span-4 py-3.5 px-4 rounded-xl bg-qh-brown hover:bg-qh-brownHover text-white font-display font-extrabold text-sm sm:text-base shadow-lg shadow-qh-brown/25 flex items-center justify-center gap-2 active:scale-95 transition-all">
              <span>🥊 Pedir al tiro</span>
              <span>•</span>
              <span id="card-btn-subtotal-${product.id}">${formatCLP(subtotal)}</span>
            </button>
            <button type="button" onclick="addToOrderCart('${product.id}')"
                    title="Agregar a mi canasta para combinar bandejas"
                    class="col-span-1 py-3.5 rounded-xl bg-qh-navy hover:bg-qh-navyLight text-white font-bold text-sm flex items-center justify-center transition">
              +🧺
            </button>
          </div>

        </div>
      </article>
    `;
    })
    .join('');
}

/**
 * Actualiza la cantidad seleccionada en una tarjeta y recalcula el subtotal en tiempo real
 */
function updateCardQty(productId, delta) {
  const current = cardQuantities[productId] || 1;
  const next = Math.max(1, Math.min(25, current + delta));
  cardQuantities[productId] = next;

  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) return;

  const subtotal = product.price * next;
  const qtyEl = document.getElementById(`card-qty-${productId}`);
  const subEl = document.getElementById(`card-subtotal-${productId}`);
  const btnSubEl = document.getElementById(`card-btn-subtotal-${productId}`);

  if (qtyEl) qtyEl.textContent = next;
  if (subEl) {
    subEl.textContent = formatCLP(subtotal);
    subEl.parentElement.querySelector('span').textContent = `Subtotal (${next * product.eggsCount} huevos)`;
  }
  if (btnSubEl) btnSubEl.textContent = formatCLP(subtotal);
}

/**
 * Agrega un producto y su cantidad actual a la canasta general del formulario
 */
function addToOrderCart(productId, silent = false) {
  const qty = cardQuantities[productId] || 1;
  orderCart[productId] = (orderCart[productId] || 0) + qty;
  syncOrderUI();

  if (!silent) {
    const product = PRODUCTS.find((p) => p.id === productId);
    showToast(`🥚 +${qty} ${product.name} agregada a tu pedido`);
  }
}

/**
 * Acción del botón "Pedir al tiro":
 * Carga el producto en el pedido y abre el modal de confirmación rápida con link directo a WhatsApp
 */
function orderImmediately(productId) {
  const qty = cardQuantities[productId] || 1;
  orderCart[productId] = qty;
  syncOrderUI();

  const product = PRODUCTS.find((p) => p.id === productId);
  const subtotal = product.price * qty;
  const totalEggs = product.eggsCount * qty;

  const waMessage = `¡Hola Qué Huevones! 🥚🥊 Quiero pedir al tiro:\n• ${qty}x ${product.name} (${product.format} - ${product.typeLabel})\n• Total Huevos: ${totalEggs} un. Calibre Extra\n• Subtotal: ${formatCLP(subtotal)}\n\nQuedo atento para coordinar dirección y horario de entrega.`;
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waMessage)}`;

  const modal = document.getElementById('order-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalWaLink = document.getElementById('modal-whatsapp-link');

  modalTitle.textContent = '¡Tu Bandeja está Lista!';
  modalBody.innerHTML = `
    <div class="flex items-center justify-between border-b border-slate-200 pb-2.5">
      <div>
        <p class="font-display font-extrabold text-base text-qh-navy">${qty}x ${product.name}</p>
        <p class="text-xs text-slate-600">${product.format} • ${product.typeLabel}</p>
      </div>
      <span class="font-display font-extrabold text-lg text-qh-brown">${formatCLP(subtotal)}</span>
    </div>
    <div class="flex items-center justify-between text-xs pt-1 text-slate-600">
      <span>Calibre certificado:</span>
      <strong class="text-qh-navy">${product.caliberBadge} (${totalEggs} huevos)</strong>
    </div>
    <div class="flex items-center justify-between text-xs text-slate-600">
      <span>Despacho estimado:</span>
      <strong class="text-emerald-700">24/48 hrs con embalaje ecológico</strong>
    </div>
  `;
  modalWaLink.href = waUrl;

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeOrderModal() {
  const modal = document.getElementById('order-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function closeOrderModalAndScrollForm() {
  closeOrderModal();
  scrollToOrderForm();
}

function scrollToOrderForm() {
  const contactSection = document.getElementById('contacto');
  if (contactSection) {
    contactSection.scrollIntoView({ behavior: 'smooth' });
  }
}

/**
 * Agrega el formato elegido desde el <select> del formulario de contacto
 */
function addFromFormSelect() {
  const selectEl = document.getElementById('order-QuickSelect');
  if (!selectEl) return;
  const productId = selectEl.value;
  orderCart[productId] = (orderCart[productId] || 0) + 1;
  syncOrderUI();
  const product = PRODUCTS.find((p) => p.id === productId);
  if (product) {
    showToast(`🥚 +1 ${product.name} añadida al formulario`);
  }
}

/**
 * Cambia la cantidad de un ítem directamente dentro del formulario de pedido
 */
function updateFormItemQty(productId, delta) {
  const current = orderCart[productId] || 0;
  const next = current + delta;
  if (next <= 0) {
    delete orderCart[productId];
  } else {
    orderCart[productId] = next;
  }
  syncOrderUI();
}

function clearOrderCart() {
  orderCart = {};
  syncOrderUI();
}

/**
 * Sincroniza todos los contadores, el banner del catálogo y la lista del formulario de pedido
 */
function syncOrderUI() {
  const container = document.getElementById('order-items-container');
  const formTotalEl = document.getElementById('order-form-total');
  const totalEggsEl = document.getElementById('order-total-eggs');
  const bannerTotalEl = document.getElementById('summary-banner-total');
  const headerBadge = document.getElementById('header-cart-badge');
  const mobileBadge = document.getElementById('mobile-cart-badge');

  const productIds = Object.keys(orderCart);
  let totalAmount = 0;
  let totalTrays = 0;
  let totalEggs = 0;

  if (productIds.length === 0) {
    if (container) {
      container.innerHTML = `
        <div class="p-4 rounded-xl bg-white border border-dashed border-slate-300 text-center text-xs text-slate-500">
          No hay bandejas seleccionadas. Elige una arriba o presiona <strong>"Pedir al tiro"</strong> en el catálogo.
        </div>
      `;
    }
  } else {
    const rowsHtml = productIds
      .map((id) => {
        const product = PRODUCTS.find((p) => p.id === id);
        if (!product) return '';
        const qty = orderCart[id];
        const itemSub = product.price * qty;
        totalAmount += itemSub;
        totalTrays += qty;
        totalEggs += product.eggsCount * qty;

        return `
          <div class="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="font-display font-bold text-xs sm:text-sm text-qh-navy truncate">${product.name}</p>
              <p class="text-[11px] text-slate-500">${product.format} • ${formatCLP(product.price)} c/u</p>
            </div>
            <div class="flex items-center gap-2.5 flex-shrink-0">
              <div class="inline-flex items-center gap-1.5 bg-qh-bone px-2 py-1 rounded-lg">
                <button type="button" onclick="updateFormItemQty('${id}', -1)" class="w-5 h-5 rounded bg-white text-qh-navy font-bold text-xs flex items-center justify-center">−</button>
                <span class="font-display font-extrabold text-xs text-qh-navy w-4 text-center">${qty}</span>
                <button type="button" onclick="updateFormItemQty('${id}', 1)" class="w-5 h-5 rounded bg-white text-qh-navy font-bold text-xs flex items-center justify-center">+</button>
              </div>
              <span class="font-display font-extrabold text-xs sm:text-sm text-qh-brown w-20 text-right">${formatCLP(itemSub)}</span>
            </div>
          </div>
        `;
      })
      .join('');

    if (container) container.innerHTML = rowsHtml;
  }

  if (formTotalEl) formTotalEl.textContent = formatCLP(totalAmount);
  if (totalEggsEl) totalEggsEl.textContent = `${totalEggs} huevos calibre Extra en ${totalTrays} formato(s)`;
  if (bannerTotalEl) bannerTotalEl.textContent = formatCLP(totalAmount);
  if (headerBadge) headerBadge.textContent = totalTrays;
  if (mobileBadge) mobileBadge.textContent = totalTrays;
}

/**
 * Procesa el envío del formulario de pedido rápido hacia WhatsApp con mensaje preconfigurado completo
 */
function handleOrderSubmit(event) {
  event.preventDefault();
  const message = buildOrderSummaryText();
  if (!message) return;

  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Genera el comprobante instantáneo en el modal web
 */
function confirmWebOrder() {
  const name = document.getElementById('order-name').value.trim() || 'Cliente Huevón';
  const address = document.getElementById('order-address').value.trim() || 'Dirección por confirmar';
  const zone = document.getElementById('order-zone').value;
  const phone = document.getElementById('order-phone').value.trim() || 'Por confirmar';

  if (Object.keys(orderCart).length === 0) {
    showToast('⚠️ Agrega al menos una bandeja a tu pedido primero');
    return;
  }

  let totalAmount = 0;
  const itemsListHtml = Object.keys(orderCart)
    .map((id) => {
      const p = PRODUCTS.find((item) => item.id === id);
      const q = orderCart[id];
      const sub = p.price * q;
      totalAmount += sub;
      return `<li class="flex justify-between text-xs py-1 border-b border-slate-200/70"><span>${q}x ${p.name} (${p.format})</span><strong>${formatCLP(sub)}</strong></li>`;
    })
    .join('');

  const waText = buildOrderSummaryText() || '¡Hola! Quiero pedir mis bandejas de Qué Huevones';
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waText)}`;

  const modal = document.getElementById('order-modal');
  document.getElementById('modal-title').textContent = `¡Pedido Registrado, ${name}!`;
  document.getElementById('modal-body').innerHTML = `
    <p class="text-xs text-slate-600 mb-2">Entrega en: <strong class="text-qh-navy">${address} (${zone})</strong> • Tel: ${phone}</p>
    <ul class="space-y-1 mb-3">${itemsListHtml}</ul>
    <div class="flex items-center justify-between pt-2">
      <span class="font-bold text-xs uppercase text-slate-500">Total a Pagar:</span>
      <span class="font-display font-extrabold text-xl text-qh-brown">${formatCLP(totalAmount)}</span>
    </div>
  `;
  document.getElementById('modal-whatsapp-link').href = waUrl;

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function buildOrderSummaryText() {
  const name = document.getElementById('order-name').value.trim();
  const phone = document.getElementById('order-phone').value.trim();
  const address = document.getElementById('order-address').value.trim();
  const zone = document.getElementById('order-zone').value;
  const notes = document.getElementById('order-notes').value.trim();

  if (Object.keys(orderCart).length === 0) {
    showToast('⚠️ Selecciona al menos una bandeja para hacer tu pedido');
    return null;
  }

  let totalAmount = 0;
  let totalEggs = 0;
  const lines = Object.keys(orderCart).map((id) => {
    const p = PRODUCTS.find((item) => item.id === id);
    const q = orderCart[id];
    const sub = p.price * q;
    totalAmount += sub;
    totalEggs += p.eggsCount * q;
    return `• ${q}x ${p.name} (${p.format}) = ${formatCLP(sub)}`;
  });

  let msg = `¡Hola *QUÉ HUEVONES*! 🥚🥊 Quiero hacer el siguiente pedido:\n\n`;
  msg += `*DETALLE DE BANDEJAS:*\n${lines.join('\n')}\n`;
  msg += `*Total Huevos:* ${totalEggs} unidades (Calibre Extra)\n`;
  msg += `*TOTAL A PAGAR:* ${formatCLP(totalAmount)}\n\n`;
  msg += `*DATOS DE DESPACHO:*\n`;
  msg += `👤 Nombre: ${name || 'Por indicar'}\n`;
  msg += `📞 Teléfono: ${phone || 'Por indicar'}\n`;
  msg += `📍 Dirección: ${address || 'Por indicar'} (${zone})\n`;
  if (notes) {
    msg += `📝 Comentarios: ${notes}\n`;
  }
  return msg;
}

/**
 * Muestra un toast flotante de confirmación
 */
let toastTimeout = null;
function showToast(message) {
  const toast = document.getElementById('toast-notification');
  const msgEl = document.getElementById('toast-message');
  if (!toast || !msgEl) return;

  msgEl.textContent = message;
  toast.classList.remove('hidden');
  toast.classList.add('flex');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
    toast.classList.remove('flex');
  }, 3200);
}

/**
 * Inicialización de eventos (Menú móvil, catálogo, scroll spy)
 */
document.addEventListener('DOMContentLoaded', () => {
  renderCatalog();
  syncOrderUI();

  // Toggle Menú Móvil
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const iconOpen = document.getElementById('menu-icon-open');
  const iconClose = document.getElementById('menu-icon-close');

  if (mobileBtn && mobileMenu) {
    mobileBtn.addEventListener('click', () => {
      const isHidden = mobileMenu.classList.contains('hidden');
      if (isHidden) {
        mobileMenu.classList.remove('hidden');
        iconOpen.classList.add('hidden');
        iconClose.classList.remove('hidden');
        mobileBtn.setAttribute('aria-expanded', 'true');
      } else {
        mobileMenu.classList.add('hidden');
        iconOpen.classList.remove('hidden');
        iconClose.classList.add('hidden');
        mobileBtn.setAttribute('aria-expanded', 'false');
      }
    });

    // Cerrar menú móvil al hacer clic en cualquier enlace
    document.querySelectorAll('.mobile-nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        mobileMenu.classList.add('hidden');
        iconOpen.classList.remove('hidden');
        iconClose.classList.add('hidden');
        mobileBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Cerrar modal con tecla Escape o clic fuera
  const modal = document.getElementById('order-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeOrderModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeOrderModal();
  });

  // Scroll Spy para iluminar sección activa en la barra de navegación
  const sections = ['inicio', 'historia', 'beneficios', 'catalogo', 'contacto'];
  const navLinks = document.querySelectorAll('.nav-link');

  window.addEventListener('scroll', () => {
    const scrollPos = window.scrollY + 140;
    let currentSection = 'inicio';

    sections.forEach((secId) => {
      const el = document.getElementById(secId);
      if (el && scrollPos >= el.offsetTop) {
        currentSection = secId;
      }
    });

    navLinks.forEach((link) => {
      const href = link.getAttribute('href').replace('#', '');
      if (href === currentSection) {
        link.classList.add('active', 'text-white');
      } else {
        link.classList.remove('active', 'text-white');
      }
    });
  });
});
