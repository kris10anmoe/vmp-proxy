const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://vmp-proxy-4u1l.vercel.app';

// Anthropic tool → OpenAI tool
function toOAITool(t) {
  return {
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.input_schema }
  };
}

// Anthropic messages → OpenAI messages
function toOAIMessages(system, messages) {
  const result = [];
  if (system) result.push({ role: 'system', content: system });

  for (const msg of messages) {
    // Vanlig tekstmelding
    if (typeof msg.content === 'string') {
      result.push({ role: msg.role, content: msg.content });
      continue;
    }
    if (!Array.isArray(msg.content)) continue;

    // Tool-resultater (Anthropic: role=user med tool_result-blokker)
    const toolResults = msg.content.filter(b => b.type === 'tool_result');
    if (toolResults.length > 0) {
      for (const tr of toolResults) {
        result.push({
          role: 'tool',
          tool_call_id: tr.tool_use_id,
          content: typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content)
        });
      }
      continue;
    }

    // Assistent med verktøykall og/eller tekst
    const textBlock = msg.content.find(b => b.type === 'text');
    const toolUses  = msg.content.filter(b => b.type === 'tool_use');
    const oaiMsg    = { role: 'assistant', content: textBlock ? textBlock.text : null };
    if (toolUses.length > 0) {
      oaiMsg.tool_calls = toolUses.map(tu => ({
        id:       tu.id,
        type:     'function',
        function: { name: tu.name, arguments: JSON.stringify(tu.input) }
      }));
    }
    result.push(oaiMsg);
  }
  return result;
}

// OpenAI respons → Anthropic respons
function toAnthropicResponse(data) {
  const choice = data.choices && data.choices[0];
  if (!choice) return { content: [], stop_reason: 'end_turn' };

  const msg     = choice.message;
  const content = [];

  if (msg.content) content.push({ type: 'text', text: msg.content });

  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      content.push({
        type:  'tool_use',
        id:    tc.id,
        name:  tc.function.name,
        input: JSON.parse(tc.function.arguments)
      });
    }
  }

  return {
    content,
    stop_reason: choice.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn'
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).end();

  const { max_tokens, system, messages, tools, model } = req.body;
  const oaiModel = model === 'gpt-4o-mini' ? 'gpt-4o-mini' : 'gpt-4o';

  const oaiBody = {
    model:      oaiModel,
    max_tokens: max_tokens || 1024,
    messages:   toOAIMessages(system, messages)
  };
  if (tools && tools.length) oaiBody.tools = tools.map(toOAITool);

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
    },
    body: JSON.stringify(oaiBody)
  });

  const data = await r.json();
  if (!r.ok) return res.status(r.status).json({ error: data.error || data });

  return res.status(200).json(toAnthropicResponse(data));
}
