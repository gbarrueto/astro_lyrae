/**
 * Icono de cielo compuesto por capas y helpers de presentación del pronóstico.
 * Corre igual en el build y en el navegador. Ver `docs/iconos-cielo.md`.
 */

export type SkyEvent = {
	date: string;
	sunrise: string;
	sunset: string;
	duskEnd: string;
	dawnStart: string;
	moonrise: string | null;
	moonset: string | null;
	moonIllumination: number;
	moonPhase: number;
};

export type SeriesPoint = {
	at: string;
	time: string;
	clouds: { code: number; range: string; label: string; quality: string } | null;
	seeing: { code: number; range: string; label: string; quality: string } | null;
	transparency: { code: number; label: string; quality: string } | null;
	obscured: boolean;
	temperature: number;
	wind: { code: number; range: string; label: string; quality: string; direction: string } | null;
	humidity: string | null;
	precipitation: string | null;
};

/** Un tramo de la noche: un punto de la serie con su nombre. */
export type NightSegment = SeriesPoint & { label: string };

export type MoonSpan = { from: string; to: string; fromAt: string; toAt: string };

export type MoonInfo = {
	illumination: number;
	phase: number;
	label: string;
	interference: "alta" | "media" | "baja";
	rise: string | null;
	riseAt: string | null;
	set: string | null;
	setAt: string | null;
	moonlit: MoonSpan[];
};

export type NightData = {
	date: string;
	offset: number;
	sunset: string;
	sunsetAt: string;
	darkFrom: string;
	darkFromAt: string;
	darkUntil: string;
	darkUntilAt: string;
	sunrise: string;
	sunriseAt: string;
	bookingDeadline: string;
	bookingDeadlineAt: string;
	moon: MoonInfo;
	verdict: string;
	headline: Phrase;
	windWarning: Phrase | null;
	segments: NightSegment[];
};

/** Nombre de archivo dentro de `src/assets/sky/`, sin extensión. */
export type SkyLayer = string;

export type SkyPicture = {
	/** Capas de atrás hacia adelante. */
	layers: SkyLayer[];
	/** Descripción para lectores de pantalla y para el `title`. */
	label: string;
	daytime: "día" | "crepúsculo" | "noche";
};

/** Tokens definidos en `global.css`. */
export const QUALITY_TONE: Record<string, string> = {
	bueno: "text-good",
	regular: "text-warn",
	malo: "text-bad",
	imposible: "text-off",
};

/** Frase en piezas: las que llevan `quality` se destacan con su color. */
export type PhrasePart = { text: string; quality?: string };
export type Phrase = PhrasePart[];

/** Cortes pensados para una noche de precordillera, no para un informe. */
export function temperatureTone(celsius: number): string {
	if (celsius <= 0) return "text-temp-freezing";
	if (celsius <= 7) return "text-temp-cold";
	if (celsius <= 14) return "text-temp-mild";
	if (celsius <= 22) return "text-temp-warm";
	return "text-temp-hot";
}

/** El seeing actual en lenguaje llano. */
export function seeingMeaning(
	seeing: { label: string; range: string; quality: string } | null,
	obscured: boolean,
): Phrase {
	if (!seeing) return [{ text: "Todavía no tenemos el dato para esta hora." }];

	const value = { text: `${seeing.label} (${seeing.range})`, quality: seeing.quality };

	if (obscured) {
		return [
			{ text: "El pronóstico marca un seeing " },
			{ ...value, quality: "imposible" },
			{ text: ", pero esta noche está nublado." },
		];
	}

	const tail =
		seeing.quality === "bueno"
			? ": buena para mirar planetas y detalle fino, como los anillos de Saturno o los cráteres de la Luna."
			: seeing.quality === "regular"
				? ": se observa bien, pero los objetos más pequeños se van a ver algo temblorosos."
				: ": la imagen va a temblar bastante, así que conviene apuntar a objetos grandes antes que a planetas.";

	return [{ text: "Esta noche está " }, value, { text: tail }];
}

/** Sigla de origen del viento → hacia dónde apunta la flecha, y su nombre. */
const WIND_ARROWS: Record<string, { deg: number; name: string }> = {
	N: { deg: 180, name: "norte" },
	NE: { deg: 225, name: "noreste" },
	E: { deg: 270, name: "este" },
	SE: { deg: 315, name: "sureste" },
	S: { deg: 0, name: "sur" },
	SO: { deg: 45, name: "suroeste" },
	O: { deg: 90, name: "oeste" },
	NO: { deg: 135, name: "noroeste" },
};

export function windArrow(direction: string | null): { deg: number; label: string } | null {
	const arrow = direction ? WIND_ARROWS[direction] : null;
	return arrow ? { deg: arrow.deg, label: `viento del ${arrow.name}` } : null;
}

const MOON_PHASES = [
	"moon-new",
	"moon-waxing-crescent",
	"moon-first-quarter",
	"moon-waxing-gibbous",
	"moon-full",
	"moon-waning-gibbous",
	"moon-last-quarter",
	"moon-waning-crescent",
] as const;

const MOON_NAMES: Record<string, string> = {
	"moon-new": "luna nueva",
	"moon-waxing-crescent": "luna creciente",
	"moon-first-quarter": "cuarto creciente",
	"moon-waxing-gibbous": "gibosa creciente",
	"moon-full": "luna llena",
	"moon-waning-gibbous": "gibosa menguante",
	"moon-last-quarter": "cuarto menguante",
	"moon-waning-crescent": "luna menguante",
};

/** `moonPhase` (0–1) al dibujo que le toca: ocho tramos de 0,125. */
export function moonPhaseLayer(phase: number): SkyLayer {
	const index = Math.round(phase * 8) % 8;
	return MOON_PHASES[index];
}

/** Nubosidad de 7Timer (1–9) a los cuatro niveles que se dibujan. */
export function cloudLayer(code: number | undefined): { layer: SkyLayer | null; label: string } {
	if (!code || code <= 2) return { layer: null, label: "despejado" };
	if (code <= 4) return { layer: "clouds-light", label: "con pocas nubes" };
	if (code <= 6) return { layer: "clouds-medium", label: "parcialmente nublado" };
	return { layer: "clouds-heavy", label: "nublado" };
}

const ms = (iso: string) => new Date(iso).getTime();

/** El día de `sky` que contiene ese instante (el último que ya empezó). */
export function eventsFor(sky: SkyEvent[], at: Date): SkyEvent | null {
	if (sky.length === 0) return null;
	const t = at.getTime();
	// El "día solar" va de amanecer a amanecer: antes del alba manda el día anterior.
	let chosen = sky[0];
	for (const event of sky) {
		if (ms(event.dawnStart) <= t) chosen = event;
	}
	return chosen;
}

/** El punto de la serie más cercano al instante pedido. */
export function pointFor(series: SeriesPoint[], at: Date): SeriesPoint | null {
	if (series.length === 0) return null;
	const t = at.getTime();
	return series.reduce((best, point) =>
		Math.abs(ms(point.at) - t) < Math.abs(ms(best.at) - t) ? point : best,
	);
}

/** Capas de atrás hacia adelante: halo, cuerpo, nubes, precipitación. */
export function skyPicture(
	at: Date,
	event: SkyEvent | null,
	point: SeriesPoint | null,
): SkyPicture {
	const t = at.getTime();
	const clouds = cloudLayer(point?.clouds?.code);
	const heavy = clouds.layer === "clouds-heavy";

	if (!event) {
		return {
			layers: clouds.layer ? [clouds.layer] : ["stars"],
			label: clouds.label,
			daytime: "noche",
		};
	}

	const isDay = t >= ms(event.sunrise) && t < ms(event.sunset);
	const isTwilight =
		(t >= ms(event.sunset) && t < ms(event.duskEnd)) ||
		(t >= ms(event.dawnStart) && t < ms(event.sunrise));

	let body: SkyLayer;
	let bodyName: string;
	let bright: boolean;

	if (isDay || isTwilight) {
		body = "sun";
		bodyName = isTwilight ? "atardecer" : "día";
		bright = true;
	} else {
		// Puede faltar alguno de los dos eventos si la luna no sale o no se pone.
		const rise = event.moonrise ? ms(event.moonrise) : null;
		const set = event.moonset ? ms(event.moonset) : null;
		const up =
			rise !== null && set !== null
				? set > rise
					? t >= rise && t < set
					: t >= rise || t < set // la puesta cae al otro día
				: rise !== null
					? t >= rise
					: set !== null
						? t < set
						: false;

		if (up) {
			body = moonPhaseLayer(event.moonPhase);
			bodyName = MOON_NAMES[body];
			bright = event.moonIllumination > 60;
		} else {
			body = "stars";
			bodyName = "noche sin luna";
			bright = false;
		}
	}

	const showBody = !(heavy && !bright);

	const layers: SkyLayer[] = [];
	if (heavy && bright) layers.push("glow");
	if (showBody) layers.push(body);
	if (clouds.layer) layers.push(clouds.layer);

	// Llover con cielo despejado no tiene sentido: se ignora.
	if (point?.precipitation && clouds.layer && clouds.layer !== "clouds-light") {
		layers.push(point.precipitation === "snow" ? "snow" : "rain");
	}

	// La etiqueta describe lo que se ve, no lo que hay: si la nube tapó la luna,
	// nombrarla confundiría a quien escucha el lector de pantalla.
	const described = [showBody ? bodyName : null, point?.clouds ? clouds.label : null].filter(
		Boolean,
	);

	return {
		layers,
		label: described.join(", ") || "cielo",
		daytime: isDay ? "día" : isTwilight ? "crepúsculo" : "noche",
	};
}

/* ------------------------------------------------------------------ *
 * Presentación de la noche
 * ------------------------------------------------------------------ */

const at = (iso: string) => new Date(iso).getTime();

/** 38520000 → "10 h 42". Las duraciones se leen en horas, no en minutos. */
export function formatDuration(msTotal: number): string {
	const minutes = Math.max(0, Math.round(msTotal / 60000));
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	if (hours === 0) return `${rest} min`;
	return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

/** Cuánto dura la oscuridad y cuánto de eso queda sin luna. */
export function darkness(night: NightData) {
	const total = at(night.darkUntilAt) - at(night.darkFromAt);
	const lit = night.moon.moonlit.reduce(
		(sum, span) =>
			sum +
			Math.max(
				0,
				Math.min(at(span.toAt), at(night.darkUntilAt)) -
					Math.max(at(span.fromAt), at(night.darkFromAt)),
			),
		0,
	);
	return { total, moonless: Math.max(0, total - lit) };
}

/**
 * El terminador es media elipse cuyo ancho depende de la fase. En el hemisferio
 * sur la luz entra por el lado contrario al del norte.
 */
export function phasePath(phase: number): string {
	const r = 42;
	const x = Math.cos(2 * Math.PI * phase);
	const edge = phase < 0.5 ? 0 : 1;
	const terminator = x > 0 ? 1 - edge : edge;
	return `M 0 ${-r} A ${r} ${r} 0 0 ${edge} 0 ${r} A ${Math.abs(x) * r} ${r} 0 0 ${terminator} 0 ${-r} Z`;
}

export type ServiceImpact = {
	service: string;
	href: string;
	status: "Óptimo" | "Parcial" | "No";
	limit: string;
	quality: "bueno" | "regular" | "imposible";
};

/**
 * Qué se puede hacer esta noche, servicio por servicio. El brillo de la luna
 * limita el cielo profundo, no la observación de la Luna ni de los planetas.
 */
export function serviceImpact(night: NightData): ServiceImpact[] {
	const clouded = night.verdict === "imposible" || night.verdict === "malo";
	const bestSeeing = night.segments.reduce<string | null>(
		(best, s) => (s.seeing?.quality === "bueno" ? "bueno" : best),
		null,
	);
	const windy = night.segments.some((s) => s.wind?.quality === "malo");
	const moon = night.moon;

	const blocked = (service: string, href: string): ServiceImpact => ({
		service,
		href,
		status: "No",
		limit: "tapado por nubes",
		quality: "imposible",
	});

	return [
		clouded
			? blocked("Observación Visual", "/service/observacion-visual")
			: {
					service: "Observación Visual",
					href: "/service/observacion-visual",
					status: bestSeeing ? "Óptimo" : "Parcial",
					limit: bestSeeing ? "seeing fino" : "seeing inestable",
					quality: bestSeeing ? "bueno" : "regular",
				},

		clouded
			? blocked("EAA", "/service/eaa")
			: {
					service: "EAA",
					href: "/service/eaa",
					status: moon.interference === "baja" ? "Óptimo" : "Parcial",
					limit:
						moon.interference === "baja"
							? "sin luna en la ventana"
							: `luna al ${moon.illumination}%`,
					quality: moon.interference === "baja" ? "bueno" : "regular",
				},

		clouded
			? blocked("Fotografía Nocturna", "/service/fotografia-nocturna")
			: {
					service: "Fotografía Nocturna",
					href: "/service/fotografia-nocturna",
					status: windy || moon.interference === "alta" ? "Parcial" : "Óptimo",
					limit: windy
						? "viento sobre el trípode"
						: moon.interference === "alta"
							? "fondo iluminado"
							: "cielo limpio y calma",
					quality: windy || moon.interference === "alta" ? "regular" : "bueno",
				},
	];
}
