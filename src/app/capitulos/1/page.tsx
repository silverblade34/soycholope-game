'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
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

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
}

interface FloatingText {
    text: string;
    x: number;
    y: number;
    opacity: number;
    vy: number;
    color: string;
}

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
            clearTimeout(this.timerId);
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
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const bgmRef = useRef<RetroArcadeBgm>(new RetroArcadeBgm());

    // Modo de juego: 'mission' (perseguir al choro) o 'practice' (probar movimientos y jugabilidad libre)
    const [gameMode, setGameMode] = useState<'mission' | 'practice'>('mission');
    const [dummyActive, setDummyActive] = useState<boolean>(true);
    const [activeActionName, setActiveActionName] = useState<string>('idle');
    const activeActionNameRef = useRef<string>('idle');
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

    // Referencias mutables para el loop (normalizadas para correr a ritmo natural y fluido en 60Hz/120Hz/ProMotion)
    const stateRef = useRef({
        gameMode: 'mission' as 'mission' | 'practice',
        gameSpeed: 0.75, // Velocidad estándar arcade retro
        dummyActive: true,
        gameState: 'playing',
        distanceToThief: 35,
        totalDistance: 0,
        lives: 3,
        worldScrollX: 0,
        player: {
            x: 180,
            y: 0,
            groundY: 0,
            vx: 0,
            vy: 0,
            speedWalk: 1.8, // Caminata urbana firme y asentada (no patina)
            speedRun: 3.1,  // Carrera ágil pero controlable y visualmente nítida
            jumpStrength: -9.8, // Salto arqueado con peso y parábola clásica arcade
            gravity: 0.38, // Gravedad con caída natural
            isGrounded: true,
            facingRight: true,
            width: 110,
            height: 110,
            bobbing: 0,
            runCycle: 0,
            animTimer: 0,
            currentAction: 'idle',
            isMoving: false,
            isSprinting: false,
            isAttacking: false,
            attackTimer: 0,
            attackDuration: 36, // ~600ms para apreciar cada uno de los 5 frames de golpe
            isDamaged: false,
            damageTimer: 0,
            damageDuration: 30,
            isDead: false,
            deathTimer: 0,
            deathDuration: 60, // Caída con peso y dramatismo
            combo: 0
        },
        thief: {
            x: 520,
            y: 0,
            speed: 2.2, // Ritmo equilibrado: más rápido que caminar (1.8) pero alcanzable al correr (3.1)
            bobbing: 0,
            runCycle: 0,
            recoilX: 0,
            hitFlash: 0
        },
        particles: [] as Particle[],
        floatingTexts: [] as FloatingText[],
        keys: {
            left: false,
            right: false,
            jump: false,
            sprint: false
        }
    });

    // Ajustar velocidad global del juego
    const changeGameSpeed = useCallback((spd: number) => {
        setGameSpeed(spd);
        stateRef.current.gameSpeed = spd;
    }, []);

    // Cambiar modo de juego limpiamente
    const switchMode = useCallback((mode: 'mission' | 'practice') => {
        setGameMode(mode);
        stateRef.current.gameMode = mode;
        if (mode === 'practice') {
            stateRef.current.distanceToThief = 25;
            setDistanceToThief(25);
            setGameState('playing');
        }
    }, []);

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

    useEffect(() => {
        stateRef.current.dummyActive = dummyActive;
    }, [dummyActive]);

    useEffect(() => {
        stateRef.current.gameState = gameState;
    }, [gameState]);

    useEffect(() => {
        stateRef.current.lives = lives;
    }, [lives]);

    // Sintetizador Web Audio para efectos de sonido
    const playAudioEffect = useCallback((type: 'punch' | 'hit' | 'jump' | 'whoosh' | 'death') => {
        try {
            const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const now = ctx.currentTime;

            if (type === 'punch' || type === 'hit') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(170, now);
                osc.frequency.exponentialRampToValueAtTime(35, now + 0.12);
                gain.gain.setValueAtTime(0.35, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.12);
            } else if (type === 'jump') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(320, now + 0.15);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.15);
            } else if (type === 'whoosh') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(260, now);
                osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.08);
            } else if (type === 'death') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.45);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.45);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.45);
            }
        } catch {
            // Silencioso ante bloqueo de audio
        }
    }, []);

    // Disparador de Ataque
    const triggerAttack = useCallback(() => {
        const st = stateRef.current;
        if (st.player.isAttacking || st.player.isDead) return;

        st.player.isAttacking = true;
        st.player.attackTimer = 0;
        setActiveActionName('atacar');
        playAudioEffect('whoosh');

        // Chequear impacto si el ladrón o muñeco está activo y en rango
        const isNear = Math.abs(st.thief.x - (st.player.x + (st.player.facingRight ? 45 : -45))) < 90;
        const isFacing = (st.player.facingRight && st.thief.x >= st.player.x) ||
                         (!st.player.facingRight && st.thief.x <= st.player.x);

        if (st.dummyActive && isNear && isFacing) {
            setTimeout(() => {
                st.thief.recoilX = st.player.facingRight ? 20 : -20;
                st.thief.hitFlash = 12;
                st.player.combo += 1;
                setHitCount((prev) => prev + 1);
                playAudioEffect('hit');

                const hitPhrases = ['¡POW!', '¡TOMA!', '¡ZAS!', '¡PUM!', '¡CON FUERZA!'];
                const text = hitPhrases[Math.floor(Math.random() * hitPhrases.length)];

                st.floatingTexts.push({
                    text,
                    x: st.thief.x + (Math.random() * 20 - 10),
                    y: st.player.groundY - 30,
                    opacity: 1.0,
                    vy: -1.6,
                    color: '#facc15'
                });

                for (let i = 0; i < 9; i++) {
                    const ang = Math.random() * Math.PI * 2;
                    const spd = 2 + Math.random() * 4;
                    st.particles.push({
                        x: st.thief.x + 20,
                        y: st.player.groundY + 30,
                        vx: Math.cos(ang) * spd,
                        vy: Math.sin(ang) * spd,
                        life: 1.0,
                        color: ['#facc15', '#f97316', '#ef4444', '#ffffff'][Math.floor(Math.random() * 4)]
                    });
                }
            }, 120);
        }
    }, [playAudioEffect]);

    // Disparador de Daño
    const triggerDamage = useCallback(() => {
        const st = stateRef.current;
        if (st.player.isDead) return;
        st.player.isDamaged = true;
        st.player.damageTimer = 0;
        setActiveActionName('daño');
        playAudioEffect('punch');

        st.floatingTexts.push({
            text: '¡AUCH!',
            x: st.player.x + 10,
            y: st.player.groundY - 20,
            opacity: 1.0,
            vy: -1.5,
            color: '#ef4444'
        });
    }, [playAudioEffect]);

    // Disparador de Muerte
    const triggerDeath = useCallback(() => {
        const st = stateRef.current;
        st.player.isDead = true;
        st.player.deathTimer = 0;
        st.player.isAttacking = false;
        st.player.isDamaged = false;
        setIsPlayerDead(true);
        setActiveActionName('muerte');
        playAudioEffect('death');

        st.floatingTexts.push({
            text: '¡DERROTADO!',
            x: st.player.x,
            y: st.player.groundY - 35,
            opacity: 1.0,
            vy: -1.2,
            color: '#f87171'
        });
    }, [playAudioEffect]);

    // Revivir o ponerse de pie
    const revivePlayer = useCallback(() => {
        const st = stateRef.current;
        st.player.isDead = false;
        st.player.deathTimer = 0;
        setIsPlayerDead(false);
        setActiveActionName('idle');
    }, []);

    // Resetear posición
    const resetPosition = useCallback(() => {
        const st = stateRef.current;
        st.player.x = 180;
        st.player.vx = 0;
        st.player.vy = 0;
        st.worldScrollX = 0;
        st.thief.x = 480;
        st.distanceToThief = 25;
        st.totalDistance = 0;
        st.player.isAttacking = false;
        st.player.isDamaged = false;
        st.player.isDead = false;
        setIsPlayerDead(false);
        setDistanceToThief(25);
        setTotalDistance(0);
    }, []);

    const handleQteFail = useCallback(() => {
        setLives((prev) => {
            const next = prev - 1;
            if (next <= 0) {
                triggerDeath();
                setTimeout(() => {
                    setGameState('gameover');
                }, 1000);
            } else {
                setQteMessage('¡El choro te golpeó y escapó más adelante!');
                setTimeout(() => {
                    stateRef.current.distanceToThief = 45;
                    setDistanceToThief(45);
                    setGameState('playing');
                }, 1200);
            }
            return next;
        });
    }, [triggerDeath]);

    const handleQteSuccess = useCallback(() => {
        setGameState('win');
    }, []);

    const startQte = useCallback(() => {
        setQteIndex(0);
        setQteTimeLeft(3.5);
        setQteMessage('¡Presiona la secuencia antes de que te ataque!');
        setGameState('qte');
    }, []);

    const startQteRef = useRef(startQte);
    useEffect(() => {
        startQteRef.current = startQte;
    }, [startQte]);

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

    // Escuchador de teclado global
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (stateRef.current.player.isDead) {
                if (['Space', 'KeyW', 'KeyA', 'KeyD', 'KeyJ', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    revivePlayer();
                }
                return;
            }

            // Manejo de QTE si está en combate
            if (stateRef.current.gameState === 'qte') {
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

            // Movimiento
            if (e.code === 'ArrowRight' || e.code === 'KeyD') stateRef.current.keys.right = true;
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') stateRef.current.keys.left = true;
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') stateRef.current.keys.sprint = true;

            // Salto
            if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
                if (!stateRef.current.keys.jump && stateRef.current.player.isGrounded) {
                    stateRef.current.player.vy = stateRef.current.player.jumpStrength;
                    stateRef.current.player.isGrounded = false;
                    playAudioEffect('jump');
                }
                stateRef.current.keys.jump = true;
            }

            // Ataque (J, Z, F, K)
            if (['KeyJ', 'KeyZ', 'KeyF', 'KeyK'].includes(e.code)) {
                e.preventDefault();
                triggerAttack();
            }

            // Daño (H)
            if (e.code === 'KeyH') {
                triggerDamage();
            }

            // Muerte (M)
            if (e.code === 'KeyM') {
                triggerDeath();
            }

            // Reset posición (R)
            if (e.code === 'KeyR') {
                resetPosition();
            }

            // Música BGM (B)
            if (e.code === 'KeyB') {
                toggleMusic();
            }
        };

        const onKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'ArrowRight' || e.code === 'KeyD') stateRef.current.keys.right = false;
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') stateRef.current.keys.left = false;
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') stateRef.current.keys.sprint = false;
            if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') stateRef.current.keys.jump = false;
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, [qteIndex, qteKeys, triggerAttack, triggerDamage, triggerDeath, revivePlayer, resetPosition, toggleMusic, playAudioEffect, handleQteFail, handleQteSuccess]);

    // Motor de Renderizado Canvas 2D
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        const V_WIDTH = 960;
        const V_HEIGHT = 540;

        const assets = {
            sky: new Image(),
            foreground: new Image(),
            character: new Image(),
            run: new Image(),
            walk: new Image(),
            idle: new Image(),
            jump: new Image(),
            attack: new Image(),
            damage: new Image(),
            death: new Image()
        };

        // Cache de frames individuales extraídos para cada acción (garantiza renderizar recortes y anchos editados al 100%)
        const actionFrameImages: Record<string, HTMLImageElement[]> = {
            correr: [],
            caminar: [],
            idle: [],
            saltar: [],
            atacar: [],
            daño: [],
            muerte: []
        };

        const activeChar = process.env.NEXT_PUBLIC_DEFAULT_CHARACTER || 'ruben';

        assets.sky.src = '/fondo-cielo.png';
        assets.foreground.src = '/primer-plano.png';
        assets.character.src = `/sprites/${activeChar}/character.png`;

        const setSrcWithFallback = (img: HTMLImageElement, primary: string, fallback: string) => {
            img.onerror = () => {
                if (!img.src.endsWith(fallback)) {
                    img.src = fallback;
                }
            };
            img.src = primary;
        };

        setSrcWithFallback(assets.run, `/sprites/${activeChar}/correr/correr.png`, `/sprites/${activeChar}/correr.png`);
        setSrcWithFallback(assets.walk, `/sprites/${activeChar}/caminar/caminar.png`, `/sprites/${activeChar}/caminar.png`);
        setSrcWithFallback(assets.idle, `/sprites/${activeChar}/idle/idle.png`, `/sprites/${activeChar}/idle.png`);
        setSrcWithFallback(assets.jump, `/sprites/${activeChar}/saltar/saltar.png`, `/sprites/${activeChar}/saltar.png`);
        setSrcWithFallback(assets.attack, `/sprites/${activeChar}/atacar/atacar.png`, `/sprites/${activeChar}/atacar.png`);
        setSrcWithFallback(assets.damage, `/sprites/${activeChar}/daño/daño.png`, `/sprites/${activeChar}/daño.png`);
        setSrcWithFallback(assets.death, `/sprites/${activeChar}/muerte/muerte.png`, `/sprites/${activeChar}/muerte.png`);

        // Cargar los 5 frames individuales exactos de cada acción para renderizado de máxima fidelidad
        const actionNames = ['correr', 'caminar', 'idle', 'saltar', 'atacar', 'daño', 'muerte'];
        actionNames.forEach((act) => {
            for (let f = 1; f <= 5; f++) {
                const fImg = new Image();
                fImg.src = `/sprites/${activeChar}/${act}/frames/frame_${f}.png`;
                actionFrameImages[act].push(fImg);
            }
        });

        // Intentar leer metadata.json para asegurar número de frames y rutas si existieran variaciones
        fetch(`/sprites/${activeChar}/metadata.json`)
            .then((r) => r.json())
            .then((meta) => {
                if (meta && meta.actions) {
                    for (const [aName, aConf] of Object.entries(meta.actions)) {
                        const conf = aConf as { frames?: string[] };
                        if (conf.frames && conf.frames.length > 0 && actionFrameImages[aName]) {
                            actionFrameImages[aName] = conf.frames.map((src) => {
                                const im = new Image();
                                im.src = src;
                                return im;
                            });
                        }
                    }
                }
            })
            .catch(() => {
                // Silencioso si no se encuentra metadata.json
            });

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            ctx.imageSmoothingEnabled = false;
        };
        window.addEventListener('resize', resize);
        resize();

        let animId: number;
        let lastTime = performance.now();

        const drawParallax = (img: HTMLImageElement, scrollX: number, speed: number) => {
            if (!img.complete || img.naturalWidth === 0) return;
            const scale = V_HEIGHT / img.naturalHeight;
            const drawW = img.naturalWidth * scale;
            const offset = (scrollX * speed) % drawW;
            let startX = -offset;
            while (startX < V_WIDTH) {
                ctx.drawImage(img, startX, 0, drawW, V_HEIGHT);
                startX += drawW;
            }
        };

        const loop = (timestamp: number) => {
            const st = stateRef.current;
            // Normalización por Delta Time a 60 FPS y escalado por velocidad del juego:
            // timeScale vale 1.0 a 60 FPS normales, 0.5 a 120 FPS (Mac ProMotion), modulado por st.gameSpeed.
            const dt = Math.min(0.05, Math.max(0.001, (timestamp - lastTime) / 1000));
            lastTime = timestamp;
            const timeScale = dt * 60 * st.gameSpeed;

            if (st.gameState === 'playing') {
                const isSprint = st.keys.sprint;
                st.player.isSprinting = isSprint;
                const currentMoveSpeed = isSprint ? st.player.speedRun : st.player.speedWalk;

                // Movimiento (bloqueado si está muerto)
                if (!st.player.isDead) {
                    if (st.keys.right) {
                        st.player.vx = currentMoveSpeed;
                        st.player.facingRight = true;
                        st.player.isMoving = true;
                    } else if (st.keys.left) {
                        st.player.vx = -currentMoveSpeed;
                        st.player.facingRight = false;
                        st.player.isMoving = true;
                    } else {
                        st.player.vx = 0;
                        st.player.isMoving = false;
                    }
                } else {
                    st.player.vx = 0;
                    st.player.isMoving = false;
                }

                // Scroll del mundo escalado por tiempo real
                const screenCenter = V_WIDTH * 0.42;
                if (st.player.vx > 0) {
                    if (st.player.x < screenCenter) {
                        st.player.x += st.player.vx * timeScale;
                    } else {
                        st.worldScrollX += st.player.vx * timeScale;
                        st.totalDistance += (st.player.vx * 0.08) * timeScale;
                    }
                } else if (st.player.vx < 0) {
                    if (st.player.x > 80) {
                        st.player.x += st.player.vx * timeScale;
                    } else if (st.worldScrollX > 0) {
                        st.worldScrollX += st.player.vx * timeScale;
                        st.totalDistance = Math.max(0, st.totalDistance + (st.player.vx * 0.08) * timeScale);
                    }
                }

                // Físicas del salto y gravedad normalizadas
                st.player.vy += st.player.gravity * timeScale;
                st.player.y += st.player.vy * timeScale;
                st.player.groundY = V_HEIGHT - st.player.height - 35;

                if (st.player.y >= st.player.groundY) {
                    st.player.y = st.player.groundY;
                    st.player.vy = 0;
                    st.player.isGrounded = true;
                }

                // Temporizador de Ataque
                if (st.player.isAttacking) {
                    st.player.attackTimer += 1 * timeScale;
                    if (st.player.attackTimer >= st.player.attackDuration) {
                        st.player.isAttacking = false;
                        st.player.attackTimer = 0;
                    }
                }

                // Temporizador de Daño
                if (st.player.isDamaged) {
                    st.player.damageTimer += 1 * timeScale;
                    if (st.player.damageTimer >= st.player.damageDuration) {
                        st.player.isDamaged = false;
                        st.player.damageTimer = 0;
                    }
                }

                // Temporizador de Muerte
                if (st.player.isDead) {
                    if (st.player.deathTimer < st.player.deathDuration) {
                        st.player.deathTimer += 1 * timeScale;
                    }
                }

                // Rebote suave al caminar/correr (sin sacudidas veloces ni efecto temblor)
                if (st.player.isMoving && st.player.isGrounded && !st.player.isDead) {
                    st.player.runCycle += (isSprint ? 0.11 : 0.07) * timeScale;
                    st.player.bobbing = Math.sin(st.player.runCycle) * (isSprint ? 1.5 : 0.9);
                } else {
                    st.player.runCycle += 0.02 * timeScale;
                    st.player.bobbing = Math.sin(st.player.runCycle) * 0.5;
                }

                // Ladrón / Muñeco de prueba
                st.thief.runCycle += 0.08 * timeScale;
                st.thief.bobbing = Math.sin(st.thief.runCycle) * 1.8;

                if (st.gameMode === 'mission') {
                    const relativeSpeed = st.player.vx - st.thief.speed;
                    st.distanceToThief -= (relativeSpeed * 0.020) * timeScale;

                    if (Math.random() < 0.08) {
                        setDistanceToThief(Math.max(1, Math.round(st.distanceToThief)));
                        setTotalDistance(Math.floor(st.totalDistance));
                    }

                    if (st.distanceToThief >= 100) {
                        setGameState('gameover');
                    } else if (st.distanceToThief <= 4) {
                        startQteRef.current();
                    }
                } else {
                    st.thief.x = Math.max(140, Math.min(V_WIDTH - 140, st.player.x + 130 + st.thief.recoilX));
                }

                if (st.thief.recoilX !== 0) {
                    st.thief.recoilX *= Math.pow(0.82, timeScale);
                    if (Math.abs(st.thief.recoilX) < 0.5) st.thief.recoilX = 0;
                }
                if (st.thief.hitFlash > 0) {
                    st.thief.hitFlash -= 1 * timeScale;
                }
            }

            // ==========================================
            // RENDERIZADO CANVAS
            // ==========================================
            ctx.fillStyle = '#0e0f14';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const scaleX = canvas.width / V_WIDTH;
            const scaleY = canvas.height / V_HEIGHT;
            const gameScale = Math.min(scaleX, scaleY);
            const offX = (canvas.width - V_WIDTH * gameScale) / 2;
            const offY = (canvas.height - V_HEIGHT * gameScale) / 2;

            ctx.save();
            ctx.translate(offX, offY);
            ctx.scale(gameScale, gameScale);
            ctx.beginPath();
            ctx.rect(0, 0, V_WIDTH, V_HEIGHT);
            ctx.clip();

            // 1. Cielo (Parallax 0.22x)
            drawParallax(assets.sky, st.worldScrollX, 0.22);

            // 2. Casas y pista (Parallax 1.0x)
            drawParallax(assets.foreground, st.worldScrollX, 1.0);

            // 3. Renderizar Ladrón o Muñeco de Sparring
            if (st.dummyActive || st.gameMode === 'mission') {
                const thiefScreenX = st.gameMode === 'mission'
                    ? Math.min(V_WIDTH - 120, Math.max(st.player.x + 60, st.player.x + st.distanceToThief * 9))
                    : st.thief.x;

                const thiefY = V_HEIGHT - 140 + st.thief.bobbing;

                // Sombra del choro pegada a sus pies
                const thiefFeetLevel = V_HEIGHT - 48;
                ctx.save();
                ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
                ctx.beginPath();
                ctx.ellipse(thiefScreenX + 42, thiefFeetLevel, 30, 5.5, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.translate(thiefScreenX, thiefY);

                const isFlash = st.thief.hitFlash > 0;
                ctx.fillStyle = isFlash ? '#ffffff' : (st.gameMode === 'practice' ? '#27272a' : '#1c1917');
                ctx.fillRect(15, 20, 50, 60);

                ctx.fillStyle = isFlash ? '#f87171' : (st.gameMode === 'practice' ? '#3f3f46' : '#0c0a09');
                ctx.fillRect(20, 0, 40, 30);

                ctx.fillStyle = '#38bdf8';
                ctx.fillRect(40, 10, 16, 6);

                if (st.gameMode === 'mission') {
                    ctx.fillStyle = '#e2e8f0';
                    ctx.fillRect(65, 30, 10, 16);
                    ctx.fillStyle = '#38bdf8';
                    ctx.fillRect(66, 32, 8, 12);
                } else {
                    ctx.fillStyle = '#ef4444';
                    ctx.fillRect(62, 32, 14, 14);
                }

                ctx.fillStyle = '#1e293b';
                ctx.fillRect(20, 75, 14, 25);
                ctx.fillRect(45, 75, 14, 25);

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(16, 96, 20, 8);
                ctx.fillRect(45, 96, 20, 8);

                if (st.gameMode === 'mission') {
                    ctx.fillStyle = '#e62329';
                    ctx.fillRect(10, -24, 60, 16);
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 9px monospace';
                    ctx.fillText('¡CHORO!', 18, -13);
                } else {
                    ctx.fillStyle = '#059669';
                    ctx.fillRect(0, -24, 85, 16);
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 8px monospace';
                    ctx.fillText('🎯 SPARRING DUMMY', 4, -13);
                }

                ctx.restore();
            }

            // 4. Determinar Sprite y Frame Activo del Protagonista (Cadencia natural de FPS)
            let activeSpriteImg = assets.character;
            let currentActionKey = 'idle';
            const totalFrames = 5;
            let animFps = 4.0;
            let currentFrameIndex = 0;
            let currentActionLabel = 'IDLE';

            if (st.player.isDead && assets.death.complete && assets.death.naturalWidth > 0) {
                activeSpriteImg = assets.death;
                currentActionKey = 'muerte';
                animFps = 4.5;
                currentFrameIndex = Math.min(totalFrames - 1, Math.floor((st.player.deathTimer / st.player.deathDuration) * totalFrames));
                currentActionLabel = 'MUERTE';
            } else if (st.player.isDamaged && assets.damage.complete && assets.damage.naturalWidth > 0) {
                activeSpriteImg = assets.damage;
                currentActionKey = 'daño';
                animFps = 6.0;
                currentFrameIndex = Math.min(totalFrames - 1, Math.floor((st.player.damageTimer / st.player.damageDuration) * totalFrames));
                currentActionLabel = 'DAÑO';
            } else if (st.player.isAttacking && assets.attack.complete && assets.attack.naturalWidth > 0) {
                activeSpriteImg = assets.attack;
                currentActionKey = 'atacar';
                animFps = 7.5;
                currentFrameIndex = Math.min(totalFrames - 1, Math.floor((st.player.attackTimer / st.player.attackDuration) * totalFrames));
                currentActionLabel = 'ATACAR';
            } else if (!st.player.isGrounded && assets.jump.complete && assets.jump.naturalWidth > 0) {
                activeSpriteImg = assets.jump;
                currentActionKey = 'saltar';
                animFps = 5.0;
                currentActionLabel = 'SALTAR';
                if (st.player.currentAction !== 'saltar') {
                    st.player.currentAction = 'saltar';
                    st.player.animTimer = 0;
                } else {
                    st.player.animTimer += (dt * animFps) * st.gameSpeed;
                }
                currentFrameIndex = Math.min(totalFrames - 1, Math.floor(st.player.animTimer));
            } else if (st.player.isMoving) {
                if (st.player.isSprinting && assets.run.complete && assets.run.naturalWidth > 0) {
                    activeSpriteImg = assets.run;
                    currentActionKey = 'correr';
                    animFps = 7.0;
                    currentActionLabel = 'CORRER';
                } else if (assets.walk.complete && assets.walk.naturalWidth > 0) {
                    activeSpriteImg = assets.walk;
                    currentActionKey = 'caminar';
                    animFps = 5.0;
                    currentActionLabel = 'CAMINAR';
                } else {
                    activeSpriteImg = assets.run;
                    currentActionKey = 'correr';
                    animFps = 7.0;
                    currentActionLabel = 'CORRER';
                }
                if (st.player.currentAction !== currentActionKey) {
                    st.player.currentAction = currentActionKey;
                    st.player.animTimer = 0;
                } else {
                    st.player.animTimer += (dt * animFps) * st.gameSpeed;
                    if (st.player.animTimer >= totalFrames) {
                        st.player.animTimer %= totalFrames;
                    }
                }
                currentFrameIndex = Math.floor(st.player.animTimer) % totalFrames;
            } else if (assets.idle.complete && assets.idle.naturalWidth > 0) {
                activeSpriteImg = assets.idle;
                currentActionKey = 'idle';
                animFps = 4.0;
                currentActionLabel = 'IDLE';
                if (st.player.currentAction !== 'idle') {
                    st.player.currentAction = 'idle';
                    st.player.animTimer = 0;
                } else {
                    st.player.animTimer += (dt * animFps) * st.gameSpeed;
                    if (st.player.animTimer >= totalFrames) {
                        st.player.animTimer %= totalFrames;
                    }
                }
                currentFrameIndex = Math.floor(st.player.animTimer) % totalFrames;
            }

            if (currentActionLabel !== activeActionNameRef.current) {
                activeActionNameRef.current = currentActionLabel;
                setActiveActionName(currentActionLabel);
            }

            // 5. Renderizar Protagonista usando preferentemente los frames individuales editados
            const charX = st.player.x;
            const charY = st.player.y + st.player.bobbing;
            const drawH = st.player.height;

            const specificFrameImg = actionFrameImages[currentActionKey]?.[currentFrameIndex];
            const hasIndividualFrame = specificFrameImg && specificFrameImg.complete && specificFrameImg.naturalWidth > 0;

            let drawW = Math.round(drawH * 0.6);

            if (hasIndividualFrame) {
                const sw = specificFrameImg.naturalWidth;
                const sh = specificFrameImg.naturalHeight;
                drawW = Math.round(drawH * (sw / sh));
            } else if (activeSpriteImg.complete && activeSpriteImg.naturalWidth > 0) {
                const sw = activeSpriteImg.naturalWidth / totalFrames;
                const sh = activeSpriteImg.naturalHeight;
                drawW = Math.round(drawH * (sw / sh));
            }

            // ==========================================
            // SOMBRA ANCLADA AL SUELO EXACTO DE LOS PIES
            // ==========================================
            const groundLevel = st.player.groundY + drawH * 0.90;
            const currentFeetY = charY + drawH * 0.90;
            const jumpDist = Math.max(0, groundLevel - currentFeetY);
            const shadowScale = Math.max(0.35, 1 - jumpDist / 190);
            const shadowAlpha = Math.max(0.12, 0.45 * shadowScale);

            ctx.save();
            ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
            ctx.beginPath();
            ctx.ellipse(
                charX + drawW / 2,
                groundLevel,
                (drawW / 2) * 0.85 * shadowScale,
                5.5 * shadowScale,
                0,
                0,
                Math.PI * 2
            );
            ctx.fill();
            ctx.restore();

            // Dibujar el personaje
            if (hasIndividualFrame) {
                ctx.save();
                if (!st.player.facingRight) {
                    ctx.translate(charX + drawW, charY);
                    ctx.scale(-1, 1);
                    ctx.drawImage(specificFrameImg, 0, 0, specificFrameImg.naturalWidth, specificFrameImg.naturalHeight, 0, 0, drawW, drawH);
                } else {
                    ctx.drawImage(specificFrameImg, 0, 0, specificFrameImg.naturalWidth, specificFrameImg.naturalHeight, charX, charY, drawW, drawH);
                }
                ctx.restore();
            } else if (activeSpriteImg.complete && activeSpriteImg.naturalWidth > 0) {
                const isSheet = activeSpriteImg.naturalWidth > activeSpriteImg.naturalHeight * 1.5;
                const frameW = isSheet ? activeSpriteImg.naturalWidth / totalFrames : activeSpriteImg.naturalWidth;
                const frameH = activeSpriteImg.naturalHeight;
                const sx = isSheet ? currentFrameIndex * frameW : 0;

                ctx.save();
                if (!st.player.facingRight) {
                    ctx.translate(charX + drawW, charY);
                    ctx.scale(-1, 1);
                    ctx.drawImage(activeSpriteImg, sx, 0, frameW, frameH, 0, 0, drawW, drawH);
                } else {
                    ctx.drawImage(activeSpriteImg, sx, 0, frameW, frameH, charX, charY, drawW, drawH);
                }
                ctx.restore();
            }

            // 6. Chispas y Partículas escaladas por timeScale
            st.particles.forEach((p) => {
                p.x += p.vx * timeScale;
                p.y += p.vy * timeScale;
                p.life -= 0.025 * timeScale;
                ctx.save();
                ctx.fillStyle = p.color;
                ctx.globalAlpha = Math.max(0, p.life);
                ctx.fillRect(p.x, p.y, 4, 4);
                ctx.restore();
            });
            st.particles = st.particles.filter((p) => p.life > 0);

            // 7. Textos Flotantes de Golpes escalados por timeScale
            st.floatingTexts.forEach((ft) => {
                ft.y += ft.vy * timeScale;
                ft.opacity -= 0.015 * timeScale;
                ctx.save();
                ctx.globalAlpha = Math.max(0, ft.opacity);
                ctx.font = '900 15px monospace';
                ctx.fillStyle = ft.color;
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 3;
                ctx.strokeText(ft.text, ft.x, ft.y);
                ctx.fillText(ft.text, ft.x, ft.y);
                ctx.restore();
            });
            st.floatingTexts = st.floatingTexts.filter((ft) => ft.opacity > 0);

            ctx.restore();
            animId = requestAnimationFrame(loop);
        };

        animId = requestAnimationFrame(loop);

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animId);
        };
    }, []);

    const resetGame = () => {
        stateRef.current.distanceToThief = 35;
        stateRef.current.totalDistance = 0;
        stateRef.current.lives = 3;
        stateRef.current.player.x = 180;
        stateRef.current.player.isDead = false;
        setIsPlayerDead(false);
        setDistanceToThief(35);
        setTotalDistance(0);
        setLives(3);
        setGameState('playing');
    };

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-black font-mono select-none">
            {/* Canvas Principal */}
            <canvas
                ref={canvasRef}
                onClick={triggerAttack}
                className="w-full h-full block cursor-crosshair"
                title="Haz clic para atacar"
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
                                    onClick={() => changeGameSpeed(spd)}
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
                                onClick={resetPosition}
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
                        onClick={() => {
                            if (stateRef.current.player.isDead) revivePlayer();
                            stateRef.current.keys.right = true;
                            stateRef.current.keys.sprint = false;
                            setTimeout(() => {
                                stateRef.current.keys.right = false;
                            }, 600);
                        }}
                        className="bg-[#171923] hover:bg-[#222533] border border-gray-700 text-gray-200 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                        title="Presiona A o D para caminar"
                    >
                        <Footprints size={14} className="text-cyan-400" />
                        <span>Caminar (A/D)</span>
                    </button>

                    {/* Botón Correr */}
                    <button
                        onClick={() => {
                            if (stateRef.current.player.isDead) revivePlayer();
                            stateRef.current.keys.right = true;
                            stateRef.current.keys.sprint = true;
                            setTimeout(() => {
                                stateRef.current.keys.right = false;
                                stateRef.current.keys.sprint = false;
                            }, 600);
                        }}
                        className="bg-[#171923] hover:bg-[#222533] border border-gray-700 text-gray-200 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                        title="Mantén Shift mientras caminas para correr"
                    >
                        <Zap size={14} className="text-yellow-400" />
                        <span>Correr (Shift)</span>
                    </button>

                    {/* Botón Saltar */}
                    <button
                        onClick={() => {
                            if (stateRef.current.player.isDead) revivePlayer();
                            if (stateRef.current.player.isGrounded) {
                                stateRef.current.player.vy = stateRef.current.player.jumpStrength;
                                stateRef.current.player.isGrounded = false;
                                playAudioEffect('jump');
                            }
                        }}
                        className="bg-[#171923] hover:bg-[#222533] border border-gray-700 text-gray-200 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                        title="Presiona Espacio o W para saltar"
                    >
                        <ArrowUp size={14} className="text-purple-400" />
                        <span>Saltar (Espacio)</span>
                    </button>

                    {/* Botón Atacar */}
                    <button
                        onClick={triggerAttack}
                        className="bg-red-950/80 hover:bg-red-900 border-2 border-red-500/70 text-red-200 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-red-950/50 cursor-pointer"
                        title="Presiona J, Z, F o haz clic en pantalla para golpear"
                    >
                        <Swords size={14} className="text-red-400" />
                        <span>¡Atacar! (J / Click)</span>
                    </button>

                    {/* Botón Daño */}
                    <button
                        onClick={triggerDamage}
                        className="bg-[#1a141b] hover:bg-[#2a1d2d] border border-pink-700/60 text-pink-300 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                        title="Presiona H para probar animación de recibir daño"
                    >
                        <ShieldAlert size={14} className="text-pink-400" />
                        <span>Probar Daño (H)</span>
                    </button>

                    {/* Botón Muerte */}
                    <button
                        onClick={isPlayerDead ? revivePlayer : triggerDeath}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                            isPlayerDead
                                ? 'bg-amber-950/80 border border-amber-500 text-amber-300'
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
                        title="Mostrar u ocultar muñeco de pruebas"
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
                                    className={`w-14 h-14 rounded-lg flex items-center justify-center text-2xl font-bold border-2 transition-all ${
                                        i < qteIndex
                                            ? 'bg-green-600 border-green-400 text-white scale-95'
                                            : i === qteIndex
                                            ? 'bg-[#e62329] border-yellow-300 text-white scale-110 shadow-lg shadow-red-500/50 animate-bounce'
                                            : 'bg-gray-800 border-gray-600 text-gray-400'
                                    }`}
                                >
                                    {key === 'ArrowUp' ? '⬆' : key === 'ArrowDown' ? '⬇' : key === 'ArrowRight' ? '➡' : '👊'}
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
                        <div className="text-red-500 font-black text-4xl mb-2">GAME OVER</div>
                        <h3 className="text-xl font-bold text-white mb-4">¡TE FALTÓ CALLE, CAUSA!</h3>
                        <p className="text-xs text-gray-400 mb-6">
                            {distanceToThief >= 100
                                ? 'El choro te sacó más de 100 metros de ventaja y se perdió por las galerías.'
                                : 'Te quedaste sin vidas en el intento de forcejeo.'}
                        </p>
                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={resetGame}
                                className="bg-[#e62329] hover:bg-red-700 text-white font-black text-xs px-6 py-3 rounded uppercase cursor-pointer"
                            >
                                Intentar de Nuevo
                            </button>
                            <button
                                onClick={() => {
                                    switchMode('practice');
                                    resetPosition();
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
                                Menú
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Pantalla Victoria */}
            {gameState === 'win' && (
                <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-6 text-center">
                    <div className="bg-[#051f0f] border-2 border-green-500 p-8 rounded-xl max-w-md w-full shadow-2xl">
                        <div className="text-green-400 font-black text-3xl mb-2">¡LO LOGRASTE!</div>
                        <h3 className="text-lg font-bold text-white mb-4">¡RECUPERASTE TU CELU, CAUSA!</h3>
                        <p className="text-xs text-gray-300 mb-6">
                            Tacleada perfecta sobre la Vía Expresa. El choro soltó el móvil y se fue corriendo.
                        </p>
                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={resetGame}
                                className="bg-green-600 hover:bg-green-500 text-white font-black text-xs px-6 py-3 rounded uppercase cursor-pointer"
                            >
                                Jugar Otra Vez
                            </button>
                            <button
                                onClick={() => {
                                    switchMode('practice');
                                    resetPosition();
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
