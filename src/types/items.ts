export type ItemCategory = 'obstaculo' | 'potenciador';

export type ItemSubCategory =
    | 'obstaculo_bajo'
    | 'obstaculo_alto'
    | 'obstaculo_bloqueo'
    | 'bebida'
    | 'comida'
    | 'especial';

export type ItemHeightTier = 'piso' | 'medio' | 'alto';

export type ItemFrequency = 'muy_frecuente' | 'media' | 'rara';

export interface ItemEffects {
    vidaDelta?: number;            // ej: -15, -5, +15
    cansancioDelta?: number;       // ej: -40 (-40% cansancio), +20 (cansancio extra por susto)
    hambreDelta?: number;          // ej: +10, +25, +50
    velocidadFactor?: number;      // ej: 0.8 (-20% vel), 1.2 (+20% vel)
    velocidadDuracion?: number;    // segundos (ej: 2s, 4s, 5s)
    stunDuracion?: number;         // segundos (ej: 0.5s de hueco, 1.0s de cable)
    escudoDuracion?: number;       // segundos (ej: 8s de poncho)
    mechanicHint?: string;         // 'Saltar por encima', 'Agacharse', 'Saltar o esquivar lateralmente'
}

export interface ItemDefinition {
    id: string;
    name: string;
    label: string;
    category: ItemCategory;
    subCategory: ItemSubCategory;
    tier: ItemHeightTier;
    frequency: ItemFrequency;
    description: string;
    effects: ItemEffects;
    imageUrl?: string;
    cropBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    updatedAt?: string;
}

/**
 * Catálogo maestro predefinido con todas las mecánicas y elementos
 * especificados para el sistema de supervivencia peruano de Soy Chólope
 */
export const DEFAULT_ITEMS_CATALOG: ItemDefinition[] = [
    // ----------------------------------------------------
    // OBSTÁCULOS
    // ----------------------------------------------------
    {
        id: 'hueco',
        name: 'Hueco',
        label: 'HUECO EN PISTA',
        category: 'obstaculo',
        subCategory: 'obstaculo_bajo',
        tier: 'piso',
        frequency: 'media',
        imageUrl: '/items/hueco.png',
        description: 'Bache o zanja típica de pista limeña. Te detiene 0.5s y quita vida.',
        effects: {
            vidaDelta: -15,
            stunDuracion: 0.5,
            mechanicHint: 'Saltar por encima'
        }
    },
    {
        id: 'cono',
        name: 'Cono',
        label: 'CONO DE TRÁNSITO',
        category: 'obstaculo',
        subCategory: 'obstaculo_bajo',
        tier: 'piso',
        frequency: 'media',
        imageUrl: '/items/cono.png',
        description: 'Cono de obra o desvío. Provoca un trompicón y empuja hacia atrás.',
        effects: {
            vidaDelta: -5,
            mechanicHint: 'Saltar o esquivar'
        }
    },
    {
        id: 'caca',
        name: 'Caca',
        label: 'CACA DE PERRO',
        category: 'obstaculo',
        subCategory: 'obstaculo_bajo',
        tier: 'piso',
        frequency: 'muy_frecuente',
        imageUrl: '/items/caca.png',
        description: 'Resbalón cómico en la vereda. Reduce 20% de velocidad y sube cansancio.',
        effects: {
            vidaDelta: 0,
            velocidadFactor: 0.8,
            velocidadDuracion: 2.0,
            cansancioDelta: 15,
            mechanicHint: 'Saltar por encima'
        }
    },
    {
        id: 'basura',
        name: 'Basura',
        label: 'BOLSA DE BASURA',
        category: 'obstaculo',
        subCategory: 'obstaculo_bloqueo',
        tier: 'piso',
        frequency: 'media',
        imageUrl: '/items/basura.png',
        description: 'Montículo de basura en la esquina. Bloquea el paso y quita 10 de vida.',
        effects: {
            vidaDelta: -10,
            mechanicHint: 'Saltar alto'
        }
    },
    {
        id: 'cable',
        name: 'Cable',
        label: 'CABLE COLGANTE',
        category: 'obstaculo',
        subCategory: 'obstaculo_alto',
        tier: 'alto',
        frequency: 'media',
        imageUrl: '/items/cable.png',
        description: 'Cable clandestino o descolgado de poste. Te engancha y pierdes 1s de control.',
        effects: {
            vidaDelta: 0,
            stunDuracion: 1.0,
            mechanicHint: 'Agacharse'
        }
    },
    {
        id: 'cordel',
        name: 'Cordel',
        label: 'CORDEL DE ROPA',
        category: 'obstaculo',
        subCategory: 'obstaculo_alto',
        tier: 'alto',
        frequency: 'media',
        imageUrl: '/items/cordel.png',
        description: 'Tendedero cruzado entre callejones. Tropiezo cómico y -5 de vida.',
        effects: {
            vidaDelta: -5,
            stunDuracion: 1.0,
            mechanicHint: 'Agacharse'
        }
    },

    // ----------------------------------------------------
    // POTENCIADORES — BEBIDAS (Afectan Cansancio)
    // ----------------------------------------------------
    {
        id: 'emoliente',
        name: 'Emoliente',
        label: 'EMOLIENTE CALIENTE',
        category: 'potenciador',
        subCategory: 'bebida',
        tier: 'medio',
        frequency: 'media',
        imageUrl: '/items/emoliente.png',
        description: 'Bebida medicinal y relajante. Reduce 40% de cansancio de inmediato.',
        effects: {
            cansancioDelta: -40,
            mechanicHint: 'Saltar sobre obstáculo'
        }
    },
    {
        id: 'maca',
        name: 'Maca',
        label: 'MACA PURA',
        category: 'potenciador',
        subCategory: 'bebida',
        tier: 'alto',
        frequency: 'rara',
        imageUrl: '/items/maca.png',
        description: 'Energizante andino supremo. Otorga +20% de velocidad por 5 segundos.',
        effects: {
            velocidadFactor: 1.2,
            velocidadDuracion: 5.0,
            cansancioDelta: -15,
            mechanicHint: 'Salto alto de riesgo'
        }
    },
    {
        id: 'chicha_morada',
        name: 'Chicha Morada',
        label: 'CHICHA MORADA',
        category: 'potenciador',
        subCategory: 'bebida',
        tier: 'medio',
        frequency: 'media',
        imageUrl: '/items/chicha_morada.png',
        description: 'Bebida nutritiva y refrescante de maíz morado. Recupera +15 de Vida.',
        effects: {
            vidaDelta: 15,
            cansancioDelta: -10,
            mechanicHint: 'Salto coordinado'
        }
    },

    // ----------------------------------------------------
    // POTENCIADORES — COMIDA (Afectan Hambre)
    // ----------------------------------------------------
    {
        id: 'anticucho',
        name: 'Anticucho',
        label: 'ANTICUCHO DE CORAZÓN',
        category: 'potenciador',
        subCategory: 'comida',
        tier: 'medio',
        frequency: 'media',
        imageUrl: '/items/anticucho.png',
        description: 'Snack tradicional con papa y ají. Sacia +25 de Hambre.',
        effects: {
            hambreDelta: 25,
            mechanicHint: 'Salto coordinado'
        }
    },
    {
        id: 'pan_chicharron',
        name: 'Pan con Chicharrón',
        label: 'PAN CON CHICHARRÓN',
        category: 'potenciador',
        subCategory: 'comida',
        tier: 'medio',
        frequency: 'media',
        imageUrl: '/items/pan_chicharron.png',
        description: 'Mega desayuno con camote y salsa criolla. +50 Hambre pero -10% Vel por 4s (pesado).',
        effects: {
            hambreDelta: 50,
            velocidadFactor: 0.9,
            velocidadDuracion: 4.0,
            mechanicHint: 'Salto sobre obstáculo'
        }
    },
    {
        id: 'cancha_serrana',
        name: 'Cancha Serrana',
        label: 'CANCHA SERRANA',
        category: 'potenciador',
        subCategory: 'comida',
        tier: 'piso',
        frequency: 'muy_frecuente',
        imageUrl: '/items/cancha_serrana.png',
        description: 'Snack salado frecuente (tipo monedas de Mario). Rellena +10 de Hambre.',
        effects: {
            hambreDelta: 10,
            mechanicHint: 'Recoger al correr'
        }
    },
    {
        id: 'picarones',
        name: 'Picarones',
        label: 'PICARONES CON MIEL',
        category: 'potenciador',
        subCategory: 'comida',
        tier: 'alto',
        frequency: 'rara',
        imageUrl: '/items/picarones.png',
        description: 'Delicia dulce peruana premium. +30 de Hambre y +15 de Vida.',
        effects: {
            hambreDelta: 30,
            vidaDelta: 15,
            mechanicHint: 'Salto alto de riesgo'
        }
    },

    // ----------------------------------------------------
    // ESPECIAL (Escudos y Mecánicas Únicas)
    // ----------------------------------------------------
    {
        id: 'poncho',
        name: 'Poncho',
        label: 'PONCHO ANDINO',
        category: 'potenciador',
        subCategory: 'especial',
        tier: 'alto',
        frequency: 'rara',
        imageUrl: '/items/poncho.png',
        description: 'Escudo temporal sagrado. Te hace inmune al próximo obstáculo durante 8s.',
        effects: {
            escudoDuracion: 8.0,
            mechanicHint: 'Salto alto de riesgo'
        }
    }
];
