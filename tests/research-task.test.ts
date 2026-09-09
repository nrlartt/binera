import { test } from "node:test";
import assert from "node:assert/strict";
import { newTask, taskSchema, taskText } from "../src/lib/research-task";
test("all four research categories retain their exact reviewed constraints", () => {
  for (const category of ["rebalancing", "grid", "yield", "health"] as const) {
    const task = { ...newTask(category), budget: "5000", target: "0x0000000000000000000000000000000000000001", lower: "1.2", upper: "1.5" };
    const text = taskText(task);
    assert.match(text, /5000 USDT/); assert.match(text, /not the agent fee/); assert.match(text, /Do not trade/);
    assert.ok(text.length <= 1200); assert.notEqual(text, taskText({ ...task, budget: "6000" }));
    assert.notEqual(text, taskText({ ...task, target: "0x0000000000000000000000000000000000000002" }));
  }
});
test("invalid addresses, nonfinite capital, inverted bounds and unsafe grid counts are rejected", () => {
  for (const patch of [{ target: "https://example.com" }, { budget: "Infinity" }, { budget: "-1" }, { budget: "1e100" }, { lower: "10", upper: "2" }, { levels: "101" }, { levels: "1.5" }]) assert.equal(taskSchema.safeParse({ ...newTask("grid"), ...patch }).success, false);
});
