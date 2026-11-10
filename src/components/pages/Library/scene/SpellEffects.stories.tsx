import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { SpellEffects } from "./SpellEffects";
import { Avatar } from "./Avatar";
import { houseToken } from "../houses";
import { readSceneColors } from "./sceneLayout";
import type { SceneColors } from "./sceneLayout";
import { SPELLS, SPELL_ORDER, addCast, castZone } from "./spellLogic";
import type { SpellCast, SpellId } from "./spellLogic";

/** 미리보기가 멈춰 보이지 않도록 매 프레임 장면을 다시 그리게 한다 */
function Tick() {
  useFrame(() => undefined);
  return null;
}

function SpellPreview({ spell = "myeonggyeong" }: { spell?: SpellId }) {
  const root = useRef<HTMLDivElement>(null);
  const [colors, setColors] = useState<SceneColors | null>(null);
  const [casts, setCasts] = useState<SpellCast[]>([]);
  useLayoutEffect(() => {
    if (root.current) setColors(readSceneColors(root.current));
  }, []);
  // 끝나면 다시 시전해 계속 볼 수 있게 한다
  useEffect(() => {
    let n = 0;
    const cast = () => {
      const now = performance.now();
      const zone = castZone(0, 0, 0);
      setCasts((list) =>
        addCast(
          list,
          {
            id: `preview-${n++}`,
            caster: "me",
            spell,
            ...zone,
            ry: 0,
            t0: now,
          },
          now,
        ),
      );
    };
    cast();
    if (spell === "myeonggyeong") return;
    const timer = window.setInterval(cast, SPELLS[spell].durationMs + 800);
    return () => window.clearInterval(timer);
  }, [spell]);
  return (
    <div
      ref={root}
      data-theme="library"
      style={{ height: "100dvh", minHeight: "calc(var(--spacing-64) * 8)" }}
    >
      {colors ? (
        <Canvas
          camera={{ position: [0, 2.2, -2.2], fov: 40 }}
          aria-label="주문 미리보기"
        >
          <color attach="background" args={[colors["--color-scene-fog"]]} />
          <ambientLight intensity={0.8} />
          <directionalLight position={[3, 5, 4]} intensity={1} />
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[12, 12]} />
            <meshStandardMaterial color={colors["--color-scene-floor"]} />
          </mesh>
          <SpellEffects colors={colors} casts={casts} />
          <Avatar
            house="cheongryong"
            robe={colors[houseToken("cheongryong", "primary")]}
            band={colors[houseToken("cheongryong", "accent")]}
            collar={colors["--color-scene-collar"]}
            skin={colors["--color-scene-skin"]}
            hat={colors["--color-scene-hat"]}
            pose="stand"
            name="수련생"
            showLabel={false}
            wand={{
              wood: colors["--color-scene-wood-dark"],
              glow: colors["--color-scene-flame"],
            }}
            wandLightAt={
              casts.find((c) => c.spell === "myeonggyeong")?.t0 ?? null
            }
          />
          <Tick />
          <OrbitControls
            target={[0, 0.8, 1.6]}
            minDistance={1.5}
            maxDistance={8}
          />
        </Canvas>
      ) : null}
    </div>
  );
}

const meta = {
  title: "Pages/Library/SpellEffects",
  component: SpellPreview,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  argTypes: { spell: { control: "select", options: SPELL_ORDER } },
  args: { spell: "myeonggyeong" },
} satisfies Meta<typeof SpellPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Myeonggyeong: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByLabelText("주문 미리보기"),
    ).toBeInTheDocument();
  },
};
export const Mukryeong: Story = { args: { spell: "mukryeong" } };
export const Hwaryong: Story = { args: { spell: "hwaryong" } };
export const Buun: Story = { args: { spell: "buun" } };
