// export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

// export type ColumnRisk = {
//   table: string;
//   column: string;
//   risk: RiskLevel;
//   reason: string;
//   recommendedStrategy: string;
// };

// export type AiScanResult = {
//   riskSummary: {
//     high: number;
//     medium: number;
//     low: number;
//   };
//   recommendations: {
//     column_strategy: Record<string, string[]>;
//   };
//   findings: ColumnRisk[];
// };


export type RiskLevel = "HIGH" | "MEDIUM" | "LOW";

export type AiRiskResult = {
  riskByColumn: Record<string, RiskLevel>;
  recommendations: {
    EMAIL_FAKE?: string[];
    HASH_SHA256?: string[];
    REDACT?: string[];
    SET_NULL?: string[];
    KEEP?: string[];
  };
};

export type AiExplainInput = {
  config: any;
  ai: AiRiskResult;
};
