'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
    Gamepad2,
    Flame,
    ArrowLeft,
    RotateCcw,
    Zap,
    Footprints,
    ArrowUp,
    Swords,
    ShieldAlert,
    Skull,
    Target,
    Volume2,
    VolumeX,
    Gauge
} from 'lucide-react';
import type { PixiGameCanvasRef } from '@/components/game/PixiGameCanvas';

/**
 * Carga dinámica del motor de renderizado PixiJS WebGL sin SSR
 */
const PixiGameCanvas = dynamic(
    () => import('@/components/game/PixiGameCanvas').then((mod) => mod.PixiGameCanvas),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#0e0f14] text-white">
                <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
                <span className="text-xs font-mono font-bold tracking-widest text-amber-400">
                    INICIALIZANDO MOTOR PIXIJS (WEBGL)...
                </span>
            </div>
        )
    }
);

/**
 * Sintetizador Web Audio nativo para banda sonora chiptune arcade retro
 * Genera bajo funky, melodía de sintetizador cuadrado y ritmo sin necesidad de archivos externos.
 */
class RetroArcadeBgm {
    private ctx: AudioContext | null = null;
    public isPlaying: boolean = false;
    private timerId: number | null = null;
    private step: number = 0;

    start() {
        if (this.isPlaying) return;
        try {
            const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (!AudioCtx) return;
            this.ctx = new AudioCtx();
            this.isPlaying = true;
            this.step = 0;
            this.tick();
        } catch {
            // Ignorar bloqueo de autoplay
        }
    }

    stop() {
        this.isPlaying = false;
        if (this.timerId) {
            window.clearTimeout(this.timerId);
            this.timerId = null;
        }
        if (this.ctx) {
            try {
                this.ctx.close();
            } catch {
                // Audio close error ignored
            }
            this.ctx = null;
        }
    }

    private tick() {
        if (!this.isPlaying || !this.ctx) return;
        const now = this.ctx.currentTime;
        const tempo = 84; // Tempo relajado con ritmo clásico beat 'em up (no apresurado)
        const stepTime = (60 / tempo) / 2;

        // Línea de bajo estilo beat 'em up clásico (A minor retro)
        const bassProgression = [110, 110, 130.81, 146.83, 110, 164.81, 146.83, 123.47];
        // Melodía arcade complementaria
        const leadProgression = [440, 0, 523.25, 587.33, 659.25, 587.33, 523.25, 493.88];

        const bassFreq = bassProgression[this.step % bassProgression.length];
        const leadFreq = leadProgression[this.step % leadProgression.length];

        // 1. Bajo sintetizado (Sawtooth)
        if (bassFreq > 0) {
            const oscB = this.ctx.createOscillator();
            const gainB = this.ctx.createGain();
            oscB.type = 'sawtooth';
            oscB.frequency.setValueAtTime(bassFreq, now);
            gainB.gain.setValueAtTime(0.08, now);
            gainB.gain.exponentialRampToValueAtTime(0.001, now + stepTime * 0.85);
            oscB.connect(gainB);
            gainB.connect(this.ctx.destination);
            oscB.start(now);
            oscB.stop(now + stepTime * 0.85);
        }

        // 2. Melodía chiptune brillante (Square wave)
        if (leadFreq > 0 && (this.step % 2 === 0 || this.step % 4 === 3)) {
            const oscL = this.ctx.createOscillator();
            const gainL = this.ctx.createGain();
            oscL.type = 'square';
            oscL.frequency.setValueAtTime(leadFreq, now);
            gainL.gain.setValueAtTime(0.03, now);
            gainL.gain.exponentialRampToValueAtTime(0.001, now + stepTime * 0.7);
            oscL.connect(gainL);
            gainL.connect(this.ctx.destination);
            oscL.start(now);
            oscL.stop(now + stepTime * 0.7);
        }

        // 3. Hi-hat / caja retro (Ruido blanco breve)
        if (this.step % 2 === 1) {
            try {
                const bufferSize = Math.floor(this.ctx.sampleRate * 0.03);
                const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                const noise = this.ctx.createBufferSource();
                noise.buffer = buffer;
                const nGain = this.ctx.createGain();
                nGain.gain.setValueAtTime(0.018, now);
                nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
                noise.connect(nGain);
                nGain.connect(this.ctx.destination);
                noise.start(now);
            } catch {
                // Ignorar error de buffer
            }
        }

        this.step++;
        this.timerId = window.setTimeout(() => this.tick(), stepTime * 1000);
    }
}

export default function CapituloUnoPage() {
    const pixiRef = useRef<PixiGameCanvasRef | null>(null);
    const bgmRef = useRef<RetroArcadeBgm>(new RetroArcadeBgm());

    // Modo de juego: 'mission' (perseguir al choro) o 'practice' (probar movimientos y jugabilidad libre)
    const [gameMode, setGameMode] = useState<'mission' | 'practice'>('mission');
    const [dummyActive, setDummyActive] = useState<boolean>(true);
    const [activeActionName, setActiveActionName] = useState<string>('IDLE');
    const [gameSpeed, setGameSpeed] = useState<number>(0.75); // 0.75x por defecto: ritmo clásico de beat 'em up
    const [hitCount, setHitCount] = useState<number>(0);
    const [isMusicPlaying, setIsMusicPlaying] = useState<boolean>(false);
    const [isPlayerDead, setIsPlayerDead] = useState<boolean>(false);

    // Estado del juego
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'qte' | 'win' | 'gameover'>('playing');
    const [distanceToThief, setDistanceToThief] = useState<number>(35); // metros
    const [totalDistance, setTotalDistance] = useState<number>(0);
    const [lives, setLives] = useState<number>(3);
    const [qteKeys] = useState<string[]>(['ArrowUp', 'ArrowDown', 'ArrowRight']);
    const [qteIndex, setQteIndex] = useState<number>(0);
    const [qteTimeLeft, setQteTimeLeft] = useState<number>(3);
    const [qteMessage, setQteMessage] = useState<string>('');

    // Toggle Música retro
    const toggleMusic = useCallback(() => {
        const bgm = bgmRef.current;
        if (bgm.isPlaying) {
            bgm.stop();
            setIsMusicPlaying(false);
        } else {
            bgm.start();
            setIsMusicPlaying(true);
        }
    }, []);

    // Cambiar modo de juego limpiamente
    const switchMode = useCallback((mode: 'mission' | 'practice') => {
        setGameMode(mode);
        if (mode === 'practice') {
            setDistanceToThief(25);
            setGameState('playing');
        }
    }, []);

    // Detectar query param en montaje y limpiar música al salir
    useEffect(() => {
        const timer = setTimeout(() => {
            if (typeof window !== 'undefined') {
                const params = new URLSearchParams(window.location.search);
                if (params.get('mode') === 'practice') {
                    switchMode('practice');
                }
            }
        }, 10);

        const currentBgm = bgmRef.current;
        return () => {
            clearTimeout(timer);
            currentBgm.stop();
        };
    }, [switchMode]);

    // Gestión del Quick Time Event (Combate al alcanzarlo)
    const handleQteFail = useCallback(() => {
        setLives((prev) => {
            const next = prev - 1;
            if (next <= 0) {
                pixiRef.current?.triggerDeath();
                setTimeout(() => {
                    setGameState('gameover');
                }, 1000);
            } else {
                setQteMessage('¡El choro te golpeó y escapó más adelante!');
                setTimeout(() => {
                    setDistanceToThief(45);
                    setGameState('playing');
                }, 1200);
            }
            return next;
        });
    }, []);

    const handleQteSuccess = useCallback(() => {
        setGameState('win');
    }, []);

    const startQte = useCallback(() => {
        setQteIndex(0);
        setQteTimeLeft(3.5);
        setQteMessage('¡Presiona la secuencia antes de que te ataque!');
        setGameState('qte');
    }, []);

    // Timer para QTE en modo misión
    useEffect(() => {
        if (gameState !== 'qte') return;

        const timer = setInterval(() => {
            setQteTimeLeft((prev) => {
                if (prev <= 0.1) {
                    clearInterval(timer);
                    handleQteFail();
                    return 0;
                }
                return prev - 0.1;
            });
        }, 100);

        return () => clearInterval(timer);
    }, [gameState, handleQteFail]);

    // Teclas para QTE y atajos de música
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            // Manejo de QTE si está en combate
            if (gameState === 'qte') {
                const targetKey = qteKeys[qteIndex];
                if (e.code === targetKey || e.key === targetKey) {
                    const nextIndex = qteIndex + 1;
                    if (nextIndex >= qteKeys.length) {
                        handleQteSuccess();
                    } else {
                        setQteIndex(nextIndex);
                    }
                } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
                    handleQteFail();
                }
                return;
            }

            // Atajo de Música (B)
            if (e.code === 'KeyB') {
                toggleMusic();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [gameState, qteIndex, qteKeys, handleQteFail, handleQteSuccess, toggleMusic]);

    const resetGame = () => {
        pixiRef.current?.resetPosition();
        setDistanceToThief(35);
        setTotalDistance(0);
        setLives(3);
        setGameState('playing');
    };

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-black font-mono select-none">
            {/* Motor PixiJS WebGL Hardware Accelerated */}
            <PixiGameCanvas
                ref={pixiRef}
                gameMode={gameMode}
                gameSpeed={gameSpeed}
                dummyActive={dummyActive}
                activeChar={process.env.NEXT_PUBLIC_DEFAULT_CHARACTER || 'ruben'}
                thiefChar="ladron"
                onActionChange={setActiveActionName}
                onHit={setHitCount}
                onDistanceChange={(d, total) => {
                    setDistanceToThief(d);
                    setTotalDistance(total);
                }}
                onGameOver={() => setGameState('gameover')}
                onCatchThief={startQte}
                onPlayerDeadChange={setIsPlayerDead}
            />

            {/* Barra Superior / HUD Principal */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none z-20">
                <div className="flex flex-col gap-2">
                    {/* Selector de Modo: Misión vs Práctica */}
                    <div className="flex items-center bg-[#111]/90 border border-gray-700/80 p-1 rounded-xl shadow-xl backdrop-blur-md pointer-events-auto">
                        <button
                            onClick={() => switchMode('mission')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                                gameMode === 'mission'
                                    ? 'bg-[#e62329] text-white shadow-md shadow-red-900/40'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <Flame size={13} />
                            <span>Misión Choro</span>
                        </button>
                        <button
                            onClick={() => switchMode('practice')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                                gameMode === 'practice'
                                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <Gamepad2 size={13} />
                            <span>Probar Movimiento (Sandbox)</span>
                        </button>
                    </div>

                    {/* Vidas (solo en misión) */}
                    {gameMode === 'mission' && (
                        <div className="flex gap-1.5 bg-black/70 border border-gray-700 px-3 py-1.5 rounded w-fit pointer-events-auto">
                            {[1, 2, 3].map((heartIndex) => (
                                <span
                                    key={heartIndex}
                                    className={`text-lg transition-transform ${
                                        heartIndex <= lives ? 'opacity-100 scale-100' : 'opacity-25 grayscale scale-90'
                                    }`}
                                >
                                    ❤️
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Badge en modo práctica */}
                    {gameMode === 'practice' && (
                        <div className="flex items-center gap-2 pointer-events-auto">
                            <span className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-[10px] font-black px-2.5 py-1 rounded-md flex items-center gap-1.5">
                                <Target size={12} className="text-emerald-400" />
                                <span>MODO LIBRE: SIN PERSECUCIÓN</span>
                            </span>
                            <span className="bg-black/60 border border-gray-700 text-gray-300 text-[10px] px-2 py-1 rounded">
                                Hits: <strong className="text-yellow-400">{hitCount}</strong>
                            </span>
                        </div>
                    )}
                </div>

                {/* Lateral Derecho: Selector de Velocidad, Música o Distancia */}
                <div className="flex flex-col items-end gap-2 pointer-events-auto">
                    <div className="flex items-center gap-2">
                        {/* Selector de Velocidad */}
                        <div className="flex items-center bg-[#181926]/90 border border-gray-700/80 rounded-lg p-0.5 shadow-lg">
                            <Gauge size={13} className="text-amber-400 ml-2 mr-1" />
                            <span className="text-[10px] text-gray-400 font-bold mr-1.5 uppercase hidden sm:inline">Velocidad:</span>
                            {([0.5, 0.75, 1.0] as const).map((spd) => (
                                <button
                                    key={spd}
                                    onClick={() => setGameSpeed(spd)}
                                    className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                                        gameSpeed === spd
                                            ? 'bg-amber-500 text-black shadow font-black'
                                            : 'text-gray-400 hover:text-white'
                                    }`}
                                    title={`Ajustar velocidad del juego a ${spd}x`}
                                >
                                    {spd === 0.75 ? '0.75x (Normal)' : `${spd}x`}
                                </button>
                            ))}
                        </div>

                        {/* Botón Música Retro */}
                        <button
                            onClick={toggleMusic}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg ${
                                isMusicPlaying
                                    ? 'bg-amber-600/90 text-amber-100 border border-amber-400'
                                    : 'bg-[#181926]/90 text-gray-400 hover:text-white border border-gray-700'
                            }`}
                            title="Activar/Desactivar Música Retro Arcade (B)"
                        >
                            {isMusicPlaying ? <Volume2 size={13} className="animate-pulse" /> : <VolumeX size={13} />}
                            <span>{isMusicPlaying ? 'Música: ON' : 'Música: OFF'}</span>
                        </button>
                    </div>

                    {gameMode === 'mission' ? (
                        <>
                            <div
                                className={`px-4 py-2 rounded border-2 shadow-xl text-right transition-colors ${
                                    distanceToThief > 75
                                        ? 'bg-red-950/90 border-red-500 animate-pulse'
                                        : distanceToThief <= 10
                                        ? 'bg-yellow-950/90 border-yellow-400'
                                        : 'bg-black/85 border-white'
                                }`}
                            >
                                <div className="text-[9px] text-gray-400 uppercase tracking-widest">Distancia al Choro</div>
                                <div className="text-xl font-black text-yellow-400">
                                    {distanceToThief} m
                                    <span className="text-[10px] text-gray-300 ml-1">/ 100m máx</span>
                                </div>
                            </div>

                            <div className="text-[10px] bg-green-900 border border-white text-white px-2.5 py-1 rounded font-bold shadow flex items-center gap-2">
                                <span>📍 AV. ABANCAY ➔ VÍA EXPRESA</span>
                                <span className="text-yellow-300">({totalDistance}m)</span>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => pixiRef.current?.resetPosition()}
                                className="bg-[#181926] hover:bg-[#232538] border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                                title="Volver al inicio de la calle (R)"
                            >
                                <RotateCcw size={13} />
                                <span>Reset Posición</span>
                            </button>
                            <Link
                                href="/tools/sprites"
                                className="bg-[#1f212e] hover:bg-[#2a2d3e] border border-yellow-500/40 text-yellow-400 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
                            >
                                <Zap size={13} />
                                <span>Generador Sprites</span>
                            </Link>
                            <Link
                                href="/"
                                className="bg-black/70 hover:bg-black border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                            >
                                <ArrowLeft size={13} />
                                <span>Menú</span>
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {/* DOCK INFERIOR: Botones de Prueba de Acciones (Modo Práctica) */}
            {gameMode === 'practice' && (
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center justify-center gap-2 bg-[#0c0d14]/90 border border-emerald-500/30 p-2 px-4 rounded-2xl shadow-2xl backdrop-blur-md">
                    {/* Indicador de Acción Activa */}
                    <div className="flex items-center gap-1.5 bg-[#171a29] border border-gray-700/80 px-3 py-1.5 rounded-xl mr-1">
                        <span className="text-[10px] text-gray-400 uppercase tracking-widest">Acción:</span>
                        <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                            {activeActionName}
                        </span>
                    </div>

                    {/* Botón Caminar */}
                    <button
                        onClick={() => pixiRef.current?.stepWalk()}
                        className="bg-[#171923] hover:bg-[#222533] border border-gray-700 text-gray-200 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                        title="Presiona A o D para caminar"
                    >
                        <Footprints size={14} className="text-cyan-400" />
                        <span>Caminar (A/D)</span>
                    </button>

                    {/* Botón Correr */}
                    <button
                        onClick={() => pixiRef.current?.stepRun()}
                        className="bg-[#171923] hover:bg-[#222533] border border-gray-700 text-gray-200 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                        title="Mantén Shift mientras caminas para correr"
                    >
                        <Zap size={14} className="text-yellow-400" />
                        <span>Correr (Shift)</span>
                    </button>

                    {/* Botón Saltar */}
                    <button
                        onClick={() => pixiRef.current?.jump()}
                        className="bg-[#171923] hover:bg-[#222533] border border-gray-700 text-gray-200 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                        title="Presiona Espacio o W para saltar"
                    >
                        <ArrowUp size={14} className="text-purple-400" />
                        <span>Saltar (Espacio)</span>
                    </button>

                    {/* Botón Atacar */}
                    <button
                        onClick={() => pixiRef.current?.triggerAttack()}
                        className="bg-red-950/70 hover:bg-red-900/90 border border-red-500/70 text-red-200 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-lg shadow-red-950/40"
                        title="Presiona J, Z o haz clic en el canvas para golpear"
                    >
                        <Swords size={14} className="text-red-400 animate-pulse" />
                        <span>¡Atacar! (J / Click)</span>
                    </button>

                    {/* Botón Daño */}
                    <button
                        onClick={() => pixiRef.current?.triggerDamage()}
                        className="bg-[#181926] hover:bg-[#232538] border border-amber-600/50 text-amber-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                        title="Presiona H para recibir daño"
                    >
                        <ShieldAlert size={14} className="text-amber-400" />
                        <span>Probar Daño (H)</span>
                    </button>

                    {/* Botón Muerte / Levantarse */}
                    <button
                        onClick={() => {
                            if (isPlayerDead) {
                                pixiRef.current?.revivePlayer();
                            } else {
                                pixiRef.current?.triggerDeath();
                            }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                            isPlayerDead
                                ? 'bg-amber-950/80 border border-amber-500 text-amber-300 animate-bounce'
                                : 'bg-[#181216] hover:bg-[#241720] border border-red-800/60 text-red-300'
                        }`}
                        title="Presiona M para probar la animación de muerte o levantarse"
                    >
                        <Skull size={14} className={isPlayerDead ? 'text-amber-400' : 'text-red-400'} />
                        <span>{isPlayerDead ? '¡Levantarse!' : 'Probar Muerte (M)'}</span>
                    </button>

                    {/* Toggle Muñeco Dummy */}
                    <button
                        onClick={() => setDummyActive(!dummyActive)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            dummyActive
                                ? 'bg-emerald-950/70 border border-emerald-500/60 text-emerald-300'
                                : 'bg-gray-900 border border-gray-700 text-gray-500'
                        }`}
                        title="Mostrar u ocultar ladrón de pruebas"
                    >
                        <Target size={14} />
                        <span>Sparring: {dummyActive ? 'ON' : 'OFF'}</span>
                    </button>
                </div>
            )}

            {/* Guía de Controles Inferior (Modo Misión) */}
            {gameMode === 'mission' && (
                <div className="absolute bottom-4 left-6 pointer-events-none z-20 hidden md:flex items-center gap-4 bg-black/75 border border-gray-700 px-4 py-2 rounded-lg text-xs text-gray-300 backdrop-blur">
                    <div>
                        <span className="bg-gray-800 border border-gray-600 px-1.5 py-0.5 rounded text-white font-bold">
                            A
                        </span>{' '}
                        <span className="bg-gray-800 border border-gray-600 px-1.5 py-0.5 rounded text-white font-bold">
                            D
                        </span>{' '}
                        Correr
                    </div>
                    <div>
                        <span className="bg-gray-800 border border-gray-600 px-1.5 py-0.5 rounded text-white font-bold">
                            ESPACIO
                        </span>{' '}
                        Saltar
                    </div>
                    <div>
                        <span className="bg-gray-800 border border-gray-600 px-1.5 py-0.5 rounded text-white font-bold">
                            J
                        </span>{' '}
                        Atacar
                    </div>
                    <div className="text-yellow-400 font-bold">🎯 Acércate a menos de 5m para recuperar tu celular</div>
                </div>
            )}

            {/* Quick Time Event (Combate al alcanzarlo) */}
            {gameState === 'qte' && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-6 animate-fadeIn">
                    <div className="bg-[#181926] border-2 border-yellow-400 p-8 rounded-xl max-w-md w-full text-center shadow-2xl shadow-yellow-500/20">
                        <div className="inline-block bg-yellow-400 text-black font-black text-xs px-3 py-1 rounded mb-3 tracking-widest">
                            ¡YA LO ALCANZASTE!
                        </div>
                        <h2 className="text-2xl font-black text-white mb-2">¡QUÍTALE EL CELULAR!</h2>
                        <p className="text-xs text-gray-300 mb-6">{qteMessage}</p>

                        <div className="flex justify-center gap-4 mb-6">
                            {qteKeys.map((key, i) => (
                                <div
                                    key={i}
                                    className={`w-12 h-12 rounded border-2 flex items-center justify-center font-black text-lg transition-all ${
                                        i < qteIndex
                                            ? 'bg-green-600 border-green-400 text-white scale-95'
                                            : i === qteIndex
                                            ? 'bg-yellow-500 border-white text-black scale-110 shadow-lg animate-pulse'
                                            : 'bg-gray-800 border-gray-600 text-gray-400'
                                    }`}
                                >
                                    {key === 'ArrowUp' ? '↑' : key === 'ArrowDown' ? '↓' : key === 'ArrowRight' ? '→' : '←'}
                                </div>
                            ))}
                        </div>

                        <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden mb-4">
                            <div
                                className="bg-yellow-400 h-full transition-all duration-100"
                                style={{ width: `${(qteTimeLeft / 3.5) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Pantalla Game Over */}
            {gameState === 'gameover' && (
                <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-6 text-center">
                    <div className="bg-[#1f0507] border-2 border-[#e62329] p-8 rounded-xl max-w-md w-full shadow-2xl">
                        <h2 className="text-3xl font-black text-[#e62329] mb-2 uppercase tracking-wider">¡TE FALTO CALLE!</h2>
                        <p className="text-sm text-gray-300 mb-6">
                            El choro dobló por Grau y se perdió en el gentío con tu celular.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={resetGame}
                                className="bg-[#e62329] hover:bg-red-700 text-white font-bold text-xs px-4 py-3 rounded uppercase transition-colors shadow-lg cursor-pointer"
                            >
                                Intentar de Nuevo
                            </button>
                            <button
                                onClick={() => {
                                    switchMode('practice');
                                    pixiRef.current?.resetPosition();
                                    setGameState('playing');
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-3 rounded uppercase cursor-pointer"
                            >
                                Modo Práctica
                            </button>
                            <Link
                                href="/"
                                className="border border-gray-600 text-gray-300 hover:bg-gray-800 font-bold text-xs px-4 py-3 rounded"
                            >
                                Salir al Menú
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Pantalla Victoria */}
            {gameState === 'win' && (
                <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-6 text-center">
                    <div className="bg-[#051f0f] border-2 border-green-500 p-8 rounded-xl max-w-md w-full shadow-2xl">
                        <div className="text-4xl mb-2">📱✨</div>
                        <h2 className="text-3xl font-black text-green-400 mb-2 uppercase tracking-wider">
                            ¡RECUPERASTE TU CELULAR!
                        </h2>
                        <p className="text-sm text-gray-300 mb-6">
                            Le metiste su quieto y recuperaste tus pertenencias. ¡Nadie se mete con el Cholo!
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={resetGame}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-4 py-3 rounded uppercase transition-colors shadow-lg cursor-pointer"
                            >
                                Jugar Otra Vez
                            </button>
                            <button
                                onClick={() => {
                                    switchMode('practice');
                                    pixiRef.current?.resetPosition();
                                    setGameState('playing');
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-3 rounded uppercase cursor-pointer"
                            >
                                Modo Práctica
                            </button>
                            <Link
                                href="/"
                                className="border border-gray-600 text-gray-300 hover:bg-gray-800 font-bold text-xs px-4 py-3 rounded"
                            >
                                Menú ➔
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
