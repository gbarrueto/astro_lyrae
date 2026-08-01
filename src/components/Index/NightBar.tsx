import { useEffect, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";

export type MoonSpan = { from: string; to: string; fromAt: string; toAt: string };

export type NightTimes = {
	date: string;
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
	moon: { rise: string | null; riseAt: string | null; set: string | null; setAt: string | null; moonlit: MoonSpan[] };
};

type Moment = {
	at: string;
	label: string;
	title: string;
	kind: "key" | "sun" | "dark" | "moon";
	text: string;
	action?: string;
};

const ms = (iso: string) => new Date(iso).getTime();
const RADIUS = { key: 15, other: 11 };

export function NightBar({
	night,
	timeZone,
	impossible,
	whatsappHref,
}: {
	night: NightTimes;
	timeZone: string;
	impossible: boolean;
	whatsappHref: string;
}) {
	const barRef = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(358);
	const [now, setNow] = useState<Date | null>(null);
	const [selected, setSelected] = useState(0);
	const [hover, setHover] = useState<string | null>(null);

	useEffect(() => {
		const tick = () => setNow(new Date());
		tick();
		const timer = setInterval(tick, 60_000);
		return () => clearInterval(timer);
	}, []);

	useEffect(() => {
		const el = barRef.current;
		if (!el) return;
		const measure = () => setWidth(el.clientWidth || 358);
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	// La barra abarca desde una hora antes del plazo hasta el amanecer.
	const from = ms(night.bookingDeadlineAt) - 60 * 60e3;
	const to = ms(night.sunriseAt) + 30 * 60e3;
	const span = to - from;
	const pct = (iso: string) => ((ms(iso) - from) / span) * 100;

	const deadlinePassed = now ? now.getTime() > ms(night.bookingDeadlineAt) : false;

	// Antes del mediodía la noche vigente es la que empezó ayer.
	const stale = useMemo(() => {
		if (!now) return false;
		const dateFmt = new Intl.DateTimeFormat("en-CA", {
			timeZone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		});
		const hour = Number(
			new Intl.DateTimeFormat("es-CL", { timeZone, hour: "2-digit", hour12: false }).format(now),
		);
		const reference = hour < 12 ? new Date(now.getTime() - 12 * 3600e3) : now;
		return dateFmt.format(reference) !== night.date;
	}, [now, night.date, timeZone]);

	const moments = useMemo<Moment[]>(() => {
		const list: (Moment | null)[] = [
			{
				at: night.bookingDeadlineAt,
				label: night.bookingDeadline,
				title: "Límite para avisar",
				kind: "key",
				text: stale
					? "Este pronóstico es de otra noche."
					: impossible
						? "Con este cielo no hay salida esta noche, pero podemos buscar otra de tu estadía."
						: deadlinePassed
							? "La hora recomendada ya pasó; a veces igual alcanzamos a armar el equipo."
							: "Hasta esta hora podemos preparar el equipo con calma. Después hay que preguntar.",
				action: stale
					? "Pregúntanos por la de hoy"
					: impossible || deadlinePassed
						? "Escríbenos igual"
						: undefined,
			},
			{
				at: night.sunsetAt,
				label: night.sunset,
				title: "Atardece",
				kind: "sun",
				text: "El sol se pone, pero todavía hay demasiada luz para observar.",
			},
			{
				at: night.darkFromAt,
				label: night.darkFrom,
				title: "Empieza la oscuridad",
				kind: "dark",
				text: "Fin del crepúsculo astronómico: desde acá el cielo sirve de verdad.",
			},
			night.moon.riseAt
				? {
						at: night.moon.riseAt,
						label: night.moon.rise!,
						title: "Sale la luna",
						kind: "moon" as const,
						text: "Desde acá aclara el fondo del cielo y tapa los objetos más tenues.",
					}
				: null,
			night.moon.setAt
				? {
						at: night.moon.setAt,
						label: night.moon.set!,
						title: "Se pone la luna",
						kind: "moon" as const,
						text: "Desde acá el cielo queda en oscuridad total: la mejor ventana de la noche.",
					}
				: null,
			{
				at: night.darkUntilAt,
				label: night.darkUntil,
				title: "Termina la oscuridad",
				kind: "dark",
				text: "Empieza a clarear: se acaba la ventana de observación.",
			},
		];

		return list
			.filter((m): m is Moment => m !== null && pct(m.at) >= 0 && pct(m.at) <= 100)
			.sort((a, b) => ms(a.at) - ms(b.at));
	}, [night, impossible, deadlinePassed, stale]);

	// Un punto baja de carril solo si se solapa con el anterior; si nadie choca,
	// todos quedan en la línea del centro.
	const lanes = useMemo(() => {
		const last: ({ px: number; r: number } | null)[] = [null, null];
		return moments.map((m) => {
			const r = m.kind === "key" ? RADIUS.key : RADIUS.other;
			const px = (pct(m.at) / 100) * width;
			const hits = (prev: { px: number; r: number } | null) =>
				prev !== null && px - prev.px < r + prev.r + 3;
			const lane = hits(last[0]) ? (hits(last[1]) ? 0 : 1) : 0;
			last[lane] = { px, r };
			return lane;
		});
	}, [moments, width]);

	const singleLane = lanes.every((lane) => lane === 0);

	useEffect(() => {
		const key = moments.findIndex((m) => m.kind === "key");
		setSelected(key < 0 ? 0 : key);
	}, [moments.length]);

	const gradient = useMemo(() => {
		const stop = (iso: string) => `${pct(iso).toFixed(2)}%`;
		const stops = [
			"var(--day) 0%",
			`var(--day) ${stop(night.sunsetAt)}`,
			`var(--dusk) ${(pct(night.sunsetAt) + 2).toFixed(2)}%`,
			`var(--night-dark) ${stop(night.darkFromAt)}`,
		];

		for (const span of night.moon.moonlit) {
			stops.push(
				`var(--night-dark) ${stop(span.fromAt)}`,
				`var(--moonlit) ${(pct(span.fromAt) + 2).toFixed(2)}%`,
				`var(--moonlit) ${stop(span.toAt)}`,
				`var(--night-dark) ${(pct(span.toAt) + 2).toFixed(2)}%`,
			);
		}

		stops.push(
			`var(--night-dark) ${stop(night.darkUntilAt)}`,
			`var(--dusk) ${stop(night.sunriseAt)}`,
			"var(--day) 100%",
		);
		return `linear-gradient(90deg, ${stops.join(", ")})`;
	}, [night]);

	const timeFmt = useMemo(
		() => new Intl.DateTimeFormat("es-CL", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }),
		[timeZone],
	);

	const readAt = (clientX: number) => {
		const el = barRef.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const at = from + ((clientX - rect.left) / rect.width) * span;
		const inMoonlight = night.moon.moonlit.some((s) => at >= ms(s.fromAt) && at < ms(s.toAt));

		const state =
			at >= ms(night.darkFromAt) && at < ms(night.darkUntilAt)
				? inMoonlight
					? "oscuro, con luna"
					: "oscuridad total"
				: at >= ms(night.sunsetAt) && at < ms(night.darkFromAt)
					? "crepúsculo"
					: at >= ms(night.darkUntilAt) && at < ms(night.sunriseAt)
						? "amaneciendo"
						: "de día";

		setHover(`${timeFmt.format(new Date(at))} · ${state}`);
	};

	const current = moments[selected];
	const move = (delta: number) =>
		setSelected((i) => (i + delta + moments.length) % moments.length);

	const TONE = {
		key: "text-primary",
		sun: "text-warn",
		dark: "text-good",
		moon: "text-off",
	} as const;

	return (
		<div>
			<div
				ref={barRef}
				className="relative h-14"
				onMouseMove={(e) => readAt(e.clientX)}
				onMouseLeave={() => setHover(null)}
			>
				<div
					className="absolute inset-0 overflow-hidden rounded-xl ring-1 ring-white/10"
					style={{ background: gradient }}
				/>

				{[16, 20, 0, 4].map((hour) => {
					const base = new Date(night.darkFromAt);
					const mark = new Date(base);
					mark.setHours(hour < 12 ? hour + 24 : hour, 0, 0, 0);
					const p = pct(mark.toISOString());
					if (p < 2 || p > 98) return null;
					return (
						<div
							key={hour}
							className="absolute inset-y-0 w-px bg-white/15"
							style={{ left: `${p}%` }}
						/>
					);
				})}

				{now && pct(now.toISOString()) >= 0 && pct(now.toISOString()) <= 100 && (
					<div
						className="absolute -inset-y-1 z-10 w-0.5 bg-foreground shadow-[0_0_8px_rgba(255,255,255,0.6)]"
						style={{ left: `${pct(now.toISOString())}%` }}
					>
						<span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[0.6rem] tracking-[0.08em] uppercase">
							ahora
						</span>
					</div>
				)}

				{moments.map((m, i) => (
					<button
						key={m.at}
						type="button"
						onClick={() => setSelected(i)}
						aria-label={`${m.title}, ${m.label}`}
						className={cn(
							"absolute z-20 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full transition-[top]",
							TONE[m.kind],
						)}
						style={{
							left: `${pct(m.at)}%`,
							top: singleLane ? "50%" : lanes[i] === 0 ? "36%" : "68%",
						}}
					>
						<span
							className={cn(
								"block rounded-full bg-current transition-transform",
								m.kind === "key"
									? "size-4 shadow-[0_0_0_2.5px_var(--background),0_0_0_4.5px_color-mix(in_oklch,var(--primary)_45%,transparent),0_0_12px_color-mix(in_oklch,var(--primary)_55%,transparent)]"
									: "size-3 shadow-[0_0_0_2.5px_var(--background),0_0_0_3.5px_rgba(255,255,255,0.22)]",
								selected === i && "scale-150",
							)}
						/>
					</button>
				))}
			</div>

			<div className="relative mt-1 h-4 text-[0.66rem] text-muted-foreground">
				{[16, 20, 0, 4].map((hour) => {
					const base = new Date(night.darkFromAt);
					const mark = new Date(base);
					mark.setHours(hour < 12 ? hour + 24 : hour, 0, 0, 0);
					const p = pct(mark.toISOString());
					if (p < 2 || p > 98) return null;
					return (
						<span
							key={hour}
							className="absolute -translate-x-1/2 tabular-nums"
							style={{ left: `${p}%` }}
						>
							{String(hour).padStart(2, "0")}:00
						</span>
					);
				})}
			</div>

			<div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.68rem] text-muted-foreground">
				{[
					["var(--day)", "día"],
					["var(--dusk)", "crepúsculo"],
					["var(--moonlit)", "con luna"],
					["var(--night-dark)", "oscuridad total"],
				].map(([color, label]) => (
					<span key={label} className="inline-flex items-center gap-1.5">
						<span className="inline-block h-2 w-3 rounded-sm" style={{ background: color }} />
						{label}
					</span>
				))}
			</div>

			{hover && <p className="mt-1 hidden text-[0.72rem] text-muted-foreground sm:block">{hover}</p>}

			{current && (
				<div className="mt-3 grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-1 rounded-2xl bg-card p-2 ring-1 ring-white/10">
					<button
						type="button"
						onClick={() => move(-1)}
						aria-label="Momento anterior"
						className="grid size-11 place-items-center rounded-xl text-muted-foreground transition hover:bg-white/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
					>
						<HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
					</button>

					<div className="min-w-0 text-center" role="status">
						<p className="flex flex-wrap items-baseline justify-center gap-x-2">
							<span className="text-sm font-medium">{current.title}</span>
							<span className={cn("text-sm font-semibold tabular-nums", TONE[current.kind])}>
								{current.label}
							</span>
						</p>
						<p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
							{current.text}
							{current.action && (
								<>
									{" "}
									<a
										href={whatsappHref}
										target="_blank"
										rel="noopener noreferrer"
										className="font-medium text-primary underline underline-offset-4"
									>
										{current.action}
									</a>
								</>
							)}
						</p>
						<p className="mt-1 text-[0.62rem] tracking-[0.1em] text-muted-foreground/70 uppercase tabular-nums">
							{selected + 1} de {moments.length}
						</p>
					</div>

					<button
						type="button"
						onClick={() => move(1)}
						aria-label="Momento siguiente"
						className="grid size-11 place-items-center rounded-xl text-muted-foreground transition hover:bg-white/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
					>
						<HugeiconsIcon icon={ArrowRight01Icon} size={18} />
					</button>
				</div>
			)}
		</div>
	);
}
