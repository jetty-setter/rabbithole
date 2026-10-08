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
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  expect(screen.getByRole("searchbox")).toHaveProperty("value", phrase);
  await waitFor(() => expect(searchMoments).toHaveBeenCalledWith(phrase, expect.any(AbortSignal)));
});

it("finds spoken words absent from metadata and links to their timestamp", async () => {
  vi.mocked(searchMoments).mockResolvedValue([{ video: { video_id: "mothman", title: "Mothman", capabilities: { seek: true } } as never, start: 65, snippet: "The eyes glowed red.", score: .8 }]);
  render(<MemoryRouter initialEntries={["/search?q=red+eyes"]}><SearchPage /></MemoryRouter>);
  const watchLink = await screen.findByRole("link", { name: "Watch from 1:05" });
  expect(watchLink.getAttribute("href")).toBe("/watch/mothman?t=65");
  const passage = watchLink.closest("article")!.querySelector("p")!;
  expect(passage.textContent).toBe("The eyes glowed red.");
  expect([...passage.querySelectorAll("mark")].map(mark => mark.textContent)).toEqual(["eyes", "red"]);
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

it("separates literal matches from strong related passages and hides weak ones", async () => {
  const video = (video_id: string, title: string) => ({ video_id, title, capabilities: { seek: true } } as never);
  vi.mocked(searchMoments).mockResolvedValue([
    { video: video("cicada", "Cicada"), start: 145, snippet: "Cryptography and steganography.", score: .72, match_type: "exact" },
    { video: video("kryptos", "Kryptos"), start: 100, snippet: "An encrypted message.", score: .71, match_type: "related" },
    { video: video("ufo", "UFO"), start: 20, snippet: "A fuzzy dot.", score: .60 },
  ]);
  render(<MemoryRouter initialEntries={["/search?q=steganography"]}><SearchPage /></MemoryRouter>);
  expect(await screen.findByRole("link", { name: "Cicada · 2:25" })).toBeTruthy();
  const toggle = screen.getByText(/Related videos/);
  const details = toggle.closest("details")!;
  expect(details.open).toBe(false);
  expect(details.textContent).toContain("Kryptos");
  expect(screen.queryByText("A fuzzy dot.")).toBeNull();
  expect(screen.queryByRole("heading", { name: "Video matches" })).toBeNull();
  fireEvent.click(toggle);
  expect(details.open).toBe(true);
  expect(screen.getByRole("link", { name: "Watch from 1:40" }).getAttribute("href")).toBe("/watch/kryptos?t=100");
});

it("shows an honest empty literal section while offering related passages", async () => {
  vi.mocked(searchMoments).mockResolvedValue([{ video: { video_id: "kryptos", title: "Kryptos" } as never, start: 0, snippet: "An encrypted message.", score: .71, match_type: "related" }]);
  render(<MemoryRouter initialEntries={["/search?q=hidden+messages"]}><SearchPage /></MemoryRouter>);
  expect(await screen.findByText("No transcript matches.")).toBeTruthy();
  expect(screen.getByText(/Related videos/).closest("details")!.open).toBe(false);
});
