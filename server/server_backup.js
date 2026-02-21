
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = 3000;

// Initialize Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

app.use(cors());
app.use(express.json());

// 1. GET goals from Supabase
app.get('/api/nodes', async (req, res) => {
    const { data, error } = await supabase.from('nodes').select('*');
    if (error) return res.status(400).json(error);
    res.json(data);
});

// 2. ADD a new goal to Supabase
app.post('/api/nodes', async (req, res) => {
    const { data, error } = await supabase
        .from('nodes')
        .insert([{ text: req.body.text, status: 'active', steps: [] }])
        .select();
    
    if (error) return res.status(400).json(error);
    res.status(201).json(data[0]);
});

// 2.2. UPDATE node (e.g. mark done)
app.patch('/api/nodes/:id', async (req, res) => {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status required' });
    const { data, error } = await supabase
        .from('nodes')
        .update({ status })
        .eq('id', req.params.id)
        .select();
    if (error) return res.status(400).json(error);
    res.json(data[0] || {});
});

// 2.5. SIMILARITY: AI-powered node connections (Gemini)
app.post('/api/similarity', async (req, res) => {
    const { ideas } = req.body;
    if (!ideas || !Array.isArray(ideas) || ideas.length < 2) {
        return res.json({ similarities: [] });
    }
    const prompt = `You are a productivity assistant. Given these goals/ideas, identify which pairs are meaningfully related (e.g., same domain, can be done together, one enables the other).
Goals: ${JSON.stringify(ideas)}

Return ONLY a valid JSON array of objects. Each object: { "i": number, "j": number, "score": number }
- i and j are 0-based indices into the ideas array
- score is 0.0 to 1.0 (0.8+ = strongly related, 0.6-0.8 = somewhat related, below 0.6 = skip)
- Only include pairs you judge meaningfully connected. No duplicates.
Example: [{"i":0,"j":1,"score":0.9},{"i":1,"j":2,"score":0.75}]`;
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().replace(/```json|```/g, "").trim();
        const similarities = JSON.parse(text);
        return res.json({ similarities: Array.isArray(similarities) ? similarities : [] });
    } catch (e) {
        console.error("Similarity Error:", e);
        return res.json({ similarities: [] });
    }
});

// 3. THE MAGIC: Synthesize (Real AI Steps from Gemini)
// Synthesize endpoint: supports both DB and direct text input
app.post('/api/synthesize', async (req, res) => {
    const text = req.body?.text;
    // If text is provided, synthesize for that text only (frontend use)
    if (text && typeof text === 'string' && text.trim()) {
        const prompt = `Goal: ${text.trim()}.\nAs a productivity assistant, break this goal into 3 tiny, actionable starting steps.\nReturn the response ONLY as a valid JSON array of strings.\nExample: ["Step 1", "Step 2", "Step 3"]`;
        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            const cleanedText = text.replace(/```json|```/g, "").trim();
            const steps = JSON.parse(cleanedText);
            return res.json({ steps });
        } catch (e) {
            return res.status(500).json({ steps: ["Could not synthesize steps."] });
        }
    }
    // Otherwise, do the DB workflow (legacy)
    const { data: activeNodes, error } = await supabase
        .from('nodes')
        .select('*')
        .eq('status', 'active');
    if (error) return res.status(400).json(error);
    for (const node of activeNodes) {
        if (!node.steps || node.steps.length === 0 || node.steps[0] === "Step 1: Open project") {
            const prompt = `Goal: ${node.text}.\nAs a productivity assistant, break this goal into 3 tiny, actionable starting steps.\nReturn the response ONLY as a valid JSON array of strings.\nExample: ["Step 1", "Step 2", "Step 3"]`;
            try {
                const result = await model.generateContent(prompt);
                const response = await result.response;
                const text = response.text();
                const cleanedText = text.replace(/```json|```/g, "").trim();
                const aiSteps = JSON.parse(cleanedText);
                await supabase.from('nodes').update({ steps: aiSteps }).eq('id', node.id);
                console.log(`✨ Gemini synthesized steps for: ${node.text}`);
            } catch (e) {
                console.error("Gemini Error:", e);
            }
        }
    }
    res.json({ message: "Gemini Synthesis complete!" });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running with Supabase on port ${PORT}`);
});