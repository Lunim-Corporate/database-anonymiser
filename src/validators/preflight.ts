import { GeneratedConfig } from "../config/generated-config.types";

export function preflightValidate(cfg: GeneratedConfig, mode: "dryrun" | "apply") {
  if (cfg.version !== 1) throw new Error(`Unsupported config version: ${cfg.version}`);

  if (mode === "apply" && cfg.reviewed !== true) {
    throw new Error(`Refusing to apply: config.reviewed must be true`);
  }

  const enabledTables = cfg.rules.filter((t) => t.enabled).length;
  if (enabledTables === 0) throw new Error(`No enabled tables in config.rules`);

if (
  !cfg.column_strategy ||
  Object.keys(cfg.column_strategy).length === 0
) {
  throw new Error("column_strategy must be defined and non-empty in config");
}


}
