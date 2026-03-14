# VideoSpeedWheel 开发文档
## 一、项目概述
### 1.1 项目介绍
VideoSpeedWheel 是一款基于 WXT + Vue 3 开发的浏览器扩展程序，旨在通过鼠标滚轮或键盘快捷键快速调节主流视频平台的播放倍速，支持多平台个性化配置与速率记忆功能，提升用户视频观看效率。

### 1.2 核心功能
- 鼠标滚轮调节：悬停倍速显示区域，滚动滚轮微调播放速率
- 键盘快捷键控制：Win+Alt+上下键模拟滚轮调节，Win+Alt+数字直接设置指定倍速
- 多平台适配：支持B站、小红书、抖音、快手、YouTube等主流视频平台
- 个性化配置：每个平台独立配置调节步长、最小/最大速率、速率记忆等参数
- 速率记忆：自动保存各平台上次播放速率，下次打开自动生效

### 1.3 技术栈
- 框架：WXT（现代化浏览器扩展开发框架）
- 前端：Vue 3（组合式API）、JavaScript/TypeScript
- 存储：WXT内置storage API
- 适配：DOM操作、MutationObserver监听页面变化

## 二、项目结构
```
VideoSpeedWheel/
├── core/ # 核心逻辑模块
│ ├── VideoSpeedController.js # 倍速控制核心类
│ ├── VideoSpeedConfig.js # 各平台配置定义
│ ├── VideoSpeedUi.js # 自定义 UI 创建（如 YouTube 倍速显示）
│ └── doc.md # 开发文档（本文档）
├── entrypoints/ # WXT 入口文件
│ ├── background.ts # 后台脚本
│ ├── content.js # 内容脚本（注入页面）
│ ├── popup/ # 配置弹窗
│ │ ├── App.vue # 弹窗主组件
│ │ ├── index.html # 弹窗 HTML 入口
│ │ ├── main.ts # 弹窗 Vue 入口
│ │ └── style.css # 弹窗样式
│ └── Example_XiaoHongShu.content/ # 示例内容脚本
├── components/ # Vue 组件
│ └── HelloWorld.vue # 测试组件
├── package.json # 项目依赖与脚本
├── tsconfig.json # TypeScript 配置
├── web-ext.config.ts # Web 扩展配置
└── wxt.config.ts # WXT 核心配置
```

## 三、核心模块详解
### 3.1 VideoSpeedConfig.js（平台配置）
#### 3.1.1 配置结构
该文件定义了各视频平台的配置信息，每个平台配置包含以下字段：
- matches：匹配的URL规则，用于确定脚本注入的页面
- storageKey：存储配置的键名（带local:前缀）
- selectors：DOM选择器，包含rateElement（倍速显示元素）、videoElement（视频元素）、extraElement（额外显示元素）、listenElement（监听元素）
- siteName：平台名称
- ui_create_func：自定义UI创建函数（如YouTube需要手动创建倍速显示元素）
- defaultConfig：默认配置，包含step（调节步长）、minRate（最小速率）、maxRate（最大速率）、lastRate（上次速率）、rememberSpeed（是否记忆速率）

#### 3.1.2 核心方法
- getMatchedConfig(currentUrl)：根据当前URL匹配对应的平台配置，实现URL通配符匹配逻辑

### 3.2 VideoSpeedController.js（倍速控制类）
#### 3.2.1 类属性
- storageKey：存储配置的键名
- defaultConfig：默认配置参数
- targetElement：倍速触发元素
- videoElement：视频元素
- textElement：倍速显示元素
- config：当前生效的配置
- isHovering：鼠标是否悬停在触发元素上
- keyInputBuffer：键盘输入缓冲
- keyInputTimer：键盘输入防抖定时器
- KEY_INPUT_TIMEOUT：键盘输入超时时间（1500ms）

#### 3.2.2 核心方法
1. initConfig()：异步初始化配置，从storage读取或使用默认配置
2. saveConfig()：保存配置到storage
3. handleMouseEnter()：鼠标进入触发元素时的处理逻辑
4. handleMouseLeave()：鼠标离开触发元素时的处理逻辑，保存当前速率
5. handleWheel()：滚轮事件处理，调整播放速率并限制范围
6. handleKeydown()：键盘事件处理，支持上下键调节速率和数字输入设置指定速率
7. processKeyInputBuffer()：处理键盘输入缓冲，设置指定倍速
8. init()：初始化DOM和事件监听，支持延迟重试机制
9. listen()：监听元素属性变化（适配SPA页面）
10. updateConfig()：手动更新配置
11. cleanup()：清理事件监听器和状态
12. getCurrentConfig()：获取当前配置

### 3.3 VideoSpeedUi.js（自定义UI）
该文件仅包含createYouTubeSpeedDisplay函数，用于为YouTube创建自定义的倍速显示元素：
- 检查元素是否已存在，避免重复创建
- 创建div元素作为倍速显示容器，设置样式和默认文本
- 将元素插入到YouTube播放器的指定位置

### 3.4 content.js（内容脚本）
#### 3.4.1 执行逻辑
1. 匹配当前页面的平台配置
2. 初始化VideoSpeedController实例
3. 异步初始化配置
4. 初始化DOM和事件监听
5. 监听SPA路由变化，页面URL变化时重新初始化

#### 3.4.2 关键配置
- matches: ['<all_urls>']：匹配所有URL
- runAt: 'document_idle'：页面空闲时执行
- allFrames: false：不注入到所有框架

### 3.5 popup/App.vue（配置弹窗）
#### 3.5.1 核心逻辑
1. 获取当前激活标签页的URL
2. 匹配对应的平台配置
3. 从storage加载配置到表单
4. 提供配置保存、重置功能
5. 表单验证，确保配置合法性

#### 3.5.2 响应式数据
- configForm：配置表单数据
- message：提示消息
- messageType：消息类型（success/error/info）
- currentSite：当前匹配的站点名称
- speedConfigItem：动态存储项
- isSiteMatched：是否匹配到支持的站点

#### 3.5.3 核心方法
- loadConfig()：加载当前站点的配置
- saveConfig()：保存配置到storage
- resetConfig()：重置为默认配置
- showMessage()：显示提示消息

## 四、事件处理机制
### 4.1 鼠标事件
- 鼠标悬停（mouseenter）：设置isHovering为true，更新鼠标样式，刷新配置
- 鼠标离开（mouseleave）：设置isHovering为false，保存当前速率
- 滚轮事件（wheel）：阻止默认行为，根据滚轮方向调整播放速率，限制速率范围，更新显示文本

### 4.2 键盘事件
- Win+Alt+↑：增加播放速率
- Win+Alt+↓：降低播放速率
- Win+Alt+数字/小数点：输入指定速率，防抖处理，超时后生效

### 4.3 页面监听
- MutationObserver监听页面DOM变化，适配SPA页面
- 监听元素属性变化，处理视频切换场景（如快手）

## 五、存储机制
### 5.1 存储方式
使用WXT的storage API，每个平台的配置独立存储，键名格式为local:${平台标识}_video_speed_config

### 5.2 存储内容
- step：滚轮调节步长
- minRate：最小播放速率
- maxRate：最大播放速率
- lastRate：上次播放速率
- rememberSpeed：是否记忆速率

### 5.3 配置加载与保存
- 初始化时优先读取存储的配置，无则使用默认配置
- 速率变化时自动保存lastRate
- 弹窗可手动修改并保存配置

## 六、开发与构建
### 6.1 环境要求
- Node.js >= 18.x（推荐20.x LTS）
- npm
- Chrome >= 90 / Firefox >= 91

### 6.2 开发脚本
- npm install：安装依赖
- npm run dev：启动Chrome开发环境
- npm run dev:firefox：启动Firefox开发环境
- npm run build：构建Chrome版本
- npm run build:firefox：构建Firefox版本
- npm run zip：打包Chrome版本为ZIP
- npm run zip:firefox：打包Firefox版本为ZIP

### 6.3 调试技巧
1. Chrome开发模式需手动创建.wxt/chrome-data目录
2. 使用console.log输出调试信息
3. 利用浏览器开发者工具调试内容脚本
4. 监听DOM变化时输出调试信息

## 七、平台适配注意事项
### 7.1 通用适配
- 各平台DOM结构可能随版本更新变化，需及时更新选择器
- SPA页面需监听URL变化，重新初始化控制器
- 视频元素可能动态加载，需实现延迟重试机制

### 7.2 各平台特殊处理
1. B站：兼容普通视频、番剧、芝士课堂，使用统一选择器
2. 小红书：区分触发元素和显示元素
3. 抖音：最大倍速限制为3.0，超出会被重置
4. 快手：路由不变，需监听swiper-slide-active元素变化
5. YouTube：需手动创建倍速显示UI

## 八、权限说明
### 8.1 申请的权限
- storage：用于保存各平台的个性化配置
- tabs：用于获取当前标签页URL，匹配对应平台的配置

### 8.2 权限使用场景
- storage：保存配置参数和记忆的播放速率
- tabs：在弹窗中获取当前标签页URL，匹配平台配置

## 九、常见问题与解决方案
### 9.1 倍速调节失效
- 检查平台选择器是否正确，DOM结构可能已更新
- 确认视频元素是否正确获取
- 查看控制台是否有报错信息

### 9.2 键盘快捷键不生效
- 确认Win+Alt组合键是否被其他程序占用
- 检查页面是否聚焦
- 确认内容脚本是否正确注入

### 9.3 配置无法保存
- 确认storage权限已申请
- 检查存储键名是否正确
- 查看控制台是否有存储相关报错

### 9.4 YouTube倍速显示不出现
- 确认createYouTubeSpeedDisplay函数是否执行
- 检查YouTube播放器DOM结构是否变化
- 确认元素插入位置是否正确

## 十、扩展开发规范
### 10.1 代码规范
- 使用ES6+语法，模块化开发
- 事件监听需在适当时候清理，避免内存泄漏
- 异步操作使用async/await，统一错误处理
- 配置参数添加合法性校验

### 10.2 兼容性规范
- 兼容Chrome和Firefox浏览器
- 适配各平台的DOM结构变化
- 处理视频元素动态加载场景

### 10.3 性能规范
- 使用防抖机制处理键盘输入
- 避免频繁的DOM操作
- 合理使用MutationObserver，避免过度监听