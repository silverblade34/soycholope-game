'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export default function CapituloUnoPage() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // Estado del juego
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'qte' | 'win' | 'gameover'>('playing');
    const [distanceToThief, setDistanceToThief] = useState<number>(35); // metros
    const [totalDistance, setTotalDistance] = useState<number>(0);
    const [lives, setLives] = useState<number>(3);
    const [qteKeys] = useState<string[]>(['ArrowUp', 'ArrowDown', 'ArrowRight']);
    const [qteIndex, setQteIndex] = useState<number>(0);
    const [qteTimeLeft, setQteTimeLeft] = useState<number>(3); // 3 segundos para reaccionar
    const [qteMessage, setQteMessage] = useState<string>('');

    // Referencias mutables para el loop de juego a 60 FPS
    const stateRef = useRef({
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
            speed: 5.8,
            jumpStrength: -13.5,
            gravity: 0.65,
            isGrounded: true,
            facingRight: true,
            width: 110,
            height: 110,
            bobbing: 0,
            runCycle: 0,
            isMoving: false,
            particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string }[]
        },
        thief: {
            x: 520,
            y: 0,
            speed: 4.8, // ligeramente más lento para que el jugador pueda alcanzarlo si corre
            bobbing: 0,
            runCycle: 0
        },
        keys: {
            left: false,
            right: false,
            jump: false
        }
    });

    // Sincronizar estado React con Ref
    useEffect(() => {
        stateRef.current.gameState = gameState;
    }, [gameState]);

    useEffect(() => {
        stateRef.current.lives = lives;
    }, [lives]);

    const handleQteFail = () => {
        setLives((prev) => {
            const next = prev - 1;
            if (next <= 0) {
                setGameState('gameover');
            } else {
                setQteMessage('¡El choro te golpeó y escapó más adelante!');
                setTimeout(() => {
                    // El ladrón se aleja 45 metros
                    stateRef.current.distanceToThief = 45;
                    setDistanceToThief(45);
                    setGameState('playing');
                }, 1200);
            }
            return next;
        });
    };

    const handleQteSuccess = () => {
        setGameState('win');
    };

    const startQte = () => {
        setQteIndex(0);
        setQteTimeLeft(3.5);
        setQteMessage('¡Presiona la secuencia antes de que te ataque!');
        setGameState('qte');
    };

    // Timer para el Quick Time Event
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
    }, [gameState]);

    // Escuchador de teclado para juego y QTE
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            // Manejo de QTE si está activo
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
                    // Tecla equivocada
                    handleQteFail();
                }
                return;
            }

            if (e.code === 'ArrowRight' || e.code === 'KeyD') stateRef.current.keys.right = true;
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') stateRef.current.keys.left = true;
            if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
                if (!stateRef.current.keys.jump && stateRef.current.player.isGrounded) {
                    stateRef.current.player.vy = stateRef.current.player.jumpStrength;
                    stateRef.current.player.isGrounded = false;
                }
                stateRef.current.keys.jump = true;
            }
        };

        const onKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'ArrowRight' || e.code === 'KeyD') stateRef.current.keys.right = false;
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') stateRef.current.keys.left = false;
            if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') stateRef.current.keys.jump = false;
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, [qteIndex, qteKeys]);

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
            idle: new Image(),
            jump: new Image(),
            attack: new Image()
        };

        assets.sky.src = '/fondo-cielo.png';
        assets.foreground.src = '/primer-plano.png';
        assets.character.src = '/personaje-base.png';
        assets.run.src = '/sprites/cholo/correr.png';
        assets.idle.src = '/sprites/cholo/idle.png';
        assets.jump.src = '/sprites/cholo/saltar.png';
        assets.attack.src = '/sprites/cholo/ataque_tacle.png';

        let charCrop = { x: 0, y: 0, w: 100, h: 100 };

        assets.character.onload = () => {
            // Trim automático
            const im = assets.character;
            const w = im.naturalWidth || im.width;
            const h = im.naturalHeight || im.height;
            const temp = document.createElement('canvas');
            temp.width = w;
            temp.height = h;
            const tctx = temp.getContext('2d');
            if (!tctx) return;
            tctx.drawImage(im, 0, 0);
            try {
                const imgData = tctx.getImageData(0, 0, w, h);
                const data = imgData.data;
                let minX = w, minY = h, maxX = 0, maxY = 0;
                let found = false;
                for (let y = 0; y < h; y += 2) {
                    for (let x = 0; x < w; x += 2) {
                        if (data[(y * w + x) * 4 + 3] > 20) {
                            if (x < minX) minX = x;
                            if (x > maxX) maxX = x;
                            if (y < minY) minY = y;
                            if (y > maxY) maxY = y;
                            found = true;
                        }
                    }
                }
                if (found) {
                    charCrop = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
                }
            } catch {
                charCrop = { x: 0, y: 0, w, h };
            }
        };

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
            const _dt = (timestamp - lastTime) / 1000;
            void _dt;
            lastTime = timestamp;

            const st = stateRef.current;

            if (st.gameState === 'playing') {
                // Movimiento del jugador
                if (st.keys.right) {
                    st.player.vx = st.player.speed;
                    st.player.facingRight = true;
                    st.player.isMoving = true;
                } else if (st.keys.left) {
                    st.player.vx = -st.player.speed;
                    st.player.facingRight = false;
                    st.player.isMoving = true;
                } else {
                    st.player.vx = 0;
                    st.player.isMoving = false;
                }

                // Scroll del mundo y cálculo de distancia
                const screenCenter = V_WIDTH * 0.42;
                if (st.player.vx > 0) {
                    if (st.player.x < screenCenter) {
                        st.player.x += st.player.vx;
                    } else {
                        st.worldScrollX += st.player.vx;
                        st.totalDistance += st.player.vx * 0.08;
                    }
                } else if (st.player.vx < 0) {
                    if (st.player.x > 80) {
                        st.player.x += st.player.vx;
                    } else if (st.worldScrollX > 0) {
                        st.worldScrollX += st.player.vx;
                        st.totalDistance = Math.max(0, st.totalDistance + st.player.vx * 0.08);
                    }
                }

                // Físicas del salto y gravedad
                st.player.vy += st.player.gravity;
                st.player.y += st.player.vy;
                st.player.groundY = V_HEIGHT - st.player.height - 40;

                if (st.player.y >= st.player.groundY) {
                    st.player.y = st.player.groundY;
                    st.player.vy = 0;
                    st.player.isGrounded = true;
                }

                // Rebote al correr
                if (st.player.isMoving && st.player.isGrounded) {
                    st.player.runCycle += 0.28;
                    st.player.bobbing = Math.sin(st.player.runCycle) * 4;
                } else {
                    st.player.runCycle += 0.04;
                    st.player.bobbing = Math.sin(st.player.runCycle) * 1.5;
                }

                // Movimiento del Ladrón (Choro)
                st.thief.runCycle += 0.26;
                st.thief.bobbing = Math.sin(st.thief.runCycle) * 4;

                // El ladrón corre hacia adelante por la pista
                const relativeSpeed = st.player.vx - st.thief.speed;
                st.distanceToThief -= relativeSpeed * 0.04;

                // Actualizar contador en UI de React cada medio segundo
                if (Math.random() < 0.1) {
                    setDistanceToThief(Math.max(1, Math.round(st.distanceToThief)));
                    setTotalDistance(Math.floor(st.totalDistance));
                }

                // ==========================================
                // REGLAS DEL JUEGO
                // ==========================================
                // 1. Si se aleja más de 100 metros: ¡Perdiste el celular!
                if (st.distanceToThief >= 100) {
                    setGameState('gameover');
                }
                // 2. Si estás a menos de 5 metros: ¡Momento de atraparlo!
                else if (st.distanceToThief <= 4) {
                    startQte();
                }
            }

            // ==========================================
            // RENDERIZADO
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

            // 1. Fondo cielo (Parallax 0.22x)
            drawParallax(assets.sky, st.worldScrollX, 0.22);

            // 2. Casas y Pista de Lima (Parallax 1.0x)
            drawParallax(assets.foreground, st.worldScrollX, 1.0);

            // 3. Renderizar Ladrón (Choro con capucha negra y celular robado en mano)
            // Se ubica en base a la distancia actual en pantalla
            const thiefScreenX = Math.min(
                V_WIDTH - 120,
                Math.max(st.player.x + 60, st.player.x + st.distanceToThief * 9)
            );
            const thiefY = V_HEIGHT - 140 + st.thief.bobbing;

            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.beginPath();
            ctx.ellipse(thiefScreenX + 45, V_HEIGHT - 38, 35, 7, 0, 0, Math.PI * 2);
            ctx.fill();

            // Dibujar silueta estilizada del ladrón en pixel art
            ctx.translate(thiefScreenX, thiefY);
            // Cuerpo / polera negra con capucha
            ctx.fillStyle = '#1c1917';
            ctx.fillRect(15, 20, 50, 60);
            // Cabeza encapuchada
            ctx.fillStyle = '#0c0a09';
            ctx.fillRect(20, 0, 40, 30);
            // Lentes oscuros
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(40, 10, 16, 6);
            // Celular robado en mano (brillante con pantalla encendida)
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(65, 30, 10, 16);
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(66, 32, 8, 12);
            // Piernas zancada
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(20, 75, 14, 25);
            ctx.fillRect(45, 75, 14, 25);
            // Zapatillas
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(16, 96, 20, 8);
            ctx.fillRect(45, 96, 20, 8);

            // Cartel flotante sobre el choro
            ctx.fillStyle = '#e62329';
            ctx.fillRect(10, -24, 60, 16);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px monospace';
            ctx.fillText('¡CHORO!', 18, -13);

            ctx.restore();

            // 4. Renderizar Protagonista con el sprite correspondiente (idle, correr, saltar, ataque)
            let activeSpriteImg = assets.character;
            let totalFrames = 1;
            let animFps = 8;

            if (st.gameState === 'qte' && assets.attack.complete && assets.attack.naturalWidth > 0) {
                activeSpriteImg = assets.attack;
                totalFrames = 4;
                animFps = 9;
            } else if (!st.player.isGrounded && assets.jump.complete && assets.jump.naturalWidth > 0) {
                activeSpriteImg = assets.jump;
                totalFrames = 4;
                animFps = 8;
            } else if (st.player.isMoving && assets.run.complete && assets.run.naturalWidth > 0) {
                activeSpriteImg = assets.run;
                totalFrames = 5;
                animFps = 10;
            } else if (assets.idle.complete && assets.idle.naturalWidth > 0) {
                activeSpriteImg = assets.idle;
                totalFrames = 4;
                animFps = 5;
            }

            if (activeSpriteImg.complete && activeSpriteImg.naturalWidth > 0) {
                const charX = st.player.x;
                const charY = st.player.y + st.player.bobbing;
                const drawH = st.player.height;
                const drawW = drawH;

                // Sombra en calzada
                ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
                ctx.beginPath();
                ctx.ellipse(charX + drawW / 2, V_HEIGHT - 38, (drawW / 2) * 0.7, 7, 0, 0, Math.PI * 2);
                ctx.fill();

                // Si es spritesheet horizontal (ancho mayor a alto), extraer frame activo
                const isSheet = activeSpriteImg.naturalWidth > activeSpriteImg.naturalHeight * 1.5;
                let sx = charCrop.x;
                let sy = charCrop.y;
                let sw = charCrop.w;
                let sh = charCrop.h;

                if (isSheet) {
                    const frameW = activeSpriteImg.naturalWidth / totalFrames;
                    const frameH = activeSpriteImg.naturalHeight;
                    const fIdx = Math.floor((timestamp / (1000 / animFps)) % totalFrames);
                    sx = fIdx * frameW;
                    sy = 0;
                    sw = frameW;
                    sh = frameH;
                }

                ctx.save();
                if (!st.player.facingRight) {
                    ctx.translate(charX + drawW, charY);
                    ctx.scale(-1, 1);
                    ctx.drawImage(activeSpriteImg, sx, sy, sw, sh, 0, 0, drawW, drawH);
                } else {
                    ctx.drawImage(
                        activeSpriteImg,
                        sx,
                        sy,
                        sw,
                        sh,
                        charX,
                        charY,
                        drawW,
                        drawH
                    );
                }
                ctx.restore();
            }

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
        setDistanceToThief(35);
        setTotalDistance(0);
        setLives(3);
        setGameState('playing');
    };

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-black font-mono select-none">
            {/* Canvas */}
            <canvas ref={canvasRef} className="w-full h-full block" />

            {/* HUD Superior */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none z-20">
                <div className="flex flex-col gap-2">
                    <div className="bg-[#111]/90 border-2 border-[#e62329] px-3 py-1.5 rounded flex items-center gap-2 shadow-lg">
                        <span className="text-white font-black text-sm tracking-wider">CAPÍTULO 01</span>
                        <span className="bg-[#2b0003] border border-yellow-400 text-yellow-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            ¡ME ROBARON EL CELU!
                        </span>
                    </div>

                    {/* Vidas */}
                    <div className="flex gap-1.5 bg-black/70 border border-gray-700 px-3 py-1.5 rounded w-fit">
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
                </div>

                {/* Medidores de distancia */}
                <div className="flex flex-col items-end gap-2">
                    {/* Alerta de distancia con el choro */}
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
                </div>
            </div>

            {/* Guía de controles inferior */}
            <div className="absolute bottom-4 left-6 pointer-events-none z-20 hidden md:flex items-center gap-4 bg-black/75 border border-gray-700 px-4 py-2 rounded-lg text-xs text-gray-300 backdrop-blur">
                <div>
                    <span className="bg-gray-800 border border-gray-600 px-1.5 py-0.5 rounded text-white font-bold">
                        A
                    </span>{' '}
                    <span className="bg-gray-800 border border-gray-600 px-1.5 py-0.5 rounded text-white font-bold">
                        D
                    </span>{' '}
                    o Flechas para Correr
                </div>
                <div>
                    <span className="bg-gray-800 border border-gray-600 px-1.5 py-0.5 rounded text-white font-bold">
                        ESPACIO
                    </span>{' '}
                    Saltar
                </div>
                <div className="text-yellow-400 font-bold">🎯 Acércate a menos de 5m para recuperar tu celular</div>
            </div>

            {/* Quick Time Event (Ventana de Combate) */}
            {gameState === 'qte' && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-6 animate-fadeIn">
                    <div className="bg-[#181926] border-2 border-yellow-400 p-8 rounded-xl max-w-md w-full text-center shadow-2xl shadow-yellow-500/20">
                        <div className="inline-block bg-yellow-400 text-black font-black text-xs px-3 py-1 rounded mb-3 tracking-widest">
                            ¡YA LO ALCANZASTE!
                        </div>
                        <h2 className="text-2xl font-black text-white mb-2">¡QUITALE EL CELULAR!</h2>
                        <p className="text-xs text-gray-300 mb-6">{qteMessage}</p>

                        {/* Secuencia de teclas */}
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

                        {/* Barra de tiempo restante */}
                        <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden mb-4">
                            <div
                                className="bg-yellow-400 h-full transition-all duration-100"
                                style={{ width: `${(qteTimeLeft / 3.5) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Pantalla Game Over: Te faltó calle */}
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

            {/* Pantalla Victoria: ¡Recuperaste tu celular! */}
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
                            <Link
                                href="/"
                                className="border border-gray-600 text-gray-300 hover:bg-gray-800 font-bold text-xs px-4 py-3 rounded"
                            >
                                Siguiente Capítulo ➔
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
