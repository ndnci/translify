<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { withBase } from 'vitepress';
import {
  translateTextWithOpenRouter,
  type BrowserTranslationUsage,
} from '@ndnci/translify-ai/browser';

const DATABASE_NAME = 'translify-playground';
const STORE_NAME = 'secrets';
const API_KEY_ID = 'openrouter-api-key';

const commonLanguages = [
  ['auto', 'Detect automatically'],
  ['ar', 'Arabic'],
  ['az', 'Azerbaijani'],
  ['zh-CN', 'Chinese (Simplified)'],
  ['zh-TW', 'Chinese (Traditional)'],
  ['nl', 'Dutch'],
  ['en', 'English'],
  ['fr', 'French'],
  ['de', 'German'],
  ['hi', 'Hindi'],
  ['it', 'Italian'],
  ['ja', 'Japanese'],
  ['ko', 'Korean'],
  ['pl', 'Polish'],
  ['pt', 'Portuguese'],
  ['ru', 'Russian'],
  ['es', 'Spanish'],
  ['sv', 'Swedish'],
  ['tr', 'Turkish'],
  ['uk', 'Ukrainian'],
] as const;

const apiKey = ref('');
const rememberKey = ref(false);
const showKey = ref(false);
const model = ref('deepseek/deepseek-v4-flash');
const sourceLanguage = ref('auto');
const targetLanguage = ref('fr');
const sourceText = ref('');
const translatedText = ref('');
const usage = ref<BrowserTranslationUsage>();
const loading = ref(false);
const error = ref('');
const storageMessage = ref('');
const copied = ref(false);

const canTranslate = computed(
  () =>
    !loading.value &&
    apiKey.value.trim().length > 0 &&
    model.value.trim().length > 0 &&
    sourceText.value.trim().length > 0,
);

onMounted(async () => {
  try {
    const storedKey = await readStoredKey();
    if (storedKey) {
      apiKey.value = storedKey;
      rememberKey.value = true;
    }
  } catch {
    storageMessage.value = 'Persistent storage is unavailable in this browser.';
  }
});

async function translate(): Promise<void> {
  if (!canTranslate.value) return;

  loading.value = true;
  error.value = '';
  copied.value = false;
  translatedText.value = '';
  usage.value = undefined;

  try {
    if (rememberKey.value) {
      await writeStoredKey(apiKey.value.trim());
    }

    const result = await translateTextWithOpenRouter({
      apiKey: apiKey.value,
      model: model.value,
      sourceLanguage: sourceLanguage.value,
      targetLanguage: targetLanguage.value,
      text: sourceText.value,
      httpReferer: window.location.href,
      appTitle: 'Translify browser translator',
    });

    translatedText.value = result.translation;
    usage.value = result.usage;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Translation failed.';
  } finally {
    loading.value = false;
  }
}

async function updateRememberKey(): Promise<void> {
  storageMessage.value = '';
  try {
    if (rememberKey.value) {
      if (apiKey.value.trim()) await writeStoredKey(apiKey.value.trim());
      storageMessage.value = 'Key saved in IndexedDB on this device.';
    } else {
      await deleteStoredKey();
      storageMessage.value = 'Saved key deleted. It will remain only for this tab session.';
    }
  } catch {
    rememberKey.value = false;
    storageMessage.value = 'Could not access IndexedDB. The key remains session-only.';
  }
}

async function forgetKey(): Promise<void> {
  try {
    await deleteStoredKey();
  } finally {
    apiKey.value = '';
    rememberKey.value = false;
    storageMessage.value = 'API key removed from this browser.';
  }
}

function swapLanguages(): void {
  if (sourceLanguage.value === 'auto') {
    sourceLanguage.value = targetLanguage.value;
    targetLanguage.value = 'en';
  } else {
    [sourceLanguage.value, targetLanguage.value] = [targetLanguage.value, sourceLanguage.value];
  }

  if (translatedText.value) {
    [sourceText.value, translatedText.value] = [translatedText.value, sourceText.value];
    usage.value = undefined;
  }
}

async function copyTranslation(): Promise<void> {
  if (!translatedText.value) return;
  await navigator.clipboard.writeText(translatedText.value);
  copied.value = true;
  window.setTimeout(() => (copied.value = false), 1_500);
}

function formatCost(cost: number | undefined): string {
  if (cost === undefined) return '—';
  if (cost === 0) return '$0';
  return `$${cost.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  })}`;
}

function languageLabel(code: string): string {
  const known = commonLanguages.find(([value]) => value === code);
  return known ? `${known[1]} (${known[0]})` : code;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'));
  });
}

async function readStoredKey(): Promise<string | undefined> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database
        .transaction(STORE_NAME, 'readonly')
        .objectStore(STORE_NAME)
        .get(API_KEY_ID);
      request.onsuccess = () =>
        resolve(typeof request.result === 'string' ? request.result : undefined);
      request.onerror = () => reject(request.error ?? new Error('Could not read IndexedDB'));
    });
  } finally {
    database.close();
  }
}

async function writeStoredKey(value: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(value, API_KEY_ID);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('Could not write IndexedDB'));
    });
  } finally {
    database.close();
  }
}

async function deleteStoredKey(): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(API_KEY_ID);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('Could not update IndexedDB'));
    });
  } finally {
    database.close();
  }
}
</script>

<template>
  <section class="translator-shell">
    <div class="hero-copy">
      <span class="eyebrow">Serverless playground</span>
      <h1>Translate directly in your browser</h1>
      <p>
        This page calls OpenRouter from your browser. Your key and text are never sent to a
        Translify server.
      </p>
    </div>

    <div class="settings-card">
      <div class="settings-grid">
        <label class="field field-key">
          <span>OpenRouter API key</span>
          <span class="input-with-action">
            <input
              v-model="apiKey"
              :type="showKey ? 'text' : 'password'"
              autocomplete="off"
              placeholder="sk-or-v1-…"
            />
            <button
              type="button"
              class="icon-button"
              :aria-label="showKey ? 'Hide key' : 'Show key'"
              @click="showKey = !showKey"
            >
              <svg v-if="showKey" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.2A10.3 10.3 0 0112 4c5 0 9 4 10 8a12.7 12.7 0 01-2 4.1M6.6 6.6A12.4 12.4 0 002 12c1 4 5 8 10 8a9.8 9.8 0 005.4-1.7"
                />
              </svg>
              <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M2 12s3.5-8 10-8 10 8 10 8-3.5 8-10 8S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z"
                />
              </svg>
            </button>
          </span>
        </label>

        <label class="field">
          <span>OpenRouter model</span>
          <input v-model="model" type="text" spellcheck="false" />
        </label>
      </div>

      <div class="storage-row">
        <label class="remember-option">
          <input v-model="rememberKey" type="checkbox" @change="updateRememberKey" />
          Remember this key in IndexedDB
        </label>
        <button v-if="apiKey" type="button" class="text-button danger" @click="forgetKey">
          Forget key
        </button>
      </div>

      <p class="security-note">
        Prefer a restricted, spending-capped key. Session-only is safest: any script running on this
        origin could read a key saved in IndexedDB.
      </p>
      <p v-if="storageMessage" class="storage-message" role="status">{{ storageMessage }}</p>
    </div>

    <div class="translator-card">
      <div class="language-bar">
        <label>
          <span class="sr-only">Source language</span>
          <input
            v-model="sourceLanguage"
            list="translify-source-languages"
            aria-label="Source language"
          />
        </label>
        <button
          type="button"
          class="swap-button"
          aria-label="Swap languages"
          @click="swapLanguages"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 10h11l-3-3m3 3l-3 3M17 14H6l3 3m-3-3l3-3" />
          </svg>
        </button>
        <label>
          <span class="sr-only">Target language</span>
          <input
            v-model="targetLanguage"
            list="translify-target-languages"
            aria-label="Target language"
          />
        </label>
        <datalist id="translify-source-languages">
          <option v-for="language in commonLanguages" :key="language[0]" :value="language[0]">
            {{ languageLabel(language[0]) }}
          </option>
        </datalist>
        <datalist id="translify-target-languages">
          <option
            v-for="language in commonLanguages.slice(1)"
            :key="language[0]"
            :value="language[0]"
          >
            {{ languageLabel(language[0]) }}
          </option>
        </datalist>
      </div>

      <div class="translation-grid">
        <label class="translation-pane">
          <span class="pane-title">Source</span>
          <textarea
            v-model="sourceText"
            placeholder="Enter text"
            maxlength="20000"
            @keydown.ctrl.enter="translate"
            @keydown.meta.enter="translate"
          />
          <span class="character-count">{{ sourceText.length.toLocaleString() }} / 20,000</span>
        </label>

        <div class="translation-pane output-pane" aria-live="polite">
          <div class="pane-heading">
            <span class="pane-title">Translation</span>
            <button
              v-if="translatedText"
              type="button"
              class="icon-button"
              :aria-label="copied ? 'Copied' : 'Copy translation'"
              @click="copyTranslation"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 8h11v11H8zM16 8V5H5v11h3" />
              </svg>
            </button>
          </div>
          <div v-if="loading" class="loading-state">
            <span class="spinner" />
            Translating…
          </div>
          <p v-else-if="translatedText" class="translated-text">{{ translatedText }}</p>
          <p v-else class="placeholder">Your translation will appear here.</p>
        </div>
      </div>

      <div v-if="error" class="error-message" role="alert">{{ error }}</div>

      <div class="action-row">
        <button type="button" class="primary-button" :disabled="!canTranslate" @click="translate">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M12 9a3 3 0 100 6 3 3 0 000-6z"
            />
          </svg>
          {{ loading ? 'Translating…' : 'Translate' }}
        </button>
        <span class="shortcut">⌘/Ctrl + Enter</span>
      </div>

      <div v-if="usage" class="usage-grid">
        <div>
          <span>Input tokens</span
          ><strong>{{ usage.promptTokens?.toLocaleString() ?? '—' }}</strong>
        </div>
        <div>
          <span>Output tokens</span
          ><strong>{{ usage.completionTokens?.toLocaleString() ?? '—' }}</strong>
        </div>
        <div>
          <span>Total tokens</span><strong>{{ usage.totalTokens?.toLocaleString() ?? '—' }}</strong>
        </div>
        <div>
          <span>Exact cost</span><strong>{{ formatCost(usage.costUsd) }}</strong>
        </div>
      </div>
    </div>

    <p class="footnote">
      This playground is translation-only. To browse and safely update project files, run
      <a :href="withBase('/commands/studio')"><code>translify studio</code></a> locally. Usage and
      cost are displayed when OpenRouter reports them.
    </p>
  </section>
</template>

<style scoped>
.translator-shell {
  max-width: 1120px;
  margin: 0 auto;
  padding: 64px 24px 40px;
  color: var(--vp-c-text-1);
}
.hero-copy {
  max-width: 720px;
  margin-bottom: 28px;
}
.hero-copy h1 {
  margin: 8px 0 12px;
  border: 0;
  font-size: clamp(2rem, 5vw, 3.5rem);
  line-height: 1.05;
  letter-spacing: -0.04em;
}
.hero-copy p {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 1.05rem;
}
.eyebrow {
  color: var(--vp-c-brand-1);
  font-weight: 700;
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.settings-card,
.translator-card {
  border: 1px solid var(--vp-c-divider);
  border-radius: 18px;
  background: var(--vp-c-bg-soft);
  box-shadow: 0 16px 50px rgb(0 0 0 / 6%);
}
.settings-card {
  padding: 20px;
  margin-bottom: 16px;
}
.settings-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 16px;
}
.field {
  display: grid;
  gap: 7px;
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
  font-weight: 650;
}
input,
textarea {
  width: 100%;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font: inherit;
  outline: none;
}
input {
  height: 42px;
  padding: 0 12px;
}
input:focus,
textarea:focus {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--vp-c-brand-1) 16%, transparent);
}
.input-with-action {
  position: relative;
  display: block;
}
.input-with-action input {
  padding-right: 44px;
}
.input-with-action .icon-button {
  position: absolute;
  top: 5px;
  right: 5px;
}
.icon-button,
.swap-button {
  display: inline-grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--vp-c-text-2);
  cursor: pointer;
}
.icon-button {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}
.icon-button:hover,
.swap-button:hover {
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-1);
}
svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.storage-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
}
.remember-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
}
.remember-option input {
  width: 16px;
  height: 16px;
  accent-color: var(--vp-c-brand-1);
}
.text-button {
  border: 0;
  padding: 4px;
  background: transparent;
  color: var(--vp-c-text-2);
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
}
.text-button.danger:hover {
  color: var(--vp-c-danger-1);
}
.security-note,
.storage-message {
  margin: 10px 0 0;
  color: var(--vp-c-text-3);
  font-size: 0.78rem;
  line-height: 1.45;
}
.storage-message {
  color: var(--vp-c-brand-1);
}
.translator-card {
  overflow: hidden;
  background: var(--vp-c-bg);
}
.language-bar {
  display: grid;
  grid-template-columns: 1fr 48px 1fr;
  align-items: center;
  border-bottom: 1px solid var(--vp-c-divider);
}
.language-bar label {
  padding: 10px 16px;
}
.language-bar input {
  border: 0;
  background: transparent;
  box-shadow: none;
  color: var(--vp-c-brand-1);
  font-weight: 700;
}
.swap-button {
  width: 40px;
  height: 40px;
  border-radius: 999px;
}
.translation-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 290px;
}
.translation-pane {
  position: relative;
  min-width: 0;
  padding: 18px;
}
.translation-pane:first-child {
  border-right: 1px solid var(--vp-c-divider);
}
.pane-title {
  color: var(--vp-c-text-3);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.pane-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
textarea {
  min-height: 210px;
  margin-top: 10px;
  padding: 0;
  resize: vertical;
  border: 0;
  box-shadow: none !important;
  font-size: 1.18rem;
  line-height: 1.55;
}
.character-count {
  position: absolute;
  right: 18px;
  bottom: 13px;
  color: var(--vp-c-text-3);
  font-size: 0.72rem;
}
.output-pane {
  background: var(--vp-c-bg-soft);
}
.translated-text,
.placeholder {
  margin: 12px 0 0;
  white-space: pre-wrap;
  font-size: 1.18rem;
  line-height: 1.55;
}
.placeholder {
  color: var(--vp-c-text-3);
}
.loading-state {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 190px;
  justify-content: center;
  color: var(--vp-c-text-2);
}
.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--vp-c-divider);
  border-top-color: var(--vp-c-brand-1);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.error-message {
  margin: 0 18px 16px;
  padding: 11px 13px;
  border: 1px solid var(--vp-c-danger-soft);
  border-radius: 9px;
  background: var(--vp-c-danger-soft);
  color: var(--vp-c-danger-1);
  font-size: 0.85rem;
}
.action-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px 18px;
  border-top: 1px solid var(--vp-c-divider);
}
.primary-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 10px;
  padding: 10px 18px;
  background: var(--vp-c-brand-1);
  color: white;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}
.primary-button:hover:not(:disabled) {
  background: var(--vp-c-brand-2);
}
.primary-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.shortcut {
  color: var(--vp-c-text-3);
  font-size: 0.76rem;
}
.usage-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-top: 1px solid var(--vp-c-divider);
}
.usage-grid div {
  display: grid;
  gap: 3px;
  padding: 14px 18px;
  border-right: 1px solid var(--vp-c-divider);
}
.usage-grid div:last-child {
  border-right: 0;
}
.usage-grid span {
  color: var(--vp-c-text-3);
  font-size: 0.72rem;
}
.usage-grid strong {
  font-variant-numeric: tabular-nums;
  font-size: 0.9rem;
}
.footnote {
  margin: 18px auto 0;
  max-width: 760px;
  text-align: center;
  color: var(--vp-c-text-3);
  font-size: 0.82rem;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@media (max-width: 720px) {
  .translator-shell {
    padding: 36px 14px 28px;
  }
  .settings-grid,
  .translation-grid {
    grid-template-columns: 1fr;
  }
  .translation-pane:first-child {
    border-right: 0;
    border-bottom: 1px solid var(--vp-c-divider);
  }
  .usage-grid {
    grid-template-columns: 1fr 1fr;
  }
  .usage-grid div:nth-child(2) {
    border-right: 0;
  }
  .usage-grid div:nth-child(-n + 2) {
    border-bottom: 1px solid var(--vp-c-divider);
  }
}
@media (max-width: 480px) {
  .storage-row {
    align-items: flex-start;
    flex-direction: column;
  }
  .language-bar {
    grid-template-columns: minmax(0, 1fr) 38px minmax(0, 1fr);
  }
  .language-bar label {
    padding: 8px 6px;
  }
  .usage-grid {
    grid-template-columns: 1fr;
  }
  .usage-grid div {
    border-right: 0;
    border-bottom: 1px solid var(--vp-c-divider);
  }
  .usage-grid div:last-child {
    border-bottom: 0;
  }
}
</style>
