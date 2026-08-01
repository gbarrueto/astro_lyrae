import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CloudIcon, Navigation03Icon } from "@hugeicons/core-free-icons";

import { QUALITY_TONE, temperatureTone, windArrow, type NightSegment } from "@/lib/sky";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const tone = (quality?: string) => (quality ? QUALITY_TONE[quality] : "");

type Row = { term: string; value: React.ReactNode; muted?: boolean; title?: string };

function detailRows(segment: NightSegment): Row[] {
	const arrow = segment.wind ? windArrow(segment.wind.direction) : null;

	return [
		{
			term: "Seeing",
			muted: segment.obscured,
			title: segment.obscured
				? "Sin efecto con el cielo cubierto: no hay nada que observar."
				: undefined,
			value: (
				<span
					className={cn(
						"tabular-nums",
						segment.obscured ? "line-through" : tone(segment.seeing?.quality),
					)}
				>
					{segment.seeing?.range}
				</span>
			),
		},
		{
			term: "Transparencia",
			muted: segment.obscured,
			title: segment.obscured
				? "Sin efecto con el cielo cubierto: no hay nada que observar."
				: undefined,
			value: (
				<span className={segment.obscured ? "line-through" : tone(segment.transparency?.quality)}>
					{segment.transparency?.label}
				</span>
			),
		},
		{
			term: "Temperatura",
			value: (
				<span className={cn("tabular-nums", temperatureTone(segment.temperature))}>
					{segment.temperature} °C
				</span>
			),
		},
		{
			term: "Viento",
			value: (
				<span className={tone(segment.wind?.quality)}>
					{segment.wind?.label}
					{arrow && (
						<span
							className="ml-1 inline-block align-middle text-primary"
							title={arrow.label}
							aria-label={arrow.label}
							style={{ transform: `rotate(${arrow.deg}deg)` }}
						>
							<HugeiconsIcon icon={Navigation03Icon} size={13} />
						</span>
					)}
				</span>
			),
		},
		{ term: "Humedad", value: <span className="tabular-nums">{segment.humidity}</span> },
	];
}

export function NightSegments({ segments }: { segments: NightSegment[] }) {
	const [active, setActive] = useState(segments[0]?.time ?? "");

	if (segments.length === 0) return null;

	return (
		<Tabs value={active} onValueChange={(value) => setActive(value as string)}>
			<TabsList className="grid w-full grid-cols-3">
				{segments.map((segment) => (
					<TabsTrigger key={segment.time} value={segment.time} className="tabular-nums">
						{segment.time}
					</TabsTrigger>
				))}
			</TabsList>

			{segments.map((segment) => (
				<TabsContent key={segment.time} value={segment.time}>
					<div className="rounded-2xl bg-card p-5 ring-1 ring-white/10">
						<div className="flex items-baseline justify-between gap-3 duration-300 animate-in fade-in slide-in-from-bottom-1">
							<h3 className="font-heading text-base font-medium">{segment.label}</h3>
							{segment.precipitation && (
								<span className="text-xs text-muted-foreground">
									{segment.precipitation === "snow" ? "con nieve" : "con lluvia"}
								</span>
							)}
						</div>

						<p
							className="mt-3 flex items-center gap-2 text-sm duration-300 animate-in fade-in slide-in-from-bottom-1"
							style={{ animationDelay: "60ms", animationFillMode: "both" }}
						>
							<HugeiconsIcon icon={CloudIcon} size={16} />
							<span className={cn("font-medium", tone(segment.clouds?.quality))}>
								{segment.clouds?.label}
							</span>
							<span className="text-xs text-muted-foreground tabular-nums">
								{segment.clouds?.range}
							</span>
						</p>

						<dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-white/10 pt-3 text-sm">
							{detailRows(segment).map((row, index) => (
								<div
									key={row.term}
									className={cn(
										"flex items-baseline justify-between gap-2 duration-300 animate-in fade-in slide-in-from-bottom-1",
										row.muted && "opacity-45",
									)}
									style={{ animationDelay: `${110 + index * 45}ms`, animationFillMode: "both" }}
									title={row.title}
								>
									<dt className="text-xs text-muted-foreground">{row.term}</dt>
									<dd className="text-right text-xs font-medium">{row.value}</dd>
								</div>
							))}
						</dl>
					</div>
				</TabsContent>
			))}
		</Tabs>
	);
}
