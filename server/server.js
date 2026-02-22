require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

/* =========================================================
   Supabase Setup
========================================================= */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

console.log("🚀 Starting server with Supabase URL:", process.env.SUPABASE_URL);

/* =========================================================
   Gemini Setup
========================================================= */

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

console.log("🚀 Gemini API Key loaded:", !!process.env.GEMINI_API_KEY);

const modelName = "gemini-2.5-flash";

async function generate(model, prompt) {
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });
  return response.text;
}

/* =========================================================
   NODES ENDPOINTS
========================================================= */

// 1. GET nodes
app.get('/api/nodes', async (req, res) => {
  const { data, error } = await supabase.from('nodes').select('*');
  if (error) return res.status(400).json(error);
  res.json(data);
});

// 2. ADD node
app.post('/api/nodes', async (req, res) => {
  const { data, error } = await supabase
    .from('nodes')
    .insert([{ text: req.body.text, status: 'active', steps: [] }])
    .select();

  if (error) return res.status(400).json(error);
  res.status(201).json(data[0]);
});

// 3. UPDATE node status
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

/* =========================================================
   SIMILARITY (Gemini)
========================================================= */

app.post('/api/similarity', async (req, res) => {
  const { ideas } = req.body;

  if (!ideas || !Array.isArray(ideas) || ideas.length < 2)
    return res.json({ similarities: [] });

  const prompt = `You are a productivity assistant. Given these goals/ideas, identify which pairs are meaningfully related.
Goals: ${JSON.stringify(ideas)}
Return ONLY a valid JSON array of objects.
Example: [{"i":0,"j":1,"score":0.9}]`;

  try {
    const rawText = await generate(modelName, prompt);
    let text = rawText.replace(/```json|```/g, "").trim();
    const similarities = JSON.parse(text);
    res.json({ similarities: Array.isArray(similarities) ? similarities : [] });
  } catch (e) {
    console.error("Similarity Error:", e);
    res.json({ similarities: [] });
  }
});

/* =========================================================
   SYNTHESIZE
========================================================= */

app.post('/api/synthesize', async (req, res) => {
  const text = req.body?.text;

  // Frontend direct synthesis
  if (text && typeof text === 'string' && text.trim()) {
    const prompt = `Goal: ${text.trim()}.
Break into 3 tiny actionable steps.
Return ONLY JSON array.`;

    try {
      const rawText = await generate(modelName, prompt);
      let cleaned = rawText.replace(/```json|```/g, "").trim();

      let steps;
      try {
        steps = JSON.parse(cleaned);
      } catch {
        const match = cleaned.match(/\[[\s\S]*\]/);
        steps = match ? JSON.parse(match[0]) : [];
      }

      if (!Array.isArray(steps) || steps.length === 0) {
        steps = [
          "Break it down.",
          "Start the first small action.",
          "Track completion."
        ];
      }

      return res.json({ steps: steps.slice(0, 3) });

    } catch (e) {
      return res.status(500).json({ steps: ["Could not synthesize steps."] });
    }
  }

  // DB workflow
  const { data: activeNodes, error } = await supabase
    .from('nodes')
    .select('*')
    .eq('status', 'active');

  if (error) return res.status(400).json(error);

  for (const node of activeNodes) {
    if (!node.steps || node.steps.length === 0) {
      const prompt = `Goal: ${node.text}.
Break into 3 tiny actionable steps.
Return ONLY JSON array.`;

      try {
        const rawText = await generate(modelName, prompt);
        const cleaned = rawText.replace(/```json|```/g, "").trim();
        const aiSteps = JSON.parse(cleaned);

        await supabase
          .from('nodes')
          .update({ steps: aiSteps })
          .eq('id', node.id);

      } catch (e) {
        console.error("Gemini Error:", e);
      }
    }
  }

  res.json({ message: "Gemini Synthesis complete!" });
});


// =========================================================
// CONTRACTS
// =========================================================

// CREATE CONTRACT
app.post('/api/contracts', async (req, res) => {
  const { user1_id, user2_id, daily_tsk_count, stake } = req.body;

  const { data, error } = await supabase
    .from('contracts')
    .insert([{
      user1_id,
      user2_id,
      daily_tsk_count,
      stake,
      done_count: 0,
      is_eval: false
    }])
    .select();

  if (error) return res.status(400).json(error);

  res.status(201).json(data[0]);
});


// GET CONTRACT BY ID
app.get('/api/contracts/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !data)
    return res.status(404).json({ error: "Contract not found" });

  res.json(data);
});


// DONE BUTTON (increment done_count)
app.post('/api/contracts/:id/done', async (req, res) => {
  const contractId = req.params.id;

  const { data: contract } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .single();

  if (!contract)
    return res.status(404).json({ error: "Contract not found" });

  if (contract.is_eval)
    return res.status(400).json({ error: "Already evaluated today" });

  const newCount = contract.done_count + 1;

  await supabase
    .from('contracts')
    .update({ done_count: newCount })
    .eq('id', contractId);

  res.json({ done_count: newCount });
});


// EVALUATE CONTRACT
app.post('/api/contracts/:id/evaluate', async (req, res) => {
  const contractId = req.params.id;
  const { failing_user_id } = req.body;

  const { data: contract } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .single();

  if (!contract)
    return res.status(404).json({ error: "Contract not found" });

  if (contract.is_eval)
    return res.status(400).json({ error: "Already evaluated" });

  const { daily_tsk_count, stake, done_count, user1_id, user2_id } = contract;

  const partner_id =
    failing_user_id === user1_id ? user2_id : user1_id;

  const ratio = done_count / daily_tsk_count;
  const penalty = Math.max(0, Math.min(stake, stake * (1 - ratio)));

  const { data: failingUser } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', failing_user_id)
    .single();

  const { data: partnerUser } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', partner_id)
    .single();

  if (!failingUser || !partnerUser)
    return res.status(404).json({ error: "User not found" });

  if (failingUser.balance < penalty)
    return res.status(400).json({ error: "Insufficient balance" });

  await supabase
    .from('profiles')
    .update({ balance: failingUser.balance - penalty })
    .eq('id', failing_user_id);

  await supabase
    .from('profiles')
    .update({ balance: partnerUser.balance + penalty })
    .eq('id', partner_id);

  await supabase
    .from('contracts')
    .update({ is_eval: true, done_count: 0 })
    .eq('id', contractId);

  res.json({ penalty });
});

// RESET CONTRACT (MVP)
app.post('/api/contracts/:id/reset', async (req, res) => {
  const contractId = req.params.id;

  await supabase
    .from('contracts')
    .update({ is_eval: false, done_count: 0 })
    .eq('id', contractId);

  res.json({ message: "Contract reset" });
});

/* =========================================================
   Start Server
========================================================= */

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});