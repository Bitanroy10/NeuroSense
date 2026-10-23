export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  try {
    const b = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const stress = Number(b.stress), mood = Number(b.mood), sleepHours = Number(b.sleepHours);
    const hr = b.restingHeartRate == null || b.restingHeartRate === "" ? null : Number(b.restingHeartRate);
    if (![stress,mood,sleepHours].every(Number.isFinite) || stress<0 || stress>10 || mood<1 || mood>10 || sleepHours<0 || sleepHours>24 || (hr!==null && (!Number.isFinite(hr)||hr<30||hr>220))) {
      return res.status(400).json({error:"Check-in values are outside the accepted ranges."});
    }
    const parts = [
      {label:"Stress", value:stress*10, weight:.4},
      {label:"Sleep", value:Math.max(0,Math.min(100,(8-sleepHours)*20)), weight:.35},
      {label:"Mood", value:(10-mood)*10, weight:.25}
    ];
    const score = Math.round(parts.reduce((s,p)=>s+p.value*p.weight,0));
    const level = score>=65 ? "Elevated" : score>=40 ? "Moderate" : "Lower";
    const suggestions = [];
    if (stress>=7) suggestions.push("Try a short pause or a comfortable 2-minute breathing exercise.");
    if (sleepHours<7) suggestions.push("Consider a consistent wind-down routine and adequate sleep opportunity.");
    if (mood<=4) suggestions.push("Consider checking in with someone you trust or a qualified professional if this persists.");
    if (!suggestions.length) suggestions.push("Keep your routine steady and continue tracking how you feel.");
    return res.status(200).json({score,level,components:parts,suggestions,disclaimer:"A simple wellness heuristic, not a diagnosis or clinically validated prediction."});
  } catch { return res.status(400).json({error:"Invalid JSON body."}); }
}