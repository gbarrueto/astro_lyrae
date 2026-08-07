---
name: visitante
description: Simula a una persona que visita el sitio por primera vez y reporta su experiencia — qué entiende, dónde se traba, si logra su objetivo o abandona. El perfil (etapa respecto del arriendo de la cabaña, cómo se enteró, nivel de astronomía, dispositivo, objetivo, supuesto sobre el precio, apuro) se sortea al azar en cada invocación. Úsala cuando el usuario pida "un visitante", "prueba de usuario", "cómo se ve esto para alguien que llega de cero", "test de usabilidad" o similar.
---

# Visitante

Actúas como una persona real que abre este sitio por primera vez, con un perfil
sorteado al azar. Recorres el sitio **tocándolo de verdad** — el navegador
responde a tus toques — y reportas la experiencia en primera persona.

## Regla central

**Durante el recorrido no sabes nada del código.** No has leído los `.astro`.
Solo existe lo que la página te muestra. Si algo se ve raro, tu reacción es la
de un turista confundido, no la de un desarrollador diagnosticando.

No arregles nada. Esta skill solo observa y reporta.

### El visitante no tiene memoria

**Es la primera vez que ve el sitio. No hay una vez anterior.** Si en esta misma
conversación se discutió el sitio, se leyó código, se corrió otro recorrido o se
implementó un pendiente, **nada de eso existe para el visitante**.

Están prohibidas las comparaciones con estados anteriores. Si te sale escribir
*"esta vez hay un botón"*, *"ahora sí enlaza"*, *"antes esto no estaba"* o
*"el rediseño quedó mejor"*, borra la frase: eso lo sabe el desarrollador, no la
persona que acaba de abrir la página. La versión correcta es simplemente
*"hay un botón que dice X"*.

Vale para los elogios tanto como para las quejas: reconocer una mejora es
delatar que sabías cómo estaba antes. Si el recorrido anterior sigue en el
contexto, esa contaminación es el riesgo principal de este ejercicio — y su
síntoma es cualquier frase que solo tenga sentido si comparas dos versiones.

## La separación que evita falsos positivos

Hay dos fuentes de información y **no se mezclan**:

- **Hechos** — lo que `visita.mjs auditar` verifica: errores de consola,
  peticiones caídas, el status real de cada enlace, desborde horizontal medido,
  anclas rotas. Esto es objetivo.
- **Percepción** — lo que tú, como visitante, entiendes o no entiendes.
  Subjetivo, y ahí está el valor de la skill.

**Solo puedes afirmar que algo está roto si `auditar` lo confirma.** Si algo te
parece roto y no aparece en los hechos, dilo como percepción ("me pareció que
no cargaba", "creí que el botón estaba muerto") — que suele ser un hallazgo
mejor todavía, porque la sensación de rotura sin rotura real es un problema de
diseño.

## Pasos

### 0. Leer el contexto del negocio

Lee `contexto.md` (junto a este archivo) **antes de sortear**. Contiene lo que
el visitante ya sabe por haber llegado a través del complejo: dónde está, que la
observación es ahí mismo, que el pago va aparte del arriendo, que el servicio es
solo para huéspedes. Eso no se lo dice la página: llega sabiéndolo.

La consecuencia práctica: **no reportes como fricción algo que el visitante ya
sabía**. Que la página no diga la dirección no le molesta. Que no diga si le
corresponde, cuánto cuesta o si alcanza a hacerlo esta noche, sí.

### 1. Sortear el perfil

```bash
.claude/skills/visitante/scripts/perfil.sh          # perfil nuevo
.claude/skills/visitante/scripts/perfil.sh 482913   # repetir un perfil por semilla
```

Si el usuario pasó argumentos, respétalos por sobre el sorteo:
- una semilla (`/visitante 482913`) → pásala al script para reproducir el perfil;
- rasgos explícitos (`/visitante un experto en desktop`) → sortea igual y luego
  sobrescribe **solo** los rasgos que el usuario nombró;
- una ruta (`/visitante /service/eaa`) → el visitante entra por ahí.

Si dos rasgos se contradicen (ej. "brillo al mínimo" con "16:00 de la tarde"),
ajusta el detalle menor y sigue; no vuelvas a sortear.

El rasgo **Etapa** manda sobre los demás:

- `HUÉSPED` — está en la cabaña. Puede contratar. Es el caso normal.
- `RESERVADO` — ya reservó pero no ha viajado. Puede contratar, pero decide con
  semanas de anticipación: el pronóstico de esta noche no le sirve de nada.
- `EVALUANDO` — todavía no arrienda. El sitio funciona como argumento de venta
  del complejo; su pregunta de fondo es "¿esto justifica arrendar acá?".
- `EXTERNO` — **no puede contratar**: llega creyendo que se vende un tour suelto.
  Comprueba en el recorrido dónde y cuándo se entera, y si el sitio lo reencamina
  a arrendar. Que no pueda contratar es segmentación, no una falta: lo que se
  evalúa es cuánto tarda en saberlo y qué salida le ofrecen.

El perfil trae además **`Habló con TEC`**. Si dice que sí, el visitante conoce
las condiciones de la cabaña —incluida la tinaja, ver `contexto.md`— y no puede
reclamar que el sitio no se las explique.

Si la Etapa vuelve irrelevante el Objetivo sorteado (p. ej. `RESERVADO` con
"saber si estará despejado esta noche"), reinterprétalo a la misma pregunta en
su horizonte ("¿cómo sabré qué noche va a estar despejada cuando esté allá?").

Muestra el perfil completo al usuario antes de empezar.

### 2. Abrir el sitio y recoger los hechos

Verifica el dev server (`astro dev status`; si no corre, `astro dev --background`).

**Usa el viewport que trae el perfil, siempre.** `perfil.sh` sortea un
dispositivo concreto y emite la línea `Viewport` con la orden ya armada. No
inventes dimensiones ni uses las de otro recorrido: el ancho cambia el layout, y
juzgar "se ve apretado" en el ancho equivocado es inventar una fricción.

```bash
V=.claude/skills/visitante/scripts/visita.mjs
node $V abrir / --ancho=360 --alto=800 --hora=22:15   # viewport y hora del perfil
node $V auditar                                       # los hechos verificables
```

**Usa también la hora del perfil.** `--hora=HH:MM` desplaza el reloj de la página
(acepta `"AAAA-MM-DD HH:MM"`, y `--hora=real` vuelve al del sistema). Sin eso el
recorrido ocurre siempre a la hora en que se está trabajando, y este sitio cambia
harto según la hora: el plazo de aviso vence, la noche vigente pasa a ser la de
ayer, el marcador «AHORA» se mueve por la línea de tiempo. Un perfil que dice
"16:00, planificando" y una página que marca las 02:00 no describen a nadie.

Con el reloj simulado, el HTML llega del servidor con la hora real y el cliente
lo hidrata con la falsa: eso provoca un aviso de hidratación en consola que
**`auditar` ignora y te lo avisa**. No es del sitio.

El viewport CSS no es la resolución de la pantalla: el navegador se queda con
parte del alto, y en Windows el escalado al 150 % —lo normal en un Full HD de
14"— deja 1280 px CSS de ancho en un equipo de 1920. Por eso el perfil trae el
número útil ya calculado.

`auditar` tarda ~3 s y recarga la página recorriéndola entera. Guarda su salida:
es tu única autoridad sobre qué está realmente roto. **Léela fuera de personaje
y no la cites en el relato** — el visitante no ve errores de consola.

Con `--sin-recargar` audita la página tal como está en ese momento, con lo que
hayas abierto o tocado; a cambio pierde los sucesos de carga.

### 3. Recorrer

```bash
node $V ver                  # todo el texto visible, en orden de lectura
node $V ver --hasta=1700     # solo las dos primeras pantallas
```

Cada línea es `altura-en-el-documento  etiqueta [marcas] :: texto`, y una marca
señala el pliegue. Eso es lo que una persona escanea: **léelo de arriba abajo y
detente donde se detendría ella**, no leas la página entera antes de opinar.

Las marcas `[ACTIVO]`, `[ABIERTO]`, `[DESACTIVADO]` y el `href` de cada enlace
te dicen el estado de los controles. Lo que no aparece en `ver` es porque no se
ve: si un texto está tapado o recortado, para el visitante no existe.

**`[TOCABLE: etiqueta]` marca lo que esconde algo detrás.** Un control cuyo
contenido se dibuja en varias cajas aparece partido en líneas sueltas y no se
nota que es un botón; esa marca lo delata. **Tócalos antes de decir que un dato
falta** — un detalle plegado no es un dato ausente.

### 4. Tocar

Un visitante toca cosas. Ahora puedes:

```bash
node $V tocar "02:00"              # por texto exacto del control
node $V tocar "Ir a la imagen 2"   # o por su aria-label
node $V tocar "#contacto"          # o por selector CSS
node $V deslizar izq --sel='[data-slot="carousel"]'   # gesto de swipe
```

Cada orden imprime **qué cambió** en la página: `−` lo que desapareció, `+` lo
que apareció. Si dice "no cambió nada de lo visible", esa es exactamente la
experiencia de la persona: tocó y no pasó nada.

Toca lo que tocaría tu perfil, no todo. Y si un enlace lleva a otra página,
`abrir` esa ruta y sigue el recorrido ahí — si se cae, lo vives como un error,
no como una ruta pendiente.

Los enlaces externos (WhatsApp, Instagram, meteoblue) **no se abren**. Solo
comenta si el destino es claro y si el visitante se atrevería a tocarlo.

### 5. Mirar (con moderación)

El texto ya te dice qué dice la página. Usa capturas solo cuando la pregunta sea
**visual**: jerarquía, apretujamiento, si algo se ve pobre o roto.

```bash
node $V mirar --y=0 --nombre=llegada        # una pantalla concreta
node $V mirar --sel='#pronostico' --nombre=tarjeta   # una sección
node $V mirar --nombre=todo                 # la página entera
```

Dos o tres capturas por recorrido, no diez. Los archivos quedan en
`/mnt/c/Users/Public/astshots/`.

**No juzgues tamaños ni superposiciones desde una captura de sección.** `--sel`
recorta un trozo del documento, así que la barra fija y los popovers salen a una
escala y en una posición que nadie ve nunca así; por eso se ocultan, y si había
alguno abierto la orden te lo avisa. Para decir "esto tapa aquello" o "esto se
ve enorme" usa `--y`, que fotografía el viewport tal como está.

Y ojo: **con un popover abierto el sitio bloquea el scroll**, así que un `--y`
posterior sale mal encuadrado. Cierra la capa antes de capturar otra cosa.

### 6. Reportar

Formato de salida, en español, en este orden:

**Perfil** — el bloque del script, tal cual, **incluida la línea `Viewport`**:
quien lea el informe tiene que poder reproducirlo en el mismo ancho.

**Recorrido** — una entrada por momento, en primera persona y en presente: qué
ve, qué piensa, qué toca, qué pasa al tocarlo. Corto y concreto. Incluye lo que
se saltea sin leer. Marca el momento exacto donde el objetivo se cumple, o donde
se rompe la paciencia.

**Veredicto** — exactamente uno de estos tres, con una frase de justificación:
- `OBJETIVO CUMPLIDO` — consiguió lo que venía a buscar.
- `CUMPLIDO CON DIFICULTAD` — lo consiguió, pero con dudas, retrocesos o suerte.
- `ABANDONO` — se fue. Di en qué punto y qué fue lo último que intentó.

**Fricciones** — ordenadas de peor a menor. Cada una con: qué pasó, dónde, y la
cita textual de lo que pensó el visitante. Marca cada una como `[hecho]` si
`auditar` la confirma o `[percepción]` si no. Sin proponer solución todavía.

**Lo que sí funcionó** — dos o tres cosas, concretas. No es relleno: sirve para
no romperlas después.

**Notas para el desarrollador** *(fuera de personaje, al final, breve)* — aquí sí
puedes usar lo que sabes del proyecto y los hechos de `auditar`: qué fricción es
un bug real, cuál es una sección aún sin portar, y cuáles valdría la pena atacar
primero. Máximo cinco líneas. Sin escribir código.

Al terminar: `node $V cerrar`.

## Sesgos que debes mantener

- El visitante **no lee**: escanea. Si un dato clave (precio, duración, punto de
  encuentro, si hay que reservar) no aparece de un vistazo, para él no existe.
- Un visitante con astronomía nula **no entiende** "seeing", "EAA", "apertura",
  "arcsec". Dilo cuando pase, con sus palabras.
- Un aficionado avanzado sí entiende, y en cambio critica la falta de datos
  técnicos (apertura y focal de los equipos, bortle del lugar).
- Los placeholders visibles (`--:--`, `Seeing --`, botones apagados) leen como
  "el sitio está roto" o "esto está abandonado", nunca como "falta portarlo".
- Escribir por WhatsApp cuesta: el visitante lo evita si no sabe precio ni si
  habrá cupo. "Tener que preguntar" es fricción, no una conversión. Y cuesta
  más todavía cuando el anfitrión está a treinta metros: preguntarle en persona
  se siente más fácil que escribir, así que el sitio compite con eso.
- **No confundas "no está en la página" con "no lo sabe"**: la ubicación, el
  traslado y quiénes son ya los sabe (ver `contexto.md`). Lo que no sabe es si
  le corresponde, cuánto vale, cuánto dura y si se puede hoy mismo.
- **Evalúas el sitio, no el catálogo.** Que un servicio no sea para este
  visitante es segmentación deliberada, no una falta: cada servicio tiene su
  público y ninguno tiene que servirle a todos. Solo es fricción si el sitio le
  hace perder tiempo antes de que pueda darse cuenta. Del mismo modo, un detalle
  técnico que solo incomoda a quien nunca iba a contratar ese servicio no es
  fricción: pregúntate siempre si algún cliente real dejaría de tomarlo por eso.
- La competencia real por la noche es **la tinaja**, no otro tour. Cualquier
  duda sobre horarios o duración se resuelve a favor de la tinaja: ya está al
  lado de la cabaña y no hay que coordinarla con nadie.

## Cómo funciona por dentro

`visita.mjs` pilotea Edge por el protocolo de DevTools (`localhost:9222`), sin
dependencias: Node ya trae `WebSocket`. La pestaña queda viva entre órdenes, así
que `abrir` una vez y después `ver`/`tocar`/`mirar` operan sobre la misma página
con su estado acumulado.

El viewport de 390 px es real (`Emulation.setDeviceMetricsOverride`), no una
ventana recortada, así que un desborde horizontal que reporte `auditar` es
genuino. En móvil los toques son eventos táctiles de verdad, que es lo único que
reconocen el carrusel y los controles.

Si algo se comporta raro, `node $V cerrar --todo` mata el navegador y la
siguiente orden lo levanta limpio.

## Si cambias la UI de una sección

`ver` no depende del markup: agrupa el texto por **caja de layout**, no por una
lista de etiquetas. Rediseñar una sección —pasar de `<dl>/<dt>/<dd>` a divs y
spans, por ejemplo— no le hace perder contenido; como mucho cambia cómo agrupa
las líneas. Medido: sobre ese mismo rediseño, un lector basado en etiquetas
perdía 20 fragmentos ("Escala Bortle", "Atardece", "17:59"); este pierde 0.

Por si acaso, `auditar` incluye la línea **«texto en pantalla que ver no
recoge»**. Si algún día deja de ser 0, el lector se quedó atrás respecto del
sitio y hay que arreglarlo antes de fiarse de un recorrido: un visitante no
puede reportar como ausente algo que sí está en pantalla.

Lo que sí queda atado a la UI concreta son los **ejemplos** de este archivo:
`tocar "02:00"`, `--sel='#pronostico'`, `[data-slot="carousel"]`. Si renombras
un id o cambias las horas, esas órdenes fallan en voz alta ("no encontré nada
que tocar…", "no existe #pronostico") — nunca en silencio. Ajusta el ejemplo y
sigue; no hay nada más que tocar en el script.
