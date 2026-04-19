import { ZodError } from "zod";
import {
  researchVoiceAcceptedMimeTypes,
  researchVoiceContextSchema,
  researchVoiceIntakeResponseSchema,
} from "~/contracts/voice";
import { env } from "~/env";
import { ResearchVoiceService } from "~/server/application/intelligence/research-voice-service";
import { auth } from "~/server/auth";
import { DeepSeekClient } from "~/server/infrastructure/intelligence/deepseek-client";
import { PythonVoiceTranscriptionClient } from "~/server/infrastructure/intelligence/python-voice-transcription-client";
import { LocalStockSearchService } from "~/server/infrastructure/screening/local-stock-search-service";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return Response.json({ message }, { status });
}

function isAcceptedVoiceMimeType(mimeType: string) {
  const normalizedMime = mimeType.toLowerCase().trim();
  const baseMime = normalizedMime.split(";", 1)[0];

  return (
    researchVoiceAcceptedMimeTypes.includes(normalizedMime as never) ||
    researchVoiceAcceptedMimeTypes.includes(baseMime as never)
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const formData = await request.formData();
    const audio = formData.get("audio");
    const contextRaw = formData.get("context");

    if (!(audio instanceof File)) {
      return jsonError("audio file is required");
    }

    if (typeof contextRaw !== "string") {
      return jsonError("voice context is required");
    }

    if (!isAcceptedVoiceMimeType(audio.type)) {
      return jsonError("unsupported voice mime type", 415);
    }

    if (audio.size > env.VOICE_MAX_UPLOAD_BYTES) {
      return jsonError("voice upload exceeds the configured size limit", 413);
    }

    const context = researchVoiceContextSchema.parse(JSON.parse(contextRaw));
    const audioBytes = new Uint8Array(await audio.arrayBuffer());
    const service = new ResearchVoiceService({
      pythonVoiceTranscriptionClient: new PythonVoiceTranscriptionClient(),
      deepSeekClient: new DeepSeekClient(),
      localStockSearchService: new LocalStockSearchService(),
    });

    const response = await service.processResearchVoice({
      audioBytes,
      fileName: audio.name || "research-voice.webm",
      mimeType: audio.type,
      context,
    });

    return Response.json(researchVoiceIntakeResponseSchema.parse(response));
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError) {
      return jsonError("invalid voice intake payload");
    }

    return jsonError(
      error instanceof Error ? error.message : "voice intake failed",
      500,
    );
  }
}
