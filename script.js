/* ============================================================
   AI工作提效助手（辅导员版）v1.0 — 核心逻辑
   ============================================================ */

// ---------- 配置 ----------
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// ---------- 设置管理 ----------
function getSettings() {
    try {
        const raw = localStorage.getItem('counselor_assistant_settings');
        return raw ? JSON.parse(raw) : { apiKey: '', model: 'claude-sonnet-4-6' };
    } catch {
        return { apiKey: '', model: 'claude-sonnet-4-6' };
    }
}

function saveSettingsToStorage(settings) {
    localStorage.setItem('counselor_assistant_settings', JSON.stringify(settings));
}

function loadSettingsUI() {
    const s = getSettings();
    document.getElementById('apiKeyInput').value = s.apiKey || '';
    document.getElementById('modelSelect').value = s.model || 'claude-sonnet-4-6';
}

function saveSettings() {
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    const model = document.getElementById('modelSelect').value;
    saveSettingsToStorage({ apiKey, model });
    showToast('设置已保存');
    document.getElementById('settingsPanel').classList.add('hidden');
}

function clearSettings() {
    saveSettingsToStorage({ apiKey: '', model: 'claude-sonnet-4-6' });
    loadSettingsUI();
    showToast('设置已清除');
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
        // Fallback for older browsers
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
 * 所有AI生成统一通过此函数调用。
 * @param {string} systemPrompt - 系统提示词
 * @param {string} userMessage  - 用户输入
 * @returns {Promise<string>}   - 生成的文本
 */
async function generateText(systemPrompt, userMessage) {
    const settings = getSettings();
    if (!settings.apiKey) {
        throw new Error('请先在设置中配置 API Key');
    }

    const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': settings.apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: settings.model,
            max_tokens: 2048,
            system: systemPrompt,
            messages: [
                { role: 'user', content: userMessage }
            ]
        })
    });

    if (!response.ok) {
        const errBody = await response.text();
        let errMsg;
        try {
            const errJson = JSON.parse(errBody);
            errMsg = errJson.error?.message || `请求失败 (${response.status})`;
        } catch {
            errMsg = `请求失败 (${response.status}): ${errBody}`;
        }
        throw new Error(errMsg);
    }

    const data = await response.json();
    return data.content[0].text;
}

// ================================================================
//  模块1：谈心记录生成
// ================================================================
const TALK_SYSTEM_PROMPT = `你是一名经验丰富的中国高校辅导员，擅长撰写规范的学生谈心谈话记录。

请根据用户提供的信息，生成一份格式规范、内容详实的学生谈心谈话记录。

输出格式必须严格遵循以下结构：

【谈心谈话记录】

一、基本信息
谈话时间：YYYY年MM月DD日（请根据当前时间合理填写）
谈话地点：（如辅导员办公室/学生宿舍/心理咨询室等）
谈话对象：（姓名、性别、年级专业班级）
谈话方式：一对一面对面谈话
谈话人：（辅导员姓名）

二、谈话背景与原因
（简要说明为什么要找该学生谈话，发现了什么问题或隐患）

三、谈话内容摘要
（以叙事方式记录谈话的主要内容和关键对话，体现辅导员的引导和学生的回应）

四、学生当前状态评估
（对学生心理状态、学习状态、生活状态进行客观评估）

五、处理意见与措施
（列出具体的处理措施和建议，包括短期和长期的帮助方案）

六、后续跟进计划
（明确后续跟进的时间节点和具体安排）

要求：
- 语言正式、专业，符合高校辅导员工作规范
- 内容详实但不过度冗长
- 体现人文关怀与专业引导的结合
- 保护学生隐私，使用化名或模糊个人信息
- 具有真实的辅导员工作记录风格`;

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

    const userMessage = `学生基本情况：${student}\n\n问题描述：${problem}\n\n处理要点：${handle || '（未提供）'}`;

    try {
        const result = await generateText(TALK_SYSTEM_PROMPT, userMessage);
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
const NEWS_SYSTEM_PROMPT = `你是一名高校宣传工作人员，擅长撰写校园活动新闻稿。

请根据用户提供的信息，生成一篇完整的校园新闻稿。

输出格式要求：

【标题】
（提供1-2个备选标题，一个正式版、一个新媒体版）

【正文】
（标准新闻稿格式，包含导语、主体、结语）

正文结构：
第一段（导语）：交代活动的时间、地点、主办方、活动名称和基本概况
第二至三段（主体）：详细描述活动过程、精彩环节、参与情况
第四段（结语）：总结活动意义、领导讲话要点或师生反响

要求：
- 新闻语言正式简洁，符合高校新闻宣传规范
- 具备新闻六要素（5W1H）
- 字数控制在500-800字
- 使用客观第三人称叙述
- 适当引用领导讲话或师生感受增强现场感
- 结尾可附：供稿单位/摄影/审核等信息模板`;

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

    const userMessage = `活动名称：${title}\n\n时间地点：${location}\n\n活动过程要点：${content || '（未提供详细过程）'}`;

    try {
        const result = await generateText(NEWS_SYSTEM_PROMPT, userMessage);
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
const SUMMARY_SYSTEM_PROMPT = `你是一名中国高校辅导员，需要撰写学期工作总结。

请根据用户提供的信息，生成一份格式规范、内容全面的学期工作总结。

输出格式要求：

【XX学期工作总结】

一、工作概述
（一段话概括本学期工作的总体情况和基本背景）

二、主要工作内容与成效
（分条列出，每条包括工作内容和具体成效，用数据和事实说话）
至少包含：
- 思想政治教育方面
- 学风建设方面
- 日常管理方面
- 心理健康教育方面
- 就业创业指导方面（如适用）
- 其他特色工作

三、存在问题与不足
（客观分析工作中存在的问题，避免泛泛而谈）

四、下一步工作计划
（针对问题提出具体可行的改进思路和下学期工作重点）

要求：
- 语言正式、客观、实事求是
- 符合高校工作总结规范
- 用数据和具体案例支撑，避免空洞
- 体现辅导员工作的专业性和责任感
- 篇幅适当，既有全面性又不过度冗长`;

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

    const userMessage = `工作列表：${work}\n\n工作成果：${result || '（未提供）'}\n\n存在问题：${problem || '（未提供）'}`;

    try {
        const result = await generateText(SUMMARY_SYSTEM_PROMPT, userMessage);
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
    // Convert newlines to <br> for display
    return div.innerHTML.replace(/\n/g, '<br>');
}

// ---------- 页面初始化 ----------
document.addEventListener('DOMContentLoaded', () => {
    loadSettingsUI();
    // 如果没有配置 API Key，自动展开设置面板
    const settings = getSettings();
    if (!settings.apiKey) {
        document.getElementById('settingsPanel').classList.remove('hidden');
    }
});
