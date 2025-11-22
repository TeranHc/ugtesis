'use client'
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import * as THREE from 'three';
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
  const animationRef = useRef(null)
  const particlesRef = useRef(null)
  const recognitionRef = useRef(null)
  const messagesEndRef = useRef(null)

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

  // --- SCROLL ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

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
    const utterance = new SpeechSynthesisUtterance(text)
    const voices = window.speechSynthesis.getVoices()
    const spanishVoice = voices.find(v => v.lang.includes('es'))
    if (spanishVoice) utterance.voice = spanishVoice
    utterance.rate = 1.0
    window.speechSynthesis.speak(utterance)
  }

  // --- THREE.JS: ROBOT AVANZADO EN ENTORNO AZULADO ---
  useEffect(() => {
    if (!mountRef.current) return

    // Configuración de Escena (CAMBIADO A TONOS AZULES PROFUNDOS)
    const scene = new THREE.Scene();
    // Usamos un azul noche profundo para la niebla y el fondo
    const deepBlue = 0x051535; 
    scene.fog = new THREE.Fog(deepBlue, 5, 15);
    scene.background = new THREE.Color(deepBlue);
    sceneRef.current = scene;

    // Cámara
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 1.5, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    while (mountRef.current.firstChild) mountRef.current.removeChild(mountRef.current.firstChild);
    mountRef.current.appendChild(renderer.domElement);

    // --- ILUMINACIÓN AVANZADA ---
    const ambientLight = new THREE.AmbientLight(0x4466ff, 0.3);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(5, 8, 5);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const rimLight1 = new THREE.PointLight(0x00ffff, 1, 10);
    rimLight1.position.set(-3, 2, -2);
    scene.add(rimLight1);

    const rimLight2 = new THREE.PointLight(0xff00ff, 1, 10);
    rimLight2.position.set(3, 2, -2);
    scene.add(rimLight2);

    // --- SUELO (CAMBIADO A AZUL MÁS INTENSO) ---
    const floorGeometry = new THREE.CircleGeometry(5, 32);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x102050, // Azul océano oscuro
        roughness: 0.3, 
        metalness: 0.8 
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1;
    floor.receiveShadow = true;
    scene.add(floor);

    // --- PARTÍCULAS ---
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 200;
    const positions = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount * 3; i++) positions[i] = (Math.random() - 0.5) * 15;
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particlesMaterial = new THREE.PointsMaterial({ color: 0x00ffff, size: 0.05, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);
    particlesRef.current = particles;

    // --- PERSONAJE AVANZADO (TU ROBOT ORIGINAL - SIN CAMBIOS) ---
    const character = new THREE.Group();
    
    // Cabeza
    const headGroup = new THREE.Group();
    const headGeometry = new THREE.SphereGeometry(0.6, 32, 32);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0x3498db, roughness: 0.4, metalness: 0.6, emissive: 0x1a5490, emissiveIntensity: 0.2 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.castShadow = true;
    headGroup.add(head);

    // Visor holográfico
    const visorGeometry = new THREE.SphereGeometry(0.65, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
    const visorMaterial = new THREE.MeshPhongMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3, emissive: 0x00ffff, emissiveIntensity: 0.5, side: THREE.DoubleSide });
    const visor = new THREE.Mesh(visorGeometry, visorMaterial);
    visor.rotation.x = Math.PI;
    headGroup.add(visor);

    // Ojos
    const eyeGeometry = new THREE.SphereGeometry(0.12, 16, 16);
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x00ff88, emissiveIntensity: 1, metalness: 1, roughness: 0 });
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial); leftEye.position.set(-0.25, 0.1, 0.5); headGroup.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial); rightEye.position.set(0.25, 0.1, 0.5); headGroup.add(rightEye);

    // Pupilas
    const pupilGeometry = new THREE.SphereGeometry(0.06, 16, 16);
    const pupilMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial); leftPupil.position.set(-0.25, 0.1, 0.56); headGroup.add(leftPupil);
    const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial); rightPupil.position.set(0.25, 0.1, 0.56); headGroup.add(rightPupil);

    // Antena
    const antennaGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8);
    const antennaMaterial = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.5, metalness: 1 });
    const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial); antenna.position.y = 0.8; headGroup.add(antenna);
    const antennaBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 1
      })
    );
    antennaBall.position.y = 1; headGroup.add(antennaBall);
    
    headGroup.position.y = 1.8;
    character.add(headGroup);

    // Cuello y Torso
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.3, 16), new THREE.MeshStandardMaterial({ color: 0x2c3e50, metalness: 0.8, roughness: 0.3 }));
    neck.position.y = 1.35; character.add(neck);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.5), new THREE.MeshStandardMaterial({ color: 0x34495e, metalness: 0.7, roughness: 0.4, emissive: 0x1a3a52, emissiveIntensity: 0.1 }));
    torso.position.y = 0.6; torso.castShadow = true; character.add(torso);

    // Luces pecho
    const chestLightGeo = new THREE.CircleGeometry(0.08, 16);
    const chestLightMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 3; i++) { const light = new THREE.Mesh(chestLightGeo, chestLightMat); light.position.set(0, 0.8 - i * 0.2, 0.26); character.add(light); }

    // Brazos
    const limbMaterial = new THREE.MeshStandardMaterial({ color: 0x3498db, metalness: 0.8, roughness: 0.3 });
    
    // Izquierdo
    const leftShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), limbMaterial); leftShoulder.position.set(-0.6, 1, 0); character.add(leftShoulder);
    const leftArmGroup = new THREE.Group(); leftArmGroup.position.set(-0.6, 1, 0);
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.8, 16), limbMaterial); leftArm.position.y = -0.4; leftArmGroup.add(leftArm);
    const leftForearmGroup = new THREE.Group(); leftForearmGroup.position.set(0, -0.8, 0);
    const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.7, 16), limbMaterial); leftForearm.position.y = -0.35; leftForearmGroup.add(leftForearm);
    leftArmGroup.add(leftForearmGroup); character.add(leftArmGroup);

    // Derecho
    const rightShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), limbMaterial); rightShoulder.position.set(0.6, 1, 0); character.add(rightShoulder);
    const rightArmGroup = new THREE.Group(); rightArmGroup.position.set(0.6, 1, 0);
    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.8, 16), limbMaterial); rightArm.position.y = -0.4; rightArmGroup.add(rightArm);
    const rightForearmGroup = new THREE.Group(); rightForearmGroup.position.set(0, -0.8, 0);
    const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.7, 16), limbMaterial); rightForearm.position.y = -0.35; rightForearmGroup.add(rightForearm);
    rightArmGroup.add(rightForearmGroup); character.add(rightArmGroup);

    // Piernas
    const legGeo = new THREE.CylinderGeometry(0.15, 0.12, 0.9, 16);
    const leftLeg = new THREE.Mesh(legGeo, limbMaterial); leftLeg.position.set(-0.25, -0.45, 0); character.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, limbMaterial); rightLeg.position.set(0.25, -0.45, 0); character.add(rightLeg);

    character.userData = { headGroup, leftPupil, rightPupil, leftArmGroup, rightArmGroup, leftForearmGroup, rightForearmGroup, visor, antennaBall };
    scene.add(character);
    characterRef.current = character;

    // --- ANIMACIÓN ---
    let time = 0;
    let mouseX = 0; let mouseY = 0;
    const handleMouseMove = (e) => {
      const rect = mountRef.current.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };
    mountRef.current.addEventListener('mousemove', handleMouseMove);

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      time += 0.016;

      // Partículas
      if (particlesRef.current) {
        particlesRef.current.rotation.y += 0.001;
        const positions = particlesRef.current.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) positions[i + 1] += Math.sin(time + positions[i]) * 0.001;
        particlesRef.current.geometry.attributes.position.needsUpdate = true;
      }

      if (characterRef.current) {
        const { headGroup, leftPupil, rightPupil, leftArmGroup, rightArmGroup, leftForearmGroup, rightForearmGroup, visor, antennaBall } = characterRef.current.userData;

        // Tracking
        headGroup.rotation.y = THREE.MathUtils.lerp(headGroup.rotation.y, mouseX * 0.3, 0.1);
        headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, -mouseY * 0.2, 0.1);
        leftPupil.position.x = -0.25 + mouseX * 0.05; leftPupil.position.y = 0.1 + mouseY * 0.05;
        rightPupil.position.x = 0.25 + mouseX * 0.05; rightPupil.position.y = 0.1 + mouseY * 0.05;

        if (isLoading) {
          // Modo pensando
          characterRef.current.position.y = Math.sin(time * 3) * 0.1;
          characterRef.current.rotation.y = Math.sin(time) * 0.2;
          leftArmGroup.rotation.z = Math.sin(time * 4) * 0.3 + 0.5;
          rightArmGroup.rotation.z = -Math.sin(time * 4) * 0.3 - 0.5;
          leftForearmGroup.rotation.z = Math.sin(time * 5) * 0.4;
          rightForearmGroup.rotation.z = -Math.sin(time * 5) * 0.4;
          visor.material.emissiveIntensity = 0.5 + Math.sin(time * 6) * 0.3;
          antennaBall.material.emissiveIntensity = 1 + Math.sin(time * 8) * 0.5;
        } else if (emotion === 'happy') {
          // Celebración
          characterRef.current.position.y = Math.abs(Math.sin(time * 5)) * 0.3;
          leftArmGroup.rotation.z = Math.sin(time * 6) * 0.5 + 1;
          rightArmGroup.rotation.z = -Math.sin(time * 6) * 0.5 - 1;
          headGroup.rotation.z = Math.sin(time * 3) * 0.1;
        } else {
          // Idle
          characterRef.current.position.y = Math.sin(time * 2) * 0.05;
          characterRef.current.rotation.y = Math.sin(time * 0.5) * 0.05;
          leftArmGroup.rotation.z = Math.sin(time) * 0.1 + 0.2;
          rightArmGroup.rotation.z = -Math.sin(time) * 0.1 - 0.2;
          leftForearmGroup.rotation.x = Math.sin(time * 1.5) * 0.1;
          rightForearmGroup.rotation.x = Math.sin(time * 1.5) * 0.1;
        }
      }
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
      if(mountRef.current) mountRef.current.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationRef.current);
      if(mountRef.current && renderer.domElement) mountRef.current.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [isLoading, emotion]);

  const handleSubmit = async (textOverride = null) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim()) return;
    const userMsg = { role: 'user', content: textToSend, time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, userMsg]);
    if (!textOverride) setInput('');
    setIsLoading(true);
    setEmotion('neutral');
    if(window.speechSynthesis) window.speechSynthesis.cancel();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend, userId: userId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error');
      const botMsg = { role: 'bot', content: data.response, source: data.source, time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) };
      setMessages(prev => [...prev, botMsg]);
      setEmotion('happy');
      speakText(data.response);
      setTimeout(() => setEmotion('neutral'), 3000);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'bot', content: 'Error de conexión.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- RENDERIZADO ---
  return (
    <div className="flex flex-col h-screen overflow-hidden font-sans">
      
      {/* 1. ENCABEZADO ORIGINAL (Blanco, cubre todo el ancho) */}
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

      {/* CONTENEDOR PRINCIPAL DIVIDIDO */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* === MITAD IZQUIERDA: ROBOT + PIE BLANCO === */}
        <div className="w-1/2 flex flex-col relative border-r border-gray-200">
            
            {/* CANVAS 3D (Fondo Azulado Profundo) */}
            <div className="flex-1 relative bg-gradient-to-br from-blue-950 via-slate-900 to-blue-950">
                <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-move z-0" />
                
                {/* Texto flotante en el 3D */}
                <div className="relative z-10 text-center pointer-events-none mt-20">
                    <h2 className="text-3xl font-bold text-white drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">
                       MARY AI
                    </h2>
                    <p className="text-blue-200 mt-2 text-sm font-mono">
                       {isLoading ? '⚡ PROCESANDO...' : isListening ? '🎤 ESCUCHANDO...' : '🤖 EN LÍNEA'}
                    </p>
                </div>
            </div>

            {/* PIE DE PÁGINA IZQUIERDO (BLANCO - NUEVO) */}
            <div className="bg-white p-4 border-t border-gray-200 flex justify-between items-center z-20">
                <p className="text-[10px] text-gray-600 italic">
                    Sistema Inteligente de Respuesta Académica
                </p>
                <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-600 rounded-full transition text-sm font-medium border border-gray-200">
                   <LogOut className="w-4 h-4" /> Salir
                </button>
            </div>
        </div>

        {/* === MITAD DERECHA: CHAT (Original) === */}
        <div className="w-1/2 flex flex-col bg-white relative z-10 shadow-2xl">
           
           {/* Área de Mensajes */}
           <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
             {messages.length === 0 && (
               <div className="text-center py-12 animate-fade-in-up">
                 <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-100">
                   <MessageSquare className="w-12 h-12 text-blue-600" />
                 </div>
                 <h2 className="text-2xl font-bold text-gray-800 mb-3">¡Hola! Soy tu asistente académico</h2>
                 <p className="text-gray-600 mb-8 max-w-md mx-auto">Estoy entrenado con los reglamentos oficiales. Puedes escribirme o usar el micrófono.</p>
                 
                 <div className="grid grid-cols-1 gap-3 max-w-md mx-auto px-4">
                   {['¿Cómo es el proceso de titulación?', '¿Cuántas veces puedo repetir una materia?', '¿Qué requisitos necesito para graduarme?'].map((q, i) => (
                     <button key={i} onClick={() => handleSubmit(q)} className="p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md transition text-left text-sm text-gray-700">
                       {q}
                     </button>
                   ))}
                 </div>
               </div>
             )}

             {messages.map((msg, i) => (
               <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div className={`max-w-md p-4 rounded-2xl shadow-sm ${
                   msg.role === 'user' 
                     ? 'bg-blue-600 text-white rounded-br-none' 
                     : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                 }`}>
                   <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                   {msg.source && (
                     <p className="text-xs mt-3 pt-2 border-t border-gray-100 opacity-70 italic flex items-center gap-1">
                       <BookOpen size={10}/> Fuente: {msg.source}
                     </p>
                   )}
                   <p className={`text-[10px] mt-2 text-right ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                     {msg.time}
                   </p>
                 </div>
               </div>
             ))}

             {isLoading && (
               <div className="flex justify-start">
                 <div className="bg-white rounded-2xl rounded-bl-none p-4 shadow-sm border border-gray-200">
                   <div className="flex gap-1.5 items-center">
                     <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                     <span className="text-xs text-gray-400">Consultando reglamentos...</span>
                   </div>
                 </div>
               </div>
             )}
             <div ref={messagesEndRef} />
           </div>

           {/* Input Original (Pie de página DERECHO) */}
           <div className="bg-white/95 backdrop-blur-md p-4 border-t border-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
             <div className="flex gap-3">
               <button onClick={toggleVoice} className={`p-4 rounded-full transition shadow-md ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                 {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
               </button>

               <input 
                 type="text" 
                 value={input} 
                 onChange={(e) => setInput(e.target.value)} 
                 onKeyPress={(e) => e.key === 'Enter' && handleSubmit()} 
                 placeholder="Escribe o habla aquí..." 
                 className="flex-1 p-4 bg-gray-50 border border-gray-200 rounded-full focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 placeholder-gray-400 shadow-inner"
                 disabled={isLoading}
               />
               
               <button onClick={() => handleSubmit()} disabled={!input.trim() || isLoading} className="p-4 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition disabled:bg-gray-300 transform active:scale-95 shadow-md">
                 <Send className="w-5 h-5" />
               </button>
             </div>
             <p className="text-[10px] text-gray-400 text-center mt-2">Universidad de Guayaquil</p>
           </div>
        </div>

      </div>
    </div>
  );
}