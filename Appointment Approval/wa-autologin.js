console.log(
    "WA DOL vehicle search helper loaded.",
    "Frame:", (window.top === window.self ? "top" : "iframe"),
    "URL:", location.href
);

function setNativeValue(el, value) {

    const prototype =
        Object.getPrototypeOf(el);

    const descriptor =
        Object.getOwnPropertyDescriptor(
            prototype,
            "value"
        );

    if (descriptor && descriptor.set) {
        descriptor.set.call(el, value);
    } else {
        el.value = value;
    }

    el.dispatchEvent(
        new Event("input", { bubbles: true })
    );

    el.dispatchEvent(
        new Event("change", { bubbles: true })
    );
}

function findClickableByText(text) {

    const norm = value =>
        (value || "")
            .toString()
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();

    const target = norm(text);

    const candidates =
        Array.from(
            document.querySelectorAll(
                "span, a, button, [role='button'], div[tabindex], li"
            )
        );

    return (
        candidates.find(el =>
            el.children.length === 0 &&
            norm(el.textContent) === target
        ) || null
    );
}

function clickElementOrAncestor(el) {

    const clickable =
        el.closest(
            "a, button, [role='button'], [tabindex], li"
        ) || el;

    clickable.click();
}

function fillAndSearch(vin) {

    const vinField =
        document.getElementById("Dd-b");

    if (!vinField) {
        console.warn(
            "WA DOL search: VIN field (#Dd-b) not found in this frame."
        );
        return false;
    }

    setNativeValue(vinField, vin);

    const reasonField =
        document.getElementById("Df-8");

    if (reasonField) {
        setNativeValue(reasonField, "PERBUSVER");
    } else {
        console.warn(
            "WA DOL search: reason dropdown (#Df-8) not found."
        );
    }

    const searchLabel =
        document.getElementById("caption2_Dd-l") ||
        findClickableByText("Search");

    if (searchLabel) {
        clickElementOrAncestor(searchLabel);
    } else {
        console.warn(
            "WA DOL search: Search element not found."
        );
    }

    return true;
}

function injectManualFillWidget() {

    if (document.getElementById("wa-manual-fill-widget")) {
        return;
    }

    if (!document.getElementById("Dd-b")) {
        // Only add this in the frame that actually has the form.
        return;
    }

    const box = document.createElement("div");
    box.id = "wa-manual-fill-widget";
    box.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 999999;
        background: white;
        border: 2px solid #4B2E83;
        border-radius: 8px;
        padding: 10px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        font-family: sans-serif;
        font-size: 12px;
        display: flex;
        gap: 6px;
        align-items: center;
    `;

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "VIN";
    input.style.cssText = `
        padding: 6px;
        border: 1px solid #ccc;
        border-radius: 4px;
        width: 150px;
        text-transform: uppercase;
    `;

    const button = document.createElement("button");
    button.textContent = "Fill & Search";
    button.style.cssText = `
        background: #4B2E83;
        color: white;
        border: none;
        padding: 6px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 600;
    `;

    button.addEventListener("click", () => {

        const vin =
            input.value.trim().toUpperCase();

        if (!vin) {
            input.focus();
            return;
        }

        const filled = fillAndSearch(vin);

        button.textContent =
            filled ? "Done" : "Failed — see console";

        setTimeout(() => {
            button.textContent = "Fill & Search";
        }, 2000);
    });

    // Pre-fill the box with the pending VIN if one exists (sent over
    // when you clicked the WA button in HappyFox), so you can just
    // glance and click rather than retyping it.
    chrome.runtime.sendMessage(
        { action: "getWaPendingVin" },
        response => {
            if (!chrome.runtime.lastError && response?.vin) {
                input.value = response.vin;
            }
        }
    );

    box.appendChild(input);
    box.appendChild(button);
    document.body.appendChild(box);
}

injectManualFillWidget();

// The vehicle-search screen can appear via an SPA-style transition
// without a full page reload, so keep watching for it. This is a
// cheap no-op once the widget already exists.
const observer = new MutationObserver(() => {
    injectManualFillWidget();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});
