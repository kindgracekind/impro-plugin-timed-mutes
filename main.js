var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.js
var main_exports = {};
__export(main_exports, {
  default: () => TimedMutesPlugin
});
module.exports = __toCommonJS(main_exports);

// node_modules/@impro.social/impro-plugin/main.js
var SimpleUUID = class {
  #id = 0;
  create() {
    return this.#id++;
  }
};
var uuid = new SimpleUUID();
function post(message) {
  self.postMessage(message);
}
var callHandlers = /* @__PURE__ */ new Map();
var pendingHostCalls = /* @__PURE__ */ new Map();
function hostCall(method, ...args) {
  const hostCallId = uuid.create();
  return new Promise((resolve, reject) => {
    pendingHostCalls.set(hostCallId, { resolve, reject });
    post({ type: "hostCall", method, hostCallId, args });
  });
}
var eventListeners = /* @__PURE__ */ new Map();
var registeredEvents = /* @__PURE__ */ new Set();
async function invokeListeners(listeners, event, args) {
  for (const listener of listeners) {
    try {
      await listener(...args);
    } catch (error) {
      console.error(`"${event}" listener threw:`, error);
    }
  }
}
async function dispatchEvent(event, args) {
  const listeners = eventListeners.get(event) ?? /* @__PURE__ */ new Set();
  switch (event) {
    case "post-context-menu":
    case "profile-context-menu": {
      const menu = new Menu();
      await invokeListeners(listeners, event, [menu, ...args]);
      return menu._serialize();
    }
    case "post-composer-open": {
      const composer = new Composer();
      await invokeListeners(listeners, event, [composer, ...args]);
      return composer._serialize();
    }
    default:
      console.warn(`No dispatch case for plugin event "${event}".`);
      return null;
  }
}
function addEventListener(event, listener) {
  let listeners = eventListeners.get(event);
  if (!listeners) {
    listeners = /* @__PURE__ */ new Set();
    eventListeners.set(event, listeners);
  }
  listeners.add(listener);
  if (!registeredEvents.has(event)) {
    registeredEvents.add(event);
    const handlerId = uuid.create();
    callHandlers.set(handlerId, (...args) => dispatchEvent(event, args));
    post({
      type: "register",
      target: "eventListener",
      event,
      handlerId
    });
  }
}
var MenuItem = class {
  constructor() {
    this.title = "";
    this.icon = null;
    this._callback = () => {
    };
  }
  /**
   * Set the menu item's label.
   * @param {string} title
   * @returns {this}
   */
  setTitle(title) {
    this.title = title;
    return this;
  }
  /**
   * Set the leading icon. Either a named icon (string) or a {@link VirtualEl}
   * to render as the icon.
   * @param {string | VirtualEl} icon
   * @returns {this}
   */
  setIcon(icon) {
    this.icon = icon;
    return this;
  }
  /**
   * Called when the user activates the item.
   * @param {() => void} callback
   * @returns {this}
   */
  onClick(callback) {
    this._callback = callback;
    return this;
  }
};
var Menu = class {
  constructor() {
    this.items = [];
  }
  /**
   * Append a menu item. The builder receives a {@link MenuItem} to configure.
   * @param {(item: MenuItem) => void} builder
   * @returns {this}
   */
  addItem(builder) {
    const item = new MenuItem();
    builder(item);
    this.items.push(item);
    return this;
  }
  /** @internal */
  _serialize() {
    return this.items.map((item) => {
      const handlerId = uuid.create();
      callHandlers.set(handlerId, item._callback);
      const icon = item.icon instanceof VirtualEl ? item.icon._serialize() : item.icon;
      return { title: item.title, icon, handlerId };
    });
  }
};
var Composer = class {
  /** @type {{ op: string, text: string }[]} */
  #ops = [];
  /** @type {number | null} */
  #cursor = null;
  /**
   * Replace the composer's current text.
   * @param {string} text
   * @returns {this}
   */
  setText(text) {
    this.#ops.push({ op: "set", text: String(text) });
    return this;
  }
  /**
   * Append text to the end of the composer.
   * @param {string} text
   * @returns {this}
   */
  appendText(text) {
    this.#ops.push({ op: "append", text: String(text) });
    return this;
  }
  /**
   * Prepend text to the start of the composer.
   * @param {string} text
   * @returns {this}
   */
  prependText(text) {
    this.#ops.push({ op: "prepend", text: String(text) });
    return this;
  }
  /**
   * Move the caret to the given character index in the final text.
   * @param {number} index
   * @returns {this}
   */
  setCursor(index) {
    this.#cursor = index;
    return this;
  }
  /** @internal */
  _serialize() {
    return { ops: this.#ops, cursor: this.#cursor };
  }
};
var PluginData = class {
  /**
   * Fetch a hydrated post view by AT-URI, as seen by the current user.
   * @param {string} uri
   * @returns {Promise<PostView>}
   */
  getPost(uri) {
    return (
      /** @type {Promise<PostView>} */
      hostCall("getPost", { uri })
    );
  }
  /**
   * Fetch the basic profile view for a DID.
   * @param {string} did
   * @returns {Promise<ProfileView>}
   */
  getProfile(did) {
    return (
      /** @type {Promise<ProfileView>} */
      hostCall("getProfile", { did })
    );
  }
  /**
   * Like {@link PluginData.getProfile}, but includes viewer relationship
   * details not present on the basic profile view: `viewer.following`,
   * `viewer.followedBy`, and `viewer.knownFollowers` (a summary of mutual
   * followers).
   * @param {string} did
   * @returns {Promise<DetailedProfileView>}
   */
  getDetailedProfile(did) {
    return (
      /** @type {Promise<DetailedProfileView>} */
      hostCall("getDetailedProfile", { did })
    );
  }
  /**
   * The full known-followers list for `did`. The summary on
   * {@link PluginData.getDetailedProfile}'s `viewer.knownFollowers` is
   * capped to a handful; use this to paginate the complete list.
   * @param {string} did
   * @returns {Promise<KnownFollowersResponse>}
   */
  getKnownFollowers(did) {
    return (
      /** @type {Promise<KnownFollowersResponse>} */
      hostCall("getKnownFollowers", { did })
    );
  }
  /**
   * Fetch a raw repo record by `(repo, collection, rkey)`.
   * @param {string} repo
   * @param {string} collection
   * @param {string} rkey
   * @returns {Promise<RepoRecord>}
   */
  getRecord(repo, collection, rkey) {
    return (
      /** @type {Promise<RepoRecord>} */
      hostCall("getRecord", { repo, collection, rkey })
    );
  }
  /**
   * Get records that link to `subject`, from a backlink
   * index of public records.
   *
   * `subject` is an AT-URI or a DID; `source` names the linking field as
   * `<collection>:<dot.path.to.field>` (e.g.
   * `"app.bsky.graph.listitem:list"`). The host paginates for you, up to
   * `limit` records (max 1000 per call — page by making further calls
   * with a narrower subject).
   *
   * @param {{ subject: string, source: string, limit?: number }} params
   * @returns {Promise<BacklinkRecord[]>}
   */
  getBacklinks({ subject, source, limit = 100 }) {
    return (
      /** @type {Promise<BacklinkRecord[]>} */
      hostCall("getBacklinks", { subject, source, limit })
    );
  }
  /**
   * Fetch the hydrated thread around a post (the post, its parents, and
   * replies), as the host renders it.
   * @param {string} uri
   * @returns {Promise<PostThreadView | null>}
   */
  getPostThread(uri) {
    return (
      /** @type {Promise<PostThreadView | null>} */
      hostCall("getPostThread", { uri })
    );
  }
  /**
   * Fetch a list's metadata view by AT-URI.
   * @param {string} uri
   * @returns {Promise<ListView | null>}
   */
  getList(uri) {
    return (
      /** @type {Promise<ListView | null>} */
      hostCall("getList", { uri })
    );
  }
  /**
   * Fetch a feed generator view by AT-URI.
   * @param {string} uri
   * @returns {Promise<FeedGeneratorView | null>}
   */
  getFeedGenerator(uri) {
    return (
      /** @type {Promise<FeedGeneratorView | null>} */
      hostCall("getFeedGenerator", { uri })
    );
  }
  /**
   * The current user's full hydrated profile (unlike `app.currentUser`,
   * which carries only `did` and `handle`). `null` when signed out.
   * @returns {Promise<DetailedProfileView | null>}
   */
  getCurrentUserProfile() {
    return (
      /** @type {Promise<DetailedProfileView | null>} */
      hostCall("getCurrentUserProfile", {})
    );
  }
  /**
   * Call a read-only AppView query endpoint through the current user's
   * session and get the raw XRPC response back.
   *
   * Only an allowlisted set of `app.bsky.*` query NSIDs is accepted;
   * viewer-private queries (mutes, bookmarks, notifications, preferences,
   * timeline, ...) additionally require the `"privateData"` action
   * permission. Unlike the curated methods above, responses are canonical
   * server state — they may briefly disagree with what the host UI shows
   * while an optimistic update is in flight, and results are not cached.
   *
   * @param {string} nsid e.g. `"app.bsky.feed.getQuotes"`
   * @param {Record<string, string | number | boolean | string[]>} [params]
   * @returns {Promise<XrpcQueryResponse>}
   */
  xrpcQuery(nsid, params = {}) {
    return (
      /** @type {Promise<XrpcQueryResponse>} */
      hostCall("xrpcQuery", { nsid, params })
    );
  }
};
var BinaryCache = class {
  /**
   * @param {string} key
   * @returns {Promise<ArrayBuffer | null>}
   */
  async get(key) {
    return (
      /** @type {Promise<ArrayBuffer | null>} */
      hostCall("getBinaryCacheEntry", { key: String(key) })
    );
  }
  /**
   * Whether an entry is stored under `key`, without transferring its bytes.
   *
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async has(key) {
    return (
      /** @type {boolean} */
      await hostCall("hasBinaryCacheEntry", { key: String(key) })
    );
  }
  /**
   * Every key this plugin currently has stored, in no particular order.
   *
   * @returns {Promise<string[]>}
   */
  async keys() {
    return (
      /** @type {string[]} */
      await hostCall("listBinaryCacheEntries")
    );
  }
  /**
   * @param {string} key
   * @param {ArrayBuffer | ArrayBufferView} data
   * @returns {Promise<void>}
   */
  async put(key, data) {
    const buffer = (
      /** @type {ArrayBuffer} */
      data instanceof ArrayBuffer ? data : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    );
    await hostCall("putBinaryCacheEntry", { key: String(key), data: buffer });
  }
  /**
   * @param {string} key
   * @returns {Promise<void>}
   */
  async delete(key) {
    await hostCall("deleteBinaryCacheEntry", { key: String(key) });
  }
};
var App = class {
  /** @internal */
  constructor() {
    this.currentUser = null;
    this.data = new PluginData();
    this.binaryCache = new BinaryCache();
  }
  /**
   * Register an event listener. Supported events:
   *
   * - `"post-context-menu"` — `(menu: Menu, post) => void`, called when the
   *   user opens a post's context menu.
   * - `"profile-context-menu"` — `(menu: Menu, profile) => void`, called
   *   when the user opens a profile's context menu.
   * - `"post-composer-open"` — `(composer: Composer, context: { kind, replyTo, replyRoot, quotedPost }) => void`,
   *   called when the post composer opens; use `composer` to seed text.
   *
   * The `listener` signature varies per event — see {@link PluginEventMap}.
   * @template {keyof PluginEventMap} K
   * @param {K} event
   * @param {PluginEventMap[K]} listener
   * @returns {void}
   */
  on(event, listener) {
    addEventListener(event, listener);
  }
  /**
   * Re-run registered feed filters. Pass a `feedURI` to limit the refresh
   * to one feed, or omit/pass `null` to refresh every feed.
   * @param {string | null} [feedURI]
   * @returns {Promise<void>}
   */
  refreshFeedFilters(feedURI = null) {
    return (
      /** @type {Promise<void>} */
      hostCall("refreshFeedFilters", feedURI)
    );
  }
  /**
   * Mute an actor on behalf of the signed-in user. Requires the `"mute"`
   * scope in the plugin manifest's `permissions.actions`.
   * @param {string} did
   * @returns {Promise<void>}
   */
  muteActor(did) {
    return (
      /** @type {Promise<void>} */
      hostCall("muteActor", { did, mute: true })
    );
  }
  /**
   * Unmute an actor. Requires the `"mute"` scope.
   * @param {string} did
   * @returns {Promise<void>}
   */
  unmuteActor(did) {
    return (
      /** @type {Promise<void>} */
      hostCall("muteActor", { did, mute: false })
    );
  }
  /**
   * Block an actor on behalf of the signed-in user. Requires the `"block"`
   * scope in the plugin manifest's `permissions.actions`.
   * @param {string} did
   * @returns {Promise<void>}
   */
  blockActor(did) {
    return (
      /** @type {Promise<void>} */
      hostCall("blockActor", { did, block: true })
    );
  }
  /**
   * Unblock an actor. Requires the `"block"` scope.
   * @param {string} did
   * @returns {Promise<void>}
   */
  unblockActor(did) {
    return (
      /** @type {Promise<void>} */
      hostCall("blockActor", { did, block: false })
    );
  }
  /**
   * Acts like the user clicking "Show less like this": sends the
   * `requestLess` feedback signal to `feedUri` and collapses the post
   * behind a feedback message in feeds. Requires the `"feedFeedback"`
   * scope.
   * @param {string} postUri
   * @param {string} feedUri
   * @returns {Promise<void>}
   */
  showLessLikeThis(postUri, feedUri) {
    return (
      /** @type {Promise<void>} */
      hostCall("showLessLikeThis", { postUri, feedUri })
    );
  }
  /**
   * Sends the `requestMore` feedback signal to `feedUri` for `postUri`.
   * Requires the `"feedFeedback"` scope.
   * @param {string} postUri
   * @param {string} feedUri
   * @returns {Promise<void>}
   */
  showMoreLikeThis(postUri, feedUri) {
    return (
      /** @type {Promise<void>} */
      hostCall("showMoreLikeThis", { postUri, feedUri })
    );
  }
};
var Notice = class {
  #toastId = uuid.create();
  #timeout;
  #hidden = false;
  /**
   * `timeout` is in milliseconds; `0` (the default) keeps the toast up until
   * {@link Notice.hide} is called.
   * @param {string} message
   * @param {number} [timeout=0]
   */
  constructor(message, timeout = 0) {
    this.#timeout = timeout;
    this.noticeEl = new VirtualEl("div");
    this.noticeEl.addClass("toast");
    this.noticeEl.setText(message);
    queueMicrotask(() => {
      if (this.#hidden) return;
      hostCall("showToast", {
        toastId: this.#toastId,
        element: this.noticeEl._serialize(),
        timeout: this.#timeout
      });
    });
  }
  /**
   * Updates `noticeEl`'s text. Only takes effect if called synchronously
   * before the microtask that snapshots the toast for the initial render.
   * @param {string} message
   * @returns {this}
   */
  setMessage(message) {
    this.noticeEl.setText(message);
    return this;
  }
  /**
   * Dismisses the toast. No-op if already hidden.
   * @returns {void}
   */
  hide() {
    if (this.#hidden) return;
    this.#hidden = true;
    hostCall("hideToast", { toastId: this.#toastId });
  }
};
var registered = false;
var Plugin = class {
  /** @internal */
  constructor() {
    this.app = new App();
  }
  /**
   * Adds an item to the impro sidebar. `icon` is a {@link VirtualEl} (typically
   * an SVG) or a string; `callback` runs when the item is clicked.
   * @param {string | VirtualEl} icon
   * @param {string} title
   * @param {() => void} [callback]
   * @returns {void}
   */
  addSidebarItem(icon, title, callback = () => {
  }) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, callback);
    post({
      type: "register",
      target: "sidebarItem",
      icon: icon instanceof VirtualEl ? icon._serialize() : icon,
      title,
      handlerId
    });
  }
  /**
   * Loads this plugin's account-synced JSON blob. Follows the user across
   * devices via account preferences. Returns whatever was last saved, or null.
   * @returns {Promise<unknown>}
   */
  async loadData() {
    return hostCall("loadData");
  }
  /**
   * Persists `data` as this plugin's account-synced JSON blob.
   * @param {Cloneable} data
   * @returns {Promise<void>}
   */
  async saveData(data) {
    await hostCall("saveData", { data });
  }
  /**
   * Device-local counterpart to {@link Plugin.loadData}: never synced through
   * the user's account preferences, so it's the right place for anything that
   * shouldn't silently follow the plugin to another device (e.g. a locally
   * held secret key). Cleared on uninstall, same as loadData/saveData.
   * @returns {Promise<unknown>}
   */
  async loadLocalData() {
    return hostCall("loadLocalData");
  }
  /**
   * Device-local counterpart to {@link Plugin.saveData}.
   * @param {Cloneable} data
   * @returns {Promise<void>}
   */
  async saveLocalData(data) {
    await hostCall("saveLocalData", { data });
  }
  /**
   * Registers a {@link PluginSettingTab} shown under this plugin's entry in
   * the app's settings.
   * @param {PluginSettingTab} tab
   * @returns {void}
   */
  addSettingTab(tab) {
    tab.plugin = this;
    const displayHandlerId = uuid.create();
    callHandlers.set(displayHandlerId, () => {
      tab.containerEl = new VirtualEl("div");
      tab.display();
      return tab.containerEl._serialize();
    });
    post({
      type: "register",
      target: "settingTab",
      name: tab.name ?? null,
      displayHandlerId
    });
  }
  /**
   * Registers a feed filter. `callback(feedUri, feedItems)` returns an object
   * `{ [postUri]: false }` for posts to hide from the feed. Only `false` hides;
   * any other value is ignored, so one plugin can't un-hide what another hid.
   * @param {(feedUri: string, feedItems: FeedItem[]) => Record<string, boolean> | Promise<Record<string, boolean>>} callback
   * @returns {void}
   */
  addFeedFilter(callback = () => ({})) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, callback);
    post({
      type: "register",
      target: "feedFilter",
      handlerId
    });
  }
  /**
   * Registers a rich-text transform. `callback(tokens, context)` receives the
   * token stream for one post and returns a new token array (or the input
   * unchanged). Tokens are one of: `text` (plain string run), `facet` (linked
   * text with an atproto facet feature), `inline` (a plugin-produced inline
   * {@link VirtualEl}), or `block` (a plugin-produced block VirtualEl). See
   * {@link FlattenedTokens} for pattern-matching across token boundaries.
   *
   * A node token's `node` is a {@link VirtualEl} when this transform creates it,
   * but arrives in serialized form when an earlier transform produced it.
   *
   * `options.handlesFacetTypes` is an array of facet feature `$type` strings
   * this transform owns, so the host can suppress fallback rendering flash
   * while the transform runs.
   * @param {(tokens: RichTextToken[], context: { uri: string, surface: string, source: { text: string } }) => RichTextToken[] | Promise<RichTextToken[]>} callback
   * @param {{ handlesFacetTypes?: string[] }} [options]
   * @returns {void}
   */
  registerRichTextTransform(callback = (tokens) => tokens, options = {}) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, async (batch) => {
      const results = [];
      for (const { tokens, context } of batch) {
        try {
          const value = await callback(tokens, context);
          results.push({ value: serializeTransformTokens(value) });
        } catch (error) {
          results.push({ error: getErrorMessage(error) });
        }
      }
      return results;
    });
    const handlesFacetTypes = Array.isArray(options.handlesFacetTypes) ? options.handlesFacetTypes.filter((type) => typeof type === "string") : [];
    post({
      type: "register",
      target: "richTextTransform",
      handlerId,
      handlesFacetTypes
    });
  }
  /**
   * Registers a slot renderer. `<plugin-slot name="...">` elements in the host
   * UI (or other plugins' output) invoke `callback(context)`, where `context`
   * is a flat string map of the slot element's attributes. The callback should
   * return a {@link VirtualEl} or `null`.
   *
   * `options.cacheKey` is an array of context field names. If provided, the
   * host treats the slot content as a pure function of these fields — omitting
   * other fields from the callback's context and caching return values until
   * invalidated by {@link Plugin.refreshSlot}. An empty array declares that
   * the content depends on no context at all, so one cached result serves
   * every instance.
   *
   * The host batches all pending contexts of a render into one call.
   * @param {string} name
   * @param {(context: Record<string, string>) => RenderResult | Promise<RenderResult>} callback
   * @param {{ cacheKey?: string[] }} [options]
   * @returns {void}
   */
  registerSlot(name, callback = () => null, options = {}) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, async (batch) => {
      const results = [];
      for (const context of batch) {
        try {
          results.push({
            value: await getSlotContent(name, callback, context)
          });
        } catch (error) {
          results.push({ error: getErrorMessage(error) });
        }
      }
      return results;
    });
    const cacheKey = Array.isArray(options.cacheKey) ? options.cacheKey.filter((field) => typeof field === "string") : null;
    post({
      type: "register",
      target: "slot",
      name,
      handlerId,
      cacheKey,
      batch: true
    });
  }
  /**
   * Registers a full-page view reachable via {@link Plugin.openPage}. `display()`
   * is called on navigation and must return a {@link VirtualEl}, or nothing to
   * render an empty page.
   * @param {{ id: string, title?: string | null, display?: () => RenderResult | Promise<RenderResult> }} options
   * @returns {void}
   */
  registerPage({ id, title = null, display = () => null }) {
    const displayHandlerId = uuid.create();
    callHandlers.set(displayHandlerId, async () => {
      const result = (
        /** @type {unknown} */
        await display()
      );
      if (result == null) return null;
      if (!(result instanceof VirtualEl)) {
        throw new Error(
          `Page "${id}" must return a VirtualEl or null, got ${describeValue(result)}`
        );
      }
      return result._serialize();
    });
    post({
      type: "register",
      target: "page",
      id,
      title,
      displayHandlerId
    });
  }
  /**
   * Navigates the user to one of this plugin's registered pages.
   * @param {string} pageId
   * @returns {Promise<void>}
   */
  openPage(pageId) {
    return (
      /** @type {Promise<void>} */
      hostCall("openPage", { pageId })
    );
  }
  /**
   * Re-invokes a registered page's display callback if the page is open.
   * `options.reset` also discards the rendered tree instead of patching it.
   * @param {string} pageId
   * @param {{ reset?: boolean }} [options]
   * @returns {Promise<void>}
   */
  refreshPage(pageId, { reset = false } = {}) {
    return (
      /** @type {Promise<void>} */
      hostCall("refreshPage", { pageId, reset })
    );
  }
  /**
   * Makes mounted `<plugin-slot name=...>` instances re-invoke this plugin's
   * registered callback for that slot, and drops any cached results. Useful
   * when a slot's content depends on plugin state that changed after render.
   *
   * `options.keys` is an array of matcher objects OR'd together,
   * e.g. `[{ did: "..." }]` — any matching slots are invalidated and refreshed.
   * Omit to refresh every instance. A slot registered with a `cacheKey` can
   * only be matched on those declared fields, since its output depends on
   * nothing else.
   * @param {string} name
   * @param {{ keys?: Record<string, string>[] }} [options]
   * @returns {Promise<void>}
   */
  refreshSlot(name, options = {}) {
    return (
      /** @type {Promise<void>} */
      hostCall("refreshSlot", { name, keys: options.keys ?? null })
    );
  }
  /**
   * Override in your subclass. Runs after the plugin is loaded and the current user is resolved.
   * @returns {void | Promise<void>}
   */
  onload() {
  }
  /**
   * Override in your subclass. Runs when the plugin is being torn down (uninstall/reload).
   * @returns {void | Promise<void>}
   */
  onunload() {
  }
  /**
   * Boots the plugin. Call as `MyPlugin.register()` at the top of your plugin's
   * main.js — instantiates the subclass, resolves the current user onto
   * `app.currentUser`, then invokes {@link Plugin.onload}. Idempotent.
   * @returns {void}
   */
  static register() {
    if (registered) return;
    registered = true;
    const instance = new this();
    hostCall("getCurrentUser").then((user) => {
      instance.app.currentUser = user;
      return instance.onload();
    }).then(
      () => post({ type: "ready" }),
      (error) => post({
        type: "ready",
        error: getErrorMessage(error)
      })
    );
  }
};
function getErrorMessage(error) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message);
  }
  return String(error);
}
function describeValue(value) {
  if (value === null) return "null";
  if (typeof value !== "object") return typeof value;
  return value.constructor?.name ?? "object";
}
async function getSlotContent(name, callback, context) {
  const result = (
    /** @type {unknown} */
    await callback(context)
  );
  if (result == null) return null;
  if (!(result instanceof VirtualEl)) {
    throw new Error(
      `Slot "${name}" must return a VirtualEl or null, got ${describeValue(result)}`
    );
  }
  return result._serialize();
}
function serializeTransformTokens(tokens) {
  if (!Array.isArray(tokens)) return tokens;
  return tokens.map((token) => {
    if ((token?.type === "inline" || token?.type === "block") && token.node instanceof VirtualEl) {
      return { ...token, node: token.node._serialize() };
    }
    return token;
  });
}
var openModals = /* @__PURE__ */ new Map();
var Modal = class {
  #modalId = uuid.create();
  constructor() {
    this.contentEl = new VirtualEl("div");
    this.titleEl = new VirtualEl("h2");
  }
  /**
   * Show the modal. Runs {@link Modal.onOpen} first, then mounts the current el state.
   * @returns {void}
   */
  open() {
    if (openModals.has(this.#modalId)) return;
    openModals.set(this.#modalId, this);
    this.onOpen();
    post({
      type: "hostCall",
      method: "openModal",
      args: [
        {
          modalId: this.#modalId,
          title: this.titleEl._serialize(),
          content: this.contentEl._serialize()
        }
      ]
    });
  }
  /**
   * Re-render the open modal from the current `titleEl` / `contentEl` state. No-op if closed.
   * @returns {void}
   */
  update() {
    if (!openModals.has(this.#modalId)) return;
    post({
      type: "hostCall",
      method: "updateModal",
      args: [
        {
          modalId: this.#modalId,
          title: this.titleEl._serialize(),
          content: this.contentEl._serialize()
        }
      ]
    });
  }
  /**
   * Hide the modal and fire {@link Modal.onClose}.
   * @returns {void}
   */
  close() {
    if (!openModals.has(this.#modalId)) return;
    openModals.delete(this.#modalId);
    post({
      type: "hostCall",
      method: "closeModal",
      args: [{ modalId: this.#modalId }]
    });
    this.onClose();
  }
  /**
   * Lifecycle hook — override to populate `titleEl` / `contentEl` before the modal mounts.
   * @returns {void}
   */
  onOpen() {
  }
  /**
   * Lifecycle hook — override to react to the modal being dismissed (by `close()` or the user).
   * @returns {void}
   */
  onClose() {
  }
};
var PluginSettingTab = class {
  /**
   * @param {Plugin} plugin The owning plugin, available as `this.plugin`.
   */
  constructor(plugin) {
    this.plugin = plugin;
    this.containerEl = new VirtualEl("div");
    this.name = null;
  }
  /**
   * Set the tab's label.
   * @param {string} name
   * @returns {this}
   */
  setName(name) {
    this.name = name;
    return this;
  }
  /**
   * Override to render the tab's contents into `this.containerEl`.
   * @returns {void}
   */
  display() {
  }
  /**
   * Re-invoke {@link PluginSettingTab.display}. `reset: true` also discards the rendered tree.
   * @param {{ reset?: boolean }} [options]
   * @returns {Promise<void>}
   */
  refresh({ reset = false } = {}) {
    return (
      /** @type {Promise<void>} */
      hostCall("refreshSettingTab", { reset })
    );
  }
};
var Setting = class {
  /**
   * @param {VirtualEl} containerEl
   */
  constructor(containerEl) {
    this.settingEl = containerEl.createDiv({ cls: "setting-item" });
    this.infoEl = this.settingEl.createDiv({ cls: "setting-item-info" });
    this.nameEl = this.infoEl.createEl("h2", { cls: "setting-item-name" });
    this.descEl = this.infoEl.createEl("p", { cls: "setting-item-desc" });
    this.controlEl = this.settingEl.createDiv({
      cls: "setting-item-control"
    });
  }
  /**
   * Set the row's name/label.
   * @param {string} text
   * @returns {this}
   */
  setName(text) {
    this.nameEl.setText(text);
    return this;
  }
  /**
   * Set the row's description text below the name.
   * @param {string} text
   * @returns {this}
   */
  setDesc(text) {
    this.descEl.setText(text);
    return this;
  }
  /**
   * Add a text input; the callback receives a {@link TextComponent}.
   * @param {(component: TextComponent) => void} callback
   * @returns {this}
   */
  addText(callback) {
    const component = new TextComponent(this.controlEl);
    callback(component);
    return this;
  }
  /**
   * Add a multi-line text input; the callback receives a {@link TextAreaComponent}.
   * @param {(component: TextAreaComponent) => void} callback
   * @returns {this}
   */
  addTextArea(callback) {
    const component = new TextAreaComponent(this.controlEl);
    callback(component);
    return this;
  }
  /**
   * Add a toggle switch; the callback receives a {@link ToggleComponent}.
   * @param {(component: ToggleComponent) => void} callback
   * @returns {this}
   */
  addToggle(callback) {
    const component = new ToggleComponent(this.controlEl);
    callback(component);
    return this;
  }
  /**
   * Add a dropdown; the callback receives a {@link DropdownComponent}.
   * @param {(component: DropdownComponent) => void} callback
   * @returns {this}
   */
  addDropdown(callback) {
    const component = new DropdownComponent(this.controlEl);
    callback(component);
    return this;
  }
  /**
   * Add a button; the callback receives a {@link ButtonComponent}.
   * @param {(component: ButtonComponent) => void} callback
   * @returns {this}
   */
  addButton(callback) {
    const component = new ButtonComponent(this.controlEl);
    callback(component);
    return this;
  }
};
var TextComponent = class {
  /**
   * @internal
   * @param {VirtualEl} containerEl
   */
  constructor(containerEl) {
    this.el = containerEl.createEl("input", {
      attr: { type: "text" },
      cls: "setting-item-text-input"
    });
  }
  /**
   * Set the current value.
   * @param {string | null} value
   * @returns {this}
   */
  setValue(value) {
    this.el.setAttr("value", value == null ? "" : String(value));
    return this;
  }
  /**
   * Set the placeholder text shown when the input is empty.
   * @param {string} value
   * @returns {this}
   */
  setPlaceholder(value) {
    this.el.setAttr("placeholder", value);
    return this;
  }
  /**
   * Fires with the new string value on every change.
   * @param {(value: string) => void} callback
   * @returns {this}
   */
  onChange(callback) {
    this.el.onChange((event) => callback(event.target.value ?? ""));
    return this;
  }
};
var TextAreaComponent = class {
  /**
   * @internal
   * @param {VirtualEl} containerEl
   */
  constructor(containerEl) {
    this.el = containerEl.createEl("textarea", {
      cls: "setting-item-textarea"
    });
  }
  /**
   * Set the current value.
   * @param {string | null} value
   * @returns {this}
   */
  setValue(value) {
    this.el.setText(value == null ? "" : String(value));
    return this;
  }
  /**
   * Set the placeholder text shown when the input is empty.
   * @param {string} value
   * @returns {this}
   */
  setPlaceholder(value) {
    this.el.setAttr("placeholder", value);
    return this;
  }
  /**
   * Fires with the new string value on every change.
   * @param {(value: string) => void} callback
   * @returns {this}
   */
  onChange(callback) {
    this.el.onChange((event) => callback(event.target.value ?? ""));
    return this;
  }
};
var ToggleComponent = class {
  /**
   * @internal
   * @param {VirtualEl} containerEl
   */
  constructor(containerEl) {
    this.el = containerEl.createEl("toggle-switch", {
      cls: "setting-item-toggle"
    });
  }
  /**
   * Set the checked state.
   * @param {boolean} value
   * @returns {this}
   */
  setValue(value) {
    if (value) this.el.setAttr("checked", "");
    else delete this.el.attrs.checked;
    return this;
  }
  /**
   * Fires with the new boolean value on every change.
   * @param {(checked: boolean) => void} callback
   * @returns {this}
   */
  onChange(callback) {
    this.el.onChange((event) => callback(event.target.checked ?? false));
    return this;
  }
};
var DropdownComponent = class {
  /**
   * @internal
   * @param {VirtualEl} containerEl
   */
  constructor(containerEl) {
    this.el = containerEl.createEl("select", {
      cls: "setting-item-dropdown"
    });
  }
  /**
   * Append one option.
   * @param {string} value
   * @param {string} label
   * @returns {this}
   */
  addOption(value, label) {
    this.el.createEl("option", { text: label, attr: { value } });
    return this;
  }
  /**
   * Append every `{ value: label }` entry as an option.
   * @param {Record<string, string>} map
   * @returns {this}
   */
  addOptions(map) {
    for (const [value, label] of Object.entries(map)) {
      this.addOption(value, label);
    }
    return this;
  }
  /**
   * Select the option whose value matches.
   * @param {string} value
   * @returns {this}
   */
  setValue(value) {
    for (const child of this.el.children) {
      if (!(child instanceof VirtualEl)) continue;
      if (child.attrs.value === value) {
        child.attrs.selected = "";
      } else {
        delete child.attrs.selected;
      }
    }
    return this;
  }
  /**
   * Fires with the newly selected value on every change.
   * @param {(value: string) => void} callback
   * @returns {this}
   */
  onChange(callback) {
    this.el.onChange((event) => callback(event.target.value ?? ""));
    return this;
  }
};
var ButtonComponent = class {
  /**
   * @internal
   * @param {VirtualEl} containerEl
   */
  constructor(containerEl) {
    this.el = containerEl.createEl("button", {
      cls: "rounded-button"
    });
  }
  /**
   * Set the button's label.
   * @param {string} text
   * @returns {this}
   */
  setButtonText(text) {
    this.el.setText(text);
    return this;
  }
  /**
   * Style the button as the row's primary call-to-action.
   * @returns {this}
   */
  setCta() {
    this.el.addClass("rounded-button-primary");
    return this;
  }
  /**
   * Register a click handler.
   * @param {() => void} callback
   * @returns {this}
   */
  onClick(callback) {
    this.el.onClick(callback);
    return this;
  }
};
var IconComponent = class {
  /**
   * @internal
   * @param {VirtualEl} containerEl
   */
  constructor(containerEl) {
    this.el = containerEl.createEl("plugin-icon");
  }
  /**
   * Set the icon name.
   * @param {string} name
   * @returns {this}
   */
  setIcon(name) {
    this.el.setAttr("icon", name);
    return this;
  }
};
var BlobImageComponent = class {
  /**
   * @internal
   * @param {VirtualEl} containerEl
   */
  constructor(containerEl) {
    this.el = containerEl.createEl("plugin-blob-image");
  }
  /**
   * DID of the repo the blob belongs to.
   * @param {string} did
   * @returns {this}
   */
  setDid(did) {
    this.el.setAttr("did", did);
    return this;
  }
  /**
   * CID of the blob to render.
   * @param {string} cid
   * @returns {this}
   */
  setCid(cid) {
    this.el.setAttr("cid", cid);
    return this;
  }
  /**
   * Set the image's alt text.
   * @param {string} alt
   * @returns {this}
   */
  setAlt(alt) {
    this.el.setAttr("alt", alt);
    return this;
  }
  /**
   * Override the CDN URL prefix used to fetch the blob.
   * @param {string} prefix
   * @returns {this}
   */
  setCdnPrefix(prefix) {
    this.el.setAttr("cdn-prefix", prefix);
    return this;
  }
};
var ProfilesListComponent = class {
  /**
   * @internal
   * @param {VirtualEl} containerEl
   */
  constructor(containerEl) {
    this.el = containerEl.createEl("plugin-profiles-list");
  }
  /**
   * Set the DIDs to render (array or comma-separated string).
   * @param {string[] | string} dids
   * @returns {this}
   */
  setDids(dids) {
    const value = Array.isArray(dids) ? dids.join(",") : String(dids ?? "");
    this.el.setAttr("dids", value);
    return this;
  }
  /**
   * Message shown when the list is empty.
   * @param {string} message
   * @returns {this}
   */
  setEmptyMessage(message) {
    this.el.setAttr("empty-message", message);
    return this;
  }
};
var PostsFeedComponent = class {
  /**
   * @internal
   * @param {VirtualEl} containerEl
   */
  constructor(containerEl) {
    this.el = containerEl.createEl("plugin-posts-feed");
  }
  /**
   * Set the post URIs to render (array or comma-separated string).
   * @param {string[] | string} uris
   * @returns {this}
   */
  setUris(uris) {
    const value = Array.isArray(uris) ? uris.join(",") : String(uris ?? "");
    this.el.setAttr("uris", value);
    return this;
  }
  /**
   * Message shown when the feed is empty.
   * @param {string} message
   * @returns {this}
   */
  setEmptyMessage(message) {
    this.el.setAttr("empty-message", message);
    return this;
  }
};
var VirtualText = class {
  /**
   * @param {string | null | undefined} value
   */
  constructor(value) {
    this.value = value == null ? "" : String(value);
  }
  /**
   * @internal
   * @returns {SerializedText}
   */
  _serialize() {
    return { type: "text", value: this.value };
  }
};
var VirtualEl = class _VirtualEl {
  /**
   * @param {string} tag
   */
  constructor(tag) {
    this.tag = tag;
    this.attrs = {};
    this.styles = {};
    this.children = [];
    this.events = {};
  }
  /**
   * Set an inline style.
   * @param {string} name
   * @param {string | null} value
   * @returns {this}
   */
  setStyle(name, value) {
    this.styles[String(name)] = value == null ? "" : String(value);
    return this;
  }
  /**
   * Register a click handler.
   * @param {(event?: object) => void} fn
   * @returns {this}
   */
  onClick(fn) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, fn);
    this.events.click = handlerId;
    return this;
  }
  /**
   * Register a change handler (form controls).
   * @param {(event: { target: { value?: string, checked?: boolean } }) => void} fn
   * @returns {this}
   */
  onChange(fn) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, fn);
    this.events.change = handlerId;
    return this;
  }
  /**
   * Register an input handler (text inputs).
   * @param {(event: { target: { value?: string } }) => void} fn
   * @returns {this}
   */
  onInput(fn) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, fn);
    this.events.input = handlerId;
    return this;
  }
  /**
   * Replace all children with a single {@link VirtualText} node.
   * @param {string | null} text
   * @returns {this}
   */
  setText(text) {
    this.children = [];
    if (text != null && text !== "") this.children.push(new VirtualText(text));
    return this;
  }
  /**
   * Remove all children.
   * @returns {this}
   */
  empty() {
    this.children = [];
    return this;
  }
  /**
   * Append a {@link VirtualEl} or {@link VirtualText}; throws on anything else.
   * @param {VirtualEl | VirtualText} child
   * @returns {this}
   */
  appendChild(child) {
    if (!(child instanceof _VirtualEl) && !(child instanceof VirtualText)) {
      throw new TypeError(
        "appendChild expects a VirtualEl or VirtualText instance"
      );
    }
    this.children.push(child);
    return this;
  }
  /**
   * Append a {@link VirtualText} child.
   * @param {string} value
   * @returns {this}
   */
  appendText(value) {
    this.children.push(new VirtualText(value));
    return this;
  }
  /**
   * Append and return a {@link VirtualText} child.
   * @param {string} value
   * @returns {VirtualText}
   */
  createText(value) {
    const node = new VirtualText(value);
    this.children.push(node);
    return node;
  }
  /**
   * Add a CSS class, whitespace-joined with any existing classes.
   * @param {string} cls
   * @returns {this}
   */
  addClass(cls) {
    this.attrs.class = this.attrs.class ? `${this.attrs.class} ${cls}` : cls;
    return this;
  }
  /**
   * Set an attribute; `undefined` coerces to `""`.
   * @param {string} name
   * @param {string | undefined} value
   * @returns {this}
   */
  setAttr(name, value) {
    this.attrs[name] = value === void 0 ? "" : value;
    return this;
  }
  /**
   * Append a child element and return it. `options` accepts `text`,
   * `cls` (string or string[]), and `attr` (object). The optional callback
   * receives the new child for further building.
   * @param {string} tag
   * @param {{ text?: string, cls?: string | string[], attr?: Record<string, string> }} [options]
   * @param {(child: VirtualEl) => void} [callback]
   * @returns {VirtualEl}
   */
  createEl(tag, options = {}, callback) {
    const child = new _VirtualEl(tag);
    if (options.text != null) child.setText(options.text);
    if (options.cls) {
      child.attrs.class = Array.isArray(options.cls) ? options.cls.join(" ") : options.cls;
    }
    if (options.attr) Object.assign(child.attrs, options.attr);
    this.children.push(child);
    if (typeof callback === "function") callback(child);
    return child;
  }
  /**
   * Shorthand for `createEl("div", ...)`.
   * @param {{ text?: string, cls?: string | string[], attr?: Record<string, string> }} [options]
   * @param {(child: VirtualEl) => void} [callback]
   * @returns {VirtualEl}
   */
  createDiv(options = {}, callback) {
    return this.createEl("div", options, callback);
  }
  /**
   * Shorthand for `createEl("span", ...)`.
   * @param {{ text?: string, cls?: string | string[], attr?: Record<string, string> }} [options]
   * @param {(child: VirtualEl) => void} [callback]
   * @returns {VirtualEl}
   */
  createSpan(options = {}, callback) {
    return this.createEl("span", options, callback);
  }
  /**
   * Append a profiles-list custom component and return its builder.
   * @param {(c: ProfilesListComponent) => void} [callback]
   * @returns {ProfilesListComponent}
   */
  createProfilesList(callback) {
    const component = new ProfilesListComponent(this);
    if (typeof callback === "function") callback(component);
    return component;
  }
  /**
   * Append a posts-feed custom component and return its builder.
   * @param {(c: PostsFeedComponent) => void} [callback]
   * @returns {PostsFeedComponent}
   */
  createPostsFeed(callback) {
    const component = new PostsFeedComponent(this);
    if (typeof callback === "function") callback(component);
    return component;
  }
  /**
   * Append an icon custom component and return its builder.
   * @param {(c: IconComponent) => void} [callback]
   * @returns {IconComponent}
   */
  createIcon(callback) {
    const component = new IconComponent(this);
    if (typeof callback === "function") callback(component);
    return component;
  }
  /**
   * Append a blob-image custom component and return its builder.
   * @param {(c: BlobImageComponent) => void} [callback]
   * @returns {BlobImageComponent}
   */
  createBlobImage(callback) {
    const component = new BlobImageComponent(this);
    if (typeof callback === "function") callback(component);
    return component;
  }
  /**
   * @internal
   * @returns {SerializedElement}
   */
  _serialize() {
    const serialized = {
      type: "element",
      tag: this.tag,
      attrs: this.attrs,
      events: this.events,
      children: this.children.map((child) => child._serialize())
    };
    if (Object.keys(this.styles).length > 0) serialized.styles = this.styles;
    return serialized;
  }
};
self.onmessage = async (event) => {
  const message = event.data;
  if (!message || typeof message !== "object") return;
  if (message.type === "call") {
    const fn = callHandlers.get(message.handlerId);
    if (!fn) {
      post({
        type: "result",
        callId: message.callId,
        error: `unknown handler ${message.handlerId}`
      });
      return;
    }
    try {
      const value = await fn(...message.args);
      post({ type: "result", callId: message.callId, value });
    } catch (error) {
      post({
        type: "result",
        callId: message.callId,
        error: getErrorMessage(error)
      });
    }
    return;
  }
  if (message.type === "hostResult") {
    const pending = pendingHostCalls.get(message.hostCallId);
    if (!pending) return;
    pendingHostCalls.delete(message.hostCallId);
    if (message.error) pending.reject(new Error(message.error));
    else pending.resolve(message.value);
    return;
  }
  if (message.type === "event") {
    switch (message.event) {
      case "modalDismissed": {
        const modal = openModals.get(message.data.modalId);
        if (modal) {
          openModals.delete(message.data.modalId);
          modal.onClose();
        }
        return;
      }
    }
  }
};

// src/main.js
var MINUTE = 60 * 1e3;
var HOUR = 60 * MINUTE;
var DAY = 24 * HOUR;
var WEEK = 7 * DAY;
var CHECK_INTERVAL_MS = MINUTE;
var NOTICE_TIMEOUT_MS = 4e3;
var CUSTOM_DURATION = "custom";
var DURATION_PRESETS = [
  { value: "1h", label: "1 hour", ms: HOUR },
  { value: "8h", label: "8 hours", ms: 8 * HOUR },
  { value: "24h", label: "24 hours", ms: DAY },
  { value: "3d", label: "3 days", ms: 3 * DAY },
  { value: "1w", label: "1 week", ms: WEEK },
  { value: "2w", label: "2 weeks", ms: 2 * WEEK },
  { value: "30d", label: "30 days", ms: 30 * DAY }
];
var CUSTOM_UNITS = [
  { value: "minutes", label: "minutes", ms: MINUTE },
  { value: "hours", label: "hours", ms: HOUR },
  { value: "days", label: "days", ms: DAY },
  { value: "weeks", label: "weeks", ms: WEEK }
];
var DEFAULT_DATA = {
  defaultDuration: "24h",
  // { [did]: { until: number (epoch ms), mutedAt: number, handle, displayName } }
  mutes: {}
};
function presetOptions() {
  const options = {};
  for (const preset of DURATION_PRESETS) options[preset.value] = preset.label;
  options[CUSTOM_DURATION] = "Custom\u2026";
  return options;
}
function describeProfile(profile) {
  if (profile.displayName) {
    return `${profile.displayName} (@${profile.handle})`;
  }
  return `@${profile.handle}`;
}
function formatDate(timestamp) {
  return new Intl.DateTimeFormat(void 0, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}
function formatTimeLeft(timestamp, now) {
  const remaining = timestamp - now;
  if (remaining <= 0) return "expiring now";
  const units = [
    { ms: WEEK, singular: "week" },
    { ms: DAY, singular: "day" },
    { ms: HOUR, singular: "hour" },
    { ms: MINUTE, singular: "minute" }
  ];
  for (const unit of units) {
    if (remaining >= unit.ms) {
      const count = Math.round(remaining / unit.ms);
      return `${count} ${unit.singular}${count === 1 ? "" : "s"} left`;
    }
  }
  return "less than a minute left";
}
var TimedMuteModal = class extends Modal {
  constructor({ profile, defaultDuration, existingUntil, onConfirm }) {
    super();
    this.profile = profile;
    this.existingUntil = existingUntil;
    this.onConfirm = onConfirm;
    this.selection = defaultDuration;
    this.customAmount = "2";
    this.customUnit = "hours";
    this.submitting = false;
  }
  get durationMs() {
    if (this.selection === CUSTOM_DURATION) {
      const amount = Number(this.customAmount);
      if (!Number.isFinite(amount) || amount <= 0) return null;
      const unit = CUSTOM_UNITS.find((entry) => entry.value === this.customUnit);
      return Math.round(amount * unit.ms);
    }
    const preset = DURATION_PRESETS.find(
      (entry) => entry.value === this.selection
    );
    return preset.ms;
  }
  onOpen() {
    this.render();
  }
  render() {
    const isExtending = this.existingUntil != null;
    this.titleEl.setText(
      isExtending ? "Extend timed mute" : "Mute for a while"
    );
    this.contentEl.empty();
    this.contentEl.createEl("p", {
      text: `${describeProfile(this.profile)} will be muted and then unmuted automatically.`,
      cls: "modal-dialog-message"
    });
    const field = this.contentEl.createDiv({ cls: "timed-mutes-modal-field" });
    field.createEl("label", {
      text: isExtending ? "New duration (from now)" : "Duration",
      attr: { for: "timed-mutes-duration" }
    });
    const wrapper = field.createDiv({ cls: "select-wrapper" });
    const select = wrapper.createEl("select", {
      attr: { id: "timed-mutes-duration" }
    });
    for (const [value, label] of Object.entries(presetOptions())) {
      const attr = { value };
      if (value === this.selection) attr.selected = "";
      select.createEl("option", { text: label, attr });
    }
    select.onChange((event) => {
      this.selection = event.target.value;
      this.render();
      this.update();
    });
    if (this.selection === CUSTOM_DURATION) {
      const custom = field.createDiv({ cls: "timed-mutes-modal-custom" });
      custom.createEl("input", {
        attr: {
          type: "number",
          value: this.customAmount,
          "aria-label": "Custom amount"
        }
      }).onInput((event) => {
        this.customAmount = event.target.value;
      });
      const unitWrapper = custom.createDiv({ cls: "select-wrapper" });
      const unitSelect = unitWrapper.createEl("select", {
        attr: { "aria-label": "Custom unit" }
      });
      for (const unit of CUSTOM_UNITS) {
        const attr = { value: unit.value };
        if (unit.value === this.customUnit) attr.selected = "";
        unitSelect.createEl("option", { text: unit.label, attr });
      }
      unitSelect.onChange((event) => {
        this.customUnit = event.target.value;
      });
    } else {
      this.contentEl.createEl("p", {
        cls: "timed-mutes-modal-summary",
        text: `Muted until ${formatDate(Date.now() + this.durationMs)}`
      });
    }
    const buttons = this.contentEl.createDiv({ cls: "modal-dialog-buttons" });
    buttons.createEl("button", {
      text: "Cancel",
      cls: "modal-dialog-button cancel-button"
    }).onClick(() => this.close());
    const confirmButton = buttons.createEl("button", {
      text: isExtending ? "Update mute" : "Mute",
      cls: "modal-dialog-button primary-button"
    });
    if (this.submitting) confirmButton.setAttr("disabled", "");
    confirmButton.onClick(() => this.submit());
  }
  async submit() {
    if (this.submitting) return;
    const durationMs = this.durationMs;
    if (durationMs == null) {
      new Notice("Enter a duration greater than zero.", NOTICE_TIMEOUT_MS);
      return;
    }
    this.submitting = true;
    this.render();
    this.update();
    try {
      await this.onConfirm(durationMs);
      this.close();
    } catch (error) {
      console.warn("Timed mute failed", error);
      new Notice("Couldn't mute this account. Try again.", NOTICE_TIMEOUT_MS);
      this.submitting = false;
      this.render();
      this.update();
    }
  }
  onClose() {
    this.titleEl.empty();
    this.contentEl.empty();
  }
};
var TimedMutesSettingTab = class extends PluginSettingTab {
  constructor() {
    super();
    this.setName("Timed Mutes");
  }
  display() {
    const plugin = this.plugin;
    new Setting(this.containerEl).setName("Default duration").setDesc("Preselected when you open the timed mute dialog").addDropdown(
      (dropdown) => dropdown.addOptions(presetOptions()).setValue(plugin.data.defaultDuration).onChange(async (value) => {
        plugin.data.defaultDuration = value;
        await plugin.persist();
      })
    );
    this.containerEl.createEl("h2", {
      text: "Active timed mutes",
      cls: "timed-mutes-section-title"
    });
    const now = Date.now();
    const entries = Object.entries(plugin.data.mutes).sort(
      ([, first], [, second]) => first.until - second.until
    );
    if (entries.length === 0) {
      this.containerEl.createEl("p", {
        text: "No timed mutes right now. Open a profile or post menu and choose \u201CMute for a while\u2026\u201D to add one.",
        cls: "timed-mutes-empty"
      });
      return;
    }
    for (const [did, entry] of entries) {
      new Setting(this.containerEl).setName(describeProfile(entry)).setDesc(
        `Muted ${formatDate(entry.mutedAt)} \xB7 Until ${formatDate(entry.until)} \xB7 ${formatTimeLeft(entry.until, now)}`
      ).addButton(
        (button) => button.setButtonText("Extend").onClick(() => {
          plugin.openMuteModal(
            { did, handle: entry.handle, displayName: entry.displayName },
            entry.until
          );
        })
      ).addButton(
        (button) => button.setButtonText("Unmute now").onClick(async () => {
          try {
            await plugin.unmuteNow(did);
            new Notice(`Unmuted ${describeProfile(entry)}`, NOTICE_TIMEOUT_MS);
          } catch (error) {
            console.warn("Unmute failed", error);
            new Notice("Couldn't unmute this account. Try again.", NOTICE_TIMEOUT_MS);
          }
        })
      );
    }
  }
};
var TimedMutesPlugin = class extends Plugin {
  async onload() {
    const saved = await this.loadData();
    this.data = {
      ...DEFAULT_DATA,
      ...saved ?? {},
      mutes: { ...saved?.mutes ?? {} }
    };
    this.checking = false;
    this.settingTab = new TimedMutesSettingTab();
    this.addSettingTab(this.settingTab);
    this.app.on("profile-context-menu", (menu, profile) => {
      this.addMenuItem(menu, profile);
    });
    this.app.on("post-context-menu", (menu, post2) => {
      const author = post2?.author;
      if (!author?.did) return;
      this.addMenuItem(menu, author);
    });
    await this.liftExpiredMutes();
    this.timer = setInterval(() => {
      this.liftExpiredMutes();
    }, CHECK_INTERVAL_MS);
  }
  onunload() {
    clearInterval(this.timer);
  }
  addMenuItem(menu, profile) {
    if (profile.did === this.app.currentUser?.did) return;
    const existing = this.data.mutes[profile.did];
    menu.addItem(
      (item) => item.setTitle(existing ? "Extend timed mute\u2026" : "Mute for a while\u2026").setIcon("timer-line").onClick(() => {
        this.openMuteModal(profile, existing?.until ?? null);
      })
    );
  }
  openMuteModal(profile, existingUntil) {
    new TimedMuteModal({
      profile,
      defaultDuration: this.data.defaultDuration,
      existingUntil,
      onConfirm: async (durationMs) => {
        await this.muteFor(profile, durationMs);
      }
    }).open();
  }
  async muteFor(profile, durationMs) {
    await this.app.muteActor(profile.did);
    const until = Date.now() + durationMs;
    this.data.mutes[profile.did] = {
      until,
      mutedAt: Date.now(),
      handle: profile.handle,
      displayName: profile.displayName ?? ""
    };
    await this.persist();
    new Notice(
      `Muted ${describeProfile(profile)} until ${formatDate(until)}`,
      NOTICE_TIMEOUT_MS
    );
    this.settingTab.refresh({ reset: true });
  }
  async unmuteNow(did) {
    await this.app.unmuteActor(did);
    delete this.data.mutes[did];
    await this.persist();
    this.settingTab.refresh({ reset: true });
  }
  async liftExpiredMutes() {
    if (this.checking) return;
    this.checking = true;
    try {
      const now = Date.now();
      const expired = Object.entries(this.data.mutes).filter(
        ([, entry]) => entry.until <= now
      );
      if (expired.length === 0) return;
      let lifted = 0;
      for (const [did, entry] of expired) {
        try {
          await this.app.unmuteActor(did);
          delete this.data.mutes[did];
          lifted += 1;
          new Notice(
            `Timed mute ended for ${describeProfile(entry)}`,
            NOTICE_TIMEOUT_MS
          );
        } catch (error) {
          console.warn(`Failed to lift timed mute for ${did}`, error);
        }
      }
      if (lifted > 0) {
        await this.persist();
        this.settingTab.refresh({ reset: true });
      }
    } finally {
      this.checking = false;
    }
  }
  async persist() {
    await this.saveData(this.data);
  }
};
