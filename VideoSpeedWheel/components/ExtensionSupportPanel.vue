<script setup lang="ts">
import { computed, ref } from 'vue';
import { i18n } from '#i18n';
import type {
  DonationItem,
  ExtensionSupportConfig,
  ExtensionSupportLinks,
} from '@/config/extensionSupport.config';

const props = withDefaults(
  defineProps<{
    config: ExtensionSupportConfig;
    /** 是否默认展开 */
    defaultExpanded?: boolean;
  }>(),
  {
    defaultExpanded: false,
  },
);

const t = (key: string) => i18n.t(key as never);
const expanded = ref(props.defaultExpanded);

const donations = computed(() => props.config.donations?.filter(hasDonationContent) ?? []);
const links = computed(() => props.config.links ?? {});
const instructions = computed(() => props.config.instructions?.filter(Boolean) ?? []);
const hasLinks = computed(() => Object.values(links.value).some(Boolean));
const hasContent = computed(
  () =>
    Boolean(props.config.description) ||
    instructions.value.length > 0 ||
    donations.value.length > 0 ||
    hasLinks.value,
);

function hasDonationContent(item: DonationItem) {
  return Boolean(item.qrImage || item.link);
}

function donationLabel(item: DonationItem) {
  if (item.label) return item.label;
  const key = `supportPanel.donation.${item.id}`;
  const translated = t(key);
  return translated === key ? item.id : translated;
}

function resolveAsset(path?: string) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return path.startsWith('/') ? path : `/${path}`;
}

function openLink(url?: string) {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

const linkEntries = computed(() => {
  const map: ExtensionSupportLinks = links.value;
  const entries: { key: string; url: string; label: string }[] = [];
  const defs: (keyof ExtensionSupportLinks)[] = [
    'website',
    'tutorial',
    'chromeStore',
    'edgeStore',
  ];
  for (const key of defs) {
    const url = map[key];
    if (url) {
      entries.push({
        key,
        url,
        label: t(`supportPanel.links.${key}`),
      });
    }
  }
  return entries;
});
</script>

<template>
  <section v-if="hasContent" class="support-panel">
    <button
      type="button"
      class="support-toggle"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <span class="toggle-text">{{ t('supportPanel.title') }}</span>
      <span class="chevron" :class="{ expanded }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    </button>

    <Transition name="expand">
      <div v-show="expanded" class="support-body">
        <p v-if="config.description" class="support-desc">
          {{ config.description }}
        </p>

        <div v-if="instructions.length" class="support-block">
          <h4>{{ t('supportPanel.instructionsTitle') }}</h4>
          <ol class="instruction-list">
            <li v-for="(item, index) in instructions" :key="index">
              {{ item }}
            </li>
          </ol>
        </div>

        <div v-if="donations.length" class="support-block">
          <h4>{{ t('supportPanel.donationTitle') }}</h4>
          <p class="support-tip">{{ t('supportPanel.donationTip') }}</p>
          <div class="donation-grid">
            <div
              v-for="item in donations"
              :key="item.id"
              class="donation-card"
            >
              <div class="donation-label">{{ donationLabel(item) }}</div>
              <button
                v-if="item.qrImage"
                type="button"
                class="qr-button"
                :title="item.link ? t('supportPanel.openLink') : undefined"
                @click="item.link && openLink(item.link)"
              >
                <img
                  :src="resolveAsset(item.qrImage)"
                  :alt="donationLabel(item)"
                  loading="lazy"
                />
              </button>
              <button
                v-if="item.link"
                type="button"
                class="link-chip"
                @click="openLink(item.link)"
              >
                {{ t('supportPanel.openLink') }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="linkEntries.length" class="support-block">
          <h4>{{ t('supportPanel.linksTitle') }}</h4>
          <div class="link-list">
            <button
              v-for="entry in linkEntries"
              :key="entry.key"
              type="button"
              class="link-item"
              @click="openLink(entry.url)"
            >
              {{ entry.label }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.support-panel {
  background: var(--vsw-surface);
  border: 1px solid var(--vsw-border);
  border-radius: var(--vsw-radius);
  box-shadow: var(--vsw-shadow);
  overflow: hidden;
}

.support-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: var(--vsw-text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--vsw-transition), color var(--vsw-transition);
}

.support-toggle:hover {
  background: var(--vsw-bg);
  color: var(--vsw-accent);
}

.toggle-text {
  letter-spacing: 0.01em;
}

.chevron {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: var(--vsw-text-muted);
  transition: transform var(--vsw-transition), color var(--vsw-transition);
}

.chevron svg {
  width: 16px;
  height: 16px;
}

.chevron.expanded {
  transform: rotate(180deg);
  color: var(--vsw-accent);
}

.support-body {
  padding: 0 16px 14px;
  text-align: left;
  border-top: 1px solid var(--vsw-border);
}

.support-desc {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.65;
  color: var(--vsw-text-secondary);
}

.support-block {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed var(--vsw-border);
}

.support-block h4 {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--vsw-text);
}

.support-tip {
  margin: 0 0 10px;
  font-size: 11px;
  color: var(--vsw-text-muted);
}

.instruction-list {
  margin: 0;
  padding-left: 1.2em;
  font-size: 12px;
  line-height: 1.7;
  color: var(--vsw-text-secondary);
}

.donation-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.donation-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.donation-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--vsw-text-muted);
}

.qr-button {
  width: 100%;
  padding: 0;
  border: 1px solid var(--vsw-border);
  border-radius: var(--vsw-radius-sm);
  background: var(--vsw-bg);
  overflow: hidden;
  cursor: pointer;
  transition: border-color var(--vsw-transition), box-shadow var(--vsw-transition);
}

.qr-button:hover {
  border-color: var(--vsw-accent);
  box-shadow: 0 0 0 3px var(--vsw-accent-ring);
}

.qr-button img {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}

.link-chip {
  padding: 3px 8px;
  border: none;
  border-radius: 999px;
  background: var(--vsw-accent-soft);
  color: var(--vsw-accent);
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--vsw-transition);
}

.link-chip:hover {
  background: #99f6e4;
}

.link-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.link-item {
  padding: 6px 10px;
  border: 1px solid var(--vsw-border);
  border-radius: var(--vsw-radius-sm);
  background: var(--vsw-bg);
  color: var(--vsw-accent);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color var(--vsw-transition), background-color var(--vsw-transition);
}

.link-item:hover {
  border-color: var(--vsw-accent);
  background: var(--vsw-accent-soft);
}

.expand-enter-active,
.expand-leave-active {
  transition: opacity 0.2s ease;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
}
</style>
