export interface FrameSlice {
    index: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ActionConfig {
    name: string;
    label: string;
    icon: string;
    sheetUrl: string;
    frameCount: number;
    frameWidth: number;
    frameHeight: number;
    offsetX: number;
    offsetY: number;
    spacing: number;
    fps: number;
    loop: boolean;
    totalWidth: number;
    totalHeight: number;
}

export interface CharacterData {
    characterName: string;
    actions: Record<string, ActionConfig>;
}

export const DEFAULT_ACTIONS: Array<{ name: string; label: string; icon: string; defaultFps: number; loop: boolean }> = [
    { name: 'correr', label: 'CORRER', icon: '', defaultFps: 10, loop: true },
    { name: 'idle', label: 'IDLE (ESPERA)', icon: '', defaultFps: 6, loop: true },
    { name: 'caminar', label: 'CAMINAR', icon: '', defaultFps: 8, loop: true },
    { name: 'saltar', label: 'SALTAR', icon: '', defaultFps: 9, loop: false },
    { name: 'atacar', label: 'ATACAR', icon: '', defaultFps: 12, loop: false },
    { name: 'daño', label: 'RECIBIR DAÑO', icon: '', defaultFps: 8, loop: false },
    { name: 'muerte', label: 'MUERTE', icon: '', defaultFps: 6, loop: false }
];
