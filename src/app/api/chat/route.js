import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    // 1. Validar Claves
    const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : ""
    if (!apiKey) throw new Error('Falta la GEMINI_API_KEY')

    const genAI = new GoogleGenerativeAI(apiKey)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    const { message, userId } = await req.json()

    // ==========================================
    // 🧠 FASE 1: MEMORIA (NUEVO)
    // ==========================================
    // Generamos el "mapa matemático" de la pregunta (Es gratis/barato)
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" })
    const embeddingResult = await embeddingModel.embedContent(message)
    const vectorUsuario = embeddingResult.embedding.values

    // Preguntamos a la BD si ya respondimos esto antes
    const { data: cacheEncontrado, error: errorCache } = await supabase
      .rpc('buscar_similares', {
        query_embedding: vectorUsuario,
        match_threshold: 0.85, // 85% de coincidencia requerida
        match_count: 1
      })

    // Si encontramos una respuesta guardada, la entregamos y CORTAMOS AQUÍ.
    // (Ahorro total de tiempo y dinero en generación)
    if (cacheEncontrado && cacheEncontrado.length > 0) {
      console.log('⚡ MEMORIA: Respuesta reutilizada')
      return NextResponse.json({ 
        response: cacheEncontrado[0].respuesta_bot,
        source: 'Memoria Inteligente (Cache)'
      })
    }

    // ==========================================
    // 🔍 FASE 2: TU BÚSQUEDA ORIGINAL (SI NO HAY MEMORIA)
    // ==========================================
    
    // 1. Convertimos la pregunta en palabras clave
    const palabrasIgnorar = ['que', 'qué', 'como', 'cómo', 'para', 'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'y', 'o', 'en', 'sobre', 'dice', 'necesito', 'saber']
    
    const palabrasClave = message
      .toLowerCase()
      .replace(/[¿?¡!.,]/g, '')
      .split(' ')
      .filter(p => p.length > 2 && !palabrasIgnorar.includes(p))

    const busqueda = palabrasClave.length > 0 ? palabrasClave : [message]

    // 2. Construimos la consulta "OR"
    let consultaSupabase = supabase
      .from('base_conocimiento')
      .select('titulo, contenido, categoria')
    
    const filtroOr = busqueda.map(p => `contenido.ilike.%${p}%`).join(',')
    
    const { data: documentos, error } = await consultaSupabase
      .or(filtroOr) 
      .limit(5)

    if (error) console.error('Error Supabase:', error)

    let contexto = "No se encontraron reglamentos específicos."
    if (documentos && documentos.length > 0) {
      contexto = documentos.map(doc => 
        `-- FUENTE (${doc.categoria}): ${doc.titulo} --\n${doc.contenido}\n`
      ).join('\n\n')
    }

    // ==========================================
    // 🤖 FASE 3: GENERACIÓN (CON TU PROMPT ORIGINAL)
    // ==========================================
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })
    
    // He ajustado LIGERAMENTE tu prompt para asegurar que sea CORTO si no sabe.
    const prompt = `
      Eres el Asistente Académico de la Universidad de Guayaquil.
      
      CONTEXTO (Reglamentos):
      ${contexto}

      PREGUNTA: "${message}"

      INSTRUCCIONES:
      1. Responde basándote EXCLUSIVAMENTE en el CONTEXTO.
      2. Si la respuesta está ahí, sé claro y cita la fuente.
      3. SI LA INFORMACIÓN NO ESTÁ EN EL CONTEXTO: Di simplemente: "Lo siento, no tengo información específica sobre eso en mis reglamentos actuales." y nada más. No des consejos genéricos ni inventes pasos.
    `

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    // ==========================================
    // 💾 FASE 4: GUARDAR (AHORA CON EL VECTOR)
    // ==========================================
    if (userId) {
      await supabase.from('logs_consultas').insert([{
        usuario_id: userId,
        pregunta: message,
        respuesta_bot: responseText,
        embedding: vectorUsuario // ¡Aquí guardamos el vector para el futuro!
      }])
    }

    return NextResponse.json({ 
      response: responseText,
      source: documentos?.length > 0 ? 'Reglamentos UG' : null
    })

  } catch (error) {
    console.error('🔴 ERROR:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}