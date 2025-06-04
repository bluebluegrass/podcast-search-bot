// /api/search.js
const { Configuration, OpenAIApi } = require("openai");

const LISTENNOTES_API_KEY = process.env.LISTENNOTES_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const handler = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: "Missing query" });
  }

  // Step 1: Call ListenNotes
  const searchRes = await fetch(
    `https://listen-api.listennotes.com/api/v2/search?q=${encodeURIComponent(
      query
    )}&language=Chinese&type=episode&len_min=5&len_max=60&sort_by_date=0`,
    {
      headers: {
        "X-ListenAPI-Key": LISTENNOTES_API_KEY,
      },
    }
  );

  const data = await searchRes.json();
  const episodes = data.results.slice(0, 3);

  const summariesText = episodes
    .map((ep, idx) => `${idx + 1}. 标题: ${ep.title_original}\n简介: ${ep.description_original}`)
    .join("\n\n");

  // Step 2: Call OpenAI to summarize
  const configuration = new Configuration({ apiKey: OPENAI_API_KEY });
  const openai = new OpenAIApi(configuration);

  const gptResponse = await openai.createChatCompletion({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "你是一个中文播客推荐助手，会根据用户的提问，对播客内容进行总结推荐。",
      },
      {
        role: "user",
        content: `以下是与“${query}”相关的播客，请为每一集写一句中文推荐理由，并附上标题：\n\n${summariesText}`,
      },
    ],
    temperature: 0.7,
  });

  const reply = gptResponse.data.choices[0].message.content;

  res.status(200).json({ reply });
};

export default handler;
