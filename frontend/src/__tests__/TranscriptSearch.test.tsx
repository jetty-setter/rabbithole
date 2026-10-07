// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { SearchPage } from "../SearchPage";
import { searchMoments } from "../api";

vi.mock("../api", async () => ({ ...await vi.importActual("../api"), searchMoments: vi.fn() }));
vi.mock("../App", () => ({ useApp: () => ({ loading: false, catalogError: false, refresh: vi.fn(), videos: [
  { video_id: "mothman", filename: "mothman", title: "Mothman", status: "ready", visibility: "public", provider: "youtube", provider_id: "GUpeDwiD64M", capabilities: { watch: true, moment_search: true }, has_transcript: true },
] }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("prefills a transcript phrase and searches only when submitted", async () => {
  vi.mocked(searchMoments).mockResolvedValue([]);
  render(<MemoryRouter initialEntries={["/search"]}><SearchPage /></MemoryRouter>);
  const input = screen.getByRole("searchbox") as HTMLInputElement;
  const phrase = input.value;
  expect(["glowing red eyes", "Silver Bridge"]).toContain(phrase);
  expect(searchMoments).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Search", exact: true }));
  expect(screen.getByRole("searchbox")).toHaveProperty("value", phrase);
  await waitFor(() => expect(searchMoments).toHaveBeenCalledWith(phrase, expect.any(AbortSignal)));
});

it("finds spoken words absent from metadata and links to their timestamp", async () => {
  vi.mocked(searchMoments).mockResolvedValue([{ video: { video_id: "mothman", title: "Mothman", capabilities: { seek: true } } as never, start: 65, snippet: "The eyes glowed red.", score: .8 }]);
  render(<MemoryRouter initialEntries={["/search?q=red+eyes"]}><SearchPage /></MemoryRouter>);
  expect(await screen.findByText("The eyes glowed red.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Watch from 1:05" }).getAttribute("href")).toBe("/watch/mothman?t=65");
});
it("reports a failed request instead of presenting it as no matches", async () => {
  vi.mocked(searchMoments).mockRejectedValue(new Error("unavailable"));
  render(<MemoryRouter initialEntries={["/search?q=red"]}><SearchPage /></MemoryRouter>);
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("couldn’t finish"));
});
it("does not invent timestamps for untimed transcripts", async () => {
  vi.mocked(searchMoments).mockResolvedValue([{ video: { video_id: "mothman", title: "Mothman", capabilities: { seek: false } } as never, start: 0, snippet: "A witness account.", score: .8 }]);
  render(<MemoryRouter initialEntries={["/search?q=witness"]}><SearchPage /></MemoryRouter>);
  expect(await screen.findByRole("link", { name: "Watch video" })).toHaveProperty("href", expect.stringContaining("/watch/mothman"));
  expect(screen.queryByText(/Watch from/)).toBeNull();
});
