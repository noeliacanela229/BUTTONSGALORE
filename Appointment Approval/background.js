const INQUIRY_ACCOUNT_ID =
    "b3f2ce49-1f41-4273-b41d-c17883664a22";

const STATE_MAP = {
    AL: 3,
    AK: 43,
    AZ: 5,
    AR: 8,
    CA: 1,
    CO: 27,
    DE: 21,
    FL: 22,
    GA: 44,
    ID: 17,
    IN: 50,
    IA: 48,
    KS: 25,
    KY: 11,
    LA: 38,
    ME: 19,
    MD: 10,
    MI: 6,
    MN: 24,
    MS: 15,
    MO: 13,
    MT: 30,
    NE: 16,
    NV: 14,
    NH: 37,
    NJ: 41,
    NM: 18,
    NY: 2,
    NC: 40,
    ND: 23,
    OH: 9,
    OK: 53,
    OR: 31,
    PA: 45,
    RI: 26,
    SC: 12,
    TN: 7,
    TX: 33,
    UT: 51,
    VA: 36,
    WV: 39,
    WI: 20,
    WY: 29
};

const TITLE_HOLDING_STATES =
    new Set([
        "KY",
        "MD",
        "MI",
        "MN",
        "MO",
        "MT",
        "NY",
        "OK",
        "WY"
    ]);

const REGISTRATION_REQUIRED_STATES =
    new Set([
        "AL",
        "CA",
        "CT",
        "HI",
        "IL",
        "IN",
        "MA",
        "NH",
        "OK",
        "SD",
        "VT"
    ]);

const STATUS_ORDER = {
    "🚩": 0,
    "⚠️": 1,
    "✅": 2
};

const pendingHappyFoxCleanupByTab =
    new Map();

const HAPPYFOX_CLEANUP_STORAGE_KEY =
    "openReviewPendingHappyFoxCleanupByTab";

function getExtensionStorageArea() {
    return chrome.storage?.session || chrome.storage?.local || null;
}

async function readStoredHappyFoxCleanups() {
    const area = getExtensionStorageArea();

    if (!area) {
        return {};
    }

    try {
        const result =
            await area.get(
                HAPPYFOX_CLEANUP_STORAGE_KEY
            );

        return result?.[HAPPYFOX_CLEANUP_STORAGE_KEY] || {};
    } catch (error) {
        console.error(
            "Open Review cleanup storage read failed:",
            error
        );
        return {};
    }
}

async function saveHappyFoxCleanup(sourceTabId, pending) {
    if (!sourceTabId || !pending) {
        return;
    }

    pendingHappyFoxCleanupByTab.set(
        sourceTabId,
        pending
    );

    const area = getExtensionStorageArea();

    if (!area) {
        return;
    }

    const all =
        await readStoredHappyFoxCleanups();

    all[String(sourceTabId)] = pending;

    try {
        await area.set({
            [HAPPYFOX_CLEANUP_STORAGE_KEY]: all
        });
    } catch (error) {
        console.error(
            "Open Review cleanup storage save failed:",
            error
        );
    }
}

async function getHappyFoxCleanup(sourceTabId) {
    if (!sourceTabId) {
        return null;
    }

    const cached =
        pendingHappyFoxCleanupByTab.get(
            sourceTabId
        );

    if (cached) {
        return cached;
    }

    const all =
        await readStoredHappyFoxCleanups();

    const stored =
        all[String(sourceTabId)] || null;

    if (stored) {
        pendingHappyFoxCleanupByTab.set(
            sourceTabId,
            stored
        );
    }

    return stored;
}

async function deleteHappyFoxCleanup(sourceTabId) {
    if (!sourceTabId) {
        return;
    }

    pendingHappyFoxCleanupByTab.delete(
        sourceTabId
    );

    const area = getExtensionStorageArea();

    if (!area) {
        return;
    }

    const all =
        await readStoredHappyFoxCleanups();

    delete all[String(sourceTabId)];

    try {
        await area.set({
            [HAPPYFOX_CLEANUP_STORAGE_KEY]: all
        });
    } catch (error) {
        console.error(
            "Open Review cleanup storage delete failed:",
            error
        );
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    if (message.action === "review") {
        openReview(message, sender)
            .then(result => sendResponse(result || { ok: true }))
            .catch(error => {
                console.error("Open Review failed:", error);
                sendResponse({
                    ok: false,
                    error: error?.message || String(error)
                });
            });

        return true;
    }

    if (message.action === "prepareHappyFoxDraft") {
        prepareHappyFoxDraft(message, sender)
            .then(result => sendResponse(result || { ok: true }))
            .catch(error => {
                console.error("Open Review HF draft failed:", error);
                sendResponse({
                    ok: false,
                    error: error?.message || String(error)
                });
            });

        return true;
    }

    if (message.action === "openReviewPrivateNoteSubmitted") {
        cleanupHappyFoxDraftTabs(sender?.tab?.id || null, message)
            .then(result => sendResponse(result || { ok: true }))
            .catch(error => {
                console.error("Open Review cleanup failed:", error);
                sendResponse({
                    ok: false,
                    error: error?.message || String(error)
                });
            });

        return true;
    }

    if (message.action === "salesforce") {

        if (message.salesforceUrl) {

            chrome.tabs.create({
                url: message.salesforceUrl
            });

        }

    }

    if (message.action === "record") {

        createVehicleInquiry(
            (message.vin || "")
                .trim()
                .toUpperCase(),

            (message.state || "")
                .trim()
                .toUpperCase()
        ).then(inquiryId => {

            if (!inquiryId) {
                return;
            }

            chrome.tabs.create({
                url:
                    `https://app.yassi.com/record-inquiries/vehicle-records/${inquiryId}`
            });

        });

    }

    if (message.action === "nmvtis") {

        createNmvtisInquiry(
            (message.vin || "")
                .trim()
                .toUpperCase()
        ).then(nmvtisId => {

            if (!nmvtisId) {
                return;
            }

            chrome.tabs.create({
                url:
                    `https://app.yassi.com/record-inquiries/nmvtis-records/${nmvtisId}`
            });

        });

    }

    if (message.action === "vinshot") {

        openVinDecoderOnly(
            (message.vin || "")
                .trim()
                .toUpperCase(),
            {
                active: true,
                waitForResults: true
            }
        )
            .then(result => sendResponse(result || { ok: true }))
            .catch(error => {
                console.error("VIN Decoder failed:", error);
                sendResponse({
                    ok: false,
                    error: error?.message || String(error)
                });
            });

        return true;

    }

    if (message.action === "wamvr") {

        const vin =
            (message.vin || "")
                .trim()
                .toUpperCase();

        const area =
            getExtensionStorageArea();

        area?.set({
            waPendingVin: vin,
            waPendingVinSetAt: Date.now()
        });

        chrome.tabs.create({
            url:
                "https://secure.dol.wa.gov/home/default.aspx?ec=PleaseLogin#2"
        });

    }

    if (message.action === "getWaPendingVin") {

        (async () => {

            const area =
                getExtensionStorageArea();

            if (!area) {
                sendResponse({ vin: "" });
                return;
            }

            try {

                const result =
                    await area.get(
                        ["waPendingVin", "waPendingVinSetAt"]
                    );

                const setAt =
                    result?.waPendingVinSetAt || 0;

                const isFresh =
                    Date.now() - setAt < 15 * 60 * 1000;

                sendResponse({
                    vin: isFresh ? (result?.waPendingVin || "") : ""
                });

            } catch (error) {

                console.error(
                    "Open Review WA pending VIN read failed:",
                    error
                );

                sendResponse({ vin: "" });
            }

        })();

        return true;
    }

    if (message.action === "generateReview") {
        generateReviewFromOpenTabs(message, sender)
            .then(result => sendResponse(result || { ok: true }))
            .catch(error => {
                console.error("Open Review generate failed:", error);
                sendResponse({
                    ok: false,
                    error: error?.message || String(error)
                });
            });

        return true;
    }

    if (message.action === "downloadDebug") {
        downloadDebugFromOpenTabs(message, sender)
            .then(() => sendResponse({ ok: true }))
            .catch(error => {
                console.error("Open Review debug download failed:", error);
                sendResponse({
                    ok: false,
                    error: error?.message || String(error)
                });
            });

        return true;
    }

});

async function openReview(message, sender) {

    const vin =
        normalizeVin(
            message.vin
        );

    const state =
        normalizeState(
            message.state
        );

    const rvClass =
        message.rvClass || "";

    const salesforceUrl =
        message.salesforceUrl || "";

    console.log("VIN:", vin);
    console.log("STATE:", state);
    console.log("RV CLASS:", rvClass);

    let salesforceTab = null;

    if (salesforceUrl) {

        salesforceTab =
            await chrome.tabs.create({
                active: false,
                url: salesforceUrl
            });

    }

    const inquiryId =
        await createVehicleInquiry(
            vin,
            state
        );

    if (!inquiryId) {
        return await handleMvrFullStop({
            message,
            vin,
            state,
            rvClass,
            sourceTabId: sender?.tab?.id || null,
            salesforceTabId: salesforceTab?.id || null,
            yassiTabId: null,
            nmvtisTabId: null
        }, "Unable to create MVR inquiry");
    }

    const yassiTab =
        await chrome.tabs.create({
            active: true,
            url:
                `https://app.yassi.com/record-inquiries/vehicle-records/${inquiryId}`
        });

    const normalizedClass =
        (rvClass || "")
            .toUpperCase()
            .trim();

    const isMotorized =
        normalizedClass.includes("CLASS A") ||
        normalizedClass.includes("CLASS B") ||
        normalizedClass.includes("CLASS C") ||
        normalizedClass.includes("MOTORHOME") ||
        normalizedClass.includes("MOTORIZED");

    let nmvtisTab = null;
    let nmvtisId = null;

    let yassiRecordStatus = "unknown";

    try {

        await activateTabForScraping(
            yassiTab.id,
            1000
        );

        yassiRecordStatus =
            await waitForYassiRecordStatus(
                yassiTab.id,
                vin
            );

        console.log(
            "YASSI RECORD STATUS:",
            yassiRecordStatus
        );

        if (
            yassiRecordStatus === "success"
        ) {

            await downloadPdf(
                inquiryId,
                vin
            );

        } else {

            console.warn(
                "MVR was not successful; stopping review and opening VIN Decoder.",
                yassiRecordStatus
            );

        }

    } catch (err) {

        console.error(
            "YASSI RECORD STATUS CHECK ERROR:",
            err
        );

        yassiRecordStatus = "unknown";

    }

    const reviewContext = {
        message,
        vin,
        state,
        rvClass,
        sourceTabId: sender?.tab?.id || null,
        salesforceTabId: salesforceTab?.id || null,
        yassiTabId: yassiTab?.id || null,
        nmvtisTabId: nmvtisTab?.id || null
    };

    if (yassiRecordStatus !== "success") {
        return await handleMvrFullStop(
            reviewContext,
            describeYassiRecordStatus(yassiRecordStatus)
        );
    }

    if (isMotorized) {

        try {

            nmvtisId =
                await createNmvtisInquiry(
                    vin
                );

            console.log(
                "NMVTIS ID:",
                nmvtisId
            );

            if (nmvtisId) {

                nmvtisTab =
                    await chrome.tabs.create({
                        active: false,
                        url:
                            `https://app.yassi.com/record-inquiries/nmvtis-records/${nmvtisId}`
                    });

                reviewContext.nmvtisTabId =
                    nmvtisTab.id || null;

            }

        } catch (err) {

            console.error(
                "NMVTIS ERROR:",
                err
            );

        }
    }

    return await generateReviewOutput(
        reviewContext
    );
}


async function prepareHappyFoxDraft(message, sender) {

    const sourceTabId =
        sender?.tab?.id || null;

    if (!sourceTabId) {
        throw new Error("HappyFox source tab was not available.");
    }

    const vin =
        normalizeVin(
            message.vin
        );

    const state =
        normalizeState(
            message.state
        );

    const rvClass =
        message.rvClass || "";

    const salesforceUrl =
        message.salesforceUrl || "";

    const openedTabIds = [];

    let salesforceTab = null;
    let yassiTab = null;
    let nmvtisTab = null;
    let pdfInfo = null;

    if (!vin) {
        throw new Error("No VIN found for this HappyFox ticket.");
    }

    if (salesforceUrl) {
        salesforceTab =
            await chrome.tabs.create({
                active: false,
                url: salesforceUrl
            });

        if (salesforceTab?.id) {
            openedTabIds.push(
                salesforceTab.id
            );
        }
    }

    // Yassi has no state code for Washington — it isn't a partial
    // failure, it's a known routing difference. NMVTIS does support WA,
    // so that still runs; Yassi/the PDF step is skipped entirely and the
    // WA DOL portal is opened in its place.
    if (state === "WA") {

        const normalizedClassWa =
            (rvClass || "")
                .toUpperCase()
                .trim();

        const isMotorizedWa =
            normalizedClassWa.includes("CLASS A") ||
            normalizedClassWa.includes("CLASS B") ||
            normalizedClassWa.includes("CLASS C") ||
            normalizedClassWa.includes("MOTORHOME") ||
            normalizedClassWa.includes("MOTORIZED");

        let nmvtisIdWa = null;

        if (isMotorizedWa) {
            try {
                nmvtisIdWa =
                    await createNmvtisInquiry(
                        vin
                    );

                if (nmvtisIdWa) {
                    nmvtisTab =
                        await chrome.tabs.create({
                            active: false,
                            url:
                                `https://app.yassi.com/record-inquiries/nmvtis-records/${nmvtisIdWa}`
                        });

                    if (nmvtisTab?.id) {
                        openedTabIds.push(
                            nmvtisTab.id
                        );
                    }
                }
            } catch (error) {
                console.error(
                    "NMVTIS ERROR (WA routing):",
                    error
                );
            }
        }

        const waStorageAreaForDraft =
            getExtensionStorageArea();

        if (waStorageAreaForDraft) {
            await waStorageAreaForDraft.set({
                waPendingVin: vin || "",
                waPendingVinSetAt: Date.now()
            });
        }

        const waTab =
            await chrome.tabs.create({
                active: false,
                url:
                    "https://secure.dol.wa.gov/home/default.aspx?ec=PleaseLogin#2"
            });

        if (waTab?.id) {
            openedTabIds.push(
                waTab.id
            );
        }

        const waOutput =
            buildWaMvrOutput(
                { vin },
                { nmvtisChecked: isMotorizedWa && !!nmvtisIdWa }
            );

        const waHtml =
            buildHappyFoxPrivateNoteHtml(
                waOutput
            );

        await activateTabForScraping(
            sourceTabId,
            500
        );

        await prepareHappyFoxPrivateNote(
            sourceTabId,
            {
                vin,
                output: waOutput,
                text: `MVR + Comparison Chart\n${waOutput || ""}`,
                html: waHtml,
                attachPdf: false,
                pdfFilename: null
            }
        );

        // Deliberately not calling saveHappyFoxCleanup / auto-closing
        // tabs here — the WA DOL tab and (if opened) the NMVTIS tab
        // both need you to actually look at them before this review is
        // actually complete, unlike the normal flow where everything
        // needed is already captured in the pasted note.

        return {
            ok: true,
            prepared: true,
            vin,
            waRouted: true,
            attachedPdf: false,
            attachmentSkipped: true,
            pdfFilename: null,
            cleanupTabIds: []
        };
    }

    const inquiryId =
        await createVehicleInquiry(
            vin,
            state
        );

    if (!inquiryId) {
        return await handleMvrFullStop(
            {
                message,
                vin,
                state,
                rvClass,
                sourceTabId,
                salesforceTabId: salesforceTab?.id || null,
                yassiTabId: null,
                nmvtisTabId: null
            },
            "Unable to create MVR inquiry"
        );
    }

    yassiTab =
        await chrome.tabs.create({
            active: true,
            url:
                `https://app.yassi.com/record-inquiries/vehicle-records/${inquiryId}`
        });

    if (yassiTab?.id) {
        openedTabIds.push(
            yassiTab.id
        );
    }

    const normalizedClass =
        (rvClass || "")
            .toUpperCase()
            .trim();

    const isMotorized =
        normalizedClass.includes("CLASS A") ||
        normalizedClass.includes("CLASS B") ||
        normalizedClass.includes("CLASS C") ||
        normalizedClass.includes("MOTORHOME") ||
        normalizedClass.includes("MOTORIZED");

    await activateTabForScraping(
        yassiTab.id,
        1000
    );

    const yassiRecordStatus =
        await waitForYassiRecordStatus(
            yassiTab.id,
            vin
        );

    if (yassiRecordStatus !== "success") {
        return await handleMvrFullStop(
            {
                message,
                vin,
                state,
                rvClass,
                sourceTabId,
                salesforceTabId: salesforceTab?.id || null,
                yassiTabId: yassiTab?.id || null,
                nmvtisTabId: null
            },
            describeYassiRecordStatus(yassiRecordStatus)
        );
    }

    pdfInfo =
        await downloadPdf(
            inquiryId,
            vin
        );

    if (
        !pdfInfo?.ok ||
        !pdfInfo.dataUrl ||
        !pdfInfo.filename ||
        !pdfInfo.filename.toUpperCase().includes(vin)
    ) {
        throw new Error(
            `Yassi PDF was not captured with matching VIN filename (${pdfInfo?.filename || "none"}).`
        );
    }

    const reviewContext = {
        message,
        vin,
        state,
        rvClass,
        sourceTabId,
        salesforceTabId: salesforceTab?.id || null,
        yassiTabId: yassiTab?.id || null,
        nmvtisTabId: null
    };

    if (isMotorized) {
        try {
            const nmvtisId =
                await createNmvtisInquiry(
                    vin
                );

            if (nmvtisId) {
                nmvtisTab =
                    await chrome.tabs.create({
                        active: false,
                        url:
                            `https://app.yassi.com/record-inquiries/nmvtis-records/${nmvtisId}`
                    });

                reviewContext.nmvtisTabId =
                    nmvtisTab?.id || null;

                if (nmvtisTab?.id) {
                    openedTabIds.push(
                        nmvtisTab.id
                    );
                }
            }
        } catch (error) {
            console.error(
                "NMVTIS ERROR:",
                error
            );
        }
    }

    const sources =
        await collectReviewSources(
            reviewContext
        );

    const output =
        buildReviewOutput(
            sources
        );

    const html =
        buildHappyFoxPrivateNoteHtml(
            output
        );

    await activateTabForScraping(
        sourceTabId,
        500
    );

    const prepareResult =
        await prepareHappyFoxPrivateNote(
            sourceTabId,
            {
                vin,
                output,
                text: `MVR + Comparison Chart
${output || ""}`,
                html,
                attachPdf: false,
                pdfFilename: pdfInfo.filename
            }
        );

    await saveHappyFoxCleanup(
        sourceTabId,
        {
            vin,
            tabIds: openedTabIds,
            createdAt: Date.now()
        }
    );

    return {
        ok: true,
        prepared: true,
        vin,
        attachedPdf: false,
        attachmentSkipped: true,
        pdfFilename: pdfInfo.filename,
        cleanupTabIds: openedTabIds
    };
}

async function cleanupHappyFoxDraftTabs(sourceTabId, message = {}) {

    if (!sourceTabId) {
        return {
            ok: false,
            error: "No HappyFox tab id supplied for cleanup."
        };
    }

    const pending =
        await getHappyFoxCleanup(
            sourceTabId
        );

    if (!pending) {
        return {
            ok: true,
            closed: 0,
            skipped: true
        };
    }

    const messageVin =
        normalizeVin(
            message.vin || ""
        );

    if (
        messageVin &&
        pending.vin &&
        messageVin !== pending.vin
    ) {
        return {
            ok: false,
            error: "Pending cleanup VIN did not match this ticket. Tabs were left open."
        };
    }

    await deleteHappyFoxCleanup(
        sourceTabId
    );

    const tabIds =
        [...new Set(
            (pending.tabIds || [])
                .filter(id => id && id !== sourceTabId)
        )];

    const removable = [];

    for (const tabId of tabIds) {
        try {
            await chrome.tabs.get(
                tabId
            );
            removable.push(
                tabId
            );
        } catch (error) {
            // Already closed; ignore.
        }
    }

    if (removable.length) {
        await chrome.tabs.remove(
            removable
        );
    }

    return {
        ok: true,
        closed: removable.length
    };
}

async function prepareHappyFoxPrivateNote(tabId, payload) {

    const injection =
        await chrome.scripting.executeScript({
            target: {
                tabId
            },
            func: async notePayload => {

                const sleep = ms =>
                    new Promise(resolve => setTimeout(resolve, ms));

                const normalize = value =>
                    (value || "")
                        .toString()
                        .replace(/\s+/g, " ")
                        .trim()
                        .toLowerCase();

                const isVisible = el => {
                    if (!el) {
                        return false;
                    }

                    const style =
                        window.getComputedStyle(el);

                    const rect =
                        el.getBoundingClientRect();

                    return style.display !== "none" &&
                        style.visibility !== "hidden" &&
                        rect.width > 0 &&
                        rect.height > 0;
                };

                const clickPrivateNote = () => {
                    const candidates =
                        [...document.querySelectorAll(
                            "button,a,[role='tab'],[role='button'],li,span,div"
                        )]
                            .filter(isVisible)
                            .filter(el => {
                                const text =
                                    normalize(
                                        el.innerText ||
                                        el.textContent ||
                                        el.getAttribute("aria-label") ||
                                        el.getAttribute("title") ||
                                        ""
                                    );

                                if (text !== "private note") {
                                    return false;
                                }

                                const role =
                                    normalize(
                                        el.getAttribute("role") || ""
                                    );

                                const tag =
                                    (el.tagName || "").toLowerCase();

                                return role === "tab" ||
                                    role === "button" ||
                                    tag === "button" ||
                                    tag === "a" ||
                                    el.closest("button,a,[role='tab'],[role='button']");
                            });

                    const target =
                        candidates[0]?.closest?.(
                            "button,a,[role='tab'],[role='button']"
                        ) || candidates[0];

                    if (target) {
                        target.click();
                        return true;
                    }

                    return false;
                };

                const findEditorInDocument = doc => {
                    const selectors = [
                        ".fr-element[contenteditable='true']",
                        ".note-editable[contenteditable='true']",
                        ".ql-editor[contenteditable='true']",
                        ".ProseMirror[contenteditable='true']",
                        "[contenteditable='true'][role='textbox']",
                        "[contenteditable='true']",
                        "textarea"
                    ];

                    const candidates = [];

                    for (const selector of selectors) {
                        doc.querySelectorAll(selector)
                            .forEach(el => {
                                if (!isVisible(el)) {
                                    return;
                                }

                                const rect =
                                    el.getBoundingClientRect();

                                if (rect.width < 250 || rect.height < 40) {
                                    return;
                                }

                                const text =
                                    normalize(el.innerText || el.value || "");

                                if (
                                    text.includes("search tickets") ||
                                    text.includes("ticket information")
                                ) {
                                    return;
                                }

                                candidates.push({
                                    el,
                                    area: rect.width * rect.height,
                                    y: rect.top
                                });
                            });
                    }

                    candidates.sort((a, b) =>
                        b.area - a.area || b.y - a.y
                    );

                    return candidates[0]?.el || null;
                };

                const findEditor = () => {
                    let editor =
                        findEditorInDocument(document);

                    if (editor) {
                        return editor;
                    }

                    for (const iframe of document.querySelectorAll("iframe")) {
                        try {
                            const doc =
                                iframe.contentDocument || iframe.contentWindow?.document;

                            if (!doc) {
                                continue;
                            }

                            editor =
                                findEditorInDocument(doc);

                            if (editor) {
                                return editor;
                            }
                        } catch (error) {
                            // Cross-origin iframe; ignore.
                        }
                    }

                    return null;
                };

                const insertHtmlIntoEditor = async (editor, html, text) => {
                    editor.scrollIntoView({
                        block: "center"
                    });

                    editor.focus();

                    const tag =
                        (editor.tagName || "").toLowerCase();

                    if (tag === "textarea" || tag === "input") {
                        editor.value = text;
                        editor.dispatchEvent(new Event("input", { bubbles: true }));
                        editor.dispatchEvent(new Event("change", { bubbles: true }));
                        return "text";
                    }

                    const ownerDocument =
                        editor.ownerDocument || document;

                    const setSelectionInsideEditor = () => {
                        try {
                            const range =
                                ownerDocument.createRange();

                            range.selectNodeContents(
                                editor
                            );
                            range.collapse(
                                false
                            );

                            const selection =
                                ownerDocument.getSelection();

                            selection.removeAllRanges();
                            selection.addRange(
                                range
                            );

                            return true;
                        } catch (error) {
                            return false;
                        }
                    };

                    const hasInsertedContent = () =>
                        normalize(editor.innerText || editor.textContent || "")
                            .includes("mvr + comparison chart");

                    const dispatchPasteLikeUser = async () => {
                        try {
                            editor.innerHTML = "";
                        } catch (error) {
                            // Continue.
                        }

                        editor.focus();
                        setSelectionInsideEditor();

                        try {
                            const dataTransfer =
                                new DataTransfer();

                            dataTransfer.setData(
                                "text/html",
                                html
                            );
                            dataTransfer.setData(
                                "text/plain",
                                text || ""
                            );

                            let pasteEvent = null;

                            try {
                                pasteEvent =
                                    new ClipboardEvent(
                                        "paste",
                                        {
                                            bubbles: true,
                                            cancelable: true,
                                            clipboardData: dataTransfer
                                        }
                                    );
                            } catch (error) {
                                pasteEvent =
                                    new Event(
                                        "paste",
                                        {
                                            bubbles: true,
                                            cancelable: true
                                        }
                                    );
                            }

                            if (!pasteEvent.clipboardData) {
                                Object.defineProperty(
                                    pasteEvent,
                                    "clipboardData",
                                    {
                                        value: dataTransfer
                                    }
                                );
                            }

                            editor.dispatchEvent(
                                pasteEvent
                            );

                            await sleep(
                                350
                            );

                            return hasInsertedContent();
                        } catch (error) {
                            return false;
                        }
                    };

                    if (await dispatchPasteLikeUser()) {
                        editor.dispatchEvent(new Event("input", { bubbles: true }));
                        editor.dispatchEvent(new Event("change", { bubbles: true }));
                        editor.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
                        return "paste";
                    }

                    try {
                        editor.innerHTML = "";
                    } catch (error) {
                        // Continue with execCommand fallback.
                    }

                    setSelectionInsideEditor();

                    let inserted = false;

                    try {
                        inserted =
                            ownerDocument.execCommand(
                                "insertHTML",
                                false,
                                html
                            );
                    } catch (error) {
                        inserted = false;
                    }

                    if (
                        !inserted ||
                        !hasInsertedContent()
                    ) {
                        editor.innerHTML = html;
                    }

                    editor.dispatchEvent(new InputEvent("input", {
                        bubbles: true,
                        inputType: "insertHTML",
                        data: null
                    }));
                    editor.dispatchEvent(new Event("change", { bubbles: true }));
                    editor.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));

                    return "html";
                };

                const dataUrlToFile = (dataUrl, filename) => {
                    const parts =
                        dataUrl.split(",");

                    const meta =
                        parts[0] || "";

                    const b64 =
                        parts[1] || "";

                    const mimeMatch =
                        meta.match(/data:([^;]+);base64/i);

                    const mime =
                        mimeMatch?.[1] || "application/pdf";

                    const binary =
                        atob(b64);

                    const bytes =
                        new Uint8Array(binary.length);

                    for (let i = 0; i < binary.length; i++) {
                        bytes[i] = binary.charCodeAt(i);
                    }

                    return new File(
                        [bytes],
                        filename,
                        {
                            type: mime,
                            lastModified: Date.now()
                        }
                    );
                };

                const clickAttachmentButton = async () => {
                    const candidates =
                        [...document.querySelectorAll(
                            "button,a,[role='button'],span,div"
                        )]
                            .filter(isVisible)
                            .filter(el => {
                                const text = normalize(
                                    el.innerText ||
                                    el.textContent ||
                                    el.getAttribute("aria-label") ||
                                    el.getAttribute("title") ||
                                    ""
                                );

                                return text.includes("attach") ||
                                    text.includes("attachment") ||
                                    text.includes("upload file") ||
                                    text === "paperclip";
                            });

                    const target =
                        candidates[0]?.closest?.("button,a,[role='button']") ||
                        candidates[0];

                    if (target) {
                        target.click();
                        await sleep(500);
                        return true;
                    }

                    return false;
                };

                const findFileInput = () => {
                    const inputs =
                        [...document.querySelectorAll("input[type='file']")]
                            .filter(input => !input.disabled);

                    if (!inputs.length) {
                        return null;
                    }

                    const scored =
                        inputs.map(input => {
                            const accept =
                                normalize(input.getAttribute("accept") || "");

                            const name =
                                normalize(
                                    input.name ||
                                    input.id ||
                                    input.getAttribute("aria-label") ||
                                    input.getAttribute("title") ||
                                    ""
                                );

                            let score = 0;

                            if (accept.includes("pdf")) score += 5;
                            if (accept.includes("application/pdf")) score += 5;
                            if (name.includes("attach") || name.includes("upload") || name.includes("file")) score += 3;
                            if (isVisible(input)) score += 1;

                            return {
                                input,
                                score
                            };
                        })
                        .sort((a, b) => b.score - a.score);

                    return scored[0]?.input || null;
                };

                const getAttachmentProcessingState = filename => {
                    const target =
                        normalize(filename || "");

                    const text =
                        normalize(document.body?.innerText || document.body?.textContent || "");

                    const filenamePresent =
                        target && text.includes(target);

                    const processingText =
                        text.includes("processing - please wait") ||
                        text.includes("processing please wait") ||
                        text.includes("processing") && text.includes("please wait");

                    const visibleProgress =
                        [...document.querySelectorAll("[role='progressbar'], progress, .progress, [class*='progress'], [class*='upload']")]
                            .some(el => {
                                if (!isVisible(el)) {
                                    return false;
                                }

                                const elText =
                                    normalize(el.innerText || el.textContent || el.getAttribute("aria-label") || "");

                                return !elText ||
                                    elText.includes("processing") ||
                                    elText.includes("upload") ||
                                    elText.includes("wait");
                            });

                    return {
                        filenamePresent,
                        processing: processingText || visibleProgress
                    };
                };

                const waitForAttachmentReady = async filename => {
                    const startedAt = Date.now();
                    let sawProcessing = false;

                    while (Date.now() - startedAt < 30000) {
                        await sleep(500);

                        const state =
                            getAttachmentProcessingState(filename);

                        if (state.processing) {
                            sawProcessing = true;
                            continue;
                        }

                        if (state.filenamePresent || sawProcessing) {
                            return {
                                ready: true,
                                sawProcessing,
                                filenamePresent: state.filenamePresent
                            };
                        }

                        if (Date.now() - startedAt > 2500) {
                            return {
                                ready: true,
                                sawProcessing,
                                filenamePresent: false,
                                assumedReady: true
                            };
                        }
                    }

                    return {
                        ready: false,
                        sawProcessing,
                        timedOut: true
                    };
                };

                const attachFile = async () => {
                    const vin =
                        (notePayload.vin || "").toString().trim().toUpperCase();

                    const filename =
                        (notePayload.pdfFilename || "").toString();

                    if (!vin || !filename.toUpperCase().includes(vin)) {
                        throw new Error(
                            `PDF filename does not match VIN (${filename || "none"} / ${vin || "none"}).`
                        );
                    }

                    if (!/\.pdf$/i.test(filename)) {
                        throw new Error(
                            `PDF filename is not a PDF (${filename}).`
                        );
                    }

                    let input =
                        findFileInput();

                    if (!input) {
                        await clickAttachmentButton();
                        input = findFileInput();
                    }

                    if (!input) {
                        throw new Error(
                            "Could not find HappyFox attachment file input."
                        );
                    }

                    const file =
                        dataUrlToFile(
                            notePayload.pdfDataUrl,
                            filename
                        );

                    const dataTransfer =
                        new DataTransfer();

                    dataTransfer.items.add(
                        file
                    );

                    input.files =
                        dataTransfer.files;

                    input.dispatchEvent(new Event("input", { bubbles: true }));
                    input.dispatchEvent(new Event("change", { bubbles: true }));

                    return {
                        filename,
                        size: file.size
                    };
                };

                window.scrollTo(0, document.body.scrollHeight);

                clickPrivateNote();
                await sleep(600);

                const editor =
                    findEditor();

                if (!editor) {
                    throw new Error(
                        "Could not find HappyFox private note editor."
                    );
                }

                const insertMode =
                    await insertHtmlIntoEditor(
                        editor,
                        notePayload.html,
                        notePayload.text || notePayload.output
                    );

                await sleep(500);

                if (notePayload.attachPdf === false) {
                    return {
                        ok: true,
                        insertMode,
                        attachmentAttached: false,
                        attachmentSkipped: true
                    };
                }

                let attachment = null;
                let attachmentAttached = false;
                let attachmentError = "";

                let attachmentReady = null;

                try {
                    attachment =
                        await attachFile();

                    attachmentReady =
                        await waitForAttachmentReady(
                            attachment?.filename || notePayload.pdfFilename
                        );

                    attachmentAttached = true;
                } catch (error) {
                    attachmentError =
                        error?.message || String(error);
                }

                if (!attachmentAttached) {
                    throw new Error(
                        attachmentError || "MVR PDF attachment failed."
                    );
                }

                return {
                    ok: true,
                    insertMode,
                    attachmentAttached,
                    attachment,
                    attachmentReady,
                    attachmentError
                };
            },
            args: [
                payload
            ]
        });

    const result =
        injection?.[0]?.result;

    if (!result?.ok) {
        throw new Error(
            result?.error || "HappyFox private note preparation failed."
        );
    }

    return result;
}

async function generateReviewFromOpenTabs(message, sender) {

    const vin =
        normalizeVin(
            message.vin
        );

    const state =
        normalizeState(
            message.state
        );

    const rvClass =
        message.rvClass || "";

    const salesforceTab =
        await findExistingSalesforceTab(
            message.salesforceUrl
        );

    const yassiTab =
        await findExistingYassiVehicleTab(
            vin
        );

    const nmvtisTab =
        await findExistingNmvtisTab(
            vin
        );

    return await generateReviewOutput({
        message,
        vin,
        state,
        rvClass,
        sourceTabId: sender?.tab?.id || null,
        salesforceTabId: salesforceTab?.id || null,
        yassiTabId: yassiTab?.id || null,
        nmvtisTabId: nmvtisTab?.id || null
    });
}

async function downloadDebugFromOpenTabs(message, sender) {

    const vin =
        normalizeVin(
            message.vin
        );

    const state =
        normalizeState(
            message.state
        );

    const rvClass =
        message.rvClass || "";

    const salesforceTab =
        await findExistingSalesforceTab(
            message.salesforceUrl
        );

    const yassiTab =
        await findExistingYassiVehicleTab(
            vin
        );

    const nmvtisTab =
        await findExistingNmvtisTab(
            vin
        );

    const context = {
        message,
        vin,
        state,
        rvClass,
        sourceTabId: sender?.tab?.id || null,
        salesforceTabId: salesforceTab?.id || null,
        yassiTabId: yassiTab?.id || null,
        nmvtisTabId: nmvtisTab?.id || null
    };

    const sources =
        await collectReviewSources(
            context
        );

    const output =
        buildReviewOutput(
            sources
        );

    const debugPayload =
        buildDebugPayload(
            context,
            sources,
            output
        );

    let vinDecoderResult = null;
    const shouldOpenVinDecoder =
        !sources?.mvr?.reliabilityComplete;

    await openReviewResultTab(
        output,
        vin
    );

    if (shouldOpenVinDecoder) {
        vinDecoderResult =
            await openVinDecoderOnly(
                vin,
                {
                    active: true
                }
            );
    }

    await downloadTextFile(
        `OPEN-REVIEW-${vin || "UNKNOWN"}.txt`,
        output
    );

    await downloadTextFile(
        `OPEN-REVIEW-DEBUG-${vin || "UNKNOWN"}.txt`,
        JSON.stringify(debugPayload, null, 2)
    );

    return {
        ok: true,
        openedResult: true,
        downloadedResult: true,
        downloadedDebug: true,
        vinDecoderResult
    };
}

async function generateReviewOutput(context) {

    const sources =
        await collectReviewSources(
            context
        );

    const output =
        buildReviewOutput(
            sources
        );

    const mvrStopped =
        !sources?.mvr?.reliabilityComplete;

    const copyResult =
        await copyReviewOutputToClipboard(
            output,
            context
        );

    let vinDecoderOpened = false;
    let vinDecoderResult = null;

    if (mvrStopped) {
        // Open the decoder after the clipboard copy so failure cases stay on
        // the VIN Decoder tab. Successful Open Review speed/path is unchanged.
        vinDecoderResult =
            await openVinDecoderOnly(
                context.vin,
                {
                    active: true
                }
            );

        vinDecoderOpened = true;
    }

    return {
        ok: true,
        copied: true,
        vinDecoderOpened,
        mvrStopped,
        vinDecoderResult,
        clipboard: copyResult
    };
}

function buildDebugPayload(context, sources, output) {

    return {
        generatedAt: new Date().toISOString(),
        vin: context.vin,
        tabIds: {
            source: context.sourceTabId,
            salesforce: context.salesforceTabId,
            yassi: context.yassiTabId,
            nmvtis: context.nmvtisTabId
        },
        parsed: {
            happyfox: sources.happyfox,
            salesforce: sources.salesforce,
            mvr: sources.mvr,
            nmvtis: sources.nmvtis
        },
        output,
        raw: sources.raw
    };
}



function buildWaMvrOutput(context = {}, info = {}) {

    const vin =
        context.vin || "UNKNOWN";

    return [
        "MVR — WASHINGTON (routed, not a failure)",
        "",
        `VIN: ${vin}`,
        "Yassi does not support WA state MVR lookups — this is expected, not an error.",
        info.nmvtisChecked
            ? "NMVTIS record opened for reference — review title/brand history there."
            : "NMVTIS was not checked (vehicle not flagged as motorized).",
        "WA DOL License Express opened — log in and use the Fill & Search box on the VIN search page. Verify ownership/lien status manually.",
        "",
        "Do not approve until ownership/lien status has been manually confirmed via WA DOL License Express."
    ].join("\n");
}

async function handleMvrFullStop(context, reason) {

    const output =
        buildMvrFullStopOutput(
            context,
            {
                failureReason: reason,
                vin: context.vin,
                state: context.state,
                rawText: "",
                reliabilityComplete: false
            }
        );

    const copyResult =
        await copyReviewOutputToClipboard(
            output,
            context
        );

    // Open the decoder last so the failure path leaves the processor on the
    // VIN Decoder tab instead of immediately jumping back to HappyFox for the
    // clipboard copy. This only runs for MVR failure/full-stop cases.
    const vinDecoderResult =
        await openVinDecoderOnly(
            context.vin,
            {
                active: true
            }
        );

    return {
        ok: true,
        copied: true,
        mvrStopped: true,
        vinDecoderOpened: true,
        vinDecoderResult,
        clipboard: copyResult
    };
}

function buildMvrFullStopOutput(context = {}, mvr = {}) {

    const vin =
        context.vin ||
        mvr.vin ||
        "UNKNOWN";

    const reason =
        mvr.failureReason ||
        describeMvrFailureFromText(
            mvr.rawText || ""
        ) ||
        "MVR ownership/lien data could not be fully extracted";

    return [
        "MVR FAILED — FULL STOP",
        "",
        `VIN: ${vin}`,
        `Reason: ${reason}`,
        "",
        "VIN Decoder opened for reference.",
        "Do not approve this appointment until the MVR is available and ownership/lien status can be verified."
    ].join("\n");
}

function describeYassiRecordStatus(status) {

    if (status === "no_record") {
        return "No MVR record found";
    }

    if (status === "service_unavailable") {
        return "State DMV service unavailable / maintenance message shown";
    }

    if (status === "unknown") {
        return "MVR did not load to a readable successful report before timeout";
    }

    return "MVR did not return a successful readable report";
}

function describeMvrFailureFromText(text) {

    const upper =
        normalizeText(
            text || ""
        );

    if (!upper) {
        return "MVR text was not captured";
    }

    if (detectMvrServiceUnavailableText(upper)) {
        return "State DMV service unavailable / maintenance message shown";
    }

    if (detectNoRecordText(upper)) {
        return "No MVR record found";
    }

    if (upper.includes("VEHICLE INTERESTS")) {
        return "Vehicle Interests loaded, but ownership/lien extraction was incomplete";
    }

    return "MVR did not load to a readable successful report";
}

async function openVinDecoderTab(vin, active = true) {

    vin = normalizeVin(vin);

    if (!vin) {
        return null;
    }

    return await chrome.tabs.create({
        active,
        url: buildVinDecoderUrl(vin)
    });
}

function buildVinDecoderUrl(vin) {

    return `https://vpic.nhtsa.dot.gov/decoder/VinDecoder?VIN=${encodeURIComponent(normalizeVin(vin))}&ModelYear=`;
}

function buildClipboardHtml(output) {

    const lines =
        (output || "")
            .toString()
            .split(/\r?\n/);

    const tableStart =
        lines.findIndex(line =>
            line
                .trim()
                .startsWith(
                    "| Field | HappyFox | Salesforce | MVR / Manual | NVITAS | Status | Notes |"
                )
        );

    if (tableStart === -1) {
        return `<div style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:14px;line-height:1.4;">${escapeHtml(output)}</div>`;
    }

    const tableLines = [];

    for (
        let i = tableStart;
        i < lines.length;
        i++
    ) {

        const line =
            lines[i].trim();

        if (!line.startsWith("|")) {
            break;
        }

        tableLines.push(line);

    }

    const headerCells =
        splitMarkdownTableRow(
            tableLines[0]
        );

    const bodyRows =
        tableLines
            .slice(2)
            .map(splitMarkdownTableRow)
            .filter(cells =>
                cells.length >= 7
            );

    const docsStart =
        lines.findIndex(line =>
            line.trim() ===
            "DOCUMENTS TO SELECT FOR CX"
        );

    const docLines = [];
    const deficiencyMethodLines = [];
    const notes = [];

    if (docsStart !== -1) {

        let inDeficiencyMethodSection = false;

        for (
            let i = docsStart + 1;
            i < lines.length;
            i++
        ) {

            const line =
                lines[i].trim();

            if (!line) {
                continue;
            }

            if (line === "SELECTED DEFICIENCY METHOD") {
                inDeficiencyMethodSection = true;
                continue;
            }

            if (
                line.startsWith("(") &&
                line.endsWith(")")
            ) {

                notes.push(
                    line.slice(1, -1)
                );

            } else if (inDeficiencyMethodSection) {

                deficiencyMethodLines.push(line);

            } else {

                docLines.push(
                    line.replace(/^[✅⚠️🚩]\s*/, "")
                );

            }
        }
    }

    const textColorStyle =
        "color:#1f2328 !important;-webkit-text-fill-color:#1f2328 !important;";

    const mutedTextColorStyle =
        "color:#57606a !important;-webkit-text-fill-color:#57606a !important;";

    const orangeTextColorStyle =
        "color:#f28c28 !important;-webkit-text-fill-color:#f28c28 !important;";

    const visibleText = value =>
        escapeHtml(value);

    const thStyle =
        `border:1px solid #d0d7de;padding:8px 10px;background:#f6f8fa;font-weight:600;text-align:left;vertical-align:top;font-family:Arial,sans-serif;font-size:13px;line-height:1.35;${textColorStyle}`;

    const tdBaseStyle =
        `border:1px solid #d0d7de;padding:8px 10px;vertical-align:top;font-family:Arial,sans-serif;font-size:13px;line-height:1.35;${textColorStyle}`;

    const statusStyle =
        `${tdBaseStyle}font-weight:700;text-align:center;white-space:nowrap;`;

    const headerHtml =
        headerCells
            .map(cell =>
                `<th style="${thStyle}">${visibleText(cell)}</th>`
            )
            .join("");

    const rowsHtml =
        bodyRows
            .map(cells => {

                const status =
                    cells[5] || "";

                const background =
                    status.includes("🚩")
                        ? "background:#fff5f5;"
                        : status.includes("⚠️")
                            ? "background:#fffbea;"
                            : "background:#ffffff;";

                return `<tr>${cells.map((cell, index) =>
                    `<td style="${index === 5 ? statusStyle : tdBaseStyle}${background}">${visibleText(cell)}</td>`
                ).join("")}</tr>`;

            })
            .join("");

    const docsHtml =
        (docLines.length || deficiencyMethodLines.length)
            ? `<div style="margin-top:22px;font-family:Arial,sans-serif;color:#111111 !important;background-color:#ffffff !important;font-size:13px;line-height:1.35;">
${docLines.length ? `<div style="font-size:16px;margin:0 0 10px;font-family:Arial,sans-serif;color:#111111 !important;background-color:#ffffff !important;font-weight:400;">${visibleText("DOCUMENTS TO SELECT FOR CX")}</div>
${docLines.map(doc =>
    `<div style="margin:4px 0 4px 18px;font-family:Arial,sans-serif;color:#111111 !important;background-color:#ffffff !important;">✅&nbsp;${visibleText(doc)}</div>`
).join("")}` : ""}
${deficiencyMethodLines.length ? `<div style="font-size:16px;margin:18px 0 10px;font-family:Arial,sans-serif;color:#111111 !important;background-color:#ffffff !important;font-weight:400;">${visibleText("SELECTED DEFICIENCY METHOD")}</div>
${deficiencyMethodLines.map(method =>
    `<div style="margin:4px 0 4px 18px;font-family:Arial,sans-serif;color:#111111 !important;background-color:#ffffff !important;">${visibleText(method)}</div>`
).join("")}` : ""}
${notes.map(note =>
    `<div style="margin-top:12px;color:#333333 !important;background-color:#ffffff !important;font-family:Arial,sans-serif;">(${visibleText(note)})</div>`
).join("")}
</div>`
            : "";

    return `<div style="font-family:Arial,sans-serif;color:#1f2328 !important;background:#ffffff !important;">
<table style="border-collapse:collapse;width:100%;min-width:1120px;background:#ffffff !important;font-family:Arial,sans-serif;color:#1f2328 !important;">
<thead><tr>${headerHtml}</tr></thead>
<tbody>${rowsHtml}</tbody>
</table>
${docsHtml}
</div>`;
}


function buildHappyFoxNativePasteHtml(output) {

    const lines =
        (output || "")
            .toString()
            .split(/\r?\n/);

    const tableStart =
        lines.findIndex(line =>
            line
                .trim()
                .startsWith(
                    "| Field | HappyFox | Salesforce | MVR / Manual | NVITAS | Status | Notes |"
                )
        );

    if (tableStart === -1) {
        return `<div><p style="margin: 0px;">${escapeHtml(output)}</p></div>`;
    }

    const tableLines = [];

    for (
        let i = tableStart;
        i < lines.length;
        i++
    ) {

        const line =
            lines[i].trim();

        if (!line.startsWith("|")) {
            break;
        }

        tableLines.push(line);

    }

    const headerCells =
        splitMarkdownTableRow(
            tableLines[0]
        );

    const bodyRows =
        tableLines
            .slice(2)
            .map(splitMarkdownTableRow)
            .filter(cells =>
                cells.length >= 7
            );

    const p = value =>
        `<p style="margin: 0px;">${escapeHtml(value)}</p>`;

    const headerHtml =
        headerCells
            .map(cell =>
                `<th>${p(cell)}</th>`
            )
            .join("");

    const rowsHtml =
        bodyRows
            .map(cells =>
                `<tr>${cells.map(cell => `<td>${p(cell)}</td>`).join("")}</tr>`
            )
            .join("");

    const docsStart =
        lines.findIndex(line =>
            line.trim() ===
            "DOCUMENTS TO SELECT FOR CX"
        );

    const docLines = [];
    const deficiencyMethodLines = [];
    const notes = [];

    if (docsStart !== -1) {

        let inDeficiencyMethodSection = false;

        for (
            let i = docsStart + 1;
            i < lines.length;
            i++
        ) {

            const line =
                lines[i].trim();

            if (!line) {
                continue;
            }

            if (line === "SELECTED DEFICIENCY METHOD") {
                inDeficiencyMethodSection = true;
                continue;
            }

            if (
                line.startsWith("(") &&
                line.endsWith(")")
            ) {

                notes.push(
                    line.slice(1, -1)
                );

            } else if (inDeficiencyMethodSection) {

                deficiencyMethodLines.push(line);

            } else {

                docLines.push(
                    line.replace(/^[✅⚠️🚩]\s*/, "")
                );

            }
        }
    }

    const docsHtml =
        (docLines.length || deficiencyMethodLines.length || notes.length)
            ? `<div>${docLines.length ? `<div>${p("DOCUMENTS TO SELECT FOR CX")}</div>${docLines.map(doc => `<div>${p(`✅\u00a0${doc}`)}</div>`).join("")}` : ""}${deficiencyMethodLines.length ? `<div>${p("SELECTED DEFICIENCY METHOD")}</div>${deficiencyMethodLines.map(method => `<div>${p(method)}</div>`).join("")}` : ""}${notes.map(note => `<div>${p(`(${note})`)}</div>`).join("")}</div>`
            : "";

    // Match HappyFox's own pasted-table structure: plain table tags with only
    // margin-reset paragraphs inside cells. This lets HappyFox apply its normal
    // posted-note theme instead of preserving our old white cell backgrounds.
    return `<div><div><p style="margin: 0px;"><strong><span style="font-size: 16px; color: #f28c28;">MVR + Comparison Chart</span></strong></p></div><div><table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>${docsHtml}</div></div>`;
}


function makeHappyFoxEditorFriendlyHtml(html) {

    // Do not strip the table cell backgrounds. HappyFox dark-mode rendering
    // applies its own dark cell styles after posting unless the cells keep
    // explicit backgrounds/colors. Only remove the big wrapper backgrounds
    // so the note does not become one giant white block.
    let cleaned =
        (html || "")
            .toString()
            .replace(/(<div style="[^"]*?)\s*background(?:-color)?:\s*#(?:fff|ffffff)\s*!important;?/gi, "$1")
            .replace(/(<table style="[^"]*?)\s*background:\s*#(?:fff|ffffff)\s*!important;?/gi, "$1")
            .replace(/(<div style="[^"]*?)\s*color:\s*#(?:111111|1f2328|333333|57606a)\s*!important;?/gi, "$1")
            .replace(/(<div style="[^"]*?)\s*color:\s*#(?:111111|1f2328|333333|57606a);?/gi, "$1")
            .replace(/(<div style="[^"]*?)\s*-webkit-text-fill-color:\s*#[0-9a-f]{6}\s*!important;?/gi, "$1");

    cleaned =
        cleaned
            .replace(/<th style="/g, '<th style="color:#111111;-webkit-text-fill-color:#111111;')
            .replace(/<td style="/g, '<td style="color:#111111;-webkit-text-fill-color:#111111;')
            .replace(/background:#f6f8fa;/g, 'background:#f6f8fa;color:#111111;-webkit-text-fill-color:#111111;')
            .replace(/background:#fff5f5;/g, 'background:#fff5f5;color:#111111;-webkit-text-fill-color:#111111;')
            .replace(/background:#fffbea;/g, 'background:#fffbea;color:#111111;-webkit-text-fill-color:#111111;')
            .replace(/background:#ffffff;/g, 'background:#ffffff;color:#111111;-webkit-text-fill-color:#111111;');

    return cleaned;
}

function buildHappyFoxPrivateNoteHtml(output) {

    return buildHappyFoxNativePasteHtml(
        output || ""
    );
}

async function copyReviewOutputToClipboard(output, context) {

    const targetTabId =
        context.sourceTabId ||
        context.salesforceTabId ||
        context.yassiTabId ||
        context.nmvtisTabId;

    if (!targetTabId) {
        throw new Error("No accessible tab available for clipboard copy.");
    }

    await activateTabForScraping(
        targetTabId,
        250
    );

    const payload = {
        text: output || "",
        html: buildClipboardHtml(output || "")
    };

    const injection =
        await chrome.scripting.executeScript({
            target: {
                tabId: targetTabId
            },
            func: async clipboardPayload => {
                const text =
                    clipboardPayload?.text || "";

                const html =
                    clipboardPayload?.html || "";

                const copyHtmlBySelection = () => {
                    if (!html) {
                        return false;
                    }

                    const container =
                        document.createElement("div");

                    container.setAttribute(
                        "contenteditable",
                        "true"
                    );

                    container.style.position = "fixed";
                    container.style.left = "-9999px";
                    container.style.top = "0";
                    container.style.width = "1200px";
                    container.innerHTML = html;

                    document.body.appendChild(
                        container
                    );

                    const selection =
                        window.getSelection();

                    const range =
                        document.createRange();

                    range.selectNodeContents(
                        container
                    );

                    selection.removeAllRanges();
                    selection.addRange(range);

                    let copied = false;

                    try {
                        copied = document.execCommand("copy");
                    } finally {
                        selection.removeAllRanges();
                        container.remove();
                    }

                    return copied;
                };

                try {
                    if (
                        html &&
                        navigator.clipboard?.write &&
                        window.ClipboardItem
                    ) {

                        await navigator.clipboard.write([
                            new ClipboardItem({
                                "text/html": new Blob(
                                    [html],
                                    { type: "text/html" }
                                ),
                                "text/plain": new Blob(
                                    [text],
                                    { type: "text/plain" }
                                )
                            })
                        ]);

                        return {
                            ok: true,
                            method: "navigator.clipboard.write/html"
                        };
                    }
                } catch (richClipboardError) {
                    // Fall through to selection-based rich copy.
                }

                try {
                    if (copyHtmlBySelection()) {
                        return {
                            ok: true,
                            method: "execCommand/html"
                        };
                    }
                } catch (selectionError) {
                    // Fall through to plain text copy.
                }

                try {
                    await navigator.clipboard.writeText(text);

                    return {
                        ok: true,
                        method: "navigator.clipboard.writeText"
                    };
                } catch (clipboardError) {
                    const textarea =
                        document.createElement("textarea");

                    textarea.value = text;
                    textarea.setAttribute("readonly", "");
                    textarea.style.position = "fixed";
                    textarea.style.left = "-9999px";
                    textarea.style.top = "0";

                    document.body.appendChild(
                        textarea
                    );

                    textarea.focus();
                    textarea.select();

                    let copied = false;

                    try {
                        copied = document.execCommand("copy");
                    } finally {
                        textarea.remove();
                    }

                    if (!copied) {
                        throw clipboardError;
                    }

                    return {
                        ok: true,
                        method: "execCommand/plain"
                    };
                }
            },
            args: [
                payload
            ]
        });

    const result =
        injection?.[0]?.result;

    if (!result?.ok) {
        throw new Error("Clipboard copy did not complete.");
    }

    return result;
}

async function collectReviewSources(context) {

    const happyfox =
        parseHappyFox(
            context.message?.happyfoxFields || {},
            context
        );

    let salesforceText = "";
    let salesforceData = {
        text: "",
        fields: []
    };
    let mvrText = "";
    let mvrData = {
        text: "",
        structured: {}
    };
    let parsedMvr = null;
    let nmvtisText = "";

    if (context.yassiTabId) {

        await activateTabForScraping(
            context.yassiTabId,
            1000
        );

        mvrData =
            await scrapeMvrStructured(
                context.yassiTabId,
                45000,
                context.vin
            );

        mvrText =
            mvrData.text || "";

    }

    parsedMvr =
        parseMvr(
            mvrData?.text ? mvrData : mvrText,
            context
        );

    if (!parsedMvr.reliabilityComplete) {
        return {
            context,
            happyfox,
            salesforce:
                parseSalesforce(
                    "",
                    context
                ),
            mvr: parsedMvr,
            nmvtis:
                parseNmvtis(
                    "",
                    context
                ),
            raw: {
                salesforceText,
                salesforceFields: salesforceData?.fields || [],
                mvrText,
                mvrStructured: mvrData?.structured || {},
                nmvtisText
            }
        };
    }

    if (context.nmvtisTabId) {

        await activateTabForScraping(
            context.nmvtisTabId,
            1000
        );

        nmvtisText =
            await scrapeNmvtisReportText(
                context.nmvtisTabId,
                45000,
                context.vin
            );

    }

    if (context.salesforceTabId) {

        // Salesforce can still need focus to hydrate fields, but most records are
        // ready much sooner than the old fixed waits allowed. Try a fast focused
        // scrape first, then fall back to slower retries only when required.
        await activateTabForScraping(
            context.salesforceTabId,
            1200
        );

        salesforceData =
            await scrapeSalesforceFieldMap(
                context.salesforceTabId,
                {
                    keepActive: true,
                    warmupMs: 650,
                    maxPasses: 2,
                    scrollDelayMs: 140,
                    clickDelayMs: 80,
                    detailsDelayMs: 450,
                    sectionDelayMs: 120,
                    stepRatio: 0.9
                }
            );

        salesforceText =
            salesforceData.text || "";

        for (let attempt = 0; attempt < 4 && !isSalesforceDataReady(salesforceData); attempt++) {

            const slowFallback = attempt >= 2;

            await delay(slowFallback ? 3000 : 1200);

            await activateTabForScraping(
                context.salesforceTabId,
                slowFallback ? 2500 : 900
            );

            const retryData =
                await scrapeSalesforceFieldMap(
                    context.salesforceTabId,
                    {
                        keepActive: true,
                        warmupMs: slowFallback ? 1600 : 650,
                        maxPasses: slowFallback ? 4 : 2,
                        scrollDelayMs: slowFallback ? 260 : 140,
                        clickDelayMs: slowFallback ? 120 : 80,
                        detailsDelayMs: slowFallback ? 850 : 450,
                        sectionDelayMs: slowFallback ? 220 : 120,
                        stepRatio: slowFallback ? 0.65 : 0.9
                    }
                );

            if (
                (retryData?.fields?.length || 0) >
                (salesforceData?.fields?.length || 0)
            ) {
                salesforceData = retryData;
            }

            if (
                (retryData?.text || "").length >
                (salesforceText || "").length
            ) {
                salesforceText = retryData.text || "";
            }

            if (isSalesforceDataReady(retryData)) {
                salesforceData = retryData;
                salesforceText = retryData.text || "";
                break;
            }
        }

    }

    return {
        context,
        happyfox,
        salesforce:
            parseSalesforce(
                salesforceData?.fields?.length
                    ? salesforceData
                    : salesforceText,
                context
            ),
        mvr:
            parsedMvr ||
            parseMvr(
                mvrData?.text ? mvrData : mvrText,
                context
            ),
        nmvtis:
            parseNmvtis(
                nmvtisText,
                context
            ),
        raw: {
            salesforceText,
            salesforceFields: salesforceData?.fields || [],
            mvrText,
            mvrStructured: mvrData?.structured || {},
            nmvtisText
        }
    };
}

function isSalesforceTextReady(text) {

    const upper =
        normalizeText(text || "");

    if (!upper) {
        return false;
    }

    const hasVehicleDetails =
        upper.includes("MODEL YEAR") ||
        upper.includes("MAKE NAME") ||
        upper.includes("UNIT INFO") ||
        upper.includes("RV DETAILS");

    const hasTrueValues =
        upper.includes("TRUE VALUES") ||
        upper.includes("WEB PURCHASE RANGE EXPIRATION") ||
        upper.includes("TRUE PURCHASE AMOUNT") ||
        upper.includes("TRUE CONSIGNMENT AMOUNT");

    const hasLocation =
        upper.includes("LOCATION ACCOUNT") ||
        upper.includes("RVSALES") ||
        upper.includes("RV SALES");

    return hasVehicleDetails &&
        (hasTrueValues || hasLocation);
}



function isSalesforceDataReady(data) {

    const fields =
        data?.fields || [];

    const apiNames =
        new Set(
            fields.map(field =>
                field.fieldApiName
            )
        );

    const hasVehicleDetails =
        apiNames.has("Class__c") ||
        apiNames.has("Model_Year__c") ||
        apiNames.has("Make_Name__c") ||
        apiNames.has("Model_Name__c") ||
        apiNames.has("Trim_Name__c");

    const hasValues =
        apiNames.has("Consignment_Value__c") ||
        apiNames.has("Buy_Outright_Value__c") ||
        apiNames.has("Expiration_Date__c") ||
        apiNames.has("Web_Purchase_Range_Expiration__c") ||
        apiNames.has("Trade_Sell_Offer__c");

    const hasLocation =
        apiNames.has("Location_Account__c");

    // Do not treat Salesforce body text alone as "ready" here.
    // Lightning can show section headers like "Unit Info" and "True Values"
    // before the actual record fields are rendered. That caused false-positive
    // readiness and blank Salesforce rows unless the user manually focused the tab.
    return hasVehicleDetails &&
        (hasValues || hasLocation);
}

function buildVehicleRequest(
    vin,
    state
) {

    const request = {
        vin,
        note: "",
        dppaExemption: 3,
        inquiryAccountId:
            INQUIRY_ACCOUNT_ID,
        batchName: "",
        referenceIdentifier: ""
    };

    if (state === "CA") {

        request.plate = "";
        request.purpose = 6;
        request.fileCode = 0;

    }

    return request;
}

async function createVehicleInquiry(
    vin,
    state
) {

    vin = normalizeVin(vin);
    state = normalizeState(state);

    const requestState =
        STATE_MAP[state];

    if (!requestState) {

        console.error(
            `Unsupported state: ${state}`
        );

        return null;
    }

    const payload = {

        inquiryAccountId:
            INQUIRY_ACCOUNT_ID,

        vehicleRequests: [
            buildVehicleRequest(
                vin,
                state
            )
        ],

        requestState,
        batchName: "",
        vehicleRequestType: 1
    };

    const response =
        await fetch(
            "https://app.yassi.com/api/inquiries/create",
            {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body:
                    JSON.stringify(
                        payload
                    )
            }
        );

    const data =
        await response.json();

    console.log(
        "YASSI RESPONSE:",
        data
    );

    return data
        ?.inquiryTransactionIdList?.[0];
}

async function createNmvtisInquiry(
    vin
) {

    vin = normalizeVin(vin);

    const payload = {

        inquiryAccountId:
            INQUIRY_ACCOUNT_ID,

        vehicleRequests: [
            {
                vin,
                note: "",
                inquiryAccountId:
                    INQUIRY_ACCOUNT_ID,
                batchName: "",
                referenceIdentifier: ""
            }
        ],

        requestState: 28,
        batchName: "",
        vehicleRequestType: null
    };

    const response =
        await fetch(
            "https://app.yassi.com/api/inquiries/create",
            {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body:
                    JSON.stringify(
                        payload
                    )
            }
        );

    const data =
        await response.json();

    console.log(
        "NMVTIS RESPONSE:",
        data
    );

    return data
        ?.inquiryTransactionIdList?.[0];
}

//
// REVIEW PARSING
//

function parseHappyFox(fields, context) {

    const get = labels =>
        getFirstValue(
            fields,
            labels
        );

    const vin =
        normalizeVin(
            context.vin ||
            get([
                "VIN (SF)",
                "VIN",
                "Vehicle VIN"
            ])
        );

    const titleState =
        normalizeState(
            context.state ||
            get([
                "Current Title State",
                "Title State",
                "State"
            ])
        );

    const rvClass =
        context.rvClass ||
        get([
            "SF RV Class",
            "RV Class",
            "Class"
        ]) ||
        "";

    const acquisitionType =
        get([
            "Acquisition Type",
            "Acquisition",
            "C / P",
            "C/P",
            "Type"
        ]) || "";

    const primaryOwnerNamesRaw =
        getFirstExactValue(
            fields,
            [
                "Full legal owner name(s)",
                "Full Legal Owner Name(s)",
                "Legal Owner Name(s)",
                "Owner Name(s)",
                "Owner Legal First and Last Name",
                "Owner",
                "Customer Name",
                "Seller Name"
            ]
        ) ||
        get([
            "Full legal owner name(s)",
            "Full Legal Owner Name(s)",
            "Legal Owner Name(s)",
            "Owner Name(s)",
            "Owner Legal First and Last Name",
            "Owner",
            "Customer Name",
            "Seller Name"
        ]) || "";

    // Do not fuzzy-match co-owner labels.
    // Fuzzy matching made a one-owner ticket duplicate the primary owner because
    // "Co Owner Legal First and Last Name" contains "Owner Legal First and Last Name".
    const coOwnerNamesRaw =
        getFirstExactValue(
            fields,
            [
                "Co Owner Legal First and Last Name",
                "Co-Owner Legal First and Last Name",
                "Co Owner Legal Name",
                "Co-Owner Legal Name",
                "Co Owner Full Legal Name",
                "Co-Owner Full Legal Name",
                "Co Owner Name",
                "Co-Owner Name",
                "Secondary Owner Legal First and Last Name",
                "Secondary Owner Name"
            ]
        ) || "";

    const ownerNames =
        dedupeNames(
            splitNames(
                compactJoin([
                    primaryOwnerNamesRaw,
                    coOwnerNamesRaw
                ], "; ")
            )
        );

    const ownerNamesRaw =
        ownerNames.join("; ");

    const make =
        get([
            "Make",
            "Manufacturer",
            "SF Make"
        ]) || "";

    const model =
        get([
            "Model",
            "SF Model"
        ]) || "";

    const trim =
        get([
            "Trim",
            "Model Trim",
            "SF Trim"
        ]) || "";

    return {
        rawFields: fields,
        ticketText:
            context.message?.happyfoxText ||
            context.message?.ticketText ||
            "",
        acquisitionType,
        appointmentDate:
            get([
                "Tentative Appointment Date",
                "Appointment Date",
                "Scheduled Appointment Date"
            ]) || "",
        rvClass,
        year:
            get([
                "Year",
                "SF Year"
            ]) || "",
        make,
        model,
        trim,
        makeModelTrim:
            compactJoin([
                make,
                model,
                trim
            ], " "),
        vin,
        ownerNamesRaw,
        ownerNames,
        lienRaw:
            get([
                "Lien",
                "Lien Status",
                "Lienholder",
                "Lienholder Name"
            ]) || "",
        lien:
            parseYesNo(
                get([
                    "Lien",
                    "Lien Status"
                ]) || ""
            ),
        titleState,
        titleOwnerType:
            get([
                "Is the title in a private party name or business name?",
                "Title Owner Type",
                "Title Ownership Type",
                "Private Party or Business Name"
            ]) || "",
        mileage:
            get([
                "Mileage",
                "Miles",
                "ODO Verified",
                "Odometer",
                "Current Mileage"
            ]) || "",
        sfLocation:
            get([
                "SF Location",
                "Salesforce Location",
                "Location"
            ]) || "",
        glLocation:
            get([
                "GL Location",
                "General Ledger Location"
            ]) || "",
        address:
            get([
                "Address",
                "Customer Address",
                "Owner Address"
            ]) || "",
        email:
            findBestEmail(
                fields
            ),
        signerAvailable:
            get([
                "Signer Available",
                "Signers Available",
                "All Signers Available",
                "Signer(s) Available",
                "Are Signers Available",
                "Available to Sign"
            ]) || "",
        estimatedPayoff:
            get([
                "Estimated Payoff",
                "Payoff",
                "Estimated Loan Payoff"
            ]) || "",
        scheduledOffer:
            get([
                "Scheduled Offer",
                "Scheduled Consignment Offer",
                "Scheduled Purchase Offer",
                "Scheduled Consignment Amount",
                "Scheduled Purchase Amount",
                "Consignment Offer",
                "Purchase Offer",
                "Offer",
                "TRU Purchase"
            ]) || "",
        paymentOption:
            get([
                "Estimated Payoff Payment Option",
                "Payoff Payment Option",
                "Deficiency Payment Option",
                "Payment Option",
                "Payment Method"
            ]) || "",
        owesMoreThanOffer:
            get([
                "Do you owe more than the sale amount?",
                "Do you owe more than the offer?",
                "Owe more than sale amount",
                "Amount owed higher than offer",
                "Negative Equity",
                "Deficiency"
            ]) || "",
        escrow:
            get([
                "Escrow",
                "Escrow Amount",
                "Holdback"
            ]) || ""
    };
}

function parseSalesforce(source, context = {}) {

    if (
        source &&
        typeof source === "object" &&
        Array.isArray(source.fields)
    ) {
        return parseSalesforceFromFieldMap(
            source,
            context
        );
    }

    return parseSalesforceFromText(
        source || "",
        context
    );
}

function parseSalesforceFromFieldMap(source, context = {}) {

    const text =
        source.text || "";

    const fallback =
        parseSalesforceFromText(
            text,
            context
        );

    const fields =
        buildSalesforceFieldLookup(
            source.fields || []
        );

    const get = (...apiNames) =>
        getSalesforceMappedValue(
            fields,
            apiNames
        );

    const comments =
        get("Customer_Comments__c") || "";

    const classValue =
        cleanSalesforceClassValue(
            get("Class__c") || fallback.classValue
        );

    const year =
        cleanSalesforceYearValue(
            get("Model_Year__c") || fallback.year
        );

    const make =
        cleanSalesforceVehiclePart(
            get("Make_Name__c") || fallback.make,
            "make"
        );

    const model =
        cleanSalesforceVehiclePart(
            get("Model_Name__c") || fallback.model,
            "model"
        );

    const trim =
        cleanSalesforceVehiclePart(
            get("Trim_Name__c") || fallback.trim,
            "trim"
        );

    const mappedVin =
        get("Consignment_VIN__c", "Asset_VIN__c");

    const vin =
        isUsableVin(mappedVin)
            ? normalizeVin(mappedVin)
            : "";

    const mileage =
        cleanSalesforceMileageValue(
            get("Mileage__c") || fallback.mileage
        );

    const email =
        getSalesforceMappedValue(
            fields,
            ["Email"],
            "Contact"
        ) ||
        get("Email__c") ||
        fallback.email;

    const mappedTruePurchase =
        cleanMoneyField(
            get("Buy_Outright_Value__c")
        );

    const mappedTrueConsignment =
        cleanMoneyField(
            get("Consignment_Value__c")
        );

    const commentTrueTrade =
        cleanMoneyField(
            extractSalesforceCommentMoney(comments, "True Trade")
        );

    const commentTrueConsignment =
        cleanMoneyField(
            extractSalesforceCommentMoney(comments, "True Consignment")
        );

    const hasActualTrueValues =
        Boolean(
            get("Expiration_Date__c") ||
            mappedTruePurchase ||
            mappedTrueConsignment ||
            commentTrueTrade ||
            commentTrueConsignment
        );

    const trueValuesExpiration =
        cleanSalesforceDateValue(
            get("Expiration_Date__c") ||
            (hasActualTrueValues ? get("Web_Purchase_Range_Expiration__c") : "")
        );

    const truePurchaseAmount =
        cleanMoneyField(
            mappedTruePurchase ||
            commentTrueTrade ||
            fallback.truePurchaseAmount
        );

    const trueConsignmentAmount =
        cleanMoneyField(
            mappedTrueConsignment ||
            commentTrueConsignment ||
            fallback.trueConsignmentAmount
        );

    const originalPurchaseOffer =
        cleanMoneyField(
            get("Trade_Sell_Offer__c") ||
            fallback.originalPurchaseOffer
        );

    const sfLocation =
        cleanSalesforceLocationValue(
            get("Location_Account__c") || fallback.sfLocation
        );

    const recordType =
        get("RecordTypeId");

    const acquisitionType =
        recordType ||
        fallback.acquisitionType ||
        (normalizeText(source.url || "").includes("CONSIGNMENT_REQUEST__C")
            ? "Used Purchase & Consignment"
            : "");

    return {
        ...fallback,
        classValue,
        year,
        make,
        model,
        trim,
        makeModelTrim:
            compactJoin([
                make,
                model,
                trim
            ], " "),
        vin,
        mileage,
        email,
        sfLocation,
        acquisitionType,
        trueValuesExpiration,
        truePurchaseAmount,
        trueConsignmentAmount,
        originalPurchaseOffer,
        rawText: text || "",
        fieldMap: source.fields || []
    };
}

function buildSalesforceFieldLookup(fields) {

    const byApi = new Map();
    const byObjectApi = new Map();

    for (const field of fields || []) {

        const apiName =
            field.fieldApiName || "";

        const objectApiName =
            field.objectApiName || "";

        if (!apiName) {
            continue;
        }

        const value =
            cleanSalesforceMappedValue(
                field.value,
                field.label,
                apiName
            );

        if (!value) {
            continue;
        }

        if (!byApi.has(apiName)) {
            byApi.set(apiName, []);
        }

        byApi.get(apiName).push({
            ...field,
            value
        });

        const objectKey = `${objectApiName}.${apiName}`;

        if (!byObjectApi.has(objectKey)) {
            byObjectApi.set(objectKey, []);
        }

        byObjectApi.get(objectKey).push({
            ...field,
            value
        });
    }

    return {
        byApi,
        byObjectApi
    };
}

function getSalesforceMappedValue(fields, apiNames, objectApiName = "Consignment_Request__c") {

    for (const apiName of apiNames) {

        const objectMatches =
            objectApiName
                ? fields.byObjectApi.get(`${objectApiName}.${apiName}`) || []
                : [];

        const genericMatches =
            fields.byApi.get(apiName) || [];

        const matches =
            [
                ...objectMatches,
                ...genericMatches
            ];

        for (const match of matches) {
            if (match.value) {
                return match.value;
            }
        }
    }

    return "";
}

function cleanSalesforceMappedValue(value, label, apiName) {

    let cleaned =
        cleanValue(value || "")
            .replace(/\bPreview\b/gi, "")
            .replace(/\bChange Record Type\b/gi, "")
            .replace(/\bChange Owner\b/gi, "")
            .replace(/\bEdit [A-Za-z0-9 /()&,'-]+$/i, "")
            .replace(/\bHelp [A-Za-z0-9 /()&,'-]+/gi, "")
            .replace(/\s+/g, " ")
            .trim();

    const labelText =
        cleanValue(label || "");

    const apiText =
        cleanValue(
            (apiName || "")
                .replace(/__c$/i, "")
                .replace(/_/g, " ")
        );

    const normalized =
        normalizeText(cleaned);

    const labelNormalized =
        normalizeText(labelText);

    const apiNormalized =
        normalizeText(apiText);

    if (
        !normalized ||
        normalized === labelNormalized ||
        normalized === apiNormalized ||
        normalized === `HELP ${labelNormalized}` ||
        normalized === `EDIT ${labelNormalized}` ||
        normalized.endsWith(" COLUMN ACTIONS")
    ) {
        return "";
    }

    if (
        /^FALSE\s+[A-Z ]+$/.test(normalized) &&
        normalized.endsWith(labelNormalized)
    ) {
        return "False";
    }

    if (
        /^TRUE\s+[A-Z ]+$/.test(normalized) &&
        normalized.endsWith(labelNormalized)
    ) {
        return "True";
    }

    return cleaned;
}

function isUsableVin(value) {

    return /^[A-HJ-NPR-Z0-9]{17}$/i.test(
        cleanValue(value)
    );
}

function cleanSalesforceYearValue(value) {

    const match =
        cleanValue(value).match(/\b(19|20)\d{2}\b/);

    return match?.[0] || "";
}

function cleanSalesforceMileageValue(value) {

    const cleaned =
        cleanValue(value);

    if (!cleaned || normalizeText(cleaned) === "MILEAGE") {
        return "";
    }

    const match =
        cleaned.match(/\b\d{1,3}(?:,\d{3})+\b|\b\d{4,6}\b/);

    return match?.[0] || "";
}

function cleanSalesforceDateValue(value) {

    const cleaned =
        cleanValue(value);

    return extractDate(cleaned) || cleaned;
}

function cleanSalesforceLocationValue(value) {

    return cleanValue(value)
        .replace(/\bPreview\b/gi, "")
        .replace(/\bEdit Location Account\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
}

function cleanMoneyField(value) {

    const money =
        extractMoneyText(value);

    return money || "";
}

function extractSalesforceCommentMoney(comments, label) {

    const pattern =
        new RegExp(`${escapeRegex(label)}\\s*:\\s*(\\d{3,7}|\\$?\\d{1,3}(?:,\\d{3})+)`, "i");

    const match =
        cleanValue(comments || "").match(pattern);

    if (!match) {
        return "";
    }

    const value =
        parseMoney(match[1]);

    return value === null
        ? ""
        : formatMoney(value);
}


function parseSalesforceFromText(text, context = {}) {

    const lines =
        toCleanLines(
            text
        );

    const fallbackVehicle =
        extractSalesforceVehicleFromText(
            text
        );

    const classValue =
        cleanSalesforceClassValue(
            extractSalesforceValue(
                lines,
                [
                    "Class",
                    "RV Class",
                    "Vehicle Class"
                ]
            )
        );

    const year =
        extractSalesforceYear(
            lines
        ) || fallbackVehicle.year || "";

    const make =
        cleanSalesforceVehiclePart(
            extractSalesforceValue(
                lines,
                [
                    "Make Name",
                    "Make",
                    "Manufacturer"
                ]
            ),
            "make"
        ) || fallbackVehicle.make || "";

    const model =
        cleanSalesforceVehiclePart(
            extractSalesforceValue(
                lines,
                [
                    "Model Name",
                    "Brand",
                    "Model"
                ]
            ),
            "model"
        ) || fallbackVehicle.model || "";

    const trim =
        cleanSalesforceVehiclePart(
            extractSalesforceValue(
                lines,
                [
                    "Trim Name",
                    "Trim",
                    "Model Trim"
                ]
            ),
            "trim"
        ) || fallbackVehicle.trim || "";

    const vin =
        extractSalesforceVin(
            lines,
            text,
            context
        );

    const mileage =
        extractSalesforceValue(
            lines,
            [
                "Mileage",
                "Miles",
                "Odometer",
                "ODO Verified"
            ]
        );

    const email =
        extractSalesforceEmail(
            lines,
            text
        );

    const trueValuesExpiration =
        extractTrueValuesExpiration(
            lines,
            text
        );

    const truePurchaseAmount =
        extractSalesforceMoneyValue(
            lines,
            [
                "True Purchase Amount",
                "True Purchase"
            ]
        );

    const trueConsignmentAmount =
        extractSalesforceMoneyValue(
            lines,
            [
                "True Consignment Amount",
                "True Consignment"
            ]
        );

    const originalPurchaseOffer =
        extractSalesforceMoneyValue(
            lines,
            [
                "Original Purchase Offer",
                "Final Offer",
                "Initial Offer"
            ]
        );

    const sfLocation =
        extractSalesforceLocation(
            lines,
            text
        );

    const normalizedText =
        normalizeText(text);

    const acquisitionType =
        normalizedText.includes("CONSIGNMENT REQUEST")
            ? "Consignment Request"
            : normalizedText.includes("PURCHASE REQUEST")
                ? "Purchase Request"
                : extractSalesforceValue(
                    lines,
                    [
                        "Acquisition Type",
                        "Request Type",
                        "Record Type"
                    ]
                );

    return {
        classValue,
        year,
        make,
        model,
        trim,
        makeModelTrim:
            compactJoin([
                make,
                model,
                trim
            ], " "),
        vin,
        mileage,
        email,
        sfLocation,
        acquisitionType,
        trueValuesExpiration,
        truePurchaseAmount,
        trueConsignmentAmount,
        originalPurchaseOffer,
        rawText: text || ""
    };
}




function extractSalesforceVehicleFromText(text) {

    const source = text || "";

    const leadMatch =
        source.match(/Sell\/Consign Form Lead:\s*(\d{4})\s+([^|\n]+?)(?:\s*\||\n)/i) ||
        source.match(/Customer Comments[\s\S]{0,600}?(\d{4})\s+([A-Z][A-Z0-9 &'./-]+?)(?:\s*\||\s+Miles\b|\n)/i);

    if (!leadMatch) {
        return {};
    }

    const year = leadMatch[1] || "";
    const desc = cleanValue(leadMatch[2] || "");
    const upper = normalizeText(desc);

    const knownMakes = [
        "FOREST RIVER",
        "COACHMEN",
        "WINNEBAGO",
        "JAYCO",
        "KEYSTONE",
        "GRAND DESIGN",
        "THOR",
        "TIFFIN",
        "NEWMAR",
        "FLEETWOOD",
        "AIRSTREAM",
        "HEARTLAND",
        "DUTCHMEN",
        "KZ",
        "PALOMINO"
    ];

    let make = "";
    let rest = desc;

    for (const candidate of knownMakes) {
        if (upper.startsWith(candidate + " ") || upper === candidate) {
            make = desc.slice(0, candidate.length).trim();
            rest = desc.slice(candidate.length).trim();
            break;
        }
    }

    if (!make) {
        const parts = desc.split(/\s+/).filter(Boolean);
        make = parts.shift() || "";
        rest = parts.join(" ");
    }

    const restParts = rest.split(/\s+/).filter(Boolean);
    const trim = restParts.length > 1 ? restParts.pop() : "";
    const model = restParts.join(" ") || rest;

    return {
        year,
        make: cleanValue(make),
        model: cleanValue(model),
        trim: cleanValue(trim)
    };
}

function cleanSalesforceVehiclePart(value, field = "") {

    let cleaned =
        cleanSalesforceLine(value || "")
            .replace(/\b(Edit|Preview|Status|Show|Help)\b.*$/gi, "")
            .replace(/\bcolumn\s+actions\b/gi, "")
            .replace(/\s+/g, " ")
            .trim();

    if (!cleaned) {
        return "";
    }

    if (field === "model") {
        cleaned = cleaned.replace(/^Year\s+\d{4}\s+/i, "").trim();
    }

    const upper = normalizeText(cleaned);

    if (
        !upper ||
        upper === "YEAR" ||
        upper === "STATUS" ||
        upper === "MODEL YEAR" ||
        upper.includes("COLUMN ACTION") ||
        upper.includes("NAVIGATION MODE") ||
        upper.includes("ACTION MODE")
    ) {
        return "";
    }

    if (field === "make" && /\bSTATUS\b/.test(upper)) {
        return "";
    }

    return cleaned;
}

function extractSalesforceYear(lines) {

    const labels = [
        "Model Year",
        "Vehicle Year",
        "Year"
    ];

    for (const label of labels) {

        const value =
            extractSalesforceValue(
                lines,
                [label]
            );

        const year =
            extractYear(
                value
            );

        if (year) {
            return year;
        }
    }

    return "";
}

function extractSalesforceVin(lines, text, context = {}) {

    const expectedVin =
        normalizeVin(
            context.vin
        );

    const labeledValue =
        extractSalesforceValue(
            lines,
            [
                "Consignment VIN",
                "VIN",
                "Vehicle Identification Number"
            ]
        );

    const labeledCandidates =
        extractAllVins(
            labeledValue
        );

    if (
        expectedVin &&
        labeledCandidates.includes(expectedVin)
    ) {
        return expectedVin;
    }

    if (labeledCandidates.length) {
        return labeledCandidates[0];
    }

    return "";
}

function extractSalesforceLocation(lines, text) {

    const specificValue =
        extractSalesforceValue(
            lines,
            [
                "SF Location",
                "Salesforce Location",
                "Sales Location",
                "Selling Location",
                "Dealership Location",
                "Store Location",
                "Location Name"
            ]
        );

    if (
        isPlausibleSalesforceLocation(
            specificValue
        )
    ) {
        return specificValue;
    }

    const exactLocationValue =
        extractPlausibleValueNearSalesforceLabel(
            lines,
            [
                "Location"
            ],
            isPlausibleSalesforceLocation
        );

    if (exactLocationValue) {
        return exactLocationValue;
    }

    return extractSalesforceLocationFromText(
        text
    );
}

function extractPlausibleValueNearSalesforceLabel(lines, labels, predicate) {

    for (const label of labels) {

        const target =
            normalizeLabel(label);

        for (let i = 0; i < lines.length; i++) {

            const line =
                cleanSalesforceLine(
                    lines[i]
                );

            const normalized =
                normalizeSalesforceLabel(
                    line
                );

            if (
                normalized === target ||
                normalized.startsWith(target + " ")
            ) {

                const inlineValue =
                    extractInlineSalesforceValue(
                        line,
                        label
                    );

                if (
                    inlineValue &&
                    predicate(inlineValue)
                ) {
                    return cleanValue(inlineValue);
                }

                for (let j = i + 1; j < Math.min(lines.length, i + 14); j++) {

                    const candidate =
                        cleanSalesforceLine(
                            lines[j]
                        );

                    if (
                        predicate(candidate)
                    ) {
                        return cleanValue(candidate);
                    }

                    if (
                        candidate &&
                        isLikelySalesforceLabel(candidate)
                    ) {
                        break;
                    }
                }
            }
        }
    }

    return "";
}

function isPlausibleSalesforceLocation(value) {

    const cleaned =
        cleanValue(value);

    const upper =
        normalizeText(cleaned);

    if (
        !upper ||
        isLikelySalesforceNoise(cleaned) ||
        isLikelySalesforceLabel(cleaned)
    ) {
        return false;
    }

    const rejected = [
        "ACCOUNT",
        "CONTACT",
        "OWNER",
        "USER",
        "LOCATION",
        "DETAILS",
        "RELATED",
        "ACTIVITY",
        "TRUE VALUES",
        "NADA TRADE VALUE",
        "MODEL NAME",
        "MAKE NAME",
        "TRIM NAME"
    ];

    if (
        rejected.includes(upper)
    ) {
        return false;
    }

    if (
        /\b(EDIT|MODEL NAME|MAKE NAME|TRIM NAME|PREVIEW|INTENT)\b/.test(upper)
    ) {
        return false;
    }

    return /\bCONSIGN\b/.test(upper) ||
        /\bRV\s*SALES\b/.test(upper) ||
        /\bRVSALES\b/.test(upper) ||
        /^[A-Z]{2,4}\d{1,3}\s+[A-Z0-9 '&.-]{3,}$/.test(upper) ||
        /\b[A-Z]{2,4}\d{1,3}\s+[A-Z0-9 '&.-]+\s+[A-Z]{2}\b/.test(upper);
}

function extractSalesforceLocationFromText(text) {

    const lines =
        toCleanLines(text);

    const exact =
        lines.find(line =>
            isPlausibleSalesforceLocation(line) &&
            /\bRV\s*SALES\b|\bRVSALES\b/i.test(line)
        );

    if (exact) {
        return cleanValue(exact);
    }

    return cleanValue(
        lines.find(line =>
            isPlausibleSalesforceLocation(line)
        ) || ""
    );
}

function extractSalesforceValue(lines, labels) {

    for (const label of labels) {

        const target =
            normalizeLabel(label);

        for (let i = 0; i < lines.length; i++) {

            const line =
                cleanSalesforceLine(
                    lines[i]
                );

            const normalized =
                normalizeSalesforceLabel(
                    line
                );

            const prefixMatch =
                normalized.startsWith(target + " ") &&
                !(target === "model" && normalized.startsWith("model year"));

            if (
                normalized === target ||
                normalized.endsWith(" " + target) ||
                prefixMatch ||
                normalized.includes(target + " column actions")
            ) {

                const inlineValue =
                    extractInlineSalesforceValue(
                        line,
                        label
                    );

                if (
                    inlineValue &&
                    isMeaningfulSalesforceValue(
                        inlineValue
                    )
                ) {
                    return cleanValue(
                        inlineValue
                    );
                }

                const nextValue =
                    nextSalesforceValue(
                        lines,
                        i + 1
                    );

                if (nextValue) {
                    return nextValue;
                }
            }
        }
    }

    return "";
}

function extractTrueValuesExpiration(lines, text) {

    const direct =
        extractDateAfterLabels(
            lines,
            [
                "True Values Expiration Date",
                "True Value Expiration Date",
                "True Values Expiration",
                "True Value Expiration",
                "Expiration Date",
                "Expiration"
            ]
        );

    if (direct) {
        return direct;
    }

    const fullText =
        text || "";

    const scopedMatch =
        fullText.match(/true\s+values?[\s\S]{0,800}?(\d{1,2}\/\d{1,2}\/\d{2,4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},\s+\d{4})/i);

    if (scopedMatch) {
        return extractDate(
            scopedMatch[1]
        );
    }

    for (let i = 0; i < lines.length; i++) {

        const upper =
            normalizeText(
                lines[i]
            );

        if (
            upper.includes("TRUE VALUES") ||
            upper.includes("TRUE VALUE")
        ) {

            for (let j = i; j < Math.min(lines.length, i + 30); j++) {

                const date =
                    extractDate(
                        lines[j]
                    );

                if (date) {
                    return date;
                }
            }
        }
    }

    return "";
}

function cleanSalesforceLine(value) {

    return cleanValue(value)
        .replace(/\bShow\s+/gi, "")
        .replace(/\bHide\s+/gi, "")
        .replace(/\bcolumn actions\b/gi, "")
        .replace(/\bActions\b/gi, "")
        .replace(/\bPreview\b/gi, "")
        .replace(/\bSort\b/gi, "")
        .replace(/\bAscending\b/gi, "")
        .replace(/\bDescending\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeSalesforceLabel(value) {

    return normalizeLabel(
        cleanSalesforceLine(value)
    );
}

function extractInlineSalesforceValue(line, label) {

    const cleaned =
        cleanSalesforceLine(line);

    const pattern =
        new RegExp(
            `^${escapeRegex(label)}\\s*:?\\s+(.+)$`,
            "i"
        );

    const match =
        cleaned.match(pattern);

    if (!match) {
        return "";
    }

    const value =
        cleanValue(
            match[1]
        );

    return isLikelySalesforceLabel(value)
        ? ""
        : value;
}

function nextSalesforceValue(lines, startIndex) {

    for (let i = startIndex; i < Math.min(lines.length, startIndex + 10); i++) {

        const value =
            cleanSalesforceLine(
                lines[i]
            );

        if (
            !value ||
            isLikelySalesforceNoise(value) ||
            isLikelySalesforceLabel(value)
        ) {
            continue;
        }

        return cleanValue(value);
    }

    return "";
}

function isMeaningfulSalesforceValue(value) {

    return !!value &&
        !isLikelySalesforceNoise(value) &&
        !isLikelySalesforceLabel(value);
}

function isLikelySalesforceLabel(value) {

    const normalized =
        normalizeSalesforceLabel(value);

    const labels = [
        "year",
        "model year",
        "make name",
        "make",
        "manufacturer",
        "model name",
        "brand",
        "model",
        "trim name",
        "trim",
        "model trim",
        "vin",
        "class",
        "rv class",
        "true values",
        "true value",
        "expiration",
        "expiration date",
        "sf location",
        "location",
        "email",
        "mileage",
        "odometer",
        "miles"
    ];

    return labels.includes(normalized);
}

function isLikelySalesforceNoise(value) {

    const upper =
        normalizeText(value);

    if (!upper) {
        return true;
    }

    const noise = [
        "DETAILS",
        "RELATED",
        "ACTIVITY",
        "CHATTER",
        "EDIT",
        "SAVE",
        "CANCEL",
        "LOADING",
        "GUIDANCE",
        "PATH",
        "SHOW MORE",
        "SHOW LESS",
        "CHANGE OWNER",
        "NEW TASK",
        "LOG A CALL",
        "MORE ACTIONS",
        "PREVIEW",
        "INTENT",
        "INTENT INTENT",
        "INTENT INTENT INTENT"
    ];

    return noise.some(item =>
        upper === item ||
        upper.startsWith(item + " ")
    );
}

function extractSalesforceEmail(lines, text) {

    for (let i = 0; i < lines.length; i++) {

        const line =
            cleanSalesforceLine(
                lines[i]
            );

        const normalized =
            normalizeSalesforceLabel(
                line
            );

        if (normalized === "web email") {
            continue;
        }

        if (normalized === "email") {

            const next =
                nextSalesforceValue(
                    lines,
                    i + 1
                );

            const emails =
                extractEmails(
                    next
                );

            if (emails.length) {
                return emails[0];
            }
        }

        if (/^Email\s+/i.test(line) && !/^Web Email\s+/i.test(line)) {

            const emails =
                extractEmails(
                    line
                );

            if (emails.length) {
                return emails[0];
            }
        }
    }

    const webEmail =
        extractSalesforceValue(
            lines,
            [
                "Web Email"
            ]
        );

    const webEmails =
        extractEmails(
            webEmail
        );

    if (webEmails.length) {
        return webEmails[0];
    }

    return findBestEmailFromText(
        text
    );
}

function findBestEmail(fields) {

    const preferred =
        getFirstValue(
            fields,
            [
                "Customer Email",
                "Owner Email",
                "Seller Email",
                "Primary Email",
                "Contact Email",
                "Email Address",
                "Email"
            ]
        );

    const allEmails =
        Object.values(fields || {})
            .flatMap(value =>
                extractEmails(value)
            );

    const external =
        allEmails.find(email =>
            !isInternalEmail(email)
        );

    if (
        preferred &&
        (!isInternalEmail(preferred) || !external)
    ) {
        return preferred;
    }

    return external || preferred || "";
}

function findBestEmailFromText(text) {

    const emails =
        extractEmails(text);

    return emails.find(email =>
        !isInternalEmail(email)
    ) || emails[0] || "";
}

function extractEmails(value) {

    return [
        ...new Set(
            ((value || "")
                .toString()
                .match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])
                .map(email =>
                    email.trim()
                )
        )
    ];
}

function isInternalEmail(email) {

    return /@(campingworld|goodsam|ganderoutdoors)\./i.test(
        email || ""
    );
}

function parseMvr(source, context) {

    const text =
        typeof source === "string"
            ? source
            : (source?.text || "");

    const structured =
        typeof source === "string"
            ? {}
            : (source?.structured || {});

    const lines =
        toCleanLines(
            text
        );

    const upper =
        normalizeText(
            text
        );

    const noRecord =
        detectNoRecordText(
            upper
        );

    const serviceUnavailable =
        detectMvrServiceUnavailableText(
            upper
        );

    const extractedTitleOwnerNames =
        extractMvrTitleOwners(
            lines,
            context,
            structured
        );

    const structuredVehicleInterestOwners =
        extractedTitleOwnerNames.length
            ? []
            : extractStructuredVehicleInterestOwners(
                structured
            );

    const titleOwnerNames =
        dedupeNames([
            ...extractedTitleOwnerNames,
            ...structuredVehicleInterestOwners
        ]);

    const registeredOwnerNames =
        extractMvrRegisteredOwners(
            lines,
            structured
        );

    const rawOwnershipConnector =
        extractMvrOwnershipConnector(
            lines
        ) ||
        structured.ownershipConnector ||
        "";

    const lienInfo =
        extractLienInfo(
            lines,
            upper,
            context.state,
            structured
        );

    const state =
        extractStateAfterLabels(
            lines,
            [
                "Title State",
                "State"
            ]
        ) ||
        context.state ||
        "";

    const vin =
        extractVin(
            text
        ) ||
        context.vin ||
        "";

    const year =
        extractYearFromLabeledText(
            lines,
            [
                "Year",
                "Model Year"
            ]
        ) ||
        extractMvrHeaderYear(
            lines
        );

    const make =
        extractValueAfterLabels(
            lines,
            [
                "Make",
                "Manufacturer"
            ]
        );

    const model =
        extractValueAfterLabels(
            lines,
            [
                "Model"
            ]
        );

    const body =
        normalizeMvrBody(
            extractValueAfterLabels(
                lines,
                [
                    "Body",
                    "Body Style",
                    "Vehicle Type",
                    "Style"
                ]
            )
        );

    const mileage =
        extractMileage(
            text,
            lines
        );

    const branding =
        extractBranding(
            upper,
            lines
        );

    const titleRecordInfo =
        extractMvrTitleRecordInfo(
            lines
        );

    const conditionInfo =
        extractMvrConditionInfo(
            lines
        );

    const waOwners =
        maybeApplyWashingtonOwnershipRule({
            context,
            lines,
            upper,
            titleOwnerNames,
            registeredOwnerNames,
            lienInfo
        });

    const finalTitleOwnersRaw =
        waOwners?.owners ||
        titleOwnerNames;

    const ownerNameConnector =
        extractOwnershipConnectorFromOwnerNames(
            finalTitleOwnersRaw
        );

    const ownershipConnector =
        rawOwnershipConnector ||
        ownerNameConnector;

    const finalTitleOwners =
        dedupeNames(
            finalTitleOwnersRaw
                .map(stripLeadingOwnershipConnector)
                .filter(Boolean)
        );

    const finalLienInfo =
        waOwners?.lienInfo ||
        lienInfo;

    return {
        noRecord,
        serviceUnavailable,
        failureReason:
            serviceUnavailable
                ? "State DMV service unavailable / maintenance message shown"
                : noRecord
                    ? "No MVR record found"
                    : "",
        titleOwnerNames: finalTitleOwners,
        ownershipCount:
            finalTitleOwners.length,
        ownershipConnector,
        registeredOwnerNames,
        lienPresent:
            finalLienInfo.present,
        lienholder:
            finalLienInfo.name,
        lienStatusText:
            finalLienInfo.statusText,
        vin,
        year,
        make,
        model,
        body,
        makeModelBody:
            formatMvrVehicle(
                make,
                model,
                body
            ),
        mileage,
        state,
        branding,
        titleNumber:
            titleRecordInfo.titleNumber,
        titleIssueDate:
            titleRecordInfo.issueDate,
        titleHasNumber:
            titleRecordInfo.hasTitleNumber,
        titleHasIssueDate:
            titleRecordInfo.hasIssueDate,
        conditions:
            conditionInfo.conditions,
        conditionStatusText:
            conditionInfo.statusText,
        rawText: text || "",
        reliabilityComplete:
            !serviceUnavailable &&
            !noRecord &&
            finalTitleOwners.length > 0 &&
            finalLienInfo.present !== null
    };
}

function extractOwnershipConnectorFromOwnerNames(ownerNames = []) {

    for (const ownerName of ownerNames || []) {
        const upper =
            normalizeText(ownerName);

        if (/^OR\b/.test(upper)) {
            return "OR";
        }

        if (/^AND\b/.test(upper)) {
            return "AND";
        }

        if (/\bOR\b/.test(upper)) {
            return "OR";
        }

        if (/\bAND\b/.test(upper)) {
            return "AND";
        }
    }

    return "";
}

function stripLeadingOwnershipConnector(value) {

    return cleanValue(value)
        .replace(/^(OR|AND)\b\s*[:\-]?\s*/i, "")
        .trim();
}

function splitCompositeOwnerName(value) {

    const cleaned =
        cleanValue(value);

    if (!cleaned) {
        return [];
    }

    if (
        /\b(L\.?L\.?C\.?|INC\.?|CORP\.?|CORPORATION|COMPANY|CO\.?|TRUST|BANK|CREDIT UNION|CREDIT UNIO|FEDERAL|FINANCE|FINANCIAL)\b/i.test(cleaned)
    ) {
        return [cleaned];
    }

    if (!/\sAND\s/i.test(cleaned)) {
        return [cleaned];
    }

    const parts =
        cleaned
            .split(/\s+AND\s+/i)
            .map(part => cleanValue(part))
            .filter(Boolean);

    if (parts.length !== 2) {
        return [cleaned];
    }

    const firstWords =
        parts[0].split(/\s+/).filter(Boolean);

    const secondWords =
        parts[1].split(/\s+/).filter(Boolean);

    if (
        firstWords.length === 1 &&
        secondWords.length >= 2
    ) {
        parts[0] = cleanValue(`${parts[0]} ${secondWords[secondWords.length - 1]}`);
    }

    return parts;
}

function expandCompositeOwnerNames(values = []) {

    return values
        .flatMap(splitCompositeOwnerName)
        .filter(Boolean);
}

function extractStructuredVehicleInterestOwners(structured = {}) {

    const preferredOwners =
        (structured.titleOwners || []).length
            ? structured.titleOwners
            : (structured.paperTitleOwners || []).length
                ? structured.paperTitleOwners
                : (structured.allOwners || []);

    return dedupeNames(
        preferredOwners
            .map(name => stripLeadingOwnershipConnector(name))
            .filter(name =>
                name &&
                !looksLikeOwnershipNoise(name) &&
                !looksLikeLienholder(name) &&
                looksLikePersonOrEntityName(name)
            )
    );
}

function meaningfulMvrTitleValue(value) {

    const cleaned =
        cleanValue(value);

    if (!cleaned) {
        return "";
    }

    if (/^(NOT PROVIDED|NONE|NULL|N\/A|NA|NO|—|-)$/i.test(cleaned)) {
        return "";
    }

    return cleaned;
}

function extractMvrTitleRecordInfo(lines) {

    const normalizedLines =
        lines.map(line => cleanValue(line));

    let titleSectionIndex = -1;

    for (let i = 0; i < normalizedLines.length; i++) {

        const upper =
            normalizeText(normalizedLines[i]);

        const ahead =
            normalizedLines
                .slice(i + 1, Math.min(normalizedLines.length, i + 12))
                .map(line => normalizeText(line))
                .join(" ");

        if (
            upper === "TITLE" &&
            /\b(TITLE:|ISSUE DATE:|ISSUE STATE:|TITLE STATUS|BRAND:|ODO READ:)\b/.test(ahead)
        ) {
            titleSectionIndex = i;
            break;
        }
    }

    if (titleSectionIndex < 0) {
        return {
            titleNumber: "",
            issueDate: "",
            hasTitleNumber: false,
            hasIssueDate: false
        };
    }

    let titleSectionEnd =
        normalizedLines.length;

    for (let i = titleSectionIndex + 1; i < normalizedLines.length; i++) {

        const upper =
            normalizeText(normalizedLines[i]);

        if (
            /^(LIEN HISTORY|NOTICE OF LIEN|VESSEL|INSURANCE|STOPS|CONDITIONS|PRIOR OWNERS?|ESTIMATED FEES|ESTIMATED FEES & PENALTIES|RENEWAL RECIPIENTS)$/.test(upper)
        ) {
            titleSectionEnd = i;
            break;
        }
    }

    const readLabelValue = labels => {

        for (let i = titleSectionIndex + 1; i < titleSectionEnd; i++) {

            const line =
                normalizedLines[i];

            for (const label of labels) {

                const inline =
                    line.match(new RegExp(`^${escapeRegex(label)}\\s*:\\s*(.*)$`, "i"));

                if (inline) {
                    return meaningfulMvrTitleValue(inline[1]);
                }

                if (normalizeText(line) === normalizeText(label)) {
                    for (let j = i + 1; j < Math.min(titleSectionEnd, i + 4); j++) {
                        const value =
                            meaningfulMvrTitleValue(normalizedLines[j]);
                        if (value) {
                            return value;
                        }
                    }
                }
            }
        }

        return "";
    };

    const titleNumber =
        readLabelValue([
            "Title",
            "Title Number",
            "Title No"
        ]);

    const issueDate =
        readLabelValue([
            "Issue Date",
            "Title Issue Date"
        ]);

    return {
        titleNumber,
        issueDate,
        hasTitleNumber:
            Boolean(titleNumber),
        hasIssueDate:
            Boolean(issueDate)
    };
}


function extractMvrConditionInfo(lines) {

    const normalizedLines =
        lines.map(line => cleanValue(line));

    const conditionIndex =
        normalizedLines.findIndex(line =>
            normalizeText(line) === "CONDITIONS"
        );

    if (conditionIndex < 0) {
        return {
            conditions: [],
            statusText: ""
        };
    }

    let conditionEnd =
        normalizedLines.length;

    for (let i = conditionIndex + 1; i < normalizedLines.length; i++) {

        const upper =
            normalizeText(normalizedLines[i]);

        if (
            /^(ESTIMATED FEES|ESTIMATED FEES & PENALTIES|LIEN HISTORY|NOTICE OF LIEN|VESSEL|INSURANCE|STOPS|PRIOR OWNERS?|RENEWAL RECIPIENTS|TITLE|REGISTRATION|VEHICLE)$/.test(upper)
        ) {
            conditionEnd = i;
            break;
        }
    }

    const conditions = [];

    for (let i = conditionIndex + 1; i < conditionEnd; i++) {

        const line =
            cleanValue(normalizedLines[i]);

        const upper =
            normalizeText(line);

        if (!line) {
            continue;
        }

        if (/^SHOW \d+ EMPTY FIELDS?$/.test(upper)) {
            continue;
        }

        if (/^(DATE|OFFICE ID|ID \/ SEQUENCE|TRANSACTION CODE|REASON|ROUTE CODE|AMOUNT|REC STATUS)\s*:?/.test(upper)) {
            continue;
        }

        if (/^\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(line)) {
            continue;
        }

        if (/^\$?[\d,]+(?:\.\d{2})?$/.test(line)) {
            continue;
        }

        if (/VEHICLE VALUE\s*:/i.test(line)) {
            continue;
        }

        if (/^NOT PROVIDED$/i.test(line)) {
            continue;
        }

        conditions.push(line);
    }

    const uniqueConditions =
        [...new Set(conditions)];

    return {
        conditions: uniqueConditions,
        statusText: uniqueConditions.length
            ? uniqueConditions.join("; ")
            : "Condition present"
    };
}

function extractMvrOwnershipConnector(lines) {

    const vehicleInterestsIndex =
        lines.findIndex(line =>
            normalizeText(line) === "VEHICLE INTERESTS"
        );

    if (vehicleInterestsIndex < 0) {
        return "";
    }

    let interestEnd =
        lines.length;

    for (let i = vehicleInterestsIndex + 1; i < lines.length; i++) {

        const upper =
            normalizeText(lines[i]);

        const ahead =
            lines
                .slice(i + 1, Math.min(lines.length, i + 7))
                .map(line => normalizeText(line))
                .join(" ");

        if (
            /^(PRIOR OWNERS?|ESTIMATED FEES|PRIOR REGISTRATION FEES|STOPS|VESSEL)$/.test(upper) ||
            (upper === "REGISTRATION" && /\b(PLATE:|ISSUE DATE:|REG EXP|REGISTRATION NUMBER:|PLATE TYPE:|STATUS:)/.test(ahead)) ||
            (upper === "VEHICLE" && /\b(VIN:|YEAR:|MAKE:|MODEL:|BODY:)/.test(ahead)) ||
            (upper === "TITLE" && /\b(TITLE:|ISSUE DATE:|ISSUE STATE:|BRAND:|ODO READ:|REMARKS:)/.test(ahead)) ||
            (upper === "INSURANCE" && /\b(INSURANCE COMPANY:|DE-INSURE|CERTIFICATE|POLICY)/.test(ahead))
        ) {
            interestEnd = i;
            break;
        }
    }

    let sawAnd = false;

    for (let i = vehicleInterestsIndex + 1; i < interestEnd; i++) {

        const line =
            cleanValue(lines[i]);

        const upper =
            normalizeText(line);

        const inlineMatch =
            upper.match(/^(CONNECTOR TYPE|CONJUNCTION|JOINT OWNERSHIP TYPE):?\s*(AND|OR)$/);

        if (inlineMatch) {
            if (inlineMatch[2] === "OR") {
                return "OR";
            }
            sawAnd = true;
            continue;
        }

        if (/^(CONNECTOR TYPE|CONJUNCTION|JOINT OWNERSHIP TYPE):?$/.test(upper)) {
            for (let j = i + 1; j < Math.min(interestEnd, i + 4); j++) {
                const next =
                    normalizeText(lines[j]);
                if (next === "OR") {
                    return "OR";
                }
                if (next === "AND") {
                    sawAnd = true;
                    break;
                }
                if (next) {
                    break;
                }
            }
        }

        if (/^AND\b/.test(upper)) {
            sawAnd = true;
        }
    }

    return sawAnd ? "AND" : "";
}

function parseNmvtis(text, context) {

    const lines =
        toCleanLines(
            text
        );

    const upper =
        normalizeText(
            text
        );

    if (!text) {
        return {
            rawText: "",
            available: false
        };
    }

    const lienInfo =
        extractLienInfo(
            lines,
            upper,
            context.state
        );

    const recordNotFound =
        upper.includes("RECORD NOT FOUND") ||
        upper.includes("NO RECORD FOUND");

    return {
        rawText: text || "",
        available: true,
        vin:
            extractVin(
                text
            ) || "",
        year:
            extractNmvtisYear(
                lines
            ),
        mileage:
            extractNmvtisMileage(
                lines,
                text,
                context
            ),
        branding:
            extractBranding(
                upper,
                lines
            ),
        lienPresent:
            lienInfo.present,
        lienholder:
            lienInfo.name,
        statusText:
            recordNotFound
                ? "Record not found"
                : ""
    };
}

function buildReviewOutput(sources) {

    const { happyfox, mvr, nmvtis, context } = sources;

    const salesforce =
        sources.salesforce || {};

    if (!mvr.reliabilityComplete) {
        return buildMvrFullStopOutput(
            context,
            mvr
        );
    }

    const rows = [];

    addLienRow(rows, happyfox, mvr, nmvtis);
    addTrueValuesExpirationRow(rows, salesforce);
    addScheduledOfferPayoffRow(rows, happyfox, salesforce, mvr);
    addMileageRow(rows, happyfox, salesforce, mvr, nmvtis);
    addOwnershipRows(rows, happyfox, mvr);
    addSignerRow(rows, happyfox, mvr);
    addYearRow(rows, happyfox, salesforce, mvr, nmvtis);
    addVehicleIdRow(rows, happyfox, salesforce, mvr);
    addVinRow(rows, happyfox, salesforce, mvr, nmvtis);
    addRvClassRow(rows, happyfox, salesforce, mvr);
    addAcquisitionRow(rows, happyfox, salesforce);
    addTitleStateRow(rows, happyfox, mvr, nmvtis, context);
    addTitleRecordRow(rows, mvr);
    addMvrConditionRow(rows, mvr);
    addBrandingRow(rows, mvr, nmvtis);
    addLocationRows(rows, happyfox, salesforce);
    addAddressRow(rows, happyfox, mvr);
    addEmailRow(rows, happyfox, salesforce);

    rows.sort((a, b) =>
        (STATUS_ORDER[a.status] ?? 9) -
        (STATUS_ORDER[b.status] ?? 9)
    );

    const table =
        buildMarkdownTable(
            rows
        );

    const documentSelection =
        buildDocumentSelection(
            happyfox,
            mvr
        );

    const outputParts = [
        table,
        "",
        "DOCUMENTS TO SELECT FOR CX",
        "",
        ...documentSelection.lines
    ];

    if (documentSelection.deficiencyMethodLines?.length) {
        outputParts.push(
            "",
            "SELECTED DEFICIENCY METHOD",
            "",
            ...documentSelection.deficiencyMethodLines
        );
    }

    if (documentSelection.note) {
        outputParts.push(
            "",
            `(${documentSelection.note})`
        );
    }

    return outputParts
        .filter(part => part !== "")
        .join("\n");
}

function addRow(rows, field, happyfox, salesforce, mvrManual, nmvtis, status, notes) {

    rows.push({
        field,
        happyfox: emptyDash(happyfox),
        salesforce: emptyDash(salesforce),
        mvrManual: emptyDash(mvrManual),
        nmvtis: emptyDash(nmvtis),
        status,
        notes: emptyDash(notes)
    });
}

function addLienRow(rows, happyfox, mvr, nmvtis) {

    const hfLien =
        happyfox.lien;

    const mvrLien =
        mvr.lienPresent;

    let status = "⚠️";
    let notes = "Lien comparison incomplete";

    const releasedLienNote =
        formatReleasedLienNote(
            mvr.lienStatusText
        );

    const mvrLienText =
        mvr.lienPresent
            ? `${mvr.lienholder || "Lienholder"} lien present`
            : releasedLienNote
                ? (mvr.lienStatusText || releasedLienNote)
                : "No lien shown";

    if (hfLien === false && mvrLien === true) {
        status = "🚩";
        notes = "HF says no lien; MVR shows active lienholder";
    } else if (hfLien === true && mvrLien === true) {
        status = "✅";
        notes = "Active lien confirmed";
    } else if (hfLien === true && mvrLien === false) {
        status = releasedLienNote ? "✅" : "⚠️";
        notes = releasedLienNote || "HF says lien; MVR shows no lien";
    } else if (hfLien === false && mvrLien === false) {
        status = "✅";
        notes = releasedLienNote || "No active lien shown";
    }

    addRow(
        rows,
        "Lien Status",
        happyfox.lienRaw || boolToYesNo(hfLien),
        "",
        mvrLienText,
        nmvtis?.statusText ||
            (nmvtis?.lienPresent === true
                ? `${nmvtis.lienholder || "Lien"}`
                : nmvtis?.lienPresent === false
                    ? "No lien shown"
                    : ""),
        status,
        notes
    );
}

function addTrueValuesExpirationRow(rows, salesforce) {

    if (!salesforce.trueValuesExpiration) {

        addRow(
            rows,
            "True Values Expiration",
            "",
            "Not Found",
            "",
            "",
            "⚠️",
            "True Values expiration not visible in Salesforce"
        );

        return;
    }

    const result =
        evaluateExpirationDate(
            salesforce.trueValuesExpiration
        );

    addRow(
        rows,
        "True Values Expiration",
        "",
        salesforce.trueValuesExpiration,
        "",
        "",
        result.status,
        result.note
    );
}


function scrubTicketTextForOverrideSearch(text) {

    return (text || "")
        .toString()
        .split(/\n|\r|\s{2,}/)
        .filter(line => {
            const upper = normalizeText(line);
            return !upper.includes("PIR NEEDED") &&
                !upper.includes("CIR NEEDED") &&
                !upper.includes("TRU VALUES EXP") &&
                !upper.includes("TRUE VALUES") &&
                !upper.includes("CUSTOM FIELD");
        })
        .join("\n");
}

function findTicketOverrideMarker(happyfox, type) {

    const marker = normalizeText(type);
    const rawFields = happyfox?.rawFields || {};

    if (!marker) {
        return {
            found: false,
            approved: false,
            note: `${marker} NOT FOUND`
        };
    }

    const explicitApprovedField =
        Object.entries(rawFields)
            .find(([key, value]) => {
                const keyUpper = normalizeText(key);
                const valueUpper = normalizeText(value);
                const cleanedValue = cleanValue(value);

                if (!hasValue(cleanedValue) || cleanedValue === "-") {
                    return false;
                }

                return (
                    keyUpper === `APPROVED ${marker}` ||
                    keyUpper === `${marker} APPROVED` ||
                    keyUpper.includes(`APPROVED ${marker}`) ||
                    keyUpper.includes(`${marker} APPROVED`) ||
                    (keyUpper.includes(marker) && valueUpper.includes("APPROV"))
                );
            });

    if (explicitApprovedField) {
        return {
            found: true,
            approved: true,
            note: `${marker} APPROVED`
        };
    }

    const fieldText = Object.entries(rawFields)
        .filter(([key, value]) => {
            const combined = normalizeText(`${key} ${value}`);
            const cleanedValue = cleanValue(value);

            return combined.includes(marker) &&
                hasValue(cleanedValue) &&
                cleanedValue !== "-";
        })
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");

    const text = scrubTicketTextForOverrideSearch(
        compactJoin([
            happyfox?.ticketText || "",
            fieldText
        ], "\n")
    );

    const upper = normalizeText(text);

    if (!upper) {
        return {
            found: false,
            approved: false,
            note: `${marker} NOT FOUND`
        };
    }

    const spaced = marker.split("").join("\\s*\\.?\\s*");
    const markerRegex = new RegExp(`\\b${spaced}\\b`, "i");
    const explicitApprovedTextRegex = new RegExp(
        `\\b(APPROVED|APPROVAL|APPROV|APPVD|COMPLETED|COMPLETE)\\b[^\\n]{0,160}(${spaced})|` +
        `(${spaced})[^\\n]{0,160}\\b(APPROVED|APPROVAL|APPROV|APPVD|COMPLETED|COMPLETE)\\b`,
        "i"
    );
    const approvedNearMarkerRegex = new RegExp(
        `(${spaced})[^\\n]{0,80}(APPROV|APPVD|OKAY|VALID|CONFIRM)|` +
        `(APPROV|APPVD|OKAY|VALID|CONFIRM)[^\\n]{0,80}(${spaced})`,
        "i"
    );

    const approved = explicitApprovedTextRegex.test(text) ||
        approvedNearMarkerRegex.test(text);
    const found = markerRegex.test(text);
    const negativeNearMarkerRegex = new RegExp(
        `(NO|NOT FOUND|MISSING|NEEDED|REQUIRED)[^\n]{0,80}(${spaced})|` +
        `(${spaced})[^\n]{0,80}(NOT FOUND|MISSING|NEEDED|REQUIRED)`,
        "i"
    );

    if (approved) {
        return {
            found: true,
            approved: true,
            note: `${marker} APPROVED`
        };
    }

    if (found && !negativeNearMarkerRegex.test(text)) {
        return {
            found: true,
            approved: false,
            note: `${marker} APPROVED`
        };
    }

    return {
        found: false,
        approved: false,
        note: `${marker} NOT FOUND`
    };
}

function getAdjustedConsignmentOffer(happyfox) {

    const fields = happyfox?.rawFields || {};

    const directValue =
        fields["Adjusted Consignment Offer"] ||
        fields["Adjusted Consignment Amount"] ||
        fields["Adjusted Consignment"] ||
        "";

    const directAmount = parseMoney(directValue);

    if (directAmount !== null) {
        return {
            found: true,
            amount: directAmount,
            text: formatMoney(directAmount)
        };
    }

    for (const [key, value] of Object.entries(fields)) {
        const keyUpper = normalizeText(key);

        if (
            keyUpper.includes("ADJUSTED CONSIGNMENT OFFER") ||
            keyUpper.includes("ADJUSTED CONSIGNMENT AMOUNT")
        ) {
            const amount = parseMoney(value);

            if (amount !== null) {
                return {
                    found: true,
                    amount,
                    text: formatMoney(amount)
                };
            }
        }
    }

    return {
        found: false,
        amount: null,
        text: ""
    };
}

function findOfferOverride(happyfox, type) {

    const markerOverride = findTicketOverrideMarker(
        happyfox,
        type
    );

    if (markerOverride.found || type !== "CIR") {
        return markerOverride;
    }

    const adjustedConsignmentOffer = getAdjustedConsignmentOffer(
        happyfox
    );

    if (adjustedConsignmentOffer.found) {
        return {
            found: true,
            approved: true,
            note: `Adjusted Consignment Offer ${adjustedConsignmentOffer.text} found; CIR not needed`
        };
    }

    return markerOverride;
}

function isUnavailableSignerText(value) {

    const upper = normalizeText(value);

    return upper.includes("UNAVAILABLE") ||
        upper.includes("NOT AVAILABLE") ||
        upper.includes("CAN'T SIGN") ||
        upper.includes("CANNOT SIGN") ||
        upper.includes("NOT ALL") ||
        upper.includes("NO");
}

function addScheduledOfferPayoffRow(rows, happyfox, salesforce, mvr) {

    const payoff =
        parseMoney(
            happyfox.estimatedPayoff
        );

    const offer =
        parseMoney(
            happyfox.scheduledOffer
        );

    const escrow =
        parseMoney(
            happyfox.escrow
        ) || 0;

    const sfTruePurchase =
        parseMoney(
            salesforce.truePurchaseAmount
        );

    const sfTrueConsignment =
        parseMoney(
            salesforce.trueConsignmentAmount
        );

    const sfOriginalPurchaseOffer =
        parseMoney(
            salesforce.originalPurchaseOffer
        );

    const consignment =
        isConsignment(
            happyfox.acquisitionType || salesforce.acquisitionType
        );

    const purchase =
        isPurchaseAcquisition(
            happyfox.acquisitionType
        ) &&
        !isConsignment(
            happyfox.acquisitionType
        );

    const sfComparable =
        consignment
            ? (sfTrueConsignment ?? sfTruePurchase ?? sfOriginalPurchaseOffer)
            : (sfTruePurchase ?? sfTrueConsignment ?? sfOriginalPurchaseOffer);

    const sfOfferText =
        consignment && sfTrueConsignment !== null
            ? `True Consignment ${formatMoney(sfTrueConsignment)}`
            : sfTruePurchase !== null
                ? `True Purchase ${formatMoney(sfTruePurchase)}`
                : sfTrueConsignment !== null
                    ? `True Consignment ${formatMoney(sfTrueConsignment)}`
                    : sfOriginalPurchaseOffer !== null
                        ? `Original Purchase Offer ${formatMoney(sfOriginalPurchaseOffer)}`
                        : "";

    if (offer === null && payoff === null && sfComparable === null) {
        return;
    }

    const deficiency =
        payoff !== null && offer !== null
            ? payoff - offer - escrow
            : null;

    const hasActiveLien =
        happyfox.lien === true ||
        mvr?.lienPresent === true;

    const payoffExceedsOffer =
        deficiency !== null &&
        deficiency > 0;

    if (
        payoffExceedsOffer &&
        hasActiveLien
    ) {

        const paymentOption =
            normalizePayoffPaymentOption(
                happyfox.paymentOption
            );

        let status = "🚩";
        let notes =
            "Payoff exceeds offer";

        let happyfoxText =
            `Payoff ${formatMoney(payoff)}`;

        if (consignment) {
            happyfoxText += happyfox.paymentOption
                ? `; ${cleanValue(happyfox.paymentOption)}`
                : "; payment option not selected";

            if (paymentOption === "ESCROW_HOLDBACK") {
                status = "✅";
                notes = "Consignment Escrow Holdback selected; select Cashier Check (consignment deficiency only)";
            } else if (paymentOption === "LOAN_PAYDOWN") {
                status = "✅";
                notes = "Consignment Loan Paydown selected; select Loan Statement Reflecting Deficiency Payment";
            } else {
                status = "🚩";
                notes = "Deficiency payment method not selected";
            }
        } else if (purchase) {
            status = "✅";
            notes = `Payoff exceeds offer by ~${formatMoney(deficiency)}; Selected Deficiency Method: Purchase 20-day payoff quote`;
        } else {
            status = "🚩";
            notes = `Payoff exceeds offer by ~${formatMoney(deficiency)}`;
        }

        addRow(
            rows,
            "Estimated Payoff vs Offer",
            happyfoxText,
            sfOfferText || `Offer ${formatMoney(offer)}`,
            hasActiveLien
                ? `${mvr?.lienholder || happyfox.lienRaw || "Active lien"} active lien`
                : "",
            "",
            status,
            notes
        );
    }

    if (
        consignment &&
        hasActiveLien &&
        !payoffExceedsOffer
    ) {

        const paymentOption =
            normalizePayoffPaymentOption(
                happyfox.paymentOption
            );

        if (
            paymentOption === "ESCROW_HOLDBACK" ||
            paymentOption === "LOAN_PAYDOWN"
        ) {

            addRow(
                rows,
                "Deficiency Method",
                cleanValue(happyfox.paymentOption),
                "",
                hasActiveLien
                    ? `${mvr?.lienholder || happyfox.lienRaw || "Active lien"} active lien`
                    : "",
                "",
                "✅",
                paymentOption === "ESCROW_HOLDBACK"
                    ? "Selected Deficiency Method: Consignment Escrow Holdback; select Cashier Check (consignment deficiency only)"
                    : "Selected Deficiency Method: Consignment Loan Paydown; select Loan Statement Reflecting Deficiency Payment"
            );
        }
    }

    if (offer !== null || sfComparable !== null) {

        let status = "✅";
        let notes = "Scheduled offer present";

        if (offer !== null && sfComparable !== null) {
            if (offer === sfComparable) {
                status = "✅";
                notes = "Match";
            } else if (
                purchase &&
                sfTruePurchase !== null &&
                offer < sfTruePurchase
            ) {
                status = "✅";
                notes = "Scheduled purchase offer is below Salesforce True Purchase; PIR not needed";
            } else if (
                consignment &&
                sfTrueConsignment !== null &&
                offer < sfTrueConsignment
            ) {
                status = "✅";
                notes = "Scheduled consignment offer is below Salesforce True Consignment; CIR not needed";
            } else {
                const overrideType = consignment ? "CIR" : "PIR";
                const override = findOfferOverride(
                    happyfox,
                    overrideType
                );

                status = override.found ? "✅" : "⚠️";
                notes = override.found
                    ? override.note
                    : override.note;
            }
        } else if (offer !== null && salesforce.rawText) {
            status = "⚠️";
            notes = "Salesforce True Values amount not visible/extracted";
        }

        addRow(
            rows,
            "Scheduled Offer",
            offer !== null
                ? formatMoney(offer)
                : cleanValue(happyfox.scheduledOffer || ""),
            sfOfferText,
            "",
            "",
            status,
            notes
        );
    }
}

function addMileageRow(rows, happyfox, salesforce, mvr, nmvtis) {

    const classValues =
        [
            happyfox.rvClass,
            salesforce.classValue,
            mvr.body
        ].filter(hasValue);

    const unitCategories =
        classValues
            .map(rvClassCategory)
            .filter(Boolean);

    if (
        unitCategories.includes("NON_MOTORIZED") ||
        classValues.some(isTrailerClass)
    ) {

        addRow(
            rows,
            "Mileage",
            happyfox.mileage || "Not Provided",
            salesforce.mileage || "Not Provided",
            mvr.mileage || "Not Provided",
            nmvtis?.available ? (nmvtis?.mileage || "") : "",
            "✅",
            "Non-motorized unit; mileage not required"
        );

        return;
    }

    const hfMileage =
        parseNumber(
            happyfox.mileage
        );

    const sfMileage =
        parseNumber(
            salesforce.mileage
        );

    const sourceMileage =
        Math.max(
            hfMileage || 0,
            sfMileage || 0
        );

    const mvrMileage =
        parseNumber(
            mvr.mileage
        );

    const nmvtisMileage =
        parseNumber(
            nmvtis?.mileage
        );

    const comparisonMileage =
        Math.max(
            mvrMileage || 0,
            nmvtisMileage || 0
        );

    if (
        sourceMileage === 0 ||
        comparisonMileage === 0
    ) {

        addRow(
            rows,
            "Mileage",
            happyfox.mileage || "Not Provided",
            salesforce.mileage || "Not Provided",
            mvr.mileage || "Not Provided",
            nmvtis?.available ? (nmvtis?.mileage || "") : "",
            "⚠️",
            "Mileage comparison incomplete"
        );

        return;
    }

    const pass =
        sourceMileage >= comparisonMileage;

    addRow(
        rows,
        "Mileage",
        happyfox.mileage || "Not Provided",
        salesforce.mileage || "Not Provided",
        mvrMileage
            ? `${mvr.mileage} actual mileage / title record`
            : (mvr.mileage || "Not Provided"),
        nmvtis?.available ? (nmvtis?.mileage || "") : "",
        pass ? "✅" : "🚩",
        pass
            ? "HF/SF mileage ≥ MVR/NMVTIS"
            : "HF/SF mileage is below MVR/NMVTIS"
    );
}

function addOwnershipRows(rows, happyfox, mvr) {

    const mvrOwners =
        mvr.titleOwnerNames || [];

    const hfOwners =
        happyfox.ownerNames || [];

    const mvrOwnerText =
        mvrOwners.join("; ");

    const ownershipConnector =
        normalizeText(mvr.ownershipConnector || "");

    const ownerCountText =
        formatMvrOwnerCountText(
            mvrOwners.length,
            ownershipConnector
        );

    if (mvrOwners.length > 0) {

        addRow(
            rows,
            "Ownership",
            happyfox.ownerNamesRaw,
            "",
            mvrOwnerText,
            "",
            "✅",
            ownerCountText
        );

    }

    if (
        hfOwners.length > 0 &&
        mvrOwners.length > 0
    ) {

        const namesAligned =
            namesMostlyAlign(
                hfOwners,
                mvrOwners,
                ownershipConnector
            );

        if (!namesAligned) {

            addRow(
                rows,
                "Owner Name",
                happyfox.ownerNamesRaw,
                "",
                mvrOwnerText,
                "",
                "⚠️",
                "Owner names differ between HF and title ownership source"
            );

        }
    }
}

function formatMvrOwnerCountText(count, connector = "") {

    if (count <= 0) {
        return "";
    }

    const relationship =
        connector === "OR"
            ? " (OR)"
            : connector === "AND"
                ? " (AND)"
                : "";

    return count === 1
        ? `One titled owner${relationship}`
        : `${count} titled owners${relationship}`;
}

function addSignerRow(rows, happyfox, mvr) {

    const raw =
        happyfox.signerAvailable || "";

    const ownerCount =
        (mvr.titleOwnerNames || []).length;

    const hfOwnerCount =
        (happyfox.ownerNames || []).length;

    const effectiveOwnerCount =
        ownerCount || hfOwnerCount;

    const ownerCountText =
        formatMvrOwnerCountText(
            ownerCount,
            normalizeText(mvr.ownershipConnector || "")
        );

    const hasEntityOwner =
        (mvr.titleOwnerNames || []).some(owner =>
            isEntityOwnerName(owner)
        );

    if (!raw) {

        addRow(
            rows,
            "Signer Available",
            "Not Found",
            "",
            hasEntityOwner && ownerCount === 1
                ? `${ownerCountText} (entity)`
                : ownerCountText,
            "",
            "✅",
            effectiveOwnerCount <= 1 && !hasEntityOwner
                ? "Single listed owner; signer availability question not required"
                : "Blank signer availability accepted unless marked unavailable"
        );

        return;
    }

    const unavailable =
        isUnavailableSignerText(
            raw
        );

    addRow(
        rows,
        "Signer Available",
        raw,
        "",
        ownerCountText,
        "",
        unavailable ? "🚩" : "✅",
        unavailable
            ? "Not all titled owners are available to sign"
            : "Signer available"
    );
}

function addYearRow(rows, happyfox, salesforce, mvr, nmvtis) {

    const hfYear =
        parseYear(
            happyfox.year
        );

    const sfYear =
        parseYear(
            salesforce.year
        );

    const mvrYear =
        parseYear(
            mvr.year
        );

    const nmvtisYear =
        parseYear(
            nmvtis?.year
        );

    const availableYears =
        [
            hfYear,
            sfYear,
            mvrYear,
            nmvtisYear
        ].filter(Boolean);

    let status = "⚠️";
    let notes = "Year comparison incomplete";

    if (availableYears.length >= 2) {

        const minYear =
            Math.min(...availableYears);

        const maxYear =
            Math.max(...availableYears);

        const delta =
            maxYear - minYear;

        if (
            isTrailerClass(
                happyfox.rvClass || salesforce.classValue || mvr.body
            )
        ) {
            status = delta === 0 ? "✅" : "🚩";
            notes = delta === 0
                ? "Match across available sources"
                : "Trailer year mismatch across available sources";
        } else {
            if (delta <= 1) {
                status = "✅";
                notes = delta === 0
                    ? "Match across available sources"
                    : "Motorized year within 0–1 year tolerance across available sources";
            } else if (delta === 2) {
                status = "⚠️";
                notes = "Motorized year differs by 2 years across available sources";
            } else {
                status = "🚩";
                notes = "Motorized year differs by 3+ years across available sources";
            }
        }
    } else if (availableYears.length === 1) {
        status = "✅";
        notes = "Year present in one source; no conflicting year shown";
    }

    if (
        salesforce.rawText &&
        !sfYear &&
        status !== "🚩"
    ) {
        status = "⚠️";
        notes = "Salesforce year not visible/extracted";
    }

    addRow(
        rows,
        "Year",
        happyfox.year,
        salesforce.year,
        mvr.year,
        nmvtis?.available ? (nmvtis?.year || "") : "",
        status,
        notes
    );
}

function addVehicleIdRow(rows, happyfox, salesforce, mvr) {

    const hfVehicle =
        happyfox.makeModelTrim;

    const sfVehicle =
        salesforce.makeModelTrim;

    const mvrVehicle =
        mvr.makeModelBody;

    const availableVehicles =
        [
            hfVehicle,
            sfVehicle,
            mvrVehicle
        ].filter(Boolean);

    let status = "⚠️";
    let notes = "Vehicle identification comparison incomplete";

    if (availableVehicles.length >= 2) {

        const allVehicleTextAligned =
            vehicleTextMostlyAlign(
                availableVehicles
            );

        const hfSfAligned =
            hfVehicle &&
            sfVehicle &&
            vehicleTextMostlyAlign([
                hfVehicle,
                sfVehicle
            ]);

        if (allVehicleTextAligned) {
            status = "✅";
            notes = "Consistent vehicle identification across available sources";
        } else if (
            hfSfAligned &&
            mvrVehicleCodingDifferenceIsAcceptable(
                happyfox,
                salesforce,
                mvr
            )
        ) {
            status = "✅";
            notes = "HF/SF match; MVR title/manufacturer coding differs but VIN/year/class support the unit";
        } else {
            status = "⚠️";
            notes = "Vehicle identification differs across available sources";
        }

    } else if (availableVehicles.length === 1) {
        status = "✅";
        notes = "Vehicle identification present in one source; no conflicting vehicle identification shown";
    }

    if (
        salesforce.rawText &&
        !sfVehicle &&
        status !== "🚩"
    ) {
        status = "⚠️";
        notes = "Salesforce vehicle identification not visible/extracted";
    }

    addRow(
        rows,
        "Make / Model / Trim",
        hfVehicle,
        sfVehicle,
        mvrVehicle,
        "",
        status,
        notes
    );
}

function mvrVehicleCodingDifferenceIsAcceptable(happyfox, salesforce, mvr) {

    const hfVin =
        normalizeVin(happyfox.vin || "");

    const mvrVin =
        normalizeVin(mvr.vin || "");

    const vinConsistent =
        !hfVin ||
        !mvrVin ||
        hfVin === mvrVin;

    const availableYears =
        [
            parseYear(happyfox.year),
            parseYear(salesforce.year),
            parseYear(mvr.year)
        ].filter(Boolean);

    const yearConsistent =
        availableYears.length < 2 ||
        Math.max(...availableYears) - Math.min(...availableYears) <= 1;

    const classCategories =
        [
            happyfox.rvClass,
            salesforce.classValue,
            mvr.body
        ]
            .map(rvClassCategory)
            .filter(Boolean);

    const classConsistent =
        classCategories.length < 2 ||
        new Set(classCategories).size === 1;

    return vinConsistent &&
        yearConsistent &&
        classConsistent;
}

function addVinRow(rows, happyfox, salesforce, mvr, nmvtis) {

    const values =
        [
            happyfox.vin,
            salesforce.vin,
            mvr.vin,
            nmvtis?.available ? nmvtis?.vin : ""
        ]
            .filter(Boolean)
            .map(normalizeVin)
            .filter(Boolean);

    const unique =
        [...new Set(values)];

    let status = "⚠️";
    let notes = "VIN comparison incomplete";

    if (unique.length === 1) {
        status = "✅";
        notes = values.length >= 2
            ? "Match across available sources"
            : "VIN present in one source; no conflicting VIN shown";
    } else if (unique.length > 1) {
        status = "🚩";
        notes = "VIN mismatch across available sources";
    }

    addRow(
        rows,
        "VIN",
        happyfox.vin,
        salesforce.vin,
        mvr.vin,
        nmvtis?.available ? (nmvtis?.vin || "") : "",
        status,
        notes
    );
}

function addRvClassRow(rows, happyfox, salesforce, mvr) {

    const availableClasses =
        [
            happyfox.rvClass,
            salesforce.classValue,
            mvr.body
        ].filter(hasValue);

    let status = "⚠️";
    let notes = "Class comparison incomplete";

    if (availableClasses.length >= 2) {

        const categories =
            availableClasses
                .map(rvClassCategory)
                .filter(Boolean);

        const uniqueCategories =
            [...new Set(categories)];

        if (
            categories.length >= 2 &&
            uniqueCategories.length === 1
        ) {
            status = "✅";
            notes = categories[0] === "NON_MOTORIZED"
                ? "Non-motorized class consistent across available sources"
                : "Motorized class consistent across available sources";
        } else if (
            uniqueCategories.includes("MOTORIZED") &&
            uniqueCategories.includes("NON_MOTORIZED")
        ) {
            status = "⚠️";
            notes = "Motorized/non-motorized class conflict across available sources";
        } else if (
            vehicleTextMostlyAlign(
                availableClasses
            )
        ) {
            status = "✅";
            notes = "Class present across available sources";
        } else {
            status = "✅";
            notes = "Class detail differs, but no motorized/non-motorized conflict shown";
        }

    } else if (availableClasses.length === 1) {
        status = "✅";
        notes = "Class present in one source; no conflicting class shown";
    }

    if (
        salesforce.rawText &&
        !hasValue(salesforce.classValue) &&
        status !== "🚩"
    ) {
        status = "⚠️";
        notes = "Salesforce class not visible/extracted";
    }

    addRow(
        rows,
        "RV Class",
        happyfox.rvClass,
        salesforce.classValue,
        mvr.body,
        "",
        status,
        notes
    );
}

function addAcquisitionRow(rows, happyfox, salesforce) {

    if (!happyfox.acquisitionType && !salesforce.acquisitionType) {
        return;
    }

    const hfType =
        happyfox.acquisitionType || "";

    const sfType =
        salesforce.acquisitionType || "";

    const hfNormalized =
        normalizeAcquisitionType(
            hfType
        );

    const sfNormalized =
        normalizeAcquisitionType(
            sfType
        );

    let status = "✅";
    let notes = hfNormalized === "CONSIGNMENT"
        ? "Consignment"
        : hfNormalized === "PURCHASE"
            ? "Purchase"
            : "Acquisition type present";

    if (!sfType) {
        status = "⚠️";
        notes = "Salesforce acquisition type not visible/extracted";
    } else if (
        hfNormalized &&
        sfNormalized &&
        sfNormalized !== "MIXED" &&
        hfNormalized !== sfNormalized
    ) {
        status = "🚩";
        notes = "HappyFox and Salesforce acquisition type differ";
    }

    addRow(
        rows,
        "Acquisition Type",
        hfType,
        sfType,
        "",
        "",
        status,
        notes
    );
}

function normalizeAcquisitionType(value) {

    const upper =
        normalizeText(value);

    if (
        upper.includes("CONSIGN") &&
        upper.includes("PURCHASE")
    ) {
        return "MIXED";
    }

    if (upper.includes("CONSIGN")) {
        return "CONSIGNMENT";
    }

    if (upper.includes("PURCHASE")) {
        return "PURCHASE";
    }

    return "";
}

function addTitleStateRow(rows, happyfox, mvr, nmvtis, context) {

    const hfState =
        normalizeState(
            happyfox.titleState ||
            context.state
        );

    const mvrState =
        normalizeState(
            mvr.state
        );

    const nmvtisState =
        nmvtis?.available && !isTrailerClass(
            happyfox.rvClass
        )
            ? (mvrState || hfState)
            : "";

    const status =
        !hfState || !mvrState || hfState === mvrState
            ? "✅"
            : "🚩";

    addRow(
        rows,
        "Title State",
        hfState,
        "",
        mvrState
            ? `${mvrState} Title Record`
            : "",
        nmvtisState
            ? `${nmvtisState} title record`
            : "",
        status,
        status === "✅"
            ? "Match"
            : "Title state mismatch"
    );
}

function addTitleRecordRow(rows, mvr) {

    if (!mvr?.rawText) {
        return;
    }

    const hasTitleNumber =
        Boolean(mvr.titleHasNumber);

    const hasIssueDate =
        Boolean(mvr.titleHasIssueDate);

    const status =
        hasTitleNumber || hasIssueDate
            ? "✅"
            : "🚩";

    const mvrValue =
        [
            hasTitleNumber
                ? `Title ${mvr.titleNumber}`
                : "Title number not provided",
            hasIssueDate
                ? `Issue Date ${mvr.titleIssueDate}`
                : "Issue date not provided"
        ].join("; ");

    addRow(
        rows,
        "Title Record",
        "",
        "",
        mvrValue,
        "",
        status,
        status === "✅"
            ? "Title number or issue date present"
            : "Title number and issue date are both not provided"
    );
}


function addMvrConditionRow(rows, mvr) {

    const conditions =
        Array.isArray(mvr?.conditions)
            ? mvr.conditions.filter(Boolean)
            : [];

    if (!conditions.length && !mvr?.conditionStatusText) {
        return;
    }

    const conditionText =
        conditions.length
            ? conditions.join("; ")
            : mvr.conditionStatusText;

    addRow(
        rows,
        "MVR Conditions",
        "",
        "",
        conditionText,
        "",
        "🚩",
        `MVR condition present: ${conditionText}`
    );
}

function addBrandingRow(rows, mvr, nmvtis) {

    const mvrBranding =
        mvr.branding || "";

    const nmvtisBranding =
        nmvtis?.available
            ? (nmvtis?.branding || "")
            : "";

    const hasBrand =
        isBrandingBad(
            mvrBranding
        ) ||
        isBrandingBad(
            nmvtisBranding
        );

    addRow(
        rows,
        "Branding",
        "",
        "",
        mvrBranding || "Not shown",
        nmvtisBranding || "",
        hasBrand ? "🚩" : "✅",
        hasBrand
            ? "Branding present"
            : "No brands present"
    );
}

function addLocationRows(rows, happyfox, salesforce) {

    if (happyfox.sfLocation || salesforce.sfLocation) {

        let status = "✅";
        let notes = "Present";

        if (!salesforce.sfLocation) {
            status = "⚠️";
            notes = "Salesforce SF Location not visible/extracted";
        } else if (!happyfox.sfLocation) {
            status = "⚠️";
            notes = "HappyFox SF Location not visible/extracted";
        } else if (
            !vehicleTextMostlyAlign([
                happyfox.sfLocation,
                salesforce.sfLocation
            ])
        ) {
            status = "⚠️";
            notes = "HappyFox and Salesforce SF Location differ";
        }

        addRow(
            rows,
            "SF Location",
            happyfox.sfLocation,
            salesforce.sfLocation,
            "",
            "",
            status,
            notes
        );

    } else {

        addRow(
            rows,
            "SF Location",
            "Not Found",
            "Not Found",
            "",
            "",
            "⚠️",
            "SF Location missing"
        );

    }

    if (happyfox.glLocation) {

        addRow(
            rows,
            "GL Location",
            happyfox.glLocation,
            "",
            "",
            "",
            "✅",
            "Present"
        );

    } else {

        addRow(
            rows,
            "GL Location",
            "Not Found",
            "",
            "",
            "",
            "⚠️",
            "GL Location missing"
        );

    }
}

function addAddressRow(rows, happyfox, mvr) {

    if (!happyfox.address) {
        return;
    }

    addRow(
        rows,
        "Address",
        happyfox.address,
        "",
        mvr.rawText && mvr.rawText.toUpperCase().includes("ADDRESS")
            ? "Owner address on MVR"
            : "",
        "",
        "✅",
        "No material conflict detected"
    );
}

function addEmailRow(rows, happyfox, salesforce) {

    if (!happyfox.email && !salesforce.email) {
        return;
    }

    addRow(
        rows,
        "Email",
        happyfox.email || "",
        salesforce.email || "",
        "",
        "",
        "✅",
        happyfox.email && salesforce.email
            ? "Customer emails present"
            : "Customer email present in one system"
    );
}


function isEntityOwnerName(value) {

    const upper = normalizeText(value);

    return /\b(L\.?L\.?C\.?|INC\.?|CORP\.?|CORPORATION|COMPANY|CO\.?|TRUST|LTD\.?|LIMITED|PARTNERSHIP|LP|LLP)\b/.test(upper);
}

function buildDocumentSelection(happyfox, mvr) {

    const docs = [];
    const deficiencyMethods = [];
    let note = "";

    const owners =
        mvr.titleOwnerNames || [];

    const hasEntityOwner =
        owners.some(owner =>
            isEntityOwnerName(owner)
        );

    const ownerDocumentCount =
        mvr.ownershipConnector === "OR"
            ? Math.max(
                1,
                (happyfox.ownerNames || []).length || 1
            )
            : owners.length;

    if (ownerDocumentCount >= 1) {
        docs.push("Owner’s Driver License (Front + Back)");
    }

    if (ownerDocumentCount >= 2) {
        docs.push("Co-Owner Driver License (Front + Back)");
    }

    if (ownerDocumentCount > 2) {
        docs.push("Other");
    }

    const titleState =
        normalizeState(
            happyfox.titleState ||
            mvr.state
        );

    const hasActiveLien =
        mvr.lienPresent === true ||
        happyfox.lien === true;

    if (
        REGISTRATION_REQUIRED_STATES.has(
            titleState
        )
    ) {
        docs.push("Registration");
    }

    if (hasActiveLien) {

        docs.push(
            "Most Recent Loan Statement (all pages)"
        );

        if (
            TITLE_HOLDING_STATES.has(
                titleState
            )
        ) {

            docs.push("Title (Front + Back)");

            note =
                `Active lien exists and ${titleState} is a title-holding state under the provided rules, therefore Title (Front + Back) is required.`;

        } else {

            note =
                `Active lien exists and ${titleState || "the title state"} is a non-title-holding state under the provided rules, therefore Title (Front + Back) is not required.`;

        }

    } else {

        docs.push("Title (Front + Back)");

    }

    const payoff =
        parseMoney(
            happyfox.estimatedPayoff
        );

    const offer =
        parseMoney(
            happyfox.scheduledOffer
        );

    const escrow =
        parseMoney(
            happyfox.escrow
        ) || 0;

    const declaredDeficiency =
        parseYesNo(
            happyfox.owesMoreThanOffer
        ) === true;

    const hasDeficiency =
        declaredDeficiency ||
        (
            payoff !== null &&
            offer !== null &&
            payoff > offer + escrow
        );

    const paymentOption =
        normalizePayoffPaymentOption(
            happyfox.paymentOption
        );

    if (
        hasActiveLien &&
        isConsignment(
            happyfox.acquisitionType
        )
    ) {

        if (paymentOption === "ESCROW_HOLDBACK") {
            docs.push("Cashier Check (consignment deficiency only)");
            deficiencyMethods.push("✅ Consignment Escrow Holdback");
        } else if (paymentOption === "LOAN_PAYDOWN") {
            docs.push("Loan Statement Reflecting Deficiency Payment");
            deficiencyMethods.push("✅ Consignment Loan Paydown");
        } else if (hasDeficiency) {
            deficiencyMethods.push("🚩 Not selected");
        }

    } else if (
        hasActiveLien &&
        hasDeficiency &&
        isPurchaseAcquisition(
            happyfox.acquisitionType
        )
    ) {
        deficiencyMethods.push("✅ Purchase 20-day payoff quote");
    }

    if (
        isConsignment(
            happyfox.acquisitionType
        )
    ) {
        docs.push("Insurance");
    }

    const ownerText =
        owners.join(" ").toUpperCase();

    const titleOwnerType =
        normalizeText(
            happyfox.titleOwnerType ||
            happyfox.rawFields?.["Is the title in a private party name or business name?"] ||
            ""
        );

    const titleIndicatesTrust =
        ownerText.includes("TRUST") ||
        titleOwnerType.includes("TRUST");

    if (
        ownerText.includes("LLC") ||
        ownerText.includes("L.L.C")
    ) {
        docs.push("LLC Membership Docs");
    }

    if (
        titleIndicatesTrust
    ) {
        docs.push("Trust Docs");
    }

    if (
        hasEntityOwner &&
        !ownerText.includes("LLC") &&
        !ownerText.includes("L.L.C") &&
        !titleIndicatesTrust
    ) {
        docs.push("Entity Authorization Docs");
    }

    const uniqueDocs =
        [...new Set(docs)];

    const uniqueDeficiencyMethods =
        [...new Set(deficiencyMethods)];

    return {
        lines:
            uniqueDocs.map(doc =>
                `✅ ${doc}`
            ),
        deficiencyMethodLines: uniqueDeficiencyMethods,
        note
    };
}

function buildMarkdownTable(rows) {

    const header =
        "| Field | HappyFox | Salesforce | MVR / Manual | NVITAS | Status | Notes |";

    const separator =
        "|---|---|---|---|---|---|---|";

    return [
        header,
        separator,
        ...rows.map(row =>
            `| ${escapeTable(row.field)} | ${escapeTable(row.happyfox)} | ${escapeTable(row.salesforce)} | ${escapeTable(row.mvrManual)} | ${escapeTable(row.nmvtis)} | ${row.status} | ${escapeTable(row.notes)} |`
        )
    ].join("\n");
}

//
// TEXT EXTRACTION FROM TABS
//

async function activateTabForScraping(tabId, waitMs = 2500) {

    try {
        const targetTab =
            await chrome.tabs.get(
                tabId
            );

        if (targetTab?.windowId) {
            await chrome.windows.update(
                targetTab.windowId,
                {
                    focused: true
                }
            );
        }

        await chrome.tabs.update(
            tabId,
            {
                active: true
            }
        );

        await delay(waitMs);

    } catch (err) {
        console.warn(
            "Open Review could not activate tab before scraping:",
            err
        );
    }
}

async function scrapeSalesforceFieldMap(tabId, options = {}) {

    const keepActive =
        Boolean(options.keepActive);

    const warmupMs =
        Number(options.warmupMs ?? 2200);

    await waitForTabLoad(
        tabId,
        25000
    );

    let originalActiveTabId = null;
    let originalWindowId = null;

    try {
        const [activeTab] =
            await chrome.tabs.query({
                active: true,
                currentWindow: true
            });

        originalActiveTabId = activeTab?.id || null;
        originalWindowId = activeTab?.windowId || null;

        const targetTab =
            await chrome.tabs.get(tabId);

        if (targetTab?.windowId) {
            await chrome.windows.update(
                targetTab.windowId,
                { focused: true }
            );
        }

        await chrome.tabs.update(
            tabId,
            { active: true }
        );

        await delay(warmupMs);
    } catch (err) {
        console.warn("Open Review could not activate Salesforce tab before scraping:", err);
    }

    const [result] =
        await chrome.scripting.executeScript({
            target: {
                tabId
            },
            world: "MAIN",
            func: async (scrapeOptions = {}) => {

                const maxPasses = Math.max(1, Number(scrapeOptions.maxPasses || 2));
                const scrollDelayMs = Math.max(80, Number(scrapeOptions.scrollDelayMs || 140));
                const clickDelayMs = Math.max(50, Number(scrapeOptions.clickDelayMs || 80));
                const detailsDelayMs = Math.max(250, Number(scrapeOptions.detailsDelayMs || 450));
                const sectionDelayMs = Math.max(80, Number(scrapeOptions.sectionDelayMs || 120));
                const stepRatio = Math.max(0.45, Math.min(1.2, Number(scrapeOptions.stepRatio || 0.9)));

                const sleep = ms =>
                    new Promise(resolve =>
                        setTimeout(resolve, ms)
                    );

                const clean = value =>
                    String(value ?? "")
                        .replace(/\s+/g, " ")
                        .trim();

                try {
                    window.focus();
                    document.documentElement?.focus?.();
                    document.body?.focus?.();
                } catch (err) {
                    // ignore focus failures inside Salesforce
                }

                const allElements = (root = document) => {
                    const out = [];

                    const walk = node => {
                        if (!node) {
                            return;
                        }

                        if (node.nodeType === Node.ELEMENT_NODE) {
                            out.push(node);

                            if (node.shadowRoot) {
                                walk(node.shadowRoot);
                            }
                        }

                        for (const child of node.children || []) {
                            walk(child);
                        }
                    };

                    walk(root.documentElement || root);
                    return out;
                };

                const textOf = el =>
                    clean(el?.innerText || el?.textContent || "");

                const isVisible = el => {
                    try {
                        if (!el || !el.isConnected) {
                            return false;
                        }

                        const rect = el.getBoundingClientRect?.();

                        if (!rect || rect.width <= 0 || rect.height <= 0) {
                            return false;
                        }

                        const style = getComputedStyle(el);

                        return style.visibility !== "hidden" &&
                            style.display !== "none" &&
                            Number(style.opacity || 1) !== 0;
                    } catch (err) {
                        return false;
                    }
                };

                const isDangerousSalesforceAction = el => {
                    if (!el) {
                        return false;
                    }

                    const combined = clean([
                        el.getAttribute?.("aria-label"),
                        el.getAttribute?.("title"),
                        el.getAttribute?.("name"),
                        el.getAttribute?.("data-aura-class"),
                        textOf(el)
                    ].filter(Boolean).join(" "));

                    // Never click Salesforce record action buttons while scraping.
                    // v2.18 could accidentally match "Send/Get True Values" while
                    // looking for the "True Values" section header and repeatedly
                    // trigger that action. Scraping should only navigate/scroll.
                    return /\b(Send\s+for\s+True\s+Values|Get\s+J\.?\s*D\.?\s*Power\s+Value|Get\s+True\s+Values|Schedule\s+Appointment|Trade\s+to\s+VIN|Send\s+Deal\s+Summary|Change\s+Owner|RVC|Show\s+more\s+actions)\b/i.test(combined);
                };

                const clickSafely = async el => {
                    if (!el || !isVisible(el) || isDangerousSalesforceAction(el)) {
                        return false;
                    }

                    try {
                        el.scrollIntoView({
                            block: "center",
                            inline: "nearest"
                        });
                    } catch (err) {
                        // ignore scrollIntoView failures
                    }

                    await sleep(clickDelayMs);

                    try {
                        el.click();
                        return true;
                    } catch (err) {
                        try {
                            el.dispatchEvent(
                                new MouseEvent(
                                    "click",
                                    {
                                        bubbles: true,
                                        cancelable: true,
                                        view: window
                                    }
                                )
                            );
                            return true;
                        } catch (innerErr) {
                            return false;
                        }
                    }
                };

                const findInside = (el, selectors) => {
                    const nodes = allElements(el);

                    for (const selector of selectors) {
                        const found = nodes.find(node => {
                            try {
                                return node.matches?.(selector);
                            } catch {
                                return false;
                            }
                        });

                        if (found) {
                            return found;
                        }
                    }

                    return null;
                };

                const stripForValue = (value, label = "") => {
                    let cleaned = clean(value);
                    const safeLabel = clean(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

                    if (safeLabel) {
                        cleaned = cleaned.replace(new RegExp(`^${safeLabel}\\s+`, "i"), "");
                    }

                    cleaned = cleaned
                        .replace(/\bPreview\b/g, "")
                        .replace(/\bChange Record Type\b/gi, "")
                        .replace(/\bChange Owner\b/gi, "")
                        .replace(/\bEdit [A-Za-z0-9 /()&,'-]+$/i, "")
                        .replace(/\bHelp [A-Za-z0-9 /()&,'-]+/gi, "")
                        .replace(/\s+/g, " ")
                        .trim();

                    if (cleaned && clean(label) && cleaned.toLowerCase() === clean(label).toLowerCase()) {
                        return "";
                    }

                    return cleaned;
                };

                const labelFromField = (el, fallback) => {
                    const labelNode = findInside(el, [
                        ".test-id__field-label-container",
                        ".slds-form-element__label",
                        "[field-label]"
                    ]);

                    return textOf(labelNode) ||
                        clean(el.getAttribute?.("field-label")) ||
                        fallback ||
                        "";
                };

                const valueFromField = (el, label) => {
                    const valueNode = findInside(el, [
                        ".test-id__field-value",
                        "lightning-formatted-text",
                        "lightning-formatted-number",
                        "lightning-formatted-url",
                        "lightning-formatted-email",
                        "records-hoverable-link",
                        ".slds-form-element__control"
                    ]);

                    return stripForValue(
                        textOf(valueNode) || textOf(el),
                        label
                    );
                };

                const collectFields = () => {
                    const fields = [];

                    for (const el of allElements(document)) {

                        const target =
                            el.getAttribute?.("data-target-selection-name") || "";

                        if (!target.startsWith("sfdc:RecordField.")) {
                            continue;
                        }

                        const match =
                            target.match(/^sfdc:RecordField\.([^.]+)\.(.+)$/);

                        if (!match) {
                            continue;
                        }

                        const objectApiName = match[1];
                        const fieldApiName = match[2];
                        const label = labelFromField(el, fieldApiName);
                        const value = valueFromField(el, label);

                        fields.push({
                            objectApiName,
                            fieldApiName,
                            label,
                            value,
                            text: textOf(el)
                        });
                    }

                    return fields;
                };

                const clickDetailsTab = async () => {
                    const candidates = allElements(document)
                        .filter(el => {
                            const role = clean(el.getAttribute?.("role"));
                            const label = clean(el.getAttribute?.("aria-label"));
                            const title = clean(el.getAttribute?.("title"));
                            const txt = textOf(el);
                            const combined = clean(`${label} ${title} ${txt}`);

                            if (!/\bDetails\b/i.test(combined)) {
                                return false;
                            }

                            return role === "tab" ||
                                ["A", "BUTTON"].includes(el.tagName) ||
                                el.getAttribute?.("data-tab-name") ||
                                /tab/i.test(clean(el.className?.toString?.() || ""));
                        })
                        .sort((a, b) => {
                            const aRole = clean(a.getAttribute?.("role"));
                            const bRole = clean(b.getAttribute?.("role"));
                            return (bRole === "tab") - (aRole === "tab");
                        });

                    for (const el of candidates) {
                        if (clean(el.getAttribute?.("aria-selected")) === "true") {
                            return true;
                        }

                        if (await clickSafely(el)) {
                            await sleep(detailsDelayMs);
                            return true;
                        }
                    }

                    return false;
                };

                const clickUsefulSections = async () => {
                    // Only expand real Salesforce section headers. Do NOT click broad
                    // matches like record action buttons. This is intentionally stricter
                    // than v2.18 because clicking "Send/Get True Values" is harmful.
                    const wanted = [
                        /^Lead Details$/i,
                        /^Values$/i,
                        /^Comments$/i,
                        /^RV Details$/i,
                        /^Unit Info(?: & Red Flags)?$/i,
                        /^Unit Info & Red Flags$/i,
                        /^Inspection Reports$/i,
                        /^True Values$/i,
                        /^True Consignment Values$/i,
                        /^True ACV Values$/i,
                        /^Previous True Values$/i,
                        /^IDS Asset Details$/i,
                        /^System Information$/i
                    ];

                    const elements = allElements(document);

                    for (const header of elements) {
                        const txt = textOf(header);

                        if (!txt || txt.length > 80) {
                            continue;
                        }

                        if (!wanted.some(re => re.test(txt))) {
                            continue;
                        }

                        if (!isVisible(header)) {
                            continue;
                        }

                        const clickTarget =
                            header.closest?.("button[aria-expanded],[role='button'][aria-expanded],.slds-section__title-action[aria-expanded]") ||
                            null;

                        if (!clickTarget || isDangerousSalesforceAction(clickTarget)) {
                            continue;
                        }

                        const ariaExpanded = clickTarget.getAttribute?.("aria-expanded");

                        if (ariaExpanded !== "false") {
                            continue;
                        }

                        await clickSafely(clickTarget);
                        await sleep(sectionDelayMs);
                    }
                };

                const getScrollers = () => {
                    const scrollers = [
                        document.scrollingElement,
                        document.documentElement,
                        document.body
                    ];

                    for (const el of allElements(document)) {
                        try {
                            if (!isVisible(el)) {
                                continue;
                            }

                            const style = getComputedStyle(el);
                            const canScroll =
                                (el.scrollHeight || 0) > (el.clientHeight || 0) + 150 &&
                                /(auto|scroll)/i.test(`${style.overflowY} ${style.overflow}`);

                            if (canScroll) {
                                scrollers.push(el);
                            }
                        } catch (err) {
                            // ignore
                        }
                    }

                    return [...new Set(scrollers.filter(Boolean))];
                };

                const scrollToY = async (scroller, y) => {
                    try {
                        if (scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body) {
                            window.scrollTo(0, y);
                        } else {
                            scroller.scrollTop = y;
                        }
                    } catch (err) {
                        // ignore
                    }
                    await sleep(scrollDelayMs);
                };

                const targetReady = fields => {
                    const apiNames = new Set(
                        fields.map(field => field.fieldApiName)
                    );

                    return apiNames.has("Class__c") &&
                        apiNames.has("Model_Year__c") &&
                        apiNames.has("Make_Name__c") &&
                        apiNames.has("Location_Account__c") &&
                        (
                            apiNames.has("Buy_Outright_Value__c") ||
                            apiNames.has("Consignment_Value__c") ||
                            apiNames.has("Expiration_Date__c")
                        );
                };

                const allFields = [];
                const textSnapshots = [];

                const captureSnapshot = () => {
                    allFields.push(...collectFields());
                    textSnapshots.push(
                        document.body?.innerText ||
                        document.body?.textContent ||
                        ""
                    );
                };

                captureSnapshot();

                if (!targetReady(allFields)) {
                    await clickDetailsTab();
                    await sleep(detailsDelayMs);
                    captureSnapshot();
                }

                if (!targetReady(allFields)) {
                    await clickUsefulSections();
                    await sleep(sectionDelayMs);
                    captureSnapshot();
                }

                // Salesforce Lightning often lazy-renders record layout fields only when
                // its internal scroll containers are visible and scrolled, not the window.
                // Walk scrollable containers, but bail out as soon as the fields we need exist.
                for (let pass = 0; pass < maxPasses && !targetReady(allFields); pass++) {
                    const scrollers = getScrollers();

                    for (const scroller of scrollers) {
                        if (targetReady(allFields)) {
                            break;
                        }
                        const maxScroll = Math.max(
                            scroller?.scrollHeight || document.body?.scrollHeight || 0,
                            document.documentElement?.scrollHeight || 0
                        );

                        const step = Math.max(500, Math.floor((window.innerHeight || 800) * stepRatio));

                        for (let y = 0; y <= maxScroll + step; y += step) {
                            await scrollToY(scroller, y);

                            if (!targetReady(allFields)) {
                                await clickUsefulSections();
                            }

                            captureSnapshot();

                            if (targetReady(allFields)) {
                                break;
                            }
                        }
                    }
                }

                const deduped = [];
                const seen = new Set();

                for (const field of allFields) {
                    const key = [
                        field.objectApiName,
                        field.fieldApiName,
                        field.value,
                        field.text
                    ].join("|");

                    if (seen.has(key)) {
                        continue;
                    }

                    seen.add(key);
                    deduped.push(field);
                }

                return {
                    generatedAt: new Date().toISOString(),
                    url: location.href,
                    title: document.title,
                    recordId:
                        (location.href.match(/\b[a-zA-Z0-9]{15,18}\b/) || [])[0] || "",
                    text: [
                        ...new Set(
                            textSnapshots
                                .join("\n")
                                .split(/\r?\n/)
                                .map(line => clean(line))
                                .filter(Boolean)
                        )
                    ].join("\n"),
                    fields: deduped
                };
            },
            args: [
                {
                    maxPasses: options.maxPasses,
                    scrollDelayMs: options.scrollDelayMs,
                    clickDelayMs: options.clickDelayMs,
                    detailsDelayMs: options.detailsDelayMs,
                    sectionDelayMs: options.sectionDelayMs,
                    stepRatio: options.stepRatio
                }
            ]
        });

    try {
        if (!keepActive && originalActiveTabId && originalActiveTabId !== tabId) {
            if (originalWindowId) {
                await chrome.windows.update(
                    originalWindowId,
                    { focused: true }
                );
            }

            await chrome.tabs.update(
                originalActiveTabId,
                { active: true }
            );
        }
    } catch (err) {
        // ignore restore failures
    }

    return result?.result || {
        text: "",
        fields: []
    };
}

async function scrapeSalesforceText(tabId) {

    try {

        await waitForTabLoad(
            tabId
        );

        await delay(3000);

        const result =
            await chrome.scripting.executeScript({
                target: {
                    tabId
                },
                func: async () => {

                    const sleep = ms =>
                        new Promise(resolve =>
                            setTimeout(resolve, ms)
                        );

                    const normalize = value =>
                        (value || "")
                            .toString()
                            .replace(/\s+/g, " ")
                            .trim();

                    const normalizeKey = value =>
                        normalize(value)
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, " ")
                            .trim();

                    const noiseWords = new Set([
                        "edit",
                        "account",
                        "actions",
                        "show actions",
                        "column actions",
                        "intent",
                        "intent intent",
                        "intent intent intent"
                    ]);

                    const isNoise = value => {
                        const key = normalizeKey(value);
                        return !key || noiseWords.has(key);
                    };

                    const isElementVisible = el => {
                        if (!el || el.nodeType !== Node.ELEMENT_NODE) {
                            return false;
                        }

                        const style = window.getComputedStyle(el);

                        if (
                            style.display === "none" ||
                            style.visibility === "hidden" ||
                            Number(style.opacity) === 0
                        ) {
                            return false;
                        }

                        const rect = el.getBoundingClientRect();

                        return rect.width > 0 && rect.height > 0;
                    };

                    const walkElements = root => {
                        const found = [];
                        const stack = [root];
                        const seen = new Set();

                        while (stack.length) {
                            const current = stack.pop();

                            if (!current || seen.has(current)) {
                                continue;
                            }

                            seen.add(current);

                            if (current.nodeType === Node.ELEMENT_NODE) {
                                found.push(current);

                                if (current.shadowRoot) {
                                    stack.push(current.shadowRoot);
                                }
                            }

                            const children =
                                current.children ||
                                current.querySelectorAll?.(":scope > *") ||
                                [];

                            for (let i = children.length - 1; i >= 0; i--) {
                                stack.push(children[i]);
                            }
                        }

                        return found;
                    };

                    const collectText = () => {

                        const parts = [
                            document.body?.innerText || ""
                        ];

                        walkElements(document.body)
                            .forEach(el => {

                                const pieces = [
                                    el.innerText,
                                    el.textContent,
                                    el.value,
                                    el.title,
                                    el.getAttribute?.("aria-label"),
                                    el.getAttribute?.("data-value"),
                                    el.getAttribute?.("data-label"),
                                    el.getAttribute?.("name")
                                ];

                                pieces
                                    .filter(Boolean)
                                    .map(normalize)
                                    .filter(piece =>
                                        piece &&
                                        piece.length <= 250
                                    )
                                    .forEach(piece =>
                                        parts.push(piece)
                                    );
                            });

                        return parts.join("\n");
                    };

                    const collectVisibleItems = () => {
                        const items = [];
                        const seen = new Set();

                        walkElements(document.body)
                            .forEach(el => {

                                if (!isElementVisible(el)) {
                                    return;
                                }

                                const rect = el.getBoundingClientRect();

                                const values = [
                                    el.innerText,
                                    el.textContent,
                                    el.value,
                                    el.title,
                                    el.getAttribute?.("aria-label"),
                                    el.getAttribute?.("data-value")
                                ]
                                    .filter(Boolean)
                                    .map(normalize)
                                    .filter(value =>
                                        value &&
                                        value.length <= 90 &&
                                        !value.includes("\n") &&
                                        !isNoise(value)
                                    );

                                values.forEach(value => {
                                    const key = [
                                        value,
                                        Math.round(rect.top),
                                        Math.round(rect.left),
                                        Math.round(rect.width),
                                        Math.round(rect.height)
                                    ].join("|");

                                    if (!seen.has(key)) {
                                        seen.add(key);
                                        items.push({
                                            text: value,
                                            key: normalizeKey(value),
                                            left: rect.left,
                                            right: rect.right,
                                            top: rect.top,
                                            bottom: rect.bottom,
                                            width: rect.width,
                                            height: rect.height,
                                            centerY: rect.top + rect.height / 2
                                        });
                                    }
                                });
                            });

                        return items.sort((a, b) =>
                            Math.abs(a.top - b.top) < 6
                                ? a.left - b.left
                                : a.top - b.top
                        );
                    };

                    const labelSpecs = [
                        ["Class", ["class"]],
                        ["Model Year", ["model year"]],
                        ["Make Name", ["make name"]],
                        ["Model Name", ["model name"]],
                        ["Trim Name", ["trim name"]],
                        ["Mileage", ["mileage"]],
                        ["Consignment VIN", ["consignment vin"]],
                        ["Vehicle Condition", ["vehicle condition"]],
                        ["Year", ["year"]],
                        ["Manufacturer", ["manufacturer"]],
                        ["Brand", ["brand"]],
                        ["Model", ["model"]],
                        ["Expiration Date", ["expiration date"]],
                        ["True Consignment Amount", ["true consignment amount"]],
                        ["True Purchase Amount", ["true purchase amount"]],
                        ["JD Power Value", ["jd power value", "j d power value"]],
                        ["SF Location", ["sf location", "salesforce location", "location"]]
                    ];

                    const labelKeys = new Set(
                        labelSpecs.flatMap(spec => spec[1])
                    );

                    const looksLikeValue = value => {
                        const key = normalizeKey(value);

                        if (!key || isNoise(value) || labelKeys.has(key)) {
                            return false;
                        }

                        if (/^[✎🖉🖊]+$/.test(value)) {
                            return false;
                        }

                        return true;
                    };

                    const valueForLabel = (items, labelItem) => {
                        const sameRow =
                            items
                                .filter(candidate =>
                                    candidate !== labelItem &&
                                    candidate.left > labelItem.right + 6 &&
                                    Math.abs(candidate.centerY - labelItem.centerY) <= Math.max(12, labelItem.height * 0.8) &&
                                    looksLikeValue(candidate.text)
                                )
                                .sort((a, b) => a.left - b.left);

                        if (sameRow.length) {
                            return sameRow[0].text;
                        }

                        const below =
                            items
                                .filter(candidate =>
                                    candidate !== labelItem &&
                                    candidate.top > labelItem.bottom &&
                                    candidate.top - labelItem.bottom < 45 &&
                                    Math.abs(candidate.left - labelItem.left) < 260 &&
                                    looksLikeValue(candidate.text)
                                )
                                .sort((a, b) =>
                                    a.top - b.top ||
                                    a.left - b.left
                                );

                        return below[0]?.text || "";
                    };

                    const collectStructuredText = () => {
                        const items = collectVisibleItems();
                        const lines = [];
                        const emitted = new Set();

                        for (const [canonical, aliases] of labelSpecs) {

                            const labelItems =
                                items.filter(item =>
                                    aliases.includes(item.key)
                                );

                            for (const labelItem of labelItems) {
                                const value =
                                    valueForLabel(
                                        items,
                                        labelItem
                                    );

                                if (!value) {
                                    lines.push(canonical);
                                    continue;
                                }

                                const line = `${canonical} ${value}`;
                                const key = `${canonical}|${value}`;

                                if (!emitted.has(key)) {
                                    emitted.add(key);
                                    lines.push(line);
                                }
                            }
                        }

                        return lines.join("\n");
                    };

                    const maybeOpenUsefulSections = () => {

                        const wanted =
                            /true\s+values?|unit\s+info|red\s+flags|vehicle|asset|detail|valuation|nada|jd\s*power/i;

                        walkElements(document.body)
                            .filter(el =>
                                ["BUTTON", "A"].includes(el.tagName)
                            )
                            .forEach(el => {

                                const text = [
                                    el.innerText,
                                    el.textContent,
                                    el.title,
                                    el.getAttribute?.("aria-label")
                                ]
                                    .filter(Boolean)
                                    .join(" ");

                                if (
                                    wanted.test(text) &&
                                    el.getAttribute("aria-expanded") === "false"
                                ) {
                                    try {
                                        el.click();
                                    } catch (err) {
                                        // ignore click failures on Salesforce controls
                                    }
                                }
                            });
                    };

                    const snapshots = [];

                    window.scrollTo(0, 0);
                    await sleep(800);

                    for (let i = 0; i < 32; i++) {

                        maybeOpenUsefulSections();
                        await sleep(450);

                        snapshots.push(
                            collectStructuredText()
                        );

                        snapshots.push(
                            collectText()
                        );

                        const maxScroll =
                            Math.max(
                                document.body?.scrollHeight || 0,
                                document.documentElement?.scrollHeight || 0
                            );

                        const currentY =
                            window.scrollY ||
                            document.documentElement.scrollTop ||
                            0;

                        const nextY =
                            currentY +
                            Math.max(
                                450,
                                Math.floor(window.innerHeight * 0.65)
                            );

                        if (
                            currentY >= maxScroll - window.innerHeight - 40
                        ) {
                            break;
                        }

                        window.scrollTo(0, nextY);
                        await sleep(700);
                    }

                    return [
                        ...new Set(
                            snapshots
                                .join("\n")
                                .split(/\r?\n/)
                                .map(line =>
                                    line.replace(/\s+/g, " ").trim()
                                )
                                .filter(Boolean)
                        )
                    ].join("\n");
                }
            });

        const text =
            result?.[0]?.result || "";

        if (text.trim().length > 50) {
            return text;
        }

        return await scrapeTabText(
            tabId,
            5000
        );

    } catch (err) {

        console.error(
            "SALESFORCE SCRAPE ERROR:",
            err
        );

        return "";
    }
}


async function scrapeMvrStructured(tabId, timeoutMs = 45000, vin = "") {

    const startedAt =
        Date.now();

    while (
        Date.now() - startedAt < timeoutMs
    ) {

        try {

            await waitForTabLoad(
                tabId
            );

            const [result] =
                await chrome.scripting.executeScript({
                    target: {
                        tabId
                    },
                    func: () => {

                        const clean = value =>
                            String(value ?? "")
                                .replace(/\s+/g, " ")
                                .trim();

                        const rawText =
                            document.body?.innerText ||
                            document.body?.textContent ||
                            "";

                        const lines =
                            rawText
                                .split(/\r?\n/)
                                .map(clean)
                                .filter(Boolean);

                        const readOwners = () => {
                            const titleOwners = [];
                            const registrationOwners = [];
                            const paperTitleOwners = [];
                            const allOwners = [];
                            const lienholders = [];

                            const recentInterestSection = index => {
                                for (let j = index - 1; j >= Math.max(0, index - 5); j--) {
                                    const prev = clean(lines[j]);
                                    if (/^(REGISTRATION(?:\s+AND\s+.*TITLE\*?)?|ELECTRONIC TITLE|TITLE\*?)$/i.test(prev)) {
                                        return prev.toUpperCase();
                                    }
                                    if (/^(Vehicle|Title|Insurance|Estimated Fees)$/i.test(prev)) break;
                                }
                                return "";
                            };

                            const nextName = start => {
                                const parts = [];

                                const isStopOrField = value =>
                                    !value ||
                                    /^(Address|Mailing|Sex Code|Date of Birth|Customer Type|Customer Number|Joint Ownership|Vehicle Number|Registration Number|Driver License|Residence|Conjunction|County|Show \d+ Empty Fields|Plate|Issue Date|Status|Reg Exp\. Date):?$/i.test(value);

                                for (let i = start; i < Math.min(lines.length, start + 8); i++) {
                                    const value = clean(lines[i]);

                                    if (isStopOrField(value)) {
                                        if (parts.length) {
                                            break;
                                        }
                                        continue;
                                    }

                                    if (/^Lien Holder(?:\s+\d+\s+of\s+\d+)?$/i.test(value)) {
                                        return "";
                                    }

                                    if (/^(Owner|Title Owner|Registration Owner)(?:\s+\d+\s+of\s+\d+)?$/i.test(value)) {
                                        if (parts.length) {
                                            break;
                                        }
                                        continue;
                                    }

                                    if (/\d/.test(value) && !/\b(LLC|INC|CORP|TRUST|BANK|CREDIT UNION)\b/i.test(value)) {
                                        if (parts.length) {
                                            break;
                                        }
                                        continue;
                                    }

                                    parts.push(value);

                                    if (parts.length >= 4) {
                                        break;
                                    }
                                }

                                return clean(parts.join(" "));
                            };

                            const previousMeaningful = index => {
                                for (let j = index - 1; j >= 0; j--) {
                                    const previous = clean(lines[j]);
                                    if (previous) return previous.toUpperCase();
                                }
                                return "";
                            };

                            const isInterestFieldValue = index =>
                                /^(TYPE|RELATIONSHIP|NAME CODE|COUNTY):?$/.test(previousMeaningful(index));

                            for (let i = 0; i < lines.length; i++) {
                                const line = clean(lines[i]);

                                if (isInterestFieldValue(i)) {
                                    continue;
                                }

                                let match = line.match(/^Title Owner(?:\s+\d+\s+of\s+\d+)?(?:\s+(.+))?$/i);
                                if (match) {
                                    const name = clean(match[1] || nextName(i + 1));
                                    if (name) {
                                        titleOwners.push(name);
                                        allOwners.push(name);
                                    }
                                    continue;
                                }

                                match = line.match(/^Registration Owner(?:\s+\d+\s+of\s+\d+)?(?:\s+(.+))?$/i);
                                if (match) {
                                    const name = clean(match[1] || nextName(i + 1));
                                    if (name) {
                                        registrationOwners.push(name);
                                        allOwners.push(name);
                                    }
                                    continue;
                                }

                                match = line.match(/^Owner\s+\d+\s+of\s+\d+(?:\s+(.+))?$/i);
                                if (match) {
                                    const section = recentInterestSection(i);
                                    const name = clean(match[1] || nextName(i + 1));
                                    if (name && /REGISTRATION(?:\s+AND\s+.*TITLE)/.test(section)) {
                                        paperTitleOwners.push(name);
                                        allOwners.push(name);
                                    } else if (name && /REGISTRATION/.test(section)) {
                                        registrationOwners.push(name);
                                        allOwners.push(name);
                                    } else if (name && /(ELECTRONIC TITLE|^TITLE\*?$)/.test(section)) {
                                        titleOwners.push(name);
                                        allOwners.push(name);
                                    }
                                    continue;
                                }

                                match = line.match(/^REGISTRATION(?:\s+AND\s+.*TITLE\*?)?\s+Owner\s+(.+)$/i);
                                if (match) {
                                    const name = clean(match[1]);
                                    if (name) {
                                        paperTitleOwners.push(name);
                                        allOwners.push(name);
                                    }
                                    continue;
                                }

                                if (
                                    /^Owner$/i.test(line) &&
                                    /(?:REGISTRATION(?:\s+AND\s+.*TITLE)|ELECTRONIC TITLE|TITLE\*?)/i.test(lines[i - 1] || "")
                                ) {
                                    const name = nextName(i + 1);
                                    if (name) {
                                        paperTitleOwners.push(name);
                                        allOwners.push(name);
                                    }
                                    continue;
                                }

                                match = line.match(/^Lien Holder(?:\s+(.+))?$/i);
                                if (match) {
                                    const name = clean(match[1] || nextName(i + 1));
                                    if (name) lienholders.push(name);
                                }
                            }

                            const dedupe = values => {
                                const seen = new Set();
                                const out = [];
                                for (const value of values) {
                                    const key = clean(value).toUpperCase();
                                    if (!key || seen.has(key)) continue;
                                    seen.add(key);
                                    out.push(clean(value));
                                }
                                return out;
                            };

                            const splitCompositeOwnerName = value => {
                                const cleaned = clean(value);

                                if (!cleaned) {
                                    return [];
                                }

                                if (/\b(LLC|L\.?L\.?C\.?|INC|CORP|CORPORATION|COMPANY|CO\.?|TRUST|BANK|CREDIT UNION|CREDIT UNIO|FEDERAL|FINANCE|FINANCIAL)\b/i.test(cleaned)) {
                                    return [cleaned];
                                }

                                if (!/\sAND\s/i.test(cleaned)) {
                                    return [cleaned];
                                }

                                const parts = cleaned
                                    .split(/\s+AND\s+/i)
                                    .map(part => clean(part))
                                    .filter(Boolean);

                                if (parts.length !== 2) {
                                    return [cleaned];
                                }

                                const secondWords = parts[1].split(/\s+/).filter(Boolean);

                                if (parts[0].split(/\s+/).length === 1 && secondWords.length >= 2) {
                                    parts[0] = clean(`${parts[0]} ${secondWords[secondWords.length - 1]}`);
                                }

                                return parts;
                            };

                            const expandCompositeOwnerNames = values =>
                                values.flatMap(splitCompositeOwnerName);

                            const cleanLienholders = dedupe(lienholders);
                            const lienholderKeys = new Set(cleanLienholders.map(value => clean(value).toUpperCase()));
                            const isLikelyLienholder = value => /\b(BANK|CREDIT UNION|CREDIT UNIO|CU|FINANCIAL|FINANCE|CAPITAL|LENDING|LENDER|LOAN|FEDERAL|FSB)\b/i.test(value);
                            const withoutLienholders = values =>
                                dedupe(expandCompositeOwnerNames(values)).filter(value => {
                                    const key = clean(value).toUpperCase();
                                    return !lienholderKeys.has(key) && !isLikelyLienholder(value);
                                });

                            return {
                                titleOwners: withoutLienholders(titleOwners),
                                registrationOwners: withoutLienholders(registrationOwners),
                                paperTitleOwners: withoutLienholders(paperTitleOwners),
                                allOwners: withoutLienholders(allOwners),
                                lienholders: cleanLienholders
                            };
                        };

                        const headerLienMatch =
                            clean(rawText).match(/\b(Yes|No|Unspecified)\s+LIENHOLDER DATA\b/i);

                        const readOwnershipConnector = () => {
                            let sawAnd = false;

                            for (let i = 0; i < lines.length; i++) {
                                const upper = clean(lines[i]).toUpperCase();

                                const inline = upper.match(/^(CONNECTOR TYPE|CONJUNCTION|JOINT OWNERSHIP TYPE):?\s*(AND|OR)$/);
                                if (inline) {
                                    if (inline[2] === "OR") return "OR";
                                    sawAnd = true;
                                    continue;
                                }

                                if (/^(CONNECTOR TYPE|CONJUNCTION|JOINT OWNERSHIP TYPE):?$/.test(upper)) {
                                    for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
                                        const next = clean(lines[j]).toUpperCase();
                                        if (next === "OR") return "OR";
                                        if (next === "AND") {
                                            sawAnd = true;
                                            break;
                                        }
                                        if (next) break;
                                    }
                                }

                                if (/^AND\b/.test(upper)) {
                                    sawAnd = true;
                                }
                            }

                            return sawAnd ? "AND" : "";
                        };

                        const structured = readOwners();
                        structured.lienHeader = headerLienMatch ? headerLienMatch[1] : "";
                        structured.ownershipConnector = readOwnershipConnector();

                        return {
                            text: rawText,
                            structured
                        };
                    }
                });

            const data =
                result?.result || {
                    text: "",
                    structured: {}
                };

            if (
                isMvrReportReadyData(
                    data,
                    vin
                )
            ) {
                return data;
            }

        } catch (err) {

            console.warn(
                "MVR STRUCTURED SCRAPE WAITING:",
                err
            );

        }

        await delay(1000);
    }

    return {
        text: await scrapeTabText(tabId, 5000),
        structured: {}
    };
}

async function scrapeNmvtisReportText(tabId, timeoutMs = 45000, vin = "") {

    const startedAt =
        Date.now();

    while (
        Date.now() - startedAt < timeoutMs
    ) {

        try {

            await waitForTabLoad(
                tabId
            );

            const [result] =
                await chrome.scripting.executeScript({
                    target: {
                        tabId
                    },
                    func: () =>
                        document.body?.innerText ||
                        document.body?.textContent ||
                        ""
                });

            const text =
                result?.result || "";

            const status =
                detectNmvtisReportStatusFromText(
                    text,
                    vin
                );

            if (
                status === "success" ||
                status === "no_record"
            ) {
                return text;
            }

        } catch (err) {

            console.warn(
                "NMVTIS SCRAPE WAITING:",
                err
            );

        }

        await delay(
            1000
        );
    }

    return await scrapeTabText(
        tabId,
        5000
    );
}

async function scrapeTabText(tabId, timeoutMs = 10000) {

    const startedAt =
        Date.now();

    while (
        Date.now() - startedAt < timeoutMs
    ) {

        try {

            await waitForTabLoad(
                tabId
            );

            const result =
                await chrome.scripting.executeScript({
                    target: {
                        tabId
                    },
                    func: () =>
                        document.body?.innerText || ""
                });

            const text =
                result?.[0]?.result || "";

            if (
                text.trim().length > 50
            ) {
                return text;
            }

        } catch (err) {

            console.warn(
                "TAB TEXT SCRAPE WAITING:",
                err
            );

        }

        await delay(1000);
    }

    return "";
}

async function findExistingSalesforceTab(salesforceUrl) {

    const tabs =
        await chrome.tabs.query({});

    if (salesforceUrl) {

        const exact =
            tabs.find(tab =>
                tab.url === salesforceUrl
            );

        if (exact) {
            return exact;
        }
    }

    return tabs
        .filter(tab =>
            /salesforce\.com|lightning\.force\.com/i.test(tab.url || "")
        )
        .sort((a, b) =>
            (b.id || 0) -
            (a.id || 0)
        )[0] || null;
}

async function findExistingYassiVehicleTab(vin) {

    const tabs =
        await chrome.tabs.query({
            url: "https://app.yassi.com/record-inquiries/vehicle-records/*"
        });

    if (!tabs.length) {
        return null;
    }

    if (vin) {

        for (const tab of tabs.slice().reverse()) {

            const text =
                await scrapeTabText(
                    tab.id,
                    3000
                );

            if (
                normalizeText(text).includes(vin)
            ) {
                return tab;
            }
        }
    }

    return tabs
        .sort((a, b) =>
            (b.id || 0) -
            (a.id || 0)
        )[0];
}

async function findExistingNmvtisTab(vin) {

    const tabs =
        await chrome.tabs.query({
            url: "https://app.yassi.com/record-inquiries/nmvtis-records/*"
        });

    if (!tabs.length) {
        return null;
    }

    if (vin) {

        for (const tab of tabs.slice().reverse()) {

            const text =
                await scrapeTabText(
                    tab.id,
                    3000
                );

            if (
                normalizeText(text).includes(vin)
            ) {
                return tab;
            }
        }
    }

    return tabs
        .sort((a, b) =>
            (b.id || 0) -
            (a.id || 0)
        )[0];
}

async function openReviewResultTab(output, vin) {

    const safeVin =
        normalizeVin(vin) ||
        "UNKNOWN";

    const renderedOutput =
        renderReviewOutputHtml(
            output
        );

    const html =
        `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Open Review ${escapeHtml(safeVin)}</title>
<style>
    body {
        font-family: Arial, sans-serif;
        margin: 24px;
        background: #f8f9fa;
        color: #1f2328;
    }

    h1 {
        margin-top: 0;
        font-size: 20px;
    }

    .toolbar {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
        flex-wrap: wrap;
    }

    button {
        background: #0A84FF;
        color: #fff;
        border: none;
        border-radius: 6px;
        padding: 8px 12px;
        cursor: pointer;
        font-weight: 600;
    }

    .output-card {
        background: #fff;
        border: 1px solid #d0d7de;
        border-radius: 10px;
        padding: 16px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    }

    .table-wrap {
        width: 100%;
        overflow-x: auto;
    }

    table {
        border-collapse: collapse;
        width: 100%;
        min-width: 1120px;
        background: #fff;
    }

    th,
    td {
        border: 1px solid #d0d7de;
        padding: 8px 10px;
        text-align: left;
        vertical-align: top;
        font-size: 13px;
        line-height: 1.35;
    }

    th {
        background: #f6f8fa;
        font-weight: 700;
        white-space: nowrap;
    }

    td.status-cell {
        text-align: center;
        font-size: 18px;
        width: 56px;
        white-space: nowrap;
    }

    tr.status-flag td {
        background: #fff5f5;
    }

    tr.status-caution td {
        background: #fffbea;
    }

    .docs-section {
        margin-top: 22px;
    }

    .docs-section h2 {
        font-size: 16px;
        margin: 0 0 10px;
    }

    .docs-section ul {
        margin: 0;
        padding-left: 22px;
    }

    .docs-section li {
        margin: 4px 0;
    }

    .note {
        margin-top: 12px;
        color: #57606a;
    }

    .message {
        white-space: pre-wrap;
        font-size: 14px;
    }

    details {
        margin-top: 16px;
    }

    summary {
        cursor: pointer;
        color: #57606a;
        font-weight: 600;
    }

    textarea {
        width: 100%;
        min-height: 320px;
        box-sizing: border-box;
        border: 1px solid #d0d7de;
        border-radius: 8px;
        padding: 14px;
        font-family: Consolas, Menlo, monospace;
        font-size: 13px;
        line-height: 1.45;
        background: #fff;
        color: #1f2328;
        white-space: pre;
        margin-top: 10px;
    }
</style>
</head>
<body>
<h1>Open Review Output — ${escapeHtml(safeVin)}</h1>
<div class="toolbar">
    <button id="copyBtn">Copy Formatted Table</button>
    <button id="downloadBtn">Download TXT</button>
</div>
<div class="output-card">
${renderedOutput}
</div>
<details>
    <summary>Show copyable Markdown/text version</summary>
    <textarea id="reviewOutput">${escapeHtml(output)}</textarea>
</details>
<script>
const output = ${JSON.stringify(output)};
const richHtml = ${JSON.stringify(buildClipboardHtml(output))};
async function copyRichPayload(text, html) {
    try {
        if (html && navigator.clipboard?.write && window.ClipboardItem) {
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/html': new Blob([html], { type: 'text/html' }),
                    'text/plain': new Blob([text], { type: 'text/plain' })
                })
            ]);
            return 'rich clipboard';
        }
    } catch (err) {
        // fall through to selection-based rich copy
    }

    try {
        if (html) {
            const container = document.createElement('div');
            container.setAttribute('contenteditable', 'true');
            container.style.position = 'fixed';
            container.style.left = '-9999px';
            container.style.top = '0';
            container.style.width = '1200px';
            container.innerHTML = html;
            document.body.appendChild(container);
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(container);
            selection.removeAllRanges();
            selection.addRange(range);
            const copied = document.execCommand('copy');
            selection.removeAllRanges();
            container.remove();
            if (copied) {
                return 'rich selection';
            }
        }
    } catch (err) {
        // fall through to plain text copy
    }

    try {
        await navigator.clipboard.writeText(text);
        return 'plain clipboard';
    } catch (err) {
        const textarea = document.getElementById('reviewOutput');
        textarea.select();
        document.execCommand('copy');
        return 'plain selection';
    }
}
document.getElementById('copyBtn').addEventListener('click', async () => {
    const button = document.getElementById('copyBtn');
    await copyRichPayload(output, richHtml);
    button.textContent = 'Copied formatted table';
});
document.getElementById('downloadBtn').addEventListener('click', () => {
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = ${JSON.stringify(`OPEN-REVIEW-${safeVin}.txt`)};
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
});
</script>
</body>
</html>`;

    await chrome.tabs.create({
        url:
            "data:text/html;charset=utf-8," +
            encodeURIComponent(html)
    });
}

function renderReviewOutputHtml(output) {

    const lines =
        (output || "")
            .toString()
            .split(/\r?\n/);

    const tableStart =
        lines.findIndex(line =>
            line
                .trim()
                .startsWith(
                    "| Field | HappyFox | Salesforce | MVR / Manual | NVITAS | Status | Notes |"
                )
        );

    if (tableStart === -1) {

        return `
<div class="message">${escapeHtml(output)}</div>`;

    }

    const tableLines = [];

    for (
        let i = tableStart;
        i < lines.length;
        i++
    ) {

        const line =
            lines[i].trim();

        if (!line.startsWith("|")) {
            break;
        }

        tableLines.push(line);

    }

    const headerCells =
        splitMarkdownTableRow(
            tableLines[0]
        );

    const bodyRows =
        tableLines
            .slice(2)
            .map(splitMarkdownTableRow)
            .filter(cells =>
                cells.length >= 7
            );

    const docsStart =
        lines.findIndex(line =>
            line.trim() ===
            "DOCUMENTS TO SELECT FOR CX"
        );

    const docLines = [];
    const deficiencyMethodLines = [];
    const notes = [];

    if (docsStart !== -1) {

        let inDeficiencyMethodSection = false;

        for (
            let i = docsStart + 1;
            i < lines.length;
            i++
        ) {

            const line =
                lines[i].trim();

            if (!line) {
                continue;
            }

            if (line === "SELECTED DEFICIENCY METHOD") {
                inDeficiencyMethodSection = true;
                continue;
            }

            if (
                line.startsWith("(") &&
                line.endsWith(")")
            ) {

                notes.push(
                    line.slice(1, -1)
                );

            } else if (inDeficiencyMethodSection) {

                deficiencyMethodLines.push(line);

            } else {

                docLines.push(
                    line.replace(/^[✅⚠️🚩]\s*/, "")
                );

            }
        }
    }

    const headerHtml =
        headerCells
            .map(cell =>
                `<th>${escapeHtml(cell)}</th>`
            )
            .join("");

    const rowsHtml =
        bodyRows
            .map(cells => {

                const status =
                    cells[5] || "";

                const rowClass =
                    status.includes("🚩")
                        ? "status-flag"
                        : status.includes("⚠️")
                            ? "status-caution"
                            : "status-ok";

                return `
<tr class="${rowClass}">
    ${cells.map((cell, index) =>
        `<td class="${index === 5 ? "status-cell" : ""}">${escapeHtml(cell)}</td>`
    ).join("")}
</tr>`;

            })
            .join("");

    const docsHtml =
        (docLines.length || deficiencyMethodLines.length)
            ? `
<div class="docs-section">
    ${docLines.length ? `<h2>DOCUMENTS TO SELECT FOR CX</h2>
    <ul>
        ${docLines.map(doc =>
            `<li>✅ ${escapeHtml(doc)}</li>`
        ).join("")}
    </ul>` : ""}
    ${deficiencyMethodLines.length ? `<h2>SELECTED DEFICIENCY METHOD</h2>
    <ul>
        ${deficiencyMethodLines.map(method =>
            `<li>${escapeHtml(method)}</li>`
        ).join("")}
    </ul>` : ""}
    ${notes.map(note =>
        `<p class="note">(${escapeHtml(note)})</p>`
    ).join("")}
</div>`
            : "";

    return `
<div class="table-wrap">
    <table>
        <thead>
            <tr>${headerHtml}</tr>
        </thead>
        <tbody>
            ${rowsHtml}
        </tbody>
    </table>
</div>
${docsHtml}`;
}

function splitMarkdownTableRow(row) {

    const inner =
        row
            .trim()
            .replace(/^\|/, "")
            .replace(/\|$/, "");

    const cells = [];
    let current = "";

    for (
        let i = 0;
        i < inner.length;
        i++
    ) {

        const char =
            inner[i];

        const next =
            inner[i + 1];

        if (
            char === "\\" &&
            next === "|"
        ) {

            current += "|";
            i++;
            continue;

        }

        if (char === "|") {

            cells.push(
                current.trim()
            );

            current = "";
            continue;

        }

        current += char;
    }

    cells.push(
        current.trim()
    );

    return cells;
}

//
// YASSI RECORD RESULT CHECK
//

async function waitForYassiRecordStatus(
    tabId,
    vin
) {

    try {

        await waitForTabLoad(
            tabId
        );

    } catch (err) {

        console.warn(
            "Yassi tab load wait failed; continuing with page polling.",
            err
        );

    }

    const timeoutMs = 45000;
    const intervalMs = 1000;
    const startedAt = Date.now();

    while (
        Date.now() - startedAt < timeoutMs
    ) {

        try {

            const result =
                await chrome.scripting.executeScript({

                    target: {
                        tabId
                    },

                    args: [
                        vin
                    ],

                    func: detectYassiRecordStatus
                });

            const status =
                result?.[0]?.result;

            if (
                status === "success" ||
                status === "no_record" ||
                status === "service_unavailable"
            ) {
                return status;
            }

        } catch (err) {

            console.warn(
                "Unable to inspect Yassi record tab yet.",
                err
            );

        }

        await delay(
            intervalMs
        );

    }

    return "unknown";
}

function detectYassiRecordStatus(
    vin
) {

    // This function is executed inside the Yassi page via chrome.scripting.
    // It must be fully self-contained; it cannot call helpers from the
    // extension background scope. v2.27 called detectMvrReportStatusFromText()
    // here and the page context threw a ReferenceError, which made the run sit
    // on the MVR page even after the report was loaded.
    const normalize = value =>
        (value || "")
            .toString()
            .replace(/\s+/g, " ")
            .trim()
            .toUpperCase();

    const upper =
        normalize(
            document.body?.innerText || document.body?.textContent || ""
        );

    const normalizedVin =
        normalize(
            vin
        );

    const detectMvrServiceUnavailableTextLocal = value => {
        return [
            "STATE DMV IS CURRENTLY HAVING MAINTENANCE",
            "DMV IS CURRENTLY HAVING MAINTENANCE",
            "CURRENTLY HAVING MAINTENANCE",
            "SERVICE IS DOWN",
            "SERVICE UNAVAILABLE",
            "TEMPORARILY UNAVAILABLE",
            "PLEASE TRY AGAIN LATER",
            "UNABLE TO PROCESS",
            "UNABLE TO COMPLETE"
        ].some(phrase => value.includes(phrase));
    };

    if (!upper) {
        return "pending";
    }

    if (detectMvrServiceUnavailableTextLocal(upper)) {
        return "service_unavailable";
    }

    const noRecordPhrases = [
        "NO RECORD FOR THIS STATE",
        "NO RECORDS FOR THIS STATE",
        "NO RECORD FOUND FOR THIS STATE",
        "NO RECORDS FOUND FOR THIS STATE",
        "NO RECORD FOUND",
        "NO RECORDS FOUND",
        "NO TITLE RECORD",
        "NO TITLE RECORDS",
        "NO VEHICLE RECORD",
        "NO VEHICLE RECORDS",
        "NOT TITLED IN THIS STATE",
        "TITLE NOT FOUND",
        "RECORD NOT FOUND"
    ];

    if (
        noRecordPhrases.some(phrase =>
            upper.includes(phrase)
        )
    ) {
        return "no_record";
    }

    const hasVin =
        normalizedVin &&
        upper.includes(normalizedVin);

    const hasVehicleInterests =
        upper.includes("VEHICLE INTERESTS");

    const hasCoreSections =
        upper.includes(" REGISTRATION ") ||
        upper.includes("REGISTRATION PLATE") ||
        upper.includes(" VEHICLE VIN") ||
        upper.includes(" TITLE TITLE") ||
        upper.includes("TITLE ISSUE DATE") ||
        upper.includes("VEHICLE VIN:") ||
        upper.includes("VIN:");

    const hasEndMarker =
        upper.includes("ESTIMATED FEES") ||
        upper.includes("TOTAL REGISTRATION FEE") ||
        upper.includes("NOTICE: RENEWAL FEES") ||
        upper.includes("VERSION V");

    if (
        hasVin &&
        hasVehicleInterests &&
        hasCoreSections &&
        hasEndMarker
    ) {
        return "success";
    }

    if (/\b(LOADING|PROCESSING|PENDING|IN PROGRESS|GENERATING)\b/i.test(upper)) {
        return "pending";
    }

    return "pending";
}

function detectMvrReportStatusFromText(
    text,
    vin
) {

    const normalize = value =>
        (value || "")
            .toString()
            .replace(/\s+/g, " ")
            .trim()
            .toUpperCase();

    const upper =
        normalize(
            text
        );

    const normalizedVin =
        normalize(
            vin
        );

    if (!upper) {
        return "pending";
    }

    const noRecordPhrases = [
        "NO RECORD FOR THIS STATE",
        "NO RECORDS FOR THIS STATE",
        "NO RECORD FOUND FOR THIS STATE",
        "NO RECORDS FOUND FOR THIS STATE",
        "NO RECORD FOUND",
        "NO RECORDS FOUND",
        "NO TITLE RECORD",
        "NO TITLE RECORDS",
        "NO VEHICLE RECORD",
        "NO VEHICLE RECORDS",
        "NOT TITLED IN THIS STATE",
        "TITLE NOT FOUND",
        "RECORD NOT FOUND"
    ];

    if (detectMvrServiceUnavailableText(upper)) {
        return "service_unavailable";
    }

    if (
        noRecordPhrases.some(
            phrase => upper.includes(phrase)
        )
    ) {
        return "no_record";
    }

    const loadingPhrases = [
        "LOADING",
        "PROCESSING",
        "PENDING",
        "IN PROGRESS",
        "GENERATING"
    ];

    const hasVin =
        normalizedVin &&
        upper.includes(normalizedVin);

    const hasVehicleInterests =
        upper.includes("VEHICLE INTERESTS");

    const hasCoreSections =
        upper.includes(" REGISTRATION ") ||
        upper.includes("REGISTRATION PLATE") ||
        upper.includes(" VEHICLE VIN") ||
        upper.includes(" TITLE TITLE") ||
        upper.includes("TITLE ISSUE DATE");

    const hasEndMarker =
        upper.includes("ESTIMATED FEES") ||
        upper.includes("TOTAL REGISTRATION FEE") ||
        upper.includes("NOTICE: RENEWAL FEES") ||
        upper.includes("VERSION V");

    if (
        hasVin &&
        hasVehicleInterests &&
        hasCoreSections &&
        hasEndMarker
    ) {
        return "success";
    }

    if (
        loadingPhrases.some(
            phrase => upper.includes(phrase)
        )
    ) {
        return "pending";
    }

    return "pending";
}

function detectNmvtisReportStatusFromText(
    text,
    vin
) {

    const normalize = value =>
        (value || "")
            .toString()
            .replace(/\s+/g, " ")
            .trim()
            .toUpperCase();

    const upper =
        normalize(
            text
        );

    const normalizedVin =
        normalize(
            vin
        );

    if (!upper) {
        return "pending";
    }

    const hasVin =
        normalizedVin &&
        upper.includes(normalizedVin);

    const hasNmvtisIdentity =
        upper.includes("VIEW NMVTIS RECORD") ||
        upper.includes("NATIONAL VEHICLE HISTORY REPORT") ||
        upper.includes("NMVTIS RECORDS");

    const hasReportHeader =
        upper.includes("NATIONAL VEHICLE HISTORY REPORT") ||
        upper.includes("YASSI IS AN APPROVED NMVTIS DATA PROVIDER") ||
        upper.includes("REQUESTED VIN");

    const hasDataSection =
        upper.includes("TITLE RECORDS") ||
        upper.includes("HISTORICAL TITLE RECORDS") ||
        upper.includes("BRAND SUMMARY") ||
        upper.includes("JUNK/SALVAGE RECORDS") ||
        upper.includes("THEFT/LIEN DATA");

    const hasEndMarker =
        upper.includes("NMVTIS CONSUMER ACCESS PRODUCT DISCLAIMER") ||
        upper.includes("NMVTIS CONSUMER ACCESS PRODUCT") ||
        upper.includes("ALL STATES, INSURANCE COMPANIES") ||
        upper.includes("VERSION V");

    const noNmvtisRecord =
        upper.includes("NO NMVTIS RECORD") ||
        upper.includes("NO NMVTIS DATA") ||
        upper.includes("NMVTIS RECORD NOT FOUND");

    if (
        hasVin &&
        hasNmvtisIdentity &&
        noNmvtisRecord
    ) {
        return "no_record";
    }

    if (
        hasVin &&
        hasNmvtisIdentity &&
        hasReportHeader &&
        hasDataSection &&
        hasEndMarker
    ) {
        return "success";
    }

    if (
        /\b(LOADING|PROCESSING|PENDING|IN PROGRESS|GENERATING)\b/i.test(upper)
    ) {
        return "pending";
    }

    return "pending";
}

function isMvrReportReadyData(
    data,
    vin
) {

    const status =
        detectMvrReportStatusFromText(
            data?.text || "",
            vin
        );

    return (
        status === "success" ||
        status === "no_record" ||
        status === "service_unavailable"
    );
}


async function downloadPdf(
    inquiryId,
    vin
) {

    const safeVin =
        normalizeVin(vin);

    const filename =
        `YASSI-${safeVin || "UNKNOWN"}.pdf`;

    try {

        console.log(
            "Waiting for Yassi PDF file to be available..."
        );

        const pdfBlob =
            await fetchYassiReportPdfBlob(
                inquiryId,
                30000
            );

        const dataUrl =
            await blobToDataUrl(
                pdfBlob
            );

        const downloadId =
            await downloadDataUrl(
                dataUrl,
                filename
            );

        if (downloadId) {
            await waitForDownloadComplete(
                downloadId,
                45000
            );
        }

        return {
            ok: true,
            filename,
            dataUrl,
            size: pdfBlob?.size || 0,
            downloadId
        };

    } catch (error) {

        console.error(
            "PDF DOWNLOAD ERROR:",
            error
        );

        return {
            ok: false,
            filename,
            error: error?.message || String(error)
        };

    }
}

async function fetchYassiReportPdfBlob(
    inquiryId,
    timeoutMs = 30000
) {

    const startedAt =
        Date.now();

    let lastError = null;

    while (
        Date.now() - startedAt < timeoutMs
    ) {

        try {

            const response =
                await fetch(
                    "https://app.yassi.com/api/inquiries/get-report-file",
                    {
                        method: "POST",
                        credentials:
                            "include",
                        headers: {
                            "Content-Type":
                                "text/plain;charset=UTF-8"
                        },
                        body:
                            JSON.stringify({
                                inquiryTransactionId:
                                    inquiryId,
                                reportFormat: 0
                            })
                    }
                );

            if (response.ok) {

                const pdfBlob =
                    await response.blob();

                if (
                    pdfBlob &&
                    pdfBlob.size > 1000
                ) {
                    return pdfBlob;
                }

                lastError =
                    new Error(
                        "PDF response was empty or incomplete."
                    );

            } else {

                lastError =
                    new Error(
                        `PDF request failed: ${response.status}`
                    );

            }

        } catch (error) {

            lastError =
                error;

        }

        await delay(
            1000
        );
    }

    throw lastError ||
        new Error(
            "Timed out waiting for Yassi PDF."
        );
}

function blobToDataUrl(
    blob
) {

    return new Promise((resolve, reject) => {

        const reader =
            new FileReader();

        reader.onload = () =>
            resolve(
                reader.result
            );

        reader.onerror =
            reject;

        reader.readAsDataURL(
            blob
        );
    });
}

function downloadDataUrl(
    dataUrl,
    filename
) {

    return new Promise((resolve, reject) => {

        chrome.downloads.download(
            {
                url: dataUrl,
                filename,
                saveAs: false
            },
            downloadId => {

                const runtimeError =
                    chrome.runtime.lastError;

                if (runtimeError) {
                    reject(
                        new Error(
                            runtimeError.message
                        )
                    );
                    return;
                }

                resolve(
                    downloadId
                );
            }
        );
    });
}

function waitForDownloadComplete(
    downloadId,
    timeoutMs = 45000
) {

    return new Promise(resolve => {

        let finished = false;
        let timeout = null;

        const done = () => {

            if (finished) {
                return;
            }

            finished = true;

            if (timeout) {
                clearTimeout(
                    timeout
                );
            }

            chrome.downloads.onChanged.removeListener(
                listener
            );

            resolve();
        };

        const listener = delta => {

            if (
                delta.id !== downloadId
            ) {
                return;
            }

            if (
                delta.state?.current === "complete" ||
                delta.state?.current === "interrupted"
            ) {
                done();
            }
        };

        chrome.downloads.onChanged.addListener(
            listener
        );

        chrome.downloads.search(
            {
                id: downloadId
            },
            items => {

                const item =
                    items?.[0];

                if (
                    item?.state === "complete" ||
                    item?.state === "interrupted"
                ) {
                    done();
                }
            }
        );

        timeout =
            setTimeout(
                done,
                timeoutMs
            );
    });
}


//
// VIN DECODER
//

async function openVinDecoderOnly(vin, options = {}) {

    vin = normalizeVin(vin);

    if (!vin) {
        console.error("No VIN supplied");
        return {
            ok: false,
            error: "No VIN supplied"
        };
    }

    const active =
        options.active === true;

    const waitForResults =
        options.waitForResults !== false;

    let decoderTab = null;
    let readiness = null;
    let submitResult = null;

    try {
        decoderTab =
            await chrome.tabs.create({
                active,
                url: buildVinDecoderUrl(vin)
            });

        if (waitForResults && decoderTab?.id) {
            await waitForTabLoad(
                decoderTab.id
            );

            // Old working behavior: the query-string URL can hydrate the NHTSA
            // decoder results on its own. Give that path first chance and do
            // not touch the form unless results clearly did not appear.
            readiness =
                await waitForVinDecoderResults(
                    decoderTab.id,
                    vin,
                    6500
                );

            // If the URL did not produce visible results, then do one real
            // form submit. This keeps the old fast URL path intact while still
            // handling NHTSA sessions where the query string only fills the box.
            if (!readiness?.ready) {
                submitResult =
                    await fillVinDecoderTab(
                        decoderTab.id,
                        vin
                    );

                if (submitResult?.submitted) {
                    await waitForTabLoad(
                        decoderTab.id
                    );
                }

                readiness =
                    await waitForVinDecoderResults(
                        decoderTab.id,
                        vin,
                        9000
                    );
            }

            // Do not refocus the VIN Decoder after the wait/submit step.
            // Opening the tab with active:true is enough to show it once;
            // refocusing here can steal the processor back from HappyFox if
            // they click away while NHTSA is still hydrating.
        }

        return {
            ok: true,
            tabId: decoderTab?.id || null,
            opened: true,
            filled:
                Boolean(readiness?.bodyHasVin) ||
                Boolean(readiness?.urlHasVin) ||
                Boolean(readiness?.inputHasVin) ||
                Boolean(submitResult?.filled),
            submitted: Boolean(submitResult?.submitted),
            viaUrl: !submitResult?.submitted,
            waited: waitForResults,
            readiness,
            submitResult
        };

    } catch (err) {
        console.error(
            "VIN DECODER OPEN ERROR:",
            err
        );

        return {
            ok: false,
            error: err?.message || String(err),
            tabId: decoderTab?.id || null,
            readiness,
            submitResult
        };
    }
}

async function waitForVinDecoderResults(tabId, vin, timeoutMs = 6500) {

    const started =
        Date.now();

    let last = null;

    while (Date.now() - started < timeoutMs) {
        last =
            await inspectVinDecoderTab(
                tabId,
                vin
            );

        if (last?.ready) {
            return last;
        }

        await delay(
            500
        );
    }

    return Object.assign(
        {
            ready: false,
            timedOut: true
        },
        last || {}
    );
}

async function inspectVinDecoderTab(tabId, vin) {

    if (!tabId) {
        return null;
    }

    try {
        const result =
            await chrome.scripting.executeScript({
                target: {
                    tabId
                },
                func: vinValue => {
                    const expectedVin =
                        (vinValue || "")
                            .toUpperCase();

                    const bodyText =
                        (document.body?.innerText || "")
                            .toUpperCase();

                    const inputs =
                        Array.from(
                            document.querySelectorAll(
                                "input, textarea"
                            )
                        )
                            .map(input => ({
                                id: input.id || "",
                                name: input.name || "",
                                value: input.value || "",
                                placeholder: input.getAttribute("placeholder") || "",
                                ariaLabel: input.getAttribute("aria-label") || ""
                            }))
                            .slice(0, 12);

                    const inputHasVin =
                        inputs
                            .some(input =>
                                (input.value || "")
                                    .toUpperCase() === expectedVin
                            );

                    const resultTextSignals =
                        /(MANUFACTURER|MODEL|MODEL YEAR|MAKE|BODY CLASS|VEHICLE TYPE|TRIM|PLANT|SERIES|GVWR)/.test(
                            bodyText
                        );

                    const hasDetailsWrapper =
                        Boolean(
                            document.querySelector(
                                ".detailsWrapper"
                            )
                        );

                    return {
                        url: location.href,
                        urlHasVin:
                            location.href
                                .toUpperCase()
                                .includes(expectedVin),
                        title: document.title || "",
                        hasDetailsWrapper,
                        inputHasVin,
                        bodyHasVin:
                            Boolean(expectedVin) &&
                            bodyText.includes(expectedVin),
                        ready:
                            hasDetailsWrapper &&
                            (
                                resultTextSignals ||
                                bodyText.includes(expectedVin)
                            ),
                        bodyPreview:
                            (document.body?.innerText || "")
                                .slice(0, 1000),
                        inputs
                    };
                },
                args: [
                    vin
                ]
            });

        return result?.[0]?.result || null;

    } catch (error) {
        return {
            error: error?.message || String(error)
        };
    }
}


async function pinVinDecoderInput(tabId, vin) {

    vin = normalizeVin(vin);

    if (!tabId || !vin) {
        return {
            filled: false,
            error: "Missing VIN Decoder tab or VIN"
        };
    }

    try {
        const result =
            await chrome.scripting.executeScript({
                target: {
                    tabId
                },
                func: vinValue => {

                    const expectedVin =
                        (vinValue || "")
                            .toString()
                            .trim()
                            .toUpperCase();

                    function isFillable(el) {
                        if (!el) {
                            return false;
                        }

                        const type =
                            (el.getAttribute("type") || "text")
                                .toLowerCase();

                        if ([
                            "hidden",
                            "button",
                            "submit",
                            "checkbox",
                            "radio",
                            "file",
                            "password"
                        ].includes(type)) {
                            return false;
                        }

                        return !el.disabled && !el.readOnly;
                    }

                    function descriptorText(el) {
                        const id =
                            el.id || "";

                        const labels =
                            id
                                ? Array.from(
                                      document.querySelectorAll(
                                          `label[for="${CSS.escape(id)}"]`
                                      )
                                  )
                                      .map(label => label.textContent || "")
                                      .join(" ")
                                : "";

                        const closestLabel =
                            el.closest("label")?.textContent || "";

                        return [
                            el.id,
                            el.name,
                            el.getAttribute("aria-label"),
                            el.getAttribute("placeholder"),
                            el.getAttribute("title"),
                            labels,
                            closestLabel
                        ]
                            .filter(Boolean)
                            .join(" ")
                            .toUpperCase();
                    }

                    function scoreInput(el, index, allTextInputs) {
                        const text =
                            descriptorText(el);

                        let score = 0;

                        if (/\bVIN\b/.test(text)) {
                            score += 100;
                        }

                        if (/VEHICLE\s+IDENTIFICATION/.test(text)) {
                            score += 80;
                        }

                        if ((el.id || "").toUpperCase() === "VIN") {
                            score += 100;
                        }

                        if ((el.name || "").toUpperCase() === "VIN") {
                            score += 100;
                        }

                        if (Number(el.getAttribute("maxlength") || 0) === 17) {
                            score += 25;
                        }

                        if ((el.value || "").trim().length === 17) {
                            score += 15;
                        }

                        if (allTextInputs.length === 1 && index === 0) {
                            score += 20;
                        }

                        return score;
                    }

                    function setNativeValue(el, value) {
                        const proto =
                            Object.getPrototypeOf(el);

                        const descriptor =
                            Object.getOwnPropertyDescriptor(
                                proto,
                                "value"
                            ) ||
                            Object.getOwnPropertyDescriptor(
                                HTMLInputElement.prototype,
                                "value"
                            ) ||
                            Object.getOwnPropertyDescriptor(
                                HTMLTextAreaElement.prototype,
                                "value"
                            );

                        if (descriptor?.set) {
                            descriptor.set.call(
                                el,
                                value
                            );
                        } else {
                            el.value = value;
                        }

                        el.setAttribute(
                            "value",
                            value
                        );

                        el.dispatchEvent(
                            new Event(
                                "input",
                                { bubbles: true }
                            )
                        );

                        el.dispatchEvent(
                            new Event(
                                "change",
                                { bubbles: true }
                            )
                        );
                    }

                    function fillOnce() {
                        const textInputs =
                            Array.from(
                                document.querySelectorAll(
                                    "input, textarea"
                                )
                            )
                                .filter(isFillable);

                        const scored =
                            textInputs
                                .map((el, index) => ({
                                    el,
                                    score: scoreInput(
                                        el,
                                        index,
                                        textInputs
                                    )
                                }))
                                .filter(item => item.score > 0)
                                .sort((a, b) => b.score - a.score);

                        const target =
                            scored[0]?.el || null;

                        if (!target) {
                            return {
                                filled: false,
                                inputCount: textInputs.length,
                                error: "VIN input not found"
                            };
                        }

                        setNativeValue(
                            target,
                            expectedVin
                        );

                        return {
                            filled: (target.value || "").toUpperCase() === expectedVin,
                            inputCount: textInputs.length,
                            inputDescriptor: descriptorText(target).slice(0, 200),
                            score: scored[0]?.score || 0,
                            url: location.href,
                            urlHasVin: location.href.toUpperCase().includes(expectedVin),
                            bodyHasVin: (document.body?.innerText || "").toUpperCase().includes(expectedVin)
                        };
                    }

                    const first =
                        fillOnce();

                    clearInterval(
                        window.__openReviewVinPinTimer
                    );

                    window.__openReviewVinPinTimer =
                        setInterval(
                            fillOnce,
                            500
                        );

                    setTimeout(
                        () => {
                            clearInterval(
                                window.__openReviewVinPinTimer
                            );
                        },
                        20000
                    );

                    return first;
                },
                args: [
                    vin
                ]
            });

        return result?.[0]?.result || null;

    } catch (error) {
        return {
            filled: false,
            error: error?.message || String(error)
        };
    }
}

async function fillVinDecoderTab(tabId, vin) {

    vin = normalizeVin(vin);

    if (!tabId || !vin) {
        return {
            filled: false,
            submitted: false,
            error: "Missing VIN Decoder tab or VIN"
        };
    }

    let lastResult = null;

    for (let attempt = 0; attempt < 8; attempt++) {
        try {
            const result =
                await chrome.scripting.executeScript({
                    target: {
                        tabId
                    },
                    func: vinValue => {

                        function isVisible(el) {
                            if (!el) {
                                return false;
                            }

                            const rect =
                                el.getBoundingClientRect();

                            const style =
                                window.getComputedStyle(el);

                            return (
                                rect.width > 0 &&
                                rect.height > 0 &&
                                style.visibility !== "hidden" &&
                                style.display !== "none" &&
                                !el.disabled &&
                                !el.readOnly
                            );
                        }

                        function descriptorText(el) {
                            const id =
                                el.id || "";

                            const labels =
                                id
                                    ? Array.from(
                                          document.querySelectorAll(
                                              `label[for="${CSS.escape(id)}"]`
                                          )
                                      )
                                          .map(label => label.textContent || "")
                                          .join(" ")
                                    : "";

                            const closestLabel =
                                el.closest("label")?.textContent || "";

                            return [
                                el.id,
                                el.name,
                                el.getAttribute("aria-label"),
                                el.getAttribute("placeholder"),
                                el.getAttribute("title"),
                                labels,
                                closestLabel
                            ]
                                .filter(Boolean)
                                .join(" ")
                                .toUpperCase();
                        }

                        function findVinInput() {
                            const candidates =
                                Array.from(
                                    document.querySelectorAll(
                                        "input, textarea"
                                    )
                                )
                                    .filter(isVisible)
                                    .filter(el => {
                                        const type =
                                            (el.getAttribute("type") || "text")
                                                .toLowerCase();

                                        return ![
                                            "hidden",
                                            "button",
                                            "submit",
                                            "checkbox",
                                            "radio",
                                            "file",
                                            "password"
                                        ].includes(type);
                                    });

                            const scored =
                                candidates
                                    .map(el => {
                                        const text =
                                            descriptorText(el);

                                        let score = 0;

                                        if (/\bVIN\b/.test(text)) {
                                            score += 100;
                                        }

                                        if (/VEHICLE\s+IDENTIFICATION/.test(text)) {
                                            score += 80;
                                        }

                                        if ((el.value || "").trim().length === 17) {
                                            score += 20;
                                        }

                                        const maxLength =
                                            Number(el.getAttribute("maxlength") || 0);

                                        if (maxLength === 17) {
                                            score += 15;
                                        }

                                        return {
                                            el,
                                            score
                                        };
                                    })
                                    .sort((a, b) => b.score - a.score);

                            return scored[0]?.score > 0
                                ? scored[0].el
                                : candidates[0] || null;
                        }

                        function setNativeValue(el, value) {
                            const proto =
                                Object.getPrototypeOf(el);

                            const descriptor =
                                Object.getOwnPropertyDescriptor(
                                    proto,
                                    "value"
                                ) ||
                                Object.getOwnPropertyDescriptor(
                                    HTMLInputElement.prototype,
                                    "value"
                                ) ||
                                Object.getOwnPropertyDescriptor(
                                    HTMLTextAreaElement.prototype,
                                    "value"
                                );

                            if (descriptor?.set) {
                                descriptor.set.call(
                                    el,
                                    value
                                );
                            } else {
                                el.value = value;
                            }

                            el.dispatchEvent(
                                new Event(
                                    "input",
                                    { bubbles: true }
                                )
                            );

                            el.dispatchEvent(
                                new Event(
                                    "change",
                                    { bubbles: true }
                                )
                            );

                            el.dispatchEvent(
                                new KeyboardEvent(
                                    "keyup",
                                    { bubbles: true, key: "A" }
                                )
                            );
                        }

                        function findDecodeButton() {
                            const buttons =
                                Array.from(
                                    document.querySelectorAll(
                                        "button, input[type='submit'], input[type='button'], a"
                                    )
                                )
                                    .filter(isVisible);

                            const scored =
                                buttons
                                    .map(el => {
                                        const text =
                                            [
                                                el.textContent,
                                                el.value,
                                                el.id,
                                                el.name,
                                                el.getAttribute("aria-label"),
                                                el.getAttribute("title")
                                            ]
                                                .filter(Boolean)
                                                .join(" ")
                                                .toUpperCase();

                                        let score = 0;

                                        if (/\bDECODE\b/.test(text)) {
                                            score += 100;
                                        }

                                        if (/VIN/.test(text)) {
                                            score += 40;
                                        }

                                        if (/SUBMIT|SEARCH/.test(text)) {
                                            score += 20;
                                        }

                                        return {
                                            el,
                                            score,
                                            text
                                        };
                                    })
                                    .sort((a, b) => b.score - a.score);

                            return scored[0]?.score > 0
                                ? scored[0].el
                                : null;
                        }

                        const input =
                            findVinInput();

                        if (!input) {
                            return {
                                filled: false,
                                submitted: false,
                                error: "VIN input not found"
                            };
                        }

                        input.focus();

                        setNativeValue(
                            input,
                            vinValue
                        );

                        input.blur();

                        const button =
                            findDecodeButton();

                        let submitted = false;

                        if (button) {
                            button.click();
                            submitted = true;
                        } else if (input.form) {
                            input.form.requestSubmit
                                ? input.form.requestSubmit()
                                : input.form.submit();
                            submitted = true;
                        }

                        return {
                            filled: true,
                            submitted,
                            inputDescriptor: descriptorText(input).slice(0, 200),
                            buttonText: button
                                ? (button.textContent || button.value || "").trim().slice(0, 200)
                                : ""
                        };
                    },
                    args: [
                        vin
                    ]
                });

            lastResult =
                result?.[0]?.result || null;

            if (lastResult?.filled) {
                return lastResult;
            }

        } catch (err) {
            lastResult = {
                filled: false,
                submitted: false,
                error: err?.message || String(err)
            };
        }

        await delay(750);
    }

    return lastResult || {
        filled: false,
        submitted: false,
        error: "VIN Decoder fill timed out"
    };
}


//
// VIN SCREENSHOT (legacy helper; not used by Open Review/VIN button)
//

async function createVinScreenshot(vin, options = {}) {

    vin = normalizeVin(vin);

    if (!vin) {
        console.error("No VIN supplied");
        return {
            ok: false,
            error: "No VIN supplied"
        };
    }

    const active =
        options.active === true;

    const copyToClipboard =
        options.copyToClipboard !== false;

    const downloadFallback =
        options.downloadFallback !== false;

    let decoderTab = null;
    let copied = false;
    let downloaded = false;
    let copyError = "";

    try {

        decoderTab =
            await chrome.tabs.create({
                active,
                url:
                    buildVinDecoderUrl(vin)
            });

        await waitForTabLoad(
            decoderTab.id
        );

        await delay(4000);

        await chrome.scripting.executeScript({
            target: {
                tabId: decoderTab.id
            },
            files: [
                "html2canvas.min.js"
            ]
        });

        const capture =
            await chrome.scripting.executeScript({

                target: {
                    tabId: decoderTab.id
                },

                func: async captureOptions => {

                    const wrapper =
                        document.querySelector(
                            ".detailsWrapper"
                        );

                    if (!wrapper) {
                        throw new Error(
                            "detailsWrapper not found"
                        );
                    }

                    const canvas =
                        await html2canvas(
                            wrapper,
                            {
                                scale: 2,
                                useCORS: true,
                                backgroundColor:
                                    "#ffffff"
                            }
                        );

                    const imageData =
                        canvas.toDataURL(
                            "image/png"
                        );

                    let copied = false;
                    let copyError = "";

                    if (
                        captureOptions?.copyToClipboard &&
                        navigator.clipboard?.write &&
                        window.ClipboardItem
                    ) {
                        try {
                            const blob =
                                await new Promise(resolve =>
                                    canvas.toBlob(
                                        resolve,
                                        "image/png"
                                    )
                                );

                            if (!blob) {
                                throw new Error(
                                    "Unable to create VIN Decoder screenshot blob"
                                );
                            }

                            await navigator.clipboard.write([
                                new ClipboardItem({
                                    "image/png": blob
                                })
                            ]);

                            copied = true;

                        } catch (err) {
                            copyError =
                                err?.message ||
                                String(err);
                        }
                    }

                    return {
                        imageData,
                        copied,
                        copyError
                    };
                },

                args: [
                    {
                        copyToClipboard
                    }
                ]
            });

        const captureResult =
            capture?.[0]?.result || {};

        const imageData =
            typeof captureResult === "string"
                ? captureResult
                : captureResult.imageData;

        copied =
            Boolean(captureResult.copied);

        copyError =
            captureResult.copyError || "";

        if (!imageData) {
            throw new Error(
                "VIN Decoder screenshot was not captured"
            );
        }

        console.log(
            copied
                ? "VIN image captured and copied"
                : "VIN image captured"
        );

        if (
            !copied &&
            downloadFallback
        ) {
            await chrome.downloads.download({
                url: imageData,
                filename: `VIN-${vin}.png`,
                saveAs: false
            });

            downloaded = true;
        }

        return {
            ok: true,
            tabId: decoderTab.id,
            copied,
            downloaded,
            copyError
        };

    } catch (err) {

        console.error(
            "VINSHOT ERROR:",
            err
        );

        return {
            ok: false,
            tabId: decoderTab?.id || null,
            copied,
            downloaded,
            copyError,
            error: err?.message || String(err)
        };

    } finally {

        // Keep the VIN Decoder tab open after capture/copy so the reviewer can
        // inspect it manually. Older builds closed this tab automatically.
    }
}
//
// EXTRACTION HELPERS
//

function getFirstExactValue(fields, labels) {

    const normalizedMap =
        Object.entries(fields || {})
            .map(([key, value]) => ({
                key,
                value,
                normalizedKey:
                    normalizeLabel(key)
            }));

    for (const label of labels) {

        const target =
            normalizeLabel(label);

        const exact =
            normalizedMap.find(item =>
                item.normalizedKey === target
            );

        if (
            exact &&
            hasValue(exact.value)
        ) {
            return cleanValue(exact.value);
        }
    }

    return "";
}

function getFirstValue(fields, labels) {

    const normalizedMap =
        Object.entries(fields || {})
            .map(([key, value]) => ({
                key,
                value,
                normalizedKey:
                    normalizeLabel(key)
            }));

    for (const label of labels) {

        const target =
            normalizeLabel(label);

        const exact =
            normalizedMap.find(item =>
                item.normalizedKey === target
            );

        if (
            exact &&
            hasValue(exact.value)
        ) {
            return cleanValue(exact.value);
        }
    }

    for (const label of labels) {

        const target =
            normalizeLabel(label);

        const fuzzy =
            normalizedMap.find(item =>
                item.normalizedKey.includes(target) ||
                target.includes(item.normalizedKey)
            );

        if (
            fuzzy &&
            hasValue(fuzzy.value)
        ) {
            return cleanValue(fuzzy.value);
        }
    }

    return "";
}

function extractValueAfterLabels(lines, labels) {

    for (const label of labels) {

        const target = normalizeLabel(label);

        for (let i = 0; i < lines.length; i++) {

            const line = lines[i];
            const normalized = normalizeLabel(line);

            if (normalized === target) {
                return cleanValue(
                    nextMeaningfulLine(
                        lines,
                        i + 1
                    )
                );
            }

            if (
                normalized.startsWith(target + " ") ||
                normalized.startsWith(target + ":")
            ) {
                return cleanValue(
                    line
                        .replace(new RegExp(`^${escapeRegex(label)}\\s*:?\\s*`, "i"), "")
                );
            }
        }
    }

    return "";
}

function extractDateAfterLabels(lines, labels) {

    const labelValue =
        extractValueAfterLabels(
            lines,
            labels
        );

    const fromValue =
        extractDate(
            labelValue
        );

    if (fromValue) {
        return fromValue;
    }

    for (const label of labels) {

        const target =
            normalizeLabel(label);

        for (let i = 0; i < lines.length; i++) {

            if (
                normalizeLabel(lines[i]).includes(target)
            ) {

                for (let j = i; j < Math.min(lines.length, i + 8); j++) {

                    const date =
                        extractDate(
                            lines[j]
                        );

                    if (date) {
                        return date;
                    }
                }
            }
        }
    }

    return "";
}


function extractMvrHeaderYear(lines) {

    for (const line of lines || []) {

        const cleaned =
            cleanValue(line);

        if (!cleaned) {
            continue;
        }

        const match =
            cleaned.match(/^(19[8-9]\d|20[0-3]\d)\b/);

        if (match) {
            return match[1];
        }
    }

    return "";
}

function extractYearFromLabeledText(lines, labels) {

    const value =
        extractValueAfterLabels(
            lines,
            labels
        );

    const fullYear =
        extractYear(
            value
        );

    if (fullYear) {
        return fullYear;
    }

    const twoDigit =
        (value || "")
            .toString()
            .trim()
            .match(/^'?([0-9]{2})$/);

    if (twoDigit) {

        const yy =
            parseInt(
                twoDigit[1],
                10
            );

        const currentTwoDigitYear =
            new Date().getFullYear() % 100;

        const century =
            yy <= currentTwoDigitYear + 1
                ? 2000
                : 1900;

        return String(
            century + yy
        );
    }

    return "";
}

function extractStateAfterLabels(lines, labels) {

    const value =
        extractValueAfterLabels(
            lines,
            labels
        );

    const match =
        (value || "")
            .toUpperCase()
            .match(/\b[A-Z]{2}\b/);

    return match?.[0] || "";
}

function extractMvrTitleOwners(lines, context, structured = {}) {

    const interestOwners =
        extractMvrInterestOwners(
            lines,
            structured
        );

    // User rule: Vehicle Interests is the ownership source of truth.
    // Do not fall through to Prior Owners or other page sections when Vehicle Interests exists.
    if (interestOwners.vehicleInterestsFound) {
        const preferredOwners =
            interestOwners.titleOwners.length
                ? interestOwners.titleOwners
                : interestOwners.paperTitleOwners.length
                    ? interestOwners.paperTitleOwners
                    : interestOwners.allOwners;

        return dedupeNames(
            preferredOwners || []
        );
    }

    const titleOwners =
        extractNamesNearLabels(
            lines,
            [
                "Legal Title Owner",
                "Title Owner",
                "Title Owners",
                "Owner Name",
                "Owner Names",
                "Business Name",
                "Legal Business Name",
                "Entity Name",
                "Company Name",
                "Registered Owner",
                "Registration Owner"
            ]
        )
            .filter(name =>
                !looksLikeLienholder(name) &&
                !looksLikeOwnershipNoise(name)
            );

    if (titleOwners.length) {
        return titleOwners;
    }

    return extractEntityOwnerCandidates(lines);
}

function extractMvrRegisteredOwners(lines, structured = {}) {

    const interestOwners =
        extractMvrInterestOwners(
            lines,
            structured
        );

    if (interestOwners.vehicleInterestsFound) {
        return dedupeNames(
            interestOwners.registrationOwners || []
        );
    }

    return extractNamesNearLabels(
        lines,
        [
            "Registered Owner",
            "Registrant",
            "Registration Owner",
            "Additional Registered"
        ]
    )
        .filter(name =>
            !looksLikeOwnershipNoise(name)
        );
}

function extractMvrInterestOwners(lines, structured = {}) {

    const titleOwners = [];
    const registrationOwners = [];
    const paperTitleOwners = [];
    const allOwners = [];
    const lienholders = [];

    const addOwner = (name, bucket = "all") => {

        const expandedNames =
            splitCompositeOwnerName(name);

        for (const cleaned of expandedNames) {

            if (
                !cleaned ||
                looksLikeOwnershipNoise(cleaned) ||
                !looksLikePersonOrEntityName(cleaned)
            ) {
                continue;
            }

            allOwners.push(cleaned);

            if (bucket === "title") {
                titleOwners.push(cleaned);
            } else if (bucket === "registration") {
                registrationOwners.push(cleaned);
            } else if (bucket === "paperTitle") {
                paperTitleOwners.push(cleaned);
            }
        }
    };

    const addLienholder = name => {

        const cleaned =
            cleanValue(name);

        if (
            cleaned &&
            !looksLikeOwnershipNoise(cleaned)
        ) {
            lienholders.push(cleaned);
        }
    };

    const vehicleInterestsIndex =
        lines.findIndex(line =>
            normalizeText(line) === "VEHICLE INTERESTS"
        );

    const vehicleInterestsFound =
        vehicleInterestsIndex >= 0;

    const lookaheadText = (index, count = 6) =>
        lines
            .slice(index + 1, Math.min(lines.length, index + 1 + count))
            .map(line => normalizeText(line))
            .join(" ");

    const isVehicleInterestsBoundary = index => {

        const upper =
            normalizeText(lines[index]);

        if (!upper) {
            return false;
        }

        if (
            /^(PRIOR OWNERS?|ESTIMATED FEES|PRIOR REGISTRATION FEES|STOPS|VESSEL)$/.test(upper)
        ) {
            return true;
        }

        const ahead =
            lookaheadText(index);

        if (
            upper === "REGISTRATION" &&
            /\b(PLATE:|ISSUE DATE:|REG EXP|REGISTRATION NUMBER:|PLATE TYPE:|STATUS:)/.test(ahead)
        ) {
            return true;
        }

        if (
            upper === "VEHICLE" &&
            /\b(VIN:|YEAR:|MAKE:|MODEL:|BODY:)/.test(ahead)
        ) {
            return true;
        }

        if (
            upper === "TITLE" &&
            /\b(TITLE:|ISSUE DATE:|ISSUE STATE:|BRAND:|ODO READ:|REMARKS:)/.test(ahead)
        ) {
            return true;
        }

        if (
            upper === "INSURANCE" &&
            /\b(INSURANCE COMPANY:|DE-INSURE|CERTIFICATE|POLICY)/.test(ahead)
        ) {
            return true;
        }

        return false;
    };

    let interestEnd =
        lines.length;

    if (vehicleInterestsFound) {
        for (let i = vehicleInterestsIndex + 1; i < lines.length; i++) {
            if (isVehicleInterestsBoundary(i)) {
                interestEnd = i;
                break;
            }
        }
    }

    const inInterestRange = index =>
        vehicleInterestsFound &&
        index > vehicleInterestsIndex &&
        index < interestEnd;

    const nextNameLine = startIndex => {

        const parts = [];

        const isStopOrField = candidate => {

            const upper =
                normalizeText(candidate);

            if (!upper) {
                return true;
            }

            return /^(ADDRESS|MAILING|SEX CODE|DATE OF BIRTH|CUSTOMER TYPE|CUSTOMER NUMBER|JOINT OWNERSHIP|VEHICLE NUMBER|REGISTRATION NUMBER|DRIVER LICENSE|DL#|RELATIONSHIP|RESIDENCE|CONJUNCTION|COUNTY|SHOW \d+ EMPTY FIELDS|LIEN DATE|PLATE|ISSUE DATE|STATUS|REG EXP\. DATE):?$/.test(upper);
        };

        for (let i = startIndex; i < Math.min(interestEnd, startIndex + 8); i++) {

            const candidate =
                cleanValue(lines[i]);

            const upper =
                normalizeText(candidate);

            if (isStopOrField(candidate)) {
                if (parts.length) {
                    break;
                }
                continue;
            }

            if (/^LIEN HOLDER(?:\s+\d+\s+OF\s+\d+)?$/.test(upper)) {
                return "";
            }

            if (
                /^(REGISTRATION(?:\s+AND\s+.*TITLE\*?)?|ELECTRONIC TITLE|TITLE\*?)$/.test(upper) ||
                /^(OWNER|TITLE OWNER|REGISTRATION OWNER)(?:\s+\d+\s+OF\s+\d+)?$/.test(upper)
            ) {
                if (parts.length) {
                    break;
                }
                continue;
            }

            if (
                /\d/.test(candidate) &&
                !/\b(LLC|L\.?L\.?C\.?|INC\.?|CORP\.?|CORPORATION|TRUST|BANK|CREDIT UNION|CREDIT UNIO)\b/i.test(candidate)
            ) {
                if (parts.length) {
                    break;
                }
                continue;
            }

            if (
                (
                    looksLikePersonOrEntityName(candidate) ||
                    (
                        parts.length > 0 &&
                        /^[A-Z][A-Z .\'-]+$/i.test(candidate)
                    )
                ) &&
                !looksLikeOwnershipNoise(candidate)
            ) {
                parts.push(candidate);
            }

            if (parts.length >= 4) {
                break;
            }
        }

        return cleanValue(parts.join(" "));
    };

    const recentVehicleInterestSection = index => {

        for (let j = index - 1; j >= Math.max(vehicleInterestsIndex + 1, index - 8); j--) {

            const previous =
                normalizeText(lines[j]);

            if (
                /^(REGISTRATION(?:\s+AND\s+.*TITLE\*?)?|ELECTRONIC TITLE|TITLE\*?)$/.test(previous)
            ) {
                return previous;
            }
        }

        return "";
    };

    const previousMeaningfulUpper = index => {

        for (let j = index - 1; j > vehicleInterestsIndex; j--) {
            const previous =
                normalizeText(lines[j]);

            if (previous) {
                return previous;
            }
        }

        return "";
    };

    const isInterestFieldValue = index =>
        /^(TYPE|RELATIONSHIP|NAME CODE|COUNTY):?$/.test(previousMeaningfulUpper(index));

    if (vehicleInterestsFound) {
        for (let i = vehicleInterestsIndex + 1; i < interestEnd; i++) {

            const line =
                cleanValue(lines[i]);

            if (!line) {
                continue;
            }

            if (isInterestFieldValue(i)) {
                continue;
            }

            let match =
                line.match(/^Lien Holder(?:\s+(.+))?$/i);

            if (match) {
                addLienholder(
                    match[1] || nextNameLine(i + 1)
                );
                continue;
            }

            match =
                line.match(/^Title Owner(?:\s+\d+\s+of\s+\d+)?(?:\s+(.+))?$/i);

            if (match) {
                addOwner(
                    match[1] || nextNameLine(i + 1),
                    "title"
                );
                continue;
            }

            match =
                line.match(/^Registration Owner(?:\s+\d+\s+of\s+\d+)?(?:\s+(.+))?$/i);

            if (match) {
                addOwner(
                    match[1] || nextNameLine(i + 1),
                    "registration"
                );
                continue;
            }

            match =
                line.match(/^Owner\s+\d+\s+of\s+\d+(?:\s+(.+))?$/i);

            if (match) {
                const section =
                    recentVehicleInterestSection(i);

                const bucket =
                    /^(ELECTRONIC TITLE|TITLE\*?)$/.test(section)
                        ? "title"
                        : /REGISTRATION/.test(section)
                            ? "paperTitle"
                            : "all";

                addOwner(
                    match[1] || nextNameLine(i + 1),
                    bucket
                );
                continue;
            }

            match =
                line.match(/^REGISTRATION(?:\s+AND\s+.*TITLE\*?)?\s+Owner\s+(.+)$/i);

            if (match) {
                addOwner(
                    match[1],
                    "paperTitle"
                );
                continue;
            }

            if (/^Owner$/i.test(line)) {
                const section =
                    recentVehicleInterestSection(i);

                if (
                    /REGISTRATION(?:\s+AND\s+.*TITLE)|ELECTRONIC TITLE|^TITLE\*?$/.test(section)
                ) {
                    addOwner(
                        nextNameLine(i + 1),
                        /^(ELECTRONIC TITLE|TITLE\*?)$/.test(section)
                            ? "title"
                            : "paperTitle"
                    );
                }
            }
        }
    }

    if (!allOwners.length) {
        [
            ...(structured.allOwners || []),
            ...(structured.titleOwners || []),
            ...(structured.registrationOwners || []),
            ...(structured.paperTitleOwners || [])
        ].forEach(name => addOwner(name));
    }

    (structured.lienholders || [])
        .forEach(addLienholder);

    const cleanLienholders =
        dedupeNames(lienholders);

    const lienholderKeys =
        new Set(cleanLienholders.map(normalizeName));

    const withoutLienholders = values =>
        dedupeNames(values).filter(name =>
            !lienholderKeys.has(normalizeName(name)) &&
            !looksLikeLienholder(name)
        );

    return {
        vehicleInterestsFound,
        allOwners:
            withoutLienholders(allOwners),
        titleOwners:
            withoutLienholders(titleOwners),
        registrationOwners:
            withoutLienholders(registrationOwners),
        paperTitleOwners:
            withoutLienholders(paperTitleOwners),
        lienholders:
            cleanLienholders
    };
}

function isStopLineForMvrInterestName(line) {

    const upper =
        normalizeText(line);

    if (!upper) {
        return true;
    }

    const stopWords = [
        "ADDRESS",
        "MAILING",
        "SEX CODE",
        "DATE OF BIRTH",
        "CUSTOMER TYPE",
        "CUSTOMER NUMBER",
        "JOINT OWNERSHIP",
        "VEHICLE NUMBER",
        "REGISTRATION NUMBER",
        "DRIVER LICENSE",
        "RESIDENCE",
        "CONJUNCTION",
        "SHOW ",
        "REGISTRATION",
        "ELECTRONIC TITLE",
        "LIEN HOLDER",
        "LIENHOLDER DATA",
        "VEHICLE INTERESTS"
    ];

    if (/^(OWNER|TITLE OWNER|REGISTRATION OWNER|LIEN HOLDER)(?:\s+\d+\s+OF\s+\d+)?$/.test(upper)) {
        return true;
    }

    if (
        stopWords.some(word =>
            upper === word ||
            upper.startsWith(word)
        )
    ) {
        return true;
    }

    if (
        /\d/.test(line) &&
        !/\b(LLC|L\.L\.C\.?|INC\.?|CORP\.?|CORPORATION|TRUST|BANK|CREDIT UNION)\b/i.test(line)
    ) {
        return true;
    }

    return false;
}

function extractEntityOwnerCandidates(lines) {

    const interestLines = [];
    let inVehicleInterests = false;
    let skipLienBlock = false;

    for (const rawLine of lines) {

        const line =
            cleanValue(rawLine);

        const upper =
            normalizeText(line);

        if (upper === "VEHICLE INTERESTS") {
            inVehicleInterests = true;
            skipLienBlock = false;
            continue;
        }

        if (!inVehicleInterests) {
            continue;
        }

        if (/^(REGISTRATION|VEHICLE|TITLE|INSURANCE|ESTIMATED FEES|PRIOR OWNERS?)$/.test(upper)) {
            break;
        }

        if (/^LIEN HOLDER(?:\b|$)/.test(upper)) {
            skipLienBlock = true;
            continue;
        }

        if (/^(REGISTRATION(?:\s+AND\s+.*TITLE\*?)?|ELECTRONIC TITLE|TITLE\*?)$/.test(upper)) {
            skipLienBlock = false;
            continue;
        }

        if (skipLienBlock) {
            continue;
        }

        interestLines.push(line);
    }

    return dedupeNames(
        interestLines.filter(line =>
            looksLikeEntityOwnerName(line) &&
            !looksLikeLienholder(line) &&
            !looksLikeOwnershipNoise(line)
        )
    ).slice(0, 3);
}

function looksLikeOwnershipNoise(value) {

    const upper = normalizeText(value);

    return !upper ||
        upper.includes("OWNERSHIP CONTROL") ||
        upper.includes("CONTROL TYPE") ||
        upper.includes("SHIP CONTROL") ||
        upper.includes("TITLE RECORD") ||
        /^\d{4}\s+/.test(upper) ||
        upper.startsWith("MAKE:") ||
        upper.startsWith("MODEL:") ||
        upper.startsWith("BODY:") ||
        upper.startsWith("VEHICLE ") ||
        upper.includes("INSURANCE COMPANY") ||
        upper.includes("INSURANCE POLICY") ||
        upper.includes("ERIE INSURANCE") ||
        upper.includes("STATE CONTACT") ||
        upper.includes("CONTACT INFO") ||
        upper.includes("PRIOR OWNER");
}

function looksLikeEntityOwnerName(value) {

    const upper = normalizeText(value);

    if (!isEntityOwnerName(upper)) {
        return false;
    }

    if (/^\d{4}\s+/.test(upper) || upper.startsWith("MAKE:") || upper.startsWith("MODEL:") || upper.startsWith("BODY:")) {
        return false;
    }

    const rejected = [
        "CAMPING WORLD",
        "GOOD SAM",
        "YASSI",
        "DEFAULT DEPARTMENT",
        "RECORD INQUIRIES",
        "REPORTS",
        "TERMS OF SERVICE",
        "STATE CONTACT",
        "CONTACT INFO",
        "NO JUNK",
        "NO INSURANCE",
        "INSURANCE COMPANY",
        "INSURANCE POLICY",
        "ERIE INSURANCE",
        "NO RECORD"
    ];

    return !rejected.some(item => upper.includes(item));
}

function extractNamesNearLabels(lines, labels) {

    const names = [];

    for (const label of labels) {

        const target =
            normalizeLabel(label);

        for (let i = 0; i < lines.length; i++) {

            const line =
                lines[i];

            const normalized =
                normalizeLabel(line);

            if (
                normalized === target ||
                normalized.startsWith(target + ":")
            ) {

                const inlineValue =
                    normalized.startsWith(target + ":")
                        ? line.replace(new RegExp(`^${escapeRegex(label)}\\s*:?\\s*`, "i"), "")
                        : "";

                addCandidateNames(
                    names,
                    inlineValue
                );

                for (let j = i + 1; j < Math.min(lines.length, i + 8); j++) {

                    const candidate =
                        lines[j];

                    if (
                        isStopLineForNames(candidate)
                    ) {
                        break;
                    }

                    addCandidateNames(
                        names,
                        candidate
                    );
                }
            }
        }
    }

    return dedupeNames(
        names
    );
}

function addCandidateNames(names, value) {

    splitNames(value)
        .filter(name =>
            looksLikePersonOrEntityName(name)
        )
        .forEach(name =>
            names.push(name)
        );
}

function isStopLineForNames(line) {

    const normalized =
        normalizeText(line);

    if (!normalized) {
        return false;
    }

    const stopWords = [
        "ADDRESS",
        "CITY",
        "STATE",
        "ZIP",
        "TITLE",
        "VIN",
        "MAKE",
        "MODEL",
        "YEAR",
        "BODY",
        "ODOMETER",
        "MILEAGE",
        "BRAND",
        "LIEN",
        "LIENHOLDER",
        "REGISTRATION",
        "PLATE",
        "ISSUE DATE",
        "EXPIRATION",
        "VEHICLE"
    ];

    return stopWords.some(word =>
        normalized === word ||
        normalized.startsWith(word + " ") ||
        normalized.startsWith(word + ":")
    );
}

function looksLikePersonOrEntityName(value) {

    const name = cleanValue(value);

    if (!name) {
        return false;
    }

    const upper = name.toUpperCase();

    if (
        /\d/.test(name) ||
        upper.length < 3 ||
        /\bVIN\b/.test(upper) ||
        upper.includes("TITLE") ||
        upper.includes("ODOMETER") ||
        upper.includes("MILEAGE") ||
        upper.includes("ADDRESS") ||
        upper.includes("INSURANCE COMPANY") ||
        upper.includes("INSURANCE POLICY") ||
        upper.includes("LIENHOLDER DATA") ||
        upper.includes("OWNERSHIP CONTROL") ||
        upper.includes("CONTROL TYPE") ||
        upper.includes("SHIP CONTROL") ||
        upper.includes("STATE CONTACT") ||
        upper.includes("CONTACT INFO") ||
        upper.includes("NO RECORD")
    ) {
        return false;
    }

    const words =
        upper
            .split(/\s+/)
            .filter(Boolean);

    return words.length >= 2 ||
        upper.includes("LLC") ||
        upper.includes("TRUST") ||
        upper.includes("INC") ||
        upper.includes("CORP");
}

function splitNames(value) {

    if (!value) {
        return [];
    }

    return value
        .toString()
        .replace(/\band\b/gi, ";")
        .replace(/\s+&\s+/g, ";")
        .split(/;|\n|\r|\|/)
        .map(cleanValue)
        .filter(Boolean);
}

function dedupeNames(names) {

    const seen = new Set();
    const result = [];

    names.forEach(name => {

        const cleaned =
            cleanName(name);

        const key =
            normalizeName(cleaned);

        if (
            key &&
            !seen.has(key)
        ) {
            seen.add(key);
            result.push(cleaned);
        }
    });

    return result;
}


function extractReleasedLienInfo(lines, structured = {}) {

    const structuredLienholders =
        dedupeNames(
            structured?.lienholders || []
        )
            .filter(name =>
                name &&
                !looksLikeOwnershipNoise(name)
            );

    const isRealReleaseValue = value => {

        const cleaned =
            cleanValue(value);

        return !!cleaned &&
            /\d/.test(cleaned) &&
            !/^(NONE|NO|N\/A|NA|NOT PROVIDED|UNSPECIFIED)$/i.test(cleaned);
    };

    const extractInlineOrNextValue = (line, nextLine, labelRegex) => {

        const inline =
            cleanValue(
                String(line || "")
                    .replace(labelRegex, "")
            );

        return inline || cleanValue(nextLine || "");
    };

    let releaseDate = "";
    let statusCode = "";
    let lienholder =
        structuredLienholders[0] || "";

    for (let i = 0; i < lines.length; i++) {

        const line =
            cleanValue(lines[i]);

        const upperLine =
            normalizeText(line);

        if (/^LIEN HOLDER(?:\s+\d+\s+OF\s+\d+)?$/.test(upperLine)) {
            const candidate =
                cleanValue(lines[i + 1] || "");

            if (
                candidate &&
                looksLikeLienholder(candidate)
            ) {
                lienholder = candidate;
            }
        }

        if (/^LIEN SATISFACTION DATE:?/.test(upperLine)) {
            const candidate =
                extractInlineOrNextValue(
                    line,
                    lines[i + 1],
                    /^Lien Satisfaction Date\s*:?\s*/i
                );

            if (isRealReleaseValue(candidate)) {
                releaseDate = candidate;
            }
        }

        if (/^LIEN STATUS CODE:?/.test(upperLine)) {
            const candidate =
                extractInlineOrNextValue(
                    line,
                    lines[i + 1],
                    /^Lien Status Code\s*:?\s*/i
                );

            statusCode =
                normalizeText(candidate);
        }
    }

    if (
        releaseDate ||
        statusCode === "S" ||
        statusCode === "SATISFIED" ||
        statusCode === "SATISFACTION"
    ) {
        return {
            released: true,
            name: lienholder,
            date: releaseDate
        };
    }

    return {
        released: false,
        name: lienholder,
        date: ""
    };
}

function formatReleasedLienStatus(releasedLien) {

    if (!releasedLien?.released) {
        return "";
    }

    return releasedLien.date
        ? `No lien — lien released — ${releasedLien.date}`
        : "No lien — lien released";
}

function formatReleasedLienNote(statusText) {

    const cleaned =
        cleanValue(statusText);

    if (!/LIEN RELEASED/i.test(cleaned)) {
        return "";
    }

    const dateMatch =
        cleaned.match(/LIEN RELEASED\s*[—-]\s*(.+)$/i);

    return dateMatch?.[1]
        ? `Lien released — ${cleanValue(dateMatch[1])}`
        : "Lien released";
}

function extractLienInfo(lines, upper, state, structured = {}) {

    const structuredLienholders =
        dedupeNames(
            structured.lienholders || []
        )
            .filter(name =>
                name &&
                !looksLikeOwnershipNoise(name)
            );

    const releasedLien =
        extractReleasedLienInfo(
            lines,
            structured
        );

    if (releasedLien.released) {
        return {
            present: false,
            name: releasedLien.name || structuredLienholders[0] || "",
            statusText: formatReleasedLienStatus(releasedLien)
        };
    }

    if (structuredLienholders.length) {
        return {
            present: true,
            name: structuredLienholders[0],
            statusText: `${structuredLienholders[0]} lien present`
        };
    }

    if (
        /\bNO\s+LIENHOLDER\s+DATA\b/.test(upper) ||
        /\bNO\s+LIEN\b/.test(upper) ||
        /\bLIEN\s*:?\s*NONE\b/.test(upper) ||
        /\bLIENHOLDER\s*:?\s*NONE\b/.test(upper) ||
        normalizeText(structured.lienHeader) === "NO"
    ) {
        return {
            present: false,
            name: "",
            statusText: "No lien shown"
        };
    }

    const lienLabels = [
        "Lienholder",
        "Lien Holder",
        "Legal Owner",
        "Secured Party",
        "Security Interest"
    ];

    for (const label of lienLabels) {

        const target =
            normalizeLabel(label);

        for (let i = 0; i < lines.length; i++) {

            const line =
                lines[i];

            const normalized =
                normalizeLabel(line);

            if (
                normalized === target ||
                normalized.startsWith(target + ":")
            ) {

                const inlineValue =
                    normalized.startsWith(target + ":")
                        ? cleanValue(line.replace(new RegExp(`^${escapeRegex(label)}\s*:?\s*`, "i"), ""))
                        : "";

                const candidates = [];

                if (inlineValue) {
                    candidates.push(inlineValue);
                }

                for (let j = i + 1; j < Math.min(lines.length, i + 7); j++) {

                    const candidate =
                        cleanValue(lines[j]);

                    if (
                        !candidate ||
                        isStopLineForLien(candidate)
                    ) {
                        break;
                    }

                    candidates.push(candidate);
                }

                const lienName =
                    candidates.find(candidate =>
                        looksLikeLienholder(candidate)
                    ) ||
                    candidates.find(candidate =>
                        !/^(NONE|NO|N\/A|NA|NOT PROVIDED)$/i.test(candidate) &&
                        looksLikePersonOrEntityName(candidate)
                    );

                if (
                    lienName &&
                    !/^(NONE|NO LIEN|N\/A|NA|NOT PROVIDED)$/i.test(lienName)
                ) {
                    return {
                        present: true,
                        name: cleanValue(lienName),
                        statusText: `${cleanValue(lienName)} lien present`
                    };
                }
            }
        }
    }

    if (
        /\bYES\s+LIENHOLDER\s+DATA\b/.test(upper) ||
        normalizeText(structured.lienHeader) === "YES"
    ) {
        return {
            present: true,
            name: "Lienholder shown",
            statusText: "Lienholder shown"
        };
    }

    if (
        /\b(UNSPECIFIED\s+)?LIENHOLDER\s+DATA\b/.test(upper)
    ) {
        return {
            present: false,
            name: "",
            statusText: "No active lienholder shown"
        };
    }

    return {
        present: null,
        name: "",
        statusText: "Lien status not extracted"
    };
}

function isStopLineForLien(line) {

    const normalized =
        normalizeText(line);

    const stopWords = [
        "OWNER",
        "REGISTERED",
        "TITLE",
        "VIN",
        "YEAR",
        "MAKE",
        "MODEL",
        "BODY",
        "BRAND",
        "ODOMETER",
        "MILEAGE",
        "ADDRESS",
        "REGISTRATION",
        "PLATE",
        "ISSUE DATE",
        "EXPIRATION"
    ];

    return stopWords.some(word =>
        normalized === word ||
        normalized.startsWith(word + " ") ||
        normalized.startsWith(word + ":")
    );
}

function looksLikeLienholder(value) {

    const upper =
        normalizeText(value);

    const markers = [
        "BANK",
        "CREDIT UNION",
        "CREDIT UNIO",
        "CU",
        "FINANCIAL",
        "FINANCE",
        "CAPITAL",
        "LENDING",
        "LENDER",
        "LOAN",
        "AUTO",
        "N.A.",
        "LLC",
        "INC",
        "CORP",
        "FEDERAL",
        "FSB",
        "ALLY",
        "CHASE",
        "WELLS FARGO",
        "US BANK",
        "U.S. BANK",
        "BANK OF AMERICA"
    ];

    return markers.some(marker =>
        upper.includes(marker)
    );
}

function maybeApplyWashingtonOwnershipRule(args) {

    const state =
        normalizeState(
            args.context.state
        );

    if (state !== "WA") {
        return null;
    }

    const hasRegisteredOwners =
        args.registeredOwnerNames.length > 0;

    const hasLegalOwnerPhrase =
        args.upper.includes("LEGAL OWNER");

    const legalOwnerSameAsRegistered =
        args.upper.includes("LEGAL OWNER SAME AS REGISTERED OWNER") ||
        args.upper.includes("SAME AS REGISTERED OWNER");

    if (
        hasRegisteredOwners &&
        legalOwnerSameAsRegistered
    ) {
        return {
            owners: args.registeredOwnerNames,
            lienInfo: {
                present: false,
                name: "",
                statusText: "No lien shown"
            }
        };
    }

    if (
        hasRegisteredOwners &&
        hasLegalOwnerPhrase &&
        args.lienInfo.present === true &&
        args.titleOwnerNames.length === 0
    ) {
        return {
            owners: args.registeredOwnerNames,
            lienInfo: args.lienInfo
        };
    }

    if (
        hasRegisteredOwners &&
        !hasLegalOwnerPhrase &&
        args.lienInfo.present !== true
    ) {
        return {
            owners: args.registeredOwnerNames,
            lienInfo: {
                present: false,
                name: "",
                statusText: "No lien shown"
            }
        };
    }

    return null;
}


function normalizeMvrBody(value) {

    const upper =
        normalizeText(value);

    if (!upper) {
        return "";
    }

    if (
        upper.includes("TRAVEL") ||
        upper.includes("TRAILER") ||
        upper.includes("STYLE:TRAVEL") ||
        upper === "TRVL" ||
        upper === "TT"
    ) {
        return "Travel Trailer";
    }

    if (
        upper.includes("FIFTH") ||
        upper === "FW"
    ) {
        return "Fifth Wheel";
    }

    if (
        upper.includes("MOTOR") ||
        upper.includes("CLASS A") ||
        upper.includes("CLASS B") ||
        upper.includes("CLASS C")
    ) {
        return cleanValue(value);
    }

    return cleanValue(value)
        .replace(/^Style:\s*/i, "");
}

function formatMvrVehicle(make, model, body) {

    const base =
        compactJoin(
            [
                make,
                model
            ],
            " "
        );

    if (base && body) {
        return `${base} (${body})`;
    }

    return compactJoin(
        [
            base,
            body
        ],
        " "
    );
}

function extractMileage(text, lines) {

    const actualMatch =
        (text || "")
            .match(/([0-9][0-9,]*)\s+(?:actual\s+)?mileage/i);

    if (actualMatch) {
        return actualMatch[1];
    }

    const odometerValue =
        extractValueAfterLabels(
            lines,
            [
                "Odometer",
                "Odometer Reading",
                "Odometer Mileage",
                "Mileage",
                "Miles"
            ]
        );

    if (/EXEMPT/i.test(odometerValue || "")) {
        return "EXEMPT";
    }

    const num =
        (odometerValue || "")
            .match(/[0-9][0-9,]*/);

    if (num) {
        return num[0];
    }

    return extractScopedMileage(
        text,
        [
            "odometer",
            "mileage",
            "miles"
        ]
    );
}

function extractNmvtisYear(lines) {

    return extractYearFromLabeledText(
        lines,
        [
            "Year",
            "Model Year",
            "Vehicle Year",
            "Title Year"
        ]
    );
}

function extractNmvtisMileage(lines, text = "", context = {}) {

    const titleRecordMileage =
        extractNmvtisTitleRecordMileage(
            text,
            context
        );

    if (titleRecordMileage) {
        return titleRecordMileage;
    }

    const odometerValue =
        extractValueAfterLabels(
            lines,
            [
                "Odometer",
                "Odometer Reading",
                "Odometer Mileage",
                "Reported Odometer",
                "Mileage",
                "Miles",
                "Actual Mileage"
            ]
        );

    if (/EXEMPT/i.test(odometerValue || "")) {
        return "EXEMPT";
    }

    const num =
        (odometerValue || "")
            .match(/[0-9][0-9,]*/);

    if (num) {
        return formatMileageNumber(num[0]);
    }

    const scoped =
        extractScopedMileage(
            text,
            [
                "odometer",
                "mileage",
                "miles"
            ]
        );

    return scoped ? formatMileageNumber(scoped) : "";
}

function extractNmvtisTitleRecordMileage(text = "", context = {}) {

    const source =
        text || "";

    const expectedVin =
        normalizeVin(
            context?.vin || ""
        );

    const titleRecordsSection =
        source.match(/Title Records[\s\S]{0,1600}?(?:Historical Title Records|Brand Summary|Junk\/Salvage Records|Theft\/Lien Data)/i)?.[0] ||
        source;

    if (expectedVin) {

        const byVinPattern =
            new RegExp(
                `${escapeRegex(expectedVin)}\\s+\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}\\s+0*([0-9]{1,8})\\s*[A-Z]?\\b`,
                "i"
            );

        const byVin =
            titleRecordsSection.match(
                byVinPattern
            );

        if (byVin) {
            return formatMileageNumber(
                byVin[1]
            );
        }
    }

    const rowMatch =
        titleRecordsSection.match(/(?:^|[^A-Z0-9])([A-Z]{2})\s+([A-HJ-NPR-Z0-9]{17})\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s+0*([0-9]{1,8})\s*[A-Z]?\b/i);

    if (rowMatch) {
        return formatMileageNumber(
            rowMatch[3]
        );
    }

    const odometerLine =
        titleRecordsSection
            .split(/\n+/)
            .find(line =>
                /\bodometer\b/i.test(line) &&
                /[A-HJ-NPR-Z0-9]{17}/i.test(line)
            );

    if (odometerLine) {

        const valueAfterVin =
            odometerLine.match(/[A-HJ-NPR-Z0-9]{17}\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s+0*([0-9]{1,8})\s*[A-Z]?\b/i);

        if (valueAfterVin) {
            return formatMileageNumber(
                valueAfterVin[1]
            );
        }
    }

    return "";
}

function formatMileageNumber(value) {

    const number =
        parseNumber(value);

    if (!number || looksLikeYear(number)) {
        return "";
    }

    return number.toLocaleString("en-US");
}

function extractScopedMileage(text, labels) {

    const source =
        text || "";

    for (const label of labels) {

        const pattern =
            new RegExp(
                `${escapeRegex(label)}[\\s\\S]{0,140}?\\b([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,6})\\b`,
                "i"
            );

        const match =
            source.match(pattern);

        if (match) {

            const value =
                match[1];

            const number =
                parseNumber(value);

            if (
                number &&
                !looksLikeYear(number)
            ) {
                return value;
            }
        }
    }

    return "";
}

function looksLikeYear(value) {

    const number =
        Number(value);

    return number >= 1900 &&
        number <= 2100;
}

function rvClassCategory(value) {

    const upper =
        normalizeText(value);

    if (!upper) {
        return "";
    }

    if (
        upper.includes("TRAVEL TRAILER") ||
        upper.includes("TRAVEL TRLR") ||
        upper.includes("TRAILER") ||
        upper.includes("TRLR") ||
        upper.includes("FIFTH") ||
        upper.includes("5TH") ||
        upper.includes("TOY HAULER") ||
        upper.includes("TENT TRAILER") ||
        upper.includes("CAMPING TRAILER") ||
        upper.includes("POP UP") ||
        upper.includes("POP-UP") ||
        upper.includes("TRUCK CAMPER") ||
        upper.includes("FOLDING CAMPER") ||
        upper.includes("FOLD DOWN") ||
        upper.includes("PARK MODEL") ||
        upper === "TT" ||
        upper === "FW" ||
        upper === "CT" ||
        upper === "TTRL" ||
        upper === "TRVL" ||
        upper === "CAMP" ||
        upper === "TENT" ||
        upper.includes("TT -") ||
        upper.includes("FW -") ||
        upper.includes("CT -") ||
        /\b(TT|FW|CT|TRLR|TTRL|TRVL)\b/.test(upper)
    ) {
        return "NON_MOTORIZED";
    }

    if (
        upper.includes("CLASS A") ||
        upper.includes("A - CLASS A") ||
        upper.includes("CLASS B") ||
        upper.includes("B - CLASS B") ||
        upper.includes("CLASS C") ||
        upper.includes("C - CLASS C") ||
        upper.includes("MOTORHOME") ||
        upper.includes("MOTOR HOME") ||
        upper.includes("MOTORIZED") ||
        upper.includes("MTRH") ||
        upper === "MH" ||
        upper === "MOTOR" ||
        upper === "A" ||
        upper === "B" ||
        upper === "C"
    ) {
        return "MOTORIZED";
    }

    return "";
}

function extractBranding(upper, lines) {

    if (
        upper.includes("NO PROBLEM FOUND") ||
        upper.includes("NO BRANDS") ||
        upper.includes("NONE SHOWN") ||
        upper.includes("BRAND: NONE") ||
        upper.includes("BRANDING: NONE")
    ) {
        return "No Problem Found";
    }

    const value =
        extractValueAfterLabels(
            lines,
            [
                "Brand",
                "Brands",
                "Branding",
                "Title Brand"
            ]
        );

    const cleaned =
        cleanBrandingValue(
            value
        );

    return cleaned || "None shown";
}

function cleanBrandingValue(value) {

    const cleaned =
        cleanValue(
            value || ""
        );

    if (!cleaned) {
        return "";
    }

    const upper =
        normalizeText(
            cleaned
        );

    if (
        upper.includes("NOT PROVIDED") ||
        upper.includes("NO PROBLEM") ||
        upper.includes("NO BRAND") ||
        upper === "NONE" ||
        upper === "NONE SHOWN" ||
        upper === "NOT SHOWN"
    ) {
        return cleaned;
    }

    const badBrands = [
        "SALVAGE",
        "JUNK",
        "FLOOD",
        "FIRE",
        "REBUILT",
        "LEMON",
        "ODOMETER DISCREPANCY",
        "NOT ACTUAL",
        "TOTAL LOSS"
    ];

    const found =
        badBrands.find(brand =>
            upper.includes(brand)
        );

    return found || cleaned;
}

function isBrandingBad(value) {

    const upper =
        normalizeText(value);

    if (!upper) {
        return false;
    }

    if (
        upper.includes("NO PROBLEM") ||
        upper.includes("NONE") ||
        upper.includes("NO BRAND") ||
        upper.includes("NOT SHOWN")
    ) {
        return false;
    }

    return [
        "SALVAGE",
        "JUNK",
        "FLOOD",
        "FIRE",
        "REBUILT",
        "LEMON",
        "ODOMETER DISCREPANCY",
        "NOT ACTUAL",
        "TOTAL LOSS"
    ].some(marker =>
        upper.includes(marker)
    );
}

function detectMvrServiceUnavailableText(upper) {

    return [
        "STATE DMV IS CURRENTLY HAVING MAINTENANCE",
        "DMV IS CURRENTLY HAVING MAINTENANCE",
        "CURRENTLY HAVING MAINTENANCE",
        "SERVICE IS DOWN",
        "SERVICE UNAVAILABLE",
        "TEMPORARILY UNAVAILABLE",
        "PLEASE TRY AGAIN LATER",
        "UNABLE TO PROCESS",
        "UNABLE TO COMPLETE"
    ].some(phrase =>
        (upper || "").includes(phrase)
    );
}

function detectNoRecordText(upper) {

    return [
        "NO RECORD FOR THIS STATE",
        "NO RECORDS FOR THIS STATE",
        "NO RECORD FOUND",
        "NO RECORDS FOUND",
        "NO TITLE RECORD",
        "NOT TITLED IN THIS STATE",
        "TITLE NOT FOUND",
        "RECORD NOT FOUND"
    ].some(phrase =>
        upper.includes(phrase)
    );
}

function extractVin(text) {

    return extractAllVins(text)[0] || "";
}

function extractAllVins(text) {

    return [
        ...new Set(
            ((text || "")
                .toString()
                .toUpperCase()
                .match(/\b[A-HJ-NPR-Z0-9]{17}\b/g) || [])
                .filter(isPlausibleVinCandidate)
        )
    ];
}

function isPlausibleVinCandidate(value) {

    const vin =
        normalizeVin(value);

    if (
        !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)
    ) {
        return false;
    }

    if (!/\d/.test(vin)) {
        return false;
    }

    const obviousNonVinPhrases = [
        "NADATRADEVALUE",
        "TRADEVALUE",
        "SALESFORCE",
        "LIGHTNING",
        "COLUMN",
        "ACTIONS"
    ];

    return !obviousNonVinPhrases.some(phrase =>
        vin.includes(phrase)
    );
}

function extractYear(text) {

    const match =
        (text || "")
            .toString()
            .match(/\b(19[8-9]\d|20[0-3]\d)\b/);

    return match?.[0] || "";
}

function extractDate(text) {

    const value =
        text || "";

    const slash =
        value.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);

    if (slash) {

        const year =
            slash[3].length === 2
                ? `20${slash[3]}`
                : slash[3];

        return `${parseInt(slash[1], 10)}/${parseInt(slash[2], 10)}/${year}`;
    }

    const month =
        value.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},\s+\d{4}\b/i);

    return month?.[0] || "";
}

function evaluateExpirationDate(dateText) {

    const parsed =
        new Date(dateText);

    if (
        Number.isNaN(parsed.getTime())
    ) {
        return {
            status: "⚠️",
            note: "Expiration date visible but could not be parsed"
        };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    parsed.setHours(0, 0, 0, 0);

    const diffDays =
        Math.round(
            (parsed.getTime() - today.getTime()) /
            86400000
        );

    if (diffDays < 0) {
        return {
            status: "🚩",
            note: Math.abs(diffDays) <= 7
                ? "Expired WITHIN 7 DAYS"
                : "Expired more than 7 days ago"
        };
    }

    if (diffDays <= 7) {
        return {
            status: "✅",
            note: "Present"
        };
    }

    return {
        status: "✅",
        note: "Valid"
    };
}

//
// GENERAL HELPERS
//

function waitForTabLoad(
    tabId
) {

    return new Promise(
        resolve => {

            let isResolved = false;
            let timeout = null;

            function done() {

                if (isResolved) {
                    return;
                }

                isResolved = true;

                if (timeout) {
                    clearTimeout(
                        timeout
                    );
                }

                chrome.tabs.onUpdated.removeListener(
                    listener
                );

                resolve();
            }

            function listener(
                updatedTabId,
                changeInfo
            ) {

                if (
                    updatedTabId === tabId &&
                    changeInfo.status ===
                        "complete"
                ) {
                    done();
                }
            }

            chrome.tabs.onUpdated.addListener(
                listener
            );

            timeout =
                setTimeout(
                    done,
                    15000
                );

            chrome.tabs.get(
                tabId,
                tab => {

                    if (
                        chrome.runtime.lastError
                    ) {
                        return;
                    }

                    if (
                        tab?.status === "complete"
                    ) {
                        done();
                    }
                }
            );
        }
    );
}

function delay(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );
}

function normalizeVin(value) {

    return (value || "")
        .toString()
        .trim()
        .toUpperCase();
}

function normalizeState(value) {

    const match =
        (value || "")
            .toString()
            .trim()
            .toUpperCase()
            .match(/\b[A-Z]{2}\b/);

    return match?.[0] || "";
}

function normalizeText(value) {

    return (value || "")
        .toString()
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();
}

function normalizeLabel(value) {

    return (value || "")
        .toString()
        .replace(/\s+/g, " ")
        .replace(/[:*]+$/g, "")
        .trim()
        .toLowerCase();
}

function normalizeName(value) {

    return (value || "")
        .toString()
        .replace(/[^A-Z0-9 ]/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();
}

function cleanValue(value) {

    return (value || "")
        .toString()
        .replace(/\s+/g, " ")
        .replace(/^[\-–—:]+\s*/, "")
        .trim();
}

function cleanName(value) {

    return cleanValue(value)
        .replace(/^(OWNER|TITLE OWNER|LEGAL OWNER|REGISTERED OWNER)\s*:?\s*/i, "")
        .trim();
}

function hasValue(value) {

    return value !== null &&
        value !== undefined &&
        cleanValue(value) !== "" &&
        cleanValue(value) !== "—";
}

function toCleanLines(text) {

    return (text || "")
        .split(/\r?\n/)
        .map(cleanValue)
        .filter(Boolean);
}

function nextMeaningfulLine(lines, startIndex) {

    for (let i = startIndex; i < lines.length; i++) {

        if (hasValue(lines[i])) {
            return lines[i];
        }
    }

    return "";
}

function emptyDash(value) {

    return hasValue(value)
        ? cleanValue(value)
        : "—";
}

function compactJoin(values, separator) {

    return values
        .map(value => cleanValue(value))
        .filter(Boolean)
        .join(separator);
}

function parseYesNo(value) {

    const upper =
        normalizeText(value);

    if (!upper) {
        return null;
    }

    if (
        /\bYES\b|\bY\b|ACTIVE|PRESENT|TRUE/.test(upper)
    ) {
        return true;
    }

    if (
        /\bNO\b|\bN\b|NONE|ABSENT|FALSE/.test(upper)
    ) {
        return false;
    }

    return null;
}

function boolToYesNo(value) {

    if (value === true) {
        return "Yes";
    }

    if (value === false) {
        return "No";
    }

    return "";
}

function parseNumber(value) {

    if (!value) {
        return null;
    }

    const match =
        value
            .toString()
            .replace(/,/g, "")
            .match(/-?\d+(?:\.\d+)?/);

    return match
        ? Number(match[0])
        : null;
}

function parseMoney(value) {

    const num =
        parseNumber(value);

    return Number.isFinite(num)
        ? num
        : null;
}

function parseYear(value) {

    const year =
        extractYear(value);

    return year
        ? Number(year)
        : null;
}

function formatMoney(value) {

    return new Intl.NumberFormat(
        "en-US",
        {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0
        }
    ).format(value);
}

function isTrailerClass(value) {

    return rvClassCategory(value) === "NON_MOTORIZED";
}

function cleanSalesforceClassValue(value) {

    return cleanValue(value)
        .replace(/\bPreview\b/gi, "")
        .replace(/\bEdit\b/gi, "")
        .replace(/\bShow\b/gi, "")
        .replace(/\bcolumn actions\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
}

function extractSalesforceMoneyValue(lines, labels) {

    const value =
        extractSalesforceValue(
            lines,
            labels
        );

    const money =
        extractMoneyText(
            value
        );

    if (money) {
        return money;
    }

    for (const label of labels) {

        const target =
            normalizeLabel(label);

        for (let i = 0; i < lines.length; i++) {

            const normalized =
                normalizeSalesforceLabel(
                    lines[i]
                );

            if (
                normalized === target ||
                normalized.startsWith(target + " ")
            ) {
                for (let j = i; j < Math.min(lines.length, i + 8); j++) {
                    const found =
                        extractMoneyText(
                            lines[j]
                        );

                    if (found) {
                        return found;
                    }
                }
            }
        }
    }

    return "";
}

function extractMoneyText(value) {

    const match =
        (value || "")
            .toString()
            .match(/\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\$\s*\d+(?:\.\d{2})?/);

    return match
        ? cleanValue(match[0])
        : "";
}

function normalizePayoffPaymentOption(value) {

    const upper =
        normalizeText(value);

    if (!upper) {
        return "";
    }

    if (
        upper.includes("ESCROW") ||
        upper.includes("HOLDBACK")
    ) {
        return "ESCROW_HOLDBACK";
    }

    if (
        upper.includes("LOAN PAYDOWN") ||
        upper.includes("PAYDOWN") ||
        upper.includes("PAY DOWN")
    ) {
        return "LOAN_PAYDOWN";
    }

    return "";
}

async function downloadTextFile(filename, text) {

    const dataUrl =
        "data:text/plain;charset=utf-8," +
        encodeURIComponent(text || "");

    await chrome.downloads.download({
        url: dataUrl,
        filename,
        saveAs: false
    });
}

function isConsignment(value) {

    return normalizeText(value)
        .includes("CONSIGN");
}

function isPurchaseAcquisition(value) {

    const upper =
        normalizeText(value);

    return upper.includes("PURCHASE") ||
        upper === "P";
}

function namesMostlyAlign(hfOwners, mvrOwners, ownershipConnector = "") {

    const effectiveConnector =
        normalizeText(ownershipConnector) ||
        extractOwnershipConnectorFromOwnerNames(mvrOwners);

    const hf =
        hfOwners
            .map(normalizeName)
            .filter(Boolean);

    const mvr =
        mvrOwners
            .map(stripLeadingOwnershipConnector)
            .map(normalizeName)
            .filter(Boolean);

    const ownerMatches = mvrName =>
        hf.some(hfName =>
            hfName.includes(mvrName) ||
            mvrName.includes(hfName) ||
            shareAtLeastTwoWords(hfName, mvrName) ||
            shareAtLeastTwoFuzzyWords(hfName, mvrName) ||
            namesAlignByInitials(hfName, mvrName)
        );

    if (effectiveConnector === "OR") {
        return mvr.some(ownerMatches);
    }

    return mvr.every(ownerMatches);
}

function namesAlignByInitials(fullName, abbreviatedName) {

    const fullWords =
        fullName
            .split(" ")
            .filter(word => word.length > 1);

    const abbreviatedWords =
        abbreviatedName
            .split(" ")
            .filter(word => word.length > 0);

    if (
        fullWords.length < 2 ||
        abbreviatedWords.length < 2
    ) {
        return false;
    }

    const fullLast =
        fullWords[fullWords.length - 1];

    const abbreviatedLast =
        abbreviatedWords[abbreviatedWords.length - 1];

    if (fullLast !== abbreviatedLast) {
        return false;
    }

    const abbreviatedFirst =
        abbreviatedWords[0];

    if (abbreviatedFirst.length === 1) {
        return fullWords[0].startsWith(abbreviatedFirst);
    }

    return fullWords[0] === abbreviatedFirst;
}

function smallLevenshteinDistance(a, b) {

    if (a === b) {
        return 0;
    }

    if (!a || !b) {
        return Math.max(a?.length || 0, b?.length || 0);
    }

    const previous =
        Array.from({ length: b.length + 1 }, (_, i) => i);

    for (let i = 1; i <= a.length; i++) {
        let left = i;
        let upperLeft = i - 1;

        for (let j = 1; j <= b.length; j++) {
            const upper = previous[j];
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            const value = Math.min(
                previous[j] + 1,
                left + 1,
                upperLeft + cost
            );
            previous[j] = value;
            upperLeft = upper;
            left = value;
        }
    }

    return previous[b.length];
}

function wordsFuzzilyMatch(a, b) {

    if (a === b) {
        return true;
    }

    if (a.length < 5 || b.length < 5) {
        return false;
    }

    return smallLevenshteinDistance(a, b) <= 2;
}

function shareAtLeastTwoFuzzyWords(a, b) {

    const aw =
        a.split(" ").filter(word => word.length > 1);

    const bw =
        b.split(" ").filter(word => word.length > 1);

    const used =
        new Set();

    let count = 0;

    for (const bWord of bw) {
        for (let i = 0; i < aw.length; i++) {
            if (used.has(i)) {
                continue;
            }
            if (wordsFuzzilyMatch(aw[i], bWord)) {
                used.add(i);
                count++;
                break;
            }
        }
    }

    return count >= 2;
}

function shareAtLeastTwoWords(a, b) {

    const aw =
        new Set(
            a.split(" ").filter(word => word.length > 1)
        );

    const bw =
        b.split(" ").filter(word => word.length > 1);

    let count = 0;

    for (const word of bw) {
        if (aw.has(word)) {
            count++;
        }
    }

    return count >= 2;
}

function vehicleTextMostlyAlign(values) {

    const normalized =
        values.map(value =>
            normalizeText(value)
                .replace(/[^A-Z0-9 ]/g, " ")
                .replace(/\bBY\b/g, " ")
                .replace(/\s+/g, " ")
                .trim()
        );

    if (normalized.length < 2) {
        return true;
    }

    const firstWords =
        new Set(
            normalized[0]
                .split(" ")
                .filter(word => word.length >= 3)
        );

    return normalized.slice(1).every(value => {

        const words =
            value
                .split(" ")
                .filter(word => word.length >= 3);

        return words.some(word =>
            firstWords.has(word)
        );
    });
}

function escapeRegex(value) {

    return value
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeTable(value) {

    return emptyDash(value)
        .replace(/\|/g, "\\|");
}

function escapeHtml(value) {

    return (value || "")
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
