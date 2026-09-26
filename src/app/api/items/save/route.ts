import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { ItemDefinition } from '@/types/items';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { item, imageDataUrl } = body;

        if (!item || !item.id) {
            return NextResponse.json({ error: 'Falta información requerida del ítem' }, { status: 400 });
        }

        const itemsDir = path.join(process.cwd(), 'public', 'items');
        await fs.mkdir(itemsDir, { recursive: true });

        let savedImageUrl = item.imageUrl || '';

        // Guardar imagen si se envió dataUrl
        if (imageDataUrl && typeof imageDataUrl === 'string') {
            const cleanBase64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(cleanBase64, 'base64');
            const filename = `${item.id}.png`;
            const filePath = path.join(itemsDir, filename);

            await fs.writeFile(filePath, buffer);
            savedImageUrl = `/items/${filename}`;
        }

        // Actualizar catalog.json
        const catalogPath = path.join(itemsDir, 'catalog.json');
        let catalog: ItemDefinition[] = [];

        try {
            const raw = await fs.readFile(catalogPath, 'utf-8');
            catalog = JSON.parse(raw);
        } catch {
            catalog = [];
        }

        const updatedItem: ItemDefinition = {
            ...item,
            imageUrl: savedImageUrl,
            updatedAt: new Date().toISOString()
        };

        const existingIndex = catalog.findIndex((c) => c.id === item.id);
        if (existingIndex >= 0) {
            catalog[existingIndex] = updatedItem;
        } else {
            catalog.push(updatedItem);
        }

        await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 2), 'utf-8');

        return NextResponse.json({
            success: true,
            message: `Ítem "${item.name}" guardado exitosamente en el juego`,
            item: updatedItem
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Error desconocido';
        console.error('Error al guardar ítem:', error);
        return NextResponse.json(
            { error: 'Error en el servidor al guardar el ítem', details: msg },
            { status: 500 }
        );
    }
}
