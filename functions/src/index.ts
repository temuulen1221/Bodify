import { initializeApp } from "firebase-admin/app";
import {
    FieldValue,
    getFirestore,
    Timestamp,
} from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";

const googleGenaiApiKey = defineSecret("GOOGLE_GENAI_API_KEY");

setGlobalOptions({maxInstances: 10});

initializeApp();

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_URL =
	`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const ALLOWED_EMOTIONS = new Set([
	"neutral",
	"happy",
	"sad",
	"excited",
	"encouraging",
	"thinking",
	"celebrating",
	"surprised",
	"confused",
]);
const ALLOWED_ACTIONS = new Set([
	"none",
	"open_workout",
	"open_recovery",
	"open_post_workout_summary",
	"open_mission_center",
	"open_avatar_screen",
	"log_workout",
	"claim_reward",
]);
const ALLOWED_ANIMATIONS = new Set([
	"talk",
	"happy",
	"sad",
	"dance",
	"wave",
	"laugh",
	"surprised",
	"thinking",
]);
const CALLABLE_CORS_ORIGINS = [
	"https://bodify-37337.web.app",
	"https://bodify-37337.firebaseapp.com",
	// Add your custom domain here if you have one
];

type ChatRole = "user" | "assistant" | "model";

interface ChatHistoryItem {
	role: ChatRole;
	text: string;
}

interface ChatWithAIRequest {
	message?: string;
	personality?: string;
	userProfile?: Record<string, unknown>;
	history?: ChatHistoryItem[];
	context?: {
		screen?: string;
		workoutType?: string;
		userState?: string;
	};
}

const CHAT_RESPONSE_MAX_CHARS = 280;
const CHAT_RESPONSE_MAX_OUTPUT_TOKENS = 160;

function trimCoachText(value: string, maxChars: number = CHAT_RESPONSE_MAX_CHARS): string {
	const normalized = String(value || "").replace(/\s+/g, " ").trim();
	if (!normalized) return "";
	if (normalized.length <= maxChars) return normalized;

	const boundarySlice = normalized.slice(0, maxChars + 1);
	const sentenceBoundary = Math.max(
		boundarySlice.lastIndexOf(". "),
		boundarySlice.lastIndexOf("! "),
		boundarySlice.lastIndexOf("? "),
	);

	if (sentenceBoundary >= Math.floor(maxChars * 0.6)) {
		return boundarySlice.slice(0, sentenceBoundary + 1).trim();
	}

	const wordBoundary = boundarySlice.lastIndexOf(" ");
	if (wordBoundary >= Math.floor(maxChars * 0.7)) {
		return `${boundarySlice.slice(0, wordBoundary).trim()}...`;
	}

	return `${normalized.slice(0, maxChars).trim()}...`;
}

interface StructuredAiResponse {
	text: string;
	emotion: string;
	xp: number;
	action: string;
	bondDelta: number;
	missionImpact: {
		missionId: string | null;
		progressDelta: number;
		completed: boolean;
	};
	ui: {
		animation: string;
		tts: boolean;
	};
}

function buildSystemPrompt(payload: ChatWithAIRequest): string {
	return [
		"You are Bodify, an avatar-first fitness AI companion inside a gamified fitness app.",
		"You must respond ONLY as compact JSON with no markdown fences.",
		"Keep the answer supportive, action-oriented, and as short as possible.",
		"Use 1 sentence by default.",
		"If the user asks for a workout, routine, or detailed guidance, give only the essential plan in at most 2 short sentences with no extra explanation.",
		`Keep the text under ${CHAT_RESPONSE_MAX_CHARS} characters.`,
		"Allowed emotions: neutral, happy, sad, excited, encouraging, thinking, celebrating, surprised, confused.",
		"Allowed actions: none, open_workout, open_recovery, open_post_workout_summary, open_mission_center, open_avatar_screen, log_workout, claim_reward.",
		"Allowed animations: talk, happy, sad, dance, wave, laugh, surprised, thinking.",
		"Schema:",
		JSON.stringify({
			text: "short coach response",
			emotion: "encouraging",
			xp: 6,
			action: "open_workout",
			bondDelta: 1,
			missionImpact: {missionId: null, progressDelta: 0, completed: false},
			ui: {animation: "wave", tts: true},
		}),
		`Personality: ${String(payload.personality || "friendly_coach")}`,
		`User profile: ${JSON.stringify(payload.userProfile || {})}`,
		`Context: ${JSON.stringify(payload.context || {})}`,
	].join("\n");
}

function sanitizeHistory(history: ChatWithAIRequest["history"]): ChatHistoryItem[] {
	if (!Array.isArray(history)) return [];
	return history
		.filter((item): item is ChatHistoryItem => !!item && typeof item.text === "string")
		.slice(-12)
		.map((item) => ({
			role: (item.role === "assistant" || item.role === "model" ? "model" : "user") as ChatRole,
			text: item.text.trim().slice(0, 600),
		}))
		.filter((item) => item.text.length > 0);
}

function stripCodeFences(raw: string): string {
	const trimmed = raw.trim();
	if (!trimmed.startsWith("```") ) return trimmed;
	return trimmed
		.replace(/^```(?:json)?/i, "")
		.replace(/```$/i, "")
		.trim();
}

function inferEmotion(text: string): string {
	if (/(great job|amazing|awesome|fantastic|celebrate)/i.test(text)) return "celebrating";
	if (/(you can|keep going|let's do this|got this)/i.test(text)) return "encouraging";
	if (/(sorry|tough|hard day)/i.test(text)) return "sad";
	if (/(wow|surprised|really)/i.test(text)) return "surprised";
	if (/(think|maybe|consider)/i.test(text)) return "thinking";
	return "neutral";
}

function inferAction(text: string): string {
	if (/(recover|rest|stretch|hydration)/i.test(text)) return "open_recovery";
	if (/(workout|exercise|session|start)/i.test(text)) return "open_workout";
	if (/(mission|quest)/i.test(text)) return "open_mission_center";
	if (/(reward|claim|unlock)/i.test(text)) return "claim_reward";
	return "none";
}

function animationForEmotion(emotion: string): string {
	switch (emotion) {
	case "happy": return "happy";
	case "sad": return "sad";
	case "excited": return "dance";
	case "encouraging": return "wave";
	case "celebrating": return "laugh";
	case "thinking": return "thinking";
	case "surprised": return "surprised";
	default: return "talk";
	}
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeResponse(rawText: string): StructuredAiResponse {
	const cleanText = stripCodeFences(rawText);
	let parsed: Partial<StructuredAiResponse> = {};
	try {
		parsed = JSON.parse(cleanText) as Partial<StructuredAiResponse>;
	} catch {
		parsed = {text: cleanText};
	}

	const text = typeof parsed.text === "string" && parsed.text.trim().length > 0 ?
		trimCoachText(parsed.text) :
		"You are doing well. Let's keep moving with one small next step.";
	const emotion = typeof parsed.emotion === "string" && ALLOWED_EMOTIONS.has(parsed.emotion) ?
		parsed.emotion : inferEmotion(text);
	const action = typeof parsed.action === "string" && ALLOWED_ACTIONS.has(parsed.action) ?
		parsed.action : inferAction(text);
	const xp = clampInteger(parsed.xp, 0, 20, 5);
	const bondDelta = clampInteger(parsed.bondDelta, -3, 5, emotion === "sad" ? 0 : 1);
	const missionImpact = parsed.missionImpact && typeof parsed.missionImpact === "object" ? {
		missionId: typeof parsed.missionImpact.missionId === "string" ?
			parsed.missionImpact.missionId : null,
		progressDelta: clampInteger(parsed.missionImpact.progressDelta, 0, 100, 0),
		completed: Boolean(parsed.missionImpact.completed),
	} : {
		missionId: null,
		progressDelta: 0,
		completed: false,
	};
	const ui = parsed.ui && typeof parsed.ui === "object" ? {
		animation: typeof parsed.ui.animation === "string" && ALLOWED_ANIMATIONS.has(parsed.ui.animation) ?
			parsed.ui.animation : animationForEmotion(emotion),
		tts: parsed.ui.tts !== false,
	} : {
		animation: animationForEmotion(emotion),
		tts: true,
	};

	return {text, emotion, xp, action, bondDelta, missionImpact, ui};
}

async function writeAiResult(userId: string, request: ChatWithAIRequest,
	response: StructuredAiResponse): Promise<void> {
	const db = getFirestore();
	const userRef = db.collection("users").doc(userId);
	const chatRef = userRef.collection("aiChats").doc();

	await Promise.all([
		userRef.set({
			aiXP: FieldValue.increment(response.xp),
			avatarBond: FieldValue.increment(response.bondDelta),
			lastAIEmotion: response.emotion,
			lastAIAction: response.action,
			lastAIAt: Timestamp.now(),
		}, {merge: true}),
		chatRef.set({
			message: request.message || "",
			personality: request.personality || "friendly_coach",
			context: request.context || {},
			response,
			createdAt: Timestamp.now(),
		}),
	]);
}

async function executeChatWithAI(
	data: ChatWithAIRequest,
	userId: string | null = null,
): Promise<StructuredAiResponse> {
	const message = typeof data.message === "string" ? data.message.trim() : "";
	if (!message) {
		throw new HttpsError("invalid-argument", "A non-empty message is required.");
	}

	const apiKey = googleGenaiApiKey.value();
	if (!apiKey) {
		throw new HttpsError(
			"failed-precondition",
			"GOOGLE_GENAI_API_KEY is not configured for Firebase Functions.",
		);
	}

	const contents = [
		...sanitizeHistory(data.history).map((item) => ({
			role: item.role,
			parts: [{text: item.text}],
		})),
		{
			role: "user",
			parts: [{text: message.slice(0, 1200)}],
		},
	];

	const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
		method: "POST",
		headers: {"Content-Type": "application/json"},
		body: JSON.stringify({
			systemInstruction: {
				parts: [{text: buildSystemPrompt(data)}],
			},
			contents,
			generationConfig: {
				temperature: 0.4,
				topP: 0.9,
				maxOutputTokens: CHAT_RESPONSE_MAX_OUTPUT_TOKENS,
			},
		}),
	});

	if (!response.ok) {
		let details = response.statusText;
		try {
			const err = await response.json() as {error?: {message?: string}};
			details = err.error?.message || details;
		} catch {
			// keep status text fallback
		}
		throw new HttpsError("internal", `Gemini request failed: ${details}`);
	}

	const dataResponse = await response.json() as {
		candidates?: Array<{content?: {parts?: Array<{text?: string}>}}>;
	};
	const modelText = dataResponse.candidates?.[0]?.content?.parts?.[0]?.text;
	if (!modelText) {
		throw new HttpsError("internal", "Gemini returned no usable content.");
	}

	const structured = normalizeResponse(modelText);
	if (userId) {
		await writeAiResult(userId, data, structured);
	}
	return structured;
}

function applyLocalCors(response: { set: (name: string, value: string) => void; status: (code: number) => { send: (body?: unknown) => void; json: (body: unknown) => void } }, requestOrigin?: string): void {
	const allowedOrigins = [
		"https://bodify-37337.web.app",
		"https://bodify-37337.firebaseapp.com",
	];
	const origin = (allowedOrigins.includes(requestOrigin ?? "")) ? requestOrigin! : allowedOrigins[0];
	response.set("Access-Control-Allow-Origin", origin);
	response.set("Access-Control-Allow-Methods", "POST, OPTIONS");
	response.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
	response.set("Access-Control-Max-Age", "3600");
}

export const chatWithAI = onCall({
	region: "us-central1",
	cors: CALLABLE_CORS_ORIGINS,
	secrets: [googleGenaiApiKey],
}, async (request) => {
	return executeChatWithAI((request.data || {}) as ChatWithAIRequest, request.auth?.uid || null);
});

export const chatWithAIHttp = onRequest({
	region: "us-central1",
	cors: CALLABLE_CORS_ORIGINS,
	secrets: [googleGenaiApiKey],
}, async (request, response) => {
	applyLocalCors(response, request.headers.origin);
	if (request.method === "OPTIONS") {
		response.status(204).send("");
		return;
	}

	if (request.method !== "POST") {
		response.status(405).json({error: "Method not allowed"});
		return;
	}

	try {
		const result = await executeChatWithAI((request.body || {}) as ChatWithAIRequest, null);
		response.status(200).json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown chat error";
		const code = error instanceof HttpsError ? error.code : "internal";
		response.status(500).json({error: message, code});
	}
});
