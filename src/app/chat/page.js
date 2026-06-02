// src/app/chat/page.js
'use client'
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
// IMPORTANTE: Importamos ReactMarkdown para traducir los ### y **
import ReactMarkdown from 'react-markdown'; 
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
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState(null)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  
  // Estado para saber si el modelo 3D ya cargó
  const [modelReady, setModelReady] = useState(false)
  
  // Ref para asegurar que solo salude una vez
  const hasGreetedRef = useRef(false)

  // Estado para mostrar la nube de saludo
  const [showGreeting, setShowGreeting] = useState(true)

  // ESTADO CÁMARA: True = Cámara Fija, False = Libre
  const [isCameraFixed, setIsCameraFixed] = useState(true)
  // --- NUEVO: Estado para mantener el razonamiento de Gemini 3.1 ---
  const [thoughtSignature, setThoughtSignature] = useState(null)

  // --- REFS ---
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const characterRef = useRef(null)
  const faceMeshesRef = useRef([]) 
  const particlesRef = useRef(null)
  const recognitionRef = useRef(null)
  const messagesEndRef = useRef(null)
  
  // Ref para sincronizar el estado de hablar dentro del bucle de animación
  const speakingRef = useRef(false);

  // REFS THREE.JS
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

  // Temporizador para ocultar el saludo a los 4 segundos
  useEffect(() => {
    const timer = setTimeout(() => {
        setShowGreeting(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  // --- CONTROL DE ANIMACIONES (MODO EXCLUSIVO) ---
  useEffect(() => {
    const baseAction = actionsRef.current['reposo'];
    const thinkingAction = actionsRef.current['pensando'];
    const talkingAction = actionsRef.current['respuesta']; 
    
    const isGreeting = actionsRef.current['saludar']?.isRunning();

    if (!isGreeting) {
        if (isSpeaking && talkingAction) {
            baseAction?.fadeOut(0.2);
            thinkingAction?.fadeOut(0.2);
            talkingAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.2).play();
        } else if (isLoading && thinkingAction) {
            baseAction?.fadeOut(0.2);
            talkingAction?.fadeOut(0.2);
            thinkingAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.2).play();
        } else if (baseAction) {
            thinkingAction?.fadeOut(0.2);
            talkingAction?.fadeOut(0.2);
            baseAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.2).play();
        }
    }
  }, [isLoading, isSpeaking]);

  // --- SEGURIDAD DE AUDIO AL RECARGAR/SALIR ---
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        // Precargar voces
        window.speechSynthesis.getVoices();
        window.speechSynthesis.cancel();
    }
    return () => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
    };
  }, []);

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

  // HE ELIMINADO LA FUNCIÓN formatMessage() PORQUE YA NO LA NECESITAMOS

  useEffect(() => {
    speakingRef.current = isSpeaking;
  }, [isSpeaking]);

  // --- VOZ (ENTRADA) ---
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
    if (!recognitionRef.current) return alert('Navegador no compatible con dictado por voz')
    if (!isListening && isSpeaking) stopSpeaking();
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  // --- SELECTOR DE VOZ (MEJORADO) ---
  const getBestVoice = (voices) => {
    const femaleKeywords = ['Sabina', 'Paulina', 'Mónica', 'Monica', 'Helena', 'Laura', 'Google español', 'Google Spanish'];
    const preciseFemale = voices.find(v => femaleKeywords.some(keyword => v.name.includes(keyword)));
    if (preciseFemale) return preciseFemale;
    const anyFemaleSounding = voices.find(v => v.lang.startsWith('es') && !['Jorge', 'Pablo', 'Diego', 'Raul'].some(m => v.name.includes(m)));
    if (anyFemaleSounding) return anyFemaleSounding;
    return voices.find(v => v.lang.startsWith('es'));
  }

  // --- VOZ (SALIDA) ---
  const speakText = (text) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    // Limpiamos los símbolos Markdown para que no los lea
    const cleanText = text.replace(/[*#_\-]/g, ''); 
    const chunks = cleanText.match(/[^.?;!]+[.?;!]*|[^.?;!]+/g) || [cleanText];
    let currentChunk = 0;

    const playNextChunk = () => {
      if (currentChunk >= chunks.length) {
          setIsSpeaking(false);
          speakingRef.current = false;
          return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[currentChunk].trim());
      const voices = window.speechSynthesis.getVoices();
      const selectedVoice = getBestVoice(voices);

      if (selectedVoice) utterance.voice = selectedVoice;
      else if (voices.length > 0) utterance.voice = voices[0]; 

      utterance.rate = 1.0;
      utterance.pitch = 1.05; 
      
      utterance.onstart = () => {
          setIsSpeaking(true);
          speakingRef.current = true;
      };
      utterance.onend = () => {
          currentChunk++;
          setTimeout(playNextChunk, 100); 
      };
      utterance.onerror = (e) => {
          setIsSpeaking(false);
          speakingRef.current = false;
      };
      
      window.speechSynthesis.speak(utterance);
    }

    playNextChunk();
  }

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        speakingRef.current = false;
    }
  }

  // --- SALUDO ---
  useEffect(() => {
    if (modelReady && !hasGreetedRef.current) {
        hasGreetedRef.current = true; 

        setTimeout(() => {
            setIsSpeaking(true);
            speakingRef.current = true;

            setTimeout(() => {
                if (!window.speechSynthesis.speaking) {
                    setIsSpeaking(false);
                    speakingRef.current = false;
                }
            }, 2000);

            speakText("Hola");

            const saludarAction = actionsRef.current['saludar'];
            const reposoAction = actionsRef.current['reposo'];

            if (saludarAction && reposoAction) {
                reposoAction.fadeOut(0.5);
                saludarAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.5).play();

                const onFinished = (e) => {
                    if (e.action === saludarAction) {
                        mixerRef.current.removeEventListener('finished', onFinished);
                        saludarAction.fadeOut(0.5);
                        reposoAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.5).play();
                    }
                };
                mixerRef.current.addEventListener('finished', onFinished);
            }
        }, 500);
    }
  }, [modelReady]);

  // --- LÓGICA DE CÁMARA ---
  useEffect(() => {
    if (!controlsRef.current || !cameraRef.current) return;
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    const isMobile = window.innerWidth < 768;

    if (isCameraFixed) {
        controls.enableZoom = false;
        controls.enableRotate = false;
        controls.enablePan = false; 
        if (isMobile) camera.position.set(0, 1.65, 0.85); 
        else camera.position.set(0, 1.65, 1.0);  
        controls.target.set(0, 1.65, 0); 
        controls.update();
    } else {
        controls.enableZoom = true;
        controls.enableRotate = true;
        controls.enablePan = true; 
        if (isMobile) camera.position.set(0, 1.55, 1.1); 
        else camera.position.set(0, 1.65, 1.2); 
        controls.target.set(0, 1.55, 0);
        controls.update();
    }
  }, [isCameraFixed]) 


  // --- THREE.JS: ESCENA 3D ---
  useEffect(() => {
    if (!mountRef.current) return

    const scene = new THREE.Scene();
    const deepBlue = 0x051535; 
    scene.fog = new THREE.Fog(deepBlue, 5, 20); 
    scene.background = new THREE.Color(deepBlue);
    sceneRef.current = scene;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000); 
    cameraRef.current = camera; 

    const renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        powerPreference: "high-performance" 
    });
    
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

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; 
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2; 
    controlsRef.current = controls;

    const isMobile = width < 768;
    controls.enableZoom = false;
    controls.enableRotate = false;
    controls.enablePan = false;
    if (isMobile) camera.position.set(0, 1.65, 0.85);
    else camera.position.set(0, 1.65, 1.0);
    controls.target.set(0, 1.65, 0); 
    controls.update();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); 
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffeebb, 1.2); 
    mainLight.position.set(2, 3.5, 5); 
    mainLight.castShadow = true;
    scene.add(mainLight);

    const fillLight = new THREE.HemisphereLight(0xddeeff, 0x252550, 1.3); 
    fillLight.position.set(0, 5, -2);
    scene.add(fillLight);

    const rimLight = new THREE.SpotLight(0x00ffff, 2.5); 
    rimLight.position.set(-5, 5, 2);
    rimLight.lookAt(0, 1, 0);
    scene.add(rimLight);
    
    const floorGeometry = new THREE.CircleGeometry(5, 32);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x102050, roughness: 0.3, metalness: 0.5 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 200;
    const positions = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount * 3; i++) positions[i] = (Math.random() - 0.5) * 15;
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particlesMaterial = new THREE.PointsMaterial({ color: 0x00ffff, size: 0.05, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);
    particlesRef.current = particles;

    const loader = new GLTFLoader();
    loader.load('/Mary3.glb', (gltf) => {
        const model = gltf.scene;
        faceMeshesRef.current = [];
        model.traverse((child) => {
            if (child.isMesh && child.morphTargetDictionary) {
                if (Object.keys(child.morphTargetDictionary).some(key => key === 'mouthOpen')) {
                    faceMeshesRef.current.push(child); 
                }
            }
        });
        model.scale.set(1, 1, 1); 
        model.position.set(0, 0, 0); 
        const mixer = new THREE.AnimationMixer(model);
        mixerRef.current = mixer;
        const animations = gltf.animations;
        if (animations && animations.length > 0) {
            let reposoClip = THREE.AnimationClip.findByName(animations, 'reposo') || animations[0];
            const pensandoClip = THREE.AnimationClip.findByName(animations, 'pensando');
            const saludarClip = THREE.AnimationClip.findByName(animations, 'saludar');
            const respuestaClip = THREE.AnimationClip.findByName(animations, 'respuesta');

            if (reposoClip) {
                const action = mixer.clipAction(reposoClip);
                action.play();
                actionsRef.current['reposo'] = action;
            }
            if (pensandoClip) {
                const action = mixer.clipAction(pensandoClip);
                action.loop = THREE.LoopRepeat;
                actionsRef.current['pensando'] = action;
            }
            if (saludarClip) {
                const action = mixer.clipAction(saludarClip);
                action.loop = THREE.LoopOnce; 
                action.clampWhenFinished = true; 
                actionsRef.current['saludar'] = action;
            }
            if (respuestaClip) {
                const action = mixer.clipAction(respuestaClip);
                action.loop = THREE.LoopRepeat; 
                actionsRef.current['respuesta'] = action;
            }
        }
        scene.add(model);
        characterRef.current = model;
        setModelReady(true);
      }, undefined, (error) => console.error('Error cargando modelo:', error)
    );

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      const delta = clockRef.current.getDelta();
      if (mixerRef.current) mixerRef.current.update(delta);
      controls.update();
      if (particlesRef.current) particlesRef.current.rotation.y += 0.001;

      if (faceMeshesRef.current.length > 0) {
          faceMeshesRef.current.forEach((mesh) => {
              const index = mesh.morphTargetDictionary['mouthOpen'];
              if (index !== undefined) {
                  if (speakingRef.current) {
                      const t = Date.now();
                      let openValue = (Math.sin(t * 0.02) * 0.5) + (Math.sin(t * 0.01) * 0.3) + (Math.random() * 0.2); 
                      openValue = Math.max(0, Math.min(0.8, openValue)); 
                      mesh.morphTargetInfluences[index] = openValue; 
                  } else {
                      const current = mesh.morphTargetInfluences[index];
                      mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(current, 0, 0.2);
                  }
              }
          });
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
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        }
    }
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameRef.current);
      if(mountRef.current && renderer.domElement) mountRef.current.removeChild(renderer.domElement);
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
      renderer.dispose();
    };
  }, []);

  // --- SUBMIT ---
  const handleSubmit = async (textOverride = null) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim()) return;
    if (textToSend.length > 500) {
        setMessages(prev => [...prev, { role: 'bot', content: "⚠️ El mensaje es demasiado largo. (máx 500 caracteres)." }]);
        return;
    }

    stopSpeaking();
    const previousInput = input;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const userMsg = { 
        role: 'user', 
        content: textToSend, 
        time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) 
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textOverride) setInput('');
    setIsLoading(true);
    
    try {
        const chatHistory = messages.slice(-6).map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
        }));

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ 
                message: textToSend, 
                history: chatHistory, 
                userId: userId,
                previousThoughtSignature: thoughtSignature // <-- NUEVO: Enviamos la firma guardada
            })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Error en la respuesta');

        // --- NUEVO: Guardamos la firma recibida para la próxima petición ---
        if (data.thoughtSignature !== undefined) {
            setThoughtSignature(data.thoughtSignature);
        }

        const botMsg = { 
            role: 'bot', 
            content: data.response, 
            source: data.source,
            suggestions: data.suggestions,
            time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) 
        };
        setMessages(prev => [...prev, botMsg]);
        speakText(data.response);

    } catch (error) {
        console.error(error);
        setMessages(prev => [...prev, { role: 'bot', content: "⚠️ Error de conexión." }]);
        if (!textOverride) setInput(previousInput);
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
        
        {/* CONTENEDOR 3D */}
        <div className="w-full h-[45dvh] md:w-1/2 md:h-auto flex flex-col relative border-b md:border-r md:border-b-0 border-gray-200 shrink-0">
            <div className="flex-1 relative bg-gradient-to-br from-blue-950 via-slate-900 to-blue-950">
                <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-move z-0" />
                
                {showGreeting && (
                    <div className="absolute top-[20%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 animate-[bounce_2s_infinite]">
                        <div className="relative bg-white text-gray-800 px-5 py-3 rounded-2xl shadow-2xl border-2 border-blue-100">
                            <p className="text-sm font-bold whitespace-nowrap">¡Hola! Estoy lista 👋</p>
                            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-white"></div>
                        </div>
                    </div>
                )}
                
                <div className="absolute top-5 left-5 z-20 text-left pointer-events-none">
                    <h2 className="text-xl font-bold text-white drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">MARY AI</h2>
                    <p className="text-blue-200 text-xs font-mono">
                       {isLoading ? '⚡ PENSANDO...' : isSpeaking ? '🔊 HABLANDO...' : isListening ? '🎤 ESCUCHANDO...' : '🤖 EN LÍNEA'}
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

        {/* CONTENEDOR CHAT */}
        <div className="w-full flex-1 md:w-1/2 flex flex-col bg-white relative z-10 shadow-2xl overflow-hidden">
           <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
             {messages.length === 0 && (
               <div className="text-center py-2 md:py-12 animate-fade-in-up">
                 <div className="w-14 h-14 md:w-24 md:h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-6 shadow-xl shadow-blue-100">
                   <MessageSquare className="w-6 h-6 md:w-12 md:h-12 text-blue-600" />
                 </div>
                 <h2 className="text-lg md:text-2xl font-bold text-gray-800 mb-1 md:mb-3">¡Hola! Soy tu asistente</h2>
                 <p className="text-xs md:text-base text-gray-600 mb-4 max-w-md mx-auto px-2">Estoy entrenado con los reglamentos oficiales.</p>
                 <div className="grid grid-cols-1 gap-2 md:gap-3 max-w-md mx-auto px-4">
                   {['¿Cómo solicito una recalificación?', '¿Proceso de titulación?', '¿Cómo estudio en la Universidad?'].map((q, i) => (
                     <button key={i} onClick={() => handleSubmit(q)} className="p-2 md:p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md transition text-center text-xs md:text-sm text-gray-700 truncate">
                       {q}
                     </button>
                   ))}
                 </div>
               </div>
             )}
{messages.map((msg, i) => (
               <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div className={`max-w-[85%] md:max-w-md p-3 md:p-4 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'}`}>
                   
                   {/* ✅ CORRECCIÓN APLICADA: Colores dinámicos */}
                   <div className={`text-sm leading-relaxed break-words overflow-hidden ${msg.role === 'user' ? 'text-white' : 'text-gray-800'}`}>
                       <ReactMarkdown
                          components={{
                            // Títulos: Blancos si es usuario, Azules si es bot
                            h1: ({node, ...props}) => <h3 className={`text-lg font-bold mt-3 mb-2 ${msg.role === 'user' ? 'text-white' : 'text-blue-900'}`} {...props} />,
                            h2: ({node, ...props}) => <h3 className={`text-base font-bold mt-3 mb-2 ${msg.role === 'user' ? 'text-white' : 'text-blue-900'}`} {...props} />,
                            h3: ({node, ...props}) => <h3 className={`text-base font-bold mt-3 mb-2 ${msg.role === 'user' ? 'text-white' : 'text-blue-900'}`} {...props} />,
                            
                            // Negritas: Blancas si es usuario, Azul oscuro si es bot
                            strong: ({node, ...props}) => <strong className={`font-bold ${msg.role === 'user' ? 'text-white' : 'text-blue-800'}`} {...props} />,
                            
                            // Listas: Blancas si es usuario, Grises si es bot
                            ul: ({node, ...props}) => <ul className={`list-disc pl-5 space-y-1 my-2 ${msg.role === 'user' ? 'text-white' : 'text-gray-700'}`} {...props} />,
                            ol: ({node, ...props}) => <ol className={`list-decimal pl-5 space-y-1 my-2 ${msg.role === 'user' ? 'text-white' : 'text-gray-700'}`} {...props} />,
                            li: ({node, ...props}) => <li className="pl-1" {...props} />,
                            
                            // Párrafos
                            p: ({node, ...props}) => <p className="mb-2 last:mb-0 leading-relaxed break-words" {...props} />
                          }}
                       >
                           {msg.content}
                       </ReactMarkdown>
                   </div>
                   {/* ----------------------------------------------------------- */}

                   {msg.source && (<p className="text-xs mt-3 pt-2 border-t border-gray-100 opacity-70 italic flex items-center gap-1"><BookOpen size={10}/> Fuente: {msg.source}</p>)}
                   
                   {msg.suggestions && msg.suggestions.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {msg.suggestions.map((sug, idx) => (
                                <button 
                                    key={idx} 
                                    onClick={() => handleSubmit(sug)} 
                                    className="text-[11px] bg-blue-50 text-blue-600 border border-blue-100 px-3 py-1.5 rounded-full hover:bg-blue-100 hover:scale-105 transition transform cursor-pointer font-medium"
                                >
                                    ✨ {sug}
                                </button>
                            ))}
                        </div>
                   )}

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