//src/app/chat/page.js
'use client'
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import * as THREE from 'three';
// Importamos Cargador y Controles
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; 
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Mic, MicOff, LogOut, Send, BookOpen, MessageSquare, Loader2 } from 'lucide-react';

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
    await supabase.auth.signOut()
    router.push('/')
  }

  // --- SCROLL AUTOMÁTICO CHAT ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

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
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  // --- TEXT TO SPEECH (MODIFICADO PARA VOZ DE MUJER) ---
  const speakText = (text) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    
    // Obtenemos todas las voces disponibles en el sistema
    const voices = window.speechSynthesis.getVoices()

    // 1. Filtramos solo las que sean español ('es')
    const spanishVoices = voices.filter(v => v.lang.includes('es'))

    // 2. Buscamos prioritaria voces con nombres de mujer conocidos
    // Sabina (Mexico), Paulina (Mexico), Elena (España), Laura (España), Google (suele ser mujer)
    let femaleVoice = spanishVoices.find(v => 
        v.name.includes('Sabina') || 
        v.name.includes('Paulina') || 
        v.name.includes('Elena') || 
        v.name.includes('Laura') || 
        v.name.includes('Monica') ||
        v.name.includes('Google español')
    )

    // 3. Asignamos la voz
    if (femaleVoice) {
        utterance.voice = femaleVoice
    } else if (spanishVoices.length > 0) {
        // Si no encuentra ninguna de mujer específica, usa la primera en español que haya
        utterance.voice = spanishVoices[0]
    }

    utterance.rate = 1.0 // Velocidad normal
    utterance.pitch = 1.1 // 📍 Un poquito más agudo para que suene más femenina
    
    window.speechSynthesis.speak(utterance)
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

    // 2. Cámara (Zoom y Posición)
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000); 
    
    // CAMBIO AQUI:
    // X=0 (Centro)
    // Y=1.7 (Altura: subimos a 1.7 metros para estar a nivel de la cara)
    // Z=1.5 (Zoom: Cuanto más pequeño, más cerca. 1.5 es un buen primer plano)
    camera.position.set(0, 1.7, 1.5);
    // 3. Renderizador
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true; 
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace; 
    renderer.toneMapping = THREE.ACESFilmicToneMapping; 
    renderer.toneMappingExposure = 1.0;
    
    while (mountRef.current.firstChild) mountRef.current.removeChild(mountRef.current.firstChild);
    mountRef.current.appendChild(renderer.domElement);

    // 4. Controles (Mirar a la cara)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; 
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;    
    controls.minDistance = 1.0;    
    controls.maxDistance = 4;      
    controls.maxPolarAngle = Math.PI / 2; 
    
    // Pivotar sobre la cabeza
    controls.target.set(0, 1.55, 0); 

    // 5. Iluminación
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2); 
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 2.5); 
    mainLight.position.set(2, 5, 5);
    mainLight.castShadow = true;
    mainLight.shadow.bias = -0.0005;  // Evita rayas (Shadow Acne)
    mainLight.shadow.mapSize.width = 2048; 
    mainLight.shadow.mapSize.height = 2048;
    scene.add(mainLight);

    const rimLight = new THREE.SpotLight(0x00ffff, 5); 
    rimLight.position.set(-5, 5, 0);
    rimLight.lookAt(0, 1, 0);
    scene.add(rimLight);

    const fillLight = new THREE.HemisphereLight(0xb1e1ff, 0x080820, 1.5); 
    fillLight.position.set(0, 5, -2);
    scene.add(fillLight);

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

    // 8. Cargar Modelo y Animación
    const loader = new GLTFLoader();
    
    loader.load(
      '/Maryprototipo3.glb', 
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(1, 1, 1); 
        model.position.set(0, 0, 0); 
        
        // --- 8.1 Sombras y Suavizado ---
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.geometry) {
                    child.geometry.computeVertexNormals(); 
                }
            }
        });

        // --- 8.2 Animaciones (Mixer) ---
        const mixer = new THREE.AnimationMixer(model);
        mixerRef.current = mixer;

        const animations = gltf.animations;
        if (animations && animations.length > 0) {
            // Busca animación 'sonrisa'
            const sonrisaClip = THREE.AnimationClip.findByName(animations, 'sonrisa');
            if (sonrisaClip) {
                const action = mixer.clipAction(sonrisaClip);
                action.loop = THREE.LoopOnce; 
                action.clampWhenFinished = true;
                actionsRef.current['sonrisa'] = action;
            }
        }

        scene.add(model);
        characterRef.current = model;
      },
      undefined,
      (error) => {
        console.error('Error cargando el modelo:', error);
      }
    );

    // 9. Loop de Animación
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      
      const delta = clockRef.current.getDelta();
      if (mixerRef.current) {
          mixerRef.current.update(delta);
      }

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

      // 📍 Disparar animación de sonrisa
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
      
      if(window.speechSynthesis) window.speechSynthesis.cancel();

      try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            // 👇 AGREGA ESTA LÍNEA (Asegúrate de poner la clave real aquí o usar variable de entorno pública)
            'x-secret-key': 'tesis-segura-2025-guayaquil-bloqueo' 
        },
        body: JSON.stringify({ message: textToSend, userId: userId })
      });
        
        const data = await response.json();
        
        // 🛡️ CORRECCIÓN 1: Si falla, pasamos el mensaje real del backend al Catch
        if (!response.ok) {
          // Buscamos el mensaje de error en 'error' o en 'response' (por si acaso)
          throw new Error(data.error || data.response || 'Error desconocido en el servidor');
        }

        const botMsg = { role: 'bot', content: data.response, source: data.source, time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) };
        setMessages(prev => [...prev, botMsg]);
        setEmotion('happy'); 
        speakText(data.response);
        setTimeout(() => setEmotion('neutral'), 3000);

      } catch (error) {
        console.error("Error capturado en frontend:", error);
        // 🛡️ CORRECCIÓN 2: Mostramos el mensaje real (error.message) en lugar del texto fijo
        setMessages(prev => [...prev, { 
            role: 'bot', 
            content: error.message || 'Error de conexión. Intenta nuevamente.' 
        }]);
      } finally {
        setIsLoading(false);
      }
    };

  // --- JSX ---
  return (
    // Use h-dvh (Dynamic Viewport Height) para mejor soporte en navegadores móviles con barras de dirección dinámicas
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

      {/* 🔥 CAMBIO RESPONSIVE 1: El contenedor principal ahora es columna en móvil y fila en PC (md:flex-row) */}
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        
        {/* 🔥 CAMBIO RESPONSIVE 2 (SECCIÓN 3D): 
           - En móvil (por defecto): w-full y altura fija (h-[45dvh], el 45% de la pantalla). 
           - En PC (md:): w-1/2 y altura automática (h-auto, que llenará el padre).
           - Bordes: En móvil el borde está abajo (border-b), en PC a la derecha (md:border-r).
        */}
        <div className="w-full h-[45dvh] md:w-1/2 md:h-auto flex flex-col relative border-b md:border-r md:border-b-0 border-gray-200 shrink-0">
            <div className="flex-1 relative bg-gradient-to-br from-blue-950 via-slate-900 to-blue-950">
                <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-move z-0" />
                {/* Ajustado el margen superior en móvil (mt-10) y PC (md:mt-20) para que no quede muy arriba */}
                <div className="relative z-10 text-center pointer-events-none mt-10 md:mt-20">
                    <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">MARY AI</h2>
                    <p className="text-blue-200 mt-2 text-sm font-mono">
                       {isLoading ? '⚡ PROCESANDO...' : isListening ? '🎤 ESCUCHANDO...' : '🤖 EN LÍNEA'}
                    </p>
                </div>
            </div>
            <div className="bg-white p-3 md:p-4 border-t border-gray-200 flex justify-between items-center z-20">
                <p className="text-[10px] text-gray-600 italic truncate mr-2">Sistema Inteligente de Respuesta Académica</p>
                <button onClick={handleLogout} className="flex-none flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-600 rounded-full transition text-xs md:text-sm font-medium border border-gray-200">
                   <LogOut className="w-3 h-3 md:w-4 md:h-4" /> Salir
                </button>
            </div>
        </div>

        {/* 🔥 CAMBIO RESPONSIVE 3 (SECCIÓN CHAT):
           - En móvil: w-full y usa flex-1 para ocupar todo el espacio restante abajo.
           - En PC (md:): w-1/2.
        */}
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
                   {['¿Cómo es el proceso de titulación?', '¿Cuántas veces puedo repetir una materia?', '¿Qué requisitos necesito para graduarme?'].map((q, i) => (
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
                   <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
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
           {/* Barra de entrada de texto */}
           <div className="bg-white/95 backdrop-blur-md p-3 md:p-4 border-t border-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex-none z-20">
             <div className="flex gap-2 md:gap-3">
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