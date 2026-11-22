import assert from "node:assert/strict";
import test from "node:test";
import { applyPositionLimit, limitSentence, parsePositionLimit, readPositionLimit } from "./flow-limit.ts";

test("a whole number from 1 to 5 is a position limit", () => {
  assert.equal(parsePositionLimit(3), 3);
  assert.equal(parsePositionLimit("5"), 5);
  assert.equal(parsePositionLimit(0), null);
  assert.equal(parsePositionLimit(6), null);
  assert.equal(parsePositionLimit(2.5), null);
});

test("applying a limit updates the desk config and the model prompt", () => {
  const workflow = {
    nodes: [
      {
        name: "Desk Config",
        parameters: { assignments: { assignments: [{ id: "maxPositions", name: "maxPositions", value: 2, type: "number" }] } },
      },
      {
        name: "Orbit",
        parameters: {
          responses: {
            values: [{ role: "system", content: "The book holds at most two positions, resting orders included. Then hunt." }],
          },
        },
      },
    ],
  };
  const applied = applyPositionLimit(workflow, 3);
  assert.equal(applied.found, true);
  assert.equal(applied.changed, true);
  assert.equal(readPositionLimit(workflow), 3);
  const content = workflow.nodes[1].parameters.responses.values[0].content;
  assert.equal(content.includes(limitSentence), true);
  assert.equal(content.includes("two"), false);
  assert.equal(applyPositionLimit(workflow, 3).changed, false);
});
