import { cn } from "@/lib/utils";

export type MoonInfo = {
	illumination: number;
	phase: number;
	label: string;
	interference: "alta" | "media" | "baja";
	rise: string | null;
	set: string | null;
};

const EFFECT: Record<string, string> = {
	alta: "Aclara el fondo del cielo: las galaxias y nebulosas tenues se pierden. Buena noche para planetas y para la Luna misma.",
	media: "Molesta algo en cielo profundo, pero la mayoría de los objetos se sigue viendo.",
	baja: "Cielo oscuro de verdad: es la mejor noche para galaxias, nebulosas y fotografía.",
};

const FOOT: Record<string, string> = {
	alta: "bg-bad/10 border-bad/25 text-bad",
	media: "bg-warn/10 border-warn/25 text-warn",
	baja: "bg-good/10 border-good/25 text-good",
};

/**
 * El terminador es media elipse cuyo ancho depende de la fase. En el hemisferio
 * sur la luz entra por el lado contrario al del norte.
 */
function phasePath(phase: number) {
	const r = 42;
	const x = Math.cos(2 * Math.PI * phase);
	const waxing = phase < 0.5;
	const edge = waxing ? 0 : 1;
	// El terminador suma (gibosa) o resta (creciente) según de qué lado vuelva.
	const terminator = x > 0 ? 1 - edge : edge;
	return `M 0 ${-r} A ${r} ${r} 0 0 ${edge} 0 ${r} A ${Math.abs(x) * r} ${r} 0 0 ${terminator} 0 ${-r} Z`;
}

export function MoonCard({ moon }: { moon: MoonInfo }) {
	const when = moon.rise ? `sale ${moon.rise}` : moon.set ? `se pone ${moon.set}` : "toda la noche";

	return (
		<div className="overflow-hidden rounded-2xl bg-card ring-1 ring-white/10">
			<div className="flex items-center gap-4 p-5">
				<svg
					width="72"
					height="72"
					viewBox="-50 -50 100 100"
					className="shrink-0"
					role="img"
					aria-label={`Luna ${moon.label}, ${moon.illumination}% iluminada`}
				>
					<circle r="42" fill="var(--muted)" />
					<path d={phasePath(moon.phase)} fill="oklch(0.93 0.03 90)" />
					<circle r="42" fill="none" stroke="rgba(255,255,255,0.14)" />
				</svg>

				<div className="min-w-0">
					<p className="font-heading text-lg leading-tight font-medium">{moon.label}</p>
					<p className="text-sm text-muted-foreground tabular-nums">
						{moon.illumination}% iluminada · {when}
					</p>
				</div>
			</div>

			<div className={cn("flex flex-col gap-1 border-t p-5", FOOT[moon.interference])}>
				<span className="text-xs font-semibold tracking-[0.14em] uppercase">
					Interferencia {moon.interference}
				</span>
				<p className="text-sm leading-relaxed text-muted-foreground">
					{EFFECT[moon.interference]}
				</p>
			</div>
		</div>
	);
}
