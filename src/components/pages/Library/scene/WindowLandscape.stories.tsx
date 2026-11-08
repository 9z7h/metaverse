import { Suspense, useLayoutEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Atmosphere } from "./Atmosphere";
import { LibraryRoom } from "./LibraryRoom";
import { readSceneColors } from "./sceneLayout";
import type { SceneColors } from "./sceneLayout";

function WindowLandscapePreview() {
  const root = useRef<HTMLDivElement>(null);
  const [colors, setColors] = useState<SceneColors | null>(null);
  useLayoutEffect(() => {
    if (root.current) setColors(readSceneColors(root.current));
  }, []);
  return (
    <div ref={root} data-theme="library" style={{ height: "100dvh" }}>
      {colors ? (
        <Canvas
          camera={{ position: [1.4, 4.4, -23.5], fov: 40 }}
          aria-label="창밖 산과 숲 미리보기"
        >
          <color attach="background" args={[colors["--color-scene-fog"]]} />
          <ambientLight intensity={1.4} />
          <directionalLight position={[-3, 5, 3]} intensity={1.6} />
          <Suspense fallback={null}>
            <LibraryRoom colors={colors} desks={[]} />
            <Atmosphere colors={colors} />
          </Suspense>
          <OrbitControls
            target={[0, 5.2, -30.6]}
            minDistance={0.4}
            maxDistance={12}
          />
        </Canvas>
      ) : null}
    </div>
  );
}

const meta = {
  title: "Pages/Library/WindowLandscape",
  component: WindowLandscapePreview,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WindowLandscapePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MoonlitValley: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByLabelText("창밖 산과 숲 미리보기"),
    ).toBeInTheDocument();
  },
};
