/** 通用模式：在 video 后插入兄弟节点作倍速钮，相对父容器绝对定位（右侧） */

const OVERLAY_ATTR = 'data-video-speed-wheel';
const PARENT_FLAG = 'data-video-speed-wheel-parent';
const MIN_VIDEO_PX = 80;
const HOT_RIGHT = 0.1;
const HOT_TOP = 0.4;
const HOT_BOTTOM = 0.6;
const SCAN_DEBOUNCE_MS = 500;
const POLL_INTERVAL_MS = 2000;

const OVERLAY_STYLE = `
    position: absolute;
    right: 4%;
    left: auto;
    top: 50%;
    transform: translateY(-50%);
    z-index: 2147483647;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 4px 8px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.65);
    color: #fff;
    font: 500 13px/1.2 system-ui, sans-serif;
    user-select: none;
    pointer-events: auto;
    cursor: n-resize;
    box-shadow: 0 1px 4px rgba(0,0,0,0.35);
`;

function formatRate(rate) {
    return `${Number(rate.toFixed(2))}x`;
}

function isOurOverlayNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    if (node.getAttribute?.(OVERLAY_ATTR) === 'general-speed-overlay') return true;
    return Boolean(node.querySelector?.(`[${OVERLAY_ATTR}="general-speed-overlay"]`));
}

function isLikelyVideoHost(node) {
    const tag = (node.tagName || '').toLowerCase();
    return tag.includes('shreddit') && tag.includes('player');
}

export function nodeMayContainVideo(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    if (isOurOverlayNode(node)) return false;
    if (node.tagName === 'VIDEO' || node.tagName === 'IFRAME') return true;
    if (isLikelyVideoHost(node)) return true;
    return Boolean(node.querySelector?.('video, iframe, shreddit-player, shreddit-player-2'));
}

function isInHotZone(video, clientX, clientY) {
    const rect = video.getBoundingClientRect();
    if (rect.width < MIN_VIDEO_PX || rect.height < MIN_VIDEO_PX) return false;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return false;
    return x >= rect.width * (1 - HOT_RIGHT)
        && y >= rect.height * HOT_TOP
        && y <= rect.height * HOT_BOTTOM;
}

function ensureParentPositioned(parent) {
    if (!parent || parent.hasAttribute(PARENT_FLAG)) return;
    const pos = getComputedStyle(parent).position;
    if (pos === 'static') {
        parent.style.position = 'relative';
    }
    parent.setAttribute(PARENT_FLAG, '1');
}

export class GeneralSpeedOverlay {
    constructor(controller) {
        this.controller = controller;
        /** @type {Map<HTMLVideoElement, HTMLElement>} */
        this.entries = new Map();
        this.activeVideo = null;
        this.hoveringOverlay = false;
        this.moveRafId = 0;
        this.pendingMove = null;
        this.scanTimer = null;
        this.pollTimer = null;

        this.handleDocumentMouseMove = this.handleDocumentMouseMove.bind(this);
        this.handleOverlayMouseEnter = this.handleOverlayMouseEnter.bind(this);
        this.handleOverlayMouseLeave = this.handleOverlayMouseLeave.bind(this);
        this.handleOverlayWheel = this.handleOverlayWheel.bind(this);
    }

    start() {
        this.scheduleVideoScan(true);
        document.addEventListener('mousemove', this.handleDocumentMouseMove, {passive: true});
        this.pollTimer = setInterval(() => this.scheduleVideoScan(), POLL_INTERVAL_MS);
    }

    destroy() {
        document.removeEventListener('mousemove', this.handleDocumentMouseMove);
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        if (this.scanTimer) {
            clearTimeout(this.scanTimer);
            this.scanTimer = null;
        }
        if (this.moveRafId) {
            cancelAnimationFrame(this.moveRafId);
            this.moveRafId = 0;
        }
        for (const el of this.entries.values()) {
            el.remove();
        }
        this.entries.clear();
        this.activeVideo = null;
        this.hoveringOverlay = false;
        this.controller.isHovering = false;
    }

    scheduleVideoScan(immediate = false) {
        if (immediate) {
            if (this.scanTimer) {
                clearTimeout(this.scanTimer);
                this.scanTimer = null;
            }
            this.refreshVideos();
            return;
        }
        if (this.scanTimer) return;
        this.scanTimer = setTimeout(() => {
            this.scanTimer = null;
            this.refreshVideos();
        }, SCAN_DEBOUNCE_MS);
    }

    refreshVideos() {
        const videos = this.controller.getAllVideoElements()
            .filter(video => video.ownerDocument === document && video.isConnected);
        const alive = new Set(videos);

        for (const video of videos) {
            if (!this.entries.has(video)) {
                this.attachToVideo(video);
            }
        }

        for (const [video, el] of this.entries) {
            if (!alive.has(video) || !video.isConnected) {
                el.remove();
                this.entries.delete(video);
                if (this.activeVideo === video) {
                    this.activeVideo = null;
                }
            }
        }

        const rate = this.controller.config?.lastRate ?? 1;
        this.updateAllTexts(rate);
    }

    createOverlayElement() {
        const el = document.createElement('div');
        el.setAttribute(OVERLAY_ATTR, 'general-speed-overlay');
        el.textContent = formatRate(this.controller.config?.lastRate ?? 1);
        el.style.cssText = OVERLAY_STYLE;
        el.addEventListener('mouseenter', this.handleOverlayMouseEnter);
        el.addEventListener('mouseleave', this.handleOverlayMouseLeave);
        el.addEventListener('wheel', this.handleOverlayWheel, {passive: false});
        return el;
    }

    attachToVideo(video) {
        const next = video.nextElementSibling;
        if (next?.getAttribute(OVERLAY_ATTR) === 'general-speed-overlay') {
            this.entries.set(video, next);
            return;
        }

        const parent = video.parentElement;
        if (!parent) return;

        ensureParentPositioned(parent);
        const el = this.createOverlayElement();
        video.insertAdjacentElement('afterend', el);
        this.entries.set(video, el);
    }

    setActiveVideo(video) {
        if (this.activeVideo === video) return;

        if (this.activeVideo) {
            const prev = this.entries.get(this.activeVideo);
            if (prev) prev.style.display = 'none';
        }

        this.activeVideo = video;

        if (video) {
            const el = this.entries.get(video);
            if (el) {
                const rect = video.getBoundingClientRect();
                if (rect.width >= MIN_VIDEO_PX && rect.height >= MIN_VIDEO_PX) {
                    el.style.display = 'flex';
                }
            }
        }
    }

    hideUnlessHovering() {
        if (this.hoveringOverlay) return;
        this.setActiveVideo(null);
        this.controller.isHovering = false;
    }

    handleDocumentMouseMove(event) {
        this.pendingMove = event;
        if (this.moveRafId) return;
        this.moveRafId = requestAnimationFrame(() => {
            this.moveRafId = 0;
            const e = this.pendingMove;
            if (!e) return;
            this.processMouseMove(e);
        });
    }

    processMouseMove(event) {
        if (this.hoveringOverlay) return;

        const {clientX, clientY} = event;
        const hit = document.elementFromPoint(clientX, clientY);
        if (hit?.closest?.(`[${OVERLAY_ATTR}="general-speed-overlay"]`)) {
            return;
        }

        let hitVideo = null;
        for (const video of this.entries.keys()) {
            if (!video.isConnected) continue;
            if (isInHotZone(video, clientX, clientY)) {
                hitVideo = video;
                break;
            }
        }

        if (hitVideo) {
            this.setActiveVideo(hitVideo);
        } else if (this.activeVideo) {
            this.hideUnlessHovering();
        }
    }

    handleOverlayMouseEnter() {
        this.hoveringOverlay = true;
        this.controller.isHovering = true;
    }

    handleOverlayMouseLeave() {
        this.hoveringOverlay = false;
        this.controller.isHovering = false;
        this.hideUnlessHovering();
    }

    handleOverlayWheel(event) {
        event.preventDefault();
        event.stopPropagation();
        if (!this.controller.config) return;
        const direction = event.deltaY > 0 ? -1 : 1;
        this.controller.changeRateByStep(direction);
    }

    updateAllTexts(rate) {
        const text = formatRate(rate);
        for (const el of this.entries.values()) {
            el.textContent = text;
        }
    }
}
