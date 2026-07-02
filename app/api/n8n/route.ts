import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    
    if (!webhookUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta la variable de entorno N8N_WEBHOOK_URL en .env.local.",
        },
        { status: 500 }
      );
    }

    // Enviamos una petición POST a n8n con metadatos útiles
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "CREOTEC Dashboard",
        triggeredAt: new Date().toISOString(),
        description: "Ejecución manual iniciada desde el dashboard operativo.",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Error desconocido");
      throw new Error(`n8n respondió con código ${response.status}: ${errorText}`);
    }

    // Algunos webhooks en n8n pueden devolver JSON o texto plano, procesamos con cuidado
    let n8nData = {};
    try {
      n8nData = await response.json();
    } catch {
      n8nData = { message: "Webhook recibido con éxito por n8n" };
    }

    return NextResponse.json({
      ok: true,
      message: "Flujo manual de n8n iniciado correctamente.",
      data: n8nData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("[/api/n8n] Error al invocar webhook:", message);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
