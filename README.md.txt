# 数理格斗 (Math Duel)

一款基于微信小游戏平台的数学对战游戏，采用 Canvas 绘制界面，玩家与 AI 进行限时算术对决。支持自定义头像、名字、难度分级、音效与震动反馈，并可通过分享链接邀请好友挑战。

## 特色
- ⚔️ 玩家 vs AI 实时对战，每人 5 分钟倒计时
- 🔢 加减法题目，根据难度自动调整数值范围
- 🎨 全 Canvas 自绘界面，无需额外图片资源
- 🎵 音效与震动反馈（可选，放入 sounds 文件夹即可生效）
- 📤 分享挑战链接，好友可直接加入对战
- 🏆 本地排行榜，记录历史战绩

## 快速开始
1. 下载并安装[微信开发者工具](https://developers.weixin.qq.com/minigame/dev/devtools/download.html)
2. 注册小游戏 AppID（或使用测试号）
3. 克隆本项目到本地，用开发者工具导入
4. 修改 `project.config.json` 中的 `appid` 字段为你的小游戏 AppID
5. 可选：将音效文件（mp3）放入 `sounds/` 目录（无文件则静音运行）
6. 编译运行，真机调试

## 目录说明
- `game.js` – 游戏主逻辑，包含所有界面绘制、交互、AI、音效等
- `game.json` – 小游戏配置文件
- `project.config.json` – 项目配置（需修改 AppID）
- `sounds/` – 音效文件夹，可替换或清空

## 音效配置
将以下命名的 mp3 文件放入 `sounds/` 文件夹即可启用音效：
- `correct.mp3`  答对
- `wrong.mp3`    答错
- `timeout.mp3`  超时
- `turn.mp3`     回合切换
- `robot.mp3`    机器人回答
- `win.mp3`      胜利

若缺少文件，游戏不会报错，但无声音。

## 开源协议
本项目采用 MIT 协议开源，欢迎 Fork 和二次创作。