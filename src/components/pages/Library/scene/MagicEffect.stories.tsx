import { useLayoutEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { MagicEffect } from "./MagicEffect";
import { readSceneColors } from "./sceneLayout";
import type { SceneColors } from "./sceneLayout";
import { HOUSE_IDS } from "../houses";
import type { HouseId } from "../houses";

function PracticePreview({ house = "cheongryong" }: { house?: HouseId }) {
  const root = useRef<HTMLDivElement>(null);
  const [colors, setColors] = useState<SceneColors | null>(null);
  useLayoutEffect(() => {
    if (root.current) setColors(readSceneColors(root.current));
  }, []);
  return (
    <div
      ref={root}
      data-theme="library"
      style={{ height: "100dvh", minHeight: "calc(var(--spacing-64) * 8)" }}
    >
      {colors ? (
        <Canvas
          camera={{ position: [2.2, 2.7, 3.2], fov: 35 }}
          aria-label="실습 마법 미리보기"
        >
          <color attach="background" args={[colors["--color-scene-fog"]]} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[3, 5, 4]} intensity={1.5} />
          <mesh position={[0, 0.75, 0]}>
            <boxGeometry args={[1.6, 0.08, 1.2]} />
            <meshStandardMaterial color={colors["--color-scene-wood"]} />
          </mesh>
          <mesh position={[0, 0.805, 0]}>
            <boxGeometry args={[0.42, 0.025, 0.6]} />
            <meshStandardMaterial color={colors["--color-scene-collar"]} />
          </mesh>
          <MagicEffect colors={colors} house={house} at={{ x: 0, z: 0 }} />
          <OrbitControls
            target={[0, 1.35, 0]}
            minDistance={1.5}
            maxDistance={6}
          />
        </Canvas>
      ) : null}
    </div>
  );
}

const meta = {
  title: "Pages/Library/MagicEffect",
  component: PracticePreview,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  argTypes: { house: { control: "select", options: HOUSE_IDS } },
  args: { house: "cheongryong" },
} satisfies Meta<typeof PracticePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Cheongryong: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByLabelText("실습 마법 미리보기"),
    ).toBeInTheDocument();
  },
};
export const Baekho: Story = { args: { house: "baekho" } };
export const Jujak: Story = { args: { house: "jujak" } };
export const Hyeonmu: Story = { args: { house: "hyeonmu" } };
