# Vercel 部署指南

## 前置要求

1. 确保后端 API 已经部署并可以访问（例如：部署在云服务器、Railway、Render 等）
2. 确保后端已配置正确的 CORS 设置，允许 Vercel 域名访问

## 部署步骤

### 1. 安装 Vercel CLI（可选）

```bash
npm i -g vercel
```

### 2. 在 Vercel 上部署

#### 方法一：通过 Vercel 网站

1. 访问 [vercel.com](https://vercel.com) 并登录
2. 点击 "Add New Project"
3. 导入你的 Git 仓库（GitHub/GitLab/Bitbucket）
4. 配置项目：
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`（如果仓库根目录不是 frontend）
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

#### 方法二：通过 Vercel CLI

```bash
cd frontend
vercel
```

### 3. 配置环境变量

在 Vercel 项目设置中添加环境变量：

- **变量名**: `VITE_API_BASE_URL`
- **变量值**: 你的后端 API 地址（例如：`https://your-backend-api.com`）

**重要**：不要包含末尾的斜杠 `/`

### 4. 配置 CORS（后端）

确保后端 `backend/app/main.py` 中的 CORS 配置包含你的 Vercel 域名：

```python
CORS_ORIGINS = "https://your-app.vercel.app,http://localhost:3000,http://localhost:5173"
```

或者在环境变量中设置：

```bash
CORS_ORIGINS=https://your-app.vercel.app,http://localhost:3000
```

### 5. 重新部署

配置环境变量后，Vercel 会自动触发重新部署。如果没有，可以手动触发：

- 在 Vercel 控制台点击 "Redeploy"
- 或推送新的 commit 到 Git 仓库

## 验证部署

1. 访问你的 Vercel 域名（例如：`https://your-app.vercel.app`）
2. 检查浏览器控制台是否有 CORS 错误
3. 测试主要功能：
   - 库存查询
   - 入库/出库操作
   - MFA 设置页面（`/mfa`）

## 常见问题

### 1. 路由 404 错误

如果访问 `/mfa` 等路由返回 404，确保 `vercel.json` 文件已正确配置。

### 2. CORS 错误

- 检查后端 CORS 配置是否包含 Vercel 域名
- 检查环境变量 `VITE_API_BASE_URL` 是否正确设置
- 确保后端允许来自 Vercel 域名的请求

### 3. API 请求失败

- 检查 `VITE_API_BASE_URL` 环境变量是否正确
- 确保后端 API 可以公网访问
- 检查后端日志查看错误信息

### 4. 构建失败

- 检查 `package.json` 中的构建脚本
- 确保所有依赖都已正确安装
- 查看 Vercel 构建日志获取详细错误信息

## 生产环境建议

1. **使用自定义域名**：在 Vercel 中配置自定义域名
2. **启用 HTTPS**：Vercel 自动提供 HTTPS 证书
3. **监控和日志**：使用 Vercel Analytics 监控应用性能
4. **环境变量管理**：为生产、预览、开发环境分别配置不同的环境变量

## 更新部署

每次推送到 Git 仓库的主分支，Vercel 会自动部署。你也可以：

1. 在 Vercel 控制台手动触发部署
2. 使用 Vercel CLI：`vercel --prod`

