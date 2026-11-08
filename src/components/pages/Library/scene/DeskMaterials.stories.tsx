import { Suspense, useLayoutEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { LibraryRoom } from "./LibraryRoom";
import { deskLayout, readSceneColors } from "./sceneLayout";
import type { SceneColors } from "./sceneLayout";

function DeskMaterialsPreview({ carpet = false }: { carpet?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [colors, setColors] = useState<SceneColors | null>(null);
  useLayoutEffect(() => {
    if (root.current) setColors(readSceneColors(root.current));
  }, []);
  return (
    <div ref={root} data-theme="library" style={{ height: "100dvh" }}>
      {colors ? (
        <Canvas
          camera={{
            position: carpet ? [1.2, 2.4, 7] : [-1.8, 2.6, 4],
            fov: 40,
          }}
          aria-label="테이블 책과 카펫 질감 미리보기"
        >
          <color attach="background" args={[colors["--color-scene-fog"]]} />
          <ambientLight intensity={1.4} />
          <directionalLight position={[-3, 5, 3]} intensity={1.6} />
          <Suspense fallback={null}>
            <LibraryRoom
              colors={colors}
              desks={Array.from({ length: 32 }, (_, i) =>
                deskLayout(`L${i + 1}`),
              )}
            />
          </Suspense>
          <OrbitControls
            target={carpet ? [0, 0.02, 3.8] : [-3.3, 0.8, 3.1]}
            minDistance={0.4}
            maxDistance={12}
          />
        </Canvas>
      ) : null}
    </div>
  );
}

const meta = {
  title: "Pages/Library/DeskMaterials",
  component: DeskMaterialsPreview,
  args: { carpet: false },
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DeskMaterialsPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const BookAndCarpet: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByLabelText("테이블 책과 카펫 질감 미리보기"),
    ).toBeInTheDocument();
  },
};

export const CarpetDetail: Story = { args: { carpet: true } };
