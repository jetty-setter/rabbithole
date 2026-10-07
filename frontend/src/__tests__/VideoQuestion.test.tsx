// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { VideoQuestion } from "../components/VideoQuestion";
import { askVideo } from "../api";

vi.mock("../api", () => ({ askVideo: vi.fn() }));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("opens on demand, answers a question, and returns to the cited moment", async () => {
  const seek = vi.fn();
  vi.mocked(askVideo).mockResolvedValue({ answer: "The puzzle uses hidden messages.", citations: [{ start: 145, text: "steganography" }] } as never);
  render(<VideoQuestion videoId="cicada" title="Cicada 3301" onSeek={seek} />);
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Ask about this video" }));
  expect(screen.getByRole("dialog", { name: "Ask about this video" })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("What caught your attention?"), { target: { value: "How were messages hidden?" } });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
  expect(await screen.findByText("The puzzle uses hidden messages.")).toBeTruthy();
  expect(askVideo).toHaveBeenCalledWith("cicada", "How were messages hidden?");
  fireEvent.click(screen.getByRole("button", { name: "Watch from 2:25" }));
  expect(seek).toHaveBeenCalledWith(145);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("keeps the draft when closed and reopened and reports request errors", async () => {
  vi.mocked(askVideo).mockRejectedValue(new Error("Please try again."));
  render(<VideoQuestion videoId="cicada" title="Cicada 3301" onSeek={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Ask about this video" }));
  fireEvent.change(screen.getByLabelText("What caught your attention?"), { target: { value: "Who made it?" } });
  fireEvent.click(screen.getByRole("button", { name: "Close question panel" }));
  fireEvent.click(screen.getByRole("button", { name: "Ask about this video" }));
  expect(screen.getByLabelText("What caught your attention?")).toHaveProperty("value", "Who made it?");
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Please try again.");
});
