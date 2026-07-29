# Pendientes

Cosas identificadas y todavía no hechas. Origen entre paréntesis.

---

## Contenido ✅

### Precio visible en las tarjetas de la portada ✅

*(fricción #4 del recorrido de visitante, semilla 794552)*

> **Hecho.** `mainPrice()` en `src/lib/services.ts` devuelve el tramo principal;
> la tarjeta de `ServiceSlideshow.astro` lo muestra sobre una línea divisoria,
> con la duración a la derecha y "Ver detalles →" debajo. Sin tarifa, muestra
> "Consúltanos".

Hoy las tarjetas de servicio de la portada muestran duración pero no precio. El
visitante llega al pie de la página sin saber cuánto vale nada, y para comparar
los tres servicios tiene que entrar y salir de tres fichas.

La gente quiere saber el precio al tiro, sin comprometerse a ver detalles. El
que quiere el detalle entra igual; al que no, no hay para qué obligarlo.

- Mostrar el precio en la tarjeta de portada, junto a la duración.
- Ojo con el formato en móvil: `price` es `PriceTier[]` justamente porque la
  observación visual tiene dos tramos (adultos / niños) y el renglón se parte.
  En la tarjeta probablemente convenga mostrar solo el tramo principal, con la
  ficha completa adentro.
- Servicios con `price: null` siguen mostrando "Consúltanos".

### Datos técnicos que faltan en las fichas ✅

*(fricción #7 — un aficionado avanzado los busca y no los encuentra)*

> **Hecho.** Focal del refractor (432 mm) y modelo de montura (Orion SkyView
> Pro, en EAA y en Observación Visual) agregados a `src/lib/services.ts`. De
> paso quedó la focal del reflector (1000 mm), que era el mismo cálculo a mano.
>
> La calidad del cielo quedó como bloque propio en la portada:
> `src/components/Index/SkyQuality.astro`, entre `Intro` y `ServiceSlideshow`,
> con los datos en la constante `sky` de `services.ts`. Va arriba y no dentro de
> "Deberías saber" porque es el argumento que decide el viaje, y además sostiene
> el precio de los servicios que vienen justo después.

Agregar a `src/lib/services.ts`:

- **EAA — focal del refractor: 432 mm.** Hoy solo está la relación focal (f/4) y
  hay que calcularla.
- **EAA — modelo de montura: Orion SkyView Pro.** Hoy dice solo "Ecuatorial
  GoTo", que no es un modelo. Aplica también a la montura de Observación Visual,
  que comparte equipo.
- **Calidad del cielo, transversal al sitio: Bortle 2, SQM 21.94 mag/arcsec².**
  Fuente: lightpollutionmap. Hoy no aparece en ninguna parte, y es el mejor
  argumento de venta que tiene el negocio — el visitante avanzado lo mencionó
  como *el dato que decide* si viajar a fotografiar.

  Decidir dónde vive: no es de un servicio, es del lugar. Candidatos: bloque
  propio en la portada, o dentro de "Deberías saber". También es insumo para la
  tarifa (ver `.claude/skills/asesor-tarifas/`): un alza de precio apoyada en la
  calidad del cielo necesita que la calidad del cielo esté escrita.

---

## Navegación ✅

### Salida al final de las fichas de servicio ✅

*(fricción #9 — evaluado)*

> **Hecho.** Sección "Los otros servicios" al cierre de `src/pages/service/[id].astro`:
> los dos servicios restantes como tarjetas chicas con foto, nombre, precio y
> duración, y el enlace "Volver a servicios" en el encabezado del bloque. Sin
> botón flotante.

El problema real no es volver arriba: es que al terminar una ficha no hay a
dónde ir, y para comparar servicios hay que devolverse a la portada.

**Recomendación: un bloque de cierre al final de cada ficha con los otros dos
servicios**, como tarjetas chicas con nombre, duración y precio, más un enlace
"Volver a servicios".

Por qué así y no lo otro:

- **Mejor que anterior/siguiente.** Con solo tres servicios, mostrar los dos
  restantes es más útil que una flecha que no dice a dónde lleva. Y de paso
  resuelve la comparación de precios que hoy obliga a entrar y salir tres veces.
- **Mejor que un botón flotante de volver arriba.** En móvil ya hay una barra
  fija abajo con precio y "Reservar"; sumar otro elemento flotante compite con
  el CTA, que es lo último que conviene tapar. Un swipe hacia arriba ya
  funciona, y el bloque de cierre resuelve la necesidad de fondo (seguir
  navegando) en vez del síntoma (volver arriba).
- Si igual se quiere el volver-arriba, la alternativa barata es integrarlo en el
  bloque de cierre como un enlace más, no como botón flotante.

---

## Pronóstico

### Avisar cuando la hora de aviso ya pasó

*(fricción #1 del recorrido de visitante, semilla 593281)*

`night.bookingDeadline` se muestra como dato fijo: "Para salir esta noche,
avísanos antes de las 15:56". La visitante llegó a esa línea a las 16:00 —se le
había pasado por cuatro minutos— y **la página no se lo dijo**: tuvo que mirar
la hora en su celular y darse cuenta sola. Esa noche era la única que le
quedaba.

El sitio es estático y `forecast.json` se genera una vez al día, así que la
comparación con "ahora" solo puede ocurrir en el cliente: una isla mínima (o un
script inline) que compare `bookingDeadline` con el reloj del visitante y
cambie el mensaje.

**Importante: cuando el plazo ya pasó, no cerrar la puerta.** El plazo son dos
horas antes del atardecer para alcanzar a armar y alinear, pero se pueden hacer
excepciones y dar por perdida la noche por sistema es perder un cliente que
estaba dispuesto. El mensaje debería reconocer que ya es tarde y aun así
invitar a escribir, algo en la línea de: *"La hora recomendada para avisar era
las 15:56. Escríbenos igual y vemos si alcanzamos a preparar el equipo."*

- Ojo con la zona horaria: el reloj del visitante puede no ser el de Chile
  (alguien planificando desde otro país). Comparar contra la hora del complejo,
  no contra la local del dispositivo.
- Ojo también con el pronóstico vencido: si `night.date` ya no es hoy —porque
  el cron falló— el bloque no debería afirmar nada sobre "esta noche".

### Viento en el pronóstico

*(fricción #4 del mismo recorrido)*

7Timer ya devuelve `wind10m` (`direction` y `speed`) en cada punto y
`scripts/forecast.mjs` lo descarta. Para fotografía de larga exposición el
viento decide tanto como las nubes —con ráfagas no hay trípode que aguante— y
para el resto del grupo es lo que define cuánto hay que abrigarse, que es la
pregunta práctica de quien sale dos horas a estar quieto de noche.

- `speed` viene como escala 1–8, no en m/s: traducirla con la tabla de la
  documentación de 7Timer, sin inventar los cortes.
- Igual que el seeing, el viento **no** se tacha con cielo cubierto: sigue
  siendo válido para decidir el abrigo.

---

## Herramientas

### Reemplazar el capturador del recorrido simulado

*(a raíz del recorrido de visitante — fricciones #1, #6 y #8 resultaron ser
artefactos de la herramienta, no del sitio)*

`.claude/skills/visitante/scripts/screens.sh` maneja Edge headless desde WSL con
un iframe para forzar el viewport. Es lento (~10 s por captura, ~3 min por
página) y solo produce imágenes estáticas, lo que genera falsos positivos
sistemáticos:

- La tabla de meteoblue se ve cortada, pero con un swipe horizontal se ve
  completa (#1, #6).
- La barra fija inferior tapa contenido en la captura, pero al hacer scroll real
  el contenido es perfectamente accesible (#8).
- No hay clic, hover ni scroll dentro de carruseles, así que los chips de hora
  del pronóstico no se pueden evaluar.

Evaluar un driver real (Playwright o Puppeteer contra Chromium en WSL) que
permita al recorrido **interactuar**: tocar, hacer scroll horizontal dentro de
un contenedor, esperar hidratación, y capturar solo cuando el estado importa.
Debería además bajar bastante el tiempo por página.

---

## Descartadas (no volver a reportarlas)

- **"No hay oferta para quien trae su propio equipo"** *(semilla 593281)*. El
  servicio de fotografía nocturna es, a propósito, para quien no sabe y quiere
  un recuerdo sin tocar nada. Quien quiere fotografiar por su cuenta le
  pregunta al anfitrión de TEC: es una conversación, no un producto del sitio.
- **"El lente 28–70 f/3.5–5.6 es lento para Vía Láctea"** *(semilla 593281)*.
  Cierto y también irrelevante: el cliente de ese servicio no lee relaciones
  focales, y el único que las lee ya trae su propia cámara y no lo va a
  contratar. Ningún cliente deja de tomar el servicio por eso.

Ambas son el mismo sesgo: juzgar el catálogo desde el perfil del visitante en
vez de juzgar la experiencia del sitio. Un servicio que no es para alguien es
segmentación, no una falta.

---

## En curso (no requieren nota, anotados para no re-reportarlos)

- Indicador `Seeing --  --:--` de la barra superior *(fricción #3)*.
- Chips de hora del pronóstico sin estado visible *(fricción #5)*.
- Cambios pensados para la tabla de pronóstico *(fricciones #1 y #6)*.

---

## Decisiones abiertas

### Tarifa del EAA

El EAA quedó a `$5.000 por persona`, el mismo valor que el tramo adulto de la
Observación Visual. La duda: el EAA implica bastante más trabajo de armado y
alineación, y el equipo cuesta un múltiplo del visual, así que cobrar lo mismo
—o menos— no se sostiene por el lado del costo. El contraargumento es que para
mucha gente la gracia está en ver con sus propios ojos, y eso le resta valor
percibido al EAA.

Pendiente de resolver con la skill `asesor-tarifas`. Ojo además con la
estructura: el EAA es un servicio **de sesión** (todos miran la misma pantalla,
el costo no cambia con el tamaño del grupo) cobrado **por persona**, lo que
castiga a las parejas y regala los grupos grandes.
