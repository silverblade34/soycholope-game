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
import { Film, Download, Save, Gamepad2, User, Loader2, CheckCircle2, AlertCircle, Plus, Check, X } from 'lucide-react';

const DEFAULT_ENV_CHAR = process.env.NEXT_PUBLIC_DEFAULT_CHARACTER || 'ruben';

export default function SpriteStudioPage() {
    const [characterName, setCharacterName] = useState<string>(DEFAULT_ENV_CHAR);
    const [availableCharacters, setAvailableCharacters] = useState<string[]>([DEFAULT_ENV_CHAR]);
    const [isCreatingChar, setIsCreatingChar] = useState<boolean>(false);
    const [newCharName, setNewCharName] = useState<string>('');

    // Inicializar diccionario de acciones predeterminadas
    const [actions, setActions] = useState<Record<string, ActionConfig>>(() => {
        const initial: Record<string, ActionConfig> = {};
        for (const item of DEFAULT_ACTIONS) {
            initial[item.name] = {
                name: item.name,
                label: item.label,
                icon: item.icon,
                sheetUrl: item.name === 'correr' ? `/sprites/${DEFAULT_ENV_CHAR}/correr/correr.png` : '',
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

    // Cargar acciones y metadata guardadas de un personaje desde el servidor
    const loadCharacterData = useCallback(async (charName: string) => {
        try {
            const res = await fetch(`/api/sprites/characters?character=${encodeURIComponent(charName)}`);
            const json = await res.json();

            if (typeof window !== 'undefined') {
                localStorage.setItem('sprite_studio_last_character', charName);
            }

            // Construir acciones base limpias
            const merged: Record<string, ActionConfig> = {};
            for (const item of DEFAULT_ACTIONS) {
                merged[item.name] = {
                    name: item.name,
                    label: item.label,
                    icon: item.icon,
                    sheetUrl: '',
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
                    frameOverrides: {},
                    frames: [],
                    gif: ''
                };
            }

            // Si hay datos guardados en disco para este personaje, fusionarlos
            if (json.data && json.data.actions) {
                interface RawActionMeta {
                    name?: string;
                    label?: string;
                    frameCount?: number;
                    frameWidth?: number;
                    frameHeight?: number;
                    offsetX?: number;
                    offsetY?: number;
                    spacing?: number;
                    fps?: number;
                    loop?: boolean;
                    frameOverrides?: Record<number, FrameOverride>;
                    spriteSheet?: string;
                    spriteSheetRoot?: string;
                    gif?: string;
                    frames?: string[];
                    totalWidth?: number;
                    totalHeight?: number;
                }

                for (const [key, rawConf] of Object.entries(json.data.actions as Record<string, RawActionMeta>)) {
                    const count = rawConf.frameCount || (rawConf.frames?.length ? rawConf.frames.length : 5);
                    const totalW = rawConf.totalWidth || (rawConf.frameWidth ? rawConf.frameWidth * count : 0);
                    const totalH = rawConf.totalHeight || rawConf.frameHeight || 0;
                    const frameW = rawConf.frameWidth || (totalW > 0 ? Math.round(totalW / count) : 0);
                    const frameH = rawConf.frameHeight || totalH;

                    merged[key] = {
                        name: rawConf.name || key,
                        label: rawConf.label || key.toUpperCase(),
                        icon: '',
                        sheetUrl: rawConf.spriteSheet || rawConf.spriteSheetRoot || `/sprites/${charName}/${key}/${key}.png`,
                        frameCount: count,
                        frameWidth: frameW,
                        frameHeight: frameH,
                        offsetX: rawConf.offsetX || 0,
                        offsetY: rawConf.offsetY || 0,
                        spacing: rawConf.spacing || 0,
                        fps: rawConf.fps || 10,
                        loop: rawConf.loop !== undefined ? rawConf.loop : true,
                        totalWidth: totalW,
                        totalHeight: totalH,
                        frameOverrides: rawConf.frameOverrides || {},
                        frames: rawConf.frames || [],
                        gif: rawConf.gif || ''
                    };
                }

                const actionsWithSprites = Object.keys(json.data.actions).filter(
                    (k) => Boolean(merged[k]?.sheetUrl) || (merged[k]?.frames && merged[k].frames!.length > 0)
                );
                if (actionsWithSprites.length > 0) {
                    setActiveActionKey(actionsWithSprites[0]);
                }
            }

            setActions(merged);
            setActiveFrameIndex(0);
        } catch (err) {
            console.error('Error al cargar datos del personaje:', err);
        }
    }, []);

    // Al montar la página, listar personajes guardados y cargar automáticamente el último
    useEffect(() => {
        let isMounted = true;

        const initCharacters = async () => {
            try {
                const res = await fetch('/api/sprites/characters');
                const json = await res.json();
                if (!isMounted) return;

                const serverChars: string[] = json.characters || [];
                let localChars: string[] = [];
                if (typeof window !== 'undefined') {
                    try {
                        localChars = JSON.parse(localStorage.getItem('sprite_studio_characters') || '[]');
                    } catch {
                        localChars = [];
                    }
                }

                const combined = Array.from(new Set([...serverChars, ...localChars])).filter(Boolean).sort();
                const finalChars = combined.length > 0 ? combined : [DEFAULT_ENV_CHAR];
                setAvailableCharacters(finalChars);

                if (typeof window !== 'undefined') {
                    localStorage.setItem('sprite_studio_characters', JSON.stringify(finalChars));
                }

                const savedChar = typeof window !== 'undefined' ? localStorage.getItem('sprite_studio_last_character') : null;
                const initial = savedChar && finalChars.includes(savedChar)
                    ? savedChar
                    : finalChars.includes(DEFAULT_ENV_CHAR)
                    ? DEFAULT_ENV_CHAR
                    : finalChars[0] || DEFAULT_ENV_CHAR;

                setCharacterName(initial);
                loadCharacterData(initial);
            } catch (err) {
                console.error('Error al consultar lista de personajes:', err);
            }
        };

        initCharacters();

        return () => {
            isMounted = false;
        };
    }, [loadCharacterData]);

    const handleSelectCharacter = (name: string) => {
        setCharacterName(name);
        loadCharacterData(name);
    };

    const handleCreateNewCharacter = () => {
        const clean = newCharName.trim().toLowerCase().replace(/\s+/g, '_');
        if (!clean) {
            setIsCreatingChar(false);
            return;
        }

        const updated = Array.from(new Set([...availableCharacters, clean])).sort();
        setAvailableCharacters(updated);
        setCharacterName(clean);
        setNewCharName('');
        setIsCreatingChar(false);

        if (typeof window !== 'undefined') {
            localStorage.setItem('sprite_studio_characters', JSON.stringify(updated));
            localStorage.setItem('sprite_studio_last_character', clean);
        }

        // Acciones base en blanco para el nuevo personaje
        const fresh: Record<string, ActionConfig> = {};
        for (const item of DEFAULT_ACTIONS) {
            fresh[item.name] = {
                name: item.name,
                label: item.label,
                icon: item.icon,
                sheetUrl: '',
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
                frameOverrides: {},
                frames: [],
                gif: ''
            };
        }
        setActions(fresh);
        setActiveActionKey('correr');
        setActiveImageElement(null);
    };

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

            setActions((prev) => {
                const current = prev[activeActionKey];
                if (!current) return prev;
                const count = current.frameCount || 5;
                const autoW = Math.round(img.naturalWidth / count);
                const autoH = img.naturalHeight;

                return {
                    ...prev,
                    [activeActionKey]: {
                        ...current,
                        totalWidth: img.naturalWidth,
                        totalHeight: img.naturalHeight,
                        frameWidth: current.frameWidth > 0 ? current.frameWidth : autoW,
                        frameHeight: current.frameHeight > 0 ? current.frameHeight : autoH
                    }
                };
            });
        };

        img.onerror = () => {
            if (!isMounted) return;
            console.warn(`No se pudo cargar la imagen para ${activeActionKey}:`, activeAction.sheetUrl);
            setActiveImageElement(null);
        };

        return () => {
            isMounted = false;
        };
    }, [activeAction?.sheetUrl, activeActionKey]);

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

                const actionSlices = calculateFrameSlices(conf);
                const framePaths: string[] = [];

                // Si algún frame fue retocado/limpiado con el borrador, actualizar la hoja compuesta
                const hasAnyCleanedFrame = Object.values(conf.frameOverrides || {}).some((ov) => Boolean(ov.customImage));
                if (hasAnyCleanedFrame) {
                    const sheetCanvas = document.createElement('canvas');
                    sheetCanvas.width = img.naturalWidth;
                    sheetCanvas.height = img.naturalHeight;
                    const sCtx = sheetCanvas.getContext('2d');
                    if (sCtx) {
                        sCtx.drawImage(img, 0, 0);
                        for (let i = 0; i < actionSlices.length; i++) {
                            const cDataUrl = conf.frameOverrides?.[i]?.customImage;
                            if (cDataUrl) {
                                const cImg = new Image();
                                await new Promise<void>((res) => {
                                    cImg.onload = () => res();
                                    cImg.onerror = () => res();
                                    cImg.src = cDataUrl;
                                });
                                const sl = actionSlices[i];
                                sCtx.clearRect(sl.x, sl.y, sl.width, sl.height);
                                sCtx.drawImage(cImg, sl.x, sl.y, sl.width, sl.height);
                            }
                        }
                        fullBase64 = sheetCanvas.toDataURL('image/png');
                    }
                }

                // Guardar como en reference_character:
                // Carpeta de acción: [action]/[action].png (ej: correr/correr.png)
                filesToSave[`${key}/${key}.png`] = fullBase64;
                // Raíz del personaje: [action].png (para compatibilidad directa)
                filesToSave[`${key}.png`] = fullBase64;

                // 2. Extraer y guardar frames individuales en [action]/frames/frame_X.png
                actionSlices.forEach((slice, idx) => {
                    const frameNum = idx + 1;
                    const customImg = conf.frameOverrides?.[idx]?.customImage;
                    const frameBase64 = extractFrameDataUrl(img, slice, customImg);
                    if (frameBase64) {
                        const relPath = `${key}/frames/frame_${frameNum}.png`;
                        filesToSave[relPath] = frameBase64;
                        framePaths.push(`/sprites/${characterName}/${relPath}`);
                    }
                });

                // 3. Generar GIF animado para la acción (como en reference_character: dash.gif, running.gif)
                try {
                    const customImgs: Record<number, string> = {};
                    if (conf.frameOverrides) {
                        for (const [k, v] of Object.entries(conf.frameOverrides)) {
                            if (v.customImage) customImgs[parseInt(k)] = v.customImage;
                        }
                    }
                    const gifBase64 = await createAnimatedGif(img, actionSlices, conf.fps, conf.loop, customImgs);
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
                    totalWidth: conf.totalWidth || (conf.frameWidth ? conf.frameWidth * conf.frameCount : 0),
                    totalHeight: conf.totalHeight || conf.frameHeight || 0,
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

                // Actualizar lista en cache local y estado de disponibles
                setAvailableCharacters((prev) => {
                    const nextList = Array.from(new Set([...prev, characterName])).sort();
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('sprite_studio_characters', JSON.stringify(nextList));
                        localStorage.setItem('sprite_studio_last_character', characterName);
                    }
                    return nextList;
                });

                // Re-sincronizar con el servidor para que los metadatos y frames queden 100% autocompletados
                loadCharacterData(characterName);
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
                        {!isCreatingChar ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <select
                                    value={characterName}
                                    onChange={(e) => {
                                        if (e.target.value === '__new__') {
                                            setIsCreatingChar(true);
                                        } else {
                                            handleSelectCharacter(e.target.value);
                                        }
                                    }}
                                    style={{
                                        background: '#1e293b',
                                        border: '1px solid #334155',
                                        color: '#fbbf24',
                                        borderRadius: '6px',
                                        padding: '5px 10px',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {availableCharacters.map((c) => (
                                        <option key={c} value={c}>
                                            {c}
                                        </option>
                                    ))}
                                    <option value="__new__">+ Nuevo Personaje...</option>
                                </select>
                                <button
                                    onClick={() => setIsCreatingChar(true)}
                                    title="Crear un nuevo personaje"
                                    style={{
                                        background: 'rgba(59, 130, 246, 0.15)',
                                        border: '1px solid rgba(59, 130, 246, 0.4)',
                                        color: '#60a5fa',
                                        borderRadius: '6px',
                                        padding: '5px 8px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <Plus size={12} />
                                    <span>Nuevo</span>
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                    type="text"
                                    placeholder="Nombre personaje"
                                    value={newCharName}
                                    onChange={(e) => setNewCharName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleCreateNewCharacter();
                                        if (e.key === 'Escape') setIsCreatingChar(false);
                                    }}
                                    autoFocus
                                    style={{
                                        background: '#1e293b',
                                        border: '1px solid #3b82f6',
                                        color: '#fbbf24',
                                        borderRadius: '6px',
                                        padding: '5px 8px',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        width: '120px'
                                    }}
                                />
                                <button
                                    onClick={handleCreateNewCharacter}
                                    title="Confirmar"
                                    style={{
                                        background: '#3b82f6',
                                        border: 'none',
                                        color: '#fff',
                                        borderRadius: '5px',
                                        padding: '5px 8px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    <Check size={12} />
                                </button>
                                <button
                                    onClick={() => setIsCreatingChar(false)}
                                    title="Cancelar"
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#94a3b8',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        )}
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
