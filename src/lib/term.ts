/** Tiny ANSI helper that no-ops when output is not a TTY or NO_COLOR is set. */
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

function wrap(code: number): (s: string) => string {
  return (s: string) => (useColor ? `[${code}m${s}[0m` : s);
}

export const c = {
  red: wrap(31),
  green: wrap(32),
  yellow: wrap(33),
  blue: wrap(34),
  gray: wrap(90),
  bold: wrap(1),
  dim: wrap(2),
};
