'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { BookOpen, MessageSquare, Send, LogOut, Loader2 } from 'lucide-react'

export default function ChatPage() {
  const router = useRouter()
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState(null) // Guardamos el ID para el log

  // Verificamos usuario
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/')
      } else {
        setUserEmail(session.user.email)
        setUserId(session.user.id)
      }
    }
    getUser()
  }, [])

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return

    // 1. Mostrar mensaje del usuario inmediatamente
    const userMsg = { 
      type: 'user', 
      text: inputMessage, 
      time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) 
    }
    setMessages(prev => [...prev, userMsg])
    
    const mensajeAEnviar = inputMessage // Guardamos referencia
    setInputMessage('')
    setIsTyping(true)

    try {
      // 2. Conectar con nuestro "Cerebro" (API Route)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: mensajeAEnviar,
          userId: userId 
        })
      })

      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Error en el servidor')

      // 3. Mostrar respuesta de Gemini
      const botMsg = { 
        type: 'bot', 
        text: data.response, // Respuesta real de la IA
        time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
        source: data.source // Fuente del reglamento (si la hubo)
      }
      setMessages(prev => [...prev, botMsg])

    } catch (error) {
      console.error(error)
      // Mensaje de error en el chat
      setMessages(prev => [...prev, { 
        type: 'bot', 
        text: 'Lo siento, tuve un problema de conexión. Inténtalo de nuevo.', 
        time: new Date().toLocaleTimeString(),
        source: 'Error de Sistema'
      }])
    } finally {
      setIsTyping(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // ... (El resto del RETURN se mantiene igual que tu diseño anterior)
  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50 to-blue-100 font-sans">
      {/* Header */}
      <div className="bg-white shadow-md p-4 flex justify-between items-center border-b-4 border-blue-600 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-200">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800 leading-tight">Asistente Virtual UG</h1>
            <p className="text-xs text-gray-500">{userEmail}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-600 rounded-full transition text-sm font-medium border border-gray-200">
          <LogOut className="w-4 h-4" /> Salir
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
        {messages.length === 0 && (
          <div className="text-center py-12 animate-fade-in-up">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-100">
              <MessageSquare className="w-12 h-12 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">¡Hola! Soy tu asistente académico</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">Estoy entrenado con los reglamentos oficiales de la Universidad de Guayaquil. ¿En qué puedo ayudarte hoy?</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto px-4">
              {['¿Cómo es el proceso de titulación?', '¿Cuántas veces puedo repetir una materia?', '¿Qué requisitos necesito para graduarme?', '¿Cómo solicito una recalificación?'].map((q, i) => (
                <button key={i} onClick={() => { setInputMessage(q); handleSendMessage(); }} className="p-4 bg-white rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 transition text-left text-sm text-gray-700 border border-gray-100 group">
                  <span className="group-hover:text-blue-600 transition-colors">{q}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xl rounded-2xl p-5 shadow-sm ${msg.type === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none border border-gray-100'}`}>
              {/* Usamos whitespace-pre-wrap para que respete los saltos de línea de Gemini */}
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              {msg.source && <p className="text-xs mt-3 pt-2 border-t border-gray-100 opacity-70 italic flex items-center gap-1"><BookOpen size={10}/> Fuente: {msg.source}</p>}
              <p className={`text-[10px] mt-2 text-right ${msg.type === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>{msg.time}</p>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-bl-none p-4 shadow-sm border border-gray-100">
              <div className="flex gap-1.5 items-center">
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                <span className="text-xs text-gray-400">Consultando reglamentos...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-white p-4 border-t border-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="max-w-4xl mx-auto flex gap-3">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Escribe tu pregunta aquí..."
            className="flex-1 p-4 bg-gray-50 border border-gray-200 rounded-full focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition text-gray-800 placeholder-gray-400 shadow-inner"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isTyping}
            className="p-4 bg-blue-600 text-white rounded-full hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 transition disabled:bg-gray-300 disabled:shadow-none transform active:scale-95"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 text-center mt-3">
          IA entrenada con documentos oficiales de la Universidad de Guayaquil
        </p>
      </div>
    </div>
  )
}