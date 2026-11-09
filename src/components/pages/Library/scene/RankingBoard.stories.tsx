import { Suspense, useLayoutEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { RankingBoard } from "./RankingBoard";
import { readSceneColors, BOARD_CENTER_X, BOARD_STAND_Z } from "./sceneLayout";
import type { SceneColors } from "./sceneLayout";
import { rankHouses } from "../houseRankingLogic";
import { HOUSE_IDS } from "../houses";
import type { HouseId } from "../houses";

function RankingPreview({
  myHouse = "cheongryong",
  scenario = "normal",
}: {
  myHouse?: HouseId;
  scenario?: "normal" | "tied" | "empty";
}) {
  const root = useRef<HTMLDivElement>(null);
  const [colors, setColors] = useState<SceneColors | null>(null);
  useLayoutEffect(() => {
    if (root.current) setColors(readSceneColors(root.current));
  }, []);
  const ranking = rankHouses(
    scenario === "empty"
      ? { baekho: 0, jujak: 0, hyeonmu: 0, cheongryong: 0 }
      : scenario === "tied"
        ? { baekho: 3720, jujak: 3720, hyeonmu: 120, cheongryong: 120 }
        : { baekho: 3000, jujak: 2280, hyeonmu: 4020, cheongryong: 5940 },
  );
  return (
    <div ref={root} data-theme="library" style={{ height: "100dvh" }}>
      {colors ? (
        <Canvas
          camera={{ position: [BOARD_CENTER_X + 0.4, 3.5, BOARD_STAND_Z - 7.3], fov: 35 }}
          aria-label="오늘의 사신제 순위판 미리보기"
        >
          <color attach="background" args={[colors["--color-scene-fog"]]} />
          <Suspense fallback={null}>
            <RankingBoard colors={colors} ranking={ranking} myHouse={myHouse} />
          </Suspense>
          <OrbitControls
            target={[BOARD_CENTER_X, 3.2, BOARD_STAND_Z]}
            minDistance={3}
            maxDistance={14}
          />
        </Canvas>
      ) : null}
    </div>
  );
}
const meta = {
  title: "Pages/Library/RankingBoard",
  component: RankingPreview,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { myHouse: "cheongryong", scenario: "normal" },
  argTypes: {
    myHouse: { control: "select", options: HOUSE_IDS },
    scenario: { control: "select", options: ["normal", "tied", "empty"] },
  },
} satisfies Meta<typeof RankingPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const DailyTraining: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByLabelText("오늘의 사신제 순위판 미리보기"),
    ).toBeInTheDocument();
  },
};
export const Tied: Story = { args: { scenario: "tied" } };
export const Empty: Story = { args: { scenario: "empty" } };
