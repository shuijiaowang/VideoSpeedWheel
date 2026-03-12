import { defineContentScript } from "#imports";

// 等待元素加载（保留核心等待逻辑）
async function waitForElement(selector: string, timeout = 30000): Promise<HTMLElement | null> {
    return new Promise((resolve) => {
        const checkElement = () => document.getElementById(selector);
        const initialElement = checkElement();
        if (initialElement) { resolve(initialElement); return; }

        const observer = new MutationObserver(() => {
            const el = checkElement();
            if (el) { observer.disconnect(); resolve(el); }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => {
            observer.disconnect();
            resolve(checkElement());
        }, timeout);
    });
}

// 收集目标元素下所有图片链接并打印
async function collectAndPrintAllImageUrls(element: HTMLElement) {
    // 获取元素下所有img标签
    const imgElements = element.querySelectorAll('img');
    // 用于存储有效链接的数组
    const imageUrls: string[] = [];

    if (imgElements.length === 0) {
        console.log("⚠️ 未找到任何图片元素");
        return;
    }

    console.log(`✅ 共找到 ${imgElements.length} 张图片，开始收集链接：`);

    // 遍历所有图片收集链接
    for (let i = 0; i < imgElements.length; i++) {
        const img = imgElements[i];
        // 优先取 data-src（懒加载图片），无则取 src
        const imgUrl = img.dataset.src || img.src;

        if (!imgUrl) {
            console.warn(`⚠️ 第 ${i+1} 张图片无有效链接，跳过`);
            continue;
        }

        // 存入数组并打印单条链接
        imageUrls.push(imgUrl);
        console.log(`📌 第 ${i+1} 张图片链接：`, imgUrl);
    }

    // 最后打印所有有效链接的汇总（方便复制）
    console.log("\n📋 所有有效图片链接汇总：");
    console.log(imageUrls.join('\n'));
    console.log(`\n✅ 收集完成！共获取 ${imageUrls.length} 个有效图片链接`);
}

export default defineContentScript({
    matches: ['https://www.behance.net/gallery/*'],
    runAt: 'document_end',
    allFrames: false,

    async main() {
        console.log("🔍 脚本启动，查找目标元素...");
        const targetElement = await waitForElement("primary-project-content");

        if (!targetElement) {
            console.error("❌ 未找到目标元素（primary-project-content）！");
            return;
        }

        console.log("✅ 找到目标元素，开始收集图片链接...");
        // 执行收集并打印链接的逻辑
        await collectAndPrintAllImageUrls(targetElement);
    },
});