import { read, utils } from "xlsx";

export async function parseExcelFromBuffer(buffer: Uint8Array) {
  try {
    const workbook = read(buffer, { type: "array", cellDates: true });

    const sensores: any = {};

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const rows = utils.sheet_to_json<any[]>(worksheet, {
        header: 1,
        defval: null,
        raw: true,
      });

      if (rows.length < 2) return;

      const headerRow = rows[0] as any[];
      if (!headerRow) return;

      const colIndex = (name: string) => {
        const idx = headerRow.findIndex(
          (h) => typeof h === "string" && h.trim() === name,
        );
        return idx !== -1 ? idx : -1;
      };

      const idxHum = colIndex("Humedad_%");
      const idxNit = colIndex("Nitrogeno_mg_kg");
      const idxFos = colIndex("Fosforo_mg_kg");
      const idxPot = colIndex("Potasio_mg_kg");
      const idxFecha = colIndex("FechaHora");

      if (idxFecha === -1) return;

      const porDia: any = {};

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] as any[];
        if (!row || row.length === 0) continue;

        const rawFecha = row[idxFecha];
        const dia = excelDateToISO(rawFecha);
        if (!dia) continue;

        if (!porDia[dia]) {
          porDia[dia] = {
            Humedad: [],
            Nitrogeno: [],
            Fosforo: [],
            Potasio: [],
          };
        }

        if (idxHum !== -1 && Number.isFinite(row[idxHum]))
          porDia[dia].Humedad.push(+row[idxHum]);
        if (idxNit !== -1 && Number.isFinite(row[idxNit]))
          porDia[dia].Nitrogeno.push(+row[idxNit]);
        if (idxFos !== -1 && Number.isFinite(row[idxFos]))
          porDia[dia].Fosforo.push(+row[idxFos]);
        if (idxPot !== -1 && Number.isFinite(row[idxPot]))
          porDia[dia].Potasio.push(+row[idxPot]);
      }

      const promedio = (arr: number[]) =>
        arr.length
          ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2))
          : null;

      const fechas = Object.keys(porDia);

      sensores[sheetName] = {
        fechas,
        Humedad: fechas.map((f) => promedio(porDia[f].Humedad)),
        Nitrogeno: fechas.map((f) => promedio(porDia[f].Nitrogeno)),
        Fosforo: fechas.map((f) => promedio(porDia[f].Fosforo)),
        Potasio: fechas.map((f) => promedio(porDia[f].Potasio)),
      };
    });

    return sensores;
  } catch (error) {
    console.error("Error parseando Excel:", error);
    return null;
  }
}

function excelDateToISO(value: any): string | null {
  if (typeof value === "number") {
    const date = dateFromSerial(value);
    if (!date) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  if (typeof value === "string") {
    const clean = value.split(" ")[0];
    const [day, month, year] = clean.split("/");
    if (!day || !month || !year) return null;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }

  return null;
}

function dateFromSerial(serial: number): Date | null {
  if (serial < 1 || serial > 2958465) return null;
  const adjusted = serial - 1;
  const days = Math.floor(adjusted);
  const totalSeconds = Math.round((adjusted - days) * 86400);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const date = new Date(Date.UTC(1899, 11, 31, hours, minutes, seconds));
  date.setUTCDate(date.getUTCDate() + days);
  if (serial >= 60) date.setUTCDate(date.getUTCDate() - 1);
  return date;
}
