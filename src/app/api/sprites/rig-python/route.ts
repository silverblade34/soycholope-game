import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { character = 'cholo', rig, pieces } = body;

        if (!rig || !pieces) {
            return NextResponse.json({ error: 'Faltan datos de rig o piezas' }, { status: 400 });
        }

        const rootDir = process.cwd();
        const outputDir = path.join(rootDir, 'script-generacion-sprites', 'output', character);
        const piecesDir = path.join(outputDir, 'pieces');
        await fs.mkdir(piecesDir, { recursive: true });

        // Guardar cada pieza PNG limpia
        for (const [filename, base64Data] of Object.entries(pieces)) {
            if (typeof base64Data !== 'string') continue;
            const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(cleanBase64, 'base64');
            await fs.writeFile(path.join(piecesDir, filename), buffer);
        }

        // Guardar rig.json
        const rigPath = path.join(outputDir, 'rig.json');
        await fs.writeFile(rigPath, JSON.stringify(rig, null, 2), 'utf-8');

        // Ejecutar animator.py con Python de .venv
        const pythonBin = path.join(rootDir, '.venv', 'bin', 'python');
        const animatorScript = path.join(rootDir, 'script-generacion-sprites', 'animator.py');

        const cmd = `"${pythonBin}" "${animatorScript}" --rig "${rigPath}" --to-game`;
        const { stdout, stderr } = await execAsync(cmd, { cwd: rootDir });

        return NextResponse.json({
            success: true,
            message: 'Animaciones procesadas y sincronizadas con Python exitosamente.',
            stdout,
            stderr
        });
    } catch (err: unknown) {
        console.error('Error ejecutando rig-python:', err);
        return NextResponse.json(
            { error: 'Error procesando rig con Python', details: (err as Error).message },
            { status: 500 }
        );
    }
}
