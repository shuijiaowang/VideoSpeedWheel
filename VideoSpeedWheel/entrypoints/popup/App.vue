<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import {getMatchedConfig} from "@/core/VideoSpeedConfig.js";


// 2. 全局默认配置（移除 TS 接口，直接使用对象）
const DEFAULT_CONFIG = {
  step: 0.1,          // 每次滚动的速率变化量
  minRate: 0.25,       // 最小播放速率
  maxRate: 16.0,       // 最大播放速率
  rememberSpeed: true,// 是否记忆上次速率
  lastRate: 1.0,      // 记忆的最后播放速率
};

// 3. 响应式数据定义（移除 TS 类型注解）
const configForm = ref({ ...DEFAULT_CONFIG });
const message = ref('');
const messageType = ref(''); // 移除 TS 联合类型限定
const currentSite = ref(''); // 当前匹配的站点名称
const speedConfigItem = ref(null); // 动态存储项（适配不同站点）
const isSiteMatched = ref(true); // 是否匹配到支持的站点

// 核心修改：加载配置函数（先获取当前标签页URL）
const loadConfig = async () => {
  try {

    // 1. 获取浏览器当前激活的标签页（关键！）
    const [activeTab] = await browser.tabs.query({
      active: true, // 激活的标签页
      currentWindow: true // 当前窗口,这个不能省略
    });
    console.log("执行吗？",activeTab,activeTab.url)


    // 校验是否获取到标签页
    if (!activeTab || !activeTab.url) {
      isSiteMatched.value = false;
      currentSite.value = '无法获取当前标签页信息';
      showMessage('获取当前标签页URL失败', 'error');
      return;
    }

    // 2. 传入标签页URL，匹配站点配置
    const matchedConfig = getMatchedConfig(activeTab.url);
    console.log("匹配到的配置：", matchedConfig);

    if (!matchedConfig) {
      isSiteMatched.value = false;
      currentSite.value = '未匹配到支持的视频站点';
      showMessage('当前页面不是支持的视频站点，配置将无法生效', 'info');
      return;
    }

    // 3. 初始化存储项 + 加载配置
    currentSite.value = matchedConfig.siteName;
    // 注意：这里要确保 storage 是 WXT 封装的存储对象
    speedConfigItem.value = storage.defineItem(matchedConfig.storageKey, {
      init: () => ({ ...DEFAULT_CONFIG, ...matchedConfig.defaultConfig }),
    });
    const savedConfig = await speedConfigItem.value.getValue();
    if (savedConfig) {
      configForm.value = { ...savedConfig };
    }
    showMessage(`已加载【${currentSite.value}】的配置`, 'success');
  } catch (err) {
    showMessage('加载配置失败', 'error');
    console.error('加载配置失败:', err);
  }
};

// 6. 保存配置到当前站点的存储
const saveConfig = async () => {
  try {
    // 校验是否匹配到站点
    if (!isSiteMatched.value || !speedConfigItem.value) {
      showMessage('当前站点不支持配置保存', 'error');
      return;
    }

    // 合法性校验（严格适配控制器规则）
    if (configForm.value.minRate >= configForm.value.maxRate) {
      showMessage('最小速率不能大于等于最大速率', 'error');
      return;
    }
    if (configForm.value.step <= 0) {
      showMessage('调节步长必须大于0', 'error');
      return;
    }
    if (
        configForm.value.lastRate < configForm.value.minRate ||
        configForm.value.lastRate > configForm.value.maxRate
    ) {
      showMessage(`记忆速率需在 ${configForm.value.minRate}~${configForm.value.maxRate} 之间`, 'error');
      return;
    }

    // 保存配置到 WXT storage
    await speedConfigItem.value.setValue(configForm.value);
    showMessage(`【${currentSite.value}】配置保存成功！`, 'success');
  } catch (err) {
    showMessage('保存配置失败', 'error');
    console.error('保存配置失败:', err);
  }
};

// 7. 重置为当前站点的默认配置
const resetConfig = () => {
  const matchedConfig = getMatchedConfig();
  if (matchedConfig) {
    // 重置为站点默认配置（而非全局默认）
    configForm.value = { ...DEFAULT_CONFIG, ...matchedConfig.defaultConfig };
  } else {
    configForm.value = { ...DEFAULT_CONFIG };
  }
  saveConfig(); // 重置后自动保存
};

// 8. 提示消息封装（移除 TS 参数类型注解）
const showMessage = (text, type) => {
  message.value = text;
  messageType.value = type;
  setTimeout(() => {
    message.value = '';
    messageType.value = '';
  }, 3000);
};

// 9. 页面生命周期
onMounted(() => {
  loadConfig(); // 挂载时加载配置
});

onUnmounted(() => {
  message.value = ''; // 卸载时清空消息
});
</script>

<template>
  <div class="popup-container">
    <!-- 站点信息提示 -->
    <div class="site-info">
      <h4>当前站点：{{ currentSite }}</h4>
      <p v-if="!isSiteMatched" class="warn-text">
        ⚠️ 此页面不是支持的视频站点，配置无法生效
      </p>
    </div>

    <!-- 配置表单区域 -->
    <div class="config-panel" :class="{ disabled: !isSiteMatched }">
      <h3>视频倍速自定义配置,hello world</h3>

      <!-- 1. 滚轮调节步长 -->
      <div class="form-item">
        <label>滚轮调节步长：</label>
        <input
            type="number"
            step="0.05"
            v-model.number="configForm.step"
            placeholder="0.1"
            :disabled="!isSiteMatched"
        />
        <small class="form-tip">每次滚动鼠标的速率变化量（建议0.05-0.5）</small>
      </div>

      <!-- 2. 最小/最大速率 -->
      <div class="form-row">
        <div class="form-item">
          <label>最小播放速率：</label>
          <input
              type="number"
              step="0.1"
              min="0.1"
              max="16.0"
              v-model.number="configForm.minRate"
              placeholder="0.25"
              :disabled="!isSiteMatched"
          />
        </div>
        <div class="form-item">
          <label>最大播放速率：</label>
          <input
              type="number"
              step="0.1"
              min="0.25"
              max="32.0"
              v-model.number="configForm.maxRate"
              placeholder="16.0"
              :disabled="!isSiteMatched"
          />
        </div>
      </div>

      <!-- 3. 速率记忆配置 -->
      <div class="form-item switch-item">
        <label>开启速率记忆：</label>
        <input
            type="checkbox"
            v-model="configForm.rememberSpeed"
            :disabled="!isSiteMatched"
        />
      </div>
      <div class="form-item" v-if="configForm.rememberSpeed">
        <label>默认记忆速率：</label>
        <input
            type="number"
            step="0.1"
            :min="configForm.minRate"
            :max="configForm.maxRate"
            v-model.number="configForm.lastRate"
            placeholder="1.0"
            :disabled="!isSiteMatched"
        />
      </div>

      <!-- 操作按钮 -->
      <div class="btn-group">
        <button @click="saveConfig" class="btn save" :disabled="!isSiteMatched">
          保存配置
        </button>
        <button @click="resetConfig" class="btn reset" :disabled="!isSiteMatched">
          重置默认
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
/* 站点信息样式 */
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

/* 配置面板样式 */
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

/* 按钮样式 */
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

/* 提示消息 */
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