const MAX_QUESTION_LENGTH = 800;
const MAX_STATIONS = 50;
const MAX_STATION_NAME_LENGTH = 100;

const finiteReadingOrNull = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue !== -1 ? numericValue : null;
};

const stringOrNull = (value, maxLength = 100) =>
  typeof value === "string" && value.trim() && value.length <= maxLength
    ? value
    : null;

const sanitizeReadings = (readings) => {
  const source = readings && typeof readings === "object" ? readings : {};
  return {
    humedad: finiteReadingOrNull(source.humedad),
    nitrogeno: finiteReadingOrNull(source.nitrogeno),
    fosforo: finiteReadingOrNull(source.fosforo),
    potasio: finiteReadingOrNull(source.potasio),
  };
};

/** Keeps only the schema expected by the Langflow prompt. */
function sanitizeAssistantDataSummary(dataSummary) {
  if (!dataSummary || typeof dataSummary !== "object" || Array.isArray(dataSummary)) {
    return null;
  }

  const rawStations = Array.isArray(dataSummary.stations) ? dataSummary.stations : [];
  const stations = rawStations.slice(0, MAX_STATIONS).flatMap((station) => {
    if (!station || typeof station !== "object") return [];
    const name = stringOrNull(station.name, MAX_STATION_NAME_LENGTH);
    if (!name) return [];
    return [{
      name,
      latestDate: stringOrNull(station.latestDate),
      readings: sanitizeReadings(station.readings),
    }];
  });

  const rawWeather = dataSummary.weather;
  const weather = rawWeather && typeof rawWeather === "object" && !Array.isArray(rawWeather)
    ? {
        latestDate: stringOrNull(rawWeather.latestDate),
        temperature: finiteReadingOrNull(rawWeather.temperature),
        humidity: finiteReadingOrNull(rawWeather.humidity),
        rain: finiteReadingOrNull(rawWeather.rain),
      }
    : null;

  return { stations, weather };
}

function buildAssistantInput(dataSummary, question) {
  return [
    "Datos verificados de las últimas lecturas del agricultor:",
    JSON.stringify(dataSummary),
    "Consulta del agricultor:",
    question,
  ].join("\n");
}

module.exports = {
  MAX_QUESTION_LENGTH,
  sanitizeAssistantDataSummary,
  buildAssistantInput,
};
