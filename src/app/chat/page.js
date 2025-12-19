// src/app/chat/page.js
'use client'
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; 
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Mic, MicOff, LogOut, Send, BookOpen, MessageSquare, Loader2, VolumeX, Lock, Unlock } from 'lucide-react';

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
  const [isSpeaking, setIsSpeaking] = useState(false)
  
  // 🎥 ESTADO: True = Cámara Fija (Frontal a la cara), False = Libre
  const [isCameraFixed, setIsCameraFixed] = useState(true)

  // --- REFS ---
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const characterRef = useRef(null)
  const particlesRef = useRef(null)
  const recognitionRef = useRef(null)
  const messagesEndRef = useRef(null)

  // 🎥 REFS THREE.JS
  const cameraRef = useRef(null)
  const controlsRef = useRef(null)
  const rendererRef = useRef(null) 

  // REFS ANIMACIÓN
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
    if(typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    try {
        await supabase.auth.signOut();
    } catch (error) {
        console.log(error);
    } finally {
        localStorage.clear();
        router.refresh(); 
        router.push('/');
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  const formatMessage = (text) => {
    if (!text) return '';
    const parts = text.split('**');
    return parts.map((part, index) => 
        index % 2 === 1 ? <strong key={index} className="font-bold text-blue-800">{part}</strong> : part
    );
  };

  // --- VOZ ---
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
    if (!isListening && isSpeaking) stopSpeaking();
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  const speakText = (text) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()

    const cleanText = text.replace(/\*/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText)
    
    const voices = window.speechSynthesis.getVoices()
    const spanishVoices = voices.filter(v => v.lang.includes('es'))
    let femaleVoice = spanishVoices.find(v => 
        v.name.includes('Sabina') || v.name.includes('Paulina') || v.name.includes('Google español')
    )

    if (femaleVoice) utterance.voice = femaleVoice
    else if (spanishVoices.length > 0) utterance.voice = spanishVoices[0]

    utterance.rate = 1.0 
    utterance.pitch = 1.1 
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance)
  }

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
    }
  }

  // ==========================================
  // 🎥 1. LÓGICA DE CAMBIO DE MODO DE CÁMARA
  // ==========================================
  useEffect(() => {
    if (!controlsRef.current || !cameraRef.current) return;

    const controls = controlsRef.current;
    const camera = cameraRef.current;
    const isMobile = window.innerWidth < 768;

    if (isCameraFixed) {
        controls.enableZoom = false;
        controls.enableRotate = false;
        controls.enablePan = false; 
        
        if (isMobile) {
            camera.position.set(0, 1.65, 0.85); 
        } else {
            camera.position.set(0, 1.65, 1.0);  
        }
        controls.target.set(0, 1.65, 0); 
        controls.update();

    } else {
        controls.enableZoom = true;
        controls.enableRotate = true;
        controls.enablePan = true; 
        
        if (isMobile) {
            camera.position.set(0, 1.55, 1.1); 
        } else {
            camera.position.set(0, 1.65, 1.2); 
        }
        controls.target.set(0, 1.55, 0);
        controls.update();
    }
  }, [isCameraFixed]) 


  // ==========================================
  // 🎨 THREE.JS: ESCENA 3D
  // ==========================================
  useEffect(() => {
    if (!mountRef.current) return

    // 1. Escena
    const scene = new THREE.Scene();
    const deepBlue = 0x051535; 
    scene.fog = new THREE.Fog(deepBlue, 5, 20); 
    scene.background = new THREE.Color(deepBlue);
    sceneRef.current = scene;

    // 2. Cámara
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000); 
    cameraRef.current = camera; 

    // 3. Renderizador
    const renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        powerPreference: "high-performance" 
    });
    
    // HD en móviles
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
    renderer.setSize(width, height);
    
    renderer.shadowMap.enabled = true; 
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace; 
    renderer.toneMapping = THREE.ACESFilmicToneMapping; 
    renderer.toneMappingExposure = 0.85;
    
    while (mountRef.current.firstChild) mountRef.current.removeChild(mountRef.current.firstChild);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Controles
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; 
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2; 
    controlsRef.current = controls;

    // --- ESTADO INICIAL ---
    const isMobile = width < 768;
    controls.enableZoom = false;
    controls.enableRotate = false;
    controls.enablePan = false;
    
    if (isMobile) {
        camera.position.set(0, 1.65, 0.85);
    } else {
        camera.position.set(0, 1.65, 1.0);
    }
    controls.target.set(0, 1.65, 0); 
    controls.update();

    // 5. Iluminación
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); 
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffeebb, 1.2); 
    mainLight.position.set(2, 3.5, 5); 
    mainLight.castShadow = true;
    mainLight.shadow.bias = -0.0005;
    mainLight.shadow.mapSize.width = 2048; 
    mainLight.shadow.mapSize.height = 2048;
    scene.add(mainLight);

    const fillLight = new THREE.HemisphereLight(0xddeeff, 0x252550, 1.3); 
    fillLight.position.set(0, 5, -2);
    scene.add(fillLight);

    const rimLight = new THREE.SpotLight(0x00ffff, 2.5); 
    rimLight.position.set(-5, 5, 2);
    rimLight.lookAt(0, 1, 0);
    scene.add(rimLight);
    
    // 6. Suelo
    const floorGeometry = new THREE.CircleGeometry(5, 32);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x102050, roughness: 0.3, metalness: 0.5 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
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
      '/Mary.glb', 
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

        const animations = gltf.animations;
        if (animations && animations.length > 0) {
            let reposoClip = THREE.AnimationClip.findByName(animations, 'reposo');
            if (!reposoClip) reposoClip = animations[0];

            if (reposoClip) {
                const action = mixer.clipAction(reposoClip);
                action.play(); 
                actionsRef.current['reposo'] = action;
            }

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
      (error) => console.error('Error cargando modelo:', error)
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
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
        setMessages(prev => [...prev, { role: 'bot', content: error.message || 'Error de conexión.' }]);
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
        
        {/* 1. CONTENEDOR 3D (REDUCIDO EN MÓVIL) */}
        {/* Cambié h-[45dvh] a h-[38dvh] para dar más espacio al chat en móvil */}
        <div className="w-full h-[38dvh] md:w-1/2 md:h-auto flex flex-col relative border-b md:border-r md:border-b-0 border-gray-200 shrink-0">
            <div className="flex-1 relative bg-gradient-to-br from-blue-950 via-slate-900 to-blue-950">
                <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-move z-0" />
                
                <div className="absolute top-5 left-5 z-20 text-left pointer-events-none">
                    <h2 className="text-xl font-bold text-white drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">MARY AI</h2>
                    <p className="text-blue-200 text-xs font-mono">
                       {isLoading ? '⚡ PROCESANDO...' : isSpeaking ? '🔊 HABLANDO...' : isListening ? '🎤 ESCUCHANDO...' : '🤖 EN LÍNEA'}
                    </p>
                </div>

                <button 
                  onClick={() => setIsCameraFixed(!isCameraFixed)}
                  className={`absolute top-5 right-5 z-20 p-2 rounded-full shadow-lg backdrop-blur-sm transition-all duration-300 border
                    ${isCameraFixed 
                        ? 'bg-blue-600/80 text-white border-blue-400 hover:bg-blue-500' 
                        : 'bg-white/20 text-blue-200 border-white/10 hover:bg-white/30'}`}
                  title={isCameraFixed ? "Desbloquear Cámara" : "Fijar Cámara"}
                >
                   {isCameraFixed ? <Lock size={20} /> : <Unlock size={20} />}
                </button>

            </div>
            <div className="bg-white p-3 md:p-4 border-t border-gray-200 flex justify-between items-center z-20">
                {/* Agregamos saltos de línea permitidos si no hay espacio */}
                <p className="text-[10px] text-gray-600 italic leading-tight mr-2">Sistema Inteligente de Respuesta Académica</p>
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

        {/* 2. CONTENEDOR CHAT */}
        <div className="w-full flex-1 md:w-1/2 flex flex-col bg-white relative z-10 shadow-2xl overflow-hidden">
           <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
             {messages.length === 0 && (
               /* BIENVENIDA COMPACTA: Padding y margenes reducidos en móvil */
               <div className="text-center py-4 md:py-12 animate-fade-in-up">
                 <div className="w-16 h-16 md:w-24 md:h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6 shadow-xl shadow-blue-100">
                   <MessageSquare className="w-8 h-8 md:w-12 md:h-12 text-blue-600" />
                 </div>
                 <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-2 md:mb-3">¡Hola! Soy tu asistente</h2>
                 <p className="text-sm md:text-base text-gray-600 mb-6 max-w-md mx-auto px-2">Estoy entrenado con los reglamentos oficiales.</p>
                 <div className="grid grid-cols-1 gap-2 md:gap-3 max-w-md mx-auto px-4">
                   {['¿Cómo solicito una recalificación?', '¿Proceso de titulación?', '¿Cómo estudio en la UG?'].map((q, i) => (
                     <button key={i} onClick={() => handleSubmit(q)} className="p-3 md:p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md transition text-left text-xs md:text-sm text-gray-700 truncate">
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
           
           {/* BARRA DE INPUT: Padding bottom extra (pb-6) para celulares sin marco */}
           <div className="bg-white/95 backdrop-blur-md p-3 md:p-4 pb-6 md:pb-4 border-t border-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex-none z-20">
             <div className="flex gap-2 md:gap-3">
               
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