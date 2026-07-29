/**
 * Pronóstico de la noche para el complejo, en un archivo.
 *
 * Consulta 7Timer! ASTRO (modelo GFS, un punto cada 3 horas), recorta la
 * ventana entre el atardecer y el amanecer, traduce las escalas numéricas a
 * lenguaje que entienda alguien que no sabe astronomía, y escribe
 * `src/data/forecast.json`.
 *
 * Lo corre un cron de GitHub Actions una vez al día. Si algo falla, sale con
 * código distinto de cero y NO toca el archivo: el sitio se queda con el
 * pronóstico de ayer, que es mejor que quedarse sin ninguno.
 *
 *   node scripts/forecast.mjs
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
 * Escalas de 7Timer!
 *
 * La API devuelve enteros, no unidades. Estas tablas son las de su
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

/**
 * seeing: 1–8, en segundos de arco. Menos es mejor: mide cuánto tiembla la
 * imagen por turbulencia, o sea cuánto detalle se puede sacar en planetas.
 */
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

/**
 * transparency: 1–8, magnitudes de extinción por masa de aire. Menos es
 * mejor: mide cuánta luz se come la atmósfera, o sea qué tan tenues son los
 * objetos que alcanzamos a ver.
 */
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

/** rh2m: −4…16, en tramos de 5 %. El 16 es el tope (100 %). */
function humidityRange(code) {
	if (typeof code !== "number") return null;
	const low = Math.min(Math.max((code + 4) * 5, 0), 100);
	const high = Math.min(low + 5, 100);
	return `${low}–${high} %`;
}

const scale = (table, code) => (table[code] ? { code, ...table[code] } : null);

/* ------------------------------------------------------------------ *
 * Fechas y zona horaria
 *
 * 7Timer trabaja en UTC. Chile cambia de huso dos veces al año, así que
 * cualquier desfase fijo lee la hora equivocada media temporada: siempre se
 * resuelve con la zona horaria real.
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
 * El instante exacto en que en el complejo son las `hour` del día `ymd`.
 *
 * SunCalc razona sobre el día UTC de la fecha que recibe, así que pasarle un
 * "ahora" cualquiera desfasa la noche entera: entre las 20:00 y medianoche en
 * Chile, el día UTC ya cambió. Anclando al mediodía local eso no ocurre.
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

/**
 * La ventana observable: del atardecer de hoy al amanecer de mañana. Si el
 * script corre de madrugada, la noche en curso sigue siendo la de ayer.
 */
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

/**
 * Salidas y puestas de sol y luna para varios días, en instantes absolutos.
 *
 * La barra superior tiene que decidir a cualquier hora si dibuja sol, luna o
 * estrellas, y el sitio es estático: en vez de recalcular efemérides en el
 * navegador, viajan resueltas y el cliente solo compara marcas de tiempo.
 */
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

/**
 * Manda la nubosidad: sin cielo despejado no hay nada que hacer, por muy
 * bueno que esté el seeing. El resto matiza el texto, no el veredicto.
 */
function verdictFor(segments) {
	if (segments.length === 0) return "malo";
	const scores = segments.map((s) => WORST[s.clouds.quality]).sort((a, b) => a - b);
	// La mediana evita que una sola hora mala condene una noche entera.
	return RANK[scores[Math.floor(scores.length / 2)]];
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
			/**
			 * Con el cielo tapado, el seeing y la transparencia dejan de decir
			 * nada: no hay nada que observar por muy quieta que esté la
			 * atmósfera. La UI los muestra, pero anulados.
			 */
			obscured: clouds?.quality === "malo",
			temperature: point.temp2m,
			humidity: humidityRange(point.rh2m),
			precipitation: point.prec_type === "none" ? null : point.prec_type,
			_at: at,
		};
	});

	// La barra superior necesita condiciones a cualquier hora, no solo de noche,
	// así que la serie completa viaja aparte. 48 horas alcanzan de sobra: el
	// archivo se regenera a diario y así sobrevive un día de cron caído.
	const series = points
		.filter((p) => p._at >= new Date(now.getTime() - 6 * 3600e3))
		.slice(0, 16)
		.map(({ _at, ...rest }) => rest);

	// La ventana observable es la que arma el bloque del pronóstico.
	const segments = points
		.filter((p) => p._at >= window.darkFrom && p._at <= window.darkUntil)
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
			/**
			 * La hora tope para pedir la salida de esta noche. La regla del
			 * servicio ("dos horas antes del atardecer") solo es accionable si
			 * alguien ya hizo la resta: nadie sabe de memoria cuándo atardece.
			 */
			bookingDeadline: localTime(new Date(window.sunset.getTime() - 2 * 3600e3)),
			darkFrom: localTime(window.darkFrom),
			darkUntil: localTime(window.darkUntil),
			sunrise: localTime(window.sunrise),
			moon,
			verdict,
			headline: headlineFor(verdict, segments, moon),
			segments,
		},
		/** Serie continua para la barra superior: condiciones a cualquier hora. */
		series,
		/** Efemérides ya resueltas, para elegir el icono sin recalcular nada. */
		sky: skyEvents(window.date, 3),
	};

	if (segments.length === 0) {
		// Pasa si el modelo se quedó corto para la noche que viene. Preferimos
		// avisar antes que publicar una noche vacía.
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
