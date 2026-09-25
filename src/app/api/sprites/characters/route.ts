import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

interface ActionMeta {
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
    totalWidth?: number;
    totalHeight?: number;
    frameOverrides?: Record<number, { x?: number; y?: number; width?: number; height?: number }>;
    spriteSheet?: string;
    spriteSheetRoot?: string;
    gif?: string;
    frames?: string[];
}

interface CharacterMetadata {
    characterName: string;
    updatedAt?: string;
    actions: Record<string, ActionMeta>;
}

/**
 * Lee los primeros 24 bytes del encabezado PNG para extraer width y height sin cargar toda la imagen
 */
async function getPngDimensions(filePath: string): Promise<{ width: number; height: number } | null> {
    try {
        const fh = await fs.open(filePath, 'r');
        const buf = Buffer.alloc(24);
        await fh.read(buf, 0, 24, 0);
        await fh.close();
        if (buf.toString('ascii', 1, 4) === 'PNG') {
            const width = buf.readUInt32BE(16);
            const height = buf.readUInt32BE(20);
            return { width, height };
        }
    } catch {
        // archivo no existe o no es png válido
    }
    return null;
}

export async function GET(req: NextRequest) {
    try {
        const spritesDir = path.join(process.cwd(), 'public', 'sprites');
        await fs.mkdir(spritesDir, { recursive: true });

        const entries = await fs.readdir(spritesDir, { withFileTypes: true });
        const characters = entries
            .filter((dirent) => dirent.isDirectory() && !dirent.name.startsWith('.'))
            .map((dirent) => dirent.name)
            .sort();

        const url = new URL(req.url);
        const requestedChar = url.searchParams.get('character') || '';

        let characterData: CharacterMetadata | null = null;

        if (requestedChar && characters.includes(requestedChar)) {
            const charDir = path.join(spritesDir, requestedChar);
            const metaPath = path.join(charDir, 'metadata.json');

            try {
                const metaRaw = await fs.readFile(metaPath, 'utf-8');
                characterData = JSON.parse(metaRaw) as CharacterMetadata;
            } catch {
                characterData = { characterName: requestedChar, actions: {} };
            }

            if (!characterData.actions) {
                characterData.actions = {};
            }

            let modified = false;

            // Descubrir automáticamente acciones y frames en disco
            try {
                const charEntries = await fs.readdir(charDir, { withFileTypes: true });
                for (const item of charEntries) {
                    if (item.isDirectory() && !['frames', 'output', '.git'].includes(item.name)) {
                        const actionName = item.name;
                        const actionDir = path.join(charDir, actionName);

                        // 1. Descubrir frames individuales recortados
                        let framePaths: string[] = [];
                        const framesDir = path.join(actionDir, 'frames');
                        try {
                            const frameEntries = await fs.readdir(framesDir);
                            framePaths = frameEntries
                                .filter((f) => f.endsWith('.png'))
                                .sort((a, b) => {
                                    const numA = parseInt(a.replace(/\D/g, '')) || 0;
                                    const numB = parseInt(b.replace(/\D/g, '')) || 0;
                                    return numA - numB;
                                })
                                .map((f) => `/sprites/${requestedChar}/${actionName}/frames/${f}`);
                        } catch {
                            // Sin carpeta frames
                        }

                        // 2. Localizar sprite sheet
                        let spriteSheetUrl = '';
                        let dimensions: { width: number; height: number } | null = null;
                        const nestedSheet = path.join(actionDir, `${actionName}.png`);
                        const rootSheet = path.join(charDir, `${actionName}.png`);

                        try {
                            await fs.access(nestedSheet);
                            spriteSheetUrl = `/sprites/${requestedChar}/${actionName}/${actionName}.png`;
                            dimensions = await getPngDimensions(nestedSheet);
                        } catch {
                            try {
                                await fs.access(rootSheet);
                                spriteSheetUrl = `/sprites/${requestedChar}/${actionName}.png`;
                                dimensions = await getPngDimensions(rootSheet);
                            } catch {
                                // No hay sheet
                            }
                        }

                        // 3. Localizar GIF
                        let gifUrl = '';
                        const nestedGif = path.join(actionDir, `${actionName}.gif`);
                        const rootGif = path.join(charDir, `${actionName}.gif`);
                        try {
                            await fs.access(nestedGif);
                            gifUrl = `/sprites/${requestedChar}/${actionName}/${actionName}.gif`;
                        } catch {
                            try {
                                await fs.access(rootGif);
                                gifUrl = `/sprites/${requestedChar}/${actionName}.gif`;
                            } catch {
                                // No hay gif
                            }
                        }

                        const existingAction: ActionMeta = characterData.actions[actionName] || {};
                        const frameCount = existingAction.frameCount || (framePaths.length > 0 ? framePaths.length : 5);
                        const totalW = dimensions?.width || existingAction.totalWidth || (existingAction.frameWidth ? existingAction.frameWidth * frameCount : 0);
                        const totalH = dimensions?.height || existingAction.totalHeight || existingAction.frameHeight || 0;
                        const frameW = existingAction.frameWidth || (totalW > 0 ? Math.round(totalW / frameCount) : 0);
                        const frameH = existingAction.frameHeight || totalH;

                        const updatedAction: ActionMeta = {
                            name: actionName,
                            label: existingAction.label || actionName.toUpperCase(),
                            frameCount,
                            frameWidth: frameW,
                            frameHeight: frameH,
                            offsetX: existingAction.offsetX || 0,
                            offsetY: existingAction.offsetY || 0,
                            spacing: existingAction.spacing || 0,
                            fps: existingAction.fps || 10,
                            loop: existingAction.loop !== undefined ? existingAction.loop : true,
                            totalWidth: totalW,
                            totalHeight: totalH,
                            frameOverrides: existingAction.frameOverrides || {},
                            spriteSheet: existingAction.spriteSheet || spriteSheetUrl,
                            spriteSheetRoot: `/sprites/${requestedChar}/${actionName}.png`,
                            gif: existingAction.gif || gifUrl,
                            frames: existingAction.frames && existingAction.frames.length > 0 ? existingAction.frames : framePaths
                        };

                        if (JSON.stringify(characterData.actions[actionName]) !== JSON.stringify(updatedAction)) {
                            characterData.actions[actionName] = updatedAction;
                            modified = true;
                        }
                    } else if (item.isFile() && item.name.endsWith('.png') && item.name !== 'character.png') {
                        const actionName = item.name.replace('.png', '');
                        if (!characterData.actions[actionName]) {
                            const sheetPath = path.join(charDir, item.name);
                            const dimensions = await getPngDimensions(sheetPath);
                            const totalW = dimensions?.width || 0;
                            const totalH = dimensions?.height || 0;
                            const count = 5;

                            characterData.actions[actionName] = {
                                name: actionName,
                                label: actionName.toUpperCase(),
                                frameCount: count,
                                frameWidth: totalW > 0 ? Math.round(totalW / count) : 0,
                                frameHeight: totalH,
                                offsetX: 0,
                                offsetY: 0,
                                spacing: 0,
                                fps: 10,
                                loop: true,
                                totalWidth: totalW,
                                totalHeight: totalH,
                                frameOverrides: {},
                                spriteSheet: `/sprites/${requestedChar}/${item.name}`,
                                spriteSheetRoot: `/sprites/${requestedChar}/${item.name}`,
                                gif: '',
                                frames: []
                            };
                            modified = true;
                        }
                    }
                }

                // Si descubrimos nuevas acciones o enriquecimos los metadatos, actualizar metadata.json
                if (modified) {
                    await fs.writeFile(metaPath, JSON.stringify(characterData, null, 2), 'utf-8');
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
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Error desconocido';
        console.error('Error al listar personajes:', error);
        return NextResponse.json(
            { error: 'Error al leer personajes', details: msg },
            { status: 500 }
        );
    }
}
