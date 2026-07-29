#!/usr/bin/env bash
# Captura el sitio como una secuencia de "pantallazos" tal como los vería una
# persona haciendo scroll en su teléfono.
#
# Uso: screens.sh <nombre> [ruta] [ancho] [alto]
#   nombre : prefijo de los archivos (ej. "visita1")
#   ruta   : ruta del sitio, por defecto "/"
#   ancho  : ancho CSS del viewport, por defecto 390 (iPhone 14)
#   alto   : alto CSS del viewport, por defecto 844
#
# Imprime las rutas WSL de los PNG generados, uno por línea, en orden de scroll.
#
# Por qué tanto rodeo: Edge en Windows impone un ancho mínimo de ventana, así
# que --window-size=390 NO produce un viewport de 390px (produce ~496px y luego
# recorta el PNG, lo que se ve igual que un desbordamiento horizontal real).
# La solución es cargar el sitio dentro de un <iframe> del ancho exacto, que sí
# establece su propio viewport. El iframe se sirve DESDE el dev server para que
# sea mismo-origen y podamos hacerle scroll y medir su altura por JS.
set -euo pipefail

NAME="${1:-visita}"
PATH_="${2:-/}"
W="${3:-390}"
H="${4:-844}"
ORIGIN="${ORIGIN:-http://localhost:4321}"

EDGE="/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
[ -x "$EDGE" ] || { echo "No se encontró Edge en $EDGE" >&2; exit 1; }

# El proyecto es el cwd; el wrapper va en public/ para que lo sirva Astro.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
FRAMEDIR="$ROOT/public/__visita_tmp__"
OUTWSL="/mnt/c/Users/Public/astshots"
OUTWIN='C:\Users\Public\astshots'
mkdir -p "$FRAMEDIR" "$OUTWSL"
trap 'rm -rf "$FRAMEDIR"' EXIT

cat > "$FRAMEDIR/frame.html" <<HTML
<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;background:#1b1b1f;font:12px system-ui;color:#666}
  iframe{width:${W}px;height:${H}px;border:0;display:block;background:#000}
</style>
<iframe id="f"></iframe>
<script>
  var q = new URLSearchParams(location.search);
  var y = +(q.get('y') || 0);
  var f = document.getElementById('f');
  f.src = q.get('u') || '/';
  f.onload = function () {
    var d = f.contentDocument;
    // El sitio usa scroll-behavior:smooth; con tiempo virtual eso deja el
    // scroll a medio camino. Lo desactivamos dentro del iframe.
    d.documentElement.style.scrollBehavior = 'auto';
    // La barra del dev toolbar de Astro no existe para un visitante real.
    var s = d.createElement('style');
    s.textContent = 'astro-dev-toolbar{display:none !important}';
    d.head.appendChild(s);
    // Se re-aplica varias veces: el documento crece mientras cargan las
    // imágenes y se hidratan las islas, y un scroll temprano queda corto.
    var n = 0;
    var t = setInterval(function () {
      f.contentWindow.scrollTo(0, y);
      // La altura total se publica en el <title> para leerla con --dump-dom.
      document.title = 'H=' + d.documentElement.scrollHeight +
                       ' W=' + f.contentWindow.innerWidth +
                       ' SW=' + d.documentElement.scrollWidth +
                       ' Y=' + Math.round(f.contentWindow.scrollY);
      if (++n > 12) clearInterval(t);
    }, 250);
  };
</script>
HTML

frame_url() { echo "$ORIGIN/__visita_tmp__/frame.html?u=$(printf '%s' "$PATH_" | sed 's/&/%26/g')&y=$1"; }

run_edge() { # run_edge <profile-tag> <extra-args...>
  local tag="$1"; shift
  "$EDGE" --headless --disable-gpu --hide-scrollbars \
    --user-data-dir="C:\\Users\\Public\\astshots\\profile-$tag-$$" \
    --window-size="$((W + 160)),$H" \
    --virtual-time-budget=9000 "$@" 2>/dev/null || true
}

# 1) Sonda: medir la altura real del documento.
DOM=$(run_edge probe --dump-dom "$(frame_url 0)")
META=$(printf '%s' "$DOM" | grep -o 'H=[0-9]* W=[0-9]* SW=[0-9]* Y=[0-9]*' | head -1 || true)
DOCH=$(printf '%s' "$META" | sed -n 's/.*H=\([0-9]*\).*/\1/p')
VPW=$(printf '%s' "$META" | sed -n 's/.*W=\([0-9]*\).*/\1/p')
SCW=$(printf '%s' "$META" | sed -n 's/.*SW=\([0-9]*\).*/\1/p')
: "${DOCH:=$((H * 6))}"

echo "# viewport=${VPW:-?}px  scrollWidth=${SCW:-?}px  documento=${DOCH}px" >&2
if [ -n "${VPW:-}" ] && [ "$VPW" != "$W" ]; then
  echo "# AVISO: el viewport medido (${VPW}) no coincide con el pedido (${W}); no confíes en las capturas." >&2
fi
if [ -n "${SCW:-}" ] && [ -n "${VPW:-}" ] && [ "$SCW" -gt "$VPW" ]; then
  echo "# AVISO: desbordamiento horizontal REAL (scrollWidth ${SCW} > viewport ${VPW})." >&2
fi

# 2) Un pantallazo por cada "scroll" del visitante (con ~12% de solapamiento).
STEP=$((H * 88 / 100))
N=$(( (DOCH - H + STEP - 1) / STEP + 1 ))
[ "$N" -lt 1 ] && N=1
[ "$N" -gt 12 ] && N=12

rm -f "$OUTWSL/$NAME"-*.png
i=0
while [ "$i" -lt "$N" ]; do
  Y=$((i * STEP))
  [ "$Y" -gt $((DOCH - H)) ] && Y=$(( DOCH - H < 0 ? 0 : DOCH - H ))
  FILE=$(printf '%s-%02d.png' "$NAME" "$((i + 1))")
  run_edge "shot$i" --screenshot="$OUTWIN\\$FILE" "$(frame_url "$Y")"
  if [ -f "$OUTWSL/$FILE" ]; then
    echo "$OUTWSL/$FILE"
  else
    echo "# falló la captura en y=$Y" >&2
  fi
  i=$((i + 1))
done

rm -rf "$OUTWSL"/profile-*-$$ 2>/dev/null || true
