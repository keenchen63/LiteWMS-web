# 前端应用文档

## 快速开始

1. 安装依赖：`npm install`
2. 配置环境变量（可选）：复制 `.env.example` 为 `.env`
3. 启动开发服务器：`npm run dev`

## 项目结构

```
src/
├── components/        # React 组件
│   ├── Layout.tsx              # 布局组件
│   ├── InventoryTable.tsx      # 库存表格
│   ├── CategoryManager.tsx     # 品类管理和入库管理
│   ├── OutboundPage.tsx        # 出库管理
│   ├── WarehouseManager.tsx   # 仓库管理和调拨
│   ├── MFAPage.tsx            # MFA 设置页面
│   ├── MFADialog.tsx          # MFA 验证对话框
│   └── Dialog.tsx              # 通用对话框
├── contexts/          # React Context
│   └── WarehouseContext.tsx   # 仓库上下文
├── hooks/             # React Hooks
│   └── useMFA.ts              # MFA 验证 Hook
├── services/          # API 服务
│   └── api.ts                 # API 调用封装
├── types.ts           # TypeScript 类型定义
├── App.tsx            # 主应用组件
└── index.tsx          # 入口文件
```

## 环境变量

- `VITE_API_BASE_URL` - 后端 API 基础 URL（默认：http://localhost:8000）

## 主要功能

### 路由配置

- `/` - 库存查询页面
- `/categories` - 品类管理和入库管理
- `/outbound` - 出库管理
- `/warehouses` - 仓库管理和库存调拨
- `/mfa` - MFA 设置页面（管理员专用）

### MFA 功能

#### MFA 设置页面 (`/mfa`)

管理员通过访问 `/mfa` 路径进入 MFA 设置页面，功能包括：

1. **首次设置**
   - 首次访问时设置管理员密码
   - 设置完成后可进行后续操作

2. **MFA 设备管理**
   - 添加新的 MFA 设备
   - 查看已配置的设备列表
   - 删除设备
   - 支持多个设备，任意一个验证通过即可

3. **密码管理**
   - 修改管理员密码
   - 需要先通过 MFA 验证

#### MFA 验证集成

**需要 MFA 验证的操作**：
- ✅ 入库操作
- ✅ 库存调拨
- ✅ 品类管理（创建、更新、删除）
- ✅ 仓库设置（添加、更新、删除）
- ✅ 库存调整

**不需要 MFA 验证的操作**：
- ❌ 出库操作
- ❌ 查询操作（库存查询、历史记录）

#### 使用方式

在需要 MFA 验证的组件中：

```typescript
import { useMFA } from '../hooks/useMFA';
import { MFADialog } from '../components/MFADialog';

const MyComponent = () => {
  const { requireMFA, showMFADialog, handleMFAVerify, handleMFACancel } = useMFA();

  const handleSubmit = async () => {
    // 执行操作前进行 MFA 验证
    const verified = await requireMFA();
    if (!verified) {
      return; // 用户取消了验证
    }

    // 继续执行操作...
  };

  return (
    <>
      {/* MFA 对话框 */}
      <MFADialog
        show={showMFADialog}
        onVerify={handleMFAVerify}
        onCancel={handleMFACancel}
        title="MFA 验证"
        message="请输入您的验证码以完成操作"
      />
      {/* 其他内容 */}
    </>
  );
};
```

### 组件说明

#### `useMFA` Hook

封装了 MFA 验证逻辑的 React Hook：

- `requireMFA()` - 触发 MFA 验证，返回 Promise<boolean>
- `showMFADialog` - 对话框显示状态
- `handleMFAVerify(code)` - 验证验证码
- `handleMFACancel()` - 取消验证

#### `MFADialog` 组件

统一的 MFA 验证对话框组件：

- 自动聚焦输入框
- 6 位数字验证码输入
- 实时验证反馈
- 错误提示和重试机制

#### `MFAPage` 组件

MFA 设置和管理页面：

- 登录界面
- 密码设置/修改
- MFA 设备管理
- 设备添加流程（二维码、密钥显示）

### UI/UX 特性

#### 统一的交互体验

入库、出库、调拨三个功能采用统一的交互方式：

1. **左侧列表**：简洁的物品列表，只显示基本信息
2. **点击展开**：点击物品后显示数量输入框和添加按钮
3. **右侧已选**：显示已选择的物品列表，可调整数量或移除
4. **两步流程**：第一步选择物品，第二步填写信息

#### 响应式设计

- 支持桌面和移动设备
- 使用 Tailwind CSS 实现响应式布局
- 优化的触摸交互体验

## 构建

```bash
npm run build
```

构建产物在 `dist/` 目录。

## 预览

```bash
npm run preview
```

## 开发注意事项

### 路由配置

项目使用 `BrowserRouter`，需要配置服务器支持：

**Vite 开发服务器**：
- 已在 `vite.config.ts` 中配置 `historyApiFallback: true`

**生产环境（Nginx）**：
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### MFA Token 管理

- JWT token 存储在 `localStorage` 中
- Token 过期后需要重新登录
- 建议在生产环境中使用 HTTPS 保护 token 传输

### 状态管理

- 使用 React Context 管理仓库状态
- 使用自定义 Hook 封装业务逻辑
- 组件内部状态管理使用 React Hooks

