console.log("Open Review Loaded");

let lastUrl = location.href;

function normalizeLabel(value) {
    return (value || "")
        .toString()
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function getAllHappyFoxFields() {

    const fields = {};

    document
        .querySelectorAll(".hf-custom-field")
        .forEach(container => {

            const label =
                container
                    .querySelector("label")
                    ?.textContent
                    ?.trim();

            const value =
                container
                    .querySelector(".hf-custom-field_value")
                    ?.textContent
                    ?.trim();

            if (label) {
                fields[label] = value || "";
            }
        });

    return fields;
}


function getHappyFoxTicketText() {

    const clone =
        document.body.cloneNode(true);

    clone
        .querySelectorAll(
            [
                '.hf-custom-field',
                '#open-review-wrapper',
                'script',
                'style',
                'input',
                'textarea',
                'select',
                'button'
            ].join(',')
        )
        .forEach(el => el.remove());

    return (clone.innerText || clone.textContent || '')
        .split(/\n+/)
        .map(line => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n');
}

function getFieldFromMap(fields, labelText) {

    const target = normalizeLabel(labelText);

    const exactKey =
        Object
            .keys(fields)
            .find(key =>
                normalizeLabel(key) === target
            );

    if (exactKey) {
        return fields[exactKey];
    }

    return null;
}

function getFirstField(fields, labels) {

    for (const label of labels) {

        const value =
            getFieldFromMap(
                fields,
                label
            );

        if (
            value !== null &&
            value !== undefined &&
            value.toString().trim() !== ""
        ) {
            return value.toString().trim();
        }
    }

    return null;
}

function getFieldValue(labelText) {

    const fields =
        getAllHappyFoxFields();

    return getFieldFromMap(
        fields,
        labelText
    );
}

function getTicketData() {

    const happyfoxFields =
        getAllHappyFoxFields();

    return {
        vin: getFirstField(
            happyfoxFields,
            [
                "VIN (SF)",
                "VIN",
                "Vehicle VIN"
            ]
        )
            ?.trim()
            ?.toUpperCase(),

        state: getFirstField(
            happyfoxFields,
            [
                "Current Title State",
                "Title State",
                "State"
            ]
        )
            ?.trim()
            ?.toUpperCase(),

        rvClass: getFirstField(
            happyfoxFields,
            [
                "SF RV Class",
                "RV Class",
                "Class"
            ]
        )
            ?.trim(),

        salesforceUrl: getFirstField(
            happyfoxFields,
            [
                "SalesForce Req Link",
                "Salesforce Req Link",
                "Salesforce Request Link",
                "SalesForce Request Link",
                "Salesforce Link"
            ]
        )
            ?.trim(),

        happyfoxFields,
        happyfoxText: getHappyFoxTicketText()
    };
}


let openReviewCleanupPending = null;
let openReviewPostedNoteObserver = null;

function markOpenReviewCleanupPending(vin) {
    openReviewCleanupPending = {
        vin: (vin || getTicketData().vin || "").toString().trim().toUpperCase(),
        createdAt: Date.now(),
        sent: false
    };

    try {
        sessionStorage.setItem(
            "openReviewCleanupPending",
            JSON.stringify(openReviewCleanupPending)
        );
    } catch (error) {
        // sessionStorage can be unavailable in some embedded contexts.
    }

    installPostedNoteCleanupObserver();
}

function restoreOpenReviewCleanupPending() {
    if (openReviewCleanupPending) {
        return;
    }

    try {
        const saved = JSON.parse(
            sessionStorage.getItem("openReviewCleanupPending") || "null"
        );

        if (
            saved &&
            saved.createdAt &&
            Date.now() - saved.createdAt < 20 * 60 * 1000
        ) {
            openReviewCleanupPending = saved;
        }
    } catch (error) {
        // Ignore malformed saved state.
    }
}

function clearOpenReviewCleanupPending() {
    openReviewCleanupPending = null;

    try {
        sessionStorage.removeItem("openReviewCleanupPending");
    } catch (error) {
        // Ignore storage errors.
    }

    if (openReviewPostedNoteObserver) {
        openReviewPostedNoteObserver.disconnect();
        openReviewPostedNoteObserver = null;
    }
}

function sendOpenReviewCleanupOnce(reason) {
    restoreOpenReviewCleanupPending();

    if (!openReviewCleanupPending || openReviewCleanupPending.sent) {
        return;
    }

    openReviewCleanupPending.sent = true;

    const payload = {
        action: "openReviewPrivateNoteSubmitted",
        ...getTicketData(),
        vin: openReviewCleanupPending.vin || getTicketData().vin,
        cleanupReason: reason || "unknown"
    };

    chrome.runtime.sendMessage(
        payload,
        response => {
            if (chrome.runtime.lastError || response?.ok === false) {
                openReviewCleanupPending.sent = false;
                try {
                    sessionStorage.setItem(
                        "openReviewCleanupPending",
                        JSON.stringify(openReviewCleanupPending)
                    );
                } catch (error) {
                    // Ignore storage errors.
                }
                return;
            }

            clearOpenReviewCleanupPending();
        }
    );
}

function nodeContainsPostedOpenReviewNote(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) {
        return false;
    }

    const root = node;

    const candidates = [
        root,
        ...root.querySelectorAll?.(
            "[data-test-id='update-box-body-html'], .hf-update-box_body, .hf-update-box_header_summary, [class*='update-box']"
        ) || []
    ];

    return candidates.some(el => {
        if (el.isContentEditable || el.closest?.("[contenteditable='true']")) {
            return false;
        }

        const text =
            (el.innerText || el.textContent || "")
                .replace(/\s+/g, " ")
                .trim();

        return text.includes("MVR + Comparison Chart") &&
            text.includes("Field") &&
            text.includes("HappyFox") &&
            text.includes("MVR / Manual");
    });
}

function installPostedNoteCleanupObserver() {
    if (openReviewPostedNoteObserver) {
        return;
    }

    openReviewPostedNoteObserver =
        new MutationObserver(mutations => {
            restoreOpenReviewCleanupPending();

            if (!openReviewCleanupPending || openReviewCleanupPending.sent) {
                return;
            }

            const foundPostedNote =
                mutations.some(mutation =>
                    [...mutation.addedNodes].some(nodeContainsPostedOpenReviewNote)
                );

            if (foundPostedNote) {
                setTimeout(
                    () => sendOpenReviewCleanupOnce("posted-note-detected"),
                    1200
                );
            }
        });

    openReviewPostedNoteObserver.observe(
        document.body,
        {
            childList: true,
            subtree: true
        }
    );
}

function removeOldButtons() {

    document
        .querySelectorAll("#open-review-wrapper")
        .forEach(el => el.remove());

}

function createMiniButton(text, cssText) {

    const button =
        document.createElement("button");

    button.textContent = text;
    button.style.cssText = cssText;

    return button;
}

function createButtons() {

    const vinLabel =
        [...document.querySelectorAll("label")]
            .find(el =>
                el.textContent.trim() === "VIN (SF)"
            );

    if (!vinLabel) {
        return;
    }

    const fieldContainer =
        vinLabel.closest(".hf-custom-field");

    if (!fieldContainer) {
        return;
    }

    if (
        fieldContainer.querySelector(
            "#open-review-wrapper"
        )
    ) {
        return;
    }

    const wrapper =
        document.createElement("div");

    wrapper.id =
        "open-review-wrapper";

    wrapper.style.marginTop =
        "10px";

    //
    // OPEN REVIEW
    //

    const reviewBtn =
        document.createElement("button");

    reviewBtn.id =
        "open-review-btn";

    reviewBtn.textContent =
        "Open Review";

    reviewBtn.title =
        "Run Open Review and prepare the HappyFox private note";

    reviewBtn.style.cssText = `
        background:#0A84FF;
        color:white;
        border:none;
        padding:8px 16px;
        border-radius:6px;
        font-weight:600;
        cursor:pointer;
        margin-bottom:6px;
    `;

    wrapper.appendChild(reviewBtn);

    //
    // TOOL ROW
    //

    const tools =
        document.createElement("div");

    tools.style.display = "flex";
    tools.style.gap = "4px";
    tools.style.flexWrap = "wrap";

    const miniButtonStyle = `
        color:white;
        border:none;
        padding:4px 8px;
        border-radius:4px;
        font-size:11px;
        cursor:pointer;
    `;

    const sfBtn =
        createMiniButton(
            "SF",
            `background:#0176D3;${miniButtonStyle}`
        );

    sfBtn.title =
        "Open Salesforce";

    const yrBtn =
        createMiniButton(
            "YR",
            `background:#2EA043;${miniButtonStyle}`
        );

    yrBtn.title =
        "Open Yassi record";

    const nmvBtn =
        createMiniButton(
            "NMV",
            `background:#FF8C00;${miniButtonStyle}`
        );

    nmvBtn.title =
        "Open NMVTIS";

    const waBtn =
        createMiniButton(
            "WA",
            `background:#4B2E83;${miniButtonStyle}`
        );

    waBtn.title =
        "Open WA DOL License Express (MVR)";

    const vinBtn =
        createMiniButton(
            "VIN",
            `background:#6F42C1;${miniButtonStyle}`
        );

    vinBtn.title =
        "Download VIN decoder screenshot";

    const genBtn =
        createMiniButton(
            "REV",
            `background:#D63384;${miniButtonStyle}`
        );

    genBtn.title =
        "Generate review from currently open tabs";

    const debugBtn =
        createMiniButton(
            "DBG",
            `background:#6C757D;${miniButtonStyle}`
        );

    debugBtn.title =
        "Open result page and download result/debug files";

    const hfBtn =
        createMiniButton(
            "HF",
            `background:#C2410C;${miniButtonStyle}`
        );

    hfBtn.title =
        "Prepare HappyFox private note with the comparison chart";

    tools.appendChild(sfBtn);
    tools.appendChild(yrBtn);
    tools.appendChild(nmvBtn);
    tools.appendChild(waBtn);
    tools.appendChild(vinBtn);
    tools.appendChild(genBtn);
    tools.appendChild(debugBtn);
    // HF draft/upload now runs from the main Open Review button.
    // Keep hfBtn defined for easy rollback/testing, but do not show a duplicate control.

    wrapper.appendChild(tools);

    fieldContainer.appendChild(
        wrapper
    );

    //
    // OPEN REVIEW
    //

    reviewBtn.addEventListener(
        "click",
        () => {

            const originalText =
                reviewBtn.textContent;

            reviewBtn.textContent =
                "Running…";

            reviewBtn.disabled =
                true;

            chrome.runtime.sendMessage(
                {
                    action: "prepareHappyFoxDraft",
                    ...getTicketData()
                },
                response => {
                    reviewBtn.disabled = false;

                    if (chrome.runtime.lastError) {
                        reviewBtn.textContent = originalText;
                        alert(`Open Review draft failed: ${chrome.runtime.lastError.message}`);
                        return;
                    }

                    if (response && response.ok === false) {
                        reviewBtn.textContent = originalText;
                        alert(`Open Review draft failed: ${response.error || "unknown error"}`);
                        return;
                    }

                    markOpenReviewCleanupPending(response?.vin);

                    reviewBtn.textContent =
                        "Draft";

                    setTimeout(
                        () => { reviewBtn.textContent = originalText; },
                        2500
                    );
                }
            );

        }
    );

    //
    // SALESFORCE
    //

    sfBtn.addEventListener(
        "click",
        () => {

            chrome.runtime.sendMessage({
                action: "salesforce",
                ...getTicketData()
            });

        }
    );

    //
    // YASSI RECORD
    //

    yrBtn.addEventListener(
        "click",
        () => {

            chrome.runtime.sendMessage({
                action: "record",
                ...getTicketData()
            });

        }
    );

    //
    // NMVTIS
    //

    nmvBtn.addEventListener(
        "click",
        () => {

            chrome.runtime.sendMessage({
                action: "nmvtis",
                ...getTicketData()
            });

        }
    );

    //
    // WA DOL LICENSE EXPRESS
    //

    waBtn.addEventListener(
        "click",
        () => {

            chrome.runtime.sendMessage({
                action: "wamvr",
                ...getTicketData()
            });

        }
    );

    //
    // VINSHOT
    //

    vinBtn.addEventListener(
        "click",
        () => {

            chrome.runtime.sendMessage({
                action: "vinshot",
                ...getTicketData()
            });

        }
    );

    //
    // REVIEW GENERATOR ONLY
    //

    genBtn.addEventListener(
        "click",
        () => {

            const originalText =
                genBtn.textContent;

            genBtn.textContent =
                "…";

            genBtn.disabled =
                true;

            chrome.runtime.sendMessage(
                {
                    action: "generateReview",
                    ...getTicketData()
                },
                response => {
                    genBtn.disabled = false;

                    if (chrome.runtime.lastError) {
                        genBtn.textContent = originalText;
                        alert(`Open Review generate failed: ${chrome.runtime.lastError.message}`);
                        return;
                    }

                    if (response && response.ok === false) {
                        genBtn.textContent = originalText;
                        alert(`Open Review generate failed: ${response.error || "unknown error"}`);
                        return;
                    }

                    genBtn.textContent =
                        "COP";

                    setTimeout(
                        () => { genBtn.textContent = originalText; },
                        2500
                    );
                }
            );

        }
    );

    //
    // HAPPYFOX PRIVATE NOTE DRAFT
    //

    hfBtn.addEventListener(
        "click",
        () => {

            const originalText =
                hfBtn.textContent;

            hfBtn.textContent =
                "…";

            hfBtn.disabled =
                true;

            chrome.runtime.sendMessage(
                {
                    action: "prepareHappyFoxDraft",
                    ...getTicketData()
                },
                response => {
                    hfBtn.disabled = false;

                    if (chrome.runtime.lastError) {
                        hfBtn.textContent = originalText;
                        alert(`Open Review HF draft failed: ${chrome.runtime.lastError.message}`);
                        return;
                    }

                    if (response && response.ok === false) {
                        hfBtn.textContent = originalText;
                        alert(`Open Review HF draft failed: ${response.error || "unknown error"}`);
                        return;
                    }

                    markOpenReviewCleanupPending(response?.vin);

                    hfBtn.textContent =
                        "DRF";

                    setTimeout(
                        () => { hfBtn.textContent = originalText; },
                        2500
                    );
                }
            );

        }
    );

    //
    // DEBUG CAPTURE
    //

    debugBtn.addEventListener(
        "click",
        () => {

            const originalText =
                debugBtn.textContent;

            debugBtn.textContent =
                "…";

            debugBtn.disabled =
                true;

            chrome.runtime.sendMessage(
                {
                    action: "downloadDebug",
                    ...getTicketData()
                },
                response => {
                    debugBtn.disabled = false;

                    if (chrome.runtime.lastError) {
                        debugBtn.textContent = originalText;
                        alert(`Open Review debug failed: ${chrome.runtime.lastError.message}`);
                        return;
                    }

                    if (response && response.ok === false) {
                        debugBtn.textContent = originalText;
                        alert(`Open Review debug failed: ${response.error || "unknown error"}`);
                        return;
                    }

                    debugBtn.textContent =
                        "SAV";

                    setTimeout(
                        () => { debugBtn.textContent = originalText; },
                        2500
                    );
                }
            );

        }
    );

}


function installPrivateNoteSubmitCleanupListener() {

    if (window.__openReviewPrivateNoteCleanupInstalled) {
        return;
    }

    window.__openReviewPrivateNoteCleanupInstalled = true;

    restoreOpenReviewCleanupPending();
    installPostedNoteCleanupObserver();

    document.addEventListener(
        "click",
        event => {

            restoreOpenReviewCleanupPending();

            if (!openReviewCleanupPending || openReviewCleanupPending.sent) {
                return;
            }

            const target =
                event.target?.closest?.(
                    "button,a,[role='button'],input[type='button'],input[type='submit'],div[role='button']"
                );

            if (!target) {
                return;
            }

            const text =
                normalizeLabel(
                    target.innerText ||
                    target.textContent ||
                    target.value ||
                    target.getAttribute("aria-label") ||
                    target.getAttribute("title") ||
                    ""
                );

            const pageText =
                normalizeLabel(document.body?.innerText || "");

            const hasPreparedOpenReviewDraft =
                pageText.includes("mvr + comparison chart");

            const looksLikePrivateNoteSubmit =
                text.includes("add private note") ||
                text.includes("save private note") ||
                text.includes("add note") ||
                text.includes("add update") ||
                text.includes("post update") ||
                text.includes("submit") ||
                text.includes("save") ||
                text.includes("send") ||
                (
                    hasPreparedOpenReviewDraft &&
                    (text === "add" || text === "update" || text === "post")
                ) ||
                (
                    hasPreparedOpenReviewDraft &&
                    text.includes("add") &&
                    !text.includes("attachment") &&
                    !text.includes("attach")
                );

            if (!looksLikePrivateNoteSubmit) {
                return;
            }

            setTimeout(
                () => sendOpenReviewCleanupOnce("private-note-submit-click"),
                2500
            );

            setTimeout(
                () => sendOpenReviewCleanupOnce("private-note-submit-click-fallback"),
                6500
            );

        },
        true
    );
}

installPrivateNoteSubmitCleanupListener();

createButtons();

setInterval(() => {

    if (
        location.href !== lastUrl
    ) {

        lastUrl =
            location.href;

        removeOldButtons();

        setTimeout(
            createButtons,
            1000
        );

        setTimeout(
            createButtons,
            3000
        );

        setTimeout(
            createButtons,
            5000
        );

    }

}, 500);

const observer =
    new MutationObserver(() => {

        createButtons();

    });

observer.observe(
    document.body,
    {
        childList: true,
        subtree: true
    }
);
