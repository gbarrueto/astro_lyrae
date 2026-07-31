# Iconos de cielo para la barra superior

Cómo se decide qué dibujo mostrar según la hora y el clima, qué dibujos hacen
falta, y qué tiene que cumplir cada uno.

---

## 1. La decisión de fondo: capas, no combinaciones

Si cada situación tuviera su propio dibujo, habría que dibujar cientos: ocho
fases de luna × cuatro niveles de nubes × tres tipos de precipitación, más el
día, más las noches sin luna. Inviable.

En vez de eso el icono se **compone en capas**, de atrás hacia adelante:

```
   [ halo ]        solo si el cuerpo queda tapado y brilla fuerte
   [ cuerpo ]      sol · una de las 8 fases de luna · estrellas
   [ nubes ]       ligera · media · densa   (ninguna si está despejado)
   [ lluvia ]      lluvia · nieve           (ninguna si no precipita)
```

Con eso, **16 dibujos cubren todos los escenarios**. Cada capa se dibuja una
sola vez y el código las apila.

---

## 2. Variables que entran en la decisión

| Variable | De dónde sale | Valores |
|---|---|---|
| Instante actual | reloj del visitante | — |
| Salida y puesta de sol | `sky[].sunrise` / `sunset` | instante |
| Crepúsculo civil | `sky[].dawnStart` / `duskEnd` | instante |
| Salida y puesta de luna | `sky[].moonrise` / `moonset` | instante o `null` |
| Fase lunar | `sky[].moonPhase` | 0–1 (0 nueva, 0,5 llena) |
| Iluminación lunar | `sky[].moonIllumination` | 0–100 % |
| Nubosidad | `series[].clouds.code` | 1–9 (7Timer) |
| Precipitación | `series[].precipitation` | `null` · `rain` · `snow` |

Todo viene resuelto en `src/data/forecast.json`, que se regenera una vez al
día. El navegador no calcula efemérides ni consulta nada: solo compara marcas
de tiempo y elige el punto de la serie más cercano a la hora actual.

### Momento del día

| Momento | Condición | Cuerpo que se dibuja |
|---|---|---|
| Día | entre `sunrise` y `sunset` | sol |
| Crepúsculo | entre `sunset` y `duskEnd`, o entre `dawnStart` y `sunrise` | sol |
| Noche | el resto | luna si está sobre el horizonte; si no, estrellas |

### Nubosidad — de la escala 1–9 a cuatro niveles

| Nivel | Código 7Timer | Cobertura | Capa de nubes |
|---|---|---|---|
| Despejado | 1–2 | 0–19 % | ninguna |
| Pocas nubes | 3–4 | 19–44 % | `clouds-light` |
| Parcial | 5–6 | 44–69 % | `clouds-medium` |
| Cubierto | 7–9 | 69–100 % | `clouds-heavy` |

Con **cubierto**, el cuerpo celeste queda **detrás** de la nube y prácticamente
no se ve. Ahí entra el halo.

### Halo

Se activa cuando hay nubes densas **y** el cuerpo detrás brilla fuerte: el sol
siempre, la luna cuando su iluminación supera el 60 %. Es el caso que
describiste: luna llena con cielo cubierto se ve como una nube con luz por
dentro.

### Precipitación

Se dibuja encima de las nubes. `rain` y `snow` vienen de 7Timer y solo aparecen
si además hay nubes de nivel parcial o cubierto — llover con cielo despejado no
tiene sentido y, si el modelo lo reporta, se ignora.

---

## 3. Dibujos necesarios

Van en `src/assets/sky/`. Hoy están todos como **placeholders geométricos**:
reemplazar el archivo por el dibujo definitivo, con el mismo nombre, es todo lo
que hay que hacer para que aparezca en el sitio.

### Cuerpos celestes (10)

| Archivo | Qué es | Estado |
|---|---|---|
| `sun.svg` | El sol | placeholder |
| `moon-new.svg` | Luna nueva | placeholder |
| `moon-waxing-crescent.svg` | Creciente | placeholder |
| `moon-first-quarter.svg` | Cuarto creciente (50 % iluminada) | placeholder |
| `moon-waxing-gibbous.svg` | Gibosa creciente | placeholder |
| `moon-full.svg` | Luna llena | placeholder |
| `moon-waning-gibbous.svg` | Gibosa menguante | placeholder |
| `moon-last-quarter.svg` | Cuarto menguante | placeholder |
| `moon-waning-crescent.svg` | Menguante | placeholder |
| `stars.svg` | Noche sin luna: estrellas sueltas | placeholder |

### Nubes (3)

| Archivo | Cobertura que representa | Estado |
|---|---|---|
| `clouds-light.svg` | 19–44 %: una nube chica, deja ver el cuerpo | placeholder |
| `clouds-medium.svg` | 44–69 %: tapa como media mitad | placeholder |
| `clouds-heavy.svg` | 69–100 %: cubre casi todo | placeholder |

### Precipitación y efectos (3)

| Archivo | Qué es | Estado |
|---|---|---|
| `rain.svg` | Gotas bajo la nube | placeholder |
| `snow.svg` | Copos bajo la nube | placeholder |
| `glow.svg` | Resplandor detrás de nube densa | placeholder |

---

## 4. Escenarios

Los casos que efectivamente se van a ver, con las capas que arma cada uno.

### De día

| Situación | Capas |
|---|---|
| Despejado | `sun` |
| Pocas nubes | `sun` + `clouds-light` |
| Parcialmente nublado | `sun` + `clouds-medium` |
| Cubierto | `glow` + `sun` + `clouds-heavy` |
| Cubierto con lluvia | `glow` + `sun` + `clouds-heavy` + `rain` |
| Cubierto con nieve | `glow` + `sun` + `clouds-heavy` + `snow` |

### De noche, con la luna sobre el horizonte

| Situación | Capas |
|---|---|
| Despejado | `moon-<fase>` |
| Pocas nubes | `moon-<fase>` + `clouds-light` |
| Parcialmente nublado | `moon-<fase>` + `clouds-medium` |
| Cubierto, luna tenue (≤60 %) | `moon-<fase>` + `clouds-heavy` |
| Cubierto, luna brillante (>60 %) | `glow` + `moon-<fase>` + `clouds-heavy` |
| Cubierto con lluvia | lo anterior + `rain` |

Los dos ejemplos que planteaste caen acá: *luna creciente al 50 % con poca
nubosidad* da `moon-first-quarter` + `clouds-light`; *luna llena con cobertura
total y lluvia* da `glow` + `moon-full` + `clouds-heavy` + `rain`.

### De noche, sin luna

Cuando la luna se puso o todavía no sale — que es, dicho sea de paso, la mejor
noche para observar.

| Situación | Capas |
|---|---|
| Despejado | `stars` |
| Pocas nubes | `stars` + `clouds-light` |
| Parcialmente nublado | `stars` + `clouds-medium` |
| Cubierto | `clouds-heavy` |
| Cubierto con lluvia | `clouds-heavy` + `rain` |

Sin luna no hay halo: no hay nada que brille detrás.

### Fases lunares — de dónde sale cada nombre

`moonPhase` va de 0 a 1 y se reparte en ocho tramos de 0,125:

| Rango | Archivo |
|---|---|
| 0,9375–1 y 0–0,0625 | `moon-new` |
| 0,0625–0,1875 | `moon-waxing-crescent` |
| 0,1875–0,3125 | `moon-first-quarter` |
| 0,3125–0,4375 | `moon-waxing-gibbous` |
| 0,4375–0,5625 | `moon-full` |
| 0,5625–0,6875 | `moon-waning-gibbous` |
| 0,6875–0,8125 | `moon-last-quarter` |
| 0,8125–0,9375 | `moon-waning-crescent` |

---

## 5. Para quien dibuja

- **Hemisferio sur.** Esto importa y casi todos los sets de iconos que andan
  dando vuelta están hechos para el norte: acá la luna creciente se ilumina por
  el **lado izquierdo**, y la menguante por el derecho. Al revés de lo que sale
  en la mayoría de las ilustraciones.
- **Tamaño real: 24 px de lado.** Se ve chiquitito en la barra superior. Trazos
  gruesos, pocas formas, nada de detalle fino: lo que se distinga a 24 px es lo
  único que existe.
- **Fondo oscuro.** El sitio es azul muy oscuro casi negro. Los dibujos tienen
  que leerse ahí; el blanco puro y el amarillo cálido funcionan bien, los grises
  medios desaparecen.
- **Formato SVG**, lienzo cuadrado de `viewBox="0 0 24 24"`, sin fondo propio
  (transparente).
- **Las capas se apilan.** Cada dibujo ocupa el mismo cuadrado de 24×24 y se
  superpone a los otros: la nube tiene que tapar la parte de abajo del cuerpo y
  dejar asomar la de arriba. Conviene dibujar las nubes en la mitad inferior y
  los cuerpos celestes ligeramente hacia arriba y a la derecha.
- **Colores sugeridos** (no obligatorios): sol y luna en el dorado del sitio
  (`#f5c469`), nubes en gris azulado claro, lluvia y nieve en un azul pálido.

---

## 6. Cómo se enchufa

- `src/lib/sky.ts` — decide las capas a partir del pronóstico y la hora.
- `src/components/Navbar/SkyIcon.astro` — las apila.
- `src/components/Navbar/navbar.astro` — muestra el icono, la hora, la
  temperatura y el seeing, y refresca en el cliente.

Para reemplazar un placeholder: sobrescribir el archivo en `src/assets/sky/`
con el mismo nombre. No hay que tocar código.
