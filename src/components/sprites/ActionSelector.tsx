'use client';

import React, { useState } from 'react';
import { ActionConfig } from './types';
import { ActionIcon } from './ActionIcon';
import { Plus, Check, X } from 'lucide-react';

interface ActionSelectorProps {
    actions: Record<string, ActionConfig>;
    activeActionKey: string;
    onSelectAction: (actionKey: string) => void;
    onAddCustomAction: (name: string, label: string) => void;
}

export const ActionSelector: React.FC<ActionSelectorProps> = ({
    actions,
    activeActionKey,
    onSelectAction,
    onAddCustomAction
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newActionName, setNewActionName] = useState('');

    const handleCreate = () => {
        const clean = newActionName.trim().toLowerCase().replace(/\s+/g, '_');
        if (!clean) return;
        onAddCustomAction(clean, clean.toUpperCase());
        setNewActionName('');
        setIsAdding(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Acciones del Personaje ({Object.keys(actions).length})
                </span>
                {!isAdding ? (
                    <button
                        onClick={() => setIsAdding(true)}
                        style={{
                            background: 'rgba(59, 130, 246, 0.15)',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            color: '#60a5fa',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}
                    >
                        <Plus size={13} />
                        <span>Nueva Acción</span>
                    </button>
                ) : (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <input
                            type="text"
                            placeholder="Ej: agacharse"
                            value={newActionName}
                            onChange={(e) => setNewActionName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreate();
                                if (e.key === 'Escape') setIsAdding(false);
                            }}
                            autoFocus
                            style={{
                                background: '#1e293b',
                                border: '1px solid #3b82f6',
                                color: '#fff',
                                borderRadius: '4px',
                                padding: '3px 8px',
                                fontSize: '11px',
                                width: '120px'
                            }}
                        />
                        <button
                            onClick={handleCreate}
                            style={{
                                background: '#3b82f6',
                                border: 'none',
                                color: '#fff',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            <Check size={12} />
                        </button>
                        <button
                            onClick={() => setIsAdding(false)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#94a3b8',
                                fontSize: '11px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            <X size={12} />
                        </button>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {Object.entries(actions).map(([key, config]) => {
                    const isActive = key === activeActionKey;
                    const hasSheet = Boolean(config.sheetUrl);

                    return (
                        <button
                            key={key}
                            onClick={() => onSelectAction(key)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '7px',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                border: isActive
                                    ? '1.5px solid #f59e0b'
                                    : hasSheet
                                    ? '1px solid rgba(16, 185, 129, 0.4)'
                                    : '1px solid #334155',
                                background: isActive
                                    ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.15))'
                                    : hasSheet
                                    ? 'rgba(16, 185, 129, 0.1)'
                                    : 'rgba(30, 41, 59, 0.6)',
                                color: isActive ? '#fbbf24' : hasSheet ? '#6ee7b7' : '#94a3b8',
                                boxShadow: isActive ? '0 0 12px rgba(245, 158, 11, 0.3)' : 'none'
                            }}
                        >
                            <ActionIcon name={key} size={14} color={isActive ? '#fbbf24' : hasSheet ? '#34d399' : '#94a3b8'} />
                            <span>{config.label}</span>
                            <span
                                style={{
                                    fontSize: '9px',
                                    padding: '1px 5px',
                                    borderRadius: '10px',
                                    background: hasSheet ? 'rgba(16, 185, 129, 0.3)' : 'rgba(148, 163, 184, 0.2)',
                                    color: hasSheet ? '#a7f3d0' : '#64748b'
                                }}
                            >
                                {hasSheet ? `${config.frameCount}f` : 'vacío'}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
