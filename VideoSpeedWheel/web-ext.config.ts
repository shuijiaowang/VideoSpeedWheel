import { defineWebExtConfig } from 'wxt';
import { resolve } from 'node:path';
export default defineWebExtConfig({
    startUrls: ["https://www.behance.net/gallery/193099519/-alesha-"],
    // Windows需要使用绝对路径，resolve方法
    chromiumProfile: resolve('.wxt/chrome-data'), //.wxt/chrome-data 需要自己手动创建该文件夹

});
