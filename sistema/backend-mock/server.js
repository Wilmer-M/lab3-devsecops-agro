const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const path = require("path");
const nodemailer = require("nodemailer");
const {
  MAX_QUESTION_LENGTH,
  sanitizeAssistantDataSummary,
  buildAssistantInput,
} = require("./assistantValidation");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "sensores_mock.db");

// CONFIGURACIÓN DE CORREO SMTP
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE !== "false",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

let transporter;
if (SMTP_CONFIG.auth.user && SMTP_CONFIG.auth.pass) {
  transporter = nodemailer.createTransport(SMTP_CONFIG);
  console.log("[SMTP] Transportador configurado con credenciales reales.");
} else {
  // Transportador auto-generado de Ethereal para desarrollo fácil
  nodemailer
    .createTestAccount()
    .then((account) => {
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: account.user,
          pass: account.pass,
        },
      });
      console.log(
        "[SMTP] Creada cuenta de pruebas temporal en Ethereal Email.",
      );
      console.log("[SMTP] Cuenta temporal creada para el entorno de desarrollo.");
    })
    .catch((err) => {
      console.error("[SMTP] Error al crear cuenta temporal Ethereal:", err);
    });
}

app.use(express.json());

const LANGFLOW_URL = (process.env.LANGFLOW_URL || "").replace(/\/$/, "");
const LANGFLOW_FLOW_ID = process.env.LANGFLOW_FLOW_ID || "";
const LANGFLOW_API_KEY = process.env.LANGFLOW_API_KEY || "";

function getLangflowAnswer(payload) {
  return (
    payload?.outputs?.[0]?.outputs?.[0]?.results?.message?.text ||
    payload?.output?.text ||
    payload?.result?.text ||
    payload?.text ||
    null
  );
}

// The app sends a compact summary of local readings. In production, replace
// this with an authenticated lookup of synchronized server-side data.
app.post("/api/agricultural-assistant", async (req, res) => {
  const { question, farmerId, sessionId, dataSummary } = req.body || {};
  const cleanQuestion = typeof question === "string" ? question.trim() : "";
  const sanitizedDataSummary = sanitizeAssistantDataSummary(dataSummary);

  if (!cleanQuestion || cleanQuestion.length > MAX_QUESTION_LENGTH) {
    return res
      .status(400)
      .json({
        success: false,
        error: "La consulta debe tener entre 1 y 800 caracteres.",
      });
  }
  if (
    !Number.isInteger(farmerId) ||
    farmerId < 1 ||
    !sanitizedDataSummary
  ) {
    return res
      .status(400)
      .json({ success: false, error: "Faltan datos válidos para analizar." });
  }

  const summary = JSON.stringify(sanitizedDataSummary);
  if (summary.length > 20000) {
    return res
      .status(413)
      .json({
        success: false,
        error: "El resumen de lecturas es demasiado grande.",
      });
  }
  if (!LANGFLOW_URL || !LANGFLOW_FLOW_ID || !LANGFLOW_API_KEY) {
    return res.status(503).json({
      success: false,
      error:
        "El asistente aún no está configurado. Completa LANGFLOW_URL, LANGFLOW_FLOW_ID y LANGFLOW_API_KEY en el servidor.",
    });
  }

  const assistantInput = buildAssistantInput(sanitizedDataSummary, cleanQuestion);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(
      `${LANGFLOW_URL}/api/v1/run/${LANGFLOW_FLOW_ID}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": LANGFLOW_API_KEY,
        },
        body: JSON.stringify({
          input_value: assistantInput,
          input_type: "chat",
          output_type: "chat",
          session_id:
            typeof sessionId === "string" && sessionId.length <= 100
              ? sessionId
              : `farmer-${farmerId}`,
        }),
        signal: controller.signal,
      },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("[Assistant] Langflow error:", response.status, payload);
      return res
        .status(502)
        .json({
          success: false,
          error: "El servicio del asistente no pudo procesar la consulta.",
        });
    }

    const answer = getLangflowAnswer(payload);
    if (!answer) {
      console.error("[Assistant] Unexpected Langflow response:", payload);
      return res
        .status(502)
        .json({
          success: false,
          error: "El asistente devolvió un formato no reconocido.",
        });
    }
    return res.json({ success: true, answer });
  } catch (error) {
    const isTimeout = error?.name === "AbortError";
    console.error("[Assistant] Request failed:", error);
    return res
      .status(504)
      .json({
        success: false,
        error: isTimeout
          ? "El asistente tardó demasiado en responder."
          : "No se pudo conectar con el asistente.",
      });
  } finally {
    clearTimeout(timeout);
  }
});

// Init SQLite DB
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
  } else {
    console.log("Connected to the SQLite database.");
    initializeDatabase();
  }
});

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function initializeDatabase() {
  db.serialize(() => {
    db.run("PRAGMA foreign_keys = ON;");

    // Create Tables
    db.run(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        nombre TEXT,
        rol TEXT,
        finca TEXT,
        correo TEXT DEFAULT '',
        mfa_secret TEXT DEFAULT '',
        intentos_fallidos INTEGER DEFAULT 0,
        bloqueado_hasta TEXT DEFAULT '',
        mfa_tipo TEXT DEFAULT 'none',
        organizacion_id INTEGER,
        FOREIGN KEY(organizacion_id) REFERENCES organizaciones(id) ON DELETE SET NULL
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS organizaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT UNIQUE,
        fecha_registro TEXT
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS sesion_activa (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        fecha_inicio TEXT,
        ultima_actividad TEXT,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS tokens_recuperacion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        token TEXT UNIQUE,
        expira_en TEXT,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS codigos_otp_email (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        codigo TEXT,
        expira_en TEXT,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      );
    `);

    // Migraciones en caliente para DB mock existente
    db.all("PRAGMA table_info(usuarios)", (err, rows) => {
      if (!err && rows) {
        const hasMfaTipo = rows.some((r) => r.name === "mfa_tipo");
        if (!hasMfaTipo) {
          db.run(
            "ALTER TABLE usuarios ADD COLUMN mfa_tipo TEXT DEFAULT 'none';",
          );
        }
        const hasOrgId = rows.some((r) => r.name === "organizacion_id");
        if (!hasOrgId) {
          db.run("ALTER TABLE usuarios ADD COLUMN organizacion_id INTEGER;");
        }
      }
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS lecturas_suelo (
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
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS lecturas_clima (
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
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS historial_nutrientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        sensor TEXT,
        elemento TEXT,
        cantidad REAL,
        fecha TEXT,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      );
    `);

    // Insert mock admin and default worker users for testing
    const adminPass = hashPassword("admin");
    const workerPass = hashPassword("worker123");

    db.run(
      `
      INSERT OR IGNORE INTO usuarios (username, password, nombre, rol, finca)
      VALUES ('admin', ?, 'Administrador General', 'admin', 'Finca Central')
    `,
      [adminPass],
    );

    db.run(
      `
      INSERT OR IGNORE INTO usuarios (username, password, nombre, rol, finca)
      VALUES ('worker1', ?, 'Juan Agricultor', 'agricultor', 'Lote A')
    `,
      [workerPass],
    );

    console.log("Tables initialized and mock users created (admin, worker1).");
  });
}

// ENDPOINTS

// 1. POST /api/register
app.post("/api/register", (req, res) => {
  const { username, password, nombre, finca, correo } = req.body;
  if (!username || !password || !nombre || !finca) {
    return res
      .status(400)
      .json({ success: false, error: "Faltan campos obligatorios" });
  }

  const hashedPassword = hashPassword(password);
  db.run(
    `INSERT INTO usuarios (username, password, nombre, rol, finca, correo)
     VALUES (?, ?, ?, 'agricultor', ?, ?)`,
    [
      username.trim().toLowerCase(),
      hashedPassword,
      nombre,
      finca,
      correo || "",
    ],
    function (err) {
      if (err) {
        if (err.message.includes("UNIQUE constraint failed")) {
          return res
            .status(400)
            .json({ success: false, error: "El usuario ya existe" });
        }
        return res.status(500).json({ success: false, error: err.message });
      }
      res.status(201).json({ success: true, userId: this.lastID });
    },
  );
});

// 2. POST /api/login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ success: false, error: "Usuario y contraseña requeridos" });
  }

  const cleanUser = username.trim().toLowerCase();

  db.get(
    "SELECT * FROM usuarios WHERE username = ?",
    [cleanUser],
    (err, user) => {
      if (err)
        return res.status(500).json({ success: false, error: err.message });
      if (!user)
        return res
          .status(401)
          .json({ success: false, error: "Usuario o contraseña incorrectos" });

      // Check block
      if (user.bloqueado_hasta) {
        const lockTime = new Date(user.bloqueado_hasta).getTime();
        const now = Date.now();
        if (now < lockTime) {
          return res
            .status(403)
            .json({ success: false, error: "Cuenta bloqueada temporalmente" });
        }
      }

      const isMatch = bcrypt.compareSync(password, user.password);
      if (isMatch) {
        // Success, reset failed attempts
        db.run(
          'UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = "" WHERE id = ?',
          [user.id],
        );

        // Active session
        db.run(
          "DELETE FROM sesion_activa WHERE usuario_id = ?",
          [user.id],
          () => {
            db.run(
              "INSERT INTO sesion_activa (usuario_id, fecha_inicio, ultima_actividad) VALUES (?, ?, ?)",
              [user.id, new Date().toISOString(), new Date().toISOString()],
            );
          },
        );

        return res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            nombre: user.nombre,
            rol: user.rol,
            finca: user.finca,
          },
        });
      } else {
        // Increment failed attempts
        const attempts = user.intentos_fallidos + 1;
        let blockedUntil = "";
        if (attempts >= 5) {
          blockedUntil = new Date(Date.now() + 15000).toISOString(); // 15s lock
        }
        db.run(
          "UPDATE usuarios SET intentos_fallidos = ?, bloqueado_hasta = ? WHERE id = ?",
          [attempts, blockedUntil, user.id],
          () => {
            if (attempts >= 5) {
              return res.status(403).json({
                success: false,
                error: "Cuenta bloqueada por 15 segundos",
              });
            }
            return res.status(401).json({
              success: false,
              error: `Contraseña incorrecta. Intento ${attempts} de 5.`,
            });
          },
        );
      }
    },
  );
});

// 3. POST /api/suelo (Unitaria)
app.post("/api/suelo", (req, res) => {
  const { usuario_id, sensor_id, fecha, humedad, nitrogeno, fosforo, potasio } =
    req.body;

  if (!usuario_id || !sensor_id || !fecha) {
    return res
      .status(400)
      .json({ success: false, error: "Faltan campos obligatorios" });
  }

  db.run(
    `INSERT OR IGNORE INTO lecturas_suelo (usuario_id, sensor_id, fecha, humedad, nitrogeno, fosforo, potasio)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [usuario_id, sensor_id, fecha, humedad, nitrogeno, fosforo, potasio],
    function (err) {
      if (err)
        return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, rowId: this.lastID });
    },
  );
});

// Inserción Masiva para simular subida de planillas Excel
app.post("/api/suelo/bulk", (req, res) => {
  const { usuario_id, data } = req.body;
  if (!usuario_id || !Array.isArray(data)) {
    return res
      .status(400)
      .json({ success: false, error: "Faltan datos o formato incorrecto" });
  }

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO lecturas_suelo (usuario_id, sensor_id, fecha, humedad, nitrogeno, fosforo, potasio)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    data.forEach((item) => {
      stmt.run([
        usuario_id,
        item.sensor_id,
        item.fecha,
        item.humedad,
        item.nitrogeno,
        item.fosforo,
        item.potasio,
      ]);
    });
    db.run("COMMIT", (err) => {
      if (err)
        return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, count: data.length });
    });
  });
  stmt.finalize();
});

// 4. GET /api/suelo/:userId
app.get("/api/suelo/:userId", (req, res) => {
  const userId = req.params.userId;
  db.all(
    "SELECT * FROM lecturas_suelo WHERE usuario_id = ? ORDER BY fecha ASC",
    [userId],
    (err, rows) => {
      if (err)
        return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, data: rows });
    },
  );
});

// 5. POST /api/clima
app.post("/api/clima", (req, res) => {
  const { usuario_id, fecha, temperatura, humedad, presion, lluvia } = req.body;
  if (!usuario_id || !fecha) {
    return res
      .status(400)
      .json({ success: false, error: "Faltan campos obligatorios" });
  }

  db.run(
    `INSERT OR IGNORE INTO lecturas_clima (usuario_id, fecha, temperatura, humedad, presion, lluvia)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [usuario_id, fecha, temperatura, humedad, presion, lluvia],
    function (err) {
      if (err)
        return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, rowId: this.lastID });
    },
  );
});

// 6. GET /api/clima/:userId
app.get("/api/clima/:userId", (req, res) => {
  const userId = req.params.userId;
  db.all(
    "SELECT * FROM lecturas_clima WHERE usuario_id = ? ORDER BY fecha ASC",
    [userId],
    (err, rows) => {
      if (err)
        return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, data: rows });
    },
  );
});

// 7. POST /api/nutrientes
app.post("/api/nutrientes", (req, res) => {
  const { usuario_id, sensor, elemento, cantidad, fecha } = req.body;
  if (!usuario_id || !sensor || !elemento || !cantidad || !fecha) {
    return res
      .status(400)
      .json({ success: false, error: "Faltan campos obligatorios" });
  }

  db.run(
    `INSERT INTO historial_nutrientes (usuario_id, sensor, elemento, cantidad, fecha)
     VALUES (?, ?, ?, ?, ?)`,
    [usuario_id, sensor, elemento, cantidad, fecha],
    function (err) {
      if (err)
        return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, rowId: this.lastID });
    },
  );
});

// 8. GET /api/nutrientes/:userId
app.get("/api/nutrientes/:userId", (req, res) => {
  const userId = req.params.userId;
  db.all(
    "SELECT * FROM historial_nutrientes WHERE usuario_id = ? ORDER BY fecha DESC",
    [userId],
    (err, rows) => {
      if (err)
        return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, data: rows });
    },
  );
});

// 9. POST /api/enviar-otp
app.post("/api/enviar-otp", (req, res) => {
  const { correo, codigo, nombre } = req.body;
  if (!correo || !codigo) {
    return res
      .status(400)
      .json({ success: false, error: "Correo y código OTP son requeridos" });
  }

  const cleanNombre = escapeHtml(nombre || "Usuario de AgroSmart");
  const cleanCodigo = escapeHtml(codigo);

  const mailOptions = {
    from: '"AgroSmart Notificaciones" <noreply@agrosmart.com>',
    to: correo,
    subject: "Código de Verificación AgroSmart",
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="font-size: 32px;">🌾</span>
          <h2 style="margin-top: 10px; color: #0f172a; font-weight: 800;">AgroSmart</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: -5px;">Monitoreo Inteligente de Cultivos</p>
        </div>
        <div style="height: 1px; background-color: #f1f5f9; margin-bottom: 20px;"></div>
        <p style="font-size: 14px; color: #334155; line-height: 20px;">Hola <strong style="color: #0f172a;">${cleanNombre}</strong>,</p>
        <p style="font-size: 14px; color: #334155; line-height: 20px;">Se ha solicitado un acceso a tu cuenta que requiere verificación en dos pasos. Utiliza el siguiente código OTP de seguridad:</p>
        
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; text-align: center; margin: 24px 0;">
          <span style="font-size: 10px; font-weight: 800; color: #166534; letter-spacing: 1.5px; text-transform: uppercase;">CÓDIGO DE VERIFICACIÓN</span>
          <div style="font-size: 32px; font-weight: 900; color: #16a34a; letter-spacing: 4px; margin-top: 6px;">${cleanCodigo}</div>
        </div>

        <p style="font-size: 11px; color: #94a3b8; line-height: 16px; text-align: center;">Este código expira en 5 minutos. Si no has intentado iniciar sesión en AgroSmart, ignora este correo de forma segura.</p>
        <div style="height: 1px; background-color: #f1f5f9; margin-top: 24px; margin-bottom: 16px;"></div>
        <p style="font-size: 10px; color: #94a3b8; text-align: center; margin: 0;">© 2026 AgroSmart Inc. Todos los derechos reservados.</p>
      </div>
    `,
  };

  if (!transporter) {
    console.log(
      `[SMTP Offline] No configurado. Código OTP para ${correo}: ${codigo}`,
    );
    return res.json({
      success: true,
      warning: "SMTP offline, OTP impreso en consola",
    });
  }

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error("[SMTP] Error enviando correo:", err);
      return res
        .status(500)
        .json({ success: false, error: "No se pudo enviar el correo" });
    }
    console.log("[SMTP] Correo enviado con éxito a:", correo);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log("[SMTP] Previsualiza el correo de pruebas aquí:", previewUrl);
      return res.json({ success: true, preview: previewUrl });
    }
    res.json({ success: true });
  });
});

app.use(express.static(__dirname));

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard_pruebas_rendimiento.html"));
});

app.get("/history", (req, res) => {
  res.sendFile(path.join(__dirname, "history_dashboard.html"));
});

app.listen(PORT, () => {
  console.log(`Mock Agro API Server listening at http://localhost:${PORT}`);
  console.log(
    `Dashboard de pruebas disponible en http://localhost:${PORT}/dashboard`,
  );
});
