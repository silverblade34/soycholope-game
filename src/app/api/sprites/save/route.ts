import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { character = 'cholo', files, metadata } = body;

        if ((!files || typeof files !== 'object') && !metadata) {
            return NextResponse.json({ error: 'No se enviaron archivos ni metadata válidos' }, { status: 400 });
        }

        const targetDir = path.join(process.cwd(), 'public', 'sprites', character);
        await fs.mkdir(targetDir, { recursive: true });

        const savedFiles: string[] = [];

        if (files && typeof files === 'object') {
            for (const [filename, base64Data] of Object.entries(files)) {
                if (typeof base64Data !== 'string') continue;

                const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
                const buffer = Buffer.from(cleanBase64, 'base64');

                const safeFilename = filename.endsWith('.png') ? filename : `${filename}.png`;
                const filePath = path.join(targetDir, safeFilename);

                await fs.mkdir(path.dirname(filePath), { recursive: true });
                await fs.writeFile(filePath, buffer);
                savedFiles.push(`/sprites/${character}/${safeFilename}`);
            }
        }

        if (body.metadata) {
            const metaPath = path.join(targetDir, 'metadata.json');
            await fs.writeFile(metaPath, JSON.stringify(body.metadata, null, 2), 'utf-8');
            savedFiles.push(`/sprites/${character}/metadata.json`);
        }

        return NextResponse.json({
            success: true,
            message: `Sprites guardados exitosamente en public/sprites/${character}`,
            savedFiles
        });
    } catch (error: any) {
        console.error('Error al guardar sprites:', error);
        return NextResponse.json(
            { error: 'Error en el servidor al guardar sprites', details: error.message },
            { status: 500 }
        );
    }
}
