// src/app/api/chat/route.js
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const maxDuration = 60; 
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    // 🔒 PROTECCIÓN: VALIDACIÓN DE SESIÓN
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

    // 🛡️ VALIDACIONES BÁSICAS
    const apiKey = process.env.GEMINI_API_KEY || ""
    const body = await req.json()
    const { message, history } = body 

    if (!message) return NextResponse.json({ response: "Pregunta vacía" })

    const genAI = new GoogleGenerativeAI(apiKey)

    // 🧠 FASE 1: EMBEDDING
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" })
    const embeddingResult = await embeddingModel.embedContent(message)
    const vectorUsuario = embeddingResult.embedding.values

    // 🔍 FASE 2: BÚSQUEDA SEMÁNTICA
    const { data: documentos } = await supabase
      .rpc('match_documents', {
        query_embedding: vectorUsuario, 
        match_threshold: 0.50, 
        match_count: 5 
      })

    // --- DETECCIÓN DE CONTEXTO ---
    const hayInformacion = documentos && documentos.length > 0;
    
    let contexto = "";
    let sourceLabel = "";

    if (hayInformacion) {
      contexto = documentos.map(doc => 
        `-- REGLAMENTO: ${doc.titulo} (${doc.categoria}) --\n${doc.contenido}\n`
      ).join('\n\n');
      sourceLabel = "Reglamento Oficial";
    } else {
      contexto = ""; 
      sourceLabel = "Sin información oficial";
    }

    // --- 🤖 FASE 3: GENERACIÓN (JSON MODE) ---
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash",
        generationConfig: { responseMimeType: "application/json" } 
    })
    
    const historialTexto = history ? history.map(h => `${h.role}: ${h.parts[0].text}`).join('\n') : "";

    // --- 🔥 PROMPT CON RESTRICCIÓN DE SUGERENCIAS 🔥 ---
    const prompt = `
      Eres Mary AI, asistente oficial de la Universidad de Guayaquil.
      
      ESTADO DE INFORMACIÓN: ${hayInformacion ? "✅ DATOS ENCONTRADOS" : "❌ DATOS NO ENCONTRADOS"}
      
      CONTEXTO RECUPERADO (SOLO PUEDES USAR ESTO):
      ${contexto}
      
      HISTORIAL: ${historialTexto}
      PREGUNTA: "${message}"

      TU MISIÓN:
      Responder la pregunta y sugerir 3 dudas siguientes.
      
      ⚠️ REGLA DE ORO PARA SUGERENCIAS (MUY IMPORTANTE):
      1. Las 'sugerencias' deben estar basadas 100% en el CONTEXTO RECUPERADO. 
      2. NO sugieras temas que no aparezcan en el texto de arriba. Si el texto habla de 'Matrículas', sugiere 'Fechas de matrícula', NO sugieras 'Becas' si no hay texto de becas.
      3. Si NO hay información (Estado ❌), tus sugerencias deben ser SOLO: ["¿Qué reglamentos tienes?", "¿Horarios de atención?", "¿Ubicación de secretaría?"].
      4. Si SÍ hay información, sugiere detalles profundos que estén en ese mismo texto (ej: plazos, artículos relacionados, requisitos mencionados).

      FORMATO JSON OBLIGATORIO:
      {
        "respuesta": "Texto de respuesta amable, citando artículos si existen...",
        "sugerencias": ["Sugerencia Segura 1", "Sugerencia Segura 2", "Sugerencia Segura 3"]
      }
    `

    const result = await model.generateContent(prompt)
    const jsonResponse = JSON.parse(result.response.text());
    
    // 💾 FASE 4: GUARDADO DE LOGS
    if (verifiedUserId) {
       await supabase.from('logs_consultas').insert([{
        usuario_id: verifiedUserId,
        pregunta: message,
        respuesta_bot: jsonResponse.respuesta, 
        embedding: vectorUsuario,
        tiene_contexto: hayInformacion
      }])
    }

    return NextResponse.json({ 
      response: jsonResponse.respuesta,
      suggestions: jsonResponse.sugerencias,
      source: sourceLabel
    })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}