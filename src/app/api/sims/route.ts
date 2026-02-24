import { NextResponse } from "next/server";
import { simulationConfigs } from "@/simulations/registry";

export async function GET() {
  return NextResponse.json({ simulations: simulationConfigs });
}
