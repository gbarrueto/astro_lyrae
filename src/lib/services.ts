import type { ImageMetadata } from "astro";
import {
	Telescope01Icon,
	EyeIcon,
	SettingsIcon,
	Camera01Icon,
	CameraLensIcon,
	CameraTripodIcon,
	SmartPhone01Icon,
} from "@hugeicons/core-free-icons";
import {
	mwOverCabin,
	visualGroup,
	mainDobson,
	eaaSetup,
	eaaScreen,
	nightGroup1,
	nightGroup2,
	clientPhoto,
	eaaLive1,
	eaaLive2,
	eyepieceSet,
	goToMount,
	tsOptics,
	asiCamera,
	sonyA7,
} from "@/assets";

/* ------------------------------------------------------------------ *
 * Temporadas y objetivos (hemisferio sur)
 * ------------------------------------------------------------------ */

export type Season = "summer" | "winter" | "out-of-season";

export function getSeason(date = new Date()): Season {
	const month = date.getMonth() + 1;
	if ([12, 1, 2].includes(month)) return "summer";
	if ([6, 7, 8].includes(month)) return "winter";
	return "out-of-season";
}

type TargetKind = "visual" | "eaa" | "wide-field";

const seasonalTargets = {
	visual: {
		circumpolar: [
			"Nebulosa Carina (NGC 3372)",
			"Nebulosa de la Tarántula (NGC 2070)",
			"Cúmulo 47 Tucanae",
		],
		winter: ["Cúmulo Omega Centauri"],
		summer: ["Nebulosa de Orión (M42)", "Las Pléyades (M45)"],
	},
	eaaOnly: {
		circumpolar: ["Galaxia M83", "Galaxia Centaurus A"],
		winter: ["Nebulosa de la Laguna (M8)", "Nebulosa Trífida (M20)"],
		summer: ["Nebulosa Roseta", "Nebulosa Cabeza de Caballo"],
	},
	"wide-field": {
		circumpolar: ["Nubes de Magallanes"],
		winter: ["Centro de la Vía Láctea"],
		summer: [] as string[],
	},
} as const;

/** Objetivos siempre presentes: no dependen de la temporada, sí de la fecha exacta. */
const variableTargets = ["Júpiter", "Saturno", "La Luna"];

function seasonalList(group: keyof typeof seasonalTargets, season: Season): string[] {
	if (season === "out-of-season") return [];
	return [...seasonalTargets[group].circumpolar, ...seasonalTargets[group][season]];
}

export function getTargets(kind: TargetKind, season: Season): string[] {
	if (season === "out-of-season") return [];
	switch (kind) {
		case "visual":
			return [...seasonalList("visual", season), ...variableTargets];
		case "eaa":
			return [...seasonalList("visual", season), ...seasonalList("eaaOnly", season)];
		case "wide-field":
			return seasonalList("wide-field", season);
	}
}

/* ------------------------------------------------------------------ *
 * Servicios: condiciones comunes
 * ------------------------------------------------------------------ */

export const booking = {
	/** El equipo hay que armarlo y alinearlo antes de que oscurezca. */
	deadline: "Avísanos a más tardar 2 horas antes del atardecer.",
	/** Cobrar solo la sesión hecha hace irrelevante el pronóstico. */
	payment: "Pagas al terminar la sesión: si no se alcanza a observar, no pagas nada.",
	group: "Hasta 10 personas por sesión.",
} as const;

/** Calidad del cielo del lugar: es del sitio, no de un servicio. */
export const sky = {
	bortle: { value: "Clase 2", label: "Escala Bortle", note: "de 9, donde 1 es el cielo más oscuro" },
	sqm: { value: "21.94", label: "Brillo del cielo", note: "mag/arcsec² — mientras más alto, más oscuro" },
	source: "lightpollutionmap.info",
} as const;

export type Spec = { label: string; value: string };

/** Un tramo de la salida. `flexible` lleva el aviso de por qué se puede mover. */
export type ExperienceStep = {
	name: string;
	duration: string;
	detail: string;
	flexible?: string;
};

export type Equipment = {
	name: string;
	summary?: string;
	icon: typeof Telescope01Icon;
	/** Foto del equipo real. Cuando falta, la tarjeta muestra el icono. */
	photo?: ImageMetadata;
	specs: Spec[];
};

/** Un tramo de la tarifa. Por separado y no como frase: en móvil el renglón se parte. */
export type PriceTier = { amount: string; note: string };

/**
 * Tarifa de un servicio. `headline` va donde el ancho es fijo, así que debe
 * sostenerse solo; el desglose completo vive en la ficha. Con `tiers` presente
 * el titular se muestra como "desde $X".
 */
export type Pricing = {
	headline: PriceTier;
	tiers?: PriceTier[];
	/** Qué cubre el titular y a quién, en prosa. Va bajo el desglose. */
	note?: string;
};

/** Imagen de apoyo dentro de la ficha: lo que el cliente se lleva. */
export type GalleryItem = {
	src: ImageMetadata;
	alt: string;
	caption: string;
};

export type Service = {
	title: string;
	/** Título corto para la tarjeta de la portada. */
	cardTitle: string;
	/** Una línea, para la tarjeta de la portada. */
	tagline: string;
	description: string;
	/** Imagen principal de la ficha (4:3). */
	image: ImageMetadata;
	/** Clase de `object-position` cuando el recorte por el centro no sirve. */
	imagePosition?: string;
	/** Imagen de la tarjeta en la portada (16:10). */
	cardImage: ImageMetadata;
	/** Ejemplos de lo que se ve o se lleva el cliente. */
	gallery?: GalleryItem[];
	/** Qué se rellena en la zona de media: por ahora, objetivos observables. */
	targetKind: TargetKind;
	targetsTitle: string;
	targetsNote: string;
	/** Duración total aproximada, para mostrar junto al precio. */
	duration: string;
	/** En qué consiste la salida, tramo por tramo. */
	experience: ExperienceStep[];
	/** Matiz sobre la duración: qué la estira o la encoge. */
	durationNote: string;
	/** Cómo se comporta el servicio según el tamaño del grupo. */
	groupNote: string;
	/** Restricción que el cliente necesita saber antes de escribir. */
	caveat?: string;
	equipment: Equipment[];
	/** Tarifa del servicio. Sin definir aún, la página muestra "Consúltanos". */
	price: Pricing | null;
};

export const services = {
	"observacion-visual": {
		title: "Observación Visual",
		cardTitle: "Observación Visual",
		tagline:
			"Explora el cielo nocturno con tus propios ojos, a través de nuestro telescopio de mayor apertura.",
		image: mainDobson,
		cardImage: visualGroup,
		description:
			"Experiencia estándar de observación visual. Observarás a través de nuestro telescopio más potente, el cual permitirá ver detalles de planetas, la luna, cúmulos estelares y algunas nebulosas brillantes. Al cierre puedes fotografiar por el ocular con tu propio celular y llevarte la imagen.",
		targetKind: "visual",
		targetsTitle: "Qué podrás observar",
		targetsNote:
			"La visibilidad de algunos objetivos puede variar según la fecha. Confirmar durante la reserva.",
		price: {
			headline: { amount: "$15.000", note: "por salida" },
			tiers: [
				{ amount: "+ $5.000", note: "por adulto adicional" },
				{ amount: "+ $2.500", note: "por niño adicional" },
			],
			note: "El valor por salida cubre hasta 2 personas. Niños, hasta los 12 años.",
		},
		duration: "≈ 2 horas",
		experience: [
			{
				name: "Tour del cielo",
				duration: "~1 hora",
				detail:
					"A ojo desnudo: reconocemos constelaciones, planetas y los objetos de la noche, y conversamos lo que quieras preguntar.",
				flexible: "Se puede acortar u omitir si quieren ir directo a observar.",
			},
			{
				name: "Observación por telescopio",
				duration: "~1 hora",
				detail:
					"Cada persona observa por el ocular. Vamos ajustando los aumentos objeto por objeto.",
			},
			{
				name: "Astrofotografía por el ocular",
				duration: "10 – 15 min",
				detail:
					"Acoplamos tu propio celular al ocular con el adaptador y fotografías lo que estás viendo: la Luna, los planetas o alguna nebulosa brillante. Te vas con la imagen tomada por ti, en tu teléfono.",
				flexible: "Es opcional: si prefieren seguir observando, seguimos observando.",
			},
		],
		durationNote:
			"Podemos extenderla si el grupo se entusiasma, o acortarla si tienen otros planes esa noche.",
		groupNote:
			"Hasta 10 personas. Mientras más grande el grupo, más se alarga el turno en el ocular.",
		caveat:
			"La observación visual y el EAA usan la misma montura, así que no se realizan la misma noche.",
		equipment: [
			{
				name: "Telescopio reflector",
				summary: "Nuestro telescopio de mayor apertura.",
				icon: Telescope01Icon,
				specs: [
					{ label: "Tipo", value: "Reflector" },
					{ label: "Apertura", value: "200 mm" },
					{ label: "Focal", value: "1200 mm" },
					{ label: "Relación focal", value: "f/6" },
				],
			},
			{
				name: "Oculares",
				summary: "Set completo más Barlow para cubrir todo el rango de aumentos.",
				icon: EyeIcon,
				photo: eyepieceSet,
				specs: [
					{ label: "Focales", value: "9 · 20 · 32 mm" },
					{ label: "Barlow", value: "2x" },
					{ label: "Aumentos", value: "25x – 222x" },
				],
			},
			{
				name: "Montura",
				summary:
					"Priorizamos siempre la ecuatorial GoTo. Si esa noche no se puede usar, la sesión se hace con el dobson.",
				icon: SettingsIcon,
				photo: goToMount,
				specs: [
					{ label: "Modelo", value: "Orion SkyView Pro" },
					{ label: "Tipo", value: "Ecuatorial GoTo" },
					{ label: "Respaldo", value: "Dobson" },
				],
			},
			{
				name: "Adaptador para celular",
				summary:
					"Sujeta cualquier teléfono al ocular y lo alinea con precisión, para fotografiar lo que se está observando.",
				icon: SmartPhone01Icon,
				specs: [
					{ label: "Modelo", value: "Celestron NexYZ" },
					{ label: "Ajuste", value: "3 ejes" },
					{ label: "Compatible", value: "Cualquier celular" },
				],
			},
		],
	},

	eaa: {
		title: "Astronomía Asistida Electrónicamente (EAA)",
		cardTitle: "EAA",
		tagline:
			"Galaxias y nebulosas apareciendo en vivo en una pantalla, con la nitidez que el ojo no alcanza a ver.",
		image: eaaSetup,
		// La foto es vertical y el telescopio está arriba: por el centro se corta.
		imagePosition: "object-top",
		cardImage: eaaScreen,
		gallery: [
			{
				src: eaaLive2,
				alt: "Nebulosa Cabeza de Caballo y Nebulosa de la Flama integrando en vivo",
				caption: "Cabeza de Caballo y Flama, apareciendo en pantalla durante la sesión.",
			},
			{
				src: eaaLive1,
				alt: "Galaxia integrando en vivo durante una sesión de EAA",
				caption: "Una galaxia tomando forma tras unos minutos de integración.",
			},
		],
		description:
			"Observación mediante cámara astronómica y seguimiento, que permite ver objetos tenues en tiempo real en una pantalla. Ideal para observar galaxias y nebulosas que son difíciles de ver visualmente.",
		targetKind: "eaa",
		targetsTitle: "Objetivos que alcanzaremos",
		targetsNote:
			"La cámara permite llegar a objetos que no son visibles a simple vista por el ocular. La visibilidad puede variar según la fecha.",
		price: {
			headline: { amount: "$20.000", note: "por salida" },
			tiers: [
				{ amount: "+ $4.500", note: "por adulto adicional" },
				{ amount: "+ $2.500", note: "por niño adicional" },
			],
			note: "El valor por salida cubre hasta 2 personas. Niños, hasta los 12 años.",
		},
		duration: "≈ 2 horas",
		experience: [
			{
				name: "Tour del cielo",
				duration: "~1 hora",
				detail:
					"A ojo desnudo: reconocemos constelaciones, planetas y los objetos de la noche, y conversamos lo que quieras preguntar.",
				flexible: "Se puede acortar u omitir si quieren ir directo a observar.",
			},
			{
				name: "Observación en pantalla",
				duration: "~1 hora",
				detail:
					"La cámara va integrando en vivo y el objeto aparece en la pantalla. Todo el grupo mira lo mismo al mismo tiempo, sin turnos.",
			},
		],
		durationNote:
			"Podemos extenderla si el grupo se entusiasma, o acortarla si tienen otros planes esa noche.",
		groupNote:
			"Hasta 10 personas. Es la opción más cómoda para grupos grandes y para quienes se cansan de esperar el ocular.",
		caveat:
			"Depende de la montura GoTo. Como usa el mismo equipo, no se realiza la misma noche que la observación visual.",
		equipment: [
			{
				name: "Telescopio refractor",
				summary: "TS-Optics. Campo amplio, ideal para nebulosas y galaxias.",
				icon: Telescope01Icon,
				photo: tsOptics,
				specs: [
					{ label: "Tipo", value: "Refractor" },
					{ label: "Apertura", value: "72 mm" },
					{ label: "Focal", value: "432 mm" },
					{ label: "Relación focal", value: "f/4" },
				],
			},
			{
				name: "Cámara astronómica",
				summary: "Sensor refrigerado, color.",
				icon: Camera01Icon,
				photo: asiCamera,
				specs: [{ label: "Modelo", value: "ZWO ASI183MC Pro" }],
			},
			{
				name: "Montura",
				summary: "Con seguimiento motorizado y apuntado automático.",
				icon: SettingsIcon,
				photo: goToMount,
				specs: [
					{ label: "Modelo", value: "Orion SkyView Pro" },
					{ label: "Tipo", value: "Ecuatorial GoTo" },
				],
			},
		],
	},

	"fotografia-nocturna": {
		title: "Fotografía Nocturna",
		cardTitle: "Fotografía Nocturna",
		// Con la astrofotografía por el ocular en Observación Visual, hay dos
		// formas de irse con una foto propia. El tagline tiene que dejar claro de
		// entrada que esta es la de campo amplio: sale la persona y el paisaje.
		tagline:
			"Un retrato tuyo bajo la Vía Láctea: sales tú, el paisaje y el cielo entero en la misma toma.",
		image: nightGroup2,
		// Las personas están abajo en el encuadre: recortar por el centro las deja fuera.
		imagePosition: "object-bottom",
		cardImage: nightGroup1,
		gallery: [
			{
				src: clientPhoto,
				alt: "Fotografía nocturna tomada por un huésped",
				caption: "Esta la tomó un huésped con su propia cámara, con nuestra ayuda.",
			},
		],
		description:
			"Sesión guiada de fotografía de paisaje nocturno, con cámara y gran angular sobre trípode. Te retratamos bajo el cielo estrellado, o bien te enseñamos a capturar tus propias tomas con tu celular o cámara. Es fotografía de campo amplio —el paisaje y el cielo entero—, no primeros planos por el telescopio.",
		targetKind: "wide-field",
		targetsTitle: "Qué retrataremos",
		targetsNote:
			"Objetos de campo amplio, los que caben junto al paisaje en una sola toma. También puedes traer tu propia cámara o celular: te acompañamos con la configuración.",
		price: {
			// El titular tiene que ser el monto más bajo para que "desde" no mienta,
			// y la nota tiene que ser corta: esta tarjeta es la única con una
			// duración larga ("15 – 20 minutos") compartiendo el renglón.
			headline: { amount: "$12.000", note: "por sesión" },
			tiers: [{ amount: "$18.000", note: "si va sola esa noche" }],
			note: "Son $12.000 cuando la sumas a la Observación Visual o al EAA la misma noche.",
		},
		// Abreviado: la duración comparte renglón con el precio en la tarjeta, la
		// barra fija y el bloque de cierre, y "minutos" entero era lo único que
		// obligaba a partir la línea.
		duration: "15 – 20 min",
		experience: [
			{
				name: "Sesión de fotos",
				duration: "15 – 20 min",
				detail:
					"Te retratamos bajo el cielo estrellado. Con grupos grandes toma un poco más.",
			},
			{
				name: "Entrega de las imágenes",
				duration: "después de la sesión",
				detail: "Procesamos las fotos que tomamos con nuestra cámara y te las entregamos.",
			},
		],
		durationNote:
			"Es corta a propósito: cabe dentro de otra salida o funciona como panorama por su cuenta.",
		groupNote:
			"Se suma a la Observación Visual o al EAA en la misma noche, o se hace por su cuenta como panorama corto.",
		equipment: [
			{
				name: "Cámara mirrorless",
				summary: "Full frame, para trabajar con poca luz.",
				icon: Camera01Icon,
				photo: sonyA7,
				specs: [{ label: "Modelo", value: "Sony A7 II" }],
			},
			{
				name: "Lente",
				summary: "Rango versátil para paisaje nocturno.",
				icon: CameraLensIcon,
				specs: [
					{ label: "Focal", value: "28 – 70 mm" },
					{ label: "Apertura", value: "f/3.5 – 5.6" },
				],
			},
			{
				name: "Trípode",
				summary: "Imprescindible para las exposiciones largas.",
				icon: CameraTripodIcon,
				specs: [{ label: "Incluido", value: "Sí" }],
			},
		],
	},
} satisfies Record<string, Service>;

export type ServiceId = keyof typeof services;

export const serviceIds = Object.keys(services) as ServiceId[];

/** Titular de la tarifa más el aviso de que hay tramos detrás. */
export type PriceSummary = PriceTier & { from: boolean };

/**
 * Lo que se muestra donde no cabe la tarifa entera: tarjetas de portada, barra
 * fija y bloque de cierre. El desglose se ve en la ficha.
 */
export function priceSummary(service: Service): PriceSummary | null {
	if (!service.price) return null;
	const { headline, tiers } = service.price;
	return { ...headline, from: (tiers?.length ?? 0) > 0 };
}
