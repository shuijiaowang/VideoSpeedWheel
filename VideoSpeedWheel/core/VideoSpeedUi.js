

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