import { defineContentScript } from "#imports";
import { VideoSpeedController } from "../../core/VideoSpeedController.js";

// 定义内容脚本：仅注入到B站视频播放页
export default defineContentScript({
    // 精准匹配B站视频页（支持通配符）https://www.xiaohongshu.com/
    matches: ['https://www.xiaohongshu_example.com/*'],
    // 可选：B站是SPA，监听路由变化确保页面切换后仍生效
    runAt: 'document_idle',
    allFrames: false,

    // 脚本注入后执行的核心逻辑（改为异步函数）
    async main() { // 关键：main改为async，支持await
        // 调用业务模块的初始化函数
        console.log("鼠标倍速插件初始化");

        const controller = new VideoSpeedController({
            // 1. 修复：storageKey必须加local:前缀
            storageKey: 'local:xiaohongshu_video_speed_config',
            // 2. 修复：自定义配置要放在defaultConfig里，覆盖默认值
            defaultConfig: {
                step: 0.1,
                minRate: 0.25,
                maxRate: 16.0,
                lastRate: 1.0, // 修复：参数名是lastRate而非defaultRate
                rememberSpeed: true,
            }
        });

        // 3. 关键：先异步初始化配置，再初始化DOM
        await controller.initConfig();

        // B站专属DOM选择器
        //触发元素，视频元素，显示元素

        const initDom = () => {
            controller.init('.xgplayer-playbackrate', 'video','.playback-name');
        };
        initDom();

        // 监听SPA路由变化（页面切换后重新初始化）
        let lastUrl = location.href;
        const observer = new MutationObserver(async () => { // 改为async
            const currentUrl = location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                controller.cleanup();
                // 延迟初始化，确保DOM加载完成
                setTimeout(() =>initDom(), 500);
            }
        });
        observer.observe(document.body, { subtree: true, childList: true });
    },
});
