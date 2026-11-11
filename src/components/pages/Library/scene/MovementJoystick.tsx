import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import "./MovementJoystick.css";

interface MovementJoystickProps {
  onMove: (direction: { x: number; y: number }) => void;
  disabled?: boolean;
}

export function MovementJoystick({
  onMove,
  disabled = false,
}: MovementJoystickProps) {
  const activePointer = useRef<number | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const reset = useCallback(() => {
    if (activePointer.current === null) return;
    activePointer.current = null;
    setPosition({ x: 0, y: 0 });
    onMove({ x: 0, y: 0 });
  }, [onMove]);
  useEffect(() => {
    if (disabled) reset();
    window.addEventListener("blur", reset);
    return () => window.removeEventListener("blur", reset);
  }, [disabled, reset]);
  useEffect(() => () => reset(), [reset]);

  const update = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const radius = rect.width / 2;
    if (!radius) return;
    let x = (event.clientX - (rect.left + radius)) / radius;
    let y = (event.clientY - (rect.top + rect.height / 2)) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    setPosition({ x, y });
    onMove({ x, y });
  };

  if (disabled) return null;
  return (
    <div
      className="movement-joystick"
      aria-label="이동 조이스틱. 손가락을 원하는 방향으로 움직이세요."
      onPointerDown={(event) => {
        if (activePointer.current !== null) return;
        event.preventDefault();
        activePointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        update(event);
      }}
      onPointerMove={(event) => {
        if (activePointer.current === event.pointerId) update(event);
      }}
      onPointerUp={(event) => {
        if (activePointer.current === event.pointerId) reset();
      }}
      onPointerCancel={(event) => {
        if (activePointer.current === event.pointerId) reset();
      }}
      onLostPointerCapture={(event) => {
        if (activePointer.current === event.pointerId) reset();
      }}
    >
      <div
        className="movement-joystick__knob"
        style={{
          transform: `translate(${position.x * 70}%, ${position.y * 70}%)`,
        }}
      />
    </div>
  );
}
