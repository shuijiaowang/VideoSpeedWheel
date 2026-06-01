<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  getHostnameFromUrl,
  getMatchedConfig,
  isSiteDisabled,
  setSiteDisabled,
} from "@/core/VideoSpeedConfig.js";
import { i18n } from '#i18n';
const t = i18n.t; // 简化i18n调用

// 全局默认配置
const DEFAULT_CONFIG = {
  step: 0.1,
  minRate: 0.25,
  maxRate: 16.0,
  rememberSpeed: true,
  lastRate: 1.0,
};

// 响应式数据
const configForm = ref({ ...DEFAULT_CONFIG });
const message = ref('');
const messageType = ref('');
const currentSite = ref('');
const currentHostname = ref('');
const speedConfigItem = ref(null);
const isSiteMatched = ref(true);
const siteDisabled = ref(false);
const canUseConfig = computed(() => isSiteMatched.value && !siteDisabled.value);

// 加载配置
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
      showMessage(t('message.siteDisabled', { site: currentSite.value }), 'info');
      return;
    }
    speedConfigItem.value = storage.defineItem(matchedConfig.storageKey, {
      init: () => ({ ...DEFAULT_CONFIG, ...matchedConfig.defaultConfig }),
    });
    const savedConfig = await speedConfigItem.value.getValue();
    if (savedConfig) {
      configForm.value = { ...savedConfig };
    }
    showMessage(t('message.loadSuccess', { site: currentSite.value }), 'success');
  } catch (err) {
    showMessage(t('message.loadFail'), 'error');
    console.error('加载配置失败:', err);
  }
};

// 保存配置
const onSiteDisabledChange = async (event) => {
  const disabled = event.target.checked;
  if (!currentHostname.value) return;

  try {
    await setSiteDisabled(currentHostname.value, disabled);
    siteDisabled.value = disabled;
    showMessage(
      disabled
        ? t('message.siteDisabled', { site: currentSite.value })
        : t('message.siteEnabled', { site: currentSite.value }),
      disabled ? 'info' : 'success'
    );
    if (!disabled && isSiteMatched.value) {
      await loadConfig();
    }
  } catch (err) {
    event.target.checked = !disabled;
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

    // 合法性校验
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
      showMessage(t('message.lastRateRange', {
        min: configForm.value.minRate,
        max: configForm.value.maxRate
      }), 'error');
      return;
    }

    await speedConfigItem.value.setValue(configForm.value);
    showMessage(t('message.saveSuccess', { site: currentSite.value }), 'success');
  } catch (err) {
    showMessage(t('message.saveFail'), 'error');
    console.error('保存配置失败:', err);
  }
};

// 重置配置
const resetConfig = () => {
  const matchedConfig = getMatchedConfig();
  if (matchedConfig) {
    configForm.value = { ...DEFAULT_CONFIG, ...matchedConfig.defaultConfig };
  } else {
    configForm.value = { ...DEFAULT_CONFIG };
  }
  saveConfig();
};

// 提示消息封装
const showMessage = (text, type) => {
  message.value = text;
  messageType.value = type;
  setTimeout(() => {
    message.value = '';
    messageType.value = '';
  }, 3000);
};

// 生命周期
onMounted(() => {
  loadConfig();
});

onUnmounted(() => {
  message.value = '';
});
</script>

<template>
  <div class="popup-container">
    <!-- 站点信息 -->
    <div class="site-info">
      <h4>{{ t('siteInfo.currentSite') }}：{{ currentSite }}</h4>
      <p v-if="!isSiteMatched" class="warn-text">
        {{ t('siteInfo.noSupport') }}
      </p>
      <p v-else-if="siteDisabled" class="warn-text">
        {{ t('siteInfo.disabledHint') }}
      </p>
      <div v-if="currentHostname" class="form-item switch-item site-disable-item">
        <label>{{ t('form.disableOnSite.label') }}：</label>
        <input
          type="checkbox"
          :checked="siteDisabled"
          @change="onSiteDisabledChange"
        />
      </div>
    </div>

    <!-- 配置面板 -->
    <div class="config-panel" :class="{ disabled: !canUseConfig }">
      <h3>{{ t('configPanel.title') }}</h3>

      <!-- 滚轮调节步长 -->
      <div class="form-item">
        <label>{{ t('form.step.label') }}：</label>
        <input
            type="number"
            step="0.05"
            v-model.number="configForm.step"
            :placeholder="t('form.step.placeholder')"
            :disabled="!canUseConfig"
        />
        <small class="form-tip">{{ t('form.step.tip') }}</small>
      </div>

      <!-- 最小/最大速率 -->
      <div class="form-row">
        <div class="form-item">
          <label>{{ t('form.minRate.label') }}：</label>
          <input
              type="number"
              step="0.1"
              min="0.1"
              max="16.0"
              v-model.number="configForm.minRate"
              :placeholder="t('form.minRate.placeholder')"
              :disabled="!canUseConfig"
          />
        </div>
        <div class="form-item">
          <label>{{ t('form.maxRate.label') }}：</label>
          <input
              type="number"
              step="0.1"
              min="0.25"
              max="32.0"
              v-model.number="configForm.maxRate"
              :placeholder="t('form.maxRate.placeholder')"
              :disabled="!canUseConfig"
          />
        </div>
      </div>

      <!-- 速率记忆 -->
      <div class="form-item switch-item">
        <label>{{ t('form.rememberSpeed.label') }}：</label>
        <input
            type="checkbox"
            v-model="configForm.rememberSpeed"
            :disabled="!canUseConfig"
        />
      </div>
      <div class="form-item" v-if="configForm.rememberSpeed">
        <label>{{ t('form.lastRate.label') }}：</label>
        <input
            type="number"
            step="0.1"
            :min="configForm.minRate"
            :max="configForm.maxRate"
            v-model.number="configForm.lastRate"
            :placeholder="t('form.lastRate.placeholder')"
            :disabled="!canUseConfig"
        />
      </div>

      <!-- 操作按钮 -->
      <div class="btn-group">
        <button @click="saveConfig" class="btn save" :disabled="!canUseConfig">
          {{ t('button.save') }}
        </button>
        <button @click="resetConfig" class="btn reset" :disabled="!canUseConfig">
          {{ t('button.reset') }}
        </button>
      </div>

      <!-- 提示消息 -->
      <div v-if="message" class="message" :class="messageType">
        {{ message }}
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 原有样式保持不变 */
.site-info {
  padding: 1em;
  text-align: center;
  border-bottom: 1px solid #eee;
}
.site-info h4 {
  margin: 0;
  color: #333;
  font-size: 15px;
}
.warn-text {
  color: #ff9800;
  font-size: 12px;
  margin: 0.5em 0 0 0;
}
.site-disable-item {
  margin: 0.75em auto 0;
  max-width: 280px;
  padding: 0 0.5em;
}
.site-disable-item label {
  font-size: 13px;
  color: #666;
}

.popup-container {
  width: 380px;
  padding: 0 1em;
  box-sizing: border-box;
}
.config-panel {
  margin-top: 0.5em;
  padding: 1em;
  border-top: 1px solid #eee;
}
.config-panel.disabled {
  opacity: 0.6;
  pointer-events: none;
}
.config-panel h3 {
  text-align: center;
  margin-bottom: 1.5em;
  color: #333;
  font-size: 16px;
  margin-top: 0;
}
.form-item {
  margin-bottom: 1em;
  display: flex;
  flex-direction: column;
  gap: 0.5em;
}
.form-row {
  display: flex;
  gap: 1em;
}
.form-row .form-item {
  flex: 1;
}
.form-item label {
  font-size: 14px;
  color: #666;
}
.form-item input {
  padding: 0.5em;
  border: 1px solid #ddd;
  border-radius: 4px;
  outline: none;
  font-size: 14px;
}
.form-item input:focus {
  border-color: #42b883;
}
.form-tip {
  font-size: 12px;
  color: #999;
  margin-top: -0.3em;
}
.switch-item {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1em;
}

.btn-group {
  display: flex;
  gap: 1em;
  margin-top: 1.5em;
}
.btn {
  flex: 1;
  padding: 0.7em;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 14px;
}
.save {
  background-color: #42b883;
  color: white;
}
.save:hover:not(:disabled) {
  background-color: #359469;
}
.reset {
  background-color: #f5f5f5;
  color: #333;
}
.reset:hover:not(:disabled) {
  background-color: #e0e0e0;
}
.btn:disabled {
  background-color: #ccc !important;
  cursor: not-allowed;
}

.message {
  margin-top: 1em;
  padding: 0.7em;
  border-radius: 4px;
  text-align: center;
  font-size: 13px;
}
.success {
  background-color: #e8f5e9;
  color: #359469;
}
.error {
  background-color: #fee;
  color: #e53935;
}
.info {
  background-color: #e3f2fd;
  color: #2196f3;
}
</style>