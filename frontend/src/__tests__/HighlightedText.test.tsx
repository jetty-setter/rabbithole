// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { HighlightedText } from "../components/HighlightedText";

afterEach(cleanup);

it("highlights repeated query words regardless of case and preserves the text", () => {
  const text = "Red eyes. The EYES glowed red.";
  const { container } = render(<HighlightedText text={text} query="red eyes" />);
  expect(container.textContent).toBe(text);
  expect([...container.querySelectorAll("mark")].map(m => m.textContent)).toEqual(["Red", "eyes", "EYES", "red"]);
});

it("treats punctuation and HTML as literal text", () => {
  const text = "C++ [signal] <img src=x onerror=alert(1)>";
  const { container } = render(<HighlightedText text={text} query="C++ [signal] <img" />);
  expect([...container.querySelectorAll("mark")].map(m => m.textContent)).toEqual(["C++", "[signal]", "<img"]);
  expect(container.querySelector("img")).toBeNull();
  expect(container.textContent).toBe(text);
});

it("only highlights the matching phrase for in-video transcript filtering", () => {
  const { container } = render(<HighlightedText text="Red eyes, then red lights." query="red eyes" phrase />);
  expect([...container.querySelectorAll("mark")].map(m => m.textContent)).toEqual(["Red eyes"]);
});

it("leaves related passages without literal matches unmarked and clears old highlights", () => {
  const { container, rerender } = render(<HighlightedText text="A crimson glow." query="red eyes" />);
  expect(container.querySelector("mark")).toBeNull();
  rerender(<HighlightedText text="A crimson glow." query="crimson" />);
  expect(container.querySelector("mark")?.textContent).toBe("crimson");
  rerender(<HighlightedText text="A crimson glow." query="  " />);
  expect(container.querySelector("mark")).toBeNull();
});
