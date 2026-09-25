'use client';

import React from 'react';
import {
    Zap,
    User,
    Footprints,
    ArrowUpCircle,
    Swords,
    ShieldAlert,
    Skull,
    Activity
} from 'lucide-react';

interface ActionIconProps {
    name: string;
    size?: number;
    color?: string;
    className?: string;
}

export const ActionIcon: React.FC<ActionIconProps> = ({ name, size = 15, color, className }) => {
    const clean = name.toLowerCase().trim();

    if (clean.includes('corr') || clean.includes('run')) {
        return <Zap size={size} color={color} className={className} />;
    }
    if (clean.includes('idle') || clean.includes('espera') || clean.includes('stand')) {
        return <User size={size} color={color} className={className} />;
    }
    if (clean.includes('camin') || clean.includes('walk')) {
        return <Footprints size={size} color={color} className={className} />;
    }
    if (clean.includes('salt') || clean.includes('jump')) {
        return <ArrowUpCircle size={size} color={color} className={className} />;
    }
    if (clean.includes('atac') || clean.includes('golp') || clean.includes('punch') || clean.includes('attack')) {
        return <Swords size={size} color={color} className={className} />;
    }
    if (clean.includes('dañ') || clean.includes('hurt') || clean.includes('hit') || clean.includes('damage')) {
        return <ShieldAlert size={size} color={color} className={className} />;
    }
    if (clean.includes('muert') || clean.includes('die') || clean.includes('dead') || clean.includes('death')) {
        return <Skull size={size} color={color} className={className} />;
    }

    return <Activity size={size} color={color} className={className} />;
};
