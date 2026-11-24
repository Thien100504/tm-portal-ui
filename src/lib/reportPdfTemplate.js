/**
 * reportPdfTemplate.js
 * Strategy:
 *  1. Build a complete, self-contained HTML string with hex colors (no oklch).
 *  2. Render that HTML in an off-screen iframe so the browser handles fonts & Vietnamese text.
 *  3. Capture the iframe with html2canvas (browser-native rendering = perfect Unicode support).
 *  4. Slice into A4 pages and add to jsPDF.
 *  5. Save → direct .pdf download. No popups. No print dialogs.
 */

export async function exportReportPDF({ stats, t, lang }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const STATUS_COLORS = {
    todo: '#94a3b8',
    in_progress: '#7c3aed',
    review: '#d97706',
    done: '#16a34a',
  };

  const taskTotal =
    (stats.my_tasks.todo || 0) +
    (stats.my_tasks.in_progress || 0) +
    (stats.my_tasks.review || 0) +
    (stats.my_tasks.done_this_week || 0);

  // ── Helpers ─────────────────────────────────────────────────────
  function pct(done, total) {
    return total ? Math.round((done / total) * 100) : 0;
  }

  function statCard({ iconSvg, iconBg, numberColor, label, value, hint = '' }) {
    return `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 18px 14px;">
        <div style="width:34px;height:34px;background:${iconBg};border-radius:9px;display:flex;align-items:center;justify-content:center;margin-bottom:14px">${iconSvg}</div>
        <p style="font-size:30px;font-weight:700;color:${numberColor};margin:0 0 4px;letter-spacing:-.5px">${value}</p>
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;font-weight:500;margin:0">${label}</p>
        ${hint ? `<p style="font-size:10px;color:#94a3b8;margin:3px 0 0">${hint}</p>` : ''}
      </div>`;
  }

  function progressBar(pctVal, color = '#4f46e5', h = '8px') {
    return `
      <div style="height:${h};border-radius:9999px;background:#e2e8f0;overflow:hidden;margin-top:6px">
        <div style="height:100%;width:${pctVal}%;background:${color};border-radius:9999px;min-width:${pctVal > 0 ? '6px' : '0'}"></div>
      </div>`;
  }

  function sectionTitle(text) {
    return `<p style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;font-weight:600;margin:0 0 16px">${text}</p>`;
  }

  const SVG_CHECK = `<svg width="18" height="18" fill="none" stroke="#16a34a" stroke-width="2" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>`;
  const SVG_CLOCK = `<svg width="18" height="18" fill="none" stroke="#7c3aed" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  const SVG_WARN = `<svg width="18" height="18" fill="none" stroke="#dc2626" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  const SVG_FOLDER = `<svg width="18" height="18" fill="none" stroke="#2563eb" stroke-width="2" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;

  // ── Sections ────────────────────────────────────────────────────
  const statCardsHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
      ${statCard({ iconSvg: SVG_CHECK, iconBg: '#f0fdf4', numberColor: '#16a34a', label: t('reports.done_this_week', { defaultValue: 'Done This Week' }), value: stats.my_tasks.done_this_week, hint: 'completed tasks' })}
      ${statCard({ iconSvg: SVG_CLOCK, iconBg: '#f5f3ff', numberColor: '#7c3aed', label: t('reports.in_progress', { defaultValue: 'In Progress' }), value: stats.my_tasks.in_progress, hint: 'active tasks' })}
      ${statCard({ iconSvg: SVG_WARN, iconBg: '#fef2f2', numberColor: '#dc2626', label: t('reports.overdue', { defaultValue: 'Overdue' }), value: stats.overdue_count, hint: stats.overdue_count > 0 ? 'needs attention' : 'all on track' })}
      ${statCard({ iconSvg: SVG_FOLDER, iconBg: '#eff6ff', numberColor: '#2563eb', label: t('reports.my_projects', { defaultValue: 'My Projects' }), value: stats.my_projects_count ?? stats.my_projects?.length ?? 0, hint: 'total projects' })}
    </div>`;

  const donutItems = [
    {
      label: t('dashboard.status.todo', { defaultValue: 'To Do' }),
      value: stats.my_tasks.todo,
      color: STATUS_COLORS.todo,
    },
    {
      label: t('dashboard.status.in_progress', { defaultValue: 'In Progress' }),
      value: stats.my_tasks.in_progress,
      color: STATUS_COLORS.in_progress,
    },
    {
      label: t('dashboard.status.review', { defaultValue: 'In Review' }),
      value: stats.my_tasks.review,
      color: STATUS_COLORS.review,
    },
    {
      label: t('reports.done_this_week', { defaultValue: 'Done' }),
      value: stats.my_tasks.done_this_week,
      color: STATUS_COLORS.done,
    },
  ];

  const taskBreakdownHTML = `
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:20px 20px 16px;background:#fff">
      ${sectionTitle(t('reports.task_breakdown', { defaultValue: 'Task Breakdown' }))}
      ${donutItems
        .map(
          (d) => `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
          <span style="width:8px;height:8px;border-radius:50%;background:${d.color};flex-shrink:0"></span>
          <span style="font-size:12px;color:#64748b;flex:1">${d.label}</span>
          <span style="font-size:13px;font-weight:600;color:#1e293b;min-width:24px;text-align:right">${d.value}</span>
          <div style="width:76px;flex-shrink:0">
            ${progressBar(taskTotal ? pct(d.value, taskTotal) : 0, d.color, '6px')}
          </div>
        </div>`
        )
        .join('')}
      <div style="border-top:1px solid #e2e8f0;margin-top:12px;padding-top:12px;display:flex;justify-content:space-between;align-items:baseline">
        <span style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;font-weight:600">Total</span>
        <span style="font-size:16px;font-weight:700;color:#1e293b">${taskTotal}</span>
      </div>
    </div>`;

  const sortedProjects = [...(stats.my_projects || [])].sort(
    (a, b) => pct(b.my_tasks_done, b.my_tasks_total) - pct(a.my_tasks_done, a.my_tasks_total)
  );
  const projectProgressHTML = `
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:20px 20px 16px;background:#fff">
      ${sectionTitle(t('reports.project_progress', { defaultValue: 'Project Progress' }))}
      ${
        sortedProjects.length === 0
          ? `<div style="height:80px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px">${t('reports.no_projects', { defaultValue: 'No projects yet' })}</div>`
          : sortedProjects
              .slice(0, 5)
              .map((proj) => {
                const p = pct(proj.my_tasks_done, proj.my_tasks_total);
                return `
              <div style="margin-bottom:16px">
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px">
                  <span style="font-size:12px;font-weight:500;color:#1e293b;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${proj.name}</span>
                  <span style="font-size:11px;color:#94a3b8;flex-shrink:0;margin-left:8px">${proj.my_tasks_done}/${proj.my_tasks_total} · ${p}%</span>
                </div>
                ${progressBar(p, '#4f46e5')}
              </div>`;
              })
              .join('')
      }
    </div>`;

  const upcomingHTML =
    stats.upcoming_tasks?.length > 0
      ? `
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:20px 20px 12px;background:#fff;margin-bottom:20px">
      ${sectionTitle(t('reports.upcoming_deadlines', { defaultValue: 'Upcoming Deadlines' }))}
      ${stats.upcoming_tasks
        .slice(0, 8)
        .map((task, i, arr) => {
          const isOverdue = new Date(task.deadline) < new Date();
          const isSoon = !isOverdue && new Date(task.deadline) - new Date() < 3 * 86400000;
          const dueDate = new Date(task.deadline).toLocaleDateString(
            lang === 'vi' ? 'vi-VN' : 'en-US',
            { month: 'short', day: 'numeric' }
          );
          const badgeColor = isOverdue ? '#dc2626' : isSoon ? '#d97706' : '#64748b';
          const badgeBg = isOverdue ? '#fee2e2' : isSoon ? '#fef9c3' : '#f1f5f9';
          const isLast = i === arr.slice(0, 8).length - 1;
          return `
          <div style="display:flex;align-items:flex-start;gap:12px;padding:9px 0;${isLast ? '' : 'border-bottom:1px solid #e2e8f0;'}">
            <div style="flex:1;min-width:0">
              <p style="font-size:12px;font-weight:500;color:#1e293b;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${task.title}</p>
              <p style="font-size:10px;color:#94a3b8;margin:2px 0 0">${task.project_name}</p>
            </div>
            <span style="font-size:11px;font-weight:600;color:${badgeColor};background:${badgeBg};border-radius:9999px;padding:2px 9px;flex-shrink:0">${dueDate}</span>
          </div>`;
        })
        .join('')}
    </div>`
      : '';

  const teamHTML =
    stats.is_pm && stats.team_workload?.length > 0
      ? `
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:20px 20px 12px;background:#fff;margin-bottom:20px">
      ${sectionTitle(t('reports.team_workload', { defaultValue: 'Team Workload' }))}
      ${stats.team_workload
        .map((m) => {
          const total = (m.todo_count || 0) + (m.in_progress_count || 0) + (m.overdue_count || 0);
          const todoPct = total ? pct(m.todo_count, total) : 0;
          const inPct = total ? pct(m.in_progress_count, total) : 0;
          const ovPct = total ? pct(m.overdue_count, total) : 0;
          return `
          <div style="margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
              <span style="font-size:12px;font-weight:500;color:#1e293b">${m.full_name}</span>
              <span style="font-size:11px;color:#94a3b8">${total} tasks${m.overdue_count > 0 ? ` &middot; <span style="color:#dc2626">${m.overdue_count} overdue</span>` : ''}</span>
            </div>
            <div style="display:flex;height:8px;border-radius:9999px;overflow:hidden;background:#e2e8f0">
              ${todoPct > 0 ? `<div style="width:${todoPct}%;background:#94a3b8"></div>` : ''}
              ${inPct > 0 ? `<div style="width:${inPct}%;background:#7c3aed"></div>` : ''}
              ${ovPct > 0 ? `<div style="width:${ovPct}%;background:#dc2626"></div>` : ''}
            </div>
          </div>`;
        })
        .join('')}
    </div>`
      : '';

  const blockedHTML =
    stats.is_pm && stats.blocked_tasks?.length > 0
      ? `
    <div style="border:1px solid #fecaca;border-radius:12px;padding:20px 20px 12px;background:#fef2f2;margin-bottom:20px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
        <p style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;font-weight:600;margin:0">${t('reports.blocked_tasks', { defaultValue: 'Blocked Tasks' })}</p>
        <span style="font-size:10px;font-weight:700;color:#dc2626;background:#fee2e2;border-radius:9999px;padding:2px 8px">${stats.blocked_tasks.length}</span>
      </div>
      ${stats.blocked_tasks
        .map((task, i, arr) => {
          const isLast = i === arr.length - 1;
          return `
          <div style="display:flex;align-items:flex-start;gap:12px;padding:9px 0;${isLast ? '' : 'border-bottom:1px solid #fecaca;'}">
            <div style="flex:1;min-width:0">
              <p style="font-size:12px;font-weight:500;color:#1e293b;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${task.title}</p>
              <p style="font-size:10px;color:#94a3b8;margin:2px 0 0">${task.project_name}</p>
            </div>
            <span style="font-size:11px;font-weight:600;color:#dc2626;flex-shrink:0">${task.blocked_by_count} ${t('reports.blocking_deps', { defaultValue: 'blocking' })}</span>
          </div>`;
        })
        .join('')}
    </div>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Arial, sans-serif;
    background: #fff; color: #1e293b; width: 794px;
    font-variant-numeric: tabular-nums;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
</style>
</head>
<body>
<div style="padding:32px 36px 44px">

  <!-- Header -->
  <div style="background:#0f172a;border-radius:14px;padding:26px 28px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:center;gap:16px">
    <div style="display:flex;align-items:center;gap:16px">
      <div style="width:44px;height:44px;background:#4f46e5;border-radius:12px;flex-shrink:0;display:flex;align-items:center;justify-content:center">
        <svg width="22" height="22" fill="none" stroke="white" stroke-width="1.75" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
      </div>
      <div>
        <h1 style="font-size:21px;font-weight:700;color:#fff;letter-spacing:-.3px">${t('reports.title', { defaultValue: 'Productivity Report' })}</h1>
        <p style="font-size:12px;color:#94a3b8;margin-top:3px">${t('reports.subtitle', { defaultValue: 'Personal productivity & project health' })}</p>
      </div>
    </div>
    <div style="text-align:right;flex-shrink:0">
      <p style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:5px">${t('reports.generated', { defaultValue: 'Generated' })}</p>
      <p style="font-size:14px;font-weight:600;color:#e2e8f0">${dateStr}</p>
    </div>
  </div>

  ${statCardsHTML}

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
    ${taskBreakdownHTML}
    ${projectProgressHTML}
  </div>

  ${upcomingHTML}
  ${teamHTML}
  ${blockedHTML}

  <!-- Footer -->
  <div style="border-top:1px solid #e2e8f0;padding-top:16px;display:flex;justify-content:space-between;align-items:center">
    <div style="display:flex;align-items:center;gap:6px">
      <div style="width:8px;height:8px;background:#4f46e5;border-radius:50%"></div>
      <span style="font-size:10px;color:#94a3b8;letter-spacing:.04em">TaskFlow · AI-Powered Project Management</span>
    </div>
    <span style="font-size:10px;color:#94a3b8">${dateStr}</span>
  </div>

</div>
</body>
</html>`;

  // ── Render in offscreen iframe → html2canvas → jsPDF ──────────────
  const iframe = document.createElement('iframe');
  iframe.style.cssText =
    'position:fixed;top:-9999px;left:-9999px;width:794px;height:1px;border:none;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);

  await new Promise((resolve) => {
    iframe.onload = resolve;
    iframe.srcdoc = html;
  });

  // Wait for fonts and layout
  await new Promise((r) => setTimeout(r, 400));

  const iframeDoc = iframe.contentDocument;
  const contentEl = iframeDoc.body;
  const totalHeight = contentEl.scrollHeight;

  // Set iframe to full height so html2canvas captures everything
  iframe.style.height = totalHeight + 'px';
  await new Promise((r) => setTimeout(r, 100));

  const { default: html2canvas } = await import('html2canvas');

  // ── Patch getComputedStyle to suppress oklch colors that html2canvas can't parse ──
  // html2canvas clones our iframe elements into the parent document, where
  // Tailwind CSS v4's oklch variables get applied. We intercept and neutralise them.
  const origGCS = window.getComputedStyle;
  window.getComputedStyle = function (el, pseudo) {
    const styles = origGCS.call(this, el, pseudo);
    return new Proxy(styles, {
      get(target, prop) {
        const val = Reflect.get(target, prop);
        if (typeof val === 'string' && val.includes('oklch')) {
          // Return a safe fallback: transparent for backgrounds, black for text
          if (
            typeof prop === 'string' &&
            (prop.includes('background') || prop.includes('Background'))
          ) {
            return 'rgba(0,0,0,0)';
          }
          return '#000000';
        }
        return val;
      },
    });
  };

  let canvas;
  try {
    canvas = await html2canvas(contentEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: 794,
      height: totalHeight,
      scrollX: 0,
      scrollY: 0,
      windowWidth: 794,
      windowHeight: totalHeight,
    });
  } finally {
    // Always restore the original getComputedStyle
    window.getComputedStyle = origGCS;
  }

  document.body.removeChild(iframe);

  // ── Slice canvas into A4 pages ──────────────────────────────────
  const { jsPDF } = await import('jspdf');
  const A4_W_PX = 794 * 2; // @scale 2
  const A4_H_PX = Math.round((794 * 2 * 297) / 210); // A4 aspect ratio in px @scale 2

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  let yOffset = 0;
  let firstPage = true;

  while (yOffset < canvas.height) {
    if (!firstPage) doc.addPage();
    firstPage = false;

    const sliceH = Math.min(A4_H_PX, canvas.height - yOffset);

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = A4_W_PX;
    sliceCanvas.height = sliceH;
    const ctx = sliceCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    ctx.drawImage(canvas, 0, yOffset, A4_W_PX, sliceH, 0, 0, A4_W_PX, sliceH);

    const imgData = sliceCanvas.toDataURL('image/jpeg', 0.95);
    const imgH = (sliceH / A4_W_PX) * pageW;
    doc.addImage(imgData, 'JPEG', 0, 0, pageW, imgH);

    yOffset += A4_H_PX;
  }

  doc.save(`productivity_report_${now.toISOString().split('T')[0]}.pdf`);
}
