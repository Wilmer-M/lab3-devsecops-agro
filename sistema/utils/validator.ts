/**
 * Utilidad para validación de datos de sensores (Pruebas de Valores Límite)
 * Recorta (clamp) los valores fuera de rango al límite más cercano.
 */

export function validateSensorValue(
  value: number | null | undefined,
  min: number,
  max: number,
): number {
  if (value === null || value === undefined || isNaN(value)) {
    console.warn(`[Validator] Valor inválido, usando mínimo ${min}`);
    return min;
  }
  if (value < min) {
    console.warn(
      `[Validator] Valor ${value} por debajo del mínimo ${min}, recortando`,
    );
    return min;
  }
  if (value > max) {
    console.warn(
      `[Validator] Valor ${value} por encima del máximo ${max}, recortando`,
    );
    return max;
  }
  return value;
}

export function validateAndReject(
  value: number | null | undefined,
  min: number,
  max: number,
): { valid: boolean; value: number; error?: string } {
  if (value === null || value === undefined || isNaN(value)) {
    return {
      valid: false,
      value: min,
      error: `Valor inválido, se usó mínimo ${min}`,
    };
  }
  if (value < min) {
    return {
      valid: false,
      value: min,
      error: `Valor ${value} por debajo del mínimo ${min}`,
    };
  }
  if (value > max) {
    return {
      valid: false,
      value: max,
      error: `Valor ${value} por encima del máximo ${max}`,
    };
  }
  return { valid: true, value };
}

export const SENSOR_LIMITS = {
  suelo: {
    humedad: { min: 0, max: 100 },
    nitrogeno: { min: 0, max: 5000 },
    fosforo: { min: 0, max: 5000 },
    potasio: { min: 0, max: 5000 },
  },
  clima: {
    temperatura: { min: -30, max: 60 },
    humedad: { min: 0, max: 100 },
    presion: { min: 800, max: 1200 },
    lluvia: { min: 0, max: 1000 },
  },
};
