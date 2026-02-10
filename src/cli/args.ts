export type CliMode = "configGen" | "dryrun" | "apply";

export type CliArgs = {
  mode: CliMode;
};

export function parseArgs(argv: string[]): CliArgs {
  const flags = new Set(argv);

  const modes = [
    flags.has("--configGen") ? "configGen" : null,
    flags.has("--dryrun") ? "dryrun" : null,
    flags.has("--apply") ? "apply" : null,
  ].filter(Boolean) as CliMode[];

  if (modes.length === 0) {
    throw new Error(
      "No mode specified. Use one of: --configGen | --dryrun | --apply"
    );
  }

  if (modes.length > 1) {
    throw new Error(
      "Multiple modes specified. Use only one of: --configGen | --dryrun | --apply"
    );
  }

  return { mode: modes[0] };
}
