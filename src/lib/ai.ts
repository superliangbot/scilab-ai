import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AIChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function getAIResponse(
  messages: AIChatMessage[],
  simulationContext: string,
): Promise<string> {
  const systemMessage: AIChatMessage = {
    role: "system",
    content: `You are SciLab AI, a friendly and knowledgeable science tutor embedded in an interactive simulation platform. You help students understand the science behind the simulation they're currently using.

Current simulation context:
${simulationContext}

Guidelines:
- Be encouraging and patient — adapt your explanation level to the student
- Reference what's happening in the simulation specifically
- Suggest experiments they can try with the controls
- Use analogies and real-world examples
- Keep responses concise (2-4 paragraphs max) unless asked for detail
- Use simple markdown formatting for clarity
- If asked about topics outside the current simulation, briefly answer then relate it back`,
  };

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [systemMessage, ...messages],
    max_tokens: 800,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content ?? "I'm sorry, I couldn't generate a response. Please try again.";
}
