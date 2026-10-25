import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { SQLiteDatabase } from "expo-sqlite";
import { Platform } from "react-native";

/**
 * Exporta los datos de suelo o clima de un agricultor a formato CSV y abre el menú de compartir.
 */
export const exportUserDataToCSV = async (
  db: SQLiteDatabase,
  userId: number,
  username: string,
  type: "suelo" | "clima"
): Promise<{ success: boolean; error?: string }> => {
  try {
    let csvContent = "";
    const fileName = `${username}_datos_${type}.csv`;

    if (type === "suelo") {
      // Obtener lecturas de suelo - CONSULTA PARAMETRIZADA
      const rows: any[] = await db.getAllAsync(
        "SELECT sensor_id, fecha, humedad, nitrogeno, fosforo, potasio FROM lecturas_suelo WHERE usuario_id = ? ORDER BY fecha ASC",
        [userId]
      );

      csvContent = "Sensor,Fecha,Humedad(%),Nitrógeno(mg/kg),Fósforo(mg/kg),Potasio(mg/kg)\n";
      rows.forEach((row) => {
        csvContent += `${row.sensor_id},${row.fecha},${row.humedad ?? ""},${row.nitrogeno ?? ""},${row.fosforo ?? ""},${row.potasio ?? ""}\n`;
      });
    } else {
      // Obtener lecturas de clima - CONSULTA PARAMETRIZADA
      const rows: any[] = await db.getAllAsync(
        "SELECT fecha, temperatura, humedad, presion, lluvia FROM lecturas_clima WHERE usuario_id = ? ORDER BY fecha ASC",
        [userId]
      );

      csvContent = "Fecha,Temperatura(°C),Humedad(%),Presión(mb),Lluvia(mm)\n";
      rows.forEach((row) => {
        csvContent += `${row.fecha},${row.temperatura ?? ""},${row.humedad ?? ""},${row.presion ?? ""},${row.lluvia ?? ""}\n`;
      });
    }

    if (Platform.OS === "web") {
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return { success: true };
    } else {
      // Almacenamiento local temporal nativo
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Compartir archivo nativo
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: `Exportar datos de ${type === "suelo" ? "suelo" : "clima"}`,
          UTI: "public.comma-separated-values-text",
        });
        return { success: true };
      } else {
        return { success: false, error: "El servicio de compartir archivos no está disponible" };
      }
    }
  } catch (error) {
    console.error("Error al exportar datos:", error);
    return { success: false, error: "Error al exportar los datos" };
  }
};

/**
 * Exporta el archivo físico de la base de datos SQLite (.db) usando el menú nativo de compartir.
 */
export const exportDatabaseFile = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    if (Platform.OS === "web") {
      return { success: false, error: "La exportación de la base de datos completa no está soportada en Web" };
    }

    const dbUri = `${FileSystem.documentDirectory}SQLite/agro.db`;

    // Verificar si el archivo existe
    const fileInfo = await FileSystem.getInfoAsync(dbUri);
    if (!fileInfo.exists) {
      return { success: false, error: "El archivo de base de datos 'agro.db' no existe todavía." };
    }

    // Compartir el archivo nativo
    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (isSharingAvailable) {
      await Sharing.shareAsync(dbUri, {
        mimeType: "application/x-sqlite3",
        dialogTitle: "Exportar base de datos agro.db",
        UTI: "public.sqlite3-database",
      });
      return { success: true };
    } else {
      return { success: false, error: "El servicio de compartir archivos no está disponible" };
    }
  } catch (error) {
    console.error("Error al exportar base de datos:", error);
    return { success: false, error: "Error al exportar la base de datos" };
  }
};

