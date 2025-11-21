import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || ""
    if (!apiKey) throw new Error('Falta la GEMINI_API_KEY')

    const genAI = new GoogleGenerativeAI(apiKey)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    const { message, userId } = await req.json()

    // ==========================================
    // 🧠 FASE 1: GENERAR EMBEDDING (VECTOR)
    // ==========================================
    // Convertimos la pregunta del usuario en números
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" })
    const embeddingResult = await embeddingModel.embedContent(message)
    const vectorUsuario = embeddingResult.embedding.values

    // ==========================================
    // 🧠 FASE 1.5: VERIFICAR CACHÉ (MEMORIA)
    // ==========================================
    // Buscamos si alguien ya preguntó algo MUY parecido (umbral alto: 0.85 o 0.9)
    const { data: memoriaEncontrada } = await supabase
      .rpc('buscar_similares', {
        query_embedding: vectorUsuario,
        match_threshold: 0.90, // ¡Alto! Queremos casi la misma pregunta
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
    
    // Buscamos en la base de conocimientos usando la función que creamos en SQL (match_documents)
    // Nota: Umbral 0.5 es un buen equilibrio. Si es muy estricto, bájalo a 0.4
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
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })
    
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
       // Guardamos el log para futuras mejoras o caché
       await supabase.from('logs_consultas').insert([{
        usuario_id: userId,
        pregunta: message,
        respuesta_bot: responseText,
        embedding: vectorUsuario // Guardamos el vector por si quieres usar caché después
      }])
    }

    return NextResponse.json({ 
      response: responseText,
      source: sourceLabel
    })

  } catch (error) {
    console.error('🔴 ERROR:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}