/* Camisas IUB — Registro de ventas (v3, prototipo)
   Datos de demostración sintéticos. Sin backend: el estado vive en localStorage.

   Reglas de negocio copiadas de la app original (CAMISASIUB):
   - El estado lo lleva cada camisa; el del pedido es el MÁS ATRASADO.
   - Cuentas: se agrupa por CONTACTO (teléfono), no por nombre.
   - Proveedor: el aporte se reparte entre pedidos proporcional al COSTO,
     y el último pedido absorbe el redondeo para que no falte ni un peso.
   - Liquidaciones: mitad de la ganancia entre los dos socios. Una pérdida
     NO genera deuda (se la come quien vendió).
   - Papelera: el borrado es reversible hasta que se vacía.
*/
(function () {
  "use strict";

  /* ── Catálogos ───────────────────────────────────────── */
  var ESTADOS = [
    { key: "Pedido", label: "Pedido", clase: "Pedido" },
    { key: "Comprado", label: "Comprado", clase: "Comprado" },
    { key: "Bordando", label: "Bordando", clase: "Bordando" },
    { key: "Listo para entrega", label: "Listo para entrega", clase: "Listo" },
    { key: "Entregado", label: "Entregado", clase: "Entregado" },
    { key: "Liquidado", label: "Liquidado", clase: "Liquidado" }
  ];
  var MODELOS = ["Versión 1", "Versión 2"];
  var GENEROS = ["Caballero", "Dama", "Unisex"];
  var TALLAS = ["S", "M", "L", "XL", "2XL", "3XL", "4XL"];
  var COLORES = [
    { n: "Negro", hex: "#1A1A1A" },
    { n: "Blanco", hex: "#F2F2F2" },
    { n: "Gris", hex: "#9AA1A9" },
    { n: "Turquí", hex: "#1B3A6B" },
    { n: "Azul turquesa", hex: "#17A2B8" },
    { n: "Camel", hex: "#C19A6B" },
    { n: "Vinotinto", hex: "#6E1B2E" },
    { n: "Palo de Rosa", hex: "#E3B7C0" },
    { n: "Mostaza", hex: "#C9A227" }
  ];
  var LUGARES = ["Soledad", "Plaza de la Paz", "Granadillos", "Centro Histórico", "Domicilio", "Buscan en casa de Val", "Buscan en casa de Samir", "Otro"];
  var VENDEDORES = ["Samir", "Valentina"];
  var EXTRA_TALLA = { "2XL": 2000, "3XL": 4000, "4XL": 6000 };
  var COSTO_BASE = 30000;
  var PRECIO_BASE = 39000;
  var PROVEEDOR = "Yesenia";
  var CLAVE = "iub-registro-v3";
  /* Tolerancia de $1 que usa la app original: un peso de más no es sobrepago. */
  var TOL = 1;

  /* ── Utilidades ──────────────────────────────────────── */
  function $(sel, raiz) { return (raiz || document).querySelector(sel); }
  function $$(sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); }
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function cop(n) { return "$" + Math.round(Number(n) || 0).toLocaleString("es-CO"); }
  function hoyISO() { return isoDe(new Date()); }
  function isoDe(d) {
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + dd;
  }
  function aFecha(isoStr) {
    if (!isoStr) return null;
    var p = String(isoStr).split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function sumaDias(isoStr, dias) {
    var d = aFecha(isoStr) || new Date();
    d.setDate(d.getDate() + dias);
    return isoDe(d);
  }
  function fechaLarga(isoStr) {
    var d = aFecha(isoStr);
    if (!d) return "—";
    return new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" }).format(d);
  }
  function fechaCorta(isoStr) {
    var d = aFecha(isoStr);
    if (!d) return "—";
    return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(d);
  }
  function diffDias(isoStr) {
    var d = aFecha(isoStr); if (!d) return null;
    var hoy = aFecha(hoyISO());
    return Math.round((d - hoy) / 86400000);
  }
  function colorHex(nombre) {
    for (var i = 0; i < COLORES.length; i++) if (COLORES[i].n === nombre) return COLORES[i].hex;
    return "#9AA1A9";
  }
  function plural(n, uno, varios) { return n + " " + (n === 1 ? uno : varios); }

  /* El otro socio. En la app original está fijo en dos nombres. */
  function otroSocioDe(vendedor) {
    if (vendedor === "Samir") return "Valentina";
    if (vendedor === "Valentina") return "Samir";
    return null;
  }
  /* Un cliente es el mismo si el teléfono coincide sin importar el formato.
     El @ de WhatsApp manda: "@samir" agrupa distinto de un número. */
  function claveCliente(p) {
    var tel = String(p.telefono || "").trim();
    if (tel) {
      if (tel.charAt(0) === "@") return "@" + tel.slice(1).trim().toLowerCase().replace(/\s+/g, "");
      var digitos = tel.replace(/\D/g, "");
      if (digitos) return digitos;
      return tel.toLowerCase();
    }
    return String(p.cliente || "").trim().toLowerCase() || "__sin_contacto__";
  }
  /* Cuando un grupo tiene varios nombres escritos, gana el más repetido. */
  function etiquetaClienteGrupo(pedidos) {
    var cuenta = {}, mejor = "", max = -1;
    pedidos.forEach(function (p) {
      var n = String(p.cliente || "").trim() || "Sin cliente";
      cuenta[n] = (cuenta[n] || 0) + 1;
    });
    pedidos.forEach(function (p) {
      var n = String(p.cliente || "").trim() || "Sin cliente";
      if (cuenta[n] >= max) { max = cuenta[n]; mejor = n; }
    });
    return mejor || "Sin cliente";
  }
  /* Un id de pedido nuevo, sin pisar los que ya existen. */
  function nuevoIdPedido() {
    var max = state.pedidos.reduce(function (m, p) {
      return Math.max(m, Number(String(p.id).replace(/\D/g, "")) || 0);
    }, 1000);
    return "IUB-" + (max + 1);
  }
  function idVenta() { return "v-" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }

  /* ── Cálculos ────────────────────────────────────────── */
  function costoUnitario(modelo, talla) {
    return COSTO_BASE + (EXTRA_TALLA[talla] || 0) + (modelo === "Versión 2" ? 1000 : 0);
  }
  function totales(p) {
    var cant = 0, venta = 0, costo = 0;
    (p.items || []).forEach(function (it) {
      var c = Number(it.cantidad) || 0;
      cant += c;
      venta += (Number(it.precio) || 0) * c;
      costo += costoUnitario(it.modelo, it.talla) * c;
    });
    return { cant: cant, venta: venta, costo: costo, ganancia: venta - costo, abono: Number(p.abono) || 0, saldo: venta - (Number(p.abono) || 0) };
  }
  function estadoPedido(p) {
    var min = ESTADOS.length - 1, actual = null;
    (p.items || []).forEach(function (it) {
      var idx = ESTADOS.findIndex(function (e) { return e.key === it.estado; });
      if (idx < 0) idx = 0;
      if (idx < min) min = idx;
    });
    actual = ESTADOS[min] || ESTADOS[0];
    return actual;
  }
  function esFinalizado(p) {
    var e = estadoPedido(p).key;
    return e === "Entregado" || e === "Liquidado";
  }

  /* ── Nuevos cálculos (copiados de la app original) ───── */
  /* El costo extra por talla SOLO aplica al costo, nunca al precio.
     La app original no tiene lógica de precio por talla. */
  function abonosCliente(p) {
    var items = p.items || [];
    var suma = items.reduce(function (a, it) { return a + (Number(it.abono) || 0); }, 0);
    /* Si el abono vive solo en el pedido y las camisas no lo tienen, se usa el del pedido. */
    return suma || (Number(p.abono) || 0);
  }
  /* El saldo nunca es negativo: un sobrepago se muestra como pagado. */
  function saldoCliente(p) {
    return Math.max(totales(p).venta - abonosCliente(p), 0);
  }
  /* Lo que ya se le pagó al proveedor por este pedido. */
  function pagadoProveedor(p) {
    var items = p.items || [];
    var definido = items.some(function (it) { return it.abonoYesenia != null && it.abonoYesenia !== ""; });
    if (definido) return Math.round(items.reduce(function (a, it) { return a + (Number(it.abonoYesenia) || 0); }, 0));
    return Math.round(Number(p.abonoYesenia) || 0);
  }
  function pendienteProveedor(p) {
    return Math.max(totales(p).costo - pagadoProveedor(p), 0);
  }
  /* Mitad de la ganancia. La pérdida NO genera deuda: quien vendió se la come. */
  function mitadGanancia(p) {
    return Math.max((totales(p).venta - totales(p).costo) / 2, 0);
  }
  function liquidadoDe(p) {
    var receptor = otroSocioDe(p.vendedor);
    if (!receptor) return 0;
    return state.liquidaciones.reduce(function (a, l) {
      if (l.pedidoId !== p.id) return a;
      if (l.pagador !== p.vendedor || l.receptor !== receptor) return a;
      return a + (Number(l.monto) || 0);
    }, 0);
  }
  function saldoSocio(p) {
    return Math.max(mitadGanancia(p) - liquidadoDe(p), 0);
  }
  function pedidoLiquidado(p) { return saldoSocio(p) <= TOL; }
  /* Un pedido no se marca como liquidado hasta que estén las tres cosas:
     cobrado del cliente, pagado al proveedor y repartido con el otro socio. */
  function puedeMarcarPagado(p) {
    var faltas = [];
    var saldoCli = saldoCliente(p);
    var pendProv = pendienteProveedor(p);
    if (saldoCli > TOL) faltas.push("cobrar " + cop(saldoCli) + " al cliente");
    if (pendProv > TOL) faltas.push("pagar " + cop(pendProv) + " a " + PROVEEDOR);
    if (!pedidoLiquidado(p)) faltas.push("liquidar " + cop(saldoSocio(p)) + " al otro socio");
    return { ok: faltas.length === 0, faltas: faltas };
  }
  /* Reparto proporcional al COSTO. El último pedido absorbe el redondeo
     para que la suma dé exactamente el monto, ni un peso menos. */
  function repartirPorCosto(total, pedidos) {
    var r = {};
    if (!pedidos.length) return r;
    if (!(total > 0)) { pedidos.forEach(function (p) { r[p.id] = 0; }); return r; }
    var costos = pedidos.map(function (p) { return totales(p).costo; });
    var sumaCosto = costos.reduce(function (a, b) { return a + b; }, 0);
    var asignado = 0;
    pedidos.forEach(function (p, i) {
      if (i === pedidos.length - 1) { r[p.id] = total - asignado; return; }
      var parte = sumaCosto > 0
        ? Math.floor(total * costos[i] / sumaCosto)
        : Math.floor(total / pedidos.length);
      asignado += parte;
      r[p.id] = parte;
    });
    return r;
  }

  /* ── Estado ──────────────────────────────────────────── */
  var state = {
    pedidos: [],
    /* visita al proveedor: { id, fecha, comprador, pedidoIds:[], aportes:{persona:monto} } */
    visitas: [],
    /* pagos entre socios: { id, pedidoId, fecha, pagador, receptor, monto, nota } */
    liquidaciones: [],
    papelera: [],
    periodo: "hoy",
    grupo: "activos",
    q: "",
    fVendedor: "",
    fEstado: "",
    qCuentas: "",
    resPeriodo: "7"
  };

  function cargar() {
    var guardado = null;
    try { guardado = JSON.parse(localStorage.getItem(CLAVE) || "null"); } catch (e) { guardado = null; }
    if (guardado && guardado.pedidos && guardado.pedidos.length) {
      state.pedidos = guardado.pedidos;
      state.visitas = Array.isArray(guardado.visitas) ? guardado.visitas : [];
      state.liquidaciones = Array.isArray(guardado.liquidaciones) ? guardado.liquidaciones : [];
      state.papelera = Array.isArray(guardado.papelera) ? guardado.papelera : [];
    } else {
      sembrar();
    }
  }
  function guardar() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify({
        pedidos: state.pedidos,
        visitas: state.visitas,
        liquidaciones: state.liquidaciones,
        papelera: state.papelera
      }));
    } catch (e) { /* modo privado */ }
    programarSincro();
  }
  /* Datos de demostración sintéticos. Sin nombres ni teléfonos reales de clientes
     reales: la lista es inventada y los montos son de prueba. */
  function sembrar() {
    var rnd = semilla(20261009);
    var clientes = [
      ["María Fernanda Gómez", "300 214 8890"], ["Andrés Bermúdez", "301 556 2014"],
      ["Luz Marina Ríos", "310 447 6621"], ["Carlos Padilla", "312 903 5542"],
      ["Yuliana Mercado", "300 771 3320"], ["Jorge Eliecer Bolaño", "301 220 9987"],
      ["Dayana Ospina", "310 665 1180"], ["Ricardo Villa", "312 338 7745"],
      ["Sandra Milena Charris", "300 908 4412"], ["Kevin De la Hoz", "301 774 2290"],
      ["Natalia Barrios", "310 112 6688"], ["José Luis Cantillo", "312 550 3391"],
      ["Estefany Pertuz", "300 336 9912"], ["Wilmer Camargo", "301 889 4470"]
    ];
    var hoy = hoyISO();
    var pedidos = [];
    var plan = [
      { d: -0, est: "Pedido", items: [["Versión 1", "Caballero", "Azul turquesa", "L"], ["Versión 2", "Dama", "Palo de Rosa", "M"]], abono: 20000, entrega: 2, lug: "Plaza de la Paz" },
      { d: -0, est: "Comprado", items: [["Versión 2", "Caballero", "Negro", "XL"]], abono: 39000, entrega: 1, lug: "Domicilio" },
      { d: -0, est: "Bordando", items: [["Versión 1", "Unisex", "Mostaza", "2XL"], ["Versión 1", "Unisex", "Mostaza", "2XL"]], abono: 0, entrega: 3, lug: "Soledad" },
      { d: -1, est: "Bordando", items: [["Versión 2", "Dama", "Vinotinto", "S"]], abono: 40000, entrega: 2, lug: "Centro Histórico" },
      { d: -1, est: "Listo para entrega", items: [["Versión 1", "Caballero", "Blanco", "M"], ["Versión 1", "Caballero", "Gris", "L"]], abono: 78000, entrega: 0, lug: "Buscan en casa de Val" },
      { d: -2, est: "Listo para entrega", items: [["Versión 2", "Dama", "Turquí", "L"]], abono: 0, entrega: 1, lug: "Granadillos" },
      { d: -2, est: "Comprado", items: [["Versión 1", "Caballero", "Camel", "3XL"]], abono: 20000, entrega: 4, lug: "Domicilio" },
      { d: -3, est: "Entregado", items: [["Versión 2", "Caballero", "Negro", "L"], ["Versión 2", "Caballero", "Negro", "L"]], abono: 156000, entrega: -1, lug: "Soledad" },
      { d: -4, est: "Liquidado", items: [["Versión 1", "Unisex", "Azul turquesa", "M"]], abono: 39000, entrega: -3, lug: "Plaza de la Paz" },
      { d: -5, est: "Entregado", items: [["Versión 1", "Dama", "Palo de Rosa", "S"], ["Versión 1", "Dama", "Palo de Rosa", "M"]], abono: 50000, entrega: -2, lug: "Centro Histórico" },
      { d: -6, est: "Liquidado", items: [["Versión 2", "Caballero", "Gris", "XL"]], abono: 40000, entrega: -5, lug: "Domicilio" },
      { d: -8, est: "Entregado", items: [["Versión 1", "Unisex", "Mostaza", "L"], ["Versión 1", "Unisex", "Vinotinto", "L"]], abono: 78000, entrega: -6, lug: "Granadillos" },
      { d: -11, est: "Liquidado", items: [["Versión 2", "Dama", "Turquí", "M"]], abono: 40000, entrega: -10, lug: "Buscan en casa de Samir" },
      { d: -14, est: "Entregado", items: [["Versión 1", "Caballero", "Blanco", "2XL"], ["Versión 1", "Caballero", "Camo", "XL"]], abono: 60000, entrega: -12, lug: "Soledad" }
    ];
    plan.forEach(function (row, i) {
      var cli = clientes[i % clientes.length];
      var items = row.items.map(function (t) {
        var precio = PRECIO_BASE + (rnd() < 0.35 ? 2000 : 0);
        return { modelo: t[0], genero: t[1], color: t[2] === "Camo" ? "Camel" : t[2], talla: t[3], precio: precio, cantidad: 1, estado: row.est, abono: 0, abonoYesenia: 0 };
      });
      var porDef = rnd() < 0.12;
      pedidos.push({
        id: "IUB-" + (1001 + i),
        fecha: sumaDias(hoy, row.d),
        fechaEntrega: porDef ? null : sumaDias(hoy, row.entrega),
        entregaPorDefinir: porDef,
        lugar: row.lug,
        entregaPor: rnd() < 0.5 ? "Samir" : "Valentina",
        cliente: cli[0],
        telefono: cli[1],
        vendedor: rnd() < 0.5 ? "Samir" : "Valentina",
        abono: row.abono,
        abonoYesenia: 0,
        nota: i % 4 === 0 ? "Cliente pidió factura." : "",
        items: items
      });
    });

    /* Un par de clientes aparecen con el teléfono escrito de otra forma, para
       que se vea que Cuentas los junta igual por ser la misma persona. */
    pedidos.push({
      id: "IUB-" + (1001 + plan.length), fecha: sumaDias(hoy, -9),
      fechaEntrega: sumaDias(hoy, -2), entregaPorDefinir: false,
      lugar: "Granadillos", entregaPor: "Samir",
      cliente: "Luz Marina Ríos", telefono: "+57 310 447 6621",
      vendedor: "Valentina", abono: 0, abonoYesenia: 0,
      nota: "Mismo cliente, teléfono con prefijo.", items: [
        { modelo: "Versión 1", genero: "Dama", color: "Blanco", talla: "S", precio: 39000, cantidad: 1, estado: "Entregado", abono: 0, abonoYesenia: 0 }
      ]
    });

    state.pedidos = pedidos;

    /* Dos visitas al proveedor, para que la vista no arranque vacía.
       El aporte se reparte entre los pedidos de cada persona por costo. */
    var vivos = pedidos.filter(function (p) { return !esFinalizado(p); });
    var compra1 = vivos.slice(0, 4), compra2 = vivos.slice(4, 7);
    if (compra1.length) {
      var reparto1 = repartirPorCosto(120000, compra1);
      compra1.forEach(function (p) { aplicarAbonoProveedor(p, reparto1[p.id]); });
      state.visitas.push({ id: idVenta(), fecha: sumaDias(hoy, -3), comprador: "Samir", pedidoIds: compra1.map(function (p) { return p.id; }), aportes: { Samir: 120000 } });
    }
    if (compra2.length) {
      var reparto2 = repartirPorCosto(80000, compra2);
      compra2.forEach(function (p) { aplicarAbonoProveedor(p, reparto2[p.id]); });
      state.visitas.push({ id: idVenta(), fecha: sumaDias(hoy, -1), comprador: "Valentina", pedidoIds: compra2.map(function (p) { return p.id; }), aportes: { Valentina: 80000 } });
    }

    /* Un pago entre socios ya registrado. */
    var conGanancia = pedidos.filter(function (p) { return mitadGanancia(p) > 0 && esFinalizado(p); });
    if (conGanancia.length) {
      var pl = conGanancia[0];
      var monto = Math.floor(mitadGanancia(pl) / 2) * 2;
      if (monto > 0) {
        state.liquidaciones.push({
          id: idVenta(), pedidoId: pl.id, fecha: sumaDias(hoy, -6),
          pagador: pl.vendedor, receptor: otroSocioDe(pl.vendedor), monto: monto, nota: "Pago parcial"
        });
      }
    }

    /* Un pedido en la papelera, para que se vea la función. */
    if (pedidos.length > 6) {
      var paraBorrar = pedidos[6];
      state.pedidos = pedidos.filter(function (p) { return p.id !== paraBorrar.id; });
      paraBorrar.eliminadoEn = new Date().toISOString();
      state.papelera.push(paraBorrar);
    }

    guardar();
  }
  /* El abono del proveedor vive por camisa, repartido proporcional a su costo.
     SUMA sobre lo que la camisa ya tenía pagado de visitas anteriores: la base
     es el abono de ESA camisa, no el del pedido (usar el del pedido lo
     contaría una vez por cada camisa y el saldo se dispararía). */
  function aplicarAbonoProveedor(p, monto) {
    var items = p.items || [];
    if (!items.length) return;
    var base = items.map(function (it) { return Number(it.abonoYesenia) || 0; });
    var sumaBase = base.reduce(function (a, b) { return a + b; }, 0);
    var costos = items.map(function (it) { return costoUnitario(it.modelo, it.talla) * (Number(it.cantidad) || 0); });
    var sumaCosto = costos.reduce(function (a, b) { return a + b; }, 0);
    var asignado = 0;
    items.forEach(function (it, i) {
      var parte;
      if (i === items.length - 1) {
        /* El último absorbe el redondeo: la suma da exacta. */
        parte = monto - asignado;
      } else {
        parte = sumaCosto > 0 ? Math.floor(monto * costos[i] / sumaCosto) : Math.floor(monto / items.length);
        asignado += parte;
      }
      it.abonoYesenia = base[i] + parte;
    });
    p.abonoYesenia = sumaBase + monto;
  }
  function semilla(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ── Render: navegación ──────────────────────────────── */
  function cambiarVista(vista) {
    /* Usuarios es solo para administradores: un vendedor que llegue aquí
       vuelve a Inicio sin poder ver la lista de accesos. */
    if (vista === "usuarios" && !esAdmin()) vista = "inicio";
    $$(".nav-item").forEach(function (b) { b.classList.toggle("is-active", b.dataset.vista === vista); });
    $$(".vista").forEach(function (s) { s.classList.toggle("is-active", s.id === "vista-" + vista); });
    moverIndicador();
    if (vista === "inicio") renderInicio();
    if (vista === "pedidos") renderPedidos();
    if (vista === "registro") { renderRegistro(); aplicarRolFormulario(); }
    if (vista === "cuentas") renderCuentas();
    if (vista === "proveedor") renderProveedor();
    if (vista === "liquidaciones") renderLiquidaciones();
    if (vista === "reportes") renderReportes();
    if (vista === "papelera") renderPapelera();
    if (vista === "historial") renderHistorial();
    if (vista === "resumenes") renderResumenes();
    if (vista === "usuarios") { cargarUsuarios(true); renderUsuarios(); }
    var cont = $("#contenido");
    if (cont && window.scrollTo) window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function badgeNav() {
    var n = state.pedidos.filter(function (p) { return !esFinalizado(p); }).length;
    var b = $("#nav-badge");
    b.textContent = n;
    b.hidden = n === 0;
    var bd = $("#nav-badge-desktop");
    if (bd) { bd.textContent = n; bd.hidden = n === 0; }
    var pb = $("#papelera-badge");
    if (pb) { pb.textContent = state.papelera.length; pb.hidden = state.papelera.length === 0; }
  }

  /* El indicador del dock móvil (estilo Bencho .gnav) se desliza hasta la
     pestaña activa. Si la vista no está en la barra, acompaña a "Más". */
  function moverIndicador(animar) {
    var nav = $("#nav"), ind = $("#nav-ind");
    if (!nav || !ind) return;
    var activo = null, i;
    for (i = 0; i < nav.children.length; i++) {
      var b = nav.children[i];
      if (!b.classList || !b.classList.contains("nav-item")) continue;
      if (!b.classList.contains("is-active")) continue;
      if (b.offsetWidth === 0 && b.offsetHeight === 0) continue;
      activo = b; break;
    }
    if (!activo) {
      for (i = 0; i < nav.children.length; i++) {
        var m = nav.children[i];
        if (m.dataset && m.dataset.vista === "__mas") { activo = m; break; }
      }
    }
    if (!activo) { ind.style.opacity = "0"; return; }
    ind.style.opacity = "1";
    if (animar !== false && ind.dataset.fase) ind.style.transition = "";
    else ind.style.transition = "none";
    ind.style.transform = "translateX(" + activo.offsetLeft + "px)";
    ind.style.width = activo.offsetWidth + "px";
    ind.dataset.fase = "1";
  }

  /* ── Render: inicio ──────────────────────────────────── */
  function rangoFechas() {
    var hoy = hoyISO();
    if (state.periodo === "hoy") return { desde: hoy, hasta: hoy };
    if (state.periodo === "7") return { desde: sumaDias(hoy, -6), hasta: hoy };
    if (state.periodo === "30") return { desde: sumaDias(hoy, -29), hasta: hoy };
    return { desde: "0000-01-01", hasta: "9999-12-31" };
  }
  function enRango(p, r) { return p.fecha >= r.desde && p.fecha <= r.hasta; }

  function renderInicio() {
    var r = rangoFechas();
    var lista = state.pedidos.filter(function (p) { return enRango(p, r); });
    var venta = 0, ganancia = 0, camisas = 0, abonos = 0, porEntregar = 0;
    lista.forEach(function (p) {
      var t = totales(p);
      venta += t.venta; ganancia += t.ganancia; camisas += t.cant; abonos += t.abono;
    });
    porEntregar = state.pedidos.filter(function (p) {
      var e = estadoPedido(p).key;
      return e !== "Entregado" && e !== "Liquidado";
    }).length;

    $("#saludo-dia").textContent = "Hoy es " + fechaLarga(hoyISO()) + ".";

    var kpis = [
      { etiqueta: "Venta", valor: cop(venta), nota: plural(lista.length, "pedido", "pedidos"), destacado: true },
      { etiqueta: "Ganancia", valor: cop(ganancia), nota: "venta − costo", positivo: true },
      { etiqueta: "Camisas", valor: String(camisas), nota: "unidades vendidas" },
      { etiqueta: "Por entregar", valor: String(porEntregar), nota: "pedidos activos" }
    ];
    $("#kpis-inicio").innerHTML = kpis.map(function (k, i) {
      return '<div class="kpi' + (k.destacado ? " destacado" : "") + (k.positivo ? " positivo" : "") + '" style="animation-delay:' + (i * 30) + 'ms">' +
        '<span class="kpi-etiqueta">' + esc(k.etiqueta) + '</span>' +
        '<span class="kpi-valor">' + esc(k.valor) + '</span>' +
        '<span class="kpi-nota">' + esc(k.nota) + '</span></div>';
    }).join("");

    renderGrafico7d();
    renderProximas();
  }

  function renderGrafico7d() {
    var hoy = hoyISO();
    var dias = [];
    for (var i = 6; i >= 0; i--) dias.push(sumaDias(hoy, -i));
    var valores = dias.map(function (d) {
      return state.pedidos.filter(function (p) { return p.fecha === d; })
        .reduce(function (a, p) { return a + totales(p).venta; }, 0);
    });
    var max = Math.max.apply(null, valores.concat([1]));
    var etiquetaDia = new Intl.DateTimeFormat("es-CO", { weekday: "short" });
    $("#grafico-7d").innerHTML = dias.map(function (d, idx) {
      var pct = Math.round((valores[idx] / max) * 100);
      var esHoy = d === hoy;
      var nom = etiquetaDia.format(aFecha(d)).replace(".", "");
      return '<div class="barra-col">' +
        '<div class="barra-pista"><div class="barra' + (esHoy ? " hoy" : "") + '" style="height:' + Math.max(pct, 2) + '%;animation-delay:' + (idx * 34) + 'ms">' +
          '<span class="barra-val">' + (valores[idx] ? cop(valores[idx]).replace("$", "") : "") + '</span>' +
        '</div></div>' +
        '<span class="barra-dia">' + esc(nom) + '</span>' +
      '</div>';
    }).join("");
    $("#chart-nota").textContent = "Total: " + cop(valores.reduce(function (a, b) { return a + b; }, 0));
  }

  function renderProximas() {
    var hoy = hoyISO();
    var list = state.pedidos.filter(function (p) {
      var e = estadoPedido(p).key;
      if (e === "Entregado" || e === "Liquidado") return false;
      if (p.entregaPorDefinir) return true;
      return p.fechaEntrega && p.fechaEntrega >= hoy;
    }).sort(function (a, b) {
      if (a.entregaPorDefinir && !b.entregaPorDefinir) return 1;
      if (!a.entregaPorDefinir && b.entregaPorDefinir) return -1;
      return String(a.fechaEntrega).localeCompare(String(b.fechaEntrega));
    }).slice(0, 6);

    var cont = $("#proximas-entregas");
    if (!list.length) {
      cont.innerHTML = '<div class="vacio"><b>Nada por entregar.</b>Cuando registres una venta con entrega pendiente aparecerá aquí.</div>';
      return;
    }
    cont.innerHTML = list.map(function (p, i) {
      var d = p.entregaPorDefinir ? null : aFecha(p.fechaEntrega);
      var dia = d ? String(d.getDate()).padStart(2, "0") : "—";
      var mes = d ? new Intl.DateTimeFormat("es-CO", { month: "short" }).format(d).replace(".", "") : "por def.";
      var cuando = p.entregaPorDefinir ? "Entrega por definir" : fechaCorta(p.fechaEntrega) + " · " + p.lugar;
      var dd = p.entregaPorDefinir ? null : diffDias(p.fechaEntrega);
      if (dd === 0) cuando = "Hoy · " + p.lugar;
      if (dd === 1) cuando = "Mañana · " + p.lugar;
      return '<button class="entrega" type="button" data-abrir="' + esc(p.id) + '" style="animation-delay:' + (i * 28) + 'ms">' +
        '<span class="entrega-fecha"><span class="entrega-dia">' + esc(dia) + '</span><span class="entrega-mes">' + esc(mes) + '</span></span>' +
        '<span class="entrega-info"><span class="entrega-cliente od-truncate">' + esc(p.cliente) + '</span><span class="entrega-meta od-truncate">' + esc(cuando) + '</span></span>' +
        '<span class="entrega-monto">' + esc(cop(totales(p).venta)) + '</span>' +
      '</button>';
    }).join("");
  }

  /* ── Render: cuentas ────────────────────────────────── */
  /* Se agrupa por contacto, no por nombre: el mismo cliente escrito de dos
     formas queda en una sola fila. Los pedidos finalizados no se suman. */
  function gruposCliente() {
    var mapa = {};
    state.pedidos.forEach(function (p) {
      if (esFinalizado(p)) return;
      var k = claveCliente(p);
      if (!mapa[k]) mapa[k] = { clave: k, pedidos: [], telefono: "" };
      mapa[k].pedidos.push(p);
      if (!mapa[k].telefono && String(p.telefono || "").trim()) mapa[k].telefono = String(p.telefono).trim();
    });
    return Object.keys(mapa).map(function (k) {
      var g = mapa[k];
      g.cliente = etiquetaClienteGrupo(g.pedidos);
      g.pedidos.sort(function (a, b) { return String(a.fecha).localeCompare(String(b.fecha)); });
      g.camisas = g.pedidos.reduce(function (a, p) { return a + totales(p).cant; }, 0);
      g.vendido = g.pedidos.reduce(function (a, p) { return a + totales(p).venta; }, 0);
      g.abono = g.pedidos.reduce(function (a, p) { return a + abonosCliente(p); }, 0);
      /* El saldo nunca se muestra negativo: un sobrepago es "pagado". */
      g.saldo = Math.max(g.vendido - g.abono, 0);
      g.vendedores = g.pedidos.map(function (p) { return p.vendedor; })
        .filter(function (v, i, a) { return a.indexOf(v) === i; }).join(", ");
      return g;
    }).sort(function (a, b) { return b.saldo - a.saldo || b.vendido - a.vendido; });
  }
  function renderCuentas() {
    var q = state.qCuentas.trim().toLowerCase();
    var grupos = gruposCliente().filter(function (g) {
      if (!q) return true;
      return [g.cliente, g.telefono, g.clave, g.vendedores].join(" ").toLowerCase().indexOf(q) >= 0;
    });

    var total = grupos.reduce(function (a, g) { return a + g.saldo; }, 0);
    var conDeuda = grupos.filter(function (g) { return g.saldo > 0; }).length;
    var camisas = grupos.reduce(function (a, g) { return a + g.camisas; }, 0);
    var promedio = grupos.length ? Math.round(total / grupos.length) : 0;

    $("#kpis-cuentas").innerHTML = [
      { etiqueta: "Por cobrar", valor: cop(total), nota: grupos.length + (grupos.length === 1 ? " cliente" : " clientes") + " · " + camisas + " camisas", destacado: true },
      { etiqueta: "Clientes con deuda", valor: String(conDeuda), nota: "de " + grupos.length + " en total" },
      { etiqueta: "Deuda promedio", valor: cop(promedio), nota: "por cliente" }
    ].map(function (k, i) {
      return '<div class="kpi' + (k.destacado ? " destacado" : "") + '" style="animation-delay:' + (i * 30) + 'ms">' +
        '<span class="kpi-etiqueta">' + esc(k.etiqueta) + '</span>' +
        '<span class="kpi-valor">' + esc(k.valor) + '</span>' +
        '<span class="kpi-nota">' + esc(k.nota) + '</span></div>';
    }).join("");

    var resumen = $("#cuentas-resumen");
    resumen.hidden = !grupos.length;
    if (grupos.length) resumen.innerHTML = plural(grupos.length, "cliente", "clientes") + " con pedidos activos · <b>" + esc(cop(total)) + "</b> pendientes";

    $("#cuentas-cuerpo").innerHTML = grupos.map(function (g) {
      var saldoCls = g.saldo > 0 ? "" : ' style="color:var(--positivo)"';
      return '<tr data-cliente="' + esc(g.clave) + '">' +
        '<td class="celda-cliente"><span class="cliente-nombre od-truncate">' + esc(g.cliente) + '</span>' +
        '<span class="cliente-sub od-truncate">' + esc(g.telefono || "Sin teléfono") + " · " + plural(g.pedidos.length, "pedido", "pedidos") + (g.vendedores ? " · " + esc(g.vendedores) : "") + '</span></td>' +
        '<td class="num">' + g.pedidos.length + '</td>' +
        '<td class="num">' + g.camisas + '</td>' +
        '<td class="num">' + esc(cop(g.vendido)) + '</td>' +
        '<td class="num" style="color:var(--positivo)">' + esc(cop(g.abono)) + '</td>' +
        '<td class="num"' + saldoCls + '>' + esc(cop(g.saldo)) + '</td>' +
        '<td class="celda-acciones">' +
          '<button class="btn-mini" type="button" data-abono="' + esc(g.clave) + '">Abonar</button>' +
          '<button class="btn-mini" type="button" data-factura="' + esc(g.clave) + '">Factura</button>' +
        '</td>' +
      '</tr>';
    }).join("");

    $("#cuentas-tarjetas").innerHTML = grupos.map(function (g) {
      return '<div class="cuenta-card">' +
        '<div class="cuenta-card-top"><span style="min-width:0">' +
          '<span class="cuenta-card-cliente od-truncate">' + esc(g.cliente) + '</span>' +
          '<span class="cuenta-card-meta od-truncate">' + esc(g.telefono || "Sin teléfono") + " · " + plural(g.pedidos.length, "pedido", "pedidos") + '</span>' +
        '</span>' +
        '<span class="saldo-pill' + (g.saldo > 0 ? "" : " pagado") + '">' + (g.saldo > 0 ? cop(g.saldo) : "Pagado") + '</span></div>' +
        '<div class="cuenta-cifras">' +
          '<div class="visita-cifra"><span>Camisas</span><b>' + g.camisas + '</b></div>' +
          '<div class="visita-cifra"><span>Vendido</span><b>' + esc(cop(g.vendido)) + '</b></div>' +
          '<div class="visita-cifra"><span>Abonado</span><b style="color:var(--positivo)">' + esc(cop(g.abono)) + '</b></div>' +
        '</div>' +
        '<div class="cuenta-accion">' +
          '<button class="btn btn-fantasma" type="button" data-abono="' + esc(g.clave) + '">Registrar abono</button>' +
          '<button class="btn btn-fantasma" type="button" data-factura="' + esc(g.clave) + '">Factura</button>' +
        '</div>' +
      '</div>';
    }).join("");

    var vacio = $("#cuentas-vacio");
    vacio.hidden = grupos.length > 0;
    if (!grupos.length) {
      vacio.innerHTML = q
        ? "<b>Ningún cliente coincide.</b>Prueba otro nombre o teléfono."
        : "<b>No hay cuentas abiertas.</b>Cuando registres una venta aparecerá aquí el saldo del cliente.";
    }
  }

  /* ── Render: proveedor ─────────────────────────────── */
  function visitasConTotales() {
    return state.visitas.map(function (v) {
      var pedidos = v.pedidoIds.map(function (id) {
        return state.pedidos.filter(function (p) { return p.id === id; })[0];
      }).filter(Boolean);
      var costo = pedidos.reduce(function (a, p) { return a + totales(p).costo; }, 0);
      var aportado = Object.keys(v.aportes || {}).reduce(function (a, k) { return a + (Number(v.aportes[k]) || 0); }, 0);
      return {
        visita: v, pedidos: pedidos, costo: costo, aportado: aportado,
        /* El saldo de la visita puede ser negativo si se pagó de más: se rotula liquidado. */
        saldo: costo - aportado,
        pendienteReal: pedidos.reduce(function (a, p) { return a + pendienteProveedor(p); }, 0)
      };
    }).sort(function (a, b) { return String(b.visita.fecha).localeCompare(String(a.visita.fecha)); });
  }
  function renderProveedor() {
    var lista = visitasConTotales();
    var pedidosActivos = state.pedidos.filter(function (p) { return !esFinalizado(p); });
    var totalCosto = pedidosActivos.reduce(function (a, p) { return a + totales(p).costo; }, 0);
    var totalPagado = pedidosActivos.reduce(function (a, p) { return a + pagadoProveedor(p); }, 0);
    var totalPendiente = Math.max(totalCosto - totalPagado, 0);

    $("#kpis-proveedor").innerHTML = [
      { etiqueta: "Costo de pedidos activos", valor: cop(totalCosto), nota: plural(pedidosActivos.length, "pedido", "pedidos"), destacado: true },
      { etiqueta: "Ya pagado", valor: cop(totalPagado), nota: "a " + PROVEEDOR },
      { etiqueta: "Pendiente", valor: cop(totalPendiente), nota: totalPendiente > TOL ? "falta pagar" : "al día" }
    ].map(function (k, i) {
      return '<div class="kpi' + (k.destacado ? " destacado" : "") + '" style="animation-delay:' + (i * 30) + 'ms">' +
        '<span class="kpi-etiqueta">' + esc(k.etiqueta) + '</span>' +
        '<span class="kpi-valor">' + esc(k.valor) + '</span>' +
        '<span class="kpi-nota">' + esc(k.nota) + '</span></div>';
    }).join("");

    var cont = $("#visitas-lista");
    if (!lista.length) {
      cont.innerHTML = '<div class="vacio"><b>Todavía no hay visitas.</b>Cuando le abones a ' + esc(PROVEEDOR) + ", registra la primera visita.</div>";
      return;
    }
    cont.innerHTML = lista.map(function (x) {
      var aportes = Object.keys(x.visita.aportes || {}).filter(function (k) { return (Number(x.visita.aportes[k]) || 0) > 0; });
      var liquidado = x.saldo <= TOL;
      return '<div class="visita">' +
        '<div class="visita-top">' +
          '<span class="visita-fecha">' + esc(fechaCorta(x.visita.fecha)) + '</span>' +
          '<span class="visita-comprador">Compró: ' + esc(x.visita.comprador || "—") + '</span>' +
        '</div>' +
        '<div class="visita-lista">' + x.pedidos.map(function (p) {
          return '<div class="visita-linea"><span><b>' + esc(p.cliente) + '</b> · ' + esc(p.id) +
            ' · ' + cop(pendienteProveedor(p)) + ' pendiente</span></div>';
        }).join("") + '</div>' +
        '<div class="visita-cifras">' +
          '<div class="visita-cifra"><span>Costo</span><b>' + esc(cop(x.costo)) + '</b></div>' +
          '<div class="visita-cifra"><span>Aportó</span><b>' + esc(cop(x.aportado)) + '</b></div>' +
          '<div class="visita-cifra"><span>' + (liquidado ? "Estado" : "Saldo") + '</span><b style="color:' +
            (liquidado ? "var(--positivo)" : "var(--peligro)") + '">' + (liquidado ? "Liquidado" : esc(cop(x.saldo))) + '</b></div>' +
        '</div>' +
        (aportes.length ? '<div class="visita-pie">' + aportes.map(function (k) {
          return '<span class="camisa-chip">' + esc(k) + " aportó " + esc(cop(x.visita.aportes[k])) + '</span>';
        }).join("") + '</div>' : "") +
      '</div>';
    }).join("");
  }

  /* ── Render: liquidaciones ─────────────────────────── */
  function renderLiquidaciones() {
    var deudaSamir = 0, deudaVal = 0, ganSamir = 0, ganVal = 0, perdidas = 0;
    state.pedidos.forEach(function (p) {
      if (p.vendedor !== "Samir" && p.vendedor !== "Valentina") return;
      var t = totales(p);
      var mitad = mitadGanancia(p);
      if (p.vendedor === "Samir") { deudaSamir += saldoSocio(p); ganSamir += mitad * 2; }
      else { deudaVal += saldoSocio(p); ganVal += mitad * 2; }
      if (t.venta - t.costo < 0) perdidas += Math.round((t.costo - t.venta) / 2);
    });

    $("#kpis-liquidaciones").innerHTML = [
      { etiqueta: "Samir → Valentina", valor: cop(deudaSamir), nota: "pendiente por repartir", destacado: true },
      { etiqueta: "Valentina → Samir", valor: cop(deudaVal), nota: "pendiente por repartir" }
    ].map(function (k, i) {
      return '<div class="kpi' + (k.destacado ? " destacado" : "") + '" style="animation-delay:' + (i * 30) + 'ms">' +
        '<span class="kpi-etiqueta">' + esc(k.etiqueta) + '</span>' +
        '<span class="kpi-valor">' + esc(k.valor) + '</span>' +
        '<span class="kpi-nota">' + esc(k.nota) + '</span></div>';
    }).join("") +
    '<div class="kpi" style="animation-delay:60ms"><span class="kpi-etiqueta">Ganancia acumulada</span>' +
      '<span class="kpi-valor">' + esc(cop(ganSamir + ganVal)) + '</span>' +
      '<span class="kpi-nota">Samir ' + esc(cop(ganSamir)) + " · Valentina " + esc(cop(ganVal)) + '</span></div>';

    var nota = $("#nota-perdidas");
    if (perdidas > 0) {
      nota.hidden = false;
      nota.innerHTML = "<b>Pérdidas sin descontar: " + esc(cop(perdidas)) + ".</b> Un pedido vendido por debajo del costo no genera deuda entre socios: la pérdida se la come quien vendió.";
    } else {
      nota.hidden = true;
    }

    var lqs = state.liquidaciones.slice().sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); });
    $("#liq-nota").textContent = lqs.length ? plural(lqs.length, "pago", "pagos") + " · " + cop(lqs.reduce(function (a, l) { return a + (Number(l.monto) || 0); }, 0)) : "";

    $("#liq-cuerpo").innerHTML = lqs.map(function (l) {
      var p = state.pedidos.filter(function (x) { return x.id === l.pedidoId; })[0];
      return '<tr>' +
        '<td class="od-nowrap">' + esc(fechaCorta(l.fecha)) + '</td>' +
        '<td>' + esc(p ? p.cliente + " · " + p.id : "Pedido eliminado") + '</td>' +
        '<td>' + esc(l.pagador) + '</td>' +
        '<td>' + esc(l.receptor) + '</td>' +
        '<td class="num">' + esc(cop(l.monto)) + '</td>' +
        '<td class="celda-acciones"><button class="btn-mini btn-mini-peligro" type="button" data-borrar-liq="' + esc(l.id) + '">Borrar</button></td>' +
      '</tr>';
    }).join("");

    var vacio = $("#liq-vacio");
    vacio.hidden = lqs.length > 0;
    if (!lqs.length) vacio.innerHTML = "<b>No hay pagos entre socios.</b>Cuando repartas una ganancia, queda registrado aquí.";
  }

  /* ── Render: reportes ──────────────────────────────── */
  function renderReportes() {
    var sel = $("#factura-cliente");
    var grupos = gruposCliente();
    sel.innerHTML = grupos.length
      ? grupos.map(function (g) { return '<option value="' + esc(g.clave) + '">' + esc(g.cliente) + "</option>"; }).join("")
      : '<option value="">No hay clientes con saldo</option>';
  }

  /* ── Render: papelera ──────────────────────────────── */
  function renderPapelera() {
    var cont = $("#papelera-lista");
    if (!state.papelera.length) {
      cont.innerHTML = '<div class="vacio"><b>La papelera está vacía.</b>Los pedidos que elimines aparecen aquí y se pueden recuperar.</div>';
      return;
    }
    var conLiq = state.papelera.filter(function (p) {
      return state.liquidaciones.some(function (l) { return l.pedidoId === p.id; });
    });
    cont.innerHTML =
      (conLiq.length ? '<p class="nota-regla">' + conLiq.length + " de estos pedidos tienen pagos entre socios registrados. Si los borras para siempre, ese historial se pierde.</p>" : "") +
      state.papelera.map(function (p) {
        return '<div class="papelera-fila">' +
          '<span class="papelera-info"><b>' + esc(p.cliente) + '</b>' +
          '<small>' + esc(fechaCorta(p.fecha)) + " · " + plural(totales(p).cant, "camisa", "camisas") + " · " + esc(cop(totales(p).venta)) + " · borrado " + esc(fechaCorta(String(p.eliminadoEn || "").slice(0, 10))) + '</small></span>' +
          '<span class="papelera-acciones">' +
            '<button class="btn btn-fantasma" type="button" data-restaurar="' + esc(p.id) + '">Restaurar</button>' +
            '<button class="btn btn-peligro" type="button" data-borrar-def="' + esc(p.id) + '">Borrar para siempre</button>' +
          '</span>' +
        '</div>';
      }).join("");
  }

  /* ── Hoja: abono del cliente ──────────────────────────── */
  var abonoAbierto = null;
  function abrirAbono(clave) {
    var g = gruposCliente().filter(function (x) { return x.clave === clave; })[0];
    if (!g) return;
    abonoAbierto = g;
    $("#abono-titulo").textContent = g.cliente;
    $("#abono-contexto").textContent =
      g.pedidos.length + (g.pedidos.length === 1 ? " pedido activo. " : " pedidos activos. ") +
      "Vendido " + cop(g.vendido) + ", abonado " + cop(g.abono) + ".";
    $("#abono-monto").value = "";
    pintarCifrasAbono();
    /* Atajos de monto, como los de la app original. */
    $("#abono-chips").innerHTML = [10000, 20000, 30000, 50000].map(function (n) {
      return '<button class="chip-rapido" type="button" data-monto="' + n + '">' + esc(cop(n)) + "</button>";
    }).join("") + '<button class="chip-rapido" type="button" data-monto="todo">Todo el saldo</button>';
    $("#capa-abono").hidden = false;
    document.body.style.overflow = "hidden";
    $("#abono-monto").focus();
  }
  function pintarCifrasAbono() {
    if (!abonoAbierto) return;
    var saldo = Math.max(abonoAbierto.vendido - abonoAbierto.abono, 0);
    $("#abono-cifras").innerHTML =
      cifra("Vendido", cop(abonoAbierto.vendido)) +
      cifra("Ya abonado", cop(abonoAbierto.abono)) +
      '<div class="detalle-cifra total"><span>Saldo</span><b>' + esc(cop(saldo)) + "</b></div>";
  }
  function cerrarAbono() { $("#capa-abono").hidden = true; document.body.style.overflow = ""; abonoAbierto = null; }

  function guardarAbono() {
    if (!abonoAbierto) return;
    var monto = Number($("#abono-monto").value) || 0;
    if (monto <= 0) { avisar("Escribe un monto mayor que cero.", null, null); $("#abono-monto").focus(); return; }

    var saldo = Math.max(abonoAbierto.vendido - abonoAbierto.abono, 0);
    /* Sobrepagar no se bloquea: se pregunta, como en la app original. */
    if (saldo > 0 && monto > saldo + TOL) {
      if (!window.confirm("El monto (" + cop(monto) + ") es mayor que el saldo pendiente (" + cop(saldo) + ").\n\n¿Registrarlo de todos modos?")) {
        avisar("El saldo pendiente es " + cop(saldo) + ".", null, null);
        return;
      }
    }

    var peds = abonoAbierto.pedidos.slice();
    var base = Math.floor(monto / peds.length);
    var resto = Math.round(monto - base * peds.length);
    /* El abono se reparte entre los pedidos del cliente. Los pesos sueltos van
       a los primeros, para que la suma dé exacto. */
    peds.forEach(function (p, i) {
      var parte = base + (i < resto ? 1 : 0);
      p.abono = (Number(p.abono) || 0) + parte;
    });

    guardar();
    cerrarAbono();
    renderCuentas(); renderPedidos(); renderInicio();
    avisar("Abono de " + cop(monto) + " registrado a " + abonoAbierto.cliente + ".", null, null);
  }

  /* ── Hoja: visita al proveedor ─────────────────────── */
  function abrirVisita() {
    var disponibles = state.pedidos.filter(function (p) {
      return !esFinalizado(p) && pendienteProveedor(p) > TOL;
    }).sort(function (a, b) { return String(a.fecha).localeCompare(String(b.fecha)); });

    $("#visita-titulo").textContent = "Visita a " + PROVEEDOR;
    $("#visita-cuerpo").innerHTML =
      '<div class="campos">' +
        '<label class="campo"><span class="campo-etiqueta">Fecha</span><input id="v-fecha" type="date" value="' + hoyISO() + '"></label>' +
        '<label class="campo"><span class="campo-etiqueta">Quién compró</span><select id="v-comprador">' +
          VENDEDORES.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + "</option>"; }).join("") +
        '</select></label>' +
      '</div>' +
      '<h3 class="detalle-sub" style="margin-top:var(--s5)">Pedidos a incluir</h3>' +
      (disponibles.length ? disponibles.map(function (p) {
        return '<label class="picker-fila">' +
          '<input type="checkbox" data-pedido="' + esc(p.id) + '">' +
          '<span class="picker-info"><b>' + esc(p.cliente) + '</b><small>' + esc(p.id) + " · " + esc(fechaCorta(p.fecha)) + " · " + esc(p.vendedor) + '</small></span>' +
          '<span class="picker-cifra"><b>' + esc(cop(totales(p).costo)) + '</b><small>costo · falta ' + esc(cop(pendienteProveedor(p))) + '</small></span>' +
        '</label>';
      }).join("") : '<div class="vacio"><b>Nada pendiente con ' + esc(PROVEEDOR) + ".</b>Todos los pedidos activos ya están pagados.</div>") +
      '<h3 class="detalle-sub" style="margin-top:var(--s5)">Quién aporta y cuánto</h3>' +
      '<p class="panel-texto">El monto se reparte entre los pedidos de esa persona proporcional al costo de cada uno.</p>' +
      VENDEDORES.map(function (v) {
        return '<div class="aporte-bloque">' +
          '<div class="aporte-cabeza">' +
            '<input type="checkbox" data-aporte="' + esc(v) + '" id="ap-' + esc(v) + '">' +
            '<label for="ap-' + esc(v) + '" style="flex:1;cursor:pointer"><b>' + esc(v) + '</b></label>' +
            '<input class="monto" type="number" inputmode="numeric" min="0" step="1000" placeholder="0" data-aporte-monto="' + esc(v) + '">' +
          '</div>' +
        '</div>';
      }).join("");

    $("#capa-visita").hidden = false;
    document.body.style.overflow = "hidden";
  }
  function cerrarVisita() { $("#capa-visita").hidden = true; document.body.style.overflow = ""; }

  function guardarVisita() {
    var fecha = $("#v-fecha").value;
    if (!fecha) { avisar("Elige la fecha de la visita.", null, null); return; }
    var comprador = $("#v-comprador").value;
    var sel = $$("#capa-visita input[data-pedido]:checked").map(function (c) { return c.dataset.pedido; });
    if (!sel.length) { avisar("Marca al menos un pedido.", null, null); return; }

    var aportes = {};
    $$("#capa-visita input[data-aporte]:checked").forEach(function (c) {
      var quien = c.dataset.aporte;
      var monto = Number($("#capa-visita [data-aporte-monto='" + quien + "']").value) || 0;
      if (monto > 0) aportes[quien] = monto;
    });
    var claves = Object.keys(aportes);
    if (!claves.length) { avisar("Marca al menos un aporte.", null, null); return; }

    var pedidos = sel.map(function (id) { return state.pedidos.filter(function (p) { return p.id === id; })[0]; }).filter(Boolean);

    /* Cada persona reparte su aporte solo entre SUS pedidos, por costo. */
    var montos = {};
    claves.forEach(function (quien) {
      var suyos = pedidos.filter(function (p) { return p.vendedor === quien; });
      if (!suyos.length) return;
      var reparto = repartirPorCosto(aportes[quien], suyos);
      suyos.forEach(function (p) {
        aplicarAbonoProveedor(p, reparto[p.id]);
        montos[p.id] = (montos[p.id] || 0) + reparto[p.id];
      });
    });

    state.visitas.push({ id: idVenta(), fecha: fecha, comprador: comprador, pedidoIds: sel, montos: montos, aportes: aportes });
    guardar();
    cerrarVisita();
    renderProveedor(); renderPedidos(); renderInicio();
    avisar("Visita guardada: " + cop(claves.reduce(function (a, k) { return a + aportes[k]; }, 0)) + " a " + PROVEEDOR + ".", null, null);
  }

  /* ── Hoja: liquidación entre socios ─────────────────── */
  var liqPedidoId = null;
  function pedidosPendientesLiquidacion(pagador) {
    if (!otroSocioDe(pagador)) return [];
    return state.pedidos.filter(function (p) {
      return p.vendedor === pagador && saldoSocio(p) > TOL;
    }).sort(function (a, b) { return saldoSocio(b) - saldoSocio(a); });
  }
  function abrirLiquidacion() {
    liqPedidoId = null;
    var pag = $("#liq-pagador").value || VENDEDORES[0];
    $("#liq-pagador").innerHTML = VENDEDORES.map(function (v) {
      return '<option value="' + esc(v) + '"' + (v === pag ? " selected" : "") + ">" + esc(v) + "</option>";
    }).join("");
    $("#liq-receptor").innerHTML = VENDEDORES.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + "</option>"; }).join("");
    $("#liq-fecha").value = hoyISO();
    refrescarPedidosLiquidacion();
    $("#capa-liquidacion").hidden = false;
    document.body.style.overflow = "hidden";
  }
  function refrescarPedidosLiquidacion() {
    var pagador = $("#liq-pagador").value;
    var receptor = otroSocioDe(pagador);
    if (receptor) $("#liq-receptor").value = receptor;
    var lista = pedidosPendientesLiquidacion(pagador);
    $("#liq-pedido").innerHTML = lista.length
      ? lista.map(function (p) {
          return '<option value="' + esc(p.id) + '">' + esc(p.cliente) + " · " + esc(fechaCorta(p.fecha)) +
            " · pendiente " + esc(cop(saldoSocio(p))) + "</option>";
        }).join("")
      : '<option value="">No hay pedidos con saldo pendiente</option>';
    liqPedidoId = lista.length ? lista[0].id : null;
    if (liqPedidoId) $("#liq-monto").value = String(Math.round(saldoSocio(pedidoPorId(liqPedidoId)) / 1000) * 1000);
    pintarCifrasLiq();
  }
  function pedidoPorId(id) { return state.pedidos.filter(function (p) { return p.id === id; })[0]; }
  function pintarCifrasLiq() {
    var p = pedidoPorId(liqPedidoId);
    if (!p) { $("#liq-cifras").innerHTML = ""; return; }
    var t = totales(p);
    $("#liq-cifras").innerHTML =
      cifra("Venta", cop(t.venta)) +
      cifra("Costo " + PROVEEDOR, cop(t.costo)) +
      cifra("Ganancia", cop(t.venta - t.costo)) +
      '<div class="detalle-cifra total"><span>Le toca al otro socio</span><b>' + esc(cop(mitadGanancia(p))) + "</b></div>" +
      '<div class="detalle-cifra"><span>Pendiente</span><b>' + esc(cop(saldoSocio(p))) + "</b></div>";
  }
  function cerrarLiquidacion() { $("#capa-liquidacion").hidden = true; document.body.style.overflow = ""; liqPedidoId = null; }

  function guardarLiquidacion() {
    var pagador = $("#liq-pagador").value, receptor = $("#liq-receptor").value;
    var idPed = $("#liq-pedido").value;
    var monto = Number($("#liq-monto").value) || 0;
    var fecha = $("#liq-fecha").value;

    if (!pagador || !receptor) { avisar("Selecciona quién paga y quién recibe.", null, null); return; }
    if (!idPed) { avisar("No hay pedidos con saldo pendiente para " + pagador + ".", null, null); return; }
    if (pagador === receptor) { avisar("El pagador y el receptor deben ser diferentes.", null, null); return; }
    if (!fecha || !(monto > 0)) { avisar("Ingresa una fecha y un monto mayor que cero.", null, null); return; }

    var p = pedidoPorId(idPed);
    if (!p) { avisar("El pedido seleccionado no existe.", null, null); return; }
    if (p.vendedor !== pagador) {
      avisar("Solo " + p.vendedor + " puede registrar la liquidación de sus propios pedidos.", null, null);
      return;
    }
    var esperado = otroSocioDe(pagador);
    if (receptor !== esperado) {
      avisar("Para pedidos de " + pagador + ", el receptor debe ser " + esperado + ".", null, null);
      return;
    }
    var saldo = saldoSocio(p);
    if (monto > saldo + TOL) {
      avisar("El monto supera el saldo pendiente de este pedido (" + cop(saldo) + ").", null, null);
      return;
    }

    state.liquidaciones.push({
      id: idVenta(), pedidoId: p.id, fecha: fecha,
      pagador: pagador, receptor: receptor, monto: monto,
      nota: $("#liq-nota-pago").value.trim()
    });
    guardar();
    cerrarLiquidacion();
    renderLiquidaciones(); renderPedidos(); renderInicio(); renderProveedor();
    avisar("Pago de " + cop(monto) + " registrado: " + pagador + " → " + receptor + ".", null, null);
  }

  /* ── Hoja: factura ─────────────────────────────────── */
  var facturaClave = null;
  function abrirFactura(clave) {
    facturaClave = clave || $("#factura-cliente").value;
    var g = gruposCliente().filter(function (x) { return x.clave === facturaClave; })[0];
    if (!g) { avisar("Elige un cliente con pedidos activos.", null, null); return; }

    $("#factura-titulo").textContent = "Factura · " + g.cliente;
    $("#factura-cuerpo").innerHTML =
      g.pedidos.map(function (p) {
        return '<div class="factura-pedido">' +
          '<div class="factura-pedido-cab">' +
            '<input type="checkbox" data-fp="' + esc(p.id) + '" checked>' +
            '<b>' + esc(p.cliente) + " · " + esc(p.id) + " · " + esc(fechaCorta(p.fecha)) + '</b>' +
            '<span class="kpi-valor" style="font-size:15px">' + esc(cop(totales(p).venta)) + '</span>' +
          '</div>' +
          (p.items || []).map(function (it, idx) {
            return '<label class="factura-camisa">' +
              '<input type="checkbox" data-fc="' + esc(p.id) + '" data-idx="' + idx + '" checked>' +
              '<span>' + esc(it.color) + (it.talla ? " · Talla " + esc(it.talla) : "") + " · " + esc(it.genero) + " · " + esc(it.modelo) + '</span>' +
              '<b>' + esc(cop(it.precio)) + "</b>" +
            "</label>";
          }).join("") +
        '</div>';
      }).join("") +
      '<div class="detalle-cifras" id="factura-resumen" style="margin-top:var(--s4)"></div>';

    actualizarResumenFactura();
    $("#capa-factura").hidden = false;
    document.body.style.overflow = "hidden";
  }
  function cerrarFactura() { $("#capa-factura").hidden = true; document.body.style.overflow = ""; facturaClave = null; }
  function seleccionFactura() {
    return $$("#capa-factura input[data-fc]:checked").map(function (c) {
      var p = pedidoPorId(c.dataset.fc);
      if (!p) return null;
      return { pedido: p, item: (p.items || [])[Number(c.dataset.idx)] };
    }).filter(function (x) { return x && x.item; });
  }
  function actualizarResumenFactura() {
    var sel = seleccionFactura();
    var total = sel.reduce(function (a, x) { return a + (Number(x.item.precio) || 0); }, 0);
    var abono = sel.reduce(function (a, x) { return a + (Number(x.item.abono) || 0); }, 0);
    var saldo = Math.max(total - abono, 0);
    var cont = $("#factura-resumen");
    if (cont) cont.innerHTML =
      cifra("Prendas", String(sel.length)) +
      cifra("Total facturado", cop(total)) +
      cifra("Total recaudado", cop(abono)) +
      '<div class="detalle-cifra total"><span>Saldo pendiente</span><b>' + esc(cop(saldo)) + "</b></div>";
  }
  /* La factura se arma como un documento aparte, listo para imprimir. */
  function generarFactura() {
    var sel = seleccionFactura();
    if (!sel.length) { avisar("Selecciona al menos una camisa.", null, null); return; }
    var g = gruposCliente().filter(function (x) { return x.clave === facturaClave; })[0];
    var total = sel.reduce(function (a, x) { return a + (Number(x.item.precio) || 0); }, 0);
    var abono = sel.reduce(function (a, x) { return a + (Number(x.item.abono) || 0); }, 0);
    var saldo = Math.max(total - abono, 0);
    var notas = [];
    sel.forEach(function (x) {
      var n = String(x.pedido.nota || "").trim();
      if (n && notas.indexOf(n) < 0) notas.push(n);
    });

    var filas = sel.map(function (x, i) {
      var it = x.item;
      var desc = [it.color, it.talla ? "Talla " + it.talla : "", it.genero, it.modelo].filter(Boolean).join(" · ");
      var rest = Math.max((Number(it.precio) || 0) - (Number(it.abono) || 0), 0);
      return "<tr><td>" + (i + 1) + "</td><td>" + esc(desc) +
        '<div style="color:#64748B;font-size:9pt">Pedido: ' + esc(x.pedido.fecha) + " · " + esc(x.pedido.id) + "</div></td>" +
        "<td style='text-align:center'>1</td>" +
        '<td style="text-align:right">' + esc(cop(it.precio)) + "</td>" +
        '<td style="text-align:right">' + esc(cop(it.abono)) + "</td>" +
        '<td style="text-align:right"><span class="badge ' + (rest === 0 ? "badge-ok" : "badge-pend") + '">' + esc(cop(rest)) + "</span></td></tr>";
    }).join("");

    var html = "<!DOCTYPE html><html lang='es-CO'><head><meta charset='utf-8'><title>Factura</title><style>" +
      "@page{margin:10mm}" +
      "body{font-family:'Segoe UI',system-ui,sans-serif;font-size:9.5pt;color:#0F172A;background:#F8FAFC;margin:0;padding:18px}" +
      ".barra{display:flex;gap:8px;justify-content:flex-end;margin-bottom:14px}" +
      ".barra button{font:inherit;padding:8px 14px;border:1px solid #CBD5E1;background:#fff;border-radius:6px;cursor:pointer}" +
      ".barra .primario{background:#0284C7;color:#fff;border-color:#0284C7}" +
      ".cabeza{background:#0284C7;color:#fff;padding:14px 16px;border-radius:8px 8px 0 0}" +
      ".cabeza h1{margin:0;font-size:15pt;letter-spacing:.02em}" +
      ".cabeza p{margin:3px 0 0;opacity:.92;font-size:9pt}" +
      ".cajas{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0}" +
      ".caja{background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:10px}" +
      ".caja span{display:block;font-size:8pt;color:#64748B;text-transform:uppercase;letter-spacing:.04em}" +
      ".caja b{font-size:12pt}" +
      ".dos{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}" +
      ".bloque{background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:12px}" +
      ".bloque h2{margin:0 0 7px;font-size:9pt;text-transform:uppercase;letter-spacing:.06em;color:#64748B}" +
      ".bloque div{display:flex;justify-content:space-between;gap:12px;padding:2px 0;font-size:9.5pt}" +
      "table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden}" +
      "th{background:#F1F5F9;text-align:left;font-size:8pt;text-transform:uppercase;letter-spacing:.04em;color:#475569;padding:9px 10px;border-bottom:1px solid #CBD5E1}" +
      "td{padding:9px 10px;border-bottom:1px solid #E2E8F0;vertical-align:top}" +
      "tfoot td{font-weight:700;background:#F1F5F9;border-top:2px solid #0F172A}" +
      ".badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:8.5pt;font-weight:700}" +
      ".badge-ok{background:#DCFCE7;color:#065F46}.badge-pend{background:#FEF3C7;color:#92400E}" +
      ".notas{margin-top:12px;background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:11px;font-size:9pt}" +
      ".pie{margin-top:16px;text-align:center;font-size:8.5pt;color:#64748B;line-height:1.6}" +
      "@media print{body{background:#fff;padding:0}.barra{display:none}}" +
      "</style></head><body>" +
      "<div class='barra'><button onclick='window.close()'>Cerrar</button><button class='primario' onclick='window.print()'>Imprimir / Guardar PDF</button></div>" +
      "<div class='cabeza'><h1>CAMISAS IUB — FACTURA</h1>" +
      "<p>Cliente: " + esc(g.cliente) + " &nbsp;|&nbsp; " + sel.length + (sel.length === 1 ? " camisa" : " camisas") +
      " &nbsp;|&nbsp; " + g.pedidos.length + (g.pedidos.length === 1 ? " pedido" : " pedidos") +
      " &nbsp;|&nbsp; Fecha: " + esc(fechaLarga(hoyISO())) + "</p></div>" +
      "<div class='cajas'>" +
        "<div class='caja'><span>Total prendas</span><b>" + sel.length + "</b></div>" +
        "<div class='caja'><span>Total facturado</span><b>" + esc(cop(total)) + "</b></div>" +
        "<div class='caja'><span>Total recaudado</span><b>" + esc(cop(abono)) + "</b></div>" +
        "<div class='caja'><span>Saldo pendiente</span><b>" + esc(cop(saldo)) + "</b></div>" +
      "</div>" +
      "<div class='dos'>" +
        "<div class='bloque'><h2>Cliente</h2>" +
          "<div><span>Nombre</span><b>" + esc(g.cliente) + "</b></div>" +
          "<div><span>Teléfono</span><b>" + esc(g.telefono || "—") + "</b></div>" +
          "<div><span>Entrega</span><b>Entrega conjunta</b></div>" +
        "</div>" +
        "<div class='bloque'><h2>Resumen</h2>" +
          "<div><span>Pedidos incluidos</span><b>" + sel.length + (sel.length === 1 ? " camisa" : " camisas") + "</b></div>" +
          "<div><span>Total</span><b>" + esc(cop(total)) + "</b></div>" +
          "<div><span>Abono</span><b>" + esc(cop(abono)) + "</b></div>" +
          "<div><span>Saldo</span><b>" + esc(cop(saldo)) + "</b></div>" +
        "</div>" +
      "</div>" +
      "<table><thead><tr><th>#</th><th>Descripción</th><th style='text-align:center'>Cant.</th>" +
      "<th style='text-align:right'>Precio</th><th style='text-align:right'>Abono</th><th style='text-align:right'>Restante</th></tr></thead>" +
      "<tbody>" + filas + "</tbody>" +
      "<tfoot><tr><td colspan='4' style='text-align:right'>Total</td><td style='text-align:right'>" + esc(cop(total)) + "</td><td></td><td></td></tr>" +
      "<tr><td colspan='5' style='text-align:right'>Abono</td><td style='text-align:right'>" + esc(cop(abono)) + "</td></tr>" +
      "<tr><td colspan='5' style='text-align:right'>Saldo por pagar</td><td style='text-align:right'>" + esc(cop(saldo)) + "</td></tr></tfoot></table>" +
      (notas.length ? "<div class='notas'><b>Notas de los pedidos:</b> " + esc(notas.join(" · ")) + "</div>" : "") +
      "<div class='pie'>Gracias por tu pedido · Camisas IUB<br>" + esc(fechaLarga(hoyISO())) +
      "<br>Este documento no es factura fiscal</div>" +
      "<script>window.onload=function(){setTimeout(function(){window.print()},150)}<\/script>" +
      "</body></html>";

    var v = window.open("", "_blank", "width=820,height=720");
    if (!v) { avisar("Permite las ventanas emergentes para imprimir.", null, null); return; }
    v.document.open(); v.document.write(html); v.document.close();
  }

  /* ── Buscador global (Ctrl+K) ──────────────────────── */
  var buscarIndice = -1, buscarItems = [];
  function abrirBuscar() {
    $("#buscar-input").value = "";
    $("#buscar-resultados").innerHTML = "";
    buscarIndice = -1; buscarItems = [];
    $("#capa-buscar").hidden = false;
    document.body.style.overflow = "hidden";
    $("#buscar-input").focus();
  }
  function cerrarBuscar() { $("#capa-buscar").hidden = true; document.body.style.overflow = ""; }
  function renderBuscar() {
    var q = $("#buscar-input").value.trim().toLowerCase();
    var cont = $("#buscar-resultados");
    if (!q) {
      cont.innerHTML = '<p class="buscar-ayuda">Escribe un cliente, un pedido, un teléfono o un vendedor.</p>';
      buscarItems = []; buscarIndice = -1;
      return;
    }
    buscarItems = state.pedidos.filter(function (p) {
      return [p.cliente, p.telefono, p.vendedor, p.id, p.lugar].join(" ").toLowerCase().indexOf(q) >= 0;
    }).slice(0, 12);
    if (!buscarItems.length) {
      cont.innerHTML = '<p class="buscar-ayuda">Nada coincide con «' + esc($("#buscar-input").value) + "».</p>";
      buscarIndice = -1;
      return;
    }
    buscarIndice = 0;
    cont.innerHTML = buscarItems.map(function (p, i) {
      var t = totales(p);
      return '<button class="buscar-item' + (i === 0 ? " is-activo" : "") + '" type="button" data-buscar-idx="' + i + '" role="option">' +
        '<span class="buscar-item-texto"><b>' + esc(p.cliente) + "</b><small>" + esc(p.id) + " · " + esc(fechaCorta(p.fecha)) + " · " + esc(estadoPedido(p).label) + '</small></span>' +
        '<span class="buscar-item-monto">' + esc(cop(t.venta)) + "</span>" +
      "</button>";
    }).join("");
  }
  function moverBusqueda(delta) {
    if (!buscarItems.length) return;
    buscarIndice = (buscarIndice + delta + buscarItems.length) % buscarItems.length;
    $$("#buscar-resultados .buscar-item").forEach(function (el, i) {
      el.classList.toggle("is-activo", i === buscarIndice);
      if (i === buscarIndice) el.scrollIntoView({ block: "nearest" });
    });
  }
  function elegirBusqueda(i) {
    var p = buscarItems[i];
    if (!p) return;
    cerrarBuscar();
    abrirDetalle(p.id);
  }

  /* ── Exportar a Excel (hojas calculadas, sin dependencias) ── */
  /* Se arma un .xlsx con la biblioteca más simple posible: es un ZIP con XML.
     Para el prototipo basta con una hoja por reporte, con los montos como número
     y las fórmulas del cálculo dentro, igual que hace la app original. */
  function descargarExcel(nombre, hojas) {
    var partes = [], cenefa = "<?xml version='1.0' encoding='UTF-8' standalone='yes'?>";
    function esc2(s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
    }
    function colDe(i) {
      var s = "";
      i = i + 1;
      while (i > 0) { var r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
      return s;
    }
    hojas.forEach(function (h, hi) {
      var filas = "";
      h.filas.forEach(function (fila, ri) {
        var celdas = "";
        fila.forEach(function (c, ci) {
          var ref = colDe(ci) + (ri + 1);
          if (c && typeof c === "object" && c.f) {
            celdas += "<c r='" + ref + "'><f>" + esc2(c.f) + "</f><v>" + (Number(c.v) || 0) + "</v></c>";
          } else if (typeof c === "number" && isFinite(c)) {
            celdas += "<c r='" + ref + "'><v>" + c + "</v></c>";
          } else {
            celdas += "<c r='" + ref + "' t='inlineStr'><is><t xml:space='preserve'>" + esc2(c) + "</t></is></c>";
          }
        });
        filas += "<row r='" + (ri + 1) + "'>" + celdas + "</row>";
      });
      /* Cada entrada del ZIP es un par [nombre, contenido]. */
      partes.push(["xl/worksheets/sheet" + (hi + 1) + ".xml", cenefa +
        "<worksheet xmlns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'>" +
        "<sheetData>" + filas + "</sheetData></worksheet>"]);
    });

    /* libro con las hojas */
    partes.push(["xl/workbook.xml", cenefa +
      "<workbook xmlns='http://schemas.openxmlformats.org/spreadsheetml/2006/main' " +
      "xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships'><sheets>" +
      hojas.map(function (h, i) {
        return "<sheet name='" + esc2(h.nombre.slice(0, 31)) + "' sheetId='" + (i + 1) + "' r:id='rId" + (i + 1) + "'/>";
      }).join("") + "</sheets></workbook>"]);
    partes.push(["xl/_rels/workbook.xml.rels", cenefa +
      "<Relationships xmlns='http://schemas.openxmlformats.org/package/2006/relationships'>" +
      hojas.map(function (h, i) {
        return "<Relationship Id='rId" + (i + 1) + "' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet' Target='worksheets/sheet" + (i + 1) + ".xml'/>";
      }).join("") + "</Relationships>"]);
    partes.push(["_rels/.rels", cenefa +
      "<Relationships xmlns='http://schemas.openxmlformats.org/package/2006/relationships'>" +
      "<Relationship Id='rId1' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument' Target='xl/workbook.xml'/>" +
      "</Relationships>"]);
    partes.push(["[Content_Types].xml", cenefa +
      "<Types xmlns='http://schemas.openxmlformats.org/package/2006/content-types'>" +
      "<Default Extension='rels' ContentType='application/vnd.openxmlformats-package.relationships+xml'/>" +
      "<Default Extension='xml' ContentType='application/xml'/>" +
      "<Override PartName='/xl/workbook.xml' ContentType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'/>" +
      hojas.map(function (h, i) {
        return "<Override PartName='/xl/worksheets/sheet" + (i + 1) + ".xml' ContentType='application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml'/>";
      }).join("") + "</Types>"]);

    var zip = construirZip(partes);
    var blob = new Blob([zip], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 800);
  }
  /* ZIP mínimo, sin compresión (método "stored"): el formato lo permite, y evita
     depender de una biblioteca de compresión para escribir el archivo. */
  function construirZip(entradas) {
    var encoder = new TextEncoder();
    function crc32(buf) {
      var c, tabla = [], n, k;
      for (n = 0; n < 256; n++) {
        c = n;
        for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        tabla[n] = c >>> 0;
      }
      var crc = 0xFFFFFFFF, i;
      for (i = 0; i < buf.length; i++) crc = (tabla[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)) >>> 0;
      return (crc ^ 0xFFFFFFFF) >>> 0;
    }
    function u16(v) { return [v & 255, (v >>> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }

    var locales = [], centrales = [], offset = 0;
    entradas.forEach(function (par) {
      var nombre = encoder.encode(par[0]);
      var datos = encoder.encode(par[1]);
      var crc = crc32(datos);
      var tam = datos.length;

      var cabLocal = [].concat(
        [80, 75, 3, 4], u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(tam), u32(tam), u16(nombre.length), u16(0)
      );
      locales.push(new Uint8Array(cabLocal), nombre, datos);

      var cabCentral = [].concat(
        [80, 75, 1, 2], u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(tam), u32(tam), u16(nombre.length),
        u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset)
      );
      centrales.push(new Uint8Array(cabCentral), nombre);

      offset += 30 + nombre.length + tam;
    });

    var localesBytes = new Uint8Array(locales.reduce(function (a, u) { return a + u.length; }, 0));
    var pos = 0;
    locales.forEach(function (u) { localesBytes.set(u, pos); pos += u.length; });

    var centralesBytes = new Uint8Array(centrales.reduce(function (a, u) { return a + u.length; }, 0));
    pos = 0;
    centrales.forEach(function (u) { centralesBytes.set(u, pos); pos += u.length; });

    var fin = new Uint8Array([].concat(
      [80, 75, 5, 6], u16(0), u16(0), u16(entradas.length), u16(entradas.length),
      u32(centralesBytes.length), u32(offset), u16(0)
    ));

    var out = new Uint8Array(localesBytes.length + centralesBytes.length + fin.length);
    out.set(localesBytes, 0);
    out.set(centralesBytes, localesBytes.length);
    out.set(fin, localesBytes.length + centralesBytes.length);
    return out;
  }
  function exportarCompra() {
    /* Agrupa por género, color, talla y versión: lo que de verdad se lleva la bodega. */
    var mapa = {};
    state.pedidos.filter(function (p) { return !esFinalizado(p); }).forEach(function (p) {
      (p.items || []).forEach(function (it) {
        var k = [it.genero, it.color, it.talla, it.modelo].join("|");
        if (!mapa[k]) mapa[k] = { genero: it.genero, color: it.color, talla: it.talla, modelo: it.modelo, cantidad: 0, venta: 0, costo: 0 };
        var c = Number(it.cantidad) || 0;
        mapa[k].cantidad += c;
        mapa[k].venta += (Number(it.precio) || 0) * c;
        mapa[k].costo += costoUnitario(it.modelo, it.talla) * c;
      });
    });
    var filas = Object.keys(mapa).map(function (k) { return mapa[k]; })
      .sort(function (a, b) {
        return a.modelo.localeCompare(b.modelo) || a.color.localeCompare(b.color) ||
          a.talla.localeCompare(b.talla) || a.genero.localeCompare(b.genero);
      });

    var totalCam = filas.reduce(function (a, f) { return a + f.cantidad; }, 0);
    var totalVenta = filas.reduce(function (a, f) { return a + f.venta; }, 0);
    var totalCosto = filas.reduce(function (a, f) { return a + f.costo; }, 0);

    descargarExcel("Compra_camisas_" + hoyISO() + ".xlsx", [
      {
        nombre: "Lista de compra",
        filas: [["Cantidad", "Género", "Color", "Talla", "Versión"]].concat(
          filas.map(function (f) { return [f.cantidad, f.genero, f.color, f.talla, f.modelo]; })
        )
      },
      {
        nombre: "Resumen",
        filas: [
          ["FECHA DE EXPORTACIÓN", fechaLarga(hoyISO())], [],
          ["Pedidos por comprar", state.pedidos.filter(function (p) { return !esFinalizado(p); }).length],
          ["Camisas por comprar", totalCam],
          ["Valor venta total", totalVenta],
          ["Costo estimado total", totalCosto],
          ["Ganancia estimada", totalVenta - totalCosto]
        ]
      }
    ]);
    avisar("Lista de compra descargada.", null, null);
  }
  function exportarCompleto() {
    var filas = [[
      "ID Pedido", "Fecha Pedido", "Fecha Entrega", "Estado", "Vendedor", "Cliente", "Teléfono",
      "Lugar de entrega", "Entrega por", "Género", "Color", "Talla", "Versión",
      "Precio Unitario", "Costo Unitario", "Cantidad", "Venta Total", "Costo Total",
      "Abono Cliente", "Saldo Pendiente Cliente", "Pagado al Proveedor",
      "Saldo Pendiente Proveedor", "Ganancia Total", "Me queda"
    ]];

    state.pedidos.forEach(function (p) {
      var items = p.items || [];
      if (!items.length) return;
      var n = items.length;
      var t = totales(p);
      var pagoProv = pagadoProveedor(p);
      var base = Math.floor(t.cant / n), resto = t.cant - base * n;
      var abonoCli = abonosCliente(p);

      items.forEach(function (it, idx) {
        var cant = n === 1 ? t.cant : base + (idx < resto ? 1 : 0);
        var pUnit = Number(it.precio) || 0;
        var cUnit = costoUnitario(it.modelo, it.talla);
        var venta = pUnit * cant, costo = cUnit * cant;
        var abono = n === 1 ? abonoCli : Math.round(abonoCli / n);
        var saldo = venta - abono;
        var pendProv = costo - Math.round(pagoProv / n);
        var ganancia = venta - costo;
        var r = idx + 2;
        filas.push([
          p.id, p.fecha, p.entregaPorDefinir ? "Pendiente por definir" : (p.fechaEntrega || ""),
          it.estado || estadoPedido(p).key, p.vendedor, p.cliente, p.telefono || "",
          p.lugar || "", p.entregaPor || "Sin asignar",
          it.genero, it.color, it.talla, it.modelo,
          pUnit, cUnit, cant,
          { f: "N" + r + "*P" + r, v: venta },
          { f: "O" + r + "*P" + r, v: costo },
          abono,
          { f: "Q" + r + "-S" + r, v: saldo },
          Math.round(pagoProv / n),
          { f: "R" + r + "-V" + r, v: pendProv },
          { f: "Q" + r + "-R" + r, v: ganancia },
          /* "Me queda" = saldo del cliente − la mitad de la ganancia.
           Debe decir W<fila>/2: al dividir la cadena salía W1, que
           resta medio número de fila en vez de media ganancia. */
          { f: "T" + r + "-W" + r + "/2", v: saldo - ganancia / 2 }
        ]);
      });
    });

    descargarExcel("Reporte_Ventas_Camisas_IUB_" + hoyISO() + ".xlsx", [{ nombre: "Reporte", filas: filas }]);
    avisar("Reporte completo descargado.", null, null);
  }

  /* ── Papelera ──────────────────────────────────────── */
  function eliminarPedido(id) {
    var idx = state.pedidos.findIndex(function (p) { return p.id === id; });
    if (idx < 0) return;
    var borrado = state.pedidos[idx];
    state.pedidos.splice(idx, 1);
    /* Se guarda una copia para poder deshacer, con la fecha de eliminación. */
    borrado.eliminadoEn = new Date().toISOString();
    state.papelera.push(borrado);
    guardar();
    cerrarDetalle();
    renderPedidos(); renderInicio(); renderCuentas(); renderProveedor(); renderLiquidaciones(); badgeNav();
    avisar("Pedido eliminado.", "Deshacer", function () {
      state.pedidos.splice(idx, 0, borrado);
      state.papelera.pop();
      guardar();
      renderPedidos(); renderInicio(); renderCuentas(); renderProveedor(); renderLiquidaciones(); badgeNav();
    });
  }
  function restaurar(id) {
    var i = state.papelera.findIndex(function (p) { return p.id === id; });
    if (i < 0) return;
    var p = state.papelera[i];
    delete p.eliminadoEn;
    state.papelera.splice(i, 1);
    state.pedidos.push(p);
    guardar();
    renderPapelera(); renderPedidos(); renderInicio(); renderCuentas(); renderProveedor(); renderLiquidaciones(); badgeNav();
    avisar("Pedido restaurado.", null, null);
  }
  function borrarDefinitivo(id) {
    var p = state.papelera.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var conLiq = state.liquidaciones.filter(function (l) { return l.pedidoId === id; }).length;
    var aviso = conLiq
      ? "\n\n⚠ Este pedido tiene " + conLiq + (conLiq === 1 ? " liquidación" : " liquidaciones") +
        " registrada(s). Al borrarlo, ese historial queda apuntando a un pedido que ya no existe."
      : "";
    if (!window.confirm("Borrar para siempre\n\n" + p.cliente + " · " + fechaCorta(p.fecha) +
      " · " + plural(totales(p).cant, "camisa", "camisas") + "\n\nEsto no se puede deshacer." + aviso)) return;
    state.papelera = state.papelera.filter(function (x) { return x.id !== id; });
    guardar();
    renderPapelera(); badgeNav();
    avisar("Pedido borrado para siempre.", null, null);
  }
  function vaciarPapelera() {
    if (!state.papelera.length) { avisar("La papelera ya está vacía.", null, null); return; }
    var total = state.papelera.length;
    var camisas = state.papelera.reduce(function (a, p) { return a + totales(p).cant; }, 0);
    var conLiq = state.papelera.filter(function (p) {
      return state.liquidaciones.some(function (l) { return l.pedidoId === p.id; });
    }).length;
    var nombres = state.papelera.slice(0, 8).map(function (p) { return p.cliente; }).join(" · ");
    if (total > 8) nombres += " y " + (total - 8) + " más";
    var aviso = conLiq
      ? "\n\n⚠ " + conLiq + (conLiq === 1 ? " de esos pedidos tiene" : " de esos pedidos tienen") + " liquidaciones registradas."
      : "";
    if (!window.confirm("Vaciar la papelera\n\nSe borran " + plural(total, "pedido", "pedidos") + " (" +
      plural(camisas, "camisa", "camisas") + ") para siempre.\n\n" + nombres + aviso)) return;
    state.papelera = [];
    guardar();
    renderPapelera(); badgeNav();
    avisar("Papelera vaciada.", null, null);
  }

  /* ── Render: pedidos ─────────────────────────────────── */
  function renderPedidos() {
    var q = state.q.trim().toLowerCase();
    var lista = state.pedidos.filter(function (p) {
      var fin = esFinalizado(p);
      if (state.grupo === "activos" && fin) return false;
      if (state.grupo === "finalizados" && !fin) return false;
      if (state.fVendedor && p.vendedor !== state.fVendedor) return false;
      if (state.fEstado && estadoPedido(p).key !== state.fEstado) return false;
      if (q) {
        var blob = [p.cliente, p.telefono, p.vendedor, p.id, p.lugar].join(" ").toLowerCase();
        if (blob.indexOf(q) < 0) return false;
      }
      return true;
    }).sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); });

    var tot = lista.reduce(function (a, p) {
      var t = totales(p); a.venta += t.venta; a.saldo += t.saldo; a.cant += t.cant; return a;
    }, { venta: 0, saldo: 0, cant: 0 });

    var resumen = $("#pedidos-resumen");
    if (lista.length) {
      resumen.hidden = false;
      resumen.innerHTML = lista.length + (lista.length === 1 ? " pedido" : " pedidos") +
        " · <b>" + esc(cop(tot.venta)) + "</b> en ventas · <b>" + esc(cop(tot.saldo)) + "</b> por cobrar";
    } else {
      resumen.hidden = true;
    }

    renderTabla(lista);
    renderTarjetas(lista);

    var vacio = $("#pedidos-vacio");
    if (!lista.length) {
      vacio.hidden = false;
      vacio.innerHTML = '<b>No hay pedidos en esta vista.</b>Prueba otro filtro o registra una venta nueva.';
    } else {
      vacio.hidden = true;
    }
  }

  function chipsCamisas(p) {
    return (p.items || []).map(function (it) {
      return '<span class="camisa-chip"><span class="chip-color" style="background:' + colorHex(it.color) + '"></span>' +
        esc(it.color) + " · " + esc(it.talla) + " × " + esc(it.cantidad) + '</span>';
    }).join("");
  }

  function renderTabla(lista) {
    $("#pedidos-cuerpo").innerHTML = lista.map(function (p) {
      var t = totales(p), e = estadoPedido(p);
      var entrega = p.entregaPorDefinir ? "Por definir" : fechaCorta(p.fechaEntrega);
      var saldoCls = t.saldo <= 0 ? " style=\"color:var(--positivo)\"" : "";
      return '<tr data-abrir="' + esc(p.id) + '">' +
        '<td class="od-nowrap">' + esc(fechaCorta(p.fecha)) + '</td>' +
        '<td class="celda-cliente"><span class="cliente-nombre od-truncate">' + esc(p.cliente) + '</span><span class="cliente-sub od-truncate">' + esc(p.vendedor) + '</span></td>' +
        '<td class="celda-camisas"><span class="od-truncate">' + esc((p.items || []).map(function (i) { return i.color + " " + i.talla; }).join(" · ")) + '</span></td>' +
        '<td class="num">' + t.cant + '</td>' +
        '<td class="num">' + esc(cop(t.venta)) + '</td>' +
        '<td class="num"' + saldoCls + '>' + esc(cop(t.saldo)) + '</td>' +
        '<td class="od-nowrap">' + esc(entrega) + '</td>' +
        '<td><span class="estado-badge estado-' + e.clase + '"><span class="punto"></span>' + esc(e.label) + '</span></td>' +
        '<td><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></td>' +
      '</tr>';
    }).join("");
  }

  function renderTarjetas(lista) {
    $("#pedidos-tarjetas").innerHTML = lista.map(function (p) {
      var t = totales(p), e = estadoPedido(p);
      return '<button class="pedido-card" type="button" data-abrir="' + esc(p.id) + '">' +
        '<div class="pedido-card-top"><span><span class="pedido-card-cliente od-truncate">' + esc(p.cliente) + '</span>' +
        '<span class="pedido-card-meta od-truncate">' + esc(p.vendedor) + " · " + esc(fechaCorta(p.fecha)) + " · " + esc(p.lugar) + '</span></span>' +
        '<span class="estado-badge estado-' + e.clase + '"><span class="punto"></span>' + esc(e.label) + '</span></div>' +
        '<div class="pedido-card-camisas">' + chipsCamisas(p) + '</div>' +
        '<div class="pedido-card-pie">' +
          '<span><span class="monto-venta">' + esc(cop(t.venta)) + '</span>' +
          '<span class="monto-saldo' + (t.saldo <= 0 ? " pagado" : "") + '">' + (t.saldo <= 0 ? "Pagado" : "Saldo ") + '<b>' + esc(t.saldo <= 0 ? cop(0) : cop(t.saldo)) + '</b></span></span>' +
          '<span class="pedido-card-meta">' + t.cant + (t.cant === 1 ? " camisa" : " camisas") + '</span>' +
        '</div>' +
      '</button>';
    }).join("");
  }

  /* ── Render: registro ────────────────────────────────── */
  function renderRegistro() {
    llenarSelect("#f-vendedor", VENDEDORES);
    llenarSelect("#f-estado", ESTADOS.map(function (e) { return e.label; }));
    llenarSelect("#f-lugar", LUGARES);
    $("#lista-vendedores").innerHTML = VENDEDORES.map(function (v) { return "<option value=\"" + esc(v) + "\">"; }).join("");
    if (!$("#camisa-items").children.length) {
      $("#f-fecha").value = hoyISO();
      agregarFilaCamisa();
    }
    aplicarRolFormulario();
    recalcular();
  }

  function llenarSelect(sel, valores) {
    var el = $(sel);
    el.innerHTML = valores.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + "</option>"; }).join("");
  }

  function opciones(lista, sel) {
    return lista.map(function (v) { return '<option value="' + esc(v) + '"' + (v === sel ? " selected" : "") + ">" + esc(v) + "</option>"; }).join("");
  }

  function agregarFilaCamisa() {
    var row = document.createElement("div");
    row.className = "camisa-item";
    row.innerHTML =
      '<label class="campo"><span class="campo-etiqueta">Modelo</span><select data-campo="modelo">' + opciones(MODELOS, "Versión 1") + "</select></label>" +
      '<label class="campo"><span class="campo-etiqueta">Género</span><select data-campo="genero">' + opciones(GENEROS, "Caballero") + "</select></label>" +
      '<label class="campo"><span class="campo-etiqueta">Color</span><select data-campo="color">' + opciones(COLORES.map(function (c) { return c.n; }), "Negro") + "</select></label>" +
      '<label class="campo"><span class="campo-etiqueta">Talla</span><select data-campo="talla">' + opciones(TALLAS, "M") + "</select></label>" +
      '<label class="campo campo-precio"><span class="campo-etiqueta">Precio</span><input type="number" inputmode="numeric" min="0" step="500" data-campo="precio" value="' + PRECIO_BASE + '"></label>' +
      '<label class="campo campo-cant"><span class="campo-etiqueta">Cant.</span><input type="number" inputmode="numeric" min="1" step="1" data-campo="cantidad" value="1"></label>' +
      '<button class="camisa-quitar" type="button" data-quitar aria-label="Quitar esta camisa"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
    $("#camisa-items").appendChild(row);
    row.querySelector('[data-campo="modelo"]').focus();
    actualizarContador();
    recalcular();
  }

  function leerFila(row) {
    function v(c) { var el = row.querySelector('[data-campo="' + c + '"]'); return el ? el.value : ""; }
    return {
      modelo: v("modelo"), genero: v("genero"), color: v("color"), talla: v("talla"),
      precio: Number(v("precio")) || 0, cantidad: Number(v("cantidad")) || 0,
      estado: $("#f-estado").value || "Pedido"
    };
  }
  function leerFilas() { return $$("#camisa-items .camisa-item").map(leerFila); }
  function actualizarContador() {
    $("#camisa-total").textContent = $$("#camisa-items .camisa-item").length;
  }
  function recalcular() {
    var items = leerFilas();
    var cant = 0, venta = 0, costo = 0;
    items.forEach(function (it) {
      cant += it.cantidad;
      venta += it.precio * it.cantidad;
      costo += costoUnitario(it.modelo, it.talla) * it.cantidad;
    });
    $("#t-camisas").textContent = cant;
    $("#t-venta").textContent = cop(venta);
    $("#t-costo").textContent = cop(costo);
    var abono = Number($("#f-abono").value) || 0;
    $("#t-abono").textContent = cop(abono);
    $("#t-ganancia").textContent = cop(venta - costo);
  }

  function limpiarVenta() {
    $("#camisa-items").innerHTML = "";
    $("#form-venta").reset();
    $("#f-fecha-entrega").disabled = false;
    $("#f-lugar-otro-wrap").hidden = true;
    $("#f-lugar-otro").disabled = true;
    $("#f-fecha").value = hoyISO();
    $("#venta-errores").hidden = true;
    agregarFilaCamisa();
    recalcular();
  }

  function enviarVenta(ev) {
    ev.preventDefault();
    var errores = [];
    var cliente = $("#f-cliente").value.trim();
    if (!cliente) errores.push("Escribe el nombre del cliente.");
    var items = leerFilas();
    if (!items.length) errores.push("Agrega al menos una camisa.");
    items = items.filter(function (it) { return it.cantidad > 0; });
    if (!items.length) errores.push("Cada camisa necesita una cantidad mayor que cero.");
    var sinPrecio = items.some(function (it) { return it.precio <= 0; });
    if (sinPrecio) errores.push("Cada camisa necesita un precio mayor que cero.");

    var alerta = $("#venta-errores");
    if (errores.length) {
      alerta.hidden = false;
      alerta.className = "alerta error";
      alerta.innerHTML = "<b>Revisa el formulario:</b> " + esc(errores.join(" "));
      alerta.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    alerta.hidden = true;

    var lugarSel = $("#f-lugar").value;
    var lugar = lugarSel === "Otro" ? ($("#f-lugar-otro").value.trim() || "Otro") : lugarSel;
    var porDefinir = $("#f-entrega-pendiente").checked;
    var maxId = state.pedidos.reduce(function (m, p) { return Math.max(m, Number(String(p.id).replace(/\D/g, "")) || 0); }, 1000);
    var pedido = {
      id: "IUB-" + (maxId + 1),
      fecha: $("#f-fecha").value || hoyISO(),
      fechaEntrega: porDefinir ? null : ($("#f-fecha-entrega").value || null),
      entregaPorDefinir: porDefinir,
      lugar: lugar,
      entregaPor: $("#f-entrega-por").value.trim(),
      cliente: cliente,
      telefono: $("#f-telefono").value.trim(),
      vendedor: $("#f-vendedor").value,
      abono: Number($("#f-abono").value) || 0,
      nota: $("#f-nota").value.trim(),
      items: items
    };
    state.pedidos.push(pedido);
    guardar();
    badgeNav();
    limpiarVenta();
    cambiarVista("pedidos");
    avisar("Pedido " + pedido.id + " registrado para " + cliente + ".", null, null);
  }

  /* ── Detalle / edición ───────────────────────────────── */
  var pedidoAbierto = null, eliminarPendiente = null;

  function abrirDetalle(id) {
    pedidoAbierto = state.pedidos.filter(function (p) { return p.id === id; })[0];
    if (!pedidoAbierto) return;
    renderDetalle();
    $("#capa-detalle").hidden = false;
    document.body.style.overflow = "hidden";
    $("#cerrar-detalle").focus();
  }
  function cerrarDetalle() {
    $("#capa-detalle").hidden = true;
    document.body.style.overflow = "";
    pedidoAbierto = null;
  }

  function renderDetalle() {
    var p = pedidoAbierto; if (!p) return;
    var t = totales(p), e = estadoPedido(p);
    $("#detalle-titulo").textContent = p.cliente + " · " + p.id;
    var entrega = p.entregaPorDefinir ? "Por definir" : fechaCorta(p.fechaEntrega);

    var lineas = (p.items || []).map(function (it, idx) {
      var opcionesEstado = ESTADOS.map(function (es) {
        return '<option value="' + esc(es.key) + '"' + (es.key === it.estado ? " selected" : "") + ">" + esc(es.label) + "</option>";
      }).join("");
      return '<div class="detalle-linea">' +
        '<span class="chip-color" style="background:' + colorHex(it.color) + '"></span>' +
        '<span class="detalle-linea-info"><span class="detalle-linea-desc od-truncate">' + esc(it.modelo) + " · " + esc(it.genero) + " · " + esc(it.color) + " · " + esc(it.talla) + '</span>' +
        '<span class="cliente-tel">' + esc(cop(it.precio)) + " × " + esc(it.cantidad) + '</span></span>' +
        '<span class="detalle-linea-col" style="min-width:150px"><label class="oculto-visual">Estado de la camisa</label>' +
        '<select data-estado-item="' + idx + '">' + opcionesEstado + "</select></span>" +
      '</div>';
    }).join("");

    $("#detalle-cuerpo").innerHTML =
      '<div class="detalle-seccion"><span class="estado-badge estado-' + e.clase + '" style="margin-bottom:12px"><span class="punto"></span>' + esc(e.label) + '</span>' +
        '<dl class="detalle-datos">' +
          dato("Vendedor", p.vendedor) +
          dato("Teléfono", p.telefono || "—") +
          dato("Fecha del pedido", fechaCorta(p.fecha)) +
          dato("Entrega", entrega) +
          dato("Lugar", p.lugar) +
          dato("Entrega por", p.entregaPor || "—") +
        '</dl></div>' +
      '<div class="detalle-seccion"><h3 class="detalle-sub">Camisas y estado</h3>' + lineas +
        '<div class="detalle-cifras">' +
          cifra("Venta", cop(t.venta)) +
          cifra("Costo Yesenia", cop(t.costo)) +
          cifra("Abono", cop(t.abono)) +
          cifra("Saldo por cobrar", cop(t.saldo)) +
          '<div class="detalle-cifra total"><span>Ganancia</span><b>' + esc(cop(t.ganancia)) + '</b></div>' +
        '</div></div>' +
      (p.nota ? '<div class="detalle-seccion"><h3 class="detalle-sub">Nota</h3><p class="dialogo-texto">' + esc(p.nota) + '</p></div>' : "");

    $("#detalle-acciones").innerHTML =
      '<button class="btn btn-fantasma" type="button" data-accion="entregar">Marcar entregado</button>' +
      '<button class="btn btn-peligro" type="button" data-accion="eliminar">Eliminar</button>' +
      '<button class="btn btn-primaria" type="button" data-accion="cerrar">Listo</button>';
  }
  function dato(k, v) { return '<div class="detalle-dato"><dt>' + esc(k) + '</dt><dd class="od-truncate">' + esc(v) + '</dd></div>'; }
  function cifra(k, v) { return '<div class="detalle-cifra"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>'; }

  function marcarEntregado() {
    if (!pedidoAbierto) return;
    pedidoAbierto.items.forEach(function (it) { it.estado = "Entregado"; });
    guardar(); renderDetalle(); renderPedidos(); renderInicio(); badgeNav();
    avisar("Pedido " + pedidoAbierto.id + " marcado como entregado.", null, null);
  }

  function pedirEliminar() {
    if (!pedidoAbierto) return;
    eliminarPendiente = pedidoAbierto.id;
    $("#aviso-texto").textContent = "Se quitará el pedido " + pedidoAbierto.id + " de " + pedidoAbierto.cliente + ". Podrás deshacerlo un momento.";
    $("#capa-aviso").hidden = false;
    $("#aviso-confirmar").focus();
  }
  function confirmarEliminar() {
    $("#capa-aviso").hidden = true;
    if (!eliminarPendiente) return;
    var id = eliminarPendiente; eliminarPendiente = null;
    var idx = state.pedidos.findIndex(function (p) { return p.id === id; });
    if (idx < 0) return;
    var borrado = state.pedidos[idx];
    state.pedidos.splice(idx, 1);
    guardar();
    cerrarDetalle();
    renderPedidos(); renderInicio(); badgeNav();
    avisar("Pedido eliminado.", "Deshacer", function () {
      state.pedidos.splice(idx, 0, borrado);
      guardar(); renderPedidos(); renderInicio(); badgeNav();
    });
  }

  /* ── Hoja "Más" ─────────────────────────────────────── */
  function abrirMas() {
    $("#capa-mas").hidden = false;
    document.body.style.overflow = "hidden";
    $(".nav-item-mas").setAttribute("aria-expanded", "true");
  }
  function cerrarMas() {
    $("#capa-mas").hidden = true;
    document.body.style.overflow = "";
    $(".nav-item-mas").setAttribute("aria-expanded", "false");
  }

  /* ── Toasts ──────────────────────────────────────────── */
  function avisar(msg, accionTexto, accion) {
    var cont = $("#toasts");
    var el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = '<span class="toast-msg">' + esc(msg) + "</span>";
    var saliendo = false;
    function quitar() {
      if (saliendo) return;
      saliendo = true;
      if (el.parentNode) {
        /* Se quita la entrada con relleno de la animación para poder
           reproducir la salida (fade + desplazamiento) antes de borrar. */
        el.style.animation = "none";
        el.classList.add("saliendo");
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 200);
      }
    }
    if (accionTexto) {
      var b = document.createElement("button");
      b.className = "toast-accion";
      b.type = "button";
      b.textContent = accionTexto;
      b.addEventListener("click", function () { accion && accion(); quitar(); });
      el.appendChild(b);
    }
    cont.appendChild(el);
    setTimeout(quitar, 6500);
  }

  /* ── Tema ────────────────────────────────────────────── */
  function aplicarTema(tema) {
    document.documentElement.setAttribute("data-theme", tema);
    var boton = $("#cambiar-tema");
    if (boton) boton.setAttribute("aria-pressed", tema === "dark" ? "true" : "false");
    try { localStorage.setItem("iub-tema", tema); } catch (e) { /* privado */ }
  }
  function iniciarTema() {
    var guardado = null;
    try { guardado = localStorage.getItem("iub-tema"); } catch (e) { /* privado */ }
    if (guardado === "light" || guardado === "dark") aplicarTema(guardado);
    else {
      var oscuro = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      aplicarTema(oscuro ? "dark" : "light");
    }
  }

  /* ── Eventos ─────────────────────────────────────────── */
  function enlazar() {
    $("#cambiar-tema").addEventListener("click", function () {
      var actual = document.documentElement.getAttribute("data-theme");
      aplicarTema(actual === "dark" ? "light" : "dark");
    });

    document.addEventListener("click", function (ev) {
      var nav = ev.target.closest(".nav-item");
      if (nav) {
        if (nav.dataset.vista === "__mas") { abrirMas(); return; }
        cambiarVista(nav.dataset.vista);
        return;
      }
      var ir = ev.target.closest("[data-ir]");
      if (ir) { cambiarVista(ir.dataset.ir); return; }
      var abrir = ev.target.closest("[data-abrir]");
      if (abrir) { abrirDetalle(abrir.dataset.abrir); return; }
      /* Vistas desde la hoja "Más" */
      var mas = ev.target.closest(".mas-item");
      if (mas) { cerrarMas(); cambiarVista(mas.dataset.vista); return; }
      var itemBuscar = ev.target.closest("[data-buscar-idx]");
      if (itemBuscar) { elegirBusqueda(Number(itemBuscar.dataset.buscarIdx)); return; }
      /* Cuentas */
      var abono = ev.target.closest("[data-abono]");
      if (abono) { abrirAbono(abono.dataset.abono); return; }
      var facturaDe = ev.target.closest("[data-factura]");
      if (facturaDe) { abrirFactura(facturaDe.dataset.factura); return; }
      /* Proveedor */
      if (ev.target.closest("#nueva-visita")) { abrirVisita(); return; }
      /* Liquidaciones */
      if (ev.target.closest("#nueva-liquidacion")) { abrirLiquidacion(); return; }
      var borrarLiq = ev.target.closest("[data-borrar-liq]");
      if (borrarLiq) {
        var iLq = state.liquidaciones.findIndex(function (l) { return l.id === borrarLiq.dataset.borrarLiq; });
        if (iLq >= 0) {
          var lqBorrada = state.liquidaciones[iLq];
          state.liquidaciones.splice(iLq, 1);
          guardar(); renderLiquidaciones(); renderPedidos();
          avisar("Pago eliminado.", "Deshacer", function () {
            state.liquidaciones.splice(iLq, 0, lqBorrada);
            guardar(); renderLiquidaciones(); renderPedidos();
          });
        }
        return;
      }
      /* Papelera */
      var rest = ev.target.closest("[data-restaurar]");
      if (rest) { restaurar(rest.dataset.restaurar); return; }
      var bdef = ev.target.closest("[data-borrar-def]");
      if (bdef) { borrarDefinitivo(bdef.dataset.borrarDef); return; }
      if (ev.target.closest("#vaciar-papelera")) { vaciarPapelera(); return; }
      /* Reportes */
      if (ev.target.closest("#exp-compra")) { exportarCompra(); return; }
      if (ev.target.closest("#exp-completo")) { exportarCompleto(); return; }
      if (ev.target.closest("#abrir-factura")) { abrirFactura($("#factura-cliente").value); return; }
      var quitar = ev.target.closest("[data-quitar]");
      if (quitar) {
        if ($$("#camisa-items .camisa-item").length > 1) {
          quitar.closest(".camisa-item").remove();
        } else {
          avisar("Debe quedar al menos una camisa.", null, null);
        }
        actualizarContador(); recalcular(); return;
      }
      if (ev.target.closest("#camisa-mas")) { agregarFilaCamisa(); return; }
      if (ev.target.closest("#cerrar-detalle") || ev.target.closest('[data-accion="cerrar"]')) { cerrarDetalle(); return; }
      if (ev.target.id === "capa-detalle") { cerrarDetalle(); return; }
      if (ev.target.id === "capa-aviso") { $("#capa-aviso").hidden = true; eliminarPendiente = null; return; }
      if (ev.target.closest("#aviso-cancelar")) { $("#capa-aviso").hidden = true; eliminarPendiente = null; return; }
      if (ev.target.closest("#aviso-confirmar")) { confirmarEliminar(); return; }
      var accion = ev.target.closest("[data-accion]");
      if (accion) {
        if (accion.dataset.accion === "entregar") marcarEntregado();
        if (accion.dataset.accion === "eliminar") pedirEliminar();
        return;
      }
      var per = ev.target.closest(".periodo-op");
      if (per) {
        state.periodo = per.dataset.periodo;
        $$(".periodo-op").forEach(function (b) { b.classList.toggle("is-active", b === per); b.setAttribute("aria-selected", b === per ? "true" : "false"); });
        renderInicio(); return;
      }
      var seg = ev.target.closest(".segmento-op");
      if (seg) {
        state.grupo = seg.dataset.grupo;
        $$(".segmento-op").forEach(function (b) { b.classList.toggle("is-active", b === seg); b.setAttribute("aria-selected", b === seg ? "true" : "false"); });
        renderPedidos(); return;
      }
    });

    document.addEventListener("keydown", function (ev) {
      /* Ctrl+K / Cmd+K abre el buscador global desde cualquier pantalla. */
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === "k" || ev.key === "K")) {
        ev.preventDefault();
        if (!$("#capa-buscar").hidden) { cerrarBuscar(); return; }
        abrirBuscar();
        return;
      }
      if (ev.key === "Escape") {
        var capas = ["#capa-buscar", "#capa-mas", "#capa-factura", "#capa-liquidacion", "#capa-visita", "#capa-abono", "#capa-aviso"];
        for (var i = 0; i < capas.length; i++) {
          if (!$(capas[i]).hidden) {
            if (capas[i] === "#capa-aviso") { eliminarPendiente = null; }
            else if (capas[i] === "#capa-abono") { cerrarAbono(); }
            else if (capas[i] === "#capa-visita") { cerrarVisita(); }
            else if (capas[i] === "#capa-liquidacion") { cerrarLiquidacion(); }
            else if (capas[i] === "#capa-factura") { cerrarFactura(); }
            else if (capas[i] === "#capa-buscar") { cerrarBuscar(); }
            else { cerrarMas(); }
            return;
          }
        }
        if (!$("#capa-detalle").hidden) cerrarDetalle();
        return;
      }
      /* Flechas dentro del buscador global. */
      if (!$("#capa-buscar").hidden) {
        if (ev.key === "ArrowDown") { ev.preventDefault(); moverBusqueda(1); return; }
        if (ev.key === "ArrowUp") { ev.preventDefault(); moverBusqueda(-1); return; }
        if (ev.key === "Enter") { ev.preventDefault(); elegirBusqueda(buscarIndice); return; }
      }
    });

    $("#form-venta").addEventListener("input", function (ev) {
      if (ev.target.id === "f-lugar") {
        var otro = $("#f-lugar").value === "Otro";
        $("#f-lugar-otro-wrap").hidden = !otro;
        $("#f-lugar-otro").disabled = !otro;
        if (otro) $("#f-lugar-otro").focus();
      }
      if (ev.target.id === "f-entrega-pendiente") {
        $("#f-fecha-entrega").disabled = ev.target.checked;
      }
      recalcular();
    });
    $("#form-venta").addEventListener("change", recalcular);
    $("#form-venta").addEventListener("submit", enviarVenta);
    $("#limpiar-venta").addEventListener("click", function () {
      limpiarVenta();
      avisar("Formulario en blanco.", null, null);
    });

    $("#detalle-cuerpo").addEventListener("change", function (ev) {
      var sel = ev.target.closest("[data-estado-item]");
      if (!sel || !pedidoAbierto) return;
      var idx = Number(sel.dataset.estadoItem);
      pedidoAbierto.items[idx].estado = sel.value;
      guardar();
      renderDetalle();
      renderPedidos(); renderInicio(); badgeNav();
    });

    $("#filtro-busqueda").addEventListener("input", function (ev) { state.q = ev.target.value; renderPedidos(); });
    $("#filtro-vendedor").addEventListener("change", function (ev) { state.fVendedor = ev.target.value; renderPedidos(); });
    $("#filtro-estado").addEventListener("change", function (ev) { state.fEstado = ev.target.value; renderPedidos(); });
    $("#filtro-cuentas").addEventListener("input", function (ev) { state.qCuentas = ev.target.value; renderCuentas(); });

    /* Hoja "Más" */
    $("#cerrar-mas").addEventListener("click", cerrarMas);
    $("#capa-mas").addEventListener("click", function (ev) { if (ev.target.id === "capa-mas") cerrarMas(); });

    /* Buscador global */
    $("#buscar-input").addEventListener("input", renderBuscar);

    /* Abono del cliente */
    $("#cerrar-abono").addEventListener("click", cerrarAbono);
    $("#abono-cancelar").addEventListener("click", cerrarAbono);
    $("#abono-guardar").addEventListener("click", guardarAbono);
    $("#abono-monto").addEventListener("input", function () {
      var chips = $$("#abono-chips .chip-rapido");
      chips.forEach(function (c) {
        if (c.dataset.monto === "todo") {
          if (!abonoAbierto) return;
          var saldo = Math.max(abonoAbierto.vendido - abonoAbierto.abono, 0);
          c.classList.toggle("is-activo", Number($("#abono-monto").value) === saldo && saldo > 0);
        } else {
          c.classList.toggle("is-activo", Number($("#abono-monto").value) === Number(c.dataset.monto));
        }
      });
    });
    $("#abono-chips").addEventListener("click", function (ev) {
      var chip = ev.target.closest(".chip-rapido");
      if (!chip || !abonoAbierto) return;
      if (chip.dataset.monto === "todo") {
        $("#abono-monto").value = String(Math.max(abonoAbierto.vendido - abonoAbierto.abono, 0));
      } else {
        $("#abono-monto").value = chip.dataset.monto;
      }
      pintarCifrasAbono();
      $$("#abono-chips .chip-rapido").forEach(function (c) {
        c.classList.toggle("is-activo", c === chip);
      });
    });

    /* Visita al proveedor */
    $("#cerrar-visita").addEventListener("click", cerrarVisita);
    $("#visita-cancelar").addEventListener("click", cerrarVisita);
    $("#visita-guardar").addEventListener("click", guardarVisita);
    $("#capa-visita").addEventListener("click", function (ev) { if (ev.target.id === "capa-visita") cerrarVisita(); });

    /* Liquidación */
    $("#cerrar-liquidacion").addEventListener("click", cerrarLiquidacion);
    $("#liq-cancelar").addEventListener("click", cerrarLiquidacion);
    $("#liq-guardar").addEventListener("click", guardarLiquidacion);
    $("#liq-pagador").addEventListener("change", refrescarPedidosLiquidacion);
    $("#liq-pedido").addEventListener("change", function () {
      liqPedidoId = $("#liq-pedido").value;
      var p = pedidoPorId(liqPedidoId);
      if (p) $("#liq-monto").value = String(Math.round(saldoSocio(p) / 1000) * 1000);
      pintarCifrasLiq();
    });
    $("#capa-liquidacion").addEventListener("click", function (ev) { if (ev.target.id === "capa-liquidacion") cerrarLiquidacion(); });

    /* Factura */
    $("#cerrar-factura").addEventListener("click", cerrarFactura);
    $("#factura-cancelar").addEventListener("click", cerrarFactura);
    $("#factura-generar").addEventListener("click", generarFactura);
    $("#capa-factura").addEventListener("click", function (ev) { if (ev.target.id === "capa-factura") cerrarFactura(); });
    /* Marcar un pedido marca todas sus camisas; si están todas, se marca el pedido. */
    $("#factura-cuerpo").addEventListener("change", function (ev) {
      var pedido = ev.target.closest("[data-fp]");
      if (pedido) {
        $$("#factura-cuerpo [data-fc='" + pedido.dataset.fp + "']").forEach(function (c) { c.checked = pedido.checked; });
      } else {
        var camisa = ev.target.closest("[data-fc]");
        if (camisa) {
          var todas = $$("#factura-cuerpo [data-fc='" + camisa.dataset.fc + "']");
          var marcadas = todas.filter(function (c) { return c.checked; }).length;
          var cab = $("#factura-cuerpo [data-fp='" + camisa.dataset.fc + "']");
          if (cab) cab.checked = marcadas === todas.length;
        }
      }
      actualizarResumenFactura();
    });

    var media = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
    if (media) {
      var cambia = function (m) {
        var guardado = null;
        try { guardado = localStorage.getItem("iub-tema"); } catch (e) { /* privado */ }
        if (!guardado) aplicarTema(m.matches ? "dark" : "light");
      };
      if (media.addEventListener) media.addEventListener("change", cambia);
      else if (media.addListener) media.addListener(cambia);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     Supabase — sesión, roles, carga y sincronización
     Las escrituras reales SOLO ocurren con sesión iniciada. Sin sesión
     o sin red, la app funciona con datos de demostración (localStorage)
     y nunca escribe en la nube. El estado local es la fuente de verdad:
     los ids locales del prototipo ("IUB-1001") siguen mandando y el id de
     la base viaja en _remotoId para poder referenciar los pedidos.
     ══════════════════════════════════════════════════════════════════ */
  var SUPABASE_URL = "https://ifdbpaduvpadotpmojas.supabase.co";
  var SUPABASE_ANON = "sb_publishable_GnC8zI1oNOWrRTxO8iVqEA_E-yf68uq";
  var USER_ROLES_DEFAULT = {
    "admin@gmail.com": { nombre: "Administrador", rol: "admin" },
    "samir@gmail.com": { nombre: "Samir", rol: "vendedor", vendedor: "Samir" },
    "val@gmail.com": { nombre: "Valentina", rol: "vendedor", vendedor: "Valentina" }
  };
  var sb = null;
  var sesion = null;
  var modoDemo = false;
  var online = true;
  var nubePendiente = false;
  var canalAvisos = null;
  var sincroTimer = null;
  var hayCambiosSync = false;
  var usuariosCache = [];
  var syncPedidos = {}, syncLiqs = {}, syncVisitas = {};

  function horaColombia() {
    try {
      return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date());
    } catch (e) {
      var d = new Date();
      return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + ":" + String(d.getSeconds()).padStart(2, "0");
    }
  }
  /* La base guarda los modelos como "Viejo"/"Nuevo"; la interfaz usa
     "Versión 1"/"Versión 2". Estas dos funciones son la única traducción. */
  function modeloAOrig(m) { return /2|nuev/i.test(String(m || "")) ? "Nuevo" : "Viejo"; }
  function protoModelo(m) { return /nuev|2/i.test(String(m || "")) ? "Versión 2" : "Versión 1"; }
  /* La app original guardaba estados viejos: se normalizan a los seis actuales. */
  function normalizarEstado(e) {
    var s = String(e || "").trim().toLowerCase();
    if (!s) return "Pedido";
    if (s.indexOf("bord") >= 0) return "Bordando";
    if (s.indexOf("listo") >= 0) return "Listo para entrega";
    if (s.indexOf("entreg") >= 0) return "Entregado";
    if (s.indexOf("compra") >= 0) return "Comprado";
    if (s.indexOf("liquid") >= 0 || s.indexOf("paga") >= 0) return "Liquidado";
    return "Pedido";
  }
  function coincideVendedor(nombre) {
    var n = String(nombre || "").toLowerCase().trim();
    for (var i = 0; i < VENDEDORES.length; i++) {
      if (VENDEDORES[i].toLowerCase() === n || n.indexOf(VENDEDORES[i].toLowerCase()) >= 0) return VENDEDORES[i];
    }
    return "";
  }
  function rolDeCorreo(email) {
    var e = String(email || "").toLowerCase();
    if (USER_ROLES_DEFAULT[e]) return USER_ROLES_DEFAULT[e];
    return { nombre: e.split("@")[0] || "Usuario", rol: "vendedor", vendedor: coincideVendedor(e) };
  }
  /* En modo demostración no hay usuarios reales: se concede el rol de admin
     para que se pueda recorrer toda la interfaz. */
  function esAdmin() { return !sesion || sesion.rol === "admin"; }

  function iniciarSupabase() {
    try {
      if (typeof window.supabase === "undefined" || !window.supabase.createClient) return false;
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
      return true;
    } catch (e) { sb = null; return false; }
  }

  /* ── Traducción pedido (app) ⇄ fila (base) ─────────────── */
  function pedidoAFila(p, eliminado) {
    var items = p.items || [];
    var primera = items[0] || {};
    var totalCant = items.reduce(function (a, it) { return a + (Number(it.cantidad) || 0); }, 0);
    var itemsJson = items.map(function (it) {
      return {
        modelo: modeloAOrig(it.modelo), genero: it.genero, color: it.color, talla: it.talla,
        cantidad: Number(it.cantidad) || 0, precio: Number(it.precio) || 0,
        costo: costoUnitario(it.modelo, it.talla), estado: it.estado || "Pedido",
        abono: Number(it.abono) || 0, abono_yesenia: Number(it.abonoYesenia) || 0
      };
    });
    var fila = {
      cliente_nombre: p.cliente || "", cliente_telefono: p.telefono || "",
      cliente_programa: "", modelo: modeloAOrig(primera.modelo), genero: primera.genero || "",
      color: primera.color || "", talla: primera.talla || "", cantidad: totalCant,
      precio_unitario: items.length ? (Number(primera.precio) || 0) : 0,
      costo_unitario: items.length ? costoUnitario(primera.modelo, primera.talla) : 0,
      abono: abonosCliente(p), estado: estadoPedido(p).key,
      vendedor: p.vendedor || "", entrega_por: p.entregaPor || "",
      fecha: p.fecha || hoyISO(),
      fecha_entrega: p.entregaPorDefinir ? null : (p.fechaEntrega || null),
      lugar_entrega: p.lugar || "", nota: p.nota || "",
      items_camisa: JSON.stringify(itemsJson),
      finalizado: esFinalizado(p),
      abono_yesenia: pagadoProveedor(p)
    };
    if (eliminado) fila.eliminado_at = p.eliminadoEn || new Date().toISOString();
    return fila;
  }
  function filaAPedido(v) {
    var items = [];
    if (v.items_camisa) {
      var arr = null;
      try { arr = JSON.parse(v.items_camisa); } catch (e) { arr = null; }
      if (arr && arr.length) {
        items = arr.map(function (it) {
          return {
            modelo: protoModelo(it.modelo), genero: it.genero || "Unisex", color: it.color || "",
            talla: it.talla || "M", precio: Number(it.precio) || 0, cantidad: Number(it.cantidad) || 1,
            estado: normalizarEstado(it.estado),
            abono: Number(it.abono) || 0,
            abonoYesenia: Number(it.abono_yesenia != null ? it.abono_yesenia : it.abonoYesenia) || 0
          };
        });
      }
    }
    if (!items.length) {
      var cant = Number(v.cantidad) || 1;
      items = [{
        modelo: protoModelo(v.modelo), genero: v.genero || "Unisex", color: v.color || "",
        talla: v.talla || "M", precio: Number(v.precio_unitario) || 0, cantidad: cant,
        estado: normalizarEstado(v.estado),
        abono: Math.round((Number(v.abono) || 0) / Math.max(cant, 1)), abonoYesenia: 0
      }];
    }
    return {
      _remotoId: v.id,
      id: "IUB-R" + v.id,
      fecha: v.fecha || hoyISO(),
      fechaEntrega: v.fecha_entrega || null,
      entregaPorDefinir: !v.fecha_entrega,
      lugar: v.lugar_entrega || "",
      entregaPor: v.entrega_por || "",
      cliente: v.cliente_nombre || "Sin cliente",
      telefono: v.cliente_telefono || "",
      vendedor: v.vendedor || (sesion && sesion.vendedor) || VENDEDORES[0],
      abono: Number(v.abono) || 0,
      abonoYesenia: Number(v.abono_yesenia) || 0,
      nota: v.nota || "",
      items: items
    };
  }
  function pedidoEncontrado(localId) {
    return state.pedidos.filter(function (x) { return x.id === localId; })[0] ||
      state.papelera.filter(function (x) { return x.id === localId; })[0];
  }
  function remotoDePedido(localId) {
    var p = pedidoEncontrado(localId);
    if (p && p._remotoId) return p._remotoId;
    if (syncPedidos[localId] && syncPedidos[localId].remotoId) return syncPedidos[localId].remotoId;
    var m = /^IUB-R(.+)$/.exec(String(localId));
    return m ? m[1] : null;
  }
  function hashPedido(p, eliminado) { return JSON.stringify(pedidoAFila(p, eliminado)); }
  function hashLiq(l) {
    return JSON.stringify({
      v: remotoDePedido(l.pedidoId), f: l.fecha, pg: l.pagador, re: l.receptor,
      m: Number(l.monto) || 0, n: l.nota || ""
    });
  }

  /* ── Escrituras ──────────────────────────────────────── */
  function escribirPedido(p, fila, eliminado, done) {
    var cuerpo = {};
    for (var k in fila) { if (Object.prototype.hasOwnProperty.call(fila, k)) cuerpo[k] = fila[k]; }
    cuerpo.updated_at = new Date().toISOString();
    cuerpo.eliminado_at = eliminado ? (p.eliminadoEn || cuerpo.updated_at) : null;
    var rid = p._remotoId;
    function fail(err) { nubePendiente = true; avisoFalloNube(err); done(rid || null); }
    if (rid) {
      sb.from("ventas").update(cuerpo).eq("id", rid).then(function (r) {
        if (r.error) return fail(r.error);
        done(rid);
      }, fail);
    } else {
      sb.from("ventas").insert(cuerpo).select().single().then(function (r) {
        if (r.error) return fail(r.error);
        var id = r.data && r.data.id;
        p._remotoId = id;
        done(id || null);
      }, fail);
    }
  }
  function escribirLiq(l, done) {
    var vid = remotoDePedido(l.pedidoId);
    if (vid == null) { done(l._remotoId || null); return; }
    var cuerpo = {
      venta_id: vid, fecha: l.fecha || hoyISO(), pagador: l.pagador || "",
      receptor: l.receptor || "", monto: Number(l.monto) || 0, nota: l.nota || "",
      hora: horaColombia()
    };
    var rid = l._remotoId;
    function fail(err) { nubePendiente = true; avisoFalloNube(err); done(rid || null); }
    if (rid) {
      sb.from("liquidaciones").update(cuerpo).eq("id", rid).then(function (r) {
        if (r.error) return fail(r.error);
        done(rid);
      }, fail);
    } else {
      sb.from("liquidaciones").insert(cuerpo).select().single().then(function (r) {
        if (r.error) return fail(r.error);
        var id = r.data && r.data.id;
        l._remotoId = id;
        done(id || null);
      }, fail);
    }
  }
  function escribirVisita(v, done) {
    if (v._remotoId) { done(v._remotoId); return; }
    var total = Object.keys(v.aportes || {}).reduce(function (a, k) { return a + (Number(v.aportes[k]) || 0); }, 0);
    var compra = {
      fecha: v.fecha || hoyISO(), comprador: v.comprador || "", proveedor: PROVEEDOR,
      observaciones: "", total: total, hora: horaColombia()
    };
    function fail(err) { nubePendiente = true; avisoFalloNube(err); done(null); }
    sb.from("compras_proveedor").insert(compra).select().single().then(function (r) {
      if (r.error) return fail(r.error);
      var cid = r.data && r.data.id;
      v._remotoId = cid;
      var pedidos = (v.pedidoIds || []).map(function (lid) {
        return { compra_id: cid, venta_id: remotoDePedido(lid), monto: Number((v.montos || {})[lid]) || 0 };
      }).filter(function (x) { return x.venta_id != null; });
      var aportes = Object.keys(v.aportes || {}).map(function (k) {
        return { compra_id: cid, persona: k, monto: Number(v.aportes[k]) || 0, fecha: v.fecha || hoyISO(), observacion: "" };
      });
      var cola = [];
      if (pedidos.length) cola.push(sb.from("compra_pedidos").insert(pedidos));
      if (aportes.length) cola.push(sb.from("compra_aportes").insert(aportes));
      return Promise.all(cola).then(function () { done(cid); });
    }, fail);
  }
  function avisoFalloNube(err) {
    nubePendiente = true;
    mostrarBanner("No se pudo guardar en la nube. Revisa tu conexión: los cambios quedan en este equipo.", false);
    if (window.console && err) console.warn("Supabase:", err.message || err);
  }

  /* ── Sincronización por diferencias ──────────────────── */
  function sincroPedidos() {
    var vistos = {};
    state.pedidos.map(function (p) { return { p: p, elim: false }; })
      .concat(state.papelera.map(function (p) { return { p: p, elim: true }; }))
      .forEach(function (par) {
        var p = par.p;
        vistos[p.id] = 1;
        var reg = syncPedidos[p.id];
        if (reg && reg.remotoId && !p._remotoId) p._remotoId = reg.remotoId;
        var h = hashPedido(p, par.elim);
        if (reg && reg.hash === h) return;
        hayCambiosSync = true;
        escribirPedido(p, pedidoAFila(p, par.elim), par.elim, function (rid) {
          syncPedidos[p.id] = { hash: h, remotoId: rid || (reg && reg.remotoId) || null };
        });
      });
    Object.keys(syncPedidos).forEach(function (id) {
      if (vistos[id]) return;
      var reg = syncPedidos[id]; delete syncPedidos[id];
      if (reg && reg.remotoId) sb.from("ventas").delete().eq("id", reg.remotoId).then(function () {}, function () {});
    });
  }
  function sincroLiqs() {
    var vistos = {};
    state.liquidaciones.forEach(function (l) {
      vistos[l.id] = 1;
      var reg = syncLiqs[l.id];
      if (reg && reg.remotoId && !l._remotoId) l._remotoId = reg.remotoId;
      var h = hashLiq(l);
      if (reg && reg.hash === h) return;
      hayCambiosSync = true;
      escribirLiq(l, function (rid) { syncLiqs[l.id] = { hash: h, remotoId: rid || (reg && reg.remotoId) || null }; });
    });
    Object.keys(syncLiqs).forEach(function (id) {
      if (vistos[id]) return;
      var reg = syncLiqs[id]; delete syncLiqs[id];
      if (reg && reg.remotoId) sb.from("liquidaciones").delete().eq("id", reg.remotoId).then(function () {}, function () {});
    });
  }
  function sincroVisitas() {
    var vistos = {};
    state.visitas.forEach(function (v) {
      vistos[v.id] = 1;
      var reg = syncVisitas[v.id];
      if (reg && reg.remotoId) { if (!v._remotoId) v._remotoId = reg.remotoId; return; }
      if (v._remotoId) { syncVisitas[v.id] = { hash: "ok", remotoId: v._remotoId }; return; }
      hayCambiosSync = true;
      escribirVisita(v, function (rid) { syncVisitas[v.id] = { hash: "ok", remotoId: rid }; });
    });
    Object.keys(syncVisitas).forEach(function (id) {
      if (vistos[id]) return;
      var reg = syncVisitas[id]; delete syncVisitas[id];
      if (reg && reg.remotoId) sb.from("compras_proveedor").delete().eq("id", reg.remotoId).then(function () {}, function () {});
    });
  }
  function sincronizarRemoto() {
    if (modoDemo || !sb || !sesion || !online) return;
    hayCambiosSync = false;
    sincroPedidos();
    sincroVisitas();
    sincroLiqs();
    if (hayCambiosSync) {
      nubePendiente = false;
      avisarCambio("datos", "guardó cambios en la app.");
    }
  }
  /* Cada mutación ya llama a guardar(): aquí se dispara el envío, con un
     pequeño retardo para agrupar cambios seguidos en una sola pasada. */
  function programarSincro() {
    if (modoDemo || !sb || !sesion) return;
    if (!online) { nubePendiente = true; return; }
    if (sincroTimer) clearTimeout(sincroTimer);
    sincroTimer = setTimeout(sincronizarRemoto, 500);
  }

  /* ── Carga desde la nube ─────────────────────────────── */
  function aplicarRemoto(ventas, liqs, compras, cped, capo) {
    var idLocalPorRemoto = {};
    var pedidos = [], papelera = [];
    (ventas || []).forEach(function (v) {
      var p = filaAPedido(v);
      idLocalPorRemoto[String(v.id)] = p.id;
      if (v.eliminado_at != null) { p.eliminadoEn = v.eliminado_at; papelera.push(p); }
      else pedidos.push(p);
    });
    state.pedidos = pedidos;
    state.papelera = papelera;

    state.liquidaciones = (liqs || []).map(function (l) {
      return {
        _remotoId: l.id, id: "LIQ-R" + l.id,
        pedidoId: idLocalPorRemoto[String(l.venta_id)] || String(l.venta_id || ""),
        fecha: l.fecha || hoyISO(), pagador: l.pagador || "", receptor: l.receptor || "",
        monto: Number(l.monto) || 0, nota: l.nota || ""
      };
    });

    var cpPorCompra = {}, caPorCompra = {};
    (cped || []).forEach(function (r) { (cpPorCompra[r.compra_id] = cpPorCompra[r.compra_id] || []).push(r); });
    (capo || []).forEach(function (r) { (caPorCompra[r.compra_id] = caPorCompra[r.compra_id] || []).push(r); });
    state.visitas = (compras || []).map(function (c) {
      var ids = [], montos = {};
      (cpPorCompra[c.id] || []).forEach(function (r) {
        var lid = idLocalPorRemoto[String(r.venta_id)] || String(r.venta_id);
        ids.push(lid);
        montos[lid] = Number(r.monto) || 0;
      });
      var aportes = {};
      (caPorCompra[c.id] || []).forEach(function (r) {
        aportes[r.persona] = (aportes[r.persona] || 0) + (Number(r.monto) || 0);
      });
      return {
        _remotoId: c.id, id: "COMP-R" + c.id, fecha: c.fecha || hoyISO(),
        comprador: c.comprador || "", pedidoIds: ids, montos: montos, aportes: aportes
      };
    });

    /* Se fija la foto de sincronización a lo recién cargado para que no se
       reescriba todo en la nube al primer cambio. */
    syncPedidos = {}; syncLiqs = {}; syncVisitas = {};
    state.pedidos.concat(state.papelera).forEach(function (p) {
      syncPedidos[p.id] = { hash: hashPedido(p, p.eliminadoEn != null), remotoId: p._remotoId };
    });
    state.liquidaciones.forEach(function (l) { syncLiqs[l.id] = { hash: hashLiq(l), remotoId: l._remotoId }; });
    state.visitas.forEach(function (v) { syncVisitas[v.id] = { hash: "ok", remotoId: v._remotoId }; });
  }
  function cargarRemoto() {
    function seguro(q) { return Promise.resolve(q).then(function (r) { return r; }, function () { return { data: [] }; }); }
    return Promise.all([
      sb.from("ventas").select("*"),
      seguro(sb.from("liquidaciones").select("*")),
      seguro(sb.from("compras_proveedor").select("*")),
      seguro(sb.from("compra_pedidos").select("*")),
      seguro(sb.from("compra_aportes").select("*"))
    ]).then(function (res) {
      if (res[0].error) throw res[0].error;
      aplicarRemoto(res[0].data || [], (res[1] || {}).data || [], (res[2] || {}).data || [], (res[3] || {}).data || [], (res[4] || {}).data || []);
      cargarUsuarios(false);
    });
  }

  /* ── Sesión ──────────────────────────────────────────── */
  function mostrarCargando(si, texto) {
    var c = $("#cargando-global");
    if (!c) return;
    if (texto) { var t = $("#cargando-texto"); if (t) t.textContent = texto; }
    c.hidden = !si;
  }
  function mostrarBanner(texto, ok) {
    var b = $("#banner-conexion");
    if (!b) return;
    if (!texto) { b.hidden = true; b.classList.remove("ok"); return; }
    var t = $("#banner-conexion-texto");
    if (t) t.textContent = texto;
    b.classList.toggle("ok", !!ok);
    b.hidden = false;
  }
  function pintarSesion() {
    var chip = $("#usuario-chip");
    if (!chip) return;
    chip.classList.toggle("usuario-sesion", !!sesion);
    chip.classList.toggle("usuario-invitado", !sesion);
    var nombre = $("#usuario-nombre"), rol = $("#usuario-rol");
    if (nombre) nombre.textContent = sesion ? (sesion.nombre || sesion.email) : "Iniciar sesión";
    if (rol) rol.textContent = sesion ? (sesion.rol === "admin" ? "Admin" : "Vendedor") : "Cuenta requerida";
    chip.title = sesion ? (sesion.email + " · sesión activa") : "Necesitas iniciar sesión para usar la base real";
    var salir = $("#btn-salir"); if (salir) salir.hidden = !sesion;
    var admin = esAdmin();
    var navU = $("#nav-usuarios"), gruU = $("#nav-grupo-sistema"), masU = $("#mas-usuarios");
    if (navU) navU.hidden = !admin;
    if (gruU) gruU.hidden = !admin;
    if (masU) masU.hidden = !admin;
    aplicarRolFormulario();
  }
  /* Un vendedor solo ve y registra sus propios pedidos: el selector de
     vendedor queda fijo. */
  function aplicarRolFormulario() {
    var fv = $("#f-vendedor");
    if (!fv) return;
    if (sesion && sesion.rol === "vendedor" && sesion.vendedor) {
      fv.value = sesion.vendedor;
      fv.disabled = true;
    } else {
      fv.disabled = false;
    }
  }
  function rolRemoto(email) {
    var e = String(email || "").toLowerCase();
    return Promise.resolve(sb.from("usuarios").select("*").eq("correo", e)).then(function (r) {
      if (!r.error && r.data && r.data.length) {
        var u = r.data[0];
        var admin = String(u.rol || "").toLowerCase().indexOf("admin") >= 0;
        sesion.rol = admin ? "admin" : "vendedor";
        sesion.nombre = u.nombre || sesion.nombre;
        sesion.vendedor = admin ? "" : (coincideVendedor(u.nombre) || "");
      } else {
        var fb = rolDeCorreo(e);
        sesion.rol = fb.rol; sesion.nombre = fb.nombre; sesion.vendedor = fb.vendedor || "";
      }
    }, function () {
      var fb = rolDeCorreo(e);
      sesion.rol = fb.rol; sesion.nombre = fb.nombre; sesion.vendedor = fb.vendedor || "";
    });
  }
  function activarSesion(s) {
    if (!s || !s.user) return;
    var email = s.user.email || "";
    sesion = { id: s.user.id, email: email, rol: "vendedor", vendedor: "", nombre: email };
    modoDemo = false;
    pintarSesion();
    mostrarCargando(true, "Cargando tus datos…");
    rolRemoto(email).then(function () { return cargarRemoto(); }).then(function () {
      mostrarCargando(false);
      pintarSesion();
      renderTodo();
      mostrarBanner(null);
      avisar("Sesión iniciada. Ya trabajas sobre la base real.", null, null);
    }, function () {
      mostrarCargando(false);
      pintarSesion();
      renderTodo();
      mostrarBanner("No se pudieron traer todos los datos de la nube. Revisa tu conexión.", false);
    });
  }
  function exigirLogin() {
    pintarSesion();
    abrirLogin();
    if (navigator.onLine === false) mostrarBanner("Sin conexión: para entrar necesitas internet.", false);
    else mostrarBanner(null);
  }
  function abrirLogin() {
    if (sesion) return;
    var c = $("#capa-login"); if (!c) return;
    var err = $("#login-error"); if (err) err.hidden = true;
    c.hidden = false;
    document.body.style.overflow = "hidden";
    var correo = $("#login-correo"); if (correo) correo.focus();
  }
  function cerrarLogin() {
    var c = $("#capa-login"); if (!c) return;
    c.hidden = true;
    document.body.style.overflow = "";
  }
  function mostrarErrorLogin(msg) {
    var e = $("#login-error");
    if (!e) return;
    e.hidden = false;
    e.textContent = msg;
  }
  function traducirErrorAuth(err) {
    var m = String((err && err.message) || "").toLowerCase();
    if (m.indexOf("invalid login") >= 0 || m.indexOf("invalid credentials") >= 0) return "Correo o contraseña incorrectos.";
    if (m.indexOf("email not confirmed") >= 0) return "Falta confirmar el correo de esta cuenta.";
    if (m.indexOf("rate") >= 0) return "Demasiados intentos. Espera un momento e inténtalo otra vez.";
    return "No se pudo iniciar sesión. Revisa los datos e inténtalo de nuevo.";
  }
  function hacerLogin(ev) {
    if (ev) ev.preventDefault();
    if (!sb) { mostrarErrorLogin("No se pudo conectar con la nube. Revisa tu conexión."); return; }
    var correo = ($("#login-correo").value || "").trim().toLowerCase();
    var clave = $("#login-clave").value || "";
    if (!correo || !clave) { mostrarErrorLogin("Escribe tu correo y tu contraseña."); return; }
    var err = $("#login-error"); if (err) err.hidden = true;
    var boton = $("#login-entrar"); if (boton) boton.disabled = true;
    mostrarCargando(true, "Entrando…");
    sb.auth.signInWithPassword({ email: correo, password: clave }).then(function (r) {
      mostrarCargando(false);
      if (boton) boton.disabled = false;
      if (r.error) { mostrarErrorLogin(traducirErrorAuth(r.error)); return; }
      cerrarLogin();
      activarSesion(r.data && r.data.session);
    }, function () {
      mostrarCargando(false);
      if (boton) boton.disabled = false;
      mostrarErrorLogin("No se pudo conectar. Revisa tu conexión.");
    });
  }
  function pedirCerrarSesion() {
    if (window.confirm("¿Cerrar sesión? Volverás a la pantalla de inicio de sesión.")) cerrarSesion();
  }
  function cerrarSesion() {
    if (!sb) { window.location.reload(); return; }
    mostrarCargando(true, "Cerrando sesión…");
    sb.auth.signOut().then(function () { window.location.reload(); }, function () { window.location.reload(); });
  }

  /* ── Avisos en vivo (Realtime) ───────────────────────── */
  function suscribirAvisos() {
    if (!sb) return;
    try {
      canalAvisos = sb.channel("avisos-camisas-iub", { config: { broadcast: { self: false } } });
      canalAvisos.on("broadcast", { event: "cambio" }, function (msg) {
        var p = (msg && msg.payload) || {};
        if (sesion && (p.autor === sesion.id || p.autorEmail === sesion.email)) return;
        var quien = p.autorEmail || "La otra persona";
        avisar(quien + " " + (p.texto || "guardó un cambio."), "Actualizar", refrescarDesdeNube);
      });
      canalAvisos.subscribe();
    } catch (e) { canalAvisos = null; }
  }
  function avisarCambio(tipo, texto) {
    if (modoDemo || !sb || !canalAvisos || !sesion) return;
    try {
      canalAvisos.send({ type: "broadcast", event: "cambio", payload: { tipo: tipo, texto: texto || "", autor: sesion.id, autorEmail: sesion.email, cuando: Date.now() } });
    } catch (e) { /* silencioso */ }
  }
  function refrescarDesdeNube() {
    if (modoDemo || !sb || !sesion) return;
    mostrarCargando(true, "Actualizando…");
    cargarRemoto().then(function () { renderTodo(); mostrarCargando(false); }, function () { mostrarCargando(false); });
  }

  /* ── Usuarios (solo admin) ───────────────────────────── */
  function cargarUsuarios(render) {
    if (modoDemo || !sb || !sesion) { usuariosCache = []; if (render) renderUsuarios(); return Promise.resolve(); }
    return Promise.resolve(sb.from("usuarios").select("*")).then(function (r) {
      usuariosCache = (!r.error && r.data) ? r.data : [];
      if (render) renderUsuarios();
    }, function () { usuariosCache = []; if (render) renderUsuarios(); });
  }
  function renderUsuarios() {
    var cuerpo = $("#usuarios-cuerpo"); if (!cuerpo) return;
    var aviso = $("#usuarios-aviso"), vacio = $("#usuarios-vacio");
    if (modoDemo) {
      cuerpo.innerHTML = "";
      if (aviso) { aviso.hidden = false; aviso.textContent = "Estás en modo demostración. Inicia sesión como administrador para gestionar usuarios."; }
      if (vacio) vacio.hidden = true;
      return;
    }
    if (aviso) aviso.hidden = true;
    cuerpo.innerHTML = usuariosCache.map(function (u) {
      var admin = String(u.rol || "").toLowerCase().indexOf("admin") >= 0;
      return '<tr>' +
        '<td>' + esc(u.nombre || "—") + '</td>' +
        '<td>' + esc(u.correo || "—") + '</td>' +
        '<td><span class="rol-pill' + (admin ? " rol-admin" : "") + '">' + (admin ? "Administrador" : "Vendedor") + '</span></td>' +
        '<td class="celda-acciones">' +
          '<button class="btn-mini" type="button" data-editar-usuario="' + esc(u.id) + '">Editar</button>' +
          '<button class="btn-mini btn-mini-peligro" type="button" data-borrar-usuario="' + esc(u.id) + '">Quitar</button>' +
        '</td></tr>';
    }).join("");
    if (vacio) {
      vacio.hidden = usuariosCache.length > 0;
      if (!usuariosCache.length) vacio.innerHTML = "<b>Todavía no hay usuarios.</b>Agrega el primero con «Nuevo usuario».";
    }
  }
  function abrirUsuarioForm(id) {
    if (!esAdmin() || modoDemo) { avisar("Necesitas sesión de administrador para gestionar usuarios.", null, null); return; }
    var u = id ? usuariosCache.filter(function (x) { return String(x.id) === String(id); })[0] : null;
    var prev = $("#capa-usuario"); if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
    var capa = document.createElement("div");
    capa.className = "capa capa-centrada";
    capa.id = "capa-usuario";
    capa.innerHTML =
      '<div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="usuario-titulo">' +
        '<h2 class="dialogo-titulo" id="usuario-titulo">' + (u ? "Editar usuario" : "Nuevo usuario") + '</h2>' +
        '<p class="alerta" id="usuario-error" role="alert" hidden></p>' +
        '<label class="campo"><span class="campo-etiqueta">Nombre</span><input id="u-nombre" type="text" value="' + esc(u ? u.nombre : "") + '"></label>' +
        '<label class="campo"><span class="campo-etiqueta">Correo</span><input id="u-correo" type="email" value="' + esc(u ? u.correo : "") + '"' + (u ? " readonly" : "") + '></label>' +
        '<label class="campo"><span class="campo-etiqueta">Rol</span><select id="u-rol">' +
          '<option value="vendedor"' + (u && String(u.rol).toLowerCase().indexOf("admin") < 0 ? " selected" : "") + '>Vendedor</option>' +
          '<option value="admin"' + (u && String(u.rol).toLowerCase().indexOf("admin") >= 0 ? " selected" : "") + '>Administrador</option>' +
        '</select></label>' +
        '<div class="dialogo-acciones">' +
          '<button class="btn btn-fantasma" type="button" data-u-cancelar>Cancelar</button>' +
          '<button class="btn btn-primaria" type="button" data-u-guardar>Guardar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(capa);
    capa.addEventListener("click", function (ev) {
      if (ev.target === capa || ev.target.closest("[data-u-cancelar]")) { capa.parentNode.removeChild(capa); return; }
      if (ev.target.closest("[data-u-guardar]")) guardarUsuario(u, capa);
    });
    var n = $("#u-nombre"); if (n) n.focus();
  }
  function guardarUsuario(u, capa) {
    var nombre = ($("#u-nombre").value || "").trim();
    var correo = ($("#u-correo").value || "").trim().toLowerCase();
    var rol = $("#u-rol").value;
    var err = $("#usuario-error");
    if (!nombre || !correo) { err.hidden = false; err.textContent = "Escribe nombre y correo."; return; }
    var fila = { nombre: nombre, correo: correo, rol: rol };
    var q = u ? sb.from("usuarios").update(fila).eq("id", u.id) : sb.from("usuarios").insert(fila);
    q.then(function (r) {
      if (r.error) { err.hidden = false; err.textContent = "No se pudo guardar: " + r.error.message; return; }
      if (capa && capa.parentNode) capa.parentNode.removeChild(capa);
      avisar(u ? "Usuario actualizado." : "Usuario agregado.", null, null);
      cargarUsuarios(true);
    }, function () { err.hidden = false; err.textContent = "No se pudo guardar. Revisa tu conexión."; });
  }
  function borrarUsuario(id) {
    if (!esAdmin() || modoDemo) return;
    var u = usuariosCache.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!u) return;
    if (!window.confirm("¿Quitar el acceso de " + (u.nombre || u.correo) + "?")) return;
    sb.from("usuarios").delete().eq("id", id).then(function () {
      avisar("Usuario quitado.", null, null);
      cargarUsuarios(true);
    }, function () { avisar("No se pudo quitar el usuario.", null, null); });
  }

  /* ── Render: historial ───────────────────────────────── */
  function renderHistorial() {
    var cont = $("#historial-lista"); if (!cont) return;
    var q = ($("#historial-busqueda") ? $("#historial-busqueda").value : "").trim().toLowerCase();
    var lista = state.pedidos.filter(function (p) {
      if (!esFinalizado(p)) return false;
      if (!q) return true;
      return [p.cliente, p.telefono, p.id, p.vendedor].join(" ").toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); });
    var tot = lista.reduce(function (a, p) { var t = totales(p); a.venta += t.venta; a.cant += t.cant; return a; }, { venta: 0, cant: 0 });
    var res = $("#historial-resumen");
    if (res) res.textContent = lista.length ? plural(lista.length, "pedido", "pedidos") + " · " + cop(tot.venta) + " · " + plural(tot.cant, "camisa", "camisas") : "";
    if (!lista.length) {
      cont.innerHTML = '<div class="vacio"><b>No hay pedidos finalizados.</b>Cuando un pedido se entregue o se liquide aparecerá aquí.</div>';
      return;
    }
    cont.innerHTML = lista.map(function (p) {
      var t = totales(p), e = estadoPedido(p);
      return '<button class="lista-fila" type="button" data-abrir="' + esc(p.id) + '">' +
        '<span class="lista-fila-info"><b>' + esc(p.cliente) + '</b><small>' + esc(p.id) + " · " + esc(fechaCorta(p.fecha)) + " · " + esc(p.vendedor) + '</small></span>' +
        '<span class="lista-fila-cifra"><b>' + esc(cop(t.venta)) + '</b><small>' + esc(e.label) + '</small></span>' +
      '</button>';
    }).join("");
  }

  /* ── Render: resúmenes ───────────────────────────────── */
  function renderResumenes() {
    if (!$("#resumenes-kpis")) return;
    var per = state.resPeriodo || "7";
    var desde = per === "7" ? sumaDias(hoyISO(), -6) : (per === "30" ? sumaDias(hoyISO(), -29) : "0000-01-01");
    var lista = state.pedidos.filter(function (p) { return p.fecha >= desde; });
    var venta = 0, costo = 0, camisas = 0, abonos = 0;
    lista.forEach(function (p) { var t = totales(p); venta += t.venta; costo += t.costo; camisas += t.cant; abonos += abonosCliente(p); });
    var ganancia = venta - costo;
    $("#resumenes-kpis").innerHTML = [
      { etiqueta: "Venta", valor: cop(venta), nota: plural(lista.length, "pedido", "pedidos"), destacado: true },
      { etiqueta: "Ganancia", valor: cop(ganancia), nota: "venta − costo", positivo: ganancia >= 0 },
      { etiqueta: "Camisas", valor: String(camisas), nota: "unidades" },
      { etiqueta: "Por cobrar", valor: cop(Math.max(venta - abonos, 0)), nota: "abonado " + cop(abonos) }
    ].map(function (k, i) {
      return '<div class="kpi' + (k.destacado ? " destacado" : "") + (k.positivo ? " positivo" : "") + '" style="animation-delay:' + (i * 30) + 'ms">' +
        '<span class="kpi-etiqueta">' + esc(k.etiqueta) + '</span>' +
        '<span class="kpi-valor">' + esc(k.valor) + '</span>' +
        '<span class="kpi-nota">' + esc(k.nota) + '</span></div>';
    }).join("");

    var porDia = {};
    lista.forEach(function (p) {
      if (!porDia[p.fecha]) porDia[p.fecha] = { pedidos: 0, camisas: 0, venta: 0, abonos: 0 };
      var t = totales(p);
      porDia[p.fecha].pedidos++; porDia[p.fecha].camisas += t.cant;
      porDia[p.fecha].venta += t.venta; porDia[p.fecha].abonos += abonosCliente(p);
    });
    var dias = Object.keys(porDia).sort(function (a, b) { return b.localeCompare(a); }).slice(0, 31);
    $("#resumenes-dias").innerHTML = dias.length ? dias.map(function (d) {
      var x = porDia[d];
      return '<tr><td class="od-nowrap">' + esc(fechaCorta(d)) + '</td><td class="num">' + x.pedidos + '</td><td class="num">' + x.camisas +
        '</td><td class="num">' + esc(cop(x.venta)) + '</td><td class="num">' + esc(cop(x.abonos)) + '</td></tr>';
    }).join("") : '<tr><td colspan="5" class="vacio">Sin movimientos en el período.</td></tr>';

    var porVend = {};
    lista.forEach(function (p) {
      var k = p.vendedor || "Sin asignar";
      if (!porVend[k]) porVend[k] = { pedidos: 0, camisas: 0, venta: 0, ganancia: 0 };
      var t = totales(p);
      porVend[k].pedidos++; porVend[k].camisas += t.cant; porVend[k].venta += t.venta; porVend[k].ganancia += t.ganancia;
    });
    var vends = Object.keys(porVend).sort(function (a, b) { return porVend[b].venta - porVend[a].venta; });
    $("#resumenes-vendedores").innerHTML = vends.length ? vends.map(function (k) {
      var x = porVend[k];
      return '<div class="lista-fila"><span class="lista-fila-info"><b>' + esc(k) + '</b><small>' + plural(x.pedidos, "pedido", "pedidos") + " · " + plural(x.camisas, "camisa", "camisas") + '</small></span>' +
        '<span class="lista-fila-cifra"><b>' + esc(cop(x.venta)) + '</b><small>ganancia ' + esc(cop(x.ganancia)) + '</small></span></div>';
    }).join("") : '<div class="vacio">Sin datos.</div>';

    var grupos = gruposCliente().filter(function (g) { return g.saldo > 0; }).slice(0, 8);
    $("#resumenes-clientes").innerHTML = grupos.length ? grupos.map(function (g) {
      return '<div class="lista-fila"><span class="lista-fila-info"><b>' + esc(g.cliente) + '</b><small>' + esc(g.telefono || "Sin teléfono") + " · " + plural(g.pedidos.length, "pedido", "pedidos") + '</small></span>' +
        '<span class="lista-fila-cifra"><b>' + esc(cop(g.saldo)) + '</b><small>de ' + esc(cop(g.vendido)) + '</small></span></div>';
    }).join("") : '<div class="vacio">Nadie debe nada. Todo al día.</div>';
  }

  /* ── Exportar listado de pedidos ─────────────────────── */
  function exportarPedidos() {
    var filas = [[
      "ID", "Fecha", "Cliente", "Teléfono", "Vendedor", "Camisas", "Cantidad",
      "Venta", "Abono cliente", "Saldo cliente", "Estado", "Entrega", "Lugar"
    ]];
    state.pedidos.slice().sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); }).forEach(function (p) {
      var t = totales(p);
      filas.push([
        p.id, p.fecha, p.cliente, p.telefono || "", p.vendedor || "",
        (p.items || []).map(function (i) { return i.color + " " + i.talla; }).join(" · "),
        t.cant, t.venta, abonosCliente(p), saldoCliente(p),
        estadoPedido(p).label, p.entregaPorDefinir ? "Por definir" : (p.fechaEntrega || ""), p.lugar || ""
      ]);
    });
    descargarExcel("Pedidos_Camisas_IUB_" + hoyISO() + ".xlsx", [{ nombre: "Pedidos", filas: filas }]);
    avisar("Listado de pedidos descargado.", null, null);
  }

  function renderTodo() {
    badgeNav();
    renderInicio();
    renderPedidos();
    renderCuentas();
    renderProveedor();
    renderLiquidaciones();
    renderReportes();
    renderPapelera();
    renderHistorial();
    renderResumenes();
    if (esAdmin()) renderUsuarios();
  }

  /* ── Login: input de etiqueta flotante (Bencho .lbi) ── */
  function actualizarLbi(campo) {
    var w = campo.closest(".lbi");
    if (!w) return;
    var foco = document.activeElement === campo;
    var lleno = campo.value.length > 0;
    w.setAttribute("data-focus", foco ? "true" : "false");
    w.setAttribute("data-filled", lleno ? "true" : "false");
    var up = foco || lleno;
    w.setAttribute("data-up", up ? "true" : "false");
    if (up) {
      var etiqueta = w.querySelector(".lbi-label");
      if (etiqueta) {
        var ancho = Math.ceil(etiqueta.getBoundingClientRect().width) + 6;
        w.style.setProperty("--lbi-ancho", ancho + "px");
      }
    }
  }
  function iniciarLbi() {
    $$(".lbi").forEach(function (w) {
      var campo = w.querySelector(".lbi-field");
      var etiqueta = w.querySelector(".lbi-label");
      if (!campo || !etiqueta) return;
      if (!etiqueta.getAttribute("data-listos")) {
        var texto = etiqueta.textContent;
        etiqueta.innerHTML = texto.split("").map(function (c, i) {
          return '<span style="--i:' + i + '">' + (c === " " ? "&nbsp;" : c) + "</span>";
        }).join("");
        etiqueta.setAttribute("data-listos", "1");
      }
      campo.addEventListener("focus", function () { actualizarLbi(campo); });
      campo.addEventListener("blur", function () { actualizarLbi(campo); });
      campo.addEventListener("input", function () { actualizarLbi(campo); });
      if (campo.value) actualizarLbi(campo);
    });
    window.addEventListener("resize", function () {
      $$(".lbi").forEach(function (w) {
        var c = w.querySelector(".lbi-field");
        if (c && (c.value.length > 0 || document.activeElement === c)) actualizarLbi(c);
      });
    });
  }

  /* Enganches propios de la capa de sesión/datos, separados de enlazar(). */
  function enlazarV3() {
    iniciarLbi();
    var chip = $("#usuario-chip");
    if (chip) chip.addEventListener("click", function () { if (!sesion) abrirLogin(); });
    var salir = $("#btn-salir");
    if (salir) salir.addEventListener("click", pedirCerrarSesion);
    var fl = $("#form-login");
    if (fl) fl.addEventListener("submit", hacerLogin);
    var lv = $("#login-ver");
    if (lv) lv.addEventListener("click", function () {
      var c = $("#login-clave");
      var ver = c.type === "password";
      c.type = ver ? "text" : "password";
      lv.setAttribute("aria-pressed", ver ? "true" : "false");
      lv.setAttribute("data-show", ver ? "true" : "false");
      actualizarLbi(c);
    });
    var capa = $("#capa-login");
    if (capa) capa.addEventListener("click", function (ev) { if (ev.target.id === "capa-login" && sesion) cerrarLogin(); });

    var hp = $("#historial-busqueda");
    if (hp) hp.addEventListener("input", renderHistorial);
    $$(".periodo-op[data-res-periodo]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.resPeriodo = b.dataset.resPeriodo;
        $$(".periodo-op[data-res-periodo]").forEach(function (x) {
          x.classList.toggle("is-active", x === b);
          x.setAttribute("aria-selected", x === b ? "true" : "false");
        });
        renderResumenes();
      });
    });
    var nu = $("#nuevo-usuario");
    if (nu) nu.addEventListener("click", function () { abrirUsuarioForm(null); });

    document.addEventListener("click", function (ev) {
      if (ev.target.closest("#exp-pedidos")) { exportarPedidos(); return; }
      var eu = ev.target.closest("[data-editar-usuario]");
      if (eu) { abrirUsuarioForm(eu.dataset.editarUsuario); return; }
      var bu = ev.target.closest("[data-borrar-usuario]");
      if (bu) { borrarUsuario(bu.dataset.borrarUsuario); return; }
    });
  }

  /* Arranque de la capa de nube: sin sesión activa se exige el login y la
     app queda bloqueada detrás de la pantalla de acceso. */
  function arrancarNube() {
    online = navigator.onLine !== false;
    window.addEventListener("online", function () { online = true; mostrarBanner(null); programarSincro(); });
    window.addEventListener("offline", function () { online = false; mostrarBanner("Sin conexión: para guardar o consultar necesitas internet.", false); });
    if (!iniciarSupabase()) {
      exigirLogin();
      mostrarBanner("No se pudo cargar la librería de la nube. Revisa tu conexión.", false);
      return;
    }
    if (!online) mostrarBanner("Sin conexión: para entrar necesitas internet.", false);
    suscribirAvisos();
    Promise.resolve(sb.auth.getSession()).then(function (r) {
      var s = r && r.data && r.data.session;
      if (s) activarSesion(s);
      else exigirLogin();
    }, function () { exigirLogin(); });
  }

  /* ── Arranque ────────────────────────────────────────── */
  function init() {
    iniciarTema();
    cargar();
    badgeNav();
    llenarSelectFiltro("#filtro-vendedor", VENDEDORES, "Todos los vendedores");
    var fe = $("#filtro-estado");
    fe.innerHTML = '<option value="">Todos los estados</option>' + ESTADOS.map(function (e) { return '<option value="' + esc(e.key) + '">' + esc(e.label) + "</option>"; }).join("");
    enlazar();
    enlazarV3();
    moverIndicador(false);
    window.addEventListener("resize", function () { moverIndicador(false); });
    pintarSesion();
    renderTodo();
    arrancarNube();
  }
  function llenarSelectFiltro(sel, valores, etiqueta) {
    var el = $(sel);
    el.innerHTML = '<option value="">' + esc(etiqueta) + "</option>" + valores.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + "</option>"; }).join("");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
