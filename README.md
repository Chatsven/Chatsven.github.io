# 澪空 · 个人网站

一个零依赖的静态个人网站，可直接部署到 GitHub Pages。

## 本地预览

```bash
python3 -m http.server 8000
```

打开 <http://localhost:8000>。

## 修改内容

- 个人简介、作品和联系方式：`index.html`
- 颜色、字体与版式：`styles.css`
- 头像与项目预览图：`assets/`
- 阻尼滚动：`script.js`，使用本机打包的 Lenis 1.3.27（MIT）

系统启用“减少动态效果”时，阻尼滚动会自动停用。

## 部署到 GitHub Pages

仓库名称使用 `<用户名>.github.io` 时，站点地址为
`https://<用户名>.github.io/`。

```bash
git init
git add .
git commit -m "Create personal website"
git branch -M main
git remote add origin https://github.com/<用户名>/<用户名>.github.io.git
git push -u origin main
```

推送后在仓库的 **Settings → Pages** 中选择 **Deploy from a branch**，
分支选择 `main`，目录选择 `/ (root)`。
