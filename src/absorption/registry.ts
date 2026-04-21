export type AbsorptionKind = 'repo' | 'skills' | 'workflow' | 'prompt-pack';
export type CocoonStatus = 'quarantined' | 'digested' | 'active' | 'rejected' | 'ejected';

export interface CocoonProvenance {
  source: string;
  absorbedAt: string;
  digestMethod: 'cell-gate';
  notes?: string;
}

export interface CocoonCapability {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

export interface BuuCocoon {
  id: string;
  name: string;
  kind: AbsorptionKind;
  status: CocoonStatus;
  capabilities: CocoonCapability[];
  provenance: CocoonProvenance;
}

export interface AbsorptionRegistry {
  cocoons: BuuCocoon[];
}

export function createEmptyRegistry(): AbsorptionRegistry {
  return { cocoons: [] };
}

export function registerCocoon(
  registry: AbsorptionRegistry,
  cocoon: BuuCocoon,
): AbsorptionRegistry {
  return {
    cocoons: [...registry.cocoons.filter((entry) => entry.id !== cocoon.id), cocoon],
  };
}

export function findCocoon(
  registry: AbsorptionRegistry,
  cocoonId: string,
): BuuCocoon | undefined {
  return registry.cocoons.find((entry) => entry.id === cocoonId);
}
