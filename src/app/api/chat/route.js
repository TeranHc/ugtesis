// src/app/api/admin/chat/route.js
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const maxDuration = 60; 
export const dynamic = 'force-dynamic';
export async function POST(req) {
  try {
    // ==========================================
    // 🔒 PROTECCIÓN 0: CANDADO DE SEGURIDAD (NUEVO)
    // ==========================================
    // Verificamos si la petición trae la "contraseña" desde el Frontend.
    // Si eres un bot de Vercel y no tienes la clave: TE BLOQUEAMOS AQUÍ (Costo 0).
    const secretHeader = req.headers.get('x-secret-key')
    
    // Aquí usamos la clave que definimos. Si no has creado la variable en Vercel aún, 
    // usará la frase fija por defecto para que te funcione ya.
    const mySecret = process.env.APP_SECRET_KEY || 'tesis-segura-2025-guayaquil-bloqueo'

    if (secretHeader !== mySecret) {
       return NextResponse.json({ 
         error: "Acceso denegado: No tienes autorización para usar esta API." 
       }, { status: 401 })
    }

    // ==========================================
    // 🛡️ PROTECCIÓN 1: VALIDACIONES BÁSICAS
    // ==========================================
    const apiKey = process.env.GEMINI_API_KEY || ""
    if (!apiKey) throw new Error('Falta la GEMINI_API_KEY')

    const body = await req.json()
    const { message, userId } = body

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ 
        response: "Por favor, escribe una pregunta válida.",
        source: "Sistema"
      })
    }

    // ==========================================
    // ⚙️ CONFIGURACIÓN INICIAL
    // ==========================================
    const genAI = new GoogleGenerativeAI(apiKey)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    // ==========================================
    // 🧠 FASE 1: GENERAR EMBEDDING (VECTOR)
    // ==========================================
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" })
    const embeddingResult = await embeddingModel.embedContent(message)
    const vectorUsuario = embeddingResult.embedding.values

    // ==========================================
    // 🧠 FASE 1.5: VERIFICAR CACHÉ (MEMORIA)
    // ==========================================
    const { data: memoriaEncontrada } = await supabase
      .rpc('buscar_similares', {
        query_embedding: vectorUsuario,
        match_threshold: 0.90, 
        match_count: 1
      })

    if (memoriaEncontrada && memoriaEncontrada.length > 0) {
      console.log('⚡ MEMORIA: Respuesta reutilizada del caché')
      return NextResponse.json({ 
        response: memoriaEncontrada[0].respuesta_bot,
        source: 'Memoria Inteligente (Cache)' 
      })
    }

    // ==========================================
    // 🔍 FASE 2: BÚSQUEDA SEMÁNTICA (VECTORES)
    // ==========================================
    const { data: documentos, error } = await supabase
      .rpc('match_documents', {
        query_embedding: vectorUsuario, 
        match_threshold: 0.50, 
        match_count: 5 
      })

    if (error) console.error('Error Supabase:', error)

    let contexto = ""
    let sourceLabel = "Base de Conocimiento"

    if (documentos && documentos.length > 0) {
      contexto = documentos.map(doc => 
        `-- REGLAMENTO: ${doc.titulo} (${doc.categoria}) --\n${doc.contenido}\n`
      ).join('\n\n')
    } else {
      contexto = "No se encontró información relevante en los reglamentos."
      sourceLabel = "Conocimiento General (Advertencia: Puede no ser exacto)"
    }

    // ==========================================
    // 🤖 FASE 3: GENERACIÓN CON GEMINI
    // ==========================================
    // MANTENIDO: Gemini 2.0 Flash como pediste
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
    
    // MANTENIDO: Tu prompt original exacto
    const prompt = `
      Eres el Asistente Académico Oficial de la Universidad de Guayaquil.
      
      TU OBJETIVO: Responder preguntas sobre reglamentos basándote EXCLUSIVAMENTE en el contexto proporcionado.

      CONTEXTO RECUPERADO:
      ${contexto}

      PREGUNTA DEL USUARIO: "${message}"

      INSTRUCCIONES:
      1. Analiza el contexto. Si encuentras la respuesta, explícala claramente.
      2. CITA LA FUENTE: Siempre menciona qué reglamento o artículo usaste (ej: "Según el Art. 22 del Reglamento...").
      3. Si el contexto dice "No se encontró información", responde: "Lo siento, no tengo información sobre ese tema específico en mis reglamentos actuales."
      4. No inventes artículos ni leyes que no estén en el texto.
    `

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    // ==========================================
    // 💾 FASE 4: GUARDADO DE LOGS
    // ==========================================
    if (userId) {
       await supabase.from('logs_consultas').insert([{
        usuario_id: userId,
        pregunta: message,
        respuesta_bot: responseText,
        embedding: vectorUsuario
      }])
    }

    return NextResponse.json({ 
      response: responseText,
      source: sourceLabel
    })

  } catch (error) {
    console.error('🔴 ERROR:', error)
    
    // 🛡️ PROTECCIÓN 2: Manejo de Cuota Excedida (Error 429)
    if (error.message && (error.message.includes('429') || error.message.includes('Quota'))) {
        return NextResponse.json({ 
            response: "El sistema está recibiendo demasiadas consultas en este momento (Límite de API alcanzado). Por favor, intenta de nuevo en unos minutos.",
            source: "Sistema (Sobrecarga Temporal)"
        })
    }

    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}