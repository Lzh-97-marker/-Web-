/* ============================================================
   /api/generate — Vercel Serverless Function
   统一AI生成后端，对接 DeepSeek API
   ============================================================ */

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// ---------- 各模块系统提示词（服务端维护） ----------
const SYSTEM_PROMPTS = {
    talk: `你是一名经验丰富的中国高校辅导员，擅长撰写规范的学生谈心谈话记录。

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
- 具有真实的辅导员工作记录风格`,

    news: `你是一名高校宣传工作人员，擅长撰写校园活动新闻稿。

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
- 结尾可附：供稿单位/摄影/审核等信息模板`,

    summary: `你是一名中国高校辅导员，需要撰写学期工作总结。

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
- 篇幅适当，既有全面性又不过度冗长`
};

// ---------- 校验 ----------
const VALID_TYPES = ['talk', 'news', 'summary'];
const VALID_MODELS = ['deepseek-chat', 'deepseek-reasoner'];

/**
 * POST /api/generate
 * Body: { prompt: string, type: "talk"|"news"|"summary", model?: string }
 * Response: { text: string }
 */
export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: '仅支持 POST 请求' });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: '服务端未配置 DEEPSEEK_API_KEY 环境变量' });
    }

    let body;
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
        return res.status(400).json({ error: '请求体格式错误，需为合法 JSON' });
    }

    const { prompt, type, model: reqModel } = body || {};

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        return res.status(400).json({ error: '缺少必填参数 prompt' });
    }

    if (!type || !VALID_TYPES.includes(type)) {
        return res.status(400).json({ error: `参数 type 无效，可选值：${VALID_TYPES.join(' / ')}` });
    }

    const model = (reqModel && VALID_MODELS.includes(reqModel)) ? reqModel : 'deepseek-chat';
    const systemPrompt = SYSTEM_PROMPTS[type];

    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt.trim() }
                ],
                max_tokens: 2048,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            let errMsg = `DeepSeek API 错误 (${response.status})`;
            try {
                const errJson = JSON.parse(errText);
                errMsg = errJson.error?.message || errMsg;
            } catch {}
            return res.status(502).json({ error: errMsg });
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || '';

        return res.status(200).json({ text });

    } catch (err) {
        return res.status(502).json({ error: `请求 DeepSeek API 失败：${err.message}` });
    }
}
