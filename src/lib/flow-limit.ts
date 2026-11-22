export const positionLimit = { min: 1, max: 5 };

export const limitSentence =
  "The book holds at most the number of positions named in the dossier under THE BOOK, resting orders included.";

export function parsePositionLimit(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isInteger(parsed) || parsed < positionLimit.min || parsed > positionLimit.max) return null;
  return parsed;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function nodesOf(workflow: Record<string, unknown>): Record<string, unknown>[] {
  if (!Array.isArray(workflow.nodes)) return [];
  return workflow.nodes.flatMap((node) => {
    const record = asRecord(node);
    return record ? [record] : [];
  });
}

function assignmentsOf(workflow: Record<string, unknown>): Record<string, unknown>[] {
  const desk = nodesOf(workflow).find((node) => node.name === "Desk Config");
  const parameters = asRecord(desk?.parameters);
  const assignments = asRecord(parameters?.assignments);
  if (!Array.isArray(assignments?.assignments)) return [];
  return assignments.assignments.flatMap((item) => {
    const record = asRecord(item);
    return record ? [record] : [];
  });
}

export function readPositionLimit(workflow: Record<string, unknown>): number | null {
  const found = assignmentsOf(workflow).find((item) => item.name === "maxPositions");
  return found ? parsePositionLimit(found.value) : null;
}

function rewriteLimit(text: string): string {
  return text.replace(/The book holds at most (?:two|\d+) positions, resting orders included\./g, limitSentence);
}

function rewriteText(value: unknown): boolean {
  if (Array.isArray(value)) {
    let changed = false;
    value.forEach((item, index) => {
      if (typeof item === "string" && item.includes("The book holds at most")) {
        const next = rewriteLimit(item);
        if (next !== item) {
          value[index] = next;
          changed = true;
        }
      } else if (rewriteText(item)) changed = true;
    });
    return changed;
  }
  const record = asRecord(value);
  if (!record) return false;
  let changed = false;
  for (const [key, item] of Object.entries(record)) {
    if (typeof item === "string" && item.includes("The book holds at most")) {
      const next = rewriteLimit(item);
      if (next !== item) {
        record[key] = next;
        changed = true;
      }
    } else if (rewriteText(item)) changed = true;
  }
  return changed;
}

export function applyPositionLimit(workflow: Record<string, unknown>, maxPositions: number): { changed: boolean; found: boolean } {
  const rows = assignmentsOf(workflow);
  const found = rows.find((item) => item.name === "maxPositions");
  if (!found) return { changed: false, found: false };
  let changed = false;
  if (parsePositionLimit(found.value) !== maxPositions) {
    found.value = maxPositions;
    found.type = "number";
    changed = true;
  }
  const orbit = nodesOf(workflow).find((node) => node.name === "Orbit");
  if (orbit && rewriteText(orbit.parameters)) changed = true;
  return { changed, found: true };
}
