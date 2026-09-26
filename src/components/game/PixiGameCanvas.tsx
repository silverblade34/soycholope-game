'use client';

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import {
    Application,
    Container,
    Sprite,
    Texture,
    Assets,
    Graphics,
    Text,
    TextStyle,
    TilingSprite
} from 'pixi.js';
import { DEFAULT_ITEMS_CATALOG, type ItemDefinition } from '@/types/items';

export interface PixiGameCanvasRef {
    triggerAttack: () => void;
    triggerDamage: () => void;
    triggerDeath: () => void;
    revivePlayer: () => void;
    resetPosition: () => void;
    stepWalk: () => void;
    stepRun: () => void;
    jump: () => void;
    duck: () => void;
    triggerEat: () => void;
    triggerDrink: () => void;
    triggerFatigue: () => void;
    triggerHunger: () => void;
}

export interface SurvivalStats {
    vida: number;
    cansancio: number;
    hambre: number;
    isFatigued: boolean;
    isStarving: boolean;
    hasPoncho: boolean;
    ponchoTimeLeft: number;
    speedBuff: number;
    speedBuffTimeLeft: number;
    stunTimeLeft: number;
}

export interface PixiGameCanvasProps {
    gameMode: 'mission' | 'practice';
    gameSpeed: number; // 0.5, 0.75, 1.0
    dummyActive: boolean;
    activeChar?: string;
    thiefChar?: string;
    onActionChange?: (actionName: string) => void;
    onHit?: (hitCount: number) => void;
    onDistanceChange?: (dist: number, totalDist: number) => void;
    onGameOver?: (reason: 'dead' | 'escaped') => void;
    onCatchThief?: () => void;
    onPlayerDeadChange?: (isDead: boolean) => void;
    onStatsChange?: (stats: SurvivalStats) => void;
}

interface ActiveItem {
    id: string;
    itemDef: ItemDefinition;
    worldX: number;
    baseY: number;
    y: number;
    bobPhase: number;
    container: Container;
    sprite: Sprite;
    fxBack: Graphics;
    fxFront: Graphics;
    collected: boolean;
    hitPlayer: boolean;
}

interface ActiveProjectile {
    id: number;
    type: 'cuchillo_alto' | 'cuchillo_bajo' | 'platano';
    x: number;
    y: number;
    vx: number;
    rotation: number;
    container: Container;
    dodged: boolean;
    hitPlayer: boolean;
}

const V_WIDTH = 960;
const V_HEIGHT = 540;
const GROUND_Y = 482; // Nivel del pavimento/calle donde tocan las zapatillas

export const PixiGameCanvas = forwardRef<PixiGameCanvasRef, PixiGameCanvasProps>(function PixiGameCanvas(
    {
        gameMode,
        gameSpeed,
        dummyActive,
        activeChar = 'ruben',
        thiefChar = 'ladron',
        onActionChange,
        onHit,
        onDistanceChange,
        onGameOver,
        onCatchThief,
        onPlayerDeadChange,
        onStatsChange
    },
    ref
) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const appRef = useRef<Application | null>(null);

    // Audio context sintético para efectos de sonido
    const audioCtxRef = useRef<AudioContext | null>(null);
    const playSfx = (type: 'whoosh' | 'hit' | 'punch' | 'jump' | 'death') => {
        try {
            const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (!AudioCtx) return;
            if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
            const ctx = audioCtxRef.current;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            if (type === 'whoosh') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(380, now);
                osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.12);
            } else if (type === 'hit' || type === 'punch') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(180, now);
                osc.frequency.exponentialRampToValueAtTime(45, now + 0.15);
                gain.gain.setValueAtTime(0.18, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.15);
            } else if (type === 'jump') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(320, now + 0.15);
                gain.gain.setValueAtTime(0.06, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.15);
            } else if (type === 'death') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.exponentialRampToValueAtTime(50, now + 0.6);
                gain.gain.setValueAtTime(0.14, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.6);
            }
        } catch {
            // Ignorar bloqueo de audio
        }
    };

    // Referencias mutables para mantener el estado del juego sincronizado
    const stateRef = useRef({
        gameMode,
        gameSpeed,
        dummyActive,
        worldScrollX: 0,
        totalDistance: 0,
        distanceToThief: 35,
        hitCount: 0,
        nextItemSpawnDist: 12,
        thiefAttackTimer: 0,
        stats: {
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
        } as SurvivalStats,
        keys: {
            left: false,
            right: false,
            jump: false,
            sprint: false,
            duck: false
        },
        player: {
            x: 180,
            y: GROUND_Y,
            vx: 0,
            vy: 0,
            speedWalk: 1.8,
            speedRun: 3.1,
            jumpStrength: -9.8,
            gravity: 0.38,
            isGrounded: true,
            facingRight: true,
            isMoving: false,
            isSprinting: false,
            isDucking: false,
            duckTimer: 0,
            eatTimer: 0,
            drinkTimer: 0,
            isAttacking: false,
            attackTimer: 0,
            attackDuration: 36,
            isDamaged: false,
            damageTimer: 0,
            damageDuration: 30,
            isDead: false,
            deathTimer: 0,
            deathDuration: 60,
            currentAction: 'idle',
            animTimer: 0,
            bobbing: 0,
            runCycle: 0
        },
        thief: {
            x: 480,
            y: GROUND_Y,
            speed: 2.45,
            facingRight: false,
            recoilX: 0,
            hitFlash: 0,
            bobbing: 0,
            runCycle: 0,
            currentAction: 'correr',
            animTimer: 0
        },
        items: [] as ActiveItem[],
        projectiles: [] as ActiveProjectile[],
        particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: number }[],
        floatingTexts: [] as { text: string; x: number; y: number; opacity: number; vy: number; color: string }[]
    });

    // Actualizar propiedades mutables en tiempo real
    useEffect(() => {
        stateRef.current.gameMode = gameMode;
        stateRef.current.gameSpeed = gameSpeed;
        stateRef.current.dummyActive = dummyActive;
    }, [gameMode, gameSpeed, dummyActive]);

    const callbacksRef = useRef({
        onActionChange,
        onHit,
        onDistanceChange,
        onGameOver,
        onCatchThief,
        onPlayerDeadChange,
        onStatsChange
    });
    useEffect(() => {
        callbacksRef.current = {
            onActionChange,
            onHit,
            onDistanceChange,
            onGameOver,
            onCatchThief,
            onPlayerDeadChange,
            onStatsChange
        };
    });

    const triggerAttack = () => {
        const st = stateRef.current;
        if (st.player.isDead || st.player.isAttacking) return;
        st.player.isAttacking = true;
        st.player.attackTimer = 0;
        playSfx('punch');

        const thiefScreenX = st.gameMode === 'mission'
            ? st.player.x + st.distanceToThief * 9.5
            : st.thief.x;

        const distance = Math.abs(thiefScreenX - st.player.x);
        const inHitRange = distance < 65 && Math.abs(st.player.y - GROUND_Y) < 40;

        if (inHitRange) {
            st.thief.hitFlash = 12;
            st.thief.recoilX = 24;
            st.hitCount += 1;
            callbacksRef.current.onHit?.(st.hitCount);

            if (st.gameMode === 'mission') {
                st.distanceToThief = Math.max(1, st.distanceToThief - 2.5);
                callbacksRef.current.onDistanceChange?.(Math.round(st.distanceToThief), Math.floor(st.totalDistance));
            }

            for (let i = 0; i < 7; i++) {
                st.particles.push({
                    x: Math.min(V_WIDTH - 20, thiefScreenX),
                    y: GROUND_Y - 45,
                    vx: (Math.random() - 0.2) * 5,
                    vy: (Math.random() - 0.5) * 4,
                    life: 1.0,
                    color: 0xffd700
                });
            }

            st.floatingTexts.push({
                text: '¡TOMA PIRAÑA! 💥',
                x: Math.min(V_WIDTH - 60, thiefScreenX),
                y: GROUND_Y - 80,
                opacity: 1.0,
                vy: -1.2,
                color: '#ffdd00'
            });
        }
    };

    const triggerDamage = () => {
        const st = stateRef.current;
        if (st.player.isDead) return;
        st.player.isDamaged = true;
        st.player.damageTimer = 0;
        st.stats.vida = Math.max(0, st.stats.vida - 15);
        playSfx('hit');

        for (let i = 0; i < 5; i++) {
            st.particles.push({
                x: st.player.x,
                y: st.player.y - 45,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 0.9,
                color: 0xff3b30
            });
        }

        st.floatingTexts.push({
            text: '-15 HP 💔',
            x: st.player.x,
            y: st.player.y - 75,
            opacity: 1.0,
            vy: -1.0,
            color: '#ff3b30'
        });

        if (st.stats.vida <= 0) {
            actionsRef.current.triggerDeath();
        }
    };

    const triggerDeath = () => {
        const st = stateRef.current;
        if (st.player.isDead) return;
        st.player.isDead = true;
        st.player.deathTimer = 0;
        st.stats.vida = 0;
        callbacksRef.current.onPlayerDeadChange?.(true);
        playSfx('death');

        st.floatingTexts.push({
            text: '¡QUEDASTE TIESO! 💀',
            x: st.player.x,
            y: st.player.y - 75,
            opacity: 1.2,
            vy: -0.7,
            color: '#ef4444'
        });

        setTimeout(() => {
            callbacksRef.current.onGameOver?.('dead');
        }, 1200);
    };

    const revivePlayer = () => {
        const st = stateRef.current;
        st.player.isDead = false;
        st.player.deathTimer = 0;
        st.player.isDamaged = false;
        st.player.isAttacking = false;
        st.player.eatTimer = 0;
        st.player.drinkTimer = 0;
        st.player.currentAction = 'idle';
        st.stats.vida = 100;
        st.stats.cansancio = 0;
        st.stats.hambre = 100;
        st.stats.isFatigued = false;
        st.stats.isStarving = false;
        callbacksRef.current.onPlayerDeadChange?.(false);
    };

    const resetPosition = () => {
        const st = stateRef.current;
        st.player.x = 180;
        st.player.y = GROUND_Y;
        st.player.vx = 0;
        st.player.vy = 0;
        st.worldScrollX = 0;
        st.totalDistance = 0;
        st.distanceToThief = 35;
        st.nextItemSpawnDist = 12;
        st.thief.x = 480;
        st.thiefAttackTimer = 0;
        st.player.isAttacking = false;
        st.player.isDamaged = false;
        st.player.isDead = false;
        st.player.isDucking = false;
        st.player.eatTimer = 0;
        st.player.drinkTimer = 0;
        st.stats = {
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
        };
        callbacksRef.current.onPlayerDeadChange?.(false);
        callbacksRef.current.onDistanceChange?.(35, 0);
        callbacksRef.current.onStatsChange?.(st.stats);
    };

    const stepWalk = () => {
        const st = stateRef.current;
        if (st.player.isDead) revivePlayer();
        st.keys.right = true;
        st.keys.sprint = false;
        setTimeout(() => {
            st.keys.right = false;
        }, 600);
    };

    const stepRun = () => {
        const st = stateRef.current;
        if (st.player.isDead) revivePlayer();
        st.keys.right = true;
        st.keys.sprint = true;
        setTimeout(() => {
            st.keys.right = false;
            st.keys.sprint = false;
        }, 600);
    };

    const jump = () => {
        const st = stateRef.current;
        if (st.player.isDead) revivePlayer();
        if (st.stats.isFatigued) {
            st.floatingTexts.push({
                text: '¡FATIGADO! (Sin energía)',
                x: st.player.x,
                y: st.player.y - 70,
                opacity: 1,
                vy: -0.8,
                color: '#f59e0b'
            });
            return;
        }
        if (st.player.isGrounded) {
            st.player.vy = st.player.jumpStrength;
            st.player.isGrounded = false;
            st.stats.cansancio = Math.min(100, st.stats.cansancio + 6);
            playSfx('jump');
        }
    };

    const duck = () => {
        const st = stateRef.current;
        if (st.player.isDead) revivePlayer();
        if (st.player.isGrounded) {
            st.player.isDucking = true;
            st.player.duckTimer = 24;
        }
    };

    const triggerEat = () => {
        const st = stateRef.current;
        if (st.player.isDead) revivePlayer();
        st.player.eatTimer = 30;
        st.stats.hambre = Math.min(100, st.stats.hambre + 30);
        playSfx('whoosh');
        st.floatingTexts.push({
            text: '¡COMIENDO! 🥪✨',
            x: st.player.x,
            y: st.player.y - 70,
            opacity: 1,
            vy: -1.0,
            color: '#fbbf24'
        });
    };

    const triggerDrink = () => {
        const st = stateRef.current;
        if (st.player.isDead) revivePlayer();
        st.player.drinkTimer = 30;
        st.stats.cansancio = Math.max(0, st.stats.cansancio - 35);
        st.stats.isFatigued = false;
        playSfx('whoosh');
        st.floatingTexts.push({
            text: '¡BEBIENDO! 🍵✨',
            x: st.player.x,
            y: st.player.y - 70,
            opacity: 1,
            vy: -1.0,
            color: '#2dd4bf'
        });
    };

    const triggerFatigue = () => {
        const st = stateRef.current;
        if (st.player.isDead) revivePlayer();
        st.stats.cansancio = 100;
        st.stats.isFatigued = true;
        st.floatingTexts.push({
            text: '¡FATIGADO AL MÁXIMO! ⚠️',
            x: st.player.x,
            y: st.player.y - 70,
            opacity: 1,
            vy: -1.0,
            color: '#f59e0b'
        });
    };

    const triggerHunger = () => {
        const st = stateRef.current;
        if (st.player.isDead) revivePlayer();
        st.stats.hambre = 0;
        st.stats.isStarving = true;
        st.floatingTexts.push({
            text: '¡INANICIÓN TOTAL! 💀',
            x: st.player.x,
            y: st.player.y - 70,
            opacity: 1,
            vy: -1.0,
            color: '#ef4444'
        });
    };

    const actionsRef = useRef({
        triggerAttack,
        triggerDamage,
        triggerDeath,
        revivePlayer,
        resetPosition,
        stepWalk,
        stepRun,
        jump,
        duck,
        triggerEat,
        triggerDrink,
        triggerFatigue,
        triggerHunger
    });
    useEffect(() => {
        actionsRef.current = {
            triggerAttack,
            triggerDamage,
            triggerDeath,
            revivePlayer,
            resetPosition,
            stepWalk,
            stepRun,
            jump,
            duck,
            triggerEat,
            triggerDrink,
            triggerFatigue,
            triggerHunger
        };
    });

    useImperativeHandle(ref, () => ({
        triggerAttack,
        triggerDamage,
        triggerDeath,
        revivePlayer,
        resetPosition,
        stepWalk,
        stepRun,
        jump,
        duck,
        triggerEat,
        triggerDrink,
        triggerFatigue,
        triggerHunger
    }));

    // Teclado
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const st = stateRef.current;
            if (st.player.isDead) {
                if (['Space', 'KeyW', 'KeyA', 'KeyD', 'KeyJ', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    actionsRef.current.revivePlayer();
                }
                return;
            }

            if (e.code === 'ArrowRight' || e.code === 'KeyD') st.keys.right = true;
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') st.keys.left = true;
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') st.keys.sprint = true;
            if (e.code === 'KeyS' || e.code === 'ArrowDown') {
                st.keys.duck = true;
                if (st.player.isGrounded) st.player.isDucking = true;
            }

            if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
                if (!st.keys.jump && st.player.isGrounded) {
                    actionsRef.current.jump();
                }
                st.keys.jump = true;
            }

            if (['KeyJ', 'KeyZ', 'KeyF', 'KeyK'].includes(e.code)) {
                e.preventDefault();
                actionsRef.current.triggerAttack();
            }
            if (e.code === 'KeyH') actionsRef.current.triggerDamage();
            if (e.code === 'KeyM') actionsRef.current.triggerDeath();
            if (e.code === 'KeyR') actionsRef.current.resetPosition();
        };

        const onKeyUp = (e: KeyboardEvent) => {
            const st = stateRef.current;
            if (e.code === 'ArrowRight' || e.code === 'KeyD') st.keys.right = false;
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') st.keys.left = false;
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') st.keys.sprint = false;
            if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') st.keys.jump = false;
            if (e.code === 'KeyS' || e.code === 'ArrowDown') {
                st.keys.duck = false;
                st.player.isDucking = false;
            }
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, []);

    // Inicialización del motor PixiJS
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let isDestroyed = false;
        const app = new Application();
        (app as unknown as { _cancelResize: () => void })._cancelResize = () => {};
        appRef.current = app;

        const safeDestroy = (instance: Application) => {
            try {
                if (typeof (instance as unknown as { _cancelResize?: unknown })._cancelResize !== 'function') {
                    (instance as unknown as { _cancelResize: () => void })._cancelResize = () => {};
                }
                instance.destroy(true, { children: true });
            } catch {
                // Silencioso ante teardown asíncrono
            }
        };

        async function initPixi() {
            if (!container) return;

            try {
                await app.init({
                    background: '#0e0f14',
                    resizeTo: container,
                    antialias: false,
                    autoDensity: true,
                    resolution: Math.min(window.devicePixelRatio || 1, 2)
                });
            } catch {
                return;
            }

            if (isDestroyed) {
                safeDestroy(app);
                return;
            }

            container.appendChild(app.canvas);

            // Contenedor principal centrado con aspect ratio virtual (960x540)
            const world = new Container();
            app.stage.addChild(world);

            // Máscara estricta para recortar el mundo al viewport 960x540
            // Evita que el ladrón, proyectiles o efectos salgan sobre las barras negras laterales
            const worldMask = new Graphics().rect(0, 0, V_WIDTH, V_HEIGHT).fill({ color: 0xffffff });
            world.addChild(worldMask);
            world.mask = worldMask;

            // ==========================================
            // 1. CARGA DE TEXTURAS (PARALLAX & PERSONAJES & ITEMS)
            // ==========================================
            const [skyTex, streetTex] = await Promise.all([
                Assets.load('/fondo-cielo.png').catch(() => Texture.WHITE),
                Assets.load('/primer-plano.png').catch(() => Texture.WHITE)
            ]);

            // Cargar frames de Rubén (Protagonista) incluyendo nuevas acciones: cansancio, hambre, comer y beber
            const playerActions = [
                'idle',
                'caminar',
                'correr',
                'saltar',
                'atacar',
                'daño',
                'muerte',
                'cansancio',
                'hambre',
                'comer',
                'beber'
            ];
            const playerTextures: Record<string, Texture[]> = {};

            await Promise.all(
                playerActions.map(async (act) => {
                    playerTextures[act] = [];
                    for (let f = 1; f <= 5; f++) {
                        const url = `/sprites/${activeChar}/${act}/frames/frame_${f}.png`;
                        try {
                            const tex = await Assets.load(url);
                            playerTextures[act].push(tex);
                        } catch {
                            try {
                                const fallbackTex = await Assets.load(`/sprites/${activeChar}/${act}/${act}.png`);
                                playerTextures[act].push(fallbackTex);
                            } catch {
                                playerTextures[act].push(Texture.WHITE);
                            }
                        }
                    }
                })
            );

            // Cargar frames del Ladrón (Choro)
            const thiefActions = ['idle', 'correr', 'atacar'];
            const thiefTextures: Record<string, Texture[]> = {};

            await Promise.all(
                thiefActions.map(async (act) => {
                    thiefTextures[act] = [];
                    for (let f = 1; f <= 5; f++) {
                        const url = `/sprites/${thiefChar}/${act}/frames/frame_${f}.png`;
                        try {
                            const tex = await Assets.load(url);
                            thiefTextures[act].push(tex);
                        } catch {
                            try {
                                const fallbackTex = await Assets.load(`/sprites/${thiefChar}/${act}/${act}.png`);
                                thiefTextures[act].push(fallbackTex);
                            } catch {
                                thiefTextures[act].push(Texture.WHITE);
                            }
                        }
                    }
                })
            );

            // Pose default de ladron character.png
            let thiefCharTex: Texture;
            try {
                thiefCharTex = await Assets.load(`/sprites/${thiefChar}/character.png`);
            } catch {
                thiefCharTex = thiefTextures['idle']?.[0] || thiefTextures['correr']?.[0] || Texture.WHITE;
            }

            // Cargar catálogo de supervivencia limeña (obstáculos y potenciadores)
            let itemCatalog: ItemDefinition[] = DEFAULT_ITEMS_CATALOG;
            try {
                const res = await fetch('/api/items/catalog');
                if (res.ok) {
                    const data = await res.json();
                    const list = Array.isArray(data) ? data : (data.catalog || []);
                    if (list.length > 0) {
                        itemCatalog = list;
                    }
                }
            } catch {
                // usar DEFAULT_ITEMS_CATALOG
            }

            const itemTextures: Record<string, Texture> = {};
            await Promise.all(
                itemCatalog.map(async (item) => {
                    if (item.imageUrl) {
                        try {
                            const tex = await Assets.load(item.imageUrl);
                            itemTextures[item.id] = tex;
                        } catch {
                            // Ignorar error de carga de item individual
                        }
                    }
                })
            );

            if (isDestroyed) return;

            // ==========================================
            // 2. CONSTRUCCIÓN DE CAPAS GRÁFICAS PIXI
            // ==========================================
            // Capa 1: Cielo infinito escalado a la altura virtual
            const skyScale = V_HEIGHT / (skyTex.height || 724);
            const skySprite = new TilingSprite({
                texture: skyTex,
                width: V_WIDTH,
                height: V_HEIGHT
            });
            skySprite.tileScale.set(skyScale, skyScale);
            world.addChild(skySprite);

            // Base de asfalto continuo de seguridad para el fondo inferior
            const asphaltBase = new Graphics();
            asphaltBase.rect(0, 470, V_WIDTH, 70);
            asphaltBase.fill({ color: 0x414552 });
            world.addChild(asphaltBase);

            // Capa 2: Calle y Casas (Primer plano)
            const streetContentHeight = 688;
            const bgScale = V_HEIGHT / streetContentHeight;
            const streetSprite = new TilingSprite({
                texture: streetTex,
                width: V_WIDTH,
                height: V_HEIGHT
            });
            streetSprite.tileScale.set(bgScale, bgScale);
            world.addChild(streetSprite);

            // Capa 3: Capa de Obstáculos y Potenciadores en el Mundo
            const itemsLayer = new Container();
            world.addChild(itemsLayer);

            // Capa 4: Sombras en el suelo
            const playerShadow = new Graphics();
            const thiefShadow = new Graphics();
            world.addChild(thiefShadow);
            world.addChild(playerShadow);

            // Capa 5: Contenedor del Ladrón (Choro / Sparring Dummy)
            const thiefContainer = new Container();
            const thiefSprite = new Sprite(thiefCharTex);
            thiefSprite.anchor.set(0.5, 0.91);
            thiefContainer.addChild(thiefSprite);

            // Badge indicador arriba del ladrón
            const thiefBadge = new Container();
            const badgeBg = new Graphics();
            const badgeStyle = new TextStyle({
                fontFamily: 'monospace',
                fontSize: 10,
                fontWeight: '900',
                fill: '#ffffff'
            });
            const badgeText = new Text({ text: '¡CHORO!', style: badgeStyle });
            badgeText.anchor.set(0.5, 0.5);
            thiefBadge.addChild(badgeBg);
            thiefBadge.addChild(badgeText);
            thiefContainer.addChild(thiefBadge);
            world.addChild(thiefContainer);

            // Capa 6: Proyectiles lanzados por el ladrón (Chavetazos y trampas)
            const projectilesLayer = new Container();
            world.addChild(projectilesLayer);

            // Capa 7: Contenedor de Rubén (Protagonista)
            const playerContainer = new Container();
            const playerSprite = new Sprite(playerTextures['idle'][0]);
            playerSprite.anchor.set(0.5, 0.95);
            playerContainer.addChild(playerSprite);
            world.addChild(playerContainer);

            // Capa 8: Efectos de Partículas y Textos Flotantes
            const fxContainer = new Container();
            world.addChild(fxContainer);

            let lastActionLabel = 'IDLE';
            let nextProjId = 1;

            // Helper para obtener altura óptima de cada elemento según su diseño
            const getItemTargetHeight = (id: string): number => {
                switch (id) {
                    case 'hueco': return 34;
                    case 'cono': return 46;
                    case 'caca': return 30;
                    case 'basura': return 50;
                    case 'cable': return 38;
                    case 'cordel': return 42;
                    case 'cancha_serrana': return 30;
                    case 'emoliente': return 42;
                    case 'chicha_morada': return 40;
                    case 'maca': return 42;
                    case 'anticucho': return 40;
                    case 'pan_chicharron': return 40;
                    case 'picarones': return 40;
                    case 'poncho': return 42;
                    default: return 40;
                }
            };

            // Helpers de efectos visuales retro/arcade para potenciadores y obstáculos
            const drawArcadeSparkle = (g: Graphics, cx: number, cy: number, r: number, color: number) => {
                g.poly([
                    cx, cy - r,
                    cx + r * 0.28, cy - r * 0.28,
                    cx + r, cy,
                    cx + r * 0.28, cy + r * 0.28,
                    cx, cy + r,
                    cx - r * 0.28, cy + r * 0.28,
                    cx - r, cy,
                    cx - r * 0.28, cy - r * 0.28
                ]).fill({ color });
            };

            const drawSteam = (g: Graphics, phase: number, topY: number) => {
                for (let i = 0; i < 2; i++) {
                    const offsetPhase = phase * 1.8 + i * 2.8;
                    const progress = (offsetPhase % 6) / 6;
                    const yStart = topY - progress * 24;
                    const xOffset = (i === 0 ? -5 : 5) + Math.sin(phase * 2.5 + i) * 3;
                    const alpha = Math.sin(progress * Math.PI) * 0.75;
                    g.moveTo(xOffset, yStart);
                    g.bezierCurveTo(
                        xOffset - 4, yStart - 5,
                        xOffset + 4, yStart - 11,
                        xOffset, yStart - 18
                    );
                    g.stroke({ color: 0xf1f5f9, width: 2, alpha });
                }
            };

            const drawStinkFumes = (g: Graphics, phase: number, height: number) => {
                const startY = -height * 0.72;
                const tendrilOffsets = [-14, 0, 14];
                tendrilOffsets.forEach((bx, idx) => {
                    const tPhase = phase * 2.0 + idx * 2.1;
                    const progress = (tPhase % 6) / 6;
                    const curY = startY - progress * 30;
                    const waveX = bx + Math.sin(phase * 2.8 + idx * 2) * 5;
                    const alpha = Math.sin(progress * Math.PI) * 0.85;

                    g.moveTo(waveX, curY);
                    g.bezierCurveTo(
                        waveX - 5, curY - 7,
                        waveX + 5, curY - 14,
                        waveX + Math.sin(phase * 3.5) * 4, curY - 22
                    );
                    g.stroke({ color: 0x84cc16, width: 2.2, alpha });
                });
            };

            const drawFlies = (g: Graphics, phase: number, height: number) => {
                const baseY = -height * 0.8;
                for (let i = 0; i < 3; i++) {
                    const angle = phase * (6 + i * 2) + i * 2.2;
                    const radiusX = 16 + i * 4;
                    const radiusY = 8 + i * 3;
                    const fx = Math.cos(angle) * radiusX + (Math.sin(phase * 12 + i) * 3);
                    const fy = baseY + Math.sin(angle) * radiusY + (Math.cos(phase * 15 + i) * 3);

                    // Mosca negra
                    g.circle(fx, fy, 1.8).fill({ color: 0x18181b });
                    // Alitas blancas revoloteando
                    const wingOffset = Math.sin(phase * 25 + i) > 0 ? -1.5 : 1.5;
                    g.ellipse(fx + wingOffset, fy - 1.2, 1.4, 0.8).fill({ color: 0xffffff, alpha: 0.85 });
                }
            };

            // Destrucción limpia y segura de un item
            const destroyItem = (item: ActiveItem) => {
                item.collected = true;
                if (item.container && !item.container.destroyed) {
                    if (item.container.parent) {
                        item.container.parent.removeChild(item.container);
                    }
                    item.container.destroy({ children: true });
                }
            };

            // Helper para generar y colocar un item en el mundo con efectos visuales dinámicos
            const spawnItemAt = (itemDef: ItemDefinition, worldX: number) => {
                const tex = itemTextures[itemDef.id] || Texture.WHITE;
                const itemCont = new Container();
                const fxBack = new Graphics();
                const spr = new Sprite(tex);
                const fxFront = new Graphics();

                itemCont.addChild(fxBack);
                itemCont.addChild(spr);
                itemCont.addChild(fxFront);

                const targetH = getItemTargetHeight(itemDef.id);
                const s = targetH / (tex.height || 100);
                spr.scale.set(s, s);

                let baseY = GROUND_Y;
                if (itemDef.tier === 'piso') {
                    spr.anchor.set(0.5, 0.96);
                    baseY = GROUND_Y;
                } else if (itemDef.tier === 'medio') {
                    spr.anchor.set(0.5, 0.5);
                    baseY = GROUND_Y - 55;
                } else {
                    spr.anchor.set(0.5, 0.5);
                    baseY = itemDef.id === 'cable' || itemDef.id === 'cordel' ? GROUND_Y - 80 : GROUND_Y - 95;
                }

                itemCont.position.set(worldX, baseY);
                itemsLayer.addChild(itemCont);

                stateRef.current.items.push({
                    id: `${itemDef.id}_${Math.random().toString(36).substring(2, 7)}`,
                    itemDef,
                    worldX,
                    baseY,
                    y: baseY,
                    bobPhase: Math.random() * Math.PI * 2,
                    container: itemCont,
                    sprite: spr,
                    fxBack,
                    fxFront,
                    collected: false,
                    hitPlayer: false
                });
            };

            // Spawnear items iniciales a lo largo de la calle para que aparezcan de inmediato
            const availableCatalog = itemCatalog.filter((it) => it.imageUrl && itemTextures[it.id]);
            const initialOffsets = [380, 560, 780, 1020, 1260, 1520, 1780, 2060];
            initialOffsets.forEach((offsetX) => {
                if (availableCatalog.length > 0) {
                    const picked = availableCatalog[Math.floor(Math.random() * availableCatalog.length)];
                    spawnItemAt(picked, offsetX);
                }
            });

            // Helper para crear contenedor gráfico de proyectil (chaveta o trampa)
            const createProjectileGraphics = (type: 'cuchillo_alto' | 'cuchillo_bajo' | 'platano'): Container => {
                const cont = new Container();
                const g = new Graphics();
                if (type === 'platano') {
                    // Cáscara de plátano
                    g.ellipse(0, 0, 11, 4.5);
                    g.fill({ color: 0xfacc15 });
                    g.arc(0, -2, 9, 0, Math.PI);
                    g.stroke({ color: 0x713f12, width: 2 });
                } else {
                    // Chavetazo peruano (navaja plateada con mango oscuro y filo brillante)
                    g.poly([-16, -1, 4, -4, 10, 0, 4, 4, -16, 1]);
                    g.fill({ color: 0xe5e7eb });
                    g.poly([-14, -1, 4, -4, 10, 0]);
                    g.stroke({ color: 0xffffff, width: 1.5 });
                    g.roundRect(-22, -3.5, 8, 7, 2);
                    g.fill({ color: 0x5c2b0e });
                    g.circle(-18, 0, 1);
                    g.fill({ color: 0xd1d5db });
                }
                cont.addChild(g);
                return cont;
            };

            // ==========================================
            // 3. GAME LOOP / TICKER NORMALIZADO (PIXI)
            // ==========================================
            app.ticker.add((ticker) => {
                const dt = Math.min(0.05, Math.max(0.001, ticker.deltaTime / 60));
                const st = stateRef.current;
                const timeScale = dt * 60 * st.gameSpeed;

                // ------------------------------------------
                // A. Redimensionado y centrado responsivo
                // ------------------------------------------
                const scaleX = app.renderer.width / V_WIDTH;
                const scaleY = app.renderer.height / V_HEIGHT;
                const gameScale = Math.min(scaleX, scaleY);
                world.scale.set(gameScale, gameScale);
                world.position.x = (app.renderer.width - V_WIDTH * gameScale) / 2;
                world.position.y = (app.renderer.height - V_HEIGHT * gameScale) / 2;

                // ------------------------------------------
                // B. Sistema de Supervivencia: Hambre, Cansancio y Vida
                // ------------------------------------------
                // 1. Hambre: drena pasivamente de manera continua
                st.stats.hambre = Math.max(0, st.stats.hambre - 0.40 * dt * st.gameSpeed);
                if (st.stats.hambre <= 0) {
                    st.stats.isStarving = true;
                    // Inanición drena vida si no come
                    st.stats.vida = Math.max(0, st.stats.vida - 1.6 * dt * st.gameSpeed);
                } else {
                    st.stats.isStarving = false;
                }

                // 2. Cansancio: aumenta al correr y se recupera al estar quieto o caminar
                if (st.player.isSprinting && st.player.isMoving && !st.player.isDead) {
                    st.stats.cansancio = Math.min(100, st.stats.cansancio + 10.5 * dt * st.gameSpeed);
                } else if (st.player.isMoving && !st.player.isDead) {
                    st.stats.cansancio = Math.max(0, st.stats.cansancio - 4.5 * dt * st.gameSpeed);
                } else {
                    st.stats.cansancio = Math.max(0, st.stats.cansancio - 12.0 * dt * st.gameSpeed);
                }

                // Fatiga: si llega a 100%
                if (st.stats.cansancio >= 100) {
                    st.stats.isFatigued = true;
                } else if (st.stats.cansancio < 65) {
                    st.stats.isFatigued = false;
                }

                // Temporizadores de estados (poncho escudo, buffs de velocidad, stuns, comer, beber)
                if (st.stats.ponchoTimeLeft > 0) {
                    st.stats.ponchoTimeLeft = Math.max(0, st.stats.ponchoTimeLeft - dt * st.gameSpeed);
                    st.stats.hasPoncho = st.stats.ponchoTimeLeft > 0;
                }
                if (st.stats.speedBuffTimeLeft > 0) {
                    st.stats.speedBuffTimeLeft = Math.max(0, st.stats.speedBuffTimeLeft - dt * st.gameSpeed);
                    if (st.stats.speedBuffTimeLeft <= 0) {
                        st.stats.speedBuff = 1.0;
                    }
                }
                if (st.stats.stunTimeLeft > 0) {
                    st.stats.stunTimeLeft = Math.max(0, st.stats.stunTimeLeft - dt * st.gameSpeed);
                }
                if (st.player.eatTimer > 0) {
                    st.player.eatTimer = Math.max(0, st.player.eatTimer - 1 * timeScale);
                }
                if (st.player.drinkTimer > 0) {
                    st.player.drinkTimer = Math.max(0, st.player.drinkTimer - 1 * timeScale);
                }

                // Comprobar muerte por inanición o daño
                if (st.stats.vida <= 0 && !st.player.isDead) {
                    actionsRef.current.triggerDeath();
                }

                // Notificar estadísticas al HUD
                callbacksRef.current.onStatsChange?.({ ...st.stats });

                // ------------------------------------------
                // C. Físicas y Movimiento de Rubén
                // ------------------------------------------
                const isSprint = st.keys.sprint && !st.stats.isFatigued;
                st.player.isSprinting = isSprint;

                // Si está fatigado o con stun, se reduce la velocidad o se bloquea
                let currentMoveSpeed = isSprint ? st.player.speedRun : st.player.speedWalk;
                currentMoveSpeed *= st.stats.speedBuff;
                if (st.stats.isFatigued) currentMoveSpeed *= 0.55;
                if (st.stats.stunTimeLeft > 0) currentMoveSpeed = 0;

                // Agacharse
                if (st.player.duckTimer > 0) {
                    st.player.duckTimer -= 1 * timeScale;
                    if (st.player.duckTimer <= 0 && !st.keys.duck) {
                        st.player.isDucking = false;
                    }
                }

                if (!st.player.isDead && st.stats.stunTimeLeft <= 0) {
                    if (st.keys.right) {
                        st.player.facingRight = true;
                        st.player.isMoving = true;
                        st.player.vx = st.player.isDucking ? currentMoveSpeed * 0.45 : currentMoveSpeed;
                    } else if (st.keys.left) {
                        st.player.facingRight = false;
                        st.player.isMoving = true;
                        st.player.vx = -(st.player.isDucking ? currentMoveSpeed * 0.45 : currentMoveSpeed);
                    } else {
                        st.player.vx = 0;
                        st.player.isMoving = false;
                    }
                } else {
                    st.player.vx = 0;
                    st.player.isMoving = false;
                }

                // Scroll del mundo
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

                // Físicas del salto y gravedad
                st.player.vy += st.player.gravity * timeScale;
                st.player.y += st.player.vy * timeScale;

                if (st.player.y >= GROUND_Y) {
                    st.player.y = GROUND_Y;
                    st.player.vy = 0;
                    st.player.isGrounded = true;
                }

                // Temporizadores de acción
                if (st.player.isAttacking) {
                    st.player.attackTimer += 1 * timeScale;
                    if (st.player.attackTimer >= st.player.attackDuration) {
                        st.player.isAttacking = false;
                        st.player.attackTimer = 0;
                    }
                }
                if (st.player.isDamaged) {
                    st.player.damageTimer += 1 * timeScale;
                    if (st.player.damageTimer >= st.player.damageDuration) {
                        st.player.isDamaged = false;
                        st.player.damageTimer = 0;
                    }
                }
                if (st.player.isDead) {
                    if (st.player.deathTimer < st.player.deathDuration) {
                        st.player.deathTimer += 1 * timeScale;
                    }
                }

                // Bobbing al caminar/correr
                if (st.player.isMoving && st.player.isGrounded && !st.player.isDead) {
                    st.player.runCycle += (isSprint ? 0.11 : 0.07) * timeScale;
                    st.player.bobbing = Math.sin(st.player.runCycle) * (isSprint ? 1.5 : 0.9);
                } else {
                    st.player.runCycle += 0.02 * timeScale;
                    st.player.bobbing = Math.sin(st.player.runCycle) * 0.5;
                }

                // ------------------------------------------
                // D. Físicas y Mecánicas del Ladrón (Choro)
                // ------------------------------------------
                if (st.gameMode === 'mission') {
                    // El ladrón SIEMPRE corre a toda velocidad hacia adelante escapando
                    st.thief.runCycle += 0.11 * timeScale;
                    st.thief.bobbing = Math.sin(st.thief.runCycle) * 1.6;

                    // Diferencia de velocidad: si el jugador se detiene o camina lento, el ladrón se fuga
                    const thiefRunSpeed = 2.45;
                    const playerForwardSpeed = Math.max(0, st.player.vx);
                    const speedDelta = thiefRunSpeed - playerForwardSpeed;

                    st.distanceToThief += (speedDelta * 0.055) * timeScale;
                    if (st.distanceToThief < 1) st.distanceToThief = 1;

                    // Actualizar reporte de distancia
                    callbacksRef.current.onDistanceChange?.(Math.round(st.distanceToThief), Math.floor(st.totalDistance));

                    // Límite de 150m: ¡El choro se fugó!
                    if (st.distanceToThief >= 150) {
                        callbacksRef.current.onGameOver?.('escaped');
                    } else if (st.distanceToThief <= 3) {
                        callbacksRef.current.onCatchThief?.();
                    }

                    // ACCIÓN ADICIONAL DEL LADRÓN: Si el jugador se acerca a < 28m, el ladrón lanza cuchillos / trampas
                    if (st.distanceToThief < 28 && st.distanceToThief > 4 && !st.player.isDead) {
                        st.thiefAttackTimer += dt * st.gameSpeed;
                        if (st.thiefAttackTimer >= 3.8) {
                            st.thiefAttackTimer = 0;

                            const thiefScreenX = st.player.x + st.distanceToThief * 9.5;
                            const randType = Math.random();
                            let projType: 'cuchillo_alto' | 'cuchillo_bajo' | 'platano' = 'cuchillo_alto';
                            let startY = GROUND_Y - 58;

                            if (randType < 0.45) {
                                projType = 'cuchillo_alto';
                                startY = GROUND_Y - 58;
                                st.floatingTexts.push({
                                    text: '🔪 ¡CHAVETAZO ALTO! (¡AGÁCHATE [S]!)',
                                    x: thiefScreenX - 30,
                                    y: GROUND_Y - 110,
                                    opacity: 1.2,
                                    vy: -0.6,
                                    color: '#f87171'
                                });
                            } else if (randType < 0.80) {
                                projType = 'cuchillo_bajo';
                                startY = GROUND_Y - 14;
                                st.floatingTexts.push({
                                    text: '🔪 ¡CHAVETAZO BAJO! (¡SALTA [ESPACIO]!)',
                                    x: thiefScreenX - 30,
                                    y: GROUND_Y - 110,
                                    opacity: 1.2,
                                    vy: -0.6,
                                    color: '#fb923c'
                                });
                            } else {
                                projType = 'platano';
                                startY = GROUND_Y - 4;
                                st.floatingTexts.push({
                                    text: '🍌 ¡TRAMPA! (¡SALTA!)',
                                    x: thiefScreenX - 30,
                                    y: GROUND_Y - 110,
                                    opacity: 1.2,
                                    vy: -0.6,
                                    color: '#facc15'
                                });
                            }

                            playSfx('whoosh');

                            const pCont = createProjectileGraphics(projType);
                            pCont.position.set(thiefScreenX - 25, startY);
                            projectilesLayer.addChild(pCont);

                            st.projectiles.push({
                                id: nextProjId++,
                                type: projType,
                                x: thiefScreenX - 25,
                                y: startY,
                                vx: projType === 'platano' ? -2.6 : -5.4,
                                rotation: 0,
                                container: pCont,
                                dodged: false,
                                hitPlayer: false
                            });
                        }
                    }
                } else {
                    // Modo práctica: respiración fluida
                    st.thief.runCycle += 0.03 * timeScale;
                    st.thief.bobbing = Math.sin(st.thief.runCycle) * 0.5;
                    st.thief.x = Math.max(140, Math.min(V_WIDTH - 140, st.player.x + 130 + st.thief.recoilX));
                }

                if (st.thief.recoilX !== 0) {
                    st.thief.recoilX *= Math.pow(0.82, timeScale);
                    if (Math.abs(st.thief.recoilX) < 0.5) st.thief.recoilX = 0;
                }
                if (st.thief.hitFlash > 0) {
                    st.thief.hitFlash -= 1 * timeScale;
                }

                // ------------------------------------------
                // E. Proyectiles del Ladrón (Actualización y Colisiones)
                // ------------------------------------------
                st.projectiles.forEach((proj) => {
                    proj.x += proj.vx * timeScale;
                    if (proj.type !== 'platano') {
                        proj.rotation += 0.28 * timeScale;
                        proj.container.rotation = proj.rotation;
                    }
                    proj.container.position.set(proj.x, proj.y);

                    // Colisión con Rubén
                    const distanceToPlayer = Math.abs(proj.x - st.player.x);
                    if (distanceToPlayer < 24 && !proj.hitPlayer && !st.player.isDead) {
                        if (proj.type === 'cuchillo_alto') {
                            if (st.player.isDucking) {
                                proj.dodged = true;
                                st.floatingTexts.push({
                                    text: '¡ESQUIVASTE EL CUCHILLO! 😎',
                                    x: st.player.x,
                                    y: st.player.y - 70,
                                    opacity: 1,
                                    vy: -1.2,
                                    color: '#38bdf8'
                                });
                            } else {
                                proj.hitPlayer = true;
                                if (st.stats.hasPoncho) {
                                    st.floatingTexts.push({
                                        text: '¡EL PONCHO REBOTÓ EL CUCHILLO! 🛡️',
                                        x: st.player.x,
                                        y: st.player.y - 80,
                                        opacity: 1,
                                        vy: -1.2,
                                        color: '#facc15'
                                    });
                                } else {
                                    st.stats.vida = Math.max(0, st.stats.vida - 18);
                                    st.player.isDamaged = true;
                                    st.player.damageTimer = 0;
                                    playSfx('hit');
                                    st.floatingTexts.push({
                                        text: '¡CHAVETAZO! -18 HP 🩸',
                                        x: st.player.x,
                                        y: st.player.y - 80,
                                        opacity: 1,
                                        vy: -1.2,
                                        color: '#ef4444'
                                    });
                                    for (let i = 0; i < 7; i++) {
                                        st.particles.push({
                                            x: st.player.x,
                                            y: GROUND_Y - 58,
                                            vx: (Math.random() - 0.5) * 4,
                                            vy: (Math.random() - 0.5) * 4,
                                            life: 1,
                                            color: 0xef4444
                                        });
                                    }
                                }
                            }
                        } else if (proj.type === 'cuchillo_bajo') {
                            if (!st.player.isGrounded && st.player.y < GROUND_Y - 20) {
                                proj.dodged = true;
                                st.floatingTexts.push({
                                    text: '¡SALTADO A TIEMPO! 👟✨',
                                    x: st.player.x,
                                    y: st.player.y - 70,
                                    opacity: 1,
                                    vy: -1.2,
                                    color: '#4ade80'
                                });
                            } else {
                                proj.hitPlayer = true;
                                if (st.stats.hasPoncho) {
                                    st.floatingTexts.push({
                                        text: '¡PONCHO PROTEGIÓ TUS TOBILLOS! 🛡️',
                                        x: st.player.x,
                                        y: st.player.y - 80,
                                        opacity: 1,
                                        vy: -1.2,
                                        color: '#facc15'
                                    });
                                } else {
                                    st.stats.vida = Math.max(0, st.stats.vida - 18);
                                    st.player.isDamaged = true;
                                    st.player.damageTimer = 0;
                                    playSfx('hit');
                                    st.floatingTexts.push({
                                        text: '¡CORTE EN LAS TABAS! -18 HP 🩸',
                                        x: st.player.x,
                                        y: st.player.y - 45,
                                        opacity: 1,
                                        vy: -1.2,
                                        color: '#ef4444'
                                    });
                                }
                            }
                        } else if (proj.type === 'platano') {
                            if (st.player.isGrounded) {
                                proj.hitPlayer = true;
                                st.stats.speedBuff = 0.65;
                                st.stats.speedBuffTimeLeft = 2.5;
                                playSfx('whoosh');
                                st.floatingTexts.push({
                                    text: '¡TE RESBALASTE, GIL! -35% VEL 🍌',
                                    x: st.player.x,
                                    y: st.player.y - 60,
                                    opacity: 1,
                                    vy: -1.2,
                                    color: '#facc15'
                                });
                            }
                        }
                    }
                });

                // Limpiar proyectiles salidos de pantalla o impactados
                st.projectiles = st.projectiles.filter((proj) => {
                    const keep = proj.x > -60 && !proj.hitPlayer;
                    if (!keep) {
                        projectilesLayer.removeChild(proj.container);
                        proj.container.destroy({ children: true });
                    }
                    return keep;
                });

                // ------------------------------------------
                // F. Generación y Colisiones de Items en el Mundo
                // ------------------------------------------
                itemsLayer.position.x = -st.worldScrollX;

                // Generar nuevos items adelante al correr
                if (st.totalDistance >= st.nextItemSpawnDist && availableCatalog.length > 0) {
                    st.nextItemSpawnDist += 14 + Math.random() * 12;
                    const picked = availableCatalog[Math.floor(Math.random() * availableCatalog.length)];
                    const spawnWorldX = st.worldScrollX + V_WIDTH + 40;
                    spawnItemAt(picked, spawnWorldX);
                }

                // Actualizar y chequear colisiones de items activos con efectos visuales dinámicos
                const playerWorldX = st.player.x + st.worldScrollX;
                st.items.forEach((item) => {
                    if (item.collected || !item.container || item.container.destroyed) return;

                    // Bobbing suave
                    item.bobPhase += 0.05 * timeScale;
                    if (item.itemDef.tier !== 'piso') {
                        item.y = item.baseY + Math.sin(item.bobPhase) * 5;
                    } else {
                        item.y = item.baseY;
                    }
                    item.container.position.set(item.worldX, item.y);

                    const targetH = getItemTargetHeight(item.itemDef.id);
                    const yCenter = item.itemDef.tier === 'piso' ? -targetH * 0.5 : 0;

                    // 1. Efectos visuales vivos de Potenciadores vs Obstáculos
                    if (item.itemDef.category === 'potenciador') {
                        // Resplandor áureo cálido pulsante bajo el potenciador
                        const auraAlpha = 0.26 + 0.12 * Math.sin(item.bobPhase * 2.2);
                        item.fxBack.clear();
                        item.fxBack.ellipse(0, yCenter, 28, 16).fill({ color: 0xf59e0b, alpha: auraAlpha * 0.45 });
                        item.fxBack.ellipse(0, yCenter, 20, 11).fill({ color: 0xfacc15, alpha: auraAlpha });
                        item.fxBack.ellipse(0, yCenter, 10, 6).fill({ color: 0xfef08a, alpha: auraAlpha * 1.2 });

                        // Destellos y chispas arcades ✨
                        item.fxFront.clear();
                        const s1 = Math.max(0, Math.sin(item.bobPhase * 3.2));
                        if (s1 > 0.1) drawArcadeSparkle(item.fxFront, -18, yCenter - 14, 4.2 * s1, 0xffffff);
                        const s2 = Math.max(0, Math.sin(item.bobPhase * 3.2 + 2.0));
                        if (s2 > 0.1) drawArcadeSparkle(item.fxFront, 17, yCenter - 8, 3.8 * s2, 0xfef08a);
                        const s3 = Math.max(0, Math.sin(item.bobPhase * 3.2 + 4.1));
                        if (s3 > 0.1) drawArcadeSparkle(item.fxFront, 2, yCenter - 22, 4.5 * s3, 0xfffbeb);

                        // Si es emoliente: humo / vapor caliente que se eleva del vaso
                        if (item.itemDef.id === 'emoliente') {
                            drawSteam(item.fxFront, item.bobPhase, yCenter - targetH * 0.45);
                        }
                    } else if (item.itemDef.category === 'obstaculo') {
                        if (item.itemDef.id === 'basura' || item.itemDef.id === 'caca') {
                            item.fxBack.clear();
                            const sW = item.itemDef.id === 'basura' ? 28 : 15;
                            item.fxBack.ellipse(0, 0, sW, 6).fill({ color: 0x000000, alpha: 0.38 });

                            item.fxFront.clear();
                            // Hedor verde ondulante apestoso
                            drawStinkFumes(item.fxFront, item.bobPhase, targetH);
                            // Moscas zumbando erráticamente alrededor
                            drawFlies(item.fxFront, item.bobPhase, targetH);
                        } else if (item.itemDef.id === 'hueco') {
                            item.fxBack.clear();
                            // Borde de profundidad oscura en el pavimento
                            item.fxBack.ellipse(0, -2, 34, 10).fill({ color: 0x090d16, alpha: 0.65 });
                            item.fxFront.clear();
                        } else if (item.itemDef.id === 'cono') {
                            item.fxBack.clear();
                            item.fxBack.ellipse(0, 0, 18, 5.5).fill({ color: 0x000000, alpha: 0.42 });
                            item.fxFront.clear();
                        } else {
                            item.fxBack.clear();
                            item.fxFront.clear();
                        }
                    }

                    // 2. Colisión con el jugador
                    const distToPlayer = Math.abs(item.worldX - playerWorldX);
                    if (distToPlayer < 28 && !st.player.isDead) {
                        if (item.itemDef.category === 'potenciador') {
                            const isTouchingY = item.y >= st.player.y - 100 && item.y <= st.player.y + 10;
                            if (isTouchingY) {
                                playSfx('whoosh');

                                // Si es bebida, activar animación beber
                                if (item.itemDef.subCategory === 'bebida') {
                                    st.player.drinkTimer = 30;
                                }
                                // Si es comida, activar animación comer
                                if (item.itemDef.subCategory === 'comida') {
                                    st.player.eatTimer = 30;
                                }

                                // Efectos en el sistema de barras
                                if (item.itemDef.effects.vidaDelta) {
                                    st.stats.vida = Math.min(100, Math.max(0, st.stats.vida + item.itemDef.effects.vidaDelta));
                                }
                                if (item.itemDef.effects.cansancioDelta) {
                                    st.stats.cansancio = Math.max(0, Math.min(100, st.stats.cansancio + item.itemDef.effects.cansancioDelta));
                                    if (st.stats.cansancio < 70) st.stats.isFatigued = false;
                                }
                                if (item.itemDef.effects.hambreDelta) {
                                    st.stats.hambre = Math.min(100, Math.max(0, st.stats.hambre + item.itemDef.effects.hambreDelta));
                                }
                                if (item.itemDef.effects.velocidadFactor) {
                                    st.stats.speedBuff = item.itemDef.effects.velocidadFactor;
                                    st.stats.speedBuffTimeLeft = item.itemDef.effects.velocidadDuracion || 4;
                                }
                                if (item.itemDef.effects.escudoDuracion) {
                                    st.stats.hasPoncho = true;
                                    st.stats.ponchoTimeLeft = item.itemDef.effects.escudoDuracion;
                                }

                                // Mensaje flotante según el potenciador
                                let msg = `+${item.itemDef.name}`;
                                let color = '#4ade80';
                                if (item.itemDef.id === 'emoliente') {
                                    msg = '🍵 ¡EMOLIENTE CALIENTE! -40% FATIGA';
                                    color = '#2dd4bf';
                                } else if (item.itemDef.id === 'chicha_morada') {
                                    msg = '🍇 ¡CHICHA HELADITA! +15 HP';
                                    color = '#c084fc';
                                } else if (item.itemDef.id === 'maca') {
                                    msg = '⚡ ¡MACA PURA! +20% VELOCIDAD';
                                    color = '#facc15';
                                } else if (item.itemDef.id === 'anticucho') {
                                    msg = '🍢 ¡ANTICUCHO! +25 HAMBRE';
                                    color = '#fb923c';
                                } else if (item.itemDef.id === 'pan_chicharron') {
                                    msg = '🥪 ¡PAN CON CHICHARRÓN! +50 HAMBRE';
                                    color = '#f59e0b';
                                } else if (item.itemDef.id === 'cancha_serrana') {
                                    msg = '🍿 +10 HAMBRE (Canchita)';
                                    color = '#fef08a';
                                } else if (item.itemDef.id === 'picarones') {
                                    msg = '🍩 ¡PICARONES CON MIEL! +30 HAMBRE +15 HP';
                                    color = '#fbbf24';
                                }

                                st.floatingTexts.push({
                                    text: msg,
                                    x: st.player.x,
                                    y: st.player.y - 70,
                                    opacity: 1.1,
                                    vy: -1.2,
                                    color
                                });

                                // Partículas doradas
                                for (let i = 0; i < 6; i++) {
                                    st.particles.push({
                                        x: st.player.x,
                                        y: item.y,
                                        vx: (Math.random() - 0.5) * 3,
                                        vy: (Math.random() - 0.5) * 3,
                                        life: 0.8,
                                        color: 0xfacc15
                                    });
                                }

                                destroyItem(item);
                            }
                        } else if (item.itemDef.category === 'obstaculo' && !item.hitPlayer) {
                            if (item.itemDef.tier === 'piso') {
                                if (st.player.y < GROUND_Y - 24) {
                                    item.hitPlayer = true;
                                    st.floatingTexts.push({
                                        text: '¡SALTADO! 👟✨',
                                        x: st.player.x,
                                        y: st.player.y - 65,
                                        opacity: 0.9,
                                        vy: -1.0,
                                        color: '#4ade80'
                                    });
                                } else {
                                    item.hitPlayer = true;
                                    if (st.stats.hasPoncho) {
                                        st.floatingTexts.push({
                                            text: '¡EL PONCHO ABSORBIÓ EL IMPACTO! 🛡️',
                                            x: st.player.x,
                                            y: st.player.y - 75,
                                            opacity: 1,
                                            vy: -1.1,
                                            color: '#facc15'
                                        });
                                    } else {
                                        st.stats.vida = Math.max(0, st.stats.vida + (item.itemDef.effects.vidaDelta || 0));
                                        if (item.itemDef.effects.stunDuracion) {
                                            st.stats.stunTimeLeft = item.itemDef.effects.stunDuracion;
                                        }
                                        if (item.itemDef.effects.velocidadFactor) {
                                            st.stats.speedBuff = item.itemDef.effects.velocidadFactor;
                                            st.stats.speedBuffTimeLeft = item.itemDef.effects.velocidadDuracion || 2.5;
                                        }
                                        if (item.itemDef.effects.cansancioDelta) {
                                            st.stats.cansancio = Math.min(100, st.stats.cansancio + item.itemDef.effects.cansancioDelta);
                                        }

                                        st.player.isDamaged = true;
                                        st.player.damageTimer = 0;
                                        playSfx('hit');

                                        const txt = item.itemDef.id === 'hueco' ? '¡HUECAZO EN PISTA! -15 HP 💥'
                                            : item.itemDef.id === 'cono' ? '¡TROMPICÓN CON CONO! -5 HP 🚧'
                                            : item.itemDef.id === 'caca' ? '¡PISASTE CACA! -20% VEL 💩'
                                            : '¡BASURA! -10 HP 🗑️';

                                        st.floatingTexts.push({
                                            text: txt,
                                            x: st.player.x,
                                            y: st.player.y - 75,
                                            opacity: 1,
                                            vy: -1.2,
                                            color: '#ef4444'
                                        });
                                    }
                                    destroyItem(item);
                                }
                            } else if (item.itemDef.tier === 'alto') {
                                if (st.player.isDucking) {
                                    item.hitPlayer = true;
                                    st.floatingTexts.push({
                                        text: '¡ESQUIVADO POR ABAJO! 🕶️',
                                        x: st.player.x,
                                        y: st.player.y - 45,
                                        opacity: 0.9,
                                        vy: -1.0,
                                        color: '#38bdf8'
                                    });
                                } else {
                                    item.hitPlayer = true;
                                    if (st.stats.hasPoncho) {
                                        st.floatingTexts.push({
                                            text: '¡PONCHO PROTEGIÓ! 🛡️',
                                            x: st.player.x,
                                            y: st.player.y - 75,
                                            opacity: 1,
                                            vy: -1.1,
                                            color: '#facc15'
                                        });
                                    } else {
                                        st.stats.vida = Math.max(0, st.stats.vida + (item.itemDef.effects.vidaDelta || 0));
                                        st.stats.stunTimeLeft = item.itemDef.effects.stunDuracion || 0.8;
                                        st.player.isDamaged = true;
                                        st.player.damageTimer = 0;
                                        playSfx('hit');

                                        const txt = item.itemDef.id === 'cable'
                                            ? '¡CABLE COLGANTE! ¡ENREDADO 1s! ⚡'
                                            : '¡TENDEDERO EN LA CARA! -5 HP 🩲';

                                        st.floatingTexts.push({
                                            text: txt,
                                            x: st.player.x,
                                            y: st.player.y - 75,
                                            opacity: 1,
                                            vy: -1.2,
                                            color: '#f43f5e'
                                        });
                                    }
                                    destroyItem(item);
                                }
                            }
                        }
                    }
                });

                // Limpiar items que quedaron muy atrás
                st.items = st.items.filter((item) => {
                    const screenX = item.worldX - st.worldScrollX;
                    const keep = screenX > -120 && !item.collected;
                    if (!keep) {
                        destroyItem(item);
                    }
                    return keep;
                });

                // ------------------------------------------
                // G. Scroll de Parallax
                // ------------------------------------------
                skySprite.tilePosition.x = -(st.worldScrollX * 0.22) / skyScale;
                streetSprite.tilePosition.x = -st.worldScrollX / bgScale;

                // ------------------------------------------
                // H. Animación y Renderizado de Rubén (Protagonista)
                // ------------------------------------------
                let playerAction = 'idle';
                let playerFps = 4.0;
                let playerFrameIndex = 0;
                let actionLabel = 'IDLE';

                if (st.player.isDead) {
                    playerAction = 'muerte';
                    playerFps = 4.5;
                    playerFrameIndex = Math.min(4, Math.floor((st.player.deathTimer / st.player.deathDuration) * 5));
                    actionLabel = 'MUERTE';
                } else if (st.player.isDamaged) {
                    playerAction = 'daño';
                    playerFps = 6.0;
                    playerFrameIndex = Math.min(4, Math.floor((st.player.damageTimer / st.player.damageDuration) * 5));
                    actionLabel = 'DAÑO';
                } else if (st.player.isAttacking) {
                    playerAction = 'atacar';
                    playerFps = 7.5;
                    playerFrameIndex = Math.min(4, Math.floor((st.player.attackTimer / st.player.attackDuration) * 5));
                    actionLabel = 'ATACAR';
                } else if (st.player.eatTimer > 0) {
                    playerAction = 'comer';
                    playerFps = 7.0;
                    const p = Math.max(0, Math.min(1, (30 - st.player.eatTimer) / 30));
                    playerFrameIndex = Math.min(4, Math.floor(p * 5));
                    actionLabel = 'COMER';
                } else if (st.player.drinkTimer > 0) {
                    playerAction = 'beber';
                    playerFps = 7.0;
                    const p = Math.max(0, Math.min(1, (30 - st.player.drinkTimer) / 30));
                    playerFrameIndex = Math.min(4, Math.floor(p * 5));
                    actionLabel = 'BEBER';
                } else if (!st.player.isGrounded) {
                    playerAction = 'saltar';
                    playerFps = 5.0;
                    actionLabel = 'SALTAR';
                    if (st.player.currentAction !== 'saltar') {
                        st.player.currentAction = 'saltar';
                        st.player.animTimer = 0;
                    } else {
                        st.player.animTimer += (dt * playerFps) * st.gameSpeed;
                    }
                    playerFrameIndex = Math.min(4, Math.floor(st.player.animTimer));
                } else if (st.player.isDucking) {
                    playerAction = 'idle';
                    actionLabel = 'AGACHARSE';
                } else if (st.player.isMoving) {
                    if (st.player.isSprinting) {
                        playerAction = 'correr';
                        playerFps = 7.0;
                        actionLabel = 'CORRER';
                    } else {
                        playerAction = 'caminar';
                        playerFps = 5.0;
                        actionLabel = 'CAMINAR';
                    }
                    if (st.player.currentAction !== playerAction) {
                        st.player.currentAction = playerAction;
                        st.player.animTimer = 0;
                    } else {
                        st.player.animTimer += (dt * playerFps) * st.gameSpeed;
                        if (st.player.animTimer >= 5) st.player.animTimer %= 5;
                    }
                    playerFrameIndex = Math.floor(st.player.animTimer) % 5;
                } else {
                    // Rubén quieto / parado
                    if (st.stats.isFatigued) {
                        playerAction = 'cansancio';
                        playerFps = 4.5;
                        actionLabel = 'CANSANCIO';
                    } else if (st.stats.isStarving) {
                        playerAction = 'hambre';
                        playerFps = 4.0;
                        actionLabel = 'HAMBRE';
                    } else {
                        playerAction = 'idle';
                        playerFps = 4.0;
                        actionLabel = 'IDLE';
                    }
                    if (st.player.currentAction !== playerAction) {
                        st.player.currentAction = playerAction;
                        st.player.animTimer = 0;
                    } else {
                        st.player.animTimer += (dt * playerFps) * st.gameSpeed;
                        if (st.player.animTimer >= 5) st.player.animTimer %= 5;
                    }
                    playerFrameIndex = Math.floor(st.player.animTimer) % 5;
                }

                if (actionLabel !== lastActionLabel) {
                    lastActionLabel = actionLabel;
                    callbacksRef.current.onActionChange?.(actionLabel);
                }

                // Asignar textura del frame activo de Rubén
                const playerFrameTextures = playerTextures[playerAction] || playerTextures['idle'];
                const curPlayerTex = playerFrameTextures[playerFrameIndex] || playerFrameTextures[0];
                if (curPlayerTex) {
                    playerSprite.texture = curPlayerTex;
                    const targetHeight = 110;
                    const baseScale = targetHeight / (curPlayerTex.height || 724);

                    if (st.player.isDucking && st.player.isGrounded && !st.player.isDead) {
                        // Compresión visual de agacharse
                        playerSprite.scale.set(
                            (st.player.facingRight ? baseScale : -baseScale) * 1.15,
                            baseScale * 0.52
                        );
                    } else {
                        playerSprite.scale.set(st.player.facingRight ? baseScale : -baseScale, baseScale);
                    }
                }

                playerContainer.position.set(st.player.x, st.player.y + st.player.bobbing);

                // Sombra de Rubén
                const jumpDistance = Math.max(0, GROUND_Y - st.player.y);
                const pShadowScale = Math.max(0.35, 1 - jumpDistance / 190);
                const pShadowAlpha = Math.max(0.12, 0.40 * pShadowScale);
                playerShadow.clear();
                playerShadow.ellipse(st.player.x, GROUND_Y, 26 * pShadowScale, 5.5 * pShadowScale);
                playerShadow.fill({ color: 0x000000, alpha: pShadowAlpha });

                // ------------------------------------------
                // I. Renderizado Real del Ladrón (Sprites y Fuga)
                // ------------------------------------------
                const showThief = st.dummyActive || st.gameMode === 'mission';
                thiefContainer.visible = showThief;
                thiefShadow.visible = showThief;

                if (showThief) {
                    // El ladrón avanza de acuerdo a la distancia real (sin topar en el borde de pantalla)
                    const thiefScreenX = st.gameMode === 'mission'
                        ? st.player.x + st.distanceToThief * 9.5
                        : st.thief.x;

                    let thiefAction = 'idle';
                    let thiefFps = 4.5;
                    let thiefFrameIndex = 0;

                    if (st.gameMode === 'mission') {
                        thiefAction = 'correr';
                        thiefFps = 7.0;
                        st.thief.facingRight = true;
                        st.thief.animTimer += (dt * thiefFps) * st.gameSpeed;
                        if (st.thief.animTimer >= 5) st.thief.animTimer %= 5;
                        thiefFrameIndex = Math.floor(st.thief.animTimer) % 5;
                    } else {
                        st.thief.facingRight = false;
                        if (st.thief.hitFlash > 0) {
                            thiefAction = 'atacar';
                            const hitProgress = Math.max(0, Math.min(1, (12 - st.thief.hitFlash) / 12));
                            thiefFrameIndex = Math.min(4, Math.floor(hitProgress * 5));
                        } else {
                            thiefAction = 'idle';
                            thiefFps = 4.5;
                            st.thief.animTimer += (dt * thiefFps) * st.gameSpeed;
                            if (st.thief.animTimer >= 5) st.thief.animTimer %= 5;
                            thiefFrameIndex = Math.floor(st.thief.animTimer) % 5;
                        }
                    }

                    const thiefFrameList = thiefTextures[thiefAction] || thiefTextures['idle'] || thiefTextures['correr'] || [];
                    const curThiefTex = thiefFrameList[thiefFrameIndex] || thiefCharTex;
                    if (curThiefTex) {
                        thiefSprite.texture = curThiefTex;
                        const targetHeight = 110;
                        const tScaleFactor = targetHeight / (curThiefTex.height || 724);
                        thiefSprite.scale.set(st.thief.facingRight ? tScaleFactor : -tScaleFactor, tScaleFactor);
                    }

                    if (st.thief.hitFlash > 0) {
                        thiefSprite.tint = 0xff5555;
                    } else {
                        thiefSprite.tint = 0xffffff;
                    }

                    thiefContainer.position.set(thiefScreenX, GROUND_Y + st.thief.bobbing);

                    // Si el ladrón está fuera de pantalla a la derecha, ocultar sprite y sombra para asegurar cero desbordes
                    const isThiefFarOffscreen = thiefScreenX > V_WIDTH + 60;
                    thiefSprite.visible = !isThiefFarOffscreen;

                    thiefShadow.clear();
                    if (!isThiefFarOffscreen) {
                        thiefShadow.ellipse(thiefScreenX, GROUND_Y, 26, 5.5);
                        thiefShadow.fill({ color: 0x000000, alpha: 0.38 });
                    }

                    // Badge del ladrón
                    badgeBg.clear();
                    if (st.gameMode === 'mission') {
                        if (thiefScreenX > V_WIDTH - 60) {
                            // Cuando el choro sale de pantalla a la derecha, fijar aviso de escape en el margen derecho
                            thiefBadge.position.set((V_WIDTH - 90) - thiefScreenX, -110);
                            badgeBg.roundRect(-60, -9, 120, 20, 6);
                            badgeBg.fill({ color: 0xd91f26 });
                            badgeText.text = `🏃 ¡FUGANDO! ${Math.round(st.distanceToThief)}m ➔`;
                            badgeText.position.set(0, 1);
                        } else {
                            thiefBadge.position.set(0, 0);
                            badgeBg.roundRect(-30, -118, 60, 16, 4);
                            badgeBg.fill({ color: 0xe62329 });
                            badgeText.text = '¡CHORO!';
                            badgeText.position.set(0, -110);
                        }
                    } else {
                        thiefBadge.position.set(0, 0);
                        badgeBg.roundRect(-50, -118, 100, 16, 4);
                        badgeBg.fill({ color: 0x059669 });
                        badgeText.text = 'SPARRING: LADRÓN';
                        badgeText.position.set(0, -110);
                    }
                }

                // ------------------------------------------
                // J. Partículas y Textos Flotantes
                // ------------------------------------------
                fxContainer.removeChildren();

                if (st.particles.length > 0) {
                    const pGfx = new Graphics();
                    st.particles.forEach((p) => {
                        p.x += p.vx * timeScale;
                        p.y += p.vy * timeScale;
                        p.vy += 0.15 * timeScale;
                        p.life -= 0.035 * timeScale;
                        if (p.life > 0) {
                            pGfx.circle(p.x, p.y, Math.max(1, p.life * 3.5));
                            pGfx.fill({ color: p.color, alpha: p.life });
                        }
                    });
                    st.particles = st.particles.filter((p) => p.life > 0);
                    fxContainer.addChild(pGfx);
                }

                if (st.floatingTexts.length > 0) {
                    st.floatingTexts.forEach((ft) => {
                        ft.y += ft.vy * timeScale;
                        ft.opacity -= 0.025 * timeScale;
                        if (ft.opacity > 0) {
                            const ftStyle = new TextStyle({
                                fontFamily: 'monospace',
                                fontSize: 15,
                                fontWeight: '900',
                                fill: ft.color,
                                stroke: { color: 0x000000, width: 4 }
                            });
                            const txt = new Text({ text: ft.text, style: ftStyle });
                            txt.anchor.set(0.5, 0.5);
                            txt.position.set(ft.x, ft.y);
                            txt.alpha = Math.min(1, ft.opacity);
                            fxContainer.addChild(txt);
                        }
                    });
                    st.floatingTexts = st.floatingTexts.filter((ft) => ft.opacity > 0);
                }
            });
        }

        initPixi();

        return () => {
            isDestroyed = true;
            const currentApp = appRef.current;
            appRef.current = null;
            if (currentApp) {
                safeDestroy(currentApp);
            }
        };
    }, [activeChar, thiefChar]);

    return (
        <div
            ref={containerRef}
            className="w-full h-full relative overflow-hidden select-none bg-[#0e0f14]"
            onClick={triggerAttack}
        />
    );
});
