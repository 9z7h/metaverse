import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BackgroundMusic } from "./BackgroundMusic";
import { getEffectsBus, setEffectsVolume } from "./soundSettings";

afterEach(() => vi.restoreAllMocks());

it("자동 재생이 차단되면 사용자 입력에서 다시 시작하고 끌 수 있다", async () => {
  const play = vi
    .spyOn(HTMLMediaElement.prototype, "play")
    .mockRejectedValueOnce(new Error("blocked"))
    .mockResolvedValue(undefined);
  const pause = vi
    .spyOn(HTMLMediaElement.prototype, "pause")
    .mockImplementation(() => {});
  const { container, unmount } = render(<BackgroundMusic />);
  const audio = container.querySelector("audio")!;
  expect(audio.loop).toBe(true);
  expect(audio.volume).toBeCloseTo(0.2);
  await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
  fireEvent.pointerDown(document.body);
  await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
  fireEvent.play(audio);
  fireEvent.click(screen.getByRole("button", { name: "음향 설정" }));
  fireEvent.change(screen.getByRole("slider", { name: /배경음 음량/ }), {
    target: { value: "65" },
  });
  expect(audio.volume).toBeCloseTo(0.65);
  const bus = { gain: { value: 1 }, connect: vi.fn() };
  const context = {
    createGain: () => bus,
    destination: {},
  } as unknown as AudioContext;
  expect(getEffectsBus(context)).toBe(bus);
  fireEvent.change(screen.getByRole("slider", { name: /효과음 음량/ }), {
    target: { value: "30" },
  });
  expect(bus.gain.value).toBeCloseTo(0.3);
  expect(audio.volume).toBeCloseTo(0.65);
  fireEvent.click(screen.getByRole("button", { name: "효과음 끄기" }));
  expect(bus.gain.value).toBe(0);
  expect(audio.volume).toBeCloseTo(0.65);
  fireEvent.click(screen.getByRole("button", { name: "효과음 켜기" }));
  expect(bus.gain.value).toBeCloseTo(0.3);
  expect(
    screen.getByRole("button", { name: "배경음 끄기" }),
  ).toBeInTheDocument();
  Object.defineProperty(audio, "paused", { configurable: true, value: false });
  fireEvent.click(screen.getByRole("button", { name: "배경음 끄기" }));
  expect(pause).toHaveBeenCalled();
  unmount();
  setEffectsVolume(1);
});
