export function enforceRowCap(params: {
  totalRows: number;
  cap: number;
  force?: boolean;
}) {
  const { totalRows, cap, force } = params;
  if (totalRows > cap && !force) {
    throw new Error(
      `Safety cap exceeded: would affect ${totalRows} rows (cap=${cap}). Re-run with --force if intended.`
    );
  }
}
