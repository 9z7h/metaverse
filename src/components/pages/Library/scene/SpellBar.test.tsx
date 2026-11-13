import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SpellBar } from "./SpellBar";

describe("지팡이 불빛 버튼", () => {
  it("상태에 따라 켜기와 끄기를 표시하고 같은 주문을 요청한다", () => {
    const onCast = vi.fn();
    const { rerender } = render(<SpellBar onCast={onCast} lightOn={false} />);
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
    render(<SpellBar onCast={vi.fn()} cooldowns={{ hwaryong: 7200 }} />);
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
    render(<SpellBar onCast={onCast} totalSeconds={1800} />);
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
    render(<SpellBar onCast={onCast} totalSeconds={5 * 3600} />);
    expect(screen.queryByText(/잠김/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /수호령/ }));
    expect(onCast).toHaveBeenCalledWith("suhoryeong");
  });

  it("기본 주문은 수련 시간이 0이어도 쓸 수 있다", () => {
    render(<SpellBar onCast={vi.fn()} totalSeconds={0} />);
    expect(
      screen.getByRole("button", { name: /화룡/ }).hasAttribute("disabled"),
    ).toBe(false);
  });
});
