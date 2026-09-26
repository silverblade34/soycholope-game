'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
    DEFAULT_ITEMS_CATALOG,
    ItemDefinition,
    ItemHeightTier,
    ItemFrequency
} from '@/types/items';
import {
    Upload,
    Save,
    Sparkles,
    AlertCircle,
    CheckCircle2,
    Layers,
    Gamepad2,
    Heart,
    Zap,
    Utensils,
    Scissors,
    Eye
} from 'lucide-react';

interface CropBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export function ItemExtractorStudio() {
    const [catalog, setCatalog] = useState<ItemDefinition[]>(DEFAULT_ITEMS_CATALOG);
    const [selectedItemId, setSelectedItemId] = useState<string>('hueco');
    const [filterCategory, setFilterCategory] = useState<'all' | 'obstaculo' | 'bebida' | 'comida' | 'especial'>('all');

    // Estado de imagen cargada
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
    const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

    // Estado del canvas de selección interactiva
    const [zoom, setZoom] = useState<number>(1);
    const [cropBox, setCropBox] = useState<CropBox>({ x: 40, y: 40, width: 140, height: 140 });
    const [isDrawing, setIsDrawing] = useState<boolean>(false);
    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

    // Opciones de limpieza de fondo (Chroma / Magic Eraser)
    const [removeBg, setRemoveBg] = useState<boolean>(true);
    const [bgTolerance, setBgTolerance] = useState<number>(28);
    const [bgColorChoice, setBgColorChoice] = useState<'auto' | 'white' | 'black'>('auto');

    // Estado de guardado
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [saveStatus, setSaveStatus] = useState<{ success: boolean; message: string } | null>(null);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Cargar catálogo actualizado desde la API
    useEffect(() => {
        let isCancelled = false;
        async function fetchCatalog() {
            try {
                const res = await fetch('/api/items/catalog');
                const data = await res.json();
                if (!isCancelled && data.success && Array.isArray(data.catalog)) {
                    setCatalog(data.catalog);
                }
            } catch {
                // Fallback silencioso
            }
        }
        fetchCatalog();
        return () => {
            isCancelled = true;
        };
    }, []);

    const activeItem = useMemo(() => {
        return catalog.find((c) => c.id === selectedItemId) || catalog[0];
    }, [catalog, selectedItemId]);

    // Manejar carga de archivo de imagen
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result as string;
            const img = new Image();
            img.onload = () => {
                setImageEl(img);
                setImageSrc(result);
                setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
                // Posicionar un recorte inicial centrado
                const initSize = Math.min(200, Math.floor(img.naturalWidth / 4));
                setCropBox({
                    x: Math.floor(img.naturalWidth / 2 - initSize / 2),
                    y: Math.floor(img.naturalHeight / 2 - initSize / 2),
                    width: initSize,
                    height: initSize
                });
            };
            img.src = result;
        };
        reader.readAsDataURL(file);
    };

    // Renderizar preview directamente en el previewCanvasRef
    const updatePreviewCanvas = useCallback(() => {
        const pCanvas = previewCanvasRef.current;
        if (!pCanvas || !imageEl || cropBox.width <= 0 || cropBox.height <= 0) return;

        pCanvas.width = cropBox.width;
        pCanvas.height = cropBox.height;
        const ctx = pCanvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, cropBox.width, cropBox.height);
        ctx.drawImage(
            imageEl,
            cropBox.x,
            cropBox.y,
            cropBox.width,
            cropBox.height,
            0,
            0,
            cropBox.width,
            cropBox.height
        );

        if (removeBg) {
            const imgData = ctx.getImageData(0, 0, cropBox.width, cropBox.height);
            const data = imgData.data;

            let targetR = 255;
            let targetG = 255;
            let targetB = 255;

            if (bgColorChoice === 'black') {
                targetR = 0;
                targetG = 0;
                targetB = 0;
            } else if (bgColorChoice === 'auto') {
                const corners = [0, (cropBox.width - 1) * 4, ((cropBox.height - 1) * cropBox.width) * 4];
                targetR = Math.round(corners.reduce((acc, c) => acc + data[c], 0) / corners.length);
                targetG = Math.round(corners.reduce((acc, c) => acc + data[c + 1], 0) / corners.length);
                targetB = Math.round(corners.reduce((acc, c) => acc + data[c + 2], 0) / corners.length);
            }

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const dist = Math.sqrt(
                    Math.pow(r - targetR, 2) + Math.pow(g - targetG, 2) + Math.pow(b - targetB, 2)
                );

                if (dist < bgTolerance * 2.5) {
                    data[i + 3] = 0; // Transparente
                }
            }

            ctx.putImageData(imgData, 0, 0);
        }
    }, [imageEl, cropBox, removeBg, bgTolerance, bgColorChoice]);

    // Redibujar canvas interactivo cuando cambia cropBox o imagen
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !imageEl) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = imageEl.naturalWidth;
        canvas.height = imageEl.naturalHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(imageEl, 0, 0);

        // Capa semi-oscura fuera del recorte
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Limpiar área del recorte
        ctx.clearRect(cropBox.x, cropBox.y, cropBox.width, cropBox.height);
        ctx.drawImage(
            imageEl,
            cropBox.x,
            cropBox.y,
            cropBox.width,
            cropBox.height,
            cropBox.x,
            cropBox.y,
            cropBox.width,
            cropBox.height
        );

        // Borde del cuadro de recorte
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = activeItem.category === 'obstaculo' ? '#ef4444' : '#10b981';
        ctx.strokeRect(cropBox.x, cropBox.y, cropBox.width, cropBox.height);

        // Guías de esquinas
        const ch = 10;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cropBox.x - 3, cropBox.y - 3, ch, ch);
        ctx.fillRect(cropBox.x + cropBox.width - ch + 3, cropBox.y - 3, ch, ch);
        ctx.fillRect(cropBox.x - 3, cropBox.y + cropBox.height - ch + 3, ch, ch);
        ctx.fillRect(cropBox.x + cropBox.width - ch + 3, cropBox.y + cropBox.height - ch + 3, ch, ch);

        updatePreviewCanvas();
    }, [imageEl, cropBox, activeItem, updatePreviewCanvas]);

    // Interacción con ratón para dibujar cuadro de recorte
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas || !imageEl) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const clickX = Math.round((e.clientX - rect.left) * scaleX);
        const clickY = Math.round((e.clientY - rect.top) * scaleY);

        setIsDrawing(true);
        setDragStart({ x: clickX, y: clickY });
        setCropBox({ x: clickX, y: clickY, width: 10, height: 10 });
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !dragStart || !canvasRef.current || !imageEl) return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const currentX = Math.round((e.clientX - rect.left) * scaleX);
        const currentY = Math.round((e.clientY - rect.top) * scaleY);

        const x = Math.min(dragStart.x, currentX);
        const y = Math.min(dragStart.y, currentY);
        const width = Math.max(15, Math.abs(currentX - dragStart.x));
        const height = Math.max(15, Math.abs(currentY - dragStart.y));

        setCropBox({
            x: Math.max(0, Math.min(imageEl.naturalWidth - width, x)),
            y: Math.max(0, Math.min(imageEl.naturalHeight - height, y)),
            width: Math.min(imageEl.naturalWidth, width),
            height: Math.min(imageEl.naturalHeight, height)
        });
    };

    const handleMouseUp = () => {
        setIsDrawing(false);
        setDragStart(null);
        updatePreviewCanvas();
    };

    // Actualizar propiedades del ítem activo
    const updateActiveItem = (updates: Partial<ItemDefinition>) => {
        setCatalog((prev) =>
            prev.map((item) => (item.id === activeItem.id ? { ...item, ...updates } : item))
        );
    };

    // Guardar ítem en el juego vía API
    const handleSaveItem = async () => {
        const pCanvas = previewCanvasRef.current;
        if (!pCanvas || pCanvas.width <= 0 || !imageSrc) {
            setSaveStatus({ success: false, message: 'Primero recorta o selecciona un elemento de la imagen' });
            return;
        }

        setIsSaving(true);
        setSaveStatus(null);

        try {
            const imageDataUrl = pCanvas.toDataURL('image/png');
            const payload = {
                item: {
                    ...activeItem,
                    cropBox
                },
                imageDataUrl
            };

            const res = await fetch('/api/items/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                setSaveStatus({ success: true, message: `¡"${activeItem.name}" guardado exitosamente en el juego!` });
                const refreshRes = await fetch('/api/items/catalog');
                const refreshData = await refreshRes.json();
                if (refreshData.success && Array.isArray(refreshData.catalog)) {
                    setCatalog(refreshData.catalog);
                }
            } else {
                setSaveStatus({ success: false, message: data.error || 'Error al guardar el ítem' });
            }
        } catch {
            setSaveStatus({ success: false, message: 'Error de conexión al guardar' });
        } finally {
            setIsSaving(false);
            setTimeout(() => setSaveStatus(null), 4500);
        }
    };

    // Filtrar catálogo para la lista
    const filteredCatalog = useMemo(() => {
        if (filterCategory === 'all') return catalog;
        if (filterCategory === 'obstaculo') return catalog.filter((c) => c.category === 'obstaculo');
        if (filterCategory === 'bebida') return catalog.filter((c) => c.subCategory === 'bebida');
        if (filterCategory === 'comida') return catalog.filter((c) => c.subCategory === 'comida');
        if (filterCategory === 'especial') return catalog.filter((c) => c.subCategory === 'especial');
        return catalog;
    }, [catalog, filterCategory]);

    return (
        <div className="flex flex-col gap-6 text-gray-200">
            {/* Header y Acciones Rápidas */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#12141e] border border-[#232738] p-4 rounded-2xl shadow-xl">
                <div>
                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                        <Sparkles className="text-yellow-400" size={20} />
                        <span>Extractor de Obstáculos & Potenciadores IA</span>
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Sube hojas generadas con IA, recorta elementos con un clic y asígnalos al sistema de supervivencia (Vida, Cansancio, Hambre).
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                    />

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition-all active:scale-95 cursor-pointer"
                    >
                        <Upload size={15} />
                        <span>{imageSrc ? 'Cambiar Imagen IA' : 'Subir Hoja de Props IA'}</span>
                    </button>

                    <Link
                        href="/capitulos/1?mode=practice"
                        className="bg-[#1a1c2a] hover:bg-[#25283b] border border-gray-700 text-gray-300 hover:text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all"
                    >
                        <Gamepad2 size={15} className="text-amber-400" />
                        <span>Probar en Juego</span>
                    </Link>
                </div>
            </div>

            {/* Grid Principal: Visor / Recortador a la Izquierda + Configuración a la Derecha */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Panel Izquierdo: Canvas Interactivo con Bounding Box */}
                <div className="lg:col-span-8 flex flex-col gap-3 bg-[#11131c] border border-[#222536] p-4 rounded-2xl shadow-xl">
                    <div className="flex items-center justify-between pb-2 border-b border-[#1f2233]">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
                            <Scissors size={14} className="text-emerald-400" />
                            <span>Lienzo de Recorte Visual</span>
                            {naturalSize.w > 0 && (
                                <span className="text-[11px] font-mono text-gray-500">
                                    ({naturalSize.w} x {naturalSize.h} px)
                                </span>
                            )}
                        </div>

                        {/* Controles de Zoom */}
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setZoom(0.6)}
                                className={`px-2 py-1 text-[11px] font-bold rounded-lg ${zoom === 0.6 ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                            >
                                Ajustar
                            </button>
                            <button
                                onClick={() => setZoom(1)}
                                className={`px-2 py-1 text-[11px] font-bold rounded-lg ${zoom === 1 ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                            >
                                1x
                            </button>
                            <button
                                onClick={() => setZoom(1.5)}
                                className={`px-2 py-1 text-[11px] font-bold rounded-lg ${zoom === 1.5 ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                            >
                                1.5x
                            </button>
                        </div>
                    </div>

                    {/* Área de Visualización */}
                    <div
                        ref={containerRef}
                        className="relative w-full h-[480px] bg-[#090a0f] border border-[#1d202e] rounded-xl overflow-auto flex items-center justify-center select-none"
                        style={{
                            backgroundImage: 'radial-gradient(#1c2030 1px, transparent 1px)',
                            backgroundSize: '16px 16px'
                        }}
                    >
                        {imageSrc ? (
                            <div
                                style={{
                                    transform: `scale(${zoom})`,
                                    transformOrigin: 'center center',
                                    transition: 'transform 0.15s ease'
                                }}
                            >
                                <canvas
                                    ref={canvasRef}
                                    onMouseDown={handleMouseDown}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                    className="cursor-crosshair shadow-2xl rounded"
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center text-gray-500 max-w-sm">
                                <div className="w-16 h-16 rounded-2xl bg-[#141724] border border-[#23273b] flex items-center justify-center text-gray-400">
                                    <Upload size={28} />
                                </div>
                                <div className="text-sm font-bold text-gray-300">
                                    No has cargado una hoja de elementos todavía
                                </div>
                                <p className="text-xs text-gray-500">
                                    Genera una cuadrícula de comida, bebidas y obstáculos peruanos en tu IA preferida y súbela aquí para recortarlos individualmente.
                                </p>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all"
                                >
                                    Cargar Imagen de Prueba
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Barra de Ajustes de Limpieza de Fondo (Chroma) */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-2 text-xs text-gray-400">
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-300">
                            <input
                                type="checkbox"
                                checked={removeBg}
                                onChange={(e) => setRemoveBg(e.target.checked)}
                                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                            />
                            <span>Limpiar Fondo Automático (Transparencia)</span>
                        </label>

                        {removeBg && (
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span>Tolerancia:</span>
                                    <input
                                        type="range"
                                        min="5"
                                        max="60"
                                        value={bgTolerance}
                                        onChange={(e) => setBgTolerance(Number(e.target.value))}
                                        className="w-24 accent-emerald-500 cursor-pointer"
                                    />
                                    <span className="font-mono text-emerald-400 font-bold w-6">{bgTolerance}</span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <span>Color Fondo:</span>
                                    <select
                                        value={bgColorChoice}
                                        onChange={(e) => setBgColorChoice(e.target.value as 'auto' | 'white' | 'black')}
                                        className="bg-[#181a26] border border-gray-700 text-gray-200 text-xs rounded-lg px-2 py-1"
                                    >
                                        <option value="auto">Automático (Esquinas)</option>
                                        <option value="white">Blanco (#FFFFFF)</option>
                                        <option value="black">Negro (#000000)</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="font-mono text-[11px] text-gray-500">
                            Recorte: {cropBox.width} x {cropBox.height} px en ({cropBox.x}, {cropBox.y})
                        </div>
                    </div>
                </div>

                {/* Panel Derecho: Previsualización y Asignación de Mecánicas */}
                <div className="lg:col-span-4 flex flex-col gap-4 bg-[#11131c] border border-[#222536] p-4 rounded-2xl shadow-xl">
                    <div className="flex items-center justify-between pb-2 border-b border-[#1f2233]">
                        <span className="text-xs font-black uppercase text-gray-300 tracking-wider">
                            Asignación & Mecánica
                        </span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            activeItem.category === 'obstaculo'
                                ? 'bg-red-950/80 border border-red-500 text-red-300'
                                : 'bg-emerald-950/80 border border-emerald-500 text-emerald-300'
                        }`}>
                            {activeItem.category.toUpperCase()}
                        </span>
                    </div>

                    {/* Previsualización del Sprite Recortado */}
                    <div className="flex items-center justify-center p-4 bg-[#090a10] border border-[#212435] rounded-xl relative overflow-hidden h-40">
                        <canvas
                            ref={previewCanvasRef}
                            className={`max-h-28 max-w-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] ${
                                imageSrc ? 'block' : 'hidden'
                            }`}
                        />
                        {!imageSrc && activeItem.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={activeItem.imageUrl}
                                alt={activeItem.name}
                                className="max-h-28 max-w-full object-contain"
                            />
                        ) : !imageSrc ? (
                            <div className="text-xs text-gray-500 text-center">
                                Selecciona un área con el ratón en la imagen para previsualizar el sprite
                            </div>
                        ) : null}

                        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 px-2 py-0.5 rounded text-[10px] text-gray-400">
                            <Eye size={11} />
                            <span>Sprite Recortado</span>
                        </div>
                    </div>

                    {/* Selector del Ítem del Catálogo a Asignar */}
                    <div>
                        <label className="text-xs font-bold text-gray-300 mb-1.5 block">
                            Elemento a Construir / Actualizar:
                        </label>
                        <select
                            value={selectedItemId}
                            onChange={(e) => setSelectedItemId(e.target.value)}
                            className="w-full bg-[#181b29] border border-gray-700 text-white font-bold text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500 cursor-pointer"
                        >
                            <optgroup label="Obstáculos (Daño o Impedimento)">
                                {catalog
                                    .filter((c) => c.category === 'obstaculo')
                                    .map((item) => (
                                        <option key={item.id} value={item.id}>
                                            🚧 {item.name} ({item.effects.mechanicHint})
                                        </option>
                                    ))}
                            </optgroup>
                            <optgroup label="Bebidas (Afectan Cansancio)">
                                {catalog
                                    .filter((c) => c.subCategory === 'bebida')
                                    .map((item) => (
                                        <option key={item.id} value={item.id}>
                                            🥤 {item.name} ({item.effects.cansancioDelta}% Cansancio)
                                        </option>
                                    ))}
                            </optgroup>
                            <optgroup label="Comidas (Afectan Hambre)">
                                {catalog
                                    .filter((c) => c.subCategory === 'comida')
                                    .map((item) => (
                                        <option key={item.id} value={item.id}>
                                            🍖 {item.name} (+{item.effects.hambreDelta} Hambre)
                                        </option>
                                    ))}
                            </optgroup>
                            <optgroup label="Especiales">
                                {catalog
                                    .filter((c) => c.subCategory === 'especial')
                                    .map((item) => (
                                        <option key={item.id} value={item.id}>
                                            🛡️ {item.name} (Escudo Temporal)
                                        </option>
                                    ))}
                            </optgroup>
                        </select>
                    </div>

                    {/* Nivel de Altura en el Escenario */}
                    <div className="bg-[#161826] border border-[#24273d] p-3 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-gray-300">Nivel de Aparición:</span>
                            <span className={`font-black text-[11px] uppercase px-2 py-0.5 rounded ${
                                activeItem.tier === 'piso'
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                                    : activeItem.tier === 'medio'
                                      ? 'bg-amber-950 text-amber-400 border border-amber-500/40'
                                      : 'bg-purple-950 text-purple-400 border border-purple-500/40'
                            }`}>
                                Nivel {activeItem.tier.toUpperCase()}
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                            {(['piso', 'medio', 'alto'] as ItemHeightTier[]).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => updateActiveItem({ tier: t })}
                                    className={`py-1.5 rounded-lg font-bold uppercase transition-all ${
                                        activeItem.tier === t
                                            ? 'bg-gray-200 text-black shadow'
                                            : 'bg-gray-800/80 text-gray-400 hover:text-white'
                                    }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>

                        <p className="text-[11px] text-gray-400 italic">
                            {activeItem.tier === 'piso' && '• Piso: Se recoge o impacta al correr en la pista.'}
                            {activeItem.tier === 'medio' && '• Medio: Ubicado tras un obstáculo, requiere saltar para alcanzarlo.'}
                            {activeItem.tier === 'alto' && '• Alto: Flota en el aire, requiere salto preciso o agacharse para esquivar.'}
                        </p>
                    </div>

                    {/* Ficha de Efectos del Sistema de Barras */}
                    <div className="bg-[#141622] border border-[#212437] p-3 rounded-xl space-y-2.5 text-xs">
                        <div className="font-bold text-gray-300 flex items-center justify-between">
                            <span>Efectos en Sistema de Barras:</span>
                            <span className="text-[10px] text-gray-500 font-mono">{activeItem.effects.mechanicHint}</span>
                        </div>

                        {/* Modificadores */}
                        <div className="grid grid-cols-3 gap-2 text-[11px]">
                            {/* Vida */}
                            <div className="bg-[#1c1f2e] p-2 rounded-lg border border-gray-800">
                                <div className="text-gray-400 text-[10px] flex items-center gap-1 mb-0.5">
                                    <Heart size={11} className="text-red-400" />
                                    <span>Vida</span>
                                </div>
                                <input
                                    type="number"
                                    value={activeItem.effects.vidaDelta ?? 0}
                                    onChange={(e) =>
                                        updateActiveItem({
                                            effects: { ...activeItem.effects, vidaDelta: Number(e.target.value) }
                                        })
                                    }
                                    className="w-full bg-transparent font-bold font-mono text-white text-xs outline-none"
                                />
                            </div>

                            {/* Cansancio */}
                            <div className="bg-[#1c1f2e] p-2 rounded-lg border border-gray-800">
                                <div className="text-gray-400 text-[10px] flex items-center gap-1 mb-0.5">
                                    <Zap size={11} className="text-yellow-400" />
                                    <span>Cansancio</span>
                                </div>
                                <input
                                    type="number"
                                    value={activeItem.effects.cansancioDelta ?? 0}
                                    onChange={(e) =>
                                        updateActiveItem({
                                            effects: { ...activeItem.effects, cansancioDelta: Number(e.target.value) }
                                        })
                                    }
                                    className="w-full bg-transparent font-bold font-mono text-white text-xs outline-none"
                                />
                            </div>

                            {/* Hambre */}
                            <div className="bg-[#1c1f2e] p-2 rounded-lg border border-gray-800">
                                <div className="text-gray-400 text-[10px] flex items-center gap-1 mb-0.5">
                                    <Utensils size={11} className="text-amber-400" />
                                    <span>Hambre</span>
                                </div>
                                <input
                                    type="number"
                                    value={activeItem.effects.hambreDelta ?? 0}
                                    onChange={(e) =>
                                        updateActiveItem({
                                            effects: { ...activeItem.effects, hambreDelta: Number(e.target.value) }
                                        })
                                    }
                                    className="w-full bg-transparent font-bold font-mono text-white text-xs outline-none"
                                />
                            </div>
                        </div>

                        {/* Frecuencia de Spawn */}
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-gray-800">
                            <span className="text-gray-400">Frecuencia en pista:</span>
                            <select
                                value={activeItem.frequency}
                                onChange={(e) => updateActiveItem({ frequency: e.target.value as ItemFrequency })}
                                className="bg-[#1d202e] border border-gray-700 text-gray-200 text-[11px] rounded px-2 py-0.5"
                            >
                                <option value="muy_frecuente">Muy Frecuente (Relleno/Monedas)</option>
                                <option value="media">Media (Equilibrado)</option>
                                <option value="rara">Rara (~5-10% spawn)</option>
                            </select>
                        </div>
                    </div>

                    {/* Mensaje de feedback de guardado */}
                    {saveStatus && (
                        <div
                            className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                                saveStatus.success
                                    ? 'bg-emerald-950/80 border border-emerald-500/80 text-emerald-300'
                                    : 'bg-red-950/80 border border-red-500/80 text-red-300'
                            }`}
                        >
                            {saveStatus.success ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                            <span>{saveStatus.message}</span>
                        </div>
                    )}

                    {/* Botón de Guardar en el Juego */}
                    <button
                        onClick={handleSaveItem}
                        disabled={isSaving || !imageSrc}
                        className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer ${
                            imageSrc
                                ? 'bg-[#e62329] hover:bg-red-700 text-white shadow-red-950/50 active:scale-98'
                                : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                        }`}
                    >
                        <Save size={15} />
                        <span>{isSaving ? 'Guardando en el Juego...' : `Guardar "${activeItem.name}" en el Juego`}</span>
                    </button>
                </div>
            </div>

            {/* Catálogo Maestro: Grid Visual de Todos los Ítems */}
            <div className="bg-[#11131c] border border-[#222536] p-4 rounded-2xl shadow-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2233] pb-3">
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Layers size={16} className="text-cyan-400" />
                            <span>Catálogo de Supervivencia Limeña ({catalog.length} Elementos)</span>
                        </h3>
                        <p className="text-xs text-gray-400">
                            Haz clic en cualquier elemento para seleccionarlo y asignarle su sprite recortado.
                        </p>
                    </div>

                    {/* Filtros por Categoría */}
                    <div className="flex items-center gap-1.5 bg-[#181a26] p-1 rounded-xl border border-gray-800 text-xs font-bold">
                        <button
                            onClick={() => setFilterCategory('all')}
                            className={`px-3 py-1 rounded-lg transition-all ${filterCategory === 'all' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Todos ({catalog.length})
                        </button>
                        <button
                            onClick={() => setFilterCategory('obstaculo')}
                            className={`px-3 py-1 rounded-lg transition-all ${filterCategory === 'obstaculo' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Obstáculos
                        </button>
                        <button
                            onClick={() => setFilterCategory('bebida')}
                            className={`px-3 py-1 rounded-lg transition-all ${filterCategory === 'bebida' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Bebidas
                        </button>
                        <button
                            onClick={() => setFilterCategory('comida')}
                            className={`px-3 py-1 rounded-lg transition-all ${filterCategory === 'comida' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Comida
                        </button>
                        <button
                            onClick={() => setFilterCategory('especial')}
                            className={`px-3 py-1 rounded-lg transition-all ${filterCategory === 'especial' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Especial
                        </button>
                    </div>
                </div>

                {/* Grid de Ítems */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {filteredCatalog.map((item) => {
                        const isSelected = item.id === activeItem.id;
                        const hasImg = Boolean(item.imageUrl);

                        return (
                            <div
                                key={item.id}
                                onClick={() => setSelectedItemId(item.id)}
                                className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                                    isSelected
                                        ? 'bg-[#1a1f33] border-emerald-500 shadow-lg shadow-emerald-950/40 scale-102'
                                        : 'bg-[#141624] border-[#222538] hover:border-gray-600'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                        item.tier === 'piso'
                                            ? 'bg-emerald-950 text-emerald-400'
                                            : item.tier === 'medio'
                                              ? 'bg-amber-950 text-amber-400'
                                              : 'bg-purple-950 text-purple-400'
                                    }`}>
                                        {item.tier}
                                    </span>

                                    {hasImg ? (
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-900" title="Sprite configurado" />
                                    ) : (
                                        <span className="w-2 h-2 rounded-full bg-gray-600" title="Pendiente de recortar" />
                                    )}
                                </div>

                                {/* Miniatura */}
                                <div className="h-16 w-full flex items-center justify-center bg-[#0d0f18] rounded-lg overflow-hidden p-1">
                                    {item.imageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={item.imageUrl}
                                            alt={item.name}
                                            className="max-h-full max-w-full object-contain"
                                        />
                                    ) : (
                                        <div className="text-[10px] text-gray-600 font-mono text-center">
                                            Sin Sprite
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <div className="text-xs font-bold text-white truncate">{item.name}</div>
                                    <div className="text-[10px] text-gray-400 truncate">
                                        {item.category === 'obstaculo' && item.effects.vidaDelta
                                            ? `${item.effects.vidaDelta} Vida`
                                            : ''}
                                        {item.subCategory === 'bebida' && item.effects.cansancioDelta
                                            ? `${item.effects.cansancioDelta}% Cansancio`
                                            : ''}
                                        {item.subCategory === 'comida' && item.effects.hambreDelta
                                            ? `+${item.effects.hambreDelta} Hambre`
                                            : ''}
                                        {item.subCategory === 'especial' ? 'Escudo 8s' : ''}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
