// core/VideoSpeedController.js
// 全局默认配置
const DEFAULT_CONFIG = {
    step: 0.1,          // 每次滚动的速率变化量
    minRate: 0.25,      // 最小播放速率
    maxRate: 16.0,      // 最大播放速率
    rememberSpeed: true,// 是否记忆上次速率
    lastRate: 1.0,      // 记忆的最后播放速率
};

export class VideoSpeedController {
    constructor(options) {
        // 强制storageKey带local:前缀，保证是本地存储
        if (!options.storageKey.startsWith('local:')) {
            throw new Error('storageKey 必须以 local: 开头（WXT 本地存储）');
        }
        this.storageKey = options.storageKey;
        // 保存默认配置（修复原TS中未挂载的问题）
        this.defaultConfig = options.defaultConfig || {};

        // 初始化实例属性
        this.isHovering = false;
        this.targetElement = null;
        this.videoElement = null;
        this.config = null; // 最终生效配置
    }

    // 初始化配置（异步，需先调用这个方法再init DOM）
    async initConfig() {
        // 1. 用WXT的defineItem做配置初始化（首次使用自动生成默认值）
        const configItem = storage.defineItem(this.storageKey, {
            init: () => ({...DEFAULT_CONFIG, ...this.defaultConfig}),
        });
        // 2. 获取存储的配置（首次是init的默认值，后续是保存的值）
        this.config = await configItem.getValue();
    }

    // 保存配置到WXT storage
    async saveConfig() {
        if (!this.config.rememberSpeed) return;
        await storage.setItem(this.storageKey, this.config);
    }

    // 鼠标进入目标元素
    handleMouseEnter = () => {
        console.log("调试：鼠标进入处于悬浮状态")
        this.isHovering = true;
        this.targetElement.style.cursor = `n-resize`;
    };

    // 鼠标离开目标元素：保存当前速率
    handleMouseLeave = async () => {
        console.log("调试：鼠标离开结束")
        this.isHovering = false;
        if (this.videoElement) {
            const fixedRate = Number(this.videoElement.playbackRate.toFixed(2));
            this.videoElement.playbackRate = fixedRate;
            // 更新配置并保存
            this.config.lastRate = fixedRate;
            await this.saveConfig();
        }
    };

    // 滚轮事件处理
    handleWheel = (event) => {
        console.log("滚轮事件未触发？", this.videoElement)
        if (!this.isHovering || !this.videoElement) return;
        event.stopPropagation();
        event.preventDefault();
        const direction = event.deltaY > 0 ? -1 : 1;
        let newRate = this.videoElement.playbackRate + (this.config.step * direction);
        // 限制速率在最小/最大值之间
        newRate = Math.min(Math.max(newRate, this.config.minRate), this.config.maxRate);
        // 设置新的播放倍速（保留2位小数）
        const fixedRate = Number(newRate.toFixed(2));
        this.videoElement.playbackRate = fixedRate;
        // 更新倍速显示文本（核心补全部分）
        console.log("为什么不变？", this.textElement)
        this.textElement.textContent = `${fixedRate}x`; // 格式如：1.50x、0.80x

    };

    // 初始化DOM和事件监听（需先调用initConfig）
    init(targetSelector, videoSelector = 'video', textSelector, listenElement, ui_create_func) {
        if (typeof ui_create_func === 'function') {
            ui_create_func(); // 执行函数并保存结果，方便后续复用
        }
        if (!this.config) {
            throw new Error('请先调用 initConfig() 初始化配置');
        }
        this.cleanup(); // 清理旧监听器
        this.targetElement = document.querySelector(targetSelector);
        console.log("目标", targetSelector, this.targetElement)
        this.videoElement = document.querySelector(videoSelector);

        //显示数字的元素
        if (textSelector !== '') {
            this.textElement = document.querySelector(textSelector);
        } else {
            this.textElement = this.targetElement
            console.log("这里没有赋值？", this.textElement, this.targetElement)
        }
        if (listenElement !== '') {
            this.listen(targetSelector, videoSelector, textSelector, listenElement)
        }
        if (!this.targetElement || !this.videoElement) {
            console.log("重试init")
            setTimeout(() => this.init(targetSelector, videoSelector, textSelector, listenElement), 1000);
            return;
        }

        // 应用记忆的速率
        if (this.config.rememberSpeed) {
            console.log("调试：获取配置：", this.config.lastRate)
            this.videoElement.playbackRate = this.config.lastRate;
            this.textElement.textContent = `${this.config.lastRate}x`
            console.log("初始化倍速，初始化显示", this.videoElement, this.textElement)
        }

        // 绑定事件
        this.targetElement.addEventListener('mouseenter', this.handleMouseEnter);
        this.targetElement.addEventListener('mouseleave', this.handleMouseLeave);
        this.targetElement.addEventListener('wheel', this.handleWheel);
    }

    listen(targetSelector, videoSelector, textSelector, listenElement) {
        // 2. 监听listenElement的属性变化（核心测试逻辑）
        const targetElement = document.querySelector(listenElement);
        if (targetElement) {
            const attrObserver = new MutationObserver((mutations) => {
                // 只要属性变化就触发重新绑定
                console.log(`[测试] listenElement属性变化:`, mutations);
                this.init(targetSelector, videoSelector, textSelector, listenElement);
            });
            // 监听目标元素的所有属性变化
            attrObserver.observe(targetElement, {attributes: true});
            console.log(`[测试] 已启动listenElement属性监听: ${listenElement}`);
        } else {
            console.warn(`[测试] 未找到listenElement: ${listenElement}`);
        }
        //监听某个元素的listenElement的属性值是否发生变化，如果变化了就重新绑定
    }

    // 手动更新配置（比如弹窗调整）
    async updateConfig(newConfig) {
        this.config = {...this.config, ...newConfig};
        await this.saveConfig();
        // 同步更新视频速率（如果改了lastRate）
        if (this.videoElement && newConfig.lastRate) {
            this.videoElement.playbackRate = newConfig.lastRate;
        }
    }

    // 清理监听器
    cleanup() {
        if (this.targetElement) {
            this.targetElement.removeEventListener('mouseenter', this.handleMouseEnter);
            this.targetElement.removeEventListener('mouseleave', this.handleMouseLeave);
            this.targetElement.removeEventListener('wheel', this.handleWheel);
        }
        this.targetElement = null;
        this.videoElement = null;
    }

    // 获取当前配置
    getCurrentConfig() {
        return {...this.config};
    }
}