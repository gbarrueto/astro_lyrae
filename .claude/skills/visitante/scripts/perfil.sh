#!/usr/bin/env bash
# Genera un perfil de visitante al azar, dentro de los márgenes reales del
# negocio: el astroturismo se ofrece SOLO a huéspedes de Turismo Entre
# Cordilleras (ver ../contexto.md). Casi todos los visitantes ya arrendaron
# una cabaña o están evaluando arrendarla.
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

# Etapa respecto del arriendo. Es el eje principal: define si el visitante es
# un huésped (puede contratar) o alguien que ni siquiera es elegible todavía.
# El caso "ya arrendó y está en la cabaña" pesa más porque es el real.
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

# El margen de noches solo tiene sentido para quien ya está (o ya va) al
# complejo. Se sortea de una tabla distinta según la etapa para que el perfil
# no se contradiga solo.
GRUPO="${ETAPA%% *}"

QUIEN=$(pick quien \
  "El anfitrión se lo mencionó en persona al momento de la llegada y le pasó el link por WhatsApp." \
  "Le llegó en el mensaje de bienvenida junto con las instrucciones de la cabaña." \
  "Vio un folleto con QR sobre la mesa del living de la cabaña. Nadie le explicó nada." \
  "Lo vio en el Instagram de Turismo Entre Cordilleras mientras miraba fotos del lugar." \
  "Se lo contó otro huésped del complejo que lo hizo anoche." \
  "Lo encontró solo, en el sitio del complejo, entre los servicios." \
  "Vio una publicación de @astro.lyrae y entró por el link de la bio.")

OBJETIVO=$(pick objetivo \
  "Comparar los tres servicios y elegir uno." \
  "Saber cuánto cuesta antes de entusiasmar a nadie." \
  "Averiguar si se puede hacer ESTA noche o hay que avisar con anticipación." \
  "Saber si va a estar despejado la noche que le queda." \
  "Ver si vale la pena yendo con niños chicos." \
  "Confirmar que alcanza a hacer esto y además la tinaja." \
  "Decidir si esto justifica arrendar acá y no en otro lado." \
  "Ver si puede tomar fotos del cielo, o si se las toman." \
  "Entender qué es exactamente esto: le hablaron de 'astroturismo' y no le quedó claro.")

# El supuesto sobre el precio: la duda más cara del sitio hoy.
COSTO=$(pick costo \
  "Asume que viene incluido en lo que ya pagó por la cabaña. Si descubre que es aparte, quiere saber cuánto YA." \
  "Asume que es un extra pagado y quiere el precio antes de escribirle a nadie." \
  "No tiene idea de si se paga aparte, y esa duda sola le da vergüenza preguntar." \
  "El anfitrión le dijo un valor de palabra y viene a verificarlo en la página." \
  "Le da lo mismo el precio si la experiencia se ve buena, pero igual quiere saberlo antes.")

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
  *)
    MARGEN=$(pick margen \
      "Todavía no tiene fechas; está viendo cuántas noches le convendría quedarse." \
      "Tiene dos noches en mente para el viaje que está armando." \
      "Piensa en un fin de semana largo, tres noches.")
    ;;
esac

ASTRO=$(pick astro \
  "Nulo. Sabe que existen las constelaciones y poco más. 'Seeing', 'apertura' o 'EAA' no le dicen nada." \
  "Nulo, pero curioso. Reconoce la Cruz del Sur. Asume que 'telescopio' = 'ver Saturno'." \
  "Básico. Ha visto videos de astronomía, sabe qué es una nebulosa, nunca miró por un telescopio." \
  "Aficionado. Tiene binoculares o un telescopio chico; entiende 'apertura' y 'distancia focal'." \
  "Aficionado avanzado. Hace astrofotografía amateur, sabe qué es el seeing en arcsec y juzga los datos técnicos con dureza." \
  "Nulo pero escéptico: cree que puede ser puro relleno turístico y busca señales de seriedad.")

DISPOSITIVO=$(pick dispositivo \
  "Celular, en vertical, conectado al WiFi de la cabaña." \
  "Celular, en vertical, con señal móvil irregular en el sector." \
  "Celular, en vertical, con una mano mientras hace otra cosa." \
  "Celular, en vertical, pantalla chica y brillo al mínimo." \
  "Celular, en vertical, pasándoselo a su acompañante cada dos por tres." \
  "Notebook, navegador de escritorio, en la mesa del comedor.")

MOMENTO=$(pick momento \
  "19:30, ya oscureciendo. Si sale hoy, tiene que decidir en minutos." \
  "22:15, después de comer, decidiendo si mañana hace esto." \
  "16:00 de la tarde, con tiempo, planificando la noche." \
  "13:30, almorzando, revisando rápido entre otras cosas." \
  "11:00 de la mañana de un día nublado, dudando." \
  "00:30, no puede dormir, curioseando sin apuro.")

TEMPERAMENTO=$(pick temperamento \
  "Impaciente: escanea, no lee. Si no entiende en 15 segundos, se va." \
  "Metódico: lee todo de arriba a abajo antes de hacer clic en nada." \
  "Explorador: hace clic en todo lo que parezca clickeable." \
  "Desconfiado: busca precios, nombres, pruebas de que esto es real." \
  "Entusiasta: se emociona rápido y se frustra igual de rápido." \
  "Práctico: solo quiere el dato concreto (precio, hora, duración, cómo se pide)." \
  "Delegador: no quiere leer, quiere que alguien le diga qué hacer.")

COMPANIA=$(pick compania \
  "Cabaña familiar: viene con su pareja y dos niños (6 y 9 años)." \
  "Cabaña familiar: cinco adultos, grupo de amigos." \
  "Cabaña familiar: tres generaciones, incluida su mamá de 72 que se acuesta temprano." \
  "Viene en pareja, escapada de fin de semana." \
  "Viene en pareja, es el cumpleaños de su acompañante y quiere sorprenderlo/a." \
  "Familia con un adolescente de 15 al que 'nada le gusta'.")

# La competencia real por la noche del huésped es la tinaja (ver contexto.md).
case "$GRUPO" in
  HUÉSPED|RESERVADO)
    NOCHE=$(pick noche \
      "Ya cuenta con la tinaja para esa noche y no sabe si las dos cosas se pisan." \
      "Está eligiendo entre la tinaja y esto; con el ánimo del grupo, alcanza para una sola." \
      "Quiere hacer las dos: la fantasía es tinaja y estrellas la misma noche." \
      "No tiene nada planificado para la noche, por eso está mirando." \
      "Los niños se duermen a las 21:30 y eso le acota todo." \
      "Al otro día tienen actividad temprano, así que no puede trasnochar.")
    ;;
  *)
    NOCHE=$(pick noche \
      "Se imagina la noche como el argumento para convencer al resto del grupo." \
      "Si esto no se ve bueno, la noche la resuelve con la tinaja y listo." \
      "Nunca ha hecho nada así y no tiene idea de cómo se organiza una noche de estas." \
      "Le preocupa que sea una actividad larga y termine siendo un compromiso." \
      "Viaja con niños y toda actividad nocturna le parece complicada de entrada." \
      "Piensa en esto como el panorama principal del viaje, no como un extra.")
    ;;
esac

cat <<EOF
PERFIL DEL VISITANTE  (semilla: $SEED)

Nombre        : $NOMBRE, $EDAD años
Etapa         : $ETAPA
Cómo se enteró: $QUIEN
Objetivo      : $OBJETIVO
Sobre el costo: $COSTO
Margen        : $MARGEN
Astronomía    : $ASTRO
Dispositivo   : $DISPOSITIVO
Momento       : $MOMENTO
Temperamento  : $TEMPERAMENTO
Compañía      : $COMPANIA
Esa noche     : $NOCHE
EOF
