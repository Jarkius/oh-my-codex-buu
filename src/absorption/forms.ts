import type { AbsorptionRegistry, CocoonCapability } from './registry.js';

export interface BuuForm {
  id: string;
  name: string;
  cocoonIds: string[];
  activeCapabilities: CocoonCapability[];
}

export function activateForm(
  registry: AbsorptionRegistry,
  id: string,
  name: string,
  cocoonIds: string[],
): BuuForm {
  const activeCapabilities = registry.cocoons
    .filter((cocoon) => cocoonIds.includes(cocoon.id))
    .flatMap((cocoon) => cocoon.capabilities);

  return {
    id,
    name,
    cocoonIds,
    activeCapabilities,
  };
}
