import { read, utils } from "xlsx";

export async function parseExcelClima(buffer: Uint8Array) {
  try {
    const workbook = read(buffer, { type: "array", cellDates: true });

    const result: any = {};

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const raw = utils.sheet_to_json<any[]>(worksheet, {
        header: 1,
        defval: null,
        raw: true,
      });

      if (raw.length < 2) return;

      const headerIndex = raw.findIndex((row: any) =>
        row?.[0]?.includes("Date & Time"),
      );

      if (headerIndex === -1) {
        console.log("No se encontró header");
        return;
      }

      const headerRow = raw[headerIndex] as any[];
      const headerText = headerRow[0] || "";
      const headers = String(headerText).split(";");

      const fechas: string[] = [];
      const Temperatura: (number | null)[] = [];
      const Humedad: (number | null)[] = [];
      const Presion: (number | null)[] = [];
      const Lluvia: (number | null)[] = [];

      for (let i = headerIndex + 1; i < raw.length; i++) {
        const row = raw[i] as any[];
        if (!row || row.length === 0) continue;

        const line = row[0];
        if (!line || typeof line !== "string") continue;

        const values = String(line).split(";");
        if (values.length !== headers.length) continue;

        const rowData: any = {};
        headers.forEach((h: string, index: number) => {
          rowData[h.trim()] = values[index];
        });

        const fecha = rowData["Date & Time"];
        if (!fecha) continue;

        fechas.push(fecha);

        const temp = safeNumber(rowData["Temp - °C"]);
        const hum = safeNumber(rowData["Hum - %"]);
        const pres = safeNumber(rowData["Barometer - mb"]);
        const rain = safeNumber(rowData["Rain - mm"]);

        Temperatura.push(temp);
        Humedad.push(hum);
        Presion.push(pres);
        Lluvia.push(rain);
      }

      result["Estacion 1"] = {
        fechas,
        Temperatura,
        Humedad,
        Presion,
        Lluvia,
      };
    });

    return result;
  } catch (error) {
    console.error("Error parseando clima:", error);
    return null;
  }
}

function safeNumber(value: any): number | null {
  const n = parseFloat(value);
  return Number.isNaN(n) ? null : n;
}
