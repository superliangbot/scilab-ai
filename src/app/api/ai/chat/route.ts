import { NextRequest, NextResponse } from "next/server";
import { getAIResponse, type AIChatMessage } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, simulationContext } = body as {
      messages: AIChatMessage[];
      simulationContext: string;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages are required" },
        { status: 400 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          message:
            "The AI tutor requires an OpenAI API key. Please add OPENAI_API_KEY to your .env file to enable this feature. In the meantime, explore the simulation and refer to the info panel for educational content!",
        },
        { status: 200 },
      );
    }

    const response = await getAIResponse(messages, simulationContext || "");

    return NextResponse.json({ message: response });
  } catch (error) {
    console.error("AI chat error:", error);
    return NextResponse.json(
      { error: "Failed to get AI response" },
      { status: 500 },
    );
  }
}
