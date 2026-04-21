import type { BuuCocoon } from './registry.js';
import { updateCocoonStatus } from './cocoon.js';

export function digestCocoon(cocoon: BuuCocoon, notes?: string): BuuCocoon {
  return {
    ...updateCocoonStatus(cocoon, 'digested'),
    provenance: {
      ...cocoon.provenance,
      notes,
    },
  };
}

export function rejectCocoon(cocoon: BuuCocoon, notes?: string): BuuCocoon {
  return {
    ...updateCocoonStatus(cocoon, 'rejected'),
    provenance: {
      ...cocoon.provenance,
      notes,
    },
  };
}
