import * as SQLite from "expo-sqlite";
import { hashPassword, isHashed, isExpoHash } from "./crypto";
import { SENSOR_LIMITS, validateSensorValue } from "./validator";

let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const SCHEMA_VERSION = 5;

const DROP_ALL_TABLES = `
  DROP TABLE IF EXISTS log_sucesos;
  DROP TABLE IF EXISTS mfa_intentos;
  DROP TABLE IF EXISTS codigos_otp_email;
  DROP TABLE IF EXISTS organizaciones;
  DROP TABLE IF EXISTS sesion_activa;
  DROP TABLE IF EXISTS tokens_recuperacion;
  DROP TABLE IF EXISTS historial_nutrientes;
  DROP TABLE IF EXISTS lecturas_clima;
  DROP TABLE IF EXISTS lecturas_suelo;
  DROP TABLE IF EXISTS usuarios;
  DROP TABLE IF EXISTS _schema_version;
`;

/**
 * Obtiene la instancia de la base de datos.
 * Si no existe, la abre y crea las tablas necesarias con soporte multiusuario.
 */
export const getDB = async () => {
  if (dbInstance) return dbInstance;
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    try {
      const db = await SQLite.openDatabaseAsync("agro.db", {
        useNewConnection: true,
      });

      // Verificar versión del esquema y reiniciar si cambió
      try {
        const row: any = await db.getFirstAsync(
          "SELECT version FROM _schema_version LIMIT 1",
        );
        if (!row || row.version !== SCHEMA_VERSION) {
          await db.execAsync(DROP_ALL_TABLES);
        }
      } catch {
        await db.execAsync(DROP_ALL_TABLES);
      }

      await db.execAsync(
        "CREATE TABLE IF NOT EXISTS _schema_version (version INTEGER)",
      );
      await db.runAsync("DELETE FROM _schema_version");
      await db.runAsync("INSERT INTO _schema_version (version) VALUES (?)", [
        SCHEMA_VERSION,
      ]);

      // Inicialización de esquema
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS usuarios (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE,
          password TEXT,
          nombre TEXT,
          rol TEXT,
          finca TEXT,
          correo TEXT DEFAULT '',
          mfa_secret TEXT DEFAULT '',
          mfa_tipo TEXT DEFAULT 'totp',
          organizacion_id INTEGER DEFAULT NULL,
          intentos_fallidos INTEGER DEFAULT 0,
          bloqueado_hasta TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS sesion_activa (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          usuario_id INTEGER,
          fecha_inicio TEXT,
          ultima_actividad TEXT,
          FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS tokens_recuperacion (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          usuario_id INTEGER,
          token TEXT UNIQUE,
          expira_en TEXT,
          FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        );
      `);

      // Verificar y migrar base de datos existente si faltan las columnas de seguridad
      const userTableInfo: any[] = await db.getAllAsync(
        "PRAGMA table_info(usuarios)",
      );

      const hasCorreo = userTableInfo.some((col) => col.name === "correo");
      if (!hasCorreo) {
        await db.execAsync(
          "ALTER TABLE usuarios ADD COLUMN correo TEXT DEFAULT '';",
        );
      }

      const hasMfaSecret = userTableInfo.some(
        (col) => col.name === "mfa_secret",
      );
      if (!hasMfaSecret) {
        await db.execAsync(
          "ALTER TABLE usuarios ADD COLUMN mfa_secret TEXT DEFAULT '';",
        );
      }

      const hasIntentos = userTableInfo.some(
        (col) => col.name === "intentos_fallidos",
      );
      if (!hasIntentos) {
        await db.execAsync(
          "ALTER TABLE usuarios ADD COLUMN intentos_fallidos INTEGER DEFAULT 0;",
        );
      }

      const hasBloqueado = userTableInfo.some(
        (col) => col.name === "bloqueado_hasta",
      );
      if (!hasBloqueado) {
        await db.execAsync(
          "ALTER TABLE usuarios ADD COLUMN bloqueado_hasta TEXT DEFAULT '';",
        );
      }

      const hasMfaTipo = userTableInfo.some((col) => col.name === "mfa_tipo");
      if (!hasMfaTipo) {
        await db.execAsync(
          "ALTER TABLE usuarios ADD COLUMN mfa_tipo TEXT DEFAULT 'totp';",
        );
      }

      const hasOrgId = userTableInfo.some(
        (col) => col.name === "organizacion_id",
      );
      if (!hasOrgId) {
        await db.execAsync(
          "ALTER TABLE usuarios ADD COLUMN organizacion_id INTEGER DEFAULT NULL;",
        );
      }

      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS log_sucesos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          usuario_id INTEGER,
          username TEXT,
          tipo TEXT,
          detalle TEXT,
          fecha TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS mfa_intentos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          usuario_id INTEGER UNIQUE,
          intentos INTEGER DEFAULT 0,
          bloqueado_hasta TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS codigos_otp_email (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          usuario_id INTEGER,
          codigo TEXT,
          expira_en TEXT,
          FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS organizaciones (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT UNIQUE,
          fecha_registro TEXT
        );
      `);

      // Verificar si ya existe soporte multiusuario (columna usuario_id en lecturas_suelo)
      const tableInfo: any[] = await db.getAllAsync(
        "PRAGMA table_info(lecturas_suelo)",
      );
      const hasUserColumn = tableInfo.some((col) => col.name === "usuario_id");

      if (!hasUserColumn) {
        // Recrear tablas para soportar el esquema multiusuario y restricciones UNIQUE compuestas
        await db.execAsync(`
          DROP TABLE IF EXISTS lecturas_suelo;
          DROP TABLE IF EXISTS lecturas_clima;
          DROP TABLE IF EXISTS historial_nutrientes;
          
          CREATE TABLE lecturas_suelo (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER,
            sensor_id TEXT,
            fecha TEXT,
            humedad REAL,
            nitrogeno REAL,
            fosforo REAL,
            potasio REAL,
            UNIQUE(usuario_id, sensor_id, fecha),
            FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
          );
          
          CREATE TABLE lecturas_clima (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER,
            fecha TEXT,
            temperatura REAL,
            humedad REAL,
            presion REAL,
            lluvia REAL,
            UNIQUE(usuario_id, fecha),
            FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
          );
          
          CREATE TABLE historial_nutrientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER,
            sensor TEXT,
            elemento TEXT,
            cantidad REAL,
            fecha TEXT,
            FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
          );
        `);
      }

      // Insertar administrador por defecto de forma segura (ignorar si ya existe)
      const hashedAdminPassword = await hashPassword("admin");
      await db.runAsync(
        `INSERT OR IGNORE INTO usuarios (username, password, nombre, rol, finca) 
         VALUES ('admin', ?, 'Administrador', 'admin', '')`,
        [hashedAdminPassword],
      );

      // Insertar superadmin por defecto
      const hashedSuperPassword = await hashPassword("superadmin");
      await db.runAsync(
        `INSERT OR IGNORE INTO usuarios (username, password, nombre, rol, finca) 
         VALUES ('superadmin', ?, 'Super Administrador', 'superadmin', '')`,
        [hashedSuperPassword],
      );

      // Migración de contraseñas legadas en texto plano a hasheadas
      try {
        const legacyUsers: any[] = await db.getAllAsync(
          "SELECT id, password FROM usuarios",
        );
        for (const u of legacyUsers) {
          if (u.password && !isHashed(u.password)) {
            const hashed = await hashPassword(u.password);
            await db.runAsync("UPDATE usuarios SET password = ? WHERE id = ?", [
              hashed,
              u.id,
            ]);
            console.log(
              `[DB Migration] Contraseña del usuario con ID ${u.id} migrada a bcrypt.`,
            );
          }
        }
      } catch (migrationError) {
        console.error("Error al migrar contraseñas legacy:", migrationError);
      }

      // Migrar contraseñas $expo$ legacy a bcrypt (reset con pass temporal)
      try {
        const expoUsers: any[] = await db.getAllAsync(
          "SELECT id, username, password FROM usuarios WHERE password LIKE '$expo$%'"
        );
        for (const u of expoUsers) {
          if (isExpoHash(u.password)) {
            const tempPass = "reset_" + Math.random().toString(36).slice(2, 8);
            const newHash = await hashPassword(tempPass);
            await db.runAsync("UPDATE usuarios SET password = ? WHERE id = ?", [newHash, u.id]);
            console.log(
              `[DB Migration] Usuario ${u.username} (ID ${u.id}): hash $expo$ migrado a bcrypt. Nueva contraseña: ${tempPass}`
            );
          }
        }
      } catch (expoError) {
        console.error("Error al migrar contraseñas $expo$:", expoError);
      }

      dbInstance = db;
      return db;
    } catch (error) {
      console.error("Error inicializando la base de datos:", error);
      dbPromise = null; // Reiniciar en caso de error para permitir reintentos
      throw error;
    }
  })();

  return dbPromise;
};

// Mantenemos los nombres antiguos por compatibilidad
export const initDB = getDB;

// Función para guardar datos de suelo masivamente asociados a un usuario
export const saveSueloData = async (
  db: SQLite.SQLiteDatabase,
  parsedData: any,
  userId: number,
) => {
  try {
    for (const sensor of Object.keys(parsedData)) {
      const { fechas, Humedad, Nitrogeno, Fosforo, Potasio } =
        parsedData[sensor];

      for (let i = 0; i < fechas.length; i++) {
        // Aplicamos validación de valores límite
        const hum = validateSensorValue(
          Humedad[i],
          SENSOR_LIMITS.suelo.humedad.min,
          SENSOR_LIMITS.suelo.humedad.max,
        );
        const nit = validateSensorValue(
          Nitrogeno[i],
          SENSOR_LIMITS.suelo.nitrogeno.min,
          SENSOR_LIMITS.suelo.nitrogeno.max,
        );
        const fos = validateSensorValue(
          Fosforo[i],
          SENSOR_LIMITS.suelo.fosforo.min,
          SENSOR_LIMITS.suelo.fosforo.max,
        );
        const pot = validateSensorValue(
          Potasio[i],
          SENSOR_LIMITS.suelo.potasio.min,
          SENSOR_LIMITS.suelo.potasio.max,
        );

        // CONSULTA PARAMETRIZADA SEGURA
        await db.runAsync(
          `INSERT OR IGNORE INTO lecturas_suelo (usuario_id, sensor_id, fecha, humedad, nitrogeno, fosforo, potasio) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [userId, sensor, fechas[i], hum, nit, fos, pot],
        );
      }
    }
  } catch (error) {
    console.error("Error guardando suelo en SQLite:", error);
  }
};

// Función para guardar datos de clima asociados a un usuario
export const saveClimaData = async (
  db: SQLite.SQLiteDatabase,
  parsedData: any,
  userId: number,
) => {
  try {
    const sensorNames = Object.keys(parsedData);
    if (sensorNames.length === 0) return;

    const sensorName = sensorNames[0];
    const { fechas, Temperatura, Humedad, Presion, Lluvia } =
      parsedData[sensorName];

    for (let i = 0; i < fechas.length; i++) {
      // Aplicamos validación de valores límite para clima
      const temp = validateSensorValue(
        Temperatura[i],
        SENSOR_LIMITS.clima.temperatura.min,
        SENSOR_LIMITS.clima.temperatura.max,
      );
      const hum = validateSensorValue(
        Humedad[i],
        SENSOR_LIMITS.clima.humedad.min,
        SENSOR_LIMITS.clima.humedad.max,
      );
      const pres = validateSensorValue(
        Presion[i],
        SENSOR_LIMITS.clima.presion.min,
        SENSOR_LIMITS.clima.presion.max,
      );
      const rain = validateSensorValue(
        Lluvia[i],
        SENSOR_LIMITS.clima.lluvia.min,
        SENSOR_LIMITS.clima.lluvia.max,
      );

      // CONSULTA PARAMETRIZADA SEGURA
      await db.runAsync(
        `INSERT OR IGNORE INTO lecturas_clima (usuario_id, fecha, temperatura, humedad, presion, lluvia) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, fechas[i], temp, hum, pres, rain],
      );
    }
  } catch (error) {
    console.error("Error guardando clima en SQLite:", error);
  }
};

// Función para obtener todos los datos formateados para la app de un usuario específico
export const getAllData = async (db: SQLite.SQLiteDatabase, userId: number) => {
  const result: any = { suelo: {}, clima: {} };

  try {
    // Obtener Suelo filtrado por usuario_id - CONSULTA PARAMETRIZADA
    const sueloRows: any[] = await db.getAllAsync(
      "SELECT * FROM lecturas_suelo WHERE usuario_id = ? ORDER BY fecha ASC",
      [userId],
    );
    sueloRows.forEach((row) => {
      if (!result.suelo[row.sensor_id]) {
        result.suelo[row.sensor_id] = {
          fechas: [],
          Humedad: [],
          Nitrogeno: [],
          Fosforo: [],
          Potasio: [],
        };
      }
      result.suelo[row.sensor_id].fechas.push(row.fecha);
      result.suelo[row.sensor_id].Humedad.push(row.humedad);
      result.suelo[row.sensor_id].Nitrogeno.push(row.nitrogeno);
      result.suelo[row.sensor_id].Fosforo.push(row.fosforo);
      result.suelo[row.sensor_id].Potasio.push(row.potasio);
    });

    // Obtener Clima filtrado por usuario_id - CONSULTA PARAMETRIZADA
    const climaRows: any[] = await db.getAllAsync(
      "SELECT * FROM lecturas_clima WHERE usuario_id = ? ORDER BY fecha ASC",
      [userId],
    );
    if (climaRows.length > 0) {
      result.clima["Estacion 1"] = {
        fechas: climaRows.map((r) => r.fecha),
        Temperatura: climaRows.map((r) => r.temperatura),
        Humedad: climaRows.map((r) => r.humedad),
        Presion: climaRows.map((r) => r.presion),
        Lluvia: climaRows.map((r) => r.lluvia),
      };
    }
  } catch (error) {
    console.error("Error obteniendo datos de SQLite:", error);
  }

  return result;
};

// Función para guardar un registro de aplicación en el historial de un usuario específico
export const saveHistoryItem = async (
  db: SQLite.SQLiteDatabase,
  item: {
    sensor: string;
    elemento: "N" | "P" | "K";
    cantidad: number;
    fecha: string;
  },
  userId: number,
) => {
  try {
    // CONSULTA PARAMETRIZADA SEGURA
    await db.runAsync(
      `INSERT INTO historial_nutrientes (usuario_id, sensor, elemento, cantidad, fecha) VALUES (?, ?, ?, ?, ?)`,
      [userId, item.sensor, item.elemento, item.cantidad, item.fecha],
    );
  } catch (error) {
    console.error("Error guardando item de historial en SQLite:", error);
  }
};

// Función para obtener todos los registros del historial de un usuario específico
export const getHistory = async (db: SQLite.SQLiteDatabase, userId: number) => {
  try {
    // CONSULTA PARAMETRIZADA SEGURA
    const rows: any[] = await db.getAllAsync(
      "SELECT sensor, elemento, cantidad, fecha FROM historial_nutrientes WHERE usuario_id = ? ORDER BY fecha DESC",
      [userId],
    );
    return rows.map((row) => ({
      sensor: row.sensor,
      elemento: row.elemento as "N" | "P" | "K",
      cantidad: row.cantidad,
      fecha: row.fecha,
    }));
  } catch (error) {
    console.error("Error obteniendo historial de SQLite:", error);
    return [];
  }
};

// Función para limpiar todos los datos de la base de datos de un usuario específico
export const clearDatabase = async (
  db: SQLite.SQLiteDatabase,
  userId: number,
) => {
  try {
    // CONSULTA PARAMETRIZADA SEGURA
    await db.runAsync("DELETE FROM lecturas_suelo WHERE usuario_id = ?", [
      userId,
    ]);
    await db.runAsync("DELETE FROM lecturas_clima WHERE usuario_id = ?", [
      userId,
    ]);
    await db.runAsync("DELETE FROM historial_nutrientes WHERE usuario_id = ?", [
      userId,
    ]);
    console.log(`Base de datos del usuario ${userId} limpia correctamente`);
  } catch (error) {
    console.error("Error al limpiar la base de datos:", error);
    throw error;
  }
};

export const addLogEntry = async (
  db: SQLite.SQLiteDatabase,
  usuarioId: number,
  username: string,
  tipo: string,
  detalle: string,
) => {
  try {
    await db.runAsync(
      "INSERT INTO log_sucesos (usuario_id, username, tipo, detalle) VALUES (?, ?, ?, ?)",
      [usuarioId, username, tipo, detalle],
    );
  } catch (error) {
    console.error("Error al añadir entrada de log:", error);
  }
};
