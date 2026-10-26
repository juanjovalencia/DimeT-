/**
 * QUÉ HUEVONES: Para con los cuentos, prueba los verdaderos huevos.
 * Fullstack Cloud Architecture (Producción Permanente + Sincronización en Tiempo Real):
 * 1. Base de Datos Permanente en la Nube (Supabase PostgreSQL/Realtime + Cloud REST Store + SSE Realtime Stream).
 *    Cero dependencia de localStorage: si se cierra el navegador, se recarga la página o se apaga el celular,
 *    ningún dato financiero, de pedidos, de embajadores o de analítica se pierde.
 * 2. Sincronización Instantánea Multi-Administrador (Juanjo <-> Morensex/Mati).
 * 3. Dashboard Financiero (Estado de Cuenta de Socios Juanjo & Morensex + Pagos a Proveedores).
 * 4. Sistema de Embajadores y Comisiones ($2.000 por Bandeja de 30 unidades).
 * 5. Checkout con Código de Embajador hacia WhatsApp (+56953930491) y Aprobación Manual en Dashboard.
 */

const WHATSAPP_NUMBER = '56953930491';

// Limpieza única de claves antiguas de demostración (sin borrar el espejo de producción v4)
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    [
      'qh_cart_state_v2',
      'qh_analytics_v2',
      'qh_orders_v2',
      'qh_analytics_v1',
      'qh_orders_v1',
      'qh_cart_v1',
      'qh_prod_cart_v3',
      'qh_prod_analytics_v3',
      'qh_prod_orders_v3',
      'qh_prod_finances_v3',
      'qh_prod_ambassadors_v3'
    ].forEach((k) => window.localStorage.removeItem(k));
  }
} catch (e) {
  // ignore
}

/* ==========================================================================
   CONFIGURACIÓN DE BASE DE DATOS CLOUD PERMANENTE Y REALTIME
   ========================================================================== */

// Almacenamiento Cloud Redundante:
// 1. Canal Cloud Persistente + Stream SSE en Tiempo Real (ntfy.sh)
// 2. Almacén de Objetos JSON en la Nube (bytebin.lucko.me)
// 3. Proyecto Supabase PostgreSQL + Realtime (opcional/configurable)
// 4. Espejo Instantáneo Local (qh_cloud_mirror_v4) para recargas (F5) en 0ms sin pérdida
const CLOUD_REALTIME_TOPIC = 'qh_cloud_realtime_sync_v3_prod';
const CLOUD_REALTIME_PUB_URL = `https://ntfy.sh/${CLOUD_REALTIME_TOPIC}`;
const CLOUD_REALTIME_POLL_URL = `https://ntfy.sh/${CLOUD_REALTIME_TOPIC}/json?poll=1`;
const CLOUD_REALTIME_SSE_URL = `https://ntfy.sh/${CLOUD_REALTIME_TOPIC}/sse`;
const CLOUD_BYTEBIN_POST_URL = 'https://bytebin.lucko.me/post';
const CLOUD_BYTEBIN_BASE_URL = 'https://bytebin.lucko.me/';

const MIRROR_STORAGE_KEY = 'qh_cloud_mirror_v4';
const ADMIN_SESSION_KEY = 'qh_admin_session_v4';
const ADMIN_VIEW_OPEN_KEY = 'qh_admin_view_open_v4';
const CART_MIRROR_KEY = 'qh_cart_mirror_v4';

// Configuración opcional de proyecto propio de Supabase
let SUPABASE_CREDENTIALS = {
  url: '',
  anonKey: ''
};
let supabaseClient = null;
let supabaseChannel = null;
let realtimeEventSource = null;
let cloudPollTimer = null;
let isSavingCloud = false;
let hasCompletedInitialCloudPull = false;
let lastCloudMessageAt = 0;
// ntfy.sh conserva mensajes ~12h: re-publicamos un respaldo si el último tiene más de 3h
const CLOUD_REFRESH_MAX_AGE_MS = 3 * 60 * 60 * 1000;

function cloudStateHasBusinessData(st) {
  return (
    st.orders.length > 0 ||
    st.finances.partnerMovements.length > 0 ||
    st.finances.supplierPayments.length > 0 ||
    (st.finances.debtSettlements && st.finances.debtSettlements.length > 0) ||
    st.ambassadors.length > 0
  );
}
const CLIENT_INSTANCE_ID = 'qh-node-' + Math.random().toString(36).slice(2, 10);

// Catálogo oficial de productos (Formato exclusivo Bandejas de 30 unidades)
const PRODUCTS = [
  {
    id: 'campo-30',
    category: 'campo',
    typeLabel: 'Huevo de Campo (Color/Café)',
    name: 'Bandeja Huevo de Campo',
    format: '30 unidades',
    eggsCount: 30,
    commission: 2000,
    caliberBadge: 'Calibre Primera / Tamaño Grande',
    qualityNote: 'Huevos de Selección Grande • Yema dorada y cáscara firme',
    price: 11500,
    badge: '🔥 100% Campo Libre',
    popular: true,
    description: 'Bandeja de 30 huevos de campo de Selección Grande de cáscara marrón firme y yema dorada intensa. Recolectados de gallinas 100% libres de pastoreo.',
    features: ['30 unidades de Selección Grande', 'Gallinas 100% libres de pastoreo', 'Yema dorada cremosa natural']
  },
  {
    id: 'blanco-30',
    category: 'blanco',
    typeLabel: 'Huevo Blanco Seleccionado',
    name: 'Bandeja Huevo Blanco Seleccionado',
    format: '30 unidades',
    eggsCount: 30,
    commission: 2000,
    caliberBadge: 'Calibre Primera / Tamaño Grande',
    qualityNote: 'Huevos de Selección Grande • Clara densa y cáscara limpia',
    price: 9000,
    badge: '⭐ Selección Grande',
    popular: false,
    description: 'Bandeja de 30 huevos blancos de Selección Grande con cáscara limpia y clara densa de alta proteína. Máxima frescura garantizada en tu cocina.',
    features: ['30 unidades de Selección Grande', 'Alimentación natural 100% limpia', 'Clara firme y yema consistente']
  }
];

const ALL_TRACKABLE_BUTTONS = [
  'Botón Verde WhatsApp: Tengo listo mi pedido, enviar a WhatsApp',
  'Drawer Botón Verde: Tengo listo mi pedido, enviar a WhatsApp',
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
  'campo-30': 1,
  'blanco-30': 1
};

// Estado en memoria del Carrito del cliente actual (inicia en 0)
let orderCart = {};
let currentOrderType = 'Pedido Único'; // 'Pedido Único' | 'Pedido Fijo Semanal'
let currentDeliveryDay = 'Lunes'; // 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes'
let customerName = '';
let customerAddress = '';
let currentAmbassadorCode = '';
let activeFilter = 'all';
let activeAdminTab = 'all';
let currentAdminUser = null;

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

function getNowFormatted() {
  const now = new Date();
  return now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* ==========================================================================
   MÓDULO 0: MOTOR DE BASE DE DATOS CLOUD PERMANENTE Y REALTIME
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

function getEmptyCloudState(resetTimestamp = 0) {
  return {
    orders: [],
    finances: {
      partnerMovements: [],
      supplierPayments: [],
      debtSettlements: []
    },
    ambassadors: [],
    analytics: getDefaultAnalytics(),
    deletedIds: [],
    resetAt: resetTimestamp,
    updatedAt: resetTimestamp,
    updatedBy: 'system',
    supabaseConfig: SUPABASE_CREDENTIALS
  };
}

// Estado global sincronizado con la Nube (arranca en cero absoluto o desde espejo local instantáneo)
let CLOUD_STATE = getEmptyCloudState(0);

function saveLocalCloudMirror() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(MIRROR_STORAGE_KEY, JSON.stringify(CLOUD_STATE));
    }
  } catch (e) {
    // ignore
  }
}

function loadLocalCloudMirror() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(MIRROR_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        CLOUD_STATE = normalizeStateObject(parsed);
      }
      const savedAdmin = window.localStorage.getItem(ADMIN_SESSION_KEY);
      if (savedAdmin) {
        currentAdminUser = savedAdmin;
      }
      const savedName = window.localStorage.getItem('qh_customer_name');
      if (savedName) customerName = savedName;
      const savedAddress = window.localStorage.getItem('qh_customer_address');
      if (savedAddress) customerAddress = savedAddress;
      const savedDay = window.localStorage.getItem('qh_delivery_day');
      if (savedDay) currentDeliveryDay = savedDay;
    }
  } catch (e) {
    // ignore
  }
}

function normalizeStateObject(raw) {
  const base = getEmptyCloudState(0);
  if (!raw || typeof raw !== 'object') return base;

  const normalizedAnalytics = getDefaultAnalytics();
  if (raw.analytics && typeof raw.analytics === 'object') {
    normalizedAnalytics.pageViews = Number(raw.analytics.pageViews) || 0;
    normalizedAnalytics.totalClicks = Number(raw.analytics.totalClicks) || 0;
    normalizedAnalytics.addToCartEvents = Number(raw.analytics.addToCartEvents) || 0;
    normalizedAnalytics.whatsappCheckouts = Number(raw.analytics.whatsappCheckouts) || 0;

    if (raw.analytics.productStats && typeof raw.analytics.productStats === 'object') {
      PRODUCTS.forEach((p) => {
        const st = raw.analytics.productStats[p.id];
        if (st) {
          normalizedAnalytics.productStats[p.id] = {
            clicks: Number(st.clicks) || 0,
            addedToCart: Number(st.addedToCart) || 0,
            checkouts: Number(st.checkouts) || 0
          };
        }
      });
    }

    if (raw.analytics.buttonClicks && typeof raw.analytics.buttonClicks === 'object') {
      ALL_TRACKABLE_BUTTONS.forEach((btn) => {
        if (typeof raw.analytics.buttonClicks[btn] === 'number') {
          normalizedAnalytics.buttonClicks[btn] = raw.analytics.buttonClicks[btn];
        }
      });
    }

    if (Array.isArray(raw.analytics.eventLog)) {
      normalizedAnalytics.eventLog = raw.analytics.eventLog.slice(0, 40);
    }
  }

  return {
    orders: Array.isArray(raw.orders) ? raw.orders : [],
    finances: {
      partnerMovements:
        raw.finances && Array.isArray(raw.finances.partnerMovements)
          ? raw.finances.partnerMovements
          : [],
      supplierPayments:
        raw.finances && Array.isArray(raw.finances.supplierPayments)
          ? raw.finances.supplierPayments
          : [],
      debtSettlements:
        raw.finances && Array.isArray(raw.finances.debtSettlements)
          ? raw.finances.debtSettlements
          : []
    },
    ambassadors: Array.isArray(raw.ambassadors) ? raw.ambassadors : [],
    analytics: normalizedAnalytics,
    deletedIds: Array.isArray(raw.deletedIds) ? raw.deletedIds : [],
    resetAt: Number(raw.resetAt) || 0,
    updatedAt: Number(raw.updatedAt) || 0,
    updatedBy: raw.updatedBy || 'system',
    supabaseConfig: raw.supabaseConfig || SUPABASE_CREDENTIALS
  };
}

/**
 * Fusiona sin conflictos el estado local con el estado remoto de la nube
 * para que ningún pedido, aporte o pago de Juanjo o Morensex se pierda jamás.
 */
function mergeCloudStates(stateA, stateB) {
  const a = normalizeStateObject(stateA);
  const b = normalizeStateObject(stateB);

  const effectiveResetAt = Math.max(a.resetAt || 0, b.resetAt || 0);
  const deletedSet = new Set([...(a.deletedIds || []), ...(b.deletedIds || [])]);

  const mergeCollectionById = (listA, listB) => {
    const map = new Map();
    [...listA, ...listB].forEach((item) => {
      if (!item || !item.id) return;
      if (deletedSet.has(item.id)) return;
      const itemTime = Number(item.updatedAt || item.timestamp || item.createdAtMs || 0);
      if (effectiveResetAt > 0 && itemTime > 0 && itemTime < effectiveResetAt) return;

      const existing = map.get(item.id);
      if (!existing) {
        map.set(item.id, item);
      } else {
        const existingTime = Number(existing.updatedAt || existing.timestamp || 0);
        if (itemTime >= existingTime) {
          map.set(item.id, item);
        }
      }
    });
    return Array.from(map.values()).sort(
      (x, y) => Number(y.timestamp || y.createdAtMs || 0) - Number(x.timestamp || x.createdAtMs || 0)
    );
  };

  // Si hubo un reinicio a cero más reciente en uno de los estados, usamos las métricas posteriores al reinicio
  const newerAnalyticsSource = (b.updatedAt || 0) >= (a.updatedAt || 0) ? b : a;
  const olderAnalyticsSource = newerAnalyticsSource === b ? a : b;

  let mergedAnalytics = getDefaultAnalytics();
  if (
    effectiveResetAt > 0 &&
    ((a.resetAt === effectiveResetAt && a.orders.length === 0 && a.updatedAt === effectiveResetAt) ||
      (b.resetAt === effectiveResetAt && b.orders.length === 0 && b.updatedAt === effectiveResetAt))
  ) {
    mergedAnalytics = newerAnalyticsSource.analytics;
  } else {
    mergedAnalytics.pageViews = Math.max(a.analytics.pageViews, b.analytics.pageViews);
    mergedAnalytics.totalClicks = Math.max(a.analytics.totalClicks, b.analytics.totalClicks);
    mergedAnalytics.addToCartEvents = Math.max(a.analytics.addToCartEvents, b.analytics.addToCartEvents);
    mergedAnalytics.whatsappCheckouts = Math.max(
      a.analytics.whatsappCheckouts,
      b.analytics.whatsappCheckouts
    );

    PRODUCTS.forEach((p) => {
      const sa = a.analytics.productStats[p.id] || { clicks: 0, addedToCart: 0, checkouts: 0 };
      const sb = b.analytics.productStats[p.id] || { clicks: 0, addedToCart: 0, checkouts: 0 };
      mergedAnalytics.productStats[p.id] = {
        clicks: Math.max(sa.clicks, sb.clicks),
        addedToCart: Math.max(sa.addedToCart, sb.addedToCart),
        checkouts: Math.max(sa.checkouts, sb.checkouts)
      };
    });

    ALL_TRACKABLE_BUTTONS.forEach((btn) => {
      mergedAnalytics.buttonClicks[btn] = Math.max(
        a.analytics.buttonClicks[btn] || 0,
        b.analytics.buttonClicks[btn] || 0
      );
    });

    mergedAnalytics.eventLog =
      (newerAnalyticsSource.analytics.eventLog || []).length >=
      (olderAnalyticsSource.analytics.eventLog || []).length
        ? newerAnalyticsSource.analytics.eventLog
        : olderAnalyticsSource.analytics.eventLog;
  }

  const supabaseCfg =
    b.supabaseConfig && b.supabaseConfig.url
      ? b.supabaseConfig
      : a.supabaseConfig && a.supabaseConfig.url
      ? a.supabaseConfig
      : SUPABASE_CREDENTIALS;

  return {
    orders: mergeCollectionById(a.orders, b.orders),
    finances: {
      partnerMovements: mergeCollectionById(
        a.finances.partnerMovements,
        b.finances.partnerMovements
      ),
      supplierPayments: mergeCollectionById(
        a.finances.supplierPayments,
        b.finances.supplierPayments
      ),
      debtSettlements: mergeCollectionById(
        a.finances.debtSettlements || [],
        b.finances.debtSettlements || []
      )
    },
    ambassadors: mergeCollectionById(a.ambassadors, b.ambassadors),
    analytics: mergedAnalytics,
    deletedIds: Array.from(deletedSet).slice(-300),
    resetAt: effectiveResetAt,
    updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0),
    updatedBy: (b.updatedAt || 0) >= (a.updatedAt || 0) ? b.updatedBy : a.updatedBy,
    supabaseConfig: supabaseCfg
  };
}

function updateCloudStatusUI(statusText, isOnline = true) {
  const badge = document.getElementById('cloud-sync-status-badge');
  const syncText = document.getElementById('cloud-last-sync-text');

  if (badge) {
    if (isOnline) {
      badge.className =
        'px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5';
      badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span>${
        supabaseClient
          ? '☁️ Supabase PostgreSQL + Realtime Online'
          : '☁️ Base de Datos Cloud • Realtime Online'
      }</span>`;
    } else {
      badge.className =
        'px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5';
      badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span><span>☁️ Reconectando a la Nube...</span>`;
    }
  }

  if (syncText && statusText) {
    syncText.textContent = statusText;
  }
}

/**
 * Inicializa el cliente oficial @supabase/supabase-js v2 y su canal Realtime
 * si el usuario configuró credenciales propias de Supabase.
 */
function initSupabaseSDK(url, anonKey) {
  if (!url || !anonKey || !window.supabase || !window.supabase.createClient) return false;
  try {
    SUPABASE_CREDENTIALS = { url: url.trim(), anonKey: anonKey.trim() };
    supabaseClient = window.supabase.createClient(
      SUPABASE_CREDENTIALS.url,
      SUPABASE_CREDENTIALS.anonKey
    );

    if (supabaseChannel) {
      supabaseClient.removeChannel(supabaseChannel);
    }

    supabaseChannel = supabaseClient
      .channel('qh-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'qh_cloud_store', filter: 'id=eq.production_v1' },
        (payload) => {
          if (payload && payload.new) {
            const remote = normalizeStateObject({
              orders: payload.new.orders,
              finances: payload.new.finances,
              ambassadors: payload.new.ambassadors,
              analytics: payload.new.analytics,
              deletedIds: payload.new.deleted_ids,
              resetAt: payload.new.reset_at,
              updatedAt: payload.new.updated_at,
              updatedBy: payload.new.updated_by
            });
            applyIncomingRemoteState(remote, 'Supabase Realtime');
          }
        }
      )
      .on('broadcast', { event: 'qh_state_update' }, (msg) => {
        if (msg && msg.payload && msg.payload.senderId !== CLIENT_INSTANCE_ID) {
          applyIncomingRemoteState(msg.payload.state, 'Supabase Broadcast');
        }
      })
      .subscribe();

    updateCloudStatusUI(`Supabase conectado (${getNowFormatted()})`, true);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Crea una versión compacta del estado para garantizar que el mensaje en ntfy.sh
 * siempre quede por debajo de 4KB inline (conservando el 100% de pedidos, finanzas y embajadores).
 */
function buildCompactCloudState(stateObj) {
  const s = normalizeStateObject(stateObj);
  return {
    orders: s.orders,
    finances: s.finances,
    ambassadors: s.ambassadors,
    deletedIds: (s.deletedIds || []).slice(-100),
    resetAt: s.resetAt,
    updatedAt: s.updatedAt,
    updatedBy: s.updatedBy,
    supabaseConfig: s.supabaseConfig,
    analytics: {
      pageViews: s.analytics.pageViews,
      totalClicks: s.analytics.totalClicks,
      addToCartEvents: s.analytics.addToCartEvents,
      whatsappCheckouts: s.analytics.whatsappCheckouts,
      productStats: s.analytics.productStats,
      buttonClicks: s.analytics.buttonClicks,
      eventLog: (s.analytics.eventLog || []).slice(0, 8)
    }
  };
}

/**
 * Descarga el estado permanente desde la Base de Datos Cloud (ntfy.sh + Bytebin + Supabase)
 */
async function pullCloudState(silent = false) {
  try {
    // 1. Si hay cliente Supabase configurado, leer de public.qh_cloud_store
    if (supabaseClient) {
      const { data, error } = await supabaseClient
        .from('qh_cloud_store')
        .select('*')
        .eq('id', 'production_v1')
        .maybeSingle();

      if (!error && data) {
        const supState = normalizeStateObject({
          orders: data.orders,
          finances: data.finances,
          ambassadors: data.ambassadors,
          analytics: data.analytics,
          deletedIds: data.deleted_ids,
          resetAt: data.reset_at,
          updatedAt: data.updated_at,
          updatedBy: data.updated_by
        });
        CLOUD_STATE = mergeCloudStates(CLOUD_STATE, supState);
        saveLocalCloudMirror();
        hasCompletedInitialCloudPull = true;
        refreshDashboardIfVisible();
        updateCloudStatusUI(`Sincronizado con Supabase (${getNowFormatted()})`, true);
      }
    }

    // 2. Leer el historial persistente en la nube desde ntfy.sh (poll=1)
    const response = await fetch(`${CLOUD_REALTIME_POLL_URL}&_t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store'
    });

    if (response.ok) {
      const text = await response.text();
      const lines = text.split('\n').filter((line) => line.trim().length > 0);
      let reconstructed = getEmptyCloudState(0);
      let foundCloudMessages = false;
      let latestBytebinKey = null;

      for (const line of lines) {
        try {
          const outer = JSON.parse(line);
          if (!outer || outer.event !== 'message') continue;
          if (outer.time) {
            lastCloudMessageAt = Math.max(lastCloudMessageAt, Number(outer.time) * 1000);
          }
          let payload = null;
          if (outer.attachment && outer.attachment.url) {
            // Mensajes > 4KB se guardan como adjunto en ntfy.sh
            try {
              const attRes = await fetch(outer.attachment.url, { cache: 'no-store' });
              if (attRes.ok) payload = JSON.parse(await attRes.text());
            } catch (attErr) {
              payload = null;
            }
          } else if (outer.message) {
            payload = JSON.parse(outer.message);
          }
          if (!payload) continue;

          if (payload.bytebinKey) {
            latestBytebinKey = payload.bytebinKey;
          }

          if (payload.state && typeof payload.state === 'object') {
            foundCloudMessages = true;
            const inc = normalizeStateObject(payload.state);
            const isExplicitReset =
              (inc.resetAt || 0) > (reconstructed.resetAt || 0) &&
              inc.orders.length === 0 &&
              inc.finances.partnerMovements.length === 0 &&
              inc.finances.supplierPayments.length === 0 &&
              (!inc.finances.debtSettlements || inc.finances.debtSettlements.length === 0) &&
              inc.ambassadors.length === 0;

            if (isExplicitReset) {
              reconstructed = inc;
            } else {
              reconstructed = mergeCloudStates(reconstructed, inc);
            }
          }
        } catch (lineErr) {
          // Ignorar líneas malformadas
        }
      }

      // 3. Si el último estado tiene respaldo completo en Bytebin Cloud Store, descargarlo y fusionarlo
      if (latestBytebinKey) {
        try {
          const bbRes = await fetch(`${CLOUD_BYTEBIN_BASE_URL}${latestBytebinKey}`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            cache: 'no-store'
          });
          if (bbRes.ok) {
            const bbJson = await bbRes.json();
            if (bbJson && typeof bbJson === 'object') {
              foundCloudMessages = true;
              const bbState = normalizeStateObject(bbJson);
              reconstructed = mergeCloudStates(reconstructed, bbState);
            }
          }
        } catch (bbErr) {
          // Continuar con el estado reconstruido de ntfy
        }
      }

      if (foundCloudMessages) {
        const hadNewerRemote = (reconstructed.updatedAt || 0) !== (CLOUD_STATE.updatedAt || 0);
        const isExplicitRemoteReset =
          (reconstructed.resetAt || 0) > (CLOUD_STATE.resetAt || 0) &&
          reconstructed.orders.length === 0 &&
          reconstructed.finances.partnerMovements.length === 0 &&
          reconstructed.finances.supplierPayments.length === 0 &&
          (!reconstructed.finances.debtSettlements || reconstructed.finances.debtSettlements.length === 0) &&
          reconstructed.ambassadors.length === 0;

        if (isExplicitRemoteReset) {
          CLOUD_STATE = reconstructed;
        } else {
          CLOUD_STATE = mergeCloudStates(CLOUD_STATE, reconstructed);
        }

        saveLocalCloudMirror();

        if (
          CLOUD_STATE.supabaseConfig &&
          CLOUD_STATE.supabaseConfig.url &&
          CLOUD_STATE.supabaseConfig.anonKey &&
          !supabaseClient
        ) {
          initSupabaseSDK(CLOUD_STATE.supabaseConfig.url, CLOUD_STATE.supabaseConfig.anonKey);
        }

        if (hadNewerRemote || !silent) {
          refreshDashboardIfVisible();
        }
      }

      hasCompletedInitialCloudPull = true;
      updateCloudStatusUI(`Nube sincronizada (${getNowFormatted()})`, true);
    }
  } catch (e) {
    updateCloudStatusUI('Usando respaldo local + reconectando Cloud...', false);
  }
  return CLOUD_STATE;
}

/**
 * Guarda de forma permanente el estado en la Base de Datos Cloud (Espejo Local 0ms + Bytebin + ntfy Realtime + Supabase)
 * y emite el evento en Tiempo Real para que el otro administrador vea el cambio al instante.
 */
async function persistCloudState(actionSummary = 'Actualización') {
  CLOUD_STATE.updatedAt = Date.now();
  CLOUD_STATE.updatedBy = currentAdminUser || 'Tienda Online';
  CLOUD_STATE.supabaseConfig = SUPABASE_CREDENTIALS;

  // 1. Guardado instantáneo en espejo local (0ms): si el usuario recarga con F5 de inmediato, no pierde nada
  saveLocalCloudMirror();
  refreshDashboardIfVisible();
  updateCloudStatusUI(`Guardando en la nube...`, true);

  try {
    isSavingCloud = true;

    // 2. Si aún no se había descargado el historial de la nube en esta sesión, fusionarlo antes de publicar
    if (!hasCompletedInitialCloudPull) {
      await pullCloudState(true);
      CLOUD_STATE.updatedAt = Date.now();
      saveLocalCloudMirror();
    }

    // 3. Guardar objeto JSON completo en Bytebin Cloud Store
    let bytebinKey = null;
    try {
      const bbPost = await fetch(CLOUD_BYTEBIN_POST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(CLOUD_STATE)
      });
      if (bbPost.ok) {
        const bbData = await bbPost.json();
        if (bbData && bbData.key) {
          bytebinKey = bbData.key;
        }
      }
    } catch (bbErr) {
      // Continuar con ntfy y Supabase aunque Bytebin falle
    }

    // 4. Si Supabase está activo, hacer UPSERT permanente en PostgreSQL + Broadcast Realtime
    let supabasePromise = Promise.resolve();
    if (supabaseClient) {
      supabasePromise = supabaseClient.from('qh_cloud_store').upsert(
        {
          id: 'production_v1',
          orders: CLOUD_STATE.orders,
          finances: CLOUD_STATE.finances,
          ambassadors: CLOUD_STATE.ambassadors,
          analytics: CLOUD_STATE.analytics,
          deleted_ids: CLOUD_STATE.deletedIds,
          reset_at: CLOUD_STATE.resetAt,
          updated_at: CLOUD_STATE.updatedAt,
          updated_by: CLOUD_STATE.updatedBy
        },
        { onConflict: 'id' }
      );

      if (supabaseChannel) {
        supabaseChannel.send({
          type: 'broadcast',
          event: 'qh_state_update',
          payload: {
            senderId: CLIENT_INSTANCE_ID,
            actionSummary,
            state: CLOUD_STATE
          }
        });
      }
    }

    // 5. Publicar y almacenar en el canal Cloud Persistente + SSE Realtime (ntfy.sh)
    const compactState = buildCompactCloudState(CLOUD_STATE);
    const realtimeBroadcastPromise = fetch(CLOUD_REALTIME_PUB_URL, {
      method: 'POST',
      body: JSON.stringify({
        senderId: CLIENT_INSTANCE_ID,
        actionSummary,
        updatedBy: CLOUD_STATE.updatedBy,
        updatedAt: CLOUD_STATE.updatedAt,
        bytebinKey,
        state: compactState
      })
    }).catch(() => {});

    await Promise.all([supabasePromise, realtimeBroadcastPromise]);
    saveLocalCloudMirror();
    updateCloudStatusUI(`Guardado en la nube (${getNowFormatted()})`, true);
    refreshDashboardIfVisible();
  } catch (e) {
    updateCloudStatusUI('Guardado localmente • Reintentando nube', false);
  } finally {
    isSavingCloud = false;
  }
}

function applyIncomingRemoteState(remoteRaw, sourceLabel = 'Cloud Realtime') {
  if (!remoteRaw) return;
  const incoming = normalizeStateObject(remoteRaw);
  const previousUpdatedAt = CLOUD_STATE.updatedAt || 0;

  // Si es un reinicio explícito más reciente, reemplazar por el estado limpio
  const isExplicitReset =
    (incoming.resetAt || 0) > (CLOUD_STATE.resetAt || 0) &&
    incoming.orders.length === 0 &&
    incoming.finances.partnerMovements.length === 0 &&
    incoming.finances.supplierPayments.length === 0 &&
    (!incoming.finances.debtSettlements || incoming.finances.debtSettlements.length === 0) &&
    incoming.ambassadors.length === 0;

  if (isExplicitReset) {
    CLOUD_STATE = incoming;
  } else {
    CLOUD_STATE = mergeCloudStates(CLOUD_STATE, incoming);
  }

  saveLocalCloudMirror();
  refreshDashboardIfVisible();
  updateCloudStatusUI(`Sincronizado en vivo (${getNowFormatted()})`, true);

  const dashboard = document.getElementById('admin-dashboard-view');
  const isDashboardOpen = dashboard && !dashboard.classList.contains('hidden');
  if (isDashboardOpen && (incoming.updatedAt || 0) > previousUpdatedAt) {
    showToast(`☁️ Sincronizado en tiempo real (${incoming.updatedBy || sourceLabel})`);
  }
}

/**
 * Conecta el listener SSE en Tiempo Real + heartbeat de respaldo
 * para garantizar sincronización instantánea entre Juanjo y Morensex.
 */
function startRealtimeCloudSubscriptions() {
  if (typeof window.EventSource !== 'undefined') {
    try {
      if (realtimeEventSource) {
        realtimeEventSource.close();
      }
      realtimeEventSource = new EventSource(CLOUD_REALTIME_SSE_URL);
      realtimeEventSource.onmessage = async (event) => {
        try {
          const outer = JSON.parse(event.data);
          if (!outer || outer.event !== 'message') return;
          if (outer.time) {
            lastCloudMessageAt = Math.max(lastCloudMessageAt, Number(outer.time) * 1000);
          }
          let payload = null;
          if (outer.attachment && outer.attachment.url) {
            const attRes = await fetch(outer.attachment.url, { cache: 'no-store' });
            if (attRes.ok) payload = JSON.parse(await attRes.text());
          } else if (outer.message) {
            payload = JSON.parse(outer.message);
          }
          if (!payload || payload.senderId === CLIENT_INSTANCE_ID) return;

          if (payload.state) {
            applyIncomingRemoteState(payload.state, payload.updatedBy || 'Realtime');
          }
          if (payload.bytebinKey) {
            try {
              const bbRes = await fetch(`${CLOUD_BYTEBIN_BASE_URL}${payload.bytebinKey}`, {
                method: 'GET',
                headers: { Accept: 'application/json' },
                cache: 'no-store'
              });
              if (bbRes.ok) {
                const bbJson = await bbRes.json();
                if (bbJson) {
                  applyIncomingRemoteState(bbJson, payload.updatedBy || 'Realtime');
                }
              }
            } catch (errBb) {
              // ignore
            }
          }
        } catch (err) {
          // ignore malformed messages
        }
      };
    } catch (e) {
      // fallback to polling
    }
  }

  // Respaldo periódico cada 10 segundos para redes móviles o reconexiones
  if (cloudPollTimer) clearInterval(cloudPollTimer);
  cloudPollTimer = setInterval(() => {
    if (!isSavingCloud) {
      pullCloudState(true);
    }
  }, 10000);
}

async function forceCloudRefresh() {
  updateCloudStatusUI('Sincronizando con la nube...', true);
  await pullCloudState(false);
  showToast('☁️ Datos sincronizados desde la Base de Datos en la Nube');
}

/* ==========================================================================
   MODAL DE CONEXIÓN SUPABASE (PARA DESPLIEGUE EN VERCEL / PROYECTO PROPIO)
   ========================================================================== */

function openSupabaseConfigModal() {
  const modal = document.getElementById('supabase-config-modal');
  const urlInp = document.getElementById('supabase-url-input');
  const keyInp = document.getElementById('supabase-key-input');

  if (urlInp) urlInp.value = SUPABASE_CREDENTIALS.url || '';
  if (keyInp) keyInp.value = SUPABASE_CREDENTIALS.anonKey || '';

  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeSupabaseConfigModal() {
  const modal = document.getElementById('supabase-config-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function handleSaveSupabaseConfig(event) {
  event.preventDefault();
  const url = (document.getElementById('supabase-url-input').value || '').trim();
  const key = (document.getElementById('supabase-key-input').value || '').trim();

  if (!url || !key) {
    SUPABASE_CREDENTIALS = { url: '', anonKey: '' };
    supabaseClient = null;
    await persistCloudState('Configuración Cloud por defecto');
    closeSupabaseConfigModal();
    showToast('☁️ Usando Base de Datos Cloud integrada en tiempo real');
    return;
  }

  const ok = initSupabaseSDK(url, key);
  if (ok) {
    await persistCloudState('Conexión a proyecto Supabase actualizada');
    await pullCloudState(false);
    closeSupabaseConfigModal();
    showToast('✅ Proyecto Supabase conectado y sincronizado en la nube');
  } else {
    showToast('⚠️ Verifica el formato de la URL y Anon Key de Supabase');
  }
}

function copySupabaseSQLSchema() {
  const sql = `CREATE TABLE IF NOT EXISTS public.qh_cloud_store (
  id TEXT PRIMARY KEY DEFAULT 'production_v1',
  orders JSONB NOT NULL DEFAULT '[]'::jsonb,
  finances JSONB NOT NULL DEFAULT '{"partnerMovements": [], "supplierPayments": []}'::jsonb,
  ambassadors JSONB NOT NULL DEFAULT '[]'::jsonb,
  analytics JSONB NOT NULL DEFAULT '{"pageViews": 0, "totalClicks": 0, "addToCartEvents": 0, "whatsappCheckouts": 0, "productStats": {}, "buttonClicks": {}, "eventLog": []}'::jsonb,
  deleted_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  reset_at BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT 0,
  updated_by TEXT NOT NULL DEFAULT 'system'
);
ALTER TABLE public.qh_cloud_store ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read write qh_cloud_store" ON public.qh_cloud_store FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.qh_cloud_store;`;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(sql);
  }
  showToast('📋 Script SQL de Supabase copiado al portapapeles');
}

/* ==========================================================================
   HELPERS DE ACCESO AL ESTADO EN LA NUBE
   ========================================================================== */

function loadAnalytics() {
  return CLOUD_STATE.analytics;
}

function loadOrders() {
  return CLOUD_STATE.orders;
}

function loadFinances() {
  return CLOUD_STATE.finances;
}

function loadAmbassadors() {
  return CLOUD_STATE.ambassadors;
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
  CLOUD_STATE.updatedAt = Date.now();
  saveLocalCloudMirror();
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
  CLOUD_STATE.updatedAt = Date.now();
  saveLocalCloudMirror();
  refreshDashboardIfVisible();
}

/* ==========================================================================
   MÓDULO 1: CARRITO DE COMPRAS, CÓDIGO DE EMBAJADOR Y CHECKOUT WHATSAPP
   ========================================================================== */

function handleAmbassadorInput(value) {
  currentAmbassadorCode = (value || '').trim();
  const mainInput = document.getElementById('ambassador-code-main');
  const drawerInput = document.getElementById('ambassador-code-drawer');
  if (mainInput && mainInput.value !== value) mainInput.value = value;
  if (drawerInput && drawerInput.value !== value) drawerInput.value = value;

  const waPreview = document.getElementById('whatsapp-live-preview');
  if (waPreview) {
    waPreview.textContent = buildWhatsAppDirectMessage();
  }
}

function handleCustomerDataInput(field, value) {
  if (field === 'name') {
    customerName = (value || '').trimStart();
    const mainInput = document.getElementById('customer-name-main');
    const drawerInput = document.getElementById('customer-name-drawer');
    if (mainInput && mainInput.value !== customerName) mainInput.value = customerName;
    if (drawerInput && drawerInput.value !== customerName) drawerInput.value = customerName;
    try { window.localStorage.setItem('qh_customer_name', customerName); } catch (e) {}
  } else if (field === 'address') {
    customerAddress = (value || '').trimStart();
    const mainInput = document.getElementById('customer-address-main');
    const drawerInput = document.getElementById('customer-address-drawer');
    if (mainInput && mainInput.value !== customerAddress) mainInput.value = customerAddress;
    if (drawerInput && drawerInput.value !== customerAddress) drawerInput.value = customerAddress;
    try { window.localStorage.setItem('qh_customer_address', customerAddress); } catch (e) {}
  }

  updateWhatsAppButtonState();

  const waPreview = document.getElementById('whatsapp-live-preview');
  if (waPreview) {
    waPreview.textContent = buildWhatsAppDirectMessage();
  }
}

function setDeliveryDay(day) {
  currentDeliveryDay = day;
  try { window.localStorage.setItem('qh_delivery_day', day); } catch (e) {}
  syncOrderUI();
  showToast(`📅 Día de entrega semanal: ${day}`);
}

function updateWhatsAppButtonState() {
  const hasName = customerName.trim().length > 0;
  const hasAddress = customerAddress.trim().length > 0;
  const isReady = hasName && hasAddress;

  const btnMain = document.getElementById('btn-whatsapp-checkout-main');
  const btnDrawer = document.getElementById('btn-whatsapp-checkout-drawer');
  const noticeMain = document.getElementById('customer-validation-notice-main');
  const noticeDrawer = document.getElementById('customer-validation-notice-drawer');

  if (btnMain) {
    if (isReady) {
      btnMain.classList.remove('opacity-60');
      btnMain.classList.add('pulse-whatsapp');
    } else {
      btnMain.classList.add('opacity-60');
      btnMain.classList.remove('pulse-whatsapp');
    }
  }

  if (btnDrawer) {
    if (isReady) {
      btnDrawer.classList.remove('opacity-60');
      btnDrawer.classList.add('pulse-whatsapp');
    } else {
      btnDrawer.classList.add('opacity-60');
      btnDrawer.classList.remove('pulse-whatsapp');
    }
  }

  if (noticeMain) {
    if (isReady) noticeMain.classList.add('hidden');
    else noticeMain.classList.remove('hidden');
  }
  if (noticeDrawer) {
    if (isReady) noticeDrawer.classList.add('hidden');
    else noticeDrawer.classList.remove('hidden');
  }
}

function setOrderType(type) {
  currentOrderType = type;
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
 * - Bandeja de 30 huevos: $2.000 de comisión por unidad.
 */
function calculateOrderCommission(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    const qty = Number(item.qty) || 0;
    const product = PRODUCTS.find((p) => p.id === item.id);
    const eggs = product ? product.eggsCount : parseInt(item.format, 10) || 0;
    if (eggs === 30) return sum + qty * 2000;
    // Históricos retrocompatibles
    if (eggs === 12) return sum + qty * 800;
    if (eggs === 60) return sum + qty * 4000;
    return sum + qty * 2000;
  }, 0);
}

/**
 * Construye el mensaje exacto para WhatsApp (+56953930491):
 * - [Cantidad]x Bandeja Huevo de Campo ($11.500 c/u)
 * - [Cantidad]x Bandeja Huevo Blanco ($9.000 c/u)
 * Total: $XX.XXX
 * Modalidad: [Pedido Único / Pedido Fijo Semanal]
 * [CONDICIONAL]: Quiero dejar agendado que me despachen todos los [DÍA ELEGIDO].
 *
 * Mis datos de entrega:
 * Nombre: [Nombre ingresado en la web]
 * Dirección: [Dirección ingresada en la web]
 * Código de embajador: [Código ingresado o 'Ninguno']
 */
function buildWhatsAppDirectMessage() {
  const qtyCampo = Number(orderCart['campo-30']) || 0;
  const qtyBlanco = Number(orderCart['blanco-30']) || 0;

  // Si el carrito está vacío en la vista previa inicial, mostrar 1x Campo por defecto
  const displayCampo = (qtyCampo === 0 && qtyBlanco === 0) ? 1 : qtyCampo;
  const displayBlanco = (qtyCampo === 0 && qtyBlanco === 0) ? 0 : qtyBlanco;

  const itemLines = [];
  let totalAmount = 0;

  if (displayCampo > 0) {
    const subCampo = displayCampo * 11500;
    totalAmount += subCampo;
    itemLines.push(`- ${displayCampo}x Bandeja Huevo de Campo ($11.500 c/u)`);
  }
  if (displayBlanco > 0) {
    const subBlanco = displayBlanco * 9000;
    totalAmount += subBlanco;
    itemLines.push(`- ${displayBlanco}x Bandeja Huevo Blanco ($9.000 c/u)`);
  }

  const itemsDetail = itemLines.join('\n');
  const totalFormatted = formatCLP(totalAmount);

  let weeklyLine = '';
  if (currentOrderType === 'Pedido Fijo Semanal') {
    weeklyLine = `\nQuiero dejar agendado que me despachen todos los ${currentDeliveryDay || 'Lunes'}.`;
  }

  const nameVal = customerName.trim() || '[Nombre ingresado en la web]';
  const addressVal = customerAddress.trim() || '[Dirección ingresada en la web]';
  const ambVal = currentAmbassadorCode.trim() || 'Ninguno';

  return (
`¡Hola! Tengo listo mi pedido de Qué Huevones:
${itemsDetail}
Total: ${totalFormatted}
Modalidad: ${currentOrderType}${weeklyLine}

Mis datos de entrega:
Nombre: ${nameVal}
Dirección: ${addressVal}
Código de embajador: ${ambVal}`
  );
}

/**
 * Ejecuta el Checkout Directo a WhatsApp (+56953930491),
 * valida que los datos obligatorios estén completos,
 * guarda el pedido permanentemente en la Base de Datos en la Nube
 * y abre WhatsApp con el mensaje 100% pre-rellenado.
 */
function triggerDirectWhatsAppCheckout(sourceLabel = 'Checkout Directo WhatsApp') {
  const name = customerName.trim();
  const address = customerAddress.trim();

  if (!name) {
    const inp = document.getElementById('customer-name-main') || document.getElementById('customer-name-drawer');
    if (inp) {
      inp.focus();
      inp.classList.add('ring-2', 'ring-red-400');
      setTimeout(() => inp.classList.remove('ring-2', 'ring-red-400'), 2500);
    }
    showToast('⚠️ Por favor completa Tu Nombre para enviar tu pedido');
    return;
  }

  if (!address) {
    const inp = document.getElementById('customer-address-main') || document.getElementById('customer-address-drawer');
    if (inp) {
      inp.focus();
      inp.classList.add('ring-2', 'ring-red-400');
      setTimeout(() => inp.classList.remove('ring-2', 'ring-red-400'), 2500);
    }
    showToast('⚠️ Por favor completa Tu Dirección de Entrega');
    return;
  }

  let qtyCampo = Number(orderCart['campo-30']) || 0;
  let qtyBlanco = Number(orderCart['blanco-30']) || 0;

  if (qtyCampo === 0 && qtyBlanco === 0) {
    orderCart['campo-30'] = 1;
    qtyCampo = 1;
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
    if (qty <= 0) return;
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
  const nowMs = Date.now();
  const nextOrderNum = 1001 + orders.length;
  const now = new Date();
  const formattedDate = now.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const cleanCode = (currentAmbassadorCode || '').trim().toUpperCase();
  const commissionAmount = calculateOrderCommission(orderItems);

  const newOrder = {
    id: `QH-${nextOrderNum}-${String(nowMs).slice(-4)}`,
    displayId: `QH-${nextOrderNum}`,
    date: formattedDate,
    timestamp: nowMs,
    updatedAt: nowMs,
    clientName: name,
    clientAddress: address,
    deliveryDay: currentOrderType === 'Pedido Fijo Semanal' ? currentDeliveryDay : null,
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

  analytics.whatsappCheckouts = (analytics.whatsappCheckouts || 0) + 1;
  analytics.eventLog.unshift({
    time: getNowFormatted(),
    type: 'CHECKOUT_WHATSAPP',
    detail: `Checkout WhatsApp (${currentOrderType}): ${formatCLP(subtotal)} • Cliente: ${name}${
      cleanCode ? ` • Embajador: ${cleanCode}` : ''
    }`
  });
  analytics.eventLog = analytics.eventLog.slice(0, 40);

  // Guardar permanentemente en la nube y notificar en tiempo real
  persistCloudState(`Nuevo pedido WhatsApp ${newOrder.displayId} (${name})`);

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
          <div class="p-3.5 rounded-2xl bg-white border-2 border-qh-brown/40 shadow-sm flex items-center justify-between gap-3">
            <div>
              <span class="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Precio Fijo Bandeja (30 un.)</span>
              <span class="font-display font-extrabold text-3xl sm:text-4xl text-qh-navy leading-none">${formatCLP(product.price)}</span>
            </div>
            <div class="text-right">
              <span class="text-xs font-black text-qh-brown bg-qh-brown/15 px-3 py-1.5 rounded-xl inline-block shadow-xs">
                ${formatCLP(unitPrice)} c/huevo
              </span>
              ${
                inCartQty > 0
                  ? `<span class="block text-[11px] font-extrabold text-emerald-700 mt-1">✓ ${inCartQty} en tu carrito</span>`
                  : `<span class="block text-[10px] font-bold text-slate-400 mt-1">30 unidades</span>`
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

  // Sincronizar inputs de nombre y dirección entre pantalla principal y drawer
  const mainNameInp = document.getElementById('customer-name-main');
  const drawerNameInp = document.getElementById('customer-name-drawer');
  if (mainNameInp && mainNameInp.value !== customerName) {
    mainNameInp.value = customerName;
  }
  if (drawerNameInp && drawerNameInp.value !== customerName) {
    drawerNameInp.value = customerName;
  }

  const mainAddressInp = document.getElementById('customer-address-main');
  const drawerAddressInp = document.getElementById('customer-address-drawer');
  if (mainAddressInp && mainAddressInp.value !== customerAddress) {
    mainAddressInp.value = customerAddress;
  }
  if (drawerAddressInp && drawerAddressInp.value !== customerAddress) {
    drawerAddressInp.value = customerAddress;
  }

  // Sincronizar estado visual de las tarjetas "Pedido Único" vs "Pedido Fijo Semanal"
  const isSemanal = currentOrderType === 'Pedido Fijo Semanal';
  const btnUnicoMain = document.getElementById('type-btn-unico-main');
  const btnSemanalMain = document.getElementById('type-btn-semanal-main');
  const btnUnicoDrawer = document.getElementById('type-btn-unico-drawer');
  const btnSemanalDrawer = document.getElementById('type-btn-semanal-drawer');

  // Mostrar / Ocultar selectores de día de entrega semanal
  const weeklyBoxMain = document.getElementById('weekly-day-box-main');
  const weeklyBoxDrawer = document.getElementById('weekly-day-box-drawer');
  if (weeklyBoxMain) {
    if (isSemanal) weeklyBoxMain.classList.remove('hidden');
    else weeklyBoxMain.classList.add('hidden');
  }
  if (weeklyBoxDrawer) {
    if (isSemanal) weeklyBoxDrawer.classList.remove('hidden');
    else weeklyBoxDrawer.classList.add('hidden');
  }

  // Actualizar botones de día seleccionado
  ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].forEach((day) => {
    const isDaySelected = currentDeliveryDay === day;
    const btnMain = document.querySelector(`.day-btn-main[data-day="${day}"]`);
    const btnDrawer = document.querySelector(`.day-btn-drawer[data-day="${day}"]`);
    if (btnMain) {
      btnMain.className = isDaySelected
        ? 'day-btn-main py-2.5 px-1 text-center rounded-xl font-display font-extrabold text-xs bg-amber-400 text-qh-navyDark shadow-md ring-2 ring-amber-300 transition'
        : 'day-btn-main py-2.5 px-1 text-center rounded-xl font-display font-bold text-xs bg-white text-qh-navy border border-slate-300 hover:border-qh-brown transition';
    }
    if (btnDrawer) {
      btnDrawer.className = isDaySelected
        ? 'day-btn-drawer py-1.5 px-0.5 text-center rounded-lg font-display font-extrabold text-[11px] bg-amber-400 text-qh-navyDark shadow transition'
        : 'day-btn-drawer py-1.5 px-0.5 text-center rounded-lg font-display font-bold text-[11px] bg-white text-qh-navy border border-slate-300 transition';
    }
  });

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
  updateWhatsAppButtonState();
  if (waPreview) waPreview.textContent = buildWhatsAppDirectMessage();
}

/* ==========================================================================
   MÓDULO 3: SISTEMA DE LOGIN Y DASHBOARD ADMINISTRATIVO ONLINE
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
  if (currentAdminUser && ALLOWED_ADMINS[currentAdminUser.toLowerCase()]) {
    showAdminDashboard(ALLOWED_ADMINS[currentAdminUser.toLowerCase()]);
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
    currentAdminUser = displayName;
    try {
      window.localStorage.setItem(ADMIN_SESSION_KEY, displayName);
    } catch (e) {
      // ignore
    }
    closeAdminLoginModal();
    document.getElementById('admin-login-form').reset();
    await showAdminDashboard(displayName);
    showToast(`🔓 Bienvenido al Dashboard Cloud, ${displayName}`);
  } else {
    if (errEl) errEl.classList.remove('hidden');
  }
}

async function showAdminDashboard(adminName) {
  const storefront = document.getElementById('storefront-view');
  const dashboard = document.getElementById('admin-dashboard-view');
  const badge = document.getElementById('admin-session-badge');
  const navLabel = document.getElementById('navbar-admin-label');

  if (storefront) storefront.classList.add('hidden');
  if (dashboard) dashboard.classList.remove('hidden');
  try {
    window.localStorage.setItem(ADMIN_VIEW_OPEN_KEY, '1');
  } catch (e) {
    // ignore
  }
  if (badge) badge.textContent = `Sesión activa: ${adminName}`;
  if (navLabel) navLabel.textContent = `Panel (${adminName})`;

  const movDate = document.getElementById('partner-mov-date');
  const supDate = document.getElementById('supplier-payment-date');
  if (movDate && !movDate.value) movDate.value = getTodayISODate();
  if (supDate && !supDate.value) supDate.value = getTodayISODate();

  renderAdminDashboard();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Descargar estado actualizado desde la nube inmediatamente al abrir el Dashboard
  await pullCloudState(false);
}

function closeAdminDashboard() {
  const storefront = document.getElementById('storefront-view');
  const dashboard = document.getElementById('admin-dashboard-view');
  if (dashboard) dashboard.classList.add('hidden');
  if (storefront) storefront.classList.remove('hidden');
  try {
    window.localStorage.removeItem(ADMIN_VIEW_OPEN_KEY);
  } catch (e) {
    // ignore
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function logoutAdmin() {
  currentAdminUser = null;
  try {
    window.localStorage.removeItem(ADMIN_SESSION_KEY);
  } catch (e) {
    // ignore
  }
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
   MÓDULO A: APROBACIÓN MANUAL DE PEDIDOS Y CONFIRMACIÓN DE EMBAJADOR EN NUBE
   ========================================================================== */

function ensureAmbassadorExistsByCode(codeRaw) {
  const clean = (codeRaw || '').trim().toUpperCase();
  if (!clean) return;
  const ambassadors = loadAmbassadors();
  const exists = ambassadors.some(
    (a) => a.code.toUpperCase() === clean || a.name.toUpperCase() === clean
  );
  if (!exists) {
    const nowMs = Date.now();
    ambassadors.push({
      id: 'AMB-' + clean,
      name: clean,
      code: clean,
      createdAt: new Date().toLocaleDateString('es-CL'),
      timestamp: nowMs,
      updatedAt: nowMs
    });
  }
}

function approveAndConfirmOrder(orderId) {
  const orders = loadOrders();
  const target = orders.find((o) => o.id === orderId);
  if (!target) return;

  const codeInp = document.getElementById(`order-amb-input-${orderId}`);
  const confirmedCode = codeInp
    ? codeInp.value.trim().toUpperCase()
    : (target.ambassadorCode || '').trim().toUpperCase();

  target.ambassadorCode = confirmedCode;
  target.approved = true;
  target.status = 'Aprobado';
  target.commissionAmount = calculateOrderCommission(target.items);
  target.updatedAt = Date.now();

  if (confirmedCode) {
    ensureAmbassadorExistsByCode(confirmedCode);
  }

  persistCloudState(`Pedido ${target.displayId || orderId} aprobado por ${currentAdminUser || 'Admin'}`);

  if (confirmedCode) {
    showToast(
      `✅ Pedido ${target.displayId || orderId} aprobado en la nube • Comisión ${formatCLP(
        target.commissionAmount
      )} sumada a ${confirmedCode}`
    );
  } else {
    showToast(`✅ Pedido ${target.displayId || orderId} aprobado en la nube`);
  }
}

function unapproveOrder(orderId) {
  const orders = loadOrders();
  const target = orders.find((o) => o.id === orderId);
  if (!target) return;
  target.approved = false;
  target.status = 'Pendiente Aprobación';
  target.updatedAt = Date.now();
  persistCloudState(`Pedido ${target.displayId || orderId} marcado pendiente`);
  showToast(`↩️ Pedido ${target.displayId || orderId} marcado como pendiente en la nube`);
}

function deleteOrderRecord(orderId) {
  CLOUD_STATE.deletedIds.push(orderId);
  CLOUD_STATE.orders = CLOUD_STATE.orders.filter((o) => o.id !== orderId);
  persistCloudState(`Pedido ${orderId} eliminado`);
  showToast(`🗑️ Pedido eliminado de la Base de Datos Cloud`);
}

function handleCreateManualOrder(event) {
  event.preventDefault();
  const productId = document.getElementById('manual-order-product').value;
  const qty = Math.max(1, parseInt(document.getElementById('manual-order-qty').value, 10) || 1);
  const orderType = document.getElementById('manual-order-type').value;
  const clientName =
    (document.getElementById('manual-order-client').value || '').trim() || 'Cliente WhatsApp';
  const ambassadorCode = (document.getElementById('manual-order-ambassador').value || '')
    .trim()
    .toUpperCase();

  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) return;

  const orders = loadOrders();
  const nowMs = Date.now();
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

  const displayId = `QH-${nextOrderNum}`;
  orders.unshift({
    id: `${displayId}-${String(nowMs).slice(-4)}`,
    displayId,
    date: formattedDate,
    timestamp: nowMs,
    updatedAt: nowMs,
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

  document.getElementById('admin-manual-order-form').reset();
  document.getElementById('manual-order-qty').value = 1;
  persistCloudState(`Pedido manual ${displayId} creado y aprobado`);

  showToast(
    `✅ Pedido ${displayId} guardado en la nube${
      ambassadorCode ? ` • Comisión ${formatCLP(commissionAmount)} sumada a ${ambassadorCode}` : ''
    }`
  );
}

/* ==========================================================================
   MÓDULO B: 💰 FINANZAS, CAJA DE LA EMPRESA Y SALDOS DE BOLSILLO EN LA NUBE
   ========================================================================== */

/**
 * Calcula el estado de la Caja de la Empresa y los saldos de bolsillo independientes
 * de Mati y Juanjo con división automática 50% según pagos a proveedores.
 */
function calculateFinancialState() {
  const orders = loadOrders();
  const finances = loadFinances();

  // 1. CAJA DE LA EMPRESA (FONDO COMÚN)
  let ordersPaidRevenue = 0;
  let paidOrdersCount = 0;

  orders.forEach((o) => {
    if (o.paid || (o.approved && o.status === 'Completado')) {
      ordersPaidRevenue += Number(o.subtotal) || 0;
      paidOrdersCount += 1;
    }
  });

  let capitalAportesToCaja = 0;
  (finances.partnerMovements || []).forEach((m) => {
    if (m.type === 'aporte' || m.type === 'aporte_caja') {
      capitalAportesToCaja += Number(m.amount) || 0;
    }
  });

  const totalCajaInflows = ordersPaidRevenue + capitalAportesToCaja;

  let cajaExpenses = 0;
  let matiOutOfPocket = 0;
  let juanjoOutOfPocket = 0;
  let totalSuppliersExpenses = 0;

  (finances.supplierPayments || []).forEach((sp) => {
    const amt = Number(sp.amount) || 0;
    totalSuppliersExpenses += amt;
    const payer = sp.payer;
    if (payer === 'Caja' || payer === 'caja' || payer === 'Caja de la Empresa') {
      cajaExpenses += amt;
    } else if (payer === 'Morensex' || payer === 'Mati' || payer === 'Bolsillo de Mati (Morensex)') {
      matiOutOfPocket += amt;
    } else if (payer === 'Juanjo' || payer === 'Bolsillo de Juanjo') {
      juanjoOutOfPocket += amt;
    }
  });

  const cajaDisponible = totalCajaInflows - cajaExpenses;

  // 2. LÓGICA DE DIVISIÓN 50% EXCLUSIVA PARA PAGOS A PROVEEDOR DESDE EL BOLSILLO DE LOS SOCIOS
  // - Cada gasto pagado a un proveedor o distribuidor por uno de los socios se divide automáticamente en 50% y 50%.
  // - Si paga Bolsillo de Mati: mitad (+50%) saldo a favor en Saldo de Mati, y la otra mitad (-50%) deuda en Saldo de Juanjo.
  // - Si paga Bolsillo de Juanjo: mitad (+50%) saldo a favor en Saldo de Juanjo, y la otra mitad (-50%) deuda en Saldo de Mati.
  // - Si ambos parten de cero o no han pagado, ambos saldos son $0.
  const saldoBolsilloMati = Math.round(matiOutOfPocket * 0.5 - juanjoOutOfPocket * 0.5);
  const saldoBolsilloJuanjo = Math.round(juanjoOutOfPocket * 0.5 - matiOutOfPocket * 0.5);

  return {
    cajaDisponible,
    totalCajaInflows,
    ordersPaidRevenue,
    paidOrdersCount,
    capitalAportesToCaja,
    cajaExpenses,
    totalSuppliersExpenses,
    matiOutOfPocket,
    juanjoOutOfPocket,
    saldoBolsilloMati,
    saldoBolsilloJuanjo
  };
}

function handleAddPartnerMovement(event) {
  event.preventDefault();
  const partner = document.getElementById('partner-mov-who').value;
  const type = document.getElementById('partner-mov-type').value;
  const date = document.getElementById('partner-mov-date').value || getTodayISODate();
  const amount = Math.max(0, Number(document.getElementById('partner-mov-amount').value) || 0);
  const concept = (document.getElementById('partner-mov-concept').value || '').trim();

  if (!amount || !concept) return;

  const nowMs = Date.now();
  const finances = loadFinances();
  finances.partnerMovements.unshift({
    id: 'PM-' + nowMs + '-' + Math.random().toString(36).slice(2, 6),
    date,
    partner,
    type,
    amount,
    concept,
    timestamp: nowMs,
    updatedAt: nowMs
  });

  const amtInput = document.getElementById('partner-mov-amount');
  const concInput = document.getElementById('partner-mov-concept');
  if (amtInput) amtInput.value = '';
  if (concInput) concInput.value = '';

  const partnerLabel = partner === 'Morensex' ? 'Morensex (Mati)' : 'Juanjo';
  persistCloudState(`Movimiento de socio (${partnerLabel}): ${formatCLP(amount)}`);
  showToast(`☁️ Movimiento de socio guardado en la nube: ${formatCLP(amount)}`);
}

function deletePartnerMovement(movId) {
  CLOUD_STATE.deletedIds.push(movId);
  CLOUD_STATE.finances.partnerMovements = CLOUD_STATE.finances.partnerMovements.filter(
    (m) => m.id !== movId
  );
  persistCloudState('Movimiento de socio eliminado');
  showToast('🗑️ Movimiento de socio eliminado de la nube');
}

/**
 * Registra un pago a proveedor distinguiendo:
 * - Opción A: "Bolsillo de Mati (Morensex)" -> +50% saldo a favor Mati / -50% deuda Juanjo
 * - Opción B: "Bolsillo de Juanjo" -> +50% saldo a favor Juanjo / -50% deuda Mati
 * - Opción C: "Caja de la Empresa" -> Descuenta del fondo común sin generar deuda entre socios
 */
function handleAddSupplierPayment(event) {
  event.preventDefault();
  const date = document.getElementById('supplier-payment-date').value || getTodayISODate();
  const amount = Math.max(0, Number(document.getElementById('supplier-payment-amount').value) || 0);
  const concept = (document.getElementById('supplier-payment-concept').value || '').trim();
  const payer = document.getElementById('supplier-payment-payer').value || 'Caja';

  if (!amount || !concept) return;

  const nowMs = Date.now();
  const finances = loadFinances();
  finances.supplierPayments.unshift({
    id: 'SP-' + nowMs + '-' + Math.random().toString(36).slice(2, 6),
    date,
    amount,
    concept,
    payer,
    timestamp: nowMs,
    updatedAt: nowMs
  });

  const amtInput = document.getElementById('supplier-payment-amount');
  const concInput = document.getElementById('supplier-payment-concept');
  if (amtInput) amtInput.value = '';
  if (concInput) concInput.value = '';

  const half = Math.round(amount * 0.5);
  let toastNote = '';
  if (payer === 'Caja') {
    toastNote = ' • Descontado de Caja de la Empresa';
  } else if (payer === 'Morensex') {
    toastNote = ` • Pagó Mati (+${formatCLP(half)} a favor de Mati / -${formatCLP(half)} deuda Juanjo)`;
  } else if (payer === 'Juanjo') {
    toastNote = ` • Pagó Juanjo (+${formatCLP(half)} a favor de Juanjo / -${formatCLP(half)} deuda Mati)`;
  }

  persistCloudState(`Pago a proveedor: ${formatCLP(amount)} (${payer})`);
  showToast(`☁️ Pago a proveedor guardado: ${formatCLP(amount)}${toastNote}`);
}

function deleteSupplierPayment(payId) {
  CLOUD_STATE.deletedIds.push(payId);
  CLOUD_STATE.finances.supplierPayments = CLOUD_STATE.finances.supplierPayments.filter(
    (p) => p.id !== payId
  );
  persistCloudState('Pago a proveedor eliminado');
  showToast('🗑️ Registro de pago a proveedor eliminado');
}

/**
 * Abre el modal para editar un pago a proveedor.
 */
function openEditExpenseModal(payId) {
  const finances = loadFinances();
  const sp = (finances.supplierPayments || []).find((p) => p.id === payId);
  if (!sp) return;

  const modal = document.getElementById('edit-finance-modal');
  const idInput = document.getElementById('edit-finance-id');
  const payerSelect = document.getElementById('edit-finance-payer');
  const dateInput = document.getElementById('edit-finance-date');
  const amtInput = document.getElementById('edit-finance-amount');
  const concInput = document.getElementById('edit-finance-concept');

  if (!modal) return;

  idInput.value = sp.id;
  if (payerSelect) {
    if (sp.payer === 'Morensex' || sp.payer === 'Mati') {
      payerSelect.value = 'Morensex';
    } else if (sp.payer === 'Juanjo') {
      payerSelect.value = 'Juanjo';
    } else {
      payerSelect.value = 'Caja';
    }
  }
  if (dateInput) dateInput.value = sp.date || getTodayISODate();
  if (amtInput) amtInput.value = sp.amount || 0;
  if (concInput) concInput.value = sp.concept || '';

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeEditFinanceModal() {
  const modal = document.getElementById('edit-finance-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

/**
 * Guarda los cambios editados en un pago a proveedor y los sincroniza en la nube.
 */
function handleSaveEditFinanceRecord(event) {
  event.preventDefault();
  const id = document.getElementById('edit-finance-id').value;
  const date = document.getElementById('edit-finance-date').value || getTodayISODate();
  const amount = Math.max(0, Number(document.getElementById('edit-finance-amount').value) || 0);
  const concept = (document.getElementById('edit-finance-concept').value || '').trim();
  const payer = document.getElementById('edit-finance-payer').value || 'Caja';

  if (!id || !amount || !concept) return;

  const finances = loadFinances();
  const sp = (finances.supplierPayments || []).find((p) => p.id === id);
  if (!sp) return;

  sp.date = date;
  sp.amount = amount;
  sp.concept = concept;
  sp.payer = payer;
  sp.updatedAt = Date.now();

  persistCloudState(`Pago a proveedor actualizado: ${formatCLP(amount)} (${payer})`);
  showToast(`✏️ Pago a proveedor actualizado en la nube: ${formatCLP(amount)}`);
  closeEditFinanceModal();
}

/**
 * Alterna el estado de cobro en Caja de un pedido ('Cobrado en Caja' vs 'Pendiente')
 * permitiendo ingresar de inmediato su dinero a la Caja Disponible.
 */
function toggleOrderPaid(orderId) {
  const orders = loadOrders();
  const target = orders.find((o) => o.id === orderId);
  if (!target) return;

  target.paid = !target.paid;
  if (target.paid) {
    target.approved = true;
    target.status = 'Completado';
  } else {
    target.status = target.approved ? 'Aprobado' : 'Pendiente Aprobación';
  }
  target.updatedAt = Date.now();

  const msg = target.paid
    ? `💰 Pedido ${target.displayId || orderId} cobrado e ingresado a Caja (${formatCLP(target.subtotal)})`
    : `↩️ Pedido ${target.displayId || orderId} desmarcado de Caja`;

  persistCloudState(msg);
  showToast(msg);
}

/**
 * Paga la comisión acumulada de un embajador descontándola directamente de la Caja de la Empresa.
 */
function payAmbassadorCommission(code, name, amount) {
  if (!amount || amount <= 0) {
    showToast('⚠️ Este embajador no registra comisiones acumuladas.');
    return;
  }
  const confirmed = confirm(
    `¿Confirmas registrar el pago de comisión de ${formatCLP(amount)} a ${name} (${code}) descontándolo directamente de la Caja Disponible de la Empresa?`
  );
  if (!confirmed) return;

  const nowMs = Date.now();
  const finances = loadFinances();
  finances.supplierPayments.unshift({
    id: 'SP-AMB-' + nowMs + '-' + Math.random().toString(36).slice(2, 6),
    date: getTodayISODate(),
    amount,
    concept: `Pago Comisión Embajador: ${name} (${code})`,
    payer: 'Caja',
    timestamp: nowMs,
    updatedAt: nowMs
  });

  persistCloudState(`Pago de comisión a ${code}: ${formatCLP(amount)} desde Caja`);
  showToast(`💸 Comisión de ${formatCLP(amount)} pagada a ${name} y descontada de Caja de la Empresa`);
}

/**
 * Alterna el estado de cobro en Caja de un pedido ('Cobrado en Caja' vs 'Pendiente')
 * permitiendo ingresar de inmediato su dinero a la Caja Disponible.
 */
function toggleOrderPaid(orderId) {
  const orders = loadOrders();
  const target = orders.find((o) => o.id === orderId);
  if (!target) return;

  target.paid = !target.paid;
  if (target.paid) {
    target.approved = true;
    target.status = 'Completado';
  } else {
    target.status = target.approved ? 'Aprobado' : 'Pendiente Aprobación';
  }
  target.updatedAt = Date.now();

  const msg = target.paid
    ? `💰 Pedido ${target.displayId || orderId} cobrado e ingresado a Caja (${formatCLP(target.subtotal)})`
    : `↩️ Pedido ${target.displayId || orderId} desmarcado de Caja`;

  persistCloudState(msg);
  showToast(msg);
}

/**
 * Paga la comisión acumulada de un embajador descontándola directamente de la Caja de la Empresa.
 */
function payAmbassadorCommission(code, name, amount) {
  if (!amount || amount <= 0) {
    showToast('⚠️ Este embajador no registra comisiones acumuladas.');
    return;
  }
  const confirmed = confirm(
    `¿Confirmas registrar el pago de comisión de ${formatCLP(amount)} a ${name} (${code}) descontándolo directamente de la Caja Disponible de la Empresa?`
  );
  if (!confirmed) return;

  const nowMs = Date.now();
  const finances = loadFinances();
  finances.supplierPayments.unshift({
    id: 'SP-AMB-' + nowMs + '-' + Math.random().toString(36).slice(2, 6),
    date: getTodayISODate(),
    amount,
    concept: `Pago Comisión Embajador: ${name} (${code})`,
    payer: 'Caja',
    timestamp: nowMs,
    updatedAt: nowMs
  });

  persistCloudState(`Pago de comisión a ${code}: ${formatCLP(amount)} desde Caja`);
  showToast(`💸 Comisión de ${formatCLP(amount)} pagada a ${name} y descontada de Caja de la Empresa`);
}

/* ==========================================================================
   MÓDULO C: 🤝 SISTEMA DE EMBAJADORES Y COMISIONES EN LA NUBE
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

  const nowMs = Date.now();
  ambassadors.push({
    id: 'AMB-' + code + '-' + String(nowMs).slice(-4),
    name,
    code,
    createdAt: new Date().toLocaleDateString('es-CL'),
    timestamp: nowMs,
    updatedAt: nowMs
  });

  nameInp.value = '';
  codeInp.value = '';
  persistCloudState(`Nuevo embajador registrado: ${name} (${code})`);
  showToast(`☁️ Embajador ${name} guardado en la nube con código: ${code}`);
}

function copyAmbassadorCode(code) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code);
  }
  showToast(`📋 Código de embajador copiado: ${code}`);
}

function deleteAmbassador(ambId) {
  CLOUD_STATE.deletedIds.push(ambId);
  CLOUD_STATE.ambassadors = CLOUD_STATE.ambassadors.filter((a) => a.id !== ambId);
  persistCloudState('Embajador eliminado');
  showToast('🗑️ Embajador eliminado de la Base de Datos Cloud');
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

  // 2. Calcular Estado de Cuenta de Socios, Caja de Empresa y Gastos
  const fin = calculateFinancialState();

  const compCashBalEl = document.getElementById('company-cash-balance');
  const compCashInEl = document.getElementById('company-cash-inflows');
  const compCashOrdNoteEl = document.getElementById('company-cash-orders-note');
  const compCashExpEl = document.getElementById('company-cash-expenses');

  if (compCashBalEl) compCashBalEl.textContent = formatCLP(fin.cajaDisponible);
  if (compCashInEl) compCashInEl.textContent = formatCLP(fin.totalCajaInflows);
  if (compCashOrdNoteEl) compCashOrdNoteEl.textContent = `${fin.paidOrdersCount} pedido(s) cobrado(s) en caja`;
  if (compCashExpEl) compCashExpEl.textContent = formatCLP(fin.cajaExpenses);

  // Saldo Bolsillo de Mati
  const balMatiEl = document.getElementById('partner-balance-mati');
  const badgeMatiEl = document.getElementById('partner-mati-badge');
  const totalMatiPaidEl = document.getElementById('partner-mati-total-paid');
  const statusNoteMatiEl = document.getElementById('partner-mati-status-note');

  if (totalMatiPaidEl) totalMatiPaidEl.textContent = formatCLP(fin.matiOutOfPocket);

  if (balMatiEl) {
    if (fin.saldoBolsilloMati > 0) {
      balMatiEl.textContent = `+${formatCLP(fin.saldoBolsilloMati)}`;
      balMatiEl.className = 'font-display font-black text-3xl sm:text-4xl text-emerald-400 mt-1';
      if (badgeMatiEl) {
        badgeMatiEl.textContent = '🟢 Saldo a Favor';
        badgeMatiEl.className =
          'px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
      }
      if (statusNoteMatiEl) statusNoteMatiEl.textContent = `A favor (+${formatCLP(fin.saldoBolsilloMati)})`;
    } else if (fin.saldoBolsilloMati < 0) {
      balMatiEl.textContent = `-${formatCLP(Math.abs(fin.saldoBolsilloMati))}`;
      balMatiEl.className = 'font-display font-black text-3xl sm:text-4xl text-rose-400 mt-1';
      if (badgeMatiEl) {
        badgeMatiEl.textContent = '🔴 Deuda';
        badgeMatiEl.className =
          'px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/30';
      }
      if (statusNoteMatiEl)
        statusNoteMatiEl.textContent = `Debe pagar ${formatCLP(Math.abs(fin.saldoBolsilloMati))}`;
    } else {
      balMatiEl.textContent = '$0';
      balMatiEl.className = 'font-display font-black text-3xl sm:text-4xl text-slate-200 mt-1';
      if (badgeMatiEl) {
        badgeMatiEl.textContent = '⚪ Al Día ($0)';
        badgeMatiEl.className =
          'px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-white/10 text-slate-300 border border-white/10';
      }
      if (statusNoteMatiEl) statusNoteMatiEl.textContent = 'Al día ($0)';
    }
  }

  // Saldo Bolsillo de Juanjo
  const balJuanjoEl = document.getElementById('partner-balance-juanjo');
  const badgeJuanjoEl = document.getElementById('partner-juanjo-badge');
  const totalJuanjoPaidEl = document.getElementById('partner-juanjo-total-paid');
  const statusNoteJuanjoEl = document.getElementById('partner-juanjo-status-note');

  if (totalJuanjoPaidEl) totalJuanjoPaidEl.textContent = formatCLP(fin.juanjoOutOfPocket);

  if (balJuanjoEl) {
    if (fin.saldoBolsilloJuanjo > 0) {
      balJuanjoEl.textContent = `+${formatCLP(fin.saldoBolsilloJuanjo)}`;
      balJuanjoEl.className = 'font-display font-black text-3xl sm:text-4xl text-emerald-400 mt-1';
      if (badgeJuanjoEl) {
        badgeJuanjoEl.textContent = '🟢 Saldo a Favor';
        badgeJuanjoEl.className =
          'px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
      }
      if (statusNoteJuanjoEl) statusNoteJuanjoEl.textContent = `A favor (+${formatCLP(fin.saldoBolsilloJuanjo)})`;
    } else if (fin.saldoBolsilloJuanjo < 0) {
      balJuanjoEl.textContent = `-${formatCLP(Math.abs(fin.saldoBolsilloJuanjo))}`;
      balJuanjoEl.className = 'font-display font-black text-3xl sm:text-4xl text-rose-400 mt-1';
      if (badgeJuanjoEl) {
        badgeJuanjoEl.textContent = '🔴 Deuda';
        badgeJuanjoEl.className =
          'px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/30';
      }
      if (statusNoteJuanjoEl)
        statusNoteJuanjoEl.textContent = `Debe pagar ${formatCLP(Math.abs(fin.saldoBolsilloJuanjo))}`;
    } else {
      balJuanjoEl.textContent = '$0';
      balJuanjoEl.className = 'font-display font-black text-3xl sm:text-4xl text-slate-200 mt-1';
      if (badgeJuanjoEl) {
        badgeJuanjoEl.textContent = '⚪ Al Día ($0)';
        badgeJuanjoEl.className =
          'px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-white/10 text-slate-300 border border-white/10';
      }
      if (statusNoteJuanjoEl) statusNoteJuanjoEl.textContent = 'Al día ($0)';
    }
  }

  const supTotalBadge = document.getElementById('supplier-payments-total-badge');
  if (supTotalBadge) supTotalBadge.textContent = `Total: ${formatCLP(fin.totalSuppliersExpenses)}`;

  // 3. Calcular Comisiones de Embajadores sobre Pedidos Aprobados con Código
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
  if (kpiPartnersEl) kpiPartnersEl.textContent = formatCLP(fin.cajaDisponible);
  if (kpiSuppliersEl) {
    kpiSuppliersEl.textContent = `Pagado a proveedores: ${formatCLP(fin.totalSuppliersExpenses)}`;
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
            0 pedidos registrados en la Base de Datos Cloud. Listo para recibir ventas reales.
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
                <span class="font-display font-extrabold text-white block">${order.displayId || order.id}</span>
                <span class="text-[11px] text-slate-400 block">${order.date}</span>
                ${
                  order.clientName
                    ? `<span class="text-xs text-amber-300 font-bold block">${order.clientName}</span>`
                    : ''
                }
                ${
                  order.clientAddress
                    ? `<span class="text-[11px] text-slate-300 block truncate max-w-[200px]" title="${order.clientAddress}">📍 ${order.clientAddress}</span>`
                    : ''
                }
              </td>
              <td class="py-3.5 px-4 whitespace-nowrap">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${
                  isWeekly
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                    : 'bg-sky-400/15 text-sky-300 border border-sky-400/30'
                }">
                  ${isWeekly ? `🔁 Semanal (${order.deliveryDay || 'Lunes'})` : '1️⃣ Pedido Único'}
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
                        ${
                          order.paid
                            ? `
                              <span class="px-2.5 py-1 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-extrabold" title="Dinero ingresado a Caja de la Empresa">
                                💰 Cobrado en Caja
                              </span>
                              <button type="button" onclick="toggleOrderPaid('${order.id}')"
                                      class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-slate-300 transition"
                                      title="Desmarcar cobro en caja">
                                ↩️ Pendiente Pago
                              </button>
                            `
                            : `
                              <button type="button" onclick="toggleOrderPaid('${order.id}')"
                                      class="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-qh-navyDark font-display font-extrabold text-xs shadow transition"
                                      title="Marcar como cobrado e ingresar a Caja de la Empresa">
                                💰 Marcar Cobrado en Caja
                              </button>
                            `
                        }
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
                          ✅ Aprobar y Cobrado en Caja
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

  // 6. Renderizar Historial de Pagos a Proveedores (División 50%)
  const supplierTbody = document.getElementById('admin-supplier-payments-tbody');
  if (supplierTbody) {
    if (!finances.supplierPayments || finances.supplierPayments.length === 0) {
      supplierTbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-6 text-center text-slate-500">
            Sin pagos a proveedores registrados en la nube ($0).
          </td>
        </tr>
      `;
    } else {
      supplierTbody.innerHTML = finances.supplierPayments
        .map((sp) => {
          let payerBadge = '';
          let effectBadge = '';
          const halfAmt = Math.round(sp.amount * 0.5);
          if (sp.payer === 'Caja' || sp.payer === 'caja' || sp.payer === 'Caja de la Empresa') {
            payerBadge =
              '<span class="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-extrabold text-[11px] border border-emerald-500/30 whitespace-nowrap">🏦 Caja de la Empresa</span>';
            effectBadge = '<span class="text-slate-400 text-[11px]">Descontado de Caja (sin deuda)</span>';
          } else if (sp.payer === 'Morensex' || sp.payer === 'Mati' || sp.payer === 'Bolsillo de Mati (Morensex)') {
            payerBadge =
              '<span class="px-2.5 py-1 rounded-lg bg-amber-400/20 text-amber-300 font-extrabold text-[11px] border border-amber-400/30 whitespace-nowrap">🥊 Bolsillo de Mati</span>';
            effectBadge = `<span class="text-emerald-400 font-bold text-[11px]">Mati +50% (${formatCLP(
              halfAmt
            )})</span> • <span class="text-rose-400 font-bold text-[11px]">Juanjo -50% (${formatCLP(halfAmt)})</span>`;
          } else if (sp.payer === 'Juanjo' || sp.payer === 'Bolsillo de Juanjo') {
            payerBadge =
              '<span class="px-2.5 py-1 rounded-lg bg-sky-400/20 text-sky-300 font-extrabold text-[11px] border border-sky-400/30 whitespace-nowrap">🥚 Bolsillo de Juanjo</span>';
            effectBadge = `<span class="text-emerald-400 font-bold text-[11px]">Juanjo +50% (${formatCLP(
              halfAmt
            )})</span> • <span class="text-rose-400 font-bold text-[11px]">Mati -50% (${formatCLP(halfAmt)})</span>`;
          } else {
            payerBadge = `<span class="px-2 py-0.5 rounded bg-white/10 text-[10px] font-bold text-amber-300">${sp.payer}</span>`;
            effectBadge = '<span class="text-slate-400 text-[11px]">-</span>';
          }

          return `
            <tr class="hover:bg-white/5 transition">
              <td class="py-2.5 px-3 whitespace-nowrap text-slate-400">${sp.date}</td>
              <td class="py-2.5 px-3 text-white font-semibold">${sp.concept}</td>
              <td class="py-2.5 px-3 whitespace-nowrap">${payerBadge}</td>
              <td class="py-2.5 px-3 text-right font-display font-extrabold text-amber-400 whitespace-nowrap">
                ${formatCLP(sp.amount)}
              </td>
              <td class="py-2.5 px-3 whitespace-nowrap">${effectBadge}</td>
              <td class="py-2.5 px-3 text-right whitespace-nowrap">
                <button type="button" onclick="openEditExpenseModal('${sp.id}')"
                        class="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-amber-300 font-bold text-xs mr-1 transition"
                        title="Editar pago a proveedor">
                  ✏️
                </button>
                <button type="button" onclick="deleteSupplierPayment('${sp.id}')"
                        class="px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-300 font-bold text-xs transition"
                        title="Eliminar pago a proveedor">
                  🗑️
                </button>
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
            0 embajadores registrados y $0 en comisiones en la nube. Crea un código arriba para comenzar.
          </td>
        </tr>
      `;
    } else {
      ambassadorsTbody.innerHTML = ambassadorRows
        .map((amb) => {
          const safeName = (amb.name || '').replace(/'/g, "\\'");
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
                <span class="inline-block">📦 Bandejas (30 un.): <strong>${amb.count30}</strong> ($2.000 c/u)</span>
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
                  amb.totalCommission > 0
                    ? `
                      <button type="button" onclick="payAmbassadorCommission('${amb.code}', '${safeName}', ${amb.totalCommission})"
                              class="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-xs font-bold text-emerald-300 border border-emerald-500/30 mr-1 transition"
                              title="Pagar comisión descontándola de Caja de la Empresa">
                        💸 Pagar (${formatCLP(amb.totalCommission)})
                      </button>
                    `
                    : ''
                }
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
          Sin eventos registrados aún en la Base de Datos Cloud. Los clics e interacciones reales aparecerán aquí en vivo.
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
 * Reinicia toda la Base de Datos en la Nube a cero absoluto ($0 ventas, 0 pedidos, $0 saldos, $0 comisiones)
 * y sincroniza el reinicio en tiempo real con todos los dispositivos conectados.
 */
async function resetProductionDataConfirmation() {
  const nowMs = Date.now();
  CLOUD_STATE = getEmptyCloudState(nowMs);
  orderCart = {};
  currentAmbassadorCode = '';
  syncOrderUI();
  renderCatalog();
  renderAdminDashboard();
  saveLocalCloudMirror();

  try {
    let bytebinKey = null;
    try {
      const bbPost = await fetch(CLOUD_BYTEBIN_POST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(CLOUD_STATE)
      });
      if (bbPost.ok) {
        const bbData = await bbPost.json();
        bytebinKey = bbData && bbData.key ? bbData.key : null;
      }
    } catch (bbErr) {
      // ignore
    }

    if (supabaseClient) {
      await supabaseClient.from('qh_cloud_store').upsert(
        {
          id: 'production_v1',
          orders: [],
          finances: { partnerMovements: [], supplierPayments: [], debtSettlements: [] },
          ambassadors: [],
          analytics: getDefaultAnalytics(),
          deleted_ids: [],
          reset_at: nowMs,
          updated_at: nowMs,
          updated_by: currentAdminUser || 'Admin Reset'
        },
        { onConflict: 'id' }
      );
    }

    await fetch(CLOUD_REALTIME_PUB_URL, {
      method: 'POST',
      body: JSON.stringify({
        senderId: CLIENT_INSTANCE_ID,
        actionSummary: 'Reinicio a cero absoluto',
        updatedBy: currentAdminUser || 'Admin',
        updatedAt: nowMs,
        bytebinKey,
        state: buildCompactCloudState(CLOUD_STATE)
      })
    }).catch(() => {});
  } catch (e) {
    // ignore
  }

  showToast('🧹 Base de Datos Cloud reiniciada a cero absoluto ($0)');
}

/* ==========================================================================
   TOAST E INICIALIZACIÓN GENERAL CON CONEXIÓN A LA NUBE
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

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Cargar al instante el último estado guardado (0ms tras F5) y la sesión de admin
  loadLocalCloudMirror();
  CLOUD_STATE.analytics.pageViews = (CLOUD_STATE.analytics.pageViews || 0) + 1;
  saveLocalCloudMirror();

  // Renderizar tienda inmediatamente con carrito en 0
  renderCatalog();
  syncOrderUI();

  if (currentAdminUser && ALLOWED_ADMINS[currentAdminUser.toLowerCase()]) {
    const navLabel = document.getElementById('navbar-admin-label');
    if (navLabel) navLabel.textContent = `Panel (${currentAdminUser})`;
    let wasDashboardOpen = false;
    try {
      wasDashboardOpen = window.localStorage.getItem(ADMIN_VIEW_OPEN_KEY) === '1';
    } catch (e) {
      wasDashboardOpen = false;
    }
    if (wasDashboardOpen) {
      showAdminDashboard(currentAdminUser);
    }
  }

  // 2. Conectar a la Base de Datos en la Nube, fusionar y activar suscripción Realtime
  await pullCloudState(true);
  refreshDashboardIfVisible();
  startRealtimeCloudSubscriptions();

  // 3. Si la copia en la nube está vieja o vacía pero este dispositivo tiene datos, re-publicar respaldo
  if (
    cloudStateHasBusinessData(CLOUD_STATE) &&
    Date.now() - lastCloudMessageAt > CLOUD_REFRESH_MAX_AGE_MS
  ) {
    persistCloudState('Respaldo automático de datos');
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

  // Cerrar Modales al hacer clic fuera o con Escape
  const loginModal = document.getElementById('admin-login-modal');
  if (loginModal) {
    loginModal.addEventListener('click', (e) => {
      if (e.target === loginModal) closeAdminLoginModal();
    });
  }

  const supaModal = document.getElementById('supabase-config-modal');
  if (supaModal) {
    supaModal.addEventListener('click', (e) => {
      if (e.target === supaModal) closeSupabaseConfigModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCartDrawer();
      closeAdminLoginModal();
      closeSupabaseConfigModal();
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
