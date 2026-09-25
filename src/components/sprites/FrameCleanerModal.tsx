'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { FrameSlice } from './types';
import { Eraser, Undo2, RotateCcw, Check, X, ZoomIn, ZoomOut, Scissors, Sparkles } from 'lucide-react';

interface FrameCleanerModalProps {
    isOpen: boolean;
    onClose: () => void;
    frameIndex: number;
    actionName: string;
    slice: FrameSlice;
    imageElement: HTMLImageElement | null;
    initialCustomImage?: string;
    onSave: (cleanedDataUrl: string) => void;
    onResetToOriginal: () => void;
}

export const FrameCleanerModal: React.FC<FrameCleanerModalProps> = ({
    isOpen,
    onClose,
    frameIndex,
    actionName,
    slice,
    imageElement,
    initialCustomImage,
    onSave,
    onResetToOriginal
}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
    const [brushSize, setBrushSize] = useState<number>(20);
    const [zoom, setZoom] = useState<number>(2); // 2x por defecto para ver bien los pixeles
    const [history, setHistory] = useState<ImageData[]>([]);
    const [leftMarginPx, setLeftMarginPx] = useState<number>(30);

    // Guardar snapshot para deshacer
    const pushSnapshot = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory((prev) => [...prev.slice(-20), data]);
    }, []);

    // Inicializar canvas con la imagen recortada o custom
    const initCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !slice || slice.width <= 0 || slice.height <= 0) return;

        canvas.width = slice.width;
        canvas.height = slice.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;

        if (initialCustomImage) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                pushSnapshot();
            };
            img.src = initialCustomImage;
        } else if (imageElement && imageElement.complete && imageElement.naturalWidth > 0) {
            ctx.drawImage(
                imageElement,
                slice.x,
                slice.y,
                slice.width,
                slice.height,
                0,
                0,
                slice.width,
                slice.height
            );
            pushSnapshot();
        }
    }, [initialCustomImage, imageElement, slice, pushSnapshot]);

    useEffect(() => {
        if (!isOpen) return;

        const timer = setTimeout(() => {
            setHistory([]);
            initCanvas();
        }, 20);

        return () => clearTimeout(timer);
    }, [isOpen, initCanvas]);

    // Deshacer última acción
    const handleUndo = () => {
        if (history.length <= 1) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const newHistory = [...history];
        newHistory.pop(); // Quitar estado actual
        const previousState = newHistory[newHistory.length - 1];
        if (previousState) {
            ctx.putImageData(previousState, 0, 0);
            setHistory(newHistory);
        }
    };

    // Coordenadas relativas al canvas interno
    const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    // Iniciar borrado libre
    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const coords = getCanvasCoords(e);
        setIsDrawing(true);
        setLastPos(coords);

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Borrar punto inicial
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    };

    // Mover cursor y trazo
    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const coords = getCanvasCoords(e);

        if (!isDrawing || !lastPos) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(lastPos.x, lastPos.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(coords.x, coords.y, brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        setLastPos(coords);
    };

    const handlePointerUp = () => {
        if (isDrawing) {
            setIsDrawing(false);
            setLastPos(null);
            pushSnapshot();
        }
    };

    // Borrado inteligente del margen izquierdo (para sangrado de frame anterior)
    const handleClearLeftMargin = (px: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillRect(0, 0, px, canvas.height);
        ctx.restore();

        pushSnapshot();
    };

    // Guardar cambios
    const handleSave = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dataUrl = canvas.toDataURL('image/png');
        onSave(dataUrl);
        onClose();
    };

    // Restablecer al recorte original de la hoja de sprites
    const handleReset = () => {
        const canvas = canvasRef.current;
        if (!canvas || !imageElement) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(
            imageElement,
            slice.x,
            slice.y,
            slice.width,
            slice.height,
            0,
            0,
            slice.width,
            slice.height
        );
        pushSnapshot();
        onResetToOriginal();
    };

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(8px)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}
        >
            <div
                style={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '16px',
                    width: '100%',
                    maxWidth: '920px',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(59, 130, 246, 0.2)',
                    overflow: 'hidden'
                }}
            >
                {/* Header */}
                <div
                    style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid #1e293b',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: '#131824'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                            style={{
                                width: '32px',
                                height: '32px',
                                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff'
                            }}
                        >
                            <Eraser size={18} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#f8fafc' }}>
                                Pincel Borrador Inteligente — Frame #{frameIndex + 1} ({actionName.toUpperCase()})
                            </h2>
                            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
                                Borra artefactos, colas o sangrado de otros frames dejándolos transparentes sin alterar el resto de la hoja.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: '6px'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Barra de Herramientas / Toolbar */}
                <div
                    style={{
                        padding: '12px 20px',
                        background: '#1e293b',
                        borderBottom: '1px solid #334155',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px'
                    }}
                >
                    {/* Tamaño de Pincel */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#cbd5e1' }}>
                            Tamaño de Pincel:
                        </span>
                        <input
                            type="range"
                            min="4"
                            max="70"
                            value={brushSize}
                            onChange={(e) => setBrushSize(parseInt(e.target.value))}
                            style={{ width: '90px', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '11px', color: '#60a5fa', fontWeight: 800, width: '32px' }}>
                            {brushSize}px
                        </span>

                        {/* Presets rápidos */}
                        {[8, 16, 28, 45].map((sz) => (
                            <button
                                key={sz}
                                onClick={() => setBrushSize(sz)}
                                style={{
                                    background: brushSize === sz ? '#3b82f6' : '#0f172a',
                                    border: '1px solid #334155',
                                    color: brushSize === sz ? '#fff' : '#94a3b8',
                                    borderRadius: '4px',
                                    padding: '2px 6px',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                {sz}p
                            </button>
                        ))}
                    </div>

                    {/* Acciones directas y Deshacer */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            onClick={handleUndo}
                            disabled={history.length <= 1}
                            title="Deshacer último trazo (Ctrl+Z)"
                            style={{
                                background: history.length > 1 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(51, 65, 85, 0.4)',
                                border: '1px solid #334155',
                                color: history.length > 1 ? '#60a5fa' : '#64748b',
                                borderRadius: '6px',
                                padding: '5px 10px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: history.length > 1 ? 'pointer' : 'not-allowed',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            <Undo2 size={13} />
                            <span>Deshacer</span>
                        </button>

                        <button
                            onClick={handleReset}
                            title="Restablecer este frame al recorte original sin ediciones"
                            style={{
                                background: 'transparent',
                                border: '1px solid #475569',
                                color: '#94a3b8',
                                borderRadius: '6px',
                                padding: '5px 10px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            <RotateCcw size={12} />
                            <span>Original</span>
                        </button>

                        {/* Controles de Zoom */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
                            <button
                                onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
                                style={{ background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', padding: '4px', cursor: 'pointer' }}
                            >
                                <ZoomOut size={12} />
                            </button>
                            <span style={{ fontSize: '11px', color: '#94a3b8', minWidth: '24px', textAlign: 'center' }}>
                                {zoom}x
                            </span>
                            <button
                                onClick={() => setZoom((z) => Math.min(4, z + 0.5))}
                                style={{ background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px', padding: '4px', cursor: 'pointer' }}
                            >
                                <ZoomIn size={12} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Barra de Solución Rápida: Limpiar Borde Izquierdo */}
                <div
                    style={{
                        padding: '8px 20px',
                        background: 'rgba(59, 130, 246, 0.08)',
                        borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Scissors size={14} color="#60a5fa" />
                        <span style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600 }}>
                            Limpieza Rápida de Sangrado Izquierdo:
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {[15, 30, 45, 60].map((px) => (
                                <button
                                    key={px}
                                    onClick={() => handleClearLeftMargin(px)}
                                    title={`Borrar franja de ${px}px desde el borde izquierdo`}
                                    style={{
                                        background: '#1e293b',
                                        border: '1px solid rgba(59, 130, 246, 0.4)',
                                        color: '#93c5fd',
                                        borderRadius: '4px',
                                        padding: '3px 8px',
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Borrar {px}px
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                            type="number"
                            min="1"
                            max="150"
                            value={leftMarginPx}
                            onChange={(e) => setLeftMarginPx(parseInt(e.target.value) || 1)}
                            style={{
                                width: '50px',
                                background: '#0f172a',
                                border: '1px solid #334155',
                                color: '#fbbf24',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                fontSize: '11px',
                                textAlign: 'center'
                            }}
                        />
                        <button
                            onClick={() => handleClearLeftMargin(leftMarginPx)}
                            style={{
                                background: '#3b82f6',
                                border: 'none',
                                color: '#fff',
                                borderRadius: '4px',
                                padding: '3px 8px',
                                fontSize: '10px',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                        >
                            Borrar Borde
                        </button>
                    </div>
                </div>

                {/* Área de Visualización y Edición Canvas */}
                <div
                    style={{
                        flex: 1,
                        overflow: 'auto',
                        padding: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#090d16',
                        position: 'relative',
                        userSelect: 'none'
                    }}
                    onPointerLeave={() => {
                        handlePointerUp();
                    }}
                >
                    <div
                        style={{
                            background: 'repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%) 50% / 14px 14px',
                            border: '2px dashed rgba(59, 130, 246, 0.4)',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            boxShadow: '0 0 30px rgba(0, 0, 0, 0.8)',
                            transform: `scale(${zoom})`,
                            transformOrigin: 'center center',
                            transition: 'transform 0.1s ease',
                            cursor: 'crosshair',
                            position: 'relative'
                        }}
                    >
                        <canvas
                            ref={canvasRef}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            style={{
                                display: 'block',
                                imageRendering: 'pixelated'
                            }}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div
                    style={{
                        padding: '14px 20px',
                        borderTop: '1px solid #1e293b',
                        background: '#131824',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '11px' }}>
                        <Sparkles size={14} color="#f59e0b" />
                        <span>Haz clic y arrastra con el cursor para borrar cualquier detalle sobrante.</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                            onClick={onClose}
                            style={{
                                background: 'transparent',
                                border: '1px solid #334155',
                                color: '#cbd5e1',
                                borderRadius: '6px',
                                padding: '6px 14px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            style={{
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                border: 'none',
                                color: '#fff',
                                borderRadius: '6px',
                                padding: '6px 16px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 0 16px rgba(16, 185, 129, 0.4)'
                            }}
                        >
                            <Check size={14} />
                            <span>Aplicar a Frame #{frameIndex + 1}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
