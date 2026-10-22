/**
 * QUÉ HUEVONES: Para con los cuentos, prueba los verdaderos huevos.
 * Fullstack Frontend Architecture (Producción):
 * 1. Carrito Reactivo (Pedido Único vs Pedido Fijo Semanal) + Código de Embajador + Checkout Directo a WhatsApp (+56953930491)
 * 2. Sistema Oculto de Frontend Analytics en localStorage (arranca en 0 para producción)
 * 3. Sistema de Login Privado (Juanjo / Morensex) + Dashboard Administrativo:
 *    - Control de Pedidos y Aprobación Manual con Confirmación de Embajador
 *    - Finanzas y Saldos (Estado de Cuenta de Socios Juanjo & Morensex/Mati + Pagos a Proveedores)
 *    - Sistema de Embajadores y Comisiones ($800 Docena / $2.000 Bandeja 30 / $4.000 Caja 60)
 */

const WHATSAPP_NUMBER = '56953930491';

// Claves de producción limpias + bandera de reinicio a cero absoluto
const PRODUCTION_RESET_FLAG = 'qh_production_clean_reset_v3';

const STORAGE_KEYS = {
  CART: 'qh_prod_cart_v3',
  ANALYTICS: 'qh_prod_analytics_v3',
  ORDERS: 'qh_prod_orders_v3',
  FINANCES: 'qh_prod_finances_v3',
  AMBASSADORS: 'qh_prod_ambassadors_v3',
  ADMIN_SESSION: 'qh_admin_session_v2'
};

/**
 * Limpia cualquier historial previo de desarrollo/pruebas en localStorage
 * para que la aplicación y el Dashboard arranquen en cero absoluto ($0, 0 pedidos, $0 saldos, $0 comisiones).
 */
function ensureCleanProductionBoot() {
  try {
    const legacyKeys = [
      'qh_cart_state_v2',
      'qh_analytics_v2',
      'qh_orders_v2',
      'qh_analytics_v1',
      'qh_orders_v1',
      'qh_cart_v1'
    ];
    legacyKeys.forEach((k) => localStorage.removeItem(k));

    if (!localStorage.getItem(PRODUCTION_RESET_FLAG)) {
      localStorage.removeItem(STORAGE_KEYS.CART);
      localStorage.removeItem(STORAGE_KEYS.ANALYTICS);
      localStorage.removeItem(STORAGE_KEYS.ORDERS);
      localStorage.removeItem(STORAGE_KEYS.FINANCES);
      localStorage.removeItem(STORAGE_KEYS.AMBASSADORS);
      localStorage.setItem(PRODUCTION_RESET_FLAG, 'true');
    }
  } catch (e) {
    // ignore storage errors
  }
}

// Ejecutar limpieza de desarrollo inmediatamente al cargar el script
ensureCleanProductionBoot();

// Catálogo oficial de productos
const PRODUCTS = [
  {
    id: 'campo-12',
    category: 'campo',
    typeLabel: 'Huevos de Campo (Color)',
    name: 'Docena de Campo',
    format: 'Docena (12 un.)',
    eggsCount: 12,
    commission: 800,
    caliberBadge: 'Calibre Primera / Tamaño Grande',
    qualityNote: 'Huevos de Selección Grande • Yema dorada y cáscara firme',
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
    commission: 2000,
    caliberBadge: 'Calibre Primera / Tamaño Grande',
    qualityNote: 'Huevos de Selección Grande • Yema dorada y cáscara firme',
    price: 8900,
    badge: '🔥 El Más Vendido',
    popular: true,
    description: 'Nuestra bandeja campeona de 30 huevos de campo de Selección Grande. El formato favorito para desayunos potentes toda la semana.',
    features: ['Mejor relación precio/calidad', 'Calibre Primera / Tamaño Grande', 'Recolección del día (<24 hrs)']
  },
  {
    id: 'campo-60',
    category: 'campo',
    typeLabel: 'Huevos de Campo (Color)',
    name: 'Caja Mayorista de Campo',
    format: 'Caja Mayorista (60 un.)',
    eggsCount: 60,
    commission: 4000,
    caliberBadge: 'Huevos de Selección Grande',
    qualityNote: 'Calibre Primera / Tamaño Grande • Cáscara marrón firme',
    price: 16900,
    badge: '🚚 Envío Gratis Incluido',
    popular: false,
    description: '2 bandejas completas (60 unidades) de huevos de campo de Selección Grande. Pensado para familias deportistas, repostería o negocios.',
    features: ['Ahorro mayorista directo', 'Despacho prioritario gratis', 'Garantía Cero Quebrados']
  },
  {
    id: 'blanco-12',
    category: 'blanco',
    typeLabel: 'Huevos Seleccionados (Blancos)',
    name: 'Docena Blanca Seleccionada',
    format: 'Docena (12 un.)',
    eggsCount: 12,
    commission: 800,
    caliberBadge: 'Calibre Primera / Tamaño Grande',
    qualityNote: 'Huevos de Selección Grande • Clara densa y cáscara limpia',
    price: 3600,
    badge: 'Frescura Total',
    popular: false,
    description: '12 huevos blancos seleccionados uno a uno por calidad y frescura. Clara densa ideal para batidos, merengues y sartén.',
    features: ['Alimentación 100% grano natural', 'Clara firme de alta proteína', 'Empaque protector reciclable']
  },
  {
    id: 'blanco-30',
    category: 'blanco',
    typeLabel: 'Huevos Seleccionados (Blancos)',
    name: 'Bandeja Familiar Blanca',
    format: 'Bandeja Familiar (30 un.)',
    eggsCount: 30,
    commission: 2000,
    caliberBadge: 'Calibre Primera / Tamaño Grande',
    qualityNote: 'Huevos de Selección Grande • Yema firme y sabor puro',
    price: 7600,
    badge: '⭐ Favorito en Cocina',
    popular: false,
    description: '30 huevos blancos de Selección Grande con yema firme y sabor limpio. Ideales para la cocina familiar de todos los días.',
    features: ['30 unidades de Selección Grande', 'Sin jaulas ni hormonas', 'Frescura garantizada 24/48h']
  },
  {
    id: 'blanco-60',
    category: 'blanco',
    typeLabel: 'Huevos Seleccionados (Blancos)',
    name: 'Caja Mayorista Blanca',
    format: 'Caja Mayorista (60 un.)',
    eggsCount: 60,
    commission: 4000,
    caliberBadge: 'Huevos de Selección Grande',
    qualityNote: 'Calibre Primera / Tamaño Grande • Clara firme y fresca',
    price: 14500,
    badge: '💪 Rendimiento Máximo',
    popular: false,
    description: 'Pack ahorro de 60 huevos blancos de Selección Grande (2 bandejas de 30 un.) con despacho gratis a tu puerta.',
    features: ['Precio mayorista conveniente', 'Despacho gratis incluido', 'Reposición 2x1 ante roturas']
  }
];

// Catálogo maestro de botones de la página para detectar también cuáles NO se pinchan
const ALL_TRACKABLE_BUTTONS = [
  'Botón Verde WhatsApp: Quiero pedir mi bandeja directo',
  'Drawer Botón Verde: Quiero pedir mi bandeja directo',
  'Header: Pide por WhatsApp',
  'Header: Abrir Carrito',
  'Hero CTA: Ver Bandejas Disponibles',
  'Hero CTA: Hacer Pedido Rápido',
  'Hero: Badge 80% Clientes',
  'Selector Tipo: Pedido Único',
  'Selector Tipo: Pedido Fijo Semanal',
  'Filtro Catálogo: Todos',
  'Filtro Catálogo: Huevos de Campo',
  'Filtro Catálogo: Huevos Blancos',
  'Laboratorio Yema: Qué Huevones',
  'Laboratorio Yema: Industrial',
  'Historia: Etapa 1 Pastoreo Libre',
  'Historia: Etapa 2 Bienestar Animal',
  'Historia: Etapa 3 Recolección Artesanal',
  'Banner Catálogo: Abrir Carrito',
  'Card Derecha: Activar Pedido Fijo Semanal',
  'Carrito: + Sumar Formato desde Selector',
  'Carrito: Vaciar Todo',
  'Footer Social: Instagram',
  'Footer Social: TikTok',
  'Contacto: Clic Correo'
];

// Cantidades temporales en las tarjetas del catálogo
const cardQuantities = {
  'campo-12': 1,
  'campo-30': 1,
  'campo-60': 1,
  'blanco-12': 1,
  'blanco-30': 1,
  'blanco-60': 1
};

// Estado global del Carrito (Arranca en 0 para producción limpia)
let orderCart = {};
let currentOrderType = 'Pedido Único'; // 'Pedido Único' | 'Pedido Fijo Semanal'
let currentAmbassadorCode = '';
let activeFilter = 'all';
let activeAdminTab = 'all';

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
    stat: '🧺 Recolección manual cada mañana y Selección Grande',
    title: 'Del nido a tu puerta en 24/48 horas sin intermediarios',
    description:
      'Mientras un huevo industrial puede pasar semanas en bodegas antes de llegar a tu mesa, en Qué Huevones recolectamos a mano cada mañana, escogemos Huevos de Selección Grande (Calibre Primera) y despachamos en bandejas biodegradables.',
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
    metrics: ['1ª Selección', '100% Eco', '24/48 hrs']
  }
];

function formatCLP(amount) {
  return '$' + Number(amount || 0).toLocaleString('es-CL');
}

function getTodayISODate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/* ==========================================================================
   ESTADO LIMPIO EN CERO ABSOLUTO (PASO A PRODUCCIÓN)
   ========================================================================== */

function getDefaultAnalytics() {
  const productStats = {};
  PRODUCTS.forEach((p) => {
    productStats[p.id] = {
      clicks: 0,
      addedToCart: 0,
      checkouts: 0
    };
  });

  const buttonClicks = {};
  ALL_TRACKABLE_BUTTONS.forEach((btn) => {
    buttonClicks[btn] = 0;
  });

  return {
    pageViews: 0,
    totalClicks: 0,
    addToCartEvents: 0,
    whatsappCheckouts: 0,
    productStats,
    buttonClicks,
    eventLog: []
  };
}

function getDefaultOrders() {
  return [];
}

function getDefaultFinances() {
  return {
    partnerMovements: [], // { id, date, partner: 'Juanjo'|'Morensex', type: 'aporte'|'pago_directo'|'reembolso', amount, concept }
    supplierPayments: []  // { id, date, amount, concept, payer: 'Juanjo'|'Morensex'|'Caja' }
  };
}

function getDefaultAmbassadors() {
  return []; // { id, name, code, createdAt }
}

function loadAnalytics() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ANALYTICS);
    if (!raw) {
      const initial = getDefaultAnalytics();
      localStorage.setItem(STORAGE_KEYS.ANALYTICS, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    ALL_TRACKABLE_BUTTONS.forEach((btn) => {
      if (typeof parsed.buttonClicks[btn] !== 'number') {
        parsed.buttonClicks[btn] = 0;
      }
    });
    PRODUCTS.forEach((p) => {
      if (!parsed.productStats[p.id]) {
        parsed.productStats[p.id] = { clicks: 0, addedToCart: 0, checkouts: 0 };
      }
    });
    if (!Array.isArray(parsed.eventLog)) parsed.eventLog = [];
    return parsed;
  } catch (e) {
    return getDefaultAnalytics();
  }
}

function saveAnalytics(data) {
  try {
    localStorage.setItem(STORAGE_KEYS.ANALYTICS, JSON.stringify(data));
  } catch (e) {
    // ignore
  }
}

function loadOrders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ORDERS);
    if (!raw) {
      const initial = getDefaultOrders();
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return getDefaultOrders();
  }
}

function saveOrders(orders) {
  try {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  } catch (e) {
    // ignore
  }
}

function loadFinances() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FINANCES);
    if (!raw) {
      const initial = getDefaultFinances();
      localStorage.setItem(STORAGE_KEYS.FINANCES, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    return {
      partnerMovements: Array.isArray(parsed.partnerMovements) ? parsed.partnerMovements : [],
      supplierPayments: Array.isArray(parsed.supplierPayments) ? parsed.supplierPayments : []
    };
  } catch (e) {
    return getDefaultFinances();
  }
}

function saveFinances(finances) {
  try {
    localStorage.setItem(STORAGE_KEYS.FINANCES, JSON.stringify(finances));
  } catch (e) {
    // ignore
  }
}

function loadAmbassadors() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AMBASSADORS);
    if (!raw) {
      const initial = getDefaultAmbassadors();
      localStorage.setItem(STORAGE_KEYS.AMBASSADORS, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return getDefaultAmbassadors();
  }
}

function saveAmbassadors(list) {
  try {
    localStorage.setItem(STORAGE_KEYS.AMBASSADORS, JSON.stringify(list));
  } catch (e) {
    // ignore
  }
}

function getNowFormatted() {
  const now = new Date();
  return now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function trackButtonClick(buttonLabel) {
  if (!buttonLabel) return;
  const analytics = loadAnalytics();
  analytics.totalClicks = (analytics.totalClicks || 0) + 1;
  analytics.buttonClicks[buttonLabel] = (analytics.buttonClicks[buttonLabel] || 0) + 1;
  analytics.eventLog.unshift({
    time: getNowFormatted(),
    type: 'BUTTON_CLICK',
    detail: `Clic en botón: "${buttonLabel}"`
  });
  analytics.eventLog = analytics.eventLog.slice(0, 40);
  saveAnalytics(analytics);
  refreshDashboardIfVisible();
}

function trackProductInteraction(productId, actionType, detailMsg) {
  const analytics = loadAnalytics();
  if (!analytics.productStats[productId]) {
    analytics.productStats[productId] = { clicks: 0, addedToCart: 0, checkouts: 0 };
  }
  analytics.totalClicks = (analytics.totalClicks || 0) + 1;
  analytics.productStats[productId].clicks += 1;

  if (actionType === 'ADD_TO_CART') {
    analytics.productStats[productId].addedToCart += 1;
    analytics.addToCartEvents = (analytics.addToCartEvents || 0) + 1;
  }

  analytics.eventLog.unshift({
    time: getNowFormatted(),
    type: actionType,
    detail: detailMsg
  });
  analytics.eventLog = analytics.eventLog.slice(0, 40);
  saveAnalytics(analytics);
  refreshDashboardIfVisible();
}

/* ==========================================================================
   MÓDULO 1: CARRITO DE COMPRAS, CÓDIGO DE EMBAJADOR Y CHECKOUT WHATSAPP
   ========================================================================== */

function loadCartState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CART);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.items && typeof parsed.items === 'object') {
      orderCart = parsed.items;
    }
    if (parsed && parsed.orderType) {
      currentOrderType = parsed.orderType;
    }
    if (parsed && typeof parsed.ambassadorCode === 'string') {
      currentAmbassadorCode = parsed.ambassadorCode;
    }
  } catch (e) {
    // use defaults
  }
}

function saveCartState() {
  try {
    localStorage.setItem(
      STORAGE_KEYS.CART,
      JSON.stringify({
        items: orderCart,
        orderType: currentOrderType,
        ambassadorCode: currentAmbassadorCode
      })
    );
  } catch (e) {
    // ignore
  }
}

function handleAmbassadorInput(value) {
  currentAmbassadorCode = (value || '').trim();
  const mainInput = document.getElementById('ambassador-code-main');
  const drawerInput = document.getElementById('ambassador-code-drawer');
  if (mainInput && mainInput.value !== value) mainInput.value = value;
  if (drawerInput && drawerInput.value !== value) drawerInput.value = value;
  saveCartState();

  const waPreview = document.getElementById('whatsapp-live-preview');
  if (waPreview) {
    waPreview.textContent = buildWhatsAppDirectMessage();
  }
}

function setOrderType(type) {
  currentOrderType = type;
  saveCartState();
  syncOrderUI();
  showToast(`🔄 Modalidad cambiada a: ${type}`);
}

function openCartDrawer() {
  const backdrop = document.getElementById('cart-drawer-backdrop');
  if (backdrop) {
    backdrop.classList.remove('hidden');
    backdrop.classList.add('flex');
  }
}

function closeCartDrawer() {
  const backdrop = document.getElementById('cart-drawer-backdrop');
  if (backdrop) {
    backdrop.classList.add('hidden');
    backdrop.classList.remove('flex');
  }
}

/**
 * Calcula la comisión proporcional de un pedido según sus ítems:
 * - Docena (12 huevos): $800 de comisión por unidad.
 * - Bandeja de 30 huevos: $2.000 de comisión por unidad.
 * - Caja Mayorista (60 huevos): $4.000 de comisión por unidad.
 */
function calculateOrderCommission(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    const qty = Number(item.qty) || 0;
    const product = PRODUCTS.find((p) => p.id === item.id);
    const eggs = product ? product.eggsCount : parseInt(item.format, 10) || 0;
    if (eggs === 12) return sum + qty * 800;
    if (eggs === 30) return sum + qty * 2000;
    if (eggs === 60) return sum + qty * 4000;
    return sum;
  }, 0);
}

/**
 * Construye el mensaje exacto para WhatsApp (+56953930491):
 * - Detalle de los productos y sus cantidades
 * - Si es Pedido Único o Pedido Fijo Semanal
 * - El Subtotal
 * - Si el cliente escribió un código de embajador: "Vengo de parte de: [CÓDIGO/NOMBRE]"
 * - Espacio en blanco para que el cliente solo complete su Nombre y Dirección desde el chat
 */
function buildWhatsAppDirectMessage() {
  const productIds = Object.keys(orderCart);
  const ambassadorLine = currentAmbassadorCode
    ? `🤝 Vengo de parte de: ${currentAmbassadorCode}\n`
    : '';

  if (productIds.length === 0) {
    return (
      `¡Hola *QUÉ HUEVONES*! 🥚🥊\n` +
      `Quiero hacer un *${currentOrderType}*:\n\n` +
      `• (Selecciona tus bandejas en el catálogo o indícanos aquí cuántas quieres)\n\n` +
      `🔄 *Tipo de Pedido:* ${currentOrderType}\n` +
      `${ambassadorLine}\n` +
      `--- Completo mis datos aquí ---\n` +
      `👤 Mi Nombre: \n` +
      `📍 Mi Dirección: `
    );
  }

  let subtotal = 0;
  let totalEggs = 0;

  const lines = productIds.map((id) => {
    const product = PRODUCTS.find((p) => p.id === id);
    const qty = orderCart[id];
    const lineSub = product.price * qty;
    subtotal += lineSub;
    totalEggs += product.eggsCount * qty;
    return `• ${qty}x ${product.name} (${product.format}) = ${formatCLP(lineSub)}`;
  });

  return (
    `¡Hola *QUÉ HUEVONES*! 🥚🥊\n` +
    `Quiero pedir mis bandejas directo:\n\n` +
    `🛒 *DETALLE DEL PEDIDO:*\n` +
    `${lines.join('\n')}\n\n` +
    `🥚 *Total Huevos:* ${totalEggs} un. (Calibre Primera / Selección Grande)\n` +
    `🔄 *Tipo de Pedido:* ${currentOrderType}\n` +
    `💰 *Subtotal:* ${formatCLP(subtotal)}\n` +
    `${ambassadorLine}\n` +
    `--- Completo mis datos aquí ---\n` +
    `👤 Mi Nombre: \n` +
    `📍 Mi Dirección: `
  );
}

/**
 * Ejecuta el Checkout Directo a WhatsApp (+56953930491),
 * guarda el pedido como pendiente de aprobación en el panel administrativo
 * (incluyendo el código de embajador si se ingresó) y abre WhatsApp.
 */
function triggerDirectWhatsAppCheckout(sourceLabel = 'Checkout Directo WhatsApp') {
  // Si el carrito está vacío, agregamos 1 Bandeja Familiar de Campo por defecto para facilitar el pedido rápido
  if (Object.keys(orderCart).length === 0) {
    orderCart['campo-30'] = 1;
    saveCartState();
    syncOrderUI();
    renderCatalog();
  }

  let subtotal = 0;
  let totalEggs = 0;
  const orderItems = [];
  const analytics = loadAnalytics();

  Object.keys(orderCart).forEach((id) => {
    const p = PRODUCTS.find((item) => item.id === id);
    if (!p) return;
    const qty = orderCart[id];
    const lineTotal = p.price * qty;
    subtotal += lineTotal;
    totalEggs += p.eggsCount * qty;

    orderItems.push({
      id: p.id,
      name: p.name,
      format: `${p.eggsCount} un.`,
      eggsCount: p.eggsCount,
      qty,
      price: p.price
    });

    if (!analytics.productStats[id]) {
      analytics.productStats[id] = { clicks: 0, addedToCart: 0, checkouts: 0 };
    }
    analytics.productStats[id].checkouts += qty;
  });

  const orders = loadOrders();
  const nextOrderNum = 1001 + orders.length;
  const now = new Date();
  const formattedDate = now.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const cleanCode = (currentAmbassadorCode || '').trim();
  const commissionAmount = calculateOrderCommission(orderItems);

  const newOrder = {
    id: `QH-${nextOrderNum}`,
    date: formattedDate,
    timestamp: Date.now(),
    clientName: 'Cliente Web WhatsApp',
    orderType: currentOrderType,
    items: orderItems,
    totalEggs,
    subtotal,
    ambassadorCode: cleanCode,
    commissionAmount,
    approved: false,
    status: 'Pendiente Aprobación'
  };

  orders.unshift(newOrder);
  saveOrders(orders);

  // Actualizar métricas de conversión en Analytics
  analytics.whatsappCheckouts = (analytics.whatsappCheckouts || 0) + 1;
  analytics.eventLog.unshift({
    time: getNowFormatted(),
    type: 'CHECKOUT_WHATSAPP',
    detail: `Checkout WhatsApp (${currentOrderType}): ${formatCLP(subtotal)}${cleanCode ? ` • Embajador: ${cleanCode}` : ''}`
  });
  analytics.eventLog = analytics.eventLog.slice(0, 40);
  saveAnalytics(analytics);
  refreshDashboardIfVisible();

  // Abrir enlace automático a WhatsApp +56953930491
  const message = buildWhatsAppDirectMessage();
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank', 'noopener,noreferrer');
}

/* ==========================================================================
   INTERACCIÓN DEL CATÁLOGO Y CARRITO
   ========================================================================== */

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

function selectStoryStep(index) {
  const step = STORY_STEPS[index];
  if (!step) return;

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
      const inCartQty = orderCart[product.id] || 0;

      return `
      <article onclick="handleProductCardClick('${product.id}', event)"
               class="product-card rounded-3xl bg-qh-bone border-2 ${
                 product.popular ? 'border-qh-brown ring-4 ring-qh-brown/15' : 'border-slate-200/90'
               } p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden cursor-pointer">
        
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

          <div class="flex items-center gap-4 mb-4">
            <div class="w-14 h-16 ${isCampo ? 'egg-shape-campo' : 'egg-shape-blanco'} flex-shrink-0 flex items-center justify-center">
              <span class="font-display font-extrabold text-xs ${
                isCampo ? 'text-white/90' : 'text-qh-navy'
              } bg-black/15 px-1.5 py-0.5 rounded-md">
                ${product.eggsCount}u
              </span>
            </div>
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-slate-500 block">${product.format}</span>
              <h3 class="font-display font-extrabold text-2xl text-qh-navy leading-tight">${product.name}</h3>
            </div>
          </div>

          <div class="mb-4 p-3 rounded-2xl bg-white border border-slate-200/90 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="text-base">🥊</span>
              <div>
                <span class="text-xs font-extrabold text-qh-navy block">${product.caliberBadge}</span>
                <span class="text-[11px] text-slate-600">${product.qualityNote}</span>
              </div>
            </div>
            <span class="px-2.5 py-1 rounded-lg bg-amber-400/25 text-amber-950 font-display font-extrabold text-[11px] whitespace-nowrap">
              1ª Selección
            </span>
          </div>

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

        <div class="pt-5 border-t border-slate-200/90 space-y-4">
          <div class="flex items-baseline justify-between">
            <div>
              <span class="text-xs font-bold text-slate-500 block">Precio por formato:</span>
              <span class="font-display font-extrabold text-2xl text-qh-navy">${formatCLP(product.price)}</span>
            </div>
            <div class="text-right">
              <span class="text-xs font-bold text-qh-brown bg-qh-brown/10 px-2.5 py-1 rounded-lg inline-block">
                ${formatCLP(unitPrice)} c/huevo
              </span>
              ${
                inCartQty > 0
                  ? `<span class="block text-[11px] font-extrabold text-emerald-700 mt-1">✓ ${inCartQty} en tu carrito</span>`
                  : ''
              }
            </div>
          </div>

          <div class="p-3.5 rounded-2xl bg-white border border-slate-200 flex items-center justify-between gap-3">
            <div>
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Cantidad</span>
              <div class="inline-flex items-center gap-2 mt-1">
                <button type="button" onclick="event.stopPropagation(); updateCardQty('${product.id}', -1)"
                        class="w-8 h-8 rounded-lg bg-qh-bone hover:bg-qh-navy hover:text-white text-qh-navy font-extrabold text-base flex items-center justify-center transition"
                        aria-label="Disminuir cantidad">
                  −
                </button>
                <span id="card-qty-${product.id}" class="w-7 text-center font-display font-extrabold text-base text-qh-navy">
                  ${qty}
                </span>
                <button type="button" onclick="event.stopPropagation(); updateCardQty('${product.id}', 1)"
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

          <div class="grid grid-cols-5 gap-2">
            <button type="button" onclick="event.stopPropagation(); orderImmediately('${product.id}')"
                    class="col-span-3 py-3.5 px-3 rounded-xl bg-qh-brown hover:bg-qh-brownHover text-white font-display font-extrabold text-xs sm:text-sm shadow-lg shadow-qh-brown/25 flex items-center justify-center gap-1.5 active:scale-95 transition-all">
              <span>🥊 Pedir al tiro</span>
            </button>
            <button type="button" onclick="event.stopPropagation(); addToOrderCart('${product.id}')"
                    class="col-span-2 py-3.5 px-3 rounded-xl bg-qh-navy hover:bg-qh-navyLight text-white font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-1 active:scale-95 transition-all">
              <span>+ Carrito</span>
            </button>
          </div>
        </div>
      </article>
    `;
    })
    .join('');
}

function handleProductCardClick(productId) {
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) return;
  trackProductInteraction(productId, 'PRODUCT_CLICK', `Cliente pinchó tarjeta: ${product.name}`);
}

function updateCardQty(productId, delta) {
  const current = cardQuantities[productId] || 1;
  const next = Math.max(1, Math.min(25, current + delta));
  cardQuantities[productId] = next;

  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) return;

  trackProductInteraction(
    productId,
    'PRODUCT_CLICK',
    `Ajustó selector en tarjeta ${product.name} a ${next} un.`
  );

  const subtotal = product.price * next;
  const qtyEl = document.getElementById(`card-qty-${productId}`);
  const subEl = document.getElementById(`card-subtotal-${productId}`);

  if (qtyEl) qtyEl.textContent = next;
  if (subEl) {
    subEl.textContent = formatCLP(subtotal);
    subEl.parentElement.querySelector('span').textContent = `Subtotal (${next * product.eggsCount} huevos)`;
  }
}

function addToOrderCart(productId, silent = false) {
  const qty = cardQuantities[productId] || 1;
  orderCart[productId] = (orderCart[productId] || 0) + qty;
  saveCartState();
  syncOrderUI();
  renderCatalog();

  const product = PRODUCTS.find((p) => p.id === productId);
  if (product) {
    trackProductInteraction(
      productId,
      'ADD_TO_CART',
      `Añadió al carrito: +${qty}x ${product.name} (${product.format})`
    );
    if (!silent) {
      showToast(`🛒 +${qty} ${product.name} sumada al carrito`);
    }
  }
}

function orderImmediately(productId) {
  const qty = cardQuantities[productId] || 1;
  orderCart[productId] = qty;
  saveCartState();
  syncOrderUI();
  renderCatalog();

  const product = PRODUCTS.find((p) => p.id === productId);
  if (product) {
    trackProductInteraction(
      productId,
      'ADD_TO_CART',
      `Clic en "Pedir al tiro": ${qty}x ${product.name}`
    );
  }

  openCartDrawer();
}

function addFromFormSelect() {
  const selectEl = document.getElementById('order-QuickSelect');
  if (!selectEl) return;
  const productId = selectEl.value;
  orderCart[productId] = (orderCart[productId] || 0) + 1;
  saveCartState();
  syncOrderUI();
  renderCatalog();

  const product = PRODUCTS.find((p) => p.id === productId);
  if (product) {
    trackProductInteraction(
      productId,
      'ADD_TO_CART',
      `Añadió desde selector de carrito: +1x ${product.name}`
    );
    showToast(`🛒 +1 ${product.name} añadida al carrito`);
  }
}

function addFromDrawerSelect() {
  const selectEl = document.getElementById('drawer-quick-select');
  if (!selectEl) return;
  const productId = selectEl.value;
  orderCart[productId] = (orderCart[productId] || 0) + 1;
  saveCartState();
  syncOrderUI();
  renderCatalog();

  const product = PRODUCTS.find((p) => p.id === productId);
  if (product) {
    trackProductInteraction(
      productId,
      'ADD_TO_CART',
      `Añadió desde Drawer lateral: +1x ${product.name}`
    );
    showToast(`🛒 +1 ${product.name} añadida al carrito`);
  }
}

function updateFormItemQty(productId, delta) {
  const current = orderCart[productId] || 0;
  const next = current + delta;
  if (next <= 0) {
    delete orderCart[productId];
  } else {
    orderCart[productId] = next;
  }
  saveCartState();
  syncOrderUI();
  renderCatalog();

  const product = PRODUCTS.find((p) => p.id === productId);
  if (product) {
    trackProductInteraction(
      productId,
      delta > 0 ? 'ADD_TO_CART' : 'PRODUCT_CLICK',
      `Ajustó cantidad en carrito de ${product.name} a ${Math.max(0, next)}`
    );
  }
}

function clearOrderCart() {
  orderCart = {};
  saveCartState();
  syncOrderUI();
  renderCatalog();
}

/**
 * Sincroniza el Carrito de la página, el Drawer lateral, los inputs de embajador y la vista previa de WhatsApp
 */
function syncOrderUI() {
  const mainContainer = document.getElementById('order-items-container');
  const drawerContainer = document.getElementById('drawer-items-container');
  const formTotalEl = document.getElementById('order-form-total');
  const totalEggsEl = document.getElementById('order-total-eggs');
  const bannerTotalEl = document.getElementById('summary-banner-total');
  const headerBadge = document.getElementById('header-cart-badge');
  const mobileBadge = document.getElementById('mobile-cart-badge');
  const drawerSubtotal = document.getElementById('drawer-subtotal');
  const drawerEggs = document.getElementById('drawer-total-eggs');
  const drawerSubtitle = document.getElementById('drawer-subtitle-count');
  const waPreview = document.getElementById('whatsapp-live-preview');

  const mainAmbInput = document.getElementById('ambassador-code-main');
  const drawerAmbInput = document.getElementById('ambassador-code-drawer');
  if (mainAmbInput && mainAmbInput.value !== currentAmbassadorCode) {
    mainAmbInput.value = currentAmbassadorCode;
  }
  if (drawerAmbInput && drawerAmbInput.value !== currentAmbassadorCode) {
    drawerAmbInput.value = currentAmbassadorCode;
  }

  // Sincronizar estado visual de las tarjetas "Pedido Único" vs "Pedido Fijo Semanal" (Alto Contraste)
  const isSemanal = currentOrderType === 'Pedido Fijo Semanal';
  const btnUnicoMain = document.getElementById('type-btn-unico-main');
  const btnSemanalMain = document.getElementById('type-btn-semanal-main');
  const btnUnicoDrawer = document.getElementById('type-btn-unico-drawer');
  const btnSemanalDrawer = document.getElementById('type-btn-semanal-drawer');

  const unicoIcon = document.getElementById('unico-icon-box');
  const unicoStatus = document.getElementById('unico-status-pill');
  const unicoTitle = document.getElementById('unico-title');
  const unicoSubbadge = document.getElementById('unico-subbadge');
  const unicoDesc = document.getElementById('unico-desc');

  const semanalIcon = document.getElementById('semanal-icon-box');
  const semanalStatus = document.getElementById('semanal-status-pill');
  const semanalTitle = document.getElementById('semanal-title');
  const semanalSubbadge = document.getElementById('semanal-subbadge');
  const semanalDesc = document.getElementById('semanal-desc');

  if (btnUnicoMain && btnSemanalMain) {
    if (!isSemanal) {
      btnUnicoMain.className = 'p-5 rounded-2xl border-2 border-qh-brown bg-qh-navy text-white text-left transition-all flex flex-col justify-between gap-3 shadow-xl ring-4 ring-qh-brown/20';
      if (unicoIcon) unicoIcon.className = 'w-11 h-11 rounded-xl bg-qh-brown text-white font-display font-extrabold text-lg flex items-center justify-center flex-shrink-0 shadow';
      if (unicoStatus) {
        unicoStatus.className = 'px-3 py-1 rounded-full bg-amber-400 text-qh-navyDark text-[11px] font-extrabold uppercase tracking-wider shadow-xs';
        unicoStatus.textContent = '✓ Seleccionado';
      }
      if (unicoTitle) unicoTitle.className = 'font-display font-extrabold text-xl text-white leading-tight';
      if (unicoSubbadge) unicoSubbadge.className = 'inline-block mt-1.5 px-2.5 py-0.5 rounded-md bg-white/15 text-amber-300 text-xs font-extrabold';
      if (unicoDesc) unicoDesc.className = 'text-xs sm:text-sm text-slate-100 font-medium leading-relaxed mt-2';

      btnSemanalMain.className = 'p-5 rounded-2xl border-2 border-slate-300 bg-white hover:border-qh-brown text-qh-navy text-left transition-all flex flex-col justify-between gap-3 shadow-md';
      if (semanalIcon) semanalIcon.className = 'w-11 h-11 rounded-xl bg-qh-navy text-white font-display font-extrabold text-lg flex items-center justify-center flex-shrink-0 shadow';
      if (semanalStatus) {
        semanalStatus.className = 'px-3 py-1 rounded-full bg-slate-100 text-qh-navy border border-slate-300 text-[11px] font-extrabold uppercase tracking-wider';
        semanalStatus.textContent = 'Elegir opción';
      }
      if (semanalTitle) semanalTitle.className = 'font-display font-extrabold text-xl text-qh-navy leading-tight';
      if (semanalSubbadge) semanalSubbadge.className = 'inline-block mt-1.5 px-2.5 py-0.5 rounded-md bg-amber-400/30 text-amber-950 text-xs font-extrabold';
      if (semanalDesc) semanalDesc.className = 'text-xs sm:text-sm text-slate-700 font-medium leading-relaxed mt-2';
    } else {
      btnSemanalMain.className = 'p-5 rounded-2xl border-2 border-qh-brown bg-qh-navy text-white text-left transition-all flex flex-col justify-between gap-3 shadow-xl ring-4 ring-qh-brown/20';
      if (semanalIcon) semanalIcon.className = 'w-11 h-11 rounded-xl bg-qh-brown text-white font-display font-extrabold text-lg flex items-center justify-center flex-shrink-0 shadow';
      if (semanalStatus) {
        semanalStatus.className = 'px-3 py-1 rounded-full bg-amber-400 text-qh-navyDark text-[11px] font-extrabold uppercase tracking-wider shadow-xs';
        semanalStatus.textContent = '✓ Seleccionado';
      }
      if (semanalTitle) semanalTitle.className = 'font-display font-extrabold text-xl text-white leading-tight';
      if (semanalSubbadge) semanalSubbadge.className = 'inline-block mt-1.5 px-2.5 py-0.5 rounded-md bg-white/15 text-amber-300 text-xs font-extrabold';
      if (semanalDesc) semanalDesc.className = 'text-xs sm:text-sm text-slate-100 font-medium leading-relaxed mt-2';

      btnUnicoMain.className = 'p-5 rounded-2xl border-2 border-slate-300 bg-white hover:border-qh-brown text-qh-navy text-left transition-all flex flex-col justify-between gap-3 shadow-md';
      if (unicoIcon) unicoIcon.className = 'w-11 h-11 rounded-xl bg-qh-navy text-white font-display font-extrabold text-lg flex items-center justify-center flex-shrink-0 shadow';
      if (unicoStatus) {
        unicoStatus.className = 'px-3 py-1 rounded-full bg-slate-100 text-qh-navy border border-slate-300 text-[11px] font-extrabold uppercase tracking-wider';
        unicoStatus.textContent = 'Elegir opción';
      }
      if (unicoTitle) unicoTitle.className = 'font-display font-extrabold text-xl text-qh-navy leading-tight';
      if (unicoSubbadge) unicoSubbadge.className = 'inline-block mt-1.5 px-2.5 py-0.5 rounded-md bg-qh-brown/20 text-qh-navy text-xs font-extrabold';
      if (unicoDesc) unicoDesc.className = 'text-xs sm:text-sm text-slate-700 font-medium leading-relaxed mt-2';
    }
  }

  if (btnUnicoDrawer && btnSemanalDrawer) {
    if (!isSemanal) {
      btnUnicoDrawer.className = 'py-2.5 px-3 rounded-xl font-display font-bold text-xs bg-qh-navy text-white shadow transition';
      btnSemanalDrawer.className = 'py-2.5 px-3 rounded-xl font-display font-bold text-xs text-qh-navy hover:bg-white transition';
    } else {
      btnSemanalDrawer.className = 'py-2.5 px-3 rounded-xl font-display font-bold text-xs bg-qh-navy text-white shadow transition';
      btnUnicoDrawer.className = 'py-2.5 px-3 rounded-xl font-display font-bold text-xs text-qh-navy hover:bg-white transition';
    }
  }

  const modePill = document.getElementById('order-mode-pill');
  const drawerModeLabel = document.getElementById('drawer-mode-label');
  const waBoxModeText = document.getElementById('wa-box-mode-text');

  if (modePill) modePill.textContent = `Modalidad: ${currentOrderType}`;
  if (drawerModeLabel) drawerModeLabel.textContent = currentOrderType;
  if (waBoxModeText) waBoxModeText.textContent = currentOrderType;

  const productIds = Object.keys(orderCart);
  let totalAmount = 0;
  let totalTrays = 0;
  let totalEggs = 0;

  if (productIds.length === 0) {
    const emptyHtml = `
      <div class="p-4 rounded-xl bg-white border border-dashed border-slate-300 text-center text-xs text-slate-500">
        Tu carrito está vacío. Suma una bandeja desde el catálogo o con el selector superior.
      </div>
    `;
    if (mainContainer) mainContainer.innerHTML = emptyHtml;
    if (drawerContainer) drawerContainer.innerHTML = emptyHtml;
  } else {
    const itemsHtml = productIds
      .map((id) => {
        const product = PRODUCTS.find((p) => p.id === id);
        if (!product) return '';
        const qty = orderCart[id];
        const itemSub = product.price * qty;
        totalAmount += itemSub;
        totalTrays += qty;
        totalEggs += product.eggsCount * qty;

        return `
          <div class="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3 shadow-xs">
            <div class="min-w-0">
              <p class="font-display font-bold text-xs sm:text-sm text-qh-navy truncate">${product.name}</p>
              <p class="text-[11px] text-slate-500">${product.format} • ${formatCLP(product.price)} c/u</p>
            </div>
            <div class="flex items-center gap-2.5 flex-shrink-0">
              <div class="inline-flex items-center gap-1.5 bg-qh-bone px-2 py-1 rounded-lg border border-slate-200">
                <button type="button" onclick="updateFormItemQty('${id}', -1)" class="w-6 h-6 rounded bg-white hover:bg-qh-navy hover:text-white text-qh-navy font-extrabold text-xs flex items-center justify-center transition">−</button>
                <span class="font-display font-extrabold text-xs text-qh-navy w-5 text-center">${qty}</span>
                <button type="button" onclick="updateFormItemQty('${id}', 1)" class="w-6 h-6 rounded bg-white hover:bg-qh-navy hover:text-white text-qh-navy font-extrabold text-xs flex items-center justify-center transition">+</button>
              </div>
              <span class="font-display font-extrabold text-xs sm:text-sm text-qh-brown w-20 text-right">${formatCLP(itemSub)}</span>
            </div>
          </div>
        `;
      })
      .join('');

    if (mainContainer) mainContainer.innerHTML = itemsHtml;
    if (drawerContainer) drawerContainer.innerHTML = itemsHtml;
  }

  if (formTotalEl) formTotalEl.textContent = formatCLP(totalAmount);
  if (totalEggsEl) {
    totalEggsEl.textContent =
      totalTrays > 0
        ? `${totalEggs} huevos de Selección Grande en ${totalTrays} bandeja(s)`
        : '0 huevos seleccionados';
  }
  if (bannerTotalEl) bannerTotalEl.textContent = formatCLP(totalAmount);
  if (headerBadge) headerBadge.textContent = totalTrays;
  if (mobileBadge) mobileBadge.textContent = totalTrays;
  if (drawerSubtotal) drawerSubtotal.textContent = formatCLP(totalAmount);
  if (drawerEggs) {
    drawerEggs.textContent =
      totalTrays > 0 ? `${totalEggs} huevos de Selección Grande` : '0 huevos seleccionados';
  }
  if (drawerSubtitle) drawerSubtitle.textContent = `${totalTrays} bandeja(s) • ${currentOrderType}`;
  if (waPreview) waPreview.textContent = buildWhatsAppDirectMessage();
}

/* ==========================================================================
   MÓDULO 3: SISTEMA DE LOGIN Y DASHBOARD ADMINISTRATIVO COMPLETO
   ========================================================================== */

const ALLOWED_ADMINS = {
  juanjo: 'Juanjo',
  morensex: 'Morensex'
};

const AUTH_KEY_HASHES = [
  '7c8f5059290305cec8323d79521f0353c9ac308b60cb4c1976340d0ce4a121d5',
  'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3'
];

async function computeSHA256(str) {
  if (window.crypto && crypto.subtle) {
    const buffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}

function openAdminLoginModal() {
  const existingSession = localStorage.getItem(STORAGE_KEYS.ADMIN_SESSION);
  if (existingSession && ALLOWED_ADMINS[existingSession.toLowerCase()]) {
    showAdminDashboard(ALLOWED_ADMINS[existingSession.toLowerCase()]);
    return;
  }

  const modal = document.getElementById('admin-login-modal');
  const errEl = document.getElementById('admin-login-error');
  if (errEl) errEl.classList.add('hidden');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
      const userInp = document.getElementById('admin-username');
      if (userInp) userInp.focus();
    }, 80);
  }
}

function closeAdminLoginModal() {
  const modal = document.getElementById('admin-login-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function handleAdminLogin(event) {
  event.preventDefault();
  const rawUser = (document.getElementById('admin-username').value || '').trim().toLowerCase();
  const rawPass = (document.getElementById('admin-password').value || '').trim();
  const errEl = document.getElementById('admin-login-error');

  const normalizedPass = rawPass.replace(/\s+/g, '');
  const [hashA, hashB] = await Promise.all([computeSHA256(rawPass), computeSHA256(normalizedPass)]);

  const isValidUser = Object.prototype.hasOwnProperty.call(ALLOWED_ADMINS, rawUser);
  const isValidPass = AUTH_KEY_HASHES.includes(hashA) || AUTH_KEY_HASHES.includes(hashB);

  if (isValidUser && isValidPass) {
    const displayName = ALLOWED_ADMINS[rawUser];
    localStorage.setItem(STORAGE_KEYS.ADMIN_SESSION, displayName);
    closeAdminLoginModal();
    document.getElementById('admin-login-form').reset();
    showAdminDashboard(displayName);
    showToast(`🔓 Bienvenido al Dashboard, ${displayName}`);
  } else {
    if (errEl) errEl.classList.remove('hidden');
  }
}

function showAdminDashboard(adminName) {
  const storefront = document.getElementById('storefront-view');
  const dashboard = document.getElementById('admin-dashboard-view');
  const badge = document.getElementById('admin-session-badge');
  const navLabel = document.getElementById('navbar-admin-label');

  if (storefront) storefront.classList.add('hidden');
  if (dashboard) dashboard.classList.remove('hidden');
  if (badge) badge.textContent = `Sesión activa: ${adminName}`;
  if (navLabel) navLabel.textContent = `Panel (${adminName})`;

  // Inicializar fechas por defecto en los formularios financieros
  const movDate = document.getElementById('partner-mov-date');
  const supDate = document.getElementById('supplier-payment-date');
  if (movDate && !movDate.value) movDate.value = getTodayISODate();
  if (supDate && !supDate.value) supDate.value = getTodayISODate();

  renderAdminDashboard();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeAdminDashboard() {
  const storefront = document.getElementById('storefront-view');
  const dashboard = document.getElementById('admin-dashboard-view');
  if (dashboard) dashboard.classList.add('hidden');
  if (storefront) storefront.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function logoutAdmin() {
  localStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
  const navLabel = document.getElementById('navbar-admin-label');
  if (navLabel) navLabel.textContent = 'Entrar';
  closeAdminDashboard();
  showToast('🔒 Sesión de administrador cerrada');
}

function switchAdminTab(tabName) {
  activeAdminTab = tabName;
  const tabs = ['all', 'pedidos', 'finanzas', 'embajadores', 'analitica'];
  tabs.forEach((t) => {
    const btn = document.getElementById(`admin-tab-${t}`);
    if (!btn) return;
    if (t === tabName) {
      btn.className = 'admin-tab-btn px-4 py-2.5 rounded-xl font-display font-extrabold text-xs sm:text-sm bg-qh-brown text-white shadow transition';
    } else {
      btn.className = 'admin-tab-btn px-4 py-2.5 rounded-xl font-display font-extrabold text-xs sm:text-sm text-slate-300 hover:bg-white/10 transition';
    }
  });

  const sections = {
    pedidos: document.getElementById('admin-section-pedidos'),
    finanzas: document.getElementById('admin-section-finanzas'),
    embajadores: document.getElementById('admin-section-embajadores'),
    analitica: document.getElementById('admin-section-analitica')
  };

  Object.keys(sections).forEach((secKey) => {
    const el = sections[secKey];
    if (!el) return;
    if (tabName === 'all' || tabName === secKey) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
}

function refreshDashboardIfVisible() {
  const dashboard = document.getElementById('admin-dashboard-view');
  if (dashboard && !dashboard.classList.contains('hidden')) {
    renderAdminDashboard();
  }
}

/* ==========================================================================
   MÓDULO A: APROBACIÓN MANUAL DE PEDIDOS Y CONFIRMACIÓN DE EMBAJADOR
   ========================================================================== */

function ensureAmbassadorExistsByCode(codeRaw) {
  const clean = (codeRaw || '').trim().toUpperCase();
  if (!clean) return;
  const ambassadors = loadAmbassadors();
  const exists = ambassadors.some(
    (a) => a.code.toUpperCase() === clean || a.name.toUpperCase() === clean
  );
  if (!exists) {
    ambassadors.push({
      id: 'AMB-' + Date.now(),
      name: clean,
      code: clean,
      createdAt: new Date().toLocaleDateString('es-CL')
    });
    saveAmbassadors(ambassadors);
  }
}

function approveAndConfirmOrder(orderId) {
  const orders = loadOrders();
  const target = orders.find((o) => o.id === orderId);
  if (!target) return;

  const codeInp = document.getElementById(`order-amb-input-${orderId}`);
  const confirmedCode = codeInp ? codeInp.value.trim().toUpperCase() : (target.ambassadorCode || '').trim().toUpperCase();

  target.ambassadorCode = confirmedCode;
  target.approved = true;
  target.status = 'Aprobado';
  target.commissionAmount = calculateOrderCommission(target.items);

  if (confirmedCode) {
    ensureAmbassadorExistsByCode(confirmedCode);
  }

  saveOrders(orders);
  renderAdminDashboard();

  if (confirmedCode) {
    showToast(`✅ Pedido ${orderId} aprobado • Comisión de ${formatCLP(target.commissionAmount)} sumada a ${confirmedCode}`);
  } else {
    showToast(`✅ Pedido ${orderId} aprobado sin código de embajador`);
  }
}

function unapproveOrder(orderId) {
  const orders = loadOrders();
  const target = orders.find((o) => o.id === orderId);
  if (!target) return;
  target.approved = false;
  target.status = 'Pendiente Aprobación';
  saveOrders(orders);
  renderAdminDashboard();
  showToast(`↩️ Pedido ${orderId} marcado como pendiente`);
}

function deleteOrderRecord(orderId) {
  const orders = loadOrders().filter((o) => o.id !== orderId);
  saveOrders(orders);
  renderAdminDashboard();
  showToast(`🗑️ Pedido ${orderId} eliminado`);
}

function handleCreateManualOrder(event) {
  event.preventDefault();
  const productId = document.getElementById('manual-order-product').value;
  const qty = Math.max(1, parseInt(document.getElementById('manual-order-qty').value, 10) || 1);
  const orderType = document.getElementById('manual-order-type').value;
  const clientName = (document.getElementById('manual-order-client').value || '').trim() || 'Cliente WhatsApp';
  const ambassadorCode = (document.getElementById('manual-order-ambassador').value || '').trim().toUpperCase();

  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) return;

  const orders = loadOrders();
  const nextOrderNum = 1001 + orders.length;
  const now = new Date();
  const formattedDate = now.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const items = [
    {
      id: product.id,
      name: product.name,
      format: `${product.eggsCount} un.`,
      eggsCount: product.eggsCount,
      qty,
      price: product.price
    }
  ];

  const subtotal = product.price * qty;
  const totalEggs = product.eggsCount * qty;
  const commissionAmount = calculateOrderCommission(items);

  if (ambassadorCode) {
    ensureAmbassadorExistsByCode(ambassadorCode);
  }

  orders.unshift({
    id: `QH-${nextOrderNum}`,
    date: formattedDate,
    timestamp: Date.now(),
    clientName,
    orderType,
    items,
    totalEggs,
    subtotal,
    ambassadorCode,
    commissionAmount,
    approved: true,
    status: 'Aprobado'
  });

  saveOrders(orders);
  document.getElementById('admin-manual-order-form').reset();
  document.getElementById('manual-order-qty').value = 1;
  renderAdminDashboard();

  showToast(
    `✅ Pedido QH-${nextOrderNum} registrado y aprobado${
      ambassadorCode ? ` • Comisión ${formatCLP(commissionAmount)} sumada a ${ambassadorCode}` : ''
    }`
  );
}

/* ==========================================================================
   MÓDULO B: 💰 FINANZAS Y SALDOS (SOCIOS Y PROVEEDORES)
   ========================================================================== */

function handleAddPartnerMovement(event) {
  event.preventDefault();
  const partner = document.getElementById('partner-mov-who').value;
  const type = document.getElementById('partner-mov-type').value;
  const date = document.getElementById('partner-mov-date').value || getTodayISODate();
  const amount = Math.max(0, Number(document.getElementById('partner-mov-amount').value) || 0);
  const concept = (document.getElementById('partner-mov-concept').value || '').trim();

  if (!amount || !concept) return;

  const finances = loadFinances();
  finances.partnerMovements.unshift({
    id: 'PM-' + Date.now(),
    date,
    partner,
    type,
    amount,
    concept
  });

  saveFinances(finances);
  document.getElementById('partner-mov-amount').value = '';
  document.getElementById('partner-mov-concept').value = '';
  renderAdminDashboard();

  const partnerLabel = partner === 'Morensex' ? 'Morensex (Mati)' : 'Juanjo';
  showToast(`💰 Saldo actualizado para ${partnerLabel}: ${formatCLP(amount)}`);
}

function deletePartnerMovement(movId) {
  const finances = loadFinances();
  finances.partnerMovements = finances.partnerMovements.filter((m) => m.id !== movId);
  saveFinances(finances);
  renderAdminDashboard();
  showToast('🗑️ Movimiento de socio eliminado');
}

function handleAddSupplierPayment(event) {
  event.preventDefault();
  const date = document.getElementById('supplier-payment-date').value || getTodayISODate();
  const amount = Math.max(0, Number(document.getElementById('supplier-payment-amount').value) || 0);
  const concept = (document.getElementById('supplier-payment-concept').value || '').trim();
  const payer = document.getElementById('supplier-payment-payer').value || 'Caja';

  if (!amount || !concept) return;

  const finances = loadFinances();
  finances.supplierPayments.unshift({
    id: 'SP-' + Date.now(),
    date,
    amount,
    concept,
    payer
  });

  saveFinances(finances);
  document.getElementById('supplier-payment-amount').value = '';
  document.getElementById('supplier-payment-concept').value = '';
  renderAdminDashboard();

  const payerNote =
    payer === 'Juanjo'
      ? ' (Sumado al saldo a favor de Juanjo)'
      : payer === 'Morensex'
      ? ' (Sumado al saldo a favor de Morensex / Mati)'
      : '';
  showToast(`🧾 Pago a proveedor registrado: ${formatCLP(amount)}${payerNote}`);
}

function deleteSupplierPayment(payId) {
  const finances = loadFinances();
  finances.supplierPayments = finances.supplierPayments.filter((p) => p.id !== payId);
  saveFinances(finances);
  renderAdminDashboard();
  showToast('🗑️ Pago a proveedor eliminado');
}

/* ==========================================================================
   MÓDULO C: 🤝 SISTEMA DE EMBAJADORES Y COMISIONES
   ========================================================================== */

function suggestAmbassadorCode() {
  const nameInp = document.getElementById('ambassador-name-input');
  const codeInp = document.getElementById('ambassador-code-create');
  if (!nameInp || !codeInp) return;
  const cleanName = (nameInp.value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  if (cleanName) {
    codeInp.value = `${cleanName}10`;
  }
}

function generateRandomAmbassadorCode() {
  const nameInp = document.getElementById('ambassador-name-input');
  const codeInp = document.getElementById('ambassador-code-create');
  if (!codeInp) return;
  const prefix =
    ((nameInp && nameInp.value) || 'QH')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6) || 'HUEVOS';
  const randomDigits = Math.floor(10 + Math.random() * 90);
  codeInp.value = `${prefix}${randomDigits}`;
}

function handleCreateAmbassador(event) {
  event.preventDefault();
  const nameInp = document.getElementById('ambassador-name-input');
  const codeInp = document.getElementById('ambassador-code-create');
  const name = (nameInp.value || '').trim();
  const code = (codeInp.value || '').trim().toUpperCase().replace(/\s+/g, '');

  if (!name || !code) return;

  const ambassadors = loadAmbassadors();
  const exists = ambassadors.some((a) => a.code.toUpperCase() === code);
  if (exists) {
    showToast(`⚠️ El código ${code} ya está asignado a un embajador`);
    return;
  }

  ambassadors.push({
    id: 'AMB-' + Date.now(),
    name,
    code,
    createdAt: new Date().toLocaleDateString('es-CL')
  });

  saveAmbassadors(ambassadors);
  nameInp.value = '';
  codeInp.value = '';
  renderAdminDashboard();
  showToast(`🤝 Embajador ${name} creado con código único: ${code}`);
}

function copyAmbassadorCode(code) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code);
  }
  showToast(`📋 Código de embajador copiado: ${code}`);
}

function deleteAmbassador(ambId) {
  const ambassadors = loadAmbassadors().filter((a) => a.id !== ambId);
  saveAmbassadors(ambassadors);
  renderAdminDashboard();
  showToast('🗑️ Embajador eliminado');
}

/* ==========================================================================
   RENDERIZADO INTEGRAL DEL DASHBOARD ADMINISTRATIVO
   ========================================================================== */

function renderAdminDashboard() {
  const orders = loadOrders();
  const analytics = loadAnalytics();
  const finances = loadFinances();
  const ambassadors = loadAmbassadors();

  // 1. Calcular Ventas y Pedidos (Aprobados vs Pendientes)
  let approvedRevenue = 0;
  let totalOrdersRevenue = 0;
  let approvedOrdersCount = 0;
  let pendingOrdersCount = 0;

  orders.forEach((o) => {
    const sub = Number(o.subtotal) || 0;
    totalOrdersRevenue += sub;
    if (o.approved) {
      approvedRevenue += sub;
      approvedOrdersCount += 1;
    } else {
      pendingOrdersCount += 1;
    }
  });

  // 2. Calcular Estado de Cuenta de Socios (Juanjo & Morensex/Mati) y Pagos a Proveedores
  const partnerTotals = {
    Juanjo: { aportes: 0, pagos: 0, retiros: 0, balance: 0 },
    Morensex: { aportes: 0, pagos: 0, retiros: 0, balance: 0 }
  };

  finances.partnerMovements.forEach((mov) => {
    const p = mov.partner === 'Morensex' ? 'Morensex' : 'Juanjo';
    const amt = Number(mov.amount) || 0;
    if (mov.type === 'aporte') partnerTotals[p].aportes += amt;
    else if (mov.type === 'pago_directo') partnerTotals[p].pagos += amt;
    else if (mov.type === 'reembolso') partnerTotals[p].retiros += amt;
  });

  let totalSuppliersPaid = 0;
  finances.supplierPayments.forEach((sp) => {
    const amt = Number(sp.amount) || 0;
    totalSuppliersPaid += amt;
    if (sp.payer === 'Juanjo') {
      partnerTotals.Juanjo.pagos += amt;
    } else if (sp.payer === 'Morensex') {
      partnerTotals.Morensex.pagos += amt;
    }
  });

  partnerTotals.Juanjo.balance =
    partnerTotals.Juanjo.aportes + partnerTotals.Juanjo.pagos - partnerTotals.Juanjo.retiros;
  partnerTotals.Morensex.balance =
    partnerTotals.Morensex.aportes + partnerTotals.Morensex.pagos - partnerTotals.Morensex.retiros;

  const combinedPartnersBalance = partnerTotals.Juanjo.balance + partnerTotals.Morensex.balance;

  // Actualizar tarjetas de Estado de Cuenta de Socios
  const balJuanjoEl = document.getElementById('partner-balance-juanjo');
  const apoJuanjoEl = document.getElementById('partner-aportes-juanjo');
  const pagJuanjoEl = document.getElementById('partner-pagos-juanjo');
  const retJuanjoEl = document.getElementById('partner-retiros-juanjo');

  if (balJuanjoEl) balJuanjoEl.textContent = formatCLP(partnerTotals.Juanjo.balance);
  if (apoJuanjoEl) apoJuanjoEl.textContent = formatCLP(partnerTotals.Juanjo.aportes);
  if (pagJuanjoEl) pagJuanjoEl.textContent = formatCLP(partnerTotals.Juanjo.pagos);
  if (retJuanjoEl) retJuanjoEl.textContent = formatCLP(partnerTotals.Juanjo.retiros);

  const balMatiEl = document.getElementById('partner-balance-morensex');
  const apoMatiEl = document.getElementById('partner-aportes-morensex');
  const pagMatiEl = document.getElementById('partner-pagos-morensex');
  const retMatiEl = document.getElementById('partner-retiros-morensex');

  if (balMatiEl) balMatiEl.textContent = formatCLP(partnerTotals.Morensex.balance);
  if (apoMatiEl) apoMatiEl.textContent = formatCLP(partnerTotals.Morensex.aportes);
  if (pagMatiEl) pagMatiEl.textContent = formatCLP(partnerTotals.Morensex.pagos);
  if (retMatiEl) retMatiEl.textContent = formatCLP(partnerTotals.Morensex.retiros);

  const supTotalBadge = document.getElementById('supplier-payments-total-badge');
  if (supTotalBadge) supTotalBadge.textContent = `Total: ${formatCLP(totalSuppliersPaid)}`;

  // 3. Calcular Comisiones de Embajadores sobre Pedidos Aprobados con Código
  // Construir mapa unificado de embajadores registrados + códigos detectados en pedidos aprobados
  const ambassadorStatsMap = {};
  ambassadors.forEach((amb) => {
    const key = amb.code.toUpperCase();
    ambassadorStatsMap[key] = {
      id: amb.id,
      name: amb.name,
      code: amb.code.toUpperCase(),
      ordersCount: 0,
      count12: 0,
      count30: 0,
      count60: 0,
      totalCommission: 0
    };
  });

  let totalAllCommissions = 0;
  let approvedOrdersWithCode = 0;

  orders.forEach((o) => {
    if (!o.approved) return;
    const rawCode = (o.ambassadorCode || '').trim().toUpperCase();
    if (!rawCode) return;

    // Buscar coincidencia por código o por nombre de embajador
    let matchedKey = rawCode;
    Object.keys(ambassadorStatsMap).forEach((k) => {
      const entry = ambassadorStatsMap[k];
      if (entry.code === rawCode || entry.name.toUpperCase() === rawCode) {
        matchedKey = k;
      }
    });

    if (!ambassadorStatsMap[matchedKey]) {
      ambassadorStatsMap[matchedKey] = {
        id: null,
        name: rawCode,
        code: rawCode,
        ordersCount: 0,
        count12: 0,
        count30: 0,
        count60: 0,
        totalCommission: 0
      };
    }

    const stat = ambassadorStatsMap[matchedKey];
    stat.ordersCount += 1;
    approvedOrdersWithCode += 1;

    (o.items || []).forEach((it) => {
      const qty = Number(it.qty) || 0;
      const prod = PRODUCTS.find((p) => p.id === it.id);
      const eggs = prod ? prod.eggsCount : parseInt(it.format, 10) || 0;
      if (eggs === 12) {
        stat.count12 += qty;
        stat.totalCommission += qty * 800;
        totalAllCommissions += qty * 800;
      } else if (eggs === 30) {
        stat.count30 += qty;
        stat.totalCommission += qty * 2000;
        totalAllCommissions += qty * 2000;
      } else if (eggs === 60) {
        stat.count60 += qty;
        stat.totalCommission += qty * 4000;
        totalAllCommissions += qty * 4000;
      }
    });
  });

  // 4. Actualizar los 4 KPIs Superiores
  const kpiRevEl = document.getElementById('kpi-total-revenue');
  const kpiProjEl = document.getElementById('kpi-monthly-projection');
  const kpiOrdEl = document.getElementById('kpi-total-orders');
  const kpiOrdBreakEl = document.getElementById('kpi-orders-breakdown');
  const kpiPartnersEl = document.getElementById('kpi-partners-total');
  const kpiSuppliersEl = document.getElementById('kpi-suppliers-total');
  const kpiAmbCommEl = document.getElementById('kpi-ambassadors-commission');
  const kpiAmbCountEl = document.getElementById('kpi-ambassadors-count');

  if (kpiRevEl) kpiRevEl.textContent = formatCLP(approvedRevenue);
  if (kpiProjEl) {
    kpiProjEl.textContent = `Total en bandeja (c/pendientes): ${formatCLP(totalOrdersRevenue)}`;
  }
  if (kpiOrdEl) kpiOrdEl.textContent = orders.length;
  if (kpiOrdBreakEl) {
    kpiOrdBreakEl.textContent = `${approvedOrdersCount} Aprobados • ${pendingOrdersCount} Pendientes`;
  }
  if (kpiPartnersEl) kpiPartnersEl.textContent = formatCLP(combinedPartnersBalance);
  if (kpiSuppliersEl) {
    kpiSuppliersEl.textContent = `Pagado a proveedores: ${formatCLP(totalSuppliersPaid)}`;
  }
  if (kpiAmbCommEl) kpiAmbCommEl.textContent = formatCLP(totalAllCommissions);
  if (kpiAmbCountEl) {
    kpiAmbCountEl.textContent = `${Object.keys(ambassadorStatsMap).length} embajadores • ${approvedOrdersWithCode} pedidos c/código`;
  }

  // 5. Renderizar Tabla de Pedidos y Aprobación Manual
  const filterType = (document.getElementById('admin-filter-order-type') || {}).value || 'all';
  const sortMode = (document.getElementById('admin-sort-orders') || {}).value || 'newest';

  const filteredOrders = orders.filter((o) => {
    if (filterType === 'all') return true;
    return o.orderType === filterType;
  });

  filteredOrders.sort((a, b) => {
    if (sortMode === 'amount-desc') return b.subtotal - a.subtotal;
    if (sortMode === 'amount-asc') return a.subtotal - b.subtotal;
    if (sortMode === 'eggs-desc') return b.totalEggs - a.totalEggs;
    return (b.timestamp || 0) - (a.timestamp || 0);
  });

  const ordersTbody = document.getElementById('admin-orders-tbody');
  if (ordersTbody) {
    if (filteredOrders.length === 0) {
      ordersTbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-8 text-center text-slate-400">
            0 pedidos registrados. La plataforma está limpia y lista para recibir pedidos reales.
          </td>
        </tr>
      `;
    } else {
      ordersTbody.innerHTML = filteredOrders
        .map((order) => {
          const isWeekly = order.orderType === 'Pedido Fijo Semanal';
          const commission = calculateOrderCommission(order.items);
          const itemsSummary = (order.items || [])
            .map((it) => `<span class="inline-block mr-2">• <strong>${it.qty}x</strong> ${it.name} (${it.format})</span>`)
            .join('<br/>');

          return `
            <tr class="hover:bg-white/5 transition ${order.approved ? 'bg-emerald-500/5' : ''}">
              <td class="py-3.5 px-4 whitespace-nowrap">
                <span class="font-display font-extrabold text-white block">${order.id}</span>
                <span class="text-[11px] text-slate-400 block">${order.date}</span>
                ${
                  order.clientName
                    ? `<span class="text-[11px] text-qh-brownLight font-semibold">${order.clientName}</span>`
                    : ''
                }
              </td>
              <td class="py-3.5 px-4 whitespace-nowrap">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${
                  isWeekly
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                    : 'bg-sky-400/15 text-sky-300 border border-sky-400/30'
                }">
                  ${isWeekly ? '🔁 Pedido Fijo Semanal' : '1️⃣ Pedido Único'}
                </span>
              </td>
              <td class="py-3.5 px-4 text-slate-200 leading-relaxed">
                ${itemsSummary}
                <span class="block text-[11px] text-slate-400 mt-0.5">${order.totalEggs} huevos en total</span>
              </td>
              <td class="py-3.5 px-4 whitespace-nowrap font-display font-extrabold text-base text-amber-400">
                ${formatCLP(order.subtotal)}
              </td>
              <td class="py-3.5 px-4">
                <div class="space-y-1.5 max-w-[200px]">
                  <input id="order-amb-input-${order.id}"
                         type="text"
                         value="${order.ambassadorCode || ''}"
                         placeholder="Sin código (o escribe aquí)"
                         class="w-full px-2.5 py-1.5 rounded-lg bg-qh-navyDark border border-amber-400/40 text-xs font-extrabold text-amber-300 uppercase placeholder-slate-500 focus:outline-none focus:border-amber-400" />
                  <span class="block text-[11px] ${
                    order.ambassadorCode ? 'text-emerald-400 font-bold' : 'text-slate-400'
                  }">
                    Comisión potencial: ${formatCLP(commission)}
                  </span>
                </div>
              </td>
              <td class="py-3.5 px-4 whitespace-nowrap">
                <div class="flex flex-wrap items-center gap-2">
                  ${
                    order.approved
                      ? `
                        <span class="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-extrabold">
                          ✅ Aprobado
                        </span>
                        <button type="button" onclick="approveAndConfirmOrder('${order.id}')"
                                class="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white transition"
                                title="Guardar cambios en el código de embajador">
                          💾 Actualizar Código
                        </button>
                        <button type="button" onclick="unapproveOrder('${order.id}')"
                                class="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-[11px] font-bold text-amber-300 transition"
                                title="Marcar como pendiente">
                          ↩️
                        </button>
                      `
                      : `
                        <button type="button" onclick="approveAndConfirmOrder('${order.id}')"
                                class="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-qh-navyDark font-display font-extrabold text-xs shadow transition">
                          ✅ Aprobar y Confirmar Código
                        </button>
                      `
                  }
                  <button type="button" onclick="deleteOrderRecord('${order.id}')"
                          class="px-2 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-300 text-xs font-bold transition"
                          title="Eliminar pedido">
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          `;
        })
        .join('');
    }
  }

  // 6. Renderizar Tablas Financieras (Movimientos de Socios + Pagos a Proveedores)
  const partnerMovTbody = document.getElementById('admin-partner-movements-tbody');
  if (partnerMovTbody) {
    if (finances.partnerMovements.length === 0) {
      partnerMovTbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-4 text-center text-slate-500">
            Sin aportes ni movimientos registrados ($0).
          </td>
        </tr>
      `;
    } else {
      partnerMovTbody.innerHTML = finances.partnerMovements
        .map((m) => {
          const isReembolso = m.type === 'reembolso';
          const partnerName = m.partner === 'Morensex' ? 'Morensex (Mati)' : 'Juanjo';
          const typeBadge =
            m.type === 'aporte'
              ? '<span class="text-emerald-400 font-bold">Aporte</span>'
              : m.type === 'pago_directo'
              ? '<span class="text-amber-300 font-bold">Pagó Gasto</span>'
              : '<span class="text-red-300 font-bold">Reembolso</span>';

          return `
            <tr class="hover:bg-white/5">
              <td class="py-2 px-2 whitespace-nowrap text-slate-400">${m.date}</td>
              <td class="py-2 px-2 font-bold text-white">${partnerName}</td>
              <td class="py-2 px-2 text-slate-300">${typeBadge} • ${m.concept}</td>
              <td class="py-2 px-2 text-right font-display font-extrabold whitespace-nowrap ${
                isReembolso ? 'text-red-400' : 'text-emerald-400'
              }">
                ${isReembolso ? '−' : '+'}${formatCLP(m.amount)}
              </td>
              <td class="py-2 px-2 text-right">
                <button type="button" onclick="deletePartnerMovement('${m.id}')" class="text-slate-500 hover:text-red-400 font-bold">✕</button>
              </td>
            </tr>
          `;
        })
        .join('');
    }
  }

  const supplierTbody = document.getElementById('admin-supplier-payments-tbody');
  if (supplierTbody) {
    if (finances.supplierPayments.length === 0) {
      supplierTbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-4 text-center text-slate-500">
            Sin pagos a proveedores registrados ($0).
          </td>
        </tr>
      `;
    } else {
      supplierTbody.innerHTML = finances.supplierPayments
        .map((sp) => {
          const payerLabel =
            sp.payer === 'Morensex'
              ? 'Morensex (Mati)'
              : sp.payer === 'Juanjo'
              ? 'Juanjo'
              : 'Caja Negocio';
          return `
            <tr class="hover:bg-white/5">
              <td class="py-2 px-2 whitespace-nowrap text-slate-400">${sp.date}</td>
              <td class="py-2 px-2 text-white font-semibold">${sp.concept}</td>
              <td class="py-2 px-2">
                <span class="px-2 py-0.5 rounded bg-white/10 text-[10px] font-bold text-amber-300">${payerLabel}</span>
              </td>
              <td class="py-2 px-2 text-right font-display font-extrabold text-amber-400 whitespace-nowrap">
                ${formatCLP(sp.amount)}
              </td>
              <td class="py-2 px-2 text-right">
                <button type="button" onclick="deleteSupplierPayment('${sp.id}')" class="text-slate-500 hover:text-red-400 font-bold">✕</button>
              </td>
            </tr>
          `;
        })
        .join('');
    }
  }

  // 7. Renderizar Tabla de Embajadores y Comisiones Acumuladas
  const ambassadorsTbody = document.getElementById('admin-ambassadors-tbody');
  if (ambassadorsTbody) {
    const ambassadorRows = Object.values(ambassadorStatsMap);
    if (ambassadorRows.length === 0) {
      ambassadorsTbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-8 text-center text-slate-400">
            0 embajadores registrados y $0 en comisiones. Crea un código arriba para comenzar.
          </td>
        </tr>
      `;
    } else {
      ambassadorsTbody.innerHTML = ambassadorRows
        .map((amb) => {
          return `
            <tr class="hover:bg-white/5 transition">
              <td class="py-3.5 px-4 font-display font-extrabold text-white">
                ${amb.name}
              </td>
              <td class="py-3.5 px-4 whitespace-nowrap">
                <span class="px-3 py-1 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300 font-display font-extrabold text-xs tracking-wider">
                  ${amb.code}
                </span>
              </td>
              <td class="py-3.5 px-4 font-bold text-slate-200">
                ${amb.ordersCount} pedido(s) aprobado(s)
              </td>
              <td class="py-3.5 px-4 text-xs text-slate-300">
                <span class="inline-block mr-2">🥚 Docenas (12): <strong>${amb.count12}</strong> ($800 c/u)</span>
                <span class="inline-block mr-2">📦 Bandejas (30): <strong>${amb.count30}</strong> ($2.000 c/u)</span>
                <span class="inline-block">🏆 Cajas (60): <strong>${amb.count60}</strong> ($4.000 c/u)</span>
              </td>
              <td class="py-3.5 px-4 whitespace-nowrap">
                <span class="font-display font-extrabold text-xl text-emerald-400">
                  ${formatCLP(amb.totalCommission)}
                </span>
              </td>
              <td class="py-3.5 px-4 text-right whitespace-nowrap">
                <button type="button" onclick="copyAmbassadorCode('${amb.code}')"
                        class="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white mr-1 transition">
                  📋 Copiar Código
                </button>
                ${
                  amb.id
                    ? `<button type="button" onclick="deleteAmbassador('${amb.id}')"
                               class="px-2.5 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-xs font-bold text-red-300 transition">
                         🗑️
                       </button>`
                    : ''
                }
              </td>
            </tr>
          `;
        })
        .join('');
    }
  }

  // 8. Renderizar Comportamiento por Producto (Más pinchados vs Ignorados)
  const productSort = (document.getElementById('admin-sort-products') || {}).value || 'clicks-desc';
  const productList = PRODUCTS.map((p) => {
    const st = analytics.productStats[p.id] || { clicks: 0, addedToCart: 0, checkouts: 0 };
    return {
      ...p,
      clicks: st.clicks,
      addedToCart: st.addedToCart,
      checkouts: st.checkouts
    };
  });

  productList.sort((a, b) => {
    if (productSort === 'clicks-asc') return a.clicks - b.clicks;
    if (productSort === 'cart-desc') return b.addedToCart - a.addedToCart;
    return b.clicks - a.clicks;
  });

  const maxProductClicks = Math.max(1, ...productList.map((p) => p.clicks));
  const productsAnalyticsEl = document.getElementById('admin-products-analytics');

  if (productsAnalyticsEl) {
    productsAnalyticsEl.innerHTML = productList
      .map((p) => {
        const pct = p.clicks === 0 ? 0 : Math.round((p.clicks / maxProductClicks) * 100);
        const statusBadge =
          p.clicks === 0
            ? `<span class="px-2.5 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[10px] font-extrabold">0 clics</span>`
            : `<span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold">Activo (${p.clicks})</span>`;

        return `
          <div class="p-4 rounded-2xl bg-qh-navyDark/90 border border-white/10 space-y-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span class="font-display font-bold text-sm text-white">${p.name}</span>
                <span class="text-xs text-slate-400 ml-1">(${p.format} • ${formatCLP(p.price)})</span>
              </div>
              ${statusBadge}
            </div>

            <div class="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
              <div class="h-full rounded-full bg-gradient-to-r from-qh-brown to-amber-400 analytics-bar-fill" style="width: ${pct}%"></div>
            </div>

            <div class="flex items-center justify-between text-[11px] text-slate-300 pt-1">
              <span>🖱️ <strong>${p.clicks}</strong> clics en producto</span>
              <span>🛒 <strong>${p.addedToCart}</strong> añadidos al carrito</span>
              <span>📲 <strong>${p.checkouts}</strong> bandejas en checkouts</span>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // 9. Renderizar Ranking de Botones Pinchados vs No Pinchados
  const btnSort = (document.getElementById('admin-sort-buttons') || {}).value || 'most';
  const buttonsArray = Object.keys(analytics.buttonClicks).map((label) => ({
    label,
    clicks: analytics.buttonClicks[label] || 0
  }));

  buttonsArray.sort((a, b) => {
    if (btnSort === 'ignored') return a.clicks - b.clicks;
    return b.clicks - a.clicks;
  });

  const maxBtnClicks = Math.max(1, ...buttonsArray.map((b) => b.clicks));
  const buttonsContainer = document.getElementById('admin-buttons-analytics');

  if (buttonsContainer) {
    buttonsContainer.innerHTML = buttonsArray
      .map((b) => {
        const pct = b.clicks === 0 ? 0 : Math.round((b.clicks / maxBtnClicks) * 100);
        const zeroClicks = b.clicks === 0;
        return `
          <div class="p-3 rounded-xl bg-qh-navyDark/80 border border-white/10 space-y-1.5">
            <div class="flex items-center justify-between gap-2 text-xs">
              <span class="font-semibold ${zeroClicks ? 'text-slate-400' : 'text-slate-200'} truncate">${b.label}</span>
              <span class="px-2 py-0.5 rounded-md font-display font-extrabold text-[11px] ${
                zeroClicks ? 'bg-white/5 text-slate-400' : 'bg-qh-brown/25 text-qh-brownLight'
              }">
                ${b.clicks} clics
              </span>
            </div>
            <div class="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div class="h-full rounded-full bg-emerald-400" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // 10. Renderizar Embudo de Conversión
  const funnelContainer = document.getElementById('admin-funnel-bars');
  if (funnelContainer) {
    const totalViews = analytics.pageViews || 0;
    const totalProductClicks = productList.reduce((acc, item) => acc + item.clicks, 0);
    const baseDenominator = Math.max(1, totalViews);
    const steps = [
      {
        label: '1. Visitas a la Página',
        count: totalViews,
        pct: totalViews > 0 ? 100 : 0,
        color: 'bg-sky-400'
      },
      {
        label: '2. Clics en Tarjetas de Producto',
        count: totalProductClicks,
        pct: totalViews > 0 ? Math.min(100, Math.round((totalProductClicks / baseDenominator) * 100)) : 0,
        color: 'bg-qh-brown'
      },
      {
        label: '3. Productos Añadidos al Carrito',
        count: analytics.addToCartEvents || 0,
        pct: totalViews > 0 ? Math.min(100, Math.round(((analytics.addToCartEvents || 0) / baseDenominator) * 100)) : 0,
        color: 'bg-amber-400'
      },
      {
        label: '4. Checkouts Iniciados a WhatsApp',
        count: orders.length,
        pct: totalViews > 0 ? Math.min(100, Math.round((orders.length / baseDenominator) * 100)) : 0,
        color: 'bg-emerald-400'
      }
    ];

    funnelContainer.innerHTML = steps
      .map(
        (st) => `
        <div class="space-y-1">
          <div class="flex justify-between text-xs">
            <span class="font-bold text-slate-200">${st.label}</span>
            <span class="font-display font-extrabold text-white">${st.count} (${st.pct}%)</span>
          </div>
          <div class="w-full h-3 rounded-full bg-qh-navyDark overflow-hidden p-0.5 border border-white/10">
            <div class="h-full rounded-full ${st.color}" style="width: ${st.pct}%"></div>
          </div>
        </div>
      `
      )
      .join('');
  }

  // 11. Renderizar Stream de Eventos en Tiempo Real
  const streamEl = document.getElementById('admin-event-stream');
  if (streamEl) {
    const events = analytics.eventLog || [];
    if (events.length === 0) {
      streamEl.innerHTML = `
        <div class="p-4 rounded-xl bg-qh-navyDark/60 border border-white/10 text-center text-slate-400">
          Sin eventos registrados aún. Los clics e interacciones reales aparecerán aquí en vivo.
        </div>
      `;
    } else {
      streamEl.innerHTML = events
        .map((ev) => {
          const badgeColor =
            ev.type === 'CHECKOUT_WHATSAPP'
              ? 'bg-emerald-500/20 text-emerald-300'
              : ev.type === 'ADD_TO_CART'
              ? 'bg-amber-500/20 text-amber-300'
              : 'bg-white/10 text-slate-300';
          return `
            <div class="p-2.5 rounded-xl bg-qh-navyDark/75 border border-white/10 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="px-2 py-0.5 rounded text-[10px] font-extrabold ${badgeColor}">${ev.type}</span>
                <span class="text-slate-200 truncate">${ev.detail}</span>
              </div>
              <span class="text-[11px] text-slate-400 whitespace-nowrap">${ev.time}</span>
            </div>
          `;
        })
        .join('');
    }
  }
}

/**
 * Permite reiniciar todos los datos locales a cero absoluto desde el panel administrativo
 */
function resetProductionDataConfirmation() {
  localStorage.removeItem(STORAGE_KEYS.CART);
  localStorage.removeItem(STORAGE_KEYS.ANALYTICS);
  localStorage.removeItem(STORAGE_KEYS.ORDERS);
  localStorage.removeItem(STORAGE_KEYS.FINANCES);
  localStorage.removeItem(STORAGE_KEYS.AMBASSADORS);
  orderCart = {};
  currentAmbassadorCode = '';
  syncOrderUI();
  renderCatalog();
  renderAdminDashboard();
  showToast('🧹 Todos los registros fueron reiniciados a cero ($0)');
}

/* ==========================================================================
   TOAST E INICIALIZACIÓN GENERAL
   ========================================================================== */

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

document.addEventListener('DOMContentLoaded', () => {
  // Inicializar almacenamiento en cero si aún no existe
  loadAnalytics();
  loadOrders();
  loadFinances();
  loadAmbassadors();

  // Cargar carrito persistente y renderizar interfaz
  loadCartState();
  renderCatalog();
  syncOrderUI();

  // Actualizar etiqueta del botón Admin si ya hay sesión iniciada
  const savedAdmin = localStorage.getItem(STORAGE_KEYS.ADMIN_SESSION);
  if (savedAdmin && ALLOWED_ADMINS[savedAdmin.toLowerCase()]) {
    const navLabel = document.getElementById('navbar-admin-label');
    if (navLabel) navLabel.textContent = `Panel (${ALLOWED_ADMINS[savedAdmin.toLowerCase()]})`;
  }

  // Listener global delegado para rastrear clics reales en elementos con [data-track-btn]
  document.body.addEventListener('click', (e) => {
    const trackedBtn = e.target.closest('[data-track-btn]');
    if (trackedBtn) {
      const label = trackedBtn.getAttribute('data-track-btn');
      trackButtonClick(label);
    }
  });

  // Cerrar Drawer del Carrito al hacer clic en el fondo oscuro
  const drawerBackdrop = document.getElementById('cart-drawer-backdrop');
  if (drawerBackdrop) {
    drawerBackdrop.addEventListener('click', (e) => {
      if (e.target === drawerBackdrop) closeCartDrawer();
    });
  }

  // Cerrar Modal de Login al hacer clic fuera o con Escape
  const loginModal = document.getElementById('admin-login-modal');
  if (loginModal) {
    loginModal.addEventListener('click', (e) => {
      if (e.target === loginModal) closeAdminLoginModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCartDrawer();
      closeAdminLoginModal();
    }
  });

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

    document.querySelectorAll('.mobile-nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        mobileMenu.classList.add('hidden');
        iconOpen.classList.remove('hidden');
        iconClose.classList.add('hidden');
        mobileBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Scroll Spy para navegación
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
