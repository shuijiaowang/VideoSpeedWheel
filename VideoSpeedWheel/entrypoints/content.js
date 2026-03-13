
import {VideoSpeedController} from "../core/VideoSpeedController.js";
import {getMatchedConfig} from "../core/VideoSpeedConfig.js";

export default defineContentScript({
    matches: ['<all_urls>'],
    runAt: 'document_idle',
    allFrames: false,
    async main() {
        console.log('鼠标倍速插件');
        const matchedConfig = getMatchedConfig();
        if (!matchedConfig) return;
        console.log(`[${matchedConfig.storageKey}] 倍速插件初始化`);
        // 初始化控制器
        const controller = new VideoSpeedController({
            storageKey: matchedConfig.storageKey,
            defaultConfig: matchedConfig.defaultConfig
        });
        // 异步初始化配置
        await controller.initConfig();
        // 初始化DOM（处理多参数场景）
        const { rateElement, videoElement, extraElement ,listenElement } = matchedConfig.selectors;
        const initDom = () => {
            controller.init(rateElement, videoElement, extraElement,listenElement,matchedConfig.ui_create_func);
        };
        initDom();
        // 监听SPA路由变化（通用逻辑）
        let lastUrl = location.href;
        const urlObserver  = new MutationObserver(async () => {
            const currentUrl = location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                controller.cleanup();
                // 延迟初始化确保DOM加载完成
                setTimeout(initDom, 500);
            }
        });
        urlObserver.observe(document.body, { subtree: true, childList: true });
    },
});
