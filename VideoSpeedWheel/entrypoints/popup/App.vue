<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  getHostnameFromUrl,
  getMatchedConfig,
  getStorageKey,
  isSiteDisabled,
  setSiteDisabled,
} from "@/core/VideoSpeedConfig.js";
import { i18n } from '#i18n';
import ExtensionSupportPanel from '@/components/ExtensionSupportPanel.vue';
import { extensionSupportConfig } from '@/config/extensionSupport.config';
const t = i18n.t;

const DEFAULT_CONFIG = {
  step: 0.1,
  minRate: 0.25,
  maxRate: 16.0,
  rememberSpeed: true,
  lastRate: 1.0,
};

const configForm = ref({ ...DEFAULT_CONFIG });
const message = ref('');
const messageType = ref('');
const currentSite = ref('');
const currentHostname = ref('');
const speedConfigItem = ref(null);
const isSiteMatched = ref(true);
const siteDisabled = ref(false);
const canUseConfig = computed(() => isSiteMatched.value && !siteDisabled.value);

const siteStatus = computed(() => {
  if (!isSiteMatched.value) return 'unsupported';
  if (siteDisabled.value) return 'disabled';
  return 'active';
});

const loadConfig = async () => {
  try {
    const [activeTab] = await browser.tabs.query({
      active: true,
      currentWindow: true
    });

    if (!activeTab || !activeTab.url) {
      isSiteMatched.value = false;
      currentSite.value = t('siteInfo.unknown');
      currentHostname.value = '';
      siteDisabled.value = false;
      showMessage(t('message.noTabUrl'), 'error');
      return;
    }

    const hostname = getHostnameFromUrl(activeTab.url);
    currentHostname.value = hostname;
    currentSite.value = hostname || t('siteInfo.unknown');
    siteDisabled.value = hostname ? await isSiteDisabled(hostname) : false;

    const matchedConfig = getMatchedConfig(activeTab.url);
    if (!matchedConfig) {
      isSiteMatched.value = false;
      showMessage(t('message.noMatchedSite'), 'info');
      return;
    }

    isSiteMatched.value = true;
    if (siteDisabled.value) {
      showMessage(t('message.siteDisabled', [currentSite.value]), 'info');
      return;
    }
    speedConfigItem.value = storage.defineItem(getStorageKey(matchedConfig, hostname), {
      init: () => ({ ...DEFAULT_CONFIG, ...matchedConfig.defaultConfig }),
    });
    const savedConfig = await speedConfigItem.value.getValue();
    if (savedConfig) {
      configForm.value = { ...savedConfig };
    }
    showMessage(t('message.loadSuccess', [currentSite.value]), 'success');
  } catch (err) {
    showMessage(t('message.loadFail'), 'error');
    console.error('加载配置失败:', err);
  }
};

const onSiteDisabledChange = async (disabled) => {
  if (!currentHostname.value) return;

  try {
    await setSiteDisabled(currentHostname.value, disabled);
    siteDisabled.value = disabled;
    showMessage(
      disabled
        ? t('message.siteDisabled', [currentSite.value])
        : t('message.siteEnabled', [currentSite.value]),
      disabled ? 'info' : 'success'
    );
    if (!disabled && isSiteMatched.value) {
      await loadConfig();
    }
  } catch (err) {
    showMessage(t('message.saveFail'), 'error');
    console.error('更新站点禁用状态失败:', err);
  }
};

const saveConfig = async () => {
  try {
    if (!canUseConfig.value || !speedConfigItem.value) {
      showMessage(t('message.noSupportSave'), 'error');
      return;
    }

    if (configForm.value.minRate >= configForm.value.maxRate) {
      showMessage(t('message.minGtMax'), 'error');
      return;
    }
    if (configForm.value.step <= 0) {
      showMessage(t('message.stepInvalid'), 'error');
      return;
    }
    if (
        configForm.value.lastRate < configForm.value.minRate ||
        configForm.value.lastRate > configForm.value.maxRate
    ) {
      showMessage(t('message.lastRateRange', [
        configForm.value.minRate,
        configForm.value.maxRate,
      ]), 'error');
      return;
    }

    await speedConfigItem.value.setValue(configForm.value);
    showMessage(t('message.saveSuccess', [currentSite.value]), 'success');
  } catch (err) {
    showMessage(t('message.saveFail'), 'error');
    console.error('保存配置失败:', err);
  }
};

const resetConfig = () => {
  const matchedConfig = getMatchedConfig();
  if (matchedConfig) {
    configForm.value = { ...DEFAULT_CONFIG, ...matchedConfig.defaultConfig };
  } else {
    configForm.value = { ...DEFAULT_CONFIG };
  }
  saveConfig();
};

const showMessage = (text, type) => {
  message.value = text;
  messageType.value = type;
  setTimeout(() => {
    message.value = '';
    messageType.value = '';
  }, 3000);
};

onMounted(() => {
  loadConfig();
});

onUnmounted(() => {
  message.value = '';
});
</script>

<template>
  <div class="popup">
    <header class="popup-header">
      <div class="brand">
        <span class="brand-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        <span class="brand-name">{{ t('extName') }}</span>
      </div>
      <div class="site-badge" :class="siteStatus">
        <span class="status-dot" />
        <span class="site-host">{{ currentSite }}</span>
      </div>
    </header>

    <div
      v-if="!isSiteMatched || siteDisabled"
      class="alert-banner"
      :class="siteDisabled ? 'warn' : 'info'"
    >
      <span v-if="!isSiteMatched">{{ t('siteInfo.noSupport') }}</span>
      <span v-else>{{ t('siteInfo.disabledHint') }}</span>
    </div>

    <section v-if="currentHostname" class="card toggle-card">
      <label class="toggle-row">
        <span class="toggle-label">{{ t('form.disableOnSite.label') }}</span>
        <span class="toggle">
          <input
            type="checkbox"
            :checked="siteDisabled"
            @change="onSiteDisabledChange($event.target.checked)"
          />
          <span class="toggle-track" />
        </span>
      </label>
    </section>

    <section class="card config-card" :class="{ disabled: !canUseConfig }">
      <h2 class="section-title">{{ t('configPanel.title') }}</h2>

      <div class="field">
        <label class="field-label" for="step-input">{{ t('form.step.label') }}</label>
        <input
          id="step-input"
          type="number"
          step="0.05"
          v-model.number="configForm.step"
          :placeholder="t('form.step.placeholder')"
          :disabled="!canUseConfig"
          class="field-input"
        />
        <p class="field-hint">{{ t('form.step.tip') }}</p>
      </div>

      <div class="field-row">
        <div class="field">
          <label class="field-label" for="min-rate">{{ t('form.minRate.label') }}</label>
          <input
            id="min-rate"
            type="number"
            step="0.1"
            min="0.1"
            max="16.0"
            v-model.number="configForm.minRate"
            :placeholder="t('form.minRate.placeholder')"
            :disabled="!canUseConfig"
            class="field-input"
          />
        </div>
        <div class="field">
          <label class="field-label" for="max-rate">{{ t('form.maxRate.label') }}</label>
          <input
            id="max-rate"
            type="number"
            step="0.1"
            min="0.25"
            max="32.0"
            v-model.number="configForm.maxRate"
            :placeholder="t('form.maxRate.placeholder')"
            :disabled="!canUseConfig"
            class="field-input"
          />
        </div>
      </div>

      <label class="toggle-row">
        <span class="toggle-label">{{ t('form.rememberSpeed.label') }}</span>
        <span class="toggle">
          <input
            type="checkbox"
            v-model="configForm.rememberSpeed"
            :disabled="!canUseConfig"
          />
          <span class="toggle-track" />
        </span>
      </label>

      <div v-if="configForm.rememberSpeed" class="field field-nested">
        <label class="field-label" for="last-rate">{{ t('form.lastRate.label') }}</label>
        <input
          id="last-rate"
          type="number"
          step="0.1"
          :min="configForm.minRate"
          :max="configForm.maxRate"
          v-model.number="configForm.lastRate"
          :placeholder="t('form.lastRate.placeholder')"
          :disabled="!canUseConfig"
          class="field-input"
        />
      </div>

      <div class="btn-group">
        <button type="button" class="btn btn-primary" :disabled="!canUseConfig" @click="saveConfig">
          {{ t('button.save') }}
        </button>
        <button type="button" class="btn btn-secondary" :disabled="!canUseConfig" @click="resetConfig">
          {{ t('button.reset') }}
        </button>
      </div>
    </section>

    <ExtensionSupportPanel :config="extensionSupportConfig" />

    <Transition name="toast">
      <div v-if="message" class="toast" :class="messageType" role="status">
        {{ message }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.popup {
  width: 380px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.popup-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 4px 4px 2px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--vsw-accent) 0%, #2dd4bf 100%);
  color: #fff;
  box-shadow: 0 2px 8px var(--vsw-accent-ring);
}

.brand-icon svg {
  width: 14px;
  height: 14px;
  margin-left: 2px;
}

.brand-name {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--vsw-text);
}

.site-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 5px 12px;
  border-radius: 999px;
  background: var(--vsw-surface);
  border: 1px solid var(--vsw-border);
  box-shadow: var(--vsw-shadow);
}

.status-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--vsw-text-muted);
}

.site-badge.active .status-dot {
  background: var(--vsw-success);
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.2);
}

.site-badge.unsupported .status-dot {
  background: var(--vsw-warn);
}

.site-badge.disabled .status-dot {
  background: var(--vsw-danger);
}

.site-host {
  font-size: 12px;
  font-weight: 500;
  color: var(--vsw-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alert-banner {
  padding: 10px 12px;
  border-radius: var(--vsw-radius-sm);
  font-size: 12px;
  line-height: 1.5;
}

.alert-banner.info {
  background: var(--vsw-info-bg);
  color: var(--vsw-info);
  border: 1px solid rgba(37, 99, 235, 0.15);
}

.alert-banner.warn {
  background: var(--vsw-warn-bg);
  color: var(--vsw-warn);
  border: 1px solid rgba(217, 119, 6, 0.15);
}

.card {
  background: var(--vsw-surface);
  border: 1px solid var(--vsw-border);
  border-radius: var(--vsw-radius);
  box-shadow: var(--vsw-shadow);
  padding: 14px 16px;
}

.toggle-card {
  padding: 12px 16px;
}

.config-card.disabled {
  opacity: 0.55;
  pointer-events: none;
}

.section-title {
  margin: 0 0 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vsw-text-secondary);
  letter-spacing: 0.02em;
}

.field {
  margin-bottom: 12px;
}

.field-row {
  display: flex;
  gap: 10px;
  margin-bottom: 4px;
}

.field-row .field {
  flex: 1;
  min-width: 0;
}

.field-nested {
  margin-top: -4px;
  padding-left: 12px;
  border-left: 2px solid var(--vsw-accent-soft);
}

.field-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--vsw-text-secondary);
}

.field-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--vsw-border);
  border-radius: var(--vsw-radius-sm);
  background: var(--vsw-bg);
  font-size: 14px;
  color: var(--vsw-text);
  transition: border-color var(--vsw-transition), box-shadow var(--vsw-transition),
    background-color var(--vsw-transition);
}

.field-input:hover:not(:disabled) {
  border-color: #cbd5e1;
}

.field-input:focus {
  border-color: var(--vsw-border-focus);
  background: var(--vsw-surface);
  box-shadow: 0 0 0 3px var(--vsw-accent-ring);
  outline: none;
}

.field-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.field-hint {
  margin: 6px 0 0;
  font-size: 11px;
  color: var(--vsw-text-muted);
  line-height: 1.4;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.toggle-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--vsw-text-secondary);
}

.toggle {
  position: relative;
  flex-shrink: 0;
}

.toggle input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-track {
  display: block;
  width: 40px;
  height: 22px;
  border-radius: 999px;
  background: #cbd5e1;
  transition: background-color var(--vsw-transition);
  cursor: pointer;
}

.toggle-track::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.15);
  transition: transform var(--vsw-transition);
}

.toggle input:checked + .toggle-track {
  background: var(--vsw-accent);
}

.toggle input:checked + .toggle-track::after {
  transform: translateX(18px);
}

.toggle input:disabled + .toggle-track {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle input:focus-visible + .toggle-track {
  outline: 2px solid var(--vsw-border-focus);
  outline-offset: 2px;
}

.btn-group {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.btn {
  flex: 1;
  padding: 9px 12px;
  border: none;
  border-radius: var(--vsw-radius-sm);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--vsw-transition), transform 0.1s ease,
    box-shadow var(--vsw-transition);
}

.btn:active:not(:disabled) {
  transform: scale(0.98);
}

.btn-primary {
  background: var(--vsw-accent);
  color: #fff;
  box-shadow: 0 1px 2px var(--vsw-accent-ring);
}

.btn-primary:hover:not(:disabled) {
  background: var(--vsw-accent-hover);
}

.btn-secondary {
  background: var(--vsw-bg);
  color: var(--vsw-text-secondary);
  border: 1px solid var(--vsw-border);
}

.btn-secondary:hover:not(:disabled) {
  background: #e2e8f0;
  color: var(--vsw-text);
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.toast {
  position: fixed;
  bottom: 12px;
  left: 12px;
  right: 12px;
  padding: 10px 14px;
  border-radius: var(--vsw-radius-sm);
  font-size: 12px;
  font-weight: 500;
  text-align: center;
  box-shadow: var(--vsw-shadow-md);
  z-index: 100;
}

.toast.success {
  background: var(--vsw-success-bg);
  color: var(--vsw-success);
  border: 1px solid rgba(5, 150, 105, 0.2);
}

.toast.error {
  background: var(--vsw-danger-bg);
  color: var(--vsw-danger);
  border: 1px solid rgba(220, 38, 38, 0.2);
}

.toast.info {
  background: var(--vsw-info-bg);
  color: var(--vsw-info);
  border: 1px solid rgba(37, 99, 235, 0.2);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
