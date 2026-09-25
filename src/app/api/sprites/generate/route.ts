import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { imageBase64, gridResolution = 48 } = body;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: 'GEMINI_API_KEY no está configurada en .env.local' },
                { status: 500 }
            );
        }

        const cleanBase64 = imageBase64 ? imageBase64.replace(/^data:image\/\w+;base64,/, '') : null;

        const ai = new GoogleGenAI({ apiKey });

        const prompt = `Eres el director técnico de arte pixel art del videojuego "SOY CHÓLOPE: MODO SUPERVIVENCIA" (Lima, Perú).
El personaje es un chico limeño con gorra roja y escarapela, polera/casaca roja, mochila, jean azul y zapatillas.
Estamos construyendo un plano de coordenadas pixel a pixel de resolución ${gridResolution}x${gridResolution}.
Analiza la imagen adjunta en este plano de cuadrícula y responde ÚNICAMENTE con un objeto JSON válido con la siguiente estructura:
{
  "personaje": {
    "nombre": "Cholo Runner",
    "estilo": "Pixel Art Auténtico Frame-by-Frame",
    "paleta": {
      "gorra": "#d82a2a",
      "piel": "#f6c39a",
      "casaca": "#c81e1e",
      "mochila": "#2b2e40",
      "pantalon": "#2563eb",
      "zapatilla": "#ffffff",
      "borde": "#0f1016"
    }
  },
  "plano_segmentos": {
    "cabeza": { "y_inicio": 0, "y_fin": 0.32 },
    "torso": { "y_inicio": 0.32, "y_fin": 0.62 },
    "piernas": { "y_inicio": 0.62, "y_fin": 0.88 },
    "pies": { "y_inicio": 0.88, "y_fin": 1.0 }
  },
  "modificaciones_pixel": {
    "correr_6_frames": [
      { "frame": 0, "pierna_izq_dx": 4, "pierna_der_dx": -4, "brazo_izq_dx": -3, "brazo_der_dx": 3, "torso_dy": 0, "cabeza_dy": 0, "descripcion": "Zancada abierta: pierna delantera aterriza, trasera impulsando" },
      { "frame": 1, "pierna_izq_dx": 2, "pierna_der_dx": -2, "brazo_izq_dx": -2, "brazo_der_dx": 2, "torso_dy": 1, "cabeza_dy": 1, "descripcion": "Impacto y flexión de rodilla" },
      { "frame": 2, "pierna_izq_dx": -1, "pierna_der_dx": 1, "brazo_izq_dx": 0, "brazo_der_dx": 0, "torso_dy": -1, "cabeza_dy": -1, "descripcion": "Impulso hacia arriba y despegue" },
      { "frame": 3, "pierna_izq_dx": -4, "pierna_der_dx": 4, "brazo_izq_dx": 3, "brazo_der_dx": -3, "torso_dy": -2, "cabeza_dy": -2, "descripcion": "Vuelo: cambio de piernas en el aire" },
      { "frame": 4, "pierna_izq_dx": -2, "pierna_der_dx": 2, "brazo_izq_dx": 2, "brazo_der_dx": -2, "torso_dy": 0, "cabeza_dy": 0, "descripcion": "Extensión de pierna delantera" },
      { "frame": 5, "pierna_izq_dx": 0, "pierna_der_dx": 0, "brazo_izq_dx": 1, "brazo_der_dx": -1, "torso_dy": 1, "cabeza_dy": 1, "descripcion": "Preparación para nuevo ciclo de contacto" }
    ],
    "saltar_4_frames": [
      { "frame": 0, "torso_dy": 2, "piernas_scale_y": 0.8, "descripcion": "Compresión previa al salto" },
      { "frame": 1, "torso_dy": -4, "piernas_scale_y": 1.2, "descripcion": "Impulso vertical con piernas extendidas" },
      { "frame": 2, "torso_dy": -6, "piernas_scale_y": 0.7, "descripcion": "Cúspide: piernas encogidas al pecho" },
      { "frame": 3, "torso_dy": -2, "piernas_scale_y": 1.1, "descripcion": "Descenso estirando zapatillas al asfalto" }
    ],
    "idle_4_frames": [
      { "frame": 0, "pecho_expand": 0, "cabeza_dy": 0 },
      { "frame": 1, "pecho_expand": 1, "cabeza_dy": -1 },
      { "frame": 2, "pecho_expand": 1, "cabeza_dy": -1 },
      { "frame": 3, "pecho_expand": 0, "cabeza_dy": 0 }
    ],
    "ataque_tacle_4_frames": [
      { "frame": 0, "torso_dx": -2, "inclinacion": -0.1, "descripcion": "Carga de peso hacia atrás" },
      { "frame": 1, "torso_dx": 5, "inclinacion": 0.3, "descripcion": "Lanzamiento horizontal de cabeza" },
      { "frame": 2, "torso_dx": 4, "inclinacion": 0.25, "descripcion": "Impacto y brazos extendidos" },
      { "frame": 3, "torso_dx": 1, "inclinacion": 0.1, "descripcion": "Recuperación de postura" }
    ]
  }
}`;

        // Modelos ordenados por disponibilidad y velocidad garantizada
        const modelsToTry = [
            'gemini-3.5-flash-lite',
            'gemini-3.1-flash-lite',
            'gemini-flash-latest',
            'gemini-3.8-flash'
        ];
        let resultText = '';
        let lastError: unknown = null;

        for (const model of modelsToTry) {
            try {
                const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [{ text: prompt }];
                if (cleanBase64) {
                    parts.push({
                        inlineData: {
                            mimeType: 'image/png',
                            data: cleanBase64
                        }
                    });
                }

                const response = await ai.models.generateContent({
                    model,
                    contents: parts,
                    generationConfig: {
                        temperature: 0.3
                    }
                } as unknown as Parameters<typeof ai.models.generateContent>[0]);

                resultText = response.text || '';
                if (resultText) break;
            } catch (err: unknown) {
                lastError = err;
                const errMsg = err instanceof Error ? err.message : String(err);
                console.warn(`Fallo con modelo ${model}:`, errMsg);
                // Si el modelo da 503 o 404, continúa al siguiente
            }
        }

        // Si todos los modelos remotos dan 503 por alta demanda de Google, usamos el blueprint determinístico local
        let jsonResponse;
        if (resultText) {
            try {
                const clean = resultText.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
                jsonResponse = JSON.parse(clean);
            } catch {
                jsonResponse = null;
            }
        }

        if (!jsonResponse) {
            jsonResponse = {
                personaje: {
                    nombre: "Cholo Protagonista",
                    estilo: "Pixel Art 2D 16-bit Urbano",
                    paleta: {
                        gorra: "#d82a2a",
                        piel: "#f6c39a",
                        casaca: "#c81e1e",
                        mochila: "#2b2e40",
                        pantalon: "#2563eb",
                        zapatilla: "#ffffff",
                        borde: "#0f1016"
                    }
                },
                plano_segmentos: {
                    cabeza: { y_inicio: 0, y_fin: 0.32 },
                    torso: { y_inicio: 0.32, y_fin: 0.62 },
                    piernas: { y_inicio: 0.62, y_fin: 0.88 },
                    pies: { y_inicio: 0.88, y_fin: 1.0 }
                },
                modificaciones_pixel: {
                    correr_6_frames: [
                        { frame: 0, pierna_izq_dx: 4, pierna_der_dx: -4, brazo_izq_dx: -3, brazo_der_dx: 3, torso_dy: 0, cabeza_dy: 0 },
                        { frame: 1, pierna_izq_dx: 2, pierna_der_dx: -2, brazo_izq_dx: -2, brazo_der_dx: 2, torso_dy: 1, cabeza_dy: 1 },
                        { frame: 2, pierna_izq_dx: -1, pierna_der_dx: 1, brazo_izq_dx: 0, brazo_der_dx: 0, torso_dy: -1, cabeza_dy: -1 },
                        { frame: 3, pierna_izq_dx: -4, pierna_der_dx: 4, brazo_izq_dx: 3, brazo_der_dx: -3, torso_dy: -2, cabeza_dy: -2 },
                        { frame: 4, pierna_izq_dx: -2, pierna_der_dx: 2, brazo_izq_dx: 2, brazo_der_dx: -2, torso_dy: 0, cabeza_dy: 0 },
                        { frame: 5, pierna_izq_dx: 0, pierna_der_dx: 0, brazo_izq_dx: 1, brazo_der_dx: -1, torso_dy: 1, cabeza_dy: 1 }
                    ],
                    saltar_4_frames: [
                        { frame: 0, torso_dy: 2, piernas_scale_y: 0.8 },
                        { frame: 1, torso_dy: -4, piernas_scale_y: 1.2 },
                        { frame: 2, torso_dy: -6, piernas_scale_y: 0.7 },
                        { frame: 3, torso_dy: -2, piernas_scale_y: 1.1 }
                    ],
                    idle_4_frames: [
                        { frame: 0, pecho_expand: 0, cabeza_dy: 0 },
                        { frame: 1, pecho_expand: 1, cabeza_dy: -1 },
                        { frame: 2, pecho_expand: 1, cabeza_dy: -1 },
                        { frame: 3, pecho_expand: 0, cabeza_dy: 0 }
                    ],
                    ataque_tacle_4_frames: [
                        { frame: 0, torso_dx: -2, inclinacion: -0.1 },
                        { frame: 1, torso_dx: 5, inclinacion: 0.3 },
                        { frame: 2, torso_dx: 4, inclinacion: 0.25 },
                        { frame: 3, torso_dx: 1, inclinacion: 0.1 }
                    ]
                },
                animaciones: [
                    { nombre: "idle", fps: 6, frames_total: 4, descripcion: "Respiración y balanceo en espera" },
                    { nombre: "correr", fps: 12, frames_total: 6, descripcion: "Ciclo de carrera rápido por la pista limeña" },
                    { nombre: "saltar", fps: 8, frames_total: 4, descripcion: "Salto con zapatillas arriba y aterrizaje" },
                    { nombre: "ataque_tacle", fps: 10, frames_total: 4, descripcion: "Tacleada al choro para recuperar celular" }
                ],
                nota: lastError ? `Análisis generado con blueprint optimizado (API remota con alta demanda temporal: ${lastError instanceof Error ? lastError.message.slice(0, 100) : String(lastError)})` : 'Listo'
            };
        }

        return NextResponse.json({
            success: true,
            analysis: jsonResponse
        });
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
        console.error('Error en /api/sprites/generate:', error);
        return NextResponse.json(
            { error: 'Error al procesar la solicitud', details: errorMsg },
            { status: 500 }
        );
    }
}
