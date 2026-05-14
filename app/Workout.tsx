import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import ScreenFrame from '../components/ScreenFrame';
import WorkoutScreen from '../screens/Workout';

function resolveAiPlanRaw(aiPlanParam) {
	const webWorkoutPlanStorageKey = 'bodify:web-workout-plan';
	const aiPlanFromQuery = typeof window !== 'undefined'
		? new URLSearchParams(window.location.search).get('aiPlan') || ''
		: '';
	const aiPlanFromSession = typeof window !== 'undefined'
		? (() => {
			try {
				return window.sessionStorage.getItem(webWorkoutPlanStorageKey) || '';
			} catch (_) {
				return '';
			}
		})()
		: '';
	const rawAiPlanValue = typeof aiPlanParam === 'string' && aiPlanParam.length > 0
		? aiPlanParam
		: aiPlanFromQuery || aiPlanFromSession;

	if (!rawAiPlanValue) {
		return '';
	}

	try {
		return decodeURIComponent(rawAiPlanValue);
	} catch (_) {
		return rawAiPlanValue;
	}
}

export default function WorkoutRoute() {
	const params = useLocalSearchParams();
	const aiPlanParam = Array.isArray(params?.aiPlan) ? params.aiPlan[0] : params?.aiPlan;
	const [aiPlanRaw, setAiPlanRaw] = useState(() => resolveAiPlanRaw(aiPlanParam));

	useEffect(() => {
		const syncAiPlan = () => {
			setAiPlanRaw(resolveAiPlanRaw(aiPlanParam));
		};

		syncAiPlan();

		if (typeof window === 'undefined') {
			return undefined;
		}

		const timer = window.setTimeout(syncAiPlan, 0);
		window.addEventListener('popstate', syncAiPlan);

		return () => {
			window.clearTimeout(timer);
			window.removeEventListener('popstate', syncAiPlan);
		};
	}, [aiPlanParam]);

	return (
		<ScreenFrame>
			<WorkoutScreen aiPlanRaw={aiPlanRaw} />
		</ScreenFrame>
	);
}