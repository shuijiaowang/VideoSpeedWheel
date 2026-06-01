// core/VideoSpeedController.js
import {GeneralSpeedOverlay, nodeMayContainVideo} from './GeneralSpeedOverlay.js';

// 全局默认配置
const DEFAULT_CONFIG = {
    step: 0.1,          // 每次滚动的速率变化量
    minRate: 0.25,      // 最小播放速率
    maxRate: 16.0,      // 最大播放速率
    rememberSpeed: true,// 是否记忆上次速率
    lastRate: 1.0,      // 记忆的最后播放速率
};

/** 从 root 收集 video（light DOM + open Shadow + 同源 iframe，不含 closed Shadow） */
export function collectVideosFromRoot(root, options = {}) {
    const {includeIframes = true} = options;
    const videos = new Set();
    const visitedDocs = new WeakSet();

    const walk = (node) => {
        if (!node) return;
        if (node.nodeType === Node.DOCUMENT_NODE) {
            if (visitedDocs.has(node)) return;
            visitedDocs.add(node);
            walk(node.documentElement);
            return;
        }
        if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            for (const child of node.children) {
                walk(child);
            }
            return;
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'VIDEO') {
                videos.add(node);
            }
            if (node.shadowRoot) {
                walk(node.shadowRoot);
            }
            if (includeIframes && node.tagName === 'IFRAME') {
                try {
                    const doc = node.contentDocument;
                    if (doc?.documentElement) {
                        walk(doc);
                    }
                } catch (_) {
                    // 跨域 iframe 无法访问
                }
            }
            for (const child of node.children) {
                walk(child);
            }
        }
    };

    if (root instanceof Document) {
        walk(root);
    } else if (root instanceof DocumentFragment || root instanceof Element) {
        walk(root);
    }
    return Array.from(videos);
}

export class VideoSpeedController {
    constructor(options) {

        this.storageKey = options.storageKey; //存储的键
        this.defaultConfig = options.defaultConfig || {}; //默认初始化的配置参数

        // 状态管理
        this.targetElement = null; //触发元素
        this.targetElements = []; // 多视频场景下的触发元素
        this.videoElement = null; //视频元素
        this.videoElements = []; // 通用模式下存储所有视频元素
        this.textElement = null; // 倍速显示元素
        this.textElements = []; // 多视频场景下的倍速显示元素
        this.config = null; // 最终生效配置
        //鼠标触发状态
        this.isHovering = false; //是否处于触发状态，此时滚轮可修改倍速
        this.generalOverlay = null; // 通用模式悬浮倍速 UI
        // 键盘输入相关状态
        this.keyInputBuffer = ''; // 存储数字输入缓冲（如"1.25"）
        this.keyInputTimer = null; // 输入延时定时器（防抖）
        this.KEY_INPUT_TIMEOUT = 1500; // 输入超时时间（ms），超时后确认输入
        this.videoObserver = null; // 监听动态添加的视频
        this.observedMutationRoots = null; // 已挂 MutationObserver 的根（含 shadowRoot）
        this.uiPollTimer = null; // 轮询保活自定义UI
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
    getAllVideoElements() {
        if (this.storageKey.includes('general')) {
            return collectVideosFromRoot(document);
        }
        return Array.from(document.querySelectorAll('video'));
    }

    applyRateToVideos(videos, rate) {
        if (!this.config || !videos.length) return;
        const fixedRate = Number(
            Math.min(Math.max(rate, this.config.minRate), this.config.maxRate).toFixed(2)
        );
        videos.forEach(video => {
            video.playbackRate = fixedRate;
        });
    }

    formatRate(rate) {
        return `${Number(rate.toFixed(2))}x`;
    }

    syncTextDisplays(rate) {
        const displayText = this.formatRate(rate);
        const textElements = this.textElements.length ? this.textElements : [this.textElement].filter(Boolean);
        textElements.forEach(textElement => {
            textElement.textContent = displayText;
        });
    }

    removeTargetEventListeners() {
        const targetElements = this.targetElements.length ? this.targetElements : [this.targetElement].filter(Boolean);
        targetElements.forEach(targetElement => {
            targetElement.removeEventListener('mouseenter', this.handleMouseEnter);
            targetElement.removeEventListener('mouseleave', this.handleMouseLeave);
            targetElement.removeEventListener('wheel', this.handleWheel);
        });
    }

    bindTargetEventListeners() {
        this.targetElements.forEach(targetElement => {
            targetElement.addEventListener('mouseenter', this.handleMouseEnter);
            targetElement.addEventListener('mouseleave', this.handleMouseLeave);
            targetElement.addEventListener('wheel', this.handleWheel);
        });
    }

    isSameElements(oldElements, newElements) {
        return oldElements.length === newElements.length
            && oldElements.every((element, index) => element === newElements[index]);
    }

    rebindMultiElements(targetSelector, videoSelector, textSelector, root = document) {
        const targetElements = targetSelector ? Array.from(root.querySelectorAll(targetSelector)) : [];
        const videoElements = videoSelector ? Array.from(root.querySelectorAll(videoSelector)) : [];
        const textElements = textSelector ? Array.from(root.querySelectorAll(textSelector)) : targetElements;

        if (
            this.isSameElements(this.targetElements, targetElements)
            && this.isSameElements(this.videoElements, videoElements)
            && this.isSameElements(this.textElements, textElements)
        ) {
            return;
        }

        this.removeTargetEventListeners();

        this.targetElements = targetElements;
        this.videoElements = videoElements;
        this.textElements = textElements;
        this.targetElement = targetElements[0] || null;
        this.videoElement = videoElements[0] || null;
        this.textElement = textElements[0] || this.targetElement;

        this.bindTargetEventListeners();
        if (this.config) {
            this.syncTextDisplays(this.config.lastRate);
        }
    }

    startUiPolling(targetSelector, videoSelector, textSelector, ui_create_func, root = document, interval = 250) {
        if (this.uiPollTimer) {
            clearInterval(this.uiPollTimer);
        }

        this.uiPollTimer = setInterval(() => {
            if (typeof ui_create_func === 'function') {
                ui_create_func(this.config?.lastRate || 1.0);
            }
            this.rebindMultiElements(targetSelector, videoSelector, textSelector, root);
            if (this.config?.rememberSpeed && this.videoElements.length) {
                this.updateAllVideoSpeed(this.config.lastRate, {save: false});
            }
        }, interval);
    }

    // 通用模式：更新所有视频的倍速
    updateAllVideoSpeed(rate, options = {}) {
        if (!this.config) return;
        const {save = true} = options;
        // newRate = Math.min(Math.max(newRate, this.config.minRate), this.config.maxRate);
        // 限制速率范围
        // const fixedRate = Number(Math.min(Math.max(rate, this.config.minRate), this.config.maxRate).toFixed(2));
        const fixedRate = Number(Math.min(Math.max(rate, this.config.minRate), this.config.maxRate).toFixed(2));
        // 更新所有视频
        if (this.storageKey.includes('general')) {
            this.videoElements = this.getAllVideoElements();
        } else if (!this.videoElements.length) {
            this.videoElements = this.videoElement ? [this.videoElement] : this.getAllVideoElements();
        }
        this.videoElements.forEach(video => {
            video.playbackRate = fixedRate;
        });
        this.config.lastRate = fixedRate;
        this.syncTextDisplays(fixedRate);
        this.generalOverlay?.updateAllTexts(fixedRate);
        // 保存记忆速率
        if (save && this.config.rememberSpeed) {
            this.saveConfig();
        }
        return fixedRate;
    }

    changeRateByStep(direction) {
        if (!this.config) return;
        const newRate = this.config.lastRate + (this.config.step * direction);
        return this.updateAllVideoSpeed(newRate, {save: false});
    }

    // 鼠标进入目标元素
    handleMouseEnter = async (event) => {
        if (this.storageKey.includes('general')) return; // 通用模式跳过
        // console.log("调试：鼠标悬浮触发状态") //
        await this.initConfig() //更新参数，可能被popup进行修改，这样就不用通信
        this.isHovering = true; //修改状态
        const targetElement = event?.currentTarget || this.targetElement;
        if (targetElement) {
            targetElement.style.cursor = `n-resize`; //修改鼠标箭头样式作为提示
        }
    };

    // 鼠标离开目标元素：保存当前速率
    handleMouseLeave = async () => {
        if (this.storageKey.includes('general')) return; // 通用模式跳过
        // console.log("调试：鼠标离开结束并存储数据")
        this.isHovering = false; //更新状态
        //这里暂时限制为两位数。
        if (this.videoElement || this.videoElements.length) {
            const currentRate = this.videoElement?.playbackRate || this.config.lastRate;
            const fixedRate = Number(currentRate.toFixed(2));
            this.updateAllVideoSpeed(fixedRate, {save: false});
            // 更新配置并保存
            this.config.lastRate = fixedRate;
            await this.saveConfig();
        }
    };

    // 滚轮事件处理
    handleWheel = (event) => {
        if (this.storageKey.includes('general')) return; // 通用模式跳过
        // console.log("触发滚轮事件触发")
        if (!this.isHovering || !this.videoElement) return;
        event.stopPropagation();
        event.preventDefault();
        const direction = event.deltaY > 0 ? -1 : 1;
        let newRate = this.videoElement.playbackRate + (this.config.step * direction);
        // 限制速率在最小/最大值之间
        newRate = Math.min(Math.max(newRate, this.config.minRate), this.config.maxRate);
        // 设置新的播放倍速（保留2位小数）
        const fixedRate = Number(newRate.toFixed(2));
        this.updateAllVideoSpeed(fixedRate, {save: false});
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
            if (!this.config) return;
            const hasTargetVideo = this.videoElement || this.videoElements.length || this.storageKey.includes('general');
            if (!hasTargetVideo) return;

            const direction = key === 'ArrowUp' ? 1 : -1;
            let newRate = (this.videoElement?.playbackRate || this.config.lastRate) + (this.config.step * direction);


            // 特定平台：单视频调节
            if (!this.storageKey.includes('general') && (this.videoElement || this.videoElements.length)) {
                newRate = (this.videoElement?.playbackRate || this.config.lastRate) + (this.config.step * direction);
                this.updateAllVideoSpeed(newRate);
            }
            // 通用模式：所有视频调节
            else if (this.storageKey.includes('general')) {
                // 使用记忆的速率作为基准
                newRate = this.config.lastRate + (this.config.step * direction);
                this.updateAllVideoSpeed(newRate);
                // console.log(`通用模式：倍速调整为 ${newRate.toFixed(2)}x`);
            }
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
            // console.log(`键盘输入缓冲: ${this.keyInputBuffer}`);

            // 设置新的定时器，超时后处理输入
            this.keyInputTimer = setTimeout(() => {
                this.processKeyInputBuffer();
            }, this.KEY_INPUT_TIMEOUT);
        }
    };

    // 处理键盘输入的数字缓冲，设置指定倍速（核心新增方法）
    processKeyInputBuffer = () => {
        if (!this.config || !this.keyInputBuffer) return;

        let inputRate = parseFloat(this.keyInputBuffer);
        if (isNaN(inputRate)) {
            console.warn(`无效的倍速输入: ${this.keyInputBuffer}`);
            this.keyInputBuffer = '';
            return;
        }

        // 特定平台：单视频设置
        if (!this.storageKey.includes('general') && (this.videoElement || this.videoElements.length)) {
            this.updateAllVideoSpeed(inputRate);
        }
        // 通用模式：所有视频设置
        else if (this.storageKey.includes('general')) {
            this.updateAllVideoSpeed(inputRate);
            // console.log(`通用模式：设置倍速为 ${inputRate.toFixed(2)}x`);
        }

        this.keyInputBuffer = '';
        if (this.keyInputTimer) {
            clearTimeout(this.keyInputTimer);
            this.keyInputTimer = null;
        }
    };
    // 初始化DOM和事件监听（需先调用initConfig）
    init(targetSelector, videoSelector = 'video', textSelector, listenElement, ui_create_func, root = document, options = {}) {
        const query = (selector) => (selector ? root.querySelector(selector) : null);
        // 通用模式初始化
        if (this.storageKey.includes('general')) {
            this.cleanup();
            // 应用记忆速率到所有视频
            if (this.config.rememberSpeed) {
                this.updateAllVideoSpeed(this.config.lastRate);
            }
            // 监听动态添加的视频元素
            this.observeDynamicVideos();
            this.generalOverlay = new GeneralSpeedOverlay(this);
            this.generalOverlay.start();
            if (!this.config.rememberSpeed) {
                this.updateAllVideoSpeed(this.config.lastRate, {save: false});
            }
            // 绑定键盘事件
            window.addEventListener('keydown', this.handleKeydown);
            return;
        }

        if (!this.config) {
            throw new Error('请先调用 initConfig() 初始化配置');
        }
        this.cleanup(); // 清理旧监听器(鼠标/键盘)，并置空

        if (typeof ui_create_func === 'function') { //如youtube，添加倍速元素
            ui_create_func(this.config.lastRate);
        }

        if (options.multiTargets) {
            this.rebindMultiElements(targetSelector, videoSelector, textSelector, root);
            if (this.config.rememberSpeed) {
                this.updateAllVideoSpeed(this.config.lastRate, {save: false});
            }
            window.addEventListener('keydown', this.handleKeydown);
            if (options.uiPollInterval) {
                this.startUiPolling(targetSelector, videoSelector, textSelector, ui_create_func, root, options.uiPollInterval);
            }
            return;
        }

        this.targetElement = query(targetSelector);
        this.videoElement = query(videoSelector);
        this.textElement = this.targetElement //默认触发元素就是显示元素
        //显示数字的元素
        if (textSelector !== '') {
            this.textElement = query(textSelector); //如小红书的触发元素和显示元素不一致
        }
        //如快手的路由不变，切换视频时需要监听发生变化，重置init
        if (listenElement !== '') {
            this.listen(targetSelector, videoSelector, textSelector, listenElement, ui_create_func, root)
        }
        //三缺一，则延迟重试
        if (!this.targetElement || !this.videoElement ||!this.textElement) {
            setTimeout(() => this.init(targetSelector, videoSelector, textSelector, listenElement, ui_create_func, root), 1000);
            return;
        }
        // 应用记忆的速率，初始化倍速
        if (this.config.rememberSpeed) {
            this.videoElement.playbackRate = this.config.lastRate;
            this.textElement.textContent = this.formatRate(this.config.lastRate)
        }

        // 绑定事件
        this.targetElement.addEventListener('mouseenter', this.handleMouseEnter);
        this.targetElement.addEventListener('mouseleave', this.handleMouseLeave);
        this.targetElement.addEventListener('wheel', this.handleWheel);

        //键盘监听，ctrl+alt+上下键=滚轮上下键
        //键盘监听，ctrl+alt+键盘如1.25会直接设置视频倍速为1.25
        window.addEventListener('keydown', this.handleKeydown);
    }
    observeMutationRoot(root) {
        if (!root || !this.videoObserver || this.observedMutationRoots?.has(root)) {
            return;
        }
        this.observedMutationRoots.add(root);
        this.videoObserver.observe(root, {childList: true, subtree: true});
    }

    registerShadowObservers(container) {
        if (!container?.querySelectorAll) return;
        container.querySelectorAll('*').forEach(el => {
            if (el.shadowRoot) {
                this.observeMutationRoot(el.shadowRoot);
                this.registerShadowObservers(el.shadowRoot);
            }
        });
    }

    bindIframeVideoObserver(iframe) {
        const onIframeReady = () => {
            try {
                const doc = iframe.contentDocument;
                if (!doc?.body) return;
                this.observeMutationRoot(doc.body);
                this.registerShadowObservers(doc.body);
                this.applyRateToVideos(collectVideosFromRoot(doc), this.config.lastRate);
            } catch (_) {
                // 跨域
            }
        };
        iframe.addEventListener('load', onIframeReady);
        onIframeReady();
    }

    handleAddedNodeForVideos(node) {
        if (!this.config || !node) return;
        const rate = this.config.lastRate;

        if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'IFRAME') {
            this.bindIframeVideoObserver(node);
        }

        const isElementOrFragment =
            node.nodeType === Node.ELEMENT_NODE
            || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
        if (!isElementOrFragment || !nodeMayContainVideo(node)) {
            return;
        }

        const subtreeVideos = collectVideosFromRoot(node);
        if (subtreeVideos.length) {
            this.applyRateToVideos(subtreeVideos, rate);
        }
        if (node.querySelectorAll) {
            this.registerShadowObservers(node);
        }
        if (this.generalOverlay) {
            this.generalOverlay.scheduleVideoScan();
        }
    }

    // 监听动态添加的视频（通用模式：含 open Shadow、同源 iframe）
    observeDynamicVideos() {
        this.observedMutationRoots = new WeakSet();
        this.videoObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    this.handleAddedNodeForVideos(node);
                });
            });
        });

        const body = document.body;
        if (body) {
            this.observeMutationRoot(body);
            this.registerShadowObservers(body);
            document.querySelectorAll('iframe').forEach(iframe => {
                this.bindIframeVideoObserver(iframe);
            });
        }
    }
    listen(targetSelector, videoSelector, textSelector, listenElement, ui_create_func, root = document) {
        // listenElement的属性变化，一般是父级元素状态改为活跃
        const targetElement = root.querySelector(listenElement);
        if (targetElement) {
            const attrObserver = new MutationObserver((mutations) => {
                // 只要属性变化就触发重新绑定
                // console.log(`[测试] listenElement属性变化:`, mutations);
                this.init(targetSelector, videoSelector, textSelector, listenElement, ui_create_func, root);
            });
            // 监听目标元素的所有属性变化
            attrObserver.observe(targetElement, {attributes: true});
            // console.log(`[测试] 已启动listenElement属性监听: ${listenElement}`);
        } else {
            console.warn(`[测试] 未找到listenElement: ${listenElement}`);
        }
    }
    // 手动更新配置（比如弹窗调整）
    async updateConfig(newConfig) {
        this.config = {...this.config, ...newConfig};
        await this.saveConfig();
        // 同步更新视频速率（如果改了lastRate）
        if (newConfig.lastRate !== undefined) {
            this.updateAllVideoSpeed(newConfig.lastRate, {save: false});
        }
    }

    // 清理监听器（适配通用模式）
    cleanup() {
        window.removeEventListener('keydown', this.handleKeydown);
        if (this.uiPollTimer) {
            clearInterval(this.uiPollTimer);
            this.uiPollTimer = null;
        }
        if (this.keyInputTimer) {
            clearTimeout(this.keyInputTimer);
            this.keyInputTimer = null;
        }
        this.keyInputBuffer = '';
        // 清理视频监听
        if (this.videoObserver) {
            this.videoObserver.disconnect();
            this.videoObserver = null;
        }
        this.observedMutationRoots = null;
        if (this.generalOverlay) {
            this.generalOverlay.destroy();
            this.generalOverlay = null;
        }
        // 特定平台清理
        this.removeTargetEventListeners();
        this.targetElement = null;
        this.targetElements = [];
        this.videoElement = null;
        this.textElement = null;
        this.textElements = [];
        this.videoElements = [];
    }

    // 获取当前配置
    getCurrentConfig() {
        return {...this.config};
    }
}