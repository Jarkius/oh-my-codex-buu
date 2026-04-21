/**
 * oh-my-codex-buu - Buu-style absorption layer for Codex-native orchestration
 *
 * This package provides:
 * - the inherited OMX runtime body from oh-my-codex
 * - a Buu-style absorption registry and cocoon model
 * - philosophy and workflow scaffolding for selective capability fusion
 */

export { setup } from './cli/setup.js';
export { doctor } from './cli/doctor.js';
export { version } from './cli/version.js';
export { mergeConfig } from './config/generator.js';
export { AGENT_DEFINITIONS, type AgentDefinition } from './agents/definitions.js';
export { generateAgentToml, installNativeAgentConfigs } from './agents/native-config.js';
export { hudCommand } from './hud/index.js';
export * from './absorption/index.js';
