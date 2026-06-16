export default async function handler(req, res) {
    try {
        const { prompt } = req.body;

        const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    {
                        role: "system",
                        content: "你是一个专业的高校辅导员助手"
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7
            })
        });

        const data = await response.json();

        res.status(200).json({
            text: data.choices[0].message.content
        });

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
}
