import { Suspense, useLayoutEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { HanokDoor } from "./HanokDoor";
import { readSceneColors } from "./sceneLayout";
import type { SceneColors } from "./sceneLayout";

function HanokDoorPreview({ warmInside = false }: { warmInside?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [colors, setColors] = useState<SceneColors | null>(null);
  useLayoutEffect(() => {
    if (root.current) setColors(readSceneColors(root.current));
  }, []);
  return (
    <div ref={root} data-theme="library" style={{ height: "100dvh" }}>
      {colors ? (
        <Canvas
          camera={{ position: [2, 1.9, 4.4], fov: 40 }}
          aria-label="한옥 문 질감 미리보기"
        >
          <color attach="background" args={[colors["--color-scene-fog"]]} />
          <ambientLight intensity={1.4} />
          <directionalLight position={[-3, 5, 3]} intensity={1.6} />
          <Suspense fallback={null}>
            <HanokDoor colors={colors} warmInside={warmInside} />
          </Suspense>
          <OrbitControls
            target={[0, 1.45, 0]}
            minDistance={0.4}
            maxDistance={12}
          />
        </Canvas>
      ) : null}
    </div>
  );
}

const meta = {
  title: "Pages/Library/HanokDoor",
  component: HanokDoorPreview,
  args: { warmInside: false },
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof HanokDoorPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const LibraryDoor: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByLabelText("한옥 문 질감 미리보기"),
    ).toBeInTheDocument();
  },
};

export const WarmDoor: Story = { args: { warmInside: true } };
