import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";

import {
	QUALITY_TONE,
	eventsFor,
	pointFor,
	seeingMeaning,
	skyPicture,
	temperatureTone,
	type SeriesPoint,
	type SkyEvent,
} from "@/lib/sky";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverDescription,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";

// Las 16 capas del icono, inline. Son diminutas y así el cambio de icono no
// dispara descargas: ver docs/iconos-cielo.md.
const SKY_LAYERS = import.meta.glob("../../assets/sky/*.svg", {
	query: "?raw",
	import: "default",
	eager: true,
}) as Record<string, string>;

const layerMarkup = new Map(
	Object.entries(SKY_LAYERS).map(([path, svg]) => [
		path.split("/").pop()!.replace(".svg", ""),
		svg,
	]),
);

type Props = {
	series: SeriesPoint[];
	sky: SkyEvent[];
	timeZone: string;
	/** La marca. Viaja como children para que el layout de la barra viva acá. */
	children?: React.ReactNode;
};

export function SkyStatus({ series, sky, timeZone, children }: Props) {
	// El primer render en el servidor no puede saber la hora del visitante, así
	// que parte en null y se llena al hidratar.
	const [now, setNow] = useState<Date | null>(null);

	useEffect(() => {
		const tick = () => setNow(new Date());
		tick();

		const timer = setInterval(tick, 30_000);
		const onVisible = () => !document.hidden && tick();
		document.addEventListener("visibilitychange", onVisible);

		return () => {
			clearInterval(timer);
			document.removeEventListener("visibilitychange", onVisible);
		};
	}, []);

	const clockFmt = new Intl.DateTimeFormat("es-CL", {
		timeZone,
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});

	const at = now ?? new Date();
	const point = pointFor(series, at);
	const picture = skyPicture(at, eventsFor(sky, at), point);
	const [hours, minutes] = clockFmt.format(at).split(":");

	// Si el punto más cercano quedó lejos, el pronóstico está viejo —cron caído,
	// por ejemplo— y es preferible no mostrar cifras a mostrarlas falsas.
	const stale = !point || Math.abs(new Date(point.at).getTime() - at.getTime()) > 6 * 3600e3;
	const seeing = stale ? null : point.seeing;
	const obscured = Boolean(point?.obscured);

	return (
		// Tres columnas para que el bloque del medio quede centrado respecto a la
		// barra completa, y no se corra según cuánto ocupen la marca o el botón.
		<nav className="mx-auto grid h-14 w-full max-w-5xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-5">
			<div className="justify-self-start">{children}</div>

			{/* Centro: la hora manda, el clima la acompaña. */}
			<div className="flex items-center gap-2.5 justify-self-center">
				<span
					className="relative inline-block size-6 shrink-0 text-primary"
					title={picture.label}
					role="img"
					aria-label={picture.label}
				>
					{picture.layers.map((layer) => (
						<span
							key={layer}
							className="absolute inset-0 [&>svg]:size-full"
							dangerouslySetInnerHTML={{ __html: layerMarkup.get(layer) ?? "" }}
						/>
					))}
				</span>

				<span
					className="font-heading text-base leading-none font-semibold tabular-nums"
					aria-label="Hora local"
				>
					{now ? (
						<>
							{hours}
							<span className="animate-blink mx-px inline-block">:</span>
							{minutes}
						</>
					) : (
						"--:--"
					)}
				</span>

				{!stale && (
					<span className={cn("text-sm font-medium tabular-nums", temperatureTone(point.temperature))}>
						{point.temperature}°
					</span>
				)}
			</div>

			{/* Derecha: el seeing, que es la palabra que despierta curiosidad. */}
			<div className="justify-self-end">
				{seeing && (
					<Popover>
					<PopoverTrigger
						render={
							<Button
								variant="outline"
								size="sm"
								// El radio casi recto lo distingue del resto de la interfaz,
								// que es toda de esquinas redondeadas.
								className="h-7 gap-1.5 rounded-[1px] px-2"
								aria-label={`Seeing: ${seeing.label}. Toca para saber qué significa`}
							/>
						}
					>
						<span
							className={cn(
								"size-2 rounded-full bg-current",
								// El color solo tiene sentido si el dato aplica: con el cielo
								// cubierto el punto se apaga, igual que el valor se tacha.
								obscured ? "text-muted-foreground/40" : QUALITY_TONE[seeing.quality],
							)}
						/>
						<span className="text-xs font-medium">Seeing</span>
						<span
							className={cn(
								"text-xs tabular-nums",
								obscured ? "text-muted-foreground line-through" : "text-muted-foreground",
							)}
						>
							{seeing.range}
						</span>
						<HugeiconsIcon icon={InformationCircleIcon} data-icon="inline-end" />
					</PopoverTrigger>

					<PopoverContent align="end" className="w-72">
						<PopoverHeader>
							<PopoverTitle>¿Qué es el seeing?</PopoverTitle>
							<PopoverDescription>
								Cuánto tiembla la imagen por la turbulencia del aire. Mientras más bajo el
								número, más nítido se ve por el telescopio.
							</PopoverDescription>
						</PopoverHeader>

						<p className="text-sm leading-relaxed">{seeingMeaning(seeing, obscured)}</p>

						<p className="text-xs leading-relaxed text-muted-foreground">
							Hay más en{" "}
							<a
								href="/#pronostico"
								className="text-primary underline underline-offset-4"
							>
								cómo estará la noche
							</a>{" "}
							y en{" "}
							<a
								href="/#deberias-saber"
								className="text-primary underline underline-offset-4"
							>
								deberías saber
							</a>
							.
						</p>
						</PopoverContent>
					</Popover>
				)}
			</div>
		</nav>
	);
}
