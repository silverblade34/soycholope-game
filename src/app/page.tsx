'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function HomePage() {
    const [selectedMode, setSelectedMode] = useState<'turista' | 'causa' | 'conero'>('causa');

    return (
        <div className="min-h-screen bg-[#0d0e12] text-white font-mono flex flex-col justify-between p-6 md:p-12 relative overflow-hidden select-none">
            {/* Fondo con textura sutil de Lima */}
            <div
                className="absolute inset-0 opacity-15 pointer-events-none bg-cover bg-center"
                style={{ backgroundImage: 'url(/primer-plano.png)' }}
            />

            {/* Header / Logo */}
            <header className="relative z-10 flex justify-between items-center max-w-6xl mx-auto w-full">
                <div className="flex items-center gap-2">
                    <span className="text-[#e62329] text-2xl font-black">★</span>
                    <span className="text-xl md:text-2xl font-black tracking-widest text-white">SOYCHÓLOPE*</span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                    <Link
                        href="/tools/sprites"
                        className="bg-[#1f212e] hover:bg-[#2a2d3e] border border-yellow-500/40 text-yellow-400 font-bold px-3 py-1.5 rounded flex items-center gap-1.5 shadow"
                    >
                        <span>⚡</span>
                        <span>GENERADOR DE SPRITES</span>
                    </Link>
                </div>
            </header>

            {/* Contenido Central */}
            <main className="relative z-10 max-w-6xl mx-auto w-full my-auto py-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                    {/* Columna Izquierda: Título y Botones */}
                    <div className="lg:col-span-6 space-y-6">
                        <div className="space-y-1">
                            <span className="text-xs uppercase tracking-widest text-[#e62329] font-bold">
                                TU HISTORIA, A TU MANERA.
                            </span>
                            <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-none text-white uppercase drop-shadow-lg">
                                PERÚ:
                                <br />
                                <span className="text-[#e62329]">MODO SUPERVIVENCIA</span>
                            </h1>
                            <p className="text-xs text-gray-400 italic pt-1">
                                &ldquo;De barrio, de ninguna frontera. Aquí también se sobrevive.&rdquo;
                            </p>
                        </div>

                        {/* Botones de acción */}
                        <div className="space-y-3 pt-2 max-w-sm">
                            <Link
                                href="/capitulos/1"
                                className="w-full py-4 bg-[#e62329] hover:bg-red-700 text-white font-black text-sm rounded shadow-xl shadow-red-900/40 flex items-center justify-between px-6 uppercase tracking-wider transition-transform active:scale-98"
                            >
                                <span>JUGAR CAPÍTULO 01</span>
                                <span>➔</span>
                            </Link>

                            <Link
                                href="/tools/sprites"
                                className="w-full py-3 bg-[#171923] hover:bg-[#202332] border border-[#2e3246] text-gray-200 font-bold text-xs rounded flex items-center justify-between px-6 uppercase tracking-wider"
                            >
                                <span>GENERADOR DE SPRITES IA</span>
                                <span className="text-yellow-400">⚡</span>
                            </Link>
                        </div>
                    </div>

                    {/* Columna Derecha: Selección de Modos (Referencia exacta) */}
                    <div className="lg:col-span-6 space-y-4">
                        <div className="text-center md:text-left">
                            <h2 className="text-base font-black uppercase tracking-wider text-gray-200">
                                ELIGE TU MODO
                            </h2>
                            <p className="text-xs text-gray-400">¿Qué tan bravo eres, causa?</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Modo Turista */}
                            <div
                                onClick={() => setSelectedMode('turista')}
                                className={`cursor-pointer rounded-lg p-4 border-2 transition-all ${
                                    selectedMode === 'turista'
                                        ? 'border-emerald-500 bg-emerald-950/40 scale-102 shadow-lg shadow-emerald-900/30'
                                        : 'border-[#232635] bg-[#141620] hover:border-gray-600'
                                }`}
                            >
                                <div className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded w-fit mb-2">
                                    MODO TURISTA
                                </div>
                                <div className="space-y-2 text-[11px] text-gray-300">
                                    <div className="font-bold text-white">Todavía confías en Google Maps.</div>
                                    <div className="flex items-center gap-1.5 text-gray-400">
                                        <span>❤️</span> 3 Vidas
                                    </div>
                                    <div className="flex items-center gap-1.5 text-gray-400">
                                        <span>👟</span> Velocidad Normal
                                    </div>
                                    <div className="flex items-center gap-1.5 text-gray-400">
                                        <span>📦</span> Obstáculos básicos
                                    </div>
                                </div>
                            </div>

                            {/* Modo Causa */}
                            <div
                                onClick={() => setSelectedMode('causa')}
                                className={`cursor-pointer rounded-lg p-4 border-2 transition-all ${
                                    selectedMode === 'causa'
                                        ? 'border-yellow-500 bg-yellow-950/40 scale-102 shadow-lg shadow-yellow-900/30'
                                        : 'border-[#232635] bg-[#141620] hover:border-gray-600'
                                }`}
                            >
                                <div className="text-[10px] font-black uppercase text-yellow-400 bg-yellow-950/80 px-2 py-0.5 rounded w-fit mb-2">
                                    MODO CAUSA
                                </div>
                                <div className="space-y-2 text-[11px] text-gray-300">
                                    <div className="font-bold text-white">Ya sabes dónde guardar el celu.</div>
                                    <div className="flex items-center gap-1.5 text-gray-400">
                                        <span>❤️</span> 2 Vidas
                                    </div>
                                    <div className="flex items-center gap-1.5 text-gray-400">
                                        <span>👟</span> Velocidad Rápida
                                    </div>
                                    <div className="flex items-center gap-1.5 text-gray-400">
                                        <span>📦</span> Obstáculos variados
                                    </div>
                                </div>
                            </div>

                            {/* Modo Conero */}
                            <div
                                onClick={() => setSelectedMode('conero')}
                                className={`cursor-pointer rounded-lg p-4 border-2 transition-all ${
                                    selectedMode === 'conero'
                                        ? 'border-[#e62329] bg-red-950/40 scale-102 shadow-lg shadow-red-900/30'
                                        : 'border-[#232635] bg-[#141620] hover:border-gray-600'
                                }`}
                            >
                                <div className="text-[10px] font-black uppercase text-red-400 bg-red-950/80 px-2 py-0.5 rounded w-fit mb-2">
                                    MODO CONERO
                                </div>
                                <div className="space-y-2 text-[11px] text-gray-300">
                                    <div className="font-bold text-white">La calle ya te conoce.</div>
                                    <div className="flex items-center gap-1.5 text-gray-400">
                                        <span>❤️</span> 1 Vida
                                    </div>
                                    <div className="flex items-center gap-1.5 text-gray-400">
                                        <span>👟</span> Muy rápida
                                    </div>
                                    <div className="flex items-center gap-1.5 text-gray-400">
                                        <span>📦</span> Obstáculos caóticos
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 flex justify-between items-center text-[10px] text-gray-500 max-w-6xl mx-auto w-full border-t border-[#1d202b] pt-4">
                <span>SOY CHÓLOPE © 2026 — LIMA, PERÚ</span>
                <span>MOTOR: NEXT.JS APP ROUTER + CANVAS 2D</span>
            </footer>
        </div>
    );
}
