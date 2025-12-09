// src/app/admin/page.js
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { BookOpen, MessageSquare, Plus, Edit2, Trash2, Search, LogOut, Menu, X, BarChart3, Clock, Save, AlertTriangle, Loader2 } from 'lucide-react'

export default function AdminPage() {
  const router = useRouter()
  // En móvil empezamos con el sidebar cerrado (false), en PC abierto (true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentView, setCurrentView] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  
  // Datos de Supabase
  const [reglamentos, setReglamentos] = useState([])
  const [logs, setLogs] = useState([])
  
  // Gestión de Categorías
  const [listaCategorias, setListaCategorias] = useState(['Titulación', 'Matrícula', 'Disciplinario', 'Financiero', 'Académico'])
  const [showModalCategoria, setShowModalCategoria] = useState(false)
  const [nuevaCategoriaInput, setNuevaCategoriaInput] = useState('')

  // Modal Borrado
  const [deleteModal, setDeleteModal] = useState({ show: false, type: null, id: null })

  // Formulario
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({ titulo: '', categoria: '', contenido: '' })
  const [mensajeSistema, setMensajeSistema] = useState(null)

  // 1. Verificar Sesión y Ajustar Sidebar inicial según pantalla
  useEffect(() => {
    // Ajuste responsive inicial: si es pantalla chica, cierra el sidebar
    if (window.innerWidth < 768) {
      setSidebarOpen(false)
    }

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
    const { data: regs } = await supabase.from('base_conocimiento').select('*').order('id', { ascending: false })
    if (regs) {
      setReglamentos(regs)
      const categoriasUsadas = [...new Set(regs.map(r => r.categoria).filter(Boolean))]
      setListaCategorias(prev => [...new Set([...prev, ...categoriasUsadas])])
    }

    const { data: logsData } = await supabase.from('logs_consultas').select('*').order('fecha', { ascending: false })
    if (logsData) setLogs(logsData)
  }

  // --- LÓGICA DE BORRADO Y GUARDADO (Mantenida igual) ---
  const vaciarTodoElCache = async () => {
    const { error } = await supabase.from('logs_consultas').delete().gt('id', 0)
    if (!error) await cargarDatos()
  }

  const handleSaveReglamento = async () => {
    if (!formData.titulo || !formData.categoria || !formData.contenido) return alert('Complete campos')
    setMensajeSistema('Generando vectores...')
    
    try {
      const response = await fetch('/api/admin/guardar-reglamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          titulo: formData.titulo,
          categoria: formData.categoria,
          contenido: formData.contenido,
          action: editingId ? 'update' : 'create'
        })
      })
      if (!response.ok) throw new Error('Error al guardar')
      await vaciarTodoElCache()
      setMensajeSistema('Guardado correctamente.')
      setFormData({ titulo: '', categoria: '', contenido: '' })
      setEditingId(null)
      setCurrentView('lista')
      await cargarDatos() 
      setTimeout(() => setMensajeSistema(null), 5000)
    } catch (error) {
      alert('Error: ' + error.message)
      setMensajeSistema(null)
    }
  }

  const handleEdit = (reg) => {
    setFormData({ titulo: reg.titulo, categoria: reg.categoria, contenido: reg.contenido })
    setEditingId(reg.id)
    setCurrentView('nuevo')
    // En móvil, cerramos sidebar al ir a editar para ver el form
    if (window.innerWidth < 768) setSidebarOpen(false)
  }

  // --- GESTIÓN MODALES ---
  const solicitarBorrarReglamento = (id) => setDeleteModal({ show: true, type: 'reglamento', id })
  const solicitarBorrarLog = (id) => setDeleteModal({ show: true, type: 'single', id })
  const solicitarVaciarHistorial = () => setDeleteModal({ show: true, type: 'all', id: null })
  const solicitarVaciarReglamentos = () => setDeleteModal({ show: true, type: 'all_reglamentos', id: null })

  const confirmarBorrado = async () => {
    let error = null
    if (deleteModal.type === 'reglamento') ({ error } = await supabase.from('base_conocimiento').delete().eq('id', deleteModal.id))
    else if (deleteModal.type === 'single') ({ error } = await supabase.from('logs_consultas').delete().eq('id', deleteModal.id))
    else if (deleteModal.type === 'all') await vaciarTodoElCache()
    else if (deleteModal.type === 'all_reglamentos') ({ error } = await supabase.from('base_conocimiento').delete().gt('id', 0))

    if (!error) {
      if (deleteModal.type.includes('reglamento')) await vaciarTodoElCache()
      else await cargarDatos()
      if (deleteModal.type === 'all_reglamentos') setMensajeSistema('Base vaciada.')
    } else {
      alert('Error: ' + error.message)
    }
    setDeleteModal({ show: false, type: null, id: null })
  }

  // Auxiliares
  const handleSelectChange = (e) => {
    if (e.target.value === 'ADD_NEW') setShowModalCategoria(true)
    else setFormData({ ...formData, categoria: e.target.value })
  }

  const guardarNuevaCategoria = () => {
    if (!nuevaCategoriaInput.trim()) return
    setListaCategorias(prev => [...prev, nuevaCategoriaInput])
    setFormData({ ...formData, categoria: nuevaCategoriaInput })
    setShowModalCategoria(false)
    setNuevaCategoriaInput('')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin mr-2"/> Cargando...</div>

  return (
    <div className="flex h-screen bg-gray-50 font-sans relative overflow-hidden">
      
      {/* 1. BACKDROP PARA MÓVIL (Fondo oscuro cuando abres menú) */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
        />
      )}

      {/* MODALES (Mismo código, responsive por defecto) */}
      {deleteModal.show && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800">¿Estás seguro?</h3>
            <p className="text-gray-500 text-sm mt-2 mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal({ show: false, type: null })} className="flex-1 py-3 border rounded-xl">Cancelar</button>
              <button onClick={confirmarBorrado} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold flex justify-center gap-2"><Trash2 size={18}/> Borrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CATEGORIA */}
      {showModalCategoria && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="font-bold mb-4 text-black">Nueva Categoría</h3>
            <input autoFocus type="text" value={nuevaCategoriaInput} onChange={(e) => setNuevaCategoriaInput(e.target.value)} className="w-full p-2 border rounded mb-4 text-black" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModalCategoria(false)} className="px-4 py-2 text-gray-600">Cancelar</button>
              <button onClick={guardarNuevaCategoria} className="px-4 py-2 bg-blue-600 text-white rounded">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. SIDEBAR RESPONSIVE */}
      <div className={`
        fixed inset-y-0 left-0 z-50 bg-blue-900 text-white transition-all duration-300 flex flex-col shadow-xl
        md:relative 
        ${sidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full md:w-20 md:translate-x-0'}
      `}>
        <div className="p-4 flex items-center justify-between border-b border-blue-800 h-16">
          {(sidebarOpen || window.innerWidth < 768) && <h2 className="text-xl font-bold tracking-wide truncate">Admin Panel</h2>}
          {/* Botón de cerrar menú (visible solo en móvil o cuando está expandido en PC) */}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-blue-800 rounded transition">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {/* Función auxiliar para items del menú */}
          {[
            { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
            { id: 'lista', icon: BookOpen, label: 'Reglamentos' },
            { id: 'nuevo', icon: Plus, label: 'Nuevo Reg.' },
            { id: 'logs', icon: Clock, label: 'Logs' }
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => { 
                setCurrentView(item.id); 
                if(item.id === 'nuevo') { setEditingId(null); setFormData({titulo:'', categoria:'', contenido:''}) }
                if(window.innerWidth < 768) setSidebarOpen(false); // Cerrar menú al hacer clic en móvil
              }} 
              className={`w-full flex items-center gap-3 p-3 rounded-lg hover:bg-blue-800 transition ${currentView === item.id ? 'bg-blue-800 shadow-inner' : ''}`}
            >
              <item.icon className="w-5 h-5 min-w-[20px]" /> 
              <span className={`${!sidebarOpen && 'md:hidden'} transition-all duration-200 whitespace-nowrap`}>{item.label}</span>
            </button>
          ))}
        </nav>
        
        <button onClick={handleLogout} className="p-4 flex items-center gap-3 border-t border-blue-800 hover:bg-blue-800 transition bg-blue-950">
          <LogOut className="w-5 h-5 min-w-[20px]" /> 
          <span className={`${!sidebarOpen && 'md:hidden'}`}>Salir</span>
        </button>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 overflow-auto flex flex-col w-full relative">
        
        {/* HEADER SUPERIOR */}
        <div className="bg-white shadow-sm p-4 border-b flex justify-between items-center sticky top-0 z-30 min-h-[64px]">
          <div className="flex items-center gap-3">
            {/* Botón hamburguesa SOLO para móvil */}
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              <Menu className="w-6 h-6" />
            </button>
            
            <h1 className="text-lg md:text-2xl font-bold text-gray-800 truncate max-w-[200px] md:max-w-none">
              {currentView === 'dashboard' && 'Dashboard'}
              {currentView === 'lista' && 'Reglamentos'}
              {currentView === 'nuevo' && 'Editor'}
              {currentView === 'logs' && 'Auditoría'}
            </h1>
          </div>
          
          {mensajeSistema && <span className="hidden md:block bg-green-100 text-green-700 px-3 py-1 rounded text-sm animate-pulse">{mensajeSistema}</span>}
        </div>
        
        {/* Mensaje sistema móvil (debajo del header si es necesario) */}
        {mensajeSistema && <div className="md:hidden bg-green-100 text-green-700 px-4 py-2 text-center text-sm">{mensajeSistema}</div>}

        <div className="p-4 md:p-6 max-w-6xl mx-auto w-full">
          
          {/* DASHBOARD (Grid ya es responsive, solo ajustamos gap) */}
          {currentView === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"><div className="flex items-center justify-between"><div><p className="text-gray-500 text-sm font-medium">Reglamentos</p><p className="text-3xl font-bold text-blue-600 mt-2">{reglamentos.length}</p></div><div className="p-3 bg-blue-50 rounded-full"><BookOpen className="w-8 h-8 text-blue-600" /></div></div></div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"><div className="flex items-center justify-between"><div><p className="text-gray-500 text-sm font-medium">Consultas</p><p className="text-3xl font-bold text-green-600 mt-2">{logs.length}</p></div><div className="p-3 bg-green-50 rounded-full"><MessageSquare className="w-8 h-8 text-green-600" /></div></div></div>
            </div>
          )}

          {/* LISTA DE REGLAMENTOS (Ajustado a Flex-Col en móvil) */}
          {currentView === 'lista' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                  <input type="text" placeholder="Buscar..." className="text-black w-full pl-10 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                {reglamentos.length > 0 && (
                  <button onClick={solicitarVaciarReglamentos} className="text-red-600 bg-white border border-gray-200 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                    <Trash2 size={16} /> Borrar Todo
                  </button>
                )}
              </div>
              <div className="divide-y divide-gray-100">
                {reglamentos.map(reg => (
                  <div key={reg.id} className="p-4 md:p-5 hover:bg-blue-50 transition">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                      <div className="flex-1 w-full">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] md:text-xs font-bold rounded-md uppercase">{reg.categoria}</span>
                          <span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={10}/> {new Date(reg.fecha_actualizacion).toLocaleDateString()}</span>
                        </div>
                        <h3 className="font-bold text-gray-800 text-base md:text-lg">{reg.titulo}</h3>
                        <p className="text-gray-600 text-xs md:text-sm mt-1 line-clamp-2">{reg.contenido}</p>
                      </div>
                      
                      {/* Botones siempre visibles en móvil, hover en PC */}
                      <div className="flex gap-2 w-full md:w-auto md:opacity-0 md:group-hover:opacity-100 transition-opacity justify-end">
                        <button onClick={() => handleEdit(reg)} className="flex-1 md:flex-none p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 flex justify-center"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => solicitarBorrarReglamento(reg.id)} className="flex-1 md:flex-none p-2 bg-red-50 text-red-600 rounded-lg border border-red-100 flex justify-center"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FORMULARIO (Padding ajustado) */}
          {currentView === 'nuevo' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-8 max-w-3xl mx-auto">
              <div className="space-y-4 md:space-y-6">
                <div><label className="block text-sm font-bold text-gray-700 mb-2">Título</label><input type="text" value={formData.titulo} onChange={(e) => setFormData({...formData, titulo: e.target.value})} className="text-black w-full p-3 border rounded-lg" /></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-2">Categoría</label><select value={formData.categoria} onChange={handleSelectChange} className="text-black w-full p-3 border rounded-lg bg-white"><option value="">Seleccionar</option><option value="ADD_NEW">+ Nueva...</option>{listaCategorias.map((cat, i) => (<option key={i} value={cat}>{cat}</option>))}</select></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-2">Contenido</label><textarea value={formData.contenido} onChange={(e) => setFormData({...formData, contenido: e.target.value})} rows="8" className="text-black w-full p-3 border rounded-lg text-sm" /></div>
                <div className="flex flex-col-reverse md:flex-row gap-4 pt-4">
                  <button onClick={() => setCurrentView('lista')} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-lg text-center">Cancelar</button>
                  <button onClick={handleSaveReglamento} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2"><Save size={20}/> Guardar</button>
                </div>
              </div>
            </div>
          )}

          {/* LOGS (Responsive Cards) */}
          {currentView === 'logs' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-4 border-b bg-gray-50 rounded-t-xl flex justify-between items-center">
                <h3 className="font-bold text-gray-700">Historial</h3>
                {logs.length > 0 && (<button onClick={solicitarVaciarHistorial} className="text-red-600 text-xs md:text-sm font-bold flex items-center gap-1"><Trash2 size={14} /> Vaciar</button>)}
              </div>
              <div className="divide-y divide-gray-100">
                {logs.length === 0 ? (<div className="p-10 text-center text-gray-500">Sin registros</div>) : (
                  logs.map((log) => (
                    <div key={log.id} className="p-4 md:p-6 hover:bg-gray-50 transition relative group">
                      <button onClick={() => solicitarBorrarLog(log.id)} className="absolute top-4 right-4 text-red-400 p-2 md:opacity-0 md:group-hover:opacity-100"><Trash2 size={18} /></button>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2"><span className="bg-indigo-100 text-indigo-800 text-[10px] px-2 py-1 rounded-full font-bold">Estudiante</span><span className="text-[10px] text-gray-400">{new Date(log.fecha).toLocaleString()}</span></div>
                        <p className="font-bold text-gray-800 text-base">"{log.pregunta}"</p>
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm text-gray-700 mt-1">{log.respuesta_bot}</div>
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