# Sticker CLI

AI Agent 表情包搜索与管理工具

## 功能

- 🔍 **搜索表情包** - 按关键词搜索本地收藏的表情
- 📁 **系列管理** - 按系列/文件夹组织表情包
- 🏷️ **标签系统** - 为表情打标签，方便分类
- 💾 **缓存下载** - 从 URL 下载并缓存新表情
- 🎲 **随机表情** - 随机返回一个表情

## 安装

```bash
npm install -g sticker-cli
```

## 使用

### 搜索表情包
```bash
sticker search 开心
sticker search 生气 --limit 5
```

### 列出系列
```bash
sticker series
```

### 列出表情
```bash
sticker list                    # 列出所有
sticker list 猥琐可爱萌          # 列出指定系列
```

### 获取表情路径（用于 IM 发送）
```bash
sticker path 猥琐可爱萌/01-得意星星.jpg
```

### 缓存新表情
```bash
sticker cache https://example.com/meme.gif --series 新系列 --name 新表情
sticker cache ./local-image.png --series 猥琐可爱萌 --name 新表情
```

### 随机表情
```bash
sticker random
sticker random 猥琐可爱萌
```

## 目录结构

```
~/.sticker-cli/
├── stickers/           # 表情文件
│   └── 猥琐可爱萌/
│       ├── 01-得意星星.jpg
│       ├── 02-呆萌发芽.jpg
│       └── ...
├── index.json          # 索引文件
└── config.json         # 配置文件（API keys）
```

## 集成 IM 工具

本 CLI 只负责搜索和返回路径，IM 发送由上层处理：

```javascript
const { search, getPath } = require('sticker-cli');

// 搜索表情
const results = await search('开心');

// 获取路径发送
const path = await getPath('猥琐可爱萌/01-得意星星.jpg');
// 然后使用 IM 工具的 API 发送图片
```

## 默认收录系列

- **猥琐可爱萌** - 乖巧宝宝系列，包含得意、呆萌、害羞、愤怒等 8 个表情

## License

MIT