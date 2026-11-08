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
          aria-label="싸리비 미리보기"
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
  title: "Pages/Library/Broom",
  component: BroomPreview,
  tags: ["autodocs"],
} satisfies Meta<typeof BroomPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Broom: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByLabelText("싸리비 미리보기"),
    ).toBeInTheDocument();
  },
};
