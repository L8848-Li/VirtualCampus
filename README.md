# VirtualCampus · 赛博校园

> 十个独立的小世界，在同一座校园慢慢交织。

校园背景的半上帝模式微型生命模拟器。观察 10 位 NPC 自主生活与关系故事，通过改变环境影响相遇。**v0.4 使用 Vue 3 + TypeScript + Vite，模拟核心独立、规则可解释、无需大模型 API 密钥。**

NPC 会记住一起吃饭的约定、为小组报告安排专注时间，也可能中断、等待或错过。一次简短回应和失约会留下有来源的猜测，后来的解释也可能不被相信。有人会在相处中萌生办兴趣小聚的愿望，自己邀请伙伴、准备材料，也可能最终没能办成。玩家改变机会，角色自己决定。

<img src="docs/images/stories-v04.png" width="390" alt="v0.4 实际运行：兴趣小聚的事实、人物理解和后续牵挂"> <img src="docs/images/campus-v04.png" width="390" alt="v0.4 实际运行：第三天的校园与人物自主行动">

## 本地运行

Node.js 22.12+，建议 Node.js 24 LTS：

```sh
git clone https://github.com/L8848-Li/VirtualCampus.git
cd VirtualCampus
npm ci
npm run dev
```

访问 http://127.0.0.1:8765 。端口被占用时：`npm run dev -- --port 8766`。

构建静态文件：`npm run build`，本机检查构建结果：`npm run preview`。本版需要通过开发服务或静态 HTTP 服务打开，已从双击 HTML 的原型迁移到模块化工程。

## 开始观察

1. 输入种子，新建世界；单步或自动推进七天、每天四时段。
2. 点击角色查看需求、重要记忆和挂在心里的计划；用 ☆ 关注最多三人。
3. 关系图切换 TA 看别人 / 别人看 TA，跟随观察持续高亮一个角色。
4. 重排宿舍、随机分组或举办社团开放日，改变相遇与协作条件。
5. 展开“那些还惦记着的事”，追看饭约、报告和兴趣小聚的完整经过；分清真实发生的事与人物各自的理解。
6. 留意“想和大家做点什么”：谁提出了愿望、谁愿意帮忙、谁最后真的到场。
7. 校园手记归档每日代表片段，重放验证同版本、种子与干预的一致性。

每次推进与干预自动保存到当前浏览器。导出 / 导入带版本和校验的 JSON 可转移或备份。v0.4 使用独立的本机存档键，保留旧版记录，暂不支持跨引擎版本导入。没有账号或云同步。

## 轻量架构

| 层              | 职责                                                     |
| --------------- | -------------------------------------------------------- |
| Vue 组件        | 地图、人物档案、关系图、故事卡、自主活动、共同事务与时间线 |
| 控制层          | 接收操作、播放时钟、导入导出、本机存储，发布普通数据快照 |
| TypeScript 内核 | 世界推进、可解释评分、计划、认知更新、社交、自主活动和因果事件 |
| 开发与测试      | Vite、vue-tsc、Vitest、多种子行为评估                    |

运行时依赖只有 Vue；未引入额外状态库、路由、后端或游戏引擎。内核不导入 Vue、DOM 或系统时钟。

```text
src/App.vue                 页面组合
src/components/             独立界面组件
src/controller/             操作与快照控制层
src/engine.ts               世界推进、事件、记忆、重放和存档
src/core/decision.ts         效用评分
src/core/plans.ts            承诺、等待、中断与兑现
src/core/tasks.ts            小组事务、进度与截止
src/core/social.ts           邀约、回应、关系与解释
src/core/cognition.ts        有来源的猜测、私人原因、当面解释与判断修正
src/core/activities.ts       自主提议、当面邀请、实际筹备和到场结算
src/core/stories.ts          从已发生事件派生故事卡，不修改模拟
src/core/evaluation.ts       多种子行为指标
scripts/evaluate.ts         生成评估报告
tests/                      模拟与行为回归检查
```

## 验证

```sh
npm run check
npm test
npm run evaluate
npm run build
```

当前 135 项测试覆盖 100 个种子的逐时段重放、状态边界、局部信息、计划持续与中断、共同事务、认知来源、解释失败、自主筹备、实际到场、故事聚合与存档恢复。故事卡只读取已提交事件，不把人物猜测归入事实。

`npm run evaluate` 默认检查 100 个种子、28,000 次角色行动，生成 [行为评估报告](docs/reports/behavior-v04.json)。记录行动、约定、报告、认知来源和小活动的结果；完成率与误会数量都不是趣味性的替代指标。CI 在 Node.js 22 / 24 运行类型检查、测试、评估和构建。

[架构与算法](docs/ARCHITECTURE.md) · [运行验收](docs/PROTOTYPE.md) · [v0.4 设计与边界](docs/ITERATION-v04.md) · [迁移记录](docs/MIGRATION.md) · [后续方向](docs/BRAINSTORM-v03.md) · [贡献说明](CONTRIBUTING.md) · [MIT 许可证](LICENSE)
