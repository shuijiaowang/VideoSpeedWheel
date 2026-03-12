// import { defineContentScript } from "#imports";
// import html2canvas from "html2canvas";
//
// // 等待元素加载
// async function waitForElement(selector: string, timeout = 30000): Promise<HTMLElement | null> {
//     return new Promise((resolve) => {
//         const checkElement = () => document.getElementById(selector);
//         const initialElement = checkElement();
//         if (initialElement) { resolve(initialElement); return; }
//         const observer = new MutationObserver(() => {
//             const el = checkElement();
//             if (el) { observer.disconnect(); resolve(el); }
//         });
//         observer.observe(document.body, { childList: true, subtree: true });
//         setTimeout(() => { observer.disconnect(); resolve(checkElement()); }, timeout);
//     });
// }
//
// // 渲染Canvas到页面并提示手动保存（核心修改）
// function renderCanvasToPage(canvas: HTMLCanvasElement) {
//     // 1. 创建遮罩层
//     const overlay = document.createElement("div");
//     overlay.style.cssText = `
//     position: fixed;
//     top: 0;
//     left: 0;
//     width: 100vw;
//     height: 100vh;
//     background: rgba(0,0,0,0.8);
//     z-index: 999999;
//     display: flex;
//     flex-direction: column;
//     align-items: center;
//     padding: 20px;
//     box-sizing: border-box;
//   `;
//
//     // 2. 创建提示文字
//     const tip = document.createElement("div");
//     tip.textContent = "✅ 截图生成完成！右键图片 → 『图片另存为』保存到本地";
//     tip.style.cssText = `
//     color: white;
//     font-size: 18px;
//     margin-bottom: 10px;
//     font-weight: bold;
//   `;
//
//     // 3. 创建关闭按钮
//     const closeBtn = document.createElement("button");
//     closeBtn.textContent = "关闭";
//     closeBtn.style.cssText = `
//     padding: 8px 16px;
//     background: #ff4444;
//     color: white;
//     border: none;
//     border-radius: 4px;
//     cursor: pointer;
//     margin-bottom: 10px;
//   `;
//     closeBtn.onclick = () => document.body.removeChild(overlay);
//
//     // 4. 创建可滚动的图片容器（适配超长图）
//     const scrollContainer = document.createElement("div");
//     scrollContainer.style.cssText = `
//     max-width: 90%;
//     max-height: 85vh;
//     overflow: auto;
//     border: 2px solid white;
//     background: white;
//   `;
//     scrollContainer.appendChild(canvas);
//
//     // 5. 组装并插入到页面
//     overlay.appendChild(tip);
//     overlay.appendChild(closeBtn);
//     overlay.appendChild(scrollContainer);
//     document.body.appendChild(overlay);
//
//     // 调整Canvas样式，让它完整显示
//     canvas.style.maxWidth = "100%";
//     canvas.style.height = "auto";
//     canvas.style.display = "block";
// }
//
// export default defineContentScript({
//     matches: ['https://www.behance.net/gallery/*'],
//     runAt: 'document_end',
//     allFrames: false,
//
//     async main() {
//         console.log("脚本启动，查找目标元素...");
//         const targetElement = await waitForElement("primary-project-content");
//         if (!targetElement) { alert("未找到目标元素！"); return; }
//         console.log("目标元素尺寸：", targetElement.scrollWidth, "x", targetElement.scrollHeight);
//
//         try {
//             const canvas = await html2canvas(targetElement, {
//                 allowTaint: true,        // ✅ 允许跨域污染，保证能生成Canvas
//                 useCORS: false,          // ✅ 关闭CORS校验
//                 scale: 1,                // ✅ 降低缩放，避免内存溢出
//                 logging: false,
//                 letterRendering: true,
//                 scrollX: 0,
//                 scrollY: 0,
//                 windowWidth: targetElement.scrollWidth,
//                 windowHeight: targetElement.scrollHeight,
//             });
//
//             console.log("Canvas生成成功，尺寸：", canvas.width, "x", canvas.height);
//             // ✅ 直接渲染到页面，不再调用toBlob/toDataURL
//             renderCanvasToPage(canvas);
//             alert("截图已渲染到页面！请右键图片保存为JPG/PNG");
//
//         } catch (error) {
//             console.error("截图失败：", error);
//             alert(`截图失败：${(error as Error).message}`);
//         }
//     },
// });