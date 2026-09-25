'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ActionConfig, FrameSlice } from './types';
import { PlayCircle, Grid, Eye, Layers, SkipBack, Play, Pause, SkipForward } from 'lucide-react';

interface AnimationPlayerProps {
    action: ActionConfig;
    slices: FrameSlice[];
    activeFrameIndex: number;
    setActiveFrameIndex: (idx: number) => void;
    imageElement: HTMLImageElement | null;
    onChangeConfig: (updated: Partial<ActionConfig>) => void;
}

export const AnimationPlayer: React.FC<AnimationPlayerProps> = ({
    action,
    slices,
    activeFrameIndex,
    setActiveFrameIndex,
    imageElement,
    onChangeConfig
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isPlaying, setIsPlaying] = useState<boolean>(true);
    // Modo de zoom: 'fit' ajusta al contenedor sin deformar; 1, 2, 3, 4 aplican escalado exacto
    const [zoom, setZoom] = useState<'fit' | 1 | 2 | 3 | 4>('fit');
    const [bgTheme, setBgTheme] = useState<'checker' | 'dark' | 'street'>('checker');

    // Estado interno para timing preciso de requestAnimationFrame
    const animRef = useRef<number | null>(null);
    const lastFrameTimeRef = useRef<number>(0);
    const currentFrameFloatRef = useRef<number>(0);

    // Cuando cambie la acción o los slices, reiniciar al frame 0
    useEffect(() => {
        currentFrameFloatRef.current = 0;
        setActiveFrameIndex(0);
        lastFrameTimeRef.current = performance.now();
    }, [action.name, slices.length, setActiveFrameIndex]);

    // Loop de renderizado continuo en Canvas
    useEffect(() => {
        let isCancelled = false;

        const loop = (timestamp: number) => {
            if (isCancelled) return;

            const canvas = canvasRef.current;
            if (!canvas) {
                animRef.current = requestAnimationFrame(loop);
                return;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Delta time para avance de frames
            const elapsed = timestamp - lastFrameTimeRef.current;
            const frameDuration = 1000 / (action.fps || 10);

            if (isPlaying && slices.length > 0 && elapsed >= frameDuration) {
                lastFrameTimeRef.current = timestamp - (elapsed % frameDuration);

                let nextFrame = currentFrameFloatRef.current + 1;
                if (nextFrame >= slices.length) {
                    if (action.loop) {
                        nextFrame = 0;
                    } else {
                        nextFrame = slices.length - 1;
                        setIsPlaying(false);
                    }
                }
                currentFrameFloatRef.current = nextFrame;
                setActiveFrameIndex(nextFrame);
            }

            // Dimensiones internas nativas del frame actual (1:1 con la celda)
            const curSlice = slices[activeFrameIndex] || slices[0];
            const targetW = curSlice ? curSlice.width : 160;
            const targetH = curSlice ? curSlice.height : 160;

            if (canvas.width !== targetW || canvas.height !== targetH) {
                canvas.width = targetW;
                canvas.height = targetH;
            }

            ctx.clearRect(0, 0, targetW, targetH);

            // Fondo según selección
            if (bgTheme === 'checker') {
                const patSize = Math.max(8, Math.round(targetW / 12));
                for (let px = 0; px < targetW; px += patSize) {
                    for (let py = 0; py < targetH; py += patSize) {
                        const isEven = ((px / patSize) + (py / patSize)) % 2 === 0;
                        ctx.fillStyle = isEven ? '#1e293b' : '#0f172a';
                        ctx.fillRect(px, py, patSize, patSize);
                    }
                }
            } else if (bgTheme === 'dark') {
                ctx.fillStyle = '#0a0d14';
                ctx.fillRect(0, 0, targetW, targetH);
            } else if (bgTheme === 'street') {
                ctx.fillStyle = '#1e1b2e';
                ctx.fillRect(0, 0, targetW, targetH * 0.75);
                ctx.fillStyle = '#111827';
                ctx.fillRect(0, targetH * 0.75, targetW, targetH * 0.25);
                ctx.fillStyle = '#374151';
                ctx.fillRect(0, targetH * 0.75, targetW, 3);
            }

            // Dibujar el frame recortado con pixel-art perfecto
            ctx.imageSmoothingEnabled = false;

            if (imageElement && curSlice && imageElement.complete && imageElement.naturalWidth > 0) {
                // Sombra suave bajo el personaje
                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.beginPath();
                ctx.ellipse(targetW / 2, targetH - Math.max(6, targetH * 0.03), (targetW * 0.35), Math.max(4, targetH * 0.02), 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.drawImage(
                    imageElement,
                    curSlice.x,
                    curSlice.y,
                    curSlice.width,
                    curSlice.height,
                    0,
                    0,
                    targetW,
                    targetH
                );
            }

            animRef.current = requestAnimationFrame(loop);
        };

        animRef.current = requestAnimationFrame(loop);

        return () => {
            isCancelled = true;
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
    }, [isPlaying, action.fps, action.loop, slices, activeFrameIndex, bgTheme, imageElement, setActiveFrameIndex]);

    const handleStep = useCallback((step: number) => {
        setIsPlaying(false);
        if (slices.length === 0) return;
        const next = (activeFrameIndex + step + slices.length) % slices.length;
        currentFrameFloatRef.current = next;
        setActiveFrameIndex(next);
    }, [activeFrameIndex, slices.length, setActiveFrameIndex]);

    const handleTogglePlay = () => {
        if (!isPlaying && activeFrameIndex >= slices.length - 1 && !action.loop) {
            currentFrameFloatRef.current = 0;
            setActiveFrameIndex(0);
        }
        setIsPlaying(!isPlaying);
    };

    const curSlice = slices[activeFrameIndex] || slices[0];
    const targetW = curSlice ? curSlice.width : 200;
    const targetH = curSlice ? curSlice.height : 200;

    return (
        <div
            style={{
                background: '#131824',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
            }}
        >
            {/* Header del reproductor con stats */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PlayCircle size={18} color="#60a5fa" />
                    <div>
                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
                            Previsualización en Vivo: {action.label}
                        </h3>
                        <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                            Frame {slices.length > 0 ? activeFrameIndex + 1 : 0} de {slices.length} | {action.fps} FPS
                        </p>
                    </div>
                </div>

                {/* Badges de zoom y fondo */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Zoom:</span>
                    {(['fit', 1, 2, 3, 4] as const).map((z) => (
                        <button
                            key={z}
                            onClick={() => setZoom(z)}
                            style={{
                                background: zoom === z ? '#3b82f6' : '#1e293b',
                                border: '1px solid #334155',
                                color: zoom === z ? '#fff' : '#94a3b8',
                                borderRadius: '4px',
                                padding: '2px 8px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                        >
                            {z === 'fit' ? 'Ajustar' : `${z}x`}
                        </button>
                    ))}

                    <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '6px' }}>Fondo:</span>
                    <button
                        onClick={() => setBgTheme(bgTheme === 'checker' ? 'dark' : bgTheme === 'dark' ? 'street' : 'checker')}
                        title="Cambiar fondo (Cuadrícula / Oscuro / Calle)"
                        style={{
                            background: '#1e293b',
                            border: '1px solid #334155',
                            color: '#94a3b8',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}
                    >
                        {bgTheme === 'checker' ? (
                            <>
                                <Grid size={12} />
                                <span>Cuadrícula</span>
                            </>
                        ) : bgTheme === 'dark' ? (
                            <>
                                <Eye size={12} />
                                <span>Oscuro</span>
                            </>
                        ) : (
                            <>
                                <Layers size={12} />
                                <span>Calle</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Canvas de animación con aspect-ratio bloqueado para eliminar cualquier deformación */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '360px',
                    maxHeight: '400px',
                    background: '#090d16',
                    borderRadius: '8px',
                    border: '1px solid #1e293b',
                    padding: '16px',
                    position: 'relative',
                    overflow: 'auto',
                    boxSizing: 'border-box'
                }}
            >
                <canvas
                    ref={canvasRef}
                    style={{
                        display: 'block',
                        imageRendering: 'pixelated',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
                        borderRadius: '6px',
                        flexShrink: 0,
                        aspectRatio: `${targetW} / ${targetH}`,
                        width: zoom === 'fit' ? 'auto' : `${targetW * (typeof zoom === 'number' ? zoom : 1)}px`,
                        height: zoom === 'fit' ? '100%' : `${targetH * (typeof zoom === 'number' ? zoom : 1)}px`,
                        maxHeight: zoom === 'fit' ? '100%' : undefined,
                        maxWidth: zoom === 'fit' ? '100%' : undefined,
                        objectFit: 'contain'
                    }}
                />

                {/* Overlay de estado de reproducción */}
                <div
                    style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: 'rgba(15, 23, 42, 0.85)',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        color: isPlaying ? '#10b981' : '#f59e0b',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    <span
                        style={{
                            display: 'inline-block',
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: isPlaying ? '#10b981' : '#f59e0b'
                        }}
                    ></span>
                    {isPlaying ? 'EN REPRODUCCIÓN' : 'PAUSADO'}
                </div>
            </div>

            {/* Barra de Controles: Play, Pasos, Scrubbing, FPS y Loop */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    background: '#0f172a',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #1e293b'
                }}
            >
                {/* Botones de transporte */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                            onClick={() => handleStep(-1)}
                            title="Frame anterior"
                            style={{
                                background: '#1e293b',
                                border: '1px solid #334155',
                                color: '#fff',
                                borderRadius: '6px',
                                padding: '7px 12px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <SkipBack size={14} />
                        </button>

                        <button
                            onClick={handleTogglePlay}
                            style={{
                                background: isPlaying ? '#ef4444' : '#10b981',
                                border: 'none',
                                color: '#fff',
                                borderRadius: '6px',
                                padding: '7px 16px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            {isPlaying ? (
                                <>
                                    <Pause size={14} />
                                    <span>Pausar</span>
                                </>
                            ) : (
                                <>
                                    <Play size={14} />
                                    <span>Reproducir</span>
                                </>
                            )}
                        </button>

                        <button
                            onClick={() => handleStep(1)}
                            title="Siguiente frame"
                            style={{
                                background: '#1e293b',
                                border: '1px solid #334155',
                                color: '#fff',
                                borderRadius: '6px',
                                padding: '7px 12px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <SkipForward size={14} />
                        </button>
                    </div>

                    {/* Loop Toggle */}
                    <label
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12px',
                            color: '#94a3b8',
                            cursor: 'pointer'
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={action.loop}
                            onChange={(e) => onChangeConfig({ loop: e.target.checked })}
                            style={{ cursor: 'pointer' }}
                        />
                        <span>Bucle Infinito (Loop)</span>
                    </label>

                    {/* Slider de FPS */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Velocidad:</span>
                        <input
                            type="range"
                            min="3"
                            max="24"
                            value={action.fps || 10}
                            onChange={(e) => onChangeConfig({ fps: parseInt(e.target.value) || 10 })}
                            style={{ width: '90px', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#f59e0b', minWidth: '42px' }}>
                            {action.fps || 10} FPS
                        </span>
                    </div>
                </div>

                {/* Barra de progreso de frames tipo scrub */}
                {slices.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>F1</span>
                        <input
                            type="range"
                            min="0"
                            max={slices.length - 1}
                            value={activeFrameIndex}
                            onChange={(e) => {
                                setIsPlaying(false);
                                const idx = parseInt(e.target.value) || 0;
                                currentFrameFloatRef.current = idx;
                                setActiveFrameIndex(idx);
                            }}
                            style={{ flex: 1, cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '10px', color: '#64748b' }}>F{slices.length}</span>
                    </div>
                )}
            </div>
        </div>
    );
};
