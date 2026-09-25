'use client';

import React, { useRef } from 'react';
import { ActionConfig } from './types';
import { ActionIcon } from './ActionIcon';
import { Upload, Scissors, CheckCircle2 } from 'lucide-react';

interface SpriteSheetUploaderProps {
    action: ActionConfig;
    onChangeConfig: (updated: Partial<ActionConfig>) => void;
    onLoadNewImage: (file: File) => void;
}

export const SpriteSheetUploader: React.FC<SpriteSheetUploaderProps> = ({
    action,
    onChangeConfig,
    onLoadNewImage
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onLoadNewImage(file);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            onLoadNewImage(file);
        }
    };

    const handleFrameCountChange = (newCount: number) => {
        const count = Math.max(1, newCount);
        const autoWidth = action.totalWidth > 0 ? Math.round(action.totalWidth / count) : 0;
        onChangeConfig({
            frameCount: count,
            frameWidth: autoWidth
        });
    };

    const autoCalcWidth = () => {
        if (action.totalWidth > 0 && action.frameCount > 0) {
            onChangeConfig({
                frameWidth: Math.round(action.totalWidth / action.frameCount),
                frameHeight: action.totalHeight,
                offsetX: 0,
                spacing: 0
            });
        }
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'rgba(59, 130, 246, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#60a5fa'
                        }}
                    >
                        <ActionIcon name={action.name} size={18} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
                            Configuración de Sprite Sheet: {action.label}
                        </h3>
                        <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                            {action.sheetUrl ? 'Fila horizontal cargada' : 'Aún sin sprite sheet'}
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                        background: '#2563eb',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'background 0.15s ease'
                    }}
                >
                    <Upload size={14} />
                    <span>Subir PNG</span>
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/webp"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                />
            </div>

            {/* Zona de Drop si no hay imagen o para reemplazar */}
            <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                    border: '2px dashed rgba(59, 130, 246, 0.35)',
                    borderRadius: '8px',
                    padding: action.sheetUrl ? '8px 12px' : '24px 16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: 'rgba(30, 41, 59, 0.3)',
                    transition: 'all 0.15s ease'
                }}
            >
                {action.sheetUrl ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                        <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CheckCircle2 size={14} color="#10b981" />
                            PNG cargado: {action.totalWidth} × {action.totalHeight} px
                        </span>
                        <span style={{ color: '#60a5fa', textDecoration: 'underline', fontSize: '11px' }}>
                            Cambiar archivo...
                        </span>
                    </div>
                ) : (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px', color: '#60a5fa' }}>
                            <Upload size={24} />
                        </div>
                        <p style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 600, color: '#93c5fd' }}>
                            Arrastra y suelta aquí el sprite sheet horizontal (PNG con alpha)
                        </p>
                        <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                            O haz clic para seleccionar archivo desde tu computadora
                        </p>
                    </div>
                )}
            </div>

            {/* Controles del Slicer */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '10px',
                    background: '#0f172a',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #1e293b'
                }}
            >
                {/* Número de frames */}
                <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                        Frames Totales (N):
                    </label>
                    <input
                        type="number"
                        min="1"
                        max="64"
                        value={action.frameCount || 5}
                        onChange={(e) => handleFrameCountChange(parseInt(e.target.value) || 1)}
                        style={{
                            width: '100%',
                            background: '#1e293b',
                            border: '1px solid #334155',
                            color: '#fff',
                            borderRadius: '6px',
                            padding: '6px 8px',
                            fontSize: '12px',
                            fontWeight: 600
                        }}
                    />
                </div>

                {/* Ancho de celda */}
                <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                        Ancho Celda (px):
                    </label>
                    <input
                        type="number"
                        min="1"
                        value={action.frameWidth || ''}
                        placeholder={action.totalWidth > 0 ? `${Math.round(action.totalWidth / (action.frameCount || 1))}` : '0'}
                        onChange={(e) => onChangeConfig({ frameWidth: parseInt(e.target.value) || 0 })}
                        style={{
                            width: '100%',
                            background: '#1e293b',
                            border: '1px solid #334155',
                            color: '#fff',
                            borderRadius: '6px',
                            padding: '6px 8px',
                            fontSize: '12px',
                            fontWeight: 600
                        }}
                    />
                </div>

                {/* Alto de celda */}
                <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                        Alto Celda (px):
                    </label>
                    <input
                        type="number"
                        min="1"
                        value={action.frameHeight || ''}
                        placeholder={`${action.totalHeight || 0}`}
                        onChange={(e) => onChangeConfig({ frameHeight: parseInt(e.target.value) || 0 })}
                        style={{
                            width: '100%',
                            background: '#1e293b',
                            border: '1px solid #334155',
                            color: '#fff',
                            borderRadius: '6px',
                            padding: '6px 8px',
                            fontSize: '12px',
                            fontWeight: 600
                        }}
                    />
                </div>

                {/* Desplazamiento X (Offset) */}
                <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                        Offset Inicial X (px):
                    </label>
                    <input
                        type="number"
                        min="0"
                        value={action.offsetX || 0}
                        onChange={(e) => onChangeConfig({ offsetX: parseInt(e.target.value) || 0 })}
                        style={{
                            width: '100%',
                            background: '#1e293b',
                            border: '1px solid #334155',
                            color: '#fff',
                            borderRadius: '6px',
                            padding: '6px 8px',
                            fontSize: '12px',
                            fontWeight: 600
                        }}
                    />
                </div>

                {/* Separación (Spacing) */}
                <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                        Espaciado (px):
                    </label>
                    <input
                        type="number"
                        min="0"
                        value={action.spacing || 0}
                        onChange={(e) => onChangeConfig({ spacing: parseInt(e.target.value) || 0 })}
                        style={{
                            width: '100%',
                            background: '#1e293b',
                            border: '1px solid #334155',
                            color: '#fff',
                            borderRadius: '6px',
                            padding: '6px 8px',
                            fontSize: '12px',
                            fontWeight: 600
                        }}
                    />
                </div>
            </div>

            {/* Botón de auto-cálculo rápido */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                    onClick={autoCalcWidth}
                    disabled={!action.totalWidth}
                    style={{
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid #3b82f6',
                        color: '#60a5fa',
                        borderRadius: '6px',
                        padding: '5px 12px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: action.totalWidth ? 'pointer' : 'not-allowed',
                        opacity: action.totalWidth ? 1 : 0.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    <Scissors size={13} />
                    <span>Auto-Dividir Uniforme ({action.totalWidth > 0 ? `${Math.round(action.totalWidth / (action.frameCount || 5))}px` : 'W/N'})</span>
                </button>
            </div>
        </div>
    );
};
