// src/app/api/chat/route.js
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const maxDuration = 60; 
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    // -----------------------------------------------------------------------
    // 1. SEGURIDAD: Validar sesión real del usuario (Mejor que x-secret-key)
    // -----------------------------------------------------------------------
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) return NextResponse.json({ error: "No token" }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
    
    const verifiedUserId = user.id

    // -----------------------------------------------------------------------
    // 2. CONFIGURACIÓN
    // -----------------------------------------------------------------------
    const apiKey = process.env.GEMINI_API_KEY || ""
    const body = await req.json()
    const { message, history } = body 

    if (!message) return NextResponse.json({ response: "Pregunta vacía" })

    const genAI = new GoogleGenerativeAI(apiKey)

    const embeddingModel = genAI.getGenerativeModel(
      { model: "gemini-embedding-001" },
      { apiVersion: 'v1beta' }
    );

    const embeddingResult = await embeddingModel.embedContent({
      content: { parts: [{ text: message }] },
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: 768, 
    });

    const vectorUsuario = embeddingResult.embedding.values;

    // B. Búsqueda en Base de Conocimiento
    const { data: documentos } = await supabase
      .rpc('match_documents', {
        query_embedding: vectorUsuario, 
        match_threshold: 0.50, 
        match_count: 5 
      })

    const hayInformacion = documentos && documentos.length > 0;
    
    let contexto = "";
    let sourceLabel = "Conocimiento General";

    if (hayInformacion) {
      contexto = documentos.map(doc => 
        `-- FUENTE: ${doc.titulo} (${doc.categoria}) --\n${doc.contenido}\n`
      ).join('\n\n');
      sourceLabel = "Reglamento Oficial";
    }

    // -----------------------------------------------------------------------
    // 3. GENERACIÓN DE RESPUESTA (Con instrucciones de formato)
    // -----------------------------------------------------------------------
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash",
        generationConfig: { responseMimeType: "application/json" } 
    })
    
    const historialTexto = history ? history.map(h => `${h.role}: ${h.parts[0].text}`).join('\n') : "";

const prompt = `
      Eres Mary AI, la asistente académica oficial y experta de la Universidad de Guayaquil.
      
      TU OBJETIVO:
      Proporcionar una respuesta COMPLETA, DETALLADA y ESTRUCTURADA basándote EXCLUSIVAMENTE en el contexto recuperado.
      NO des respuestas cortas o simplistas de un solo párrafo si hay información para desarrollar.

      ESTADO DE DATOS: ${hayInformacion ? "✅ INFORMACIÓN ENCONTRADA" : "❌ NO HAY INFORMACIÓN EN LA BASE DE DATOS"}
      
      CONTEXTO RECUPERADO (Toda tu respuesta debe salir de aquí):
      ${contexto}
      
      HISTORIAL DE CHAT: ${historialTexto}
      PREGUNTA DEL USUARIO: "${message}"

      INSTRUCCIONES DE RESPUESTA (IMPORTANTE):
      1. **ESTRUCTURA**: Usa formato Markdown para organizar la respuesta. Usa títulos (### Título) para separar secciones y negritas (**texto**) para resaltar conceptos clave.
      2. **DETALLE**: Si el texto habla de un proceso, requisitos o modalidades, DESGLÓSALOS en una lista con viñetas (- elemento) para que sea fácil de leer.
      3. **EXTENSIÓN**: Explica el "cómo", el "qué" y el "dónde" si el texto lo dice. Tu respuesta debe ser profesional y educativa.
      4. **CITAS**: Menciona explícitamente el artículo o reglamento (ej: "Según el Art. 7...") cuando sea pertinente.
      5. **SI NO HAY DATOS**: Di amablemente que no tienes información sobre ese tema específico en tus reglamentos actuales, no inventes.

      INSTRUCCIONES PARA SUGERENCIAS:
      1. Sugiere 3 preguntas que profundicen en el tema encontrado (ej: "¿Cuáles son los requisitos?", "¿Plazos de entrega?").
      2. Solo sugiere cosas que sepas responder con el contexto que tienes.

      FORMATO JSON OBLIGATORIO:
      {
        "respuesta": "Aquí va tu respuesta detallada en Markdown (con ###, **, - listados)...",
        "sugerencias": ["Pregunta Profunda 1", "Pregunta Profunda 2", "Pregunta Profunda 3"]
      }
    `

    const result = await model.generateContent(prompt)
    const jsonResponse = JSON.parse(result.response.text());
    
    // -----------------------------------------------------------------------
    // 4. GUARDADO DE LOGS (Corregido: Sin columna 'tiene_contexto')
    // -----------------------------------------------------------------------
    if (verifiedUserId) {
        // Usamos el Service Role para asegurar que se guarde el log sí o sí
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        )
        
        await supabaseAdmin.from('logs_consultas').insert([{
            usuario_id: verifiedUserId,
            pregunta: message,
            respuesta_bot: jsonResponse.respuesta, 
            embedding: vectorUsuario
            // Eliminé 'tiene_contexto' para que no te de error
        }])
    }

    return NextResponse.json({ 
      response: jsonResponse.respuesta,
      suggestions: jsonResponse.sugerencias,
      source: sourceLabel
    })

  } catch (error) {
    console.error("Error API:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}