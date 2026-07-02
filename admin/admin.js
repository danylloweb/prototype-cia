/* ============================================================
   CIA DO CORPO — Admin App (client-side SPA)
   Dashboard de telemetria + CRUD de unidades, popups/campanhas,
   conteúdo/oferta e integrações de APIs (GTM/GA4/Meta/etc.).
   ============================================================ */
(function (w, d) {
  var DATA = w.CDC.data;
  var AUTH_KEY = "cdc_admin_auth", PASS_KEY = "cdc_admin_pass";
  var cfg = DATA.get();
  var chartRef = null;

  /* ---------- utils ---------- */
  function $(s, r) { return (r || d).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); }
  function elFrom(html) { var t = d.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
  function esc(s) { return (s == null ? "" : String(s)).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  function toast(msg, err) { var t = $("#toast"); t.textContent = msg; t.className = "toast show" + (err ? " err" : ""); setTimeout(function () { t.className = "toast"; }, 2600); }
  function save() { cfg = DATA.save(cfg); toast("Alterações salvas ✓"); }
  function slug(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function download(name, content, type) {
    var b = new Blob([content], { type: type || "application/json" }); var u = URL.createObjectURL(b);
    var a = d.createElement("a"); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u);
  }

  /* ---------- auth ---------- */
  function currentPass() { return localStorage.getItem(PASS_KEY) || (cfg.admin && cfg.admin.passHint) || "ciadocorpo2026"; }
  function doLogin(e) {
    e.preventDefault();
    var u = $("#lg-user").value.trim(), p = $("#lg-pass").value;
    if (u === (cfg.admin ? cfg.admin.user : "admin") && p === currentPass()) {
      sessionStorage.setItem(AUTH_KEY, "1"); showApp();
    } else { $("#lg-err").textContent = "Usuário ou senha inválidos."; }
  }
  function showApp() {
    $("#login").classList.add("hidden"); $("#app").classList.remove("hidden");
    route(location.hash.replace("#", "") || "dashboard");
  }
  function logout() { sessionStorage.removeItem(AUTH_KEY); location.hash = ""; $("#app").classList.add("hidden"); $("#login").classList.remove("hidden"); }

  /* ---------- modal ---------- */
  function openModal(title, bodyHtml, onSave, saveLabel) {
    var host = $("#modalHost");
    var m = elFrom(
      '<div class="modal-bg"><div class="modal">' +
        '<div class="modal-head"><h3>' + esc(title) + '</h3><button class="x-btn" data-x>&times;</button></div>' +
        '<div class="modal-body">' + bodyHtml + '</div>' +
        '<div class="modal-foot"><button class="btn ghost" data-x>Cancelar</button>' +
        (onSave ? '<button class="btn primary" data-save>' + (saveLabel || "Salvar") + '</button>' : '') + '</div>' +
      '</div></div>');
    host.appendChild(m);
    function close() { m.remove(); }
    $all("[data-x]", m).forEach(function (b) { b.onclick = close; });
    m.addEventListener("click", function (e) { if (e.target === m) close(); });
    var sv = $("[data-save]", m); if (sv) sv.onclick = function () { if (onSave(m) !== false) close(); };
    return m;
  }

  /* ============================================================
     VIEWS
     ============================================================ */
  var titles = { dashboard: "Dashboard", unidades: "Unidades", planos: "Planos", popups: "Popups & Campanhas", clube: "Clube & Parceiros", grade: "Grade de Aulas", conteudo: "Conteúdo & Oferta", integracoes: "Integrações", config: "Configurações" };
  var WEEKDAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

  function route(name) {
    if (!titles[name]) name = "dashboard";
    if (!sessionStorage.getItem(AUTH_KEY)) return;
    cfg = DATA.get();
    $("#pageTitle").textContent = titles[name];
    $("#pageActions").innerHTML = "";
    $all("#nav a").forEach(function (a) { a.classList.toggle("active", a.getAttribute("data-route") === name); });
    location.hash = name;
    views[name]();
    $("#side").classList.remove("open");
  }

  var views = {};

  /* ---------- DASHBOARD ---------- */
  function getEvents() { try { return JSON.parse(localStorage.getItem("cdc_events") || "[]"); } catch (e) { return []; } }
  views.dashboard = function () {
    var range = parseInt(sessionStorage.getItem("cdc_dash_range") || "30", 10);
    var since = Date.now() - range * 864e5;
    var ev = getEvents().filter(function (x) { return x.t >= since; });
    function count(n) { return ev.filter(function (x) { return x.e === n; }).length; }
    var wa = count("whatsapp_click"), call = count("call_click"), lead = count("lead_submit");
    var pv = count("page_view"), pop = count("popup_view"), popcta = count("popup_cta");
    var conv = wa + call + lead;
    var rate = pv ? ((conv / pv) * 100).toFixed(1) : "0.0";

    var html =
      '<div class="grid cols-4" style="margin-bottom:18px">' +
        kpi("Cliques WhatsApp", wa, waIcon(), "Conversa iniciada") +
        kpi("Ligações", call, phoneIcon(), "Click-to-call") +
        kpi("Leads (form)", lead, leadIcon(), "Formulário enviado") +
        kpi("Taxa de conversão", rate + "%", rateIcon(), conv + " conv / " + pv + " visitas") +
      '</div>' +
      '<div class="grid cols-4" style="margin-bottom:22px">' +
        kpi("Visitas", pv, eyeIcon(), "Páginas vistas") +
        kpi("Popups exibidos", pop, popIcon(), "Campanhas") +
        kpi("Cliques em popup", popcta, popIcon(), "CTA de campanha") +
        kpi("Eventos totais", ev.length, boltIcon(), "Telemetria first-party") +
      '</div>' +

      '<div class="grid cols-2" style="margin-bottom:22px">' +
        '<div class="panel"><div class="section-title">Conversões por dia <span class="tag live">ao vivo</span></div><canvas id="dashChart" height="150"></canvas></div>' +
        '<div class="panel"><div class="section-title">Origem do tráfego <span class="tag live">ao vivo</span></div><div id="srcBars"></div></div>' +
      '</div>' +

      '<div class="grid cols-2" style="margin-bottom:22px">' +
        '<div class="panel"><div class="section-title">Conversões por unidade <span class="tag live">ao vivo</span></div><div id="unitBars"></div></div>' +
        '<div class="panel"><div class="section-title">Fontes de mídia paga <span class="tag soon">conectar</span></div>' + paidSources() + '</div>' +
      '</div>' +

      '<div class="panel"><div class="section-title">Status das integrações</div><div class="grid cols-3" id="intStatus"></div></div>';

    $("#view").innerHTML = html;

    // actions: range selector + reset demo
    $("#pageActions").innerHTML =
      '<select class="btn" id="rangeSel" style="padding-right:30px">' +
        opt(7, range) + opt(30, range) + opt(90, range) + '</select>';
    $("#rangeSel").onchange = function () { sessionStorage.setItem("cdc_dash_range", this.value); views.dashboard(); };

    renderChart(ev, range);
    renderSourceBars(ev);
    renderUnitBars(ev);
    renderIntStatus();
    if (!ev.length) {
      $("#view").insertBefore(elFrom('<div class="panel" style="margin-bottom:18px;border-color:rgba(245,165,36,.4)"><b>Sem dados ainda.</b> <span class="muted">Os números aparecem conforme as pessoas navegam no site (cliques de WhatsApp, ligações, formulários e popups são capturados automaticamente). Abra o site, interaja e volte aqui.</span></div>'), $("#view").firstChild);
    }
  };
  function opt(v, sel) { return '<option value="' + v + '"' + (v === sel ? ' selected' : '') + '>Últimos ' + v + ' dias</option>'; }
  function kpi(label, val, icon, delta) {
    return '<div class="kpi"><div class="ic">' + icon + '</div><div class="v">' + val + '</div><div class="l">' + label + '</div><div class="d">' + (delta || "") + '</div></div>';
  }
  function renderChart(ev, range) {
    if (!w.Chart) return;
    var days = [], labels = [], map = {};
    for (var i = range - 1; i >= 0; i--) { var dt = new Date(Date.now() - i * 864e5); var k = dt.toISOString().slice(0, 10); days.push(k); map[k] = 0; labels.push(dt.getDate() + "/" + (dt.getMonth() + 1)); }
    ev.forEach(function (x) { if (["whatsapp_click", "call_click", "lead_submit"].indexOf(x.e) > -1) { var k = new Date(x.t).toISOString().slice(0, 10); if (k in map) map[k]++; } });
    var data = days.map(function (k) { return map[k]; });
    var ctx = $("#dashChart"); if (chartRef) chartRef.destroy();
    var g = ctx.getContext("2d"); var grad = g.createLinearGradient(0, 0, 0, 150); grad.addColorStop(0, "rgba(255,90,0,.45)"); grad.addColorStop(1, "rgba(255,90,0,0)");
    chartRef = new w.Chart(ctx, { type: "line", data: { labels: labels, datasets: [{ label: "Conversões", data: data, borderColor: "#ff7a00", backgroundColor: grad, fill: true, tension: .35, pointRadius: 0, borderWidth: 2 }] },
      options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: "#9a9aa8", maxTicksLimit: 8 } }, y: { grid: { color: "#26262f" }, ticks: { color: "#9a9aa8", precision: 0 }, beginAtZero: true } } } });
  }
  function bars(map, host) {
    var keys = Object.keys(map); var max = Math.max.apply(null, keys.map(function (k) { return map[k]; }).concat([1]));
    if (!keys.length) { $(host).innerHTML = '<div class="empty">Sem dados no período.</div>'; return; }
    $(host).innerHTML = keys.sort(function (a, b) { return map[b] - map[a]; }).map(function (k) {
      return '<div class="bar-row"><div class="nm">' + esc(k) + '</div><div class="bar"><i style="width:' + (map[k] / max * 100) + '%"></i></div><div class="vl">' + map[k] + '</div></div>';
    }).join("");
  }
  function renderSourceBars(ev) { var m = {}; ev.filter(function (x) { return x.e === "page_view"; }).forEach(function (x) { var s = (x.p && x.p.source) || "Direto"; m[s] = (m[s] || 0) + 1; }); bars(m, "#srcBars"); }
  function renderUnitBars(ev) { var m = {}; ev.filter(function (x) { return ["whatsapp_click", "call_click"].indexOf(x.e) > -1; }).forEach(function (x) { var u = (x.p && x.p.unit_name) || "Não informado"; m[u] = (m[u] || 0) + 1; }); bars(m, "#unitBars"); }
  function paidSources() {
    return '<div class="bar-row"><div class="nm">Google Ads</div><div class="bar"><i style="width:0%"></i></div><div class="vl muted">—</div></div>' +
      '<div class="bar-row"><div class="nm">Meta Ads</div><div class="bar"><i style="width:0%"></i></div><div class="vl muted">—</div></div>' +
      '<p class="muted" style="font-size:.82rem;margin:10px 0 0">Conecte as contas em <b>Integrações</b> para trazer investimento, CPL e ROAS reais.</p>';
  }
  function renderIntStatus() {
    var ints = cfg.integrations || {};
    var list = [["Google Ads", ints.googleAds], ["GA4", ints.ga4], ["Search Console", ints.searchConsole], ["Meta Ads", ints.metaAds], ["Meta CAPI", ints.metaCapi], ["GTM", ints.gtm]];
    $("#intStatus").innerHTML = list.map(function (it) {
      var on = it[1] && it[1].connected;
      return '<div class="int-card"><div class="logo-box">' + esc(it[0].slice(0, 2)) + '</div><div class="meta"><h4>' + esc(it[0]) + '</h4><p><span class="badge ' + (on ? "on" : "off") + '">' + (on ? "Conectado" : "Não conectado") + '</span></p></div></div>';
    }).join("");
  }

  /* ---------- UNIDADES ---------- */
  views.unidades = function () {
    $("#pageActions").innerHTML = '<button class="btn primary" id="addUnit">+ Nova unidade</button>';
    $("#addUnit").onclick = function () { editUnit(null); };
    var rows = cfg.units.map(function (u, i) {
      return '<tr><td><b>' + esc(u.name) + '</b><br><span class="muted" style="font-size:.8rem">' + esc(u.city) + ' · ' + esc(u.neighborhood || "") + '</span></td>' +
        '<td class="muted">' + esc(u.phone) + '</td>' +
        '<td><span class="badge ' + (u.tier === "exclusive" ? "excl" : "off") + '">' + (u.tier === "exclusive" ? "Exclusive" : "Standard") + '</span></td>' +
        '<td><label class="switch"><input type="checkbox" data-toggle="' + i + '"' + (u.active !== false ? " checked" : "") + '><span class="sl"></span></label></td>' +
        '<td class="row-actions"><button class="btn sm" data-edit="' + i + '">Editar</button><button class="btn sm danger" data-del="' + i + '">Excluir</button></td></tr>';
    }).join("");
    $("#view").innerHTML = '<div class="panel"><table class="tbl"><thead><tr><th>Unidade</th><th>Telefone</th><th>Tipo</th><th>Ativa</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    $all("[data-toggle]").forEach(function (c) { c.onchange = function () { cfg.units[+c.getAttribute("data-toggle")].active = c.checked; save(); }; });
    $all("[data-edit]").forEach(function (b) { b.onclick = function () { editUnit(+b.getAttribute("data-edit")); }; });
    $all("[data-del]").forEach(function (b) { b.onclick = function () { var i = +b.getAttribute("data-del"); if (confirm("Excluir a unidade \"" + cfg.units[i].name + "\"?")) { cfg.units.splice(i, 1); save(); views.unidades(); } }; });
  };

  /* ---------- PLANOS POR UNIDADE ---------- */
  function ensurePlans() {
    if (!cfg.plans) cfg.plans = { groupsOrder: ["Premium Standard", "Exclusive"], byUnit: {} };
    if (!cfg.plans.byUnit) cfg.plans.byUnit = {};
    if (!cfg.plans.groupsOrder) cfg.plans.groupsOrder = ["Premium Standard", "Exclusive"];
    return cfg.plans;
  }
  function badgesToText(a) { return (a || []).map(function (b) { return b.t + " | " + (b.c || "blue"); }).join("\n"); }
  function textToBadges(s) { return (s || "").split("\n").map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) { var p = l.split("|"); return { t: (p[0] || "").trim(), c: ((p[1] || "blue").trim().toLowerCase()) }; }); }
  function linesToArr(s) { return (s || "").split("\n").map(function (l) { return l.trim(); }).filter(Boolean); }

  views.planos = function () {
    var plans = ensurePlans();
    var by = plans.byUnit;
    var rows = cfg.units.map(function (u) {
      var pg = by[u.id];
      var tier = pg ? (pg.tierLabel || "—") : "—";
      var summary = pg && pg.items ? pg.items.map(function (it) { return esc(it.name) + " (" + esc(it.price || "—") + ")"; }).join(" · ") : '<span class="muted">sem planos — clique para criar</span>';
      return '<tr><td><b>' + esc(u.name) + '</b><br><span class="muted" style="font-size:.8rem">' + (u.active !== false ? "ativa" : "inativa") + '</span></td>' +
        '<td><span class="badge ' + (tier === "Exclusive" ? "excl" : "off") + '">' + esc(tier) + '</span></td>' +
        '<td class="muted" style="font-size:.85rem">' + summary + '</td>' +
        '<td class="row-actions"><button class="btn sm" data-pl="' + esc(u.id) + '">Editar planos</button></td></tr>';
    }).join("");
    $("#view").innerHTML = '<div class="panel"><p class="muted" style="margin:0 0 14px">Cada unidade tem seus próprios planos. As alterações aparecem no seletor de unidade da página de <b>Planos</b>.</p>' +
      '<table class="tbl"><thead><tr><th>Unidade</th><th>Grupo</th><th>Planos</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    $all("[data-pl]").forEach(function (b) { b.onclick = function () { editUnitPlans(b.getAttribute("data-pl")); }; });
  };

  function editUnitPlans(uid) {
    var plans = ensurePlans();
    var by = plans.byUnit;
    var u = cfg.units.filter(function (x) { return x.id === uid; })[0];
    if (!u) return;
    var pg = by[uid] ? JSON.parse(JSON.stringify(by[uid])) : {
      tierLabel: (plans.groupsOrder[0] || "Premium Standard"), includedText: "",
      items: [
        { key: "basic", name: "Basic+", desc: "", price: "", unit: "/mês", old: "", note: "+ R$ 50,00", featured: false, cta: "Quero o Basic+", badges: [], features: [] },
        { key: "vip", name: "Anual VIP", desc: "", price: "", unit: "", old: "", note: "+ R$ 50,00", featured: true, cta: "Quero o Anual VIP", badges: [], features: [] },
        { key: "mensal", name: "Mensal", desc: "", price: "", unit: "/mês", old: "", note: "+ R$ 50,00", featured: false, cta: "Quero o Mensal", badges: [], features: [] }
      ]
    };
    var groupOpts = (plans.groupsOrder || ["Premium Standard", "Exclusive"]).map(function (g) { return [g, g]; });
    function planFields(it, ix) {
      return '<div class="panel" style="margin:12px 0;padding:14px;background:var(--bg-soft,#f6f6f8)">' +
        '<div class="section-title" style="font-size:.95rem;margin-bottom:8px">Plano ' + (ix + 1) + '</div>' +
        '<div class="frow">' + f("Nome", "p" + ix + "n", it.name) + f("Texto do botão", "p" + ix + "c", it.cta) + '</div>' +
        f("Descrição", "p" + ix + "d", it.desc) +
        '<div class="frow-3">' + f("Preço", "p" + ix + "p", it.price, "R$ 129,99 / 12x de R$ 109,90") + f("Sufixo", "p" + ix + "u", it.unit, "/mês") + f("Total riscado", "p" + ix + "o", it.old, "R$ 1.318,80") + '</div>' +
        '<div class="frow">' + f("Matrícula / obs.", "p" + ix + "m", it.note, "+ R$ 50,00") + sel("Destaque (card preto)", "p" + ix + "f", [["no", "Não"], ["yes", "Sim"]], it.featured ? "yes" : "no") + '</div>' +
        ta("Selos — 1 por linha: Texto | cor (green, blue ou amber)", "p" + ix + "b", badgesToText(it.badges)) +
        ta("Benefícios — 1 por linha", "p" + ix + "l", linesToArr(it.features).join("\n")) +
        '</div>';
    }
    var body = '<div class="frow">' + sel("Grupo (rótulo do seletor)", "gtier", groupOpts, pg.tierLabel) + f("Unidades incluídas (texto)", "ginc", pg.includedText) + '</div>' +
      pg.items.map(planFields).join("");
    openModal("Planos — " + u.name, body, function (m) {
      var items = pg.items.map(function (it, ix) {
        return {
          key: it.key,
          name: val(m, "p" + ix + "n"), cta: val(m, "p" + ix + "c"), desc: val(m, "p" + ix + "d"),
          price: val(m, "p" + ix + "p"), unit: val(m, "p" + ix + "u"), old: val(m, "p" + ix + "o"), note: val(m, "p" + ix + "m"),
          featured: val(m, "p" + ix + "f") === "yes",
          badges: textToBadges(val(m, "p" + ix + "b")),
          features: linesToArr(val(m, "p" + ix + "l"))
        };
      });
      by[uid] = { tierLabel: val(m, "gtier"), includedText: val(m, "ginc"), items: items };
      save(); views.planos();
    }, "Salvar planos");
  }
  function editUnit(i) {
    var u = i == null ? { id: "", name: "", tier: "standard", active: true, city: "", neighborhood: "", address: "", phone: "", whatsapp: "", maps: "", image: "" } : Object.assign({}, cfg.units[i]);
    var body =
      f("Nome da unidade", "nm", u.name) +
      '<div class="frow">' + f("Cidade", "city", u.city) + f("Bairro", "nb", u.neighborhood) + '</div>' +
      f("Endereço completo", "addr", u.address) +
      '<div class="frow">' + f("Telefone (exibição)", "phone", u.phone, "(81) 9....") + f("WhatsApp (só números, c/ 55)", "wa", u.whatsapp, "5581...") + '</div>' +
      '<div class="frow">' + sel("Tipo", "tier", [["standard", "Standard"], ["exclusive", "Exclusive"]], u.tier) + f("Link do Google Maps", "maps", u.maps) + '</div>' +
      f("URL da imagem", "img", u.image, "https://...") +
      '<p class="hint">Dica: use uma imagem em alta (1200×800). Pode colar a URL de um asset do site atual.</p>';
    openModal(i == null ? "Nova unidade" : "Editar unidade", body, function (m) {
      var name = val(m, "nm"); if (!name) { toast("Informe o nome", true); return false; }
      var obj = { id: u.id || slug(name), name: name, tier: val(m, "tier"), active: u.active !== false,
        city: val(m, "city"), neighborhood: val(m, "nb"), address: val(m, "addr"),
        phone: val(m, "phone"), whatsapp: val(m, "wa").replace(/\D/g, ""), maps: val(m, "maps"), image: val(m, "img") };
      if (i == null) cfg.units.push(obj); else cfg.units[i] = obj;
      save(); views.unidades();
    });
  }

  /* ---------- POPUPS / CAMPANHAS ---------- */
  views.popups = function () {
    $("#pageActions").innerHTML = '<button class="btn primary" id="addPop">+ Nova campanha</button>';
    $("#addPop").onclick = function () { editPopup(null); };
    var rows = (cfg.popups || []).map(function (p, i) {
      return '<tr><td><b>' + esc(p.name) + '</b><br><span class="muted" style="font-size:.8rem">' + esc(p.headline) + '</span></td>' +
        '<td class="muted">' + trg(p) + '</td>' +
        '<td class="muted">' + (p.pages && p.pages.join(", ")) + '</td>' +
        '<td><label class="switch"><input type="checkbox" data-pt="' + i + '"' + (p.active ? " checked" : "") + '><span class="sl"></span></label></td>' +
        '<td class="row-actions"><button class="btn sm" data-pv="' + i + '">Prévia</button><button class="btn sm" data-pe="' + i + '">Editar</button><button class="btn sm danger" data-pd="' + i + '">Excluir</button></td></tr>';
    }).join("");
    $("#view").innerHTML = '<div class="panel"><table class="tbl"><thead><tr><th>Campanha</th><th>Gatilho</th><th>Páginas</th><th>Ativa</th><th></th></tr></thead><tbody>' + (rows || '') + '</tbody></table>' + (rows ? '' : '<div class="empty">Nenhuma campanha ainda.</div>') + '</div>';
    $all("[data-pt]").forEach(function (c) { c.onchange = function () { cfg.popups[+c.getAttribute("data-pt")].active = c.checked; save(); }; });
    $all("[data-pe]").forEach(function (b) { b.onclick = function () { editPopup(+b.getAttribute("data-pe")); }; });
    $all("[data-pv]").forEach(function (b) { b.onclick = function () { previewPopup(cfg.popups[+b.getAttribute("data-pv")]); }; });
    $all("[data-pd]").forEach(function (b) { b.onclick = function () { var i = +b.getAttribute("data-pd"); if (confirm("Excluir a campanha?")) { cfg.popups.splice(i, 1); save(); views.popups(); } }; });
  };
  function trg(p) { var map = { time: "Após " + p.triggerValue + "s", scroll: "Scroll " + p.triggerValue + "%", exit: "Intenção de saída", load: "Ao carregar" }; return map[p.trigger] || p.trigger; }
  function editPopup(i) {
    var p = i == null ? { id: "", active: true, name: "", headline: "", body: "", image: "", ctaLabel: "Quero saber mais", ctaType: "whatsapp", ctaTarget: "", trigger: "time", triggerValue: 6, frequency: "session", pages: ["all"], startDate: "", endDate: "", theme: "brand" } : Object.assign({}, cfg.popups[i]);
    var body =
      f("Nome interno", "nm", p.name) +
      f("Título (headline)", "hl", p.headline) +
      ta("Texto", "bd", p.body) +
      f("URL da imagem (opcional)", "img", p.image) +
      '<div class="frow">' + f("Texto do botão", "cl", p.ctaLabel) + sel("Ação do botão", "ct", [["whatsapp", "Abrir WhatsApp"], ["link", "Link externo"], ["scroll", "Rolar para CTA"]], p.ctaType) + '</div>' +
      f("Destino do botão (WhatsApp nº ou URL — vazio = unidade padrão)", "tg", p.ctaTarget) +
      '<div class="frow-3">' + sel("Gatilho", "tr", [["time", "Tempo"], ["scroll", "Scroll"], ["exit", "Saída"], ["load", "Imediato"]], p.trigger) + f("Valor (s ou %)", "tv", p.triggerValue) + sel("Frequência", "fr", [["session", "1x por sessão"], ["daily", "1x por dia"], ["always", "Sempre"]], p.frequency) + '</div>' +
      '<div class="frow-3">' + f("Páginas (all, index, planos...)", "pg", (p.pages || []).join(",")) + f("Início (YYYY-MM-DD)", "sd", p.startDate) + f("Fim (YYYY-MM-DD)", "ed", p.endDate) + '</div>' +
      sel("Tema visual", "th", [["brand", "Laranja (marca)"], ["dark", "Escuro"], ["light", "Claro"]], p.theme);
    openModal(i == null ? "Nova campanha" : "Editar campanha", body, function (m) {
      var name = val(m, "nm"); if (!name) { toast("Informe o nome", true); return false; }
      var obj = { id: p.id || slug(name), active: p.active, name: name, headline: val(m, "hl"), body: val(m, "bd"),
        image: val(m, "img"), ctaLabel: val(m, "cl"), ctaType: val(m, "ct"), ctaTarget: val(m, "tg"),
        trigger: val(m, "tr"), triggerValue: parseInt(val(m, "tv") || "0", 10), frequency: val(m, "fr"),
        pages: val(m, "pg").split(",").map(function (s) { return s.trim(); }).filter(Boolean), startDate: val(m, "sd"), endDate: val(m, "ed"), theme: val(m, "th") };
      if (i == null) (cfg.popups = cfg.popups || []).push(obj); else cfg.popups[i] = obj;
      save(); views.popups();
    });
  }
  function previewPopup(p) {
    var du = DATA.defaultUnit();
    openModal("Prévia — " + p.name,
      '<div style="border-radius:14px;overflow:hidden;border:1px solid var(--line)">' +
        (p.image ? '<img src="' + esc(p.image) + '" style="width:100%;height:180px;object-fit:cover">' : '') +
        '<div style="padding:24px;background:' + (p.theme === "dark" ? "#15151a" : "#fff") + ';color:' + (p.theme === "dark" ? "#fff" : "#14141a") + '">' +
          '<h3 style="font-size:1.4rem;text-transform:uppercase;margin:0 0 10px">' + esc(p.headline) + '</h3>' +
          '<p style="color:#888;margin:0 0 16px">' + esc(p.body) + '</p>' +
          '<span style="display:inline-block;background:linear-gradient(120deg,#ff5a00,#ff9e00);color:#fff;padding:12px 22px;border-radius:99px;font-weight:700">' + esc(p.ctaLabel) + '</span>' +
        '</div></div>' +
        '<p class="hint" style="margin-top:14px">Gatilho: ' + trg(p) + ' · Frequência: ' + esc(p.frequency) + ' · CTA: ' + esc(p.ctaType) + (p.ctaType === "whatsapp" && !p.ctaTarget && du ? " (unidade " + esc(du.name) + ")" : "") + '</p>',
      null);
  }

  /* ---------- CLUBE & PARCEIROS ---------- */
  function getLeads() { try { return JSON.parse(localStorage.getItem("cdc_partner_leads") || "[]"); } catch (e) { return []; } }
  function setLeads(a) { localStorage.setItem("cdc_partner_leads", JSON.stringify(a)); }
  views.clube = function () {
    $("#pageActions").innerHTML = '<button class="btn primary" id="addPartner">+ Novo parceiro</button>';
    $("#addPartner").onclick = function () { editPartner(null); };
    var leads = getLeads().sort(function (a, b) { return b.ts - a.ts; });
    var novos = leads.filter(function (l) { return l.status !== "contatado"; }).length;

    var leadRows = leads.length ? leads.map(function (l, i) {
      var wa = (l.telefone || "").replace(/\D/g, ""); wa = wa ? (wa.length <= 11 ? "55" + wa : wa) : "";
      return '<tr><td><b>' + esc(l.empresa) + '</b><br><span class="muted" style="font-size:.8rem">' + esc(l.nome) + (l.cidade ? " · " + esc(l.cidade) : "") + '</span></td>' +
        '<td class="muted">' + esc(l.categoria || "-") + '</td>' +
        '<td class="muted" style="max-width:240px">' + esc(l.beneficio || "-") + '</td>' +
        '<td><span class="badge ' + (l.status === "contatado" ? "off" : "on") + '">' + (l.status === "contatado" ? "Contatado" : "Novo") + '</span></td>' +
        '<td class="row-actions">' + (wa ? '<a class="btn sm primary" target="_blank" href="https://wa.me/' + wa + '">WhatsApp</a>' : '') +
        '<button class="btn sm" data-lstatus="' + i + '">' + (l.status === "contatado" ? "Reabrir" : "Contatado") + '</button>' +
        '<button class="btn sm danger" data-ldel="' + i + '">Excluir</button></td></tr>';
    }).join("") : '';

    var pRows = (cfg.partnersClub || []).filter(function (p) { return !p.hidden; }).map(function (p) {
      var idx = cfg.partnersClub.indexOf(p);
      return '<tr><td><b>' + esc(p.name) + '</b><br><span class="muted" style="font-size:.8rem">' + esc(p.benefit || "") + '</span></td>' +
        '<td class="muted">' + esc(p.category) + '</td>' +
        '<td class="muted">' + esc(p.phone || "") + (p.instagram ? '<br>@' + esc(p.instagram) : '') + '</td>' +
        '<td><label class="switch"><input type="checkbox" data-pfeat="' + idx + '"' + (p.featured ? " checked" : "") + '><span class="sl"></span></label></td>' +
        '<td class="row-actions"><button class="btn sm" data-pedit="' + idx + '">Editar</button><button class="btn sm danger" data-pdel="' + idx + '">Excluir</button></td></tr>';
    }).join("");

    $("#view").innerHTML =
      '<div class="panel" style="margin-bottom:20px"><div class="section-title">Leads — "Quero ser parceiro" ' + (novos ? '<span class="tag live">' + novos + ' novo' + (novos > 1 ? 's' : '') + '</span>' : '') + '</div>' +
        (leadRows ? '<table class="tbl"><thead><tr><th>Empresa</th><th>Categoria</th><th>Benefício oferecido</th><th>Status</th><th></th></tr></thead><tbody>' + leadRows + '</tbody></table>'
          : '<div class="empty">Nenhum lead ainda. Quando um empresário enviar o formulário "Quero ser parceiro" no site, ele aparece aqui.</div>') + '</div>' +
      '<div class="panel"><div class="section-title">Parceiros do Clube <span class="tag live">' + (cfg.partnersClub || []).filter(function (p) { return !p.hidden; }).length + '</span></div>' +
        '<table class="tbl"><thead><tr><th>Parceiro</th><th>Categoria</th><th>Contato</th><th>Destaque</th><th></th></tr></thead><tbody>' + pRows + '</tbody></table></div>';

    $all("[data-lstatus]").forEach(function (b) { b.onclick = function () { var i = +b.getAttribute("data-lstatus"); leads[i].status = leads[i].status === "contatado" ? "novo" : "contatado"; setLeads(leads); views.clube(); }; });
    $all("[data-ldel]").forEach(function (b) { b.onclick = function () { var i = +b.getAttribute("data-ldel"); if (confirm("Excluir este lead?")) { leads.splice(i, 1); setLeads(leads); views.clube(); } }; });
    $all("[data-pfeat]").forEach(function (c) { c.onchange = function () { cfg.partnersClub[+c.getAttribute("data-pfeat")].featured = c.checked; save(); }; });
    $all("[data-pedit]").forEach(function (b) { b.onclick = function () { editPartner(+b.getAttribute("data-pedit")); }; });
    $all("[data-pdel]").forEach(function (b) { b.onclick = function () { var i = +b.getAttribute("data-pdel"); if (confirm("Excluir o parceiro \"" + cfg.partnersClub[i].name + "\"?")) { cfg.partnersClub.splice(i, 1); save(); views.clube(); } }; });
  };
  function editPartner(i) {
    var cats = cfg.partnerCategories || [];
    var p = i == null ? { name: "", category: cats[0] || "", benefit: "", city: "", address: "", instagram: "", phone: "", featured: false } : Object.assign({}, cfg.partnersClub[i]);
    var body =
      f("Nome do parceiro", "pnm", p.name) +
      '<div class="frow">' + sel("Categoria", "pcat", cats.map(function (c) { return [c, c]; }), p.category) + f("Benefício para alunos", "pben", p.benefit) + '</div>' +
      f("Endereço (opcional)", "padr", p.address) +
      '<div class="frow-3">' + f("Cidade/bairro", "pcity", p.city) + f("Instagram (sem @)", "pig", p.instagram) + f("Telefone/WhatsApp", "pph", p.phone) + '</div>' +
      '<div class="field"><label>Destaque na listagem</label><label class="switch"><input type="checkbox" id="ff-pfeat"' + (p.featured ? " checked" : "") + '><span class="sl"></span></label></div>';
    openModal(i == null ? "Novo parceiro" : "Editar parceiro", body, function (m) {
      var name = val(m, "pnm"); if (!name) { toast("Informe o nome", true); return false; }
      var obj = { name: name, category: val(m, "pcat"), benefit: val(m, "pben"), address: val(m, "padr"),
        city: val(m, "pcity"), instagram: val(m, "pig").replace(/^@/, ""), phone: val(m, "pph"), featured: m.querySelector("#ff-pfeat").checked };
      cfg.partnersClub = cfg.partnersClub || [];
      if (i == null) cfg.partnersClub.push(obj); else cfg.partnersClub[i] = obj;
      save(); views.clube();
    });
  }

  /* ---------- GRADE DE AULAS ---------- */
  views.grade = function () {
    $("#pageActions").innerHTML = '<button class="btn primary" id="addClass">+ Nova aula</button>';
    $("#addClass").onclick = function () { editClass(null); };
    var unitName = function (uid) { if (uid === "all" || !uid) return "Todas as unidades"; var u = DATA.unitById(uid); return u ? u.name : uid; };
    var list = (cfg.classesGrid || []).map(function (c, i) { return { c: c, i: i }; });
    list.sort(function (a, b) { return WEEKDAYS.indexOf(a.c.day) - WEEKDAYS.indexOf(b.c.day) || (a.c.time || "").localeCompare(b.c.time || ""); });
    var rows = list.map(function (o) {
      return '<tr><td><b>' + esc(o.c.day) + '</b></td><td class="muted">' + esc(o.c.time) + '</td><td>' + esc(o.c.name) + '</td>' +
        '<td class="muted">' + esc(unitName(o.c.unit)) + '</td>' +
        '<td class="row-actions"><button class="btn sm" data-cedit="' + o.i + '">Editar</button><button class="btn sm danger" data-cdel="' + o.i + '">Excluir</button></td></tr>';
    }).join("");
    $("#view").innerHTML = '<div class="panel"><p class="muted" style="font-size:.86rem;margin:-4px 0 16px">A grade aparece na página de cada unidade. Use "Todas as unidades" para horários comuns, ou selecione uma unidade específica.</p>' +
      (rows ? '<table class="tbl"><thead><tr><th>Dia</th><th>Horário</th><th>Aula</th><th>Unidade</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>' : '<div class="empty">Nenhuma aula cadastrada.</div>') + '</div>';
    $all("[data-cedit]").forEach(function (b) { b.onclick = function () { editClass(+b.getAttribute("data-cedit")); }; });
    $all("[data-cdel]").forEach(function (b) { b.onclick = function () { var i = +b.getAttribute("data-cdel"); if (confirm("Excluir esta aula?")) { cfg.classesGrid.splice(i, 1); save(); views.grade(); } }; });
  };
  function editClass(i) {
    var c = i == null ? { day: "Segunda", time: "", name: "", unit: "all" } : Object.assign({}, cfg.classesGrid[i]);
    var unitOpts = [["all", "Todas as unidades"]].concat(cfg.units.map(function (u) { return [u.id, u.name]; }));
    var body = '<div class="frow-3">' + sel("Dia", "cday", WEEKDAYS.map(function (d) { return [d, d]; }), c.day) +
      f("Horário (ex: 18:00)", "ctime", c.time) + f("Aula", "cname", c.name) + '</div>' +
      sel("Unidade", "cunit", unitOpts, c.unit || "all");
    openModal(i == null ? "Nova aula" : "Editar aula", body, function (m) {
      var name = val(m, "cname"); var time = val(m, "ctime");
      if (!name || !time) { toast("Preencha aula e horário", true); return false; }
      var obj = { day: val(m, "cday"), time: time, name: name, unit: val(m, "cunit") };
      cfg.classesGrid = cfg.classesGrid || [];
      if (i == null) cfg.classesGrid.push(obj); else cfg.classesGrid[i] = obj;
      save(); views.grade();
    });
  }

  /* ---------- CONTEÚDO & OFERTA ---------- */
  views.conteudo = function () {
    var o = cfg.offer || {}, mt = cfg.meta || {};
    $("#view").innerHTML =
      '<div class="grid cols-2">' +
        '<div class="panel"><div class="section-title">Oferta principal</div>' +
          '<div class="field"><label>Exibir oferta</label><label class="switch"><input type="checkbox" id="ofEn"' + (o.enabled ? " checked" : "") + '><span class="sl"></span></label></div>' +
          f("Selo (badge)", "ofBadge", o.badge) + f("Título", "ofTitle", o.title) + ta("Subtítulo", "ofSub", o.subtitle) +
          '<button class="btn primary" id="saveOffer">Salvar oferta</button></div>' +
        '<div class="panel"><div class="section-title">Informações gerais</div>' +
          '<div class="frow">' + f("Anos de história", "mtYears", mt.yearsActive) + f("E-mail", "mtEmail", mt.email) + '</div>' +
          f("Instagram", "mtIg", mt.instagram) + f("Facebook", "mtFb", mt.facebook) +
          f("Endereço da sede", "mtHead", mt.headOffice) +
          '<button class="btn primary" id="saveMeta">Salvar informações</button></div>' +
      '</div>' +
      '<div class="panel" style="margin-top:18px"><div class="section-title">Horários de funcionamento</div><div id="hoursBox"></div>' +
        '<button class="btn sm" id="addHour">+ Linha</button> <button class="btn primary" id="saveHours">Salvar horários</button></div>' +
      '<div class="panel" style="margin-top:18px"><div class="section-title">Parceiros (Clube da Parceria)</div>' +
        f("Lista separada por vírgula", "partners", (cfg.partners || []).join(", ")) +
        '<button class="btn primary" id="savePartners">Salvar parceiros</button></div>';

    $("#saveOffer").onclick = function () { cfg.offer = { enabled: $("#ofEn").checked, badge: gv("ofBadge"), title: gv("ofTitle"), subtitle: gv("ofSub") }; save(); };
    $("#saveMeta").onclick = function () { Object.assign(cfg.meta, { yearsActive: parseInt(gv("mtYears") || "11", 10), email: gv("mtEmail"), instagram: gv("mtIg"), facebook: gv("mtFb"), headOffice: gv("mtHead") }); save(); };
    $("#savePartners").onclick = function () { cfg.partners = gv("partners").split(",").map(function (s) { return s.trim(); }).filter(Boolean); save(); };

    function drawHours() {
      $("#hoursBox").innerHTML = (cfg.meta.hours || []).map(function (h, i) {
        return '<div class="frow" style="margin-bottom:10px"><input data-hd="' + i + '" value="' + esc(h.d) + '"><input data-hh="' + i + '" value="' + esc(h.h) + '"></div>';
      }).join("");
    }
    drawHours();
    $("#addHour").onclick = function () { cfg.meta.hours.push({ d: "Novo", h: "" }); drawHours(); };
    $("#saveHours").onclick = function () {
      cfg.meta.hours = (cfg.meta.hours || []).map(function (h, i) { return { d: ($('[data-hd="' + i + '"]') || {}).value || h.d, h: ($('[data-hh="' + i + '"]') || {}).value || h.h }; });
      save();
    };
  };

  /* ---------- INTEGRAÇÕES ---------- */
  views.integracoes = function () {
    var t = cfg.telemetry || {}, ints = cfg.integrations || {};
    $("#view").innerHTML =
      '<div class="panel" style="margin-bottom:18px"><div class="section-title">Tags &amp; pixels <span class="tag live">aplica no site</span></div>' +
        '<p class="muted" style="font-size:.86rem;margin:-6px 0 16px">Cole os IDs abaixo. Eles passam a carregar no site imediatamente (respeitando o consentimento LGPD).</p>' +
        '<div class="frow">' + f("Google Tag Manager (GTM-XXXX)", "tGtm", t.gtmId) + f("GA4 Measurement ID (G-XXXX)", "tGa4", t.ga4Id) + '</div>' +
        '<div class="frow">' + f("Meta Pixel ID", "tPx", t.metaPixelId) + f("Microsoft Clarity ID", "tCl", t.clarityId) + '</div>' +
        '<div class="frow">' + f("Endpoint CAPI (server-side, opcional)", "tCapi", t.capiEndpoint) +
          '<div class="field"><label>Exigir consentimento (LGPD)</label><label class="switch"><input type="checkbox" id="tCons"' + (t.consentRequired !== false ? " checked" : "") + '><span class="sl"></span></label></div></div>' +
        '<button class="btn primary" id="saveTel">Salvar tags</button></div>' +

      '<div class="panel" style="margin-bottom:18px"><div class="section-title">Avaliações do Google <span class="tag live">prova social</span></div>' +
        '<p class="muted" style="font-size:.86rem;margin:-6px 0 16px">Cole sua API key do Google Places e o Place ID de cada unidade. As avaliações reais aparecem na home automaticamente.</p>' +
        f("Google Places API key", "gpKey", (ints.googlePlaces||{}).apiKey || "") +
        '<div id="gpPlaces"></div>' +
        '<button class="btn primary" id="saveGp">Salvar avaliações</button></div>' +

      '<div class="section-title" style="margin:6px 0 14px">Conexões de API <span class="tag soon">contas de dados</span></div>' +
      '<div class="grid cols-2" id="intGrid"></div>' +
      '<p class="muted" style="font-size:.82rem;margin-top:14px">As credenciais ficam salvas na configuração. A sincronização de métricas (investimento, CPL, ROAS, cliques de Search) é puxada para o Dashboard quando o coletor de dados estiver ativo.</p>';

    // Google Places por unidade
    var gpIds = (ints.googlePlaces && ints.googlePlaces.unitPlaceIds) || {};
    $("#gpPlaces").innerHTML = '<div class="frow">' + cfg.units.map(function (u) {
      return '<div class="field"><label>Place ID — ' + esc(u.name) + '</label><input id="ff-gp-' + u.id + '" value="' + esc(gpIds[u.id] || "") + '" placeholder="ChIJ..."></div>';
    }).join("") + '</div>';
    $("#saveGp").onclick = function () {
      cfg.integrations.googlePlaces = cfg.integrations.googlePlaces || { unitPlaceIds: {} };
      cfg.integrations.googlePlaces.apiKey = gv("gpKey").trim();
      var map = {}; cfg.units.forEach(function (u) { var v = gv("gp-" + u.id); if (v) map[u.id] = v.trim(); });
      cfg.integrations.googlePlaces.unitPlaceIds = map;
      cfg.integrations.googlePlaces.connected = !!cfg.integrations.googlePlaces.apiKey;
      save();
    };

    $("#saveTel").onclick = function () {
      Object.assign(cfg.telemetry, { gtmId: gv("tGtm").trim(), ga4Id: gv("tGa4").trim(), metaPixelId: gv("tPx").trim(), clarityId: gv("tCl").trim(), capiEndpoint: gv("tCapi").trim(), consentRequired: $("#tCons").checked });
      save();
    };

    var defs = [
      ["googleAds", "Google Ads", [["accountId", "ID da conta"], ["customerId", "Customer ID"], ["devToken", "Developer token"]]],
      ["ga4", "Google Analytics 4", [["propertyId", "Property ID"], ["measurementId", "Measurement ID"], ["apiSecret", "API secret"]]],
      ["searchConsole", "Search Console", [["siteUrl", "URL do site"]]],
      ["metaAds", "Meta Ads", [["adAccountId", "Ad Account ID"], ["businessId", "Business ID"], ["accessToken", "Access token"]]],
      ["metaCapi", "Meta Conversions API", [["datasetId", "Dataset ID"], ["accessToken", "Access token"]]],
      ["gtm", "GTM (API de container)", [["containerId", "Container ID"], ["apiKey", "API key"]]]
    ];
    $("#intGrid").innerHTML = defs.map(function (dd) {
      var key = dd[0], cur = ints[key] || {};
      return '<div class="panel"><div class="int-card" style="border:0;padding:0;margin-bottom:14px"><div class="logo-box">' + esc(dd[1].slice(0, 2)) + '</div>' +
        '<div class="meta"><h4>' + esc(dd[1]) + '</h4><p><span class="badge ' + (cur.connected ? "on" : "off") + '" id="st-' + key + '">' + (cur.connected ? "Conectado" : "Não conectado") + '</span></p></div></div>' +
        dd[2].map(function (fl) { return f(fl[1], "i-" + key + "-" + fl[0], cur[fl[0]] || ""); }).join("") +
        '<div style="display:flex;gap:8px"><button class="btn primary sm" data-conn="' + key + '">Salvar &amp; conectar</button>' +
        (cur.connected ? '<button class="btn sm danger" data-disc="' + key + '">Desconectar</button>' : '') + '</div></div>';
    }).join("");

    $all("[data-conn]").forEach(function (b) { b.onclick = function () {
      var key = b.getAttribute("data-conn"); var obj = cfg.integrations[key] = cfg.integrations[key] || {};
      defs.filter(function (x) { return x[0] === key; })[0][2].forEach(function (fl) { obj[fl[0]] = gv("i-" + key + "-" + fl[0]); });
      var filled = Object.keys(obj).some(function (k) { return k !== "connected" && k !== "note" && obj[k]; });
      obj.connected = filled; save(); views.integracoes();
      toast(filled ? "Conexão salva ✓" : "Preencha ao menos um campo", !filled);
    }; });
    $all("[data-disc]").forEach(function (b) { b.onclick = function () { var key = b.getAttribute("data-disc"); cfg.integrations[key].connected = false; save(); views.integracoes(); }; });
  };

  /* ---------- CONFIGURAÇÕES ---------- */
  views.config = function () {
    $("#view").innerHTML =
      '<div class="grid cols-2">' +
        '<div class="panel"><div class="section-title">Segurança</div>' +
          f("Nova senha do admin", "npass", "", "deixe em branco para manter") +
          '<button class="btn primary" id="savePass">Atualizar senha</button>' +
          '<p class="hint">A senha fica salva apenas neste navegador (client-side).</p></div>' +
        '<div class="panel"><div class="section-title">Backup da configuração</div>' +
          '<p class="muted" style="font-size:.86rem">Exporte um arquivo JSON com tudo (unidades, campanhas, integrações) para versionar ou publicar.</p>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">' +
            '<button class="btn primary" id="exp">⬇ Exportar JSON</button>' +
            '<button class="btn" id="impBtn">⬆ Importar JSON</button>' +
            '<input type="file" id="impFile" accept="application/json" class="hidden">' +
            '<button class="btn danger" id="rst">Restaurar padrão</button></div></div>' +
      '</div>' +
      '<div class="panel" style="margin-top:18px"><div class="section-title">Dados de telemetria (local)</div>' +
        '<p class="muted" style="font-size:.86rem">Eventos first-party capturados neste navegador para o dashboard.</p>' +
        '<div style="display:flex;gap:8px"><button class="btn" id="expEv">⬇ Exportar eventos</button><button class="btn danger" id="clrEv">Limpar eventos</button></div></div>';

    $("#savePass").onclick = function () { var p = gv("npass"); if (p) { localStorage.setItem(PASS_KEY, p); toast("Senha atualizada ✓"); $("#npass").value = ""; } else toast("Digite a nova senha", true); };
    $("#exp").onclick = function () { download("cia-do-corpo-config.json", DATA.export()); };
    $("#impBtn").onclick = function () { $("#impFile").click(); };
    $("#impFile").onchange = function (e) { var fr = new FileReader(); fr.onload = function () { try { DATA.import(fr.result); cfg = DATA.get(); toast("Configuração importada ✓"); route("dashboard"); } catch (x) { toast("JSON inválido", true); } }; fr.readAsText(e.target.files[0]); };
    $("#rst").onclick = function () { if (confirm("Restaurar a configuração padrão? Suas alterações serão perdidas.")) { DATA.reset(); cfg = DATA.get(); toast("Restaurado ✓"); route("dashboard"); } };
    $("#expEv").onclick = function () { download("cia-do-corpo-eventos.json", localStorage.getItem("cdc_events") || "[]"); };
    $("#clrEv").onclick = function () { if (confirm("Limpar todos os eventos locais?")) { localStorage.removeItem("cdc_events"); toast("Eventos limpos ✓"); } };
  };

  /* ---------- form helpers ---------- */
  function f(label, id, value, ph) { return '<div class="field"><label>' + esc(label) + '</label><input id="ff-' + id + '" value="' + esc(value) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '></div>'; }
  function ta(label, id, value) { return '<div class="field"><label>' + esc(label) + '</label><textarea id="ff-' + id + '">' + esc(value) + '</textarea></div>'; }
  function sel(label, id, opts, cur) { return '<div class="field"><label>' + esc(label) + '</label><select id="ff-' + id + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === cur ? " selected" : "") + '>' + esc(o[1]) + '</option>'; }).join("") + '</select></div>'; }
  function val(m, id) { var e = m.querySelector("#ff-" + id); return e ? e.value : ""; }
  function gv(id) { var e = $("#ff-" + id); return e ? e.value : ""; }

  /* ---------- icons ---------- */
  function waIcon() { return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24z"/></svg>'; }
  function phoneIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>'; }
  function leadIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h5"/></svg>'; }
  function rateIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>'; }
  function eyeIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'; }
  function popIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8"/></svg>'; }
  function boltIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9z"/></svg>'; }

  /* ---------- boot ---------- */
  $("#loginForm").addEventListener("submit", doLogin);
  $("#logout").onclick = logout;
  $("#menuBtn").onclick = function () { $("#side").classList.toggle("open"); };
  $all("#nav a").forEach(function (a) { a.onclick = function (e) { e.preventDefault(); route(a.getAttribute("data-route")); }; });
  if (sessionStorage.getItem(AUTH_KEY)) showApp();
})(window, document);
