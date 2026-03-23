import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue','@wxt-dev/i18n/module'],
    manifest:{
        permissions: ['storage','tabs'],
        default_locale: 'zh_CN', // 默认语言为英语
        name: '__MSG_extName__',
        description: '__MSG_extDescription__',
    },
});
