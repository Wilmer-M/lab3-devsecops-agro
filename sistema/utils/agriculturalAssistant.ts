export type AssistantReadings = {
  humedad: number | null;
  nitrogeno: number | null;
  fosforo: number | null;
  potasio: number | null;
};

export type AssistantDataSummary = {
  stations: Array<{
    name: string;
    latestDate: string | null;
    readings: AssistantReadings;
  }>;
  weather: {
    latestDate: string | null;
    temperature: number | null;
    humidity: number | null;
    rain: number | null;
  } | null;
};

type RawStation = Record<string, unknown>;
type RawAssistantData = {
  suelo?: Record<string, RawStation>;
  clima?: Record<string, RawStation>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const lastFiniteNumber = (values?: unknown[]): number | null => {
  if (!Array.isArray(values)) return null;
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = Number(values[index]);
    // -1 represents an invalid or unavailable sensor reading in AgroSmart.
    if (Number.isFinite(value) && value !== -1) return value;
  }
  return null;
};

const lastValue = (values?: unknown[]): string | null => {
  if (!Array.isArray(values) || values.length === 0) return null;
  const value = values[values.length - 1];
  return value === null || value === undefined || value === "" ? null : String(value);
};

/** Creates a compact summary; raw Excel rows are never sent per question. */
export const buildAssistantDataSummary = (data: unknown): AssistantDataSummary => {
  const rawData: RawAssistantData = isRecord(data) ? data : {};
  const soil = rawData.suelo ?? {};
  const weatherStation = Object.values(rawData.clima ?? {})[0];

  return {
    stations: Object.entries(soil).map(([name, station]) => ({
      name,
      latestDate: lastValue(station.fechas as unknown[]),
      readings: {
        humedad: lastFiniteNumber(station.Humedad as unknown[]),
        nitrogeno: lastFiniteNumber(station.Nitrogeno as unknown[]),
        fosforo: lastFiniteNumber(station.Fosforo as unknown[]),
        potasio: lastFiniteNumber(station.Potasio as unknown[]),
      },
    })),
    weather: weatherStation
      ? {
          latestDate: lastValue(weatherStation.fechas as unknown[]),
          temperature: lastFiniteNumber(weatherStation.Temperatura as unknown[]),
          humidity: lastFiniteNumber(weatherStation.Humedad as unknown[]),
          rain: lastFiniteNumber(weatherStation.Lluvia as unknown[]),
        }
      : null,
  };
};
