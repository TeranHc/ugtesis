'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient' // Importamos tu conexión
import { Loader2, LogIn } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // 1. Verificar si ya hay sesión iniciada al entrar
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        // Si ya está logueado, verificamos su rol y lo redirigimos
        redirigirUsuario(session.user.id)
      }
    }
    checkSession()
  }, [])

  // 2. Función inteligente para redirigir según el rol
  const redirigirUsuario = async (userId) => {
    try {
      // Buscamos qué rol tiene este usuario en tu tabla 'perfiles_usuarios'
      const { data, error } = await supabase
        .from('perfiles_usuarios')
        .select('rol')
        .eq('id', userId)
        .single()

      if (error) throw error

      if (data?.rol === 'admin') {
        console.log('Usuario es Admin -> Redirigiendo al Panel')
        router.push('/admin') 
      } else {
        console.log('Usuario es Estudiante -> Redirigiendo al Chat')
        router.push('/chat')  
      }
    } catch (err) {
      console.error('Error verificando rol:', err)
      // Si falla algo, por seguridad lo mandamos al chat
      router.push('/chat')
    }
  }

  // 3. Manejar el clic en "Ingresar"
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Si el login es exitoso, decidimos a dónde mandarlo
      await redirigirUsuario(data.user.id)

    } catch (err) {
      setError('Correo o contraseña incorrectos. Intenta de nuevo.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 space-y-6 border border-gray-200">
        
        <div className="text-center">
          <h1 className="text-3xl font-bold text-blue-900">Asistente UG</h1>
          <p className="text-gray-500 mt-2">Sistema de Apoyo Académico</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo Institucional</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="estudiante@ug.edu.ec"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-900"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-900"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center bg-blue-900 hover:bg-blue-800 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin mr-2 h-5 w-5" />
                Verificando...
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-5 w-5" />
                Ingresar
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}