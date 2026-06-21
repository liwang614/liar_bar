# 版本控制与开发规范

> 本项目（骗子酒馆猫狗羊）从即日起严格执行以下规范。**任何代码改动都必须经过 Git，且不得直接提交到 `main`。**

## 一、核心原则

1. **一切改动走 Git**：不存在"在工作区改完就算完"。每一次代码/配置/文档变更都要进入版本控制并产生提交。
2. **禁止直接在 `main` 上提交**：`main` 永远是可运行、已验证的稳定分支。所有改动先在独立分支上完成。
3. **小步提交**：一个提交只做一件事，便于回溯与回滚。
4. **先验证再合并**：改动自测通过（类型检查 + 测试）后，才合并回 `main`。
5. **工作树保持干净**：提交后 `git status` 应为 clean；临时文件不入库（见 `.gitignore`）。

## 二、分支命名

| 前缀 | 用途 | 示例 |
|------|------|------|
| `feat/` | 新功能 | `feat/room-list` |
| `fix/` | 修复 bug | `fix/fate-backfire` |
| `refactor/` | 重构（不改行为） | `refactor/game-server` |
| `docs/` | 文档 | `docs/version-control` |
| `test/` | 仅测试 | `test/challenge-cases` |
| `chore/` | 构建/依赖/杂项 | `chore/bump-vite` |

## 三、每次改动的标准流程

```bash
# 1. 切回 main 并同步最新
git checkout main
git pull

# 2. 新建并切到功能分支
git checkout -b feat/xxx

# 3. 改代码……

# 4. 自测（必须全绿）
npm run typecheck
npm test

# 5. 暂存并提交（提交信息见第四节）
git add -A
git commit -m "feat: 简述本次改动"

# 6. 推送分支
git push -u origin feat/xxx

# 7. 合并回 main（二选一）
#    a) 在 GitHub 上开 Pull Request，审查后合并
#    b) 本地合并：git checkout main && git merge --no-ff feat/xxx && git push

# 8. 删除已合并分支
git branch -d feat/xxx
git push origin --delete feat/xxx
```

## 四、提交信息规范

格式：`<type>: <简述>`，正文说明**为什么**改（可选）。

- 类型：`feat` / `fix` / `refactor` / `docs` / `test` / `chore` / `style`
- 简述用祈使句、不超过 50 字。
- 示例：
  - `feat: 首页展示已创建房间，可点击进入`
  - `fix: 翻命运牌恢复标准规则（炸弹只炸对方）`
  - `test: 补充质疑边界用例`

## 五、提交前检查清单

- [ ] `npm run typecheck` 通过（`tsc -b --noEmit`）
- [ ] `npm test` 全部通过（`vitest run`）
- [ ] 本次提交只包含与该改动相关的文件
- [ ] 没有把临时/日志/构建产物（`_*.out`、`_dev.log`、`dist/`、`node_modules/` 等）提交进去
- [ ] 提交信息清晰、类型正确

## 六、不要做的事

- ❌ 直接 `git commit` 到 `main`
- ❌ 一个提交里混入多个不相关改动
- ❌ 提交未通过类型检查/测试的代码到 `main`
- ❌ 用 `git push --force` 覆盖共享分支（`main` / 他人分支）
- ❌ 把密钥、临时文件、构建产物入库
