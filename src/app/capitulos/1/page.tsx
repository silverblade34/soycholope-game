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
    ArrowDown,
    Swords,
    ShieldAlert,
    Skull,
    Target,
    Volume2,
    VolumeX,
    Gauge,
    ChevronDown,
    ChevronUp,
    SlidersHorizontal,
    Heart,
    Utensils,
    Shield,
    Pause,
    Play,
    ArrowRight
} from 'lucide-react';
import type { PixiGameCanvasRef, SurvivalStats } from '@/components/game/PixiGameCanvas';

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
        const tempo = 84;
        const stepTime = (60 / tempo) / 2;

        const bassProgression = [110, 110, 130.81, 146.83, 110, 164.81, 146.83, 123.47];
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

    // Modo de juego: 'mission' (perseguir al choro) o 'practice' (sandbox)
    const [gameMode, setGameMode] = useState<'mission' | 'practice'>('mission');
    const [dummyActive, setDummyActive] = useState<boolean>(true);
    const [activeActionName, setActiveActionName] = useState<string>('IDLE');
    const [gameSpeed, setGameSpeed] = useState<number>(0.75);
    const [hitCount, setHitCount] = useState<number>(0);
    const [isMusicPlaying, setIsMusicPlaying] = useState<boolean>(false);
    const [isPlayerDead, setIsPlayerDead] = useState<boolean>(false);
    const [showActionBar, setShowActionBar] = useState<boolean>(true);
    const [isPaused, setIsPaused] = useState<boolean>(false);

    // Estado de Supervivencia Limeña (Vida, Cansancio, Hambre)
    const [survivalStats, setSurvivalStats] = useState<SurvivalStats>({
        vida: 100,
        cansancio: 0,
        hambre: 100,
        isFatigued: false,
        isStarving: false,
        hasPoncho: false,
        ponchoTimeLeft: 0,
        speedBuff: 1.0,
        speedBuffTimeLeft: 0,
        stunTimeLeft: 0
    });

    // Estado del juego
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'qte' | 'win' | 'gameover'>('playing');
    const [gameOverReason, setGameOverReason] = useState<'dead' | 'escaped'>('escaped');
    const [distanceToThief, setDistanceToThief] = useState<number>(35);
    const [totalDistance, setTotalDistance] = useState<number>(0);
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
        setSurvivalStats((prev) => {
            const nextHp = Math.max(0, prev.vida - 35);
            if (nextHp <= 0) {
                pixiRef.current?.triggerDeath();
                setTimeout(() => {
                    setGameOverReason('dead');
                    setGameState('gameover');
                }, 1000);
            } else {
                setQteMessage('¡El choro te encajó un cabezazo y sacó ventaja!');
                setTimeout(() => {
                    setDistanceToThief(42);
                    setGameState('playing');
                }, 1200);
            }
            return { ...prev, vida: nextHp };
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

            // Atajo para alternar barra de acciones (C)
            if (e.code === 'KeyC') {
                setShowActionBar((prev) => !prev);
            }

            // Atajo de Pausa (P o Escape)
            if (e.code === 'KeyP' || e.code === 'Escape') {
                setIsPaused((prev) => !prev);
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
                isPaused={isPaused}
                activeChar={process.env.NEXT_PUBLIC_DEFAULT_CHARACTER || 'ruben'}
                thiefChar="ladron"
                onActionChange={setActiveActionName}
                onHit={setHitCount}
                onDistanceChange={(d, total) => {
                    setDistanceToThief(d);
                    setTotalDistance(total);
                }}
                onGameOver={(reason) => {
                    setGameOverReason(reason);
                    setGameState('gameover');
                }}
                onCatchThief={startQte}
                onPlayerDeadChange={setIsPlayerDead}
                onStatsChange={setSurvivalStats}
            />

            {/* BARRA SUPERIOR / HUD PRINCIPAL (Fiel al Mockup) */}
            <div className="absolute top-3 sm:top-4 left-3 sm:left-4 right-3 sm:right-4 flex justify-between items-start pointer-events-none z-20">
                {/* LADO IZQUIERDO: CARD DEL PERSONAJE (Rubén) Y SUS BARRAS */}
                <div className="flex flex-col gap-1.5 pointer-events-auto">
                    <div className="flex items-center gap-3 bg-[#0a0c13]/92 border-2 border-[#1a2030] p-2 sm:p-2.5 px-3 rounded-2xl shadow-2xl backdrop-blur-md">
                        {/* Avatar de Rubén con marco cyan */}
                        <div className="w-13 h-13 sm:w-14 sm:h-14 bg-[#111420] border-2 border-cyan-500/50 rounded-xl overflow-hidden flex items-center justify-center shadow-[inset_0_0_10px_rgba(6,182,212,0.3)] flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/sprites/ruben/avatar.png"
                                alt="Rubén"
                                className="w-12 h-12 sm:w-13 sm:h-13 object-contain pixelated"
                            />
                        </div>

                        {/* Tres Barras de Supervivencia: Vida, Cansancio, Hambre */}
                        <div className="flex flex-col gap-1 sm:gap-1.5 min-w-[190px] sm:min-w-[240px]">
                            {/* 1. VIDA */}
                            <div className="flex flex-col gap-0.5">
                                <div className="flex justify-between items-center text-[10px] sm:text-[11px] font-black tracking-wider">
                                    <span className="flex items-center gap-1.5 text-rose-500">
                                        <Heart size={12} className="fill-rose-500 text-rose-500 animate-pulse" />
                                        <span>VIDA</span>
                                    </span>
                                    <span className="text-white font-mono font-bold text-[10px] sm:text-[11px]">
                                        {Math.round(survivalStats.vida)} / 100
                                    </span>
                                </div>
                                <div className="w-full bg-[#201015] border border-rose-950/80 h-2.5 rounded-full overflow-hidden p-[1px]">
                                    <div
                                        className="h-full bg-gradient-to-r from-rose-600 via-rose-500 to-rose-400 rounded-full transition-all duration-150 shadow-[0_0_8px_rgba(244,63,94,0.6)]"
                                        style={{ width: `${Math.max(0, Math.min(100, survivalStats.vida))}%` }}
                                    />
                                </div>
                            </div>

                            {/* 2. CANSANCIO */}
                            <div className="flex flex-col gap-0.5">
                                <div className="flex justify-between items-center text-[10px] sm:text-[11px] font-black tracking-wider">
                                    <span className="flex items-center gap-1.5 text-amber-400">
                                        <Zap size={12} className="fill-amber-400 text-amber-400" />
                                        <span>CANSANCIO</span>
                                        {survivalStats.isFatigued && (
                                            <span className="bg-red-600 text-white text-[8px] px-1 rounded animate-bounce">
                                                ¡FATIGA!
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-white font-mono font-bold text-[10px] sm:text-[11px]">
                                        {Math.round(survivalStats.cansancio)}%
                                    </span>
                                </div>
                                <div className="w-full bg-[#20180e] border border-amber-950/80 h-2.5 rounded-full overflow-hidden p-[1px]">
                                    <div
                                        className={`h-full rounded-full transition-all duration-150 ${
                                            survivalStats.isFatigued
                                                ? 'bg-gradient-to-r from-red-500 to-amber-500 animate-pulse'
                                                : 'bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                                        }`}
                                        style={{ width: `${Math.max(0, Math.min(100, survivalStats.cansancio))}%` }}
                                    />
                                </div>
                            </div>

                            {/* 3. HAMBRE */}
                            <div className="flex flex-col gap-0.5">
                                <div className="flex justify-between items-center text-[10px] sm:text-[11px] font-black tracking-wider">
                                    <span className="flex items-center gap-1.5 text-emerald-400">
                                        <Utensils size={12} className="text-emerald-400" />
                                        <span>HAMBRE</span>
                                        {survivalStats.isStarving && (
                                            <span className="bg-red-600 text-white text-[8px] px-1 rounded animate-pulse">
                                                ¡HAMBRE!
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-white font-mono font-bold text-[10px] sm:text-[11px]">
                                        {Math.round(survivalStats.hambre)}%
                                    </span>
                                </div>
                                <div className="w-full bg-[#0e2017] border border-emerald-950/80 h-2.5 rounded-full overflow-hidden p-[1px]">
                                    <div
                                        className={`h-full rounded-full transition-all duration-150 ${
                                            survivalStats.hambre <= 20
                                                ? 'bg-gradient-to-r from-red-600 to-orange-500 animate-pulse'
                                                : 'bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                        }`}
                                        style={{ width: `${Math.max(0, Math.min(100, survivalStats.hambre))}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Efectos activos (Poncho Escudo, Turbo Maca, etc.) */}
                    {(survivalStats.hasPoncho || survivalStats.speedBuffTimeLeft > 0) && (
                        <div className="flex flex-wrap gap-1 px-1">
                            {survivalStats.hasPoncho && (
                                <span className="bg-sky-950/90 border border-sky-400 text-sky-200 text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow">
                                    <Shield size={10} className="text-sky-400" />
                                    <span>PONCHO ESCUDO ({Math.ceil(survivalStats.ponchoTimeLeft)}s)</span>
                                </span>
                            )}
                            {survivalStats.speedBuffTimeLeft > 0 && (
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow ${
                                    survivalStats.speedBuff > 1
                                        ? 'bg-yellow-950/90 border border-yellow-400 text-yellow-200'
                                        : 'bg-orange-950/90 border border-orange-400 text-orange-200'
                                }`}>
                                    <span>
                                        {survivalStats.speedBuff > 1
                                            ? `⚡ TURBO MACA (${Math.ceil(survivalStats.speedBuffTimeLeft)}s)`
                                            : `💩 RESBALÓN (${Math.ceil(survivalStats.speedBuffTimeLeft)}s)`}
                                    </span>
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* LADO DERECHO: UBICACIÓN, DISTANCIA Y BOTÓN PAUSA (Fiel al Mockup) */}
                <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
                    {/* Píldora de Ubicación */}
                    <div className="bg-[#0a0c13]/92 border border-gray-800 px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-xl backdrop-blur-md">
                        <span className="w-2.5 h-2.5 rotate-45 bg-[#e62329] border border-white inline-block shadow-sm" />
                        <span className="text-[11px] sm:text-xs font-black tracking-wider text-gray-200">
                            AV. ABANCAY ➔ VÍA EXPRESA
                        </span>
                    </div>

                    {/* Contador de Distancia */}
                    <div className="bg-[#0a0c13]/92 border border-gray-800 px-3.5 sm:px-4 py-1.5 rounded-xl flex flex-col items-center justify-center shadow-xl backdrop-blur-md min-w-[85px] sm:min-w-[95px]">
                        <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                            DISTANCIA
                        </span>
                        <span className="text-sm sm:text-base font-black text-amber-400 font-mono tracking-tight">
                            {Math.round(totalDistance)} m
                        </span>
                    </div>

                    {/* Botón de Pausa */}
                    <button
                        onClick={() => setIsPaused((prev) => !prev)}
                        className="w-10 h-10 sm:w-11 sm:h-11 bg-[#0a0c13]/92 hover:bg-[#1a2030] active:bg-[#232b40] border border-gray-700/80 rounded-xl flex items-center justify-center text-white transition-all active:scale-95 shadow-xl cursor-pointer"
                        title="Pausar juego (P o Escape)"
                    >
                        {isPaused ? <Play size={18} className="fill-white ml-0.5" /> : <Pause size={18} className="fill-white" />}
                    </button>
                </div>
            </div>

            {/* ALERTA DE PERSECUCIÓN EN MODO MISIÓN */}
            {gameMode === 'mission' && distanceToThief > 110 && (
                <div className="absolute top-20 right-4 z-20 pointer-events-none bg-red-950/90 border-2 border-red-500 text-red-200 text-xs px-3 py-1.5 rounded-xl font-bold animate-pulse shadow-2xl">
                    ⚠️ ¡El choro está a {distanceToThief}m! (¡A los 150m se fuga!)
                </div>
            )}

            {/* ============================================================== */}
            {/* CONTROLES INFERIORES: D-PAD, DOCKS DE CATÁLOGO Y ACCIONES      */}
            {/* ============================================================== */}

            {/* 1. D-PAD VIRTUAL DE 4 DIRECCIONES (Inferior Izquierda) */}
            <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-6 z-20 pointer-events-auto select-none">
                <div className="relative w-28 h-28 sm:w-32 sm:h-32 grid grid-cols-3 grid-rows-3 gap-1 sm:gap-1.5 p-1 sm:p-1.5 bg-[#080a10]/80 border border-cyan-900/35 rounded-2xl backdrop-blur-md shadow-2xl">
                    <div />
                    {/* ARRIBA: SALTAR */}
                    <button
                        onPointerDown={() => pixiRef.current?.jump()}
                        className="flex items-center justify-center bg-[#131625]/90 hover:bg-[#1f243b] active:bg-[#2b3252] border border-gray-700/80 rounded-xl text-gray-200 transition-all active:scale-95 cursor-pointer shadow-md"
                        title="Saltar / Doble Salto (W / ↑)"
                    >
                        <ArrowUp size={20} className="stroke-[2.5]" />
                    </button>
                    <div />

                    {/* IZQUIERDA: RETROCEDER */}
                    <button
                        onPointerDown={() => pixiRef.current?.setVirtualKey('left', true)}
                        onPointerUp={() => pixiRef.current?.setVirtualKey('left', false)}
                        onPointerLeave={() => pixiRef.current?.setVirtualKey('left', false)}
                        className="flex items-center justify-center bg-[#131625]/90 hover:bg-[#1f243b] active:bg-[#2b3252] border border-gray-700/80 rounded-xl text-gray-200 transition-all active:scale-95 cursor-pointer shadow-md"
                        title="Retroceder (A / ←)"
                    >
                        <ArrowLeft size={20} className="stroke-[2.5]" />
                    </button>

                    {/* CENTRO */}
                    <div className="flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-cyan-500/40" />
                    </div>

                    {/* DERECHA: AVANZAR / CORRER (Resaltado en Cyan Glow como el Mockup) */}
                    <button
                        onPointerDown={() => {
                            pixiRef.current?.setVirtualKey('right', true);
                            pixiRef.current?.setVirtualKey('sprint', true);
                        }}
                        onPointerUp={() => {
                            pixiRef.current?.setVirtualKey('right', false);
                            pixiRef.current?.setVirtualKey('sprint', false);
                        }}
                        onPointerLeave={() => {
                            pixiRef.current?.setVirtualKey('right', false);
                            pixiRef.current?.setVirtualKey('sprint', false);
                        }}
                        className="flex items-center justify-center bg-cyan-950/85 hover:bg-cyan-900 active:bg-cyan-800 border-2 border-cyan-400 rounded-xl text-cyan-300 transition-all active:scale-95 cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.6)]"
                        title="Avanzar / Correr (D / →)"
                    >
                        <ArrowRight size={22} className="stroke-[3]" />
                    </button>

                    <div />
                    {/* ABAJO: AGACHARSE */}
                    <button
                        onPointerDown={() => pixiRef.current?.setVirtualKey('duck', true)}
                        onPointerUp={() => pixiRef.current?.setVirtualKey('duck', false)}
                        onPointerLeave={() => pixiRef.current?.setVirtualKey('duck', false)}
                        className="flex items-center justify-center bg-[#131625]/90 hover:bg-[#1f243b] active:bg-[#2b3252] border border-gray-700/80 rounded-xl text-gray-200 transition-all active:scale-95 cursor-pointer shadow-md"
                        title="Agacharse (S / ↓)"
                    >
                        <ArrowDown size={20} className="stroke-[2.5]" />
                    </button>
                    <div />
                </div>
            </div>

            {/* 2. DOCKS INFERIORES CENTRALES: OBSTÁCULOS DE BARRIO Y POTENCIADORES */}
            <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-20 hidden md:flex items-center gap-3 pointer-events-auto select-none">
                {/* DOCK OBSTÁCULOS DE BARRIO (Rojo) */}
                <div className="bg-[#14080b]/92 border border-red-900/80 rounded-2xl p-2 px-3 shadow-2xl backdrop-blur-md flex flex-col gap-1.5 min-w-[210px]">
                    <div className="text-[10px] font-black uppercase tracking-wider text-red-400 flex items-center justify-between">
                        <span>OBSTÁCULOS DE BARRIO</span>
                        <span className="text-[8px] text-red-400/70">ESQUIVAR</span>
                    </div>
                    <div className="flex items-center justify-center gap-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/items/hueco.png" alt="Hueco" title="Hueco en la pista" className="w-8 h-8 object-contain pixelated hover:scale-125 transition-transform" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/items/cono.png" alt="Cono" title="Cono de tránsito" className="w-7 h-7 object-contain pixelated hover:scale-125 transition-transform" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/items/perro_echado.png" alt="Perro echado" title="Firulais durmiendo" className="w-10 h-7 object-contain pixelated hover:scale-125 transition-transform" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/items/borracho.png" alt="Borracho" title="Borracho en la vereda" className="w-11 h-7 object-contain pixelated hover:scale-125 transition-transform" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/items/maceta_volcada.png" alt="Maceta volcada" title="Maceta volcada" className="w-8 h-8 object-contain pixelated hover:scale-125 transition-transform" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/items/carrito_ambulante.png" alt="Carrito ambulante" title="Carrito ambulante (Requiere Doble Salto)" className="w-8 h-8 object-contain pixelated hover:scale-125 transition-transform" />
                    </div>
                </div>

                {/* DOCK POTENCIADORES (Verde) */}
                <div className="bg-[#08140f]/92 border border-emerald-900/80 rounded-2xl p-2 px-3 shadow-2xl backdrop-blur-md flex flex-col gap-1.5 min-w-[210px]">
                    <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center justify-between">
                        <span>POTENCIADORES</span>
                        <span className="text-[8px] text-emerald-400/70">RECOLECTAR</span>
                    </div>
                    <div className="flex items-center justify-center gap-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/items/emoliente.png" alt="Emoliente" title="Emoliente caliente (-cansancio)" className="w-7 h-7 object-contain pixelated hover:scale-125 transition-transform" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/items/chicha.png" alt="Chicha" title="Chicha morada (-cansancio)" className="w-7 h-7 object-contain pixelated hover:scale-125 transition-transform" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/items/pan_chicharron.png" alt="Pan con chicharrón" title="Pan con chicharrón (+hambre)" className="w-8 h-8 object-contain pixelated hover:scale-125 transition-transform" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/items/canchita.png" alt="Canchita" title="Canchita serrana (+hambre)" className="w-8 h-8 object-contain pixelated hover:scale-125 transition-transform" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/items/picarones.png" alt="Picarones" title="Picarones (+hambre)" className="w-8 h-8 object-contain pixelated hover:scale-125 transition-transform" />
                    </div>
                </div>
            </div>

            {/* 3. BOTONES DE ACCIÓN (Inferior Derecha: Salto y Ataque Arcade) */}
            <div className="absolute bottom-4 sm:bottom-6 right-4 sm:right-6 z-20 flex items-center gap-3 sm:gap-4 pointer-events-auto select-none">
                {/* BOTÓN SALTAR (Azul brillante circular con Doble Salto) */}
                <div className="flex flex-col items-center gap-1">
                    <button
                        onPointerDown={() => pixiRef.current?.jump()}
                        className="w-15 h-15 sm:w-17 sm:h-17 rounded-full bg-gradient-to-b from-[#1e88e5] to-[#1565c0] border-2 border-[#64b5f6] shadow-[0_0_20px_rgba(30,136,229,0.6)] flex items-center justify-center text-white active:scale-90 transition-all cursor-pointer hover:brightness-110"
                        title="Saltar / Doble Salto (Espacio / W)"
                    >
                        <ArrowUp size={28} className="stroke-[3]" />
                    </button>
                    <span className="text-[10px] font-black uppercase tracking-wider text-sky-300 drop-shadow">
                        SALTAR
                    </span>
                </div>

                {/* BOTÓN ATACAR (Rojo carmesí circular) */}
                <div className="flex flex-col items-center gap-1">
                    <button
                        onPointerDown={() => pixiRef.current?.triggerAttack()}
                        className="w-15 h-15 sm:w-17 sm:h-17 rounded-full bg-gradient-to-b from-[#e53935] to-[#b71c1c] border-2 border-[#ef5350] shadow-[0_0_20px_rgba(229,57,53,0.6)] flex items-center justify-center text-white active:scale-90 transition-all cursor-pointer hover:brightness-110"
                        title="Atacar (J / Click)"
                    >
                        <span className="text-2xl select-none leading-none">👊</span>
                    </button>
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-300 drop-shadow">
                        ATACAR
                    </span>
                </div>
            </div>

            {/* SANDBOX DEV DOCK (Solo visible en modo práctica si se expande) */}
            {gameMode === 'practice' && (
                showActionBar ? (
                    <div className="absolute top-24 left-4 z-20 flex flex-wrap items-center gap-1.5 bg-[#0c0d14]/92 border border-emerald-500/35 p-2 rounded-2xl shadow-2xl backdrop-blur-md max-w-sm pointer-events-auto">
                        <div className="w-full flex items-center justify-between text-[10px] font-bold text-gray-400 pb-1 border-b border-gray-800">
                            <span>PROBAR ANIMACIONES (SANDBOX)</span>
                            <button
                                onClick={() => setShowActionBar(false)}
                                className="text-gray-400 hover:text-white"
                            >
                                <ChevronDown size={14} />
                            </button>
                        </div>
                        <button
                            onClick={() => pixiRef.current?.triggerEat()}
                            className="bg-[#181926] hover:bg-[#232538] border border-yellow-600/50 text-yellow-300 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                            <Utensils size={11} /> Comer
                        </button>
                        <button
                            onClick={() => pixiRef.current?.triggerDrink()}
                            className="bg-[#181926] hover:bg-[#232538] border border-teal-600/50 text-teal-300 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                            <Volume2 size={11} /> Beber
                        </button>
                        <button
                            onClick={() => pixiRef.current?.triggerFatigue()}
                            className="bg-[#181926] hover:bg-[#232538] border border-orange-600/50 text-orange-300 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                            <Zap size={11} /> Cansancio
                        </button>
                        <button
                            onClick={() => pixiRef.current?.triggerHunger()}
                            className="bg-[#181926] hover:bg-[#232538] border border-rose-600/50 text-rose-300 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                            <Flame size={11} /> Hambre
                        </button>
                        <button
                            onClick={() => pixiRef.current?.triggerDamage()}
                            className="bg-[#181926] hover:bg-[#232538] border border-amber-600/50 text-amber-300 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                            <ShieldAlert size={11} /> Daño
                        </button>
                        <button
                            onClick={() => {
                                if (isPlayerDead) pixiRef.current?.revivePlayer();
                                else pixiRef.current?.triggerDeath();
                            }}
                            className="bg-[#181926] hover:bg-[#232538] border border-red-600/50 text-red-300 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                            <Skull size={11} /> {isPlayerDead ? 'Revivir' : 'Muerte'}
                        </button>
                        <button
                            onClick={() => setDummyActive(!dummyActive)}
                            className="bg-[#181926] hover:bg-[#232538] border border-emerald-600/50 text-emerald-300 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                            <Target size={11} /> Sparring: {dummyActive ? 'ON' : 'OFF'}
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowActionBar(true)}
                        className="absolute top-24 left-4 z-20 bg-[#0c0d14]/90 hover:bg-[#151724] border border-emerald-500/50 text-emerald-300 px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 shadow-xl backdrop-blur-md cursor-pointer pointer-events-auto"
                    >
                        <SlidersHorizontal size={11} />
                        <span>Panel Pruebas ({activeActionName})</span>
                        <ChevronUp size={11} />
                    </button>
                )
            )}

            {/* MODAL DE PAUSA */}
            {isPaused && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-50 p-6 animate-in fade-in duration-200">
                    <div className="bg-[#0f111a] border-2 border-cyan-500/60 p-6 sm:p-8 rounded-3xl max-w-sm w-full shadow-2xl text-center flex flex-col gap-4">
                        <div className="inline-block bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest mx-auto">
                            ⏸️ PAUSA
                        </div>
                        <h2 className="text-2xl font-black text-white tracking-widest uppercase">
                            JUEGO EN PAUSA
                        </h2>
                        <p className="text-xs text-gray-400">
                            Tómate un respiro, causita. ¿Qué hacemos ahora?
                        </p>

                        <div className="flex flex-col gap-2.5 pt-2">
                            {/* Reanudar */}
                            <button
                                onClick={() => setIsPaused(false)}
                                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-3 rounded-xl uppercase text-xs tracking-wider transition-all cursor-pointer shadow-lg shadow-cyan-900/40 active:scale-95"
                            >
                                Continuar Jugando
                            </button>

                            {/* Selector de Modo */}
                            <div className="flex items-center justify-between bg-[#151824] border border-gray-800 p-2.5 rounded-xl text-xs">
                                <span className="text-gray-400 font-bold">Modo actual:</span>
                                <button
                                    onClick={() => {
                                        switchMode(gameMode === 'mission' ? 'practice' : 'mission');
                                    }}
                                    className="text-amber-400 font-black hover:underline cursor-pointer flex items-center gap-1"
                                >
                                    {gameMode === 'mission' ? '🔥 Misión Choro' : '🎮 Modo Práctica'}
                                </button>
                            </div>

                            {/* Velocidad */}
                            <div className="flex items-center justify-between bg-[#151824] border border-gray-800 p-2 px-3 rounded-xl">
                                <span className="text-xs text-gray-400 font-bold">Velocidad:</span>
                                <div className="flex gap-1">
                                    {([0.5, 0.75, 1.0] as const).map((spd) => (
                                        <button
                                            key={spd}
                                            onClick={() => setGameSpeed(spd)}
                                            className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                                                gameSpeed === spd
                                                    ? 'bg-amber-500 text-black font-black'
                                                    : 'text-gray-400 hover:text-white'
                                            }`}
                                        >
                                            {spd}x
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Música */}
                            <button
                                onClick={toggleMusic}
                                className="w-full bg-[#181a28] hover:bg-[#23263b] border border-gray-700 text-gray-200 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                            >
                                {isMusicPlaying ? <Volume2 size={14} className="text-amber-400" /> : <VolumeX size={14} />}
                                <span>{isMusicPlaying ? 'Música Retro: ON' : 'Música Retro: OFF'}</span>
                            </button>

                            {/* Reiniciar */}
                            <button
                                onClick={() => {
                                    setIsPaused(false);
                                    resetGame();
                                }}
                                className="w-full bg-[#181a28] hover:bg-[#23263b] border border-gray-700 text-gray-200 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                            >
                                <RotateCcw size={14} />
                                <span>Reiniciar Carrera</span>
                            </button>

                            {/* Menú Principal */}
                            <Link
                                href="/"
                                className="w-full border border-gray-800 hover:border-gray-600 text-gray-400 hover:text-white py-2.5 rounded-xl text-xs font-bold transition-colors block text-center"
                            >
                                Salir al Menú Principal
                            </Link>
                        </div>
                    </div>
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
                <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-6 text-center animate-in fade-in duration-300">
                    <div className="bg-[#1a080a] border-2 border-[#e62329] p-8 rounded-2xl max-w-lg w-full shadow-2xl shadow-red-950/80">
                        {gameOverReason === 'escaped' ? (
                            <>
                                <div className="text-4xl mb-2">🏃💨💨</div>
                                <h2 className="text-2xl sm:text-3xl font-black text-[#e62329] mb-2 uppercase tracking-wider">
                                    ¡EL CHORO SE FUGÓ, SANO!
                                </h2>
                                <p className="text-sm text-gray-200 mb-4 leading-relaxed font-sans">
                                    ¡Para la siguiente no seas tan lenteja, compare! Te quedaste hueveando mirando los cerros y el piraña ya chapó su mototaxi.
                                </p>
                                <div className="bg-black/60 border border-red-900/60 p-3 rounded-xl mb-6 text-xs text-amber-300 font-mono text-left">
                                    <p className="font-bold text-red-400 mb-1">📋 REPORTE DE SERENAZGO:</p>
                                    <p>• Ahorita tu Xiaomi ya está formateado en Las Malvinas con chip Robistar.</p>
                                    <p>• El piraña te sacó más de 150 metros de ventaja trotando en chancletas.</p>
                                    <p>• Te fuiste descalzo, sin pasaje y con la moral por los suelos.</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="text-4xl mb-2">💀🪦</div>
                                <h2 className="text-2xl sm:text-3xl font-black text-[#e62329] mb-2 uppercase tracking-wider">
                                    ¡QUEDASTE TIESO EN LA PISTA!
                                </h2>
                                <p className="text-sm text-gray-200 mb-4 leading-relaxed font-sans">
                                    ¡Te desmayaste por falta de comida y fatiga extrema! Pasó una combi de la 50 raspándote las tabas y el sereno te decomisó la billetera por desacato.
                                </p>
                                <div className="bg-black/60 border border-red-900/60 p-3 rounded-xl mb-6 text-xs text-amber-300 font-mono text-left">
                                    <p className="font-bold text-red-400 mb-1">📋 DIAGNÓSTICO CALLEJERO:</p>
                                    <p>• Hambre en cero: ¿Por qué no te comiste un anticucho o una canchita?</p>
                                    <p>• Fatiga al 100%: Debiste clavarte un emoliente caliente antes de desmayarte.</p>
                                    <p>• Te faltó calle, causita. ¡Bienvenido a Lima la gris!</p>
                                </div>
                            </>
                        )}

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={resetGame}
                                className="bg-[#e62329] hover:bg-red-700 text-white font-black text-xs px-5 py-3 rounded-xl uppercase transition-all shadow-lg shadow-red-900/40 cursor-pointer active:scale-95"
                            >
                                Intentar de Nuevo (Venganza)
                            </button>
                            <button
                                onClick={() => {
                                    switchMode('practice');
                                    pixiRef.current?.resetPosition();
                                    setGameState('playing');
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-3 rounded-xl uppercase cursor-pointer transition-colors"
                            >
                                Entrenar en Modo Práctica (Sandbox)
                            </button>
                            <Link
                                href="/"
                                className="border border-gray-700 text-gray-400 hover:text-white hover:bg-white/5 font-bold text-xs px-4 py-2.5 rounded-xl transition-colors"
                            >
                                Salir al Menú Principal
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
