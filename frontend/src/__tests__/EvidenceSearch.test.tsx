// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EvidenceSearch } from "../components/rabbithole/EvidenceSearch";
import { getEvidence } from "../api";

vi.mock("../api", () => ({ getEvidence: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

const result = {
  status: "partial", total_matches: 1,
  jobs: [{ source_id: "s9", number: 1, title: "Original record", status: "ready" },
         { source_id: "s2", number: 2, title: "Offline record", status: "unavailable" }],
  matches: [{ source_id: "s9", number: 1, title: "Original record", passage_index: 0, passage: "A signal was observed." }],
};

describe("Evidence search", () => {
  it("shows partial availability and links search passages to display citation numbers", async () => {
    vi.mocked(getEvidence).mockImplementation(async (_slug, q) => ({ ...result, matches: q ? result.matches : [], total_matches: q ? 1 : 0 }));
    render(<EvidenceSearch slug="signal" />);
    expect(await screen.findByText("1 of 2 sources searchable.")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "signal" } });
    expect(await screen.findByText("A signal was observed.")).toBeTruthy();
    for (const link of screen.getAllByRole("link", { name: "[1] Original record" })) {
      expect(link.getAttribute("href")).toBe("#rh-source-1");
    }
  });
  it("recovers visibly from an API failure", async () => {
    vi.mocked(getEvidence).mockRejectedValueOnce(new Error("unavailable"));
    vi.mocked(getEvidence).mockResolvedValue(result);
    render(<EvidenceSearch slug="signal" />);
    expect(await screen.findByText("Evidence search is temporarily unavailable.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByText("1 of 2 sources searchable.")).toBeTruthy());
  });
});
