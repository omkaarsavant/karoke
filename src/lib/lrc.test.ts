import { describe, it, expect } from "vitest";
import { parseLrc, activeLineIndex, formatTime } from "./lrc";

describe("lrc", () => {
  it("parses timestamps and sorts", () => {
    const l = parseLrc("[ti:x]\n[00:05.50]b\n[00:01.00]a\n[01:02.123]c");
    expect(l.map((x) => x.text)).toEqual(["a", "b", "c"]);
    expect(l[1].time).toBeCloseTo(5.5);
    expect(l[2].time).toBeCloseTo(62.123);
  });
  it("handles multiple tags and offset", () => {
    const l = parseLrc("[offset:1000]\n[00:03.00][00:10.00]chorus");
    expect(l.map((x) => x.time)).toEqual([2, 9]);
  });
  it("removes enhanced LRC word timestamps and voice labels", () => {
    const l = parseLrc("[00:10.986]v1:<00:10.986>You <00:11.391>told <00:11.777>me");
    expect(l).toEqual([{ time: 10.986, text: "You told me" }]);
  });
  it("finds active line", () => {
    const l = parseLrc("[00:01.00]a\n[00:05.00]b");
    expect(activeLineIndex(l, 0.5)).toBe(-1);
    expect(activeLineIndex(l, 1)).toBe(0);
    expect(activeLineIndex(l, 7)).toBe(1);
  });
  it("formats time", () => expect(formatTime(65.9)).toBe("1:05"));
});
