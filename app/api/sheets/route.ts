import { NextResponse } from "next/server";
import { google } from "googleapis";
import fs from "fs";
import path from "path";

// Evita que Next.js cachee la respuesta: siempre trae datos frescos de Sheets.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SHEET_NAME = "Historial_Servicios";

// Cabeceras exactas de la hoja (fila 1). El orden define el índice de cada columna.
const HEADERS = [
  "numeroCelular", // A - Número de Celular
  "pais", // B - País
  "ciudad", // C - Ciudad
  "fechaRegistro", // D - Fecha de Registro
  "mes", // E - Mes
  "anio", // F - Año
  "horaInicio", // G - Hora de Inicio
  "franjaHoraria", // H - Franja Horaria
  "tiempoPrimeraRespuesta", // I - Tiempo 1ra Respuesta (Minutos)
  "tiempoResolucion", // J - Tiempo de Resolución (Días)
  "nombrePaciente", // K - Nombre del Paciente
  "seccion", // L - Sección
  "categoria", // M - Categoría
  "detalle", // N - Detalle
  "tipoLead", // O - Tipo de Lead
  "redSocial", // P - Red Social
  "tipoUsuario", // Q - Tipo de Usuario
  "sentimiento", // R - Sentimiento del Cliente
  "resumenSentimiento", // S - Resumen del Sentimiento
  "tonoAsesor", // T - Tono del Asesor
] as const;

export type RegistroServicio = Record<(typeof HEADERS)[number], string>;

function cleanEnvValue(value: string | undefined): string | undefined {
  if (!value) return value;
  let cleaned = value.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.substring(1, cleaned.length - 1);
  } else if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
    cleaned = cleaned.substring(1, cleaned.length - 1);
  }
  return cleaned;
}

function getAuth() {
  let clientEmail = cleanEnvValue(process.env.GOOGLE_CLIENT_EMAIL);
  let privateKey = cleanEnvValue(process.env.GOOGLE_PRIVATE_KEY)?.replace(/\\n/g, "\n");

  // Si no están definidas en las variables de entorno, buscamos automáticamente
  // un archivo JSON de cuenta de servicio de Google Cloud en la carpeta raíz del proyecto.
  if (!clientEmail || !privateKey) {
    try {
      const rootDir = process.cwd();
      const files = fs.readdirSync(rootDir);
      const jsonKeyFile = files.find(
        (f) => f.endsWith(".json") && (f.includes("creotec") || f.includes("bot") || f.includes("sheets") || f.includes("service-account"))
      );
      if (jsonKeyFile) {
        const filePath = path.join(rootDir, jsonKeyFile);
        const content = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(content);
        if (parsed.client_email && parsed.private_key) {
          clientEmail = parsed.client_email;
          privateKey = parsed.private_key;
          console.log(`[/api/sheets] Credenciales cargadas exitosamente desde archivo local: ${jsonKeyFile}`);
        }
      }
    } catch (err) {
      console.warn("[/api/sheets] No se pudo cargar archivo de credenciales local:", err);
    }
  }

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Faltan credenciales: define GOOGLE_CLIENT_EMAIL y GOOGLE_PRIVATE_KEY en .env.local o coloca el archivo JSON de la cuenta de servicio en la raíz del proyecto."
    );
  }

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}


export async function GET() {
  try {
    const spreadsheetId =
      process.env.SPREADSHEET_ID || "1Pv4Ax5GS0yvqrhscBg6lTAo4xcPlDDuxSswxG8CraO8";
    if (!spreadsheetId) {
      throw new Error("Falta la variable de entorno SPREADSHEET_ID.");
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      // Leemos de la columna A a la T (20 columnas de datos).
      range: `${SHEET_NAME}!A:T`,
      valueRenderOption: "FORMATTED_VALUE",
    });

    const rows = response.data.values ?? [];

    // La primera fila son las cabeceras; la ignoramos y mapeamos el resto.
    const [, ...dataRows] = rows;

    const data: RegistroServicio[] = dataRows
      // Descartamos filas totalmente vacías.
      .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
      .map((row) => {
        const registro = {} as RegistroServicio;
        HEADERS.forEach((key, i) => {
          registro[key] = String(row[i] ?? "").trim();
        });
        return registro;
      });

    return NextResponse.json(
      {
        ok: true,
        count: data.length,
        updatedAt: new Date().toISOString(),
        data,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("[/api/sheets] Error:", message);
    return NextResponse.json(
      { ok: false, error: message, data: [] },
      { status: 500 }
    );
  }
}
