import { ActionConfig, FrameSlice } from './types';

/**
 * Calcula las coordenadas (x, y, width, height) para cada frame del sprite sheet.
 * Soporta recorte por coordenadas nativas para preservar la nitidez absoluta del pixel art.
 */
export function calculateFrameSlices(config: ActionConfig): FrameSlice[] {
    const { frameCount, frameWidth, frameHeight, offsetX, offsetY, spacing, totalWidth } = config;
    if (frameCount <= 0) return [];

    const slices: FrameSlice[] = [];
    const step = (frameWidth > 0 ? frameWidth : (totalWidth / frameCount)) + spacing;

    for (let i = 0; i < frameCount; i++) {
        const x = offsetX + i * step;
        const y = offsetY;
        const w = frameWidth > 0 ? frameWidth : Math.max(1, Math.round(totalWidth / frameCount));
        const h = frameHeight > 0 ? frameHeight : config.totalHeight;

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
export function extractFrameDataUrl(img: HTMLImageElement, slice: FrameSlice): string {
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
