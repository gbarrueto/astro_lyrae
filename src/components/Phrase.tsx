import { QUALITY_TONE, type Phrase as Parts } from "@/lib/sky";
import { cn } from "@/lib/utils";

export function Phrase({ parts }: { parts: Parts }) {
	return (
		<>
			{parts.map((part, index) =>
				part.quality ? (
					<strong key={index} className={cn("font-medium", QUALITY_TONE[part.quality])}>
						{part.text}
					</strong>
				) : (
					<span key={index}>{part.text}</span>
				),
			)}
		</>
	);
}
