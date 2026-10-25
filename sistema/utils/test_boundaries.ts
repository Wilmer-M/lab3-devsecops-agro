import { validateSensorValue, SENSOR_LIMITS } from "./validator";

const testValues = [
  { val: -1, expected: null, desc: "Fuera de límite inferior (Inválido)" },
  { val: 0, expected: 0, desc: "Límite exacto inferior (Válido)" },
  { val: 1, expected: 1, desc: "Justo encima del límite inferior (Válido)" },
  { val: 50, expected: 50, desc: "Valor medio (Válido)" },
  { val: 99, expected: 99, desc: "Justo debajo del límite superior (Válido)" },
  { val: 100, expected: 100, desc: "Límite exacto superior (Válido)" },
  { val: 101, expected: null, desc: "Fuera de límite superior (Inválido)" }
];

console.log("==================================================");
console.log("=== PRUEBA DE REGRESIÓN: VALORES LÍMITE SUELO (HUMEDAD 0-100%) ===");
console.log("==================================================");

let totalTests = 0;
let passedTests = 0;

testValues.forEach(({ val, expected, desc }) => {
  totalTests++;
  const result = validateSensorValue(val, SENSOR_LIMITS.suelo.humedad.min, SENSOR_LIMITS.suelo.humedad.max);
  
  if (result === expected) {
    passedTests++;
    console.log(`✅ PASÓ | Valor: ${val.toString().padStart(4)} | Esperaba: ${expected === null ? "null" : expected} | Obtuve: ${result === null ? "null" : result} | [${desc}]`);
  } else {
    console.log(`❌ FALLÓ | Valor: ${val.toString().padStart(4)} | Esperaba: ${expected === null ? "null" : expected} | Obtuve: ${result === null ? "null" : result} | [${desc}]`);
  }
});

console.log("==================================================");
console.log(`RESULTADO FINAL: ${passedTests}/${totalTests} pruebas exitosas.`);
console.log("==================================================");

if (passedTests === totalTests) {
  console.log("🎉 ¡ÉXITO! La prueba de regresión pasó correctamente. La lógica de validación es estable.");
  process.exit(0);
} else {
  console.log("🚨 ¡ERROR! Se ha detectado una regresión en la lógica de validación.");
  process.exit(1);
}
