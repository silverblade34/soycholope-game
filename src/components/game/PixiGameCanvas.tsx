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

export interface PixiGameCanvasRef {
    triggerAttack: () => void;
    triggerDamage: () => void;
    triggerDeath: () => void;
    revivePlayer: () => void;
    resetPosition: () => void;
    stepWalk: () => void;
    stepRun: () => void;
    jump: () => void;
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
    onGameOver?: () => void;
    onCatchThief?: () => void;
    onPlayerDeadChange?: (isDead: boolean) => void;
}

const V_WIDTH = 960;
const V_HEIGHT = 540;
const GROUND_Y = 475; // Nivel de la pista/calle donde tocan las zapatillas

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
        onPlayerDeadChange
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
        keys: {
            left: false,
            right: false,
            jump: false,
            sprint: false
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
            speed: 2.2,
            facingRight: false,
            recoilX: 0,
            hitFlash: 0,
            bobbing: 0,
            runCycle: 0,
            currentAction: 'correr',
            animTimer: 0
        },
        particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: number }[],
        floatingTexts: [] as { text: string; x: number; y: number; opacity: number; vy: number; color: string }[]
    });

    // Actualizar propiedades mutables en tiempo real
    useEffect(() => {
        stateRef.current.gameMode = gameMode;
        stateRef.current.gameSpeed = gameSpeed;
        stateRef.current.dummyActive = dummyActive;
    }, [gameMode, gameSpeed, dummyActive]);

    // Métodos expuestos al padre

    const callbacksRef = useRef({
        onActionChange,
        onHit,
        onDistanceChange,
        onGameOver,
        onCatchThief,
        onPlayerDeadChange
    });
    useEffect(() => {
        callbacksRef.current = {
            onActionChange,
            onHit,
            onDistanceChange,
            onGameOver,
            onCatchThief,
            onPlayerDeadChange
        };
    });

    const triggerAttack = () => {
        const st = stateRef.current;
        if (st.player.isAttacking || st.player.isDead) return;
        st.player.isAttacking = true;
        st.player.attackTimer = 0;
        playSfx('whoosh');

        // Comprobar impacto contra el ladrón
        const thiefScreenX = st.gameMode === 'mission'
            ? Math.min(V_WIDTH - 120, Math.max(st.player.x + 60, st.player.x + st.distanceToThief * 9))
            : st.thief.x;

        const isNear = Math.abs(thiefScreenX - (st.player.x + (st.player.facingRight ? 45 : -45))) < 90;
        const isFacing = (st.player.facingRight && thiefScreenX >= st.player.x) ||
                         (!st.player.facingRight && thiefScreenX <= st.player.x);

        if ((st.dummyActive || st.gameMode === 'mission') && isNear && isFacing) {
            setTimeout(() => {
                st.thief.recoilX = st.player.facingRight ? 24 : -24;
                st.thief.hitFlash = 12;
                st.hitCount += 1;
                callbacksRef.current.onHit?.(st.hitCount);
                playSfx('hit');

                const hitPhrases = ['¡POW!', '¡TOMA!', '¡ZAS!', '¡PUM!', '¡CON FUERZA!'];
                const text = hitPhrases[Math.floor(Math.random() * hitPhrases.length)];

                st.floatingTexts.push({
                    text,
                    x: thiefScreenX + (Math.random() * 20 - 10),
                    y: GROUND_Y - 45,
                    opacity: 1.0,
                    vy: -1.6,
                    color: '#facc15'
                });

                for (let i = 0; i < 9; i++) {
                    const ang = Math.random() * Math.PI * 2;
                    const spd = 2 + Math.random() * 4;
                    const colors = [0xfacc15, 0xf97316, 0xef4444, 0xffffff];
                    st.particles.push({
                        x: thiefScreenX,
                        y: GROUND_Y - 30,
                        vx: Math.cos(ang) * spd,
                        vy: Math.sin(ang) * spd,
                        life: 1.0,
                        color: colors[Math.floor(Math.random() * colors.length)]
                    });
                }
            }, 120);
        }
    };

    const triggerDamage = () => {
        const st = stateRef.current;
        if (st.player.isDead) return;
        st.player.isDamaged = true;
        st.player.damageTimer = 0;
        playSfx('punch');
        st.floatingTexts.push({
            text: '¡AUCH!',
            x: st.player.x + 10,
            y: GROUND_Y - 30,
            opacity: 1.0,
            vy: -1.5,
            color: '#ef4444'
        });
    };

    const triggerDeath = () => {
        const st = stateRef.current;
        st.player.isDead = true;
        st.player.deathTimer = 0;
        st.player.isAttacking = false;
        st.player.isDamaged = false;
        callbacksRef.current.onPlayerDeadChange?.(true);
        playSfx('death');
        st.floatingTexts.push({
            text: '¡DERROTADO!',
            x: st.player.x,
            y: GROUND_Y - 45,
            opacity: 1.0,
            vy: -1.2,
            color: '#f87171'
        });
    };

    const revivePlayer = () => {
        const st = stateRef.current;
        st.player.isDead = false;
        st.player.deathTimer = 0;
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
        st.thief.x = 480;
        st.player.isAttacking = false;
        st.player.isDamaged = false;
        st.player.isDead = false;
        callbacksRef.current.onPlayerDeadChange?.(false);
        callbacksRef.current.onDistanceChange?.(35, 0);
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
        if (st.player.isGrounded) {
            st.player.vy = st.player.jumpStrength;
            st.player.isGrounded = false;
            playSfx('jump');
        }
    };

    const actionsRef = useRef({
        triggerAttack,
        triggerDamage,
        triggerDeath,
        revivePlayer,
        resetPosition
    });
    useEffect(() => {
        actionsRef.current = {
            triggerAttack,
            triggerDamage,
            triggerDeath,
            revivePlayer,
            resetPosition
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
        jump
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

            if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
                if (!st.keys.jump && st.player.isGrounded) {
                    st.player.vy = st.player.jumpStrength;
                    st.player.isGrounded = false;
                    playSfx('jump');
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
        // Evitar que el plugin de resize de Pixi v8 falle si destroy se llama durante la inicialización
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

            // ==========================================
            // 1. CARGA DE TEXTURAS (PARALLAX & PERSONAJES)
            // ==========================================
            const [skyTex, streetTex] = await Promise.all([
                Assets.load('/fondo-cielo.png').catch(() => Texture.WHITE),
                Assets.load('/primer-plano.png').catch(() => Texture.WHITE)
            ]);

            // Cargar frames de Rubén (Protagonista)
            const playerActions = ['idle', 'caminar', 'correr', 'saltar', 'atacar', 'daño', 'muerte'];
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
            const thiefActions = ['correr', 'atacar'];
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
                thiefCharTex = thiefTextures['correr'][0] || Texture.WHITE;
            }

            if (isDestroyed) return;

            // ==========================================
            // 2. CONSTRUCCIÓN DE CAPAS GRÁFICAS PIXI
            // ==========================================
            // Capa 1: Cielo infinito
            const skySprite = new TilingSprite({
                texture: skyTex,
                width: V_WIDTH,
                height: V_HEIGHT
            });
            world.addChild(skySprite);

            // Capa 2: Calle y Casas (Primer plano)
            const streetSprite = new TilingSprite({
                texture: streetTex,
                width: V_WIDTH,
                height: V_HEIGHT
            });
            world.addChild(streetSprite);

            // Capa 3: Sombras en el suelo
            const playerShadow = new Graphics();
            const thiefShadow = new Graphics();
            world.addChild(thiefShadow);
            world.addChild(playerShadow);

            // Capa 4: Contenedor del Ladrón (Choro / Sparring Dummy)
            const thiefContainer = new Container();
            const thiefSprite = new Sprite(thiefCharTex);
            thiefSprite.anchor.set(0.5, 0.90); // Anclado exactamente en las suelas de las zapatillas
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

            // Capa 5: Contenedor de Rubén (Protagonista)
            const playerContainer = new Container();
            const playerSprite = new Sprite(playerTextures['idle'][0]);
            playerSprite.anchor.set(0.5, 0.90); // Anclado exactamente en las suelas de las zapatillas
            playerContainer.addChild(playerSprite);
            world.addChild(playerContainer);

            // Capa 6: Efectos de Partículas y Textos Flotantes
            const fxContainer = new Container();
            world.addChild(fxContainer);

            let lastActionLabel = 'IDLE';

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
                // B. Físicas y Movimiento de Rubén
                // ------------------------------------------
                const isSprint = st.keys.sprint;
                st.player.isSprinting = isSprint;
                const currentMoveSpeed = isSprint ? st.player.speedRun : st.player.speedWalk;

                if (!st.player.isDead) {
                    if (st.keys.right) {
                        st.player.facingRight = true;
                        st.player.isMoving = true;
                        st.player.vx = currentMoveSpeed;
                    } else if (st.keys.left) {
                        st.player.facingRight = false;
                        st.player.isMoving = true;
                        st.player.vx = -currentMoveSpeed;
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

                // Bobbing suave al caminar/correr
                if (st.player.isMoving && st.player.isGrounded && !st.player.isDead) {
                    st.player.runCycle += (isSprint ? 0.11 : 0.07) * timeScale;
                    st.player.bobbing = Math.sin(st.player.runCycle) * (isSprint ? 1.5 : 0.9);
                } else {
                    st.player.runCycle += 0.02 * timeScale;
                    st.player.bobbing = Math.sin(st.player.runCycle) * 0.5;
                }

                // ------------------------------------------
                // C. Físicas y Movimiento del Ladrón
                // ------------------------------------------
                st.thief.runCycle += 0.08 * timeScale;
                st.thief.bobbing = Math.sin(st.thief.runCycle) * 1.8;

                if (st.gameMode === 'mission') {
                    const relativeSpeed = st.player.vx - st.thief.speed;
                    st.distanceToThief -= (relativeSpeed * 0.020) * timeScale;

                    if (Math.random() < 0.08) {
                        callbacksRef.current.onDistanceChange?.(Math.max(1, Math.round(st.distanceToThief)), Math.floor(st.totalDistance));
                    }

                    if (st.distanceToThief >= 100) {
                        callbacksRef.current.onGameOver?.();
                    } else if (st.distanceToThief <= 4) {
                        callbacksRef.current.onCatchThief?.();
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

                // ------------------------------------------
                // D. Scroll de Parallax
                // ------------------------------------------
                skySprite.tilePosition.x = -(st.worldScrollX * 0.22);
                streetSprite.tilePosition.x = -st.worldScrollX;

                // ------------------------------------------
                // E. Animación y Renderizado de Rubén (Protagonista)
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
                    playerAction = 'idle';
                    playerFps = 4.0;
                    actionLabel = 'IDLE';
                    if (st.player.currentAction !== 'idle') {
                        st.player.currentAction = 'idle';
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
                    const scaleFactor = targetHeight / (curPlayerTex.height || 724);
                    playerSprite.scale.set(st.player.facingRight ? scaleFactor : -scaleFactor, scaleFactor);
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
                // F. Renderizado Real del Ladrón (Sprites)
                // ------------------------------------------
                const showThief = st.dummyActive || st.gameMode === 'mission';
                thiefContainer.visible = showThief;
                thiefShadow.visible = showThief;

                if (showThief) {
                    const thiefScreenX = st.gameMode === 'mission'
                        ? Math.min(V_WIDTH - 120, Math.max(st.player.x + 60, st.player.x + st.distanceToThief * 9))
                        : st.thief.x;

                    // Determinar acción y frame del ladrón
                    let thiefAction = 'correr';
                    let thiefFps = 7.0;
                    let thiefFrameIndex = 0;

                    if (st.gameMode === 'mission') {
                        // En misión el choro corre hacia adelante con el celular
                        thiefAction = 'correr';
                        thiefFps = 7.0;
                        st.thief.facingRight = true;
                        st.thief.animTimer += (dt * thiefFps) * st.gameSpeed;
                        if (st.thief.animTimer >= 5) st.thief.animTimer %= 5;
                        thiefFrameIndex = Math.floor(st.thief.animTimer) % 5;
                    } else {
                        // En modo práctica es sparring dummy
                        st.thief.facingRight = false; // Mirando hacia Rubén
                        if (st.thief.hitFlash > 6) {
                            thiefAction = 'atacar'; // Reacción de impacto/golpe
                            thiefFrameIndex = 2;
                        } else {
                            thiefAction = 'correr';
                            thiefFrameIndex = 0; // Postura firme de combate
                        }
                    }

                    const thiefFrameList = thiefTextures[thiefAction] || thiefTextures['correr'];
                    const curThiefTex = thiefFrameList[thiefFrameIndex] || thiefCharTex;
                    if (curThiefTex) {
                        thiefSprite.texture = curThiefTex;
                        const targetHeight = 110;
                        const tScaleFactor = targetHeight / (curThiefTex.height || 724);
                        thiefSprite.scale.set(st.thief.facingRight ? tScaleFactor : -tScaleFactor, tScaleFactor);
                    }

                    // Efecto de flash al ser golpeado
                    if (st.thief.hitFlash > 0) {
                        thiefSprite.tint = 0xff5555;
                    } else {
                        thiefSprite.tint = 0xffffff;
                    }

                    thiefContainer.position.set(thiefScreenX, GROUND_Y + st.thief.bobbing);

                    // Sombra del ladrón grounded en el pavimento
                    thiefShadow.clear();
                    thiefShadow.ellipse(thiefScreenX, GROUND_Y, 26, 5.5);
                    thiefShadow.fill({ color: 0x000000, alpha: 0.38 });

                    // Badge sobre el ladrón
                    badgeBg.clear();
                    if (st.gameMode === 'mission') {
                        badgeBg.roundRect(-30, -118, 60, 16, 4);
                        badgeBg.fill({ color: 0xe62329 });
                        badgeText.text = '¡CHORO!';
                        badgeText.position.set(0, -110);
                    } else {
                        badgeBg.roundRect(-55, -118, 110, 16, 4);
                        badgeBg.fill({ color: 0x059669 });
                        badgeText.text = '🎯 SPARRING: LADRÓN';
                        badgeText.position.set(0, -110);
                    }
                }

                // ------------------------------------------
                // G. Partículas y Textos Flotantes
                // ------------------------------------------
                fxContainer.removeChildren();

                // Dibujar partículas
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

                // Dibujar textos flotantes
                if (st.floatingTexts.length > 0) {
                    st.floatingTexts.forEach((ft) => {
                        ft.y += ft.vy * timeScale;
                        ft.opacity -= 0.025 * timeScale;
                        if (ft.opacity > 0) {
                            const ftStyle = new TextStyle({
                                fontFamily: 'monospace',
                                fontSize: 16,
                                fontWeight: '900',
                                fill: ft.color,
                                stroke: { color: 0x000000, width: 4 }
                            });
                            const txt = new Text({ text: ft.text, style: ftStyle });
                            txt.anchor.set(0.5, 0.5);
                            txt.position.set(ft.x, ft.y);
                            txt.alpha = ft.opacity;
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
