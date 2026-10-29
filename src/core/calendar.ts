// A fictional compressed scenario, not a real-world holiday or academic calendar.
export const springCampusDay = {
  name: "春日校园开放午后",
  tick: 82,
  location: 4,
  day: 21,
  slot: "午后",
  description: "社团摆出兴趣展示与作品，路过的同学可自主选择参加。",
} as const;

export const isSpringCampusDay = (tick: number) => tick === springCampusDay.tick;
