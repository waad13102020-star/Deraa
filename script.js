const STORAGE_KEY = "deraaState";

let state = {
  cyber: [],
  hr: [],
  operational: [],
  reports: [],
  checklist: {}
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state = Object.assign(state, parsed);
    } catch (e) {
      console.error(e);
    }
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clamp(number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, number));
}

function computeCyberScore(data) {
  let score = 100;

  if (data.ssl === "invalid") score -= 25;
  else if (data.ssl === "expiring") score -= 10;

  const extraPorts = Math.max(0, data.openPorts - 2);
  score -= Math.min(30, extraPorts * 5);

  score -= data.vulnCritical * 15;
  score -= data.vulnHigh * 8;
  score -= data.vulnMedium * 4;
  score -= data.vulnLow * 1;

  return clamp(Math.round(score));
}

function computeHRResult(data) {
  let score = 100;
  const warnings = [];

  if (data.resignationRate > 15) {
    score -= (data.resignationRate - 15) * 2;
    warnings.push("معدل استقالات مرتفع بشكل ملحوظ");
  }
  if (data.absenteeism > 10) {
    score -= (data.absenteeism - 10) * 2;
    warnings.push("ارتفاع في معدلات الغياب");
  }
  if (data.salaryVariance > 20) {
    score -= (data.salaryVariance - 20) * 1.5;
    warnings.push("تفاوت غير معتاد في أنماط الرواتب");
  }
  if (data.avgTenure > 0 && data.avgTenure < 1) {
    score -= 10;
    warnings.push("انخفاض متوسط بقاء الموظفين في مناصبهم");
  }

  return { score: clamp(Math.round(score)), warnings: warnings };
}

function computeOperationalScore(data) {
  let score = 100;
  score -= Math.min(30, data.downtimeHours * 1.5);
  score -= Math.min(30, data.incidents * 4);
  score += (data.maturity - 3) * 5;
  return clamp(Math.round(score));
}

function checklistScore(checkboxElements) {
  if (checkboxElements.length === 0) return 0;
  let checkedCount = 0;
  checkboxElements.forEach(function (box) {
    if (box.checked) checkedCount++;
  });
  return Math.round((checkedCount / checkboxElements.length) * 100);
}

function riskBand(score) {
  if (score === null || score === undefined) {
    return { label: "لا توجد بيانات بعد", color: "var(--text-muted)" };
  }
  if (score >= 80) return { label: "مخاطر منخفضة", color: "var(--good)" };
  if (score >= 60) return { label: "مخاطر متوسطة", color: "var(--warn)" };
  return { label: "مخاطر مرتفعة", color: "var(--danger)" };
}

function overallScore(scoresArray) {
  const valid = scoresArray.filter(function (s) {
    return s !== null && s !== undefined;
  });
  if (valid.length === 0) return null;
  const sum = valid.reduce(function (a, b) { return a + b; }, 0);
  return Math.round(sum / valid.length);
}

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
}

function el(id) {
  return document.getElementById(id);
}

function getAllScores() {
  const cyberLatest = state.cyber.length > 0 ? state.cyber[0].score : null;
  const hrLatest = state.hr.length > 0 ? state.hr[0].score : null;
  const operationalLatest = state.operational.length > 0 ? state.operational[0].score : null;

  const governanceBoxes = document.querySelectorAll("#governanceChecklist input[type=checkbox]");
  const complianceBoxes = document.querySelectorAll("#complianceChecklist input[type=checkbox]");
  const governanceScore = checklistScore(governanceBoxes);
  const complianceScore = checklistScore(complianceBoxes);

  const overall = overallScore([cyberLatest, hrLatest, governanceScore, complianceScore, operationalLatest]);

  return {
    cyber: cyberLatest,
    hr: hrLatest,
    governance: governanceScore,
    compliance: complianceScore,
    operational: operationalLatest,
    overall: overall
  };
}

function renderOverall(scores) {
  const band = riskBand(scores.overall);
  const pct = scores.overall || 0;

  const circle = el("overallCircle");
  circle.style.background =
    "conic-gradient(" + band.color + " " + (pct * 3.6) + "deg, var(--bg-surface-2) 0deg)";

  el("overallScoreText").textContent = scores.overall !== null ? scores.overall : "—";
  el("overallCaption").textContent = band.label;
  el("overallCaption").style.color = band.color;

  el("overallChipValue").textContent = scores.overall !== null ? scores.overall : "—";
  el("overallChipValue").style.color = band.color;
}

function renderBars(scores) {
  const items = [
    { label: "الأمن السيبراني", value: scores.cyber },
    { label: "الموارد البشرية", value: scores.hr },
    { label: "الحوكمة", value: scores.governance },
    { label: "الامتثال", value: scores.compliance },
    { label: "التشغيلي", value: scores.operational }
  ];

  let html = "";
  items.forEach(function (item) {
    const band = riskBand(item.value);
    const width = item.value || 0;
    html +=
      '<div class="bar-row">' +
      '<span class="bar-label">' + item.label + "</span>" +
      '<div class="bar-track"><div class="bar-fill" style="width:' + width + "%; background:" + band.color + ';"></div></div>' +
      '<span class="bar-value">' + (item.value !== null ? item.value : "—") + "</span>" +
      "</div>";
  });
  el("categoryBars").innerHTML = html;
}

function renderScoreCards(scores) {
  const cards = [
    { key: "cyber", title: "الأمن السيبراني", value: scores.cyber },
    { key: "hr", title: "الموارد البشرية", value: scores.hr },
    { key: "governance", title: "الحوكمة", value: scores.governance },
    { key: "compliance", title: "الامتثال التنظيمي", value: scores.compliance },
    { key: "operational", title: "المخاطر التشغيلية", value: scores.operational }
  ];

  let html = "";
  cards.forEach(function (c) {
    const band = riskBand(c.value);
    html +=
      '<button class="score-card" data-goto="' + c.key + '">' +
      '<div class="score-card-title">' + c.title + "</div>" +
      '<div class="score-card-value">' + (c.value !== null ? c.value : "—") + " <small>/100</small></div>" +
      '<div class="score-card-band"><span class="dot" style="background:' + band.color + '"></span>' + band.label + "</div>" +
      "</button>";
  });
  el("scoreGrid").innerHTML = html;

  document.querySelectorAll(".score-card").forEach(function (card) {
    card.addEventListener("click", function () {
      goToSection(card.getAttribute("data-goto"));
    });
  });
}

function renderRecentActivity() {
  const all = [];

  state.cyber.forEach(function (h) {
    all.push({ date: h.date, text: "فحص أمني للنطاق " + h.domain, score: h.score });
  });
  state.hr.forEach(function (h) {
    all.push({ date: h.date, text: "تقييم مخاطر الموارد البشرية", score: h.score });
  });
  state.operational.forEach(function (h) {
    all.push({ date: h.date, text: "تقييم المخاطر التشغيلية", score: h.score });
  });
  state.reports.forEach(function (r) {
    all.push({ date: r.date, text: "بلاغ جديد: " + r.category, score: null });
  });

  all.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
  const recent = all.slice(0, 6);

  const list = el("recentActivityList");
  if (recent.length === 0) {
    list.innerHTML = '<li class="empty-state" style="border:none">لا يوجد نشاط بعد. ابدأ بإدخال بيانات أول تقييم من القائمة الجانبية.</li>';
    return;
  }

  let html = "";
  recent.forEach(function (a) {
    const band = riskBand(a.score);
    html +=
      "<li>" +
      '<span class="activity-date">' + formatDate(a.date) + "</span>" +
      '<span class="activity-text">' + a.text + "</span>" +
      (a.score !== null
        ? '<span class="badge" style="color:' + band.color + ";border-color:" + band.color + '">' + a.score + "/100</span>"
        : "") +
      "</li>";
  });
  list.innerHTML = html;
}

function renderDashboard() {
  const scores = getAllScores();
  renderOverall(scores);
  renderBars(scores);
  renderScoreCards(scores);
  renderRecentActivity();
}

function renderCyberHistory() {
  const body = el("cyberHistoryBody");
  const emptyMsg = el("cyberEmpty");

  if (state.cyber.length === 0) {
    body.innerHTML = "";
    emptyMsg.style.display = "block";
    return;
  }
  emptyMsg.style.display = "none";

  let html = "";
  state.cyber.forEach(function (h) {
    const band = riskBand(h.score);
    const sslLabel = h.ssl === "valid" ? "سارية" : h.ssl === "expiring" ? "قاربة على الانتهاء" : "غير سارية";
    const totalVulns = h.vulnCritical + h.vulnHigh + h.vulnMedium + h.vulnLow;
    html +=
      "<tr>" +
      "<td>" + formatDate(h.date) + "</td>" +
      "<td>" + h.domain + "</td>" +
      "<td>" + sslLabel + "</td>" +
      "<td>" + h.openPorts + "</td>" +
      "<td>" + totalVulns + "</td>" +
      '<td><span class="badge" style="color:' + band.color + ";border-color:" + band.color + '">' + h.score + "/100</span></td>" +
      "</tr>";
  });
  body.innerHTML = html;
}

function renderHrHistory() {
  const list = el("hrHistoryList");
  const emptyMsg = el("hrEmpty");

  if (state.hr.length === 0) {
    list.innerHTML = "";
    emptyMsg.style.display = "block";
    return;
  }
  emptyMsg.style.display = "none";

  let html = "";
  state.hr.forEach(function (h) {
    const band = riskBand(h.score);
    let warningsHtml = "";
    if (h.warnings && h.warnings.length > 0) {
      warningsHtml = '<div class="hr-warnings">';
      h.warnings.forEach(function (w) {
        warningsHtml += '<span class="warning-chip"><span class="dot"></span>' + w + "</span>";
      });
      warningsHtml += "</div>";
    }
    html +=
      '<li class="hr-entry">' +
      '<div class="hr-entry-top">' +
      '<span class="activity-date">' + formatDate(h.date) + "</span>" +
      '<span class="badge" style="color:' + band.color + ";border-color:" + band.color + '">' + h.score + "/100</span>" +
      "</div>" +
      '<div class="hr-entry-stats">استقالات ' + h.resignationRate + "% · غياب " + h.absenteeism + "% · تفاوت رواتب " + h.salaryVariance + "% · بقاء " + h.avgTenure + " سنة</div>" +
      warningsHtml +
      "</li>";
  });
  list.innerHTML = html;
}

function renderOperationalHistory() {
  const body = el("operationalHistoryBody");
  const emptyMsg = el("opEmpty");

  if (state.operational.length === 0) {
    body.innerHTML = "";
    emptyMsg.style.display = "block";
    return;
  }
  emptyMsg.style.display = "none";

  let html = "";
  state.operational.forEach(function (h) {
    const band = riskBand(h.score);
    html +=
      "<tr>" +
      "<td>" + formatDate(h.date) + "</td>" +
      "<td>" + h.downtimeHours + "</td>" +
      "<td>" + h.incidents + "</td>" +
      "<td>" + h.maturity + "/5</td>" +
      '<td><span class="badge" style="color:' + band.color + ";border-color:" + band.color + '">' + h.score + "/100</span></td>" +
      "</tr>";
  });
  body.innerHTML = html;
}

function renderReports() {
  const list = el("reportsList");
  const emptyMsg = el("reportsEmpty");

  if (state.reports.length === 0) {
    list.innerHTML = "";
    emptyMsg.style.display = "block";
    return;
  }
  emptyMsg.style.display = "none";

  let html = "";
  state.reports.forEach(function (r) {
    html +=
      '<li class="report-item">' +
      '<div class="report-top">' +
      '<span class="activity-date">' + formatDate(r.date) + "</span>" +
      '<span class="report-category">' + r.category + "</span>" +
      (r.anonymous ? '<span class="badge">مجهول الهوية</span>' : "") +
      "</div>" +
      '<p class="report-desc">' + r.description + "</p>" +
      '<label class="status-field"><span>الحالة</span>' +
      '<select data-report-id="' + r.id + '">' +
‎      ["جديد", "قيد المراجعة", "تم الحل"]
        .map(function (s) {
          return '<option value="' + s + '"' + (s === r.status ? " selected" : "") + ">" + s + "</option>";
        })
        .join("") +
      "</select></label>" +
      "</li>";
  });
  list.innerHTML = html;

  document.querySelectorAll("select[data-report-id]").forEach(function (select) {
    select.addEventListener("change", function () {
      const id = Number(select.getAttribute("data-report-id"));
      const report = state.reports.find(function (r) { return r.id === id; });
      if (report) {
        report.status = select.value;
        saveState();
      }
    });
  });
}

function renderChecklistScores() {
  const governanceBoxes = document.querySelectorAll("#governanceChecklist input[type=checkbox]");
  const complianceBoxes = document.querySelectorAll("#complianceChecklist input[type=checkbox]");

  const governanceScore = checklistScore(governanceBoxes);
  const complianceScore = checklistScore(complianceBoxes);

  const govBand = riskBand(governanceScore);
  const compBand = riskBand(complianceScore);

  const govBadge = el("governanceScoreBadge");
  govBadge.textContent = governanceScore + "/100 — " + govBand.label;
  govBadge.style.color = govBand.color;
  govBadge.style.borderColor = govBand.color;

  const compBadge = el("complianceScoreBadge");
  compBadge.textContent = complianceScore + "/100 — " + compBand.label;
  compBadge.style.color = compBand.color;
  compBadge.style.borderColor = compBand.color;
}

function applyChecklistState() {
  const allBoxes = document.querySelectorAll('#governanceChecklist input[type=checkbox], #complianceChecklist input[type=checkbox]');
  allBoxes.forEach(function (box) {
    box.checked = !!state.checklist[box.id];
  });
}

function renderAll() {
  renderChecklistScores();
  renderDashboard();
  renderCyberHistory();
  renderHrHistory();
  renderOperationalHistory();
  renderReports();
}

function goToSection(sectionId) {
  document.querySelectorAll(".page").forEach(function (page) {
    page.classList.remove("active");
  });
  document.querySelectorAll(".nav-item").forEach(function (btn) {
    btn.classList.remove("active");
  });

  el(sectionId).classList.add("active");
  document.querySelector('.nav-item[data-section="' + sectionId + '"]').classList.add("active");
}

document.querySelectorAll(".nav-item").forEach(function (btn) {
  btn.addEventListener("click", function () {
    goToSection(btn.getAttribute("data-section"));
  });
});

el("cyberForm").addEventListener("submit", function (event) {
  event.preventDefault();

  const domain = el("cyberDomain").value.trim();
  if (!domain) {
    el("cyberError").textContent = "أدخل اسم النطاق قبل بدء الفحص.";
    return;
  }
  el("cyberError").textContent = "";

  const data = {
    domain: domain,
    ssl: el("cyberSsl").value,
    openPorts: Number(el("cyberPorts").value) || 0,
    vulnCritical: Number(el("cyberCritical").value) || 0,
    vulnHigh: Number(el("cyberHigh").value) || 0,
    vulnMedium: Number(el("cyberMedium").value) || 0,
    vulnLow: Number(el("cyberLow").value) || 0
  };

  const score = computeCyberScore(data);

  state.cyber.unshift(Object.assign({ id: Date.now(), date: new Date().toISOString(), score: score }, data));

  saveState();
  renderAll();
  event.target.reset();
  el("cyberPorts").value = 2;
});

el("hrForm").addEventListener("submit", function (event) {
  event.preventDefault();

  const resignationInput = el("hrResignation").value;
  const tenureInput = el("hrTenure").value;
  if (resignationInput === "" || tenureInput === "") {
    el("hrError").textContent = "أدخل معدل الاستقالات ومتوسط بقاء الموظفين على الأقل.";
    return;
  }
  el("hrError").textContent = "";

  const data = {
    resignationRate: Number(resignationInput) || 0,
    absenteeism: Number(el("hrAbsenteeism").value) || 0,
    salaryVariance: Number(el("hrSalaryVariance").value) || 0,
    avgTenure: Number(tenureInput) || 0
  };

  const result = computeHRResult(data);

  state.hr.unshift(Object.assign(
    { id: Date.now(), date: new Date().toISOString(), score: result.score, warnings: result.warnings },
    data
  ));

  saveState();
  renderAll();
  event.target.reset();
});

el("operationalForm").addEventListener("submit", function (event) {
  event.preventDefault();

  const downtimeInput = el("opDowntime").value;
  if (downtimeInput === "") {
    el("opError").textContent = "أدخل عدد ساعات التوقف على الأقل.";
    return;
  }
  el("opError").textContent = "";

  const data = {
    downtimeHours: Number(downtimeInput) || 0,
    incidents: Number(el("opIncidents").value) || 0,
    maturity: Number(el("opMaturity").value)
  };

  const score = computeOperationalScore(data);

  state.operational.unshift(Object.assign({ id: Date.now(), date: new Date().toISOString(), score: score }, data));

  saveState();
  renderAll();
  event.target.reset();
  el("opMaturity").value = 3;
});

el("reportForm").addEventListener("submit", function (event) {
  event.preventDefault();

  const description = el("reportDescription").value.trim();
  if (!description) {
    el("reportError").textContent = "يرجى كتابة وصف موجز للبلاغ.";
    el("reportSuccess").style.display = "none";
    return;
  }
  el("reportError").textContent = "";

  const newReport = {
    id: Date.now(),
    date: new Date().toISOString(),
    category: el("reportCategory").value,
    description: description,
    anonymous: el("reportAnonymous").checked,
    status: "جديد"
  };

  state.reports.unshift(newReport);
  saveState();
  renderAll();

  event.target.reset();
  el("reportAnonymous").checked = true;

  el("reportSuccess").style.display = "block";
  setTimeout(function () {
    el("reportSuccess").style.display = "none";
  }, 3000);
});

document.querySelectorAll('#governanceChecklist input[type=checkbox], #complianceChecklist input[type=checkbox]').forEach(function (box) {
  box.addEventListener("change", function () {
    state.checklist[box.id] = box.checked;
    saveState();
    renderAll();
  });
});

el("resetBtn").addEventListener("click", function () {
  const sure = confirm("سيتم حذف جميع البيانات المدخلة نهائيًا. هل تريد المتابعة؟");
  if (sure) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
});

loadState();
applyChecklistState();
renderAll();
