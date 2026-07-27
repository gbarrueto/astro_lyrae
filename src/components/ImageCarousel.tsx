import { useState, useEffect } from "react";
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
  className: string
}

export function ImageCarousel({ images, className }: ImageCarouselProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    if (!api) return
    setSelected(api.selectedScrollSnap())
    api.on("select", () => setSelected(api.selectedScrollSnap()))
  }, [api])

  const current = images[selected]

  return (
    <div className={className}>
      {current.title && (
        <div className="text-center w-1/2 basis-1/2">
          <h3 className="text-xl font-semibold">{current.title}</h3>
          <p>{current.description}</p>
        </div>
      )}
      <Carousel setApi={setApi} className="basis-1/2">
        <CarouselContent className="py-16">
          {images.map((image, index) => (
            <CarouselItem key={index}>
              <img src={image.src} alt={image.alt ?? ""} className="h-full rounded-md object-cover" />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className={ "hidden md:flex" } />
        <CarouselNext className={ "hidden md:flex" }/>
      </Carousel>
    </div>
  )
}
