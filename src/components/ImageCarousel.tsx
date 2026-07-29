import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel"

type ImageCarouselProps = {
  images: { src: string; alt?: string; title?: string; description?: string }[],
  className?: string
}

export function ImageCarousel({ images, className }: ImageCarouselProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    if (!api) return
    const onSelect = () => setSelected(api.selectedScrollSnap())
    onSelect()
    api.on("select", onSelect)
    return () => { api.off("select", onSelect) }
  }, [api])

  const current = images[selected]

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <Carousel setApi={setApi} className="w-full">
        <CarouselContent>
          {images.map((image, index) => (
            <CarouselItem key={index}>
              <img
                src={image.src}
                alt={image.alt ?? ""}
                loading="lazy"
                className="aspect-[4/3] w-full rounded-xl object-cover"
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        {/* En móvil se navega con swipe; las flechas solo aparecen donde hay puntero. */}
        <CarouselPrevious className="hidden md:flex" />
        <CarouselNext className="hidden md:flex" />
      </Carousel>

      {current?.title && (
        <div className="text-center">
          <h3 className="font-heading text-lg font-medium">{current.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{current.description}</p>
        </div>
      )}

      {images.length > 1 && (
        <div className="flex justify-center gap-2">
          {images.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => api?.scrollTo(index)}
              aria-label={`Ir a la imagen ${index + 1}`}
              aria-current={index === selected}
              className={cn(
                "h-1.5 rounded-full transition-all",
                index === selected ? "w-6 bg-primary" : "w-1.5 bg-foreground/25",
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}
