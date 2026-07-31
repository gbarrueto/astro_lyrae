/**
 * Qué dibujo del cielo corresponde a una hora dada.
 *
 * El icono se compone por capas en vez de existir uno por combinación: ocho
 * fases de luna por cuatro niveles de nube por tres precipitaciones serían
 * cientos de dibujos. Ver `docs/iconos-cielo.md`.
 *
 * La misma función corre en el build (para el primer render) y en el navegador
 * (para refrescar sin recargar), así que no depende de nada del entorno.
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
	humidity: string | null;
	precipitation: string | null;
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

/** Color del semáforo de condiciones. Los tokens viven en `global.css`. */
export const QUALITY_TONE: Record<string, string> = {
	bueno: "text-good",
	regular: "text-warn",
	malo: "text-bad",
};

/**
 * Color de la temperatura.
 *
 * Un "5°" a secas no dice nada; en azul de helada, sí. Los cortes están
 * pensados para alguien parado dos horas de noche en la precordillera, no para
 * un informe meteorológico.
 */
export function temperatureTone(celsius: number): string {
	if (celsius <= 0) return "text-temp-freezing";
	if (celsius <= 7) return "text-temp-cold";
	if (celsius <= 14) return "text-temp-mild";
	if (celsius <= 22) return "text-temp-warm";
	return "text-temp-hot";
}

/** Cómo se lee el seeing actual para alguien que nunca lo escuchó nombrar. */
export function seeingMeaning(
	seeing: { label: string; range: string; quality: string } | null,
	obscured: boolean,
): string {
	if (!seeing) return "Todavía no tenemos el dato para esta hora.";

	if (obscured) {
		return `El pronóstico marca un seeing ${seeing.label} (${seeing.range}), pero esta noche está nublado.`;
	}

	if (seeing.quality === "bueno") {
		return `Esta noche está ${seeing.label} (${seeing.range}): buena para mirar planetas y detalle fino, como los anillos de Saturno o los cráteres de la Luna.`;
	}

	if (seeing.quality === "regular") {
		return `Esta noche está ${seeing.label} (${seeing.range}): se observa bien, pero los objetos más pequeños se van a ver algo temblorosos.`;
	}

	return `Esta noche está ${seeing.label} (${seeing.range}): la imagen va a temblar bastante, así que conviene apuntar a objetos grandes antes que a planetas.`;
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

/**
 * Compone el icono.
 *
 * Orden de las capas: halo, cuerpo celeste, nubes, precipitación. Con el cielo
 * cubierto el cuerpo queda detrás de la nube; si además brilla fuerte (el sol,
 * o la luna sobre 60 % de iluminación) se enciende el halo, que es como se ve
 * de verdad una nube densa con la luna llena detrás.
 */
export function skyPicture(
	at: Date,
	event: SkyEvent | null,
	point: SeriesPoint | null,
): SkyPicture {
	const t = at.getTime();
	const clouds = cloudLayer(point?.clouds?.code);
	const heavy = clouds.layer === "clouds-heavy";

	// Sin efemérides no se puede saber si es de día: se muestra solo el cielo.
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
		// De noche, la luna solo cuenta si está sobre el horizonte. Puede faltar
		// alguno de los dos eventos cuando la luna no sale o no se pone ese día.
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

	// Con el cielo cubierto y un cuerpo que no brilla, no queda nada que asomar.
	const showBody = !(heavy && !bright);

	const layers: SkyLayer[] = [];
	if (heavy && bright) layers.push("glow");
	if (showBody) layers.push(body);
	if (clouds.layer) layers.push(clouds.layer);

	// Llover con cielo despejado no tiene sentido: si el modelo lo reporta, se ignora.
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
