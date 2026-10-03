// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { EmbedPlayer } from "../EmbedPlayer";

afterEach(() => { cleanup(); delete window.YT; });

it("preserves playback on parent updates but replaces the player for another video", async () => {
  const destroy = vi.fn();
  const create = vi.fn(function (target: HTMLElement) {
    const iframe = document.createElement("iframe");
    target.replaceWith(iframe);
    return { seekTo: vi.fn(), playVideo: vi.fn(), destroy: () => { destroy(); iframe.remove(); } };
  });
  window.YT = { Player: create };
  const props = { videoId: "first", embedUrl: "https://www.youtube-nocookie.com/embed/first", title: "First" };
  const view = render(<EmbedPlayer {...props} registerSeek={() => {}} />);
  await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  view.rerender(<EmbedPlayer {...props} registerSeek={() => {}} />);
  expect(destroy).not.toHaveBeenCalled();
  expect(create).toHaveBeenCalledTimes(1);
  view.rerender(<EmbedPlayer {...props} videoId="second" registerSeek={() => {}} />);
  await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
  expect(destroy).toHaveBeenCalledTimes(1);
  expect(view.container.querySelectorAll("iframe")).toHaveLength(1);
});
