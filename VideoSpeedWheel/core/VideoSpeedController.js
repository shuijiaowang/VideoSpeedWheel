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

        this.storageKey = options.storageKey; //存储的键
        this.defaultConfig = options.defaultConfig || {}; //默认初始化的配置参数

        // 状态管理
        this.targetElement = null; //触发元素
        this.videoElement = null; //视频元素
        this.textElement = null; // 倍速显示元素
        this.config = null; // 最终生效配置
        //鼠标触发状态
        this.isHovering = false; //是否处于触发状态，此时滚轮可修改倍速
        // 键盘输入相关状态
        this.keyInputBuffer = ''; // 存储数字输入缓冲（如"1.25"）
        this.keyInputTimer = null; // 输入延时定时器（防抖）
        this.KEY_INPUT_TIMEOUT = 1500; // 输入超时时间（ms），超时后确认输入
    }

    // 初始化配置/从本地读取配置（异步，需先调用这个方法再init DOM）
    async initConfig() {
        // 1. 用WXT的defineItem做配置初始化（首次使用自动生成默认值）
        const configItem = storage.defineItem(this.storageKey, {
            init: () => ({...DEFAULT_CONFIG, ...this.defaultConfig}),
        });
        // 2. 获取存储的配置（首次是init的默认值，后续是保存的值）
        this.config = await configItem.getValue();
    }

    // 保存配置到storage
    async saveConfig() {
        await storage.setItem(this.storageKey, this.config);
    }
    // 鼠标进入目标元素
    handleMouseEnter = async () => {
        console.log("调试：鼠标悬浮触发状态") //
        await this.initConfig() //更新参数，可能被popup进行修改，这样就不用通信
        this.isHovering = true; //修改状态
        this.targetElement.style.cursor = `n-resize`; //修改鼠标箭头样式作为提示
    };

    // 鼠标离开目标元素：保存当前速率
    handleMouseLeave = async () => {
        console.log("调试：鼠标离开结束并存储数据")
        this.isHovering = false; //更新状态
        //这里暂时限制为两位数。
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
        console.log("触发滚轮事件触发")
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
        // 更新倍速显示文本
        this.textElement.textContent = `${fixedRate}x`; // 格式如：1.50x、0.80x
    };

    // 处理键盘按下事件（核心新增方法）
    handleKeydown = (event) => {
        // 只响应 ctrl + alt 组合键
        const isWinKey = event.metaKey || event.winKey;
        if (!isWinKey || !event.altKey) return;

        const { key } = event;
        // 阻止默认行为和冒泡，避免影响浏览器原生功能
        event.stopPropagation();
        event.preventDefault();

        // 1. 处理上下方向键调整倍速（模拟滚轮）
        if (key === 'ArrowUp' || key === 'ArrowDown') {
            if (!this.videoElement || !this.config) return;

            const direction = key === 'ArrowUp' ? 1 : -1;
            let newRate = this.videoElement.playbackRate + (this.config.step * direction);
            // 限制速率范围
            newRate = Math.min(Math.max(newRate, this.config.minRate), this.config.maxRate);
            const fixedRate = Number(newRate.toFixed(2));

            // 更新视频倍速和显示
            this.videoElement.playbackRate = fixedRate;
            this.textElement.textContent = `${fixedRate}x`;

            // 更新并保存配置
            this.config.lastRate = fixedRate;
            this.saveConfig();
            return;
        }

        // 2. 处理数字/小数点输入（设置指定倍速）
        const isNumberKey = /^\d$/.test(key); // 0-9数字
        const isDotKey = key === '.' && !this.keyInputBuffer.includes('.'); // 小数点（仅允许一个）

        if (isNumberKey || isDotKey) {
            // 清空之前的定时器（防抖）
            if (this.keyInputTimer) {
                clearTimeout(this.keyInputTimer);
            }

            // 添加到输入缓冲
            this.keyInputBuffer += key;
            console.log(`键盘输入缓冲: ${this.keyInputBuffer}`);

            // 设置新的定时器，超时后处理输入
            this.keyInputTimer = setTimeout(() => {
                this.processKeyInputBuffer();
            }, this.KEY_INPUT_TIMEOUT);
        }
    };

    // 处理键盘输入的数字缓冲，设置指定倍速（核心新增方法）
    processKeyInputBuffer = () => {
        if (!this.videoElement || !this.config || !this.keyInputBuffer) return;

        // 转换为数字并验证
        let inputRate = parseFloat(this.keyInputBuffer);
        if (isNaN(inputRate)) {
            console.warn(`无效的倍速输入: ${this.keyInputBuffer}`);
            this.keyInputBuffer = '';
            return;
        }

        // 限制在最小/最大值之间
        inputRate = Math.min(Math.max(inputRate, this.config.minRate), this.config.maxRate);

        // 设置倍速并更新显示
        this.videoElement.playbackRate = inputRate;
        if (this.textElement) {
            this.textElement.textContent = `${inputRate}x`;
        }

        // 更新并保存配置
        this.config.lastRate = inputRate;
        this.saveConfig();

        console.log(`键盘设置倍速: ${inputRate}x`);

        // 清空缓冲和定时器
        this.keyInputBuffer = '';
        if (this.keyInputTimer) {
            clearTimeout(this.keyInputTimer);
            this.keyInputTimer = null;
        }
    };
    // 初始化DOM和事件监听（需先调用initConfig）
    init(targetSelector, videoSelector = 'video', textSelector, listenElement, ui_create_func) {
        if (typeof ui_create_func === 'function') { //如youtube，添加倍速元素
            ui_create_func();
        }
        if (!this.config) {
            throw new Error('请先调用 initConfig() 初始化配置');
        }
        this.cleanup(); // 清理旧监听器(鼠标/键盘)，并置空
        this.targetElement = document.querySelector(targetSelector);
        this.videoElement = document.querySelector(videoSelector);
        this.textElement = this.targetElement //默认触发元素就是显示元素
        //显示数字的元素
        if (textSelector !== '') {
            this.textElement = document.querySelector(textSelector); //如小红书的触发元素和显示元素不一致
        }
        //如快手的路由不变，切换视频时需要监听发生变化，重置init
        if (listenElement !== '') {
            this.listen(targetSelector, videoSelector, textSelector, listenElement,ui_create_func)
        }
        //三缺一，则延迟重试
        if (!this.targetElement || !this.videoElement ||!this.textElement) {
            setTimeout(() => this.init(targetSelector, videoSelector, textSelector, listenElement), 1000);
            return;
        }
        // 应用记忆的速率，初始化倍速
        if (this.config.rememberSpeed) {
            this.videoElement.playbackRate = this.config.lastRate;
            this.textElement.textContent = `${this.config.lastRate}x`
        }

        // 绑定事件
        this.targetElement.addEventListener('mouseenter', this.handleMouseEnter);
        this.targetElement.addEventListener('mouseleave', this.handleMouseLeave);
        this.targetElement.addEventListener('wheel', this.handleWheel);

        //键盘监听，ctrl+alt+上下键=滚轮上下键
        //键盘监听，ctrl+alt+键盘如1.25会直接设置视频倍速为1.25
        window.addEventListener('keydown', this.handleKeydown);
    }

    listen(targetSelector, videoSelector, textSelector, listenElement) {
        // listenElement的属性变化，一般是父级元素状态改为活跃
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
        // 解绑键盘事件
        window.removeEventListener('keydown', this.handleKeydown);

        // 清空键盘输入相关状态
        if (this.keyInputTimer) {
            clearTimeout(this.keyInputTimer);
            this.keyInputTimer = null;
        }
        this.keyInputBuffer = '';
        if (this.targetElement) {
            this.targetElement.removeEventListener('mouseenter', this.handleMouseEnter);
            this.targetElement.removeEventListener('mouseleave', this.handleMouseLeave);
            this.targetElement.removeEventListener('wheel', this.handleWheel);
        }
        this.targetElement = null;
        this.videoElement = null;
        this.textElement = null;
    }

    // 获取当前配置
    getCurrentConfig() {
        return {...this.config};
    }
}