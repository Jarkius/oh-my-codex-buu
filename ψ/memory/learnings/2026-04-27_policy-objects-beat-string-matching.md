# Policy Objects Beat String Matching

If an active form is meant to change planning and execution behavior, its effect should be represented as a canonical policy object, not reconstructed later from free-form wake-directive text.

In practice:

- capabilities -> policy signals
- policy signals -> planning posture
- planning posture -> execution and verification behavior

This makes the system easier to test, easier to evolve, and less brittle than treating user-facing directive strings as the real source of behavior.

The same rule applies to memory architecture: a structure is not real until there is an explicit command path to move data into it.
