/**
 * Escribe `src/data/forecast.json` con el pronóstico de la noche, a partir de
 * 7Timer! ASTRO. Lo corre un cron diario; si falla, sale con código distinto de
 * cero sin tocar el archivo.
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as SunCalc from "suncalc";

/* ------------------------------------------------------------------ *
 * Dónde observamos
 * ------------------------------------------------------------------ */

const SITE = {
	lat: -37.643,
	lon: -71.695,
	timeZone: "America/Santiago",
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "src/data/forecast.json");

/* ------------------------------------------------------------------ *
 * Escalas de 7Timer!: la API devuelve enteros, no unidades. Tablas de su
 * documentación oficial; el índice del arreglo es el código.
 * ------------------------------------------------------------------ */

/** cloudcover: 1–9. */
const CLOUDS = [
	null,
	{ range: "0–6 %", label: "despejado", quality: "bueno" },
	{ range: "6–19 %", label: "casi despejado", quality: "bueno" },
	{ range: "19–31 %", label: "algunas nubes", quality: "bueno" },
	{ range: "31–44 %", label: "parcialmente nublado", quality: "regular" },
	{ range: "44–56 %", label: "parcialmente nublado", quality: "regular" },
	{ range: "56–69 %", label: "mayormente nublado", quality: "regular" },
	{ range: "69–81 %", label: "mayormente nublado", quality: "malo" },
	{ range: "81–94 %", label: "casi cubierto", quality: "malo" },
	{ range: "94–100 %", label: "cubierto", quality: "malo" },
];

/** seeing: 1–8, en segundos de arco. Menos es mejor. */
const SEEING = [
	null,
	{ range: '<0,5"', label: "excelente", quality: "bueno" },
	{ range: '0,5–0,75"', label: "muy bueno", quality: "bueno" },
	{ range: '0,75–1"', label: "bueno", quality: "bueno" },
	{ range: '1–1,25"', label: "aceptable", quality: "regular" },
	{ range: '1,25–1,5"', label: "aceptable", quality: "regular" },
	{ range: '1,5–2"', label: "mediocre", quality: "regular" },
	{ range: '2–2,5"', label: "malo", quality: "malo" },
	{ range: '>2,5"', label: "muy malo", quality: "malo" },
];

/** transparency: 1–8, magnitudes de extinción por masa de aire. Menos es mejor. */
const TRANSPARENCY = [
	null,
	{ label: "excelente", quality: "bueno" },
	{ label: "muy buena", quality: "bueno" },
	{ label: "buena", quality: "bueno" },
	{ label: "aceptable", quality: "regular" },
	{ label: "aceptable", quality: "regular" },
	{ label: "regular", quality: "regular" },
	{ label: "pobre", quality: "malo" },
	{ label: "muy pobre", quality: "malo" },
];

/** wind10m.speed: 1–8, en la escala de 7Timer, no en m/s. */
const WIND = [
	null,
	{ range: "<0,3 m/s", label: "calma", quality: "bueno" },
	{ range: "0,3–3,4 m/s", label: "brisa suave", quality: "bueno" },
	{ range: "3,4–8 m/s", label: "moderado", quality: "bueno" },
	{ range: "8–10,8 m/s", label: "fresco", quality: "regular" },
	{ range: "10,8–17,2 m/s", label: "fuerte", quality: "malo" },
	{ range: "17,2–24,5 m/s", label: "temporal", quality: "malo" },
	{ range: "24,5–32,6 m/s", label: "tormenta", quality: "malo" },
	{ range: ">32,6 m/s", label: "huracanado", quality: "malo" },
];

/** Direcciones en inglés → siglas nuestras. */
const WIND_DIRECTION = {
	N: "N",
	NE: "NE",
	E: "E",
	SE: "SE",
	S: "S",
	SW: "SO",
	W: "O",
	NW: "NO",
};

function windScale(wind) {
	const scaled = scale(WIND, wind?.speed);
	if (!scaled) return null;
	return { ...scaled, direction: WIND_DIRECTION[wind.direction] ?? wind.direction ?? null };
}

/** rh2m: −4…16, en tramos de 5 %. El 16 es el tope (100 %). */
function humidityRange(code) {
	if (typeof code !== "number") return null;
	const low = Math.min(Math.max((code + 4) * 5, 0), 100);
	const high = Math.min(low + 5, 100);
	return `${low}–${high} %`;
}

const scale = (table, code) => (table[code] ? { code, ...table[code] } : null);

/* ------------------------------------------------------------------ *
 * Fechas y zona horaria. 7Timer trabaja en UTC y Chile cambia de huso dos veces
 * al año: nunca usar un desfase fijo.
 * ------------------------------------------------------------------ */

/** "2026072818" (UTC) → Date */
function parseInit(init) {
	const [, y, m, d, h] = init.match(/^(\d{4})(\d{2})(\d{2})(\d{2})$/) ?? [];
	if (!y) throw new Error(`init con formato inesperado: ${init}`);
	return new Date(Date.UTC(+y, +m - 1, +d, +h));
}

const timeFmt = new Intl.DateTimeFormat("es-CL", {
	timeZone: SITE.timeZone,
	hour: "2-digit",
	minute: "2-digit",
	hour12: false,
});

const dateFmt = new Intl.DateTimeFormat("en-CA", {
	timeZone: SITE.timeZone,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

const localTime = (date) => timeFmt.format(date);
const localDate = (date) => dateFmt.format(date);

/** Hora local (0–23) de un instante, según la zona horaria del complejo. */
const localHour = (date) => Number(localTime(date).slice(0, 2));

const partsFmt = new Intl.DateTimeFormat("en-US", {
	timeZone: SITE.timeZone,
	hour12: false,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
});

/** Minutos que la zona del complejo adelanta a UTC en ese instante (−240 / −180). */
function zoneOffset(date) {
	const p = Object.fromEntries(partsFmt.formatToParts(date).map((x) => [x.type, x.value]));
	const asIfUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
	return (asIfUTC - date.getTime()) / 60000;
}

/**
 * El instante en que en el complejo son las `hour` del día `ymd`. SunCalc razona
 * sobre el día UTC de la fecha que recibe, así que hay que anclarlo al mediodía
 * local o la noche se desfasa entera.
 */
function atLocalHour(ymd, hour) {
	const guess = new Date(`${ymd}T${String(hour).padStart(2, "0")}:00:00Z`);
	return new Date(guess.getTime() - zoneOffset(guess) * 60000);
}

/** Suma días a una fecha "YYYY-MM-DD" sin salir del calendario local. */
function addDays(ymd, days) {
	const [y, m, d] = ymd.split("-").map(Number);
	return dateFmt.format(new Date(Date.UTC(y, m - 1, d + days, 12)));
}

/* ------------------------------------------------------------------ *
 * La noche
 * ------------------------------------------------------------------ */

/** Del atardecer de hoy al amanecer de mañana. */
function nightWindow(now) {
	// Antes del mediodía la noche vigente todavía es la que empezó ayer.
	const today = localDate(now);
	const date = localHour(now) < 12 ? addDays(today, -1) : today;

	const noon = atLocalHour(date, 12);
	const nextNoon = atLocalHour(addDays(date, 1), 12);
	const dusk = SunCalc.getTimes(noon, SITE.lat, SITE.lon);
	const dawn = SunCalc.getTimes(nextNoon, SITE.lat, SITE.lon);

	return {
		date,
		sunset: dusk.sunset,
		// Oscuridad real (crepúsculo astronómico): cuando de verdad se puede observar.
		darkFrom: dusk.night,
		darkUntil: dawn.nightEnd,
		sunrise: dawn.sunrise,
	};
}

/** Qué tan molesta va a estar la luna durante la ventana observable. */
function moonReport(window) {
	const mid = new Date((window.darkFrom.getTime() + window.darkUntil.getTime()) / 2);
	const { fraction, phase } = SunCalc.getMoonIllumination(mid);
	const times = SunCalc.getMoonTimes(window.sunset, SITE.lat, SITE.lon, true);

	const names = [
		"luna nueva",
		"luna creciente",
		"cuarto creciente",
		"gibosa creciente",
		"luna llena",
		"gibosa menguante",
		"cuarto menguante",
		"luna menguante",
	];
	const label = names[Math.round(phase * 8) % 8];

	// Con más de dos tercios iluminada, el cielo se aclara lo suficiente como
	// para tapar galaxias y nebulosas tenues. Los planetas no sufren.
	const interference = fraction > 0.66 ? "alta" : fraction > 0.33 ? "media" : "baja";

	return {
		illumination: Math.round(fraction * 100),
		label,
		interference,
		rise: times.rise ? localTime(times.rise) : null,
		set: times.set ? localTime(times.set) : null,
	};
}

/** Efemérides de varios días en instantes absolutos, para comparar en el cliente. */
function skyEvents(fromDate, days = 3) {
	const events = [];

	for (let i = 0; i < days; i++) {
		const date = addDays(fromDate, i);
		const noon = atLocalHour(date, 12);
		const sun = SunCalc.getTimes(noon, SITE.lat, SITE.lon);
		const moonTimes = SunCalc.getMoonTimes(atLocalHour(date, 0), SITE.lat, SITE.lon, true);
		const { fraction, phase } = SunCalc.getMoonIllumination(noon);

		events.push({
			date,
			sunrise: sun.sunrise.toISOString(),
			sunset: sun.sunset.toISOString(),
			// Crepúsculo civil: el rato en que ya no es de día pero todavía hay luz.
			duskEnd: sun.dusk.toISOString(),
			dawnStart: sun.dawn.toISOString(),
			moonrise: moonTimes.rise ? moonTimes.rise.toISOString() : null,
			moonset: moonTimes.set ? moonTimes.set.toISOString() : null,
			moonIllumination: Math.round(fraction * 100),
			moonPhase: Number(phase.toFixed(3)),
		});
	}

	return events;
}

/* ------------------------------------------------------------------ *
 * Veredicto
 * ------------------------------------------------------------------ */

const WORST = { bueno: 0, regular: 1, malo: 2 };
const RANK = ["bueno", "regular", "malo"];

/** Manda la nubosidad; el resto matiza el texto, no el veredicto. */
function verdictFor(segments) {
	if (segments.length === 0) return "malo";
	const scores = segments.map((s) => WORST[s.clouds.quality]).sort((a, b) => a - b);
	// La mediana evita que una sola hora mala condene una noche entera.
	return RANK[scores[Math.floor(scores.length / 2)]];
}

/** Aviso aparte: el viento no entra en el veredicto pero sí cambia la salida. */
function windWarningFor(segments) {
	const windy = segments.filter((s) => s.wind && s.wind.quality === "malo");
	if (windy.length === 0) return null;

	const worst = windy.reduce((a, b) => (b.wind.code > a.wind.code ? b : a));
	const when = windy.length === segments.length ? "toda la noche" : `cerca de las ${worst.time}`;

	return `Se espera viento ${worst.wind.label} ${when}: hay que abrigarse más de lo que dice el termómetro, y la fotografía de larga exposición se complica.`;
}

function headlineFor(verdict, segments, moon) {
	const clear = segments.filter((s) => s.clouds.quality === "bueno");

	if (verdict === "malo") {
		return clear.length > 0
			? `Noche mayormente nublada, con un claro cerca de las ${clear[0].time}.`
			: "Cielo cubierto durante toda la noche.";
	}

	if (verdict === "regular") {
		return "Noche con nubes intermitentes: se puede observar, pero a ratos.";
	}

	if (moon.interference === "alta") {
		return `Cielo despejado, aunque la ${moon.label} va a aclarar el fondo y tapar los objetos más tenues.`;
	}

	return "Cielo despejado durante la mayor parte de la noche.";
}

/* ------------------------------------------------------------------ *
 * 7Timer
 * ------------------------------------------------------------------ */

const ENDPOINT =
	`http://www.7timer.info/bin/astro.php?lon=${SITE.lon}&lat=${SITE.lat}` +
	`&ac=0&unit=metric&output=json&tzshift=0`;

async function fetchAstro(attempt = 1) {
	try {
		const res = await fetch(ENDPOINT, { signal: AbortSignal.timeout(30_000) });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		// Devuelve JSON con tabulaciones y, a veces, con el content-type equivocado.
		return JSON.parse(await res.text());
	} catch (error) {
		if (attempt >= 3) throw error;
		await new Promise((r) => setTimeout(r, attempt * 3000));
		return fetchAstro(attempt + 1);
	}
}

/** Cómo se llama el tramo, según a qué hora cae. */
function segmentLabel(hour) {
	if (hour >= 18 && hour < 23) return "Anochecer";
	if (hour >= 23 || hour < 2) return "Medianoche";
	if (hour >= 2 && hour < 6) return "Madrugada";
	return "Amanecer";
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

async function main() {
	// FORECAST_NOW permite probar el corte del mediodía sin esperar a la hora.
	const now = process.env.FORECAST_NOW ? new Date(process.env.FORECAST_NOW) : new Date();
	const astro = await fetchAstro();

	if (!Array.isArray(astro?.dataseries) || astro.dataseries.length === 0) {
		throw new Error("7Timer respondió sin dataseries");
	}

	const initAt = parseInit(astro.init);
	const window = nightWindow(now);

	const points = astro.dataseries.map((point) => {
		const at = new Date(initAt.getTime() + point.timepoint * 3600e3);
		const clouds = scale(CLOUDS, point.cloudcover);
		return {
			at: at.toISOString(),
			time: localTime(at),
			clouds,
			seeing: scale(SEEING, point.seeing),
			transparency: scale(TRANSPARENCY, point.transparency),
			obscured: clouds?.quality === "malo",
			temperature: point.temp2m,
			wind: windScale(point.wind10m),
			humidity: humidityRange(point.rh2m),
			precipitation: point.prec_type === "none" ? null : point.prec_type,
			_at: at,
		};
	});

	// La barra superior necesita condiciones a cualquier hora, no solo de noche.
	const series = points
		.filter((p) => p._at >= new Date(now.getTime() - 6 * 3600e3))
		.slice(0, 16)
		.map(({ _at, ...rest }) => rest);

	// Tres tramos y no la noche completa: una salida dura unas dos horas.
	const segments = points
		.filter((p) => p._at >= window.darkFrom && p._at <= window.darkUntil)
		.slice(0, 3)
		.map(({ _at, ...rest }) => ({ label: segmentLabel(localHour(_at)), ...rest }));

	const moon = moonReport(window);
	const verdict = verdictFor(segments);

	const forecast = {
		generatedAt: now.toISOString(),
		model: {
			name: "7Timer! ASTRO",
			basis: "GFS",
			init: astro.init,
			resolution: "3 horas",
		},
		site: SITE,
		night: {
			date: window.date,
			sunset: localTime(window.sunset),
			bookingDeadline: localTime(new Date(window.sunset.getTime() - 2 * 3600e3)),
			bookingDeadlineAt: new Date(window.sunset.getTime() - 2 * 3600e3).toISOString(),
			darkFrom: localTime(window.darkFrom),
			darkUntil: localTime(window.darkUntil),
			sunrise: localTime(window.sunrise),
			moon,
			verdict,
			headline: headlineFor(verdict, segments, moon),
			windWarning: windWarningFor(segments),
			segments,
		},
		/** Serie continua para la barra superior: condiciones a cualquier hora. */
		series,
		/** Efemérides ya resueltas, para elegir el icono sin recalcular nada. */
		sky: skyEvents(window.date, 3),
	};

	if (segments.length === 0) {
		// El modelo se quedó corto para la noche que viene.
		throw new Error("Ningún punto del modelo cae dentro de la ventana nocturna");
	}

	const serialized = JSON.stringify(forecast, null, "\t") + "\n";
	const previous = await readFile(OUTPUT, "utf8").catch(() => null);

	await mkdir(path.dirname(OUTPUT), { recursive: true });
	await writeFile(OUTPUT, serialized);

	const changed = previous === null || stripTimestamp(previous) !== stripTimestamp(serialized);
	console.log(
		`${changed ? "Actualizado" : "Sin cambios"}: noche del ${window.date}, ` +
			`veredicto "${verdict}", ${segments.length} tramos (modelo ${astro.init}).`,
	);
}

/** El instante de generación cambia siempre; no cuenta como cambio de datos. */
function stripTimestamp(json) {
	return json.replace(/"generatedAt":\s*"[^"]*",?\n?/, "");
}

main().catch((error) => {
	console.error(`No se pudo generar el pronóstico: ${error.message}`);
	process.exit(1);
});
