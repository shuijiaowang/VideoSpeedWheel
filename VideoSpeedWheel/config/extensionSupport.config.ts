/**
 * 扩展说明 / 赏赞 / 链接配置
 * 复制本文件与 components/ExtensionSupportPanel.vue 到其他 WXT 项目即可复用。
 * 二维码图片请放到 public/ 目录，路径相对于扩展根（如 /donate/wechat.png）。
 */
export interface DonationItem {
  /** 唯一标识，用于 i18n key 或自定义 label */
  id: 'wechat' | 'alipay' | 'kofi' | string;
  /** 展示名称，不填则使用 i18n */
  label?: string;
  /** public 下的二维码图片路径 */
  qrImage?: string;
  /** 点击二维码或按钮打开的链接（Ko-fi 等） */
  link?: string;
}

export interface ExtensionSupportLinks {
  website?: string;
}

export interface ExtensionSupportConfig {
  /** 简短说明，支持 HTML 或纯文本 */
  description?: string;
  /** 使用说明条目 */
  instructions?: string[];
  donations?: DonationItem[];
  links?: ExtensionSupportLinks;
}

/** 当前项目的默认配置 —— 按需修改链接与图片路径 */
export const extensionSupportConfig: ExtensionSupportConfig = {
  description:
    '轻量高效的视频倍速调节工具，支持鼠标滚轮与键盘快捷键，多平台个性化配置与速率记忆。',
  instructions: [
    '将鼠标悬停在视频页倍速区域，滚轮上下即可调节播放速度',
    'Win+Alt+↑/↓ 模拟滚轮调节；Win+Alt+数字 直接设置指定倍速',
    '点击扩展图标可为本站单独配置步长、速率范围与记忆选项',
  ],
  donations: [
    {
      id: 'wechat',
      qrImage: '/donate/wechat.png',
    },
    {
      id: 'alipay',
      qrImage: '/donate/alipay.png',
    },
    {
      id: 'kofi',
      qrImage: '/donate/kofi.png',
      link: 'https://ko-fi.com/sleepking324',
    },
  ],
  links: {
    website: 'https://works.lyyxy.top/projects/videospeed',
  },
};
