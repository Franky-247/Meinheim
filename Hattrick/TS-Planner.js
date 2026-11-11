function setupSlider(numberId, sliderId) {
    const numberInput = document.getElementById(numberId);
    const slider = document.getElementById(sliderId);

    // Slider -> Zahlenfeld
    slider.addEventListener("input", function () {
    numberInput.value = this.value;
    calc();
});

    // Zahlenfeld -> Slider
    // Erst wenn die Eingabe abgeschlossen wurde.
    numberInput.addEventListener("change", function () {
        let value = Number(this.value);

        if (isNaN(value)) {
            return;
        }

        const min = Number(this.min);
        const max = Number(this.max);

        value = Math.max(min, Math.min(max, value));

        this.value = value;
        slider.value = value;
    });
}

setupSlider("mf_referenz", "mf_referenz_slider");

const params = new URLSearchParams(window.location.search);

const DEBUG = Number(params.get("debug") || 0);
const EXPERT = Number(params.get("expert") || 0);
const FQ = Number(params.get("fq") || 6,5 );
const DRIFT = Number(params.get("ts_drift") || 0,33 );

function log(level, ...args) {
    if (DEBUG >= level) {
        console.log(...args);
    }
}

function expert(level, ...args) {
    if (EXPERT >= level) {
        console.log(...args);
    }
}

// Inputs
const startTS = document.getElementById("startTS");
const ruhewert = document.getElementById("ruhewert");
const fq_Input = document.getElementById("fq-input");
const psy_Input = document.getElementById("psy-input");
const ti_Input = document.getElementById(".ti-input");
const ts_driftsetInput = document.getElementById("ts_drift");
const fqDriftInput = document.getElementById("fq_drift");
const mfRefInput = document.getElementById("mf_referenz");
const pic_factorInput = document.getElementById("pic_factor");
const mots_factorInput = document.getElementById("mots_factor");

var mfawaypinCells = document.querySelectorAll(".mfawaypin");
var mfawaypicCells = document.querySelectorAll(".mfawaypic");
var mfawaymotsCells = document.querySelectorAll(".mfawaymots");
var mfhomepicCells = document.querySelectorAll(".mfhomepic");
var mfhomemotsCells = document.querySelectorAll(".mfhomemots");
var mfhomepinCells = document.querySelectorAll(".mfhomepin");
var mfderbypinCells = document.querySelectorAll(".mfderbypin");
var mfderbypicCells = document.querySelectorAll(".mfderbypic");
var mfderbymotsCells = document.querySelectorAll(".mfderbymots");
var mfmatchCells = document.querySelectorAll(".match");

// let mfawaypin = 1;
function fqFactor(fq) {
    // Begrenze fq auf mindestens 1.01 ( wg. Div0 )
    fq = Math.max(1.01, fq);

    const ts_drift = parseFloat(ts_driftsetInput.value) || 0;
    
    const result = {
    //  hohe FQ bremst Zerfall
    //  hohe FQ beschleunigt Erholung
        high: ts_drift / (fq - 1),
        low: ts_drift / 6 * ( fq - 1 )  ,
    };

    return result;
}

// Die FQ fällt im Schnitt in 24 Wochen um 1 Stufe.
const FQ_DRIFT_BASE = 112 / 168;

function fqDrift(fq) {
    const fq_drift = parseFloat(fqDriftInput.value) || 0;

    fq = fq - FQ_DRIFT_BASE * (1 - fq_drift);
    fq = Math.max(1.01, fq); // Begrenze fq auf mindestens 1.01
    return fq;
}


function applyFQDefaults(changedInput) {
    const newFQ = Number(changedInput.value);

    const row = changedInput.closest("tr");
    const rows = Array.from(tbody.querySelectorAll("tr"));
    const startIndex = rows.indexOf(row);

    let fqDefault = newFQ;

    for (let i = startIndex + 1; i < rows.length; i++) {
        const input = rows[i].querySelector(".fq-input");

	// FQ Zerfall findet beim TU statt
        if ( ( i + 2 ) % 7 === 0) {
		fqDefault = fqDrift(fqDefault);
        } 

	if (input) {
	    input.value = fqDefault;
	}
    }
}


function applyPSYDefaults(changedInput) {
    const newPSY = Number(changedInput.value);

    const row = changedInput.closest("tr");
    const rows = Array.from(tbody.querySelectorAll("tr"));
    const startIndex = rows.indexOf(row);

    for (let i = startIndex + 1; i < rows.length; i++) {
        const input = rows[i].querySelector(".psy-input");

		if (input) {
		    input.value = newPSY;
		}
    }
}


function applyTIDefaults(changedInput) {
    const newTI = Number(changedInput.value);

    const row = changedInput.closest("tr");
    const rows = Array.from(tbody.querySelectorAll("tr"));
    const startIndex = rows.indexOf(row);

    for (let i = startIndex + 1; i < rows.length; i++) {
        const input = rows[i].querySelector(".ti-input");

		if (input) {
		    input.value = newTI;
		}
    }
}

function getRuhewert(tsBasiswert, psy) {
    return Math.min(5.0, tsBasiswert + psy * 0.1);
}

// Drift pro Update
function applyUpdate(aktuelleTS, effektiverRuhewert, factors) {

    let tsBasiswert = parseFloat(document.getElementById("ruhewert").value);
    // Verein: Ruhewert 4.5 / NT: Ruhewert 5.0

    let factor;

    if (aktuelleTS > effektiverRuhewert) {
        // Zerfall von oben
        factor = factors.high;
    } else {
        // Erholung von unten
        factor = factors.low;
    }

    aktuelleTS = aktuelleTS - ( aktuelleTS - effektiverRuhewert ) * factor * aktuelleTS;

    if ( tsBasiswert <= 4.5 ) {
	    if (aktuelleTS > 9.5) {
		// Verein: Cap 9.5 beim ersten täglichen TS-Update
		aktuelleTS = 9.5;
    		}
    }

    return aktuelleTS;
}

function applySeasonDefaults() {

    const types = document.querySelectorAll(".type");
    const actions = document.querySelectorAll(".action");
    const weeks = document.querySelectorAll(".week");

    let cupExit = parseInt(document.getElementById("cupExit").value);
    let hmExit = parseInt(document.getElementById("hmExit").value);

    let cupRound = 0;
    let hmRound = 0;

    for (let i = 0; i < 114; i++) {

	// Midweek-Spiele
        if (i  === 0) {
            // Reset zu Beginn der Saison
            types[i].value = "Reset";
        } else if ( ( i + 4 ) % 7 === 0) {

            cupRound++;
	    if (actions[i].value === "") {
	    	actions[i].value = "PIN";
	    } 

            if (cupRound > cupExit) {
                types[i].value = "Friendly";
            } else {
                types[i].value = "Pokal";
            }

        } else if ( ( i + 2 ) % 7 === 0) {

            // Hattrick Masters
            if (i > 27) {
		    if ( ( hmRound ) < ( hmExit ) ) {
			types[i].value = "Hattrick Masters";
			if (actions[i].value === "") {
				actions[i].value = "PIN";
			} 
			hmRound++;
		    } else {
			types[i].value = "";
		    }
            } else {
                types[i].value = "";
            }
        } else if ( ( i + 5 ) % 7 === 0) {

            // Hattrick Masters
            if (i > 27) {
		    if ( ( hmRound ) < ( hmExit ) ) {
			types[i].value = "Hattrick Masters";
			if (actions[i].value === "") {
	    			actions[i].value = "MOTS";
			} 
            	 	hmRound++;
		    } else {
			types[i].value = "";
		    }
            } else {
                types[i].value = "";
            }
        } else if ( ( i + 7 ) % 7 === 0) {

            // Wochenende
            if (i > 110) {
                types[i].value = "Friendly";
            } else {
                types[i].value = "Liga";
		if (actions[i].value === "") {
	        	actions[i].value = "PIN";
		}	
            }
        } else if ( ( i + 3 ) % 7 === 0) {
		if (types[i].value === "") {
                	types[i].value = "TI einstellen";
		}	
        } else {

            // Update
            types[i].value = "";
        }
    }
    log(1,"HMExit:",hmExit);
    log(1,"HM-Runde:",hmRound);

    // Spiel 30 optional Relegation
    types[105].value = "Relegation";
    actions[105].value = "MOTS";
    // Spiel 31 optional FedCup
    types[108].value = "FedCup";
    actions[108].value = "NORMAL";
    weeks[113].value = "0";
    types[113].value = "Reset";
    actions[113].value = "";
}

// Spieleffekte (bewusst klassisch gehalten)

// HM:
// Einstellung des Teams:
// Spielt man das "Spiel des Jahres" (Match Of The Season", MOTS) oder "Kraft sparen" ("Play It Cool", PIC), wird die Teamstimmung nicht so sehr wie bei normalen Spielen verringert (fällt um 1/3) bzw. erhöht (steigt um 1/4). Der Effekt während des Spiels fällt aber genauso aus wie bei einem normalen Spiel.
// 

function applyMatch(ts, action, type) {
    	let tsBasiswert = parseFloat(ruhewert.value);
        let pic = parseFloat(document.getElementById("pic_factor").value);
        let mots = parseFloat(document.getElementById("mots_factor").value);

	if (type === "Hattrick Masters") {
		if (action === "PIC") {
			ts = ts * 5 / 4;
		    } else if (action === "MOTS") {
			ts = ts * 3 / 4;
		}
        } else if (type === "Reset") {
			// Spezialfall NT/U21-NT ts = 5.0
			ts = tsBasiswert;
        } else if (type === "Reset 80 %") {
			// Beispiel aus dem Hattrick-Handbuch: (9 - 5) * 0.8 = 3,2
			// Die Formel reduziert die Differenz zum Ruhewert; bei TS < Ruhewert steigt die TS entsprechend.
			ts = ts - ( ts - tsBasiswert ) * 0.8;
        } else if (type === "Reset 60 %") {
			ts = ts - ( ts - tsBasiswert ) * 0.6;
        } else if (type === "Reset 40 %") {
			ts = ts - ( ts - tsBasiswert ) * 0.4;
        } else if (type === "Drop") {
			ts = Math.ceil( ts ) - 1.01;
        } else if (type === "Rise") {
			ts = Math.floor( ts ) + 1;
        } else if (type === "Special Match") {
		if (action === "PIC") {
			// ts = ts * 4 / 3;
			ts = ts * pic;
		    } else if (action === "MOTS") {
			// ts = ts / 2;
			ts = ts * mots;
		}
	}
	else
	{
		if (action === "PIC") {
			ts = ts * 4 / 3;
		    } else if (action === "MOTS") {
			ts = ts / 2;
		}
	}
    return ts;
}

function applyTISchraube(ts, oldTI, newTI) {
        oldTI = Math.max(0.001, oldTI);
	// const NERO_EXPONENT = Math.log(1.2) / Math.log(0.7);
	const NERO_EXPONENT = -0.5;
	return ts * (newTI / oldTI) ** NERO_EXPONENT;
}

// Realistischere Update-Anzahl, bei der Version mit täglichen Updates wird immer mit 1 gerechnet.
function getUpdates(type) {
    // if (type === "Friendly") return 3;
    // if (type === "Liga") return 4;
    // if (type === "Pokal") return 3;
    // if (type === "Relegation") return 4;
    // if (type === "Update") return 1;
    return 1;
}

function importCSV() {
    const fileInput = document.getElementById("csv_import");
    const table = document.getElementById("tsTable");

    if (!fileInput.files.length) {
        alert("Bitte zuerst eine CSV-Datei auswählen.");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function (event) {

        const text = event.target.result;

        const lines = text
            .split(/\r?\n/)
            .filter(line => line.trim() !== "");

        if (lines.length < 2) {
            alert("Die CSV-Datei enthält keine Daten.");
            return;
        }

        // Header auslesen
        const headers = lines[0].split(";");

        // Spaltenpositionen ermitteln
        const typeIndex = headers.indexOf("Spieltyp");
        const actionIndex = headers.indexOf("TS Einsatz");
        const ortIndex = headers.indexOf("Spielort");
        const fqIndex = headers.indexOf("FQ");
        const tiIndex = headers.indexOf("TI");
        const psyIndex = headers.indexOf("Sportpsychologe");
        const gegnerIndex = headers.indexOf("Gegner");

        if (typeIndex === -1 || actionIndex === -1 || ortIndex === -1 ||
            fqIndex === -1 || tiIndex === -1 || psyIndex === -1) {

            alert("Eine oder mehrere benötigte Spalten wurden nicht gefunden.");
            return;
        }

        const csvRows = lines.slice(1).map(line => line.split(";"));

        const tbody = table.querySelector("tbody");

        /*
         * Die vorhandenen Tabellenzeilen bleiben bestehen.
         */
        const tableRows = tbody.querySelectorAll("tr");

        csvRows.forEach((csvRow, rowIndex) => {

            const tr = tableRows[rowIndex];

            if (!tr) {
                return;
            }

            // -----------------------------
            // Spieltyp
            // -----------------------------
            const typeSelect = tr.querySelector("select.type");

            if (typeSelect) {
                const value = csvRow[typeIndex]?.trim();

                if (value !== undefined) {
                    typeSelect.value = value;
                }
            }

            // -----------------------------
            // Spielort
            // -----------------------------
            const ortSelect = tr.querySelector("select.ort");

            if (ortSelect) {
                const value = csvRow[ortIndex]?.trim();

                if (value !== undefined) {
                    ortSelect.value = value;
                    log(1, "Ort:", ortSelect);
                }
            }

            // -----------------------------
            // TS Einsatz
            // -----------------------------
            const actionSelect = tr.querySelector("select.action");

            if (actionSelect) {
                const value = csvRow[actionIndex]?.trim();

                if (value !== undefined) {
                    actionSelect.value = value;
                }
            }

            // -----------------------------
            // TI
            // -----------------------------
            const tiInput = tr.querySelector(".ti-input");

            if (tiInput) {
                const tiWert = csvRow[tiIndex]?.trim();

                if (tiWert !== undefined && tiWert !== "") {
                    tiInput.value = tiWert;
                }
            }

            // -----------------------------
            // FQ
            // -----------------------------
            const fqInput = tr.querySelector(".fq-input");

            if (fqInput) {
                const fqWert = csvRow[fqIndex]?.trim();

                if (fqWert !== undefined && fqWert !== "") {
                    fqInput.value = fqWert;
                }
            }

            // -----------------------------
            // Sportpsychologe
            // -----------------------------
            const psyInput = tr.querySelector(".psy-input");

            if (psyInput) {
                const psyWert = csvRow[psyIndex]?.trim();

                if (psyWert !== undefined && psyWert !== "") {
                    psyInput.value = psyWert;
                }
            }
            // -----------------------------
            // Gegner
            // -----------------------------
	    const gegner = tr.querySelector(".gegner input");

	    if (gegner) {
		    const gegnerWert = csvRow[gegnerIndex]?.trim() || "";
		    gegner.value = gegnerWert;
	    }

        });

        log(1, "CSV erfolgreich importiert.");

        calc();
    };

    reader.onerror = function () {
        alert("Fehler beim Lesen der CSV-Datei.");
    };

    reader.readAsText(file, "UTF-8");
}

function getCellValue(cell) {

    const field = cell.querySelector("input, select, textarea");

    let value;

    if (field) {
        value = field.value;
    } else {
        value = cell.textContent.trim();
    }

    if (value === "") {
        return null;
    }

    return parseFloat(
        value.replace(",", ".")
    );
}

let tsChart = null;
let graphikVisible = false;

function showGraphik() {
    const table = document.getElementById("tsTable");
    // ============================================================
    // Hier festlegen, welche Tabellenspalten als Kurven
    // dargestellt werden sollen.
    // ============================================================

// Standardkurven – oberhalb der Grafik
const defaultColumns = [
    "TS vor dem Spiel",
    "TS nach dem Spiel",
    "Mittelfeld beim Spiel",
    "FQ",
    "Sportpsychologe"
];

// Optionale Kurven – unterhalb der Grafik
const homeColumns = [
    "Mittelfeld Heimspiel PIN",
    "Mittelfeld Heimspiel PIC",
    "Mittelfeld Heimspiel MOTS"
];

const derbyColumns = [
    "Mittelfeld Auswärts-Derby PIN",
    "Mittelfeld Auswärts-Derby PIC",
    "Mittelfeld Auswärts-Derby MOTS"
];

const awayColumns = [
    "Mittelfeld Auswärts PIN",
    "Mittelfeld Auswärts PIC",
    "Mittelfeld Auswärts MOTS"
];

const defaultVisible = new Set(defaultColumns);

// Alle verfügbaren Kurven für die bisherige Verarbeitung
const graphColumns = [
    ...defaultColumns,
    ...homeColumns,
    ...derbyColumns,
    ...awayColumns
];

function renderTsLegend(containerId, columns) {
    const container = document.getElementById(containerId);
    if (!container || !tsChart) return;

    container.replaceChildren();

    columns.forEach(name => {
        const index = tsChart.data.datasets.findIndex(
            dataset => dataset.label === name
        );

        if (index === -1) return;

        const dataset = tsChart.data.datasets[index];
        const item = document.createElement("div");
        item.className = "ts-legend-item";

        const swatch = document.createElement("span");
        swatch.className = "ts-legend-swatch";
        swatch.style.backgroundColor =
            String(dataset.borderColor ?? "#777");

        const label = document.createElement("span");
        label.textContent = name;

        item.append(swatch, label);

        const updateItem = () => {
            const visible = tsChart.isDatasetVisible(index);
            item.classList.toggle("ts-hidden", !visible);
        };

        item.addEventListener("click", () => {
            tsChart.setDatasetVisibility(
                index,
                !tsChart.isDatasetVisible(index)
            );
            tsChart.update();
            updateAllTsLegends();
        });

        container.appendChild(item);
        updateItem();
    });
}

function updateAllTsLegends() {

    renderTsLegend("ts-default-legend", defaultColumns);
    renderTsLegend("ts-home-legend", homeColumns);
    renderTsLegend("ts-derby-legend", derbyColumns);
    renderTsLegend("ts-away-legend", awayColumns);
}

    // Überschriften der Tabelle ermitteln
    // ============================================================

    const headers = Array.from(
        table.querySelectorAll("thead th")
    ).map(th => th.textContent.trim());

    // ============================================================
    // Spaltennummern für die gewünschten Kurven ermitteln
    // ============================================================

    const columnIndices = graphColumns.map(columnName => {
        const index = headers.indexOf(columnName);
        if (index === -1) {
            console.warn(
                `Spalte "${columnName}" wurde nicht gefunden.`
            );
        }
        return index;
    });

    // Nur tatsächlich vorhandene Spalten verwenden
    const validColumns = graphColumns
        .map((name, index) => ({
            name: name,
            index: columnIndices[index]
        }))
        .filter(column => column.index !== -1);

    if (validColumns.length === 0) {
        alert("Keine der angegebenen Grafik-Spalten wurde gefunden.");
        return;
    }

    // ============================================================
    // Events und Daten vorbereiten
    // ============================================================

    const events = [];
    const datasets = validColumns.map(column => ({
        label: column.name,
         data: [],
       hidden: !defaultVisible.has(column.name)

}));

    // ============================================================
    // Tabelle durchlaufen
    // ============================================================

    table.querySelectorAll("tbody tr").forEach(row => {
        const cols = row.querySelectorAll("td");
        // Event-Spalte suchen
        const eventCol = headers.indexOf("Event");
        if (eventCol === -1 || !cols[eventCol]) {
            return;
        }
        const event = cols[eventCol].textContent.trim();
        if (event === "") {
            return;
        }
        // Werte für die einzelnen Kurven auslesen
        const values = validColumns.map(column => {
            const cell = cols[column.index];
            if (!cell) {
                return null;
            }
            return getCellValue(cell);
        });
        // Event nur übernehmen, wenn mindestens
        // ein gültiger Wert vorhanden ist.
        if (values.some(value => value !== null)) {
            events.push(event);
            values.forEach((value, index) => {
                datasets[index].data.push(value);
            });
        }
    });
    // ============================================================
    // Container sichtbar machen
    // ============================================================
    document.getElementById("chartContainer").style.display = "block";
    // ============================================================
    // Canvas
    // ============================================================
    const ctx = document.getElementById("tsChart");
    // ============================================================
    // Farben für die verschiedenen Kurven
    // ============================================================
    const colors = [
        "#3366cc",   // blau
        "#dc3912",   // rot
        "#109618",   // grün
        "#ff9900",   // orange
        "#990099",   // violett
        "#0099c6",   // türkis
        "#dd4477",   // pink
        "#66aa00"    // hellgrün
    ];
    // ============================================================
    // Chart.js-Datasets erzeugen
    // ============================================================
    datasets.forEach((dataset, index) => {
        dataset.borderColor =
            colors[index % colors.length];
        dataset.backgroundColor =
            colors[index % colors.length];
        dataset.borderWidth = 1.5;
        dataset.pointRadius = 2;
        dataset.pointHoverRadius = 5;
        dataset.tension = 0.1;
    });
    // ============================================================
    // Chart erstmalig erzeugen
    // ============================================================
    if (tsChart === null) {
        tsChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: events,
                datasets: datasets
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: "Event",
                            color: "#000000",
                            font: {
                                weight: "bold"
                            }
                        },
                        ticks: {
                            color: "#000000"
                        },
                        grid: {
                            color: "rgba(0, 0, 0, 0.20)"
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: "Wert",
                            color: "#000000",
                            font: {
                                weight: "bold"
                            }
                        },
                        ticks: {
                            color: "#000000"
                        },
                        grid: {
                            color: "rgba(0, 0, 0, 0.20)"
                        }
                    }
                },
		    plugins: {
		    legend: {
			display: false
		    },
		    tooltip: {
			enabled: true
		    }
		}
            }
        });
    } else {
	// ========================================================
	// Chart existiert bereits:
	// Sichtbarkeit der bisherigen Kurven merken
	// ========================================================
	const visibility = new Map();

	tsChart.data.datasets.forEach((dataset, index) => {
	    visibility.set(
		dataset.label,
		tsChart.isDatasetVisible(index)
	    );
	});

	// ========================================================
	// Neue Daten übernehmen und Sichtbarkeit wiederherstellen
	// ========================================================
	tsChart.data.labels = events;

	tsChart.data.datasets = datasets;

	tsChart.data.datasets.forEach((dataset, index) => {
	    if (visibility.has(dataset.label)) {
		// Bisherige Auswahl wiederherstellen
		tsChart.setDatasetVisibility(
		    index,
		    visibility.get(dataset.label)
		);
	    } else {
		// Neue Kurven entsprechend dem Default anzeigen
		tsChart.setDatasetVisibility(
		    index,
		    defaultVisible.has(dataset.label)
		);
	    }
	});

	tsChart.update();
	updateAllTsLegends();
    }
    updateAllTsLegends();
}

function exportCSV() {

	// ToDo: TI exportieren,
    const table = document.getElementById("tsTable");

    let csv = [];

    // Header
    const headers = Array.from(
        table.querySelectorAll("thead th")
    ).map(th => th.textContent.trim());

    csv.push(headers.join(";"));

	// Zeilen
	const rows = table.querySelectorAll("tbody tr");
	rows.forEach(row => {
	    const cols = row.querySelectorAll("td");
	    const rowData = Array.from(cols).map(col => {
		const field = col.querySelector("input, select, textarea");
		if (field) {
		    return field.value;
		}
		return col.textContent.trim();
	    });
	    csv.push(rowData.join(";"));
	});
    // CSV-Datei erzeugen
    const blob = new Blob(
        [csv.join("\n")],
        { type: "text/csv;charset=utf-8;" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ts-export.csv";
    a.click();
    URL.revokeObjectURL(url);
}

function toggleGraphik() {

    const container = document.getElementById("chartContainer");
    const button = document.getElementById("GraphikBtn");

    const defaultLegend = document.getElementById("ts-default-legend");
    const optionalLegend = document.getElementById("ts-optional-legend");

    graphikVisible = !graphikVisible;

    if (graphikVisible) {
        container.style.display = "block";
        defaultLegend.style.display = "flex";
        optionalLegend.style.display = "grid";
        button.textContent = "Hide Graphik";
        showGraphik();
    } else {
        container.style.display = "none";
        defaultLegend.style.display = "none";
        optionalLegend.style.display = "none";
        button.textContent = "Show Graphik";
    }
}

mfawaypinCells = document.querySelectorAll(".mfawaypin");
mfawaypicCells = document.querySelectorAll(".mfawaypic");
mfawaymotsCells = document.querySelectorAll(".mfawaymots");
mfhomepicCells = document.querySelectorAll(".mfhomepic");
mfhomemotsCells = document.querySelectorAll(".mfhomemots");
mfhomepinCells = document.querySelectorAll(".mfhomepin");
mfderbypinCells = document.querySelectorAll(".mfderbypin");
mfderbypicCells = document.querySelectorAll(".mfderbypic");
mfderbymotsCells = document.querySelectorAll(".mfderbymots");
mfmatchCells = document.querySelectorAll(".match");

let mfawaypin = 1;
// Playing away 		100%
// Playing at home 	119.892%
// Playing CA 		93%
// Playing PIC 		83.945%
// Playing MOTS 		111.49%
// Playing derby 		111.493% (*)    
let mfpic =  0.5 ** 0.25;
let mfmots =  1.5 ** 0.25;
let mfhome =  12 / 10;
let mfderby =  11 / 10;
let mfawaypic = mfawaypin * mfpic;
let mfawaymots = mfawaypin * mfmots;
let mfhomepin = mfawaypin * mfhome;
let mfhomepic = mfawaypin * mfhome * mfpic;
let mfhomemots = mfawaypin * mfhome * mfmots;
let mfderbypin = mfawaypin * mfderby;
let mfderbypic = mfawaypin * mfderby * mfpic;
let mfderbymots = mfawaypin * mfderby * mfmots;
let mfmatch = mfawaypin;

const actionMappings = {
    "PIC": {
        class: "cool",
        cells: {
            Neutral: mfawaypicCells,
            Home: mfhomepicCells,
            Away: mfawaypicCells,
            Derby: mfderbypicCells
        }
    },

    "PIN": {
        class: "calm",
        cells: {
            Neutral: mfawaypinCells,
            Home: mfhomepinCells,
            Away: mfawaypinCells,
            Derby: mfderbypinCells
        }
    },

    "MOTS": {
        class: "hot",
        cells: {
            Neutral: mfawaymotsCells,
            Home: mfhomemotsCells,
            Away: mfawaymotsCells,
            Derby: mfderbymotsCells
        }
    },

    "NORMAL": {
        class: "normal",
        cells: {
            Neutral: mfawaypinCells,
            Home: mfhomepinCells,
            Away: mfawaypinCells,
            Derby: mfderbypinCells
        }
    },

    "": {
        class: "cloud",
        cells: {
            "": mfmatchCells,          // <-- fehlt bisher
            Neutral: mfmatchCells,
            Home: mfhomepinCells,
            Away: mfawaypinCells,
            Derby: mfderbypinCells
        }
    },

    "default": {
        class: "cloud",
        cells: {
            "": mfmatchCells,
            Neutral: mfmatchCells,
            Home: mfhomepinCells,
            Away: mfawaypinCells,
            Derby: mfderbypinCells
        }
    }
};

function updateCell(i, action = "", spielort = "") {
    // Fallback für leere action oder spielort
    const mapping = actionMappings[action] || actionMappings[""];
    const cells = mapping.cells[spielort] || mapping.cells[""] || mapping.cells.default || mfmatchCells;

    const styleClass = mapping.class;

    // Alle relevanten Zellen zurücksetzen
    [mfawaypinCells[i], mfhomepinCells[i], mfawaypicCells[i], mfhomepicCells[i], mfawaymotsCells[i], mfhomemotsCells[i], mfderbypinCells[i], mfderbypicCells[i], mfderbymotsCells[i], mfmatchCells[i]]
        .forEach(cell => cell.classList.remove("normal", "cool", "calm", "hot", "cloud"));

    // Neue Klasse hinzufügen
    cells[i].classList.add(styleClass);

    // Text aktualisieren (Fallback auf mfawaypin/mfmatch, falls action oder spielort leer sind)
    let value = mfawaypin;
    if (action === "PIC") value = spielort === "Neutral" ? mfawaypic : spielort === "Home" ? mfhomepic : spielort === "Away" ? mfawaypic : spielort === "Derby" ? mfderbypic : mfawaypic;
    else if (action === "PIN") value = spielort === "Neutral" ? mfawaypin : spielort === "Home" ? mfhomepin : spielort === "Away" ? mfawaypin : spielort === "Derby" ? mfderbypin : mfawaypin;
    else if (action === "MOTS") value = spielort === "Neutral" ? mfawaymots : spielort === "Home" ? mfhomemots : spielort === "Away" ? mfawaymots : spielort === "Derby" ? mfderbymots : mfawaymots;
    else if (action === "NORMAL") value = spielort === "Neutral" ? mfawaypin : spielort === "Home" ? mfhomepin : spielort === "Away" ? mfawaypin : spielort === "Derby" ? mfderbypin : mfawaypin;

    mfmatchCells[i].innerText = value.toFixed(2);
}

function getTSFactor(tsBefore, tsBasiswert) {
    const delta = tsBefore - tsBasiswert;
    let tsfactor = parseFloat(document.getElementById("ts_factor").value);

    if (delta < 0) {
	log(1,"TS-Faktor vorher: ",tsfactor);
        tsfactor = tsfactor - Math.pow(tsfactor, Math.PI / 2) * delta;
	log(1,"TS-Faktor nachher: ",tsfactor);
    }

    return tsfactor;
}

// Hauptberechnung
function calc() {

    let upd = 0;
    let tiBefore = 100;
    let tiAfter = 100;
    let oldTI = tiAfter;

    let ts = parseFloat(startTS.value);
    let tsBasiswert = parseFloat(ruhewert.value);
    let deffq = 6;
    let defpsy = 0;

    const types = document.querySelectorAll(".type");
    const actions = document.querySelectorAll(".action");
    const ort = document.querySelectorAll(".ort");
    const cupExit = document.getElementById("cupExit").value;
    const hmExit = document.getElementById("hmExit").value;
    const spieltyp = document.querySelectorAll(".spieltyp");

    const updCells = document.querySelectorAll(".upd");

    const beforeCells = document.querySelectorAll(".before");
    const afterCells = document.querySelectorAll(".after");
    const tiCells = document.querySelectorAll(".ti-input");
    const fqCells = document.querySelectorAll(".fq-input");
    const psyCells = document.querySelectorAll(".psy-input");
    const gegnerCells = document.querySelectorAll(".gegner");

    let effektiverRuhewert = getRuhewert(tsBasiswert, defpsy);
    let factors = fqFactor(deffq);
    let ts_drift = parseFloat(ts_driftsetInput.value);
    let mf_referenz = parseFloat(mfRefInput.value);
    let fq_drift = parseFloat(fqDriftInput.value);

    log(1,beforeCells.length, afterCells.length);
    log(1,"calc läuft");

    for (let i = 0; i < 114; i++) {
	defpsy = Number(psyCells[i].value);
	deffq = Number(fqCells[i].value);

    	effektiverRuhewert = getRuhewert(tsBasiswert, defpsy);
    	factors = fqFactor(deffq);
        // Drift vor Spiel
        let updates = getUpdates(types[i].value);

	    for (let j = 0; j < updates; j++) {
 		    ts = applyUpdate(ts, effektiverRuhewert, factors);
	}

	let tsBefore = ts;
        tsfactor = parseFloat(document.getElementById("ts_factor").value);
	// mfawaypin = mf_referenz + mf_referenz * ( tsBefore - tsBasiswert ) * 0.07;
	     // \[ \boxed{ MF(TS)=10\left[1+0{,}07\Delta TS-0{,}01455(\Delta TS)^2\right] } \]
	mfawaypin = mf_referenz + mf_referenz * ( tsBefore - tsBasiswert ) * getTSFactor(tsBefore, tsBasiswert);
	// mfawaypic = mfawaypin * 0.83945;
	// mfawaymots = mfawaypin * 1.1193;
	// mfhomepin = mfawaypin * 1.19892;
	// mfhomepic = mfawaypin * 1.19892 * 0.83945;
	// mfhomemots = mfawaypin * 1.19892 * 1.1193;
	// mfderbypin = mfawaypin * 1.11493;
	// mfderbypic = mfawaypin * 1.11493 * 0.83945;
	// mfderbymots = mfawaypin * 1.11493 * 1.1193;
	 mfpic =  0.5 ** 0.25;
	 mfmots =  1.5 ** 0.25;
	 mfhome =  12 / 10;
	 mfderby =  11 / 10;
         mfpic = parseFloat(document.getElementById("mf_pic_factor").value);
         mfmots = parseFloat(document.getElementById("mf_mots_factor").value);
         mfhome = parseFloat(document.getElementById("mf_home_factor").value);
         mfderby = parseFloat(document.getElementById("mf_derby_factor").value);
	 // MF(LS,h,MOTS) = 1 + (MF(n,a,PIC)-1) x 0.96 x 1.1 x 1.316.
	 // old: mfawaypic = mfawaypin * mfpic;
	 mfawaypic = 1 + (mfawaypin - 1 ) * mfpic;
	 mfawaymots = 1 + (mfawaypin - 1 ) * mfmots;
	 mfhomepin = 1 + (mfawaypin - 1 ) * mfhome;
	 mfhomepic = 1 + (mfawaypin - 1 ) * mfhome * mfpic;
	 mfhomemots = 1 + (mfawaypin - 1 ) * mfhome * mfmots;
	 mfderbypin = 1 + (mfawaypin - 1 ) * mfderby;
	 mfderbypic = 1 + (mfawaypin - 1 ) * mfderby * mfpic;
	 mfderbymots = 1 + (mfawaypin - 1 ) * mfderby * mfmots;
	 mfmatch = mfawaypin;

	 log(1, "mfpic:", mfpic);
	 log(1, "mfmots:", mfmots);
	 log(1, "mfhome:", mfhome);
	 log(1, "mfderby:", mfderby);
	mfmatch = mfawaypin;


        let action = actions[i].value;
        let type = types[i].value;
        let spielort = ort[i].value;

        beforeCells[i].className = "before";
        // Friendly → immer NORMAL
        let effectiveAction = (type === "Friendly") ? "NORMAL" : action;
        let effectiveType = type;

        if ( ts < 1) beforeCells[i].classList.add("cold");
        else if (ts >= 1 && ts < 2) beforeCells[i].classList.add("murderous");
        else if (ts >= 2 && ts < 3) beforeCells[i].classList.add("furious");
        else if (ts >= 3 && ts < 4) beforeCells[i].classList.add("irritated");
        else if (ts >= 4 && ts < 5) beforeCells[i].classList.add("composed");
        else if (ts >= 5 && ts < 6) beforeCells[i].classList.add("calm");
        else if (ts >= 6 && ts < 7) beforeCells[i].classList.add("content");
        else if (ts >= 7 && ts < 8) beforeCells[i].classList.add("satisfied");
        else if (ts >= 8 && ts < 9) beforeCells[i].classList.add("delirious");
        else if (ts >= 9 && ts < 10) beforeCells[i].classList.add("cloud");
        else if (ts >= 10 ) beforeCells[i].classList.add("paradise");
        else beforeCells[i].classList.add("paradise");

        // Spiel anwenden
        ts = applyMatch(ts, effectiveAction, effectiveType);

	tiAfter = Number(tiCells[i].value);

        if ( ( i + 3 ) % 7 === 0) {

		// Die effektive TI muß ein "tägliches Update" vor dem TU eingestellt werden !
 		tiAfter = Number(tiCells[i-1].value);

		if (tiAfter !== oldTI) {
			ts = applyTISchraube(ts, oldTI, tiAfter);
			oldTI = tiAfter;
		}
	}

        // normale Berechnung ...
        tiBefore = tiAfter;

        // Clamp
        ts = Math.max(0.01, Math.min(13.99, ts));
        let tsAfter = ts;

        // Ausgabe
        beforeCells[i].innerText = tsBefore.toFixed(2);
        afterCells[i].innerText = tsAfter.toFixed(2);

	let gegner = "B";
	log(1,"MF Referenz:",mf_referenz);
	log(1,"TS: vorher",tsBefore);

        mfawaypinCells[i].innerText = mfawaypin.toFixed(2);
        mfawaypicCells[i].innerText = mfawaypic.toFixed(2);
        mfawaymotsCells[i].innerText = mfawaymots.toFixed(2);
        mfhomepinCells[i].innerText = mfhomepin.toFixed(2);
        mfhomepicCells[i].innerText = mfhomepic.toFixed(2);
        mfhomemotsCells[i].innerText = mfhomemots.toFixed(2);
        mfderbypinCells[i].innerText = mfderbypin.toFixed(2);
        mfderbypicCells[i].innerText = mfderbypic.toFixed(2);
        mfderbymotsCells[i].innerText = mfderbymots.toFixed(2);
        mfmatchCells[i].innerText = mfmatch.toFixed(2);

        // Farbe
        afterCells[i].className = "after";

        if ( ts < 1) afterCells[i].classList.add("cold");
        else if (ts >= 1 && ts < 2) afterCells[i].classList.add("murderous");
        else if (ts >= 2 && ts < 3) afterCells[i].classList.add("furious");
        else if (ts >= 3 && ts < 4) afterCells[i].classList.add("irritated");
        else if (ts >= 4 && ts < 5) afterCells[i].classList.add("composed");
        else if (ts >= 5 && ts < 6) afterCells[i].classList.add("calm");
        else if (ts >= 6 && ts < 7) afterCells[i].classList.add("content");
        else if (ts >= 7 && ts < 8) afterCells[i].classList.add("satisfied");
        else if (ts >= 8 && ts < 9) afterCells[i].classList.add("delirious");
        else if (ts >= 9 && ts < 10) afterCells[i].classList.add("cloud");
        else if (ts >= 10 ) afterCells[i].classList.add("paradise");
        else afterCells[i].classList.add("paradise");

        if (type === "Friendly") {
	    if (action === "PIC") {
				alert("Der Schiedsrichter notiert: 'Trainer wollte PIC im Friendly.'");
			} 
	    if (action === "MOTS") {
				alert("Der Schiedsrichter notiert: 'Trainer wollte MOTS im Friendly.'");
			} 
            actions[i].value = "PIN";
	} 
        log(1,"i:", i, "action:", action, "spielort:", spielort );
	updateCell(i, action, spielort);
    }
    if (graphikVisible) {
	    showGraphik();
    }
}
