// 所有视频站点的倍速配置表
import {createYouTubeSpeedDisplay} from "./VideoSpeedUi.js";

export const videoSpeedConfigs = [
    {
        matches: ['<all_urls>'], // 匹配所有URL（仅在无其他匹配时生效）
        storageKey: 'local:general_video_speed_config',
        selectors: {
            rateElement: '', // 通用模式无触发元素
            videoElement: 'video', // 匹配所有视频
            extraElement: '',
            listenElement: ''
        },
        siteName: "General",
        defaultConfig: {
            step: 0.1,
            minRate: 0.1,
            maxRate: 16.0,
            lastRate: 1.0,
            rememberSpeed: true
        }
    },
    //B站普通视频/B站番剧/芝士课堂
    {
        // 匹配的URL（对应原matches）
        matches: ['https://www.bilibili.com/bangumi/*', 'https://www.bilibili.com/cheese/*', 'https://www.bilibili.com/video/*'],
        // 存储key（带local:前缀）
        storageKey: 'local:bilibili_video_speed_config',
        // DOM选择器（对应controller.init的参数）
        selectors: {
            rateElement: '.bpx-player-ctrl-playbackrate-result',
            videoElement: 'video',
            extraElement: '' // 无则空
        },
        siteName:"Bilibili",
        // 自定义配置（覆盖默认值）
        defaultConfig: {
            step: 0.1,
            minRate: 0.1,
            maxRate: 16.0,
            lastRate: 1.0,
            rememberSpeed: true
        }
    },
    // 小红书
    {
        matches: ['https://www.xiaohongshu.com/*'],
        storageKey: 'local:xiaohongshu_video_speed_config',
        selectors: {
            rateElement: '.xgplayer-playbackrate',
            videoElement: 'video',
            extraElement: '.playback-name'
        },
        siteName:"XiaoHongShu",
        defaultConfig: {
            step: 0.1,
            minRate: 0.1,
            maxRate: 16.0,
            lastRate: 1.0,
            rememberSpeed: true
        }
    },
    // 抖音
    {
        matches: ['https://www.douyin.com/*'],
        storageKey: 'local:douyin_video_speed_config',
        selectors: {
            rateElement: '.xgplayer-playback-setting.slide-show .xgplayer-setting-playbackRatio',
            videoElement: 'video[autoplay]',
            extraElement: ''
        },
        siteName:"DouYin",
        defaultConfig: {
            step: 0.1,
            minRate: 0.1,
            maxRate: 3.0, //抖音视频有最大上限超出会被重置
            lastRate: 1.0,
            rememberSpeed: true
        }
    },
    //快手
    {
        //document.querySelector("swiper-slide-active video").playbackRate
        matches: ['https://www.kuaishou.com/*'],
        storageKey: 'local:kuaishou_video_speed_config',
        selectors: {
            rateElement: '.swiper-slide-active .speed .speed',
            videoElement: '.swiper-slide-active video',
            extraElement: '',
            listenElement: '.swiper-slide-active'
        },
        siteName:"KuaiShou",
        defaultConfig: {
            step: 0.1,
            minRate: 0.1,
            maxRate: 16.0,
            lastRate: 1.0,
            rememberSpeed: true
        }
    },
    {
        matches: ['https://www.youtube.com/*'],
        storageKey: 'local:youtube_video_speed_config',
        selectors: {
            rateElement: '#custom-speed-display',
            videoElement: 'video',
            extraElement: '',
        },
        siteName:"YouTube",
        ui_create_func: createYouTubeSpeedDisplay, //Youtube需要先创建UI
        defaultConfig: {
            step: 0.1,
            minRate: 0.1,
            maxRate: 16.0,
            lastRate: 1.0,
            rememberSpeed: true
        }
    }
];

// 辅助函数：根据当前URL匹配对应的配置
export const getMatchedConfig = (currentUrl) => {
    if(!currentUrl){
        currentUrl = window.location.href;
    }
    // 1. 先匹配特定平台（排除通用配置）
    const specificConfig = videoSpeedConfigs.find(config => {
        if (config.siteName === "General") return false; // 跳过通用配置
        return config.matches.some(match => {
            const regex = new RegExp(`^${match.replace(/\*/g, '.*')}$`);
            return regex.test(currentUrl);
        });
    });
    return specificConfig || videoSpeedConfigs.find(config => config.siteName === "General");
};