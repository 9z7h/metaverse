import { Suspense, useLayoutEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { expect, within } from "@storybook/test";
import { BroomModel } from "./Broom";
import { readSceneColors } from "../sceneLayout";
import type { SceneColors } from "../sceneLayout";

function BroomPreview() {
  const root = useRef<HTMLDivElement>(null);
  const [colors, setColors] = useState<SceneColors | null>(null);
  useLayoutEffect(() => {
    if (root.current) setColors(readSceneColors(root.current));
  }, []);
  return (
    <div ref={root} data-theme="library" style={{ height: "100dvh" }}>
      {colors && (
        <Canvas
          camera={{ position: [2, 1.6, 2.5], fov: 40 }}
          aria-label="전통 구름 탈것 미리보기"
        >
          <color attach="background" args={[colors["--color-scene-fog"]]} />
          <ambientLight intensity={1.4} />
          <directionalLight position={[2, 4, 3]} intensity={1.5} />
          <Suspense fallback={null}>
            <BroomModel colors={colors} />
          </Suspense>
          <OrbitControls />
        </Canvas>
      )}
    </div>
  );
}
const meta = {
  title: "Pages/Garden/Cloud Ride",
  component: BroomPreview,
  tags: ["autodocs"],
} satisfies Meta<typeof BroomPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const KoreanCloudRide: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByLabelText("전통 구름 탈것 미리보기"),
    ).toBeInTheDocument();
  },
};
