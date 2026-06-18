/**
 * @module IDParser
 * @description Módulo para parsear datos de cédulas de identidad chilenas
 * desde lectores de códigos de barras (QR frontal y PDF417 trasero).
 * 
 * Formatos soportados:
 * - QR Frontal: URLs del Registro Civil con RUN embebido
 * - PDF417 Trasero: Secuencia de caracteres con RUN codificado
 * 
 * @version 1.0.0
 */

(function () {
  'use strict';

  // ─── Expresiones regulares para extracción del RUN ───────────────────────────

  /** Patrón para capturar RUN desde parámetros de URL (RUN=, SERIALNUMBER=, run=) */
  const RE_RUN_PARAM = /(?:RUN=|SERIALNUMBER=|run=)(\d{7,8}-?[\dkK])/i;

  /** Patrón para capturar RUN directamente en la ruta de la URL */
  const RE_RUN_PATH = /\/(\d{7,8})-?([\dkK])(?:\/|$|&)/;

  /** Patrón para capturar RUN al inicio de una cadena PDF417 */
  const RE_PDF417_START = /^0?(\d{7,8})([0-9kK])/i;

  /** Patrón alternativo para capturar RUN dentro de la cadena PDF417 con delimitadores */
  const RE_PDF417_DELIMITED = /(?:^|[\x00-\x1f\s|])(\d{7,8})[-\s]?([0-9kK])(?:[\x00-\x1f\s|]|$)/i;

  /** Patrones de URL que identifican un QR frontal del Registro Civil */
  const QR_INDICATORS = ['http', 'registro', 'srcei', 'registrocivil', 'sidiv'];

  // ─── Funciones auxiliares ────────────────────────────────────────────────────

  /**
   * Formatea un RUN en formato estándar (sin guión intermedio, con guión verificador).
   * Ejemplo: "12345678" + "9" → "12345678-9"
   *
   * @param {string} cuerpo - Dígitos principales del RUN (7-8 dígitos)
   * @param {string} verificador - Dígito verificador (0-9, k, K)
   * @returns {string} RUN formateado como "XXXXXXXX-X"
   * @private
   */
  function formatearRUN(cuerpo, verificador) {
    const cuerpoLimpio = cuerpo.replace(/-/g, '');
    return `${cuerpoLimpio}-${verificador.toUpperCase()}`;
  }

  /**
   * Valida que un string tenga la estructura mínima esperada para un RUN.
   *
   * @param {string} run - RUN formateado a validar
   * @returns {boolean} true si el formato es válido
   * @private
   */
  function esRUNValido(run) {
    return /^\d{7,8}-[\dK]$/.test(run);
  }

  /**
   * Construye el objeto de respuesta estándar para resultados exitosos.
   *
   * @param {string} run - RUN extraído y formateado
   * @param {string} raw - Cadena original sin procesar
   * @param {string} method - Método de parseo utilizado
   * @returns {{ success: boolean, run: string, raw: string, method: string }}
   * @private
   */
  function respuestaExitosa(run, raw, method) {
    return { success: true, run, raw, method };
  }

  /**
   * Construye el objeto de respuesta estándar para resultados fallidos.
   *
   * @param {string} raw - Cadena original sin procesar
   * @param {string} method - Método de parseo que falló
   * @param {string} [error='No se encontró un RUN válido'] - Descripción del error
   * @returns {{ success: boolean, raw: string, method: string, error: string }}
   * @private
   */
  function respuestaFallida(raw, method, error = 'No se encontró un RUN válido') {
    return { success: false, raw, method, error };
  }

  // ─── Funciones principales ───────────────────────────────────────────────────

  /**
   * Parsea el código QR del lado FRONTAL de una cédula de identidad chilena.
   *
   * El QR frontal contiene una URL del Registro Civil con el RUN embebido.
   * URLs reconocidas:
   * - https://registro.srcei.cl/...
   * - https://portal.sidiv.registrocivil.cl/docstatus?RUN=XXXXXXXX&type=...
   * - https://registo.srcei.cl/ci/... (typo oficial en la URL)
   *
   * @param {string} rawString - Cadena cruda leída desde el escáner de QR
   * @returns {{ success: boolean, run?: string, raw: string, method: string, error?: string }}
   *   Objeto con el resultado del parseo. Si tiene éxito, incluye el RUN formateado.
   *
   * @example
   * // URL con parámetro RUN
   * parseQRFront('https://portal.sidiv.registrocivil.cl/docstatus?RUN=12345678&type=new');
   * // → { success: true, run: '12345678-0', raw: '...', method: 'QR_FRONT' }
   *
   * @example
   * // URL con SERIALNUMBER
   * parseQRFront('https://registro.srcei.cl/ci/SERIALNUMBER=12345678-K');
   * // → { success: true, run: '12345678-K', raw: '...', method: 'QR_FRONT' }
   */
  function parseQRFront(rawString) {
    const METHOD = 'QR_FRONT';

    if (!rawString || typeof rawString !== 'string') {
      return respuestaFallida(rawString || '', METHOD, 'Entrada vacía o inválida');
    }

    const raw = rawString.trim();

    // Intento 1: Buscar RUN como parámetro de URL (RUN=, SERIALNUMBER=, run=)
    const matchParam = raw.match(RE_RUN_PARAM);
    if (matchParam) {
      const valor = matchParam[1];

      // Si ya incluye guión, separar cuerpo y verificador
      if (valor.includes('-')) {
        const partes = valor.split('-');
        const run = formatearRUN(partes[0], partes[1]);
        if (esRUNValido(run)) {
          return respuestaExitosa(run, raw, METHOD);
        }
      }

      // Si no tiene guión, los últimos caracteres son el dígito verificador
      const cuerpo = valor.slice(0, -1);
      const verificador = valor.slice(-1);
      const run = formatearRUN(cuerpo, verificador);
      if (esRUNValido(run)) {
        return respuestaExitosa(run, raw, METHOD);
      }
    }

    // Intento 2: Buscar RUN directamente en la ruta de la URL
    const matchPath = raw.match(RE_RUN_PATH);
    if (matchPath) {
      const run = formatearRUN(matchPath[1], matchPath[2]);
      if (esRUNValido(run)) {
        return respuestaExitosa(run, raw, METHOD);
      }
    }

    return respuestaFallida(raw, METHOD, 'No se pudo extraer el RUN del QR frontal');
  }

  /**
   * Parsea el código de barras PDF417 del lado TRASERO de una cédula de identidad chilena.
   *
   * El PDF417 trasero contiene una secuencia larga de caracteres donde el RUN
   * aparece típicamente al inicio (con un posible cero prefijo) seguido del
   * dígito verificador, o bien separado por delimitadores de control.
   *
   * @param {string} rawString - Cadena cruda leída desde el escáner PDF417
   * @returns {{ success: boolean, run?: string, raw: string, method: string, error?: string }}
   *   Objeto con el resultado del parseo. Si tiene éxito, incluye el RUN formateado.
   *
   * @example
   * // RUN al inicio de la cadena
   * parsePDF417('123456789ABCDEF...');
   * // → { success: true, run: '12345678-9', raw: '...', method: 'PDF417_BACK' }
   *
   * @example
   * // RUN con cero prefijo
   * parsePDF417('0123456785SOME_DATA...');
   * // → { success: true, run: '12345678-5', raw: '...', method: 'PDF417_BACK' }
   */
  function parsePDF417(rawString) {
    const METHOD = 'PDF417_BACK';

    if (!rawString || typeof rawString !== 'string') {
      return respuestaFallida(rawString || '', METHOD, 'Entrada vacía o inválida');
    }

    const raw = rawString.trim();

    // Intento 1: RUN al inicio de la cadena (con posible cero prefijo)
    const matchInicio = raw.match(RE_PDF417_START);
    if (matchInicio) {
      const run = formatearRUN(matchInicio[1], matchInicio[2]);
      if (esRUNValido(run)) {
        return respuestaExitosa(run, raw, METHOD);
      }
    }

    // Intento 2: RUN después de delimitadores o caracteres de control
    const matchDelimitado = raw.match(RE_PDF417_DELIMITED);
    if (matchDelimitado) {
      const run = formatearRUN(matchDelimitado[1], matchDelimitado[2]);
      if (esRUNValido(run)) {
        return respuestaExitosa(run, raw, METHOD);
      }
    }

    // Intento 3: Buscar cualquier secuencia de 7-8 dígitos seguida de verificador
    const matchGenerico = raw.match(/(\d{7,8})[-\s]?([0-9kK])/i);
    if (matchGenerico) {
      const run = formatearRUN(matchGenerico[1], matchGenerico[2]);
      if (esRUNValido(run)) {
        return respuestaExitosa(run, raw, METHOD);
      }
    }

    return respuestaFallida(raw, METHOD, 'No se pudo extraer el RUN del PDF417 trasero');
  }

  /**
   * Detecta automáticamente el tipo de código (QR frontal o PDF417 trasero)
   * y parsea el RUN de la cadena proporcionada.
   *
   * Lógica de detección:
   * 1. Si la cadena contiene indicadores de URL ('http', 'registro', 'srcei') → intenta QR frontal
   * 2. Si la cadena es larga (>50 caracteres) sin indicadores de URL → intenta PDF417
   * 3. En caso ambiguo → intenta ambos métodos en orden
   *
   * @param {string} rawString - Cadena cruda leída desde cualquier escáner
   * @returns {{ success: boolean, run?: string, raw: string, method: string, error?: string }}
   *   Objeto con el resultado del parseo. El campo `method` indica qué parser tuvo éxito.
   *
   * @example
   * // Detección automática de QR
   * autoDetectAndParse('https://portal.sidiv.registrocivil.cl/docstatus?RUN=12345678');
   * // → { success: true, run: '12345678-...', method: 'QR_FRONT', ... }
   *
   * @example
   * // Detección automática de PDF417
   * autoDetectAndParse('0123456785XYZABC...(cadena larga)...');
   * // → { success: true, run: '12345678-5', method: 'PDF417_BACK', ... }
   */
  function autoDetectAndParse(rawString) {
    if (!rawString || typeof rawString !== 'string') {
      return {
        success: false,
        raw: rawString || '',
        method: 'AUTO_DETECT',
        error: 'Entrada vacía o inválida',
      };
    }

    const raw = rawString.trim();
    const rawLower = raw.toLowerCase();

    // Verificar si la cadena contiene indicadores de URL (probable QR frontal)
    const esURL = QR_INDICATORS.some(function (indicador) {
      return rawLower.includes(indicador);
    });

    // Verificar si la cadena es larga y sin estructura de URL (probable PDF417)
    const esPDF417Probable = raw.length > 50 && !esURL;

    // Caso 1: Parece ser un QR frontal → intentar QR primero
    if (esURL) {
      const resultadoQR = parseQRFront(raw);
      if (resultadoQR.success) {
        return resultadoQR;
      }

      // Si el QR falla, intentar PDF417 como respaldo
      const resultadoPDF = parsePDF417(raw);
      if (resultadoPDF.success) {
        return resultadoPDF;
      }
    }

    // Caso 2: Parece ser un PDF417 → intentar PDF417 primero
    if (esPDF417Probable) {
      const resultadoPDF = parsePDF417(raw);
      if (resultadoPDF.success) {
        return resultadoPDF;
      }

      // Si PDF417 falla, intentar QR como respaldo
      const resultadoQR = parseQRFront(raw);
      if (resultadoQR.success) {
        return resultadoQR;
      }
    }

    // Caso 3: Ambiguo → intentar ambos métodos en orden
    if (!esURL && !esPDF417Probable) {
      const resultadoQR = parseQRFront(raw);
      if (resultadoQR.success) {
        return resultadoQR;
      }

      const resultadoPDF = parsePDF417(raw);
      if (resultadoPDF.success) {
        return resultadoPDF;
      }
    }

    return {
      success: false,
      raw: raw,
      method: 'AUTO_DETECT',
      error: 'No se pudo parsear el RUN con ningún método disponible',
    };
  }

  // ─── Exportar al objeto global ───────────────────────────────────────────────

  /**
   * @global
   * @namespace IDParser
   * @description API pública del módulo de parseo de cédulas de identidad chilenas.
   * Accesible desde `window.IDParser`.
   */
  window.IDParser = {
    parseQRFront: parseQRFront,
    parsePDF417: parsePDF417,
    autoDetectAndParse: autoDetectAndParse,
  };
})();
