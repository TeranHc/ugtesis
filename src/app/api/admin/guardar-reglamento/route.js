// src/app/api/admin/guardar-reglamento/route.js
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    // -----------------------------------------------------------------------
    // 🔒 1. CAPA DE SEGURIDAD CRÍTICA (NUEVO)
    // -----------------------------------------------------------------------
    
    // A. Obtener el token del header
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: "No autorizado: Token faltante" }, { status: 401 })
    }

    // B. Cliente "Anónimo" solo para validar al usuario (Sin permisos de superadmin aún)
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    // C. Verificar que el token sea válido en Supabase Auth
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: "Sesión inválida o expirada" }, { status: 401 })
    }

    // D. Verificar si el usuario tiene rol 'admin' en tu base de datos
    const { data: perfil } = await supabaseAuth
        .from('perfiles_usuarios')
        .select('rol')
        .eq('id', user.id)
        .single()

    if (perfil?.rol !== 'admin') {
      console.warn(`Intento de acceso no autorizado por usuario: ${user.id}`)
      return NextResponse.json({ error: "Acceso denegado: Requiere privilegios de administrador" }, { status: 403 })
    }

    // -----------------------------------------------------------------------
    // ✅ 2. LÓGICA DE NEGOCIO (Solo se ejecuta si pasó la seguridad)
    // -----------------------------------------------------------------------

    const { id, titulo, contenido, categoria, action } = await req.json()

    // Configuración de Gemini
    const apiKey = process.env.GEMINI_API_KEY
    const genAI = new GoogleGenerativeAI(apiKey)

    // AHORA SÍ: Inicializamos el cliente con PODERES TOTALES (Service Role)
    // porque ya sabemos que es un admin real.
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY 
    )

    // Generar Embedding
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" })
    const result = await model.embedContent(contenido)
    const vector = result.embedding.values

    let errorSupabase = null

    // Guardar en Supabase usando el cliente Admin
    if (action === 'create') {
      const { error } = await supabaseAdmin.from('base_conocimiento').insert([{
        titulo,
        contenido,
        categoria,
        embedding: vector
      }])
      errorSupabase = error
    } 
    else if (action === 'update') {
      const { error } = await supabaseAdmin.from('base_conocimiento').update({
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