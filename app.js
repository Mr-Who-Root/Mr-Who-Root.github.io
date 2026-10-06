/* ===========================================================
   Cyber-Sentry portfolio — all content is rendered from
   data.json at runtime, so editing that file updates the site.
   =========================================================== */

(() => {
  "use strict";

  let DATA = null;

  // ---------------- utils ----------------

  const $ = (id) => document.getElementById(id);

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));

  const renderInline = (text) =>
    esc(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");

  // data.json writes bullets inconsistently ("- foo" and "-foo" both occur)
  function renderBullets(text) {
    if (!text) return "";
    const lines = String(text).split("\n").map((l) => l.trim()).filter(Boolean);
    let html = "", inList = false;
    for (const line of lines) {
      const m = line.match(/^[-*]\s*(.+)$/);
      if (m) {
        if (!inList) { html += "<ul>"; inList = true; }
        html += `<li>${renderInline(m[1])}</li>`;
      } else {
        if (inList) { html += "</ul>"; inList = false; }
        html += `<p>${renderInline(line)}</p>`;
      }
    }
    return inList ? html + "</ul>" : html;
  }

  const socialUrl = (platform, username) => {
    const p = String(platform).toLowerCase();
    if (p === "linkedin") return `https://linkedin.com/in/${username}`;
    if (p === "github") return `https://github.com/${username}`;
    if (p === "twitter" || p === "x") return `https://x.com/${username}`;
    return username;
  };

  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // "Aug 2024", "April 2022", "2017", "Present" -> Date (null if unparseable)
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  function parseDate(s) {
    const str = String(s || "").trim().toLowerCase();
    if (!str) return null;
    if (/present|current|now/.test(str)) return new Date();
    const year = (str.match(/\b(19|20)\d{2}\b/) || [])[0];
    if (!year) return null;
    const mi = MONTHS.findIndex((m) => str.includes(m));
    return new Date(Number(year), mi < 0 ? 0 : mi, 1);
  }

  const isPresent = (s) => /present|current|now/i.test(String(s || ""));

  // "2 yrs 2 mos" between two date strings
  function durationOf(start, end) {
    const a = parseDate(start), b = parseDate(end);
    if (!a || !b) return "";
    const months = Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth());
    const y = Math.floor(months / 12), m = months % 12;
    return [y ? `${y} yr${y > 1 ? "s" : ""}` : "", m ? `${m} mo${m > 1 ? "s" : ""}` : ""]
      .filter(Boolean).join(" ");
  }

  // Projects carry no category field, so infer filter tags from their text.
  const PROJECT_TAGS = [
    ["SECURITY", /secur|soar|threat|\bsoc\b|complian|firewall|red\/blue|log management|incident|nmap|nuclei/i],
    ["AI", /\bai\b|\bml\b|\brag\b|gemini|llm|machine learning/i],
    ["MOBILE", /flutter|fultter|kotlin|android|ios|admob/i],
  ];
  const projectTags = (pr) => {
    const hay = `${pr.name} ${pr.description} ${pr.technologies}`;
    const tags = PROJECT_TAGS.filter(([, re]) => re.test(hay)).map(([t]) => t);
    return tags.length ? tags : ["PLATFORM"];
  };

  // Flatten every custom section into { title, issuer, date, kind }, newest first.
  function credentials() {
    return (DATA.customSections || []).flatMap((section) => {
      const fields = section.fields || [];
      const titleF = fields.find((f) => f.type !== "date") || fields[0];
      const dateF = fields.find((f) => f.type === "date");
      return (section.items || []).map((item) => {
        const raw = String(titleF ? item[titleF.name] ?? "" : "").trim();
        // "Splunk 7.x Fundamentals Part 1 , Splunk" -> title + issuer
        const cut = raw.lastIndexOf(",");
        const title = (cut > 0 ? raw.slice(0, cut) : raw).trim();
        const issuer = cut > 0 ? raw.slice(cut + 1).trim() : "";
        const date = dateF ? String(item[dateF.name] ?? "") : "";
        const kind = /hackathon|award|winner|finalist|competition/i.test(raw) ? "ACHIEVEMENT" : "CERTIFIED";
        return { title, issuer, date, kind, t: parseDate(date)?.getTime() ?? 0 };
      });
    }).filter((c) => c.title).sort((a, b) => b.t - a.t);
  }

  // ---------------- custom HUD cursor ----------------
  // Only for real pointing devices — touch users keep native behaviour.

  function setupCursor() {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;

    const dot = $("cursor-dot");
    const ring = $("cursor-ring");
    const label = $("cursor-label");
    if (!dot || !ring) return;

    document.body.classList.add("has-cursor");

    let mx = window.innerWidth / 2, my = window.innerHeight / 2;   // true pointer
    let rx = mx, ry = my;                                          // ring (eased)

    document.addEventListener("mousemove", (e) => {
      mx = e.clientX;
      my = e.clientY;
      // the dot tracks exactly; the ring lags behind via the rAF loop
      dot.style.transform = `translate(${mx}px, ${my}px)`;
    }, { passive: true });

    // ring trails the dot with simple exponential easing
    (function loop() {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      requestAnimationFrame(loop);
    })();

    document.addEventListener("mousedown", () => document.body.classList.add("cursor-down"));
    document.addEventListener("mouseup", () => document.body.classList.remove("cursor-down"));
    document.addEventListener("mouseleave", () => document.body.classList.add("cursor-out"));
    document.addEventListener("mouseenter", () => document.body.classList.remove("cursor-out"));

    // hover targets: anything interactive, with an optional readout label
    const HOVER_SEL = "a, button, .tag, .proj, .cert, .crow, [data-cursor]";
    document.addEventListener("mouseover", (e) => {
      const t = e.target.closest(HOVER_SEL);
      if (!t) return;
      document.body.classList.add("cursor-hover");
      label.textContent = t.getAttribute("data-cursor") || "OPEN";
    });
    document.addEventListener("mouseout", (e) => {
      if (e.target.closest(HOVER_SEL) && !e.relatedTarget?.closest?.(HOVER_SEL)) {
        document.body.classList.remove("cursor-hover");
        label.textContent = "";
      }
    });
  }

  // ---------------- boot sequence ----------------

  function runBoot(onDone) {
    const boot = $("boot");
    const log = $("boot-log");
    const fill = $("boot-fill");
    if (!boot || !log) return onDone();

    // play once per browser session — reloads and back-navigation skip it
    let seen = false;
    try { seen = sessionStorage.getItem("cs-booted") === "1"; sessionStorage.setItem("cs-booted", "1"); } catch (_) {}
    if (reducedMotion() || seen) { boot.classList.add("done"); document.body.classList.remove("booting"); return onDone(); }

    document.body.classList.add("booting");

    const lines = [
      "> initializing cyber-sentry core ...",
      "> mounting /dev/portfolio ......... OK",
      "> verifying signature ............ VALID",
      "> establishing secure channel .... AES-256",
      "> loading operator profile ....... DONE",
      "> access granted.",
    ];

    let i = 0;
    const step = () => {
      if (i < lines.length) {
        log.textContent += lines[i] + "\n";
        fill.style.width = Math.round(((i + 1) / lines.length) * 100) + "%";
        i++;
        setTimeout(step, 190);
      } else {
        setTimeout(() => {
          boot.classList.add("done");
          document.body.classList.remove("booting");
          onDone();
        }, 320);
      }
    };
    setTimeout(step, 160);
  }

  // ---------------- HUD status bar ----------------

  function setupHud() {
    const clock = $("hb-clock");
    const uptime = $("hb-uptime");
    const pid = $("hb-pid");
    const ping = $("hb-ping");

    if (pid) pid.textContent = String(Math.floor(1000 + Math.random() * 8000));
    if (ping) ping.textContent = Math.floor(12 + Math.random() * 40) + "MS";

    const start = Date.now();
    const pad = (n) => String(n).padStart(2, "0");

    setInterval(() => {
      const now = new Date();
      if (clock) clock.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const s = Math.floor((Date.now() - start) / 1000);
      if (uptime) uptime.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
    }, 1000);
  }

  // ---------------- hero ----------------

  function renderHero() {
    const p = DATA.personalInfo;

    $("brand-text").innerHTML = (() => {
      const parts = String(p.name).trim().split(/\s+/);
      const first = parts.shift();
      return `${esc(first.toUpperCase())}<span class="b2">_${esc(parts.join("").toUpperCase())}</span>`;
    })();

    $("hero-chip").textContent =
      `${String(p.title).toUpperCase().replace(/\s+/g, "_")} // V1.0`;

    // Name stacks as: first word, then the rest — each line gets its own glow.
    const words = String(p.name).trim().split(/\s+/);
    const lines = words.length > 1 ? [words[0], words.slice(1).join(" ")] : [words[0]];
    const nameEl = $("hero-name");
    nameEl.setAttribute("aria-label", p.name);
    nameEl.innerHTML = lines
      .map((l) => `<span class="ln" data-text="${esc(l.toUpperCase())}">${esc(l.toUpperCase())}</span>`)
      .join("");

    // periodic glitch burst
    if (!reducedMotion()) {
      const glitch = () => {
        nameEl.classList.add("glitching");
        setTimeout(() => nameEl.classList.remove("glitching"), 430);
        setTimeout(glitch, 3200 + Math.random() * 4200);
      };
      setTimeout(glitch, 1400);
    }

    // First sentence of the summary — skill *category* names ("Languages",
    // "Frameworks & Libraries") read as meaningless filler here.
    const firstSentence = String(p.summary).split(/\.\s+/)[0].trim();
    $("hero-tagline").textContent = (() => {
      if (firstSentence.length <= 200) return firstSentence + ".";
      // trim back to a word boundary so it never cuts mid-word
      const cut = firstSentence.slice(0, 200);
      return cut.slice(0, cut.lastIndexOf(" ")) + "…";
    })();

    const mail = $("btn-mail");
    mail.href = `mailto:${p.email}`;
    mail.textContent = "GET_IN_TOUCH";

    renderRadar();

    // current role, if any
    const now = (DATA.experience || []).find((e) => isPresent(e.endDate));
    $("hero-now").innerHTML = now
      ? `<i class="led green"></i><span class="hn-k">NOW</span> ${esc(now.position)} <span class="hn-at">@</span> ${esc(now.company)}`
      : "";

    // newest certification (achievements like hackathons don't count)
    const latest = credentials().find((c) => c.kind === "CERTIFIED");
    // Prefer the acronym — "Certified Ethical Hacker (CEH)" reads as "CEH";
    // otherwise cut at a word boundary: "FortiSOAR 7.6 Administrator" -> "FORTISOAR 7.6".
    const certLabel = (() => {
      if (!latest) return "OPERATOR";
      const acronym = latest.title.match(/\(([A-Za-z]{2,8})\)/);
      if (acronym) return acronym[1].toUpperCase();
      const words = latest.title.split(/[\s(]+/);
      let out = words.shift();
      for (const w of words) { if ((out + " " + w).length > 16) break; out += " " + w; }
      return out.toUpperCase();
    })();
    $("id-badge").textContent = `${certLabel} // VALID`;

    const edu = (DATA.education || [])[0];
    $("id-org").textContent = edu
      ? (edu.institution.match(/\b[A-Z]/g) || []).join("").slice(0, 4) || "EDU"
      : "SEC";
  }

  // ---------------- identity panel: radar instead of a photo ----------------

  const RADAR_PERIOD = 4;   // seconds per sweep — keep in sync with .radar-sweep in style.css
  const FOCUS = ["SOC_AUTOMATION", "SOAR_PLAYBOOKS", "THREAT_INTEL", "DETECTION_ENG", "MOBILE_APPS"];

  function renderRadar() {
    // one blip per project, spread by the golden angle so they never bunch up
    const n = Math.max(3, Math.min(12, (DATA.projects || []).length));
    $("radar").insertAdjacentHTML("beforeend", Array.from({ length: n }, (_, i) => {
      const deg = (i * 137.508 + 24) % 360;
      const r = 14 + ((i * 23) % 30);   // % of the radar box, center is 50%
      const rad = (deg * Math.PI) / 180;
      const x = 50 + r * Math.sin(rad), y = 50 - r * Math.cos(rad);
      // light up exactly when the sweep's leading edge passes this angle
      return `<span class="blip" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;animation-delay:${((deg / 360) * RADAR_PERIOD).toFixed(2)}s"></span>`;
    }).join(""));
    // the sweep has been spinning since page load; restart it so it shares t=0 with the blips
    const sweep = document.querySelector(".radar-sweep");
    sweep.style.animation = "none";
    void sweep.offsetWidth;
    sweep.style.animation = "";

    const el = $("id-focus");
    if (reducedMotion()) { el.textContent = FOCUS[0]; return; }
    // type each focus area out, hold, then move to the next
    let i = 0;
    const type = (word, k = 0) => {
      el.textContent = word.slice(0, k);
      if (k < word.length) return setTimeout(() => type(word, k + 1), 55);
      setTimeout(() => type(FOCUS[++i % FOCUS.length]), 2200);
    };
    type(FOCUS[0]);
  }

  // ---------------- sections ----------------

  function renderAbout() {
    const p = DATA.personalInfo;
    const years = (String(p.summary).match(/(\d+)\+?\s*years?/i) || [])[1];
    const certs = credentials().filter((c) => c.kind === "CERTIFIED").length;

    $("about-content").innerHTML = `
      <div class="about-text" data-reveal>
        <p>${renderInline(p.summary)}</p>
        <p class="about-loc">// LOCATION: ${esc(p.location)}</p>
      </div>
      <div class="stat-grid" data-reveal>
        ${[
          [years ? years + "+" : (DATA.experience || []).length, "YEARS_ACTIVE"],
          [(DATA.projects || []).length, "PROJECTS"],
          [certs, "CERTIFICATIONS"],
          ["300+", "INTEGRATIONS"],
        ].map(([n, l]) => `<div class="stat"><div class="stat-n">${esc(n)}</div><div class="stat-l">${l}</div></div>`).join("")}
      </div>
    `;
  }

  function renderSkills() {
    $("skills-content").innerHTML = (DATA.skills || []).map((s) => {
      const tags = String(s.skills).split(",").map((t) => t.trim()).filter(Boolean);
      return `
        <div class="skill-block" data-reveal>
          <h3>// ${esc(s.category).toUpperCase()} <span class="skill-n">[${String(tags.length).padStart(2, "0")}]</span></h3>
          <div class="skill-tags">
            ${tags.map((t) => `<span class="tag" data-cursor="SKILL">${esc(t)}</span>`).join("")}
          </div>
        </div>
      `;
    }).join("");
  }

  function renderProjects() {
    const projects = (DATA.projects || []).map((pr) => ({ ...pr, tags: projectTags(pr) }));
    const filters = ["ALL", ...["SECURITY", "AI", "MOBILE", "PLATFORM"]
      .filter((t) => projects.some((p) => p.tags.includes(t)))];
    const count = (f) => f === "ALL" ? projects.length : projects.filter((p) => p.tags.includes(f)).length;

    const bar = filters.length > 2 ? `
      <div class="proj-filter" role="group" aria-label="Filter projects" data-reveal>
        ${filters.map((f, i) => `
          <button type="button" class="pf${i === 0 ? " on" : ""}" data-filter="${f}" aria-pressed="${i === 0}" data-cursor="FILTER">
            ${f}<span class="pf-n">${String(count(f)).padStart(2, "0")}</span>
          </button>`).join("")}
      </div>` : "";

    const cards = projects.map((pr, i) => {
      const stack = String(pr.technologies || "").split(",").map((t) => t.trim()).filter(Boolean);
      return `
        <article class="proj" data-reveal data-tags="${pr.tags.join(" ")}" data-cursor="INSPECT">
          <div class="proj-top">
            <span class="proj-idx">OP_${String(i + 1).padStart(2, "0")}</span>
            <span class="proj-tags">${pr.tags.map((t) => `<span class="ptag ptag-${t.toLowerCase()}">${t}</span>`).join("")}</span>
          </div>
          <h3 class="proj-name">${esc(pr.name)}</h3>
          <p class="proj-desc">${renderInline(pr.description)}</p>
          <div class="proj-stack">${stack.map((t) => `<span class="chip-sm">${esc(t)}</span>`).join("")}</div>
          ${pr.link ? `<a class="proj-link" href="${esc(pr.link)}" target="_blank" rel="noopener" data-cursor="OPEN">ACCESS &rarr;</a>` : ""}
        </article>
      `;
    }).join("");

    $("projects-content").innerHTML = `${bar}<div class="proj-grid">${cards}</div>`;

    $("projects-content").addEventListener("click", (e) => {
      const btn = e.target.closest(".pf");
      if (!btn) return;
      const f = btn.dataset.filter;
      document.querySelectorAll(".pf").forEach((b) => {
        b.classList.toggle("on", b === btn);
        b.setAttribute("aria-pressed", String(b === btn));
      });
      document.querySelectorAll(".proj").forEach((card) => {
        card.hidden = f !== "ALL" && !card.dataset.tags.split(" ").includes(f);
      });
    });
  }

  const BULLETS_SHOWN = 4;

  function renderExperience() {
    // consecutive roles at the same company collapse into one group (promotions)
    const groups = [];
    for (const e of DATA.experience || []) {
      const last = groups[groups.length - 1];
      if (last && last.company.trim().toLowerCase() === String(e.company).trim().toLowerCase()) last.roles.push(e);
      else groups.push({ company: e.company, roles: [e] });
    }

    // `company` is passed only for a standalone role; grouped roles share the group header
    const role = (e, company) => {
      const html = renderBullets(e.description);
      // hide everything past the first few bullets behind a toggle
      // (a single leftover bullet isn't worth a toggle)
      const total = (html.match(/<li>/g) || []).length;
      const keep = total > BULLETS_SHOWN + 1 ? BULLETS_SHOWN : total;
      let n = 0;
      const clipped = html.replace(/<li>/g, () => (++n > keep ? '<li class="more">' : "<li>"));
      const extra = total - keep;
      return `
        <div class="role${isPresent(e.endDate) ? " role-now" : ""}">
          <div class="role-head">
            <h3 class="exp-role">${esc(e.position)}</h3>
            ${isPresent(e.endDate) ? `<span class="badge-now"><i class="led green"></i>CURRENT</span>` : ""}
          </div>
          ${company ? `<div class="exp-org">${esc(company)}</div>` : ""}
          <div class="exp-meta">
            ${esc(e.startDate)} &mdash; ${esc(e.endDate)}
            <span class="dur">// ${durationOf(e.startDate, e.endDate)}</span>
            ${company ? `<span class="loc">// ${esc(e.location)}</span>` : ""}
          </div>
          <div class="role-body">${clipped}</div>
          ${extra ? `<button type="button" class="exp-more" aria-expanded="false" data-cursor="EXPAND" data-n="${extra}">+ ${extra} MORE</button>` : ""}
        </div>
      `;
    };

    const exp = groups.map((g) => {
      const multi = g.roles.length > 1;
      const first = g.roles[g.roles.length - 1], latest = g.roles[0];
      return `
        <div class="exp" data-reveal>
          <div class="exp-kind">// DEPLOYMENT${multi ? ` <span class="promo">&#9650; ${g.roles.length - 1 > 1 ? g.roles.length - 1 + " PROMOTIONS" : "PROMOTED"}</span>` : ""}</div>
          ${multi ? `
            <div class="exp-org exp-org-lg">${esc(g.company)}</div>
            <div class="exp-meta">${esc(first.startDate)} &mdash; ${esc(latest.endDate)}
              <span class="dur">// ${durationOf(first.startDate, latest.endDate)}</span>
              <span class="loc">// ${esc(latest.location)}</span></div>
            <div class="roles">${g.roles.map((r) => role(r)).join("")}</div>
          ` : role(latest, g.company)}
        </div>
      `;
    }).join("");

    const edu = (DATA.education || []).map((e) => `
      <div class="exp" data-reveal>
        <div class="exp-kind">// TRAINING</div>
        <h3 class="exp-role">${esc(e.degree)}${e.fieldOfStudy ? " &mdash; " + esc(e.fieldOfStudy) : ""}</h3>
        <div class="exp-org">${esc(e.institution)}</div>
        <div class="exp-meta">${esc(e.startDate)} &mdash; ${esc(e.endDate)} <span class="loc">// ${esc(e.location)}</span></div>
        ${e.description ? `<p>${renderInline(e.description)}</p>` : ""}
      </div>
    `).join("");

    const wrap = $("experience-content");
    wrap.innerHTML = exp + edu;
    wrap.addEventListener("click", (e) => {
      const btn = e.target.closest(".exp-more");
      if (!btn) return;
      const r = btn.closest(".role");
      const open = r.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(open));
      btn.textContent = open ? "- COLLAPSE" : `+ ${btn.dataset.n} MORE`;
    });
  }

  function renderCerts() {
    $("certs-content").innerHTML = credentials().map((c) => `
      <div class="cert${c.kind === "ACHIEVEMENT" ? " cert-ach" : ""}" data-reveal data-cursor="${c.kind === "ACHIEVEMENT" ? "AWARD" : "VERIFY"}">
        <div class="cert-valid">${c.kind === "ACHIEVEMENT" ? "&#9733; ACHIEVEMENT" : "&#9679; CERTIFIED"}</div>
        <div class="cert-name">${esc(c.title)}</div>
        <div class="cert-date">${[c.issuer, c.date].filter(Boolean).map(esc).join(" // ")}</div>
      </div>
    `).join("");
  }

  function renderContact() {
    const p = DATA.personalInfo;
    // phone is intentionally never rendered, even though data.json carries it
    const rows = [
      ["EMAIL", `<a href="mailto:${esc(p.email)}" data-cursor="MAIL">${esc(p.email)}</a>
                 <button type="button" class="copy" data-copy="${esc(p.email)}" data-cursor="COPY">COPY</button>`],
      ["LOCATION", esc(p.location)],
      ...(p.socialLinks || []).map((s) => {
        const url = socialUrl(s.platform, s.username);
        return [String(s.platform).toUpperCase(), `<a href="${esc(url)}" target="_blank" rel="noopener" data-cursor="OPEN">${esc(url.replace(/^https?:\/\//, ""))}</a>`];
      }),
    ];

    $("contact-content").innerHTML = `
      <div data-reveal>
        <h3 class="contact-lead">Open a<br/><span class="cyan">secure channel</span>.</h3>
        <p class="contact-sub">
          &gt; Available for security engineering, SOC automation<br/>
          &gt; and detection engineering work.<br/>
          &gt; Response time: &lt; 24h
        </p>
        <a href="mailto:${esc(p.email)}" class="btn btn-pink" data-cursor="EXEC">SEND_MESSAGE</a>
      </div>
      <div class="contact-rows" data-reveal>
        ${rows.map(([k, v]) => `<div class="crow"><span class="k">${k}</span><span class="v">${v}</span></div>`).join("")}
      </div>
    `;

    $("site-foot").innerHTML =
      `&copy; ${new Date().getFullYear()} ${esc(p.name)} <span class="sf-sep">//</span> ${esc(p.title)}`;

    $("contact-content").addEventListener("click", (e) => {
      const btn = e.target.closest(".copy");
      if (!btn) return;
      const done = () => { btn.textContent = "COPIED"; setTimeout(() => (btn.textContent = "COPY"), 1600); };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(btn.dataset.copy).then(done, () => {});
    });
  }

  // ---------------- scroll behaviours ----------------

  function setupReveal() {
    if (!("IntersectionObserver" in window)) {
      document.documentElement.classList.add("reveal-fallback");
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
  }

  function setupActiveNav() {
    if (!("IntersectionObserver" in window)) return;
    const links = [...document.querySelectorAll(".nav a[data-nav]")];
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id));
      });
    }, { threshold: 0.4 });
    links.forEach((a) => {
      const sec = document.querySelector(a.getAttribute("href"));
      if (sec) io.observe(sec);
    });
  }

  function setupNav() {
    const burger = $("nav-burger");
    burger?.addEventListener("click", () => {
      const open = document.body.classList.toggle("nav-open");
      burger.setAttribute("aria-expanded", String(open));
    });
    document.querySelectorAll(".nav a").forEach((a) =>
      a.addEventListener("click", () => document.body.classList.remove("nav-open"))
    );
  }

  // ---------------- boot ----------------

  function renderAll() {
    renderHero();
    renderAbout();
    renderSkills();
    renderProjects();
    renderExperience();
    renderCerts();
    renderContact();
    setupReveal();
    setupActiveNav();
  }

  setupCursor();
  setupNav();
  setupHud();

  fetch("data.json")
    .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then((data) => {
      DATA = data;
      runBoot(renderAll);
    })
    .catch((err) => {
      $("boot")?.classList.add("done");
      document.body.classList.remove("booting");
      document.documentElement.classList.add("reveal-fallback");
      $("hero-tagline").innerHTML =
        `<span style="color:#ff003c">FATAL: could not load data.json (${esc(err.message)}).</span><br/>
         Serve over http:// — e.g. <code>python3 -m http.server</code> — not file://`;
    });
})();
