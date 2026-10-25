const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildAssistantInput,
  sanitizeAssistantDataSummary,
} = require("./assistantValidation");

test("descarta -1, NaN y campos ajenos del contexto enviado al modelo", () => {
  const summary = sanitizeAssistantDataSummary({
    stations: [
      {
        name: "Lote A",
        latestDate: "2026-09-27",
        readings: { humedad: 28, nitrogeno: -1, fosforo: "no disponible", potasio: 45 },
        ignoredField: "no debe salir del backend",
      },
    ],
    weather: { latestDate: "2026-09-27", temperature: -1, humidity: 81, rain: 2 },
    injectedField: "no debe salir del backend",
  });

  assert.deepEqual(summary, {
    stations: [{
      name: "Lote A",
      latestDate: "2026-09-27",
      readings: { humedad: 28, nitrogeno: null, fosforo: null, potasio: 45 },
    }],
    weather: { latestDate: "2026-09-27", temperature: null, humidity: 81, rain: 2 },
  });
});

test("rechaza un contexto que no sea un objeto", () => {
  assert.equal(sanitizeAssistantDataSummary(null), null);
  assert.equal(sanitizeAssistantDataSummary([]), null);
  assert.equal(sanitizeAssistantDataSummary("lecturas"), null);
});

test("construye el prompt solo con el resumen saneado y la pregunta", () => {
  const summary = sanitizeAssistantDataSummary({
    stations: [{ name: "Lote B", latestDate: "2026-09-27", readings: { humedad: 30 } }],
    weather: null,
  });
  const input = buildAssistantInput(summary, "¿Cómo está la humedad?");

  assert.match(input, /Lote B/);
  assert.match(input, /¿Cómo está la humedad\?/);
  assert.doesNotMatch(input, /undefined/);
});
