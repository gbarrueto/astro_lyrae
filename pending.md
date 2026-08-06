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

### El texto introductorio ya no acompaña a las imágenes

Los tres párrafos de `Intro.astro` se escribieron cuando el carrusel mostraba una
foto por servicio: cada párrafo era el pie de una imagen concreta. Hoy el
carrusel muestra **experiencias** —la Vía Láctea sobre las cabañas, el grupo
observando, la pareja retratada— y el texto quedó describiendo un catálogo que
ya no está a la vista.

- Reescribir los párrafos para que hablen de la experiencia, no del catálogo:
  los servicios ya tienen su propia sección justo debajo, con foto, precio y
  duración.
- De paso se resuelve algo detectado en los recorridos: el segundo párrafo dice
  *"Electronically Assisted Astronomy (EAA)"* en inglés, y ahí es donde el
  visitante sin astronomía deja de leer.
- Ojo con el largo: es lo primero que se ve después del botón de reserva y del
  aviso de exclusividad. Tres párrafos son mucho para esa posición.

---

## Navegación

### Saltos hacia el pronóstico

*(fricción #4 del recorrido de visitante, semilla 330439)*

> **Hecho lo de "Deberías saber".** Los puntos 01 y 03 llevan enlace a
> `#pronostico`, y `section[id]` gana `scroll-margin-top` en `global.css` para que
> el título del destino no quede bajo la barra fija. **Falta el salto desde la
> barra superior**, que sigue enredado con el pendiente de la ubicación.

Para una huésped que llega desde el mensaje de bienvenida, *"¿se puede hoy?"* es
**la** pregunta, y el pronóstico está en la cuarta pantalla. Peor: el punto 01 de
"Deberías saber" le dice literalmente *"Revisa el pronóstico del tiempo"* y no
hay ningún enlace que la lleve ahí; el texto solo menciona que está "más abajo".

El ancla `#pronostico` ya existe y funciona, así que esto es agregar enlaces, no
construir nada.

- **Desde `GoodToKnow.astro`**: el punto 01 debería enlazar a `#pronostico`, y el
  punto 03 —el de seeing— también, ya que remata con "más abajo puedes ver cómo
  se espera que esté".
- **Desde el navbar**: hoy los enlaces a `/#pronostico` y `/#deberias-saber`
  existen pero viven **dentro del popover de `SkyStatus`**, o sea escondidos tras
  un botón que dice "Seeing" —una palabra que el visitante sin astronomía no
  entiende y no se atreve a tocar. El icono de cielo y la temperatura de la barra
  son el lugar natural para un salto directo al pronóstico.
- Ojo con el `scroll-behavior: smooth` del sitio y la barra fija: el destino
  necesita `scroll-margin-top` para que el título no quede debajo de la barra.

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

### Mostrar más de una noche ✅

*(fricción #1 del recorrido de visitante, semilla 330439)*

> **Hecho.** `scripts/forecast.mjs` emite `nights[]` y `NightPanel.tsx` abre con
> un selector de noche. Verificado contra la API: 7Timer llega a 72 h, o sea tres
> noches con cuatro puntos cada una — pero el alcance se cuenta desde el `init`
> del modelo, así que el script emite **solo las noches que tienen datos** y el
> selector renderiza las que existan. Con una sola noche, ni siquiera aparece.

La visitante llevaba tres noches por delante y el sitio solo le mostró una. Peor:
el propio bloque le ofrece *"Escríbenos y buscamos otra noche de tu estadía"* y
acto seguido no le muestra ninguna otra noche. Se fue sin poder escribir, porque
para escribir necesitaba saber qué noche pedir.

Es la fricción de mayor valor del recorrido: convierte un `CUMPLIDO CON
DIFICULTAD` en `OBJETIVO CUMPLIDO`, y además ataca el caso más común —el huésped
tiene varias noches y solo necesita elegir cuál.

- Ver primero **hasta dónde llega 7Timer**: el endpoint `astro` entrega puntos
  cada 3 horas, y hay que confirmar cuántos días cubre antes de diseñar nada.
  `scripts/forecast.mjs` hoy se queda con la noche vigente y descarta el resto.
- Si 7Timer no alcanza, evaluar **una segunda fuente solo para el resumen** de
  las noches siguientes: nubosidad y poco más. No hace falta seeing ni
  transparencia para decir "el domingo se ve mejor" — el detalle completo puede
  seguir siendo solo de la noche vigente.
- Cuidado con el peso visual: la tarjeta actual ya es densa. Las noches
  siguientes probablemente quieran ser una fila compacta ("sáb 2: despejado ·
  dom 3: nublado") que al tocarla abra el detalle, no tres tarjetas completas.

### La noche cruza medianoche: mostrar los dos días

*(fricción #2 del mismo recorrido)*

El encabezado dice *"Pronóstico para la noche del viernes, 31 de julio"*, pero la
visitante lo leyó a la 01:10 del sábado 1 y al pie decía *"Actualizado el 1/8,
00:34"*. No supo si le estaban mostrando la noche que terminaba o la que venía.

Una noche de observación abarca dos fechas de calendario —empieza el viernes y
termina el sábado a las 06:16, como dice el propio bloque "Cielo oscuro 19:29 –
06:16"—, así que nombrarla con un solo día es ambiguo justo para quien la está
viviendo.

- Nombrar el rango, no el día: "la noche del viernes 31 al sábado 1".
- Es la misma raíz que el punto siguiente: pasada la medianoche, el sitio se
  desincroniza de quien lo está mirando. Conviene resolverlos juntos.

### No abrir en un tramo de hora que ya pasó ✅

*(fricción #3 del mismo recorrido)*

> **Resuelto por rediseño.** Se fueron las pestañas de hora: los tres tramos
> viven ahora dentro de la línea de tiempo, cada uno en su hora real, y el
> marcador «AHORA» muestra dónde está parado el visitante. Ya no hay un tramo
> "seleccionado por defecto" que pueda estar vencido.

A la 01:10 la tarjeta venía abierta en "Anochecer · 20:00", un tramo que había
ocurrido cinco horas antes. La visitante lo notó de inmediato y le restó
credibilidad al resto del bloque.

- **Desactivar** los tramos ya pasados, o al menos marcarlos, y **seleccionar por
  defecto el siguiente que queda**.
- Si ya pasaron todos (mirando a las 05:00), el bloque no debería insistir con
  esta noche: ahí es donde engancha con "mostrar más de una noche".
- Comparar contra la hora del complejo, no la del dispositivo — mismo criterio
  que se usó para el plazo de aviso.

### Explicar qué efecto tiene cada dato, no solo su valor

*(fricción #5 del mismo recorrido y del anterior)*

La tarjeta entrega Seeing, Transparencia, Temperatura, Viento y Humedad como
cifras sueltas. Para un visitante sin astronomía son una caja negra: sabe que
`Transparencia: muy pobre` es malo porque está tachado, pero no qué le cambia a
*su* noche. El seeing ya tiene su explicación en el popover de la barra y funcionó
bien; el resto no tiene nada.

Lo que hay que decir de cada uno es **qué se ve distinto y cómo se pasa la noche**:

- **Transparencia** — cuántos objetos tenues alcanzas a ver; con mala, la Vía
  Láctea se apaga aunque el cielo esté despejado.
- **Temperatura** — cuánto hay que abrigarse para estar dos horas quieto de
  noche. Es la pregunta práctica, no el número.
- **Viento** — arruina la exposición larga (fotografía) y hace tiritar al grupo;
  ya existe `night.windWarning` para el caso fuerte.
- **Humedad** — empaña la óptica y baja la sensación térmica bastante más que lo
  que dice el termómetro.

Sirve el mismo patrón del seeing: `Popover` o `Tooltip` en el término, con una
frase en lenguaje llano. Enlaza con el punto 5 de "Sacarle provecho a shadcn".

**Parcialmente cubierto** por el bloque "Qué se puede hacer" del panel nuevo, que
traduce la noche a impacto por servicio ("luna al 60%", "viento sobre el
trípode"). Lo que sigue faltando es la explicación **del término en sí**, en el
popover donde aparece la cifra.

### Humedad: el rango degenerado y de qué es el porcentaje

*(fricción #6 del recorrido de visitante, semilla 330439)*

> **Hecho a medias.** El rango degenerado ya no aparece: `humidityRange()` imprime
> `100 %` cuando los dos extremos coinciden. Falta la segunda parte —explicar de
> qué es el porcentaje—, que va junto con los popovers de términos.

Dos cosas distintas en el mismo dato.

**1. `100–100 %` se lee como un descuido.** `humidityRange()` en
`scripts/forecast.mjs:101` calcula `low` y `high` a partir de `rh2m`, y en el
tope de la escala los dos topan en 100, así que imprime un rango de 100 a 100.
Cuando ambos extremos coinciden hay que mostrar **`100 %`** a secas. Es el único
rango calculado del pronóstico: los de nubosidad vienen de la tabla `CLOUDS` con
los tramos escritos a mano, así que no degeneran.

**2. ¿Humedad respecto de qué?** Es **humedad relativa a 2 m del suelo** (`rh2m`
de 7Timer): qué porcentaje del vapor de agua que el aire puede sostener *a esa
temperatura* ya está presente. Por eso 100 % no significa "está lloviendo" sino
**aire saturado**, y ahí está lo que importa para observar:

- A 100 % el aire está en el punto de rocío: **se empaña la óptica**, y con 6 °C
  puede llegar a escarcharse. Es la diferencia entre una salida cómoda y estar
  secando el ocular cada diez minutos.
- Baja la sensación térmica bastante más de lo que dice el termómetro, que es la
  pregunta práctica de quien va a estar dos horas quieto de noche.

Ese "respecto de qué" es exactamente el vacío del pendiente anterior: el número
solo no dice nada si no se sabe contra qué se mide. Van juntos.

### Avisar cuando la hora de aviso ya pasó ✅

*(fricción #1 del recorrido de visitante, semilla 593281)*

> **Hecho.** El bloque del plazo en `NightForecast.astro` tiene tres estados y un
> script inline elige el que corresponde: antes del plazo muestra la hora tope;
> pasado el plazo reconoce que ya es tarde e **invita a escribir igual**, con
> enlace directo a WhatsApp; y si el pronóstico ya no es el de la noche vigente,
> no afirma nada sobre hoy.
>
> La comparación es contra la hora del complejo, no la del dispositivo, y el
> plazo viaja como instante absoluto (`night.bookingDeadlineAt`) para no depender
> de parsear "15:56". Probados los siete bordes, incluida la madrugada, cuando la
> noche vigente sigue siendo la de ayer.

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

### Viento en el pronóstico ✅

*(fricción #4 del mismo recorrido)*

> **Hecho.** `wind10m` entra en cada tramo con la escala 1–8 traducida según la
> tabla oficial de 7Timer, y la dirección pasada a nuestras siglas (SO, O, NO).
> No se tacha con cielo cubierto. Cuando algún tramo llega a viento fuerte o más,
> `night.windWarning` agrega un aviso propio: el viento no cambia el veredicto
> —se puede observar con viento— pero arruina la exposición larga y cambia cuánto
> hay que abrigarse.

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

## Barra superior

### Icono del botón de seeing: interrogación, no exclamación ✅

*(a raíz del recorrido de visitante, semilla 330439)*

> **Hecho.** `HelpCircleIcon` en lugar de `InformationCircleIcon`.

El botón usa `InformationCircleIcon` de hugeicons (`SkyStatus.tsx:147`), que se
lee como un signo de admiración —aviso, algo va mal— cuando lo que hace en
realidad es explicar un término. Un signo de interrogación comunica "acá te
resuelvo la duda", que es exactamente lo que pasa al tocarlo.

Importa más de lo que parece: para el visitante sin astronomía, "Seeing" es una
palabra en inglés sin significado, y el icono es la única pista de que ahí hay
una explicación y no una alerta. En el recorrido, tocarlo fue el momento en que
el término dejó de ser ruido.

- Candidato en el set instalado: `HelpCircleIcon` / `QuestionMarkIcon` de
  `@hugeicons/core-free-icons`.

### De dónde son la hora y la temperatura

La barra muestra hora, temperatura y seeing sin decir **de qué lugar**. Para
quien llega desde Instagram o Google, esos números no tienen referente; para el
huésped, confirmarían que el dato es del complejo y no de su ciudad.

Idea: icono de ubicación + "Quillaileo", enlazado a la ubicación en Google Maps.

⚠️ **Compite por el mismo espacio que el pendiente "Saltos hacia el pronóstico"**
(sección Navegación), que propone convertir el icono de cielo y la temperatura en
un salto a `#pronostico`. La barra tiene tres zonas y en 390 px ya está llena:
marca · icono + hora + temperatura · botón de seeing. Los dos cambios hay que
resolverlos juntos, no por separado, y probablemente algo tenga que ceder —
candidata natural: la marca "Lyrae." de la izquierda, que en la portada es
redundante con el `h1` que viene dos pantallas más abajo.

### Dibujos definitivos de los iconos de cielo

La composición por capas ya funciona y está enchufada, pero los 16 archivos de
`src/assets/sky/` son placeholders geométricos hechos para verificar la lógica,
no para mostrarlos en producción.

Los dibujos vienen en camino. Lo que hay que respetar está en
`docs/iconos-cielo.md`: nombres de archivo, lienzo de 24×24, hemisferio sur —la
luna creciente se ilumina por la izquierda— y que las capas se apilan, así que
las nubes van abajo y los cuerpos celestes arriba a la derecha.

Reemplazar un archivo con el mismo nombre es todo lo que hay que hacer; no se
toca código.

---

## Ilustrar los conceptos

El sitio explica seeing, apertura, distancia focal y escala Bortle **solo con
texto**. Son conceptos que se entienden mirando, no leyendo: una imagen de cielo
despejado contra uno cubierto comunica en un segundo lo que tres párrafos no
logran. La apuesta es que el visitante entienda el *efecto* sin tener que
aprender el término.

⚠️ **Antes de llenar "Deberías saber" hay que plegarla.** El pendiente
"Sacarle provecho a shadcn" propone un `Accordion` ahí porque las tres tarjetas
abiertas ya suman bastante scroll en móvil. Si además se le agregan imágenes, un
interactivo y dos animaciones, la sección se vuelve la más larga del sitio. El
orden correcto es: **plegar primero, llenar después** — y así cada demo se carga
solo cuando alguien abre su tarjeta.

⚠️ **Hay que decidir dónde vive cada explicación.** El pendiente "Explicar qué
efecto tiene cada dato" (sección Pronóstico) propone popovers en los términos del
pronóstico. Estos ilustrativos son la versión larga de lo mismo. Conviene que no
se contradigan: el popover responde en contexto y en una frase; "Deberías saber"
muestra el efecto y puede enlazarse desde el popover.

### Cielo despejado contra cielo cubierto

En el punto 01 de "Deberías saber", que hoy dice *"¡No queremos nubes!"* sin
mostrar ninguna. Dos fotos del mismo encuadre —idealmente del propio complejo—
valen más que la frase.

- Es la misma tarjeta que debería enlazar a `#pronostico` (ver "Saltos hacia el
  pronóstico"): la imagen explica el porqué y el enlace lleva al dato de hoy.

### Cómo cambian apertura y focal la imagen de un planeta

Elemento interactivo en el punto 02. Dos controles —apertura y distancia focal—
y una imagen de planeta que responde: más apertura, más detalle y más brillo;
más focal, imagen más grande y más oscura.

- **Definir el alcance antes de construir**: esto es una demostración
  *cualitativa*, no un simulador óptico. Si se presenta como exacto, el
  aficionado avanzado —que sí lee estos datos— va a encontrarle el error.
- Se puede resolver con CSS sobre una foto buena (escala + desenfoque + brillo)
  antes que con canvas.
- Conecta con las fichas de servicio: ahí ya están la apertura y la focal reales
  de cada telescopio, así que la demo puede terminar en "nuestro equipo está acá".

### Buen seeing contra mal seeing, en movimiento

El seeing es turbulencia: es lo único de esta lista que **no se puede mostrar con
una imagen fija**. Dos animaciones cortas del mismo planeta, una estable y otra
hirviendo, en el punto 03.

- **No usar GIF.** Pesan varios MB y el visitante típico está con señal móvil
  irregular en la precordillera. Video `webm`/`mp4` con `preload="none"`, `muted`,
  `loop`, `playsinline` y un `poster` estático pesa una fracción.
- Respetar `prefers-reduced-motion`: sin animación, mostrar los dos fotogramas
  lado a lado.

### La escala Bortle, ilustrada

En `SkyQuality.astro`. Hoy el bloque dice "Clase 2" y "21.94 mag/arcsec²" con una
nota de texto; el número no significa nada para quien no conoce la escala, y es
el mejor argumento de venta del negocio.

- La comparativa clásica de los nueve cielos es material **con derechos** en casi
  todas sus versiones. Verificar licencia antes de usarla, o encargar una propia.
- Alternativa más honesta y más barata: **dos fotos propias** —el cielo del
  complejo contra el cielo de una ciudad— que es exactamente la comparación que
  al visitante le importa. Ya existe `mw-core-over-cabin.webp` para el primer
  lado.

---

## Interfaz

### Sacarle provecho a shadcn

El proyecto tiene shadcn configurado (base-ui, estilo `maia`, iconos hugeicons)
y `src/components/ui/` solo tiene cuatro componentes instalados: `button`,
`carousel`, `popover` y `tabs` (este último llegó con el control de horas del
pronóstico). Buena parte de la interfaz son `div` con `ring-1` y `rounded-2xl`
escritos a mano, que es justo lo que los componentes ya resuelven —y con estados
de foco y accesibilidad incluidos.

Ordenado por lo que más rinde:

1. **`Accordion` en "Deberías saber"** (`GoodToKnow.astro`). Hoy son tres
   tarjetas siempre abiertas que suman bastante scroll en móvil. Plegadas, el
   visitante escanea los tres títulos y abre el que le interesa.
2. **`Alert` para los avisos.** El bloque de exclusividad en `Intro.astro`, el
   `windWarning` y la nota de "seeing tachado" en `NightForecast.astro` son
   todos `div` estilizados a mano.
3. ~~**`Badge` para los chips.**~~ **Hecho en los objetivos observables** de la
   ficha de servicio. Ojo con la variante: `secondary` los dejaba grises y perdían
   la identidad, así que van con `outline` más los tokens del ámbar de marca. El
   chip del veredicto de la noche sigue siendo un span con clases.
4. **`Separator`** en vez de los `border-t` repartidos por las tarjetas.
5. **`Tooltip` o `Popover` en el resto de los términos técnicos.** El seeing ya
   lo tiene en la barra; transparencia, apertura y relación focal siguen sin
   explicación en el punto donde aparecen. Es el vehículo del pendiente
   "Explicar qué efecto tiene cada dato" de la sección Pronóstico.

Discutible y por eso al final: **`Tabs` en la ficha de servicio** para separar
experiencia / equipamiento / antes de reservar. Acortaría mucho la página, pero
esconde contenido que hoy se encuentra bajando, y en los recorridos simulados el
aficionado avanzado sí leía el equipamiento completo. No hacerlo sin evaluarlo
antes.

---

## Herramientas ✅

### Reemplazar el capturador del recorrido simulado ✅

*(a raíz del recorrido de visitante — fricciones #1, #6 y #8 resultaron ser
artefactos de la herramienta, no del sitio)*

> **Hecho.** `screens.sh` se reemplazó por `scripts/visita.mjs`, que pilotea Edge
> por el protocolo de DevTools (`localhost:9222`) sin dependencias: Node ya trae
> `WebSocket`. Órdenes: `abrir`, `ver`, `tocar`, `deslizar`, `mirar`, `auditar`,
> `cerrar`. La pestaña sobrevive entre órdenes.
>
> El ciclo completo bajó de ~2 min a **7 s**. El viewport de 390 px ahora es real
> (`Emulation.setDeviceMetricsOverride`), así que se fue el iframe y con él la
> franja gris y el fantasma bajo la barra. El recorrido **interactúa**: taps
> táctiles de verdad, swipe para el carrusel y popovers que se abren — el control
> de horas y el popover del seeing antes no se evaluaban nunca.
>
> Lo que más rinde no es la velocidad sino la separación entre **hechos** y
> **percepción**: `auditar` verifica consola, red, status de cada enlace,
> desborde y anclas, y el visitante solo puede afirmar que algo está roto si eso
> lo confirma. `ver` entrega el texto en orden de lectura, que es lo que una
> persona escanea, a una fracción del costo de leer capturas.
>
> `ver` agrupa por caja de layout y no por etiquetas, así que sobrevive a que se
> rediseñe una sección; `auditar` incluye una línea de control («texto en
> pantalla que ver no recoge») que delata si el lector se queda atrás.

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

- ~~Indicador `Seeing --  --:--` de la barra superior~~ *(fricción #3)*. **Hecho:**
  la barra muestra hora del complejo, temperatura, seeing e icono de cielo
  compuesto por capas. Faltan los dibujos definitivos — hoy hay placeholders
  geométricos en `src/assets/sky/`, ver `docs/iconos-cielo.md`.
- ~~Chips de hora del pronóstico sin estado visible~~ *(fricción #5)*. **Resuelto
  por eliminación:** los seis botones se fueron junto con la tabla. El modelo
  entrega un punto cada 3 horas, así que elegir una hora exacta prometía una
  precisión que no existe.
- ~~Cambios pensados para la tabla de pronóstico~~ *(fricciones #1 y #6)*.
  **Hecho:** `NightForecast.astro` reemplaza el iframe de meteoblue por un
  veredicto de la noche en lenguaje llano, con los tramos de 3 horas y el seeing
  tachado cuando hay nubes.

---

## Decisiones abiertas

### Tarifa del EAA ✅

> **Resuelto.** Los tres servicios pasaron de tarifa por persona a **mínimo por
> salida (hasta 2 personas) + adicional por persona**: Observación Visual
> $15.000 +$5.000/adulto +$2.500/niño; EAA $20.000 +$4.500/adulto
> +$2.500/niño; Fotografía $12.000 sumada a otra salida, $18.000 sola.
>
> El error de fondo no era el nivel sino la estructura: cobrar por cabeza un
> servicio cuyo costo es por salida dejaba al operador bajo el sueldo mínimo con
> una pareja —el caso más frecuente— y cobraba $32.000 a una familia de 4 por un
> EAA que no cuesta un peso más de operar. El nivel se ancló en la **noche de
> cabaña** ($50.000–$70.000): cada tarifa queda entre el 20% y el 40% de una
> noche.
>
> Dos supuestos que sostienen estos números y conviene no perder: el equipo es
> **capital hundido** (compra de hobby, no se amortiza) y el operador trabaja
> **estacionalmente**. Si alguna vez hay que pasar la batuta a alguien que deba
> comprar equipo, estos precios no le sirven.
>
> Método y anclas en `.claude/skills/asesor-tarifas/`.

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
