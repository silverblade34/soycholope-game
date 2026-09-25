'use client';

import React, { useMemo } from 'react';
import { ActionConfig, FrameSlice } from './types';
import { extractFrameDataUrl } from './slicerUtils';
import { Film, Download } from 'lucide-react';

interface FrameStripProps {
    action: ActionConfig;
    slices: FrameSlice[];
    activeFrameIndex: number;
    onSelectFrame: (index: number) => void;
    imageElement: HTMLImageElement | null;
}

export const FrameStrip: React.FC<FrameStripProps> = ({
    action,
    slices,
    activeFrameIndex,
    onSelectFrame,
    imageElement
}) => {
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

    if (slices.length === 0) return null;

    return (
        <div
            style={{
                background: '#131824',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Film size={15} color="#60a5fa" />
                    <span>Tira de Frames Recortados Individuales ({slices.length})</span>
                </span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Haz clic en un frame para pausar e inspeccionarlo
                </span>
            </div>

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
                    const thumbUrl = frameThumbnails[idx];

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
                                border: isActive ? '2px solid #f59e0b' : '1px solid #334155',
                                borderRadius: '8px',
                                padding: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                minWidth: '90px'
                            }}
                        >
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
        </div>
    );
};
