import express from "express";
import cors from "cors";
import { Resend } from "resend";
import rateLimit from "express-rate-limit";
import "dotenv/config"; // Carga las variables de entorno del archivo .env

const app = express();

// Lee la API Key de Resend desde las variables de entorno del servidor
const resend = new Resend(process.env.RESEND_API_KEY, {
  region: process.env.RESEND_REGION || "us-east-1", // Usa la región de .env o un valor por defecto
});

// Dirección de email a la que llegarán los mensajes
const EMAIL_TO = process.env.EMAIL_TO;
// Dirección de email desde la que se enviarán los mensajes (debe ser de un dominio verificado en Resend)
const EMAIL_FROM =
  process.env.EMAIL_FROM || "Optica Nissy <onboarding@resend.dev>";

// Verificación de variables de entorno críticas al inicio
if (!process.env.RESEND_API_KEY || !EMAIL_TO) {
  console.error("Error: Faltan variables de entorno críticas (RESEND_API_KEY, EMAIL_TO). El servidor no puede iniciar.");
  process.exit(1); // Detiene la aplicación si no están configuradas
}

// --- Middlewares ---
// 1. Habilitar CORS de forma segura para producción, permitiendo múltiples orígenes
const allowedOrigins = (
  process.env.CORS_ORIGIN || "http://localhost:4321"
).split(",");

const corsOptions = {
  origin: function (origin, callback) {
    // Permite peticiones sin origen (como Postman o apps móviles)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `El origen '${origin}' no está permitido por la política de CORS.`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// 2. Limitar la cantidad de solicitudes por IP a 2 por día
const limiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 horas
  max: 50, // Límite de 50 peticiones por IP cada 24 horas
  message:
    "Has alcanzado el límite de mensajes por día. Por favor, inténtalo de nuevo mañana.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
// app.use(limiter); // Descomenta esta línea cuando termines de probar
// 2. Middleware para parsear el cuerpo de las peticiones como JSON
app.use(express.json());

// --- Rutas ---
app.post("/", async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !phone || !subject || !message) {
      return res
        .status(400)
        .json({ message: "Faltan campos requeridos." });
    }

    // NUEVO: Validación del formato del email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ message: "El formato del correo electrónico no es válido." });
    }

    // Envía el email usando Resend
    await resend.emails.send({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: `Nuevo Mensaje de Contacto: ${subject}`,
      html: `<p><strong>Nombre:</strong> ${name}</p>
             <p><strong>Email:</strong> ${email}</p>
             <p><strong>Teléfono:</strong> ${phone}</p>
             <p><strong>Mensaje:</strong></p>
             <p>${message}</p>`,
    });

    res.status(200).json({ message: "Mensaje enviado con éxito" });
  } catch (error) {
    console.error("Error al procesar la petición:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en el puerto ${PORT}`));