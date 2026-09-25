import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
    try {
        const spritesDir = path.join(process.cwd(), 'public', 'sprites', 'cholo');
        try {
            await fs.access(spritesDir);
        } catch {
            return NextResponse.json({ exists: false, files: [] });
        }

        const files = await fs.readdir(spritesDir);
        const pngFiles = files.filter(f => f.endsWith('.png')).map(f => `/sprites/cholo/${f}`);

        return NextResponse.json({
            exists: pngFiles.length > 0,
            files: pngFiles
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        return NextResponse.json({ exists: false, files: [], error: msg });
    }
}
