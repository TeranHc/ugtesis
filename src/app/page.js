// src/app/page.js
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, LogIn, Download } from 'lucide-react' // <--- 1. Agregamos icono Download

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // --- NUEVO: ESTADO PARA LA INSTALACIÓN ---
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstallable, setIsInstallable] = useState(false)

  // 1. Verificar sesión y capturar evento de instalación
  useEffect(() => {
    // A. Verificar sesión
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        redirigirUsuario(session.user.id)
      }
    }
    checkSession()

    // B. Capturar evento de instalación (PWA)
    const handleInstallPrompt = (e) => {
      // Prevenir que Chrome muestre la barra automática enseguida
      e.preventDefault()
      // Guardar el evento para dispararlo después con el botón
      setDeferredPrompt(e)
      // Mostrar el botón en la interfaz
      setIsInstallable(true)
    }

    window.addEventListener('beforeinstallprompt', handleInstallPrompt)

    // Limpieza
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
    }
  }, [])

  // --- NUEVO: FUNCIÓN PARA INSTALAR ---
  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    // Mostrar el prompt nativo
    deferredPrompt.prompt()

    // Esperar a ver qué decidió el usuario
    const { outcome } = await deferredPrompt.userChoice
    
    if (outcome === 'accepted') {
      console.log('Usuario aceptó instalar')
      setDeferredPrompt(null)
      setIsInstallable(false) // Ocultar botón
    }
  }

  // 2. Función inteligente para redirigir según el rol
  const redirigirUsuario = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('perfiles_usuarios')
        .select('rol')
        .eq('id', userId)
        .single()

      if (error) throw error

      if (data?.rol === 'admin') {
        router.push('/admin') 
      } else {
        router.push('/chat')  
      }
    } catch (err) {
      console.error('Error verificando rol:', err)
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
        
        <div className="text-center relative">
          {/* BOTÓN DE INSTALACIÓN (Solo visible si es instalable) */}
          {isInstallable && (
            <button 
              onClick={handleInstallClick}
              className="absolute top-0 right-0 p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full transition shadow-sm animate-pulse"
              title="Instalar App"
            >
              <Download size={20} />
            </button>
          )}

          <h1 className="text-3xl font-bold text-blue-900">Asistente UG</h1>
          <p className="text-gray-500 mt-2">Sistema de Apoyo Académico</p>
          
          {/* Mensaje extra si se puede instalar */}
          {isInstallable && (
             <p className="text-xs text-blue-600 mt-1 cursor-pointer hover:underline" onClick={handleInstallClick}>
               ¡Instalar aplicación en tu celular!
             </p>
          )}
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