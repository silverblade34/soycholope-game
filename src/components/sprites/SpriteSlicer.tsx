'use client';

import React, { useState } from 'react';
import { ActionConfig, FrameSlice } from './types';
import { Scissors } from 'lucide-react';

interface SpriteSlicerProps {
    action: ActionConfig;
    slices: FrameSlice[];
    activeFrameIndex: number;
    onSelectFrame: (index: number) => void;
}

export const SpriteSlicer: React.FC<SpriteSlicerProps> = ({
    action,
    slices,
    activeFrameIndex,
    onSelectFrame
}) => {
    // Si la imagen es muy alta (>350px), escalar al 50% para visualización cómoda por defecto
    const [scaleMode, setScaleMode] = useState<'fit' | '100' | '50'>('fit');

    if (!action.sheetUrl) {
        return (
            <div
                style={{
                    background: '#131824',
                    border: '1px solid #1e293b',
                    borderRadius: '12px',
                    padding: '24px',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '13px'
                }}
            >
                Carga un sprite sheet para visualizar las líneas de corte.
            </div>
        );
    }

    // Calcular factor de escala para mantener proporciones perfectas
    let scale = 1;
    if (scaleMode === '50') {
        scale = 0.5;
    } else if (scaleMode === 'fit') {
        // Ajustar altura máxima a ~200px para que quepa en el panel sin deformarse
        const maxH = 200;
        scale = action.totalHeight > maxH ? maxH / action.totalHeight : 1;
    }

    const displayW = Math.round(action.totalWidth * scale);
    const displayH = Math.round(action.totalHeight * scale);

    return (
        <div
            style={{
                background: '#131824',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Scissors size={14} color="#60a5fa" />
                    <span>Guías de Recorte Slicer ({slices.length} frames)</span>
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Vista:</span>
                    {(['fit', '100', '50'] as const).map((m) => (
                        <button
                            key={m}
                            onClick={() => setScaleMode(m)}
                            style={{
                                background: scaleMode === m ? '#3b82f6' : '#1e293b',
                                border: '1px solid #334155',
                                color: scaleMode === m ? '#fff' : '#94a3b8',
                                borderRadius: '4px',
                                padding: '2px 7px',
                                fontSize: '10px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            {m === 'fit' ? 'Ajustar' : `${m}%`}
                        </button>
                    ))}
                    <span style={{ fontSize: '10px', color: '#64748b', marginLeft: '4px' }}>
                        {action.totalWidth}×{action.totalHeight}px
                    </span>
                </div>
            </div>

            {/* Contenedor con scroll horizontal para ver la tira completa sin deformación */}
            <div
                style={{
                    overflowX: 'auto',
                    overflowY: 'auto',
                    maxHeight: '320px',
                    background: 'repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%) 50% / 16px 16px',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '12px',
                    position: 'relative'
                }}
            >
                <div
                    style={{
                        position: 'relative',
                        display: 'block',
                        width: `${displayW}px`,
                        height: `${displayH}px`,
                        flexShrink: 0
                    }}
                >
                    {/* Imagen completa del spritesheet proporcional */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={action.sheetUrl}
                        alt="Sprite Sheet Original"
                        style={{
                            display: 'block',
                            width: `${displayW}px`,
                            height: `${displayH}px`,
                            imageRendering: 'pixelated'
                        }}
                    />

                    {/* Guías de corte superpuestas escaladas exactamente a la par */}
                    {slices.map((slice) => {
                        const isActive = slice.index === activeFrameIndex;
                        const sliceLeft = Math.round(slice.x * scale);
                        const sliceTop = Math.round(slice.y * scale);
                        const sliceW = Math.round(slice.width * scale);
                        const sliceH = Math.round(slice.height * scale);

                        return (
                            <div
                                key={slice.index}
                                onClick={() => onSelectFrame(slice.index)}
                                title={`Frame ${slice.index + 1}: x=${slice.x}, y=${slice.y}, w=${slice.width}, h=${slice.height}`}
                                style={{
                                    position: 'absolute',
                                    left: `${sliceLeft}px`,
                                    top: `${sliceTop}px`,
                                    width: `${sliceW}px`,
                                    height: `${sliceH}px`,
                                    boxSizing: 'border-box',
                                    border: isActive
                                        ? '2px solid #f59e0b'
                                        : '1.5px dashed rgba(59, 130, 246, 0.7)',
                                    background: isActive
                                        ? 'rgba(245, 158, 11, 0.18)'
                                        : 'rgba(59, 130, 246, 0.08)',
                                    cursor: 'pointer',
                                    transition: 'all 0.1s ease',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    padding: '3px'
                                }}
                            >
                                <span
                                    style={{
                                        alignSelf: 'flex-start',
                                        background: isActive ? '#f59e0b' : 'rgba(15, 23, 42, 0.85)',
                                        color: isActive ? '#000' : '#93c5fd',
                                        fontSize: '9px',
                                        fontWeight: 700,
                                        padding: '1px 4px',
                                        borderRadius: '3px'
                                    }}
                                >
                                    #{slice.index + 1}
                                </span>

                                <span
                                    style={{
                                        alignSelf: 'flex-end',
                                        background: 'rgba(15, 23, 42, 0.85)',
                                        color: '#cbd5e1',
                                        fontSize: '9px',
                                        padding: '1px 3px',
                                        borderRadius: '2px'
                                    }}
                                >
                                    {slice.width}px
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
