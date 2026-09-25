declare module 'gifenc' {
    export interface GIFEncoderOptions {
        initialCapacity?: number;
        auto?: boolean;
    }

    export interface WriteFrameOptions {
        palette?: number[][];
        delay?: number;
        transparent?: boolean;
        transparentIndex?: number;
        repeat?: number;
        dispose?: number;
    }

    export function GIFEncoder(options?: GIFEncoderOptions): {
        writeFrame: (index: Uint8Array, width: number, height: number, options?: WriteFrameOptions) => void;
        finish: () => void;
        bytes: () => Uint8Array;
        reset: () => void;
    };

    export function quantize(
        rgba: Uint8ClampedArray | Uint8Array,
        maxColors?: number,
        options?: {
            format?: 'rgba4444' | 'rgb565' | 'rgba5551';
            oneBitAlpha?: boolean;
            clearAlpha?: boolean;
            clearAlphaThreshold?: number;
            clearAlphaColor?: number;
        }
    ): number[][];

    export function applyPalette(
        rgba: Uint8ClampedArray | Uint8Array,
        palette: number[][],
        format?: 'rgba4444' | 'rgb565' | 'rgba5551'
    ): Uint8Array;
}
