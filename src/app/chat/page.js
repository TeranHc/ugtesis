//src/app/chat/page.js
'use client'
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import * as THREE from 'three';
// Importamos Cargador y Controles
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; 
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// 🔥 NUEVO ICONO: VolumeX para el botón de silenciar
import { Mic, MicOff, LogOut, Send, BookOpen, MessageSquare, Loader2, VolumeX } from 'lucide-react';

export default function AsistenteFinalAzul() {
  // --- ESTADO ---
  const router = useRouter()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [emotion, setEmotion] = useState('neutral')
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState(null)
  const [isListening, setIsListening] = useState(false)
  // 🔥 NUEVO ESTADO: Para saber si está hablando
  const [isSpeaking, setIsSpeaking] = useState(false)

  // --- REFS ---
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const characterRef = useRef(null)
  const particlesRef = useRef(null)
  const recognitionRef = useRef(null)
  const messagesEndRef = useRef(null)

  // 📍 NUEVAS REFS PARA ANIMACIÓN
  const mixerRef = useRef(null) 
  const actionsRef = useRef({}) 
  const clockRef = useRef(new THREE.Clock()) 
  const animationFrameRef = useRef(null)

  // --- AUTENTICACIÓN ---
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
  }, [router])

  const handleLogout = async () => {
    // 1. Callar a la asistente primero
    if(typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    
    // 2. Intentar cerrar sesión en Supabase
    try {
        const { error } = await supabase.auth.signOut();
        if (error) console.log("Aviso al cerrar sesión:", error.message);
    } catch (error) {
        console.log("Error de red o sesión ya cerrada:", error);
    } finally {
        // 3. 🔥 ESTA ES LA CLAVE: Redirigir SIEMPRE, haya error o no.
        // Limpiamos caché local por si acaso y nos vamos.
        localStorage.clear(); // Opcional: asegura limpieza total
        router.refresh(); 
        router.push('/');
    }
  }

  // --- SCROLL AUTOMÁTICO CHAT ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  // --- HELPER: FORMATEAR TEXTO (Negritas) ---
  const formatMessage = (text) => {
    if (!text) return '';
    const parts = text.split('**');
    return parts.map((part, index) => 
        index % 2 === 1 ? <strong key={index} className="font-bold text-blue-800">{part}</strong> : part
    );
  };

  // --- VOZ (SPEECH TO TEXT) ---
  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.lang = 'es-EC'
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = false
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        setInput(transcript)
        setIsListening(false)
      }
      recognitionRef.current.onend = () => setIsListening(false)
      recognitionRef.current.onerror = () => setIsListening(false)
    }
  }, [])

  const toggleVoice = () => {
    if (!recognitionRef.current) return alert('Navegador no compatible')
    
    // Si queremos hablar, primero callamos al asistente si está hablando
    if (!isListening && isSpeaking) {
        stopSpeaking();
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  // --- TEXT TO SPEECH (MODIFICADO CON CONTROL DE ESTADO) ---
  const speakText = (text) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    
    // Cancelamos cualquier audio previo
    window.speechSynthesis.cancel()

    const cleanText = text.replace(/\*/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText)
    
    const voices = window.speechSynthesis.getVoices()
    const spanishVoices = voices.filter(v => v.lang.includes('es'))
    let femaleVoice = spanishVoices.find(v => 
        v.name.includes('Sabina') || 
        v.name.includes('Paulina') || 
        v.name.includes('Elena') || 
        v.name.includes('Laura') || 
        v.name.includes('Monica') ||
        v.name.includes('Google español')
    )

    if (femaleVoice) {
        utterance.voice = femaleVoice
    } else if (spanishVoices.length > 0) {
        utterance.voice = spanishVoices[0]
    }

    utterance.rate = 1.0 
    utterance.pitch = 1.1 

    // 🔥 EVENTOS: Controlamos el estado del botón
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance)
  }

  // 🔥 NUEVA FUNCIÓN: Detener el habla manualmente
  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
    }
  }

  // ==========================================
  // 🎨 THREE.JS: ESCENA 3D
  // ==========================================
  useEffect(() => {
    if (!mountRef.current) return

    // 1. Configuración de Escena
    const scene = new THREE.Scene();
    const deepBlue = 0x051535; 
    scene.fog = new THREE.Fog(deepBlue, 5, 20); 
    scene.background = new THREE.Color(deepBlue);
    sceneRef.current = scene;

    // 2. Cámara
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000); 
// --- 🔥 LÓGICA MÓVIL VS PC ---
    const isMobile = width < 768; // Consideramos móvil si es menor a 768px

    if (isMobile) {
        // 📱 MÓVIL: Más cerca (Menor Z) y quizás un poco más abajo (Menor Y)
        // Juega con el último número: 0.8 o 0.7 para mucho zoom
        camera.position.set(0, 1.55, 0.75); 
    } else {
        // 💻 PC: Configuración normal
        camera.position.set(0, 1.65, 0.9); 
    }    // 3. Renderizador
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true; 
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace; 
    renderer.toneMapping = THREE.ACESFilmicToneMapping; 
    renderer.toneMappingExposure = 0.85;
    
    while (mountRef.current.firstChild) mountRef.current.removeChild(mountRef.current.firstChild);
    mountRef.current.appendChild(renderer.domElement);

    // 4. Controles
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; 
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;    
    controls.minDistance = 0.5;    
    controls.maxDistance = 4;      
    controls.maxPolarAngle = Math.PI / 2; 
    controls.target.set(0, 1.55, 0); 

// 5. Iluminación (AJUSTADA: Más brillo general sin quemar)

    // --- CAMBIO 1: Aumentar Luz Ambiental ---
    // Antes estaba en 0.3. La subimos a 0.7.
    // Esto hace que las sombras más oscuras sean gris claro en lugar de negro,
    // "levantando" toda la escena.
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); 
    scene.add(ambientLight);

    // --- CAMBIO 2: Ajustar Luz Principal (Key Light) ---
    // Mantenemos la intensidad en 1.2 (está bien), pero bajamos un poco su posición Y.
    // Antes: .set(2, 5, 5) -> Ahora: .set(2, 3.5, 5)
    // Al bajarla, le da más de lleno en la cara y el pecho, no tanto desde arriba.
    const mainLight = new THREE.DirectionalLight(0xffeebb, 1.2); 
    mainLight.position.set(2, 3.5, 5); // Posición Y bajada para iluminar mejor el rostro
    mainLight.castShadow = true;
    mainLight.shadow.bias = -0.0005;
    mainLight.shadow.mapSize.width = 2048; 
    mainLight.shadow.mapSize.height = 2048;
    scene.add(mainLight);

    // --- CAMBIO 3: Aumentar Luz de Relleno (Hemisphere) ---
    // Antes estaba en 0.8. La subimos a 1.3.
    // Esta luz es fundamental en entornos oscuros. Rellena todo el modelo
    // con una luz suave azulada, haciendo que resalte del fondo.
    const fillLight = new THREE.HemisphereLight(0xddeeff, 0x252550, 1.3); 
    fillLight.position.set(0, 5, -2);
    scene.add(fillLight);

    // --- CAMBIO 4: Luz de Borde (Rim Light) ---
    // La mantenemos igual, hace un buen trabajo separando el pelo del fondo.
    const rimLight = new THREE.SpotLight(0x00ffff, 2.5); 
    rimLight.position.set(-5, 5, 2);
    rimLight.lookAt(0, 1, 0);
    scene.add(rimLight);
    
    // 6. Suelo
    const floorGeometry = new THREE.CircleGeometry(5, 32);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x102050, 
        roughness: 0.3, 
        metalness: 0.5 
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add(floor);

    // 7. Partículas
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 200;
    const positions = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount * 3; i++) positions[i] = (Math.random() - 0.5) * 15;
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particlesMaterial = new THREE.PointsMaterial({ color: 0x00ffff, size: 0.05, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);
    particlesRef.current = particles;

    // 8. Cargar Modelo
    const loader = new GLTFLoader();
    loader.load(
      '/Mary.glb', // Asegúrate de que este sea el nombre correcto del archivo nuevo
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(1, 1, 1); 
        model.position.set(0, 0, 0); 
        
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.geometry) child.geometry.computeVertexNormals(); 
            }
        });

        const mixer = new THREE.AnimationMixer(model);
        mixerRef.current = mixer;

        // --- 🔥 AQUÍ ESTÁ EL CAMBIO CLAVE ---
        const animations = gltf.animations;
        if (animations && animations.length > 0) {
            
            // 1. ACTIVAR REPOSO (IDLE) AUTOMÁTICAMENTE
            // Buscamos la animación llamada 'reposo'
            let reposoClip = THREE.AnimationClip.findByName(animations, 'reposo');
            
            // SI NO LA ENCUENTRA: Usamos la primera animación disponible como respaldo (Plan B)
            if (!reposoClip) {
                console.log("No encontré 'reposo', usando la primera animación disponible.");
                reposoClip = animations[0];
            }

            if (reposoClip) {
                const action = mixer.clipAction(reposoClip);
                action.play(); // <--- ¡ESTO ES LO QUE BAJA LOS BRAZOS!
                actionsRef.current['reposo'] = action;
            }

            // 2. CONFIGURAR SONRISA (Para usarla después)
            const sonrisaClip = THREE.AnimationClip.findByName(animations, 'sonrisa');
            if (sonrisaClip) {
                const action = mixer.clipAction(sonrisaClip);
                action.loop = THREE.LoopOnce; 
                action.clampWhenFinished = true;
                actionsRef.current['sonrisa'] = action;
            }
        }
        // ------------------------------------

        scene.add(model);
        characterRef.current = model;
      },
      undefined,
      (error) => console.error('Error cargando el modelo:', error)
    );

    // 9. Loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      const delta = clockRef.current.getDelta();
      if (mixerRef.current) mixerRef.current.update(delta);
      controls.update();
      if (particlesRef.current) particlesRef.current.rotation.y += 0.001;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
        if(mountRef.current && camera && renderer) {
            const w = mountRef.current.clientWidth;
            const h = mountRef.current.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        }
    }
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameRef.current);
      if(mountRef.current && renderer.domElement) mountRef.current.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []); 

    const handleSubmit = async (textOverride = null) => {
      const textToSend = textOverride || input;
      if (!textToSend.trim()) return;

      // Si empieza a "pensar", cortamos cualquier audio anterior
      stopSpeaking();

      if (actionsRef.current['sonrisa']) {
          const action = actionsRef.current['sonrisa'];
          action.reset();
          action.setLoop(THREE.LoopOnce);
          action.play();
      }

      const userMsg = { role: 'user', content: textToSend, time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) };
      setMessages(prev => [...prev, userMsg]);
      if (!textOverride) setInput('');
      setIsLoading(true);
      setEmotion('neutral');
      
      try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-secret-key': 'tesis-segura-2025-guayaquil-bloqueo' 
        },
        body: JSON.stringify({ message: textToSend, userId: userId })
      });
        
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || data.response || 'Error desconocido');

        const botMsg = { role: 'bot', content: data.response, source: data.source, time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) };
        setMessages(prev => [...prev, botMsg]);
        setEmotion('happy'); 
        speakText(data.response);
        setTimeout(() => setEmotion('neutral'), 3000);

      } catch (error) {
        console.error("Error frontend:", error);
        setMessages(prev => [...prev, { 
            role: 'bot', 
            content: error.message || 'Error de conexión.' 
        }]);
      } finally {
        setIsLoading(false);
      }
    };

  // --- JSX ---
  return (
    <div className="flex flex-col h-dvh overflow-hidden font-sans">
      <header className="flex-none bg-white/95 backdrop-blur-md shadow-lg p-4 flex justify-between items-center border-b-4 border-blue-600 z-50 relative">
         <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-200">
             <BookOpen className="w-5 h-5 text-white" />
           </div>
           <div>
             <h1 className="text-lg font-bold text-gray-800 leading-tight">Asistente Virtual UG</h1>
             <p className="text-xs text-gray-500">{userEmail || 'Cargando...'}</p>
           </div>
         </div>
      </header>

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        
        <div className="w-full h-[45dvh] md:w-1/2 md:h-auto flex flex-col relative border-b md:border-r md:border-b-0 border-gray-200 shrink-0">
            <div className="flex-1 relative bg-gradient-to-br from-blue-950 via-slate-900 to-blue-950">
                <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-move z-0" />
                
                {/* 📍 AQUI ESTÁ CORREGIDO: left-4 asegura que esté a la izquierda */}
                <div className="absolute top-4 left-4 z-20 text-left pointer-events-none">
                    <h2 className="text-xl font-bold text-white drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">MARY AI</h2>
                    <p className="text-blue-200 text-xs font-mono">
                       {isLoading ? '⚡ PROCESANDO...' : isSpeaking ? '🔊 HABLANDO...' : isListening ? '🎤 ESCUCHANDO...' : '🤖 EN LÍNEA'}
                    </p>
                </div>

            </div>
            <div className="bg-white p-3 md:p-4 border-t border-gray-200 flex justify-between items-center z-20">
                <p className="text-[10px] text-gray-600 italic truncate mr-2">Sistema Inteligente de Respuesta Académica</p>
                <button
                  onClick={handleLogout}
                  className="flex-none flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 
                             bg-red-500/20 hover:bg-red-500/30 
                             text-red-600 hover:text-red-700 
                             rounded-full transition text-xs md:text-sm font-medium 
                             border border-red-300/40">
                  <LogOut className="w-3 h-3 md:w-4 md:h-4" /> Salir
                </button>

            </div>
        </div>

        <div className="w-full flex-1 md:w-1/2 flex flex-col bg-white relative z-10 shadow-2xl overflow-hidden">
           <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
             {messages.length === 0 && (
               <div className="text-center py-8 md:py-12 animate-fade-in-up">
                 <div className="w-20 h-20 md:w-24 md:h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-100">
                   <MessageSquare className="w-10 h-10 md:w-12 md:h-12 text-blue-600" />
                 </div>
                 <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-3">¡Hola! Soy tu asistente</h2>
                 <p className="text-sm md:text-base text-gray-600 mb-8 max-w-md mx-auto px-2">Estoy entrenado con los reglamentos oficiales. Escríbeme o usa el micrófono.</p>
                 <div className="grid grid-cols-1 gap-3 max-w-md mx-auto px-4">
                   {['¿En que año se fundó la Universidad?', '¿Quién te programó?', '¿Quién es Kevin?'].map((q, i) => (
                     <button key={i} onClick={() => handleSubmit(q)} className="p-3 md:p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md transition text-left text-xs md:text-sm text-gray-700">
                       {q}
                     </button>
                   ))}
                 </div>
               </div>
             )}
             {messages.map((msg, i) => (
               <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div className={`max-w-[85%] md:max-w-md p-3 md:p-4 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'}`}>
                   <p className="text-sm leading-relaxed whitespace-pre-wrap">{formatMessage(msg.content)}</p>
                   {msg.source && (<p className="text-xs mt-3 pt-2 border-t border-gray-100 opacity-70 italic flex items-center gap-1"><BookOpen size={10}/> Fuente: {msg.source}</p>)}
                   <p className={`text-[10px] mt-2 text-right ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>{msg.time}</p>
                 </div>
               </div>
             ))}
             {isLoading && (
               <div className="flex justify-start">
                 <div className="bg-white rounded-2xl rounded-bl-none p-4 shadow-sm border border-gray-200">
                   <div className="flex gap-1.5 items-center"><Loader2 className="w-4 h-4 text-blue-500 animate-spin" /><span className="text-xs text-gray-400">Consultando reglamentos...</span></div>
                 </div>
               </div>
             )}
             <div ref={messagesEndRef} />
           </div>
           
           <div className="bg-white/95 backdrop-blur-md p-3 md:p-4 border-t border-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex-none z-20">
             <div className="flex gap-2 md:gap-3">
               
               {/* BOTÓN DE SILENCIAR: Solo aparece si isSpeaking es true */}
               {isSpeaking && (
                   <button onClick={stopSpeaking} className="p-3 md:p-4 rounded-full shadow-md flex-none bg-orange-100 text-orange-600 hover:bg-orange-200 transition animate-in fade-in zoom-in">
                      <VolumeX className="w-5 h-5" />
                   </button>
               )}

               <button onClick={toggleVoice} className={`p-3 md:p-4 rounded-full transition shadow-md flex-none ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                 {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
               </button>
               
               <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSubmit()} placeholder="Escribe o habla..." className="flex-1 p-3 md:p-4 bg-gray-50 border border-gray-200 rounded-full focus:ring-2 focus:ring-blue-500 outline-none text-sm md:text-base text-gray-800 placeholder-gray-400 shadow-inner" disabled={isLoading}/>
               <button onClick={() => handleSubmit()} disabled={!input.trim() || isLoading} className="p-3 md:p-4 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition disabled:bg-gray-300 transform active:scale-95 shadow-md flex-none"><Send className="w-5 h-5" /></button>
             </div>
             <p className="text-[10px] text-gray-400 text-center mt-2">Universidad de Guayaquil</p>
           </div>
        </div>
      </div>
    </div>
  );
}