/** 通用模式：overlay 按 video 的 getBoundingClientRect 做 fixed 定位；light DOM 挂 video 后，open Shadow 挂 shadowRoot */

const OVERLAY_ATTR = 'data-video-speed-wheel';
const MOUNT_LIGHT = 'light';
const MOUNT_SHADOW = 'shadow';
const OVERLAY_INSET_RIGHT = 8;
const MIN_VIDEO_PX = 80;
const HOT_RIGHT = 0.1;
const HOT_TOP = 0.4;
const HOT_BOTTOM = 0.6;
const SCAN_DEBOUNCE_MS = 500;
const POLL_INTERVAL_MS = 2000;

const OVERLAY_BASE_STYLE = `
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

const OVERLAY_POSITIONED_STYLE = `
    position: fixed;
    left: 0;
    top: 0;
    transform: translate(-100%, -50%);
    ${OVERLAY_BASE_STYLE}
`;

function formatRate(rate) {
    return `${Number(rate.toFixed(2))}x`;
}

function getOpenShadowRoot(video) {
    const root = video.getRootNode();
    return root instanceof ShadowRoot ? root : null;
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

function isPointerOnOverlay(clientX, clientY) {
    const elements = document.elementsFromPoint(clientX, clientY);
    return elements.some(el =>
        el.getAttribute?.(OVERLAY_ATTR) === 'general-speed-overlay'
        || el.closest?.(`[${OVERLAY_ATTR}="general-speed-overlay"]`)
    );
}

function getWheelDirection(deltaY) {
    return deltaY > 0 ? -1 : 1;
}

export class GeneralSpeedOverlay {
    constructor(controller) {
        this.controller = controller;
        /** @type {Map<HTMLVideoElement, { el: HTMLElement, mount: string }>} */
        this.entries = new Map();
        this.activeVideo = null;
        this.hoveringOverlay = false;
        this.moveRafId = 0;
        this.pendingMove = null;
        this.scanTimer = null;
        this.pollTimer = null;
        this.repositionRafId = 0;

        this.handleDocumentMouseMove = this.handleDocumentMouseMove.bind(this);
        this.handleDocumentWheel = this.handleDocumentWheel.bind(this);
        this.handleReposition = this.scheduleReposition.bind(this);
        this.handleOverlayMouseEnter = this.handleOverlayMouseEnter.bind(this);
        this.handleOverlayMouseLeave = this.handleOverlayMouseLeave.bind(this);
        this.handleOverlayWheel = this.handleOverlayWheel.bind(this);
    }

    start() {
        this.scheduleVideoScan(true);
        document.addEventListener('mousemove', this.handleDocumentMouseMove, {passive: true});
        document.addEventListener('wheel', this.handleDocumentWheel, {capture: true, passive: false});
        window.addEventListener('scroll', this.handleReposition, true);
        window.addEventListener('resize', this.handleReposition, {passive: true});
        this.pollTimer = setInterval(() => this.scheduleVideoScan(), POLL_INTERVAL_MS);
    }

    destroy() {
        document.removeEventListener('mousemove', this.handleDocumentMouseMove);
        document.removeEventListener('wheel', this.handleDocumentWheel, true);
        window.removeEventListener('scroll', this.handleReposition, true);
        window.removeEventListener('resize', this.handleReposition);
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
        if (this.repositionRafId) {
            cancelAnimationFrame(this.repositionRafId);
            this.repositionRafId = 0;
        }
        for (const {el} of this.entries.values()) {
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
            const entry = this.entries.get(video);
            if (!entry || !entry.el.isConnected) {
                entry?.el.remove();
                this.entries.delete(video);
                this.attachToVideo(video);
            }
        }

        for (const [video, {el}] of this.entries) {
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

        if (this.activeVideo?.isConnected) {
            const entry = this.entries.get(this.activeVideo);
            if (entry?.el.style.display === 'flex') {
                this.positionOverlay(this.activeVideo, entry);
            }
        }
    }

    createOverlayElement(mount) {
        const el = document.createElement('div');
        el.setAttribute(OVERLAY_ATTR, 'general-speed-overlay');
        el.dataset.vswMount = mount;
        el.textContent = formatRate(this.controller.config?.lastRate ?? 1);
        el.style.cssText = OVERLAY_POSITIONED_STYLE;
        el.addEventListener('mouseenter', this.handleOverlayMouseEnter);
        el.addEventListener('mouseleave', this.handleOverlayMouseLeave);
        el.addEventListener('wheel', this.handleOverlayWheel, {passive: false});
        return el;
    }

    attachToVideo(video) {
        const shadowRoot = getOpenShadowRoot(video);
        if (shadowRoot) {
            this.attachToVideoInShadow(video, shadowRoot);
            return;
        }

        const next = video.nextElementSibling;
        if (next?.getAttribute(OVERLAY_ATTR) === 'general-speed-overlay') {
            this.entries.set(video, {
                el: next,
                mount: next.dataset.vswMount || MOUNT_LIGHT,
            });
            return;
        }

        const parent = video.parentElement;
        if (!parent) return;

        const el = this.createOverlayElement(MOUNT_LIGHT);
        video.insertAdjacentElement('afterend', el);
        this.entries.set(video, {el, mount: MOUNT_LIGHT});
    }

    attachToVideoInShadow(video, shadowRoot) {
        const el = this.createOverlayElement(MOUNT_SHADOW);
        shadowRoot.appendChild(el);
        this.entries.set(video, {el, mount: MOUNT_SHADOW});
    }

    positionOverlay(video, entry) {
        const {el} = entry;
        const rect = video.getBoundingClientRect();
        if (rect.width < MIN_VIDEO_PX || rect.height < MIN_VIDEO_PX) {
            el.style.display = 'none';
            return;
        }

        el.style.left = `${rect.right - OVERLAY_INSET_RIGHT}px`;
        el.style.top = `${rect.top + rect.height / 2}px`;
        el.style.transform = 'translate(-100%, -50%)';
    }

    setActiveVideo(video) {
        if (this.activeVideo === video) return;

        if (this.activeVideo) {
            const prev = this.entries.get(this.activeVideo);
            if (prev) prev.el.style.display = 'none';
        }

        this.activeVideo = video;

        if (video) {
            const entry = this.entries.get(video);
            if (entry) {
                const rect = video.getBoundingClientRect();
                if (rect.width >= MIN_VIDEO_PX && rect.height >= MIN_VIDEO_PX) {
                    this.positionOverlay(video, entry);
                    entry.el.style.display = 'flex';
                }
            }
        }
    }

    hideUnlessHovering() {
        if (this.hoveringOverlay) return;
        this.setActiveVideo(null);
        this.controller.isHovering = false;
    }

    scheduleReposition() {
        if (!this.activeVideo) return;
        if (this.repositionRafId) return;
        this.repositionRafId = requestAnimationFrame(() => {
            this.repositionRafId = 0;
            const entry = this.entries.get(this.activeVideo);
            if (entry && this.activeVideo?.isConnected && entry.el.style.display === 'flex') {
                this.positionOverlay(this.activeVideo, entry);
            }
        });
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
        if (isPointerOnOverlay(clientX, clientY)) {
            return;
        }

        const hitVideo = this.findVideoInHotZone(clientX, clientY);

        if (hitVideo) {
            this.setActiveVideo(hitVideo);
        } else if (this.activeVideo) {
            this.hideUnlessHovering();
        }
    }

    findVideoInHotZone(clientX, clientY) {
        for (const video of this.entries.keys()) {
            if (!video.isConnected) continue;
            if (isInHotZone(video, clientX, clientY)) {
                return video;
            }
        }
        return null;
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
        const direction = getWheelDirection(event.deltaY);
        this.controller.changeRateByStep(direction);
    }

    handleDocumentWheel(event) {
        if (!this.controller.config) return;

        const {clientX, clientY} = event;
        const isOnOverlay = isPointerOnOverlay(clientX, clientY);
        const hitVideo = this.findVideoInHotZone(clientX, clientY);
        const shouldHandle = Boolean(isOnOverlay || hitVideo);

        if (!shouldHandle) return;

        event.preventDefault();
        event.stopPropagation();

        if (hitVideo) {
            this.setActiveVideo(hitVideo);
        }
        this.controller.changeRateByStep(getWheelDirection(event.deltaY));
    }

    updateAllTexts(rate) {
        const text = formatRate(rate);
        for (const {el} of this.entries.values()) {
            el.textContent = text;
        }
    }
}
