import type { BuuCocoon, CocoonCapability, CocoonStatus } from './registry.js';

export interface CreateCocoonInput {
  id: string;
  name: string;
  kind: BuuCocoon['kind'];
  source: string;
  capabilities: CocoonCapability[];
  status?: CocoonStatus;
  notes?: string;
}

export function createCocoon(input: CreateCocoonInput): BuuCocoon {
  return {
    id: input.id,
    name: input.name,
    kind: input.kind,
    status: input.status ?? 'quarantined',
    capabilities: input.capabilities,
    provenance: {
      source: input.source,
      absorbedAt: new Date().toISOString(),
      digestMethod: 'cell-gate',
      notes: input.notes,
    },
  };
}

export function updateCocoonStatus(cocoon: BuuCocoon, status: CocoonStatus): BuuCocoon {
  return {
    ...cocoon,
    status,
  };
}
