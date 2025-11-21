import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { id, titulo, contenido, categoria, action } = await req.json()

    // 1. Configuración
    const apiKey = process.env.GEMINI_API_KEY
    const genAI = new GoogleGenerativeAI(apiKey)

    // --- CORRECCIÓN AQUÍ ---
    // createClient toma (URL, LLAVE). 
    // Al poner aquí la SERVICE_ROLE_KEY, obtienes permisos de administrador total.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY 
    )
    // -----------------------

    // 2. GENERAR EL EMBEDDING
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" })
    const result = await model.embedContent(contenido)
    const vector = result.embedding.values

    let errorSupabase = null

    // 3. Guardar en Supabase
    if (action === 'create') {
      const { error } = await supabase.from('base_conocimiento').insert([{
        titulo,
        contenido,
        categoria,
        embedding: vector
      }])
      errorSupabase = error
    } 
    else if (action === 'update') {
      const { error } = await supabase.from('base_conocimiento').update({
        titulo,
        contenido,
        categoria,
        embedding: vector,
        fecha_actualizacion: new Date()
      }).eq('id', id)
      errorSupabase = error
    }

    if (errorSupabase) throw errorSupabase

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error("Error al procesar reglamento:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}