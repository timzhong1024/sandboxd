# AGENT.md

这个文件是给未来继续在本仓库工作的 agent 的短期记忆，不是产品宣传文案。上下文变长或中断后，优先先读这个文件，再看 `README.md`。

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

- `packages/core` 导出 `ManagedEntity`、`ManagedEntityKind`、`ManagedEntityOrigin`、`isSandboxdManaged`
- `apps/server` 提供：
  - `GET /healthz`
  - `GET /api/entities`
- `apps/web` 会拉取 `/api/entities` 并渲染 entity 列表

当前这些都是骨架，不是功能完成态。不要误以为 server 已经接入真实 systemd。

## 统一模型

当前统一实体模型是 `ManagedEntity`，字段保持和 README 一致：

- `kind`
- `origin`
- `unitName`
- `unitType`
- `state`
- `slice`
- `labels`
- `sandboxProfile`

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

如果后续要接入更底层的 systemd / qemu / nspawn 能力，优先通过 `runtime-systemd` 边界演进，不要把 systemd 细节散落进 WebUI。

## 明确不该做的事

- 不要把这个项目带偏成 Kubernetes / PaaS / Docker 面板克隆
- 不要为了“未来可能需要”提前引入数据库、鉴权系统、多租户模型
- 不要为 container / VM 单独造第二套对象模型
- 不要跳过 systemd 直接围绕 shell 脚本堆控制逻辑

## 下一步优先级

后续开发默认按这个顺序推进：

1. 把 `server` 的 `/api/entities` 从硬编码示例替换成真实的 systemd unit inventory。
2. 在 `core` 中沉淀 unit -> `ManagedEntity` 的映射逻辑，而不是让 server/web 各自处理。
3. 在 `web` 中完成基础 inventory 页面：列表、状态、类型、`external` / `sandboxd-managed` 标签。
4. 再往前推进 Sandboxd 托管 service 的创建与更新能力。
5. 最后才考虑 `cli`、`mcp`、`runtime-systemd` 拆成独立包。

## 工作方式

做实现前先检查：

- `README.md` 里的产品承诺是否会被这次改动破坏
- 当前改动是否还在 Phase 1 范围内
- 是否把“systemd-first”变成了“shell-first”

做实现后至少验证：

- `pnpm exec playwright install chromium`（首次本机运行 Playwright 时）
- `pnpm verify`
- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `pnpm test`

如果需要扩展架构，先更新这个文件和 `README.md`，再继续写代码。
