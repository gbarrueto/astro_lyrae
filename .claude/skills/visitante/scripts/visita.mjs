#!/usr/bin/env node
// Pilotea el navegador por CDP en vez de sacarle fotos por línea de comandos.
//
// Uso: visita.mjs <orden> [args]
//   abrir  [ruta] [--ancho=390] [--alto=844]   carga una página y la deja abierta
//   ver    [--desde=0] [--hasta=N]             el texto visible, en orden de lectura
//   tocar  <texto|selector>                    un toque real, y qué cambió con él
//   deslizar <izq|der> [--sel=CSS]             gesto de swipe (así se navega el carrusel)
//   mirar  [--sel=CSS] [--y=N] [--nombre=x]    captura (completa, de un elemento o de una pantalla)
//   auditar [--sin-recargar]                   hechos verificables: consola, red, enlaces, desbordes
//   cerrar                                     termina la sesión
//
// La pestaña sobrevive entre órdenes: `abrir` una vez, y después `ver`/`tocar`
// las veces que haga falta sobre la misma página, con su estado acumulado.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';

const PUERTO = 9222;
const ORIGIN = process.env.ORIGIN || 'http://localhost:4321';
const OUT = process.env.ASTSHOTS || '/mnt/c/Users/Public/astshots';
const EDGE = '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const ESTADO = `${OUT}/.visita.json`;

const [orden, ...resto] = process.argv.slice(2);
const banderas = Object.fromEntries(
	resto.filter((a) => a.startsWith('--')).map((a) => {
		const i = a.indexOf('=');
		return i < 0 ? [a.slice(2), '1'] : [a.slice(2, i), a.slice(i + 1)];
	}),
);
const libre = resto.filter((a) => !a.startsWith('--'));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Conexión ────────────────────────────────────────────────────────────────

async function version() {
	try {
		const r = await fetch(`http://localhost:${PUERTO}/json/version`, { signal: AbortSignal.timeout(1500) });
		return await r.json();
	} catch {
		return null;
	}
}

async function navegador() {
	let v = await version();
	if (!v) {
		spawn(EDGE, [
			'--headless', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
			// Sin extensiones: Edge trae un bloqueador que falsea peticiones caídas.
			'--disable-extensions', '--no-first-run', '--no-default-browser-check',
			'--disable-features=Translate,msEdgeIdentityFeatures',
			`--remote-debugging-port=${PUERTO}`,
			'--user-data-dir=C:\\Users\\Public\\astshots\\perfil-cdp',
			'about:blank',
		], { detached: true, stdio: 'ignore' }).unref();
		for (let i = 0; i < 40 && !v; i++) { await espera(500); v = await version(); }
		if (!v) throw new Error('no pude levantar Edge con el puerto de depuración');
	}
	return v;
}

const sucesos = { consola: [], red: [], respuestas: [] };

async function conectar() {
	const v = await navegador();
	const ws = new WebSocket(v.webSocketDebuggerUrl);
	await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('WebSocket')); });

	let n = 0;
	const pendientes = new Map();
	ws.onmessage = (e) => {
		const m = JSON.parse(e.data);
		if (m.id && pendientes.has(m.id)) {
			const { res, rej } = pendientes.get(m.id);
			pendientes.delete(m.id);
			m.error ? rej(new Error(`${m.method || ''} ${m.error.message}`)) : res(m.result);
			return;
		}
		const p = m.params || {};
		if (m.method === 'Log.entryAdded' && p.entry?.level === 'error') sucesos.consola.push(p.entry.text);
		if (m.method === 'Runtime.exceptionThrown') sucesos.consola.push(p.exceptionDetails?.exception?.description || 'excepción sin descripción');
		if (m.method === 'Runtime.consoleAPICalled' && p.type === 'error') sucesos.consola.push(p.args?.map((a) => a.value ?? a.description).join(' '));
		if (m.method === 'Network.loadingFailed' && !p.canceled) sucesos.red.push(`${p.errorText} ${p.type}`);
		if (m.method === 'Network.responseReceived' && p.response.status >= 400) sucesos.respuestas.push(`${p.response.status} ${p.response.url}`);
	};
	const enviar = (method, params = {}, sessionId) =>
		new Promise((res, rej) => {
			const id = ++n;
			pendientes.set(id, { res, rej });
			ws.send(JSON.stringify({ id, method, params, sessionId }));
		});

	// La pestaña persiste entre órdenes; si murió, se abre otra.
	const guardado = existsSync(ESTADO) ? JSON.parse(readFileSync(ESTADO, 'utf8')) : {};
	let targetId = guardado.targetId ?? null;
	const { targetInfos } = await enviar('Target.getTargets');
	if (!targetInfos.some((t) => t.targetId === targetId)) targetId = null;
	if (!targetId) {
		({ targetId } = await enviar('Target.createTarget', { url: 'about:blank' }));
		mkdirSync(OUT, { recursive: true });
		writeFileSync(ESTADO, JSON.stringify({ ...guardado, targetId }));
	}
	// Las pestañas de sobra roban el primer plano; sin él Chromium estrangula
	// timers y observers, y las islas `client:visible` no llegan a hidratarse.
	for (const t of targetInfos)
		if (t.type === 'page' && t.targetId !== targetId) await enviar('Target.closeTarget', { targetId: t.targetId }).catch(() => {});

	const { sessionId } = await enviar('Target.attachToTarget', { targetId, flatten: true });
	const cmd = (m, p) => enviar(m, p, sessionId);

	for (const d of ['Page.enable', 'Runtime.enable', 'Log.enable', 'Network.enable', 'DOM.enable']) await cmd(d);
	await cmd('Page.bringToFront').catch(() => {});

	const js = async (expr) => {
		const r = await cmd('Runtime.evaluate', { expression: `(() => {${expr}})()`, returnByValue: true, awaitPromise: true });
		if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
		return r.result.value;
	};
	// El modo táctil lo decide el ancho con que se abrió, no el DOM: bajo
	// emulación, navigator.maxTouchPoints no es de fiar.
	const movil = guardado.movil ?? true;
	const recordar = (datos) => writeFileSync(ESTADO, JSON.stringify({ ...guardado, targetId, ...datos }));
	return { cmd, js, enviar, targetId, movil, recordar, cerrar: () => ws.close() };
}

// ── Piezas compartidas ──────────────────────────────────────────────────────

// Astro quita el atributo `ssr` al hidratar. Las islas `client:visible` solo
// lo hacen al entrar en pantalla, así que solo exigimos las que se ven.
// `astro-island` es display:contents y no tiene caja propia: hay que medir al hijo.
const ESPERAR_ISLAS = `
  const caja = el => (el.firstElementChild || el).getBoundingClientRect();
  const pendiente = () => [...document.querySelectorAll('astro-island[ssr]')].some(el => {
    const r = caja(el);
    return r.top < innerHeight && r.bottom > 0 && r.width > 0;
  });
  return new Promise(res => {
    let i = 0;
    const t = setInterval(() => { if (!pendiente() || ++i > 40) { clearInterval(t); res(!pendiente()); } }, 100);
  });`;

// Lo que una persona "ve" al escanear: texto en orden de lectura, con su altura
// en el documento y el estado de los controles.
const LEER = (max = 110) => `
  // "Visible" incluye no estar recortado por un ancestro: los slides que el
  // carrusel tiene fuera de cuadro existen en el DOM pero nadie los ve.
  const visible = el => {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    if (!(r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.opacity !== '0')) return false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p);
      if (o.overflowX === 'visible' && o.overflowY === 'visible') continue;
      const c = p.getBoundingClientRect();
      if (r.right <= c.left + 1 || r.left >= c.right - 1 || r.bottom <= c.top + 1 || r.top >= c.bottom - 1) return false;
    }
    return true;
  };
  // Se agrupa por caja de layout, no por una lista de etiquetas: así el lector
  // sobrevive a que la UI cambie de <dl>/<dt> a divs y spans. Los controles se
  // tratan como unidad propia aunque sean inline, para no perder su estado.
  const UNIDAD = 'button,a,summary,[role=button],[role=tab],[role=radio],[role=option],[role=dialog]';
  const esBloque = el => {
    if (el.matches(UNIDAD)) return true;
    const d = getComputedStyle(el).display;
    return d !== 'inline' && d !== 'contents';
  };
  const bloqueDe = el => { for (let p = el; p; p = p.parentElement) if (esBloque(p)) return p; return document.body; };

  const orden = [];
  const porBloque = new Map();
  const paseo = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let nd; (nd = paseo.nextNode());) {
    if (nd.nodeType === 1) {
      if (nd.tagName === 'IMG' && visible(nd)) {
        const r = nd.getBoundingClientRect();
        const alt = nd.getAttribute('alt');
        orden.push({ y: Math.round(r.top + scrollY), tag: 'img', marcas: [],
                     txt: alt === null ? '«sin alt»' : alt.trim() || '«alt vacío»' });
      }
      continue;
    }
    const t = nd.textContent.replace(/\\s+/g, ' ').trim();
    if (!t) continue;
    const p = nd.parentElement;
    if (!p || p.closest('script,style,astro-dev-toolbar') || !visible(p)) continue;
    const b = bloqueDe(p);
    if (!porBloque.has(b)) { const e = { el: b, partes: [] }; porBloque.set(b, e); orden.push(e); }
    porBloque.get(b).partes.push(t);
  }

  const salida = [];
  for (const e of orden) {
    if (!e.el) { salida.push(e); continue; }
    const el = e.el, r = el.getBoundingClientRect();
    let txt = e.partes.join(' ').replace(/\\s+/g, ' ').trim();
    if (!txt) continue;
    if (txt.length > ${max}) txt = txt.slice(0, ${max}) + '…';
    const act = el.closest('a[href],button,[role=button],[role=tab],[role=radio]') || el;
    const marcas = [];
    if (act.tagName === 'A') marcas.push(act.getAttribute('href'));
    // Un control puede anunciarse activo de cuatro formas según el patrón que
    // use (tab, radio, toggle, navegación); si solo se mira una, el recorrido
    // reporta "no se ve cuál está elegido" cuando sí se ve.
    const act_ = act.getAttribute('aria-selected') ?? act.getAttribute('aria-checked') ?? act.getAttribute('aria-pressed');
    const cur = act.getAttribute('aria-current');
    if (act_ === 'true' || (cur && cur !== 'false')) marcas.push('ACTIVO');
    if (act.getAttribute('aria-expanded') === 'true') marcas.push('ABIERTO');
    if (act.disabled || act.getAttribute('aria-disabled') === 'true') marcas.push('DESACTIVADO');
    salida.push({ y: Math.round(r.top + scrollY), tag: el.tagName.toLowerCase(), txt, marcas });
  }
  // Un término y su valor son una sola cosa para quien lee ("Seeing: 0,75–1″").
  return salida.filter((n, i) => {
    const sig = salida[i + 1];
    if (n.tag === 'dt' && sig?.tag === 'dd') { n.txt += ': ' + sig.txt; sig.tag = ''; }
    return n.tag !== '';
  });`;

// Todo el texto que de verdad se ve, hoja por hoja y sin agrupar. Sirve de
// contraste: si `ver` deja algo fuera, la UI cambió de una forma que el lector
// no sigue, y el visitante reportaría como ausente algo que sí está en pantalla.
const TEXTO_VISIBLE = `
  const visible = el => {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    if (!(r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.opacity !== '0')) return false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p);
      if (o.overflowX === 'visible' && o.overflowY === 'visible') continue;
      const c = p.getBoundingClientRect();
      if (r.right <= c.left + 1 || r.left >= c.right - 1 || r.bottom <= c.top + 1 || r.top >= c.bottom - 1) return false;
    }
    return true;
  };
  const out = [];
  const paseo = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let nd; (nd = paseo.nextNode());) {
    const t = nd.textContent.replace(/\\s+/g, ' ').trim();
    if (!t) continue;
    const p = nd.parentElement;
    if (!p || p.closest('script,style,astro-dev-toolbar') || !visible(p)) continue;
    out.push(t);
  }
  return out;`;

// Una imagen sin dimensiones reservadas empuja todo lo que tiene debajo cuando
// termina de cargar. Si se mide antes de eso, el toque cae en el vacío.
const ESPERAR_IMAGENES = `
  const pendientes = () => [...document.images].filter(i => {
    if (i.complete) return false;
    const r = i.getBoundingClientRect();
    return r.top < innerHeight * 2 && r.bottom > -innerHeight;
  }).length;
  return new Promise(res => {
    let i = 0;
    const t = setInterval(() => { if (!pendientes() || ++i > 30) { clearInterval(t); res(1); } }, 100);
  });`;

const pinta = (nodos, alto) => {
	let pliegue = false;
	const lineas = [];
	for (const n of nodos) {
		if (!pliegue && n.y > alto) { lineas.push(`     ── pliegue (${alto}px): de aquí para abajo hay que hacer scroll ──`); pliegue = true; }
		const m = n.marcas.filter(Boolean).length ? ` [${n.marcas.filter(Boolean).join(' ')}]` : '';
		lineas.push(`${String(n.y).padStart(5)} ${n.tag}${m} :: ${n.txt}`);
	}
	return lineas.join('\n');
};

async function irA(ctx, ruta, ancho, alto) {
	await ctx.cmd('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 1, mobile: ancho < 700 });
	await ctx.cmd('Emulation.setTouchEmulationEnabled', { enabled: ancho < 700, maxTouchPoints: 5 });
	const url = ruta.startsWith('http') ? ruta : ORIGIN + ruta;
	await ctx.cmd('Page.navigate', { url });
	for (let i = 0; i < 60; i++) {
		if (await ctx.js('return document.readyState === "complete"').catch(() => false)) break;
		await espera(250);
	}
	await ctx.js(ESPERAR_ISLAS);
	return url;
}

// La barra del dev toolbar no existe para un visitante. Y al recortar una
// sección, todo lo que flota respecto del viewport —barra fija, popovers en
// portal— aparece pegado en mitad del recorte, en un tamaño y una posición que
// nadie ve nunca así. Es un artefacto del encuadre y hay que sacarlo.
const FLOTANTES = '[role=dialog],[role=tooltip],[role=menu],[role=listbox],[popover],[data-floating-ui-portal]';
const OCULTAR = (sinFijos) => `
  const s = document.createElement('style');
  s.id = '__visita_css__';
  s.textContent = 'astro-dev-toolbar{display:none !important}';
  document.head.appendChild(s);
  // visibility (y no display) para no mover nada de sitio al ocultarlos.
  ${sinFijos ? `let capas = 0;
  for (const el of document.querySelectorAll('body *')) {
    const p = getComputedStyle(el).position;
    const flota = p === 'fixed' || p === 'sticky' || el.matches(${JSON.stringify(FLOTANTES)});
    if (!flota) continue;
    if (el.matches(${JSON.stringify(FLOTANTES)}) && el.getBoundingClientRect().width > 0) capas++;
    el.dataset.visitaOculto = (el.style.visibility = 'hidden', '1');
  }
  if (capas) console.warn('[visita] ' + capas + ' capa(s) flotante(s) abiertas, ocultadas para el recorte');
  return capas;` : 'return 0;'}`;
const MOSTRAR = `
  document.getElementById('__visita_css__')?.remove();
  for (const el of document.querySelectorAll('[data-visita-oculto]')) {
    el.style.visibility = ''; delete el.dataset.visitaOculto;
  }
  return 1;`;

async function capturar(ctx, nombre, opciones = {}, sinFijos = false) {
	mkdirSync(OUT, { recursive: true });
	const capas = await ctx.js(OCULTAR(sinFijos));
	if (capas) console.log(`(había ${capas} capa flotante abierta; se ocultó para encuadrar la sección)`);
	await espera(200); // que el compositor alcance a repintar antes del disparo
	try {
		const r = await ctx.cmd('Page.captureScreenshot', { format: 'webp', quality: 82, ...opciones });
		const archivo = `${OUT}/${nombre}.webp`;
		writeFileSync(archivo, Buffer.from(r.data, 'base64'));
		return { archivo, kb: Math.round((r.data.length * 0.75) / 1024) };
	} finally {
		await ctx.js(MOSTRAR);
	}
}

// ── Órdenes ─────────────────────────────────────────────────────────────────

const ordenes = {
	async abrir(ctx) {
		const ancho = +(banderas.ancho || 390);
		const alto = +(banderas.alto || 844);
		ctx.recordar({ ancho, alto, movil: ancho < 700 });
		const url = await irA(ctx, libre[0] || '/', ancho, alto);
		const m = await ctx.js(`
      const d = document.documentElement;
      const caja = el => (el.firstElementChild || el).getBoundingClientRect();
      return { vw: innerWidth, sw: d.scrollWidth, alto: d.scrollHeight, titulo: document.title,
               islas: document.querySelectorAll('astro-island').length,
               // Las de más abajo esperan al scroll por diseño; solo delatan algo las visibles.
               pendientes: [...document.querySelectorAll('astro-island[ssr]')]
                 .filter(el => { const r = caja(el); return r.top < innerHeight && r.bottom > 0; }).length };`);
		console.log(`${url}  «${m.titulo}»`);
		console.log(`viewport ${m.vw}×${alto} · documento ${m.alto}px (${(m.alto / alto).toFixed(1)} pantallas) · ${m.islas} islas${m.pendientes ? `, ${m.pendientes} sin hidratar en pantalla` : ''}`);
		if (m.sw > m.vw) console.log(`DESBORDE HORIZONTAL REAL: scrollWidth ${m.sw} > viewport ${m.vw}`);
		if (sucesos.consola.length) console.log(`errores de consola al cargar: ${sucesos.consola.length}`);
		if (sucesos.red.length) console.log(`peticiones fallidas: ${sucesos.red.join(', ')}`);
	},

	async ver(ctx) {
		const alto = (await ctx.js('return innerHeight')) || 844;
		const desde = +(banderas.desde || 0);
		const hasta = +(banderas.hasta || Infinity);
		const nodos = (await ctx.js(LEER())).filter((n) => n.y >= desde && n.y <= hasta);
		console.log(pinta(nodos, alto));
		console.log(`\n(${nodos.length} elementos visibles)`);
	},

	async tocar(ctx) {
		const objetivo = libre.join(' ');
		if (!objetivo) throw new Error('falta qué tocar: texto exacto del control, o un selector CSS');
		const antes = await ctx.js(LEER());
		const urlAntes = await ctx.js('return location.href');

		const p = await ctx.js(`
      const q = ${JSON.stringify(objetivo)};
      const cand = /^[.#\\[]/.test(q) ? [...document.querySelectorAll(q)]
        : [...document.querySelectorAll('button,a,[role=button],[role=tab],[role=radio],summary,input,label')]
            .filter(el => el.innerText?.trim() === q || el.getAttribute('aria-label') === q)
            .concat([...document.querySelectorAll('button,a,[role=button],[role=tab]')]
              .filter(el => el.innerText?.trim().includes(q)));
      const el = cand.find(e => e.getBoundingClientRect().width > 0);
      if (!el) return null;
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      return { etiqueta: (el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40) };`);
		if (!p) { console.log(`no encontré nada que tocar con «${objetivo}»`); return; }

		await ctx.js(ESPERAR_ISLAS); // tras el scroll puede haber una isla client:visible recién montándose
		await ctx.js(ESPERAR_IMAGENES); // una imagen que termina de cargar empuja el layout y mueve el objetivo
		// Se vuelve a medir pegado al toque y se comprueba que el punto siga cayendo
		// dentro del objetivo: si no, el tap aterriza en otra cosa y el recorrido
		// concluye "toqué y no pasó nada" cuando en realidad no lo tocó.
		const medir = `
      const q = ${JSON.stringify(objetivo)};
      const cand = /^[.#\\[]/.test(q) ? [...document.querySelectorAll(q)]
        : [...document.querySelectorAll('button,a,[role=button],[role=tab],[role=radio],summary,input,label')]
            .filter(el => el.innerText?.trim() === q || el.getAttribute('aria-label') === q)
            .concat([...document.querySelectorAll('button,a,[role=button],[role=tab]')]
              .filter(el => el.innerText?.trim().includes(q)));
      const el = cand.find(e => e.getBoundingClientRect().width > 0);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) el.scrollIntoView({ block: 'center', behavior: 'instant' });
      const b = el.getBoundingClientRect();
      const x = b.x + b.width / 2, y = b.y + b.height / 2;
      const encima = document.elementFromPoint(x, y);
      return { x, y, w: Math.round(b.width), h: Math.round(b.height),
               acierta: !!encima && (el.contains(encima) || encima.contains(el)),
               estorba: encima && !(el.contains(encima) || encima.contains(el))
                 ? encima.tagName.toLowerCase() + '.' + String(encima.className.baseVal ?? encima.className).slice(0, 40) : null };`;
		let caja = await ctx.js(medir);
		if (caja && !caja.acierta) { await espera(400); caja = await ctx.js(medir); }
		if (!caja) { console.log(`no encontré nada que tocar con «${objetivo}»`); return; }
		if (!caja.acierta) console.log(`ojo: en el punto del toque hay ${caja.estorba ?? 'nada'}, encima del objetivo`);

		const tactil = ctx.movil;
		if (tactil) {
			const punto = [{ x: caja.x, y: caja.y, radiusX: 12, radiusY: 12, force: 1 }];
			await ctx.cmd('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punto });
			await ctx.cmd('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		} else {
			for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
				await ctx.cmd('Input.dispatchMouseEvent', { type, x: caja.x, y: caja.y, button: 'left', clickCount: 1 });
		}
		await espera(700);
		await ctx.js(ESPERAR_ISLAS);

		const chico = tactil && (caja.w < 44 || caja.h < 44);
		console.log(`toqué «${p.etiqueta}» (${caja.w}×${caja.h}px)${chico ? '  ← blanco chico para un dedo' : ''}`);
		const urlDespues = await ctx.js('return location.href');
		if (urlDespues !== urlAntes) console.log(`la página cambió a ${urlDespues}`);

		const despues = await ctx.js(LEER());
		const clave = (n) => `${n.tag}|${n.txt}|${n.marcas.filter(Boolean).join(',')}`;
		const A = new Set(antes.map(clave));
		const B = new Set(despues.map(clave));
		const nuevo = despues.filter((n) => !A.has(clave(n)));
		const ido = antes.filter((n) => !B.has(clave(n)));
		if (!nuevo.length && !ido.length) {
			console.log('no cambió nada de lo visible. O el control no hace nada, o no llegó el toque.');
		} else {
			for (const n of ido.slice(0, 10)) console.log(`  − ${n.tag} :: ${n.txt}`);
			for (const n of nuevo.slice(0, 14)) console.log(`  + ${n.tag}${n.marcas.filter(Boolean).length ? ` [${n.marcas.filter(Boolean).join(' ')}]` : ''} :: ${n.txt}`);
			if (nuevo.length > 14 || ido.length > 10) console.log('  …');
		}
		if (sucesos.consola.length) console.log(`errores de consola durante el toque: ${sucesos.consola.slice(0, 3).join(' | ')}`);
	},

	// En móvil el carrusel no tiene botones: o se desliza, o no existe.
	async deslizar(ctx) {
		const dir = (libre[0] || 'izq').startsWith('d') ? 1 : -1;
		const antes = await ctx.js(LEER());
		const p = await ctx.js(`
      const sel = ${JSON.stringify(banderas.sel || '')};
      const el = sel ? document.querySelector(sel) : null;
      if (sel && !el) return null;
      if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = el ? el.getBoundingClientRect() : { x: 0, y: 0, width: innerWidth, height: innerHeight };
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, ancho: r.width };`);
		if (!p) { console.log(`no existe ${banderas.sel}`); return; }
		await ctx.js(ESPERAR_ISLAS);

		const recorrido = Math.min(p.ancho * 0.6, 260) * dir;
		const punto = (x) => [{ x, y: p.y, radiusX: 12, radiusY: 12, force: 1 }];
		await ctx.cmd('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punto(p.x) });
		for (let i = 1; i <= 8; i++) {
			await ctx.cmd('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: punto(p.x + (recorrido * i) / 8) });
			await espera(16);
		}
		await ctx.cmd('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		await espera(700);

		console.log(`deslicé hacia ${dir > 0 ? 'la derecha' : 'la izquierda'}${banderas.sel ? ` sobre ${banderas.sel}` : ''}`);
		const despues = await ctx.js(LEER());
		const clave = (n) => `${n.tag}|${n.txt}|${n.marcas.filter(Boolean).join(',')}`;
		const A = new Set(antes.map(clave));
		const nuevo = despues.filter((n) => !A.has(clave(n)));
		if (!nuevo.length) console.log('nada cambió: o no hay nada que deslizar ahí, o el gesto no se reconoció.');
		else for (const n of nuevo.slice(0, 10)) console.log(`  + ${n.tag} :: ${n.txt}`);
	},

	async mirar(ctx) {
		const nombre = banderas.nombre || 'vista';
		let opciones = { captureBeyondViewport: true };
		if (banderas.sel) {
			const caja = await ctx.js(`
        const el = document.querySelector(${JSON.stringify(banderas.sel)});
        if (!el) return null;
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        const r = el.getBoundingClientRect();
        return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height, scale: 1 };`);
			if (!caja) { console.log(`no existe ${banderas.sel}`); return; }
			opciones = { clip: caja, captureBeyondViewport: true };
		} else if (banderas.y !== undefined) {
			// Sin captureBeyondViewport: al componer más allá del viewport, las
			// barras fijas se recolocan en su hueco del flujo y aparecen flotando
			// a media pantalla. Para una pantalla concreta hay que scrollear de
			// verdad y fotografiar lo que se ve, que es lo que ve la persona.
			// El sitio anima el scroll (scroll-behavior: smooth); sin desactivarlo
			// la captura sale a medio camino del salto.
			await ctx.js(`document.documentElement.style.scrollBehavior = 'auto';
			              scrollTo(0, ${+banderas.y}); return 1`);
			await espera(350);
			opciones = {};
		}
		const { archivo, kb } = await capturar(ctx, nombre, opciones, !!banderas.sel);
		console.log(`${archivo}  (${kb} KB)`);
	},

	async auditar(ctx) {
		// Recarga para observar la carga entera: consola y red solo emiten mientras
		// estamos atados. Con --sin-recargar se audita la página tal como está
		// ahora, con lo que hayas abierto o tocado (pero sin los sucesos de carga).
		const url = await ctx.js('return location.href');
		if (!banderas['sin-recargar']) {
			sucesos.consola.length = sucesos.red.length = sucesos.respuestas.length = 0;
			await ctx.cmd('Page.reload', { ignoreCache: true });
			await espera(1500);
			await ctx.js(ESPERAR_ISLAS);
			await ctx.js(`document.documentElement.style.scrollBehavior = 'auto';
			              scrollTo(0, document.documentElement.scrollHeight); return 1`);
			await espera(800);
			await ctx.js(ESPERAR_ISLAS);
			await ctx.js('scrollTo(0, 0); return 1');
		}

		const d = await ctx.js(`
      const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const recortado = el => { let p = el.parentElement;
        while (p) { const o = getComputedStyle(p).overflowX; if (o !== 'visible') return true; p = p.parentElement; } return false; };
      const doc = document.documentElement;
      return {
        vw: innerWidth, sw: doc.scrollWidth,
        // Solo importan los que sobresalen Y no están recortados por un ancestro:
        // el carrusel sobresale por diseño y no produce scroll lateral.
        desbordan: doc.scrollWidth > innerWidth
          ? [...document.querySelectorAll('*')].filter(el => vis(el) && el.getBoundingClientRect().right > innerWidth + 1 && !recortado(el))
              .slice(0, 6).map(el => el.tagName.toLowerCase() + '.' + String(el.className.baseVal ?? el.className).slice(0, 50))
          : [],
        sinAlt: [...document.querySelectorAll('img:not([alt])')].map(el => el.currentSrc.split('/').pop()).slice(0, 8),
        chicos: [...document.querySelectorAll('button,a,[role=button],[role=tab]')]
          .filter(el => vis(el) && getComputedStyle(el).display !== 'inline')
          .map(el => ({ t: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 28), r: el.getBoundingClientRect() }))
          .filter(o => o.r.width < 44 || o.r.height < 44)
          .map(o => \`\${o.t || '«sin texto»'} (\${Math.round(o.r.width)}×\${Math.round(o.r.height)})\`).slice(0, 8),
        enlaces: [...new Set([...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')))],
        anclas: [...new Set([...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href').slice(1)))]
          .filter(id => id && !document.getElementById(id)),
      };`);

		const linea = (t, xs) => console.log(xs.length ? `${t}\n  ${xs.join('\n  ')}` : `${t} ninguno`);
		console.log(`# hechos verificables de ${url}\n`);
		linea('errores de consola:', [...new Set(sucesos.consola)].slice(0, 6));
		linea('peticiones fallidas:', [...new Set(sucesos.red)].slice(0, 6));
		linea('respuestas 4xx/5xx:', [...new Set(sucesos.respuestas)].slice(0, 6));
		console.log(`desborde horizontal: ${d.sw > d.vw ? `SÍ (${d.sw} > ${d.vw})` : 'no'}`);
		if (d.desbordan.length) linea('  culpables (no recortados):', d.desbordan);
		linea('anclas rotas (#id inexistente):', d.anclas);
		linea('imágenes sin atributo alt:', d.sinAlt);
		if (ctx.movil) linea('blancos táctiles < 44px:', d.chicos);

		// `text-transform` hace que innerText devuelva mayúsculas donde el nodo
		// crudo no las tiene: comparar sin distinguir caja evita ese falso positivo.
		const norm = (t) => t.toLowerCase().replace(/\s+/g, ' ').trim();
		const leido = norm((await ctx.js(LEER(Infinity))).map((n) => n.txt).join('  '));
		const fuera = [...new Set((await ctx.js(TEXTO_VISIBLE)).filter((t) => !leido.includes(norm(t))))];
		linea(`texto en pantalla que «ver» no recoge (${fuera.length}):`, fuera.slice(0, 8).map((t) => `«${t.slice(0, 60)}»`));

		const internos = d.enlaces.filter((h) => h.startsWith('/'));
		const estados = await Promise.all(internos.map(async (h) => {
			try {
				const r = await fetch(ORIGIN + h, { signal: AbortSignal.timeout(8000) });
				return `${r.status} ${h}`;
			} catch { return `sin respuesta ${h}`; }
		}));
		linea('enlaces internos:', estados);
		linea('enlaces externos:', d.enlaces.filter((h) => !h.startsWith('/') && !h.startsWith('#')));
	},

	async cerrar(ctx) {
		await ctx.enviar('Target.closeTarget', { targetId: ctx.targetId });
		rmSync(ESTADO, { force: true });
		if (banderas.todo) await ctx.enviar('Browser.close');
		console.log('sesión cerrada');
	},
};

if (!ordenes[orden]) {
	const cabecera = readFileSync(new URL(import.meta.url)).toString().split('\n').slice(1);
	console.error(cabecera.slice(0, cabecera.findIndex((l) => !l.startsWith('//'))).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
	process.exit(1);
}

const ctx = await conectar();
try {
	await ordenes[orden](ctx);
} finally {
	ctx.cerrar();
}
process.exit(0);
