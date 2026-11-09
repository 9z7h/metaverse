import { useLayoutEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Avatar } from "./Avatar";
import type { AvatarPose } from "./Avatar";
import { readSceneColors } from "./sceneLayout";
import type { SceneColors } from "./sceneLayout";
import { HOUSE_IDS, HOUSES, houseToken } from "../houses";
import type { HouseId } from "../houses";

function AvatarPreview({
  house = "baekho",
  pose = "stand",
  practicing = false,
  closeUp = false,
}: {
  house?: HouseId;
  pose?: AvatarPose;
  practicing?: boolean;
  closeUp?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [colors, setColors] = useState<SceneColors | null>(null);
  useLayoutEffect(() => {
    if (root.current) setColors(readSceneColors(root.current));
  }, []);
  return (
    <div
      ref={root}
      data-theme="library"
      style={{ height: "100dvh", minHeight: "calc(var(--spacing-64) * 10)" }}
    >
      {colors ? (
        <Canvas
          camera={{
            position: closeUp ? [0.5, 1.4, 1.4] : [1.5, 1.45, 3.2],
            fov: 35,
          }}
          aria-label="수련생 의상 미리보기"
        >
          <color attach="background" args={[colors["--color-scene-fog"]]} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[3, 5, 4]} intensity={2} />
          <directionalLight
            position={[-3, 2, -2]}
            intensity={1}
            color={colors["--color-scene-moonlight"]}
          />
          <Avatar
            house={house}
            robe={colors[houseToken(house, "primary")]}
            band={colors[houseToken(house, "accent")]}
            collar={colors["--color-scene-collar"]}
            skin={colors["--color-scene-skin"]}
            hat={colors["--color-scene-hat"]}
            pose={pose}
            name={HOUSES[house].name}
            showLabel={false}
            focusing={pose === "sit"}
            practicing={practicing}
            wand={{
              wood: colors["--color-scene-wood-dark"],
              glow: colors[houseToken(house, "accent")],
            }}
          />
          <OrbitControls
            target={closeUp ? [0, 1.35, 0] : [0, 0.85, 0]}
            minDistance={closeUp ? 0.7 : 2}
            maxDistance={5}
          />
        </Canvas>
      ) : null}
    </div>
  );
}

const meta = {
  title: "Pages/Library/Avatar",
  component: AvatarPreview,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  argTypes: {
    house: { control: "select", options: HOUSE_IDS },
    pose: { control: "select", options: ["stand", "walk", "run", "sit"] },
  },
  args: { house: "baekho", pose: "stand", practicing: false },
} satisfies Meta<typeof AvatarPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Baekho: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByLabelText("수련생 의상 미리보기"),
    ).toBeInTheDocument();
  },
};
export const Jujak: Story = { args: { house: "jujak" } };
export const Hyeonmu: Story = { args: { house: "hyeonmu" } };
export const Cheongryong: Story = { args: { house: "cheongryong" } };
export const Walking: Story = { args: { pose: "walk" } };
export const Running: Story = { args: { pose: "run" } };
export const Studying: Story = { args: { pose: "sit" } };
export const Practicing: Story = { args: { pose: "sit", practicing: true } };

export const FaceDetail: Story = { args: { closeUp: true } };
