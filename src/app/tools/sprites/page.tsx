'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { ActionConfig, CharacterData, DEFAULT_ACTIONS, FrameOverride } from '@/components/sprites/types';
import { calculateFrameSlices, extractFrameDataUrl, createAnimatedGif } from '@/components/sprites/slicerUtils';
import { ActionSelector } from '@/components/sprites/ActionSelector';
import { SpriteSheetUploader } from '@/components/sprites/SpriteSheetUploader';
import { SpriteSlicer } from '@/components/sprites/SpriteSlicer';
import { AnimationPlayer } from '@/components/sprites/AnimationPlayer';
import { FrameStrip } from '@/components/sprites/FrameStrip';
import { Film, Download, Save, Gamepad2, User, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SpriteStudioPage() {
    const [characterName, setCharacterName] = useState<string>('cholo');

    // Inicializar diccionario de acciones predeterminadas
    const [actions, setActions] = useState<Record<string, ActionConfig>>(() => {
        const initial: Record<string, ActionConfig> = {};
        for (const item of DEFAULT_ACTIONS) {
            initial[item.name] = {
                name: item.name,
                label: item.label,
                icon: item.icon,
                sheetUrl: item.name === 'correr' ? '/sprites/cholo/correr.png' : '',
                frameCount: 5,
                frameWidth: 0,
                frameHeight: 0,
                offsetX: 0,
                offsetY: 0,
                spacing: 0,
                fps: item.defaultFps,
                loop: item.loop,
                totalWidth: 0,
                totalHeight: 0,
                frameOverrides: {}
            };
        }
        return initial;
    });

    const [activeActionKey, setActiveActionKey] = useState<string>('correr');
    const [activeFrameIndex, setActiveFrameIndex] = useState<number>(0);

    // Cache de HTMLImageElement para el canvas
    const [activeImageElement, setActiveImageElement] = useState<HTMLImageElement | null>(null);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [saveStatus, setSaveStatus] = useState<{ success?: boolean; message?: string } | null>(null);

    const activeAction = actions[activeActionKey] || actions['correr'];

    // Cargar imagen en memoria cuando cambie sheetUrl de la acción activa
    useEffect(() => {
        let isMounted = true;

        if (!activeAction?.sheetUrl) {
            const timer = setTimeout(() => {
                if (isMounted) setActiveImageElement(null);
            }, 0);
            return () => {
                isMounted = false;
                clearTimeout(timer);
            };
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = activeAction.sheetUrl;

        img.onload = () => {
            if (!isMounted) return;
            setActiveImageElement(img);

            // Si los datos de ancho/alto no estaban fijados, calcularlos automáticamente
            if (activeAction.totalWidth === 0 || activeAction.frameWidth === 0) {
                const count = activeAction.frameCount || 5;
                const autoW = Math.round(img.naturalWidth / count);
                const autoH = img.naturalHeight;

                setActions((prev) => ({
                    ...prev,
                    [activeActionKey]: {
                        ...prev[activeActionKey],
                        totalWidth: img.naturalWidth,
                        totalHeight: img.naturalHeight,
                        frameWidth: autoW,
                        frameHeight: autoH
                    }
                }));
            }
        };

        img.onerror = () => {
            if (!isMounted) return;
            console.warn(`No se pudo cargar la imagen para ${activeActionKey}:`, activeAction.sheetUrl);
            setActiveImageElement(null);
        };

        return () => {
            isMounted = false;
        };
    }, [activeAction?.sheetUrl, activeActionKey, activeAction?.totalWidth, activeAction?.frameWidth, activeAction?.frameCount]);

    // Recalcular cortes de frames en tiempo real
    const slices = useMemo(() => {
        if (!activeAction) return [];
        return calculateFrameSlices(activeAction);
    }, [activeAction]);

    // Modificar parámetros de la acción activa
    const handleUpdateActiveConfig = useCallback((updated: Partial<ActionConfig>) => {
        setActions((prev) => ({
            ...prev,
            [activeActionKey]: {
                ...prev[activeActionKey],
                ...updated
            }
        }));
    }, [activeActionKey]);

    // Actualizar override individual de un frame específico (ej: ensanchar el frame 2)
    const handleUpdateFrameOverride = useCallback((frameIndex: number, override: Partial<FrameOverride> | null) => {
        setActions((prev) => {
            const currentAction = prev[activeActionKey];
            if (!currentAction) return prev;

            const existingOverrides = { ...(currentAction.frameOverrides || {}) };
            if (override === null) {
                delete existingOverrides[frameIndex];
            } else {
                existingOverrides[frameIndex] = {
                    ...existingOverrides[frameIndex],
                    ...override
                };
            }

            return {
                ...prev,
                [activeActionKey]: {
                    ...currentAction,
                    frameOverrides: existingOverrides
                }
            };
        });
    }, [activeActionKey]);

    // Manejar carga de nuevo archivo PNG
    const handleLoadNewImage = useCallback((file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            if (!dataUrl) return;

            const tempImg = new Image();
            tempImg.src = dataUrl;
            tempImg.onload = () => {
                const defaultCount = activeAction?.frameCount || 5;
                const autoW = Math.round(tempImg.naturalWidth / defaultCount);
                const autoH = tempImg.naturalHeight;

                setActions((prev) => ({
                    ...prev,
                    [activeActionKey]: {
                        ...prev[activeActionKey],
                        sheetUrl: dataUrl,
                        totalWidth: tempImg.naturalWidth,
                        totalHeight: autoH,
                        frameWidth: autoW,
                        frameHeight: autoH,
                        offsetX: 0,
                        offsetY: 0,
                        spacing: 0,
                        frameOverrides: {}
                    }
                }));
                setActiveImageElement(tempImg);
                setActiveFrameIndex(0);
            };
        };
        reader.readAsDataURL(file);
    }, [activeActionKey, activeAction]);

    // Agregar nueva acción personalizada
    const handleAddCustomAction = useCallback((name: string, label: string) => {
        setActions((prev) => ({
            ...prev,
            [name]: {
                name,
                label,
                icon: '',
                sheetUrl: '',
                frameCount: 5,
                frameWidth: 0,
                frameHeight: 0,
                offsetX: 0,
                offsetY: 0,
                spacing: 0,
                fps: 10,
                loop: true,
                totalWidth: 0,
                totalHeight: 0,
                frameOverrides: {}
            }
        }));
        setActiveActionKey(name);
    }, []);

    // Exportar configuración completa como JSON
    const handleExportJson = () => {
        const exportData: CharacterData = {
            characterName,
            actions
        };

        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${characterName}_spritesheet_metadata.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Guardar directamente en /public/sprites/[character]/ organizado como reference_character
    const handleSaveToGame = async () => {
        setIsSaving(true);
        setSaveStatus(null);

        try {
            const filesToSave: Record<string, string> = {};
            const cleanActionsMeta: Record<string, unknown> = {};

            // Procesar cada acción para asegurar que tenemos el PNG base64, frames recortados y GIF animado
            for (const [key, conf] of Object.entries(actions)) {
                if (!conf.sheetUrl) continue;

                // Obtener objeto imagen cargado en memoria
                let img: HTMLImageElement;
                if (key === activeActionKey && activeImageElement && activeImageElement.complete && activeImageElement.naturalWidth > 0) {
                    img = activeImageElement;
                } else {
                    img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.src = conf.sheetUrl;
                    await new Promise((resolve) => {
                        img.onload = resolve;
                        img.onerror = resolve;
                    });
                }

                if (!img.naturalWidth) continue;

                // 1. Obtener base64 del spritesheet completo
                let fullBase64 = conf.sheetUrl.startsWith('data:image/') ? conf.sheetUrl : '';
                if (!fullBase64) {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0);
                        fullBase64 = canvas.toDataURL('image/png');
                    }
                }

                if (!fullBase64) continue;

                // Guardar como en reference_character:
                // Carpeta de acción: [action]/[action].png (ej: correr/correr.png)
                filesToSave[`${key}/${key}.png`] = fullBase64;
                // Raíz del personaje: [action].png (para compatibilidad directa)
                filesToSave[`${key}.png`] = fullBase64;

                // 2. Extraer y guardar frames individuales en [action]/frames/frame_X.png
                const actionSlices = calculateFrameSlices(conf);
                const framePaths: string[] = [];

                actionSlices.forEach((slice, idx) => {
                    const frameNum = idx + 1;
                    const frameBase64 = extractFrameDataUrl(img, slice);
                    if (frameBase64) {
                        const relPath = `${key}/frames/frame_${frameNum}.png`;
                        filesToSave[relPath] = frameBase64;
                        framePaths.push(`/sprites/${characterName}/${relPath}`);
                    }
                });

                // 3. Generar GIF animado para la acción (como en reference_character: dash.gif, running.gif)
                try {
                    const gifBase64 = await createAnimatedGif(img, actionSlices, conf.fps, conf.loop);
                    if (gifBase64) {
                        filesToSave[`${key}/${key}.gif`] = gifBase64;
                        filesToSave[`${key}.gif`] = gifBase64;
                    }
                } catch (gifErr) {
                    console.warn(`No se pudo generar GIF para acción ${key}:`, gifErr);
                }

                // Si es la acción correr o idle, generar avatar character.png en la raíz
                if (actionSlices.length > 0 && (key === 'correr' || key === 'idle' || !filesToSave['character.png'])) {
                    const avatarBase64 = extractFrameDataUrl(img, actionSlices[0]);
                    if (avatarBase64) {
                        filesToSave['character.png'] = avatarBase64;
                    }
                }

                cleanActionsMeta[key] = {
                    name: conf.name,
                    label: conf.label,
                    frameCount: conf.frameCount,
                    frameWidth: conf.frameWidth,
                    frameHeight: conf.frameHeight,
                    offsetX: conf.offsetX,
                    offsetY: conf.offsetY,
                    spacing: conf.spacing,
                    fps: conf.fps,
                    loop: conf.loop,
                    frameOverrides: conf.frameOverrides || {},
                    spriteSheet: `/sprites/${characterName}/${key}/${key}.png`,
                    spriteSheetRoot: `/sprites/${characterName}/${key}.png`,
                    gif: `/sprites/${characterName}/${key}/${key}.gif`,
                    frames: framePaths
                };
            }

            const res = await fetch('/api/sprites/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    character: characterName,
                    files: filesToSave,
                    metadata: {
                        characterName,
                        updatedAt: new Date().toISOString(),
                        actions: cleanActionsMeta
                    }
                })
            });

            const data = await res.json();
            if (res.ok) {
                setSaveStatus({
                    success: true,
                    message: `¡Guardado exitoso! Estructura creada en /public/sprites/${characterName}/ (con GIFs animados, subcarpetas por acción y frames).`
                });
            } else {
                setSaveStatus({
                    success: false,
                    message: data.error || 'Error al guardar sprites'
                });
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error de conexión';
            setSaveStatus({
                success: false,
                message: msg
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div
            style={{
                minHeight: '100vh',
                background: '#090d16',
                color: '#f8fafc',
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                padding: '24px 20px',
                boxSizing: 'border-box'
            }}
        >
            {/* Header / Barra Superior */}
            <div
                style={{
                    maxWidth: '1280px',
                    margin: '0 auto 24px auto',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '16px',
                    background: '#131824',
                    border: '1px solid #1e293b',
                    borderRadius: '14px',
                    padding: '16px 20px'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                        style={{
                            width: '42px',
                            height: '42px',
                            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 16px rgba(245, 158, 11, 0.4)',
                            color: '#fff'
                        }}
                    >
                        <Film size={22} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                            Sprite Sheet Studio (Frame-by-Frame)
                        </h1>
                        <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                            Animación clásica por recorte de tiras horizontales (5 frames)
                        </p>
                    </div>
                </div>

                {/* Controles de personaje y guardado */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={13} color="#94a3b8" />
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Personaje:</span>
                        <input
                            type="text"
                            value={characterName}
                            onChange={(e) => setCharacterName(e.target.value.toLowerCase().trim())}
                            style={{
                                background: '#1e293b',
                                border: '1px solid #334155',
                                color: '#fbbf24',
                                borderRadius: '6px',
                                padding: '5px 10px',
                                fontSize: '12px',
                                fontWeight: 700,
                                width: '100px'
                            }}
                        />
                    </div>

                    <button
                        onClick={handleExportJson}
                        style={{
                            background: '#1e293b',
                            border: '1px solid #334155',
                            color: '#94a3b8',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <Download size={14} />
                        <span>Exportar JSON</span>
                    </button>

                    <button
                        onClick={handleSaveToGame}
                        disabled={isSaving}
                        style={{
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            border: 'none',
                            color: '#fff',
                            borderRadius: '8px',
                            padding: '8px 16px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: isSaving ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '7px',
                            boxShadow: '0 0 12px rgba(16, 185, 129, 0.3)'
                        }}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 size={14} className="animate-spin" />
                                <span>Guardando...</span>
                            </>
                        ) : (
                            <>
                                <Save size={14} />
                                <span>Guardar en el Juego</span>
                            </>
                        )}
                    </button>

                    <Link
                        href="/capitulos/1"
                        style={{
                            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                            color: '#000',
                            borderRadius: '8px',
                            padding: '8px 16px',
                            fontSize: '12px',
                            fontWeight: 800,
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <Gamepad2 size={15} />
                        <span>Probar en Cap. 1</span>
                    </Link>
                </div>
            </div>

            {/* Banner de status si hubo guardado */}
            {saveStatus && (
                <div
                    style={{
                        maxWidth: '1280px',
                        margin: '0 auto 16px auto',
                        background: saveStatus.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        border: `1px solid ${saveStatus.success ? '#10b981' : '#ef4444'}`,
                        borderRadius: '8px',
                        padding: '10px 16px',
                        fontSize: '12px',
                        color: saveStatus.success ? '#a7f3d0' : '#fca5a5',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '10px'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {saveStatus.success ? <CheckCircle2 size={16} color="#10b981" /> : <AlertCircle size={16} color="#ef4444" />}
                        <span>{saveStatus.message}</span>
                    </div>
                    <button
                        onClick={() => setSaveStatus(null)}
                        style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '13px' }}
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Contenedor Principal */}
            <div
                style={{
                    maxWidth: '1280px',
                    margin: '0 auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px'
                }}
            >
                {/* 1. Selector de Acciones */}
                <div
                    style={{
                        background: '#131824',
                        border: '1px solid #1e293b',
                        borderRadius: '12px',
                        padding: '14px 18px'
                    }}
                >
                    <ActionSelector
                        actions={actions}
                        activeActionKey={activeActionKey}
                        onSelectAction={(key) => setActiveActionKey(key)}
                        onAddCustomAction={handleAddCustomAction}
                    />
                </div>

                {/* 2. Grid de Trabajo: Reproductor a la Izquierda / Configuración a la Derecha */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)',
                        gap: '20px'
                    }}
                >
                    {/* Columna Izquierda: AnimationPlayer */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <AnimationPlayer
                            action={activeAction}
                            slices={slices}
                            activeFrameIndex={activeFrameIndex}
                            setActiveFrameIndex={setActiveFrameIndex}
                            imageElement={activeImageElement}
                            onChangeConfig={handleUpdateActiveConfig}
                        />

                        {/* Tira de frames recortados */}
                        <FrameStrip
                            action={activeAction}
                            slices={slices}
                            activeFrameIndex={activeFrameIndex}
                            onSelectFrame={(idx) => setActiveFrameIndex(idx)}
                            imageElement={activeImageElement}
                            onUpdateFrameOverride={handleUpdateFrameOverride}
                        />
                    </div>

                    {/* Columna Derecha: Uploader + Configuración + Slicer Guías */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <SpriteSheetUploader
                            action={activeAction}
                            onChangeConfig={handleUpdateActiveConfig}
                            onLoadNewImage={handleLoadNewImage}
                        />

                        <SpriteSlicer
                            action={activeAction}
                            slices={slices}
                            activeFrameIndex={activeFrameIndex}
                            onSelectFrame={(idx) => setActiveFrameIndex(idx)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
