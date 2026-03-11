
import {defineContentScript} from "#imports";

// 定义内容脚本：仅注入到B站视频播放页
export default defineContentScript({
    // 精准匹配B站视频页（支持通配符）
    matches: ['https://www.bilibili.com/video/*'],
    // 可选：B站是SPA，监听路由变化确保页面切换后仍生效
    runAt: 'document_idle',
    allFrames: false,

    // 脚本注入后执行的核心逻辑
    main() {
        // 调用业务模块的初始化函数
        console.log("插件初始化")
        let isHovering = false; // 标记鼠标是否悬停在播放速率控制元素上,鼠标在特定位置才执行该功能
        const STEP = 0.1; // 每次滚动的倍率变化量
        const MIN_RATE = 0.25; // 最小播放速率
        const MAX_RATE = 16.0; // 最大播放速率
        let targetElement = null; // 播放速率控制元素
        let videoElement = null; // 视频元素

        // 鼠标进入目标元素时的处理函数
        function handleMouseEnter() {
            isHovering = true;
        }

        // 鼠标离开目标元素时的处理函数
        function handleMouseLeave() {
            isHovering = false;
            if (videoElement) {
                // 离开时保留当前速率，并四舍五入到两位小数
                videoElement.playbackRate = Number(videoElement.playbackRate.toFixed(2));
            }
        }

        // 滚轮事件处理函数
        function handleWheel(event) {
            if (!isHovering) return; // 只在悬停时处理滚轮事件
            event.preventDefault(); // 阻止默认滚轮行为

            // 计算滚动方向（向上滚动加速，向下滚动减速）
            const direction = event.deltaY > 0 ? -1 : 1;

            // 计算新倍率并限制范围
            let newRate = videoElement.playbackRate + (STEP * direction);
            newRate = Math.min(Math.max(newRate, MIN_RATE), MAX_RATE);

            // 四舍五入到两位小数
            // 应用新倍率
            videoElement.playbackRate = Number(newRate.toFixed(2));
        }

        // 初始化函数
        function init() {
            console.log('初始化播放速率控制插件');
            // 移除旧的元素监听器
            if (targetElement) {
                targetElement.removeEventListener('mouseenter', handleMouseEnter);
                targetElement.removeEventListener('mouseleave', handleMouseLeave);
                targetElement.removeEventListener('wheel', handleWheel);
            }

            // 查询最新元素 //bpx-player-ctrl-playbackrate
            targetElement = document.querySelector('.bpx-player-ctrl-playbackrate');
            videoElement = document.querySelector('video');

            if (!targetElement || !videoElement) {
                // 如果元素不存在，延迟重试
                setTimeout(init, 1000);
                return;
            }

            // 添加新的事件监听
            targetElement.addEventListener('mouseenter', handleMouseEnter);
            targetElement.addEventListener('mouseleave', handleMouseLeave);
            targetElement.addEventListener('wheel', handleWheel);
        }


        // 初始化并监听DOM变化
        init();
    },
});
