import { defineWebExtConfig } from 'wxt';
import { resolve } from 'node:path';
export default defineWebExtConfig({
    startUrls: ["https://www.douyin.com/search/%E6%B2%99%E9%9B%95%E8%AF%B4%E5%89%A7"],
    // Windows需要使用绝对路径，resolve方法
    chromiumProfile: resolve('.wxt/chrome-data'), //.wxt/chrome-data 需要自己手动创建该文件夹

});
