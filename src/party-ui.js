import { icon } from './icons.js';
import './party.css';

const glyphs = {
  people: '<circle cx="9" cy="7.5" r="3"/><path d="M3 20v-2.1c0-3.1 2.5-5.1 6-5.1s6 2 6 5.1V20M16 4.8a3 3 0 0 1 0 5.6m1.4 2.7c2.3.6 3.6 2.2 3.6 4.7V20"/>',
  link: '<path d="m10 13.9 4-3.8m-5.2 0L7 11.8a3.3 3.3 0 1 0 4.7 4.7l2.2-2.1m1.3-.5 1.8-1.7a3.3 3.3 0 0 0-4.7-4.7l-2.2 2.1"/>',
  face: '<path d="M4 9a8 8 0 0 1 16 0v5a8 8 0 0 1-16 0z"/><path d="M4.3 8.4c4.1.5 6.9-1.2 8.4-4.1 1.2 2.8 3.9 4.7 7.2 4.6M9.4 15c1.6 1.4 3.6 1.4 5.2 0"/><path d="M8.8 11.4h.1m6.2 0h.1" stroke-width="2.6"/>',
  wave: '<path d="m5.2 15.3-1.3-3.4c-.6-1.6 1.3-2.6 2.2-1.3l2 2.9-2.7-7c-.5-1.5 1.5-2.3 2.1-.9l2.4 5.8-2.3-7.1c-.5-1.5 1.6-2.1 2.1-.8l2.6 7-1.7-6.1c-.4-1.5 1.6-2 2-.7l2.4 7.4-.9-3.8c-.4-1.5 1.6-2 2.1-.6l2 6.2c1.1 3.5-.1 6.2-3.6 7.4-3.5 1.3-6.2.3-9.4-5z"/><path d="M19 3.8c1 .9 1.5 2.1 1.7 3.3M2.4 16.7c.3 1.3.9 2.4 1.8 3.2"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="m12 8.1 3.7 2.6-1.4 4.2H9.7l-1.4-4.2zM12 8.1V4m3.7 6.7 4.1-1.1m-5.5 5.3 2.4 3.4m-7-3.4-2.4 3.4m1-7.6-4.1-1.1"/>',
  check: '<path d="m5.8 12.2 4.2 4.2L18.4 8"/>',
};

function symbol(name) {
  const box = document.createElement('span');
  box.className = 'party-symbol';
  box.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${glyphs[name]}</svg>`;
  return box;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(className, label) {
  const node = element('button', className, label);
  node.type = 'button';
  return node;
}

function updateText(node, value) {
  if (node.textContent !== value) node.textContent = value;
}

const connectionLabels = {
  connecting: 'Joining',
  reconnecting: 'Rejoining',
  offline: 'Offline',
};

const connectionDetails = {
  connecting: 'Connecting to the island…',
  reconnecting: 'Reconnecting to the island…',
  offline: 'Character selection is offline.',
};

export function createPartyUI({ residents, onClaim, onRelease, onWave, onInvite, onKick, onPicker }) {
  const play = document.getElementById('play-space');
  const existingActions = play.querySelector('.world-actions');
  const existingBottom = document.getElementById('world-bottom');
  const world = document.getElementById('world-host');
  const byHandle = new Map(residents.map((resident) => [resident.handle, resident]));
  let state = { status: 'connecting', players: [], ownId: null, claims: {}, seated: false, nearBall: false };
  let ownHandle = null;
  let pending = null;
  let inviteBusy = false;
  let inviteTimer;

  play.classList.add('party-play');

  const room = element('div', 'party-room');
  const count = element('span', 'party-count');
  count.setAttribute('role', 'status');
  count.setAttribute('aria-live', 'polite');
  count.setAttribute('aria-atomic', 'true');
  const countText = element('span');
  count.append(symbol('people'), countText);
  const inviteButton = button('party-invite');
  inviteButton.setAttribute('aria-label', 'Invite someone to this island');
  inviteButton.title = 'Invite someone to this island';
  const inviteLabel = element('span', null, 'Invite');
  inviteButton.append(symbol('link'), inviteLabel);
  const inviteStatus = element('span', 'party-reader-only');
  inviteStatus.setAttribute('role', 'status');
  const linkPanel = element('div', 'party-invite-panel');
  linkPanel.id = 'party-invite-panel';
  linkPanel.hidden = true;
  const linkLabel = element('label', null, 'Island invite link');
  const linkField = element('input');
  linkField.type = 'url';
  linkField.id = 'party-invite-url';
  linkField.readOnly = true;
  linkLabel.htmlFor = linkField.id;
  const linkClose = button('party-popover-close');
  linkClose.innerHTML = icon('close');
  linkClose.setAttribute('aria-label', 'Close invite link');
  linkPanel.append(linkLabel, linkClose, linkField);
  inviteButton.setAttribute('aria-controls', linkPanel.id);
  inviteButton.setAttribute('aria-expanded', 'false');
  room.append(count, inviteButton, inviteStatus, linkPanel);
  existingActions.prepend(room);

  const controls = element('div', 'party-controls');
  existingBottom.before(controls);
  const dock = element('div', 'party-dock');
  dock.setAttribute('role', 'group');
  dock.setAttribute('aria-label', 'Island actions');
  const identity = button('party-action party-identity');
  identity.setAttribute('aria-haspopup', 'dialog');
  identity.setAttribute('aria-controls', 'party-picker');
  const guestFace = symbol('face');
  const portrait = new Image(24, 24);
  portrait.className = 'party-avatar';
  portrait.alt = '';
  portrait.hidden = true;
  const identityLabel = element('span', 'party-identity-label', 'Choose character');
  identity.append(guestFace, portrait, identityLabel);
  const wave = button('party-action party-wave');
  wave.append(symbol('wave'), element('span', null, 'Wave'));
  const kick = button('party-action party-kick');
  kick.append(symbol('ball'), element('span', null, 'Kick'));
  kick.setAttribute('aria-label', 'Kick the ball');
  kick.hidden = true;
  dock.append(identity, wave, kick);
  controls.append(dock, existingBottom);

  const picker = element('dialog', 'party-picker');
  picker.id = 'party-picker';
  picker.setAttribute('aria-labelledby', 'party-picker-title');
  picker.setAttribute('aria-describedby', 'party-picker-availability');
  const header = element('header', 'party-picker-heading');
  const heading = element('h2', null, 'Choose your character');
  heading.id = 'party-picker-title';
  heading.tabIndex = -1;
  const availability = element('p', 'party-availability');
  availability.id = 'party-picker-availability';
  const close = button('round-btn party-picker-close');
  close.setAttribute('aria-label', 'Close character picker');
  close.innerHTML = icon('close');
  header.append(heading, availability, close);
  const options = element('div', 'party-options');
  options.setAttribute('role', 'group');
  options.setAttribute('aria-label', 'Resident characters');
  const cards = new Map();

  for (const resident of residents) {
    const card = button('party-choice');
    card.dataset.handle = resident.handle;
    const tile = element('span', 'party-portrait');
    const photo = new Image(112, 100);
    photo.src = `/portraits/${resident.handle}.webp`;
    photo.alt = '';
    photo.decoding = 'async';
    photo.loading = 'lazy';
    const tick = element('span', 'party-selected-mark');
    tick.append(symbol('check'));
    tile.append(photo, tick);
    const name = element('span', 'party-choice-name', resident.shortName);
    const detail = element('span', 'party-choice-status');
    card.append(tile, name, detail);
    card.addEventListener('click', () => choose(resident));
    cards.set(resident.handle, { card, detail });
    options.append(card);
  }

  const pickerFooter = element('footer', 'party-picker-footer');
  const selection = element('p', 'party-selection');
  const feedback = element('p', 'party-feedback');
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  const release = button('text-btn party-release', 'Release character');
  const done = button('primary compact party-done', 'Continue as visitor');
  pickerFooter.append(selection, release, done);
  picker.append(header, options, feedback, pickerFooter);
  document.body.append(picker);

  function resetInvite(restoreFocus = false) {
    if (linkPanel.hidden) return;
    linkPanel.hidden = true;
    inviteButton.setAttribute('aria-expanded', 'false');
    if (restoreFocus) inviteButton.focus({ preventScroll: true });
  }

  function showInviteLink(url) {
    linkField.value = url;
    linkPanel.hidden = false;
    inviteButton.setAttribute('aria-expanded', 'true');
    inviteStatus.textContent = 'Select and copy the island invite link.';
    linkField.focus({ preventScroll: true });
    linkField.select();
  }

  function inviteNotice(label, description) {
    updateText(inviteLabel, label);
    inviteStatus.textContent = description;
    inviteTimer = setTimeout(() => {
      updateText(inviteLabel, 'Invite');
      inviteStatus.textContent = '';
    }, 2400);
  }

  async function invite() {
    if (!linkPanel.hidden) { resetInvite(true); return; }
    if (inviteBusy) return;
    clearTimeout(inviteTimer);
    inviteBusy = true;
    try {
      // Invoke during the click event so clipboard and share APIs retain user activation.
      const result = await onInvite();
      if (result?.copied === false && result.url) {
        updateText(inviteLabel, 'Invite');
        showInviteLink(result.url);
      } else if (result === false || result?.copied === false) {
        inviteNotice('Try again', 'The invite link could not be copied.');
      } else {
        inviteNotice('Copied!', 'Island invite link copied.');
      }
    } catch (error) {
      if (error?.url) showInviteLink(error.url);
      else inviteNotice('Try again', 'Could not create an invite link. Try again.');
    } finally {
      inviteBusy = false;
    }
  }

  inviteButton.addEventListener('click', invite);
  linkClose.addEventListener('click', () => resetInvite(true));
  linkField.addEventListener('focus', () => linkField.select());
  linkField.addEventListener('click', () => linkField.select());
  document.addEventListener('pointerdown', (event) => {
    if (!linkPanel.hidden && !room.contains(event.target)) resetInvite();
  });
  room.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !linkPanel.hidden) {
      event.preventDefault();
      resetInvite(true);
    }
  });

  function openPicker() {
    if (picker.open) return;
    resetInvite();
    feedback.textContent = '';
    options.scrollTop = 0;
    picker.showModal();
    heading.focus({ preventScroll: true });
    onPicker?.(true);
  }

  function closePicker() {
    if (picker.open) picker.close();
  }

  identity.addEventListener('click', openPicker);
  close.addEventListener('click', closePicker);
  done.addEventListener('click', closePicker);
  picker.addEventListener('close', () => { if (!picker.open) onPicker?.(false); });
  picker.addEventListener('click', (event) => {
    if (event.target !== picker) return;
    const { top, bottom, left, right } = picker.getBoundingClientRect();
    if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) closePicker();
  });

  function clearPending(message = '') {
    if (pending) clearTimeout(pending.timeout);
    pending = null;
    updateText(feedback, message);
  }

  function submit(handle) {
    clearPending();
    const action = { handle };
    pending = action;
    action.timeout = setTimeout(() => {
      if (pending === action) {
        clearPending('The island hasn’t confirmed that change yet. Try again.');
        paint();
      }
    }, 6000);
    updateText(feedback, handle ? `Choosing ${byHandle.get(handle).shortName}…` : 'Releasing your character…');
    paint();
    const reject = (message) => {
      if (pending !== action) return;
      clearPending(message || 'The character change could not be confirmed. Try again.');
      paint();
    };
    try {
      const request = handle ? onClaim(handle) : onRelease();
      Promise.resolve(request).then((result) => {
        if (result === false || result?.ok === false) reject(result?.message);
      }, () => reject());
    } catch {
      reject();
    }
  }

  function choose(resident) {
    if (pending) return;
    if (state.status !== 'online') { updateText(feedback, connectionDetails[state.status]); return; }
    const owner = state.claims[resident.handle];
    if (owner && owner !== state.ownId) { updateText(feedback, `${resident.shortName} is already in use.`); return; }
    if (ownHandle === resident.handle) { closePicker(); return; }
    submit(resident.handle);
  }

  release.addEventListener('click', () => {
    if (!pending && ownHandle && state.status === 'online') submit(null);
  });

  options.addEventListener('keydown', (event) => {
    const card = event.target.closest('.party-choice');
    if (!card || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    const columns = getComputedStyle(options).gridTemplateColumns.split(' ').length;
    const index = residents.findIndex((person) => person.handle === card.dataset.handle);
    const last = residents.length - 1;
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? last : Math.max(0, Math.min(last, index + delta[event.key]));
    event.preventDefault();
    cards.get(residents[target].handle).card.focus();
  });

  wave.addEventListener('click', (event) => {
    if (state.status !== 'online') return;
    onWave();
    if (event.detail > 0) world.focus({ preventScroll: true });
  });
  kick.addEventListener('click', (event) => {
    if (state.status !== 'online' || state.seated || !state.nearBall) return;
    onKick();
    if (event.detail > 0) world.focus({ preventScroll: true });
  });

  function paint() {
    const online = state.status === 'online';
    const participantCount = state.players.length;
    const detail = online ? `${participantCount} ${participantCount === 1 ? 'person' : 'people'} on the island` : connectionDetails[state.status];
    updateText(countText, online ? `${participantCount} here` : connectionLabels[state.status]);
    if (count.title !== detail) {
      count.title = detail;
      count.setAttribute('aria-label', detail);
    }
    if (room.dataset.connection !== state.status) room.dataset.connection = state.status;
    const current = byHandle.get(ownHandle);
    if (identity.dataset.handle !== (ownHandle || '')) {
      identity.dataset.handle = ownHandle || '';
      updateText(identityLabel, current ? current.shortName : 'Choose character');
      const label = current ? `Change character, currently ${current.name}` : 'Choose character';
      identity.setAttribute('aria-label', label);
      identity.title = label;
      guestFace.hidden = Boolean(current);
      portrait.hidden = !current;
      if (current) portrait.src = `/portraits/${current.handle}.webp`;
      else portrait.removeAttribute('src');
    }
    const waveDisabled = !online;
    if (wave.disabled !== waveDisabled) wave.disabled = waveDisabled;
    const kickHidden = !online || !state.nearBall || Boolean(state.seated);
    if (kick.hidden !== kickHidden) kick.hidden = kickHidden;
    const seated = String(Boolean(state.seated));
    if (play.dataset.partySeated !== seated) play.dataset.partySeated = seated;

    let free = 0;
    for (const person of residents) {
      const { card, detail: availabilityLabel } = cards.get(person.handle);
      const status = ownHandle === person.handle ? 'yours' : state.claims[person.handle] ? 'taken' : 'free';
      if (status === 'free') free++;
      const disabled = !online || status === 'taken' || Boolean(pending);
      if (card.getAttribute('aria-disabled') !== String(disabled)) card.setAttribute('aria-disabled', String(disabled));
      if (card.dataset.state !== status) {
        card.dataset.state = status;
        const label = { yours: 'Yours', taken: 'In use', free: 'Free' }[status];
        updateText(availabilityLabel, label);
        card.setAttribute('aria-label', `${person.name}, ${label.toLowerCase()}`);
        card.setAttribute('aria-pressed', String(status === 'yours'));
        card.title = `${person.name} · ${label}`;
      }
    }
    updateText(availability, online ? `${free} of ${residents.length} characters free` : connectionDetails[state.status]);
    updateText(selection, current ? `Playing as ${current.shortName}` : 'Visiting as a guest');
    updateText(done, current ? 'Done' : 'Continue as visitor');
    const releaseHidden = !current;
    if (release.hidden !== releaseHidden) release.hidden = releaseHidden;
    const releaseDisabled = !online || Boolean(pending);
    if (release.disabled !== releaseDisabled) release.disabled = releaseDisabled;
  }

  function render(next) {
    state = next;
    const owner = state.players.find((player) => player.id === state.ownId);
    const claimed = state.ownId && (Object.keys(state.claims).find((key) => state.claims[key] === state.ownId) || owner?.handle);
    ownHandle = byHandle.has(claimed) ? claimed : null;
    if (pending) {
      if (pending.handle === ownHandle && state.status === 'online') {
        clearPending();
        closePicker();
      } else if (state.status !== 'online') {
        clearPending(connectionDetails[state.status]);
      } else if (pending.handle && state.claims[pending.handle] && state.claims[pending.handle] !== state.ownId) {
        clearPending(`${byHandle.get(pending.handle).shortName} was just chosen. Pick another character.`);
      }
    }
    paint();
  }

  paint();
  return { render, openPicker, closePicker };
}
