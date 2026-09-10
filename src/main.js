import {
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
} from "@impro.social/impro-plugin";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const CHECK_INTERVAL_MS = MINUTE;
const NOTICE_TIMEOUT_MS = 4000;

const CUSTOM_DURATION = "custom";

const DURATION_PRESETS = [
  { value: "1h", label: "1 hour", ms: HOUR },
  { value: "8h", label: "8 hours", ms: 8 * HOUR },
  { value: "24h", label: "24 hours", ms: DAY },
  { value: "3d", label: "3 days", ms: 3 * DAY },
  { value: "1w", label: "1 week", ms: WEEK },
  { value: "2w", label: "2 weeks", ms: 2 * WEEK },
  { value: "30d", label: "30 days", ms: 30 * DAY },
];

const CUSTOM_UNITS = [
  { value: "minutes", label: "minutes", ms: MINUTE },
  { value: "hours", label: "hours", ms: HOUR },
  { value: "days", label: "days", ms: DAY },
  { value: "weeks", label: "weeks", ms: WEEK },
];

const DEFAULT_DATA = {
  defaultDuration: "24h",
  // { [did]: { until: number (epoch ms), mutedAt: number, handle, displayName } }
  mutes: {},
};

function presetOptions() {
  const options = {};
  for (const preset of DURATION_PRESETS) options[preset.value] = preset.label;
  options[CUSTOM_DURATION] = "Custom…";
  return options;
}

function describeProfile(profile) {
  if (profile.displayName) {
    return `${profile.displayName} (@${profile.handle})`;
  }
  return `@${profile.handle}`;
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function formatTimeLeft(timestamp, now) {
  const remaining = timestamp - now;
  if (remaining <= 0) return "expiring now";
  const units = [
    { ms: WEEK, singular: "week" },
    { ms: DAY, singular: "day" },
    { ms: HOUR, singular: "hour" },
    { ms: MINUTE, singular: "minute" },
  ];
  for (const unit of units) {
    if (remaining >= unit.ms) {
      const count = Math.round(remaining / unit.ms);
      return `${count} ${unit.singular}${count === 1 ? "" : "s"} left`;
    }
  }
  return "less than a minute left";
}

class TimedMuteModal extends Modal {
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
      (entry) => entry.value === this.selection,
    );
    return preset.ms;
  }

  onOpen() {
    this.render();
  }

  render() {
    const isExtending = this.existingUntil != null;
    this.titleEl.setText(
      isExtending ? "Extend timed mute" : "Mute for a while",
    );
    this.contentEl.empty();

    this.contentEl.createEl("p", {
      text: `${describeProfile(this.profile)} will be muted and then unmuted automatically.`,
      cls: "modal-dialog-message",
    });

    const field = this.contentEl.createDiv({ cls: "timed-mutes-modal-field" });
    field.createEl("label", {
      text: isExtending ? "New duration (from now)" : "Duration",
      attr: { for: "timed-mutes-duration" },
    });
    const wrapper = field.createDiv({ cls: "select-wrapper" });
    const select = wrapper.createEl("select", {
      attr: { id: "timed-mutes-duration" },
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
      custom
        .createEl("input", {
          attr: {
            type: "number",
            value: this.customAmount,
            "aria-label": "Custom amount",
          },
        })
        .onInput((event) => {
          this.customAmount = event.target.value;
        });
      const unitWrapper = custom.createDiv({ cls: "select-wrapper" });
      const unitSelect = unitWrapper.createEl("select", {
        attr: { "aria-label": "Custom unit" },
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
        text: `Muted until ${formatDate(Date.now() + this.durationMs)}`,
      });
    }

    const buttons = this.contentEl.createDiv({ cls: "modal-dialog-buttons" });
    buttons
      .createEl("button", {
        text: "Cancel",
        cls: "modal-dialog-button cancel-button",
      })
      .onClick(() => this.close());
    const confirmButton = buttons.createEl("button", {
      text: isExtending ? "Update mute" : "Mute",
      cls: "modal-dialog-button primary-button",
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
}

class TimedMutesSettingTab extends PluginSettingTab {
  constructor() {
    super();
    this.setName("Timed Mutes");
  }

  display() {
    const plugin = this.plugin;

    new Setting(this.containerEl)
      .setName("Default duration")
      .setDesc("Preselected when you open the timed mute dialog")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions(presetOptions())
          .setValue(plugin.data.defaultDuration)
          .onChange(async (value) => {
            plugin.data.defaultDuration = value;
            await plugin.persist();
          }),
      );

    this.containerEl.createEl("h2", {
      text: "Active timed mutes",
      cls: "setting-item-name",
    });

    const now = Date.now();
    const entries = Object.entries(plugin.data.mutes).sort(
      ([, first], [, second]) => first.until - second.until,
    );

    if (entries.length === 0) {
      this.containerEl.createEl("p", {
        text: "No timed mutes right now. Open a profile or post menu and choose “Mute for a while…” to add one.",
        cls: "timed-mutes-empty",
      });
      return;
    }

    for (const [did, entry] of entries) {
      new Setting(this.containerEl)
        .setName(describeProfile(entry))
        .setDesc(
          `Until ${formatDate(entry.until)} · ${formatTimeLeft(entry.until, now)}`,
        )
        .addButton((button) =>
          button.setButtonText("Extend").onClick(() => {
            plugin.openMuteModal(
              { did, handle: entry.handle, displayName: entry.displayName },
              entry.until,
            );
          }),
        )
        .addButton((button) =>
          button.setButtonText("Unmute now").onClick(async () => {
            try {
              await plugin.unmuteNow(did);
              new Notice(`Unmuted ${describeProfile(entry)}`, NOTICE_TIMEOUT_MS);
            } catch (error) {
              console.warn("Unmute failed", error);
              new Notice("Couldn't unmute this account. Try again.", NOTICE_TIMEOUT_MS);
            }
          }),
        );
    }
  }
}

export default class TimedMutesPlugin extends Plugin {
  async onload() {
    const saved = await this.loadData();
    this.data = {
      ...DEFAULT_DATA,
      ...(saved ?? {}),
      mutes: { ...(saved?.mutes ?? {}) },
    };
    this.checking = false;

    this.settingTab = new TimedMutesSettingTab();
    this.addSettingTab(this.settingTab);

    this.app.on("profile-context-menu", (menu, profile) => {
      this.addMenuItem(menu, profile);
    });
    this.app.on("post-context-menu", (menu, post) => {
      const author = post?.author;
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
    menu.addItem((item) =>
      item
        .setTitle(existing ? "Extend timed mute…" : "Mute for a while…")
        .setIcon("timer-line")
        .onClick(() => {
          this.openMuteModal(profile, existing?.until ?? null);
        }),
    );
  }

  openMuteModal(profile, existingUntil) {
    new TimedMuteModal({
      profile,
      defaultDuration: this.data.defaultDuration,
      existingUntil,
      onConfirm: async (durationMs) => {
        await this.muteFor(profile, durationMs);
      },
    }).open();
  }

  async muteFor(profile, durationMs) {
    await this.app.muteActor(profile.did);
    const until = Date.now() + durationMs;
    this.data.mutes[profile.did] = {
      until,
      mutedAt: Date.now(),
      handle: profile.handle,
      displayName: profile.displayName ?? "",
    };
    await this.persist();
    new Notice(
      `Muted ${describeProfile(profile)} until ${formatDate(until)}`,
      NOTICE_TIMEOUT_MS,
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
        ([, entry]) => entry.until <= now,
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
            NOTICE_TIMEOUT_MS,
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
}
