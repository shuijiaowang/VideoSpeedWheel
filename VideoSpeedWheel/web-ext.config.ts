import { defineWebExtConfig } from 'wxt';
import { resolve } from 'node:path';
export default defineWebExtConfig({
    startUrls: ["https://www.bilibili.com/"],
    // startUrls: ["https://www.doubao.com/chat/coding","https://chat.deepseek.com/","https://baidu.com/"],
    // On Windows, the path must be absolute
    chromiumProfile: resolve('.wxt/chrome-data'), //.wxt/chrome-data 需要自己手动创建
    keepProfileChanges: true,
});
