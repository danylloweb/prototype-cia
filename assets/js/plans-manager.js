/* ============================================================
   CIA DO CORPO — Plans Manager
   Renderização dinâmica de planos por unidade selecionada
   ============================================================ */

(function (w, d) {
  var DATA = w.CDC.data;
  var UNIT_PLAN_KEY = "cdc_unit_for_plan";

  function getPlansByUnit(unitId) {
    var unit = DATA.unitById(unitId);
    if (!unit) return null;
    var cfg = DATA.get();
    return cfg.plans ? cfg.plans[unit.tier] : null;
  }

  function getSelectedUnitForPlan() {
    var id = localStorage.getItem(UNIT_PLAN_KEY);
    if (id && DATA.unitById(id)) return id;
    return "avenida-norte"; // fallback padrão
  }

  function setSelectedUnitForPlan(unitId) {
    localStorage.setItem(UNIT_PLAN_KEY, unitId);
    localStorage.setItem("cdc_my_unit", unitId); // sincroniza com seletor geral do site
    renderUnitTabs();
    renderPlans();
    if (w.CDC.exp && w.CDC.exp.applyUnit) w.CDC.exp.applyUnit();
  }

  function renderUnitTabs() {
    var host = d.querySelector("[data-units-tabs]");
    if (!host) return;

    var all = DATA.activeUnits();
    var grouped = { standard: [], exclusive: [] };
    all.forEach(function (u) {
      if (grouped[u.tier]) grouped[u.tier].push(u);
    });

    var selected = getSelectedUnitForPlan();
    var html = "";

    // Tier Standard
    if (grouped.standard.length) {
      html += '<div class="units-tab-group">';
      html += '<h4 class="tab-group-label">Premium Standard</h4>';
      html += '<div class="units-tab-buttons">';
      grouped.standard.forEach(function (u) {
        var active = u.id === selected ? " active" : "";
        html +=
          '<button class="unit-tab-btn' +
          active +
          '" data-select-unit="' +
          u.id +
          '">' +
          u.name +
          "</button>";
      });
      html += "</div></div>";
    }

    // Tier Exclusive
    if (grouped.exclusive.length) {
      html += '<div class="units-tab-group">';
      html += '<h4 class="tab-group-label">Exclusive</h4>';
      html += '<div class="units-tab-buttons">';
      grouped.exclusive.forEach(function (u) {
        var active = u.id === selected ? " active" : "";
        html +=
          '<button class="unit-tab-btn' +
          active +
          '" data-select-unit="' +
          u.id +
          '">' +
          u.name +
          "</button>";
      });
      html += "</div></div>";
    }

    host.innerHTML = html;

    // Delegação de cliques
    host.querySelectorAll("[data-select-unit]").forEach(function (btn) {
      btn.onclick = function (e) {
        e.preventDefault();
        var uid = btn.getAttribute("data-select-unit");
        setSelectedUnitForPlan(uid);
      };
    });
  }

  function renderPlans() {
    var host = d.querySelector("[data-plans-host]");
    if (!host) return;

    var unitId = getSelectedUnitForPlan();
    var plans = getPlansByUnit(unitId);
    if (!plans) return;

    var unit = DATA.unitById(unitId);
    var html = "";

    // Header com nome da unidade e tier
    html += '<div class="plans-header reveal">';
    html += '<h3 class="plans-unit-title">' + unit.name + "</h3>";
    html +=
      '<p class="plans-unit-info">Unidades incluídas: <strong>' +
      plans.unitsLabel +
      "</strong></p>";
    html += "</div>";

    // Grid de planos
    html += '<div class="plans-grid">';
    plans.items.forEach(function (plan) {
      var isFeatured = plan.featured;
      html += '<div class="plan' + (isFeatured ? " featured" : "") + ' reveal">';

      if (isFeatured) {
        html += '<span class="ribbon">Mais escolhido</span>';
      }

      html += "<h3>" + plan.name + "</h3>";
      html += '<p class="plan-desc">' + plan.description + "</p>";
      html +=
        '<div class="plan-price">' + plan.price + '<small>' +
        (plan.period || plan.total) +
        "</small></div>";
      html +=
        '<p style="font-size:.82rem;color:var(--text-soft);margin-bottom:14px">' +
        plan.enrollment +
        "</p>";

      if (plan.badges && plan.badges.length) {
        html += '<div class="plan-badges">';
        plan.badges.forEach(function (badge) {
          html +=
            '<span class="badge badge-' +
            badge.type +
            '">' +
            badge.label +
            "</span>";
        });
        html += "</div>";
      }

      html += "<ul>";
      plan.features.forEach(function (f) {
        html +=
          '<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg> ' +
          f +
          "</li>";
      });
      html += "</ul>";

      var btnClass = isFeatured ? "btn-primary" : "btn-ghost";
      html +=
        '<a class="btn ' +
        btnClass +
        ' btn-block" data-cdc="wa-default" href="#" data-plan="' +
        plan.id +
        '" data-plan-name="' +
        plan.name +
        '" data-unit="' +
        unitId +
        '">Quero o ' +
        plan.name +
        "</a>";

      html += "</div>";
    });
    html += "</div>";

    host.innerHTML = html;

    // Dynamic content is not observed by the initial reveal observer, so force it visible.
    host.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
  }

  function init() {
    renderUnitTabs();
    renderPlans();
  }

  d.readyState !== "loading" ? init() : d.addEventListener("DOMContentLoaded", init);

  w.CDC = w.CDC || {};
  w.CDC.plansManager = {
    getSelectedUnit: getSelectedUnitForPlan,
    setSelectedUnit: setSelectedUnitForPlan,
    getPlansByUnit: getPlansByUnit
  };
})(window, document);
