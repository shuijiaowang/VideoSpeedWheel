
//小红书的播放器在第一次加载播放过程中，video元素是空壳，不能直接通过通过document.querySelector("video").playbackRate=5修改倍速
//需要等待视频缓存到本地后才可以。
//或是直接调用window属性实例
// 没用
// for (const k in window) {
//     try {
//         const v = window[k];

//         if (
//             v &&
//             typeof v === "object" &&
//             typeof v.switchPlaybackRate === "function" &&
//             v.video instanceof HTMLVideoElement
//         ) {
//             console.log("找到播放器", k, v);
//         }
//     } catch {}
// }