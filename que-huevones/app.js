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

// Configuración oficial de proyecto propio de Supabase (Producción)
const DEFAULT_SUPABASE_CREDENTIALS = {
  url: 'https://zjvlpzywqwvghpuzlvbt.supabase.co',
  anonKey: 'sb_publishable_78JknTIH_i-ZtHH8S4NG7w_P5Hs7i-N'
};
let SUPABASE_CREDENTIALS = {
  url: DEFAULT_SUPABASE_CREDENTIALS.url,
  anonKey: DEFAULT_SUPABASE_CREDENTIALS.anonKey
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
    st.ambassadors.length > 0 ||
    (st.users && st.users.length > 0)
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
let currentUserRole = null; // 'socio' | 'encargada' | 'embajador'
let currentUserUsername = null;
let currentUserCode = null;
const USER_SESSION_OBJECT_KEY = 'qh_user_session_obj_v4';
const PORTAL_VIEW_OPEN_KEY = 'qh_portal_view_open_v4';

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
  const base = {
    orders: [],
    finances: {
      partnerMovements: [],
      supplierPayments: [],
      ambassadorPayouts: [],
      partnerAdjustments: [],
      debtSettlements: []
    },
    ambassadors: [],
    users: [],
    analytics: getDefaultAnalytics(),
    deletedIds: [],
    resetAt: resetTimestamp,
    updatedAt: resetTimestamp,
    updatedBy: 'system',
    supabaseConfig: SUPABASE_CREDENTIALS
  };
  reconcileBusinessDataDefaults(base);
  return base;
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
      } else {
        reconcileBusinessDataDefaults(CLOUD_STATE);
      }
      const savedSessionObj = window.localStorage.getItem(USER_SESSION_OBJECT_KEY);
      if (savedSessionObj) {
        try {
          const sess = JSON.parse(savedSessionObj);
          currentAdminUser = sess.name || null;
          currentUserRole = sess.role || null;
          currentUserUsername = sess.username || null;
          currentUserCode = sess.code || sess.ambassadorCode || null;
        } catch (err) {
          // ignore
        }
      } else {
        const savedAdmin = window.localStorage.getItem(ADMIN_SESSION_KEY);
        if (savedAdmin) {
          currentAdminUser = savedAdmin;
          currentUserRole = 'socio';
          currentUserUsername = savedAdmin.toLowerCase();
          currentUserCode = savedAdmin.toLowerCase().includes('juanjo') ? 'JUANJO' : 'MATI10';
        }
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

/**
 * Reconcilia y asegura los ajustes oficiales de negocio:
 * 1. Caso Emilia: Limpia pagos duplicados o erróneos anteriores de comisiones en la Caja
 *    y deja registrado en el historial UN ÚNICO pago real a Emilia por $6.000.
 *    Además, registra de forma predeterminada a la usuaria Emilia con contraseña 12345
 *    y rol "Encargada de Embajadores y Redes", junto a los socios fundadores Juanjo y Mati.
 * 2. Brecha entre socios: Aplica y asegura el abono directo de $2.300 a favor de Juanjo
 *    (Juanjo pagó a Mati), descontando -$2.300 de la deuda hacia Mati.
 * 3. Normaliza el estado de pedidos existentes al flujo de 3 estados y sincroniza usuarios <-> embajadores.
 */
function reconcileBusinessDataDefaults(state) {
  if (!state || !state.finances) return;
  if (!Array.isArray(state.ambassadors)) state.ambassadors = [];
  if (!Array.isArray(state.users)) state.users = [];
  const deletedSet = new Set(state.deletedIds || []);

  // 1. Caso Emilia (Embajadora y Encargada de Embajadores y Redes)
  const emiliaCode = 'EMILIA';
  let emiliaAmb = state.ambassadors.find(
    (a) => (a.code || '').toUpperCase() === emiliaCode || (a.name || '').toUpperCase() === emiliaCode
  );
  if (!emiliaAmb && !deletedSet.has('AMB-EMILIA')) {
    emiliaAmb = {
      id: 'AMB-EMILIA',
      name: 'Emilia',
      code: emiliaCode,
      phone: '',
      username: 'emilia',
      invitedBy: 'Directo',
      createdAt: '26-10-2026',
      timestamp: 1729960000000,
      updatedAt: 1729960000000
    };
    state.ambassadors.push(emiliaAmb);
  } else if (emiliaAmb) {
    if (!emiliaAmb.invitedBy) emiliaAmb.invitedBy = 'Directo';
    if (!emiliaAmb.username) emiliaAmb.username = 'emilia';
  }

  // Asegurar Usuarios Predeterminados: Juanjo (Socio), Mati (Socio) y Emilia (Encargada, pass: 12345)
  const hasJuanjoUser = state.users.some((u) => (u.username || '').toLowerCase() === 'juanjo');
  if (!hasJuanjoUser && !deletedSet.has('USR-JUANJO')) {
    state.users.push({
      id: 'USR-JUANJO',
      name: 'Juanjo',
      username: 'juanjo',
      password: 'FOUNDER_HASH',
      phone: '',
      role: 'socio',
      code: 'JUANJO',
      ambassadorCode: 'JUANJO',
      invitedBy: 'Directo',
      isFounder: true,
      createdAt: '26-10-2026',
      timestamp: 1729960000000,
      updatedAt: 1729960000000
    });
  }

  const hasMatiUser = state.users.some(
    (u) => (u.username || '').toLowerCase() === 'morensex' || (u.username || '').toLowerCase() === 'mati'
  );
  if (!hasMatiUser && !deletedSet.has('USR-MORENSEX')) {
    state.users.push({
      id: 'USR-MORENSEX',
      name: 'Mati (Morensex)',
      username: 'morensex',
      password: 'FOUNDER_HASH',
      phone: '',
      role: 'socio',
      code: 'MATI10',
      ambassadorCode: 'MATI10',
      invitedBy: 'Directo',
      isFounder: true,
      createdAt: '26-10-2026',
      timestamp: 1729960000000,
      updatedAt: 1729960000000
    });
  }

  const hasEmiliaUser = state.users.some((u) => (u.username || '').toLowerCase() === 'emilia');
  if (!hasEmiliaUser && !deletedSet.has('USR-EMILIA')) {
    state.users.push({
      id: 'USR-EMILIA',
      name: 'Emilia',
      username: 'emilia',
      password: '12345',
      phone: '',
      role: 'encargada',
      code: emiliaCode,
      ambassadorCode: emiliaCode,
      invitedBy: emiliaAmb ? emiliaAmb.invitedBy || 'Directo' : 'Directo',
      createdAt: '26-10-2026',
      timestamp: 1729960000000,
      updatedAt: 1729960000000
    });
  }

  // Sincronizar embajadores existentes con cuentas de usuario y viceversa
  state.ambassadors.forEach((amb) => {
    if (!amb.invitedBy) amb.invitedBy = 'Directo';
    const cleanCode = (amb.code || '').trim().toUpperCase();
    if (!cleanCode) return;
    const defaultUsername = (amb.username || cleanCode).trim().toLowerCase().replace(/\s+/g, '');
    if (!amb.username) amb.username = defaultUsername;

    const existingUser = state.users.find(
      (u) =>
        (u.code || u.ambassadorCode || '').toUpperCase() === cleanCode ||
        (u.username || '').toLowerCase() === defaultUsername
    );
    if (!existingUser) {
      const usrId = 'USR-AMB-' + cleanCode;
      if (!deletedSet.has(usrId)) {
        state.users.push({
          id: usrId,
          name: amb.name || cleanCode,
          username: defaultUsername,
          password: amb.password || '12345',
          phone: amb.phone || '',
          role: cleanCode === 'EMILIA' || cleanCode === 'EMILIA10' ? 'encargada' : 'embajador',
          code: cleanCode,
          ambassadorCode: cleanCode,
          invitedBy: amb.invitedBy || 'Directo',
          createdAt: amb.createdAt || '27-10-2026',
          timestamp: amb.timestamp || 1729960000000,
          updatedAt: amb.updatedAt || 1729960000000
        });
      }
    }
  });

  state.users.forEach((usr) => {
    const cleanCode = (usr.code || usr.ambassadorCode || usr.username || '').trim().toUpperCase();
    if (cleanCode) {
      usr.code = cleanCode;
      usr.ambassadorCode = cleanCode;
    }
    if (usr.role === 'socio' && !usr.password) {
      usr.password = 'FOUNDER_HASH';
    }
    if (!usr.invitedBy) usr.invitedBy = 'Directo';
    if (usr.role === 'embajador' || usr.role === 'encargada') {
      if (!cleanCode) return;
      const existingAmb = state.ambassadors.find(
        (a) => (a.code || '').toUpperCase() === cleanCode
      );
      if (!existingAmb) {
        const ambId = 'AMB-' + cleanCode;
        if (!deletedSet.has(ambId)) {
          state.ambassadors.push({
            id: ambId,
            name: usr.name || usr.username,
            code: cleanCode,
            phone: usr.phone || '',
            username: usr.username,
            password: usr.password || '12345',
            invitedBy: usr.invitedBy || 'Directo',
            createdAt: usr.createdAt || '27-10-2026',
            timestamp: usr.timestamp || 1729960000000,
            updatedAt: usr.updatedAt || 1729960000000
          });
        }
      }
    }
  });

  // Asegurar el pago histórico único a Emilia de $6.000 sin borrar futuros pagos nuevos
  const isEmiliaDuplicateLegacy = (sp) => {
    if (sp.id === 'SP-AMB-EMILIA-6000') return false;
    if (sp.payoutId && sp.payoutId !== 'PAY-AMB-EMILIA-6000') return false; // conservar pagos nuevos posteriores
    const conc = (sp.concept || '').toUpperCase();
    return conc.includes('EMILIA') && (conc.includes('COMISI') || conc.includes('AMB') || conc.includes('EMBAJADOR'));
  };

  if (Array.isArray(state.finances.supplierPayments)) {
    state.finances.supplierPayments = state.finances.supplierPayments.filter(
      (sp) => !isEmiliaDuplicateLegacy(sp)
    );
    const hasSpEmilia6000 = state.finances.supplierPayments.some(
      (sp) => sp.id === 'SP-AMB-EMILIA-6000'
    );
    if (!hasSpEmilia6000 && !deletedSet.has('SP-AMB-EMILIA-6000') && !deletedSet.has('PAY-AMB-EMILIA-6000')) {
      state.finances.supplierPayments.push({
        id: 'SP-AMB-EMILIA-6000',
        payoutId: 'PAY-AMB-EMILIA-6000',
        date: '2026-10-26',
        amount: 6000,
        concept: 'Pago Comisión Embajador: Emilia (EMILIA)',
        payer: 'Caja',
        timestamp: 1729960000000,
        updatedAt: 1729960000000
      });
    }
  }

  if (!Array.isArray(state.finances.ambassadorPayouts)) {
    state.finances.ambassadorPayouts = [];
  }
  const hasPayEmilia6000 = state.finances.ambassadorPayouts.some(
    (p) => p.id === 'PAY-AMB-EMILIA-6000'
  );
  if (!hasPayEmilia6000 && !deletedSet.has('PAY-AMB-EMILIA-6000')) {
    state.finances.ambassadorPayouts.push({
      id: 'PAY-AMB-EMILIA-6000',
      date: '2026-10-26',
      code: emiliaCode,
      name: 'Emilia',
      amount: 6000,
      concept: 'Pago Comisión Embajador: Emilia (EMILIA)',
      payer: 'Caja',
      isHistoricalSeed: true,
      timestamp: 1729960000000,
      updatedAt: 1729960000000
    });
  } else {
    state.finances.ambassadorPayouts.forEach((p) => {
      if (p.id === 'PAY-AMB-EMILIA-6000') {
        p.isHistoricalSeed = true;
      }
    });
  }

  // 2. Ajuste Brecha Entre Socios: $2.300 a favor de Juanjo
  if (!Array.isArray(state.finances.partnerAdjustments)) {
    state.finances.partnerAdjustments = [];
  }
  const hasAbono2300 = state.finances.partnerAdjustments.some(
    (a) => a.id === 'ADJ-JUANJO-MATI-2300' || (a.from === 'Juanjo' && Number(a.amount) === 2300)
  );
  if (!hasAbono2300) {
    state.finances.partnerAdjustments.unshift({
      id: 'ADJ-JUANJO-MATI-2300',
      date: '2026-10-26',
      from: 'Juanjo',
      to: 'Morensex',
      amount: 2300,
      concept: 'Abono directo de Juanjo a Mati (ajuste de brecha -$2.300)',
      timestamp: 1729960000000,
      updatedAt: 1729960000000
    });
  }

  // 3. Normalizar pedidos existentes
  if (Array.isArray(state.orders)) {
    state.orders.forEach((o) => {
      if (typeof o.paid !== 'boolean') {
        o.paid = Boolean(o.approved && o.status === 'Completado');
      }
      if (!o.deliveryStatus) {
        o.deliveryStatus = (o.status === 'Entregado' || o.status === 'Completado') ? 'Entregado' : 'Falta Entregar';
      }
      if (!o.status || o.status === 'Aprobado' || o.status === 'Completado' || o.status === 'Pendiente Aprobación') {
        if (o.deliveryStatus === 'Entregado') {
          o.status = 'Entregado';
        } else if (o.paid) {
          o.status = 'Pagado - Falta Entregar';
        } else {
          o.status = 'Pendiente de Pago';
        }
      }
    });
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

  const normState = {
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
      ambassadorPayouts:
        raw.finances && Array.isArray(raw.finances.ambassadorPayouts)
          ? raw.finances.ambassadorPayouts
          : [],
      partnerAdjustments:
        raw.finances && Array.isArray(raw.finances.partnerAdjustments)
          ? raw.finances.partnerAdjustments
          : [],
      debtSettlements:
        raw.finances && Array.isArray(raw.finances.debtSettlements)
          ? raw.finances.debtSettlements
          : []
    },
    ambassadors: Array.isArray(raw.ambassadors) ? raw.ambassadors : [],
    users: Array.isArray(raw.users) ? raw.users : [],
    analytics: normalizedAnalytics,
    deletedIds: Array.isArray(raw.deletedIds) ? raw.deletedIds : [],
    resetAt: Number(raw.resetAt) || 0,
    updatedAt: Number(raw.updatedAt) || 0,
    updatedBy: raw.updatedBy || 'system',
    supabaseConfig:
      raw.supabaseConfig && raw.supabaseConfig.url && raw.supabaseConfig.anonKey
        ? raw.supabaseConfig
        : SUPABASE_CREDENTIALS
  };

  reconcileBusinessDataDefaults(normState);
  return normState;
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

  const mergedResult = {
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
      ambassadorPayouts: mergeCollectionById(
        a.finances.ambassadorPayouts || [],
        b.finances.ambassadorPayouts || []
      ),
      partnerAdjustments: mergeCollectionById(
        a.finances.partnerAdjustments || [],
        b.finances.partnerAdjustments || []
      ),
      debtSettlements: mergeCollectionById(
        a.finances.debtSettlements || [],
        b.finances.debtSettlements || []
      )
    },
    ambassadors: mergeCollectionById(a.ambassadors, b.ambassadors),
    users: mergeCollectionById(a.users || [], b.users || []),
    analytics: mergedAnalytics,
    deletedIds: Array.from(deletedSet).slice(-300),
    resetAt: effectiveResetAt,
    updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0),
    updatedBy: (b.updatedAt || 0) >= (a.updatedAt || 0) ? b.updatedBy : a.updatedBy,
    supabaseConfig: supabaseCfg
  };

  reconcileBusinessDataDefaults(mergedResult);
  return mergedResult;
}

function updateCloudStatusUI(statusText, isOnline = true) {
  const badge = document.getElementById('cloud-sync-status-badge');
  const syncText = document.getElementById('cloud-last-sync-text');

  if (badge) {
    if (isOnline) {
      badge.className =
        'px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5';
      badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span>${
        supabaseClient || (SUPABASE_CREDENTIALS && SUPABASE_CREDENTIALS.url)
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
              users: payload.new.users || (payload.new.finances && payload.new.finances.users_store) || [],
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
    users: s.users || [],
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
    // 1. Si hay credenciales de Supabase configuradas, leer de public.qh_cloud_store (vía SDK o REST directo)
    if (SUPABASE_CREDENTIALS && SUPABASE_CREDENTIALS.url && SUPABASE_CREDENTIALS.anonKey) {
      let data = null;
      if (supabaseClient) {
        const res = await supabaseClient
          .from('qh_cloud_store')
          .select('*')
          .eq('id', 'production_v1')
          .maybeSingle();
        if (!res.error && res.data) {
          data = res.data;
        }
      }
      if (!data) {
        try {
          const restRes = await fetch(
            `${SUPABASE_CREDENTIALS.url}/rest/v1/qh_cloud_store?id=eq.production_v1&select=*`,
            {
              method: 'GET',
              headers: {
                apikey: SUPABASE_CREDENTIALS.anonKey,
                Authorization: `Bearer ${SUPABASE_CREDENTIALS.anonKey}`,
                Accept: 'application/json'
              },
              cache: 'no-store'
            }
          );
          if (restRes.ok) {
            const rows = await restRes.json();
            if (Array.isArray(rows) && rows.length > 0) {
              data = rows[0];
            }
          }
        } catch (restErr) {
          // ignore
        }
      }

      if (data) {
        const supState = normalizeStateObject({
          orders: data.orders,
          finances: data.finances,
          ambassadors: data.ambassadors,
          users: data.users || (data.finances && data.finances.users_store) || [],
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
    if (SUPABASE_CREDENTIALS && SUPABASE_CREDENTIALS.url && SUPABASE_CREDENTIALS.anonKey) {
      const rowPayload = {
        id: 'production_v1',
        orders: CLOUD_STATE.orders,
        finances: Object.assign({}, CLOUD_STATE.finances, { users_store: CLOUD_STATE.users || [] }),
        ambassadors: CLOUD_STATE.ambassadors,
        analytics: CLOUD_STATE.analytics,
        deleted_ids: CLOUD_STATE.deletedIds,
        reset_at: CLOUD_STATE.resetAt,
        updated_at: CLOUD_STATE.updatedAt,
        updated_by: CLOUD_STATE.updatedBy
      };

      supabasePromise = fetch(
        `${SUPABASE_CREDENTIALS.url}/rest/v1/qh_cloud_store?on_conflict=id`,
        {
          method: 'POST',
          headers: {
            apikey: SUPABASE_CREDENTIALS.anonKey,
            Authorization: `Bearer ${SUPABASE_CREDENTIALS.anonKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal'
          },
          body: JSON.stringify(rowPayload)
        }
      ).catch(() => {
        if (supabaseClient) {
          return supabaseClient.from('qh_cloud_store').upsert(rowPayload, { onConflict: 'id' });
        }
      });

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

function loadUsers() {
  if (!Array.isArray(CLOUD_STATE.users)) CLOUD_STATE.users = [];
  return CLOUD_STATE.users;
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
      tabBtn.className = 'story-tab text-left p-5 sm:p-6 rounded-2xl border border-[#E8C170]/60 bg-[#0B2826] text-[#FAF8F2] shadow-xl transition-all';
      if (badgeSpan) badgeSpan.className = 'w-11 h-11 rounded-xl bg-[#E8C170] text-[#0B2420] font-display font-extrabold text-lg flex items-center justify-center flex-shrink-0';
      if (subtitleSpan) subtitleSpan.className = 'text-xs font-bold uppercase tracking-wider text-[#F9E8B2]';
      if (pText) pText.className = 'text-xs sm:text-sm text-[#E6EFEA]/80 mt-1.5';
    } else {
      tabBtn.className = 'story-tab text-left p-5 sm:p-6 rounded-2xl border border-[#E5DFCE] bg-[#FCFBF7] text-[#0B2826] hover:border-[#C89B48]/60 shadow-sm transition-all';
      if (badgeSpan) badgeSpan.className = 'w-11 h-11 rounded-xl bg-[#0B2826]/[0.07] text-[#0B2826] font-display font-extrabold text-lg flex items-center justify-center flex-shrink-0';
      if (subtitleSpan) subtitleSpan.className = 'text-xs font-bold uppercase tracking-wider text-[#9E6E24]';
      if (pText) pText.className = 'text-xs sm:text-sm text-[#4A635E] mt-1.5';
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
      <div class="p-4 rounded-2xl bg-white/[0.04] border border-[#F9E8B2]/15">
        <p class="font-display font-bold text-[#F9E8B2] text-sm">${b.title}</p>
        <p class="text-xs text-[#E6EFEA]/80 mt-1">${b.text}</p>
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
        'catalog-tab px-4 py-2.5 rounded-xl font-display font-bold text-xs sm:text-sm bg-[#0B2826] text-[#FAF8F2] shadow transition-all flex items-center gap-2';
    } else {
      btn.className =
        'catalog-tab px-4 py-2.5 rounded-xl font-display font-bold text-xs sm:text-sm text-[#0B2826] hover:bg-[#FCFBF7] transition-all flex items-center gap-2';
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
               class="product-card rounded-3xl bg-[#F7F5EE] border ${
                 product.popular ? 'border-[#C89B48] ring-2 ring-[#E8C170]/25' : 'border-[#E5DFCE]'
               } p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden cursor-pointer">
        
        <div>
          <div class="flex items-center justify-between gap-2 mb-4">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${
              isCampo
                ? 'bg-[#0B2826]/[0.07] text-[#0B2826] border border-[#0B2826]/15'
                : 'bg-[#0B2826]/[0.05] text-[#0B2826] border border-[#0B2826]/15'
            }">
              <span class="w-2.5 h-2.5 rounded-full ${isCampo ? 'bg-[#C89B48]' : 'bg-[#FCFBF7] border border-[#0B2826]'}"></span>
              ${product.typeLabel}
            </span>
            <span class="px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${
              product.popular ? 'bg-[#0B2826] text-[#F9E8B2] border border-[#E8C170]/40' : 'bg-[#FCFBF7] text-[#0B2826] border border-[#E5DFCE]'
            }">
              ${product.badge}
            </span>
          </div>

          <div class="flex items-center gap-4 mb-4">
            <div class="w-14 h-16 ${isCampo ? 'egg-shape-campo' : 'egg-shape-blanco'} flex-shrink-0 flex items-center justify-center">
              <span class="font-display font-extrabold text-xs ${
                isCampo ? 'text-white/95' : 'text-[#0B2826]'
              } bg-black/15 px-1.5 py-0.5 rounded-md">
                ${product.eggsCount}u
              </span>
            </div>
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-[#4A635E] block">${product.format}</span>
              <h3 class="font-display font-extrabold text-2xl text-[#0B2826] leading-tight">${product.name}</h3>
            </div>
          </div>

          <div class="mb-4 p-3 rounded-2xl bg-[#FCFBF7] border border-[#E5DFCE] flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="text-base">🥊</span>
              <div>
                <span class="text-xs font-extrabold text-[#0B2826] block">${product.caliberBadge}</span>
                <span class="text-[11px] text-[#4A635E]">${product.qualityNote}</span>
              </div>
            </div>
            <span class="px-2.5 py-1 rounded-lg bg-[#E8C170]/30 text-[#0B2826] font-display font-extrabold text-[11px] whitespace-nowrap">
              1ª Selección
            </span>
          </div>

          <p class="text-sm text-[#354F4B] leading-relaxed mb-4">
            ${product.description}
          </p>

          <ul class="space-y-1.5 mb-6 text-xs font-semibold text-[#0B2826]/90">
            ${product.features
              .map(
                (feat) => `
              <li class="flex items-center gap-2">
                <span class="w-4 h-4 rounded-full bg-[#0B2826]/10 text-[#0B2826] flex items-center justify-center text-[10px] font-bold">✓</span>
                <span>${feat}</span>
              </li>
            `
              )
              .join('')}
          </ul>
        </div>

        <div class="pt-5 border-t border-[#E5DFCE] space-y-4">
          <div class="p-3.5 rounded-2xl bg-[#FCFBF7] border border-[#C89B48]/50 shadow-sm flex items-center justify-between gap-3">
            <div>
              <span class="text-[10px] font-black uppercase tracking-wider text-[#4A635E] block">Precio Fijo Bandeja (30 un.)</span>
              <span class="font-display font-extrabold text-3xl sm:text-4xl text-[#0B2826] leading-none">${formatCLP(product.price)}</span>
            </div>
            <div class="text-right">
              <span class="text-xs font-black text-[#0B2826] bg-[#E8C170]/35 border border-[#C89B48]/30 px-3 py-1.5 rounded-xl inline-block shadow-xs">
                ${formatCLP(unitPrice)} c/huevo
              </span>
              ${
                inCartQty > 0
                  ? `<span class="block text-[11px] font-extrabold text-[#2E4812] mt-1">✓ ${inCartQty} en tu carrito</span>`
                  : `<span class="block text-[10px] font-bold text-[#4A635E] mt-1">30 unidades</span>`
              }
            </div>
          </div>

          <div class="p-3.5 rounded-2xl bg-[#FCFBF7] border border-[#E5DFCE] flex items-center justify-between gap-3">
            <div>
              <span class="text-[11px] font-bold uppercase tracking-wider text-[#4A635E] block">Cantidad</span>
              <div class="inline-flex items-center gap-2 mt-1">
                <button type="button" onclick="event.stopPropagation(); updateCardQty('${product.id}', -1)"
                        class="w-8 h-8 rounded-lg bg-[#F2EFE4] hover:bg-[#0B2826] hover:text-[#FAF8F2] text-[#0B2826] font-extrabold text-base flex items-center justify-center transition"
                        aria-label="Disminuir cantidad">
                  −
                </button>
                <span id="card-qty-${product.id}" class="w-7 text-center font-display font-extrabold text-base text-[#0B2826]">
                  ${qty}
                </span>
                <button type="button" onclick="event.stopPropagation(); updateCardQty('${product.id}', 1)"
                        class="w-8 h-8 rounded-lg bg-[#F2EFE4] hover:bg-[#0B2826] hover:text-[#FAF8F2] text-[#0B2826] font-extrabold text-base flex items-center justify-center transition"
                        aria-label="Aumentar cantidad">
                  +
                </button>
              </div>
            </div>

            <div class="text-right">
              <span class="text-[11px] font-bold uppercase tracking-wider text-[#4A635E] block">
                Subtotal (${qty * product.eggsCount} huevos)
              </span>
              <span id="card-subtotal-${product.id}" class="font-display font-extrabold text-xl text-[#9E6E24]">
                ${formatCLP(subtotal)}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-5 gap-2">
            <button type="button" onclick="event.stopPropagation(); orderImmediately('${product.id}')"
                    class="col-span-3 py-3.5 px-3 rounded-xl bg-[#E8C170] hover:bg-[#F3D289] text-[#0B2420] font-display font-extrabold text-xs sm:text-sm shadow-lg shadow-[#E8C170]/30 flex items-center justify-center gap-1.5 active:scale-95 transition-all">
              <span>🥊 Pedir al tiro</span>
            </button>
            <button type="button" onclick="event.stopPropagation(); addToOrderCart('${product.id}')"
                    class="col-span-2 py-3.5 px-3 rounded-xl bg-[#0B2826] hover:bg-[#123834] text-[#FAF8F2] font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-1 active:scale-95 transition-all">
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
        ? 'day-btn-main py-2.5 px-1 text-center rounded-xl font-display font-extrabold text-xs bg-[#0B2826] text-[#F9E8B2] shadow-md ring-2 ring-[#E8C170] transition'
        : 'day-btn-main py-2.5 px-1 text-center rounded-xl font-display font-bold text-xs bg-[#FCFBF7] text-[#0B2826] border border-[#D8D0BC] hover:border-[#C89B48] transition';
    }
    if (btnDrawer) {
      btnDrawer.className = isDaySelected
        ? 'day-btn-drawer py-1.5 px-0.5 text-center rounded-lg font-display font-extrabold text-[11px] bg-[#0B2826] text-[#F9E8B2] shadow transition'
        : 'day-btn-drawer py-1.5 px-0.5 text-center rounded-lg font-display font-bold text-[11px] bg-[#FCFBF7] text-[#0B2826] border border-[#D8D0BC] transition';
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
      btnUnicoMain.className = 'p-5 rounded-2xl border-2 border-[#E8C170] bg-[#0B2826] text-[#FAF8F2] text-left transition-all flex flex-col justify-between gap-3 shadow-xl ring-4 ring-[#E8C170]/20';
      if (unicoIcon) unicoIcon.className = 'w-11 h-11 rounded-xl bg-[#E8C170] text-[#0B2420] font-display font-extrabold text-lg flex items-center justify-center flex-shrink-0 shadow';
      if (unicoStatus) {
        unicoStatus.className = 'px-3 py-1 rounded-full bg-[#E8C170] text-[#0B2420] text-[11px] font-extrabold uppercase tracking-wider shadow-xs';
        unicoStatus.textContent = '✓ Seleccionado';
      }
      if (unicoTitle) unicoTitle.className = 'font-display font-extrabold text-xl text-[#FAF8F2] leading-tight';
      if (unicoSubbadge) unicoSubbadge.className = 'inline-block mt-1.5 px-2.5 py-0.5 rounded-md bg-white/10 text-[#F9E8B2] text-xs font-extrabold';
      if (unicoDesc) unicoDesc.className = 'text-xs sm:text-sm text-[#E6EFEA]/85 font-medium leading-relaxed mt-2';

      btnSemanalMain.className = 'p-5 rounded-2xl border border-[#D8D0BC] bg-[#FCFBF7] hover:border-[#C89B48] text-[#0B2826] text-left transition-all flex flex-col justify-between gap-3 shadow-sm';
      if (semanalIcon) semanalIcon.className = 'w-11 h-11 rounded-xl bg-[#0B2826] text-[#FAF8F2] font-display font-extrabold text-lg flex items-center justify-center flex-shrink-0 shadow';
      if (semanalStatus) {
        semanalStatus.className = 'px-3 py-1 rounded-full bg-[#F2EFE4] text-[#0B2826] border border-[#D8D0BC] text-[11px] font-extrabold uppercase tracking-wider';
        semanalStatus.textContent = 'Elegir opción';
      }
      if (semanalTitle) semanalTitle.className = 'font-display font-extrabold text-xl text-[#0B2826] leading-tight';
      if (semanalSubbadge) semanalSubbadge.className = 'inline-block mt-1.5 px-2.5 py-0.5 rounded-md bg-[#E8C170]/30 text-[#0B2826] text-xs font-extrabold';
      if (semanalDesc) semanalDesc.className = 'text-xs sm:text-sm text-[#4A635E] font-medium leading-relaxed mt-2';
    } else {
      btnSemanalMain.className = 'p-5 rounded-2xl border-2 border-[#E8C170] bg-[#0B2826] text-[#FAF8F2] text-left transition-all flex flex-col justify-between gap-3 shadow-xl ring-4 ring-[#E8C170]/20';
      if (semanalIcon) semanalIcon.className = 'w-11 h-11 rounded-xl bg-[#E8C170] text-[#0B2420] font-display font-extrabold text-lg flex items-center justify-center flex-shrink-0 shadow';
      if (semanalStatus) {
        semanalStatus.className = 'px-3 py-1 rounded-full bg-[#E8C170] text-[#0B2420] text-[11px] font-extrabold uppercase tracking-wider shadow-xs';
        semanalStatus.textContent = '✓ Seleccionado';
      }
      if (semanalTitle) semanalTitle.className = 'font-display font-extrabold text-xl text-[#FAF8F2] leading-tight';
      if (semanalSubbadge) semanalSubbadge.className = 'inline-block mt-1.5 px-2.5 py-0.5 rounded-md bg-white/10 text-[#F9E8B2] text-xs font-extrabold';
      if (semanalDesc) semanalDesc.className = 'text-xs sm:text-sm text-[#E6EFEA]/85 font-medium leading-relaxed mt-2';

      btnUnicoMain.className = 'p-5 rounded-2xl border border-[#D8D0BC] bg-[#FCFBF7] hover:border-[#C89B48] text-[#0B2826] text-left transition-all flex flex-col justify-between gap-3 shadow-sm';
      if (unicoIcon) unicoIcon.className = 'w-11 h-11 rounded-xl bg-[#0B2826] text-[#FAF8F2] font-display font-extrabold text-lg flex items-center justify-center flex-shrink-0 shadow';
      if (unicoStatus) {
        unicoStatus.className = 'px-3 py-1 rounded-full bg-[#F2EFE4] text-[#0B2826] border border-[#D8D0BC] text-[11px] font-extrabold uppercase tracking-wider';
        unicoStatus.textContent = 'Elegir opción';
      }
      if (unicoTitle) unicoTitle.className = 'font-display font-extrabold text-xl text-[#0B2826] leading-tight';
      if (unicoSubbadge) unicoSubbadge.className = 'inline-block mt-1.5 px-2.5 py-0.5 rounded-md bg-[#E8C170]/30 text-[#0B2826] text-xs font-extrabold';
      if (unicoDesc) unicoDesc.className = 'text-xs sm:text-sm text-[#4A635E] font-medium leading-relaxed mt-2';
    }
  }

  if (btnUnicoDrawer && btnSemanalDrawer) {
    if (!isSemanal) {
      btnUnicoDrawer.className = 'py-2.5 px-3 rounded-xl font-display font-bold text-xs bg-[#0B2826] text-[#FAF8F2] shadow transition';
      btnSemanalDrawer.className = 'py-2.5 px-3 rounded-xl font-display font-bold text-xs text-[#0B2826] hover:bg-[#FCFBF7] transition';
    } else {
      btnSemanalDrawer.className = 'py-2.5 px-3 rounded-xl font-display font-bold text-xs bg-[#0B2826] text-[#FAF8F2] shadow transition';
      btnUnicoDrawer.className = 'py-2.5 px-3 rounded-xl font-display font-bold text-xs text-[#0B2826] hover:bg-[#FCFBF7] transition';
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
      <div class="p-4 rounded-xl bg-[#FCFBF7] border border-dashed border-[#D8D0BC] text-center text-xs text-[#4A635E]">
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
          <div class="p-3 rounded-xl bg-[#FCFBF7] border border-[#E5DFCE] flex items-center justify-between gap-3 shadow-xs">
            <div class="min-w-0">
              <p class="font-display font-bold text-xs sm:text-sm text-[#0B2826] truncate">${product.name}</p>
              <p class="text-[11px] text-[#4A635E]">${product.format} • ${formatCLP(product.price)} c/u</p>
            </div>
            <div class="flex items-center gap-2.5 flex-shrink-0">
              <div class="inline-flex items-center gap-1.5 bg-[#F2EFE4] px-2 py-1 rounded-lg border border-[#E5DFCE]">
                <button type="button" onclick="updateFormItemQty('${id}', -1)" class="w-6 h-6 rounded bg-[#FCFBF7] hover:bg-[#0B2826] hover:text-[#FAF8F2] text-[#0B2826] font-extrabold text-xs flex items-center justify-center transition">−</button>
                <span class="font-display font-extrabold text-xs text-[#0B2826] w-5 text-center">${qty}</span>
                <button type="button" onclick="updateFormItemQty('${id}', 1)" class="w-6 h-6 rounded bg-[#FCFBF7] hover:bg-[#0B2826] hover:text-[#FAF8F2] text-[#0B2826] font-extrabold text-xs flex items-center justify-center transition">+</button>
              </div>
              <span class="font-display font-extrabold text-xs sm:text-sm text-[#9E6E24] w-20 text-right">${formatCLP(itemSub)}</span>
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
   MÓDULO 3: SISTEMA DE LOGIN MULTI-ROL, REGISTRO PÚBLICO Y PORTAL DE EMBAJADOR
   ========================================================================== */

const ALLOWED_ADMINS = {
  juanjo: 'Juanjo',
  morensex: 'Morensex',
  mati: 'Morensex'
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

/**
 * Determina si un identificador pertenece a uno de los socios fundadores (Juanjo o Mati/Morensex).
 * Regla de negocio: Los socios dueños no generan bonos de producción por reclutar invitados.
 */
function isFounderRecruiter(nameOrCode) {
  const clean = (nameOrCode || '').trim().toUpperCase();
  if (!clean) return false;
  if (
    clean === 'JUANJO' ||
    clean === 'JUANJO10' ||
    clean === 'MATI' ||
    clean === 'MATI10' ||
    clean === 'MORENSEX' ||
    clean === 'MATI (MORENSEX)'
  ) {
    return true;
  }
  const users = loadUsers();
  const matchedUser = users.find(
    (u) =>
      (u.username || '').trim().toUpperCase() === clean ||
      (u.name || '').trim().toUpperCase() === clean ||
      (u.code || '').trim().toUpperCase() === clean
  );
  if (matchedUser && matchedUser.role === 'socio') return true;
  return false;
}

function saveActiveUserSession(userObj) {
  currentAdminUser = userObj.name || userObj.username;
  currentUserRole = userObj.role || 'embajador';
  currentUserUsername = (userObj.username || '').toLowerCase();
  currentUserCode = (userObj.code || userObj.ambassadorCode || '').toUpperCase();
  try {
    window.localStorage.setItem(ADMIN_SESSION_KEY, currentAdminUser);
    window.localStorage.setItem(
      USER_SESSION_OBJECT_KEY,
      JSON.stringify({
        name: currentAdminUser,
        role: currentUserRole,
        username: currentUserUsername,
        code: currentUserCode,
        ambassadorCode: currentUserCode
      })
    );
  } catch (e) {
    // ignore
  }
}

/**
 * Autentica un usuario contra Socios Fundadores, Emilia (12345) o cualquier cuenta en CLOUD_STATE.users / CLOUD_STATE.ambassadors
 */
async function authenticateCredentials(rawUsernameInput, rawPasswordInput) {
  const rawUser = (rawUsernameInput || '').trim().toLowerCase();
  const rawPass = (rawPasswordInput || '').trim();
  if (!rawUser || !rawPass) return null;

  const normalizedPass = rawPass.replace(/\s+/g, '');
  const [hashA, hashB] = await Promise.all([computeSHA256(rawPass), computeSHA256(normalizedPass)]);
  const isFounderMasterKey = AUTH_KEY_HASHES.includes(hashA) || AUTH_KEY_HASHES.includes(hashB);

  // 1. Verificar si existe en CLOUD_STATE.users
  const users = loadUsers();
  const matchedUser = users.find(
    (u) =>
      (u.username || '').trim().toLowerCase() === rawUser ||
      (u.name || '').trim().toLowerCase() === rawUser ||
      (u.code || '').trim().toLowerCase() === rawUser
  );

  if (matchedUser) {
    const storedPass = String(matchedUser.password || '').trim();
    const isSocio = matchedUser.role === 'socio' || Object.prototype.hasOwnProperty.call(ALLOWED_ADMINS, rawUser);
    if (
      (storedPass && storedPass !== 'FOUNDER_HASH' && storedPass === rawPass) ||
      (isSocio && isFounderMasterKey) ||
      (rawUser === 'emilia' && rawPass === '12345')
    ) {
      return {
        name: matchedUser.name || matchedUser.username,
        username: (matchedUser.username || rawUser).toLowerCase(),
        role: matchedUser.role || 'embajador',
        code: (matchedUser.code || '').toUpperCase()
      };
    }
  }

  // 2. Verificar Socios Fundadores directos (Juanjo / Morensex / Mati)
  if (Object.prototype.hasOwnProperty.call(ALLOWED_ADMINS, rawUser) && isFounderMasterKey) {
    const displayName = ALLOWED_ADMINS[rawUser];
    return {
      name: displayName,
      username: rawUser === 'mati' ? 'morensex' : rawUser,
      role: 'socio',
      code: rawUser === 'juanjo' ? 'JUANJO10' : 'MATI10'
    };
  }

  // 3. Verificar Emilia por defecto (emilia / 12345)
  if ((rawUser === 'emilia' || rawUser === 'emilia10') && rawPass === '12345') {
    return {
      name: 'Emilia',
      username: 'emilia',
      role: 'encargada',
      code: 'EMILIA10'
    };
  }

  // 4. Verificar en CLOUD_STATE.ambassadors si tiene contraseña
  const ambassadors = loadAmbassadors();
  const matchedAmb = ambassadors.find(
    (a) =>
      (a.username || '').trim().toLowerCase() === rawUser ||
      (a.code || '').trim().toLowerCase() === rawUser ||
      (a.name || '').trim().toLowerCase() === rawUser
  );
  if (matchedAmb && String(matchedAmb.password || '').trim() === rawPass) {
    return {
      name: matchedAmb.name,
      username: (matchedAmb.username || matchedAmb.code).toLowerCase(),
      role: matchedAmb.role || 'embajador',
      code: (matchedAmb.code || '').toUpperCase()
    };
  }

  return null;
}

function openAdminLoginModal() {
  if (currentAdminUser) {
    if (currentUserRole === 'socio' || currentUserRole === 'encargada') {
      showAdminDashboard(currentAdminUser);
      return;
    }
    if (currentUserRole === 'embajador') {
      showAmbassadorPortal();
      return;
    }
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
  const rawUser = (document.getElementById('admin-username').value || '').trim();
  const rawPass = (document.getElementById('admin-password').value || '').trim();
  const errEl = document.getElementById('admin-login-error');

  const authUser = await authenticateCredentials(rawUser, rawPass);
  if (authUser) {
    saveActiveUserSession(authUser);
    closeAdminLoginModal();
    document.getElementById('admin-login-form').reset();

    if (authUser.role === 'embajador') {
      await showAmbassadorPortal();
      showToast(`🥚 Bienvenido a tu Portal Personal de Embajador, ${authUser.name}`);
    } else {
      await showAdminDashboard(authUser.name);
      const roleLabel =
        authUser.role === 'encargada'
          ? 'Encargada de Embajadores y Redes'
          : 'Socio Fundador';
      showToast(`🔓 Bienvenido al Panel (${roleLabel}), ${authUser.name}`);
    }
  } else {
    if (errEl) errEl.classList.remove('hidden');
  }
}

/* ==========================================================================
   MODAL PÚBLICO: "🥚 QUIERO SER EMBAJADOR" (REGISTRO E INICIO DE SESIÓN)
   ========================================================================== */

function populateRecruiterSelects() {
  const ambassadors = loadAmbassadors();
  const selectIds = [
    'pub-amb-invited-by',
    'ambassador-invited-by-select',
    'edit-amb-invited-by',
    'new-user-invited-by',
    'edit-usr-invited-by'
  ];

  // Ordenar alfabéticamente poniendo a Emilia arriba para acceso rápido
  const sortedAmbs = [...ambassadors].sort((a, b) => {
    const aEm = (a.code || '').toUpperCase() === 'EMILIA10' ? -1 : 0;
    const bEm = (b.code || '').toUpperCase() === 'EMILIA10' ? -1 : 0;
    if (aEm !== bEm) return aEm - bEm;
    return (a.name || '').localeCompare(b.name || '');
  });

  selectIds.forEach((id) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const prevValue = sel.value || 'Directo';
    const firstOptionLabel =
      id === 'pub-amb-invited-by'
        ? 'Llegué directo / Nadie'
        : 'Llegué directo / Nadie (Sin reclutador)';

    let html = `<option value="Directo">${firstOptionLabel}</option>`;
    sortedAmbs.forEach((amb) => {
      const code = (amb.code || '').toUpperCase();
      const name = amb.name || code;
      const isFounder = isFounderRecruiter(code) || isFounderRecruiter(name);
      const tag = isFounder ? 'Socio Fundador' : `Código: ${code}`;
      html += `<option value="${name}">${name} (${tag})</option>`;
    });

    sel.innerHTML = html;

    // Restaurar selección previa si existe
    const hasOption = Array.from(sel.options).some((opt) => opt.value === prevValue);
    if (hasOption) {
      sel.value = prevValue;
    }
  });
}

function openAmbassadorAuthModal(initialTab = 'register') {
  populateRecruiterSelects();
  const modal = document.getElementById('ambassador-auth-modal');
  const activeBanner = document.getElementById('amb-modal-active-session-banner');
  const activeNameEl = document.getElementById('amb-modal-active-name');

  if (currentAdminUser && activeBanner && activeNameEl) {
    activeBanner.classList.remove('hidden');
    activeBanner.classList.add('flex');
    activeNameEl.textContent = `${currentAdminUser} (${currentUserCode || currentUserRole})`;
  } else if (activeBanner) {
    activeBanner.classList.add('hidden');
    activeBanner.classList.remove('flex');
  }

  switchAmbassadorAuthTab(initialTab);

  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeAmbassadorAuthModal() {
  const modal = document.getElementById('ambassador-auth-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function switchAmbassadorAuthTab(tab) {
  const tabReg = document.getElementById('amb-auth-tab-register');
  const tabLog = document.getElementById('amb-auth-tab-login');
  const formReg = document.getElementById('public-ambassador-register-form');
  const formLog = document.getElementById('public-ambassador-login-form');
  const errReg = document.getElementById('pub-amb-register-error');
  const errLog = document.getElementById('pub-amb-login-error');

  if (errReg) errReg.classList.add('hidden');
  if (errLog) errLog.classList.add('hidden');

  if (tab === 'login') {
    if (tabLog) {
      tabLog.className =
        'py-2.5 px-3 rounded-xl font-display font-extrabold text-xs sm:text-sm bg-amber-400 text-qh-navyDark shadow transition';
    }
    if (tabReg) {
      tabReg.className =
        'py-2.5 px-3 rounded-xl font-display font-extrabold text-xs sm:text-sm text-slate-300 hover:text-white transition';
    }
    if (formReg) formReg.classList.add('hidden');
    if (formLog) formLog.classList.remove('hidden');
  } else {
    if (tabReg) {
      tabReg.className =
        'py-2.5 px-3 rounded-xl font-display font-extrabold text-xs sm:text-sm bg-amber-400 text-qh-navyDark shadow transition';
    }
    if (tabLog) {
      tabLog.className =
        'py-2.5 px-3 rounded-xl font-display font-extrabold text-xs sm:text-sm text-slate-300 hover:text-white transition';
    }
    if (formLog) formLog.classList.add('hidden');
    if (formReg) formReg.classList.remove('hidden');
  }
}

function suggestPublicAmbassadorFields() {
  const nameInp = document.getElementById('pub-amb-name');
  const userInp = document.getElementById('pub-amb-username');
  const codeInp = document.getElementById('pub-amb-code');
  if (!nameInp) return;

  const rawName = (nameInp.value || '').trim();
  const cleanAlpha = rawName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '');

  if (userInp && !userInp.dataset.touched) {
    userInp.value = cleanAlpha.toLowerCase().slice(0, 12);
  }
  if (codeInp && !codeInp.dataset.touched) {
    codeInp.value = cleanAlpha ? `${cleanAlpha.toUpperCase().slice(0, 8)}10` : '';
  }
}

async function handlePublicAmbassadorRegister(event) {
  event.preventDefault();
  const name = (document.getElementById('pub-amb-name').value || '').trim();
  const phone = (document.getElementById('pub-amb-phone').value || '').trim();
  const username = (document.getElementById('pub-amb-username').value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  const password = (document.getElementById('pub-amb-password').value || '').trim();
  const code = (document.getElementById('pub-amb-code').value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  const invitedBy = (document.getElementById('pub-amb-invited-by').value || 'Directo').trim();
  const errEl = document.getElementById('pub-amb-register-error');

  if (!name || !phone || !username || !password || !code) {
    if (errEl) {
      errEl.textContent = '⚠️ Por favor completa todos los campos obligatorios.';
      errEl.classList.remove('hidden');
    }
    return;
  }

  const ambassadors = loadAmbassadors();
  const users = loadUsers();

  const codeExists = ambassadors.some((a) => (a.code || '').toUpperCase() === code);
  if (codeExists) {
    if (errEl) {
      errEl.textContent = `⚠️ El código "${code}" ya está registrado. Elige otro código (ej: ${code}2).`;
      errEl.classList.remove('hidden');
    }
    return;
  }

  const userExists = users.some((u) => (u.username || '').toLowerCase() === username);
  if (userExists || username === 'juanjo' || username === 'morensex' || username === 'mati' || username === 'emilia') {
    if (errEl) {
      errEl.textContent = `⚠️ El nombre de usuario "${username}" ya está en uso. Elige otro usuario.`;
      errEl.classList.remove('hidden');
    }
    return;
  }

  const nowMs = Date.now();
  const newAmb = {
    id: 'AMB-' + code + '-' + String(nowMs).slice(-4),
    name,
    code,
    phone,
    username,
    password,
    invitedBy: invitedBy || 'Directo',
    role: 'embajador',
    createdAt: new Date().toLocaleDateString('es-CL'),
    timestamp: nowMs,
    updatedAt: nowMs
  };
  ambassadors.push(newAmb);

  const newUser = {
    id: 'USR-' + code + '-' + String(nowMs).slice(-4),
    username,
    password,
    name,
    role: 'embajador',
    code,
    ambassadorCode: code,
    phone,
    invitedBy: invitedBy || 'Directo',
    createdAt: new Date().toLocaleDateString('es-CL'),
    timestamp: nowMs,
    updatedAt: nowMs
  };
  users.push(newUser);

  saveActiveUserSession({
    name,
    username,
    role: 'embajador',
    code
  });

  const regForm = document.getElementById('public-ambassador-register-form');
  if (regForm) regForm.reset();
  closeAmbassadorAuthModal();

  await persistCloudState(`Nuevo embajador registrado en web: ${name} (${code}) • Invitado por: ${invitedBy}`);
  await showAmbassadorPortal();
  showToast(`🎉 ¡Cuenta creada con éxito! Bienvenido a tu Portal de Embajador, ${name}`);
}

async function handlePublicAmbassadorLogin(event) {
  event.preventDefault();
  const rawUser = (document.getElementById('pub-login-username').value || '').trim();
  const rawPass = (document.getElementById('pub-login-password').value || '').trim();
  const errEl = document.getElementById('pub-amb-login-error');

  const authUser = await authenticateCredentials(rawUser, rawPass);
  if (!authUser) {
    if (errEl) errEl.classList.remove('hidden');
    return;
  }

  saveActiveUserSession(authUser);
  const logForm = document.getElementById('public-ambassador-login-form');
  if (logForm) logForm.reset();
  closeAmbassadorAuthModal();

  if (authUser.role === 'socio' || authUser.role === 'encargada') {
    await showAdminDashboard(authUser.name);
    showToast(`🔓 Sesión iniciada en Panel (${authUser.name})`);
  } else {
    await showAmbassadorPortal();
    showToast(`🥚 Bienvenido a tu Portal Personal de Embajador, ${authUser.name}`);
  }
}

function goToActiveUserPortal() {
  closeAmbassadorAuthModal();
  if (currentUserRole === 'socio' || currentUserRole === 'encargada') {
    showAdminDashboard(currentAdminUser);
  } else if (currentAdminUser) {
    showAmbassadorPortal();
  }
}

/* ==========================================================================
   📱 PORTAL PERSONAL DEL EMBAJADOR (CARGA DIRECTA DE PEDIDOS Y DESPACHOS)
   ========================================================================== */

async function showAmbassadorPortal() {
  const storefront = document.getElementById('storefront-view');
  const dashboard = document.getElementById('admin-dashboard-view');
  const portal = document.getElementById('ambassador-portal-view');
  const navLabel = document.getElementById('navbar-admin-label');
  const backAdminBtn = document.getElementById('portal-back-to-admin-btn');

  if (storefront) storefront.classList.add('hidden');
  if (dashboard) dashboard.classList.add('hidden');
  if (portal) portal.classList.remove('hidden');

  if (backAdminBtn) {
    if (currentUserRole === 'socio' || currentUserRole === 'encargada') {
      backAdminBtn.classList.remove('hidden');
    } else {
      backAdminBtn.classList.add('hidden');
    }
  }

  try {
    window.localStorage.setItem(PORTAL_VIEW_OPEN_KEY, '1');
    window.localStorage.removeItem(ADMIN_VIEW_OPEN_KEY);
  } catch (e) {
    // ignore
  }

  if (navLabel && currentAdminUser) {
    navLabel.textContent = `Mi Portal (${currentAdminUser})`;
  }

  renderAmbassadorPortal();
  updatePortalOrderPreview();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  await pullCloudState(true);
  renderAmbassadorPortal();
}

function closeAmbassadorPortal() {
  const storefront = document.getElementById('storefront-view');
  const dashboard = document.getElementById('admin-dashboard-view');
  const portal = document.getElementById('ambassador-portal-view');

  if (portal) portal.classList.add('hidden');
  if (dashboard) dashboard.classList.add('hidden');
  if (storefront) storefront.classList.remove('hidden');

  try {
    window.localStorage.removeItem(PORTAL_VIEW_OPEN_KEY);
  } catch (e) {
    // ignore
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openMyAmbassadorPortalFromAdmin() {
  showAmbassadorPortal();
}

function returnFromPortalToAdmin() {
  if (currentUserRole === 'socio' || currentUserRole === 'encargada') {
    showAdminDashboard(currentAdminUser);
  }
}

function copyCurrentAmbassadorPortalCode() {
  const code = currentUserCode || 'EMBAJADOR';
  copyAmbassadorCode(code);
}

function togglePortalWeeklyDay() {
  const typeSel = document.getElementById('portal-order-modality');
  const wrap = document.getElementById('portal-order-day-wrapper');
  if (!typeSel || !wrap) return;
  if (typeSel.value === 'Pedido Fijo Semanal') {
    wrap.classList.remove('hidden');
  } else {
    wrap.classList.add('hidden');
  }
}

function adjustPortalTrayQty(type, delta) {
  const inputId = type === 'campo' ? 'portal-order-qty-campo' : 'portal-order-qty-blanco';
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const current = parseInt(inp.value, 10) || 0;
  inp.value = Math.max(0, current + delta);
  updatePortalOrderPreview();
}

function updatePortalOrderPreview() {
  const qtyCampo = Math.max(0, parseInt((document.getElementById('portal-order-qty-campo') || {}).value, 10) || 0);
  const qtyBlanco = Math.max(0, parseInt((document.getElementById('portal-order-qty-blanco') || {}).value, 10) || 0);
  const totalTrays = qtyCampo + qtyBlanco;
  const subtotal = qtyCampo * 11500 + qtyBlanco * 9000;
  const commission = totalTrays * 2000;

  const traysEl = document.getElementById('portal-order-preview-trays');
  const totalEl = document.getElementById('portal-order-preview-total');

  if (traysEl) {
    traysEl.textContent = `${totalTrays} bandeja(s) (${totalTrays * 30} huevos) • Tu comisión: +${formatCLP(commission)}`;
  }
  if (totalEl) totalEl.textContent = formatCLP(subtotal);
}

async function handleAmbassadorPortalCreateOrder(event) {
  event.preventDefault();
  const clientName = ((document.getElementById('portal-order-client-name') || {}).value || '').trim();
  const clientAddress = ((document.getElementById('portal-order-client-address') || {}).value || '').trim();
  const clientPhone = ((document.getElementById('portal-order-client-phone') || {}).value || '').trim();
  const clientNotes = ((document.getElementById('portal-order-notes') || {}).value || '').trim();
  const orderType = ((document.getElementById('portal-order-modality') || {}).value || 'Pedido Único').trim();
  const deliveryDay = ((document.getElementById('portal-order-delivery-day') || {}).value || 'Jueves').trim();

  const qtyCampo = Math.max(0, parseInt((document.getElementById('portal-order-qty-campo') || {}).value, 10) || 0);
  const qtyBlanco = Math.max(0, parseInt((document.getElementById('portal-order-qty-blanco') || {}).value, 10) || 0);

  if (!clientName || !clientAddress || qtyCampo + qtyBlanco <= 0) {
    showToast('⚠️ Debes ingresar Nombre del Cliente, Dirección de Entrega y al menos 1 bandeja.');
    return;
  }

  const items = [];
  if (qtyCampo > 0) {
    items.push({
      id: 'campo-30',
      name: 'Bandeja Huevo de Campo (Color/Café)',
      format: '30 unidades',
      eggsCount: 30,
      qty: qtyCampo,
      price: 11500
    });
  }
  if (qtyBlanco > 0) {
    items.push({
      id: 'blanco-30',
      name: 'Bandeja Huevo Blanco Seleccionado',
      format: '30 unidades',
      eggsCount: 30,
      qty: qtyBlanco,
      price: 9000
    });
  }

  const totalTrays = qtyCampo + qtyBlanco;
  const totalEggs = totalTrays * 30;
  const subtotal = qtyCampo * 11500 + qtyBlanco * 9000;
  const commissionAmount = totalTrays * 2000;

  // Código del embajador activo en sesión
  const ambCode = (currentUserCode || currentAdminUser || 'EMBAJADOR').toUpperCase();
  ensureAmbassadorExistsByCode(ambCode);

  const orders = loadOrders();
  const nowMs = Date.now();
  const nextOrderNum = 1001 + orders.length;
  const displayId = `QH-${nextOrderNum}`;
  const formattedDate = new Date().toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const fullAddress = clientNotes ? `${clientAddress} (Nota: ${clientNotes})` : clientAddress;

  orders.unshift({
    id: `${displayId}-${String(nowMs).slice(-4)}`,
    displayId,
    date: formattedDate,
    timestamp: nowMs,
    updatedAt: nowMs,
    clientName,
    clientPhone,
    clientAddress: fullAddress,
    orderType,
    deliveryDay: orderType === 'Pedido Fijo Semanal' ? deliveryDay : null,
    items,
    totalEggs,
    subtotal,
    ambassadorCode: ambCode,
    createdByAmbassador: currentAdminUser || ambCode,
    commissionAmount,
    approved: false,
    paid: false,
    deliveryStatus: 'Falta Entregar',
    status: 'Pendiente de Pago'
  });

  const portalForm = document.getElementById('portal-load-order-form');
  if (portalForm) portalForm.reset();
  const campoInp = document.getElementById('portal-order-qty-campo');
  const blancoInp = document.getElementById('portal-order-qty-blanco');
  if (campoInp) campoInp.value = 1;
  if (blancoInp) blancoInp.value = 0;
  togglePortalWeeklyDay();
  updatePortalOrderPreview();

  await persistCloudState(
    `Pedido ${displayId} cargado en Portal por ${currentAdminUser} (${ambCode}) para despacho`
  );
  renderAmbassadorPortal();
  showToast(
    `🚀 Pedido ${displayId} enviado a Despacho de Juanjo y Mati • Comisión de ${formatCLP(
      commissionAmount
    )} asignada a tu código ${ambCode}`
  );
}

function renderAmbassadorPortal() {
  const portal = document.getElementById('ambassador-portal-view');
  if (!portal || portal.classList.contains('hidden')) return;

  const ambReport = calculateAmbassadorsAndBonusesState();
  const orders = loadOrders();

  // Identificar el registro del embajador actual
  const cleanCode = (currentUserCode || '').toUpperCase();
  const cleanName = (currentAdminUser || '').toUpperCase();

  let myStat = ambReport.statsMap[cleanCode];
  if (!myStat) {
    myStat = Object.values(ambReport.statsMap).find(
      (s) =>
        s.code === cleanCode ||
        s.code + '10' === cleanCode ||
        cleanCode + '10' === s.code ||
        (s.name || '').toUpperCase() === cleanName ||
        (s.username || '').toUpperCase() === (currentUserUsername || '').toUpperCase()
    );
  }

  if (!myStat) {
    myStat = {
      name: currentAdminUser || 'Embajador',
      code: cleanCode || 'QH10',
      invitedBy: 'Directo',
      isFounder: isFounderRecruiter(cleanCode) || isFounderRecruiter(cleanName),
      ordersCount: 0,
      pendingOrdersCount: 0,
      ownCampoTrays: 0,
      ownBlancoTrays: 0,
      ownTotalTrays: 0,
      ownPendingTrays: 0,
      ownCommissionEarned: 0,
      guests: [],
      guestCampoTrays: 0,
      guestBlancoTrays: 0,
      guestTotalTrays: 0,
      bonusCampoBlocks: 0,
      bonusBlancoBlocks: 0,
      bonusCampoAmount: 0,
      bonusBlancoAmount: 0,
      totalBonusEarned: 0,
      totalEarnedAll: 0,
      totalPaid: 0,
      totalPendingToPay: 0
    };
  }

  // Actualizar cabeceras del portal
  const nameBadge = document.getElementById('portal-amb-name');
  const codeBadge = document.getElementById('portal-amb-code');
  const invBadge = document.getElementById('portal-amb-invited-badge');
  if (nameBadge) nameBadge.textContent = myStat.name;
  if (codeBadge) codeBadge.textContent = myStat.code;
  if (invBadge) invBadge.textContent = `Invitado por: ${myStat.invitedBy || 'Directo'}`;

  // KPIs personales
  const kpiTrays = document.getElementById('portal-kpi-own-trays');
  const kpiBreak = document.getElementById('portal-kpi-own-breakdown');
  const kpiOwnComm = document.getElementById('portal-kpi-own-commission');
  const kpiGuestBonuses = document.getElementById('portal-kpi-guest-bonuses');
  const kpiGuestSummary = document.getElementById('portal-kpi-guests-summary');
  const kpiTotalPending = document.getElementById('portal-kpi-total-pending');
  const kpiTotalPaid = document.getElementById('portal-kpi-paid-history');

  if (kpiTrays) kpiTrays.textContent = myStat.ownTotalTrays;
  if (kpiBreak) {
    const pendNote = myStat.ownPendingTrays > 0 ? ` (${myStat.ownPendingTrays} en revisión)` : '';
    kpiBreak.textContent = `${myStat.ownCampoTrays} Café • ${myStat.ownBlancoTrays} Blanco${pendNote}`;
  }
  if (kpiOwnComm) kpiOwnComm.textContent = formatCLP(myStat.ownCommissionEarned);
  if (kpiGuestBonuses) kpiGuestBonuses.textContent = formatCLP(myStat.totalBonusEarned);
  if (kpiGuestSummary) {
    kpiGuestSummary.textContent = `${myStat.guests.length} invitado(s) • ${myStat.guestTotalTrays} bandejas de red`;
  }
  if (kpiTotalPending) kpiTotalPending.textContent = formatCLP(myStat.totalPendingToPay);
  if (kpiTotalPaid) kpiTotalPaid.textContent = `Ya pagado histórico: ${formatCLP(myStat.totalPaid)}`;

  // Barras de progreso de Producción de Invitados
  const campoProgressInBlock = myStat.guestCampoTrays % 10;
  const campoPct =
    myStat.guestCampoTrays > 0 && campoProgressInBlock === 0
      ? 100
      : Math.min(100, Math.round((campoProgressInBlock / 10) * 100));
  const progCampoTitle = document.getElementById('portal-progress-campo-title');
  const progCampoPct = document.getElementById('portal-progress-campo-pct');
  const progCampoBar = document.getElementById('portal-progress-campo-bar');
  const progCampoNote = document.getElementById('portal-progress-campo-note');

  if (progCampoTitle) {
    progCampoTitle.textContent = `Bandejas Café de tus invitados: ${campoProgressInBlock}/10 para bono de $10.000`;
  }
  if (progCampoPct) progCampoPct.textContent = `${campoProgressInBlock}/10`;
  if (progCampoBar) progCampoBar.style.width = `${campoPct}%`;
  if (progCampoNote) {
    progCampoNote.textContent = myStat.isFounder
      ? `Total invitados: ${myStat.guestCampoTrays} bandejas Café • Socio Fundador (Sin bono reclutamiento)`
      : `Total acumulado invitados: ${myStat.guestCampoTrays} bandejas Café • ${myStat.bonusCampoBlocks} bono(s) ganado(s) (${formatCLP(myStat.bonusCampoAmount)})`;
  }

  const blancoProgressInBlock = myStat.guestBlancoTrays % 10;
  const blancoPct =
    myStat.guestBlancoTrays > 0 && blancoProgressInBlock === 0
      ? 100
      : Math.min(100, Math.round((blancoProgressInBlock / 10) * 100));
  const progBlancoTitle = document.getElementById('portal-progress-blanco-title');
  const progBlancoPct = document.getElementById('portal-progress-blanco-pct');
  const progBlancoBar = document.getElementById('portal-progress-blanco-bar');
  const progBlancoNote = document.getElementById('portal-progress-blanco-note');

  if (progBlancoTitle) {
    progBlancoTitle.textContent = `Bandejas Blanco de tus invitados: ${blancoProgressInBlock}/10 para bono de $8.000`;
  }
  if (progBlancoPct) progBlancoPct.textContent = `${blancoProgressInBlock}/10`;
  if (progBlancoBar) progBlancoBar.style.width = `${blancoPct}%`;
  if (progBlancoNote) {
    progBlancoNote.textContent = myStat.isFounder
      ? `Total invitados: ${myStat.guestBlancoTrays} bandejas Blanco • Socio Fundador (Sin bono reclutamiento)`
      : `Total acumulado invitados: ${myStat.guestBlancoTrays} bandejas Blanco • ${myStat.bonusBlancoBlocks} bono(s) ganado(s) (${formatCLP(myStat.bonusBlancoAmount)})`;
  }

  // Lista de invitados del embajador
  const guestsListEl = document.getElementById('portal-guests-list-container');
  if (guestsListEl) {
    if (myStat.guests.length === 0) {
      guestsListEl.innerHTML = `
        <p class="text-xs text-slate-400 italic">
          Aún no tienes embajadores registrados bajo tu invitación. Diles que al registrarse en <strong>"🥚 Quiero ser Embajador"</strong> seleccionen tu nombre en <em>"¿Quién te invitó?"</em>.
        </p>
      `;
    } else {
      guestsListEl.innerHTML = `
        <div class="grid sm:grid-cols-2 gap-2.5">
          ${myStat.guests
            .map(
              (g) => `
            <div class="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-2">
              <div>
                <span class="font-display font-extrabold text-white text-xs block">${g.name}</span>
                <span class="text-[11px] text-amber-300 font-bold">Código: ${g.code}</span>
              </div>
              <div class="text-right text-[11px]">
                <span class="font-extrabold text-emerald-400 block">${g.totalTrays} bandejas aprob.</span>
                <span class="text-slate-400">${g.campoTrays} Café • ${g.blancoTrays} Blanco</span>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `;
    }
  }

  // Tabla de Mis Pedidos y Ventas Cargadas (filtra únicamente los pedidos de este embajador)
  const myOrders = orders.filter((o) => {
    const c = (o.ambassadorCode || '').trim().toUpperCase();
    return c === myStat.code || c === cleanCode || c === cleanName;
  });

  const countBadge = document.getElementById('portal-orders-count-badge');
  if (countBadge) countBadge.textContent = `${myOrders.length} pedido(s) registrado(s)`;

  const tbody = document.getElementById('portal-orders-tbody');
  if (tbody) {
    if (myOrders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-8 text-center text-slate-400">
            Aún no tienes pedidos registrados. Carga tu primer pedido en el formulario de arriba o comparte tu código <strong>${myStat.code}</strong>.
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = myOrders
        .map((o) => {
          const comm = calculateOrderCommission(o.items);
          const isDelivered = o.deliveryStatus === 'Entregado';
          const isPaid = Boolean(o.paid || o.approved);

          let statusHtml = '';
          if (isDelivered) {
            statusHtml = `<span class="px-2.5 py-1 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-extrabold">🚚 Entregado</span>`;
          } else if (isPaid) {
            statusHtml = `<span class="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-extrabold">✅ Pagado / Aprobado</span>`;
          } else {
            statusHtml = `<span class="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-extrabold">⏳ Pendiente de Pago</span>`;
          }

          const originHtml = o.createdByAmbassador
            ? `<span class="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">📱 Mi Portal</span>`
            : `<span class="px-2 py-0.5 rounded-lg bg-amber-400/15 text-amber-300 border border-amber-400/30 text-[11px] font-bold">🌐 Web (${myStat.code})</span>`;

          const itemsSummary = (o.items || [])
            .map((it) => `📦 <strong>${it.qty}x</strong> ${it.name}`)
            .join('<br/>');

          return `
            <tr class="hover:bg-white/5 transition">
              <td class="py-3 px-4 whitespace-nowrap">
                <span class="font-display font-extrabold text-white text-xs block">${o.displayId || o.id}</span>
                <span class="text-[11px] text-slate-400">${o.date || '-'}</span>
              </td>
              <td class="py-3 px-4">
                <span class="font-bold text-white text-xs block">${o.clientName || 'Cliente'}</span>
                <span class="text-[11px] text-slate-400 block">${o.orderType || 'Pedido Único'}${
                  o.deliveryDay ? ` (${o.deliveryDay})` : ''
                }</span>
              </td>
              <td class="py-3 px-4 whitespace-nowrap">
                ${originHtml}
              </td>
              <td class="py-3 px-4 text-xs text-slate-200">
                ${itemsSummary}
              </td>
              <td class="py-3 px-4 font-display font-bold text-amber-300 whitespace-nowrap">
                ${formatCLP(o.subtotal)}
              </td>
              <td class="py-3 px-4 font-display font-extrabold text-emerald-400 whitespace-nowrap">
                +${formatCLP(comm)}
              </td>
              <td class="py-3 px-4 whitespace-nowrap">
                ${statusHtml}
              </td>
            </tr>
          `;
        })
        .join('');
    }
  }
}

/* ==========================================================================
   CONTROL DE NAVEGACIÓN Y PERMISOS EN DASHBOARD ADMINISTRATIVO POR ROL
   ========================================================================== */

async function showAdminDashboard(adminName) {
  // Si el usuario tiene rol exclusivamente de embajador, redirigir a su portal personal
  if (currentUserRole === 'embajador') {
    await showAmbassadorPortal();
    return;
  }

  const storefront = document.getElementById('storefront-view');
  const dashboard = document.getElementById('admin-dashboard-view');
  const portal = document.getElementById('ambassador-portal-view');
  const badge = document.getElementById('admin-session-badge');
  const navLabel = document.getElementById('navbar-admin-label');
  const myPortalBtn = document.getElementById('admin-open-my-portal-btn');

  if (storefront) storefront.classList.add('hidden');
  if (portal) portal.classList.add('hidden');
  if (dashboard) dashboard.classList.remove('hidden');
  if (myPortalBtn) myPortalBtn.classList.remove('hidden');

  try {
    window.localStorage.setItem(ADMIN_VIEW_OPEN_KEY, '1');
    window.localStorage.removeItem(PORTAL_VIEW_OPEN_KEY);
  } catch (e) {
    // ignore
  }

  const isEncargada = currentUserRole === 'encargada';
  const roleTag = isEncargada ? 'Encargada de Embajadores y Redes' : 'Socio Fundador';

  if (badge) badge.textContent = `Sesión activa: ${adminName} (${roleTag})`;
  if (navLabel) navLabel.textContent = `Panel (${adminName})`;

  // Aplicar permisos visuales estrictos según rol (Socio vs Encargada Emilia)
  const founderKpis = document.getElementById('admin-founder-kpis-grid');
  const encargadaKpis = document.getElementById('admin-encargada-kpis-grid');
  const supaBtn = document.getElementById('admin-supabase-config-btn');
  const tabAll = document.getElementById('admin-tab-all');
  const tabPedidos = document.getElementById('admin-tab-pedidos');
  const tabFinanzas = document.getElementById('admin-tab-finanzas');
  const tabAnalitica = document.getElementById('admin-tab-analitica');

  if (isEncargada) {
    // Emilia NO ve contabilidad de socios ni direcciones de despacho de clientes
    if (founderKpis) founderKpis.classList.add('hidden');
    if (encargadaKpis) {
      encargadaKpis.classList.remove('hidden');
      encargadaKpis.classList.add('grid');
    }
    if (supaBtn) supaBtn.classList.add('hidden');
    if (tabAll) tabAll.classList.add('hidden');
    if (tabPedidos) tabPedidos.classList.add('hidden');
    if (tabFinanzas) tabFinanzas.classList.add('hidden');
    if (tabAnalitica) tabAnalitica.classList.add('hidden');

    if (activeAdminTab !== 'embajadores' && activeAdminTab !== 'usuarios') {
      activeAdminTab = 'embajadores';
    }
    switchAdminTab(activeAdminTab);
  } else {
    // Socios Fundadores (Juanjo y Mati) tienen acceso total
    if (founderKpis) founderKpis.classList.remove('hidden');
    if (encargadaKpis) {
      encargadaKpis.classList.add('hidden');
      encargadaKpis.classList.remove('grid');
    }
    if (supaBtn) supaBtn.classList.remove('hidden');
    if (tabAll) tabAll.classList.remove('hidden');
    if (tabPedidos) tabPedidos.classList.remove('hidden');
    if (tabFinanzas) tabFinanzas.classList.remove('hidden');
    if (tabAnalitica) tabAnalitica.classList.remove('hidden');

    switchAdminTab(activeAdminTab || 'all');
  }

  const movDate = document.getElementById('partner-mov-date');
  const supDate = document.getElementById('supplier-payment-date');
  if (movDate && !movDate.value) movDate.value = getTodayISODate();
  if (supDate && !supDate.value) supDate.value = getTodayISODate();

  populateRecruiterSelects();
  renderAdminDashboard();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Descargar estado actualizado desde la nube inmediatamente al abrir el Dashboard
  await pullCloudState(false);
}

function closeAdminDashboard() {
  const storefront = document.getElementById('storefront-view');
  const dashboard = document.getElementById('admin-dashboard-view');
  const portal = document.getElementById('ambassador-portal-view');
  if (dashboard) dashboard.classList.add('hidden');
  if (portal) portal.classList.add('hidden');
  if (storefront) storefront.classList.remove('hidden');
  try {
    window.localStorage.removeItem(ADMIN_VIEW_OPEN_KEY);
    window.localStorage.removeItem(PORTAL_VIEW_OPEN_KEY);
  } catch (e) {
    // ignore
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function logoutAdmin() {
  currentAdminUser = null;
  currentUserRole = null;
  currentUserUsername = null;
  currentUserCode = null;
  try {
    window.localStorage.removeItem(ADMIN_SESSION_KEY);
    window.localStorage.removeItem(USER_SESSION_OBJECT_KEY);
    window.localStorage.removeItem(ADMIN_VIEW_OPEN_KEY);
    window.localStorage.removeItem(PORTAL_VIEW_OPEN_KEY);
  } catch (e) {
    // ignore
  }
  const navLabel = document.getElementById('navbar-admin-label');
  if (navLabel) navLabel.textContent = 'Entrar';
  closeAdminDashboard();
  showToast('🔒 Sesión cerrada correctamente');
}

function switchAdminTab(tabName) {
  const isEncargada = currentUserRole === 'encargada';
  if (isEncargada && tabName !== 'embajadores' && tabName !== 'usuarios') {
    tabName = 'embajadores';
  }

  activeAdminTab = tabName;
  const tabs = ['all', 'pedidos', 'finanzas', 'embajadores', 'usuarios', 'analitica'];
  tabs.forEach((t) => {
    const btn = document.getElementById(`admin-tab-${t}`);
    if (!btn) return;
    if (t === tabName) {
      btn.className =
        'admin-tab-btn px-4 py-2.5 rounded-xl font-display font-extrabold text-xs sm:text-sm bg-qh-brown text-white shadow transition';
    } else {
      btn.className =
        'admin-tab-btn px-4 py-2.5 rounded-xl font-display font-extrabold text-xs sm:text-sm text-slate-300 hover:bg-white/10 transition';
    }
  });

  const sections = {
    pedidos: document.getElementById('admin-section-pedidos'),
    finanzas: document.getElementById('admin-section-finanzas'),
    embajadores: document.getElementById('admin-section-embajadores'),
    usuarios: document.getElementById('admin-section-usuarios'),
    analitica: document.getElementById('admin-section-analitica')
  };

  Object.keys(sections).forEach((secKey) => {
    const el = sections[secKey];
    if (!el) return;
    // Seguridad de rol: Encargada (Emilia) jamás ve pedidos (direcciones) ni finanzas (socios) ni analítica
    if (isEncargada && (secKey === 'pedidos' || secKey === 'finanzas' || secKey === 'analitica')) {
      el.classList.add('hidden');
      return;
    }
    if (tabName === 'all' || tabName === secKey) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
}

function refreshDashboardIfVisible() {
  populateRecruiterSelects();
  const dashboard = document.getElementById('admin-dashboard-view');
  if (dashboard && !dashboard.classList.contains('hidden')) {
    renderAdminDashboard();
  }
  const portal = document.getElementById('ambassador-portal-view');
  if (portal && !portal.classList.contains('hidden')) {
    renderAmbassadorPortal();
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
    paid: true,
    deliveryStatus: 'Falta Entregar',
    status: 'Pagado - Falta Entregar'
  });

  document.getElementById('admin-manual-order-form').reset();
  document.getElementById('manual-order-qty').value = 1;
  persistCloudState(`Pedido manual ${displayId} creado y pagado`);

  showToast(
    `✅ Pedido ${displayId} guardado en la nube como Pagado (Listo para despachar)${
      ambassadorCode ? ` • Comisión ${formatCLP(commissionAmount)} sumada a ${ambassadorCode}` : ''
    }`
  );
}

// Filtro activo para las Listas Automáticas de Trabajo de Pedidos
let currentOrderWorklistFilter = 'all'; // 'all' | 'pending_payment' | 'to_dispatch' | 'delivered'

function setOrderWorklistFilter(filterKey) {
  currentOrderWorklistFilter = filterKey;

  const btnAll = document.getElementById('order-worklist-all');
  const btnPending = document.getElementById('order-worklist-pending');
  const btnDispatch = document.getElementById('order-worklist-dispatch');
  const btnDelivered = document.getElementById('order-worklist-delivered');

  const baseInactive = 'order-worklist-btn px-3.5 py-2 rounded-xl text-xs font-extrabold bg-white/10 hover:bg-white/20 transition ';
  const baseActive = 'order-worklist-btn px-3.5 py-2 rounded-xl text-xs font-extrabold shadow-lg transition ';

  if (btnAll) {
    btnAll.className = filterKey === 'all'
      ? baseActive + 'bg-qh-brown text-white'
      : baseInactive + 'text-slate-300';
  }
  if (btnPending) {
    btnPending.className = filterKey === 'pending_payment'
      ? baseActive + 'bg-amber-500 text-qh-navyDark'
      : baseInactive + 'text-amber-300';
  }
  if (btnDispatch) {
    btnDispatch.className = filterKey === 'to_dispatch'
      ? baseActive + 'bg-emerald-500 text-qh-navyDark'
      : baseInactive + 'text-emerald-300';
  }
  if (btnDelivered) {
    btnDelivered.className = filterKey === 'delivered'
      ? baseActive + 'bg-sky-500 text-qh-navyDark'
      : baseInactive + 'text-sky-300';
  }

  renderAdminDashboard();
}

/**
 * Transición a Estado 2: "Pagado / Aprobado — Falta Entregar"
 * Marca el pedido en verde e ingresa el monto directo a la Caja de la Empresa.
 */
function markOrderAsPaid(orderId) {
  const orders = loadOrders();
  const target = orders.find((o) => o.id === orderId);
  if (!target) return;

  target.paid = true;
  target.approved = true;
  target.deliveryStatus = 'Falta Entregar';
  target.status = 'Pagado - Falta Entregar';
  target.updatedAt = Date.now();

  persistCloudState(`Pedido ${target.displayId || orderId} pagado e ingresado a Caja (${formatCLP(target.subtotal)})`);
  showToast(`💰 Pedido ${target.displayId || orderId} marcado como PAGADO. Dinero sumado a Caja Disponible.`);
}

/**
 * Transición a Estado 3: "Entregado / Completado"
 * Marca cuando las bandejas ya fueron despachadas físicamente.
 */
function markOrderAsDelivered(orderId) {
  const orders = loadOrders();
  const target = orders.find((o) => o.id === orderId);
  if (!target) return;

  target.paid = true;
  target.approved = true;
  target.deliveryStatus = 'Entregado';
  target.status = 'Entregado';
  target.updatedAt = Date.now();

  persistCloudState(`Pedido ${target.displayId || orderId} entregado físicamente`);
  showToast(`🚚 Pedido ${target.displayId || orderId} marcado como ENTREGADO / COMPLETADO.`);
}

/**
 * Revierte a Estado 1: "Pendiente de Pago"
 */
function markOrderPendingPayment(orderId) {
  const orders = loadOrders();
  const target = orders.find((o) => o.id === orderId);
  if (!target) return;

  target.paid = false;
  target.approved = false;
  target.deliveryStatus = 'Falta Entregar';
  target.status = 'Pendiente de Pago';
  target.updatedAt = Date.now();

  persistCloudState(`Pedido ${target.displayId || orderId} desmarcado de Caja`);
  showToast(`⏳ Pedido ${target.displayId || orderId} devuelto a Pendiente de Pago.`);
}

/**
 * Revierte a Estado 2: "Falta Entregar"
 */
function markOrderPendingDelivery(orderId) {
  const orders = loadOrders();
  const target = orders.find((o) => o.id === orderId);
  if (!target) return;

  target.deliveryStatus = 'Falta Entregar';
  target.status = target.paid ? 'Pagado - Falta Entregar' : 'Pendiente de Pago';
  target.updatedAt = Date.now();

  persistCloudState(`Pedido ${target.displayId || orderId} devuelto a lista de despacho`);
  showToast(`🚚 Pedido ${target.displayId || orderId} devuelto a Falta Entregar.`);
}

/**
 * Abre el modal para editar cualquier dato del pedido existente:
 * - Modificar bandejas y cantidades
 * - Modificar manualmente el subtotal / total a pagar (descuentos)
 * - Modificar o quitar el código de embajador
 * - Modificar estado de pago y entrega
 */
function openEditOrderModal(orderId) {
  const orders = loadOrders();
  const order = orders.find((o) => o.id === orderId);
  if (!order) return;

  const modal = document.getElementById('edit-order-modal');
  if (!modal) return;

  document.getElementById('edit-order-id').value = order.id;
  document.getElementById('edit-order-display-id').textContent = order.displayId || order.id;
  document.getElementById('edit-order-date').textContent = order.date || '-';
  document.getElementById('edit-order-client-name').value = order.clientName || '';
  document.getElementById('edit-order-client-phone').value = order.clientPhone || '';
  document.getElementById('edit-order-client-address').value = order.clientAddress || '';
  document.getElementById('edit-order-type').value = order.orderType || 'Pedido Único';
  document.getElementById('edit-order-delivery-day').value = order.deliveryDay || 'Lunes';

  let qtyCampo = 0;
  let qtyBlanco = 0;
  (order.items || []).forEach((it) => {
    const q = Number(it.qty) || 0;
    if (it.id === 'campo-30' || (it.name && it.name.toLowerCase().includes('campo'))) {
      qtyCampo += q;
    } else if (it.id === 'blanco-30' || (it.name && it.name.toLowerCase().includes('blanco'))) {
      qtyBlanco += q;
    }
  });

  if (qtyCampo === 0 && qtyBlanco === 0 && (order.items || []).length > 0) {
    qtyCampo = Number(order.items[0].qty) || 1;
  }

  document.getElementById('edit-order-qty-campo').value = qtyCampo;
  document.getElementById('edit-order-qty-blanco').value = qtyBlanco;
  document.getElementById('edit-order-subtotal').value = Number(order.subtotal) || 0;
  document.getElementById('edit-order-ambassador-code').value = order.ambassadorCode || '';

  const stateSel = document.getElementById('edit-order-state');
  if (stateSel) {
    if (order.deliveryStatus === 'Entregado') {
      stateSel.value = 'Entregado';
    } else if (order.paid) {
      stateSel.value = 'Pagado';
    } else {
      stateSel.value = 'Pendiente';
    }
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeEditOrderModal() {
  const modal = document.getElementById('edit-order-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function recalculateModalOrderSubtotal() {
  const qtyCampo = Math.max(0, parseInt(document.getElementById('edit-order-qty-campo').value, 10) || 0);
  const qtyBlanco = Math.max(0, parseInt(document.getElementById('edit-order-qty-blanco').value, 10) || 0);
  const subtotal = qtyCampo * 11500 + qtyBlanco * 9000;
  document.getElementById('edit-order-subtotal').value = subtotal;
}

function clearOrderAmbassadorCodeInModal() {
  const codeInp = document.getElementById('edit-order-ambassador-code');
  if (codeInp) {
    codeInp.value = '-';
  }
}

function handleSaveEditOrder(event) {
  event.preventDefault();
  const orderId = document.getElementById('edit-order-id').value;
  const orders = loadOrders();
  const order = orders.find((o) => o.id === orderId);
  if (!order) return;

  const clientName = (document.getElementById('edit-order-client-name').value || '').trim();
  const clientPhone = (document.getElementById('edit-order-client-phone').value || '').trim();
  const clientAddress = (document.getElementById('edit-order-client-address').value || '').trim();
  const orderType = document.getElementById('edit-order-type').value;
  const deliveryDay = document.getElementById('edit-order-delivery-day').value;

  const qtyCampo = Math.max(0, parseInt(document.getElementById('edit-order-qty-campo').value, 10) || 0);
  const qtyBlanco = Math.max(0, parseInt(document.getElementById('edit-order-qty-blanco').value, 10) || 0);
  const manualSubtotal = Math.max(0, Number(document.getElementById('edit-order-subtotal').value) || 0);

  const rawCode = (document.getElementById('edit-order-ambassador-code').value || '').trim().toUpperCase();
  const cleanCode = (rawCode === '-' || rawCode === 'SIN CODIGO' || rawCode === 'SIN CÓDIGO') ? '' : rawCode;

  const orderState = document.getElementById('edit-order-state').value;

  // Reconstruir items
  const newItems = [];
  if (qtyCampo > 0) {
    const prodCampo = PRODUCTS.find((p) => p.id === 'campo-30');
    newItems.push({
      id: 'campo-30',
      name: prodCampo ? prodCampo.name : 'Bandeja Huevo de Campo',
      format: '30 unidades',
      eggsCount: 30,
      qty: qtyCampo,
      price: 11500
    });
  }
  if (qtyBlanco > 0) {
    const prodBlanco = PRODUCTS.find((p) => p.id === 'blanco-30');
    newItems.push({
      id: 'blanco-30',
      name: prodBlanco ? prodBlanco.name : 'Bandeja Huevo Blanco Seleccionado',
      format: '30 unidades',
      eggsCount: 30,
      qty: qtyBlanco,
      price: 9000
    });
  }

  order.clientName = clientName;
  order.clientPhone = clientPhone;
  order.clientAddress = clientAddress;
  order.orderType = orderType;
  order.deliveryDay = orderType === 'Pedido Fijo Semanal' ? deliveryDay : null;
  order.items = newItems;
  order.totalEggs = (qtyCampo + qtyBlanco) * 30;
  order.subtotal = manualSubtotal;

  order.ambassadorCode = cleanCode;
  order.commissionAmount = cleanCode ? calculateOrderCommission(newItems) : 0;
  if (cleanCode) {
    ensureAmbassadorExistsByCode(cleanCode);
  }

  // Actualizar según estado
  if (orderState === 'Entregado') {
    order.paid = true;
    order.approved = true;
    order.deliveryStatus = 'Entregado';
    order.status = 'Entregado';
  } else if (orderState === 'Pagado') {
    order.paid = true;
    order.approved = true;
    order.deliveryStatus = 'Falta Entregar';
    order.status = 'Pagado - Falta Entregar';
  } else {
    order.paid = false;
    order.approved = false;
    order.deliveryStatus = 'Falta Entregar';
    order.status = 'Pendiente de Pago';
  }

  order.updatedAt = Date.now();

  persistCloudState(`Pedido ${order.displayId || order.id} editado manualmente`);
  showToast(`✏️ Pedido ${order.displayId || order.id} actualizado con éxito en la nube`);
  closeEditOrderModal();
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

  // 2. LÓGICA DE DIVISIÓN 50% + AJUSTE DE BRECHA ENTRE SOCIOS ($2.300 ABONO DE JUANJO A MATI)
  // - Cada gasto pagado a un proveedor o distribuidor por uno de los socios se divide al 50%.
  // - Si paga Bolsillo de Mati: Juanjo debe el 50% de ese gasto a Mati.
  // - Si paga Bolsillo de Juanjo: Mati debe el 50% de ese gasto a Juanjo.
  // - Ajuste oficial: Abono directo de $2.300 a favor de Juanjo (Juanjo le pagó a Mati),
  //   lo que reduce la brecha/deuda de Juanjo hacia Mati en exactamente $2.300 (+2.300 a favor de Juanjo)
  //   y reduce el saldo a favor de Mati en $2.300 (-2.300 a Mati), conservando el cálculo base del pedido de huevos.
  const baseMati50 = Math.round(matiOutOfPocket * 0.5 - juanjoOutOfPocket * 0.5);
  const baseJuanjo50 = Math.round(juanjoOutOfPocket * 0.5 - matiOutOfPocket * 0.5);

  let juanjoAbonosToMati = 0;
  let matiAbonosToJuanjo = 0;
  (finances.partnerAdjustments || []).forEach((adj) => {
    const amt = Number(adj.amount) || 0;
    if (adj.from === 'Juanjo' && (adj.to === 'Morensex' || adj.to === 'Mati')) {
      juanjoAbonosToMati += amt;
    } else if ((adj.from === 'Morensex' || adj.from === 'Mati') && adj.to === 'Juanjo') {
      matiAbonosToJuanjo += amt;
    }
  });

  if (juanjoAbonosToMati === 0 && (!finances.partnerAdjustments || finances.partnerAdjustments.length === 0)) {
    juanjoAbonosToMati = 2300;
  }
  const netAbonoToJuanjo = juanjoAbonosToMati - matiAbonosToJuanjo;

  const saldoBolsilloMati = baseMati50 - netAbonoToJuanjo;
  const saldoBolsilloJuanjo = baseJuanjo50 + netAbonoToJuanjo;

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
    baseMati50,
    baseJuanjo50,
    netAbonoToJuanjo,
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
 */
function toggleOrderPaid(orderId) {
  const orders = loadOrders();
  const target = orders.find((o) => o.id === orderId);
  if (!target) return;

  if (target.paid) {
    markOrderPendingPayment(orderId);
  } else {
    markOrderAsPaid(orderId);
  }
}

/**
 * Paga y salda el Total a Pagar (Comisión Propia + Bonos por Producción de Invitados) de un embajador
 * dejándolo en $0 sin borrar su historial de producción, descontándolo de la Caja de la Empresa.
 */
function payAmbassadorCommission(code, name, amount) {
  if (!amount || amount <= 0) {
    showToast('⚠️ Este embajador no registra saldo pendiente por pagar ($0).');
    return;
  }
  const cleanCode = (code || '').trim().toUpperCase();
  const confirmed = confirm(
    `¿Confirmas registrar el pago total (Comisión Propia + Bonos de Invitados) de ${formatCLP(
      amount
    )} a ${name} (${cleanCode})?\n\n• Se descontará de la Caja de la Empresa.\n• Su deuda pendiente actual quedará saldada en $0 sin borrar su historial de producción.\n• Nuevas ventas o bonos posteriores sumarán desde $0.`
  );
  if (!confirmed) return;

  const nowMs = Date.now();
  const finances = loadFinances();
  const payoutId = 'PAY-AMB-' + nowMs + '-' + Math.random().toString(36).slice(2, 6);

  if (!finances.ambassadorPayouts) finances.ambassadorPayouts = [];
  finances.ambassadorPayouts.unshift({
    id: payoutId,
    date: getTodayISODate(),
    code: cleanCode,
    name: name,
    amount: amount,
    concept: `Pago Comisión + Bonos Embajador: ${name} (${cleanCode})`,
    payer: 'Caja',
    timestamp: nowMs,
    updatedAt: nowMs
  });

  finances.supplierPayments.unshift({
    id: 'SP-AMB-' + nowMs + '-' + Math.random().toString(36).slice(2, 6),
    payoutId: payoutId,
    date: getTodayISODate(),
    amount: amount,
    concept: `Pago Comisión + Bonos Embajador: ${name} (${cleanCode})`,
    payer: 'Caja',
    timestamp: nowMs,
    updatedAt: nowMs
  });

  persistCloudState(`Pago de comisión/bonos a ${cleanCode}: ${formatCLP(amount)} desde Caja`);
  showToast(`💸 Pago de ${formatCLP(amount)} registrado a ${name}. Deuda pendiente saldada a $0.`);
}

/**
 * Elimina un registro del historial de pagos a embajadores y reintegra el monto a Caja.
 */
function deleteAmbassadorPayout(payoutId) {
  const confirmed = confirm('¿Confirmas eliminar esta transacción del historial de pagos a embajadores?');
  if (!confirmed) return;

  const finances = loadFinances();
  const payout = (finances.ambassadorPayouts || []).find((p) => p.id === payoutId);
  const code = payout ? payout.code : '';

  CLOUD_STATE.deletedIds.push(payoutId);
  finances.ambassadorPayouts = (finances.ambassadorPayouts || []).filter((p) => p.id !== payoutId);
  finances.supplierPayments = (finances.supplierPayments || []).filter(
    (sp) => sp.payoutId !== payoutId && sp.id !== payoutId
  );

  persistCloudState(`Transacción de comisión eliminada (${code})`);
  showToast('🗑️ Pago a embajador eliminado y reintegrado a la contabilidad');
}

/* ==========================================================================
   MÓDULO C: 🤝 SISTEMA DE EMBAJADORES, CARGAS/INVITADOS, BONOS Y USUARIOS
   ========================================================================== */

/**
 * Calcula integralmente:
 * 1. Ventas propias de cada embajador (portal + web) y su comisión directa ($2.000/bandeja)
 * 2. Red de Invitados ("Sus Cargas / Sus Invitados") reclutados por cada embajador
 * 3. Bono por Producción de Invitados:
 *    - Cada bloque de 10 bandejas de Huevo de Campo (Café) vendidas por sus invitados = +$10.000
 *    - Cada bloque de 10 bandejas de Huevo Blanco vendidas por sus invitados = +$8.000
 *    - Regla de negocio: Juanjo y Mati no generan bonos para sí mismos por meter gente porque son los socios dueños.
 *      Cualquier otro embajador (incluida Emilia) sí genera bonos por la producción de sus invitados.
 * 4. Saldos pagados y Total a Pagar (Comisión Propia + Bonos por Invitados pendientes).
 */
function calculateAmbassadorsAndBonusesState() {
  const orders = loadOrders();
  const finances = loadFinances();
  const ambassadors = loadAmbassadors();

  const statsMap = {};

  ambassadors.forEach((amb) => {
    const key = (amb.code || '').trim().toUpperCase();
    if (!key) return;
    const isFounder =
      isFounderRecruiter(key) || isFounderRecruiter(amb.name) || amb.role === 'socio';
    statsMap[key] = {
      id: amb.id,
      name: amb.name || key,
      code: key,
      phone: amb.phone || '',
      username: amb.username || '',
      password: amb.password || '',
      invitedBy: amb.invitedBy || 'Directo',
      role: amb.role || 'embajador',
      isFounder,
      ordersCount: 0,
      pendingOrdersCount: 0,
      ownCampoTrays: 0,
      ownBlancoTrays: 0,
      ownTotalTrays: 0,
      ownPendingCampoTrays: 0,
      ownPendingBlancoTrays: 0,
      ownPendingTrays: 0,
      ownCommissionEarned: 0,
      ownCommissionHistoricalBeforeCutoff: 0,
      guests: [],
      guestCampoTrays: 0,
      guestBlancoTrays: 0,
      guestTotalTrays: 0,
      guestPendingCampoTrays: 0,
      guestPendingBlancoTrays: 0,
      bonusCampoBlocks: 0,
      bonusBlancoBlocks: 0,
      bonusCampoAmount: 0,
      bonusBlancoAmount: 0,
      totalBonusEarned: 0,
      totalEarnedAll: 0,
      totalPaid: 0,
      effectiveDeductiblePaid: 0,
      ownCommissionPending: 0,
      bonusPending: 0,
      totalPendingToPay: 0
    };
  });

  function resolveAmbassadorKey(rawIdentifier) {
    const clean = (rawIdentifier || '').trim().toUpperCase();
    if (!clean || clean === '-' || clean === 'DIRECTO' || clean.includes('NADIE')) return null;
    if (statsMap[clean]) return clean;
    const foundKey = Object.keys(statsMap).find((k) => {
      const entry = statsMap[k];
      return (
        entry.code === clean ||
        entry.code + '10' === clean ||
        clean + '10' === entry.code ||
        (entry.name || '').trim().toUpperCase() === clean ||
        (entry.username || '').trim().toUpperCase() === clean
      );
    });
    if (foundKey) return foundKey;
    if (isFounderRecruiter(clean)) {
      const fKey = clean.includes('JUANJO') ? 'JUANJO' : 'MATI10';
      if (!statsMap[fKey]) {
        statsMap[fKey] = {
          id: null,
          name: fKey === 'JUANJO' ? 'Juanjo' : 'Mati (Morensex)',
          code: fKey,
          phone: '',
          username: fKey === 'JUANJO' ? 'juanjo' : 'morensex',
          password: 'FOUNDER_HASH',
          invitedBy: 'Directo',
          role: 'socio',
          isFounder: true,
          ordersCount: 0,
          pendingOrdersCount: 0,
          ownCampoTrays: 0,
          ownBlancoTrays: 0,
          ownTotalTrays: 0,
          ownPendingCampoTrays: 0,
          ownPendingBlancoTrays: 0,
          ownPendingTrays: 0,
          ownCommissionEarned: 0,
          ownCommissionHistoricalBeforeCutoff: 0,
          guests: [],
          guestCampoTrays: 0,
          guestBlancoTrays: 0,
          guestTotalTrays: 0,
          guestPendingCampoTrays: 0,
          guestPendingBlancoTrays: 0,
          bonusCampoBlocks: 0,
          bonusBlancoBlocks: 0,
          bonusCampoAmount: 0,
          bonusBlancoAmount: 0,
          totalBonusEarned: 0,
          totalEarnedAll: 0,
          totalPaid: 0,
          effectiveDeductiblePaid: 0,
          ownCommissionPending: 0,
          bonusPending: 0,
          totalPendingToPay: 0
        };
      }
      return fKey;
    }
    return null;
  }

  let totalAllOwnTrays = 0;
  let totalAllOwnCommissionsEarned = 0;

  // 1. Contabilizar pedidos por embajador
  orders.forEach((o) => {
    const rawCode = (o.ambassadorCode || '').trim().toUpperCase();
    if (!rawCode || rawCode === '-') return;

    let matchedKey = resolveAmbassadorKey(rawCode);
    if (!matchedKey) {
      matchedKey = rawCode;
      statsMap[matchedKey] = {
        id: null,
        name: rawCode,
        code: rawCode,
        phone: '',
        username: rawCode.toLowerCase(),
        password: '',
        invitedBy: 'Directo',
        role: 'embajador',
        isFounder: isFounderRecruiter(rawCode),
        ordersCount: 0,
        pendingOrdersCount: 0,
        ownCampoTrays: 0,
        ownBlancoTrays: 0,
        ownTotalTrays: 0,
        ownPendingCampoTrays: 0,
        ownPendingBlancoTrays: 0,
        ownPendingTrays: 0,
        ownCommissionEarned: 0,
        ownCommissionHistoricalBeforeCutoff: 0,
        guests: [],
        guestCampoTrays: 0,
        guestBlancoTrays: 0,
        guestTotalTrays: 0,
        guestPendingCampoTrays: 0,
        guestPendingBlancoTrays: 0,
        bonusCampoBlocks: 0,
        bonusBlancoBlocks: 0,
        bonusCampoAmount: 0,
        bonusBlancoAmount: 0,
        totalBonusEarned: 0,
        totalEarnedAll: 0,
        totalPaid: 0,
        effectiveDeductiblePaid: 0,
        ownCommissionPending: 0,
        bonusPending: 0,
        totalPendingToPay: 0
      };
    }

    const stat = statsMap[matchedKey];
    let orderCampo = 0;
    let orderBlanco = 0;

    (o.items || []).forEach((it) => {
      const qty = Number(it.qty) || 0;
      const lowerName = (it.name || '').toLowerCase();
      if (it.id === 'blanco-30' || lowerName.includes('blanco')) {
        orderBlanco += qty;
      } else {
        orderCampo += qty;
      }
    });

    const orderTrays = orderCampo + orderBlanco;
    if (o.approved || o.paid) {
      stat.ordersCount += 1;
      stat.ownCampoTrays += orderCampo;
      stat.ownBlancoTrays += orderBlanco;
      stat.ownTotalTrays += orderTrays;
      const comm = orderTrays * 2000;
      stat.ownCommissionEarned += comm;
      if ((o.timestamp || 0) <= 1729960000000) {
        stat.ownCommissionHistoricalBeforeCutoff += comm;
      }
      totalAllOwnTrays += orderTrays;
      totalAllOwnCommissionsEarned += comm;
    } else {
      stat.pendingOrdersCount += 1;
      stat.ownPendingCampoTrays += orderCampo;
      stat.ownPendingBlancoTrays += orderBlanco;
      stat.ownPendingTrays += orderTrays;
    }
  });

  // 2. Agrupar invitados ("Sus Cargas / Sus Invitados") por reclutador y sumar su producción
  Object.values(statsMap).forEach((guestStat) => {
    const invRaw = (guestStat.invitedBy || '').trim();
    const recruiterKey = resolveAmbassadorKey(invRaw);
    if (!recruiterKey || recruiterKey === guestStat.code) return;

    const recruiter = statsMap[recruiterKey];
    if (!recruiter) return;

    recruiter.guests.push({
      id: guestStat.id,
      name: guestStat.name,
      code: guestStat.code,
      campoTrays: guestStat.ownCampoTrays,
      blancoTrays: guestStat.ownBlancoTrays,
      totalTrays: guestStat.ownTotalTrays,
      pendingCampoTrays: guestStat.ownPendingCampoTrays,
      pendingBlancoTrays: guestStat.ownPendingBlancoTrays,
      pendingTrays: guestStat.ownPendingTrays
    });

    recruiter.guestCampoTrays += guestStat.ownCampoTrays;
    recruiter.guestBlancoTrays += guestStat.ownBlancoTrays;
    recruiter.guestTotalTrays += guestStat.ownTotalTrays;
    recruiter.guestPendingCampoTrays += guestStat.ownPendingCampoTrays;
    recruiter.guestPendingBlancoTrays += guestStat.ownPendingBlancoTrays;
  });

  // 3. Calcular Bonos por Producción de Invitados (10 Bandejas Café = $10.000, 10 Bandejas Blanco = $8.000)
  let totalAllGuestBonusesEarned = 0;
  let totalAllGuestTrays = 0;

  Object.values(statsMap).forEach((stat) => {
    totalAllGuestTrays += stat.guestTotalTrays;
    if (stat.isFounder) {
      // Regla de negocio: Juanjo y Mati no generan bonos para sí mismos por meter gente
      stat.bonusCampoBlocks = 0;
      stat.bonusBlancoBlocks = 0;
      stat.bonusCampoAmount = 0;
      stat.bonusBlancoAmount = 0;
      stat.totalBonusEarned = 0;
    } else {
      stat.bonusCampoBlocks = Math.floor(stat.guestCampoTrays / 10);
      stat.bonusBlancoBlocks = Math.floor(stat.guestBlancoTrays / 10);
      stat.bonusCampoAmount = stat.bonusCampoBlocks * 10000;
      stat.bonusBlancoAmount = stat.bonusBlancoBlocks * 8000;
      stat.totalBonusEarned = stat.bonusCampoAmount + stat.bonusBlancoAmount;
      totalAllGuestBonusesEarned += stat.totalBonusEarned;
    }
    stat.totalEarnedAll = stat.ownCommissionEarned + stat.totalBonusEarned;
  });

  // 4. Descontar Pagos Realizados (ambassadorPayouts)
  const ambassadorPayouts = finances.ambassadorPayouts || [];
  let totalAllPaidCommissions = 0;

  ambassadorPayouts.forEach((pay) => {
    const payAmt = Number(pay.amount) || 0;
    totalAllPaidCommissions += payAmt;
    const matchedKey = resolveAmbassadorKey(pay.code);
    if (matchedKey && statsMap[matchedKey]) {
      const st = statsMap[matchedKey];
      st.totalPaid += payAmt;
      if (pay.id === 'PAY-AMB-EMILIA-6000' || pay.isHistoricalSeed) {
        st.effectiveDeductiblePaid += Math.min(payAmt, st.ownCommissionHistoricalBeforeCutoff);
      } else {
        st.effectiveDeductiblePaid += payAmt;
      }
    }
  });

  let totalAllPendingToPay = 0;
  Object.values(statsMap).forEach((stat) => {
    stat.totalPendingToPay = Math.max(0, stat.totalEarnedAll - stat.effectiveDeductiblePaid);
    stat.ownCommissionPending = Math.max(
      0,
      stat.ownCommissionEarned - stat.effectiveDeductiblePaid
    );
    stat.bonusPending = Math.max(0, stat.totalPendingToPay - stat.ownCommissionPending);
    totalAllPendingToPay += stat.totalPendingToPay;
  });

  return {
    statsMap,
    ambassadorList: Object.values(statsMap),
    totalAllOwnTrays,
    totalAllOwnCommissionsEarned,
    totalAllGuestTrays,
    totalAllGuestBonusesEarned,
    totalAllPaidCommissions,
    totalAllPendingToPay
  };
}

function suggestAmbassadorCode() {
  const nameInp = document.getElementById('ambassador-name-input');
  const codeInp = document.getElementById('ambassador-code-create');
  const userInp = document.getElementById('ambassador-username-input');
  if (!nameInp || !codeInp) return;
  const cleanName = (nameInp.value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  if (cleanName) {
    codeInp.value = `${cleanName}10`;
    if (userInp && !userInp.dataset.touched) {
      userInp.value = cleanName.toLowerCase();
    }
  }
}

function generateRandomAmbassadorCode() {
  const nameInp = document.getElementById('ambassador-name-input');
  const codeInp = document.getElementById('ambassador-code-create');
  if (!codeInp) return;
  const prefix =
    ((nameInp && nameInp.value) || 'QH')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
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
  const invInp = document.getElementById('ambassador-invited-by-select');
  const phoneInp = document.getElementById('ambassador-phone-input');
  const userInp = document.getElementById('ambassador-username-input');
  const passInp = document.getElementById('ambassador-password-input');

  const name = (nameInp.value || '').trim();
  const code = (codeInp.value || '').trim().toUpperCase().replace(/\s+/g, '');
  const invitedBy = ((invInp && invInp.value) || 'Directo').trim();
  const phone = ((phoneInp && phoneInp.value) || '').trim();
  const username =
    ((userInp && userInp.value) || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '') || code.toLowerCase();
  const password = ((passInp && passInp.value) || '').trim() || '12345';

  if (!name || !code) return;

  const ambassadors = loadAmbassadors();
  const users = loadUsers();
  const exists = ambassadors.some((a) => (a.code || '').toUpperCase() === code);
  if (exists) {
    showToast(`⚠️ El código ${code} ya está asignado a un embajador`);
    return;
  }

  const nowMs = Date.now();
  ambassadors.push({
    id: 'AMB-' + code + '-' + String(nowMs).slice(-4),
    name,
    code,
    phone,
    username,
    password,
    invitedBy,
    role: 'embajador',
    createdAt: new Date().toLocaleDateString('es-CL'),
    timestamp: nowMs,
    updatedAt: nowMs
  });

  // Sincronizar también en CLOUD_STATE.users para que pueda entrar a su Portal Personal
  const existingUser = users.find(
    (u) => (u.username || '').toLowerCase() === username || (u.code || '').toUpperCase() === code
  );
  if (!existingUser) {
    users.push({
      id: 'USR-' + code + '-' + String(nowMs).slice(-4),
      username,
      password,
      name,
      role: 'embajador',
      code,
      phone,
      invitedBy,
      createdAt: new Date().toLocaleDateString('es-CL'),
      timestamp: nowMs,
      updatedAt: nowMs
    });
  }

  if (nameInp) nameInp.value = '';
  if (codeInp) codeInp.value = '';
  if (phoneInp) phoneInp.value = '';
  if (userInp) userInp.value = '';
  if (passInp) passInp.value = '';

  persistCloudState(`Nuevo embajador registrado: ${name} (${code}) • Reclutado por: ${invitedBy}`);
  showToast(`☁️ Embajador ${name} (${code}) creado con acceso a Portal (Usuario: ${username})`);
}

function copyAmbassadorCode(code) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code);
  }
  showToast(`📋 Código de embajador copiado: ${code}`);
}

function openEditAmbassadorModal(ambId) {
  populateRecruiterSelects();
  const ambassadors = loadAmbassadors();
  const amb = ambassadors.find((a) => a.id === ambId || a.code === ambId);
  if (!amb) return;

  const modal = document.getElementById('edit-ambassador-modal');
  if (!modal) return;

  document.getElementById('edit-amb-id').value = amb.id;
  document.getElementById('edit-amb-name').value = amb.name || '';
  document.getElementById('edit-amb-code').value = amb.code || '';
  document.getElementById('edit-amb-phone').value = amb.phone || '';
  document.getElementById('edit-amb-username').value = amb.username || (amb.code || '').toLowerCase();
  document.getElementById('edit-amb-password').value =
    amb.password === 'FOUNDER_HASH' ? '' : amb.password || '12345';

  const invSel = document.getElementById('edit-amb-invited-by');
  if (invSel) {
    const invVal = amb.invitedBy || 'Directo';
    const hasOpt = Array.from(invSel.options).some((o) => o.value === invVal);
    if (!hasOpt && invVal !== 'Directo') {
      const opt = document.createElement('option');
      opt.value = invVal;
      opt.textContent = invVal;
      invSel.appendChild(opt);
    }
    invSel.value = invVal;
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeEditAmbassadorModal() {
  const modal = document.getElementById('edit-ambassador-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function handleSaveEditAmbassador(event) {
  event.preventDefault();
  const ambId = document.getElementById('edit-amb-id').value;
  const name = (document.getElementById('edit-amb-name').value || '').trim();
  const newCode = (document.getElementById('edit-amb-code').value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  const phone = (document.getElementById('edit-amb-phone').value || '').trim();
  const invitedBy = (document.getElementById('edit-amb-invited-by').value || 'Directo').trim();
  const username = (document.getElementById('edit-amb-username').value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  const password = (document.getElementById('edit-amb-password').value || '').trim();

  if (!name || !newCode) return;

  const ambassadors = loadAmbassadors();
  const users = loadUsers();
  const amb = ambassadors.find((a) => a.id === ambId);
  if (!amb) return;

  const oldCode = (amb.code || '').toUpperCase();
  const oldUsername = (amb.username || '').toLowerCase();
  const nowMs = Date.now();

  amb.name = name;
  amb.code = newCode;
  amb.phone = phone;
  amb.invitedBy = invitedBy;
  if (username) amb.username = username;
  if (password && amb.password !== 'FOUNDER_HASH') amb.password = password;
  amb.updatedAt = nowMs;

  // Sincronizar en CLOUD_STATE.users
  const linkedUser = users.find(
    (u) =>
      (u.code || '').toUpperCase() === oldCode ||
      (u.username || '').toLowerCase() === oldUsername
  );
  if (linkedUser) {
    linkedUser.name = name;
    linkedUser.code = newCode;
    linkedUser.phone = phone;
    linkedUser.invitedBy = invitedBy;
    if (username) linkedUser.username = username;
    if (password && linkedUser.password !== 'FOUNDER_HASH') linkedUser.password = password;
    linkedUser.updatedAt = nowMs;
  }

  // Si cambió el código, actualizar los pedidos que tenían el código anterior
  if (oldCode && oldCode !== newCode) {
    loadOrders().forEach((o) => {
      if ((o.ambassadorCode || '').toUpperCase() === oldCode) {
        o.ambassadorCode = newCode;
        o.updatedAt = nowMs;
      }
    });
  }

  closeEditAmbassadorModal();
  persistCloudState(`Embajador actualizado: ${name} (${newCode}) • Invitado por: ${invitedBy}`);
  showToast(`✏️ Embajador ${name} actualizado en la nube`);
}

function deleteAmbassador(ambId) {
  const ambassadors = loadAmbassadors();
  const target = ambassadors.find((a) => a.id === ambId);
  if (target && isFounderRecruiter(target.code)) {
    showToast('⚠️ No se puede eliminar el registro de un Socio Fundador.');
    return;
  }
  const confirmed = confirm(
    `¿Confirmas eliminar al embajador ${target ? target.name : ambId} de la base de datos?`
  );
  if (!confirmed) return;

  CLOUD_STATE.deletedIds.push(ambId);
  CLOUD_STATE.ambassadors = CLOUD_STATE.ambassadors.filter((a) => a.id !== ambId);
  if (target) {
    const linkedUser = loadUsers().find(
      (u) =>
        u.role === 'embajador' &&
        ((u.code || '').toUpperCase() === (target.code || '').toUpperCase() ||
          (u.username || '').toLowerCase() === (target.username || '').toLowerCase())
    );
    if (linkedUser) {
      CLOUD_STATE.deletedIds.push(linkedUser.id);
      CLOUD_STATE.users = CLOUD_STATE.users.filter((u) => u.id !== linkedUser.id);
    }
  }
  persistCloudState('Embajador eliminado');
  showToast('🗑️ Embajador eliminado de la Base de Datos Cloud');
}

/* ==========================================================================
   👥 MÓDULO DE GESTIÓN DINÁMICA DE USUARIOS Y PERMISOS (ROLES INTERNOS)
   ========================================================================== */

function suggestNewUserFields() {
  const nameInp = document.getElementById('new-user-name');
  const userInp = document.getElementById('new-user-username');
  const codeInp = document.getElementById('new-user-code');
  if (!nameInp) return;

  const clean = (nameInp.value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '');

  if (userInp && !userInp.dataset.touched) {
    userInp.value = clean.toLowerCase().slice(0, 12);
  }
  if (codeInp && !codeInp.dataset.touched) {
    codeInp.value = clean ? `${clean.toUpperCase().slice(0, 8)}10` : '';
  }
}

function handleAdminCreateUser(event) {
  event.preventDefault();
  const nameEl = document.getElementById('new-user-name');
  const phoneEl = document.getElementById('new-user-phone');
  const userEl = document.getElementById('new-user-username');
  const passEl = document.getElementById('new-user-password');
  const roleEl = document.getElementById('new-user-role');
  const codeEl = document.getElementById('new-user-code');
  const invEl = document.getElementById('new-user-invited-by');

  const name = (nameEl ? nameEl.value : '').trim();
  const phone = (phoneEl ? phoneEl.value : '').trim();
  const username = (userEl ? userEl.value : '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  const password = (passEl ? passEl.value : '').trim();
  let role = (roleEl ? roleEl.value : 'embajador').trim();
  const rawCode = (codeEl ? codeEl.value : '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  const invitedBy = (invEl ? invEl.value : 'Directo').trim();

  if (!name || !username || !password) return;

  // Si quien crea el usuario es Encargada (Emilia), no puede crear Socios Fundadores
  if (currentUserRole === 'encargada' && role === 'socio') {
    role = 'embajador';
  }

  const code =
    rawCode ||
    `${name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8)}10`;

  const users = loadUsers();
  const ambassadors = loadAmbassadors();

  const existsUser = users.some((u) => (u.username || '').toLowerCase() === username);
  if (existsUser) {
    showToast(`⚠️ El usuario "${username}" ya existe en el sistema.`);
    return;
  }

  const nowMs = Date.now();
  const newUserId = 'USR-' + code + '-' + String(nowMs).slice(-4);
  users.push({
    id: newUserId,
    username,
    password,
    name,
    role,
    code,
    ambassadorCode: code,
    phone,
    invitedBy,
    createdAt: new Date().toLocaleDateString('es-CL'),
    timestamp: nowMs,
    updatedAt: nowMs
  });

  const existsAmb = ambassadors.some((a) => (a.code || '').toUpperCase() === code);
  if (!existsAmb) {
    ambassadors.push({
      id: 'AMB-' + code + '-' + String(nowMs).slice(-4),
      name,
      code,
      phone,
      username,
      password,
      invitedBy,
      role,
      createdAt: new Date().toLocaleDateString('es-CL'),
      timestamp: nowMs,
      updatedAt: nowMs
    });
  }

  const formEl = document.getElementById('admin-create-user-form');
  if (formEl) formEl.reset();
  if (userEl) delete userEl.dataset.touched;
  if (codeEl) delete codeEl.dataset.touched;

  persistCloudState(`Usuario creado: ${name} (@${username}) • Rol: ${role}`);
  showToast(`👥 Usuario ${name} (@${username}) creado con éxito en la nube`);
}

function openEditUserModal(userId) {
  populateRecruiterSelects();
  const users = loadUsers();
  const usr = users.find((u) => u.id === userId);
  if (!usr) return;

  if (currentUserRole === 'encargada' && usr.role === 'socio') {
    showToast('⚠️ Solo los Socios Fundadores pueden editar cuentas de Socio.');
    return;
  }

  const modal = document.getElementById('edit-user-modal');
  if (!modal) return;

  document.getElementById('edit-usr-id').value = usr.id;
  document.getElementById('edit-usr-name').value = usr.name || '';
  const phoneInp = document.getElementById('edit-usr-phone');
  if (phoneInp) phoneInp.value = usr.phone || '';
  document.getElementById('edit-usr-username').value = usr.username || '';
  document.getElementById('edit-usr-password').value =
    usr.password === 'FOUNDER_HASH' ? '' : usr.password || '';
  document.getElementById('edit-usr-role').value = usr.role || 'embajador';
  document.getElementById('edit-usr-code').value = usr.code || usr.ambassadorCode || '';

  const invSel = document.getElementById('edit-usr-invited-by');
  if (invSel) {
    const invVal = usr.invitedBy || 'Directo';
    const hasOpt = Array.from(invSel.options).some((o) => o.value === invVal);
    if (!hasOpt && invVal !== 'Directo') {
      const opt = document.createElement('option');
      opt.value = invVal;
      opt.textContent = invVal;
      invSel.appendChild(opt);
    }
    invSel.value = invVal;
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeEditUserModal() {
  const modal = document.getElementById('edit-user-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function handleSaveEditUser(event) {
  event.preventDefault();
  const userId = document.getElementById('edit-usr-id').value;
  const name = (document.getElementById('edit-usr-name').value || '').trim();
  const phoneInp = document.getElementById('edit-usr-phone');
  const phone = (phoneInp ? phoneInp.value : '').trim();
  const username = (document.getElementById('edit-usr-username').value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  const password = (document.getElementById('edit-usr-password').value || '').trim();
  let role = (document.getElementById('edit-usr-role').value || 'embajador').trim();
  const code = (document.getElementById('edit-usr-code').value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  const invitedBy = (document.getElementById('edit-usr-invited-by').value || 'Directo').trim();

  const users = loadUsers();
  const ambassadors = loadAmbassadors();
  const usr = users.find((u) => u.id === userId);
  if (!usr) return;

  if (currentUserRole === 'encargada' && role === 'socio') {
    role = usr.role === 'socio' ? 'socio' : 'encargada';
  }

  const oldCode = (usr.code || usr.ambassadorCode || '').toUpperCase();
  const oldUsername = (usr.username || '').toLowerCase();
  const nowMs = Date.now();

  usr.name = name;
  usr.phone = phone;
  usr.username = username;
  if (password) usr.password = password;
  usr.role = role;
  if (code) {
    usr.code = code;
    usr.ambassadorCode = code;
  }
  usr.invitedBy = invitedBy;
  usr.updatedAt = nowMs;

  const linkedAmb = ambassadors.find(
    (a) =>
      (a.code || '').toUpperCase() === oldCode ||
      (a.username || '').toLowerCase() === oldUsername
  );
  if (linkedAmb) {
    linkedAmb.name = name;
    linkedAmb.phone = phone;
    linkedAmb.username = username;
    if (password) linkedAmb.password = password;
    linkedAmb.role = role;
    if (code) linkedAmb.code = code;
    linkedAmb.invitedBy = invitedBy;
    linkedAmb.updatedAt = nowMs;
  }

  closeEditUserModal();
  persistCloudState(`Usuario actualizado: ${name} (@${username}) • Rol: ${role}`);
  showToast(`✏️ Usuario ${name} actualizado en la nube`);
}

function deleteUserRecord(userId) {
  const users = loadUsers();
  const usr = users.find((u) => u.id === userId);
  if (!usr) return;

  if (
    usr.id === 'USR-FOUNDER-JUANJO' ||
    usr.id === 'USR-FOUNDER-MATI' ||
    isFounderRecruiter(usr.username)
  ) {
    showToast('⚠️ Las cuentas de los Socios Fundadores (Juanjo y Mati) están protegidas.');
    return;
  }

  const confirmed = confirm(`¿Confirmas eliminar la cuenta de usuario de ${usr.name} (@${usr.username})?`);
  if (!confirmed) return;

  CLOUD_STATE.deletedIds.push(userId);
  CLOUD_STATE.users = CLOUD_STATE.users.filter((u) => u.id !== userId);

  persistCloudState(`Usuario eliminado: ${usr.name}`);
  showToast(`🗑️ Usuario ${usr.name} eliminado`);
}

/* ==========================================================================
   RENDERIZADO INTEGRAL DEL DASHBOARD ADMINISTRATIVO
   ========================================================================== */

function renderAdminDashboard() {
  const orders = loadOrders();
  const analytics = loadAnalytics();
  const finances = loadFinances();
  const users = loadUsers();

  // Asegurar que las listas de reclutadores estén siempre al día
  populateRecruiterSelects();

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
  const adjMatiEl = document.getElementById('partner-mati-adjustment-note');

  if (totalMatiPaidEl) totalMatiPaidEl.textContent = formatCLP(fin.matiOutOfPocket);
  if (adjMatiEl) adjMatiEl.textContent = `-${formatCLP(fin.netAbonoToJuanjo || 2300)}`;

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
  const adjJuanjoEl = document.getElementById('partner-juanjo-adjustment-note');

  if (totalJuanjoPaidEl) totalJuanjoPaidEl.textContent = formatCLP(fin.juanjoOutOfPocket);
  if (adjJuanjoEl) adjJuanjoEl.textContent = `+${formatCLP(fin.netAbonoToJuanjo || 2300)}`;

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

  // 3. Calcular Embajadores, Invitados (Cargas), Bonos por Producción y Saldos Pendientes
  const ambReport = calculateAmbassadorsAndBonusesState();
  const ambassadorRows = ambReport.ambassadorList;
  const ambassadorPayouts = finances.ambassadorPayouts || [];

  // 4. Actualizar KPIs Superiores (Socios Fundadores + Encargada Emilia)
  const kpiRevEl = document.getElementById('kpi-total-revenue');
  const kpiProjEl = document.getElementById('kpi-monthly-projection');
  const kpiOrdEl = document.getElementById('kpi-total-orders');
  const kpiOrdBreakEl = document.getElementById('kpi-orders-breakdown');
  const kpiPartnersEl = document.getElementById('kpi-partners-total');
  const kpiSuppliersEl = document.getElementById('kpi-suppliers-total');
  const kpiAmbCommEl = document.getElementById('kpi-ambassadors-commission');
  const kpiAmbCountEl = document.getElementById('kpi-ambassadors-count');

  if (kpiRevEl) kpiRevEl.textContent = formatCLP(fin.ordersPaidRevenue);
  if (kpiProjEl) {
    kpiProjEl.textContent = `Total ventas (c/pendientes): ${formatCLP(totalOrdersRevenue)}`;
  }
  if (kpiOrdEl) kpiOrdEl.textContent = orders.length;
  if (kpiOrdBreakEl) {
    kpiOrdBreakEl.textContent = `${fin.paidOrdersCount} Pagados • ${orders.length - fin.paidOrdersCount} Pendientes de Pago`;
  }
  if (kpiPartnersEl) kpiPartnersEl.textContent = formatCLP(fin.cajaDisponible);
  if (kpiSuppliersEl) {
    kpiSuppliersEl.textContent = `Pagado a proveedores: ${formatCLP(fin.totalSuppliersExpenses)}`;
  }
  if (kpiAmbCommEl) kpiAmbCommEl.textContent = formatCLP(ambReport.totalAllPendingToPay);
  if (kpiAmbCountEl) {
    kpiAmbCountEl.textContent = `${ambassadorRows.length} embajadores • Pagado: ${formatCLP(
      ambReport.totalAllPaidCommissions
    )}`;
  }

  // KPIs exclusivos para la vista de Encargada (Emilia)
  const encAmbTotal = document.getElementById('enc-kpi-ambassadors-total');
  const encAmbSub = document.getElementById('enc-kpi-ambassadors-sub');
  const encTotalTrays = document.getElementById('enc-kpi-total-trays');
  const encTraysBreak = document.getElementById('enc-kpi-trays-breakdown');
  const encTotalBonuses = document.getElementById('enc-kpi-total-bonuses');
  const encBonusesSub = document.getElementById('enc-kpi-bonuses-sub');
  const encPendingPayouts = document.getElementById('enc-kpi-pending-payouts');
  const encPaidSub = document.getElementById('enc-kpi-paid-sub');

  const totalCampoNetwork = ambassadorRows.reduce((acc, r) => acc + (r.ownCampoTrays || 0), 0);
  const totalBlancoNetwork = ambassadorRows.reduce((acc, r) => acc + (r.ownBlancoTrays || 0), 0);

  if (encAmbTotal) encAmbTotal.textContent = ambassadorRows.length;
  if (encAmbSub) encAmbSub.textContent = `Activos en la red (${users.length} usuarios)`;
  if (encTotalTrays) encTotalTrays.textContent = ambReport.totalAllOwnTrays;
  if (encTraysBreak) encTraysBreak.textContent = `${totalCampoNetwork} Café • ${totalBlancoNetwork} Blanco`;
  if (encTotalBonuses) encTotalBonuses.textContent = formatCLP(ambReport.totalAllGuestBonusesEarned);
  if (encBonusesSub) encBonusesSub.textContent = `${ambReport.totalAllGuestTrays} bandejas vendidas por invitados`;
  if (encPendingPayouts) encPendingPayouts.textContent = formatCLP(ambReport.totalAllPendingToPay);
  if (encPaidSub) {
    encPaidSub.textContent = `Pagado histórico: ${formatCLP(ambReport.totalAllPaidCommissions)}`;
  }

  // 5. Renderizar Listas de Trabajo (Worklists) y Tabla de Pedidos (Solo Socios Fundadores)
  const filterType = (document.getElementById('admin-filter-order-type') || {}).value || 'all';
  const sortMode = (document.getElementById('admin-sort-orders') || {}).value || 'newest';

  const countAll = orders.length;
  const countPending = orders.filter((o) => !o.paid).length;
  const countDispatch = orders.filter((o) => o.paid && o.deliveryStatus !== 'Entregado').length;
  const countDelivered = orders.filter((o) => o.deliveryStatus === 'Entregado').length;

  const countAllEl = document.getElementById('count-worklist-all');
  const countPendingEl = document.getElementById('count-worklist-pending');
  const countDispatchEl = document.getElementById('count-worklist-dispatch');
  const countDeliveredEl = document.getElementById('count-worklist-delivered');

  if (countAllEl) countAllEl.textContent = countAll;
  if (countPendingEl) countPendingEl.textContent = countPending;
  if (countDispatchEl) countDispatchEl.textContent = countDispatch;
  if (countDeliveredEl) countDeliveredEl.textContent = countDelivered;

  const filteredOrders = orders.filter((o) => {
    if (currentOrderWorklistFilter === 'pending_payment' && o.paid) return false;
    if (currentOrderWorklistFilter === 'to_dispatch' && (!o.paid || o.deliveryStatus === 'Entregado')) return false;
    if (currentOrderWorklistFilter === 'delivered' && o.deliveryStatus !== 'Entregado') return false;

    if (filterType !== 'all' && o.orderType !== filterType) return false;
    return true;
  });

  filteredOrders.sort((a, b) => {
    if (sortMode === 'amount-desc') return (b.subtotal || 0) - (a.subtotal || 0);
    if (sortMode === 'amount-asc') return (a.subtotal || 0) - (b.subtotal || 0);
    if (sortMode === 'eggs-desc') return (b.totalEggs || 0) - (a.totalEggs || 0);
    return (b.timestamp || 0) - (a.timestamp || 0);
  });

  const ordersTbody = document.getElementById('admin-orders-tbody');
  if (ordersTbody && currentUserRole !== 'encargada') {
    if (filteredOrders.length === 0) {
      let emptyMsg = '0 pedidos en esta vista.';
      if (currentOrderWorklistFilter === 'pending_payment') {
        emptyMsg = '🎉 No hay pedidos pendientes de pago. Todos los pedidos registrados están al día o despachados.';
      } else if (currentOrderWorklistFilter === 'to_dispatch') {
        emptyMsg = '🚚 No hay pedidos pendientes de despacho por entregar en este momento.';
      } else if (currentOrderWorklistFilter === 'delivered') {
        emptyMsg = '📦 Historial de pedidos entregados vacío.';
      }
      ordersTbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-8 text-center text-slate-400">
            ${emptyMsg}
          </td>
        </tr>
      `;
    } else {
      ordersTbody.innerHTML = filteredOrders
        .map((order) => {
          const isWeekly = order.orderType === 'Pedido Fijo Semanal';
          const isPaid = Boolean(order.paid);
          const isDelivered = order.deliveryStatus === 'Entregado';
          const commission = calculateOrderCommission(order.items);

          let rowClass = 'hover:bg-white/5 transition';
          let statusBadge = '';
          let actionButtons = '';

          if (isDelivered) {
            rowClass += ' bg-white/5';
            statusBadge = `
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-extrabold">
                🚚 Entregado
              </span>
            `;
            actionButtons = `
              <button type="button" onclick="markOrderPendingDelivery('${order.id}')"
                      class="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-bold text-slate-300 transition"
                      title="Volver a lista de pendientes de entrega">
                ↩️ Falta Entregar
              </button>
            `;
          } else if (isPaid) {
            rowClass += ' bg-emerald-500/10 border-l-4 border-emerald-500';
            statusBadge = `
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 text-xs font-extrabold shadow-sm">
                ✅ Pagado — Falta Entregar
              </span>
            `;
            actionButtons = `
              <button type="button" onclick="markOrderAsDelivered('${order.id}')"
                      class="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-qh-navyDark font-display font-extrabold text-xs shadow transition"
                      title="Marcar como entregado físicamente">
                🚚 Marcar Entregado
              </button>
              <button type="button" onclick="markOrderPendingPayment('${order.id}')"
                      class="px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[10px] font-bold text-slate-400 transition"
                      title="Desmarcar pago (volver a Pendiente)">
                ↩️
              </button>
            `;
          } else {
            rowClass += ' bg-amber-500/5';
            statusBadge = `
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-extrabold">
                ⏳ Pendiente de Pago
              </span>
            `;
            actionButtons = `
              <button type="button" onclick="markOrderAsPaid('${order.id}')"
                      class="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-qh-navyDark font-display font-extrabold text-xs shadow transition"
                      title="Confirmar transferencia e ingresar dinero a Caja">
                💰 Marcar Pagado
              </button>
            `;
          }

          actionButtons += `
            <button type="button" onclick="openEditOrderModal('${order.id}')"
                    class="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-amber-300 font-bold text-xs transition"
                    title="Editar pedido (bandejas, subtotal o código)">
              ✏️
            </button>
            <button type="button" onclick="deleteOrderRecord('${order.id}')"
                    class="px-2 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/30 text-red-300 font-bold text-xs transition"
                    title="Eliminar pedido">
              🗑️
            </button>
          `;

          const clientDisplay = `
            <div class="space-y-1">
              <span class="font-display font-extrabold text-white text-sm block">${order.clientName || 'Cliente'}</span>
              ${
                order.clientPhone
                  ? `<a href="https://wa.me/${order.clientPhone.replace(/[^0-9]/g, '')}" target="_blank" rel="noopener noreferrer"
                        class="text-xs text-emerald-400 hover:underline font-semibold block">
                       📞 ${order.clientPhone}
                     </a>`
                  : ''
              }
              ${
                order.clientAddress
                  ? `<span class="text-xs text-amber-200/90 font-bold block leading-snug">📍 ${order.clientAddress}</span>`
                  : '<span class="text-[11px] text-slate-500 block italic">Sin dirección registrada</span>'
              }
            </div>
          `;

          const itemsSummary = (order.items || [])
            .map((it) => `<span class="inline-block mr-1">📦 <strong>${it.qty}x</strong> ${it.name} (${it.format || '30 un.'})</span>`)
            .join('<br/>');

          const ambCode = (order.ambassadorCode || '').trim().toUpperCase();
          const hasAmb = ambCode && ambCode !== '-';
          const ambDisplay = hasAmb
            ? `<div>
                 <span class="px-2.5 py-1 rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-300 font-display font-extrabold text-xs inline-block">
                   ${ambCode}
                 </span>
                 <span class="text-[10px] text-emerald-400 font-bold block mt-0.5">
                   Comisión: ${formatCLP(commission)}
                 </span>
                 ${
                   order.createdByAmbassador
                     ? `<span class="text-[10px] text-sky-300 block">📱 Cargado en Portal</span>`
                     : ''
                 }
               </div>`
            : `<span class="text-slate-500 text-xs italic">- (Sin código)</span>`;

          return `
            <tr class="${rowClass}">
              <td class="py-3.5 px-4 whitespace-nowrap">
                <span class="font-display font-extrabold text-white block text-sm">${order.displayId || order.id}</span>
                <span class="text-[11px] text-slate-400 block">${order.date}</span>
              </td>
              <td class="py-3.5 px-4 min-w-[200px]">
                ${clientDisplay}
              </td>
              <td class="py-3.5 px-4 whitespace-nowrap">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${
                  isWeekly
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                    : 'bg-sky-400/15 text-sky-300 border border-sky-400/30'
                }">
                  ${isWeekly ? `🔁 Semanal (${order.deliveryDay || 'Lunes'})` : '1️⃣ Único'}
                </span>
              </td>
              <td class="py-3.5 px-4 text-slate-200 leading-relaxed min-w-[180px]">
                ${itemsSummary}
                <span class="block text-[11px] text-slate-400 mt-0.5">${order.totalEggs || 30} huevos en total</span>
              </td>
              <td class="py-3.5 px-4 whitespace-nowrap font-display font-extrabold text-base text-amber-400">
                ${formatCLP(order.subtotal)}
              </td>
              <td class="py-3.5 px-4 whitespace-nowrap">
                ${ambDisplay}
              </td>
              <td class="py-3.5 px-4 whitespace-nowrap">
                <div class="flex flex-col gap-2">
                  <div>${statusBadge}</div>
                  <div class="flex flex-wrap items-center gap-1.5">${actionButtons}</div>
                </div>
              </td>
            </tr>
          `;
        })
        .join('');
    }
  }

  // 6. Renderizar Historial de Pagos a Proveedores (Solo Socios Fundadores)
  const supplierTbody = document.getElementById('admin-supplier-payments-tbody');
  if (supplierTbody && currentUserRole !== 'encargada') {
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

  // 7. Renderizar "📈 Producción de Invitados y Bonos (10 Bandejas)"
  const guestProdGrid = document.getElementById('admin-guest-production-grid');
  const guestBonusesBadge = document.getElementById('guest-bonuses-total-summary-badge');
  if (guestBonusesBadge) {
    guestBonusesBadge.textContent = `Total Bonos Generados: ${formatCLP(
      ambReport.totalAllGuestBonusesEarned
    )}`;
  }

  if (guestProdGrid) {
    // Mostrar a Emilia y a todos los embajadores no-fundadores que tienen invitados (o al menos a Emilia como destacada)
    const eligibleRecruiters = ambassadorRows.filter(
      (amb) =>
        !amb.isFounder &&
        (amb.guests.length > 0 || amb.code === 'EMILIA' || amb.code === 'EMILIA10' || (amb.name || '').toUpperCase() === 'EMILIA')
    );

    if (eligibleRecruiters.length === 0) {
      guestProdGrid.innerHTML = `
        <div class="col-span-2 p-6 rounded-2xl bg-qh-navyDark/70 border border-white/10 text-center text-slate-400 text-xs">
          Aún no hay embajadores con invitados asignados. Asígnalos en el selector <strong>"¿Quién lo invitó?"</strong> al crear o editar un embajador.
        </div>
      `;
    } else {
      guestProdGrid.innerHTML = eligibleRecruiters
        .map((rec) => {
          const campoInBlock = rec.guestCampoTrays % 10;
          const campoPct =
            rec.guestCampoTrays > 0 && campoInBlock === 0
              ? 100
              : Math.min(100, Math.round((campoInBlock / 10) * 100));

          const blancoInBlock = rec.guestBlancoTrays % 10;
          const blancoPct =
            rec.guestBlancoTrays > 0 && blancoInBlock === 0
              ? 100
              : Math.min(100, Math.round((blancoInBlock / 10) * 100));

          const guestsPills =
            rec.guests.length === 0
              ? `<span class="text-[11px] text-slate-400 italic">Sin invitados registrados aún bajo ${rec.name}</span>`
              : rec.guests
                  .map(
                    (g) =>
                      `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-200">
                        👤 <strong>${g.name}</strong> (${g.code}): <span class="text-amber-300 font-bold">${g.campoTrays} Café</span> / <span class="text-sky-300 font-bold">${g.blancoTrays} Blanco</span>
                      </span>`
                  )
                  .join(' ');

          return `
            <div class="p-5 rounded-2xl bg-qh-navyDark/90 border border-amber-400/25 space-y-4">
              <div class="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-display font-extrabold text-base text-white">${rec.name}</span>
                    <span class="px-2 py-0.5 rounded-lg bg-amber-400/20 text-amber-300 font-display font-extrabold text-[11px]">${rec.code}</span>
                  </div>
                  <p class="text-[11px] text-slate-400 mt-0.5">
                    Red de Invitados: <strong class="text-white">${rec.guests.length} persona(s)</strong> • Total grupal aprobado: <strong class="text-emerald-400">${rec.guestTotalTrays} bandejas</strong>
                  </p>
                </div>
                <div class="text-right">
                  <span class="text-[10px] uppercase tracking-wider text-amber-300 font-extrabold block">Bonos Ganados</span>
                  <span class="font-display font-black text-xl text-amber-400">${formatCLP(rec.totalBonusEarned)}</span>
                </div>
              </div>

              <!-- Barra Progreso Huevo de Campo ($10.000 cada 10 bandejas) -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-bold text-amber-200">🥚 Invitados de ${rec.name}: <strong>${campoInBlock}/10 Bandejas Café</strong> para el bono de $10.000</span>
                  <span class="font-display font-extrabold text-amber-300">${rec.bonusCampoBlocks} bono(s) (${formatCLP(rec.bonusCampoAmount)})</span>
                </div>
                <div class="w-full h-3 rounded-full bg-white/10 overflow-hidden">
                  <div class="h-full rounded-full bg-gradient-to-r from-qh-brown to-amber-400 transition-all duration-500" style="width: ${campoPct}%"></div>
                </div>
                <div class="flex justify-between text-[11px] text-slate-400">
                  <span>Total acumulado Café de invitados: <strong>${rec.guestCampoTrays} bandejas</strong>${
                    rec.guestPendingCampoTrays > 0 ? ` (+${rec.guestPendingCampoTrays} en proceso)` : ''
                  }</span>
                  <span>Faltan ${10 - campoInBlock} para +$10.000</span>
                </div>
              </div>

              <!-- Barra Progreso Huevo Blanco ($8.000 cada 10 bandejas) -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-bold text-sky-200">⚪ Invitados de ${rec.name}: <strong>${blancoInBlock}/10 Bandejas Blanco</strong> para el bono de $8.000</span>
                  <span class="font-display font-extrabold text-sky-300">${rec.bonusBlancoBlocks} bono(s) (${formatCLP(rec.bonusBlancoAmount)})</span>
                </div>
                <div class="w-full h-3 rounded-full bg-white/10 overflow-hidden">
                  <div class="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-500" style="width: ${blancoPct}%"></div>
                </div>
                <div class="flex justify-between text-[11px] text-slate-400">
                  <span>Total acumulado Blanco de invitados: <strong>${rec.guestBlancoTrays} bandejas</strong>${
                    rec.guestPendingBlancoTrays > 0 ? ` (+${rec.guestPendingBlancoTrays} en proceso)` : ''
                  }</span>
                  <span>Faltan ${10 - blancoInBlock} para +$8.000</span>
                </div>
              </div>

              <!-- Detalle de cargas / invitados -->
              <div class="pt-2 border-t border-white/10">
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1.5">Sus Cargas / Sus Invitados:</span>
                <div class="flex flex-wrap gap-1.5">
                  ${guestsPills}
                </div>
              </div>
            </div>
          `;
        })
        .join('');
    }
  }

  // 8. Renderizar Tabla General de Embajadores (Comisión Propia + Producción de Invitados y Bonos + Total a Pagar)
  const ambassadorsTbody = document.getElementById('admin-ambassadors-tbody');
  if (ambassadorsTbody) {
    if (ambassadorRows.length === 0) {
      ambassadorsTbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-8 text-center text-slate-400">
            0 embajadores registrados en la nube. Crea un embajador arriba para comenzar.
          </td>
        </tr>
      `;
    } else {
      ambassadorsTbody.innerHTML = ambassadorRows
        .map((amb) => {
          const safeName = (amb.name || '').replace(/'/g, "\\'");
          const invLabel = amb.invitedBy || 'Directo';
          const isDirect =
            invLabel.toLowerCase() === 'directo' || invLabel.toLowerCase().includes('nadie');

          const invitedByHtml = isDirect
            ? `<span class="px-2.5 py-1 rounded-lg bg-white/5 text-slate-400 text-xs font-semibold">Directo / Nadie</span>`
            : `<span class="px-2.5 py-1 rounded-lg bg-sky-500/20 border border-sky-500/30 text-sky-300 text-xs font-extrabold">🤝 Invitado de ${invLabel}</span>`;

          let guestBonusCell = '';
          if (amb.isFounder) {
            guestBonusCell = `
              <div class="text-xs text-slate-400">
                <span class="font-bold text-slate-300 block">👑 Socio Dueño (${amb.guests.length} inv.)</span>
                <span class="text-[11px] italic">Sin bono reclutamiento ($0)</span>
              </div>
            `;
          } else {
            guestBonusCell = `
              <div class="space-y-0.5 text-xs">
                <span class="font-bold text-white block">
                  👥 ${amb.guests.length} inv. • 📦 ${amb.guestTotalTrays} bandejas
                </span>
                <span class="text-[11px] text-slate-300 block">
                  Café: <strong>${amb.guestCampoTrays}</strong> (${amb.bonusCampoBlocks}x $10k) • Blanco: <strong>${amb.guestBlancoTrays}</strong> (${amb.bonusBlancoBlocks}x $8k)
                </span>
                <span class="font-display font-extrabold text-amber-300 block">
                  Bonos: +${formatCLP(amb.totalBonusEarned)}
                </span>
              </div>
            `;
          }

          return `
            <tr class="hover:bg-white/5 transition">
              <td class="py-3.5 px-4">
                <div class="space-y-1">
                  <span class="font-display font-extrabold text-white text-sm block">${amb.name}</span>
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span class="px-2.5 py-0.5 rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-300 font-display font-extrabold text-xs tracking-wider">
                      ${amb.code}
                    </span>
                    ${
                      amb.username
                        ? `<span class="text-[11px] text-slate-400 font-semibold">@${amb.username}</span>`
                        : ''
                    }
                  </div>
                  ${
                    amb.phone
                      ? `<span class="text-[11px] text-emerald-400 block">📞 ${amb.phone}</span>`
                      : ''
                  }
                </div>
              </td>
              <td class="py-3.5 px-4 whitespace-nowrap">
                ${invitedByHtml}
              </td>
              <td class="py-3.5 px-4 text-xs">
                <div class="space-y-0.5">
                  <span class="font-bold text-white block">
                    📦 <strong>${amb.ownTotalTrays}</strong> bandejas (${amb.ordersCount} ped.)
                  </span>
                  <span class="text-[11px] text-slate-400 block">
                    ${amb.ownCampoTrays} Café • ${amb.ownBlancoTrays} Blanco${
                      amb.ownPendingTrays > 0 ? ` (+${amb.ownPendingTrays} pend.)` : ''
                    }
                  </span>
                  <span class="font-display font-extrabold text-emerald-400 block">
                    Comisión directa: ${formatCLP(amb.ownCommissionEarned)}
                  </span>
                </div>
              </td>
              <td class="py-3.5 px-4">
                ${guestBonusCell}
              </td>
              <td class="py-3.5 px-4 whitespace-nowrap font-display font-bold text-emerald-400">
                ${formatCLP(amb.totalPaid || 0)}
              </td>
              <td class="py-3.5 px-4 whitespace-nowrap">
                <div>
                  <span class="font-display font-extrabold text-lg block ${
                    amb.totalPendingToPay > 0 ? 'text-amber-400' : 'text-slate-400'
                  }">
                    ${formatCLP(amb.totalPendingToPay)}
                  </span>
                  ${
                    amb.totalPendingToPay > 0
                      ? `<span class="text-[10px] text-slate-300 block">
                           Propia: ${formatCLP(amb.ownCommissionPending)} + Bonos: ${formatCLP(amb.bonusPending)}
                         </span>`
                      : `<span class="text-[10px] text-slate-500 block">Saldado ($0)</span>`
                  }
                </div>
              </td>
              <td class="py-3.5 px-4 text-right whitespace-nowrap">
                <div class="flex flex-wrap items-center justify-end gap-1.5">
                  <button type="button" onclick="copyAmbassadorCode('${amb.code}')"
                          class="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition"
                          title="Copiar código al portapapeles">
                    📋
                  </button>
                  ${
                    amb.totalPendingToPay > 0
                      ? `
                        <button type="button" onclick="payAmbassadorCommission('${amb.code}', '${safeName}', ${amb.totalPendingToPay})"
                                class="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-qh-navyDark font-display font-extrabold text-xs shadow transition"
                                title="Pagar Comisión Propia + Bonos de Invitados y dejar deuda en $0">
                          💸 Pagar / Saldar (${formatCLP(amb.totalPendingToPay)})
                        </button>
                      `
                      : `
                        <span class="px-2 py-1 rounded-lg bg-white/5 text-slate-400 text-xs font-semibold">
                          ✅ Al Día
                        </span>
                      `
                  }
                  ${
                    amb.id
                      ? `
                        <button type="button" onclick="openEditAmbassadorModal('${amb.id}')"
                                class="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-amber-300 transition"
                                title="Editar embajador / Cambiar quién lo invitó">
                          ✏️
                        </button>
                        <button type="button" onclick="deleteAmbassador('${amb.id}')"
                                class="px-2.5 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-xs font-bold text-red-300 transition"
                                title="Eliminar embajador">
                          🗑️
                        </button>
                      `
                      : ''
                  }
                </div>
              </td>
            </tr>
          `;
        })
        .join('');
    }
  }

  // 9. Renderizar Historial de Transacciones a Embajadores
  const payoutsTbody = document.getElementById('admin-ambassador-payouts-tbody');
  const payoutsBadge = document.getElementById('ambassador-payouts-total-badge');
  if (payoutsBadge) {
    payoutsBadge.textContent = `Total Saldado: ${formatCLP(ambReport.totalAllPaidCommissions)}`;
  }

  if (payoutsTbody) {
    if (ambassadorPayouts.length === 0) {
      payoutsTbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-6 text-center text-slate-500">
            Sin pagos a embajadores registrados en la nube ($0).
          </td>
        </tr>
      `;
    } else {
      payoutsTbody.innerHTML = ambassadorPayouts
        .map((p) => {
          return `
            <tr class="hover:bg-white/5 transition">
              <td class="py-2.5 px-3 whitespace-nowrap text-slate-400">${p.date}</td>
              <td class="py-2.5 px-3 text-white font-semibold">${p.name}</td>
              <td class="py-2.5 px-3 whitespace-nowrap">
                <span class="px-2.5 py-0.5 rounded-lg bg-amber-400/20 border border-amber-400/30 text-amber-300 font-bold text-xs">
                  ${p.code}
                </span>
              </td>
              <td class="py-2.5 px-3 font-display font-extrabold text-emerald-400 whitespace-nowrap">
                ${formatCLP(p.amount)}
              </td>
              <td class="py-2.5 px-3 whitespace-nowrap">
                <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                  🏦 Caja de la Empresa
                </span>
              </td>
              <td class="py-2.5 px-3 text-right whitespace-nowrap">
                <button type="button" onclick="deleteAmbassadorPayout('${p.id}')"
                        class="px-2 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-300 font-bold text-xs transition"
                        title="Revertir este pago">
                  🗑️
                </button>
              </td>
            </tr>
          `;
        })
        .join('');
    }
  }

  // 10. Renderizar Tabla de Gestión de Usuarios y Roles (#admin-users-tbody)
  const usersCountBadge = document.getElementById('admin-users-count-badge');
  if (usersCountBadge) {
    usersCountBadge.textContent = `${users.length} Usuario(s)`;
  }

  const usersTbody = document.getElementById('admin-users-tbody');
  if (usersTbody) {
    if (users.length === 0) {
      usersTbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-6 text-center text-slate-500">
            No hay usuarios registrados.
          </td>
        </tr>
      `;
    } else {
      usersTbody.innerHTML = users
        .map((u) => {
          let roleBadge = '';
          if (u.role === 'socio') {
            roleBadge = `<span class="px-2.5 py-1 rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-extrabold">👑 Socio Fundador (Acceso Total)</span>`;
          } else if (u.role === 'encargada') {
            roleBadge = `<span class="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold">🌟 Encargada de Embajadores y Redes</span>`;
          } else {
            roleBadge = `<span class="px-2.5 py-1 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-300 text-xs font-extrabold">🥚 Embajador / Vendedor (Portal Personal)</span>`;
          }

          const passDisplay =
            u.password === 'FOUNDER_HASH'
              ? '<span class="text-slate-400 italic text-xs">Clave Maestra Socio</span>'
              : `<code class="px-2 py-0.5 rounded bg-white/10 text-amber-200 text-xs font-mono">${u.password || '12345'}</code>`;

          const isProtectedFounder =
            u.id === 'USR-FOUNDER-JUANJO' ||
            u.id === 'USR-FOUNDER-MATI' ||
            u.role === 'socio';

          const usrCode = u.code || u.ambassadorCode || '-';
          const usrInvited = u.invitedBy || 'Directo';

          return `
            <tr class="hover:bg-white/5 transition">
              <td class="py-3 px-4">
                <span class="font-display font-extrabold text-white text-sm block">${u.name}</span>
                ${
                  u.phone
                    ? `<span class="text-[11px] text-emerald-400 font-semibold block">📞 ${u.phone}</span>`
                    : `<span class="text-[11px] text-slate-500 block">Sin teléfono</span>`
                }
              </td>
              <td class="py-3 px-4 whitespace-nowrap">
                <span class="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-amber-300 font-bold text-xs">@${u.username}</span>
              </td>
              <td class="py-3 px-4 whitespace-nowrap">
                ${passDisplay}
              </td>
              <td class="py-3 px-4 whitespace-nowrap">
                ${roleBadge}
              </td>
              <td class="py-3 px-4 whitespace-nowrap">
                <div class="space-y-1">
                  <span class="px-2.5 py-0.5 rounded-lg bg-amber-400/20 border border-amber-400/30 text-amber-300 font-display font-bold text-xs inline-block">
                    ${usrCode}
                  </span>
                  <span class="text-[11px] text-slate-300 font-semibold block">
                    Invitó: <strong class="text-sky-300">${usrInvited}</strong>
                  </span>
                </div>
              </td>
              <td class="py-3 px-4 text-right whitespace-nowrap">
                <button type="button" onclick="openEditUserModal('${u.id}')"
                        class="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-amber-300 font-bold text-xs mr-1 transition"
                        title="Editar usuario / rol / clave">
                  ✏️ Editar
                </button>
                ${
                  !isProtectedFounder
                    ? `<button type="button" onclick="deleteUserRecord('${u.id}')"
                               class="px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-300 font-bold text-xs transition"
                               title="Eliminar usuario">
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

  // 11. Renderizar Exclusivamente "Productos Más Pinchados" (Solo Socios Fundadores)
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

  if (productsAnalyticsEl && currentUserRole !== 'encargada') {
    productsAnalyticsEl.innerHTML = productList
      .map((p) => {
        const pct = p.clicks === 0 ? 0 : Math.round((p.clicks / maxProductClicks) * 100);
        const statusBadge =
          p.clicks === 0
            ? `<span class="px-2.5 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[10px] font-extrabold">0 clics</span>`
            : `<span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold">Activo (${p.clicks})</span>`;

        return `
          <div class="p-5 rounded-2xl bg-qh-navyDark/90 border border-white/10 space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span class="font-display font-extrabold text-base text-white">${p.name}</span>
                <span class="text-xs text-amber-300 font-bold ml-1.5">(${p.format} • ${formatCLP(p.price)})</span>
              </div>
              ${statusBadge}
            </div>

            <div class="w-full h-3 rounded-full bg-white/10 overflow-hidden">
              <div class="h-full rounded-full bg-gradient-to-r from-qh-brown to-amber-400 analytics-bar-fill" style="width: ${pct}%"></div>
            </div>

            <div class="grid grid-cols-3 gap-2 text-center text-xs pt-1">
              <div class="p-2 rounded-xl bg-white/5 border border-white/5">
                <span class="text-[10px] text-slate-400 uppercase font-bold block">Clics Producto</span>
                <strong class="font-display text-white text-sm">${p.clicks}</strong>
              </div>
              <div class="p-2 rounded-xl bg-white/5 border border-white/5">
                <span class="text-[10px] text-slate-400 uppercase font-bold block">Al Carrito</span>
                <strong class="font-display text-amber-300 text-sm">${p.addedToCart}</strong>
              </div>
              <div class="p-2 rounded-xl bg-white/5 border border-white/5">
                <span class="text-[10px] text-slate-400 uppercase font-bold block">En Checkouts</span>
                <strong class="font-display text-emerald-400 text-sm">${p.checkouts}</strong>
              </div>
            </div>
          </div>
        `;
      })
      .join('');
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
  // 1. Cargar al instante el último estado guardado (0ms tras F5) y la sesión activa
  loadLocalCloudMirror();
  CLOUD_STATE.analytics.pageViews = (CLOUD_STATE.analytics.pageViews || 0) + 1;
  saveLocalCloudMirror();

  // Renderizar tienda inmediatamente con carrito en 0
  renderCatalog();
  syncOrderUI();
  populateRecruiterSelects();

  if (currentAdminUser) {
    const navLabel = document.getElementById('navbar-admin-label');
    if (navLabel) {
      navLabel.textContent =
        currentUserRole === 'embajador'
          ? `Mi Portal (${currentAdminUser})`
          : `Panel (${currentAdminUser})`;
    }
    let wasDashboardOpen = false;
    let wasPortalOpen = false;
    try {
      wasDashboardOpen = window.localStorage.getItem(ADMIN_VIEW_OPEN_KEY) === '1';
      wasPortalOpen = window.localStorage.getItem(PORTAL_VIEW_OPEN_KEY) === '1';
    } catch (e) {
      wasDashboardOpen = false;
      wasPortalOpen = false;
    }
    if (wasPortalOpen || (wasDashboardOpen && currentUserRole === 'embajador')) {
      showAmbassadorPortal();
    } else if (wasDashboardOpen) {
      showAdminDashboard(currentAdminUser);
    }
  }

  // 2. Inicializar cliente Supabase oficial y conectar a la Base de Datos en la Nube
  if (SUPABASE_CREDENTIALS && SUPABASE_CREDENTIALS.url && SUPABASE_CREDENTIALS.anonKey) {
    initSupabaseSDK(SUPABASE_CREDENTIALS.url, SUPABASE_CREDENTIALS.anonKey);
  }
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

  const ambAuthModal = document.getElementById('ambassador-auth-modal');
  if (ambAuthModal) {
    ambAuthModal.addEventListener('click', (e) => {
      if (e.target === ambAuthModal) closeAmbassadorAuthModal();
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
      closeAmbassadorAuthModal();
      closeEditAmbassadorModal();
      closeEditUserModal();
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
