import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpellBar } from "./SpellBar";
import type { SpellBarProps } from "./SpellBar";

/** 주문 칩은 접혀 있다가 토글을 눌러야 펼쳐진다 */
function renderOpen(props: SpellBarProps) {
  const view = render(<SpellBar {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "주문 목록" }));
  return view;
}

describe("지팡이 불빛 버튼", () => {
  it("상태에 따라 켜기와 끄기를 표시하고 같은 주문을 요청한다", () => {
    const onCast = vi.fn();
    const { rerender } = renderOpen({ onCast, lightOn: false });
    const off = screen.getByRole("button", { name: /지팡이 불빛 켜기/ });
    expect(off.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(off);
    expect(onCast).toHaveBeenCalledWith("myeonggyeong");
    rerender(<SpellBar onCast={onCast} lightOn />);
    const on = screen.getByRole("button", { name: /지팡이 불빛 끄기/ });
    expect(on.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(on);
    expect(onCast).toHaveBeenCalledTimes(2);
    expect(onCast).toHaveBeenLastCalledWith("myeonggyeong");
  });

  it("쿨타임 중인 주문만 남은 시간과 함께 비활성화한다", () => {
    renderOpen({ onCast: vi.fn(), cooldowns: { hwaryong: 7200 } });
    const fire = screen.getByRole("button", { name: /화룡.*8초 후 사용 가능/ });
    const cloud = screen.getByRole("button", { name: /부운/ });
    expect(fire.hasAttribute("disabled")).toBe(true);
    expect(cloud.hasAttribute("disabled")).toBe(false);
    expect(fire.textContent).toContain("8초");
  });
});

describe("잠긴 주문", () => {
  it("수련 시간이 모자라는 주문은 잠긴 칩으로 보이고 누르지 못한다", () => {
    const onCast = vi.fn();
    renderOpen({ onCast, totalSeconds: 1800 });
    const locked = screen.getByRole("button", {
      name: /소신.*30분을 더 채우면 풀립니다/,
    });
    expect(locked.hasAttribute("disabled")).toBe(true);
    expect(locked.textContent).toContain("잠김");
    fireEvent.click(locked);
    expect(onCast).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole("button", { name: /수호령.*4시간 30분/ })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("누적 시간이 차면 주문이 풀려 시전을 요청한다", () => {
    const onCast = vi.fn();
    renderOpen({ onCast, totalSeconds: 5 * 3600 });
    expect(screen.queryByText(/잠김/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /수호령/ }));
    expect(onCast).toHaveBeenCalledWith("suhoryeong");
  });

  it("기본 주문은 수련 시간이 0이어도 쓸 수 있다", () => {
    renderOpen({ onCast: vi.fn(), totalSeconds: 0 });
    expect(
      screen.getByRole("button", { name: /화룡/ }).hasAttribute("disabled"),
    ).toBe(false);
  });
});

/** jsdom에는 PointerEvent가 없어 pointerType이 사라진다 */
class TestPointerEvent extends MouseEvent {
  readonly pointerType: string;
  constructor(type: string, init: MouseEventInit & { pointerType?: string }) {
    super(type, init);
    this.pointerType = init.pointerType ?? "";
  }
}

describe("잠긴 주문 말풍선", () => {
  beforeEach(() => vi.stubGlobal("PointerEvent", TestPointerEvent));
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const cover = (name: string) =>
    screen
      .getByRole("button", { name: new RegExp(name) })
      .parentElement!.querySelector<HTMLElement>("[data-spell-lock]")!;

  it("마우스를 올리면 설명과 필요한 수련 시간이 뜨고 벗어나면 사라진다", () => {
    renderOpen({ onCast: vi.fn(), totalSeconds: 1200 });
    expect(screen.queryByRole("tooltip")).toBeNull();
    const c = cover("소신");
    fireEvent.pointerEnter(c, { pointerType: "mouse" });
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toContain("0.55배");
    expect(tip.textContent).toContain("누적 수련 1시간 필요");
    expect(tip.textContent).toContain("지금 20분");
    expect(tip.textContent).toContain("40분 남음");
    fireEvent.pointerLeave(c, { pointerType: "mouse" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("탭하면 말풍선이 토글되고 4초 뒤 저절로 닫힌다", () => {
    vi.useFakeTimers();
    renderOpen({ onCast: vi.fn(), totalSeconds: 0 });
    const c = cover("수호령");
    fireEvent.pointerDown(c, { pointerType: "touch" });
    fireEvent.click(c);
    expect(screen.getByRole("tooltip").textContent).toContain(
      "누적 수련 5시간",
    );
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("이미 쓸 수 있는 주문도 마우스를 올리면 설명과 단축키가 뜬다", () => {
    renderOpen({ onCast: vi.fn(), totalSeconds: 5 * 3600 });
    const chip = screen.getByRole("button", { name: /화룡/ });
    fireEvent.pointerEnter(chip.parentElement!, { pointerType: "mouse" });
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toContain("작은 붉은 불꽃");
    expect(tip.textContent).toContain("단축키 3");
    fireEvent.pointerLeave(chip.parentElement!, { pointerType: "mouse" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("명경 칩은 불빛이 켜져 있으면 묵령 설명을 보여 준다", () => {
    renderOpen({ onCast: vi.fn(), lightOn: true });
    const chip = screen.getByRole("button", { name: /지팡이 불빛 끄기/ });
    fireEvent.pointerEnter(chip.parentElement!, { pointerType: "mouse" });
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toContain("묵령");
    expect(tip.textContent).toContain("단축키 1 또는 2");
  });

  it("쿨타임 중인 칩도 마우스를 올리면 설명이 뜬다", () => {
    renderOpen({ onCast: vi.fn(), cooldowns: { hwaryong: 5000 } });
    const chip = screen.getByRole("button", { name: /화룡/ });
    const cover =
      chip.parentElement!.querySelector<HTMLElement>("[aria-hidden]")!;
    fireEvent.pointerEnter(cover, { pointerType: "mouse" });
    expect(screen.getByRole("tooltip").textContent).toContain("작은 붉은 불꽃");
  });

  it("풀린 주문은 잠금 덮개가 없다", () => {
    renderOpen({ onCast: vi.fn(), totalSeconds: 5 * 3600 });
    expect(document.querySelector("[data-spell-lock]")).toBeNull();
  });
});

describe("주문 토글", () => {
  it("처음에는 동그란 버튼 하나만 보이고 누를 때마다 칩이 펼쳐지고 접힌다", () => {
    render(<SpellBar onCast={vi.fn()} />);
    const toggle = screen.getByRole("button", { name: "주문 목록" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("button", { name: /화룡/ })).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /화룡/ })).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.queryByRole("button", { name: /화룡/ })).toBeNull();
  });

  it("시전해도 목록은 열려 있다", () => {
    const onCast = vi.fn();
    renderOpen({ onCast });
    fireEvent.click(screen.getByRole("button", { name: /화룡/ }));
    expect(onCast).toHaveBeenCalledWith("hwaryong");
    expect(screen.getByRole("button", { name: /부운/ })).toBeTruthy();
  });
});
