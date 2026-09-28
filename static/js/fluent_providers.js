/**
 * J.A.R.V.I.S. Mark-86 Fluent Provider & Desktop Hub Controller
 * Coordinates all 10 International AI Providers, Windows 11 Mica Titlebar,
 * Navigation Rail view switching, and Token Budget Optimization.
 */

class FluentDesktopHub {
  constructor() {
    this.providers = [];
    this.activeProvider = 'openrouter';
    this.isAlwaysOnTop = false;
    this.init();
  }

  async init() {
    this._bindWindowControls();
    this._bindNavRail();
    this._bindInteractiveButtons();
    await this.fetchProviders();
    this._bindTokenBudgetControls();
    this._bindFullViews();
  }

  _bindWindowControls() {
    const minBtn = document.getElementById('winMinBtn');
    const maxBtn = document.getElementById('winMaxBtn');
    const closeBtn = document.getElementById('winCloseBtn');
    const pinBtn = document.getElementById('winPinBtn');

    if (window.jarvisNative) {
      if (minBtn) minBtn.addEventListener('click', () => window.jarvisNative.minimize());
      if (maxBtn) maxBtn.addEventListener('click', () => window.jarvisNative.maximize());
      if (closeBtn) closeBtn.addEventListener('click', () => window.jarvisNative.close());
      if (pinBtn) {
        pinBtn.addEventListener('click', async () => {
          this.isAlwaysOnTop = !this.isAlwaysOnTop;
          await window.jarvisNative.setAlwaysOnTop(this.isAlwaysOnTop);
          pinBtn.style.color = this.isAlwaysOnTop ? '#00f0ff' : '#a0b2c6';
          pinBtn.title = this.isAlwaysOnTop ? 'Always on Top: ON' : 'Always on Top: OFF';
        });
      }
    } else {
      if (minBtn) minBtn.style.display = 'none';
      if (maxBtn) maxBtn.style.display = 'none';
      if (closeBtn) closeBtn.style.display = 'none';
      if (pinBtn) pinBtn.style.display = 'none';
    }

    // Top Header Quick Switcher
    const quickSelect = document.getElementById('headerQuickProviderSelect');
    if (quickSelect) {
      quickSelect.addEventListener('change', async (e) => {
        const val = e.target.value;
        await this.setActiveProvider(val);
      });
    }
  }

  _bindInteractiveButtons() {
    // Avatar toggle in top bar
    const avBtn = document.getElementById('avatarToggleBtn');
    if (avBtn) {
      avBtn.addEventListener('click', () => {
        const holo = document.getElementById('hologramContainer');
        if (holo) {
          const isHidden = (holo.style.display === 'none' || holo.style.opacity === '0' || !holo.style.display);
          if (isHidden) {
            if (window.showHolographicAvatar) window.showHolographicAvatar();
          } else {
            if (window.hideHolographicAvatar) window.hideHolographicAvatar();
          }
        }
      });
    }

    // Quick Screenshot in chat console
    const ssBtn = document.getElementById('quickScreenshotBtn');
    if (ssBtn) {
      ssBtn.addEventListener('click', async () => {
        const promptInput = document.getElementById('chatPromptInput');
        if (promptInput) {
          promptInput.value = 'Capture a desktop screenshot and analyze the current workspace contents.';
          const sendBtn = document.getElementById('chatSendBtn');
          if (sendBtn) sendBtn.click();
        }
      });
    }

    // Voice test button
    const testVoiceBtn = document.getElementById('testVoiceBtn');
    if (testVoiceBtn) {
      testVoiceBtn.addEventListener('click', async () => {
        const engineSelect = document.getElementById('mainTtsEngineSelect') || document.getElementById('ttsEngineSelect');
        const voiceSelect = document.getElementById('mainTtsVoiceSelect') || document.getElementById('ttsVoiceSelect');
        const engine = engineSelect ? engineSelect.value : 'edge';
        const voice = voiceSelect ? voiceSelect.value : 'en_US-Male';

        const testPhrase = 'All Mark 86 neural subsystems and Windows 11 Fluent telemetry are fully operational, Sir.';

        try {
          testVoiceBtn.disabled = true;
          testVoiceBtn.innerHTML = `${getFluentSvg('sync', { size: '14px' })} Synthesizing...`;
          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: testPhrase, engine, voice })
          });
          if (!res.ok) throw new Error(`TTS synthesis failed with status ${res.status}`);
          const blob = await res.blob();
          const audio = new Audio(URL.createObjectURL(blob));
          audio.onended = () => URL.revokeObjectURL(audio.src);
          audio.onerror = () => URL.revokeObjectURL(audio.src);
          audio.play();
        } catch (e) {
          console.error(e);
        } finally {
          testVoiceBtn.disabled = false;
          testVoiceBtn.innerHTML = `${getFluentSvg('volume_up', { size: '15px' })} TEST VOICE PHRASE`;
        }
      });
    }
  }

  _bindNavRail() {
    const navButtons = document.querySelectorAll('.nav-rail-item');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetView = btn.dataset.view;
        this.switchView(targetView);
      });
    });

    window.switchNav = (viewId) => this.switchView(viewId);
  }

  switchView(viewId) {
    document.querySelectorAll('.nav-rail-item').forEach(b => {
      b.classList.toggle('active', b.dataset.view === viewId);
    });

    document.querySelectorAll('.desktop-view-page').forEach(page => {
      page.classList.toggle('active', page.id === `view-${viewId}`);
    });

    if (viewId === 'providers') {
      this.fetchProviders();
    } else if (viewId === 'protocols') {
      this.renderFullProtocols();
    } else if (viewId === 'vault') {
      this.renderFullVault();
    } else if (viewId === 'telemetry') {
      this.renderFullTelemetry();
    }
  }

  async fetchProviders() {
    try {
      const res = await fetch('/api/providers');
      if (!res.ok) throw new Error(`Failed to fetch providers: ${res.status}`);
      const data = await res.json();
      this.providers = data.providers || [];
      this.activeProvider = data.active_provider || 'openrouter';
      this.renderProvidersGrid();
      this.updateHeaderQuickSwitcher();
      this.updateTokenBudgetUI(data.global_config);
    } catch (e) {
      console.error('Error fetching providers:', e);
    }
  }

  updateHeaderQuickSwitcher() {
    const quickSelect = document.getElementById('headerQuickProviderSelect');
    if (!quickSelect) return;
    quickSelect.innerHTML = '';

    this.providers.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.is_local ? '⚡' : '🌐'} ${p.name} (${p.configured_model})`;
      if (p.id.toLowerCase() === this.activeProvider.toLowerCase()) {
        opt.selected = true;
      }
      quickSelect.appendChild(opt);
    });

    const activePill = document.getElementById('titlebarActiveProvPill');
    const activeObj = this.providers.find(p => p.id === this.activeProvider);
    if (activePill) {
      activePill.textContent = activeObj ? `${activeObj.name} // ${activeObj.configured_model}` : this.activeProvider.toUpperCase();
    }
    if (window.jarvisApp) {
      window.jarvisApp.activeProvider = this.activeProvider;
      if (activeObj) {
        window.jarvisApp.activeModel = activeObj.configured_model || activeObj.default_model;
      }
    }
  }

  renderProvidersGrid() {
    const grid = document.getElementById('providersGridContainer');
    if (!grid) return;
    grid.innerHTML = '';

    this.providers.forEach(p => {
      const isCurrentActive = (p.id.toLowerCase() === this.activeProvider.toLowerCase());
      const card = document.createElement('div');
      card.className = `provider-card ${isCurrentActive ? 'active-provider' : ''}`;
      card.id = `card-provider-${p.id}`;

      const iconName = p.icon || (p.is_local ? 'memory' : 'cloud');
      const iconSvg = getFluentSvg(iconName, { size: '20px', color: '#00f0ff' });

      card.innerHTML = `
        <div class="provider-card-header">
          <div class="provider-card-title">
            ${iconSvg}
            <span>${p.name}</span>
          </div>
          <span class="provider-badge">${p.badge}</span>
        </div>
        
        <div class="provider-card-desc">${p.description}</div>

        ${(p.requires_key || p.id === 'ollama') ? `
          <div class="provider-input-group">
            <label class="provider-input-label">${p.id === 'ollama' ? 'API KEY / CLOUD AUTH TOKEN (OPTIONAL)' : 'API KEY / ACCESS TOKEN'}</label>
            <div class="provider-input-row">
              <input type="password" id="key-${p.id}" class="fluent-input" placeholder="${p.has_key ? p.masked_key : (p.id === 'ollama' ? 'Optional (for Authenticated Cloud / Remote Host)' : 'Enter ' + p.name + ' API Key...')}" value="">
              <button type="button" class="fluent-btn" onclick="FluentDesktopHub.togglePasswordVis('key-${p.id}')">
                ${getFluentSvg('visibility', { size: '14px' })}
              </button>
            </div>
          </div>
        ` : ''}

        <div class="provider-input-group">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <label class="provider-input-label" style="margin-bottom:0;">TARGET MODEL IDENTIFIER</label>
            <button type="button" class="fluent-btn" onclick="fluentHub.loadModelsForProvider('${p.id}')" title="Scan local & cloud models" style="padding:2px 8px; font-size:10px; height:auto; min-height:0; background:rgba(0,240,255,0.08); border:1px solid rgba(0,240,255,0.2); color:#00f0ff; border-radius:4px; cursor:pointer;">
              ${getFluentSvg('search', { size: '11px' })} DISCOVER
            </button>
          </div>
          <div class="provider-input-row">
            <input type="text" id="model-${p.id}" list="models-list-${p.id}" class="fluent-input" value="${this.escapeHtml(p.configured_model || p.default_model)}" placeholder="${this.escapeHtml(p.default_model)}" oninput="fluentHub.onModelInputChange('${p.id}', this.value)" onchange="fluentHub.onModelInputChange('${p.id}', this.value)">
            <datalist id="models-list-${p.id}"></datalist>
          </div>
          <div id="models-status-${p.id}" style="font-size:11px; color:#888; margin-top:3px; display:none;"></div>
        </div>

        ${(p.id === 'custom' || p.id === 'vllm' || p.id === 'ollama' || p.id === 'huggingface') ? `
          <div class="provider-input-group">
            <label class="provider-input-label">API BASE URL / ENDPOINT</label>
            <input type="text" id="baseurl-${p.id}" class="fluent-input" value="${this.escapeHtml(p.configured_base_url || p.default_base_url)}">
          </div>
        ` : ''}

        <div class="provider-card-footer">
          <div class="ping-latency-badge" id="ping-${p.id}">
            <span class="badge-dot"></span>
            <span>STANDBY</span>
          </div>
          <div style="display:flex; gap:6px;">
            <button type="button" class="fluent-btn" onclick="fluentHub.testProvider('${p.id}')">
              ${getFluentSvg('speed', { size: '14px' })} TEST PING
            </button>
            <button type="button" class="fluent-btn ${isCurrentActive ? 'btn-primary' : ''}" onclick="fluentHub.saveAndActivate('${p.id}')">
              ${isCurrentActive ? `${getFluentSvg('check_circle', { size: '14px' })} ACTIVE` : `${getFluentSvg('play_arrow', { size: '14px' })} ACTIVATE`}
            </button>
          </div>
        </div>
      `;

      grid.appendChild(card);
    });
  }

  async loadModelsForProvider(providerId) {
    const statusEl = document.getElementById(`models-status-${providerId}`);
    const datalist = document.getElementById(`models-list-${providerId}`);
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerHTML = `<span style="color:#00f0ff;">Scanning for local & cloud models...</span>`;
    }
    try {
      const res = await fetch(`/api/providers/${providerId}/models`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      const models = data.models || [];
      if (datalist) {
        datalist.innerHTML = '';
        models.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.id;
          opt.label = `${m.name} [${m.badge}]`;
          datalist.appendChild(opt);
        });
      }
      if (statusEl) {
        const localCount = models.filter(m => m.is_installed || (m.badge && m.badge.includes('LOCAL'))).length;
        const cloudCount = models.length - localCount;
        statusEl.innerHTML = `<span style="color:#00ffaa;">✓ Discovered ${models.length} models (${localCount} local, ${cloudCount} cloud/registry). Type or pick from dropdown.</span>`;
      }
    } catch (e) {
      if (statusEl) {
        statusEl.innerHTML = `<span style="color:#ff3366;">⚠️ Discovery error: ${e.message}</span>`;
      }
    }
  }

  static togglePasswordVis(inputId) {
    const el = document.getElementById(inputId);
    if (el) {
      el.type = el.type === 'password' ? 'text' : 'password';
    }
  }

  escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async testProvider(providerId) {
    const badge = document.getElementById(`ping-${providerId}`);
    if (badge) {
      badge.innerHTML = `<span class="badge-dot" style="background:#ffb700;"></span> <span>TESTING...</span>`;
      badge.className = 'ping-latency-badge';
    }

    const keyInput = document.getElementById(`key-${providerId}`);
    const modelInput = document.getElementById(`model-${providerId}`);
    const baseurlInput = document.getElementById(`baseurl-${providerId}`);

    const payload = {
      provider_id: providerId,
      model: modelInput ? modelInput.value.trim() : null,
      api_key: keyInput && keyInput.value.trim() ? keyInput.value.trim() : undefined,
      base_url: baseurlInput ? baseurlInput.value.trim() : undefined
    };

    try {
      const res = await fetch('/api/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`Provider test failed: ${res.status}`);
      const data = await res.json();

      if (badge) {
        if (data.status === 'ok' || data.success) {
          badge.innerHTML = `<span class="badge-dot" style="background:#00ffaa;"></span> <span>${data.latency_ms}ms OK</span>`;
          badge.className = 'ping-latency-badge';
        } else {
          badge.innerHTML = `<span class="badge-dot" style="background:#ff3366;"></span> <span>FAIL: ${(data.message || 'Error').substring(0, 15)}</span>`;
          badge.className = 'ping-latency-badge error';
        }
      }
    } catch (e) {
      if (badge) {
        badge.innerHTML = `<span class="badge-dot" style="background:#ff3366;"></span> <span>ERR: Offline</span>`;
        badge.className = 'ping-latency-badge error';
      }
    }
  }

  async onModelInputChange(providerId, value) {
    const cleanModel = (value || '').trim();
    if (!cleanModel) return;
    const p = this.providers.find(item => item.id === providerId);
    if (p) {
      p.configured_model = cleanModel;
    }
    if (this.activeProvider.toLowerCase() === providerId.toLowerCase()) {
      if (window.jarvisApp) {
        window.jarvisApp.activeModel = cleanModel;
      }
      this.updateHeaderQuickSwitcher();
    }
    try {
      await fetch('/api/providers/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerId,
          model: cleanModel
        })
      });
    } catch (e) {
      console.error('Failed to auto-save model change:', e);
    }
  }

  async saveAndActivate(providerId) {
    const keyInput = document.getElementById(`key-${providerId}`);
    const modelInput = document.getElementById(`model-${providerId}`);
    const baseurlInput = document.getElementById(`baseurl-${providerId}`);

    const selectedModel = modelInput ? modelInput.value.trim() : undefined;
    const payload = {
      provider: providerId,
      model: selectedModel,
      api_key: keyInput && keyInput.value.trim() ? keyInput.value.trim() : undefined,
      base_url: baseurlInput ? baseurlInput.value.trim() : undefined
    };

    try {
      const res = await fetch('/api/providers/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`Provider save failed: ${res.status}`);
      await this.setActiveProvider(providerId, selectedModel);
      if (window.jarvisAudio) window.jarvisAudio.playClick();
    } catch (e) {
      console.error(e);
    }
  }

  async setActiveProvider(providerId, explicitModel) {
    try {
      const payload = { active_provider: providerId };
      if (explicitModel) {
        payload[`${providerId}_model`] = explicitModel;
      }
      const res = await fetch('/api/config/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`Config update failed: ${res.status}`);
      this.activeProvider = providerId;
      await this.fetchProviders();
      const activeObj = this.providers.find(p => p.id === providerId);
      const activeModelName = explicitModel || (activeObj ? (activeObj.configured_model || activeObj.default_model) : null);
      if (window.jarvisApp) {
        window.jarvisApp.activeProvider = providerId;
        window.jarvisApp.activeModel = activeModelName;
        if (window.jarvisApp.updateProviderHUD) window.jarvisApp.updateProviderHUD();
      }
      this.updateHeaderQuickSwitcher();
      if (window.jarvisAudio) window.jarvisAudio.playClick();
    } catch (e) {
      console.error(e);
    }
  }

  _bindTokenBudgetControls() {
    const lowTokenSwitch = document.getElementById('lowTokenSwitch');
    const maxTokenSlider = document.getElementById('maxTokenSlider');
    const maxTokenVal = document.getElementById('maxTokenVal');

    if (lowTokenSwitch) {
      lowTokenSwitch.addEventListener('change', async (e) => {
        const checked = e.target.checked;
        const res = await fetch('/api/config/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ low_token_mode: checked })
        });
        if (!res.ok) throw new Error(`Config update failed: ${res.status}`);
        const pill = document.getElementById('tokenBudgetPill');
        if (pill) {
          pill.innerHTML = checked 
            ? `${getFluentSvg('speed', { size: '14px', color: '#00ffaa' })} LOW-TOKEN: ON` 
            : `${getFluentSvg('bolt', { size: '14px', color: '#00d2ff' })} FULL CONTEXT`;
        }
      });
    }

    if (maxTokenSlider) {
      maxTokenSlider.addEventListener('input', (e) => {
        if (maxTokenVal) maxTokenVal.textContent = `${e.target.value} tokens`;
      });
      maxTokenSlider.addEventListener('change', async (e) => {
        const res = await fetch('/api/config/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ max_tokens: parseInt(e.target.value) })
        });
        if (!res.ok) throw new Error(`Config update failed: ${res.status}`);
      });
    }
  }

  updateTokenBudgetUI(config) {
    if (!config) return;
    const lowTokenSwitch = document.getElementById('lowTokenSwitch');
    const maxTokenSlider = document.getElementById('maxTokenSlider');
    const maxTokenVal = document.getElementById('maxTokenVal');
    const pill = document.getElementById('tokenBudgetPill');

    if (lowTokenSwitch) {
      lowTokenSwitch.checked = config.low_token_mode !== false;
    }
    if (pill) {
      pill.innerHTML = (config.low_token_mode !== false) 
        ? `${getFluentSvg('speed', { size: '14px', color: '#00ffaa' })} LOW-TOKEN: ON` 
        : `${getFluentSvg('bolt', { size: '14px', color: '#00d2ff' })} FULL CONTEXT`;
    }
    if (maxTokenSlider && config.max_tokens) {
      maxTokenSlider.value = config.max_tokens;
      if (maxTokenVal) maxTokenVal.textContent = `${config.max_tokens} tokens`;
    }
  }

  _bindFullViews() {
    // Bind Full Vision OCR Page buttons
    const captureBtn = document.getElementById('mainOcrCaptureBtn');
    const extractBtn = document.getElementById('mainOcrExtractBtn');
    const mainDropzone = document.getElementById('ocrMainDropzone');

    if (captureBtn) {
      captureBtn.addEventListener('click', async () => {
        try {
          captureBtn.disabled = true;
          captureBtn.innerHTML = `${getFluentSvg('sync', { size: '15px' })} Capturing...`;
          const res = await fetch('/api/screenshot', { method: 'POST' });
          if (!res.ok) throw new Error(`Screenshot failed: ${res.status}`);
          const data = await res.json();
          if (data.base64_data) {
            this.currentVisionImg = data.base64_data;
            if (mainDropzone) {
              mainDropzone.innerHTML = `<img src="${data.base64_data}" style="max-height:100%; max-width:100%; object-fit:contain; border-radius:8px;">`;
            }
          }
        } catch (e) {
          console.error(e);
        } finally {
          captureBtn.disabled = false;
          captureBtn.innerHTML = `${getFluentSvg('camera_alt', { size: '15px' })} CAPTURE SCREENSHOT`;
        }
      });
    }

    if (extractBtn) {
      extractBtn.addEventListener('click', async () => {
        if (!this.currentVisionImg) {
          alert('Please capture or paste an image first.');
          return;
        }
        const resultBox = document.getElementById('mainOcrResultBox');
        if (resultBox) {
          resultBox.innerHTML = '// Running GLM-OCR neural text extraction...';
        }
        try {
          extractBtn.disabled = true;
          extractBtn.innerHTML = `${getFluentSvg('sync', { size: '15px' })} Extracting...`;
          const res = await fetch('/api/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: this.currentVisionImg, model: 'glm-ocr:latest' })
          });
          if (!res.ok) throw new Error(`OCR failed: ${res.status}`);
          const data = await res.json();
          if (resultBox) {
            resultBox.textContent = data.text || data.error || 'No text recognized.';
          }
        } catch (e) {
          if (resultBox) resultBox.textContent = `Error: ${e.message}`;
        } finally {
          extractBtn.disabled = false;
          extractBtn.innerHTML = `${getFluentSvg('text_fields', { size: '15px' })} EXTRACT MARKDOWN`;
        }
      });
    }

    // Bind Full Vault Add
    const vaultSaveBtn = document.getElementById('vaultMainSaveBtn');
    if (vaultSaveBtn) {
      vaultSaveBtn.addEventListener('click', async () => {
        const titleInput = document.getElementById('vaultMainTitle');
        const contentInput = document.getElementById('vaultMainContent');
        if (!titleInput || !contentInput || !titleInput.value.trim()) return;

        try {
          const res = await fetch('/api/vault/note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: titleInput.value.trim(), content: contentInput.value.trim() })
          });
          if (!res.ok) throw new Error(`Vault note save failed: ${res.status}`);
          titleInput.value = '';
          contentInput.value = '';
          this.renderFullVault();
        } catch (e) {
          console.error(e);
        }
      });
    }
  }

  async renderFullProtocols() {
    const container = document.getElementById('fullProtocolGrid');
    if (!container) return;
    try {
      const res = await fetch('/api/protocols');
      if (!res.ok) throw new Error(`Protocols fetch failed: ${res.status}`);
      const list = await res.json();
      container.innerHTML = list.map(p => `
        <div class="provider-card">
          <div class="provider-card-header">
            <span style="font-weight:700; color:#00d2ff; font-family:var(--font-sci-fi); display:flex; align-items:center; gap:6px;">
              ${getFluentSvg(p.google_icon || 'bolt', { size: '18px', color: '#00d2ff' })} ${this.escapeHtml(p.name)}
            </span>
            <span class="provider-badge">${this.escapeHtml(p.code)}</span>
          </div>
          <div class="provider-card-desc">${this.escapeHtml(p.description)}</div>
          <button class="fluent-btn btn-primary" style="margin-top:8px;" onclick="window.runStarkProtocol('${this.escapeHtml(p.id)}')">
            ${getFluentSvg('play_arrow', { size: '15px' })} EXECUTE DIRECTIVE
          </button>
        </div>
      `).join('');
    } catch (e) {}
  }

  async renderFullVault() {
    const container = document.getElementById('vaultMainList');
    if (!container) return;
    try {
      const res = await fetch('/api/vault');
      if (!res.ok) throw new Error(`Vault fetch failed: ${res.status}`);
      const data = await res.json();
      const notes = data.notes || [];
      if (notes.length === 0) {
        container.innerHTML = '<div style="color:#7f9cb8; font-size:0.85rem;">No memorandums stored in neural vault.</div>';
        return;
      }
      container.innerHTML = notes.map(n => `
        <div class="provider-card" style="padding:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="color:#00d2ff; font-size:0.9rem;">${this.escapeHtml(n.title)}</strong>
            <span style="font-size:0.7rem; color:#7f9cb8;">${this.escapeHtml(n.created_at || '')}</span>
          </div>
          <p style="font-size:0.82rem; color:#cce2f7; margin-top:4px; line-height:1.4;">${this.escapeHtml(n.content)}</p>
        </div>
      `).join('');
    } catch (e) {}
  }

  async renderFullTelemetry() {
    try {
      const res = await fetch('/api/telemetry');
      if (!res.ok) throw new Error(`Telemetry fetch failed: ${res.status}`);
      const data = await res.json();
      const cpu = data.cpu?.percent || 0;
      const mem = data.memory?.percent || 0;
      const disk = data.disk?.percent || 0;
      const host = data.system?.hostname || 'STARK-PC';
      const uptime = data.system?.uptime_formatted || '1h';
      const ramUsed = ((data.memory?.used || 0) / (1024**3)).toFixed(1);
      const ramTotal = ((data.memory?.total || 0) / (1024**3)).toFixed(1);

      const cpuEl = document.getElementById('fullCpuVal');
      if (cpuEl) cpuEl.textContent = `${cpu}%`;

      const ramEl = document.getElementById('fullRamVal');
      if (ramEl) ramEl.textContent = `${mem}%`;

      const ramUsageEl = document.getElementById('fullRamUsage');
      if (ramUsageEl) ramUsageEl.textContent = `${ramUsed} GB / ${ramTotal} GB`;

      const diskEl = document.getElementById('fullDiskVal');
      if (diskEl) diskEl.textContent = `${disk}%`;

      const hostEl = document.getElementById('fullHostVal');
      if (hostEl) hostEl.textContent = host;

      const uptimeEl = document.getElementById('fullUptimeVal');
      if (uptimeEl) uptimeEl.textContent = `Uptime: ${uptime}`;

      const procList = document.getElementById('fullProcessList');
      if (procList && data.top_processes) {
        procList.innerHTML = data.top_processes.map(p => `
          <div style="display:flex; justify-content:space-between; padding:6px 10px; background:rgba(0,0,0,0.3); border-radius:4px; font-size:0.8rem; font-family:var(--font-telemetry);">
            <span style="color:#fff;">${this.escapeHtml(p.name)} (PID ${Number(p.pid)})</span>
            <span style="color:#00d2ff;">CPU: ${Number(p.cpu)}% | RAM: ${Number(p.memory)}%</span>
          </div>
        `).join('');
      }
    } catch (e) {}
  }
}

window.runStarkProtocol = async function(protoId) {
  if (window.jarvisProtocols) {
    window.jarvisProtocols.runProtocol(protoId);
  }
};

window.addEventListener('DOMContentLoaded', () => {
  window.fluentHub = new FluentDesktopHub();
});
