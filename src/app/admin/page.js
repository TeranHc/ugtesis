'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { BookOpen, MessageSquare, Plus, Edit2, Trash2, Search, LogOut, Menu, X, BarChart3, Clock, Save, AlertTriangle, Loader2, ChevronDown, Filter, Calendar } from 'lucide-react'

export default function AdminPage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentView, setCurrentView] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  
  const [reglamentos, setReglamentos] = useState([])
  const [logs, setLogs] = useState([])
  
  // Gestión de Categorías
  const [listaCategorias, setListaCategorias] = useState([])
  const [showModalCategoria, setShowModalCategoria] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false) 
  const [showFilterDropdown, setShowFilterDropdown] = useState(false) 
  const [nuevaCategoriaInput, setNuevaCategoriaInput] = useState('')

  // Buscador y Filtros de Reglamentos
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('Todas') 

  // Filtros de Logs
  const [logTimeFilter, setLogTimeFilter] = useState('3días') 
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  const [deleteModal, setDeleteModal] = useState({ show: false, type: null, id: null })
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({ titulo: '', categoria: '', contenido: '' })
  const [mensajeSistema, setMensajeSistema] = useState(null)

  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false)
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }
      const { data: perfil } = await supabase.from('perfiles_usuarios').select('rol').eq('id', session.user.id).single()
      if (perfil?.rol !== 'admin') { router.push('/chat') } 
      else { setLoading(false); cargarDatos() }
    }
    checkAdmin()
  }, [])

  const cargarDatos = async () => {
    const { data: regs } = await supabase.from('base_conocimiento').select('*').order('id', { ascending: false })
    if (regs) {
      setReglamentos(regs)
      const categoriasBD = [...new Set(regs.map(r => r.categoria).filter(Boolean))]
      setListaCategorias(categoriasBD)
    }
    const { data: logsData } = await supabase.from('logs_consultas').select('*').order('fecha', { ascending: false })
    if (logsData) setLogs(logsData)
  }

  const highlightText = (text, highlight) => {
    if (!highlight.trim()) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() ? 
          <mark key={i} className="bg-yellow-200 text-black p-0 rounded font-bold">{part}</mark> : 
          part
        )}
      </span>
    );
  };

  const logsFiltrados = logs.filter(log => {
    const fechaLog = new Date(log.fecha);
    const ahora = new Date();
    if (logTimeFilter === 'hora') return ahora - fechaLog <= 3600000;
    if (logTimeFilter === 'hoy') return fechaLog.toDateString() === ahora.toDateString();
    if (logTimeFilter === '3días') return ahora - fechaLog <= 3 * 86400000;
    if (logTimeFilter === 'semana') return ahora - fechaLog <= 7 * 86400000;
    if (logTimeFilter === 'mes') return ahora - fechaLog <= 30 * 86400000;
    if (logTimeFilter === 'custom') {
      const inicio = customStartDate ? new Date(customStartDate) : null;
      const fin = customEndDate ? new Date(customEndDate) : null;
      if (fin) fin.setHours(23, 59, 59);
      if (inicio && fin) return fechaLog >= inicio && fechaLog <= fin;
      if (inicio) return fechaLog >= inicio;
      if (fin) return fechaLog <= fin;
    }
    return true;
  });

  const reglamentosFiltrados = reglamentos.filter(reg => {
    const matchesSearch = searchTerm === '' || 
      reg.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.categoria?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.contenido?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'Todas' || reg.categoria === filterCategory;
    return matchesSearch && matchesCategory;
  })

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
        body: JSON.stringify({ id: editingId, titulo: formData.titulo, categoria: formData.categoria, contenido: formData.contenido, action: editingId ? 'update' : 'create' })
      })
      if (!response.ok) throw new Error('Error al guardar')
      await vaciarTodoElCache(); setMensajeSistema('Guardado correctamente.'); setFormData({ titulo: '', categoria: '', contenido: '' }); setEditingId(null); setCurrentView('lista'); await cargarDatos(); setTimeout(() => setMensajeSistema(null), 5000)
    } catch (error) { alert('Error: ' + error.message); setMensajeSistema(null) }
  }

  const handleEdit = (reg) => {
    setFormData({ titulo: reg.titulo, categoria: reg.categoria, contenido: reg.contenido }); setEditingId(reg.id); setCurrentView('nuevo'); if (window.innerWidth < 768) setSidebarOpen(false)
  }

  const solicitarBorrarLog = (id) => setDeleteModal({ show: true, type: 'single', id })
  const solicitarVaciarHistorial = () => setDeleteModal({ show: true, type: 'all', id: null })
  const solicitarBorrarReglamento = (id) => setDeleteModal({ show: true, type: 'reglamento', id })

  const confirmarBorrado = async () => {
    let error = null
    if (deleteModal.type === 'reglamento') ({ error } = await supabase.from('base_conocimiento').delete().eq('id', deleteModal.id))
    else if (deleteModal.type === 'single') ({ error } = await supabase.from('logs_consultas').delete().eq('id', deleteModal.id))
    else if (deleteModal.type === 'all') await vaciarTodoElCache()
    else if (deleteModal.type === 'all_reglamentos') ({ error } = await supabase.from('base_conocimiento').delete().gt('id', 0))
    if (!error) { await cargarDatos(); setDeleteModal({ show: false, type: null, id: null }) } 
    else { alert('Error: ' + error.message) }
  }

  const guardarNuevaCategoria = () => {
    if (!nuevaCategoriaInput.trim()) return
    setListaCategorias(prev => [...new Set([...prev, nuevaCategoriaInput])]); setFormData({ ...formData, categoria: nuevaCategoriaInput }); setShowModalCategoria(false); setNuevaCategoriaInput('')
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  if (loading) return <div className="flex h-screen items-center justify-center font-sans text-black"><Loader2 className="animate-spin mr-2"/> Cargando...</div>

  return (
    <div className="flex h-screen bg-gray-50 font-sans relative overflow-hidden text-black">
      
      {sidebarOpen && ( <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-40 md:hidden" /> )}

      {deleteModal.show && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm text-black">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold">¿Estás seguro?</h3>
            <p className="text-gray-500 text-sm mt-2 mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal({ show: false, type: null })} className="flex-1 py-3 border rounded-xl font-medium hover:bg-gray-50 transition font-sans">Cancelar</button>
              <button onClick={confirmarBorrado} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold flex justify-center gap-2 hover:bg-red-700 transition font-sans font-bold"><Trash2 size={18}/> Borrar</button>
            </div>
          </div>
        </div>
      )}

      {showModalCategoria && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 text-black font-sans">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold mb-4">Nueva Categoría</h3>
            <input autoFocus type="text" value={nuevaCategoriaInput} onChange={(e) => setNuevaCategoriaInput(e.target.value)} className="w-full p-2 border rounded mb-4 text-black outline-none focus:ring-2 focus:ring-blue-500 font-sans" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModalCategoria(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded">Cancelar</button>
              <button onClick={guardarNuevaCategoria} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition">Guardar</button>
            </div>
          </div>
        </div>
      )}

      <div className={`fixed inset-y-0 left-0 z-50 bg-blue-900 text-white transition-all duration-300 flex flex-col shadow-xl md:relative ${sidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full md:w-20 md:translate-x-0'}`}>
        <div className="p-4 flex items-center justify-between border-b border-blue-800 h-16">
          {(sidebarOpen || window.innerWidth < 768) && <h2 className="text-xl font-bold tracking-wide truncate font-sans uppercase">Admin Panel</h2>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-blue-800 rounded transition">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto font-sans font-bold">
          {[
            { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
            { id: 'lista', icon: BookOpen, label: 'Reglamentos' },
            { id: 'nuevo', icon: Plus, label: 'Nuevo Reg.' },
            { id: 'logs', icon: Clock, label: 'Logs' }
          ].map((item) => (
            <button key={item.id} onClick={() => { setCurrentView(item.id); if(item.id === 'nuevo') { setEditingId(null); setFormData({titulo:'', categoria:'', contenido:''}) } if(window.innerWidth < 768) setSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-3 rounded-lg hover:bg-blue-800 transition ${currentView === item.id ? 'bg-blue-800 shadow-inner' : ''}`}>
              <item.icon className="w-5 h-5 min-w-[20px]" /> 
              <span className={`${!sidebarOpen && 'md:hidden'} transition-all duration-200 whitespace-nowrap`}>{item.label}</span>
            </button>
          ))}
        </nav>
        <button onClick={handleLogout} className="p-4 flex items-center gap-3 border-t border-blue-800 hover:bg-blue-800 transition bg-blue-950 font-sans font-bold">
          <LogOut className="w-5 h-5 min-w-[20px]" /> <span className={`${!sidebarOpen && 'md:hidden'}`}>Salir</span>
        </button>
      </div>

      <div className="flex-1 overflow-auto flex flex-col w-full relative text-black">
        <div className="bg-white shadow-sm p-4 border-b flex justify-between items-center sticky top-0 z-30 min-h-[64px]">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><Menu className="w-6 h-6" /></button>
            <h1 className="text-lg md:text-2xl font-bold text-gray-800 truncate font-sans uppercase">{currentView}</h1>
          </div>
          {mensajeSistema && <span className="hidden md:block bg-green-100 text-green-700 px-3 py-1 rounded text-sm animate-pulse font-medium font-sans font-bold">{mensajeSistema}</span>}
        </div>
        
        <div className="p-4 md:p-6 max-w-6xl mx-auto w-full font-sans">
          
          {currentView === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition"><div className="flex items-center justify-between font-bold"><div><p className="text-gray-500 text-sm font-medium">Reglamentos</p><p className="text-3xl font-bold text-blue-600 mt-2">{reglamentos.length}</p></div><div className="p-3 bg-blue-50 rounded-full"><BookOpen className="w-8 h-8 text-blue-600" /></div></div></div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition font-bold"><div className="flex items-center justify-between"><div><p className="text-gray-500 text-sm font-medium">Consultas</p><p className="text-3xl font-bold text-green-600 mt-2">{logs.length}</p></div><div className="p-3 bg-green-50 rounded-full"><MessageSquare className="w-8 h-8 text-green-600" /></div></div></div>
            </div>
          )}

          {currentView === 'lista' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden text-black">
              <div className="p-4 border-b bg-gray-50 flex flex-col lg:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                  <input type="text" placeholder="Buscar por título, categoría o contenido..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-black" />
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  {/* FILTRO CATEGORIA CORREGIDO */}
                  <div className="relative w-full sm:w-auto text-black font-sans font-bold">
                    <button onClick={() => setShowFilterDropdown(!showFilterDropdown)} className="w-full sm:w-64 flex items-center justify-between gap-2 bg-white border border-gray-300 px-3 py-2 rounded-lg text-sm font-bold transition hover:border-gray-400">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Filter className="w-4 h-4 text-gray-500 shrink-0" />
                        <span className="truncate">{filterCategory === 'Todas' ? 'Todas las Categorías' : filterCategory}</span>
                      </div>
                      <ChevronDown size={16} className={`text-gray-400 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showFilterDropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowFilterDropdown(false)}></div>
                        {/* Alineación corregida: left-0 en móvil/mitad de pantalla para que no se corte a la izquierda */}
                        <div className="absolute left-0 lg:right-0 z-50 mt-1 w-full sm:w-80 lg:w-72 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto font-bold">
                          <button onClick={() => { setFilterCategory('Todas'); setShowFilterDropdown(false); }} className={`w-full text-left p-3 text-sm transition-colors border-b ${filterCategory === 'Todas' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700 hover:bg-gray-50'}`}>Todas las Categorías</button>
                          {listaCategorias.map((cat, i) => (
                            <button key={i} onClick={() => { setFilterCategory(cat); setShowFilterDropdown(false); }} className={`w-full text-left p-3 text-sm transition-colors border-b last:border-0 leading-tight whitespace-normal ${filterCategory === cat ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700 hover:bg-gray-50'}`}>{cat}</button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  {reglamentos.length > 0 && (
                    <button onClick={() => setDeleteModal({show: true, type: 'all_reglamentos'})} className="w-full sm:w-auto text-red-600 bg-white border border-red-200 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition font-sans font-bold"><Trash2 size={16} /> Borrar Todo</button>
                  )}
                </div>
              </div>
              <div className="divide-y divide-gray-100 text-black">
                {reglamentosFiltrados.length === 0 ? (
                  <div className="p-10 text-center text-gray-500 flex flex-col items-center gap-2 font-sans"><Search className="w-10 h-10 text-gray-300" /><p>Sin resultados.</p></div>
                ) : (
                  reglamentosFiltrados.map(reg => (
                    <div key={reg.id} className="p-4 md:p-5 hover:bg-blue-50 transition group">
                      <div className="flex flex-col md:flex-row justify-between items-start gap-4 text-black">
                        <div className="flex-1 w-full text-black">
                          <div className="flex flex-wrap items-center gap-2 mb-1 font-bold">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] md:text-xs font-bold rounded-md uppercase">{highlightText(reg.categoria, searchTerm)}</span>
                            <span className="text-[10px] text-gray-400 flex items-center gap-1 font-sans font-bold"><Clock size={10}/> {new Date(reg.fecha_actualizacion).toLocaleDateString()}</span>
                          </div>
                          <h3 className="font-bold text-gray-800 text-base md:text-lg leading-tight font-sans">{highlightText(reg.titulo, searchTerm)}</h3>
                          <p className="text-gray-600 text-xs md:text-sm mt-2 line-clamp-2 leading-relaxed font-sans">{highlightText(reg.contenido, searchTerm)}</p>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto md:opacity-0 md:group-hover:opacity-100 transition-opacity justify-end border-t md:border-t-0 pt-3 md:pt-0">
                          <button onClick={() => handleEdit(reg)} className="flex-1 md:flex-none p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 flex justify-center hover:bg-blue-100"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => solicitarBorrarReglamento(reg.id)} className="flex-1 md:flex-none p-2 bg-red-50 text-red-600 rounded-lg border border-red-100 flex justify-center hover:bg-red-100"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {currentView === 'nuevo' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-8 max-w-4xl mx-auto text-black font-sans">
              <div className="space-y-4 md:space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Título</label>
                  <input type="text" value={formData.titulo} onChange={(e) => setFormData({...formData, titulo: e.target.value})} className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold" placeholder="Ej: Reglamento de Admisión..." />
                </div>
                <div className="relative">
                  <label className="block text-sm font-bold text-gray-700 mb-2 font-bold">Categoría</label>
                  <button onClick={() => setShowDropdown(!showDropdown)} className="w-full p-3 border rounded-lg bg-white text-black flex justify-between items-center outline-none focus:ring-2 focus:ring-blue-500 font-bold">
                    <span className="text-left leading-tight whitespace-normal">{formData.categoria || "Seleccionar"}</span>
                    <ChevronDown size={20} className={`text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)}></div>
                      <div className="absolute left-0 z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto font-bold">
                        <button onClick={() => { setShowModalCategoria(true); setShowDropdown(false); }} className="w-full text-left p-3 text-blue-600 font-bold hover:bg-blue-50 border-b">+ Nueva...</button>
                        {listaCategorias.map((cat, i) => (
                          <button key={i} onClick={() => { setFormData({...formData, categoria: cat}); setShowDropdown(false); }} className="w-full text-left p-3 text-black hover:bg-gray-50 border-b last:border-0 leading-tight whitespace-normal text-sm">{cat}</button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 font-bold">Contenido</label>
                  <textarea value={formData.contenido} onChange={(e) => setFormData({...formData, contenido: e.target.value})} rows="15" className="w-full p-3 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 font-bold" placeholder="Texto completo..." />
                  <p className="text-right text-xs text-gray-400 mt-1 font-bold font-sans">Caracteres: {formData.contenido.length}</p>
                </div>
                <div className="flex flex-col-reverse md:flex-row gap-4 pt-4 border-t font-sans">
                  <button onClick={() => setCurrentView('lista')} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-lg text-center font-bold">Cancelar</button>
                  <button onClick={handleSaveReglamento} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2 hover:bg-blue-700 transition shadow-lg shadow-blue-200"><Save size={20}/> Guardar Reglamento</button>
                </div>
              </div>
            </div>
          )}

          {currentView === 'logs' && (
            <div className="space-y-4 font-sans text-black">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Clock size={18} className="text-gray-400 mr-2" />
                  {[
                    { id: 'hora', label: '1h' },
                    { id: 'hoy', label: 'Hoy' },
                    { id: '3días', label: '3 días' },
                    { id: 'semana', label: '1 sem' },
                    { id: 'mes', label: '1 mes' },
                    { id: 'custom', label: 'Personalizado' },
                    { id: 'all', label: 'Todo' }
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      onClick={() => setLogTimeFilter(btn.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${logTimeFilter === btn.id ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
                {logTimeFilter === 'custom' && (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 font-bold">
                    <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="p-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500" />
                    <span className="text-gray-400">a</span>
                    <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="p-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                )}
                {logs.length > 0 && (
                  <button onClick={solicitarVaciarHistorial} className="text-red-600 text-xs md:text-sm font-bold flex items-center gap-1 hover:text-red-800 transition">
                    <Trash2 size={14} /> Vaciar Historial
                  </button>
                )}
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 text-black">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center rounded-t-xl font-bold">
                  <h3 className="font-bold text-gray-700 flex items-center gap-2">
                    <MessageSquare size={18} /> Mostrando {logsFiltrados.length} consultas
                  </h3>
                </div>
                <div className="divide-y divide-gray-100 text-black">
                  {logsFiltrados.length === 0 ? (
                    <div className="p-10 text-center text-gray-500 font-medium">Sin registros en este período</div>
                  ) : (
                    logsFiltrados.map((log) => (
                      <div key={log.id} className="p-4 md:p-6 hover:bg-gray-50 transition relative group">
                        <button onClick={() => solicitarBorrarLog(log.id)} className="absolute top-4 right-4 text-red-400 p-2 md:opacity-0 md:group-hover:opacity-100 transition"><Trash2 size={18} /></button>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <span className="bg-indigo-100 text-indigo-800 text-[10px] px-2 py-1 rounded-full font-bold uppercase">Estudiante</span>
                            <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1 font-bold"><Calendar size={10}/> {new Date(log.fecha).toLocaleString()}</span>
                          </div>
                          <p className="font-bold text-gray-800 text-base font-bold">"{log.pregunta}"</p>
                          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm text-gray-700 mt-1 leading-relaxed font-bold">{log.respuesta_bot}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}