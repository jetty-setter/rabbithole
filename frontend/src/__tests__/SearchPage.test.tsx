// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { SearchPage } from "../SearchPage";

vi.mock("../App", () => ({ useApp: () => ({ loading: false, catalogError: false, refresh: vi.fn(), videos: [
  { video_id: "jelly", filename: "jelly", title: "Phantom jelly", owner: "MBARI", description: "Deep sea footage", created_at: "2026-10-01", status: "ready", visibility: "public", capabilities: { watch: true }, has_transcript: false },
] }) }));
afterEach(cleanup);

it("finds an untranscribed embed and navigates to the watch page", () => {
  render(<MemoryRouter initialEntries={["/search?q=sea"]}><SearchPage /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "Phantom jelly" })).toBeTruthy();
  expect(screen.getByRole("link", { name: /Phantom jelly/ }).getAttribute("href")).toBe("/watch/jelly");
});

it("supports another query and an honest empty result", () => {
  render(<MemoryRouter initialEntries={["/search?q=sea"]}><SearchPage /></MemoryRouter>);
  const input = screen.getByRole("searchbox");
  fireEvent.change(input, { target: { value: "clockwork" } });
  fireEvent.submit(input.closest("form")!);
  expect(screen.getByRole("heading", { name: "Results for “clockwork”" })).toBeTruthy();
  expect(screen.getByText(/No matches yet/)).toBeTruthy();
});
