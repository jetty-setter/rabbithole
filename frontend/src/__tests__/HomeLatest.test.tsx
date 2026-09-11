// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { HomeLatest } from "../components/home/HomeLatest";

function renderLatest(items?: Parameters<typeof HomeLatest>[0]["items"]) {
  return render(
    <MemoryRouter>
      <HomeLatest items={items} />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe("HomeLatest — future multi-item scaffolding", () => {
  it("with no items: renders only the lead feature, no index list", () => {
    renderLatest();

    const region = screen.getByRole("region", { name: /^latest$/i });
    expect(
      within(region).getByRole("heading", { name: /the wow! signal/i }),
    ).toBeTruthy();
    expect(within(region).queryByRole("list")).toBeNull();
  });

  it("with items: renders the lead feature plus a tighter index below it", () => {
    renderLatest([
      { slug: "a", title: "Item A", hook: "Hook A." },
      { slug: "b", title: "Item B", hook: "Hook B.", imageUrl: "/b.jpg" },
    ]);

    const region = screen.getByRole("region", { name: /^latest$/i });
    // Lead is still there and still first.
    expect(
      within(region).getByRole("heading", { name: /the wow! signal/i }),
    ).toBeTruthy();

    const list = within(region).getByRole("list");
    const rows = within(list).getAllByRole("heading", { level: 3 });
    expect(rows.map((h) => h.textContent)).toEqual(["Item A", "Item B"]);

    const links = within(list).getAllByRole("link", { name: /read rabbithole/i });
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/rabbitholes/a",
      "/rabbitholes/b",
    ]);

    // Only the item with a real imageUrl renders an image. The image is
    // decorative (aria-hidden, alt=""), so query the DOM directly rather
    // than by role.
    expect(list.querySelectorAll("img")).toHaveLength(1);
  });

  it("alternates image side across index items", () => {
    renderLatest([
      { slug: "a", title: "Item A", hook: "Hook A.", imageUrl: "/a.jpg" },
      { slug: "b", title: "Item B", hook: "Hook B.", imageUrl: "/b.jpg" },
    ]);

    const rows = document.querySelectorAll(".home-index-row");
    expect(rows[0].classList.contains("image-left")).toBe(true);
    expect(rows[1].classList.contains("image-right")).toBe(true);
  });
});
