import type { CheckResult } from "../core/types";

export function renderJson(result: CheckResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}
