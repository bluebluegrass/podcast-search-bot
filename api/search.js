// /api/search.js
const OpenAI = require("openai");

const LISTENNOTES_API_KEY = process.env.LISTENNOTES_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const handler = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: "Missing query" });
  }

  try {
    // Step 1: Use GPT to extract search keywords
    const extractResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "你是一个播客搜索助手，请从用户的问题中提取2到4个关键词，用空格分隔，尽可能简洁准确。不要解释，只输出关键词。"
        },
        {
          role: "user",
          content: query
        }
      ],
      temperature: 0.5,
      max_tokens: 30
    });

    const keywordQuery = extractResponse.choices[0].message.content.trim();

    // Step 2: Call ListenNotes
    const searchRes = await fetch(
      `https://listen-api.listennotes.com/api/v2/search?q=${encodeURIComponent(
        keywordQuery
      )}&language=Chinese&type=episode&len_min=5&len_max=60&sort_by_date=0`,
      {
        headers: {
          "X-ListenAPI-Key": LISTENNOTES_API_KEY,
        },
      }
    );

    const data = await searchRes.json();
    const episodes = data.results.slice(0, 3);

    if (!episodes.length) {
      return res.status(200).json({
        reply: "未找到相关的播客。建议尝试更简短或不同的关键词，例如“焦虑”、“工作”、“内耗”。",
      });
    }

    const summariesText = episodes
      .map((ep, idx) => {
        const title = ep.title_original;
        const desc = ep.description_original;
        const link = ep.listennotes_url;
        return `${idx + 1}. 标题：${title}\n推荐理由：${desc.slice(0, 60).replace(/\n/g, " ")}\n收听链接：${link}`;
      })
      .join("\n\n");

    // Step 3: Call GPT to write short summary (plain text, no markdown)
    const gptResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "你是一个中文播客推荐助手，请对每条播客写一句不超过30字的推荐理由，格式为：标题、推荐理由、收听链接，使用纯文本格式。不要使用任何 markdown 或特殊符号。"
        },
        {
          role: "user",
          content: `以下是与“${keywordQuery}”相关的播客，请为每一集写一句中文推荐理由，并保留标题和链接：\n\n${summariesText}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const reply = gptResponse.choices[0].message.content;
    res.status(200).json({ reply });


  } catch (err) {
    console.error("Error in API handler:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = handler;