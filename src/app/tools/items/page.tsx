'use client';

import React from 'react';
import Link from 'next/link';
import { ItemExtractorStudio } from '@/components/items/ItemExtractorStudio';
import { Film, Package, ArrowLeft } from 'lucide-react';

export default function ItemsStudioPage() {
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
            <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Navegación Superior entre herramientas */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-[#131824] border border-[#1e293b] p-3.5 px-5 rounded-2xl">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/"
                            className="bg-[#1c2233] hover:bg-[#252c42] border border-gray-700 text-gray-300 hover:text-white p-2 rounded-xl text-xs flex items-center gap-1.5 transition-all"
                            title="Volver al Inicio"
                        >
                            <ArrowLeft size={14} />
                            <span className="hidden sm:inline font-bold">Inicio</span>
                        </Link>

                        <div className="flex items-center bg-[#0d111a] p-1 rounded-xl border border-[#202738]">
                            <Link
                                href="/tools/sprites"
                                className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-gray-400 hover:text-white flex items-center gap-1.5 transition-all"
                            >
                                <Film size={13} className="text-amber-400" />
                                <span>Sprites de Personajes</span>
                            </Link>

                            <div className="px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider bg-emerald-500 text-black flex items-center gap-1.5 shadow-md">
                                <Package size={13} />
                                <span>Obstáculos & Potenciadores</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-xs text-gray-400 hidden md:block">
                        <span className="text-emerald-400 font-bold">Motor:</span> Extractor Inteligente con Chroma & Catálogo de Supervivencia
                    </div>
                </div>

                {/* Estudio de Extracción de Items */}
                <ItemExtractorStudio />
            </div>
        </div>
    );
}
