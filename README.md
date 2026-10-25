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
- 锚点阻尼滚动：`script.js` 中的原生临界阻尼动画
- 首页 WebGL 网格与跟随鼠标的连续水波：`script.js`

一般滚轮与触控保持原生滚动，只对站内锚点跳转启用阻尼缓动。系统启用“减少动态效果”时，锚点阻尼会自动停用。

## 部署到 GitHub Pages

仓库沿用 `<用户名>.github.io` 命名，当前通过 `CNAME` 发布到
<https://mio.cool/>。

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
