export type ArrendamientoPersonaTipo = 'Fisica' | 'Resico' | 'Moral';

type ArrendamientoDefaults = {
  concepto: string;
  producto: string;
};

const ARRENDAMIENTO_DEFAULTS: Record<string, Record<ArrendamientoPersonaTipo, ArrendamientoDefaults>> = {
  adMSU2024: {
    Fisica: { concepto: '118', producto: '7000017' },
    Moral: { concepto: '118', producto: '7000041' },
    Resico: { concepto: '130', producto: '7000092' },
  },
  adCI_ANAHUAC_SA_D: {
    Fisica: { concepto: '103', producto: '7000017' },
    Moral: { concepto: '103', producto: '7000041' },
    Resico: { concepto: '130', producto: '7000065' },
  },
  adGRUPO_BUENAGUI: {
    Fisica: { concepto: '103', producto: '7000017' },
    Moral: { concepto: '103', producto: '7000041' },
    Resico: { concepto: '130', producto: '7000089' },
  },
};

const ARRENDAMIENTO_IVA08_OVERRIDES: Record<
  string,
  Partial<Record<ArrendamientoPersonaTipo, ArrendamientoDefaults>>
> = {
  adGRUPO_BUENAGUI: {
    Fisica: { concepto: '1103', producto: '7001017' },
    Resico: { concepto: '1130', producto: '7001089' },
  },
};

export const getArrendamientoPersonaTipo = (regimenFiscal: string): ArrendamientoPersonaTipo => {
  if (regimenFiscal === '612') return 'Fisica';
  if (regimenFiscal === '606') return 'Fisica';
  if (regimenFiscal === '626') return 'Resico';
  return 'Moral';
};

export const getRentasDefaultsForEmpresa = (
  empresaDb: string,
  regimenFiscal: string,
  hasIva08 = false
): ArrendamientoDefaults | null => {
  if (!empresaDb) return null;
  const empresaDefaults = ARRENDAMIENTO_DEFAULTS[empresaDb];
  if (!empresaDefaults) return null;
  const personaTipo = getArrendamientoPersonaTipo(regimenFiscal);
  if (hasIva08) {
    const overrides = ARRENDAMIENTO_IVA08_OVERRIDES[empresaDb];
    const overrideValue = overrides?.[personaTipo];
    if (overrideValue) return overrideValue;
  }
  return empresaDefaults[personaTipo] ?? null;
};
