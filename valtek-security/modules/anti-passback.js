/**
 * @module AntiPassback
 * @description Módulo de lógica anti-passback temporal y direccional para el
 * sistema de control de acceso escolar Valtek Security.
 *
 * Controla que los accesos se realicen en la secuencia correcta de hitos,
 * evitando duplicaciones y accesos inválidos.
 *
 * Hitos válidos:
 *  - Ingreso_Perimetral: Entrada al perímetro del establecimiento
 *  - Salida_Definitiva:  Salida definitiva del perímetro
 *  - Ingreso_Oficial:    Entrada oficial al edificio principal
 *  - Salida_Oficial:     Salida oficial del edificio principal
 */

(function () {
  'use strict';

  // ─────────────────────────────────────────────
  // Constantes
  // ─────────────────────────────────────────────

  /** @type {Set<string>} Conjunto de hitos válidos del sistema */
  const HITOS_VALIDOS = new Set([
    'Ingreso_Perimetral',
    'Salida_Definitiva',
    'Ingreso_Oficial',
    'Salida_Oficial',
  ]);

  // ─────────────────────────────────────────────
  // Estado interno
  // ─────────────────────────────────────────────

  /**
   * Mapa de estado por RUN.
   * Cada entrada almacena el último hito registrado, su timestamp y las alertas asociadas.
   * @type {Map<string, {lastHito: string, timestamp: Date, alerts: Array<Object>}>}
   */
  let _estadosPorRun = new Map();

  /**
   * Registro global de alertas anti-passback generadas.
   * @type {Array<{run: string, hito: string, reason: string, timestamp: Date}>}
   */
  let _alertas = [];

  // ─────────────────────────────────────────────
  // Funciones internas
  // ─────────────────────────────────────────────

  /**
   * Valida que el RUN proporcionado sea una cadena no vacía.
   * @param {string} run - Identificador RUN del usuario.
   * @throws {Error} Si el RUN es inválido.
   */
  function _validarRun(run) {
    if (!run || typeof run !== 'string' || run.trim().length === 0) {
      throw new Error('AntiPassback: El RUN proporcionado es inválido o está vacío.');
    }
  }

  /**
   * Valida que el hito solicitado sea uno de los hitos reconocidos por el sistema.
   * @param {string} hito - Nombre del hito a validar.
   * @throws {Error} Si el hito no es válido.
   */
  function _validarHito(hito) {
    if (!HITOS_VALIDOS.has(hito)) {
      throw new Error(
        `AntiPassback: Hito "${hito}" no es válido. ` +
        `Hitos aceptados: ${[...HITOS_VALIDOS].join(', ')}.`
      );
    }
  }

  /**
   * Registra una alerta anti-passback tanto en el estado del RUN como en el
   * registro global de alertas.
   * @param {string} run    - RUN del usuario que generó la alerta.
   * @param {string} hito   - Hito que intentó registrarse.
   * @param {string} reason - Razón descriptiva del bloqueo.
   */
  function _registrarAlerta(run, hito, reason) {
    const alerta = {
      run,
      hito,
      reason,
      timestamp: new Date(),
    };

    // Agregar al registro global
    _alertas.push(alerta);

    // Agregar al estado individual del RUN si existe
    const estado = _estadosPorRun.get(run);
    if (estado) {
      estado.alerts.push(alerta);
    }
  }

  // ─────────────────────────────────────────────
  // Funciones públicas
  // ─────────────────────────────────────────────

  /**
   * Valida si un acceso es permitido según las reglas anti-passback.
   *
   * Reglas de validación:
   *  - **Ingreso_Oficial**: Bloqueado si el último hito es Ingreso_Oficial
   *    sin una Salida_Oficial intermedia (usuario ya está DENTRO).
   *  - **Salida_Oficial**: Bloqueado si no existe un Ingreso_Oficial previo
   *    (usuario no está registrado como DENTRO).
   *  - **Ingreso_Perimetral**: Siempre permitido si el usuario está enrolado.
   *  - **Salida_Definitiva**: Solo permitido si existe un Ingreso_Perimetral
   *    sin una Salida_Definitiva posterior.
   *
   * @param {string} run           - RUN del usuario que solicita acceso.
   * @param {string} requestedHito - Hito de acceso solicitado.
   * @returns {{allowed: boolean, hito?: string, timestamp?: Date, reason?: string, alert?: boolean}}
   *   Objeto con el resultado de la validación. Si `allowed` es true, incluye
   *   el hito y timestamp registrados. Si es false, incluye la razón del
   *   bloqueo y una bandera de alerta.
   */
  function validateAccess(run, requestedHito) {
    _validarRun(run);
    _validarHito(requestedHito);

    const runNormalizado = run.trim();
    const estadoActual = _estadosPorRun.get(runNormalizado) || null;
    const ultimoHito = estadoActual ? estadoActual.lastHito : null;

    // ── Regla A: Ingreso_Oficial ──────────────────────────────
    if (requestedHito === 'Ingreso_Oficial') {
      if (ultimoHito === 'Ingreso_Oficial') {
        const reason = 'ANTI_PASSBACK: RUN ya registrado como DENTRO. Requiere Salida_Oficial previa.';
        _registrarAlerta(runNormalizado, requestedHito, reason);
        return { allowed: false, reason, alert: true };
      }
    }

    // ── Regla B: Salida_Oficial ───────────────────────────────
    if (requestedHito === 'Salida_Oficial') {
      if (ultimoHito !== 'Ingreso_Oficial') {
        const reason = 'ANTI_PASSBACK: RUN no registra Ingreso_Oficial previo.';
        _registrarAlerta(runNormalizado, requestedHito, reason);
        return { allowed: false, reason, alert: true };
      }
    }

    // ── Regla C: Ingreso_Perimetral ───────────────────────────
    // Siempre permitido si el usuario está enrolado.
    // (La verificación de enrolamiento se realiza en capas superiores;
    //  este módulo asume que el RUN recibido corresponde a un usuario válido.)

    // ── Regla D: Salida_Definitiva ────────────────────────────
    if (requestedHito === 'Salida_Definitiva') {
      // Requiere un Ingreso_Perimetral previo sin Salida_Definitiva posterior
      if (!ultimoHito || ultimoHito === 'Salida_Definitiva') {
        const reason = 'ANTI_PASSBACK: RUN no registra Ingreso_Perimetral previo sin Salida_Definitiva.';
        _registrarAlerta(runNormalizado, requestedHito, reason);
        return { allowed: false, reason, alert: true };
      }
    }

    // ── Acceso permitido: actualizar estado ───────────────────
    const ahora = new Date();

    if (estadoActual) {
      estadoActual.lastHito = requestedHito;
      estadoActual.timestamp = ahora;
    } else {
      _estadosPorRun.set(runNormalizado, {
        lastHito: requestedHito,
        timestamp: ahora,
        alerts: [],
      });
    }

    return {
      allowed: true,
      hito: requestedHito,
      timestamp: ahora,
    };
  }

  /**
   * Obtiene el estado actual de un RUN específico.
   *
   * @param {string} run - RUN del usuario a consultar.
   * @returns {{lastHito: string, timestamp: Date, alerts: Array<Object>}|null}
   *   Estado actual del RUN o null si no existe registro.
   */
  function getState(run) {
    _validarRun(run);
    const estado = _estadosPorRun.get(run.trim());
    if (!estado) {
      return null;
    }
    // Retornar copia para evitar mutaciones externas
    return {
      lastHito: estado.lastHito,
      timestamp: new Date(estado.timestamp.getTime()),
      alerts: [...estado.alerts],
    };
  }

  /**
   * Obtiene una copia del mapa completo de estados de todos los RUN rastreados.
   *
   * @returns {Map<string, {lastHito: string, timestamp: Date, alerts: Array<Object>}>}
   *   Mapa con todos los estados registrados.
   */
  function getAllStates() {
    const copia = new Map();
    _estadosPorRun.forEach(function (estado, run) {
      copia.set(run, {
        lastHito: estado.lastHito,
        timestamp: new Date(estado.timestamp.getTime()),
        alerts: [...estado.alerts],
      });
    });
    return copia;
  }

  /**
   * Obtiene una copia del arreglo de todas las alertas anti-passback
   * generadas desde el último reset o limpieza.
   *
   * @returns {Array<{run: string, hito: string, reason: string, timestamp: Date}>}
   *   Arreglo de alertas registradas.
   */
  function getAlerts() {
    return _alertas.map(function (alerta) {
      return {
        run: alerta.run,
        hito: alerta.hito,
        reason: alerta.reason,
        timestamp: new Date(alerta.timestamp.getTime()),
      };
    });
  }

  /**
   * Limpia el arreglo global de alertas anti-passback.
   * No afecta las alertas almacenadas en el estado individual de cada RUN.
   */
  function clearAlerts() {
    _alertas = [];
  }

  /**
   * Reinicia completamente el estado del módulo anti-passback.
   * Elimina todos los estados de RUN y todas las alertas registradas.
   */
  function reset() {
    _estadosPorRun = new Map();
    _alertas = [];
  }

  // ─────────────────────────────────────────────
  // Exportación global
  // ─────────────────────────────────────────────

  /**
   * API pública del módulo AntiPassback expuesta en el objeto global window.
   * @namespace window.AntiPassback
   */
  window.AntiPassback = {
    validateAccess,
    getState,
    getAllStates,
    getAlerts,
    clearAlerts,
    reset,
  };
})();
