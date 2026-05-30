const { OpenAI } = require('openai');
require('dotenv').config();

// Configuration for GitHub Models API
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const client = new OpenAI({
  baseURL: "https://models.inference.ai.azure.com",
  apiKey: GITHUB_TOKEN,
});

// ── OpenAI (ChatGPT) via GitHub Models ──────────────────────────────────────
async function tryOpenAI(prompt) {
    if (!GITHUB_TOKEN) throw new Error('GitHub Token not found in .env');
    try {
        const response = await client.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "gpt-4o", // Using GPT-4o from GitHub Models
            temperature: 1,
            max_tokens: 4096,
            top_p: 1
        });
        return response.choices[0].message.content.trim();
    } catch (e) {
        throw new Error('OpenAI (GitHub): ' + e.message);
    }
}

// ── Meta Llama via GitHub Models ──────────────────────────────────────────
async function tryLlama(prompt) {
    if (!GITHUB_TOKEN) throw new Error('GitHub Token not found in .env');
    try {
        const response = await client.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "meta-llama-3.1-70b-instruct", // Using Llama 3.1 70B from GitHub Models
            temperature: 1,
            max_tokens: 4096,
            top_p: 1
        });
        return response.choices[0].message.content.trim();
    } catch (e) {
        throw new Error('Llama (GitHub): ' + e.message);
    }
}

module.exports = { tryOpenAI, tryLlama };
