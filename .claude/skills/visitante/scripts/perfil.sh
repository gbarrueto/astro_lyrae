#!/usr/bin/env bash
# Genera un perfil de visitante al azar, dentro de los márgenes reales del
# negocio: el astroturismo se ofrece SOLO a huéspedes de Turismo Entre
# Cordilleras (ver ../contexto.md). Casi todos los visitantes ya arrendaron
# una cabaña o están evaluando arrendarla.
#
# Los rasgos NO son independientes: la etapa manda, y varios se derivan de ella
# o de rasgos ya sorteados. Sortearlos sueltos producía gente imposible —un
# huésped decidiendo si arrendar, alguien en el WiFi de la cabaña desde su casa,
# un objetivo sobre niños en un grupo sin niños—, y un recorrido que arranca de
# una persona que no puede existir no vale nada.
#
# El orden de este archivo es deliberado: cada bloque solo puede usar lo ya
# calculado más arriba.
# Uso: perfil.sh [semilla]
set -euo pipefail

SEED="${1:-$(shuf -i 100000-999999 -n 1)}"

# Elección determinista a partir de (semilla, ranura): pasar la misma semilla
# reproduce exactamente el mismo perfil, y cada ranura sortea independiente.
pick() {
  local slot="$1"; shift
  local opts=("$@")
  local h idx
  h=$(printf '%s' "$SEED-$slot" | md5sum | cut -c1-8)
  idx=$(( 16#$h % ${#opts[@]} ))
  printf '%s' "${opts[$idx]}"
}

NOMBRE=$(pick nombre \
  "Camila" "Rodrigo" "Fernanda" "Matías" "Paulina" "Ignacio" "Valentina" \
  "Héctor" "Josefa" "Diego" "Marcela" "Tomás" "Alejandra" "Óscar")

EDAD=$(pick edad "26" "31" "34" "38" "41" "45" "52" "58" "63" "23")

# ── Etapa: el eje del que cuelga casi todo lo demás ──────────────────────────
ETAPA=$(pick etapa \
  "HUÉSPED — Está alojando en la cabaña; el grupo todavía no define qué hacer de noche." \
  "HUÉSPED — Llegó hoy a la cabaña, recién instalándose, y ya mira qué hacer esta noche." \
  "HUÉSPED — Está en la cabaña; alguien del grupo tiró la idea y a él/ella le tocó averiguar." \
  "HUÉSPED — Está en la cabaña y anoche estuvo nublado; quiere saber si hoy cambia la cosa." \
  "RESERVADO — Ya reservó por Airbnb, viaja en dos semanas. Arma el itinerario desde su casa." \
  "RESERVADO — Ya reservó para el fin de semana largo y quiere dejar todo coordinado antes de llegar." \
  "EVALUANDO — Está pensando arrendar una cabaña; si el astroturismo se ve bueno, se decide." \
  "EVALUANDO — Compara TEC con otra cabaña más barata en la zona. Esto podría ser el desempate." \
  "EXTERNO — No tiene nada que ver con el complejo: vio el Instagram y quiere contratar el tour suelto." )

GRUPO="${ETAPA%% *}"

# ── Contacto con el complejo ─────────────────────────────────────────────────
# Quien ya arrendó conoce las condiciones de la cabaña, incluida la tinaja
# (ver contexto.md). El EXTERNO, por definición, no ha hablado con nadie.
case "$GRUPO" in
  HUÉSPED)   TEC="sí — conoce las condiciones de la cabaña y de la tinaja." ;;
  RESERVADO) TEC=$(pick tec \
                "sí — coordinó la reserva con el dueño y le explicaron las condiciones." \
                "sí — reservó por Airbnb y después escribió por WhatsApp para coordinar." ) ;;
  EVALUANDO) TEC=$(pick tec \
                "no — todavía no habla con nadie del complejo." \
                "no — solo miró el sitio de las cabañas por fuera." \
                "sí — escribió preguntando disponibilidad y le contaron lo básico." ) ;;
  *)         TEC="no — no ha hablado con nadie del complejo; ni sabe que hay que alojar ahí." ;;
esac
CON_TEC=$([ "${TEC:0:2}" = "sí" ] && echo 1 || echo 0)

# ── Cómo llegó: el canal tiene que existir para su etapa ─────────────────────
# "Al momento de la llegada", "el living de la cabaña" o "el mensaje de
# bienvenida" solo existen si ya hay una reserva.
case "$GRUPO" in
  HUÉSPED)
    QUIEN=$(pick quien \
      "El anfitrión se lo mencionó en persona al momento de la llegada y le pasó el link por WhatsApp." \
      "Le llegó en el mensaje de bienvenida junto con las instrucciones de la cabaña." \
      "Vio un folleto con QR sobre la mesa del living de la cabaña. Nadie le explicó nada." \
      "Se lo contó otro huésped del complejo que lo hizo anoche." \
      "Lo encontró solo, en el sitio del complejo, entre los servicios.")
    ;;
  RESERVADO)
    QUIEN=$(pick quien \
      "Le llegó en el mensaje de bienvenida junto con las instrucciones de la cabaña." \
      "Lo encontró solo, en el sitio del complejo, entre los servicios." \
      "Lo vio en el Instagram de Turismo Entre Cordilleras mientras miraba fotos del lugar." \
      "Se lo contó un conocido que estuvo allá y lo hizo.")
    ;;
  EVALUANDO)
    QUIEN=$(pick quien \
      "Lo encontró solo, en el sitio del complejo, entre los servicios." \
      "Lo vio en el Instagram de Turismo Entre Cordilleras mientras miraba fotos del lugar." \
      "Se lo contó un conocido que estuvo allá y lo hizo." \
      "Vio una publicación de @astro.lyrae y entró por el link de la bio.")
    ;;
  *)
    QUIEN=$(pick quien \
      "Vio una publicación de @astro.lyrae y entró por el link de la bio." \
      "Lo vio en el Instagram de Turismo Entre Cordilleras y le llamó la atención el telescopio." \
      "Se lo contó un conocido que estuvo allá y lo hizo.")
    ;;
esac

# ── Con quién viaja: tiene que caber en la biografía ─────────────────────────
MADRE=$(( EDAD + $(pick offsetmadre 24 26 27 29 31) ))
COMPANIA_OPTS=(
  "Viene en pareja, escapada de fin de semana."
  "Viene en pareja, es el cumpleaños de su acompañante y quiere sorprenderlo/a."
  "Cabaña familiar: cinco adultos, grupo de amigos."
)
[ "$EDAD" -ge 30 ] && COMPANIA_OPTS+=("Cabaña familiar: viene con su pareja y dos niños (6 y 9 años).")
[ "$EDAD" -ge 38 ] && COMPANIA_OPTS+=("Familia con un adolescente de 15 al que 'nada le gusta'.")
[ "$EDAD" -ge 38 ] && COMPANIA_OPTS+=("Cabaña familiar: tres generaciones, incluida su mamá de $MADRE que se acuesta temprano.")
COMPANIA=$(pick compania "${COMPANIA_OPTS[@]}")
# Quien todavía no arrendó no tiene "cabaña familiar": tiene un grupo con el que
# viajaría.
case "$GRUPO" in
  HUÉSPED|RESERVADO) : ;;
  *) COMPANIA="${COMPANIA/Cabaña familiar:/Viajaría con}" ;;
esac

case "$COMPANIA" in
  *"niños (6 y 9"*) NINOS=1 ;;
  *) NINOS=0 ;;
esac

# ── Objetivo: lo que define el recorrido entero ──────────────────────────────
# Depende de la etapa (quien ya arrendó no decide si arrendar) y de con quién
# viaja (no se pregunta por niños quien viaja sin niños).
case "$GRUPO" in
  HUÉSPED)
    OBJETIVO_OPTS=(
      "Comparar los tres servicios y elegir uno."
      "Saber cuánto cuesta antes de entusiasmar a nadie."
      "Averiguar si se puede hacer ESTA noche o hay que avisar con anticipación."
      "Saber si va a estar despejado la noche que le queda."
      "Entender qué es exactamente esto: le hablaron de 'astroturismo' y no le quedó claro."
    )
    ;;
  RESERVADO)
    OBJETIVO_OPTS=(
      "Comparar los tres servicios y elegir uno."
      "Saber cuánto cuesta antes de entusiasmar a nadie."
      "Averiguar con cuánta anticipación hay que avisar, para dejarlo coordinado."
      "Entender cómo sabrá, estando allá, si la noche va a estar despejada."
      "Entender qué es exactamente esto: le hablaron de 'astroturismo' y no le quedó claro."
    )
    ;;
  *)
    OBJETIVO_OPTS=(
      "Comparar los tres servicios y elegir uno."
      "Saber cuánto cuesta antes de entusiasmar a nadie."
      "Decidir si esto justifica arrendar acá y no en otro lado."
      "Entender qué es exactamente esto: le hablaron de 'astroturismo' y no le quedó claro."
    )
    ;;
esac
[ "$NINOS" = 1 ] && OBJETIVO_OPTS+=("Ver si vale la pena yendo con niños chicos.")
# La tinaja solo está en la cabeza de quien ya habló con el complejo.
[ "$CON_TEC" = 1 ] && [ "$GRUPO" != EXTERNO ] && \
  OBJETIVO_OPTS+=("Confirmar que alcanza a hacer esto y además la tinaja.")
OBJETIVO=$(pick objetivo "${OBJETIVO_OPTS[@]}")

# ── Supuesto sobre el precio ─────────────────────────────────────────────────
COSTO_OPTS=(
  "Asume que es un extra pagado y quiere el precio antes de escribirle a nadie."
  "No tiene idea de si se paga aparte, y esa duda sola le da vergüenza preguntar."
  "Le da lo mismo el precio si la experiencia se ve buena, pero igual quiere saberlo antes."
)
# "Lo que ya pagó" solo existe si hay una reserva hecha.
case "$GRUPO" in
  HUÉSPED|RESERVADO)
    COSTO_OPTS+=("Asume que viene incluido en lo que ya pagó por la cabaña. Si descubre que es aparte, quiere saber cuánto YA.") ;;
  EVALUANDO)
    COSTO_OPTS+=("Asume que iría incluido en la tarifa de la cabaña que está cotizando.") ;;
esac
# Nadie le dijo un valor de palabra si nunca habló con el complejo.
[ "$CON_TEC" = 1 ] && COSTO_OPTS+=("El anfitrión le dijo un valor de palabra y viene a verificarlo en la página.")
COSTO=$(pick costo "${COSTO_OPTS[@]}")

# ── Cuántas noches tiene por delante ─────────────────────────────────────────
case "$GRUPO" in
  HUÉSPED)
    MARGEN=$(pick margen \
      "Le queda solo esta noche: se va mañana temprano y no hay segunda oportunidad." \
      "Le quedan dos noches: puede elegir la mejor, pero necesita saber cuál." \
      "Le quedan tres noches, sin apuro real." \
      "Está una semana: hoy solo curiosea, decide después.")
    ;;
  RESERVADO)
    MARGEN=$(pick margen \
      "Va a estar dos noches; quiere dejar una reservada desde ya." \
      "Va a estar tres noches y quiere saber si conviene decidir allá o antes." \
      "Va a estar una sola noche: o resulta esa, o no resulta.")
    ;;
  EVALUANDO)
    MARGEN=$(pick margen \
      "Todavía no tiene fechas; está viendo cuántas noches le convendría quedarse." \
      "Tiene dos noches en mente para el viaje que está armando." \
      "Piensa en un fin de semana largo, tres noches.")
    ;;
  *)
    MARGEN=$(pick margen \
      "No piensa alojarse: quiere ir una noche, hacer el tour y volverse." \
      "Anda por la zona unos días y quiere encajar esto en alguna noche." \
      "Todavía no tiene fecha; primero quiere saber si se puede contratar suelto.")
    ;;
esac
case "$MARGEN" in
  *"solo esta noche"*) SIN_MANANA=1 ;;
  *) SIN_MANANA=0 ;;
esac

ASTRO=$(pick astro \
  "Nulo. Sabe que existen las constelaciones y poco más. 'Seeing', 'apertura' o 'EAA' no le dicen nada." \
  "Nulo. Sabe que existen las constelaciones y poco más. 'Seeing', 'apertura' o 'EAA' no le dicen nada." \
  "Nulo. Sabe que existen las constelaciones y poco más. 'Seeing', 'apertura' o 'EAA' no le dicen nada." \
  "Nulo. Sabe que existen las constelaciones y poco más. 'Seeing', 'apertura' o 'EAA' no le dicen nada." \
  "Nulo, pero curioso. Reconoce la Cruz del Sur. Asume que 'telescopio' = 'ver Saturno'." \
  "Nulo, pero curioso. Reconoce la Cruz del Sur. Asume que 'telescopio' = 'ver Saturno'." \
  "Nulo, pero curioso. Reconoce la Cruz del Sur. Asume que 'telescopio' = 'ver Saturno'." \
  "Nulo pero escéptico: cree que puede ser puro relleno turístico y busca señales de seriedad." \
  "Nulo pero escéptico: cree que puede ser puro relleno turístico y busca señales de seriedad." \
  "Nulo pero escéptico: cree que puede ser puro relleno turístico y busca señales de seriedad." \
  "Básico. Ha visto videos de astronomía, sabe qué es una nebulosa, nunca miró por un telescopio." \
  "Básico. Ha visto videos de astronomía, sabe qué es una nebulosa, nunca miró por un telescopio." \
  "Aficionado. Tiene binoculares o un telescopio chico; entiende 'apertura' y 'distancia focal'." \
  "Aficionado avanzado. Hace astrofotografía amateur, sabe qué es el seeing en arcsec y juzga los datos técnicos con dureza.")

# ── Dispositivo: el tamaño va aparte de dónde está conectado ─────────────────
# El viewport CSS no es la resolución de la pantalla: el navegador se queda con
# parte del alto, y en Windows el escalado al 150 % —lo normal en un 1920×1080
# de 14"— divide los píxeles CSS por 1,5.
DISPOSITIVO=$(pick dispositivo \
  "Celular gama media (360×800), en vertical|360|800" \
  "Celular Android grande (412×915), en vertical|412|915" \
  "iPhone (390×844), en vertical|390|844" \
  "Celular gama media (360×800), en vertical|360|800" \
  "iPhone (390×844), en vertical|390|844" \
  "Notebook Full HD (1920×1080); el navegador deja 1920×969 útiles|1920|969" \
  "Notebook Full HD de 14\" con Windows al 150 % de escala: navega a 1280×646 px CSS|1280|646" \
  "Notebook antiguo de 1366×768; el navegador deja 1366×657 útiles|1366|657")

VIEWPORT_W="${DISPOSITIVO#*|}"; VIEWPORT_W="${VIEWPORT_W%|*}"
VIEWPORT_H="${DISPOSITIVO##*|}"
DISPOSITIVO="${DISPOSITIVO%%|*}"

# Dónde está sentado: en la cabaña solo puede estar el huésped, y la señal móvil
# irregular solo le pasa a quien anda con el teléfono.
MOVIL=$([ "$VIEWPORT_W" -lt 700 ] && echo 1 || echo 0)
case "$GRUPO:$MOVIL" in
  HUÉSPED:1)
    DONDE=$(pick donde \
      ", conectado al WiFi de la cabaña." \
      ", con señal móvil irregular en el sector." \
      ", de pie en la terraza, mirando el cielo cada tanto." \
      ", pasándoselo a su acompañante cada dos por tres.")
    ;;
  HUÉSPED:0)
    DONDE=$(pick donde \
      ", en la mesa del comedor de la cabaña." \
      ", sobre las piernas, con el WiFi de la cabaña.")
    ;;
  *:1)
    DONDE=$(pick donde \
      ", en el sillón después de comer." \
      ", en el metro, a ratos." \
      ", en la cama antes de dormir.")
    ;;
  *)
    DONDE=$(pick donde \
      ", desde su casa." \
      ", en la oficina, entre una cosa y otra." \
      ", en la mesa del comedor de su casa.")
    ;;
esac
DISPOSITIVO="$DISPOSITIVO$DONDE"

# ── Momento del día ──────────────────────────────────────────────────────────
MOMENTO_OPTS=(
  "16:00 de la tarde, con tiempo, planificando la noche."
  "13:30, almorzando, revisando rápido entre otras cosas."
  "11:00 de la mañana de un día nublado, dudando."
)
# "Decide si mañana" no existe para quien se va mañana temprano.
[ "$SIN_MANANA" = 0 ] && MOMENTO_OPTS+=("22:15, después de comer, decidiendo si mañana hace esto.")
[ "$SIN_MANANA" = 0 ] && MOMENTO_OPTS+=("00:30, no puede dormir, curioseando sin apuro.")
# La urgencia de "decidir en minutos" solo aplica a quien puede salir hoy.
if [ "$GRUPO" = HUÉSPED ]; then
  MOMENTO_OPTS+=("19:30, ya oscureciendo. Si sale hoy, tiene que decidir en minutos.")
else
  MOMENTO_OPTS+=("19:30, ya oscureciendo, con el día resuelto.")
fi
MOMENTO=$(pick momento "${MOMENTO_OPTS[@]}")

# ── Temperamento ─────────────────────────────────────────────────────────────
TEMPERAMENTO_OPTS=(
  "Impaciente: escanea, no lee. Si no entiende en 15 segundos, se va."
  "Metódico: lee todo de arriba a abajo antes de hacer clic en nada."
  "Explorador: hace clic en todo lo que parezca clickeable."
  "Desconfiado: busca precios, nombres, pruebas de que esto es real."
  "Práctico: solo quiere el dato concreto (precio, hora, duración, cómo se pide)."
)
# El escéptico que busca pruebas no es el que se emociona rápido ni el que no lee.
case "$ASTRO" in
  *escéptico*) : ;;
  *) TEMPERAMENTO_OPTS+=("Entusiasta: se emociona rápido y se frustra igual de rápido.")
     TEMPERAMENTO_OPTS+=("Delegador: no quiere leer, quiere que alguien le diga qué hacer.") ;;
esac
TEMPERAMENTO=$(pick temperamento "${TEMPERAMENTO_OPTS[@]}")

# ── Qué tiene esa noche ──────────────────────────────────────────────────────
# El horario propio del grupo, derivado de con quién viaja.
case "$COMPANIA" in
  *"niños (6 y 9"*) HORARIO="Los niños se duermen a las 21:30 y eso le acota todo." ;;
  *"mamá de"*)      HORARIO="Su mamá se acuesta temprano y no la va a dejar sola despierta." ;;
  *)                HORARIO="Al otro día tienen actividad temprano, así que no puede trasnochar." ;;
esac

case "$GRUPO" in
  HUÉSPED|RESERVADO)
    NOCHE_OPTS=(
      "No tiene nada planificado para la noche, por eso está mirando."
      "$HORARIO"
      "Piensa en esto como el panorama principal de la estadía, no como un extra."
    )
    # La tinaja solo aparece si sabe que existe y cómo funciona.
    [ "$CON_TEC" = 1 ] && NOCHE_OPTS+=(
      "Tiene la tinaja pedida a una hora y quiere saber cuánto dura esto para calzarlo."
      "Quiere hacer las dos: la fantasía es tinaja y estrellas la misma noche."
    )
    ;;
  *)
    NOCHE_OPTS=(
      "Se imagina la noche como el argumento para convencer a quienes vienen con él/ella."
      "Nunca ha hecho nada así y no tiene idea de cómo se organiza una noche de estas."
      "Le preocupa que sea una actividad larga y termine siendo un compromiso."
      "Piensa en esto como el panorama principal del viaje, no como un extra."
    )
    [ "$NINOS" = 1 ] && NOCHE_OPTS+=("Viaja con niños y toda actividad nocturna le parece complicada de entrada.")
    ;;
esac
NOCHE=$(pick noche "${NOCHE_OPTS[@]}")

cat <<EOF
PERFIL DEL VISITANTE  (semilla: $SEED)

Nombre        : $NOMBRE, $EDAD años
Etapa         : $ETAPA
Habló con TEC : $TEC
Cómo se enteró: $QUIEN
Objetivo      : $OBJETIVO
Sobre el costo: $COSTO
Margen        : $MARGEN
Astronomía    : $ASTRO
Dispositivo   : $DISPOSITIVO
Viewport      : ${VIEWPORT_W}×${VIEWPORT_H}   → node visita.mjs abrir / --ancho=$VIEWPORT_W --alto=$VIEWPORT_H
Momento       : $MOMENTO
Temperamento  : $TEMPERAMENTO
Compañía      : $COMPANIA
Esa noche     : $NOCHE
EOF
