import { useEffect, useRef, useState } from "react";
import { ButtonMedium, ButtonSmall } from "../../ui/Button";
import { getEffectsVolume, setEffectsVolume } from "./soundSettings";

/** 처음 켰을 때의 음량(%) — 공부하는 동안 거슬리지 않게 낮게 둔다 */
const DEFAULT_VOLUME = 10;

export function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [effects, setEffects] = useState(() =>
    Math.round(getEffectsVolume() * 100),
  );
  const lastEffects = useRef(effects || 100);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = DEFAULT_VOLUME / 100;
    let enabled = true;
    const start = () => {
      if (!enabled) return;
      void audio
        .play()
        .then(() => {
          enabled = false;
        })
        .catch(() => {
          // 자동 재생이 차단되면 다음 사용자 입력에서 다시 시도한다.
        });
    };
    const onInteraction = (event: Event) => {
      if (
        event.target instanceof Element &&
        event.target.closest("[data-music-control]")
      )
        return;
      start();
    };
    start();
    document.addEventListener("pointerdown", onInteraction);
    document.addEventListener("keydown", onInteraction);
    return () => {
      enabled = false;
      document.removeEventListener("pointerdown", onInteraction);
      document.removeEventListener("keydown", onInteraction);
      audio.pause();
    };
  }, []);

  return (
    <>
      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}sounds/music/sasinhakdang.mp3`}
        loop
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <div
        data-music-control
        style={{
          position: "fixed",
          right: "max(var(--spacing-16), env(safe-area-inset-right))",
          top: "calc(max(var(--spacing-16), env(safe-area-inset-top)) + var(--spacing-64) + var(--spacing-48))",
          zIndex: 5,
          display: "flex",
          flexDirection: "column-reverse",
          alignItems: "flex-end",
          gap: "var(--spacing-8)",
        }}
      >
        {open ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--spacing-8)",
              padding: "var(--spacing-12)",
              borderRadius: "var(--radius-lg)",
              background: "var(--color-background-Subtle)",
              border: "1px solid var(--color-border-default)",
              color: "var(--color-text-primary)",
              width: "calc(var(--spacing-48) * 4)",
            }}
          >
            <label
              htmlFor="background-music-volume"
              style={{ font: "var(--text-body-sm-bold)" }}
            >
              배경음 음량 {volume}%
            </label>
            <input
              id="background-music-volume"
              type="range"
              min="0"
              max="100"
              step="0.5"
              value={volume}
              style={{
                width: "100%",
                accentColor: "var(--color-interactive-primary)",
              }}
              onChange={(event) => {
                const next = Number(event.target.value);
                setVolume(next);
                if (audioRef.current) audioRef.current.volume = next / 100;
              }}
            />
            <ButtonSmall
              style="monolight"
              onClick={() => {
                const audio = audioRef.current;
                if (!audio) return;
                if (audio.paused) void audio.play().catch(() => {});
                else audio.pause();
              }}
            >
              {playing ? "배경음 끄기" : "배경음 켜기"}
            </ButtonSmall>
            <label
              htmlFor="effects-volume"
              style={{ font: "var(--text-body-sm-bold)" }}
            >
              효과음 음량 {effects}%
            </label>
            <input
              id="effects-volume"
              type="range"
              min="0"
              max="100"
              value={effects}
              style={{
                width: "100%",
                accentColor: "var(--color-interactive-primary)",
              }}
              onChange={(event) => {
                const next = Number(event.target.value);
                setEffects(next);
                if (next > 0) lastEffects.current = next;
                setEffectsVolume(next / 100);
              }}
            />
            <ButtonSmall
              style="monolight"
              onClick={() => {
                const next = effects > 0 ? 0 : lastEffects.current;
                setEffects(next);
                setEffectsVolume(next / 100);
              }}
            >
              {effects > 0 ? "효과음 끄기" : "효과음 켜기"}
            </ButtonSmall>
          </div>
        ) : null}
        <ButtonMedium
          type="icon"
          icon="music"
          style="monolight"
          radius="var(--radius-circle)"
          aria-label="음향 설정"
          aria-pressed={open}
          onClick={() => setOpen((value) => !value)}
        />
      </div>
    </>
  );
}
