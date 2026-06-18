/**
 * relay-simulator.js
 * Módulo simulador del controlador de relays de hardware
 * para el sistema de control de acceso escolar.
 *
 * Simula un controlador ZKTeco inBio-260 con relays,
 * lectoras Wiegand, sensores de puerta y lógica anti-passback.
 *
 * @module RelaySimulator
 */

// ─────────────────────────────────────────────
// Definiciones de Relays
// ─────────────────────────────────────────────

/**
 * Mapa de relays del sistema.
 * Cada relay controla un punto de acceso físico.
 * @type {Object.<string, {id: number, name: string, state: boolean, pulseTimeout: number|null}>}
 */
const RELAYS = {
  RELAY_1: { id: 1, name: 'Portón Exterior', state: false, pulseTimeout: null },
  RELAY_2: { id: 2, name: 'Torniquete Entrada', state: false, pulseTimeout: null },
  RELAY_3: { id: 3, name: 'Torniquete Salida', state: false, pulseTimeout: null }
};

// ─────────────────────────────────────────────
// Definiciones de Lectoras
// ─────────────────────────────────────────────

/**
 * Mapa de lectoras del sistema.
 * Cada lectora está asociada a un relay y define un hito de registro.
 * @type {Object.<string, {id: number, name: string, relay: string, hito: string, direction: string}>}
 */
const READERS = {
  L1: { id: 1, name: 'Entrada Portón Exterior', relay: 'RELAY_1', hito: 'Ingreso_Perimetral', direction: 'IN' },
  L2: { id: 2, name: 'Salida Portón Exterior', relay: 'RELAY_1', hito: 'Salida_Definitiva', direction: 'OUT' },
  L3: { id: 3, name: 'Entrada Torniquete Interior', relay: 'RELAY_2', hito: 'Ingreso_Oficial', direction: 'IN' },
  L4: { id: 4, name: 'Salida Torniquete Interior', relay: 'RELAY_3', hito: 'Salida_Oficial', direction: 'OUT' }
};

// ─────────────────────────────────────────────
// Configuración del Controlador
// ─────────────────────────────────────────────

/**
 * Configuración de red y modelo del controlador simulado.
 * @type {{ip: string, subnet: string, gateway: string, port: number, protocol: string, connected: boolean, model: string}}
 */
let controllerConfig = {
  ip: '192.168.1.200',
  subnet: '255.255.255.0',
  gateway: '192.168.1.1',
  port: 4370,
  protocol: 'Wiegand',
  connected: true,
  model: 'ZKTeco inBio-260'
};

// ─────────────────────────────────────────────
// Callbacks de Eventos
// ─────────────────────────────────────────────

/**
 * Callback invocado cuando un relay se activa.
 * @type {Function|null}
 * @param {number} relayId - ID del relay activado
 */
let onRelayActivate = null;

/**
 * Callback invocado cuando un relay se desactiva.
 * @type {Function|null}
 * @param {number} relayId - ID del relay desactivado
 */
let onRelayDeactivate = null;

/**
 * Callback invocado cuando un escaneo ha sido procesado completamente.
 * @type {Function|null}
 * @param {Object} result - Resultado del procesamiento del escaneo
 */
let onScanProcessed = null;

/**
 * Callback invocado en alertas de anti-passback u otras.
 * @type {Function|null}
 * @param {Object} alert - Información de la alerta generada
 */
let onAlert = null;

/**
 * Callback invocado cuando la puerta genera una alarma por apertura prolongada.
 * @type {Function|null}
 * @param {Object} sensorState - Estado actual del sensor de puerta
 */
let onDoorAlarm = null;

// ─────────────────────────────────────────────
// Estado del Sensor de Puerta
// ─────────────────────────────────────────────

/**
 * Estado simulado del sensor magnético de puerta.
 * @type {{isOpen: boolean, openSince: number|null, alarmTriggered: boolean}}
 */
let doorSensorState = {
  isOpen: false,
  openSince: null,
  alarmTriggered: false
};

/** Umbral en milisegundos para disparar alarma de puerta abierta (60 segundos). */
const DOOR_ALARM_THRESHOLD_MS = 60000;

/** Intervalo interno que vigila el estado del sensor de puerta. */
let _doorCheckInterval = null;

// ─────────────────────────────────────────────
// Funciones de Relays
// ─────────────────────────────────────────────

/**
 * Busca la clave del relay por su ID numérico.
 * @param {number} relayId - ID del relay a buscar
 * @returns {string|null} Clave del relay (ej. 'RELAY_1') o null si no existe
 * @private
 */
function _findRelayKey(relayId) {
  return Object.keys(RELAYS).find((key) => RELAYS[key].id === relayId) || null;
}

/**
 * Busca la clave de la lectora por su ID numérico.
 * @param {number} readerId - ID de la lectora a buscar
 * @returns {string|null} Clave de la lectora (ej. 'L1') o null si no existe
 * @private
 */
function _findReaderKey(readerId) {
  return Object.keys(READERS).find((key) => READERS[key].id === readerId) || null;
}

/**
 * Activa un relay por un pulso de duración determinada y luego lo desactiva.
 * Dispara los callbacks onRelayActivate y onRelayDeactivate.
 *
 * @param {number} relayId - ID numérico del relay a activar
 * @param {number} [durationMs=3000] - Duración del pulso en milisegundos
 * @returns {Promise<{relayId: number, name: string, activatedAt: number, deactivatedAt: number}>}
 *   Promesa que se resuelve cuando el pulso se completa
 * @throws {Error} Si el relay no existe o el controlador no está conectado
 */
function activateRelay(relayId, durationMs = 3000) {
  return new Promise((resolve, reject) => {
    if (!controllerConfig.connected) {
      return reject(new Error('Controlador no conectado. No se puede activar el relay.'));
    }

    const key = _findRelayKey(relayId);
    if (!key) {
      return reject(new Error(`Relay con ID ${relayId} no encontrado.`));
    }

    const relay = RELAYS[key];

    // Cancelar timeout previo si hay un pulso activo
    if (relay.pulseTimeout !== null) {
      clearTimeout(relay.pulseTimeout);
      relay.pulseTimeout = null;
    }

    // Activar el relay
    relay.state = true;
    const activatedAt = Date.now();

    if (typeof onRelayActivate === 'function') {
      try {
        onRelayActivate(relayId);
      } catch (err) {
        console.error(`[RelaySimulator] Error en callback onRelayActivate: ${err.message}`);
      }
    }

    console.log(`[RelaySimulator] Relay ${relay.name} (ID: ${relayId}) ACTIVADO por ${durationMs}ms`);

    // Programar desactivación tras la duración del pulso
    relay.pulseTimeout = setTimeout(() => {
      relay.state = false;
      relay.pulseTimeout = null;
      const deactivatedAt = Date.now();

      if (typeof onRelayDeactivate === 'function') {
        try {
          onRelayDeactivate(relayId);
        } catch (err) {
          console.error(`[RelaySimulator] Error en callback onRelayDeactivate: ${err.message}`);
        }
      }

      console.log(`[RelaySimulator] Relay ${relay.name} (ID: ${relayId}) DESACTIVADO`);

      resolve({
        relayId,
        name: relay.name,
        activatedAt,
        deactivatedAt
      });
    }, durationMs);
  });
}

/**
 * Procesa el escaneo de una lectora. Verifica enrolamiento,
 * valida anti-passback y activa el relay correspondiente.
 *
 * @param {number} readerId - ID de la lectora donde se realizó el escaneo
 * @param {string} run - RUN (identificador) de la persona escaneada
 * @returns {Promise<{success: boolean, reader: Object, relay: Object, hito: string, timestamp: number, message: string}>}
 *   Resultado del procesamiento del escaneo
 */
async function processReaderScan(readerId, run) {
  const timestamp = Date.now();

  // Buscar la lectora
  const readerKey = _findReaderKey(readerId);
  if (!readerKey) {
    const result = {
      success: false,
      reader: null,
      relay: null,
      hito: null,
      timestamp,
      message: `Lectora con ID ${readerId} no encontrada.`
    };
    _fireScanProcessed(result);
    return result;
  }

  const reader = READERS[readerKey];
  const relayKey = reader.relay;
  const relay = RELAYS[relayKey];

  // Verificar conexión del controlador
  if (!controllerConfig.connected) {
    const result = {
      success: false,
      reader: { ...reader },
      relay: { id: relay.id, name: relay.name },
      hito: reader.hito,
      timestamp,
      message: 'Controlador no conectado. Acceso denegado.'
    };
    _fireScanProcessed(result);
    return result;
  }

  // Verificar enrolamiento usando window.EnrollmentDB si está disponible
  let isEnrolled = true; // Por defecto permitir si no hay DB de enrolamiento
  if (typeof window !== 'undefined' && window.EnrollmentDB) {
    try {
      const persona = window.EnrollmentDB.getByRun
        ? window.EnrollmentDB.getByRun(run)
        : null;
      isEnrolled = persona !== null && persona !== undefined;
    } catch (err) {
      console.warn(`[RelaySimulator] Error verificando enrolamiento: ${err.message}`);
      isEnrolled = false;
    }
  }

  if (!isEnrolled) {
    const result = {
      success: false,
      reader: { ...reader },
      relay: { id: relay.id, name: relay.name },
      hito: reader.hito,
      timestamp,
      message: `RUN ${run} no está enrolado en el sistema. Acceso denegado.`
    };
    _fireAlert({
      type: 'NO_ENROLADO',
      run,
      reader: reader.name,
      timestamp,
      message: result.message
    });
    _fireScanProcessed(result);
    return result;
  }

  // Validar anti-passback
  if (typeof window !== 'undefined' && window.AntiPassback) {
    try {
      const apValidation = window.AntiPassback.validate
        ? window.AntiPassback.validate(run, reader.direction, reader.hito)
        : { allowed: true };

      if (!apValidation.allowed) {
        const result = {
          success: false,
          reader: { ...reader },
          relay: { id: relay.id, name: relay.name },
          hito: reader.hito,
          timestamp,
          message: apValidation.message || `Anti-passback: acceso denegado para RUN ${run} en ${reader.name}.`
        };
        _fireAlert({
          type: 'ANTI_PASSBACK',
          run,
          reader: reader.name,
          direction: reader.direction,
          timestamp,
          message: result.message
        });
        _fireScanProcessed(result);
        return result;
      }
    } catch (err) {
      console.warn(`[RelaySimulator] Error validando anti-passback: ${err.message}`);
    }
  }

  // Todo OK: activar el relay correspondiente
  try {
    await activateRelay(relay.id);

    const result = {
      success: true,
      reader: { ...reader },
      relay: { id: relay.id, name: relay.name },
      hito: reader.hito,
      timestamp,
      message: `Acceso concedido para RUN ${run} en ${reader.name}. Relay ${relay.name} activado.`
    };
    _fireScanProcessed(result);
    return result;
  } catch (err) {
    const result = {
      success: false,
      reader: { ...reader },
      relay: { id: relay.id, name: relay.name },
      hito: reader.hito,
      timestamp,
      message: `Error activando relay: ${err.message}`
    };
    _fireScanProcessed(result);
    return result;
  }
}

/**
 * Fuerza la apertura de un relay (para pruebas).
 * El relay permanece abierto hasta que se llame a forceCloseRelay.
 *
 * @param {number} relayId - ID del relay a forzar apertura
 * @returns {{success: boolean, relayId: number, message: string}}
 */
function forceOpenRelay(relayId) {
  const key = _findRelayKey(relayId);
  if (!key) {
    return { success: false, relayId, message: `Relay con ID ${relayId} no encontrado.` };
  }

  const relay = RELAYS[key];

  // Cancelar cualquier pulso activo
  if (relay.pulseTimeout !== null) {
    clearTimeout(relay.pulseTimeout);
    relay.pulseTimeout = null;
  }

  relay.state = true;

  if (typeof onRelayActivate === 'function') {
    try {
      onRelayActivate(relayId);
    } catch (err) {
      console.error(`[RelaySimulator] Error en callback onRelayActivate: ${err.message}`);
    }
  }

  console.log(`[RelaySimulator] Relay ${relay.name} (ID: ${relayId}) FORZADO ABIERTO`);
  return { success: true, relayId, message: `Relay ${relay.name} forzado abierto.` };
}

/**
 * Fuerza el cierre de un relay previamente forzado abierto.
 *
 * @param {number} relayId - ID del relay a cerrar
 * @returns {{success: boolean, relayId: number, message: string}}
 */
function forceCloseRelay(relayId) {
  const key = _findRelayKey(relayId);
  if (!key) {
    return { success: false, relayId, message: `Relay con ID ${relayId} no encontrado.` };
  }

  const relay = RELAYS[key];

  // Cancelar cualquier pulso activo
  if (relay.pulseTimeout !== null) {
    clearTimeout(relay.pulseTimeout);
    relay.pulseTimeout = null;
  }

  relay.state = false;

  if (typeof onRelayDeactivate === 'function') {
    try {
      onRelayDeactivate(relayId);
    } catch (err) {
      console.error(`[RelaySimulator] Error en callback onRelayDeactivate: ${err.message}`);
    }
  }

  console.log(`[RelaySimulator] Relay ${relay.name} (ID: ${relayId}) FORZADO CERRADO`);
  return { success: true, relayId, message: `Relay ${relay.name} forzado cerrado.` };
}

/**
 * Obtiene el estado actual de un relay específico.
 *
 * @param {number} relayId - ID del relay a consultar
 * @returns {{id: number, name: string, state: boolean, hasPulseActive: boolean}|null}
 *   Estado del relay o null si no existe
 */
function getRelayState(relayId) {
  const key = _findRelayKey(relayId);
  if (!key) {
    return null;
  }

  const relay = RELAYS[key];
  return {
    id: relay.id,
    name: relay.name,
    state: relay.state,
    hasPulseActive: relay.pulseTimeout !== null
  };
}

/**
 * Obtiene el estado de todos los relays del sistema.
 *
 * @returns {Array<{id: number, name: string, state: boolean, hasPulseActive: boolean}>}
 *   Lista con el estado de cada relay
 */
function getAllRelayStates() {
  return Object.keys(RELAYS).map((key) => {
    const relay = RELAYS[key];
    return {
      id: relay.id,
      name: relay.name,
      state: relay.state,
      hasPulseActive: relay.pulseTimeout !== null
    };
  });
}

// ─────────────────────────────────────────────
// Funciones de Lectoras
// ─────────────────────────────────────────────

/**
 * Obtiene la configuración de una lectora específica.
 *
 * @param {number} readerId - ID de la lectora a consultar
 * @returns {{id: number, name: string, relay: string, hito: string, direction: string}|null}
 *   Configuración de la lectora o null si no existe
 */
function getReaderConfig(readerId) {
  const key = _findReaderKey(readerId);
  if (!key) {
    return null;
  }
  return { ...READERS[key] };
}

/**
 * Obtiene la configuración de todas las lectoras del sistema.
 *
 * @returns {Array<{key: string, id: number, name: string, relay: string, hito: string, direction: string}>}
 *   Lista con la configuración de cada lectora
 */
function getAllReaders() {
  return Object.keys(READERS).map((key) => ({
    key,
    ...READERS[key]
  }));
}

// ─────────────────────────────────────────────
// Funciones del Controlador
// ─────────────────────────────────────────────

/**
 * Actualiza la configuración de red/modelo del controlador.
 * Solo actualiza los campos proporcionados en newConfig.
 *
 * @param {Object} newConfig - Objeto parcial con las propiedades a actualizar
 * @returns {{success: boolean, config: Object, message: string}}
 */
function updateControllerConfig(newConfig) {
  if (!newConfig || typeof newConfig !== 'object') {
    return {
      success: false,
      config: { ...controllerConfig },
      message: 'Configuración inválida. Se esperaba un objeto.'
    };
  }

  const allowedKeys = ['ip', 'subnet', 'gateway', 'port', 'protocol', 'connected', 'model'];
  const updatedKeys = [];

  for (const key of allowedKeys) {
    if (key in newConfig) {
      controllerConfig[key] = newConfig[key];
      updatedKeys.push(key);
    }
  }

  console.log(`[RelaySimulator] Configuración del controlador actualizada: ${updatedKeys.join(', ')}`);
  return {
    success: true,
    config: { ...controllerConfig },
    message: `Configuración actualizada: ${updatedKeys.join(', ')}`
  };
}

/**
 * Obtiene la configuración actual del controlador.
 *
 * @returns {{ip: string, subnet: string, gateway: string, port: number, protocol: string, connected: boolean, model: string}}
 *   Copia de la configuración actual
 */
function getControllerConfig() {
  return { ...controllerConfig };
}

/**
 * Simula un ping al controlador.
 * Retorna latencia aleatoria entre 1 y 15ms si está conectado.
 *
 * @returns {{success: boolean, latency: number|null, ip: string, message: string}}
 *   Resultado del ping simulado
 */
function pingController() {
  if (!controllerConfig.connected) {
    return {
      success: false,
      latency: null,
      ip: controllerConfig.ip,
      message: `Sin respuesta de ${controllerConfig.ip}. Controlador desconectado.`
    };
  }

  const latency = Math.floor(Math.random() * 15) + 1;
  return {
    success: true,
    latency,
    ip: controllerConfig.ip,
    message: `Respuesta de ${controllerConfig.ip}: tiempo=${latency}ms`
  };
}

// ─────────────────────────────────────────────
// Simulación de Sensor de Puerta
// ─────────────────────────────────────────────

/**
 * Establece el estado del sensor de puerta.
 * Si la puerta se abre, inicia el temporizador de alarma.
 * Si permanece abierta más de 60 segundos, dispara onDoorAlarm.
 *
 * @param {boolean} isOpen - true si la puerta está abierta, false si está cerrada
 */
function setDoorOpen(isOpen) {
  if (isOpen && !doorSensorState.isOpen) {
    // Puerta se abre
    doorSensorState.isOpen = true;
    doorSensorState.openSince = Date.now();
    doorSensorState.alarmTriggered = false;
    console.log('[RelaySimulator] Sensor de puerta: ABIERTA');
  } else if (!isOpen && doorSensorState.isOpen) {
    // Puerta se cierra
    doorSensorState.isOpen = false;
    doorSensorState.openSince = null;
    doorSensorState.alarmTriggered = false;
    console.log('[RelaySimulator] Sensor de puerta: CERRADA');
  }
}

/**
 * Obtiene el estado actual del sensor de puerta con el tiempo transcurrido.
 *
 * @returns {{isOpen: boolean, openSince: number|null, alarmTriggered: boolean, elapsedMs: number|null}}
 *   Estado del sensor con tiempo transcurrido desde la apertura
 */
function getDoorSensorState() {
  const elapsed = doorSensorState.isOpen && doorSensorState.openSince
    ? Date.now() - doorSensorState.openSince
    : null;

  return {
    isOpen: doorSensorState.isOpen,
    openSince: doorSensorState.openSince,
    alarmTriggered: doorSensorState.alarmTriggered,
    elapsedMs: elapsed
  };
}

/**
 * Reconoce y silencia la alarma de puerta abierta.
 *
 * @returns {{success: boolean, message: string}}
 */
function acknowledgeDoorAlarm() {
  if (!doorSensorState.alarmTriggered) {
    return { success: false, message: 'No hay alarma activa para reconocer.' };
  }

  doorSensorState.alarmTriggered = false;
  console.log('[RelaySimulator] Alarma de puerta reconocida/silenciada.');
  return { success: true, message: 'Alarma de puerta reconocida y silenciada.' };
}

/**
 * Verifica el estado del sensor de puerta cada segundo.
 * Si la puerta lleva abierta más de 60 segundos, dispara la alarma.
 * @private
 */
function _checkDoorSensor() {
  if (!doorSensorState.isOpen || doorSensorState.alarmTriggered) {
    return;
  }

  const elapsed = Date.now() - doorSensorState.openSince;
  if (elapsed >= DOOR_ALARM_THRESHOLD_MS) {
    doorSensorState.alarmTriggered = true;
    console.warn(`[RelaySimulator] ⚠ ALARMA: Puerta abierta por más de ${DOOR_ALARM_THRESHOLD_MS / 1000} segundos.`);

    if (typeof onDoorAlarm === 'function') {
      try {
        onDoorAlarm(getDoorSensorState());
      } catch (err) {
        console.error(`[RelaySimulator] Error en callback onDoorAlarm: ${err.message}`);
      }
    }
  }
}

// ─────────────────────────────────────────────
// Funciones auxiliares internas
// ─────────────────────────────────────────────

/**
 * Dispara el callback onScanProcessed si está definido.
 * @param {Object} result - Resultado del escaneo procesado
 * @private
 */
function _fireScanProcessed(result) {
  if (typeof onScanProcessed === 'function') {
    try {
      onScanProcessed(result);
    } catch (err) {
      console.error(`[RelaySimulator] Error en callback onScanProcessed: ${err.message}`);
    }
  }
}

/**
 * Dispara el callback onAlert si está definido.
 * @param {Object} alert - Información de la alerta
 * @private
 */
function _fireAlert(alert) {
  if (typeof onAlert === 'function') {
    try {
      onAlert(alert);
    } catch (err) {
      console.error(`[RelaySimulator] Error en callback onAlert: ${err.message}`);
    }
  }
}

// ─────────────────────────────────────────────
// Inicialización del intervalo del sensor de puerta
// ─────────────────────────────────────────────

_doorCheckInterval = setInterval(_checkDoorSensor, 1000);

// ─────────────────────────────────────────────
// Exportación global vía window.RelaySimulator
// ─────────────────────────────────────────────

/**
 * API pública del simulador de relays.
 * Se expone como window.RelaySimulator para uso desde otros módulos.
 */
window.RelaySimulator = {
  // Funciones de relays
  activateRelay,
  forceOpenRelay,
  forceCloseRelay,
  getRelayState,
  getAllRelayStates,

  // Funciones de lectoras
  processReaderScan,
  getReaderConfig,
  getAllReaders,

  // Funciones del controlador
  updateControllerConfig,
  getControllerConfig,
  pingController,

  // Funciones del sensor de puerta
  setDoorOpen,
  getDoorSensorState,
  acknowledgeDoorAlarm,

  // Callbacks configurables desde el exterior
  /** @param {Function} cb - Callback para activación de relay */
  set onRelayActivate(cb) { onRelayActivate = cb; },
  get onRelayActivate() { return onRelayActivate; },

  /** @param {Function} cb - Callback para desactivación de relay */
  set onRelayDeactivate(cb) { onRelayDeactivate = cb; },
  get onRelayDeactivate() { return onRelayDeactivate; },

  /** @param {Function} cb - Callback para escaneo procesado */
  set onScanProcessed(cb) { onScanProcessed = cb; },
  get onScanProcessed() { return onScanProcessed; },

  /** @param {Function} cb - Callback para alertas */
  set onAlert(cb) { onAlert = cb; },
  get onAlert() { return onAlert; },

  /** @param {Function} cb - Callback para alarma de puerta */
  set onDoorAlarm(cb) { onDoorAlarm = cb; },
  get onDoorAlarm() { return onDoorAlarm; }
};

console.log('[RelaySimulator] Módulo inicializado. Controlador:', controllerConfig.model, '| IP:', controllerConfig.ip);
