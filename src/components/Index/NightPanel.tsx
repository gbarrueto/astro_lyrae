import { useEffect, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, CloudIcon, WhatsappIcon } from "@hugeicons/core-free-icons";

import {
	QUALITY_TONE,
	darkness,
	formatDuration,
	phasePath,
	serviceImpact,
	temperatureTone,
	windArrow,
	type NightData,
	type NightSegment,
	type Phrase as Parts,
} from "@/lib/sky";
import { cn } from "@/lib/utils";
import { Phrase } from "@/components/Phrase";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const VERDICT: Record<
	string,
	{ label: string; short: string; tone: string; tint: string; viable: boolean }
> = {
	bueno: {
		label: "Buena noche para observar",
		short: "Buena",
		tone: "text-good",
		tint: "bg-good/8",
		viable: true,
	},
	regular: {
		label: "Noche irregular",
		short: "Irregular",
		tone: "text-warn",
		tint: "bg-warn/8",
		viable: true,
	},
	malo: {
		label: "Mala noche para observar",
		short: "Mala",
		tone: "text-bad",
		tint: "bg-bad/8",
		viable: false,
	},
	imposible: {
		label: "No se puede observar",
		short: "Imposible",
		tone: "text-off",
		tint: "bg-off/8",
		viable: false,
	},
};

const DOT: Record<string, string> = {
	bueno: "bg-good",
	regular: "bg-warn",
	malo: "bg-bad",
	imposible: "bg-off",
};

const at = (iso: string) => new Date(iso).getTime();

const moonTone = (interference: string) =>
	QUALITY_TONE[interference === "alta" ? "malo" : interference === "media" ? "regular" : "bueno"];

function nightName(night: NightData, timeZone: string) {
	if (night.offset === 0) return "Hoy";
	if (night.offset === 1) return "Mañana";
	const [y, m, d] = night.date.split("-").map(Number);
	const label = new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", weekday: "long" }).format(
		new Date(Date.UTC(y, m - 1, d)),
	);
	return label.charAt(0).toUpperCase() + label.slice(1);
}

/* ------------------------------------------------------------------ *
 * Línea de tiempo
 * ------------------------------------------------------------------ */

type Milestone = {
	at: string;
	time: string;
	title: string;
	note: string;
	dot: string;
	key?: boolean;
};

function milestones(night: NightData): Milestone[] {
	const list: (Milestone | null)[] = [
		{
			at: night.bookingDeadlineAt,
			time: night.bookingDeadline,
			title: "Límite para avisar",
			note: "Después hay que consultar.",
			dot: "bg-primary",
			key: true,
		},
		{
			at: night.sunsetAt,
			time: night.sunset,
			title: "Atardece",
			note: "Todavía con luz.",
			dot: "bg-warn",
		},
		{
			at: night.darkFromAt,
			time: night.darkFrom,
			title: "Empieza la oscuridad",
			note: "Cielo útil desde acá.",
			dot: "bg-good",
		},
		night.moon.riseAt
			? {
					at: night.moon.riseAt,
					time: night.moon.rise!,
					title: "Sale la luna",
					note: "Sube el brillo del fondo.",
					dot: "bg-off",
				}
			: null,
		night.moon.setAt
			? {
					at: night.moon.setAt,
					time: night.moon.set!,
					title: "Se pone la luna",
					note:
						at(night.moon.setAt) < at(night.darkFromAt)
							? "Se va antes de oscurecer."
							: "Oscuridad total desde acá.",
					dot: "bg-off",
				}
			: null,
		{
			at: night.darkUntilAt,
			time: night.darkUntil,
			title: "Termina la oscuridad",
			note: "Se cierra la ventana.",
			dot: "bg-good",
		},
	];

	return list.filter((m): m is Milestone => m !== null).sort((a, b) => at(a.at) - at(b.at));
}

/** El color del riel según la fase del cielo en ese instante. */
function railTone(night: NightData, when: number) {
	if (when < at(night.sunsetAt)) return "bg-day";
	if (when < at(night.darkFromAt)) return "bg-dusk";
	if (when >= at(night.darkUntilAt)) return "bg-dusk";
	const lit = night.moon.moonlit.some((s) => when >= at(s.fromAt) && when < at(s.toAt));
	return lit ? "bg-moonlit" : "bg-night-dark";
}

function WeatherPill({ segment, open }: { segment: NightSegment; open: boolean }) {
	return (
		<span
			className={cn(
				"inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5 transition",
				open ? "bg-card ring-1 ring-white/20" : "bg-white/5 ring-1 ring-white/8 hover:bg-white/10 hover:ring-white/15",
			)}
		>
			<span
				className={cn(
					"grid size-7 place-items-center rounded-full",
					segment.clouds?.quality === "malo" ? "bg-bad/15" : "bg-white/8",
					QUALITY_TONE[segment.clouds?.quality ?? "regular"],
				)}
			>
				<HugeiconsIcon icon={CloudIcon} size={15} />
			</span>
			<span className={cn("text-xs font-bold tabular-nums", temperatureTone(segment.temperature))}>
				{segment.temperature}°
			</span>
			<span className="h-3 w-px bg-white/15" />
			<span className="text-[10px] font-semibold text-muted-foreground">{segment.label}</span>
		</span>
	);
}

function WeatherDetail({ segment }: { segment: NightSegment }) {
	const arrow = segment.wind ? windArrow(segment.wind.direction) : null;
	const dim = "text-muted-foreground line-through opacity-50";

	const rows: [string, React.ReactNode][] = [
		[
			"Seeing",
			<span className={segment.obscured ? dim : QUALITY_TONE[segment.seeing?.quality ?? ""]}>
				{segment.seeing?.range}
			</span>,
		],
		[
			"Transparencia",
			<span className={segment.obscured ? dim : QUALITY_TONE[segment.transparency?.quality ?? ""]}>
				{segment.transparency?.label}
			</span>,
		],
		[
			"Temperatura",
			<span className={temperatureTone(segment.temperature)}>{segment.temperature} °C</span>,
		],
		[
			"Viento",
			<span className={QUALITY_TONE[segment.wind?.quality ?? ""]}>
				{segment.wind?.label} {arrow && segment.wind?.direction}
			</span>,
		],
		["Humedad", <span>{segment.humidity}</span>],
		[
			"Nubes",
			<span className={QUALITY_TONE[segment.clouds?.quality ?? ""]}>{segment.clouds?.range}</span>,
		],
	];

	return (
		<>
			<div className="flex items-baseline justify-between gap-3">
				<span className="text-xs font-bold">
					{segment.label} · <span className="tabular-nums">{segment.time}</span>
				</span>
				<span className={cn("text-xs font-semibold", QUALITY_TONE[segment.clouds?.quality ?? ""])}>
					{segment.clouds?.label}
				</span>
			</div>

			{segment.precipitation && (
				<p className="text-xs text-muted-foreground">
					{segment.precipitation === "snow" ? "Con nieve." : "Con lluvia."}
				</p>
			)}

			<dl className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-white/10 pt-2 text-[10px]">
				{rows.map(([term, value]) => (
					<div key={term} className="flex items-start justify-between gap-2 leading-snug">
						<dt className="whitespace-nowrap text-muted-foreground">{term}</dt>
						<dd className="min-w-0 text-right font-semibold tabular-nums">{value}</dd>
					</div>
				))}
			</dl>
		</>
	);
}

function Timeline({ night, now, timeZone }: { night: NightData; now: Date | null; timeZone: string }) {
	const [open, setOpen] = useState(-1);
	const marks = milestones(night);

	type Row = { at: string; time: string; body: React.ReactNode; dot: string; size: string; tone: string };

	const rows: Row[] = marks.map((m) => ({
		at: m.at,
		time: m.time,
		dot: m.dot,
		size: m.key ? "size-2.5" : "size-2",
		tone: m.key ? "text-primary" : "text-foreground",
		body: (
			<p className="text-xs leading-snug">
				<span className={cn("font-semibold", m.key && "text-primary")}>{m.title}</span>
				<span className="text-muted-foreground"> — {m.note}</span>
			</p>
		),
	}));

	night.segments.forEach((segment, index) => {
		rows.push({
			at: segment.at,
			time: segment.time,
			dot: "bg-white/40",
			size: "size-1.5",
			tone: "text-muted-foreground",
			body: (
				<Popover open={open === index} onOpenChange={(o) => setOpen(o ? index : -1)}>
					<PopoverTrigger
						render={<button type="button" aria-label={`Clima a las ${segment.time}`} />}
					>
						<WeatherPill segment={segment} open={open === index} />
					</PopoverTrigger>
					<PopoverContent align="start" className="flex w-64 flex-col gap-2 bg-muted">
						<WeatherDetail segment={segment} />
					</PopoverContent>
				</Popover>
			),
		});
	});

	// La luna cuelga del hito que la nombra: causa y efecto en el mismo lugar.
	const moonRow = rows.findIndex((r) => r.at === (night.moon.riseAt ?? night.moon.setAt));
	if (moonRow >= 0) {
		rows[moonRow] = {
			...rows[moonRow],
			body: (
				<>
					{rows[moonRow].body}
					<div className="mt-1.5 flex items-center gap-2 rounded-xl bg-white/4 p-2">
						<svg width="26" height="26" viewBox="-50 -50 100 100" className="shrink-0" aria-hidden="true">
							<circle r="42" fill="var(--muted)" />
							<path d={phasePath(night.moon.phase)} fill="oklch(0.93 0.03 90)" />
							<circle r="42" fill="none" stroke="rgba(255,255,255,0.14)" />
						</svg>
						<p className="text-[10px] leading-snug text-muted-foreground">
							<span className={cn("font-semibold", moonTone(night.moon.interference))}>
								{night.moon.label}
							</span>{" "}
							· Luna al {night.moon.illumination}%
							{night.moon.interference === "baja"
								? " · no estorba"
								: " · limita cielo profundo, no la Luna ni los planetas"}
						</p>
					</div>
				</>
			),
		};
	}

	rows.sort((a, b) => at(a.at) - at(b.at));

	// El alto sugiere duración real sin romperse cuando dos hitos casi coinciden.
	const gapFor = (index: number) => {
		if (index === 0) return 0;
		const minutes = (at(rows[index].at) - at(rows[index - 1].at)) / 60000;
		return Math.min(46, Math.max(10, minutes * 0.2));
	};

	const nowTime = now?.getTime() ?? null;
	const showNow =
		nowTime !== null && nowTime > at(rows[0].at) && nowTime < at(rows[rows.length - 1].at);

	const timeFmt = new Intl.DateTimeFormat("es-CL", {
		timeZone,
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});

	return (
		<ol className="flex flex-col">
			{rows.map((row, index) => {
				const gap = gapFor(index);
				const prev = index === 0 ? row.at : rows[index - 1].at;
				const midBefore = (at(prev) + at(row.at)) / 2;
				const midAfter =
					index === rows.length - 1
						? at(row.at)
						: (at(row.at) + at(rows[index + 1].at)) / 2;

				const nowHere =
					showNow && nowTime! >= at(prev) && nowTime! < at(row.at) && index > 0;

				return (
					<li key={`${row.at}-${index}`} className="grid grid-cols-[38px_12px_1fr] gap-x-2.5">
						<div className="text-right">
							<div style={{ height: gap }} />
							<span className={cn("text-xs font-semibold tabular-nums", row.tone)}>{row.time}</span>
						</div>

						<div className="relative flex flex-col items-center">
							<div className={cn("w-[3px] rounded-sm", railTone(night, midBefore))} style={{ height: gap }} />
							<span className={cn("rounded-full shadow-[0_0_0_2.5px_var(--card)]", row.size, row.dot)} />
							<div className={cn("w-[3px] flex-1 rounded-sm", railTone(night, midAfter))} />
						</div>

						<div className="pb-1">
							<div style={{ height: gap }} />
							{nowHere && now && (
								<div className="mb-1.5 flex items-center gap-2">
									<span className="rounded bg-primary px-1.5 py-px text-[9px] font-bold tracking-[0.14em] text-primary-foreground">
										AHORA
									</span>
									<span className="h-px flex-1 bg-primary/40" />
									<span className="text-[10px] font-semibold text-primary tabular-nums">
										{timeFmt.format(now)}
									</span>
								</div>
							)}
							{row.body}
						</div>
					</li>
				);
			})}
		</ol>
	);
}

/* ------------------------------------------------------------------ *
 * Panel
 * ------------------------------------------------------------------ */

export function NightPanel({
	nights,
	timeZone,
	whatsappNumber,
}: {
	nights: NightData[];
	timeZone: string;
	whatsappNumber: string;
}) {
	const [selected, setSelected] = useState(0);
	const [now, setNow] = useState<Date | null>(null);
	const [openBy, setOpenBy] = useState<Record<string, boolean>>({});

	useEffect(() => {
		const tick = () => setNow(new Date());
		tick();
		const timer = setInterval(tick, 60_000);
		return () => clearInterval(timer);
	}, []);

	const night = nights[selected];
	const verdict = VERDICT[night.verdict] ?? VERDICT.malo;
	const isToday = night.offset === 0;
	const passed = now ? now.getTime() > at(night.bookingDeadlineAt) : false;
	const actionable = verdict.viable && (!isToday || !passed);

	const { total, moonless } = useMemo(() => darkness(night), [night]);
	const impacts = useMemo(() => serviceImpact(night), [night]);

	const expanded = openBy[night.date] ?? verdict.viable;

	const deadlineNote = !isToday
		? "hasta esa hora preparamos el equipo"
		: passed
			? "ya pasó; consúltanos igual"
			: !verdict.viable
				? "pero el cielo no acompaña"
				: now
					? `quedan ${formatDuration(at(night.bookingDeadlineAt) - now.getTime())}`
					: "";

	const whenLabel = nightName(night, timeZone).toLowerCase();
	const href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
		`Hola, me gustaría salir a observar ${night.offset === 0 ? "esta noche" : `${whenLabel} en la noche`}. ¿Tienen cupo?`,
	)}`;

	return (
		<div>
			{nights.length > 1 && (
				<div className="mb-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${nights.length}, 1fr)` }}>
					{nights.map((candidate, index) => {
						const active = index === selected;
						const tone = VERDICT[candidate.verdict] ?? VERDICT.malo;
						return (
							<button
								key={candidate.date}
								type="button"
								aria-pressed={active}
								onClick={() => setSelected(index)}
								className={cn(
									"flex min-h-11 cursor-pointer flex-col items-start justify-center gap-0.5 rounded-xl px-3 py-2 text-left transition hover:brightness-125",
									active ? cn(tone.tint, "ring-1 ring-white/20") : "bg-white/4 ring-1 ring-white/8",
								)}
							>
								<span className="flex items-center gap-1.5">
									<span className={cn("size-1.5 rounded-full", DOT[candidate.verdict])} />
									<span className={cn("text-xs font-bold", active ? "text-foreground" : "text-foreground/60")}>
										{nightName(candidate, timeZone)}
									</span>
								</span>
								<span className={cn("text-[10px] font-semibold", active ? tone.tone : "text-muted-foreground")}>
									{tone.short}
								</span>
							</button>
						);
					})}
				</div>
			)}

			<div className="overflow-hidden rounded-2xl bg-card ring-1 ring-white/10">
				{/* Veredicto */}
				<div className={cn("border-b border-white/7 p-4", verdict.tint)}>
					<p className="text-[10px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
						Veredicto
					</p>
					<h3 className={cn("mt-1.5 font-heading text-2xl leading-tight font-semibold", verdict.tone)}>
						{verdict.label}
					</h3>
					<p className="mt-1.5 text-sm leading-snug">
						<Phrase parts={night.headline as Parts} />
					</p>

					<div className="mt-3 flex flex-wrap gap-1.5">
						{[
							["Oscuridad", formatDuration(total), "text-good"],
							["Sin luna", formatDuration(moonless), moonless > 0 ? "text-good" : "text-off"],
							["Luna", `${night.moon.illumination}%`, night.moon.interference === "baja" ? "text-good" : "text-warn"],
						].map(([label, value, tone]) => (
							<span
								key={label}
								className="inline-flex flex-none items-baseline gap-1.5 rounded-full bg-white/6 px-2.5 py-1.5"
							>
								<span className="text-[10px] font-semibold whitespace-nowrap text-muted-foreground uppercase">
									{label}
								</span>
								<span className={cn("text-xs font-bold whitespace-nowrap tabular-nums", tone)}>
									{value}
								</span>
							</span>
						))}
					</div>

					{verdict.viable && (
						<p
							className={cn(
								"mt-3 rounded-xl px-3 py-2.5 text-xs leading-snug",
								actionable ? "bg-primary/10 ring-1 ring-primary/30" : "bg-white/5 ring-1 ring-white/8",
							)}
						>
							Cierre para avisar{" "}
							<span className="font-bold tabular-nums">{night.bookingDeadline}</span>
							{deadlineNote && <span className="text-muted-foreground"> · {deadlineNote}</span>}
						</p>
					)}

					{actionable ? (
						<a
							href={href}
							target="_blank"
							rel="noopener noreferrer"
							className="mt-2 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
						>
							<HugeiconsIcon icon={WhatsappIcon} size={18} />
							Reservar por WhatsApp
						</a>
					) : (
						<p className="mt-2 text-xs leading-snug text-muted-foreground">
							{verdict.viable
								? "Igual podemos coordinar. "
								: "No se puede salir esta noche; podemos buscar otra de tu estadía. "}
							<a
								href={href}
								target="_blank"
								rel="noopener noreferrer"
								className="font-semibold text-primary underline underline-offset-[3px]"
							>
								Escríbenos
							</a>
						</p>
					)}
				</div>

				{/* Qué se puede hacer */}
				<div className="border-b border-white/7 p-4">
					<p className="text-[10px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
						Qué se puede hacer
					</p>
					<ul className="mt-2 -mx-2 flex flex-col gap-0.5">
						{impacts.map((impact) => (
							<li key={impact.service}>
								<a
									href={impact.href}
									className="flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 py-2 transition hover:bg-white/6"
								>
									<span className={cn("size-1.5 shrink-0 rounded-full", DOT[impact.quality])} />
									<span className="text-xs font-semibold">{impact.service}</span>
									<span className="ml-auto truncate text-[10px] text-muted-foreground">
										{impact.limit}
									</span>
									<span
										className={cn(
											"shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap",
											impact.quality === "bueno" && "bg-good/15 text-good",
											impact.quality === "regular" && "bg-warn/15 text-warn",
											impact.quality === "imposible" && "bg-off/15 text-off",
										)}
									>
										{impact.status}
									</span>
								</a>
							</li>
						))}
					</ul>
				</div>

				{/* La noche, en orden */}
				<div className="p-4">
					<div className="flex items-baseline justify-between gap-3">
						<p className="text-[10px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
							La noche, en orden
						</p>
						{isToday && now && (
							<span className="flex items-center gap-1.5 text-[10px] font-semibold text-primary tabular-nums">
								<span className="size-1.5 animate-blink rounded-full bg-primary" />
								ahora{" "}
								{new Intl.DateTimeFormat("es-CL", {
									timeZone,
									hour: "2-digit",
									minute: "2-digit",
									hour12: false,
								}).format(now)}
							</span>
						)}
					</div>

					{expanded ? (
						<div className="mt-3">
							<Timeline night={night} now={now} timeZone={timeZone} />
						</div>
					) : (
						<p className="mt-2 text-xs leading-snug text-muted-foreground tabular-nums">
							Oscuridad {night.darkFrom} → {night.darkUntil}
							{moonless > 0 && ` · sin luna ${formatDuration(moonless)}`} ·{" "}
							{night.segments[0]?.clouds?.label}
						</p>
					)}

					<button
						type="button"
						onClick={() => setOpenBy((state) => ({ ...state, [night.date]: !expanded }))}
						aria-expanded={expanded}
						className="mt-2 flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white/5 text-xs font-semibold text-primary transition hover:bg-white/10"
					>
						{expanded ? "Ocultar la noche" : "Ver la noche completa"}
						<span className={cn("transition-transform", expanded && "rotate-180")}>
							<HugeiconsIcon icon={ArrowDown01Icon} size={14} />
						</span>
					</button>
				</div>
			</div>
		</div>
	);
}
