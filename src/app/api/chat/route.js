import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    // 1. Validar y Limpiar Clave
    const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : ""
    if (!apiKey) throw new Error('Falta la GEMINI_API_KEY')

    const genAI = new GoogleGenerativeAI(apiKey)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    const { message, userId } = await req.json()

    // --- LÓGICA DE BÚSQUEDA INTELIGENTE (KEYWORD SEARCH) ---
    
    // 1. Convertimos la pregunta en palabras clave
    // Quitamos palabras "basura" (stopwords) que confunden a la base de datos
    const palabrasIgnorar = ['que', 'qué', 'como', 'cómo', 'para', 'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'y', 'o', 'en', 'sobre', 'dice', 'necesito', 'saber']
    
    const palabrasClave = message
      .toLowerCase()
      .replace(/[¿?¡!.,]/g, '') // Quitar signos de puntuación
      .split(' ')
      .filter(p => p.length > 2 && !palabrasIgnorar.includes(p)) // Solo palabras útiles

    // Si no quedaron palabras clave (ej: "¿qué es?"), usamos la frase original por si acaso
    const busqueda = palabrasClave.length > 0 ? palabrasClave : [message]

    console.log('🔍 Buscando palabras clave:', busqueda) // Para que veas en la terminal qué busca

    // 2. Construimos una consulta "OR": Busca si contiene la Palabra 1 O la Palabra 2 O la Palabra 3...
    // Esto aumenta mucho la probabilidad de encontrar el reglamento correcto.
    let consultaSupabase = supabase
      .from('base_conocimiento')
      .select('titulo, contenido, categoria')
    
    // Creamos el filtro dinámico: contenido ILIKE %palabra1% OR contenido ILIKE %palabra2%...
    const filtroOr = busqueda.map(p => `contenido.ilike.%${p}%`).join(',')
    
    const { data: documentos, error } = await consultaSupabase
      .or(filtroOr) 
      .limit(5) // Traemos hasta 5 candidatos para que Gemini elija el mejor

    if (error) console.error('Error Supabase:', error)

    // --- FIN DE LÓGICA DE BÚSQUEDA ---

    let contexto = "No se encontraron reglamentos específicos."
    if (documentos && documentos.length > 0) {
      // Juntamos todos los textos encontrados
      contexto = documentos.map(doc => 
        `-- FUENTE (${doc.categoria}): ${doc.titulo} --\n${doc.contenido}\n`
      ).join('\n\n')
    }

    console.log('📄 Contexto encontrado:', documentos?.length || 0, 'documentos')

    // 3. Preguntamos a Gemini (Modelo 2.0 Flash)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })
    
    const prompt = `
      Eres el Asistente Académico de la Universidad de Guayaquil.
      
      Tengo esta información de los reglamentos (CONTEXTO):
      ---------------------
      ${contexto}
      ---------------------

      Pregunta del estudiante: "${message}"

      Instrucciones:
      1. Analiza el CONTEXTO. Si encuentras la respuesta ahí, responde de forma clara y cita la fuente (ej: "Según el Art. 64...").
      2. Si la información en el CONTEXTO no tiene NADA que ver con la pregunta (por ejemplo, habla de matrículas y la pregunta es sobre deportes), di: "Lo siento, no tengo información específica sobre eso en mis reglamentos actuales."
      3. Sé amable y profesional.
    `

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    // 4. Logs
    if (userId) {
      await supabase.from('logs_consultas').insert([{
        usuario_id: userId,
        pregunta: message,
        respuesta_bot: responseText
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