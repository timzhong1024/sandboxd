# AGENT.md

这个文件是给未来继续在本仓库工作的 agent 的短期记忆，不是产品宣传文案。上下文变长或中断后，优先先读这个文件，再看 `README.md`。

TypeScript 编码规范单独写在 [docs/typescript-style.md](/Users/timzhong/systemd-homelab/docs/typescript-style.md)。做 TS 改动前，先按那份规范判断当前建模是不是足够窄、足够精确。

## 项目目标

Sandboxd 是一个 systemd-first 的 homelab sandbox manager。

核心原则：

- 所有受管对象最终都映射为 systemd unit。
- WebUI、CLI、MCP 只是同一控制面的不同入口，不要各自发明一套模型。
- 当前重点不是“支持尽可能多的 runtime”，而是先把 systemd unit inventory 和 Sandboxd 托管对象的统一视图做扎实。

产品定位接近 Portainer / Proxmox，但实现哲学不同：

- 不围绕 OCI / hypervisor 自建平台抽象。
- 不隐藏宿主机，而是直接拥抱 systemd、cgroup v2、unit file、D-Bus。
- 面向单机、单管理员，不做多用户、RBAC、集群、企业审计。

## 当前代码状态

仓库已经初始化为 `pnpm` monorepo，现有 3 个包：

- `apps/web`: React + Vite WebUI 骨架
- `apps/server`: Node.js 控制面骨架
- `packages/core`: 共享领域类型和基础工具

已经打通的最小链路：

- `packages/core` 导出 `ManagedEntitySummary`、`ManagedEntityDetail`、`CreateSandboxServiceInput` 等共享契约
- `apps/server` 提供：
  - `GET /healthz`
  - `GET /api/entities`
  - `GET /api/entities/:unitName`
  - `POST /api/entities/:unitName/start`
  - `POST /api/entities/:unitName/stop`
  - `POST /api/entities/:unitName/restart`
  - `POST /api/sandbox-services`
- `apps/web` 已经对齐同一套 client port，但 UI 目前主要消费列表接口

当前这些都是骨架，不是功能完成态。不要误以为 server 已经接入真实 systemd。

项目还处在非常早期阶段，默认不要把“兼容旧设计 / 兼容旧接口 / 平滑迁移”当成目标。只要能让当前架构、模型和实现明显变得更对，允许直接做破坏性调整，并同步更新调用点、测试和文档。

当前阶段的默认决策原则：

- 不需要为尚未稳定的接口保留兼容层、过渡分支、弃用周期。
- 不需要为了假想的外部用户或未来版本负担向后兼容。
- 可以直接重命名、删字段、改 API、调分层，只要改动后的方向更清晰。
- 优先消除错误抽象和早期坏结构，不要为了“改动小一点”保留已经看出会妨碍后续演进的设计。

当前 inventory 策略：

- 优先尝试读取真实 systemd unit inventory
- 如果运行环境不是 Linux，或者 `systemctl` 不可用，则自动退回 fixture inventory
- 不要为了让本机开发通过而去删除这层降级；它是当前跨平台开发的必要支撑

## 当前分层约束

为了提高 agent 并行开发效率，当前代码默认遵守以下分层：

- `packages/core`
  - 只放 domain model、纯映射、纯解析、纯校验
  - 不放 fixture、环境变量读取、HTTP、`systemctl` 调用、文件系统读写
- `apps/server/src/ports`
  - 只定义 server 内部 use-case 依赖的最小接口
- `apps/server/src/adapters`
  - `systemd/*` 只负责访问 runtime
  - `metadata/*` 只负责 fixture / fallback 或未来 metadata source
- `apps/server/src/use-cases`
  - 只负责编排业务步骤，不直接做 HTTP，也不直接暴露 `spawn` 细节
- `apps/server/src/transport`
  - 只负责 HTTP 输入输出
- `apps/web/src/ports`
  - 只定义前端 use-case 依赖的 client 接口
- `apps/web/src/transport`
  - 只负责 API 请求与 payload 解析
- `apps/web/src/use-cases`
  - 只负责前端业务动作编排
- `apps/web/src/view-model`
  - 只负责 React 状态组织
- `apps/web/src/ui`
  - 只负责渲染

依赖方向约束：

- `transport` 可以依赖 `use-cases` / `ports`，不能直接依赖另一端 adapter 的内部细节
- `use-cases` 可以依赖 `ports` 和 `core`，不能直接 import 不相关 transport
- `adapters` 可以依赖 `ports` 和 `core`
- `core` 不能依赖 `server` 或 `web`

如果一个改动同时需要碰 `transport + adapter + domain` 三层以上，先停下来检查是不是边界又被写混了。

## 统一模型

当前统一实体模型已经拆成 3 组契约：

- `ManagedEntitySummary`
- `ManagedEntityDetail`
- `CreateSandboxServiceInput`

其中：

- `summary` 用于列表和概览
- `detail` 用于 inspect、action 返回值和创建结果
- `create input` 用于创建 sandboxed service

`summary` 至少包含：

- `kind`
- `origin`
- `unitName`
- `unitType`
- `state`
- `subState`
- `loadState`
- `slice`
- `description`
- `sandboxProfile`
- `labels`
- `capabilities`

`detail` 在 `summary` 基础上补充：

- `resourceControls`
- `sandboxing`
- `status`

`kind` 取值固定为：

- `systemd-unit`
- `sandbox-service`
- `container`
- `vm`

V1 真正实现的只有前两类。`container` 和 `vm` 现在只是保留枚举，不要假装已经支持。

## 当前技术约束

- 包管理器固定为 `pnpm`
- 工程工具固定为 `Vite + Vitest + oxfmt + oxlint + TypeScript`
- 不要引入 ESLint / Prettier / Turbo / Nx，除非用户明确要求
- 项目整体采用 ESM
- `web` 用 Vite
- `server` 和 `core` 也走 Vite family，不要默认切回另一套构建体系
- TypeScript 默认优先精确类型、显式收窄、窄接口；不要写宽 base type 后在内部靠 switch / if 分发所有子类型
- 不要为了“统一风格”把语义不重叠的方法硬挂到 base class / base interface 上
- 不要把向后兼容当作默认约束；这个阶段优先选择更干净的破坏性演进

如果后续要接入更底层的 systemd / qemu / nspawn 能力，优先通过 `runtime-systemd` 边界演进，不要把 systemd 细节散落进 WebUI。

## 明确不该做的事

- 不要把这个项目带偏成 Kubernetes / PaaS / Docker 面板克隆
- 不要为了“未来可能需要”提前引入数据库、鉴权系统、多租户模型
- 不要为 container / VM 单独造第二套对象模型
- 不要跳过 systemd 直接围绕 shell 脚本堆控制逻辑

## 下一步优先级

后续开发默认按这个顺序推进：

1. 把 `server` 的 read path 全量接到真实 systemd inventory 和 unit detail。
2. 用真实 metadata 替换当前 `kind` / `origin` 的启发式识别。
3. 把 `start` / `stop` / `restart` / `create sandboxed service` 从 fixture placeholder 推进到真实 systemd 写路径。
4. 在 `web` 中补齐 inspect、action、create flow，而不只是列表页。
5. 最后才考虑 `cli`、`mcp`、`runtime-systemd` 拆成独立包。

## 工作方式

做实现前先检查：

- `README.md` 里的产品承诺是否会被这次改动破坏
- 当前改动是否还在 Phase 1 范围内
- 是否把“systemd-first”变成了“shell-first”

做实现后至少验证：

- `pnpm exec playwright install chromium`（首次本机运行 Playwright 时）
- `pnpm verify:quick`
- `pnpm smoke:dev`
- `pnpm verify`
- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `pnpm test`

如果需要扩展架构，先更新这个文件和 `README.md`，再继续写代码。
