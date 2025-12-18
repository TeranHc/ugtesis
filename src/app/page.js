// src/app/page.js
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
// 1. IMPORTAMOS LOS ICONOS NUEVOS (Eye, EyeOff)
import { Loader2, LogIn, Download, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // 2. ESTADO PARA CONTROLAR LA VISIBILIDAD DE LA CONTRASEÑA
  const [showPassword, setShowPassword] = useState(false)
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // --- ESTADO PARA LA INSTALACIÓN (PWA) ---
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstallable, setIsInstallable] = useState(false)

  // Verificar sesión y capturar evento de instalación
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        redirigirUsuario(session.user.id)
      }
    }
    checkSession()

    const handleInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      console.log('Usuario aceptó instalar')
      setDeferredPrompt(null)
      setIsInstallable(false)
    }
  }

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
          {/* BOTÓN DE INSTALACIÓN */}
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

          {/* 3. CAMBIO PRINCIPAL: Input de contraseña con botón */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <div className="relative">
              <input
                // Aquí cambiamos el tipo dinámicamente
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                // Agregamos 'pr-10' (padding-right) para que el texto no se monte sobre el ojo
                className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-900"
                required
              />
              
              {/* Botón del Ojo */}
              <button
                type="button" // Importante: type="button" para que no envíe el formulario
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPassword ? (
                  <EyeOff size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </button>
            </div>
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