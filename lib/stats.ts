/**
 * Utilidades estadísticas y de datos para el dashboard CREOTEC.
 */

// Sentinela usado en la hoja para "sin dato". Debe omitirse en los cálculos.
const SENTINEL = 9999;

/**
 * Convierte un texto a número aceptando coma o punto decimal.
 * Devuelve null si no es un número válido.
 */
export function parseNumber(value: string | undefined | null): number | null {
  if (value == null) return null;
  const cleaned = String(value).trim().replace(",", ".");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Calcula la MEDIANA de una lista de textos numéricos.
 * Omite valores vacíos y el sentinela 9999 (indicado en las reglas de negocio),
 * porque los tiempos tienen fuerte asimetría positiva y el promedio no es representativo.
 */
export function median(values: (string | number | null | undefined)[]): number {
  const nums = values
    .map((v) => (typeof v === "number" ? v : parseNumber(v as string)))
    .filter((n): n is number => n !== null && n !== SENTINEL);

  if (nums.length === 0) return 0;

  nums.sort((a, b) => a - b);
  const mid = Math.floor(nums.length / 2);

  return nums.length % 2 !== 0
    ? nums[mid]
    : (nums[mid - 1] + nums[mid]) / 2;
}

/**
 * Cuenta ocurrencias por categoría y devuelve pares [etiqueta, conteo]
 * ordenados de mayor a menor.
 */
export function countBy(
  items: string[],
  { limit }: { limit?: number } = {}
): Array<[string, number]> {
  const map = new Map<string, number>();
  for (const raw of items) {
    const key = raw?.trim();
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  return limit ? sorted.slice(0, limit) : sorted;
}

/** Redondea a n decimales devolviendo un número. */
export function round(value: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/**
 * Divide textos largos en arreglos de líneas (multilínea) para que Chart.js
 * los renderice sin cortar en los ejes verticales u horizontales.
 */
export function formatChartLabel(label: string, maxLen = 26): string | string[] {
  if (!label || label.length <= maxLen) return label;
  
  const words = label.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= maxLen) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  
  return lines.length > 1 ? lines : label;
}
