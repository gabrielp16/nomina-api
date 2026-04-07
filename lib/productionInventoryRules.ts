export interface ProductionPackagingRule {
  packagedProductName: string;
  packagedProductCode?: string;
  baseProductName: string;
  baseProductCode?: string;
  unitsPerPackage: number;
}

const productionPackagingRules: ProductionPackagingRule[] = [
  {
    packagedProductName: 'Morchis TO-GO! - Roscas',
    packagedProductCode: 'GORO',
    baseProductName: 'Roscas',
    baseProductCode: 'UNRO',
    unitsPerPackage: 10,
  },
  {
    packagedProductName: 'Morchis TO-GO! - Navidad',
    packagedProductCode: 'GONA',
    baseProductName: 'Figuritas - Navidad',
    baseProductCode: 'FINA',
    unitsPerPackage: 10,
  },
  {
    packagedProductName: 'Morchis TO-GO! - Figuritas',
    packagedProductCode: 'GOFI',
    baseProductName: 'Figuritas - Animalitos',
    baseProductCode: 'FIAN',
    unitsPerPackage: 10,
  },
  {
    packagedProductName: 'Morchis TO-GO! - Especiales',
    packagedProductCode: 'GOES',
    baseProductName: 'Figuritas - Especiales',
    baseProductCode: 'FIES',
    unitsPerPackage: 10,
  },
  {
    packagedProductName: 'Morchis TO-GO! - Waffles Precocidos',
    packagedProductCode: 'GOWP',
    baseProductName: 'Wafles Precocidos',
    baseProductCode: 'UNWP',
    unitsPerPackage: 10,
  },
  {
    packagedProductName: 'Morchis TO-GO! - Bolitas',
    packagedProductCode: 'GOBO',
    baseProductName: 'Bolitas 30gr',
    baseProductCode: 'BOME',
    unitsPerPackage: 10,
  },
];

const normalizeValue = (value: string) => value.trim().toUpperCase();

const ruleMap = new Map<string, ProductionPackagingRule>();

for (const rule of productionPackagingRules) {
  ruleMap.set(normalizeValue(rule.packagedProductName), rule);

  if (rule.packagedProductCode) {
    ruleMap.set(normalizeValue(rule.packagedProductCode), rule);
  }
}

export const getProductionPackagingRule = (productIdentifier?: string | null) => {
  if (!productIdentifier) {
    return null;
  }

  return ruleMap.get(normalizeValue(productIdentifier)) ?? null;
};