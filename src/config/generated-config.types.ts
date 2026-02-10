export type StrategyName =
  | "KEEP"
  | "EMAIL_FAKE"
  | "HASH_SHA256"
  | "REDACT"
  | "SET_NULL"
  | "TRUNCATE";

export type TableColumnRule = {
  column: string;
  strategy?: StrategyName;        
  params?: Record<string, any>;
};

export type TableRule = {
  table: string;
  enabled: boolean;
  columns: TableColumnRule[];
};

export type GlobalColumnStrategy = {
  [K in StrategyName]?: string[] | Record<string, any>;
};

export type GeneratedConfig = {
  version: 1;
  generatedAt: string;
  reviewed: boolean;

  scope: {
    schema: string;
    denylistTables: string[];
  };

  samples: {
    limit: number;
    masked: boolean;
  };

  
  column_strategy: GlobalColumnStrategy;

  rules: TableRule[];
};
