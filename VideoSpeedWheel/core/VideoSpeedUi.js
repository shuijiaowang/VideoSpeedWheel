

export function createYouTubeSpeedDisplay() {
    // 检查是否已创建过，避免重复
    if (document.getElementById('custom-speed-display')) return;

    // 创建显示倍速的容器
    const speedDisplay = document.createElement('div');
    speedDisplay.id = 'custom-speed-display';
    speedDisplay.className = 'ytp-button custom-speed-display'; // 复用ytp-button类保持样式统一
    speedDisplay.style.cssText = `
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #fff;
                    font-family: Roboto, Arial, sans-serif;
                    font-size: 14px;
                    padding: 0 8px;
                    height: 100%;
                    cursor: default; // 取消鼠标指针变化，强调无交互
                    user-select: none; // 禁止文本选中
                `;
    speedDisplay.textContent = '1.0x'; // 默认显示1.0倍速

    // 找到插入位置（ytp-right-controls-left第一个子元素前）
    const targetContainer = document.querySelector('.ytp-right-controls-left');
    if (targetContainer) {
        // 插入到"展开按钮"之后，自动播放按钮之前
        const firstButton = targetContainer.querySelector('.ytp-expand-right-bottom-section-button');
        if (firstButton) {
            targetContainer.insertBefore(speedDisplay, firstButton.nextSibling);
        } else {
            targetContainer.prepend(speedDisplay);
        }
    }
}

//在推特的视频元素上插入一个倍速播放按钮
// document.querySelectorAll('[data-testid="videoComponent"] [dir="ltr"]')[3]的父亲是个button的父亲是个div的父亲是个div的后面插入一个亲兄弟,显示内容为1.0X
//直接复制所有dom并在它后面插入一个一模一样的,修改复制品内容即可
//<div><div class="css-175oi2r"><button aria-label="视频设置" role="button" class="css-175oi2r r-sdzlij r-1phboty r-rs99b7 r-lrvibr r-2yi16 r-1qi8awa r-1loqt21 r-o7ynqc r-6416eg r-1ny4l3l" type="button" style="border-color: rgba(0, 0, 0, 0); background-color: rgba(0, 0, 0, 0);"><div dir="ltr" class="css-146c3p1 r-qvutc0 r-37j5jr r-q4m81j r-a023e6 r-rjixqe r-b88u0q r-1awozwy r-6koalj r-18u37iz r-16y2uox r-bcqeeo r-1777fci" style="color: rgb(255, 255, 255); cursor: pointer;"><svg viewBox="0 0 24 24" aria-hidden="true" class="r-4qtqp9 r-yyyyoo r-dnmrzs r-bnwqim r-lrvibr r-m6rgpd r-z80fyv r-19wmn03" style="color: rgb(255, 255, 255); cursor: pointer;"><g><path d="M10.54 1.75h2.92l1.57 2.36c.11.17.32.25.53.21l2.53-.59 2.17 2.17-.58 2.54c-.05.2.04.41.21.53l2.36 1.57v2.92l-2.36 1.57c-.17.12-.26.33-.21.53l.58 2.54-2.17 2.17-2.53-.59c-.21-.04-.42.04-.53.21l-1.57 2.36h-2.92l-1.58-2.36c-.11-.17-.32-.25-.52-.21l-2.54.59-2.17-2.17.58-2.54c.05-.2-.03-.41-.21-.53l-2.35-1.57v-2.92L4.1 8.97c.18-.12.26-.33.21-.53L3.73 5.9 5.9 3.73l2.54.59c.2.04.41-.04.52-.21l1.58-2.36zm1.07 2l-.98 1.47C10.05 6.08 9 6.5 7.99 6.27l-1.46-.34-.6.6.33 1.46c.24 1.01-.18 2.07-1.05 2.64l-1.46.98v.78l1.46.98c.87.57 1.29 1.63 1.05 2.64l-.33 1.46.6.6 1.46-.34c1.01-.23 2.06.19 2.64 1.05l.98 1.47h.78l.97-1.47c.58-.86 1.63-1.28 2.65-1.05l1.45.34.61-.6-.34-1.46c-.23-1.01.18-2.07 1.05-2.64l1.47-.98v-.78l-1.47-.98c-.87-.57-1.28-1.63-1.05-2.64l.34-1.46-.61-.6-1.45.34c-1.02.23-2.07-.19-2.65-1.05l-.97-1.47h-.78zM12 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5c.82 0 1.5-.67 1.5-1.5s-.68-1.5-1.5-1.5zM8.5 12c0-1.93 1.56-3.5 3.5-3.5 1.93 0 3.5 1.57 3.5 3.5s-1.57 3.5-3.5 3.5c-1.94 0-3.5-1.57-3.5-3.5z" style="cursor: pointer;"></path></g></svg><div class="css-175oi2r r-xoduu5"><span class="css-1jxf684 r-dnmrzs r-1udh08x r-1udbk01 r-3s2u2q r-bcqeeo r-1ttztb7 r-qvutc0 r-poiln3 r-a023e6 r-rjixqe"></span></div></div></button></div></div>
//然后修改aria-label="视频设置，移除图标，显示为1.0X

export function createTwitterSpeedDisplay(rate = 1.0) {
    const videoComponents = Array.from(document.querySelectorAll('[data-testid="videoComponent"]'));
    const displayText = `${Number(rate.toFixed(2))}x`;

    videoComponents.forEach(videoComponent => {
        const settingButton = videoComponent.querySelector(
            'button[aria-label*="视频设置"], button[aria-label*="Video settings"], button[aria-label*="Settings"]'
        );
        const buttonTextTargets = Array.from(videoComponent.querySelectorAll('[dir="ltr"]'))
            .filter(element => element.closest('button'));
        const textTarget = settingButton?.querySelector('[dir="ltr"]')
            || buttonTextTargets[3]
            || buttonTextTargets[buttonTextTargets.length - 1];
        const button = settingButton || textTarget?.closest('button');
        const wrapper = button?.parentElement?.parentElement;
        const container = wrapper?.parentElement;

        if (!wrapper || !container || container.querySelector('[data-video-speed-wheel="twitter-speed-display"]')) {
            return;
        }

        // Twitter/X 会频繁卸载控制条，clone 原生按钮能最大程度保持当前主题样式。
        const clone = wrapper.cloneNode(true);
        clone.classList.add('custom-speed-display');
        clone.setAttribute('data-video-speed-wheel', 'twitter-speed-display');

        const btn = clone.querySelector('button');
        if (btn) {
            btn.setAttribute('aria-label', '播放速度');
            btn.setAttribute('type', 'button');
            btn.style.cursor = 'n-resize';
            btn.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
            });
        }

        clone.querySelectorAll('svg, span').forEach(element => element.remove());

        const textContainer = clone.querySelector('[dir="ltr"]');
        if (textContainer) {
            textContainer.setAttribute('data-video-speed-wheel', 'twitter-speed-text');
            textContainer.textContent = displayText;
            textContainer.style.display = 'flex';
            textContainer.style.alignItems = 'center';
            textContainer.style.justifyContent = 'center';
            textContainer.style.minWidth = '40px';
            textContainer.style.fontSize = '14px';
            textContainer.style.fontWeight = '500';
            textContainer.style.color = '#fff';
            textContainer.style.cursor = 'n-resize';
        }

        wrapper.after(clone);
    });
}
