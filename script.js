/* ============================================================
   AI工作提效助手（辅导员版）v1.0 — 核心逻辑
   所有AI请求统一通过后端 /api/generate 转发 DeepSeek
   ============================================================ */

// ---------- 设置管理（仅管理模型选择） ----------
function getSettings() {
    try {
        const raw = localStorage.getItem('counselor_assistant_settings');
        return raw ? JSON.parse(raw) : { model: 'deepseek-chat' };
    } catch {
        return { model: 'deepseek-chat' };
    }
}

function saveSettingsToStorage(settings) {
    localStorage.setItem('counselor_assistant_settings', JSON.stringify(settings));
}

function loadSettingsUI() {
    const s = getSettings();
    document.getElementById('modelSelect').value = s.model || 'deepseek-chat';
}

function saveSettings() {
    const model = document.getElementById('modelSelect').value;
    saveSettingsToStorage({ model });
    showToast('设置已保存');
    document.getElementById('settingsPanel').classList.add('hidden');
}

function clearSettings() {
    saveSettingsToStorage({ model: 'deepseek-chat' });
    loadSettingsUI();
    showToast('已恢复默认设置');
}

function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    loadSettingsUI();
    panel.classList.toggle('hidden');
}

// ---------- Toast ----------
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    toast.style.opacity = '1';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 1800);
}

// ---------- 复制 ----------
async function copyOutput(outputId) {
    const el = document.getElementById(outputId);
    const text = el.textContent.trim();
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        showToast('已复制到剪贴板');
    } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('已复制到剪贴板');
    }
}

// ---------- 输出区域辅助 ----------
function setOutput(el, content) {
    el.innerHTML = content;
    el.scrollTop = 0;
}

function setLoading(el, btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> 生成中...';
    el.innerHTML = '<span class="text-gray-400">正在生成，请稍候...</span>';
}

function clearLoading(el, btn, originalHTML) {
    btn.disabled = false;
    btn.innerHTML = originalHTML;
}

// ---------- 统一 AI 调用函数 ----------
/**
 * 所有AI生成统一通过此函数调用后端 /api/generate。
 * 前端不直接调用任何第三方AI API。
 *
 * @param {string} userPrompt - 用户输入内容（结构化拼接后的纯文本）
 * @param {"talk"|"news"|"summary"} type - 生成类型
 * @returns {Promise<string>} - 后端返回的生成文本
 */
async function generateText(userPrompt, type) {
    const settings = getSettings();

    const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt: userPrompt,
            type: type,
            model: settings.model
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `请求失败 (${response.status})`);
    }

    return data.text;
}

// ================================================================
//  模块1：谈心记录生成
// ================================================================
async function generateTalkRecord() {
    const student = document.getElementById('talkStudent').value.trim();
    const problem = document.getElementById('talkProblem').value.trim();
    const handle = document.getElementById('talkHandle').value.trim();

    if (!student || !problem) {
        showToast('请至少填写"学生基本情况"和"谈话问题描述"');
        return;
    }

    const outputEl = document.getElementById('talkOutput');
    const btn = document.getElementById('talkBtn');
    const copyBtn = document.getElementById('talkCopyBtn');
    const origHTML = btn.innerHTML;

    setLoading(outputEl, btn);

    const userPrompt =
        `学生基本情况：${student}\n\n` +
        `问题描述：${problem}\n\n` +
        `处理要点：${handle || '（未提供）'}`;

    try {
        const result = await generateText(userPrompt, 'talk');
        setOutput(outputEl, escapeHtml(result));
        copyBtn.classList.remove('hidden');
    } catch (err) {
        setOutput(outputEl, `<span class="text-red-500">生成失败：${escapeHtml(err.message)}</span>`);
        copyBtn.classList.add('hidden');
    } finally {
        clearLoading(outputEl, btn, origHTML);
    }
}

// ================================================================
//  模块2：新闻稿生成
// ================================================================
async function generateNews() {
    const title = document.getElementById('newsTitle').value.trim();
    const location = document.getElementById('newsLocation').value.trim();
    const content = document.getElementById('newsContent').value.trim();

    if (!title || !location) {
        showToast('请至少填写"活动名称"和"时间地点"');
        return;
    }

    const outputEl = document.getElementById('newsOutput');
    const btn = document.getElementById('newsBtn');
    const copyBtn = document.getElementById('newsCopyBtn');
    const origHTML = btn.innerHTML;

    setLoading(outputEl, btn);

    const userPrompt =
        `活动名称：${title}\n\n` +
        `时间地点：${location}\n\n` +
        `活动过程要点：${content || '（未提供详细过程）'}`;

    try {
        const result = await generateText(userPrompt, 'news');
        setOutput(outputEl, escapeHtml(result));
        copyBtn.classList.remove('hidden');
    } catch (err) {
        setOutput(outputEl, `<span class="text-red-500">生成失败：${escapeHtml(err.message)}</span>`);
        copyBtn.classList.add('hidden');
    } finally {
        clearLoading(outputEl, btn, origHTML);
    }
}

// ================================================================
//  模块3：工作总结生成
// ================================================================
async function generateSummary() {
    const work = document.getElementById('summaryWork').value.trim();
    const result = document.getElementById('summaryResult').value.trim();
    const problem = document.getElementById('summaryProblem').value.trim();

    if (!work) {
        showToast('请至少填写"工作列表"');
        return;
    }

    const outputEl = document.getElementById('summaryOutput');
    const btn = document.getElementById('summaryBtn');
    const copyBtn = document.getElementById('summaryCopyBtn');
    const origHTML = btn.innerHTML;

    setLoading(outputEl, btn);

    const userPrompt =
        `工作列表：${work}\n\n` +
        `工作成果：${result || '（未提供）'}\n\n` +
        `存在问题：${problem || '（未提供）'}`;

    try {
        const result = await generateText(userPrompt, 'summary');
        setOutput(outputEl, escapeHtml(result));
        copyBtn.classList.remove('hidden');
    } catch (err) {
        setOutput(outputEl, `<span class="text-red-500">生成失败：${escapeHtml(err.message)}</span>`);
        copyBtn.classList.add('hidden');
    } finally {
        clearLoading(outputEl, btn, origHTML);
    }
}

// ---------- XSS 防护 ----------
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
}

// ---------- 页面初始化 ----------
document.addEventListener('DOMContentLoaded', () => {
    loadSettingsUI();
});
