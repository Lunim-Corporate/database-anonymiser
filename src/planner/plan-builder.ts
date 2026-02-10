import {
  GeneratedConfig,
  StrategyName,
  TableColumnRule,
} from "../config/generated-config.types";

/**
 * Default strategy when nothing matches
 */
const DEFAULT_STRATEGY: StrategyName = "KEEP";

/**
 * Resolve strategy for a single column using precedence:
 *
 * 1. Table-level override (ONLY if strategy explicitly provided)
 * 2. Global column_strategy
 * 3. Default = KEEP
 */
function resolveStrategy(
  columnName: string,
  tableColumns: TableColumnRule[],
  globalStrategy: GeneratedConfig["column_strategy"]
): { strategy: StrategyName; params?: Record<string, any> } {
  // 1️. Table-level override (explicit strategy only)
  const tableOverride = tableColumns.find(
    (c) => c.column === columnName && c.strategy !== undefined
  );

  if (tableOverride) {
    return {
      strategy: tableOverride.strategy!,
      params: tableOverride.params,
    };
  }

  // 2️. Global column strategy
  for (const [strategy, columnsOrConfig] of Object.entries(globalStrategy)) {
    if (Array.isArray(columnsOrConfig)) {
      if (columnsOrConfig.includes(columnName)) {
        return { strategy: strategy as StrategyName };
      }
    }
  }

  // 3️. Default
  return { strategy: DEFAULT_STRATEGY };
}

/**
 * Split schema.table safely
 */
function splitTable(full: string): { schema: string; name: string } {
  const [schema, name] = full.split(".");
  if (!schema || !name) {
    throw new Error(
      `Invalid table name "${full}". Expected format: schema.table`
    );
  }
  return { schema, name };
}

/**
 * Build execution plan from config
 */
export function buildPlan(cfg: GeneratedConfig) {
  const denylist = new Set(cfg.scope.denylistTables);

  const tables = cfg.rules
    // 1️. filter disabled + denylisted tables
    .filter((rule) => {
      if (!rule.enabled) return false;

      // denylist can contain either schema.table OR just table
      const { name } = splitTable(rule.table);
      return !denylist.has(rule.table) && !denylist.has(name);
    })
    // 2️. build planned tables
    .map((tableRule) => {
      const { schema, name } = splitTable(tableRule.table);

      const plannedColumns = tableRule.columns.map((col) => {
        const resolved = resolveStrategy(
          col.column,
          tableRule.columns,
          cfg.column_strategy
        );

        return {
          column: col.column,
          strategy: resolved.strategy,
          params: resolved.params,
        };
      });

      return {
        table: tableRule.table,
        schema,
        name,
        columns: plannedColumns,
      };
    });

  return {
    createdAt: new Date().toISOString(),
    tables,
  };
}
