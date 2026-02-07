// src/app/api/admin/guardar-reglamento/route.js
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    // -----------------------------------------------------------------------
    // 🔒 1. CAPA DE SEGURIDAD CRÍTICA
    // -----------------------------------------------------------------------
    
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: "No autorizado: Token faltante" }, { status: 401 })
    }

    // A. Cliente para validar el TOKEN (Anon Key es suficiente aquí)
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: "Sesión inválida o expirada" }, { status: 401 })
    }

    // B. Cliente con PODERES TOTALES (Service Role)
    // Lo inicializamos aquí para usarlo en la verificación del rol y saltar el RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY 
    )

    // C. Verificar rol usando el cliente ADMIN (Esto corrige el error 403)
    const { data: perfil, error: perfilError } = await supabaseAdmin
        .from('perfiles_usuarios')
        .select('rol')
        .eq('id', user.id)
        .single()

    // Log para depuración en tu terminal
    console.log(`Verificando usuario: ${user.id} | Rol en DB: ${perfil?.rol}`);

    if (perfilError || perfil?.rol !== 'admin') {
      console.warn(`Acceso denegado: El usuario ${user.id} tiene rol [${perfil?.rol}]`);
      return NextResponse.json({ 
        error: "Acceso denegado: Se requiere rol de administrador",
        debug_rol: perfil?.rol 
      }, { status: 403 })
    }

    // -----------------------------------------------------------------------
    // ✅ 2. LÓGICA DE NEGOCIO (Solo si es Admin)
    // -----------------------------------------------------------------------

    const { id, titulo, contenido, categoria, action } = await req.json()

    if (!contenido) throw new Error("El contenido es obligatorio para generar el vector")

    // Configuración de Gemini
    const apiKey = process.env.GEMINI_API_KEY
    const genAI = new GoogleGenerativeAI(apiKey)

    // Usamos los mismos nombres de variables en todo el bloque
    const embeddingModel = genAI.getGenerativeModel(
      { model: "gemini-embedding-001" },
      { apiVersion: 'v1beta' }
    );

    const resultEmbedding = await embeddingModel.embedContent({
      content: { parts: [{ text: contenido }] },
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: 768, 
    });

    // Extraemos el vector del objeto correcto
    const vector = resultEmbedding.embedding.values;

    let errorSupabase = null

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