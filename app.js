/* ==========================================================================
   SMR TECHNOLOGY REVIEW DASHBOARD - APPLICATION CONTROLLER
   ========================================================================== */

const STORAGE_KEY = "smr_dashboard_initiatives";
const DATA_JSON_PATH = "./data.json";

// Define state colors for visual mapping
const STATE_THEMES = {
    "Prioritize": { bg: "rgba(245, 158, 11, 0.1)", border: "rgba(245, 158, 11, 0.25)", color: "#f59e0b", bar: "#f59e0b" },
    "Investigate": { bg: "rgba(129, 140, 248, 0.1)", border: "rgba(129, 140, 248, 0.25)", color: "#818cf8", bar: "#818cf8" },
    "Design": { bg: "rgba(192, 132, 252, 0.1)", border: "rgba(192, 132, 252, 0.25)", color: "#c084fc", bar: "#c084fc" },
    "Build": { bg: "rgba(56, 189, 248, 0.1)", border: "rgba(56, 189, 248, 0.25)", color: "#38bdf8", bar: "#38bdf8" },
    "Test": { bg: "rgba(6, 182, 212, 0.1)", border: "rgba(6, 182, 212, 0.25)", color: "#06b6d4", bar: "#06b6d4" },
    "Launch": { bg: "rgba(236, 72, 153, 0.1)", border: "rgba(236, 72, 153, 0.25)", color: "#ec4899", bar: "#ec4899" },
    "Complete": { bg: "rgba(16, 185, 129, 0.1)", border: "rgba(16, 185, 129, 0.25)", color: "#10b981", bar: "#10b981" },
    "Deferred": { bg: "rgba(148, 163, 184, 0.1)", border: "rgba(148, 163, 184, 0.25)", color: "#94a3b8", bar: "#94a3b8" }
};

// Owner avatar backgrounds for Seattle SAR members
const OWNER_AVATARS = {
    "Nick": "#ef4444",    // Red
    "Wes": "#10b981",     // Emerald
    "Raquel": "#f59e0b",  // Amber
    "Barton": "#818cf8",  // Blue/Indigo
    "Garth": "#ec4899",   // Pink
    "David": "#06b6d4",   // Cyan
    "Linda": "#a855f7",   // Purple
    "Nasa": "#14b8a6"     // Teal
};

// Define Tech Area category styling colors
const TECH_THEMES = {
    "Membership & Base Operations Management": {
        bg: "rgba(99, 102, 241, 0.12)",
        color: "#c7d2fe",
        border: "rgba(99, 102, 241, 0.3)"
    },
    "Training & Operations Support": {
        bg: "rgba(20, 184, 166, 0.12)",
        color: "#99f6e4",
        border: "rgba(20, 184, 166, 0.3)"
    },
    "Organization Support": {
        bg: "rgba(236, 72, 153, 0.12)",
        color: "#fbcfe8",
        border: "rgba(236, 72, 153, 0.3)"
    }
};

// 2. Global State Storage Manager
class DashboardState {
    constructor() {
        this.initiatives = [];
        this.currentView = "table";
        this.searchQuery = "";
        
        // Custom multi-select filter sets initialized with all options checked
        this.selectedTechAreas = [
            "Membership & Base Operations Management",
            "Training & Operations Support",
            "Organization Support"
        ];
        this.selectedStates = [
            "Prioritize",
            "Investigate",
            "Design",
            "Build",
            "Test",
            "Launch",
            "Complete",
            "Deferred"
        ];

        // Table sorting parameters
        this.sortBy = "techArea";
        this.sortDirection = "asc";

        // KPI quick-filter: null | 'active' | 'blocked'
        this.kpiFilter = null;
        this.tableResizersInitialized = false;
    }

    loadFromStorage() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            return null;
        }

        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error("Error reading dashboard data from local storage", e);
            return null;
        }
    }

    async initialize() {
        const stored = this.loadFromStorage();
        if (stored) {
            this.initiatives = stored;
            return;
        }

        try {
            const response = await fetch(DATA_JSON_PATH, { cache: "no-store" });
            if (!response.ok) {
                throw new Error(`Failed to load ${DATA_JSON_PATH} (${response.status})`);
            }

            const json = await response.json();
            if (!Array.isArray(json)) {
                throw new Error("Loaded data.json is not an array");
            }

            this.initiatives = json;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(json));
        } catch (error) {
            console.error("Unable to initialize dashboard data from data.json", error);
            this.initiatives = [];
        }
    }

    save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.initiatives));
        this.updateKPIs();
        this.render();
    }

    exportToJsonFile(filename = "data.json") {
        const jsonString = JSON.stringify(this.initiatives, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    importFromJson(data) {
        if (!Array.isArray(data)) {
            throw new Error("Imported JSON must be an array of initiatives.");
        }

        this.initiatives = data;
        this.save();
    }

    // Mutators
    addInitiative(item) {
        this.initiatives.push(item);
        this.save();
    }

    updateInitiative(id, updatedItem) {
        const index = this.initiatives.findIndex(x => x.id === id);
        if (index !== -1) {
            this.initiatives[index] = { ...this.initiatives[index], ...updatedItem };
            this.save();
        }
    }

    deleteInitiative(id) {
        this.initiatives = this.initiatives.filter(x => x.id !== id);
        this.save();
    }

    toggleNextStep(initiativeId, stepIndex) {
        const initiative = this.initiatives.find(x => x.id === initiativeId);
        if (initiative && initiative.nextSteps && initiative.nextSteps[stepIndex]) {
            initiative.nextSteps[stepIndex].completed = !initiative.nextSteps[stepIndex].completed;
            this.save();
        }
    }

    // Filter implementation
    getFilteredInitiatives() {
        const filtered = this.initiatives.filter(item => {
            // Text Search filter (Fuzzy matches titles, descriptions, owners, status notes, blockers)
            const query = this.searchQuery.toLowerCase().trim();
            const textMatches = !query || 
                item.initiative.toLowerCase().includes(query) ||
                (item.description && item.description.toLowerCase().includes(query)) ||
                item.owners.some(owner => owner.toLowerCase().includes(query)) ||
                item.dependencies.some(dep => dep.toLowerCase().includes(query)) ||
                (item.blockers && item.blockers.toLowerCase().includes(query)) ||
                item.status.some(stat => stat.toLowerCase().includes(query));

            // Custom multi-select filters
            const techMatches = this.selectedTechAreas.includes(item.techArea);
            const stateMatches = this.selectedStates.includes(item.state);

            // KPI quick-filter (active states / has blockers)
            const activeStates = ["Prioritize", "Investigate", "Design", "Build", "Test", "Launch"];
            const kpiMatches = !this.kpiFilter ||
                (this.kpiFilter === 'active' && activeStates.includes(item.state)) ||
                (this.kpiFilter === 'blocked' && item.blockers &&
                    item.blockers.toLowerCase() !== 'none' &&
                    item.blockers.toLowerCase() !== 'n/a' &&
                    item.blockers.trim() !== '');

            return textMatches && techMatches && stateMatches && kpiMatches;
        });

        // Apply column sorting (A-Z and Z-A)
        return filtered.sort((a, b) => {
            let valA, valB;
            
            if (this.sortBy === "initiative") {
                valA = a.initiative.toLowerCase();
                valB = b.initiative.toLowerCase();
            } else if (this.sortBy === "techArea") {
                valA = a.techArea.toLowerCase();
                valB = b.techArea.toLowerCase();
            } else if (this.sortBy === "state") {
                valA = a.state.toLowerCase();
                valB = b.state.toLowerCase();
            } else if (this.sortBy === "cost") {
                const getNumericCost = (str) => {
                    if (!str || str.toLowerCase() === "tbd") return 9999999; // Treat TBD as high cost to group at end
                    const num = parseInt(str.replace(/[$,]/g, ""));
                    return isNaN(num) ? 0 : num;
                };
                valA = getNumericCost(a.cost);
                valB = getNumericCost(b.cost);
            } else if (this.sortBy === "progress") {
                const getProgressPercent = (x) => {
                    const total = x.nextSteps ? x.nextSteps.length : 0;
                    if (total === 0) return 0;
                    const completed = x.nextSteps.filter(ns => ns.completed).length;
                    return completed / total;
                };
                valA = getProgressPercent(a);
                valB = getProgressPercent(b);
            } else {
                return 0;
            }

            if (valA < valB) return this.sortDirection === "asc" ? -1 : 1;
            if (valA > valB) return this.sortDirection === "asc" ? 1 : -1;
            return 0;
        });
    }

    // KPI calculation
    updateKPIs() {
        const activeStates = ["Prioritize", "Investigate", "Design", "Build", "Test", "Launch"];
        
        let activeCount = 0;
        let blockedCount = 0;
        let totalCostVal = 0;

        this.initiatives.forEach(item => {
            // Active count
            if (activeStates.includes(item.state)) {
                activeCount++;
            }
            // Blocked state detection
            const hasBlockers = item.blockers && 
                                item.blockers.toLowerCase() !== "none" && 
                                item.blockers.toLowerCase() !== "n/a" &&
                                item.blockers.trim() !== "";
            if (hasBlockers) {
                blockedCount++;
            }
            // Cost accumulation
            if (item.cost && item.cost.startsWith("$")) {
                const numeric = parseInt(item.cost.replace(/[$,]/g, ""));
                if (!isNaN(numeric)) {
                    totalCostVal += numeric;
                }
            }
        });

        // Hydrate DOM elements
        document.querySelector("#kpi-total .kpi-value").textContent = this.initiatives.length;
        document.querySelector("#kpi-active .kpi-value").textContent = activeCount;
        document.querySelector("#kpi-blocked .kpi-value").textContent = blockedCount;
        document.querySelector("#kpi-cost .kpi-value").textContent = "$" + totalCostVal.toLocaleString();
        
        // Dynamic Warning indicator additions
        const blockedCard = document.getElementById("kpi-blocked");
        if (blockedCount > 0) {
            blockedCard.classList.add("needs-action");
        } else {
            blockedCard.classList.remove("needs-action");
        }
    }

    // Render Hub
    render() {
        const filtered = this.getFilteredInitiatives();
        
        // Toggle the empty panel display
        const noResults = document.getElementById("no-results");
        if (filtered.length === 0) {
            noResults.style.display = "flex";
            document.getElementById("view-grid").style.display = "none";
            document.getElementById("view-board").style.display = "none";
            document.getElementById("view-table").style.display = "none";
            return;
        } else {
            noResults.style.display = "none";
        }

        // Keep the view buttons in sync with the current view state
        document.querySelectorAll(".view-btn").forEach(btn => {
            btn.classList.toggle("active", btn.getAttribute("data-view") === this.currentView);
        });

        // Branch by active view mode
        if (this.currentView === "grid") {
            document.getElementById("view-grid").style.display = "block";
            document.getElementById("view-board").style.display = "none";
            document.getElementById("view-table").style.display = "none";
            this.renderGrid(filtered);
        } else if (this.currentView === "board") {
            document.getElementById("view-grid").style.display = "none";
            document.getElementById("view-board").style.display = "block";
            document.getElementById("view-table").style.display = "none";
            this.renderBoard(filtered);
        } else if (this.currentView === "table") {
            document.getElementById("view-grid").style.display = "none";
            document.getElementById("view-board").style.display = "none";
            document.getElementById("view-table").style.display = "block";
            this.renderTable(filtered);
        }
    }

    /* 2a. GRID VIEW RENDER ENGINE */
    renderGrid(items) {
        const container = document.getElementById("view-grid");
        container.innerHTML = ""; // reset

        // Group items by Tech Area
        const groups = {};
        items.forEach(item => {
            if (!groups[item.techArea]) {
                groups[item.techArea] = [];
            }
            groups[item.techArea].push(item);
        });

        // Print each tech group category
        for (const [techArea, list] of Object.entries(groups)) {
            const section = document.createElement("section");
            section.className = "tech-area-section";

            section.innerHTML = `
                <div class="tech-area-header">
                    <h2>${techArea}</h2>
                    <span class="tech-area-badge">${list.length} ${list.length === 1 ? 'Project' : 'Projects'}</span>
                </div>
                <div class="initiatives-grid" id="grid-group-${techArea.replace(/\s+/g, '-')}"></div>
            `;
            container.appendChild(section);

            const grid = section.querySelector(".initiatives-grid");
            list.forEach(item => {
                grid.appendChild(this.createCardDOM(item));
            });
        }
    }

    /* 2b. KANBAN BOARD VIEW RENDER ENGINE */
    renderBoard(items) {
        const columns = document.querySelectorAll(".kanban-column-cards");
        columns.forEach(col => col.innerHTML = ""); // reset all

        // Sort items into columns
        const columnsCount = { "Prioritize": 0, "Investigate": 0, "Design": 0, "Build": 0, "Test": 0, "Launch": 0, "Complete": 0, "Deferred": 0 };

        items.forEach(item => {
            const columnContainer = document.querySelector(`.kanban-column[data-state="${item.state}"] .kanban-column-cards`);
            if (columnContainer) {
                columnContainer.appendChild(this.createCardDOM(item, true));
                columnsCount[item.state]++;
            }
        });

        // Set counts in swimlane headers
        for (const [state, count] of Object.entries(columnsCount)) {
            document.querySelector(`.kanban-column[data-state="${state}"] .count`).textContent = count;
        }
    }

    /* Helper: Update Table Header Sort Indicators */
    updateSortIcons() {
        const columns = ["techArea", "initiative", "state", "cost", "progress"];
        columns.forEach(col => {
            const icon = document.getElementById(`sort-icon-${col}`);
            if (icon) {
                if (this.sortBy === col) {
                    icon.textContent = this.sortDirection === "asc" ? "↑" : "↓";
                    icon.className = `sort-icon ${this.sortDirection}`;
                } else {
                    icon.textContent = "↕";
                    icon.className = "sort-icon";
                }
            }
        });
    }

    /* 2c. SPREADSHEET TABLE VIEW RENDER ENGINE */
    renderTable(items) {
        // Refresh sort icons visually
        this.updateSortIcons();

        const tbody = document.getElementById("table-body");
        tbody.innerHTML = ""; // reset

        items.forEach(item => {
            const tr = document.createElement("tr");
            
            const nextStepsCount = item.nextSteps ? item.nextSteps.length : 0;
            const completedCount = item.nextSteps ? item.nextSteps.filter(x => x.completed).length : 0;
            const percentage = nextStepsCount > 0 ? Math.round((completedCount / nextStepsCount) * 100) : 0;

            const stateTheme = STATE_THEMES[item.state] || { color: "#ffffff", bg: "rgba(255,255,255,0.1)", border: "rgba(255,255,255,0.2)" };

            // 1. Render Dependencies list
            const depsHtml = item.dependencies.map(dep => dep !== "N/A" ? `<span class="dep-tag" style="margin: 0.15rem; display: inline-block;">${dep}</span>` : "").join("");
            const depsDisplay = depsHtml.trim() !== "" ? `<div class="card-dependencies">${depsHtml}</div>` : `<span class="text-muted">—</span>`;

            // 2. Render Status list
            const statusTooltip = item.status.length > 0 ? item.status.join(" \n") : "Click to add status notes";
            const statusLabel = item.status.length > 0 ? `${item.status.length} note${item.status.length === 1 ? "" : "s"}` : "Add status";
            const statusDisplay = `
                <a href="#" class="status-note-link" data-id="${item.id}" title="${statusTooltip}">
                    <span class="status-note-icon">📝</span>
                    <span>${statusLabel}</span>
                </a>
            `;

            // 3. Render Needs/Blockers alert (multi-line supported)
            const hasBlockers = item.blockers && 
                                item.blockers.toLowerCase() !== "none" && 
                                item.blockers.toLowerCase() !== "n/a" &&
                                item.blockers.trim() !== "";
            let blockerDisplay;
            if (hasBlockers) {
                const blockerLines = item.blockers.split("\n").map(l => l.trim()).filter(l => l !== "");
                blockerDisplay = `
                    <div class="table-blockers-container" style="display: flex; flex-direction: column; gap: 0.35rem; min-width: 160px;">
                        ${blockerLines.map(line => `
                            <div class="card-blocker-alert" style="font-size: 0.75rem; padding: 0.4rem 0.6rem; margin: 0; display: flex; align-items: flex-start; gap: 0.35rem;">
                                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink: 0; margin-top: 1px;">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                    <line x1="12" y1="9" x2="12" y2="13"/>
                                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                                </svg>
                                <span style="text-align: left; line-height: 1.3;">${line}</span>
                            </div>
                        `).join("")}
                    </div>
                `;
            } else {
                blockerDisplay = `
                    <span class="text-success" style="font-weight: 600; display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.8125rem;">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-teal);"><polyline points="20 6 9 17 4 12"/></svg>
                        None
                    </span>
                `;
            }

            // 4. Render Actions next-steps checklist
            const actionsHtml = item.nextSteps ? item.nextSteps.map((step, idx) => `
                <div class="checklist-item ${step.completed ? 'checked' : ''}" data-step="${idx}" style="padding: 0.15rem 0.3rem;">
                    <div class="custom-checkbox" style="width: 14px; height: 14px;">
                        <svg viewBox="0 0 24 24" width="8" height="8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                    <span class="checklist-item-text" style="font-size: 0.75rem;">${step.text}</span>
                </div>
            `).join("") : `<span class="text-muted">—</span>`;
            
            const actionsDisplay = item.nextSteps && item.nextSteps.length > 0 ? `
                <div class="card-next-steps" style="gap: 0.25rem; min-width: 170px;">
                    <div class="next-steps-header" style="margin-bottom: 0.15rem;">
                        <span class="next-steps-progress" style="font-size: 0.7rem; color: var(--color-accent); font-weight: 600;">${completedCount}/${nextStepsCount} Done</span>
                    </div>
                    <div class="progress-bar-bg" style="height: 3px; margin-bottom: 0.3rem;">
                        <div class="progress-bar-fill" style="width: ${percentage}%"></div>
                    </div>
                    <div class="checklist-container" style="display: flex; flex-direction: column; gap: 0.2rem;">
                        ${actionsHtml}
                    </div>
                </div>
            ` : `<span class="text-muted">—</span>`;

            const techTheme = TECH_THEMES[item.techArea] || { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)", color: "#ffffff" };

            tr.innerHTML = `
                <td>
                    <span class="tech-badge" style="--tech-bg: ${techTheme.bg}; --tech-color: ${techTheme.color}; --tech-border: ${techTheme.border}">
                        ${item.techArea}
                    </span>
                </td>
                <td>
                    <a class="table-title" href="#" data-id="${item.id}">${item.initiative}</a>
                </td>
                <td>
                    <span class="card-state-badge" style="--badge-bg: ${stateTheme.bg}; --badge-color: ${stateTheme.color}; --badge-border: ${stateTheme.border}">
                        ${item.state}
                    </span>
                </td>
                <td>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.25rem;">
                        ${item.owners.map(o => `
                            <span class="owner-avatar" style="--avatar-bg: ${OWNER_AVATARS[o] || '#475569'}" title="${o}">
                                ${o.charAt(0)}
                            </span>
                        `).join("")}
                    </div>
                </td>
                <td>
                    ${depsDisplay}
                </td>
                <td class="table-cost">${item.cost}</td>
                <td>
                    ${statusDisplay}
                </td>
                <td>
                    ${blockerDisplay}
                </td>
                <td>
                    ${actionsDisplay}
                </td>
            `;

            // Hyperlinked title opens edit drawer
            tr.querySelector(".table-title").addEventListener("click", (e) => {
                e.preventDefault();
                openDrawer(item.id);
            });

            // Status note icon opens the status modal
            const statusLink = tr.querySelector(".status-note-link");
            if (statusLink) {
                statusLink.addEventListener("click", (e) => {
                    e.preventDefault();
                    openStatusNoteModal(item.id);
                });
            }

            // Hook interactive checklist click events in table
            if (nextStepsCount > 0) {
                tr.querySelectorAll(".checklist-item").forEach(checkNode => {
                    checkNode.addEventListener("click", (e) => {
                        e.stopPropagation();
                        const stepIdx = parseInt(checkNode.getAttribute("data-step"));
                        this.toggleNextStep(item.id, stepIdx);
                    });
                });
            }

            tbody.appendChild(tr);
        });

        // Initialize drag resize grab handles once table is drawn and visible in the DOM
        if (!this.tableResizersInitialized) {
            this.initTableResizable();
            this.tableResizersInitialized = true;
        }
    }

    /* Resizable Column Grab Handles Implementation */
    initTableResizable() {
        const table = document.querySelector(".table-dense");
        if (!table) return;

        const cols = table.querySelectorAll("thead th");
        if (cols.length === 0) return;

        // Capture actual initial sizes from live DOM elements to start
        const widths = Array.from(cols).map(col => col.getBoundingClientRect().width);

        // Turn table-layout fixed so cell sizes adhere strictly to style.width changes
        table.style.tableLayout = "fixed";

        cols.forEach((col, index) => {
            col.style.width = widths[index] + "px";

            // Inject the resizer drag handle
            const resizer = document.createElement("div");
            resizer.className = "col-resizer";
            col.appendChild(resizer);

            let startX = 0;
            let startWidth = 0;

            const onMouseDown = (e) => {
                startX = e.pageX;
                startWidth = col.getBoundingClientRect().width;

                resizer.classList.add("resizing");
                document.body.style.cursor = "col-resize";
                document.body.style.userSelect = "none";

                const onMouseMove = (moveEvt) => {
                    const width = startWidth + (moveEvt.pageX - startX);
                    if (width > 60) {
                        col.style.width = width + "px";
                    }
                };

                const onMouseUp = () => {
                    resizer.classList.remove("resizing");
                    document.body.style.cursor = "";
                    document.body.style.userSelect = "";
                    document.removeEventListener("mousemove", onMouseMove);
                    document.removeEventListener("mouseup", onMouseUp);
                };

                document.addEventListener("mousemove", onMouseMove);
                document.addEventListener("mouseup", onMouseUp);
            };

            // Stop click events on resize handle from triggering sorting
            resizer.addEventListener("mousedown", (e) => {
                e.stopPropagation();
                onMouseDown(e);
            });

            resizer.addEventListener("click", (e) => {
                e.stopPropagation();
            });
        });
    }

    /* Helper: Generate Card DOM representation */
    createCardDOM(item, isCompact = false) {
        const card = document.createElement("div");
        card.className = "card";
        
        const stateTheme = STATE_THEMES[item.state] || { color: "#ffffff", bg: "rgba(255,255,255,0.1)", border: "rgba(255,255,255,0.2)" };
        card.style.setProperty("--card-border-color", stateTheme.color);

        // Blocker logic
        const hasBlockers = item.blockers && 
                            item.blockers.toLowerCase() !== "none" && 
                            item.blockers.toLowerCase() !== "n/a" &&
                            item.blockers.trim() !== "";

        // Next steps progress calculations
        const totalSteps = item.nextSteps ? item.nextSteps.length : 0;
        const completedSteps = item.nextSteps ? item.nextSteps.filter(x => x.completed).length : 0;
        const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

        card.innerHTML = `
            <div class="card-top">
                <h3 class="card-title">${item.initiative}</h3>
                <span class="card-state-badge" style="--badge-bg: ${stateTheme.bg}; --badge-color: ${stateTheme.color}; --badge-border: ${stateTheme.border}">
                    ${item.state}
                </span>
            </div>
            
            <p class="card-desc">${item.description}</p>
            
            <div class="card-dependencies">
                ${item.dependencies.map(dep => dep !== "N/A" ? `<span class="dep-tag">${dep}</span>` : "").join("")}
            </div>
            
            <div class="card-attributes">
                <div class="owners-list">
                    ${item.owners.map(owner => `
                        <span class="owner-avatar" style="--avatar-bg: ${OWNER_AVATARS[owner] || '#475569'}" title="${owner}">
                            ${owner.charAt(0)}
                        </span>
                    `).join("")}
                </div>
                <div class="cost-label">
                    Cost: <span class="cost-value">${item.cost}</span>
                </div>
            </div>

            <div class="card-status-list">
                ${item.status.map(note => `
                    <div class="status-item">
                        <span class="status-bullet"></span>
                        <span>${note}</span>
                    </div>
                `).join("")}
            </div>

            <!-- Warning block alert if active (multi-line supported) -->
            ${hasBlockers ? `
                <div style="display: flex; flex-direction: column; gap: 0.35rem; width: 100%;">
                    ${item.blockers.split("\n").map(l => l.trim()).filter(l => l !== "").map(line => `
                        <div class="card-blocker-alert" style="margin: 0; display: flex; align-items: flex-start; gap: 0.35rem;">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink: 0; margin-top: 2px;">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                <line x1="12" y1="9" x2="12" y2="13"/>
                                <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                            <span style="text-align: left; line-height: 1.3;">${line}</span>
                        </div>
                    `).join("")}
                </div>
            ` : ""}

            <!-- Next steps checklists (Hidden in compact Kanban columns) -->
            ${(!isCompact && totalSteps > 0) ? `
                <div class="card-next-steps">
                    <div class="next-steps-header">
                        <span class="next-steps-title">Next Steps</span>
                        <span class="next-steps-progress">${completedSteps}/${totalSteps} Done</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${progressPercent}%"></div>
                    </div>
                    
                    <div class="checklist-container">
                        ${item.nextSteps.map((step, idx) => `
                            <div class="checklist-item ${step.completed ? 'checked' : ''}" data-step="${idx}">
                                <div class="custom-checkbox">
                                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </div>
                                <span class="checklist-item-text">${step.text}</span>
                            </div>
                        `).join("")}
                    </div>
                </div>
            ` : ""}

            <div class="card-actions">
                <button class="btn-card-action edit-btn" title="Edit Initiative">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="btn-card-action btn-delete delete-btn" title="Delete Initiative">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        `;

        // Interactive Checklist Event Hook
        if (!isCompact && totalSteps > 0) {
            card.querySelectorAll(".checklist-item").forEach(checkNode => {
                checkNode.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const stepIdx = parseInt(checkNode.getAttribute("data-step"));
                    this.toggleNextStep(item.id, stepIdx);
                });
            });
        }

        // Title click / Card edit overlay trigger
        card.querySelector(".card-title").addEventListener("click", () => openDrawer(item.id));
        card.querySelector(".edit-btn").addEventListener("click", () => openDrawer(item.id));
        card.querySelector(".delete-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete the initiative "${item.initiative}"?`)) {
                this.deleteInitiative(item.id);
            }
        });

        return card;
    }
}

// Instantiate global State controller
const store = new DashboardState();

// 3. UI Drawer Animation & Operations
const overlay = document.getElementById("drawer-overlay");
const panel = document.getElementById("drawer-panel");
const form = document.getElementById("initiative-form");

function openDrawer(initiativeId = null) {
    overlay.classList.add("active");
    panel.classList.add("active");
    document.body.style.overflow = "hidden"; // block background scroll

    const deleteBtn = document.getElementById("btn-delete-initiative");

    if (initiativeId) {
        // Edit Mode loading
        document.getElementById("drawer-title").textContent = "Edit Initiative";
        const item = store.initiatives.find(x => x.id === initiativeId);
        
        if (item) {
            document.getElementById("form-id").value = item.id;
            document.getElementById("form-title").value = item.initiative;
            document.getElementById("form-tech-area").value = item.techArea;
            document.getElementById("form-state").value = item.state;
            document.getElementById("form-owners").value = item.owners.join(", ");
            document.getElementById("form-cost").value = item.cost;
            document.getElementById("form-description").value = item.description;
            document.getElementById("form-dependencies").value = item.dependencies.join(", ");
            document.getElementById("form-status").value = item.status.join("\n");
            document.getElementById("form-blockers").value = item.blockers;
            
            const nextStepsText = item.nextSteps ? item.nextSteps.map(x => x.text).join("\n") : "";
            document.getElementById("form-next-steps").value = nextStepsText;
        }

        // Show Delete button and bind a fresh click handler (clone to remove stale listeners)
        deleteBtn.style.display = "inline-flex";
        const freshDeleteBtn = deleteBtn.cloneNode(true);
        deleteBtn.parentNode.replaceChild(freshDeleteBtn, freshDeleteBtn.cloneNode(true) === freshDeleteBtn ? freshDeleteBtn : deleteBtn);
        const activeBtnRef = document.getElementById("btn-delete-initiative");
        activeBtnRef.style.display = "inline-flex";
        activeBtnRef.onclick = () => {
            if (confirm(`Are you sure you want to delete "${item.initiative}"? This cannot be undone.`)) {
                store.deleteInitiative(initiativeId);
                closeDrawer();
            }
        };
    } else {
        // Add Mode loading — hide Delete button
        deleteBtn.style.display = "none";
        deleteBtn.onclick = null;
        document.getElementById("drawer-title").textContent = "Add Initiative";
        form.reset();
        document.getElementById("form-id").value = "";
    }
}

function closeDrawer() {
    overlay.classList.remove("active");
    panel.classList.remove("active");
    document.body.style.overflow = ""; // restore background scroll
}

let activeStatusNoteInitiativeId = null;
let statusNoteSelectionStart = 0;
let statusNoteSelectionEnd = 0;

function updateStatusNoteSelection() {
    const textarea = document.getElementById("status-note-textarea");
    if (!textarea) return;
    statusNoteSelectionStart = textarea.selectionStart;
    statusNoteSelectionEnd = textarea.selectionEnd;
}

function openStatusNoteModal(initiativeId) {
    const item = store.initiatives.find(x => x.id === initiativeId);
    if (!item) return;

    activeStatusNoteInitiativeId = initiativeId;
    document.getElementById("status-note-initiative-title").textContent = item.initiative;
    document.getElementById("status-note-textarea").value = item.status.join("\n");
    document.getElementById("status-note-overlay").classList.add("active");
    document.getElementById("status-note-modal").classList.add("active");
    document.body.style.overflow = "hidden";
    const textarea = document.getElementById("status-note-textarea");
    textarea.focus();
    textarea.setSelectionRange(0, 0);
    updateStatusNoteSelection();
}

function closeStatusNoteModal() {
    document.getElementById("status-note-overlay").classList.remove("active");
    document.getElementById("status-note-modal").classList.remove("active");
    document.body.style.overflow = "";
    activeStatusNoteInitiativeId = null;
}

function getStatusNoteTextarea() {
    return document.getElementById("status-note-textarea");
}

function wrapStatusSelection(before, after, placeholder) {
    const textarea = getStatusNoteTextarea();
    const value = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || placeholder || "";
    const newValue = value.slice(0, start) + before + selected + after + value.slice(end);
    textarea.value = newValue;
    textarea.focus();
    const cursorPos = start + before.length + selected.length + after.length;
    textarea.setSelectionRange(cursorPos, cursorPos);
}

function applyStatusNoteFormat(type) {
    const textarea = getStatusNoteTextarea();
    if (!textarea) return;

    const currentStart = textarea.selectionStart;
    const currentEnd = textarea.selectionEnd;
    const start = currentStart !== currentEnd ? Math.min(currentStart, currentEnd) : Math.min(statusNoteSelectionStart, statusNoteSelectionEnd);
    const end = currentStart !== currentEnd ? Math.max(currentStart, currentEnd) : Math.max(statusNoteSelectionStart, statusNoteSelectionEnd);
    textarea.focus();
    textarea.setSelectionRange(start, end);

    const value = textarea.value;
    const selected = value.slice(start, end);

    if (type === "bold") {
        wrapStatusSelection("**", "**", "bold text");
        return;
    }
    if (type === "italic") {
        wrapStatusSelection("_", "_", "italic text");
        return;
    }
    if (type === "bullet") {
        const lines = selected ? selected.split("\n") : ["List item"];
        const bulleted = lines.map(line => line.trim() ? `- ${line.trim()}` : "- ").join("\n");
        textarea.value = value.slice(0, start) + bulleted + value.slice(end);
        textarea.focus();
        textarea.setSelectionRange(start, start + bulleted.length);
        return;
    }
    if (type === "number") {
        const lines = selected ? selected.split("\n") : ["List item"];
        const numbered = lines.map((line, index) => `${index + 1}. ${line.trim()}`).join("\n");
        textarea.value = value.slice(0, start) + numbered + value.slice(end);
        textarea.focus();
        textarea.setSelectionRange(start, start + numbered.length);
        return;
    }
    if (type === "link") {
        const url = window.prompt("Enter URL", "https://");
        if (!url) return;
        const linkText = selected || "link text";
        const markdown = `[${linkText}](${url})`;
        textarea.value = value.slice(0, start) + markdown + value.slice(end);
        textarea.focus();
        textarea.setSelectionRange(start + markdown.length, start + markdown.length);
    }
}

// 4. Form Event Listeners & Submission pipeline
form.addEventListener("submit", (e) => {
    e.preventDefault();

    const id = document.getElementById("form-id").value;
    const initiative = document.getElementById("form-title").value.trim();
    const techArea = document.getElementById("form-tech-area").value;
    const state = document.getElementById("form-state").value;
    const cost = document.getElementById("form-cost").value.trim() || "$0";
    const description = document.getElementById("form-description").value.trim();
    const blockers = document.getElementById("form-blockers").value.trim() || "None";
    
    // Parse owners list from string commas
    const owners = document.getElementById("form-owners").value.split(",")
                    .map(x => x.trim())
                    .filter(x => x !== "");
    
    // Parse dependencies list
    const dependenciesRaw = document.getElementById("form-dependencies").value.split(",")
                            .map(x => x.trim())
                            .filter(x => x !== "");
    const dependencies = dependenciesRaw.length > 0 ? dependenciesRaw : ["N/A"];

    // Parse status lines
    const status = document.getElementById("form-status").value.split("\n")
                    .map(x => x.trim())
                    .filter(x => x !== "");

    // Parse next step items
    const rawNextSteps = document.getElementById("form-next-steps").value.split("\n")
                        .map(x => x.trim())
                        .filter(x => x !== "");
    
    let nextSteps = [];
    if (id) {
        // Retain checked state for matching next step descriptions in edit mode
        const existingItem = store.initiatives.find(x => x.id === id);
        const existingSteps = existingItem ? existingItem.nextSteps : [];
        
        nextSteps = rawNextSteps.map(text => {
            const match = existingSteps.find(prev => prev.text === text);
            return { text, completed: match ? match.completed : false };
        });
    } else {
        nextSteps = rawNextSteps.map(text => ({ text, completed: false }));
    }

    const payload = {
        initiative,
        techArea,
        state,
        cost,
        description,
        owners,
        dependencies,
        status,
        blockers,
        nextSteps
    };

    if (id) {
        store.updateInitiative(id, payload);
    } else {
        const newId = "init-" + Date.now();
        store.addInitiative({ id: newId, ...payload });
    }

    closeDrawer();
});

// 5. Interface Control Wire-ups
document.getElementById("btn-add-initiative").addEventListener("click", () => openDrawer());
document.getElementById("btn-close-drawer").addEventListener("click", closeDrawer);
document.getElementById("btn-cancel-drawer").addEventListener("click", closeDrawer);
overlay.addEventListener("click", closeDrawer);

document.getElementById("btn-close-status-note").addEventListener("click", closeStatusNoteModal);
document.getElementById("btn-cancel-status-note").addEventListener("click", closeStatusNoteModal);
document.getElementById("status-note-overlay").addEventListener("click", closeStatusNoteModal);
["btn-format-bold", "btn-format-italic", "btn-format-bullet", "btn-format-number", "btn-format-link"].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
        btn.addEventListener("mousedown", (e) => {
            updateStatusNoteSelection();
            e.preventDefault();
        });
    }
});
const statusNoteTextarea = document.getElementById("status-note-textarea");
if (statusNoteTextarea) {
    ["mouseup", "keyup", "select", "focus"].forEach(evt => {
        statusNoteTextarea.addEventListener(evt, updateStatusNoteSelection);
    });
}

document.addEventListener("selectionchange", () => {
    const textarea = document.getElementById("status-note-textarea");
    if (document.activeElement === textarea) {
        updateStatusNoteSelection();
    }
});
document.getElementById("btn-format-bold").addEventListener("click", () => applyStatusNoteFormat("bold"));
document.getElementById("btn-format-italic").addEventListener("click", () => applyStatusNoteFormat("italic"));
document.getElementById("btn-format-bullet").addEventListener("click", () => applyStatusNoteFormat("bullet"));
document.getElementById("btn-format-number").addEventListener("click", () => applyStatusNoteFormat("number"));
document.getElementById("btn-format-link").addEventListener("click", () => applyStatusNoteFormat("link"));
document.getElementById("btn-save-status-note").addEventListener("click", () => {
    if (!activeStatusNoteInitiativeId) return;

    const status = document.getElementById("status-note-textarea").value.split("\n")
        .map(x => x.trim())
        .filter(x => x !== "");

    store.updateInitiative(activeStatusNoteInitiativeId, { status });
    closeStatusNoteModal();
});

// View switches
document.querySelectorAll(".view-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".view-btn").forEach(x => x.classList.remove("active"));
        btn.classList.add("active");
        
        const targetView = btn.getAttribute("data-view");
        store.currentView = targetView;
        store.render();
    });
});

// Search functionality
const searchInput = document.getElementById("search-input");
const clearSearchBtn = document.getElementById("clear-search-btn");

searchInput.addEventListener("input", (e) => {
    const val = e.target.value;
    store.searchQuery = val;
    
    if (val.trim() !== "") {
        clearSearchBtn.style.display = "block";
    } else {
        clearSearchBtn.style.display = "none";
    }
    
    store.render();
});

clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    store.searchQuery = "";
    clearSearchBtn.style.display = "none";
    searchInput.focus();
    store.render();
});

// Custom dropdown lists
const allTechAreasList = [
    "Membership & Base Operations Management",
    "Training & Operations Support",
    "Organization Support"
];

const allStatesList = [
    "Prioritize",
    "Investigate",
    "Design",
    "Build",
    "Test",
    "Launch",
    "Complete",
    "Deferred"
];

// Initialize dropdown checkboxes and behaviors
function initCustomDropdowns() {
    // A. Tech Areas popover
    const techTrigger = document.getElementById("trigger-tech-area");
    const techMenu = document.getElementById("dropdown-tech-area");
    const techOptionsContainer = document.getElementById("options-tech-area");

    techOptionsContainer.innerHTML = allTechAreasList.map(area => `
        <label class="dropdown-option-item">
            <input type="checkbox" value="${area}" checked data-type="tech">
            <span>${area === "Membership & Base Operations Management" ? "Membership & Base Ops" : 
                   area === "Training & Operations Support" ? "Training & Operations" : area}</span>
        </label>
    `).join("");

    techTrigger.addEventListener("click", (e) => {
        e.stopPropagation();
        techMenu.classList.toggle("open");
        document.getElementById("dropdown-state").classList.remove("open");
    });

    // B. States popover
    const stateTrigger = document.getElementById("trigger-state");
    const stateMenu = document.getElementById("dropdown-state");
    const stateOptionsContainer = document.getElementById("options-state");

    stateOptionsContainer.innerHTML = allStatesList.map(state => `
        <label class="dropdown-option-item">
            <input type="checkbox" value="${state}" checked data-type="state">
            <span>${state}</span>
        </label>
    `).join("");

    stateTrigger.addEventListener("click", (e) => {
        e.stopPropagation();
        stateMenu.classList.toggle("open");
        techMenu.classList.remove("open");
    });

    // Close popovers clicking anywhere outside
    document.addEventListener("click", () => {
        techMenu.classList.remove("open");
        stateMenu.classList.remove("open");
    });

    // Prevent propagation inside popovers
    document.getElementById("menu-tech-area").addEventListener("click", (e) => e.stopPropagation());
    document.getElementById("menu-state").addEventListener("click", (e) => e.stopPropagation());

    // Listen to checkbox changes
    document.querySelectorAll(".dropdown-option-item input").forEach(cb => {
        cb.addEventListener("change", () => {
            updateFiltersFromCheckboxes();
        });
    });

    // Link handlers
    document.getElementById("all-tech-area").addEventListener("click", () => toggleAllCheckboxes("tech", true));
    document.getElementById("none-tech-area").addEventListener("click", () => toggleAllCheckboxes("tech", false));
    document.getElementById("all-state").addEventListener("click", () => toggleAllCheckboxes("state", true));
    document.getElementById("none-state").addEventListener("click", () => toggleAllCheckboxes("state", false));
}

function toggleAllCheckboxes(type, checked) {
    document.querySelectorAll(`.dropdown-option-item input[data-type="${type}"]`).forEach(cb => {
        cb.checked = checked;
    });
    updateFiltersFromCheckboxes();
}

function updateFiltersFromCheckboxes() {
    // Collect checked Tech Areas
    const selectedTechs = [];
    document.querySelectorAll('.dropdown-option-item input[data-type="tech"]:checked').forEach(cb => {
        selectedTechs.push(cb.value);
    });
    store.selectedTechAreas = selectedTechs;

    const techLabel = document.querySelector("#trigger-tech-area span");
    if (selectedTechs.length === allTechAreasList.length) {
        techLabel.textContent = "All Tech Areas";
    } else if (selectedTechs.length === 0) {
        techLabel.textContent = "None Selected";
    } else {
        techLabel.textContent = `Tech Areas (${selectedTechs.length})`;
    }

    // Collect checked States
    const selectedStates = [];
    document.querySelectorAll('.dropdown-option-item input[data-type="state"]:checked').forEach(cb => {
        selectedStates.push(cb.value);
    });
    store.selectedStates = selectedStates;

    const stateLabel = document.querySelector("#trigger-state span");
    if (selectedStates.length === allStatesList.length) {
        stateLabel.textContent = "All States";
    } else if (selectedStates.length === 0) {
        stateLabel.textContent = "None Selected";
    } else {
        stateLabel.textContent = `States (${selectedStates.length})`;
    }

    store.render();
}

function resetCheckboxFilters() {
    document.querySelectorAll('.dropdown-option-item input').forEach(cb => {
        cb.checked = true;
    });
    updateFiltersFromCheckboxes();
}

// Reset panel button wiring
document.getElementById("btn-reset-filters").addEventListener("click", () => {
    searchInput.value = "";
    clearSearchBtn.style.display = "none";
    
    store.searchQuery = "";
    resetCheckboxFilters();
});

// Table sorting header click wiring
document.querySelectorAll("th.sortable").forEach(header => {
    header.addEventListener("click", () => {
        const column = header.getAttribute("data-sort");
        if (store.sortBy === column) {
            store.sortDirection = store.sortDirection === "asc" ? "desc" : "asc";
        } else {
            store.sortBy = column;
            store.sortDirection = "asc";
        }
        store.render();
    });
});

// KPI Card Quick-Filter Click Handlers
function setKpiFilter(filterType) {
    // Toggle off if already active
    const newFilter = store.kpiFilter === filterType ? null : filterType;
    store.kpiFilter = newFilter;

    // Update visual active states on the cards
    document.getElementById("kpi-active").classList.toggle("kpi-filter-active", newFilter === "active");
    document.getElementById("kpi-blocked").classList.toggle("kpi-filter-active", newFilter === "blocked");

    // Switch to table view so the filter result is visible
    if (newFilter !== null) {
        store.currentView = "table";
        document.querySelectorAll(".view-btn").forEach(b => b.classList.remove("active"));
        document.querySelector(".view-btn[data-view='table']").classList.add("active");
    }

    store.render();
}

// Page Initialization
document.addEventListener("DOMContentLoaded", async () => {
    await store.initialize();
    initCustomDropdowns();
    store.updateKPIs();
    store.render();

    document.getElementById("btn-export-json").addEventListener("click", () => {
        store.exportToJsonFile();
    });

    document.getElementById("btn-import-json").addEventListener("click", () => {
        document.getElementById("json-import-input").click();
    });

    document.getElementById("json-import-input").addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const json = JSON.parse(text);
            store.importFromJson(json);
        } catch (error) {
            console.error(error);
            alert("Unable to import the JSON file. Please make sure the file contains a valid array of initiatives.");
        } finally {
            event.target.value = "";
        }
    });

    // Wire up KPI card clicks
    document.getElementById("kpi-active").addEventListener("click", () => setKpiFilter("active"));
    document.getElementById("kpi-blocked").addEventListener("click", () => setKpiFilter("blocked"));
});
