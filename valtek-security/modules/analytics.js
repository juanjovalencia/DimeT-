/**
 * ============================================================================
 * VALTEK SECURITY — Motor de Analíticas de Presencia en Tiempo Real
 * ============================================================================
 *
 * Módulo responsable de:
 *   - Gestión de usuarios enrolados (CRUD)
 *   - Registro de eventos de acceso (ingreso/salida)
 *   - Cálculo de métricas en tiempo real (población actual, KPIs)
 *   - Cola de sincronización offline
 *   - Persistencia en localStorage
 *   - Datos de demostración precargados
 *
 * @module Analytics
 * @version 1.0.0
 */

(function () {
  'use strict';

  // ==========================================================================
  // ESTRUCTURAS DE DATOS INTERNAS
  // ==========================================================================

  /** @type {Map<string, {name:string, run:string, phone:string, email:string, role:string, enrolledAt:string}>} */
  let enrolledUsers = new Map();

  /** @type {Array<{run:string, hito:string, timestamp:string, reader:string, relay:string}>} */
  let accessLog = [];

  /** @type {Array<{run:string, hito:string, timestamp:string, reader:string, relay:string}>} */
  let offlineQueue = [];

  /** @type {boolean} Estado de conexión (por defecto en línea) */
  let isOnline = true;

  // ==========================================================================
  // CONSTANTES
  // ==========================================================================

  /** Clave de almacenamiento local */
  const STORAGE_KEY = 'valtek_data';

  /** Hitos reconocidos por el sistema */
  const HITOS = {
    INGRESO_OFICIAL: 'Ingreso_Oficial',
    SALIDA_OFICIAL: 'Salida_Oficial',
    INGRESO_PERIMETRAL: 'Ingreso_Perimetral',
    SALIDA_PERIMETRAL: 'Salida_Perimetral',
  };

  // ==========================================================================
  // UTILIDADES INTERNAS
  // ==========================================================================

  /**
   * Formatea un objeto Date o string ISO a formato HH:MM:SS
   * @param {string|Date} timestamp - Marca de tiempo a formatear
   * @returns {string} Hora formateada como HH:MM:SS
   */
  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  /**
   * Verifica si un timestamp corresponde al día de hoy
   * @param {string} timestamp - Marca de tiempo ISO
   * @returns {boolean} true si es del día actual
   */
  function isToday(timestamp) {
    const eventDate = new Date(timestamp);
    const now = new Date();
    return (
      eventDate.getFullYear() === now.getFullYear() &&
      eventDate.getMonth() === now.getMonth() &&
      eventDate.getDate() === now.getDate()
    );
  }

  /**
   * Obtiene los eventos de hoy del accessLog
   * @returns {Array} Eventos filtrados del día actual
   */
  function filterTodayEvents() {
    return accessLog.filter((event) => isToday(event.timestamp));
  }

  /**
   * Normaliza un RUN eliminando puntos y convirtiendo a mayúsculas
   * @param {string} run - RUN a normalizar
   * @returns {string} RUN normalizado (ej: "12345678-5")
   */
  function normalizeRUN(run) {
    if (!run || typeof run !== 'string') return '';
    return run.replace(/\./g, '').trim().toUpperCase();
  }

  // ==========================================================================
  // 2. GESTIÓN DE USUARIOS
  // ==========================================================================

  /**
   * Enrola un nuevo usuario en el sistema.
   * Valida el RUN usando window.RUNValidator si está disponible.
   *
   * @param {Object} userData - Datos del usuario
   * @param {string} userData.name - Nombre completo
   * @param {string} userData.run - RUN chileno (ej: "12345678-5")
   * @param {string} userData.phone - Teléfono de contacto
   * @param {string} userData.email - Correo electrónico
   * @param {string} userData.role - Rol: Alumno, Docente, Administrativo, Apoderado
   * @returns {{success: boolean, user?: Object, error?: string}}
   */
  function enrollUser(userData) {
    try {
      // Validar campos requeridos
      if (!userData || !userData.name || !userData.run || !userData.role) {
        return {
          success: false,
          error: 'Campos requeridos faltantes: name, run y role son obligatorios.',
        };
      }

      const normalizedRUN = normalizeRUN(userData.run);

      // Validar RUN con el validador global si está disponible
      if (window.RUNValidator) {
        const validation = window.RUNValidator.validate
          ? window.RUNValidator.validate(normalizedRUN)
          : window.RUNValidator(normalizedRUN);

        // Soportar tanto booleano como objeto con propiedad 'valid'
        const isValid =
          typeof validation === 'boolean' ? validation : validation && validation.valid;

        if (!isValid) {
          return {
            success: false,
            error: `RUN inválido: ${normalizedRUN}. No pasa la validación del módulo 11.`,
          };
        }
      }

      // Verificar que no esté ya enrolado
      if (enrolledUsers.has(normalizedRUN)) {
        return {
          success: false,
          error: `El usuario con RUN ${normalizedRUN} ya está enrolado.`,
        };
      }

      // Crear objeto de usuario
      const user = {
        name: userData.name.trim(),
        run: normalizedRUN,
        phone: (userData.phone || '').trim(),
        email: (userData.email || '').trim(),
        role: userData.role.trim(),
        enrolledAt: new Date().toISOString(),
      };

      enrolledUsers.set(normalizedRUN, user);

      return { success: true, user: { ...user } };
    } catch (err) {
      return {
        success: false,
        error: `Error al enrolar usuario: ${err.message}`,
      };
    }
  }

  /**
   * Obtiene un usuario enrolado por su RUN
   * @param {string} run - RUN del usuario
   * @returns {Object|null} Datos del usuario o null si no existe
   */
  function getUser(run) {
    const normalized = normalizeRUN(run);
    const user = enrolledUsers.get(normalized);
    return user ? { ...user } : null;
  }

  /**
   * Obtiene todos los usuarios enrolados
   * @returns {Array<Object>} Lista de todos los usuarios
   */
  function getAllUsers() {
    return Array.from(enrolledUsers.values()).map((u) => ({ ...u }));
  }

  /**
   * Verifica si un RUN está enrolado en el sistema
   * @param {string} run - RUN a verificar
   * @returns {boolean} true si el usuario está enrolado
   */
  function isEnrolled(run) {
    return enrolledUsers.has(normalizeRUN(run));
  }

  /**
   * Elimina un usuario del sistema de enrolamiento
   * @param {string} run - RUN del usuario a eliminar
   * @returns {boolean} true si se eliminó correctamente
   */
  function removeUser(run) {
    return enrolledUsers.delete(normalizeRUN(run));
  }

  /**
   * Obtiene la cantidad total de usuarios enrolados
   * @returns {number} Total de usuarios enrolados
   */
  function getUserCount() {
    return enrolledUsers.size;
  }

  // ==========================================================================
  // 3. REGISTRO DE ACCESOS
  // ==========================================================================

  /**
   * Registra un evento de acceso (ingreso o salida).
   * Si el sistema está offline, el evento se encola para sincronización posterior.
   *
   * @param {string} run - RUN del usuario
   * @param {string} hito - Tipo de evento (Ingreso_Oficial, Salida_Oficial, etc.)
   * @param {string} reader - Identificador del lector RFID/NFC
   * @param {string} relay - Identificador del relé activado
   * @returns {{success: boolean, event?: Object, queued?: boolean, error?: string}}
   */
  function logAccess(run, hito, reader, relay) {
    try {
      if (!run || !hito) {
        return {
          success: false,
          error: 'RUN y hito son obligatorios para registrar un acceso.',
        };
      }

      const event = {
        run: normalizeRUN(run),
        hito: hito,
        timestamp: new Date().toISOString(),
        reader: reader || 'READER_DEFAULT',
        relay: relay || 'RELAY_DEFAULT',
      };

      if (!isOnline) {
        // Encolar para sincronización posterior
        offlineQueue.push(event);
        return { success: true, event: { ...event }, queued: true };
      }

      accessLog.push(event);
      return { success: true, event: { ...event }, queued: false };
    } catch (err) {
      return {
        success: false,
        error: `Error al registrar acceso: ${err.message}`,
      };
    }
  }

  /**
   * Obtiene el registro de accesos, opcionalmente filtrado.
   *
   * @param {Object} [filters] - Filtros opcionales
   * @param {string} [filters.run] - Filtrar por RUN
   * @param {string} [filters.date] - Filtrar por fecha (formato YYYY-MM-DD)
   * @param {string} [filters.hito] - Filtrar por tipo de hito
   * @returns {Array<Object>} Eventos de acceso filtrados
   */
  function getAccessLog(filters) {
    let results = [...accessLog];

    if (!filters) return results;

    if (filters.run) {
      const normalizedRUN = normalizeRUN(filters.run);
      results = results.filter((e) => e.run === normalizedRUN);
    }

    if (filters.date) {
      const targetDate = filters.date; // Formato esperado: YYYY-MM-DD
      results = results.filter((e) => {
        const eventDate = new Date(e.timestamp).toISOString().split('T')[0];
        return eventDate === targetDate;
      });
    }

    if (filters.hito) {
      results = results.filter((e) => e.hito === filters.hito);
    }

    return results;
  }

  /**
   * Obtiene exclusivamente los eventos de acceso del día actual
   * @returns {Array<Object>} Eventos de hoy
   */
  function getTodayLog() {
    return filterTodayEvents().map((e) => ({ ...e }));
  }

  // ==========================================================================
  // 4. ANALÍTICAS EN TIEMPO REAL
  // ==========================================================================

  /**
   * Calcula la población actual dentro del colegio.
   * Cuenta los usuarios cuyo último hito es 'Ingreso_Oficial' sin un
   * 'Salida_Oficial' posterior. Representa las personas físicamente
   * DENTRO del colegio en este momento.
   *
   * @returns {number} Cantidad de personas actualmente dentro del colegio
   */
  function getPopulacionActual() {
    const todayEvents = filterTodayEvents();

    // Agrupar eventos por RUN y determinar último hito oficial
    const lastHitoByRUN = new Map();

    for (const event of todayEvents) {
      if (
        event.hito === HITOS.INGRESO_OFICIAL ||
        event.hito === HITOS.SALIDA_OFICIAL
      ) {
        const existing = lastHitoByRUN.get(event.run);
        if (!existing || new Date(event.timestamp) > new Date(existing.timestamp)) {
          lastHitoByRUN.set(event.run, event);
        }
      }
    }

    // Contar quienes tienen como último hito un ingreso oficial
    let count = 0;
    for (const [, lastEvent] of lastHitoByRUN) {
      if (lastEvent.hito === HITOS.INGRESO_OFICIAL) {
        count++;
      }
    }

    return count;
  }

  /**
   * Cuenta el total acumulado de RUNs únicos que registraron un 'Ingreso_Oficial' hoy
   * @returns {number} Total de personas que ingresaron hoy
   */
  function getTotalIngresados() {
    const todayEvents = filterTodayEvents();
    const runsIngresados = new Set();

    for (const event of todayEvents) {
      if (event.hito === HITOS.INGRESO_OFICIAL) {
        runsIngresados.add(event.run);
      }
    }

    return runsIngresados.size;
  }

  /**
   * Cuenta el total acumulado de RUNs únicos que registraron una 'Salida_Oficial' hoy
   * @returns {number} Total de personas que salieron hoy
   */
  function getTotalEgresados() {
    const todayEvents = filterTodayEvents();
    const runsEgresados = new Set();

    for (const event of todayEvents) {
      if (event.hito === HITOS.SALIDA_OFICIAL) {
        runsEgresados.add(event.run);
      }
    }

    return runsEgresados.size;
  }

  /**
   * Igual que getPopulacionActual pero incluye también la zona perimetral.
   * Considera Ingreso_Oficial, Ingreso_Perimetral como "dentro" y
   * Salida_Oficial, Salida_Perimetral como "fuera".
   *
   * @returns {number} Total de personas en el recinto (incluyendo zona perimetral)
   */
  function getEnRecintoTotal() {
    const todayEvents = filterTodayEvents();
    const hitosIngreso = [HITOS.INGRESO_OFICIAL, HITOS.INGRESO_PERIMETRAL];
    const hitosSalida = [HITOS.SALIDA_OFICIAL, HITOS.SALIDA_PERIMETRAL];
    const allHitos = [...hitosIngreso, ...hitosSalida];

    // Agrupar último hito relevante por RUN
    const lastHitoByRUN = new Map();

    for (const event of todayEvents) {
      if (allHitos.includes(event.hito)) {
        const existing = lastHitoByRUN.get(event.run);
        if (!existing || new Date(event.timestamp) > new Date(existing.timestamp)) {
          lastHitoByRUN.set(event.run, event);
        }
      }
    }

    let count = 0;
    for (const [, lastEvent] of lastHitoByRUN) {
      if (hitosIngreso.includes(lastEvent.hito)) {
        count++;
      }
    }

    return count;
  }

  /**
   * Genera la matriz de datos para la tabla del dashboard.
   * Para cada usuario con actividad hoy, retorna su hora de entrada,
   * hora de salida y estado actual.
   *
   * @returns {Array<{name:string, run:string, horaEntrada:string, horaSalida:string, estadoActual:string}>}
   */
  function getUserDayMatrix() {
    const todayEvents = filterTodayEvents();

    // Agrupar eventos de hoy por RUN
    const eventsByRUN = new Map();
    for (const event of todayEvents) {
      if (
        event.hito === HITOS.INGRESO_OFICIAL ||
        event.hito === HITOS.SALIDA_OFICIAL
      ) {
        if (!eventsByRUN.has(event.run)) {
          eventsByRUN.set(event.run, []);
        }
        eventsByRUN.get(event.run).push(event);
      }
    }

    const matrix = [];

    for (const [run, events] of eventsByRUN) {
      // Ordenar eventos cronológicamente
      events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Primer Ingreso_Oficial del día
      const primerIngreso = events.find((e) => e.hito === HITOS.INGRESO_OFICIAL);
      // Última Salida_Oficial del día
      const salidasOficiales = events.filter((e) => e.hito === HITOS.SALIDA_OFICIAL);
      const ultimaSalida =
        salidasOficiales.length > 0
          ? salidasOficiales[salidasOficiales.length - 1]
          : null;

      // Determinar estado actual: último evento
      const ultimoEvento = events[events.length - 1];
      const estadoActual =
        ultimoEvento.hito === HITOS.INGRESO_OFICIAL
          ? 'DENTRO DEL COLEGIO'
          : 'FUERA DEL COLEGIO';

      // Obtener nombre del usuario enrolado
      const user = enrolledUsers.get(run);
      const name = user ? user.name : `Desconocido (${run})`;

      matrix.push({
        name: name,
        run: run,
        horaEntrada: primerIngreso ? formatTime(primerIngreso.timestamp) : '--:--:--',
        horaSalida: ultimaSalida ? formatTime(ultimaSalida.timestamp) : '--:--:--',
        estadoActual: estadoActual,
      });
    }

    // Ordenar por nombre para presentación consistente
    matrix.sort((a, b) => a.name.localeCompare(b.name));

    return matrix;
  }

  /**
   * Retorna todas las métricas KPI del dashboard en un solo objeto
   *
   * @returns {{poblacionActual:number, totalIngresados:number, totalEgresados:number, enRecintoTotal:number, timestamp:string}}
   */
  function getDashboardMetrics() {
    return {
      poblacionActual: getPopulacionActual(),
      totalIngresados: getTotalIngresados(),
      totalEgresados: getTotalEgresados(),
      enRecintoTotal: getEnRecintoTotal(),
      timestamp: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // 5. SINCRONIZACIÓN OFFLINE
  // ==========================================================================

  /**
   * Establece el estado de conexión del sistema
   * @param {boolean} status - true = en línea, false = offline
   */
  function setOnlineStatus(status) {
    isOnline = Boolean(status);
  }

  /**
   * Obtiene la cantidad de eventos pendientes en la cola offline
   * @returns {number} Cantidad de eventos en cola
   */
  function getOfflineQueueSize() {
    return offlineQueue.length;
  }

  /**
   * Procesa la cola de eventos offline, simulando una subida por lotes.
   * Cada evento se transfiere al accessLog con un pequeño delay simulado.
   *
   * @param {Function} [onProgress] - Callback de progreso: (processed, total) => void
   * @returns {Promise<{success: boolean, processed: number, errors: number}>}
   */
  async function syncOfflineQueue(onProgress) {
    if (offlineQueue.length === 0) {
      return { success: true, processed: 0, errors: 0 };
    }

    const total = offlineQueue.length;
    let processed = 0;
    let errors = 0;

    // Procesar cada evento de la cola
    while (offlineQueue.length > 0) {
      const event = offlineQueue.shift();

      try {
        // Simular latencia de red (50-150ms por evento)
        await new Promise((resolve) =>
          setTimeout(resolve, 50 + Math.random() * 100)
        );

        accessLog.push(event);
        processed++;
      } catch (err) {
        errors++;
        console.error(`[Analytics] Error sincronizando evento: ${err.message}`);
      }

      // Notificar progreso
      if (typeof onProgress === 'function') {
        onProgress(processed + errors, total);
      }
    }

    return { success: errors === 0, processed, errors };
  }

  /**
   * Obtiene el estado actual de conexión
   * @returns {boolean} true si está en línea
   */
  function getOnlineStatus() {
    return isOnline;
  }

  // ==========================================================================
  // 6. PERSISTENCIA
  // ==========================================================================

  /**
   * Guarda los datos de usuarios enrolados y el registro de accesos
   * en localStorage bajo la clave 'valtek_data'
   * @returns {boolean} true si se guardó correctamente
   */
  function saveToLocalStorage() {
    try {
      const data = {
        enrolledUsers: Array.from(enrolledUsers.entries()),
        accessLog: accessLog,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      console.error(`[Analytics] Error guardando en localStorage: ${err.message}`);
      return false;
    }
  }

  /**
   * Carga los datos desde localStorage y restaura las estructuras internas
   * @returns {boolean} true si se cargó correctamente
   */
  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;

      const data = JSON.parse(raw);

      // Restaurar enrolledUsers desde array de entries
      if (Array.isArray(data.enrolledUsers)) {
        enrolledUsers = new Map(data.enrolledUsers);
      }

      // Restaurar accessLog
      if (Array.isArray(data.accessLog)) {
        accessLog = data.accessLog;
      }

      return true;
    } catch (err) {
      console.error(`[Analytics] Error cargando desde localStorage: ${err.message}`);
      return false;
    }
  }

  /**
   * Exporta todos los datos del sistema como cadena JSON
   * @returns {string} Representación JSON de todos los datos
   */
  function exportData() {
    const data = {
      enrolledUsers: Array.from(enrolledUsers.entries()),
      accessLog: accessLog,
      offlineQueue: offlineQueue,
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Importa datos desde una cadena JSON, reemplazando los datos actuales
   * @param {string} jsonString - Cadena JSON con los datos a importar
   * @returns {{success: boolean, error?: string}}
   */
  function importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);

      if (Array.isArray(data.enrolledUsers)) {
        enrolledUsers = new Map(data.enrolledUsers);
      }

      if (Array.isArray(data.accessLog)) {
        accessLog = data.accessLog;
      }

      if (Array.isArray(data.offlineQueue)) {
        offlineQueue = data.offlineQueue;
      }

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: `Error importando datos: ${err.message}`,
      };
    }
  }

  // ==========================================================================
  // 7. DATOS DE DEMOSTRACIÓN
  // ==========================================================================

  /**
   * Carga datos de demostración con usuarios chilenos reales y eventos
   * de acceso simulados para el día actual. Genera escenarios realistas:
   *   - Al menos 3 usuarios actualmente DENTRO del colegio
   *   - Al menos 2 usuarios con ciclo completo ingreso+salida
   *   - Variedad de roles y horarios
   */
  function loadDemoData() {
    // Limpiar datos existentes
    enrolledUsers.clear();
    accessLog = [];
    offlineQueue = [];

    // ── Usuarios de demostración ──────────────────────────────────────────
    const demoUsers = [
      {
        name: 'Juan Pérez González',
        run: '12345678-5',
        phone: '+56 9 1234 5678',
        email: 'juan.perez@colegio.cl',
        role: 'Alumno',
      },
      {
        name: 'Ana Gómez Rojas',
        run: '23456789-0',
        phone: '+56 9 2345 6789',
        email: 'ana.gomez@colegio.cl',
        role: 'Docente',
      },
      {
        name: 'Carlos Muñoz Soto',
        run: '11111111-1',
        phone: '+56 9 3456 7890',
        email: 'carlos.munoz@colegio.cl',
        role: 'Administrativo',
      },
      {
        name: 'María Fernanda López',
        run: '9876543-K',
        phone: '+56 9 4567 8901',
        email: 'maria.lopez@colegio.cl',
        role: 'Apoderado',
      },
      {
        name: 'Diego Alejandro Ruiz',
        run: '15432879-5',
        phone: '+56 9 5678 9012',
        email: 'diego.ruiz@colegio.cl',
        role: 'Alumno',
      },
      {
        name: 'Catalina Herrera Pinto',
        run: '18765432-3',
        phone: '+56 9 6789 0123',
        email: 'catalina.herrera@colegio.cl',
        role: 'Docente',
      },
      {
        name: 'Roberto Andrés Silva',
        run: '20123456-7',
        phone: '+56 9 7890 1234',
        email: 'roberto.silva@colegio.cl',
        role: 'Alumno',
      },
      {
        name: 'Francisca Alejandra Díaz',
        run: '14567890-K',
        phone: '+56 9 8901 2345',
        email: 'francisca.diaz@colegio.cl',
        role: 'Administrativo',
      },
    ];

    // Enrolar usuarios directamente (sin validación externa para demo)
    for (const userData of demoUsers) {
      const user = {
        name: userData.name,
        run: normalizeRUN(userData.run),
        phone: userData.phone,
        email: userData.email,
        role: userData.role,
        enrolledAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Hace 30 días
      };
      enrolledUsers.set(user.run, user);
    }

    // ── Eventos de acceso de hoy ──────────────────────────────────────────
    // Función helper para crear timestamps de hoy a una hora específica
    const todayAt = (hours, minutes, seconds = 0) => {
      const d = new Date();
      d.setHours(hours, minutes, seconds, 0);
      return d.toISOString();
    };

    // Escenario 1: Juan Pérez — DENTRO DEL COLEGIO (ingresó a las 07:45)
    accessLog.push({
      run: '12345678-5',
      hito: HITOS.INGRESO_OFICIAL,
      timestamp: todayAt(7, 45, 12),
      reader: 'READER_PUERTA_PRINCIPAL',
      relay: 'RELAY_01',
    });

    // Escenario 2: Ana Gómez — DENTRO DEL COLEGIO (ingresó a las 07:30)
    accessLog.push({
      run: '23456789-0',
      hito: HITOS.INGRESO_OFICIAL,
      timestamp: todayAt(7, 30, 5),
      reader: 'READER_PUERTA_PRINCIPAL',
      relay: 'RELAY_01',
    });

    // Escenario 3: Carlos Muñoz — CICLO COMPLETO (ingresó 07:15, salió 09:30)
    accessLog.push({
      run: '11111111-1',
      hito: HITOS.INGRESO_OFICIAL,
      timestamp: todayAt(7, 15, 0),
      reader: 'READER_PUERTA_PRINCIPAL',
      relay: 'RELAY_01',
    });
    accessLog.push({
      run: '11111111-1',
      hito: HITOS.SALIDA_OFICIAL,
      timestamp: todayAt(9, 30, 45),
      reader: 'READER_PUERTA_PRINCIPAL',
      relay: 'RELAY_01',
    });

    // Escenario 4: María López — CICLO COMPLETO (ingresó 08:00, salió 08:45)
    // Apoderada que dejó al alumno y se fue
    accessLog.push({
      run: '9876543-K',
      hito: HITOS.INGRESO_OFICIAL,
      timestamp: todayAt(8, 0, 22),
      reader: 'READER_PUERTA_LATERAL',
      relay: 'RELAY_02',
    });
    accessLog.push({
      run: '9876543-K',
      hito: HITOS.SALIDA_OFICIAL,
      timestamp: todayAt(8, 45, 10),
      reader: 'READER_PUERTA_LATERAL',
      relay: 'RELAY_02',
    });

    // Escenario 5: Diego Ruiz — DENTRO DEL COLEGIO (ingresó a las 07:55)
    accessLog.push({
      run: '15432879-5',
      hito: HITOS.INGRESO_OFICIAL,
      timestamp: todayAt(7, 55, 33),
      reader: 'READER_PUERTA_PRINCIPAL',
      relay: 'RELAY_01',
    });

    // Escenario 6: Catalina Herrera — DENTRO DEL COLEGIO (ingresó 07:20)
    // Docente que salió brevemente y reingresó
    accessLog.push({
      run: '18765432-3',
      hito: HITOS.INGRESO_OFICIAL,
      timestamp: todayAt(7, 20, 15),
      reader: 'READER_PUERTA_PRINCIPAL',
      relay: 'RELAY_01',
    });
    accessLog.push({
      run: '18765432-3',
      hito: HITOS.SALIDA_OFICIAL,
      timestamp: todayAt(9, 0, 0),
      reader: 'READER_PUERTA_PRINCIPAL',
      relay: 'RELAY_01',
    });
    accessLog.push({
      run: '18765432-3',
      hito: HITOS.INGRESO_OFICIAL,
      timestamp: todayAt(9, 15, 30),
      reader: 'READER_PUERTA_PRINCIPAL',
      relay: 'RELAY_01',
    });

    // Escenario 7: Roberto Silva — DENTRO DEL COLEGIO (ingresó 08:10)
    accessLog.push({
      run: '20123456-7',
      hito: HITOS.INGRESO_OFICIAL,
      timestamp: todayAt(8, 10, 5),
      reader: 'READER_PUERTA_PRINCIPAL',
      relay: 'RELAY_01',
    });

    // Escenario 8: Francisca Díaz — Sin eventos hoy (no ha venido)
    // (Enrolada pero sin actividad — no aparecerá en getUserDayMatrix)

    // Ordenar accessLog cronológicamente
    accessLog.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    console.log('[Analytics] Datos de demostración cargados correctamente.');
    console.log(`[Analytics] Usuarios enrolados: ${enrolledUsers.size}`);
    console.log(`[Analytics] Eventos de acceso: ${accessLog.length}`);
    console.log(`[Analytics] Población actual: ${getPopulacionActual()}`);

    return {
      usersLoaded: enrolledUsers.size,
      eventsLoaded: accessLog.length,
      poblacionActual: getPopulacionActual(),
      totalIngresados: getTotalIngresados(),
      totalEgresados: getTotalEgresados(),
    };
  }

  // ==========================================================================
  // EXPORTACIÓN PÚBLICA — window.Analytics
  // ==========================================================================

  window.Analytics = {
    // Gestión de usuarios
    enrollUser,
    getUser,
    getAllUsers,
    isEnrolled,
    removeUser,
    getUserCount,

    // Registro de accesos
    logAccess,
    getAccessLog,
    getTodayLog,

    // Analíticas en tiempo real
    getPopulacionActual,
    getTotalIngresados,
    getTotalEgresados,
    getEnRecintoTotal,
    getUserDayMatrix,
    getDashboardMetrics,

    // Sincronización offline
    setOnlineStatus,
    getOfflineQueueSize,
    syncOfflineQueue,
    getOnlineStatus,

    // Persistencia
    saveToLocalStorage,
    loadFromLocalStorage,
    exportData,
    importData,

    // Datos de demostración
    loadDemoData,

    // Constantes expuestas (solo lectura)
    HITOS: Object.freeze({ ...HITOS }),
  };

  console.log('[Analytics] Módulo de analíticas cargado correctamente.');
})();
