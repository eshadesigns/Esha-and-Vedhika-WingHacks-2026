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

app.get('/api/nodes', async (req, res) => {
  const { data, error } = await supabase.from('nodes').select('*');
  if (error) return res.status(400).json(error);
  res.json(data);
});

app.post('/api/nodes', async (req, res) => {
  const { data, error } = await supabase
    .from('nodes')
    .insert([{ text: req.body.text, status: 'active', steps: [] }])
    .select()
    .single();

  if (error) return res.status(400).json(error);
  res.status(201).json(data);
});

app.patch('/api/nodes/:id', async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status required' });

  const { data, error } = await supabase
    .from('nodes')
    .update({ status })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json(error);
  res.json(data || {});
});
// SYNTHESIZE
app.post('/api/synthesize', async (req, res) => {
  const text = req.body?.text;

  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ steps: ["No text provided."] });
  }

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

    res.json({ steps: steps.slice(0, 3) });

  } catch (e) {
    console.error("SYNTHESIZE ERROR:", e);
    res.status(500).json({ steps: ["Could not synthesize steps."] });
  }
});
/* =========================================================
   CONTRACTS
========================================================= */

/* CREATE CONTRACT */
app.post('/api/contracts', async (req, res) => {
  const { user_a_id, user_b_id, daily_task_goal, daily_stake } = req.body;

  const { data, error } = await supabase
    .from('contracts')
    .insert([{
      user_a_id,
      user_b_id,
      daily_task_goal,
      daily_stake,
      user_a_completed_today: 0,
      user_b_completed_today: 0,
      done_count: 0,
      is_eval: false
    }])
    .select()
    .single();

  if (error) return res.status(400).json(error);

  res.status(201).json(data);
});

/* GET CONTRACT */
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

/* DONE BUTTON */
app.post('/api/contracts/:id/done', async (req, res) => {
  const contractId = req.params.id;
  const { user_id } = req.body;

  const { data: contract, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .single();

  if (error || !contract)
    return res.status(404).json({ error: "Contract not found" });

  if (contract.is_eval)
    return res.status(400).json({ error: "Already evaluated today" });

  let updateData = {
    done_count: contract.done_count + 1
  };

  if (user_id === contract.user_a_id) {
    updateData.user_a_completed_today =
      contract.user_a_completed_today + 1;
  }

  if (user_id === contract.user_b_id) {
    updateData.user_b_completed_today =
      contract.user_b_completed_today + 1;
  }

  const { error: updateErr } = await supabase
    .from('contracts')
    .update(updateData)
    .eq('id', contractId);

  if (updateErr) return res.status(400).json(updateErr);

  res.json({ success: true });
});

/* EVALUATE CONTRACT */
// EVALUATE CONTRACT (frontend calls /api/evaluate)
app.post('/api/evaluate', async (req, res) => {
  const { contractId, username, friendUsername, required, completed, stake } = req.body;

  if (!contractId || !username || !friendUsername) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    // 1. Get contract
    const { data: contract } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single();

    if (!contract) return res.status(404).json({ error: "Contract not found" });

    if (contract.is_eval) {
      return res.status(400).json({ error: "Already evaluated" });
    }

    // 2. Determine penalty
    const ratio = required > 0 ? completed / required : 0;
    const penalty = Math.max(0, Math.min(stake, stake * (1 - ratio)));

    // 3. Find profiles
    const { data: user } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();

    const { data: friend } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', friendUsername)
      .single();

    if (!user || !friend) {
      return res.status(404).json({ error: "User not found" });
    }

    // 4. Apply penalty (transfer money)
    if (user.balance < penalty) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    await supabase
      .from('profiles')
      .update({ balance: user.balance - penalty })
      .eq('id', user.id);

    await supabase
      .from('profiles')
      .update({ balance: friend.balance + penalty })
      .eq('id', friend.id);

    // 5. Mark contract evaluated and reset day
    await supabase
      .from('contracts')
      .update({
        is_eval: true,
        user_a_completed_today: 0,
        user_b_completed_today: 0,
        done_count: 0
      })
      .eq('id', contractId);

    res.json({
      message: "Evaluated",
      penalty,
      balances: {
        [username]: user.balance - penalty,
        [friendUsername]: friend.balance + penalty
      }
    });

  } catch (e) {
    console.error("EVALUATE ERROR:", e);
    res.status(500).json({ error: e.message || "Evaluate failed" });
  }
});

/* RESET CONTRACT */
app.post('/api/contracts/:id/reset', async (req, res) => {
  const contractId = req.params.id;

  await supabase
    .from('contracts')
    .update({
      is_eval: false,
      user_a_completed_today: 0,
      user_b_completed_today: 0,
      done_count: 0
    })
    .eq('id', contractId);

  res.json({ message: "Contract reset" });
});

/* =========================================================
   SETUP (create users + contract)
========================================================= */

app.post('/api/setup', async (req, res) => {
  const { username, friendUsername, dailyGoalCount, daily_stakeAmount } = req.body;

  if (!username || !friendUsername)
    return res.status(400).json({ error: "Usernames required" });

  try {
    // Find or create user A
    let { data: user } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();

    if (!user) {
      const { data: newUser } = await supabase
        .from('profiles')
        .insert([{ username, balance: 500 }])
        .select()
        .single();
      user = newUser;
    }

    // Find or create user B
    let { data: friend } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', friendUsername)
      .single();

    if (!friend) {
      const { data: newFriend } = await supabase
        .from('profiles')
        .insert([{ username: friendUsername, balance: 500 }])
        .select()
        .single();
      friend = newFriend;
    }

    // Create contract
    const { data: contract } = await supabase
      .from('contracts')
      .insert([{
        user_a_id: user.id,
        user_b_id: friend.id,
        daily_task_goal: dailyGoalCount,
        daily_stake: daily_stakeAmount,
        user_a_completed_today: 0,
        user_b_completed_today: 0,
        done_count: 0,
        is_eval: false,
      }])
      .select()
      .single();

    res.json({
      contractId: contract.id,
      userId: user.id,
      friendId: friend.id,
      balances: {
        [username]: user.balance,
        [friendUsername]: friend.balance,
      },
      friends: [friendUsername],
    });

  } catch (e) {
    console.error("SETUP ERROR:", e);
    res.status(500).json({ error: e.message || e });
  }
});

/* =========================================================
   START SERVER
========================================================= */

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});