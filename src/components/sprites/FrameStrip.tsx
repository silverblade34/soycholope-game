'use client';

import React, { useMemo, useState } from 'react';
import { ActionConfig, FrameSlice, FrameOverride } from './types';
import { extractFrameDataUrl, createAnimatedGif } from './slicerUtils';
import { Film, Download, Sliders, RotateCcw, Sparkles } from 'lucide-react';

interface FrameStripProps {
    action: ActionConfig;
    slices: FrameSlice[];
    activeFrameIndex: number;
    onSelectFrame: (index: number) => void;
    imageElement: HTMLImageElement | null;
    onUpdateFrameOverride: (frameIndex: number, override: Partial<FrameOverride> | null) => void;
}

export const FrameStrip: React.FC<FrameStripProps> = ({
    action,
    slices,
    activeFrameIndex,
    onSelectFrame,
    imageElement,
    onUpdateFrameOverride
}) => {
    const [isGeneratingGif, setIsGeneratingGif] = useState<boolean>(false);

    // Generar thumbnails sincrónicamente con useMemo cuando cambien slices o la imagen
    const frameThumbnails = useMemo(() => {
        if (!imageElement || slices.length === 0 || !imageElement.complete || imageElement.naturalWidth === 0) {
            return [];
        }

        const thumbs: string[] = [];
        for (const slice of slices) {
            try {
                const url = extractFrameDataUrl(imageElement, slice);
                thumbs.push(url);
            } catch (err) {
                console.error('Error al extraer frame:', err);
                thumbs.push('');
            }
        }
        return thumbs;
    }, [imageElement, slices]);

    const handleDownloadFrame = (idx: number, e: React.MouseEvent) => {
        e.stopPropagation();
        const url = frameThumbnails[idx];
        if (!url) return;

        const a = document.createElement('a');
        a.href = url;
        a.download = `${action.name}_frame_${idx + 1}.png`;
        a.click();
    };

    const handleDownloadGif = async () => {
        if (!imageElement || slices.length === 0) return;
        setIsGeneratingGif(true);
        try {
            const gifDataUrl = await createAnimatedGif(imageElement, slices, action.fps, action.loop);
            if (gifDataUrl) {
                const a = document.createElement('a');
                a.href = gifDataUrl;
                a.download = `${action.name}.gif`;
                a.click();
            }
        } catch (err) {
            console.error('Error al generar GIF:', err);
        } finally {
            setIsGeneratingGif(false);
        }
    };

    if (slices.length === 0) return null;

    const currentSlice = slices[activeFrameIndex] || slices[0];
    const currentOverride = action.frameOverrides?.[activeFrameIndex];

    const adjustValue = (field: 'x' | 'width' | 'y' | 'height', delta: number) => {
        const curVal = currentSlice[field];
        const newVal = Math.max(1, curVal + delta);
        onUpdateFrameOverride(activeFrameIndex, { [field]: newVal });
    };

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
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Film size={15} color="#60a5fa" />
                    <span>Tira de Frames ({slices.length})</span>
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        onClick={handleDownloadGif}
                        disabled={isGeneratingGif}
                        title="Exportar animación activa como GIF animado con fondo transparente"
                        style={{
                            background: 'rgba(59, 130, 246, 0.15)',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            color: '#60a5fa',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: isGeneratingGif ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}
                    >
                        <Sparkles size={12} />
                        <span>{isGeneratingGif ? 'Generando GIF...' : 'Exportar GIF'}</span>
                    </button>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                        Haz clic en un frame para ajustar su corte
                    </span>
                </div>
            </div>

            {/* Galería de Frames */}
            <div
                style={{
                    display: 'flex',
                    gap: '10px',
                    overflowX: 'auto',
                    paddingBottom: '6px'
                }}
            >
                {slices.map((slice, idx) => {
                    const isActive = idx === activeFrameIndex;
                    const thumbUrl = frameThumbnails[idx] || (action.frames && action.frames[idx]) || '';
                    const hasOverride = Boolean(action.frameOverrides?.[idx]);

                    return (
                        <div
                            key={slice.index}
                            onClick={() => onSelectFrame(idx)}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '6px',
                                background: isActive ? 'rgba(245, 158, 11, 0.12)' : '#0f172a',
                                border: isActive ? '2px solid #f59e0b' : hasOverride ? '1px dashed #3b82f6' : '1px solid #334155',
                                borderRadius: '8px',
                                padding: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                minWidth: '95px',
                                position: 'relative'
                            }}
                        >
                            {hasOverride && (
                                <span
                                    title="Este frame tiene un corte manual personalizado"
                                    style={{
                                        position: 'absolute',
                                        top: '4px',
                                        left: '4px',
                                        background: '#3b82f6',
                                        color: '#fff',
                                        fontSize: '8px',
                                        fontWeight: 800,
                                        padding: '1px 4px',
                                        borderRadius: '3px',
                                        zIndex: 2
                                    }}
                                >
                                    EDIT
                                </span>
                            )}

                            <div
                                style={{
                                    width: '80px',
                                    height: '80px',
                                    background: 'repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%) 50% / 10px 10px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden'
                                }}
                            >
                                {thumbUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={thumbUrl}
                                        alt={`Frame ${idx + 1}`}
                                        style={{
                                            maxWidth: '100%',
                                            maxHeight: '100%',
                                            objectFit: 'contain',
                                            imageRendering: 'pixelated'
                                        }}
                                    />
                                ) : (
                                    <span style={{ fontSize: '10px', color: '#64748b' }}>...</span>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                <span
                                    style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        color: isActive ? '#fbbf24' : '#94a3b8'
                                    }}
                                >
                                    F{idx + 1}
                                </span>
                                <span style={{ fontSize: '9px', color: '#64748b' }}>
                                    {slice.width}px
                                </span>

                                <button
                                    onClick={(e) => handleDownloadFrame(idx, e)}
                                    title="Descargar este frame como PNG"
                                    style={{
                                        background: 'rgba(59, 130, 246, 0.15)',
                                        border: 'none',
                                        color: '#60a5fa',
                                        cursor: 'pointer',
                                        borderRadius: '4px',
                                        padding: '3px 5px',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    <Download size={11} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Inspector de Ajuste Fino para el Frame Seleccionado */}
            {currentSlice && (
                <div
                    style={{
                        background: '#0f172a',
                        border: '1px solid #1e293b',
                        borderRadius: '8px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Sliders size={13} color="#f59e0b" />
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
                                Ajuste Individual: Frame #{activeFrameIndex + 1}
                            </span>
                            {currentOverride && (
                                <span style={{ fontSize: '10px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '1px 6px', borderRadius: '4px' }}>
                                    Personalizado
                                </span>
                            )}
                        </div>

                        {currentOverride && (
                            <button
                                onClick={() => onUpdateFrameOverride(activeFrameIndex, null)}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid #334155',
                                    color: '#94a3b8',
                                    borderRadius: '4px',
                                    padding: '2px 8px',
                                    fontSize: '10px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <RotateCcw size={10} />
                                <span>Restablecer a automático</span>
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                        {/* Ancho */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: '#94a3b8' }}>Ancho de este frame (W):</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <button
                                    onClick={() => adjustValue('width', -5)}
                                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px', padding: '4px 6px', fontSize: '11px', cursor: 'pointer' }}
                                >
                                    -5
                                </button>
                                <button
                                    onClick={() => adjustValue('width', -1)}
                                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px', padding: '4px 6px', fontSize: '11px', cursor: 'pointer' }}
                                >
                                    -1
                                </button>
                                <input
                                    type="number"
                                    min="1"
                                    value={currentSlice.width}
                                    onChange={(e) => onUpdateFrameOverride(activeFrameIndex, { width: parseInt(e.target.value) || currentSlice.width })}
                                    style={{ width: '60px', background: '#1e293b', border: '1px solid #3b82f6', color: '#fbbf24', borderRadius: '4px', padding: '4px 6px', fontSize: '11px', fontWeight: 700, textAlign: 'center' }}
                                />
                                <button
                                    onClick={() => adjustValue('width', +1)}
                                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px', padding: '4px 6px', fontSize: '11px', cursor: 'pointer' }}
                                >
                                    +1
                                </button>
                                <button
                                    onClick={() => adjustValue('width', +5)}
                                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px', padding: '4px 6px', fontSize: '11px', cursor: 'pointer' }}
                                >
                                    +5
                                </button>
                            </div>
                        </div>

                        {/* Posición X */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: '#94a3b8' }}>Posición X de inicio:</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <button
                                    onClick={() => adjustValue('x', -5)}
                                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px', padding: '4px 6px', fontSize: '11px', cursor: 'pointer' }}
                                >
                                    -5
                                </button>
                                <button
                                    onClick={() => adjustValue('x', -1)}
                                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px', padding: '4px 6px', fontSize: '11px', cursor: 'pointer' }}
                                >
                                    -1
                                </button>
                                <input
                                    type="number"
                                    min="0"
                                    value={currentSlice.x}
                                    onChange={(e) => onUpdateFrameOverride(activeFrameIndex, { x: parseInt(e.target.value) || 0 })}
                                    style={{ width: '60px', background: '#1e293b', border: '1px solid #3b82f6', color: '#60a5fa', borderRadius: '4px', padding: '4px 6px', fontSize: '11px', fontWeight: 700, textAlign: 'center' }}
                                />
                                <button
                                    onClick={() => adjustValue('x', +1)}
                                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px', padding: '4px 6px', fontSize: '11px', cursor: 'pointer' }}
                                >
                                    +1
                                </button>
                                <button
                                    onClick={() => adjustValue('x', +5)}
                                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px', padding: '4px 6px', fontSize: '11px', cursor: 'pointer' }}
                                >
                                    +5
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
