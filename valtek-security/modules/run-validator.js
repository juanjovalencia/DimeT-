/**
 * @module RUNValidator
 * @description Módulo de validación de RUN (Rol Único Nacional) chileno.
 * Implementa el algoritmo de módulo 11 para verificar la validez de un RUN/RUT.
 * Se exporta como objeto global en window.RUNValidator.
 *
 * @example
 * // Uso básico
 * const resultado = RUNValidator.validateRUN('12.345.678-5');
 * console.log(resultado); // { valid: true, formatted: '12.345.678-5' }
 *
 * @example
 * // Obtener dígito verificador
 * const dv = RUNValidator.getVerificationDigit('12345678');
 * console.log(dv); // '5'
 */
(function () {
  'use strict';

  // ──────────────────────────────────────────────
  // Expresión regular para validar formato limpio
  // Solo dígitos seguidos opcionalmente de 'K'
  // ──────────────────────────────────────────────
  const RUN_LIMPIO_REGEX = /^\d{7,8}[\dkK]$/;

  /**
   * Sanitiza un RUN eliminando puntos, guiones y espacios.
   * Convierte cualquier 'k' minúscula a 'K' mayúscula.
   *
   * @param {string} input - El RUN en cualquier formato de entrada.
   *   Formatos aceptados: '12.345.678-9', '12345678-9', '123456789', '12.345.678-K'
   * @returns {string} El RUN limpio sin puntos ni guiones, con 'K' en mayúscula si corresponde.
   *
   * @example
   * sanitizeRUN('12.345.678-9');  // → '123456789'
   * sanitizeRUN('12.345.678-K');  // → '12345678K'
   * sanitizeRUN('12345678-k');    // → '12345678K'
   * sanitizeRUN(' 12.345.678-9 '); // → '123456789'
   *
   * @throws {Error} Si el argumento no es un string.
   */
  function sanitizeRUN(input) {
    if (typeof input !== 'string') {
      throw new Error('El argumento debe ser un string.');
    }

    // Eliminar espacios al inicio y al final
    let limpio = input.trim();

    // Eliminar puntos y guiones
    limpio = limpio.replace(/[.\-]/g, '');

    // Convertir 'k' minúscula a 'K' mayúscula
    limpio = limpio.toUpperCase();

    return limpio;
  }

  /**
   * Calcula el dígito verificador de un RUN usando el algoritmo de módulo 11.
   *
   * Pasos del algoritmo:
   *  1. Se toman los dígitos del cuerpo del RUN (sin el dígito verificador).
   *  2. Se multiplica cada dígito de derecha a izquierda por la secuencia cíclica 2, 3, 4, 5, 6, 7.
   *  3. Se suman todos los productos.
   *  4. Se calcula: resultado = 11 - (suma % 11).
   *  5. Si el resultado es 11, el dígito verificador es '0'.
   *  6. Si el resultado es 10, el dígito verificador es 'K'.
   *  7. En cualquier otro caso, el dígito verificador es el resultado como string.
   *
   * @param {string} runBody - El cuerpo numérico del RUN (solo dígitos, sin dígito verificador).
   *   Ejemplo: '12345678'
   * @returns {string} El dígito verificador calculado ('0'-'9' o 'K').
   *
   * @example
   * getVerificationDigit('12345678'); // → '5'
   * getVerificationDigit('11111111'); // → '1'
   *
   * @throws {Error} Si el cuerpo del RUN no contiene solo dígitos o tiene largo inválido.
   */
  function getVerificationDigit(runBody) {
    if (typeof runBody !== 'string') {
      throw new Error('El cuerpo del RUN debe ser un string.');
    }

    // Validar que solo contenga dígitos
    if (!/^\d+$/.test(runBody)) {
      throw new Error('El cuerpo del RUN debe contener solo dígitos numéricos.');
    }

    // Validar largo razonable (entre 6 y 8 dígitos para RUN chileno)
    if (runBody.length < 6 || runBody.length > 8) {
      throw new Error(
        'El cuerpo del RUN debe tener entre 6 y 8 dígitos. Se recibieron ' +
          runBody.length +
          ' dígitos.'
      );
    }

    // Secuencia de multiplicadores cíclica: 2, 3, 4, 5, 6, 7
    const multiplicadores = [2, 3, 4, 5, 6, 7];

    // Convertir el cuerpo a un arreglo de dígitos invertido (derecha a izquierda)
    const digitos = runBody.split('').reverse();

    // Sumar los productos de cada dígito por su multiplicador correspondiente
    let suma = 0;
    for (let i = 0; i < digitos.length; i++) {
      const digito = parseInt(digitos[i], 10);
      const multiplicador = multiplicadores[i % multiplicadores.length];
      suma += digito * multiplicador;
    }

    // Calcular el resultado según módulo 11
    const resultado = 11 - (suma % 11);

    // Determinar el dígito verificador
    if (resultado === 11) {
      return '0';
    }
    if (resultado === 10) {
      return 'K';
    }
    return resultado.toString();
  }

  /**
   * Valida un RUN chileno completo (cuerpo + dígito verificador).
   *
   * Sanitiza la entrada, verifica el formato y compara el dígito verificador
   * proporcionado con el calculado mediante el algoritmo de módulo 11.
   *
   * @param {string} run - El RUN a validar, en cualquier formato aceptado.
   *   Formatos aceptados: '12.345.678-9', '12345678-9', '123456789', '12345678K'
   * @returns {{ valid: boolean, formatted: string, error?: string }}
   *   Objeto con el resultado de la validación:
   *   - `valid`: true si el RUN es válido, false en caso contrario.
   *   - `formatted`: el RUN formateado (ej: '12.345.678-9'), vacío si el formato es inválido.
   *   - `error`: mensaje descriptivo del error (solo presente cuando valid es false).
   *
   * @example
   * validateRUN('12.345.678-5');
   * // → { valid: true, formatted: '12.345.678-5' }
   *
   * @example
   * validateRUN('12345678-0');
   * // → { valid: false, formatted: '12.345.678-0', error: 'Dígito verificador inválido...' }
   *
   * @example
   * validateRUN('abc');
   * // → { valid: false, formatted: '', error: 'Formato de RUN inválido...' }
   */
  function validateRUN(run) {
    // Verificar que se recibió un string
    if (typeof run !== 'string') {
      return {
        valid: false,
        formatted: '',
        error: 'El RUN debe ser un string.',
      };
    }

    // Sanitizar la entrada
    var limpio = sanitizeRUN(run);

    // Verificar formato limpio (7-8 dígitos + 1 dígito verificador)
    if (!RUN_LIMPIO_REGEX.test(limpio)) {
      return {
        valid: false,
        formatted: '',
        error:
          'Formato de RUN inválido. Debe contener entre 7 y 8 dígitos seguidos de un dígito verificador (0-9 o K).',
      };
    }

    // Separar el cuerpo del dígito verificador proporcionado
    var cuerpo = limpio.slice(0, -1);
    var dvProporcionado = limpio.slice(-1);

    // Calcular el dígito verificador esperado
    var dvCalculado;
    try {
      dvCalculado = getVerificationDigit(cuerpo);
    } catch (e) {
      return {
        valid: false,
        formatted: '',
        error: 'Error al calcular el dígito verificador: ' + e.message,
      };
    }

    // Formatear el RUN para la respuesta
    var formateado = formatRUN(limpio);

    // Comparar dígitos verificadores
    if (dvProporcionado !== dvCalculado) {
      return {
        valid: false,
        formatted: formateado,
        error:
          'Dígito verificador inválido. Se esperaba "' +
          dvCalculado +
          '" pero se recibió "' +
          dvProporcionado +
          '".',
      };
    }

    return {
      valid: true,
      formatted: formateado,
    };
  }

  /**
   * Formatea un RUN limpio al formato estándar chileno con puntos y guión.
   *
   * Toma un RUN sin puntos ni guiones y lo convierte al formato legible:
   * puntos como separadores de miles y guión antes del dígito verificador.
   *
   * @param {string} run - El RUN limpio (sin puntos ni guiones).
   *   Ejemplo: '123456789' o '12345678K'
   * @returns {string} El RUN formateado. Ejemplo: '12.345.678-9' o '12.345.678-K'
   *
   * @example
   * formatRUN('123456789');  // → '12.345.678-9'
   * formatRUN('12345678K');  // → '12.345.678-K'
   * formatRUN('76543210');   // → '7.654.321-0'
   *
   * @throws {Error} Si el RUN no tiene un formato limpio válido.
   */
  function formatRUN(run) {
    if (typeof run !== 'string') {
      throw new Error('El RUN debe ser un string.');
    }

    // Sanitizar por si viene con formato
    var limpio = sanitizeRUN(run);

    // Validar formato limpio
    if (!RUN_LIMPIO_REGEX.test(limpio)) {
      throw new Error(
        'Formato de RUN inválido para formatear. Se recibió: "' + run + '".'
      );
    }

    // Separar cuerpo y dígito verificador
    var cuerpo = limpio.slice(0, -1);
    var dv = limpio.slice(-1);

    // Agregar puntos como separadores de miles (de derecha a izquierda)
    var cuerpoFormateado = '';
    var contador = 0;

    for (var i = cuerpo.length - 1; i >= 0; i--) {
      if (contador > 0 && contador % 3 === 0) {
        cuerpoFormateado = '.' + cuerpoFormateado;
      }
      cuerpoFormateado = cuerpo[i] + cuerpoFormateado;
      contador++;
    }

    // Retornar con formato: cuerpo.formateado-dv
    return cuerpoFormateado + '-' + dv;
  }

  // ──────────────────────────────────────────────
  // Exportar el módulo como objeto global
  // ──────────────────────────────────────────────
  window.RUNValidator = {
    sanitizeRUN: sanitizeRUN,
    validateRUN: validateRUN,
    formatRUN: formatRUN,
    getVerificationDigit: getVerificationDigit,
  };
})();
