#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');
const ora = require('ora');

const program = new Command();
const STICKER_DIR = path.join(require('os').homedir(), '.sticker-cli', 'stickers');
const INDEX_FILE = path.join(require('os').homedir(), '.sticker-cli', 'index.json');

// 初始化索引
function initIndex() {
  if (!fs.existsSync(INDEX_FILE)) {
    const initialIndex = {
      version: '1.0.0',
      stickers: [],
      series: {}
    };
    fs.writeFileSync(INDEX_FILE, JSON.stringify(initialIndex, null, 2));
  }
}

// 读取索引
function readIndex() {
  initIndex();
  return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
}

// 保存索引
function saveIndex(index) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}

// 扫描贴纸目录
function scanStickers() {
  const index = readIndex();
  
  if (!fs.existsSync(STICKER_DIR)) {
    fs.mkdirSync(STICKER_DIR, { recursive: true });
    return [];
  }
  
  const series = fs.readdirSync(STICKER_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  index.series = {};
  
  series.forEach(serieName => {
    const seriePath = path.join(STICKER_DIR, serieName);
    const files = fs.readdirSync(seriePath)
      .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
      .map(f => {
        const fullPath = path.join(seriePath, f);
        const stats = fs.statSync(fullPath);
        const id = `${serieName}/${f}`;
        
        // 保留已有标签
        const existing = index.stickers.find(s => s.id === id);
        
        return {
          id: id,
          name: path.basename(f, path.extname(f)).replace(/^\d+-/, ''),
          series: serieName,
          path: fullPath,
          relativePath: `${serieName}/${f}`,
          size: stats.size,
          modified: stats.mtime,
          tags: existing ? existing.tags : []
        };
      });
    
    index.series[serieName] = files;
  });
  
  // 合并所有贴纸
  index.stickers = Object.values(index.series).flat();
  
  saveIndex(index);
  return index.stickers;
}

// 搜索贴纸
function searchStickers(keyword, options = {}) {
  const stickers = scanStickers();
  const lowerKeyword = keyword.toLowerCase();
  
  return stickers.filter(s => {
    const matchName = s.name.toLowerCase().includes(lowerKeyword);
    const matchSeries = s.series.toLowerCase().includes(lowerKeyword);
    const matchTags = s.tags.some(t => t.toLowerCase().includes(lowerKeyword));
    return matchName || matchSeries || matchTags;
  });
}

// 列出系列
function listSeries() {
  const index = readIndex();
  return Object.keys(index.series || {});
}

// 根据ID获取贴纸
function getStickerById(id) {
  const stickers = scanStickers();
  return stickers.find(s => s.id === id || s.relativePath === id);
}

// CLI 命令定义
program
  .name('sticker')
  .description('AI Agent 表情包搜索与管理工具')
  .version('1.0.0');

// 搜索命令
program
  .command('search <keyword>')
  .description('搜索表情包')
  .option('-l, --limit <n>', '限制返回数量', '10')
  .action(async (keyword, options) => {
    const spinner = ora('搜索中...').start();
    
    try {
      const results = searchStickers(keyword);
      spinner.stop();
      
      if (results.length === 0) {
        console.log(chalk.yellow('未找到匹配的表情包'));
        return;
      }
      
      console.log(chalk.green(`\n找到 ${results.length} 个结果：\n`));
      
      results.slice(0, parseInt(options.limit)).forEach((s, i) => {
        console.log(`${chalk.cyan(i + 1)}. ${chalk.bold(s.name)}`);
        console.log(`   系列: ${chalk.gray(s.series)}`);
        console.log(`   路径: ${chalk.blue(s.relativePath)}`);
        console.log(`   大小: ${chalk.gray((s.size / 1024).toFixed(1))} KB`);
        console.log();
      });
      
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('搜索失败:'), error.message);
    }
  });

// 列出系列命令
program
  .command('series')
  .description('列出所有表情包系列')
  .action(() => {
    const series = listSeries();
    
    if (series.length === 0) {
      console.log(chalk.yellow('暂无表情包系列'));
      return;
    }
    
    console.log(chalk.green('\n表情包系列列表：\n'));
    series.forEach((s, i) => {
      const count = readIndex().series[s]?.length || 0;
      console.log(`${chalk.cyan(i + 1)}. ${chalk.bold(s)} ${chalk.gray(`(${count} 个表情)`)}`);
    });
    console.log();
  });

// 列出贴纸命令
program
  .command('list [series]')
  .description('列出表情包')
  .action((seriesName) => {
    const stickers = scanStickers();
    let filtered = stickers;
    
    if (seriesName) {
      filtered = stickers.filter(s => s.series === seriesName);
    }
    
    if (filtered.length === 0) {
      console.log(chalk.yellow('暂无表情包'));
      return;
    }
    
    console.log(chalk.green(`\n共 ${filtered.length} 个表情包：\n`));
    filtered.forEach((s, i) => {
      console.log(`${chalk.cyan(i + 1)}. ${s.name} ${chalk.gray(`[${s.series}]`)}`);
    });
    console.log();
  });

// 获取贴纸路径（用于IM工具发送）
program
  .command('path <id>')
  .description('获取贴纸文件的完整路径')
  .action((id) => {
    const sticker = getStickerById(id);
    
    if (!sticker) {
      console.error(chalk.red('未找到贴纸:'), id);
      process.exit(1);
    }
    
    console.log(sticker.path);
  });

// 缓存新贴纸
program
  .command('cache <source>')
  .description('缓存新的表情包')
  .requiredOption('-s, --series <name>', '指定系列名称')
  .option('-n, --name <name>', '指定名称')
  .action(async (source, options) => {
    const spinner = ora('下载中...').start();
    
    try {
      // 创建系列目录
      const serieDir = path.join(STICKER_DIR, options.series);
      if (!fs.existsSync(serieDir)) {
        fs.mkdirSync(serieDir, { recursive: true });
      }
      
      // 确定文件名
      const ext = path.extname(source) || '.jpg';
      const name = options.name || `sticker-${Date.now()}`;
      const filename = `${name}${ext}`;
      const destPath = path.join(serieDir, filename);
      
      // 下载或复制文件
      if (source.startsWith('http')) {
        const response = await axios.get(source, { responseType: 'stream' });
        const writer = fs.createWriteStream(destPath);
        response.data.pipe(writer);
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
      } else {
        fs.copyFileSync(source, destPath);
      }
      
      spinner.stop();
      console.log(chalk.green('✅ 已缓存:'), destPath);
      
      // 更新索引
      scanStickers();
      
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('缓存失败:'), error.message);
    }
  });

// 随机表情
program
  .command('random [series]')
  .description('随机返回一个表情包')
  .action((seriesName) => {
    const stickers = scanStickers();
    let filtered = stickers;
    
    if (seriesName) {
      filtered = stickers.filter(s => s.series === seriesName);
    }
    
    if (filtered.length === 0) {
      console.log(chalk.yellow('暂无表情包'));
      return;
    }
    
    const random = filtered[Math.floor(Math.random() * filtered.length)];
    console.log(chalk.green('\n随机表情包：\n'));
    console.log(`名称: ${chalk.bold(random.name)}`);
    console.log(`系列: ${chalk.gray(random.series)}`);
    console.log(`路径: ${chalk.blue(random.path)}`);
    console.log();
  });

program.parse();