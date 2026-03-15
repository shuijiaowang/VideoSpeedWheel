import { defineWebExtConfig } from 'wxt';
import { resolve } from 'node:path';
export default defineWebExtConfig({
    startUrls: ["https://www.bilibili.com","https://www.douyin.com","https://www.xiaohongshu.com","https://www.kuaishou.com/new-reco"],
    // startUrls: ["https://v.youth.cn/yw/202603/t20260312_16552623.htm"],
    // startUrls: ["https://www.bilibili.com"],
    // Windows需要使用绝对路径，resolve方法
    chromiumProfile: resolve('.wxt/chrome-data'), //.wxt/chrome-data 需要自己手动创建该文件夹
});
