// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useSearchParams } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { LibraryPage } from "../LibraryPage";

// Stands in for the real search results route so a hero submission can be
// observed, including the query it carried in `?q=`.
function SearchProbe() {
  const [params] = useSearchParams();
  return <div>search results for: {params.get("q")}</div>;
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/rabbitholes/:slug" element={<div>reader page</div>} />
        <Route path="/search" element={<SearchProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const heroSearchInput = () =>
  screen.getByRole("searchbox", { name: /search rabbithole/i });
const diveInButton = () => screen.getByRole("button", { name: /dive in/i });

afterEach(cleanup);

describe("LibraryPage — homepage", () => {
  it("renders the hero", () => {
    renderHome();

    expect(
      screen.getByRole("heading", { level: 1, name: /see what.?s\s+inside/i }),
    ).toBeTruthy();
    // The hero's call to action is a real search form.
    expect(heroSearchInput()).toBeTruthy();
    expect(diveInButton()).toBeTruthy();
  });

  it("has no explanation block and no START HERE treatment", () => {
    renderHome();

    expect(screen.queryByText(/built to be wandered/i)).toBeNull();
    expect(screen.queryByText(/^start here$/i)).toBeNull();
    expect(screen.queryByText(/where it goes from here/i)).toBeNull();
  });

  it("Latest: renders the Wow! Signal feature with its exact copy", () => {
    renderHome();

    const region = screen.getByRole("region", { name: /^latest$/i });
    expect(
      within(region).getByRole("heading", { name: /the wow! signal/i }),
    ).toBeTruthy();
    expect(
      within(region).getByText(
        "For 72 seconds in 1977, a radio telescope in Ohio detected a signal so unusual that astronomer Jerry Ehman circled the printout and wrote one word beside it: Wow! It was never detected again.",
      ),
    ).toBeTruthy();
  });

  it("Latest: the read action has no arrow and links to the RabbitHole", () => {
    renderHome();

    const region = screen.getByRole("region", { name: /^latest$/i });
    const action = within(region).getByRole("link", { name: /read rabbithole/i });
    expect(action.textContent).toBe("Read RabbitHole");
    expect(action.getAttribute("href")).toBe("/rabbitholes/the-wow-signal");
  });

  it("hero search: a query + Dive in routes into /search, carrying the query", async () => {
    renderHome();

    fireEvent.change(heroSearchInput(), { target: { value: "  gone too far  " } });
    fireEvent.click(diveInButton());

    expect(await screen.findByText("search results for: gone too far")).toBeTruthy();
  });

  it("hero search: Enter in the field submits the query", async () => {
    renderHome();

    const input = heroSearchInput();
    fireEvent.change(input, { target: { value: "the qwerty keyboard" } });
    fireEvent.submit(input.closest("form")!);

    expect(
      await screen.findByText("search results for: the qwerty keyboard"),
    ).toBeTruthy();
  });

  it("hero search: an empty query does not navigate", () => {
    renderHome();

    fireEvent.change(heroSearchInput(), { target: { value: "   " } });
    fireEvent.click(diveInButton());

    expect(screen.queryByText(/^search results for:/)).toBeNull();
    // still on the homepage
    expect(
      screen.getByRole("heading", { level: 1, name: /see what.?s\s+inside/i }),
    ).toBeTruthy();
  });
});
