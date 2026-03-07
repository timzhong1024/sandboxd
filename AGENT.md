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

仓库已经初始化为 `pnpm` monorepo，当前主要工作区：

- `packages/core`: 共享领域类型和基础工具
- `packages/control-plane`: 共享 ports、adapters、use-cases 和装配函数
- `apps/server`: Node.js 入口与 transport host
- `apps/web`: React + Vite WebUI
- `apps/cli`: `sandboxctl`
- `apps/mcp`: MCP tool/server 定义

已经打通的最小链路：

- `packages/core` 导出 `ManagedEntitySummary`、`ManagedEntityDetail`、`CreateSandboxServiceInput` 等共享契约
- `packages/control-plane` 提供真实可复用的 metadata/runtime adapter 与业务编排
- `apps/server` 提供：
  - `GET /healthz`
  - `GET /api/entities`
  - `GET /api/entities/:unitName`
  - `POST /api/entities/:unitName/start`
  - `POST /api/entities/:unitName/stop`
  - `POST /api/entities/:unitName/restart`
  - `POST /api/sandbox-services`
  - `POST /mcp`
- `apps/web` 已经完成列表、详情、动作、创建的单页工作台
- `apps/cli` 已经直接依赖 `packages/control-plane` 提供本地 `sandboxctl`
- `apps/mcp` 已经定义 V1 MCP tools，并由 `apps/server` 挂载

不要再把 `apps/server/src/*` 当成复用层。后端共享能力已经移动到 `packages/control-plane`。

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

当前 runtime-systemd 演进默认决策：

- 不把“迁移到 `dbus-next`”本身当成目标；优先稳定 runtime port 边界
- 短期保留 `systemctl list-units` 做 inventory
- `inspect` 优先向 `systemctl show` 的结构化属性读取收敛
- `start` / `stop` / `restart` 继续允许走 `systemctl`
- 后续如果做 D-Bus spike，先只覆盖 `getUnit()`，不要一开始全面替换全部 runtime
- 如果未来引入 `dbus-next`，把它放在 `SystemdRuntimePort` 后面作为一个可切换 adapter，而不是把 D-Bus 细节扩散到 use-case / web / core

## 当前分层约束

为了提高 agent 并行开发效率，当前代码默认遵守以下分层：

- `packages/core`
  - 只放 domain model、纯映射、纯解析、纯校验
  - 不放 fixture、环境变量读取、HTTP、`systemctl` 调用、文件系统读写
- `packages/control-plane`
  - 放 ports、runtime adapters、metadata adapters、use-cases、application wiring
  - 这是 server / mcp / 后续入口的唯一后端复用层
- `apps/server/src/transport`
  - 只负责 HTTP 输入输出和 `/mcp` transport host
- `apps/cli/src`
  - 只负责命令解析、文本输出和本地 control-plane 装配
- `apps/mcp/src`
  - 只负责 MCP tool 定义和 server 构造
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

- `transport` 可以依赖 `packages/control-plane`，不能自己再实现业务逻辑
- `apps/mcp` 可以依赖 `packages/control-plane` 和 `core`，不能依赖 `apps/server/src/*`
- `apps/cli` 直接依赖 `packages/control-plane`，不依赖 `apps/server`
- `packages/control-plane` 可以依赖 `core`
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

1. 继续收紧 `packages/control-plane` 的边界，不要让后端逻辑回流进 `apps/server`。
2. 用真实 metadata 进一步替换 `kind` / `origin` 的启发式识别。
3. 保持 `/mcp` 无状态；不要引入 stateful streamable HTTP，后续只补必要的 observability。
4. 继续完善 CLI/MCP 的错误语义和使用体验。
5. 最后再考虑 `runtime-systemd` 单独拆包。

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
