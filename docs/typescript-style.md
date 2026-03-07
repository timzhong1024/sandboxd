# TypeScript Style Guide

这个文件定义 Sandboxd 的 TypeScript 编码规范。目标不是追求“写法自由”，而是让类型系统尽可能早地拦住错误，并让 agent 在局部上下文里也能稳定演进代码。

## 总原则

- 优先让类型表达业务边界，而不是只给实现补注解。
- 优先窄接口、窄输入、窄输出，不要用“大一统基础类型”把不相干的能力硬塞到一起。
- 优先静态约束，不要把本该由 TypeScript 保证的事情留到运行时分支里兜底。
- 优先显式收窄，再调用具体能力；不要把“先传进来再内部猜类型”当作默认设计。

## 数据建模

- 领域模型优先用判别联合（discriminated union）或一组彼此独立的精确类型。
- 如果两个对象的字段语义不同，即使字段名相似，也不要为了“复用”强行提取成一个宽泛 base interface。
- 只有稳定、通用、跨多处共享的字段才允许上提到公共类型；否则保留在具体类型上。
- 不要把不相关的可选字段堆到同一个接口里，再靠 `undefined` 组合出不同形态。

反例：

```ts
interface BaseAction {
  kind: "start" | "stop" | "restart" | "create";
  unitName?: string;
  cpuWeight?: number;
  memoryMax?: string;
}
```

推荐：

```ts
interface StartAction {
  kind: "start";
  unitName: string;
}

interface CreateSandboxServiceAction {
  kind: "create-sandbox-service";
  name: string;
  cpuWeight?: number;
  memoryMax?: string;
}

type Action = StartAction | CreateSandboxServiceAction;
```

## API 设计

- 不要设计“接受一个抽象类型，然后在内部大段 `switch` / `if` 分发所有子类型”的大而全入口，除非这是不可避免的公共边界。
- 如果调用方其实知道自己处理的是哪一种具体类型，就直接暴露精确函数，而不是先升格到宽类型再降回来。
- 同名但语义完全不同的方法，不要强行挂到 base class / base interface 上统一签名。
- 如果必须存在公共入口，公共入口只做路由；真实逻辑应尽快转交给针对具体类型的窄函数。

反例：

```ts
function execute(action: Action) {
  switch (action.kind) {
    case "start":
      return start(action.unitName);
    case "create-sandbox-service":
      return createSandboxService(action.name, action.cpuWeight);
  }
}
```

推荐：

```ts
function startUnit(action: StartAction) {
  return start(action.unitName);
}

function createSandboxService(action: CreateSandboxServiceAction) {
  return create(action.name, action.cpuWeight);
}
```

## 类型收窄

- 编码时优先使用断言函数（assertion functions）或类型守卫（type guards）做显式收窄，再调用具体方法。
- 当输入来自网络、文件系统、systemd、CLI 参数或任意 `unknown` 源时，先做收窄，后做业务逻辑。
- 收窄逻辑要靠近边界层，不要把 `unknown` 或宽类型继续向核心逻辑扩散。
- 收窄失败要直接抛出明确错误，不要悄悄 fallback 成默认值掩盖问题。

推荐：

```ts
function assertSandboxService(entity: ManagedEntity): asserts entity is SandboxServiceEntity {
  if (entity.kind !== "sandbox-service") {
    throw new TypeError(`Expected sandbox-service, got ${entity.kind}`);
  }
}

function restartSandboxService(entity: ManagedEntity) {
  assertSandboxService(entity);
  return restartUnit(entity.unitName);
}
```

## 类与继承

- 默认优先组合而不是继承。
- 不要为了抽象而抽象出 base class，尤其不要在 base class 上挂一组对子类并不真正通用的方法。
- 如果子类型方法名字相同但类型完全不重叠，宁可让它们留在各自具体类型/模块里，也不要为“表面统一”牺牲类型精度。
- 只有当共享状态、共享行为和替换关系都非常明确时，才允许引入继承层次。

## 函数边界

- 参数尽量具体，不要默认接收 `Record<string, unknown>`、`any` 或“万能 options 对象”。
- 返回值尽量稳定，不要返回过宽联合，除非调用方确实需要分支处理。
- 一个函数只做一层抽象的事。若既做解析又做分发又做执行，通常说明边界太宽。
- 优先小函数和具名中间变量，让类型错误能定位到具体步骤。

## 运行时校验

- 对外部输入统一使用解析函数或断言函数，把 `unknown` 收敛成精确领域类型。
- 解析函数的职责是“验证 + 生成精确类型”，不要顺手塞入业务副作用。
- 运行时校验产出的类型应直接被后续代码复用，避免重复写第二套本地猜测逻辑。

## 禁止事项

- 不要新增 `any`，除非有无法避免的第三方边界，并且要把影响范围控制在最外层。
- 不要用类型断言 `as Foo` 去跳过本来应该存在的收窄逻辑。
- 不要通过在 base interface 上添加一堆可选字段来兼容未来场景。
- 不要引入“万能管理器”“万能执行器”“万能工厂”这类只能靠 `switch` 才能工作的抽象。

## 提交前自检

在提交 TypeScript 改动前，至少检查：

- 新增类型是否精确表达了具体业务对象，而不是把多个对象强行揉成一个宽接口。
- 业务函数是否接收了最小必要类型，而不是抽象父类型。
- 外部输入是否已经在边界层完成收窄或断言。
- 是否出现了本可拆分的 `switch` 分发入口。
- `pnpm verify:quick` 和 `pnpm verify` 是否通过。
