import { StrategyName } from "../config/generated-config.types";


export type PlannedColumn = {
  column: string;
  strategy: StrategyName;
  params?: Record<string, any>;
};

export type PlannedTable = {
  table: string;
  schema: string;
  name: string;
  columns: PlannedColumn[];
};


export type Plan = {
  createdAt: string;
  tables: PlannedTable[];
};
