/**
 * J.A.R.V.I.S. Protocols Matrix Controller
 * Handles Stark Protocols execution, visual cues, and tactical audio feedback
 */

class JarvisProtocols {
    constructor() {
        this.protocols = [];
        this.init();
    }

    async init() {
        await this.loadProtocols();
        this.bindQuickButtons();
    }

    async loadProtocols() {
        try {
            const res = await fetch('/api/protocols');
            if (res.ok) {
                this.protocols = await res.json();
                this.renderProtocolGrid();
            }
        } catch (e) {
            console.warn("Failed to load protocols:", e);
        }
    }

    bindQuickButtons() {
        document.querySelectorAll('.quick-proto-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const protoId = btn.dataset.proto;
                if (protoId) this.runProtocol(protoId);
            });
        });
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

    renderProtocolGrid() {
        const container = document.getElementById('protocolMatrixGrid');
        if (!container) return;

        container.innerHTML = this.protocols.map(p => `
            <div class="hud-panel" style="padding: 10px; background: rgba(0,240,255,0.04); border-radius: 6px; border: 1px solid rgba(0,240,255,0.18);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span style="font-family:var(--font-sci-fi); font-size:0.85rem; color:var(--stark-cyan); font-weight:700; display:flex; align-items:center; gap:6px;">
                        ${getFluentSvg(p.google_icon || 'bolt', { size: '16px', color: '#00f0ff' })} ${this.escapeHtml(p.name)}
                    </span>
                    <span style="font-family:var(--font-telemetry); font-size:0.7rem; color:var(--stark-gold);">${this.escapeHtml(p.code)}</span>
                </div>
                <p style="font-size:0.78rem; color:var(--text-secondary); margin-bottom:8px; line-height:1.35;">${this.escapeHtml(p.description)}</p>
                <button class="hud-btn-icon" style="width:100%; justify-content:center; padding:6px 0;" onclick="window.jarvisProtocols.runProtocol('${this.escapeHtml(p.id)}')">
                    ${getFluentSvg('play_arrow', { size: '14px' })} EXECUTE DIRECTIVE
                </button>
            </div>
        `).join('');
    }

    async runProtocol(protoId) {
        if (window.jarvisAudio) {
            window.jarvisAudio.playAlert();
        }
        if (window.arcReactor) {
            window.arcReactor.setState(protoId === 'threat_scan' ? 'THREAT' : 'THINKING');
        }

        // Print to terminal if visible
        if (window.logToTerminal) {
            window.logToTerminal(`[PROTOCOL ENGAGED]: ${protoId.toUpperCase()} DIRECTIVE INITIATED...`);
        }

        try {
            const res = await fetch('/api/protocols/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ protocol_id: protoId })
            });

            if (!res.ok) {
                throw new Error(`Protocol execution request failed with status ${res.status}`);
            }

            const data = await res.json();

            if (window.arcReactor) {
                window.arcReactor.setState('IDLE');
            }

            if (data.success) {
                if (window.jarvisAudio && data.voice_ack) {
                    window.jarvisAudio.speak(data.voice_ack);
                }

                // Add to Chat feed as system action report
                if (window.addJarvisMessage) {
                    const protoName = (data && data.protocol && data.protocol.name) ? data.protocol.name : protoId;
                    const protoCode = (data && data.protocol && data.protocol.code) ? data.protocol.code : 'PROTOCOL';
                    let reportContent = `**[${protoName}]** - ${protoCode}\n\n`;
                    reportContent += `${data.voice_ack || ''}\n\n`;
                    if (data.summary) {
                        reportContent += `> ${data.summary}\n`;
                    }
                    if (data.ocr_result && data.ocr_result.text) {
                        reportContent += `\n**Optical Scan Extracted Text:**\n\`\`\`\n${data.ocr_result.text}\n\`\`\``;
                    }
                    window.addJarvisMessage(reportContent, [{
                        action: 'protocol',
                        id: protoId,
                        result: data
                    }]);
                }

                if (window.logToTerminal) {
                    window.logToTerminal(`[PROTOCOL SUCCESS]: ${protoId.toUpperCase()} completed successfully.`);
                }
            } else {
                if (window.logToTerminal) {
                    window.logToTerminal(`[PROTOCOL ERROR]: ${data.error || 'Execution failed'}`);
                }
            }
        } catch (e) {
            if (window.arcReactor) window.arcReactor.setState('IDLE');
            console.error("Protocol error:", e);
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.jarvisProtocols = new JarvisProtocols();
});
