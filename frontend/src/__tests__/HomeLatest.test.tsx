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

  it("every row uses the same image-left/text-right direction, never alternating", () => {
    renderLatest([
      { slug: "a", title: "Item A", hook: "Hook A.", imageUrl: "/a.jpg" },
      { slug: "b", title: "Item B", hook: "Hook B.", imageUrl: "/b.jpg" },
    ]);

    const rows = document.querySelectorAll(".home-index-row.has-image");
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      // No side-specific modifier class -- image-left/text-right is the
      // only layout, expressed via DOM order (image first) rather than a
      // class the row could vary.
      expect(row.classList.contains("image-left")).toBe(false);
      expect(row.classList.contains("image-right")).toBe(false);
      const children = Array.from(row.children);
      const imageIndex = children.findIndex((c) =>
        c.classList.contains("home-index-image"),
      );
      const textIndex = children.findIndex((c) =>
        c.classList.contains("home-index-text"),
      );
      expect(imageIndex).toBeGreaterThanOrEqual(0);
      expect(imageIndex).toBeLessThan(textIndex);
    }
  });
});
