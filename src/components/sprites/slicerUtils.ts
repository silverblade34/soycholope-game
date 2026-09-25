import { ActionConfig, FrameSlice } from './types';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

/**
 * Calcula las coordenadas (x, y, width, height) para cada frame del sprite sheet.
 * Soporta recorte por coordenadas nativas y overrides personalizados por frame individual.
 */
export function calculateFrameSlices(config: ActionConfig): FrameSlice[] {
    const { frameCount, frameWidth, frameHeight, offsetX, offsetY, spacing, totalWidth, frameOverrides } = config;
    if (frameCount <= 0) return [];

    const slices: FrameSlice[] = [];
    const baseW = frameWidth > 0 ? frameWidth : Math.max(1, Math.round(totalWidth / frameCount));
    const baseH = frameHeight > 0 ? frameHeight : config.totalHeight;
    const step = baseW + spacing;

    for (let i = 0; i < frameCount; i++) {
        let x = offsetX + i * step;
        let y = offsetY;
        let w = baseW;
        let h = baseH;

        // Aplicar override individual si existe para este frame específico
        const ov = frameOverrides?.[i];
        if (ov) {
            if (ov.x !== undefined) x = ov.x;
            if (ov.y !== undefined) y = ov.y;
            if (ov.width !== undefined) w = ov.width;
            if (ov.height !== undefined) h = ov.height;
        }

        slices.push({
            index: i,
            x: Math.round(x),
            y: Math.round(y),
            width: Math.round(w),
            height: Math.round(h)
        });
    }

    return slices;
}

/**
 * Extrae un frame individual recortado a un DataURL base64 usando un canvas temporal
 */
export function extractFrameDataUrl(img: HTMLImageElement, slice: FrameSlice, customImage?: string): string {
    if (customImage) return customImage;

    const canvas = document.createElement('canvas');
    canvas.width = slice.width;
    canvas.height = slice.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
        img,
        slice.x,
        slice.y,
        slice.width,
        slice.height,
        0,
        0,
        slice.width,
        slice.height
    );

    return canvas.toDataURL('image/png');
}

/**
 * Genera un GIF animado transparente con gifenc centrado en cada frame,
 * soportando frames individuales con retoque/limpieza personalizado.
 */
export async function createAnimatedGif(
    img: HTMLImageElement,
    slices: FrameSlice[],
    fps: number,
    loop: boolean = true,
    customImages?: Record<number, string>
): Promise<string> {
    if (!slices.length || !img || !img.complete || img.naturalWidth === 0) return '';

    // Dimensiones máximas para acomodar frames con anchos variables centrados
    const maxW = Math.max(...slices.map((s) => s.width));
    const maxH = Math.max(...slices.map((s) => s.height));

    const gif = GIFEncoder();
    const delay = Math.round(1000 / (fps || 10));

    const canvas = document.createElement('canvas');
    canvas.width = maxW;
    canvas.height = maxH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return '';

    // Pre-cargar imágenes personalizadas si las hay
    const loadedCustomImgs: Record<number, HTMLImageElement> = {};
    if (customImages) {
        await Promise.all(
            Object.entries(customImages).map(([idxStr, dataUrl]) => {
                const idx = parseInt(idxStr);
                if (!dataUrl) return Promise.resolve();
                return new Promise<void>((resolve) => {
                    const cImg = new Image();
                    cImg.onload = () => {
                        loadedCustomImgs[idx] = cImg;
                        resolve();
                    };
                    cImg.onerror = () => resolve();
                    cImg.src = dataUrl;
                });
            })
        );
    }

    for (const slice of slices) {
        ctx.clearRect(0, 0, maxW, maxH);
        ctx.imageSmoothingEnabled = false;

        // Centrado horizontal y alineado al suelo (abajo)
        const dx = Math.round((maxW - slice.width) / 2);
        const dy = maxH - slice.height;

        const custom = loadedCustomImgs[slice.index];
        if (custom) {
            ctx.drawImage(custom, dx, dy, slice.width, slice.height);
        } else {
            ctx.drawImage(
                img,
                slice.x,
                slice.y,
                slice.width,
                slice.height,
                dx,
                dy,
                slice.width,
                slice.height
            );
        }

        const imageData = ctx.getImageData(0, 0, maxW, maxH);
        const { data } = imageData;

        // Cuantización de color con soporte para transparencia
        const palette = quantize(data, 256, {
            format: 'rgba4444',
            oneBitAlpha: true,
            clearAlpha: true
        });

        const index = applyPalette(data, palette);

        gif.writeFrame(index, maxW, maxH, {
            palette,
            delay,
            transparent: true,
            transparentIndex: palette.findIndex((p: number[]) => p[3] === 0),
            repeat: loop ? 0 : -1
        });
    }

    gif.finish();
    const bytes = gif.bytes();
    const blob = new Blob([bytes as unknown as BlobPart], { type: 'image/gif' });

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
    });
}
