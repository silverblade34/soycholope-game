import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(req: NextRequest) {
    try {
        const spritesDir = path.join(process.cwd(), 'public', 'sprites');
        await fs.mkdir(spritesDir, { recursive: true });

        const entries = await fs.readdir(spritesDir, { withFileTypes: true });
        const characters = entries
            .filter((dirent) => dirent.isDirectory() && !dirent.name.startsWith('.'))
            .map((dirent) => dirent.name);

        const url = new URL(req.url);
        const requestedChar = url.searchParams.get('character') || '';

        let characterData: any = null;

        if (requestedChar && characters.includes(requestedChar)) {
            const charDir = path.join(spritesDir, requestedChar);
            const metaPath = path.join(charDir, 'metadata.json');

            try {
                const metaRaw = await fs.readFile(metaPath, 'utf-8');
                characterData = JSON.parse(metaRaw);
            } catch {
                characterData = { characterName: requestedChar, actions: {} };
            }

            // Descubrir automáticamente acciones adicionales en disco si no estaban en metadata
            try {
                const charEntries = await fs.readdir(charDir, { withFileTypes: true });
                for (const item of charEntries) {
                    if (item.isDirectory() && !['frames', 'output'].includes(item.name)) {
                        const actionName = item.name;
                        if (!characterData.actions[actionName]) {
                            characterData.actions[actionName] = {
                                name: actionName,
                                label: actionName.toUpperCase(),
                                frameCount: 5,
                                spriteSheet: `/sprites/${requestedChar}/${actionName}/${actionName}.png`,
                                spriteSheetRoot: `/sprites/${requestedChar}/${actionName}.png`
                            };
                        }
                    } else if (item.isFile() && item.name.endsWith('.png') && item.name !== 'character.png') {
                        const actionName = item.name.replace('.png', '');
                        if (!characterData.actions[actionName]) {
                            characterData.actions[actionName] = {
                                name: actionName,
                                label: actionName.toUpperCase(),
                                frameCount: 5,
                                spriteSheet: `/sprites/${requestedChar}/${item.name}`,
                                spriteSheetRoot: `/sprites/${requestedChar}/${item.name}`
                            };
                        }
                    }
                }
            } catch (err) {
                console.warn('Error escaneando acciones en disco:', err);
            }
        }

        return NextResponse.json({
            characters,
            character: requestedChar,
            data: characterData
        });
    } catch (error: any) {
        console.error('Error al listar personajes:', error);
        return NextResponse.json(
            { error: 'Error al leer personajes', details: error.message },
            { status: 500 }
        );
    }
}
