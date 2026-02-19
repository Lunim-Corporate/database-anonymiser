export async function buildProofBundle(args: {
  config: any;
  ai: any;
  dryrun?: any;
  apply?: any;
  vendorExportSql: string;
  explanation: string;
}) {
  const { config, ai, dryrun, apply, vendorExportSql, explanation } = args;

  const proofMd = `
# Safe Data Proof Bundle

## Summary
- GeneratedAt: ${config.generatedAt}
- Reviewed: ${config.reviewed}

## Risk Summary (AI)
${JSON.stringify(ai?.riskSummary || {}, null, 2)}

## Strategy Recommendations (AI)
${JSON.stringify(ai?.recommendations || {}, null, 2)}

## Human Explanation
${explanation || "(not generated)"}

## Dryrun (rows)
${dryrun ? JSON.stringify(dryrun.dryrunResult.updatedByTable, null, 2) : "(not run)"}

## Apply (rows)
${apply ? JSON.stringify(apply.applyResult.updatedByTable, null, 2) : "(not applied)"}
`.trim();

  // For demo: return strings; for real product: zip these into a downloadable artifact.
  return {
    proofMarkdown: proofMd,
    configYaml: config,
    vendorExportSqlPreview: vendorExportSql.slice(0, 2000),
  };
}
