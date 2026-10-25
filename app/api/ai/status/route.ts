import { connection } from "next/server";
import { providerInfo } from "@/lib/ai/provider";

/** Which AI provider is active. Never includes the key itself. */
export async function GET() {
  await connection(); // read the environment at request time, not build time
  return Response.json(providerInfo());
}
