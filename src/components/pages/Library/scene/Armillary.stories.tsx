import { Suspense, useLayoutEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Armillary } from "./Armillary";
import { readSceneColors } from "./sceneLayout";
import type { SceneColors } from "./sceneLayout";

function ArmillaryPreview() {
  const root = useRef<HTMLDivElement>(null);
  const [colors, setColors] = useState<SceneColors | null>(null);
  useLayoutEffect(() => {
    if (root.current) setColors(readSceneColors(root.current));
  }, []);
  return (
    <div ref={root} data-theme="library" style={{ height: "100dvh" }}>
      {colors ? (
        <Canvas
          camera={{ position: [8.4, 2.7, -25.4], fov: 40 }}
          aria-label="혼천의 질감 미리보기"
        >
          <color attach="background" args={[colors["--color-scene-fog"]]} />
          <ambientLight intensity={1.4} />
          <directionalLight position={[-3, 5, 3]} intensity={1.6} />
          <Suspense fallback={null}>
            <Armillary colors={colors} />
          </Suspense>
          <OrbitControls
            target={[6.2, 1.45, -28.6]}
            minDistance={0.4}
            maxDistance={12}
          />
        </Canvas>
      ) : null}
    </div>
  );
}

const meta = {
  title: "Pages/Library/Armillary",
  component: ArmillaryPreview,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ArmillaryPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AntiqueInstrument: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByLabelText("혼천의 질감 미리보기"),
    ).toBeInTheDocument();
  },
};
