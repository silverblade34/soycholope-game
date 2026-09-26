import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { DEFAULT_ITEMS_CATALOG, ItemDefinition } from '@/types/items';

export async function GET() {
    try {
        const itemsDir = path.join(process.cwd(), 'public', 'items');
        await fs.mkdir(itemsDir, { recursive: true });

        const catalogPath = path.join(itemsDir, 'catalog.json');
        let currentCatalog: ItemDefinition[] = [...DEFAULT_ITEMS_CATALOG];

        try {
            const raw = await fs.readFile(catalogPath, 'utf-8');
            const saved: ItemDefinition[] = JSON.parse(raw);
            // Combinar con valores por defecto asegurando que no se pierdan IDs nuevos
            const savedMap = new Map(saved.map((item) => [item.id, item]));
            currentCatalog = DEFAULT_ITEMS_CATALOG.map((def) => {
                const existing = savedMap.get(def.id);
                return existing ? { ...def, ...existing } : def;
            });
            // Agregar cualquier item custom extra guardado
            saved.forEach((item) => {
                if (!currentCatalog.some((c) => c.id === item.id)) {
                    currentCatalog.push(item);
                }
            });
        } catch {
            // Si no existe aún catalog.json, se creará al guardar
        }

        // Verificar qué archivos de imagen existen físicamente en public/items
        const files: string[] = await fs.readdir(itemsDir).catch(() => [] as string[]);
        const enrichedCatalog = currentCatalog.map((item) => {
            const filename = `${item.id}.png`;
            const hasImage = files.includes(filename);
            return {
                ...item,
                imageUrl: hasImage ? `/items/${filename}?t=${Date.now()}` : item.imageUrl || ''
            };
        });

        return NextResponse.json({
            success: true,
            catalog: enrichedCatalog
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Error desconocido';
        return NextResponse.json({ error: 'Error al leer catálogo de ítems', details: msg }, { status: 500 });
    }
}
