"use strict";
const TOOL_ID = "1f70c4c5-f80c-45aa-8d17-9b42f7ea6b7f";
const DISPLAY_NAME = "SVG URL link";
const ATTACH_KEY = TOOL_ID + ':state';
const DEFAULTS = { urlLink: "/product/" };
let latestParams = DEFAULTS;
let isExecuting = false;
function normalizeParams(input) {
    const value = input ?? {};
    return {
        urlLink: typeof value.urlLink === 'string' ? value.urlLink : DEFAULTS.urlLink,
    };
}
function htmlEscapeAttribute(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}
function uniqueSceneNodes(nodes) {
    return [...new Set(nodes)].filter((node) => !node.removed);
}
function attachRelaunch(nodes) {
    const unique = uniqueSceneNodes(nodes);
    if (unique.length > 0) {
        for (const node of unique)
            node.setRelaunchData({ [TOOL_ID]: DISPLAY_NAME });
    }
    else {
        figma.root.setRelaunchData({ [TOOL_ID]: DISPLAY_NAME });
    }
}
function singleSelectedTarget() {
    const selection = figma.currentPage.selection;
    return selection.length === 1 ? (selection[0] ?? null) : null;
}
function readAttachment(node) {
    try {
        const parsed = JSON.parse(node.getPluginData(ATTACH_KEY));
        if (parsed?.version !== 1)
            return null;
        return {
            version: 1,
            params: normalizeParams(parsed.params),
            state: (parsed.state ?? null),
        };
    }
    catch {
        return null;
    }
}
function writeAttachment(node, params, state) {
    node.setPluginData(ATTACH_KEY, JSON.stringify({ version: 1, params, state }));
}
function status_apply(_selection, enabled) {
    return enabled ? "Ready to apply" : "Select a layer";
}
function evaluateEnabled_apply(selection) {
    return selection.length === 1;
}
function actionTarget_apply() {
    const target = singleSelectedTarget();
    if (target == null)
        return null;
    return evaluateEnabled_apply([target]) ? target : null;
}
function evaluateEnabled_read(selection) {
    return selection.length === 1;
}
function actionTarget_read() {
    const target = singleSelectedTarget();
    if (target == null)
        return null;
    return evaluateEnabled_read([target]) ? target : null;
}
async function action_apply(params, target, _previousState) {
    const affectedNodes = [target];
    (() => {
        target.setSharedPluginData("tidata", "url_link", params.urlLink);
        figma.notify('Data applied to "' + target.name + '"');
    })();
    return { affectedNodes, state: null };
}
async function action_read(_params, target, _previousState) {
    const affectedNodes = [target];
    (() => {
        const url = target.getSharedPluginData("tidata", "url_link");
        if (url) {
            figma.notify('url_link: ' + url);
        }
        else {
            figma.notify('No data on "' + target.name + '"');
        }
    })();
    return { affectedNodes, state: null };
}
async function runAction_apply(target, notify) {
    isExecuting = true;
    try {
        const result = await action_apply(latestParams, target, null);
        writeAttachment(target, latestParams, result.state);
        attachRelaunch(result.affectedNodes);
        pushActionStates();
        if (notify) {
            const created = result.affectedNodes.filter((node) => node !== target);
            if (created.length > 0) {
                figma.viewport.scrollAndZoomIntoView(created);
            }
            figma.notify(DISPLAY_NAME + " ran");
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        figma.notify(message, { error: true });
        throw error;
    }
    finally {
        isExecuting = false;
    }
}
async function runAction_read(target, notify) {
    isExecuting = true;
    try {
        const result = await action_read(latestParams, target, null);
        writeAttachment(target, latestParams, result.state);
        attachRelaunch(result.affectedNodes);
        pushActionStates();
        if (notify) {
            const created = result.affectedNodes.filter((node) => node !== target);
            if (created.length > 0) {
                figma.viewport.scrollAndZoomIntoView(created);
            }
            figma.notify(DISPLAY_NAME + " ran");
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        figma.notify(message, { error: true });
        throw error;
    }
    finally {
        isExecuting = false;
    }
}
function pushActionStates() {
    const selection = figma.currentPage.selection;
    const t_apply = actionTarget_apply();
    const enabled_apply = t_apply != null;
    const t_read = actionTarget_read();
    const enabled_read = t_read != null;
    figma.ui.postMessage({
        type: 'action-state',
        actions: {
            "apply": { enabled: enabled_apply, label: "Apply data", status: status_apply(selection, enabled_apply) },
            "read": { enabled: enabled_read, label: "Read data", status: undefined },
        },
    });
}
function refreshSelection() {
    if (isExecuting)
        return;
    const target = singleSelectedTarget();
    const attachment = target != null ? readAttachment(target) : null;
    if (attachment) {
        latestParams = attachment.params;
    }
    else if (target) {
        const url = target.getSharedPluginData("tidata", "url_link");
        if (url) {
            latestParams = { urlLink: url };
        }
        else {
            latestParams = DEFAULTS;
        }
    }
    else {
        latestParams = DEFAULTS;
    }
    figma.ui.postMessage({ type: 'params-change', params: latestParams });
    pushActionStates();
}
const initialTarget = singleSelectedTarget();
const initialAttachment = initialTarget != null ? readAttachment(initialTarget) : null;
const initialParams = initialAttachment?.params ?? DEFAULTS;
latestParams = initialParams;
let html = __html__;
html = html.replace(/(id="urlLink"[^>]*\bvalue=")[^"]*(")/g, '$1' + htmlEscapeAttribute(String(initialParams.urlLink)) + '$2');
figma.root.setRelaunchData({ [TOOL_ID]: DISPLAY_NAME });
figma.showUI(html, { width: 280, height: 320 });
pushActionStates();
figma.on('selectionchange', refreshSelection);
figma.ui.onmessage = (msg) => {
    if (msg.type === 'resize') {
        figma.ui.resize(280, Math.max(120, Math.min(900, Math.round(msg.height))));
        return;
    }
    if (msg.type === 'action') {
        if (msg.id === "apply") {
            const target = actionTarget_apply();
            if (target == null)
                return;
            latestParams = normalizeParams(msg.params);
            void runAction_apply(target, true);
            return;
        }
        if (msg.id === "read") {
            const target = actionTarget_read();
            if (target == null)
                return;
            latestParams = normalizeParams(msg.params);
            void runAction_read(target, true);
            return;
        }
        return;
    }
};
