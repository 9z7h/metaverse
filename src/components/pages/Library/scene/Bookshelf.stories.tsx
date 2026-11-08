import { Suspense, useLayoutEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { LibraryRoom } from "./LibraryRoom";
import { readSceneColors } from "./sceneLayout";
import type { SceneColors } from "./sceneLayout";

function BookshelfPreview() {
  const root = useRef<HTMLDivElement>(null);
  const [colors, setColors] = useState<SceneColors | null>(null);
  useLayoutEffect(() => {
    if (root.current) setColors(readSceneColors(root.current));
  }, []);
  return (
    <div ref={root} data-theme="library" style={{ height: "100dvh" }}>
      {colors ? (
        <Canvas
          camera={{ position: [-6.3, 1.7, 2], fov: 40 }}
          aria-label="고서 책장 질감 미리보기"
        >
          <color attach="background" args={[colors["--color-scene-fog"]]} />
          <ambientLight intensity={1.4} />
          <directionalLight position={[-3, 5, 3]} intensity={1.6} />
          <Suspense fallback={null}>
            <LibraryRoom colors={colors} desks={[]} />
          </Suspense>
          <OrbitControls
            target={[-8.2, 1.5, 0]}
            minDistance={0.4}
            maxDistance={12}
          />
        </Canvas>
      ) : null}
    </div>
  );
}

const meta = {
  title: "Pages/Library/Bookshelf",
  component: BookshelfPreview,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof BookshelfPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AntiqueBooks: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByLabelText("고서 책장 질감 미리보기"),
    ).toBeInTheDocument();
  },
};
