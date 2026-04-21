import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createCocoon } from '../cocoon.js';
import { activateForm } from '../forms.js';
import { createEmptyRegistry, findCocoon, registerCocoon } from '../registry.js';
import { digestCocoon, rejectCocoon } from '../quarantine.js';

describe('absorption registry', () => {
  it('registers and finds cocoons', () => {
    const registry = createEmptyRegistry();
    const cocoon = createCocoon({
      id: 'qwen-oracle',
      name: 'Qwen Oracle',
      kind: 'workflow',
      source: 'github.com/Jarkius/oh-my-qwen',
      capabilities: [
        {
          id: 'oracle-routing',
          name: 'Oracle routing',
          description: 'Central brain routing and session state analysis',
          tags: ['oracle', 'routing'],
        },
      ],
    });

    const updated = registerCocoon(registry, cocoon);
    assert.equal(updated.cocoons.length, 1);
    assert.equal(findCocoon(updated, 'qwen-oracle')?.name, 'Qwen Oracle');
  });

  it('digests and rejects cocoons with provenance notes', () => {
    const cocoon = createCocoon({
      id: 'cell-gate',
      name: 'Cell Gate',
      kind: 'workflow',
      source: 'github.com/Jarkius/oh-my-qwen',
      capabilities: [],
    });

    const digested = digestCocoon(cocoon, 'Reviewed and approved for Buu chamber');
    const rejected = rejectCocoon(cocoon, 'Contains incompatible runtime assumptions');

    assert.equal(digested.status, 'digested');
    assert.match(digested.provenance.notes ?? '', /approved/i);
    assert.equal(rejected.status, 'rejected');
    assert.match(rejected.provenance.notes ?? '', /incompatible/i);
  });

  it('activates a form from selected cocoons', () => {
    const registry = registerCocoon(
      createEmptyRegistry(),
      createCocoon({
        id: 'qwen-oracle',
        name: 'Qwen Oracle',
        kind: 'workflow',
        source: 'github.com/Jarkius/oh-my-qwen',
        capabilities: [
          {
            id: 'oracle-routing',
            name: 'Oracle routing',
            description: 'Central brain routing and session state analysis',
            tags: ['oracle'],
          },
        ],
        status: 'active',
      }),
    );

    const form = activateForm(registry, 'super-buu', 'Super Buu', ['qwen-oracle']);
    assert.equal(form.name, 'Super Buu');
    assert.equal(form.activeCapabilities.length, 1);
    assert.equal(form.activeCapabilities[0]?.id, 'oracle-routing');
  });
});
