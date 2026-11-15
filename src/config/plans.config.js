/** Definición de planes. Se usa en la página de planes y en Configuración. */
export const PLANS = {
  free: {
    id: 'free',
    name: 'Simulador Libre',
    price: 0,
    period: 'siempre',
    tagline: 'Para consultas rápidas y estimaciones informales.',
    limits: { employees: 5, liquidations: 20 },
    features: [
      'Indemnización Art. 245 LCT',
      'Preaviso e integración',
      'SAC y vacaciones',
      'Recibo en PDF',
      'Guardado en la nube',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Profesional PRO',
    price: 14900,
    period: 'mes',
    tagline: 'Herramienta completa para abogados y contadores.',
    highlight: true,
    limits: { employees: Infinity, liquidations: Infinity },
    features: [
      'Todo lo del plan Libre',
      'Empleados y liquidaciones ilimitados',
      'Cálculos de casos anteriores (multas históricas)',
      'Recibos con datos del estudio',
      'Exportación CSV y respaldo',
      'Soporte vía WhatsApp',
    ],
  },
  estudio: {
    id: 'estudio',
    name: 'Estudio Jurídico',
    price: 32500,
    period: 'mes',
    tagline: 'Hasta 5 usuarios y gestión masiva.',
    limits: { employees: Infinity, liquidations: Infinity },
    features: [
      'Todo lo del plan PRO',
      'Hasta 5 usuarios',
      'Gestión de clientes y carpetas',
      'Consultoría técnica mensual',
      'Acceso API (próximamente)',
    ],
  },
};

/** Filas de la tabla comparativa [texto, free, pro, estudio] */
export const PLAN_COMPARISON = [
  ['Indemnización por antigüedad (Art. 245)', true, true, true],
  ['Fallo Vizzoti automático', true, true, true],
  ['Preaviso, integración, SAC y vacaciones', true, true, true],
  ['Recibo / informe en PDF', true, true, true],
  ['Empleados y liquidaciones ilimitados', false, true, true],
  ['Casos anteriores a Ley Bases (multas históricas)', false, true, true],
  ['Exportación CSV y respaldo', false, true, true],
  ['Multi-usuario y carpetas compartidas', false, false, true],
];

export const planOf = (id) => PLANS[id] || PLANS.free;
