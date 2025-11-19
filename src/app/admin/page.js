'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { BookOpen, MessageSquare, Plus, Edit2, Trash2, Search, LogOut, Menu, X, BarChart3, Clock, Save } from 'lucide-react'

export default function AdminPage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentView, setCurrentView] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  
  // Datos de Supabase
  const [reglamentos, setReglamentos] = useState([])
  const [logs, setLogs] = useState([])
  
  // Gestión de Categorías Dinámicas
  const [listaCategorias, setListaCategorias] = useState(['Titulación', 'Matrícula', 'Disciplinario', 'Financiero', 'Académico'])
  const [showModalCategoria, setShowModalCategoria] = useState(false)
  const [nuevaCategoriaInput, setNuevaCategoriaInput] = useState('')

  // Formulario
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({ titulo: '', categoria: '', contenido: '' })
  const [mensajeSistema, setMensajeSistema] = useState(null)

  // 1. Verificar Sesión y Cargar Datos
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }

      const { data: perfil } = await supabase
        .from('perfiles_usuarios')
        .select('rol')
        .eq('id', session.user.id)
        .single()

      if (perfil?.rol !== 'admin') {
        router.push('/chat')
      } else {
        setLoading(false)
        cargarDatos()
      }
    }
    checkAdmin()
  }, [])

  const cargarDatos = async () => {
    // A. Cargar Reglamentos
    const { data: regs } = await supabase.from('base_conocimiento').select('*').order('id', { ascending: false })
    if (regs) {
      setReglamentos(regs)
      // B. Truco: Extraer categorías únicas que ya existen en la BD para añadirlas a la lista
      const categoriasUsadas = [...new Set(regs.map(r => r.categoria).filter(Boolean))]
      setListaCategorias(prev => [...new Set([...prev, ...categoriasUsadas])])
    }

    // C. Cargar Logs
    const { data: logsData } = await supabase.from('logs_consultas').select('*').order('fecha', { ascending: false }).limit(10)
    if (logsData) setLogs(logsData)
  }

  // 2. Funciones del Formulario
  const handleSaveReglamento = async () => {
    if (!formData.titulo || !formData.categoria || !formData.contenido) {
      alert('Por favor complete todos los campos')
      return
    }
    
    let error = null
    if (editingId) {
      const { error: err } = await supabase.from('base_conocimiento').update(formData).eq('id', editingId)
      error = err
    } else {
      const { error: err } = await supabase.from('base_conocimiento').insert([formData])
      error = err
    }

    if (!error) {
      setMensajeSistema('Guardado correctamente')
      setFormData({ titulo: '', categoria: '', contenido: '' })
      setEditingId(null)
      setCurrentView('lista')
      cargarDatos()
      setTimeout(() => setMensajeSistema(null), 3000)
    } else {
      alert('Error al guardar: ' + error.message)
    }
  }

  const handleEdit = (reg) => {
    setFormData({ titulo: reg.titulo, categoria: reg.categoria, contenido: reg.contenido })
    setEditingId(reg.id)
    setCurrentView('nuevo')
  }

  const handleDelete = async (id) => {
    if (confirm('¿Está seguro de eliminar este reglamento?')) {
      const { error } = await supabase.from('base_conocimiento').delete().eq('id', id)
      if (!error) cargarDatos()
    }
  }

  // 3. Funciones para Nueva Categoría
  const handleSelectChange = (e) => {
    const valor = e.target.value
    if (valor === 'ADD_NEW') {
      setShowModalCategoria(true)
    } else {
      setFormData({ ...formData, categoria: valor })
    }
  }

  const guardarNuevaCategoria = () => {
    if (!nuevaCategoriaInput.trim()) return
    // Agregamos a la lista visual
    setListaCategorias(prev => [...prev, nuevaCategoriaInput])
    // La seleccionamos en el formulario
    setFormData({ ...formData, categoria: nuevaCategoriaInput })
    // Cerramos modal
    setShowModalCategoria(false)
    setNuevaCategoriaInput('')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return <div className="flex h-screen items-center justify-center">Cargando panel...</div>

  return (
    <div className="flex h-screen bg-gray-50 font-sans relative">
      {/* MODAL DE NUEVA CATEGORÍA */}
      {showModalCategoria && (
        <div className="fixed inset-0 bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl animate-fade-in-up">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Agregar Nueva Categoría</h3>
            <input 
              autoFocus
              type="text" 
              value={nuevaCategoriaInput}
              onChange={(e) => setNuevaCategoriaInput(e.target.value)}
              placeholder="Ej: Becas, Vinculación..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => setShowModalCategoria(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button 
                onClick={guardarNuevaCategoria}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-blue-900 text-white transition-all duration-300 flex flex-col shadow-xl`}>
        <div className="p-4 flex items-center justify-between border-b border-blue-800">
          {sidebarOpen && <h2 className="text-xl font-bold tracking-wide">Admin Panel</h2>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-blue-800 rounded transition">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setCurrentView('dashboard')} className={`w-full flex items-center gap-3 p-3 rounded-lg hover:bg-blue-800 transition ${currentView === 'dashboard' ? 'bg-blue-800 shadow-inner' : ''}`}>
            <BarChart3 className="w-5 h-5" /> {sidebarOpen && <span>Dashboard</span>}
          </button>
          <button onClick={() => setCurrentView('lista')} className={`w-full flex items-center gap-3 p-3 rounded-lg hover:bg-blue-800 transition ${currentView === 'lista' ? 'bg-blue-800 shadow-inner' : ''}`}>
            <BookOpen className="w-5 h-5" /> {sidebarOpen && <span>Reglamentos</span>}
          </button>
          <button onClick={() => { setCurrentView('nuevo'); setEditingId(null); setFormData({ titulo: '', categoria: '', contenido: '' }); }} className={`w-full flex items-center gap-3 p-3 rounded-lg hover:bg-blue-800 transition ${currentView === 'nuevo' ? 'bg-blue-800 shadow-inner' : ''}`}>
            <Plus className="w-5 h-5" /> {sidebarOpen && <span>Nuevo Reglamento</span>}
          </button>
          <button onClick={() => setCurrentView('logs')} className={`w-full flex items-center gap-3 p-3 rounded-lg hover:bg-blue-800 transition ${currentView === 'logs' ? 'bg-blue-800 shadow-inner' : ''}`}>
            <Clock className="w-5 h-5" /> {sidebarOpen && <span>Logs Consultas</span>}
          </button>
        </nav>
        
        <button onClick={handleLogout} className="p-4 flex items-center gap-3 border-t border-blue-800 hover:bg-blue-800 transition bg-blue-950">
          <LogOut className="w-5 h-5" /> {sidebarOpen && <span>Cerrar Sesión</span>}
        </button>
      </div>

      {/* Contenido Principal */}
      <div className="flex-1 overflow-auto">
        <div className="bg-white shadow-sm p-6 border-b flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">
            {currentView === 'dashboard' && 'Dashboard General'}
            {currentView === 'lista' && 'Gestión de Reglamentos'}
            {currentView === 'nuevo' && (editingId ? 'Editar Reglamento' : 'Agregar Nuevo Reglamento')}
            {currentView === 'logs' && 'Auditoría de Consultas'}
          </h1>
          {mensajeSistema && <span className="bg-green-100 text-green-700 px-3 py-1 rounded text-sm animate-pulse">{mensajeSistema}</span>}
        </div>

        <div className="p-6 max-w-6xl mx-auto">
          {/* VISTA: DASHBOARD */}
          {currentView === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm font-medium">Total Reglamentos</p>
                    <p className="text-3xl font-bold text-blue-600 mt-2">{reglamentos.length}</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-full"><BookOpen className="w-8 h-8 text-blue-600" /></div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition">
                 <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm font-medium">Consultas (Logs)</p>
                    <p className="text-3xl font-bold text-green-600 mt-2">{logs.length}</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-full"><MessageSquare className="w-8 h-8 text-green-600" /></div>
                </div>
              </div>
            </div>
          )}

          {/* VISTA: LISTA */}
          {currentView === 'lista' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-4 border-b bg-gray-50 rounded-t-xl flex gap-2">
                <Search className="w-5 h-5 text-gray-400 mt-2" />
                <input type="text" placeholder="Buscar reglamentos..." className="text-black flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="divide-y divide-gray-100">
                {reglamentos.map(reg => (
                  <div key={reg.id} className="p-5 hover:bg-blue-50 transition group">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                           <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-md uppercase tracking-wide">{reg.categoria}</span>
                           <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={12}/> {new Date(reg.fecha_actualizacion).toLocaleDateString()}</span>
                        </div>
                        <h3 className="font-bold text-gray-800 text-lg">{reg.titulo}</h3>
                        <p className="text-gray-600 text-sm mt-2 line-clamp-2 leading-relaxed">{reg.contenido}</p>
                      </div>
                      <div className="flex gap-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(reg)} className="p-2 text-blue-600 hover:bg-white hover:shadow rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(reg.id)} className="p-2 text-red-600 hover:bg-white hover:shadow rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentView === 'nuevo' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-3xl mx-auto">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Título del Reglamento</label>
                  <input type="text" value={formData.titulo} onChange={(e) => setFormData({...formData, titulo: e.target.value})} placeholder="Ej: Art. 45 - Proceso de Titulación" className="text-black w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Categoría</label>
                  <select 
                    value={formData.categoria} 
                    onChange={handleSelectChange} 
                    className="text-black w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition bg-white"
                  >
                    <option value="">Seleccionar categoría</option>
                    
                    <option value="ADD_NEW" className="text-blue-600 font-bold">+ Nueva Categoría...</option>
                    {/* Listamos las categorías dinámicas */}
                    {listaCategorias.map((cat, index) => (
                      <option key={index} value={cat}>{cat}</option>
                    ))}
                    
                    
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Contenido Completo</label>
                  <textarea value={formData.contenido} onChange={(e) => setFormData({...formData, contenido: e.target.value})} placeholder="Pegue aquí el texto oficial del reglamento..." rows="12" className="text-black w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition font-mono text-sm leading-relaxed" />
                </div>
                
                <div className="flex gap-4 pt-4">
                  <button onClick={handleSaveReglamento} className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-bold flex justify-center items-center gap-2 shadow-lg shadow-blue-200">
                    <Save size={20}/> {editingId ? 'Actualizar Reglamento' : 'Guardar Reglamento'}
                  </button>
                  <button onClick={() => { setCurrentView('lista'); setEditingId(null); }} className="px-8 bg-gray-100 text-gray-600 py-3 rounded-lg hover:bg-gray-200 transition font-semibold">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VISTA: LOGS DE CONSULTAS (Esto es lo que te faltaba) */}
          {currentView === 'logs' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-4 border-b bg-gray-50 rounded-t-xl">
                <h3 className="font-bold text-gray-700">Historial Reciente</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {logs.length === 0 ? (
                  <div className="p-10 text-center text-gray-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-20"/>
                    <p>No hay consultas registradas aún.</p>
                  </div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="p-6 hover:bg-gray-50 transition">
                      <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                          <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full font-bold">
                            Estudiante
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                             <Clock size={12}/> {new Date(log.fecha).toLocaleString()}
                          </span>
                        </div>
                        
                        <div>
                          <p className="font-bold text-gray-800 text-lg">"{log.pregunta}"</p>
                        </div>
                        
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                          <p className="text-xs font-bold text-blue-600 mb-1 uppercase flex items-center gap-1">
                            <BookOpen size={12}/> Respuesta generada:
                          </p>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {log.respuesta_bot}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}