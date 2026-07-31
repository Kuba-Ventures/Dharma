var DHARMA_API = 'https://www.dharmaautomations.com';
var BRAND_PRIMARY = '#7F77DD';   // brand-400 — same purple as web
var BRAND_SECONDARY = '#534AB7'; // brand-600 — supporting actions
var BRAND_ACCENT = '#AFA9EC';    // brand-200 — section accents
var LOGO_URL = DHARMA_API + '/logo.png';

function dharmaHeader(title, subtitle) {
  var h = CardService.newCardHeader()
    .setTitle(title || 'Dharma')
    .setImageUrl(LOGO_URL)
    .setImageStyle(CardService.ImageStyle.CIRCLE);
  if (subtitle) h.setSubtitle(subtitle);
  return h;
}

function onHomepage(e) {
  return buildWelcomeCard();
}

function onGmailMessage(e) {
  // Classify the open message. Calendar invites get Accept/Decline/Reschedule;
  // everything else gets the tone strip (existing behavior).
  var classified = classifyMessage(e.gmail.messageId);
  if (classified && classified.kind === 'invite') {
    return buildInviteCard(e.gmail.messageId, classified.invite || {});
  }
  return buildMainCard(e.gmail.messageId);
}

function classifyMessage(messageId) {
  var accessToken = ScriptApp.getOAuthToken();
  try {
    var res = UrlFetchApp.fetch(DHARMA_API + '/api/emails/' + encodeURIComponent(messageId) + '/classify', {
      method: 'get',
      headers: { 'Authorization': 'GoogleBearer ' + accessToken },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
      return JSON.parse(res.getContentText());
    }
  } catch (err) {
    Logger.log('classifyMessage failed: ' + err.message);
  }
  return null;
}

function buildInviteCard(messageId, invite) {
  var headerLabel = invite.isCancellation ? 'Canceled meeting' : 'Calendar invite';
  var section = CardService.newCardSection().setHeader(headerLabel);

  var headline = invite.isCancellation
    ? '<b>This meeting was canceled.</b>'
    : (invite.summary ? '<b>' + invite.summary + '</b>' : '<b>Calendar invite</b>');
  section.addWidget(CardService.newTextParagraph().setText(headline));

  if (invite.start) {
    section.addWidget(
      CardService.newDecoratedText()
        .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.CLOCK))
        .setTopLabel('When')
        .setText(invite.start)
        .setWrapText(true)
    );
  }
  if (invite.organizer) {
    section.addWidget(
      CardService.newDecoratedText()
        .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.PERSON))
        .setTopLabel('From')
        .setText(invite.organizer)
        .setWrapText(true)
    );
  }

  section.addWidget(CardService.newDivider());

  // Cancellation: no RSVP needed; just let the user draft a reply if they want.
  if (invite.isCancellation) {
    section.addWidget(CardService.newTextButton()
      .setText('Draft a reply')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setBackgroundColor(BRAND_PRIMARY)
      .setOnClickAction(CardService.newAction()
        .setFunctionName('forceDraftReply')
        .setParameters({ messageId: messageId })));
    return CardService.newCardBuilder()
      .setHeader(dharmaHeader('Dharma'))
      .addSection(buildToneStatusSection())
      .addSection(section)
      .build();
  }

  // Live invite: Accept / Decline / Reschedule
  var params = {
    iCalUID: invite.iCalUID || '',
    summary: invite.summary || '',
    start: invite.start || '',
    organizer: invite.organizer || '',
    messageId: messageId,
  };

  section.addWidget(CardService.newTextButton()
    .setText('Accept')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setBackgroundColor('#22c55e')
    .setOnClickAction(CardService.newAction()
      .setFunctionName('rsvpAccept')
      .setParameters(params)));

  section.addWidget(CardService.newTextButton()
    .setText('Decline')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setBackgroundColor('#ef4444')
    .setOnClickAction(CardService.newAction()
      .setFunctionName('rsvpDecline')
      .setParameters(params)));

  section.addWidget(CardService.newTextButton()
    .setText('Reschedule')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setBackgroundColor(BRAND_PRIMARY)
    .setOnClickAction(CardService.newAction()
      .setFunctionName('rsvpReschedule')
      .setParameters(params)));

  // Escape hatch in case detection was wrong (e.g. follow-up prose email
  // that just happens to have an invite quoted in it).
  section.addWidget(CardService.newDivider());
  section.addWidget(CardService.newTextButton()
    .setText('Draft a reply instead')
    .setTextButtonStyle(CardService.TextButtonStyle.TEXT)
    .setOnClickAction(CardService.newAction()
      .setFunctionName('forceDraftReply')
      .setParameters({ messageId: messageId })));

  return CardService.newCardBuilder()
    .setHeader(dharmaHeader('Dharma'))
    .addSection(buildToneStatusSection())
    .addSection(section)
    .build();
}

function forceDraftReply(e) {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(buildMainCard(e.parameters.messageId)))
    .build();
}

function rsvpAccept(e) { return doRsvp(e, 'accept'); }
function rsvpDecline(e) { return doRsvp(e, 'decline'); }

function doRsvp(e, action) {
  var p = e.parameters || {};
  if (!p.iCalUID) {
    return notificationResponse('Could not RSVP: missing event ID. Try clicking Accept/Decline in Gmail directly.');
  }

  var payload = {
    action: action,
    iCalUID: p.iCalUID,
    summary: p.summary || '',
    start: p.start || '',
    organizer: p.organizer || '',
  };

  var accessToken = ScriptApp.getOAuthToken();
  try {
    var res = UrlFetchApp.fetch(DHARMA_API + '/api/calendar/rsvp', {
      method: 'post',
      headers: {
        'Authorization': 'GoogleBearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    var code = res.getResponseCode();
    if (code < 200 || code >= 300) {
      var errMsg = 'RSVP failed (' + code + ')';
      try { errMsg = JSON.parse(res.getContentText()).error || errMsg; } catch (_) {}
      return notificationResponse(errMsg);
    }
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(
        action === 'accept' ? 'Accepted. Calendar updated.' :
        action === 'decline' ? 'Declined. Calendar updated.' : 'Response sent.'
      ))
      .build();
  } catch (err) {
    return notificationResponse('RSVP failed: ' + err.message);
  }
}

function rsvpReschedule(e) {
  var p = e.parameters || {};
  var accessToken = ScriptApp.getOAuthToken();
  try {
    var res = UrlFetchApp.fetch(DHARMA_API + '/api/calendar/rsvp', {
      method: 'post',
      headers: {
        'Authorization': 'GoogleBearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify({
        action: 'reschedule',
        summary: p.summary || '',
        start: p.start || '',
        organizer: p.organizer || '',
      }),
      muteHttpExceptions: true,
    });
    var code = res.getResponseCode();
    if (code < 200 || code >= 300) {
      var errMsg = 'Reschedule draft failed (' + code + ')';
      try { errMsg = JSON.parse(res.getContentText()).error || errMsg; } catch (_) {}
      return notificationResponse(errMsg);
    }
    var data = JSON.parse(res.getContentText());
    // Cache the generated text so saveDraft can pick it up. Mirror the existing
    // generateDraft flow.
    var cacheKey = 'draft_' + (p.messageId || 'reschedule_' + Date.now());
    CacheService.getUserCache().put(cacheKey, data.text || '', 600);

    var section = CardService.newCardSection().setHeader('Suggested reply')
      .addWidget(CardService.newTextParagraph().setText(data.text || ''))
      .addWidget(CardService.newDivider())
      .addWidget(CardService.newTextButton()
        .setText('Save as draft')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setBackgroundColor(BRAND_PRIMARY)
        .setOnClickAction(CardService.newAction()
          .setFunctionName('saveRescheduleDraft')
          .setParameters({
            cacheKey: cacheKey,
            organizer: p.organizer || '',
            summary: p.summary || '',
          })));
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(
        CardService.newCardBuilder()
          .setHeader(dharmaHeader('Reschedule draft'))
          .addSection(section)
          .build()
      ))
      .build();
  } catch (err) {
    return notificationResponse('Reschedule draft failed: ' + err.message);
  }
}

function onComposeOpen(e) {
  var subject = (e.draftMetadata && e.draftMetadata.subject) ? e.draftMetadata.subject : '';
  var messageId = (e.gmail && e.gmail.messageId) ? e.gmail.messageId : '';
  var threadId = '';

  // With draftAccess METADATA, e.gmail.messageId is the draft's message ID.
  // Use it to get the thread ID directly instead of guessing from subject.
  if (messageId) {
    try {
      var draft = Gmail.Users.Messages.get('me', messageId, { format: 'minimal' });
      if (draft && draft.threadId) threadId = draft.threadId;
    } catch (err) {
      Logger.log('Could not resolve threadId from draft: ' + err.message);
    }
  }

  return buildComposeCard(subject, threadId);
}

function buildWelcomeCard() {
  return CardService.newCardBuilder()
    .setHeader(dharmaHeader('Dharma', 'Replies in your voice'))
    .addSection(buildToneStatusSection())
    .addSection(
      CardService.newCardSection().setHeader('Get started')
        .addWidget(CardService.newTextParagraph()
          .setText('Open an email and Dharma will draft a reply in your voice. <font color="' + BRAND_SECONDARY + '">Tap a tone</font>: My Tone, Concise, Formal / Legal, or Scheduling.'))
        .addWidget(CardService.newTextButton()
          .setText('Open your Dharma dashboard')
          .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
          .setBackgroundColor(BRAND_PRIMARY)
          .setOpenLink(CardService.newOpenLink().setUrl(DHARMA_API + '/dashboard')))
        .addWidget(CardService.newTextParagraph()
          .setText('Change your tone, labels, and scheduling in the dashboard. You are already signed in there.'))
    )
    .build();
}

function buildMainCard(messageId) {
  var tones = ['My Tone', 'Concise', 'Formal / Legal', 'Scheduling'];
  var section = CardService.newCardSection().setHeader('Quick reply');
  for (var i = 0; i < tones.length; i++) {
    section.addWidget(
      CardService.newTextButton()
        .setText(tones[i])
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setBackgroundColor(BRAND_PRIMARY)
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('generateDraft')
            .setParameters({ messageId: messageId, tone: tones[i] })
        )
    );
  }
  return CardService.newCardBuilder()
    .setHeader(dharmaHeader('Dharma'))
    .addSection(buildToneStatusSection())
    .addSection(section)
    .build();
}

function buildToneMenuCard(actionFunction, baseParams) {
  var tones = ['My Tone', 'Concise', 'Formal / Legal', 'Scheduling'];

  var section = CardService.newCardSection();

  for (var i = 0; i < tones.length; i++) {
    var tone = tones[i];
    var params = {};
    for (var key in baseParams) params[key] = baseParams[key];
    params.tone = tone;

    section.addWidget(
      CardService.newTextButton()
        .setText(tone)
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setBackgroundColor(BRAND_PRIMARY)
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName(actionFunction)
            .setParameters(params)
        )
    );
  }

  return CardService.newCardBuilder()
    .setHeader(dharmaHeader('Dharma'))
    .addSection(section)
    .build();
}

// ── Polish Draft: reads auto-saved draft body, polishes it ────────────────────
function decodeBase64Url(data) {
  try {
    return Utilities.newBlob(Utilities.base64Decode(data.replace(/-/g, '+').replace(/_/g, '/'))).getDataAsString();
  } catch (_) { return ''; }
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractPlainTextFromPayload(payload) {
  if (!payload) return '';

  // Prefer text/plain
  if (payload.mimeType === 'text/plain' && payload.body && payload.body.data) {
    var t = decodeBase64Url(payload.body.data);
    if (t) return t;
  }

  // Fall back to text/html stripped of tags
  if (payload.mimeType === 'text/html' && payload.body && payload.body.data) {
    var html = decodeBase64Url(payload.body.data);
    if (html) return stripHtml(html);
  }

  // Recurse into parts — try text/plain first, then anything
  if (payload.parts) {
    for (var i = 0; i < payload.parts.length; i++) {
      if (payload.parts[i].mimeType === 'text/plain') {
        var t = extractPlainTextFromPayload(payload.parts[i]);
        if (t) return t;
      }
    }
    for (var i = 0; i < payload.parts.length; i++) {
      var t = extractPlainTextFromPayload(payload.parts[i]);
      if (t) return t;
    }
  }

  return '';
}

function polishDraft(e) {
  try {
    return polishDraftInner(e);
  } catch (globalErr) {
    return notificationResponse('Caught: ' + globalErr.message);
  }
}

function polishDraftInner(e) {
  var subject = e.parameters.subject || '';
  var accessToken = ScriptApp.getOAuthToken();

  var draftText = null;
  var drafts = [];
  try {
    var originalSubject = subject.replace(/^(Re:\s*)+/i, '').trim().toLowerCase();

    var listRes = UrlFetchApp.fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/drafts?maxResults=20',
      { headers: { 'Authorization': 'Bearer ' + accessToken }, muteHttpExceptions: true }
    );
    var listData;
    try { listData = JSON.parse(listRes.getContentText()); } catch (_) { listData = {}; }
    drafts = listData.drafts || [];

    var fallbackText = null;
    var foundMeta = null;
    var fallbackMeta = null;

    for (var d = 0; d < drafts.length; d++) {
      var draftId = drafts[d] && drafts[d].id;
      if (!draftId || typeof draftId !== 'string' || draftId.length < 3) continue;

      var draftData;
      try {
        var draftRes = UrlFetchApp.fetch(
          'https://gmail.googleapis.com/gmail/v1/users/me/drafts/' + encodeURIComponent(draftId) + '?format=full',
          { headers: { 'Authorization': 'Bearer ' + accessToken }, muteHttpExceptions: true }
        );
        if (draftRes.getResponseCode() !== 200) continue;
        draftData = JSON.parse(draftRes.getContentText());
      } catch (dErr) {
        Logger.log('Skipping draft ' + draftId + ': ' + dErr.message);
        continue;
      }

      var payload = draftData.message && draftData.message.payload;
      var hList = (payload && payload.headers) || [];
      var getH = function(name) {
        for (var i = 0; i < hList.length; i++) {
          if (hList[i].name && hList[i].name.toLowerCase() === name.toLowerCase()) return hList[i].value || '';
        }
        return '';
      };
      var draftSubjRaw = getH('subject');
      var draftSubj = draftSubjRaw.replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
      var bodyText = extractPlainTextFromPayload(payload);

      // Strip Gmail's quoted reply block
      if (bodyText) {
        var quoteIdx = bodyText.search(/\nOn .+wrote:/);
        if (quoteIdx > 0) bodyText = bodyText.slice(0, quoteIdx).trim();
      }

      if (!bodyText) continue;

      var meta = {
        draftId: draftId,
        threadId: (draftData.message && draftData.message.threadId) || '',
        to: getH('to'),
        subject: draftSubjRaw,
        inReplyTo: getH('in-reply-to'),
        references: getH('references')
      };

      if (!originalSubject || draftSubj === originalSubject) {
        draftText = bodyText;
        foundMeta = meta;
        break;
      }
      if (!fallbackText) { fallbackText = bodyText; fallbackMeta = meta; }
    }

    if (!draftText && fallbackText) { draftText = fallbackText; foundMeta = fallbackMeta; }

  } catch (err) {
    return notificationResponse('Could not read draft: ' + err.message);
  }

  if (!draftText || !draftText.trim()) {
    return notificationResponse('No draft found. Type your notes in the compose box, wait a moment for Gmail to auto-save, then click Polish Draft.');
  }

  var response;
  try {
    response = UrlFetchApp.fetch(DHARMA_API + '/api/emails/thread-draft', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'GoogleBearer ' + accessToken },
      payload: JSON.stringify({ threadId: 'none', draftText: draftText.trim() }),
      muteHttpExceptions: true,
    });
  } catch (err) {
    return notificationResponse('Network error: ' + err.message);
  }

  var data;
  try {
    data = JSON.parse(response.getContentText());
  } catch (_) {
    return notificationResponse('HTTP ' + response.getResponseCode() + ': server error');
  }

  if (!data.ok || !data.text) {
    return notificationResponse(data.error || 'Polish failed.');
  }

  var cacheKey = 'polish_' + Utilities.getUuid();
  var cachePayload = JSON.stringify({ text: data.text, meta: foundMeta });
  CacheService.getUserCache().put(cacheKey, cachePayload, 600);

  var resultSection = CardService.newCardSection().setHeader('Polished version')
    .addWidget(CardService.newTextParagraph().setText(data.text))
    .addWidget(CardService.newDivider())
    .addWidget(
      CardService.newTextButton()
        .setText('Insert into draft')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setBackgroundColor(BRAND_PRIMARY)
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('insertPolishedDraft')
            .setParameters({ cacheKey: cacheKey })
        )
    )
    .addWidget(
      CardService.newTextButton()
        .setText('Try again')
        .setOnClickAction(CardService.newAction().setFunctionName('popCard'))
    );

  return CardService.newActionResponseBuilder()
    .setNavigation(
      CardService.newNavigation().pushCard(
        CardService.newCardBuilder()
          .setHeader(dharmaHeader('Polished draft'))
          .addSection(resultSection)
          .build()
      )
    )
    .build();
}

function insertPolishedDraft(e) {
  var cacheKey = e.parameters.cacheKey;
  var cached = CacheService.getUserCache().get(cacheKey);
  if (!cached) return notificationResponse('Draft expired. Please regenerate.');
  CacheService.getUserCache().remove(cacheKey);

  var parsed;
  try { parsed = JSON.parse(cached); } catch (_) { return notificationResponse('Cache error. Please regenerate.'); }

  var polishedText = parsed.text;
  var meta = parsed.meta;
  var accessToken = ScriptApp.getOAuthToken();

  if (meta && meta.draftId) {
    // Replace draft body via REST API
    try {
      var userEmail = Session.getActiveUser().getEmail();
      var lines = [
        'From: ' + userEmail,
        'To: ' + (meta.to || ''),
        'Subject: ' + (meta.subject || ''),
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8'
      ];
      if (meta.inReplyTo) lines.push('In-Reply-To: ' + meta.inReplyTo);
      if (meta.references || meta.inReplyTo) {
        lines.push('References: ' + ((meta.references ? meta.references + ' ' : '') + (meta.inReplyTo || '')).trim());
      }
      // Send as HTML, not text/plain: a text/plain body looks full-width in the
      // editable compose box but mail clients display and send it hard-wrapped
      // at ~78 columns, breaking every paragraph into short lines. Reuse the
      // same div-wrapping the instant-insert path uses so the sent message
      // soft-wraps to the recipient's width.
      var raw = lines.join('\r\n') + '\r\n\r\n' + textToGmailHtml(polishedText);
      var encoded = Utilities.base64EncodeWebSafe(raw);

      var putRes = UrlFetchApp.fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/drafts/' + encodeURIComponent(meta.draftId),
        {
          method: 'put',
          contentType: 'application/json',
          headers: { 'Authorization': 'Bearer ' + accessToken },
          payload: JSON.stringify({ message: { raw: encoded, threadId: meta.threadId } }),
          muteHttpExceptions: true
        }
      );
      if (putRes.getResponseCode() !== 200) {
        return notificationResponse('Could not replace draft (' + putRes.getResponseCode() + ').');
      }
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText('Draft replaced!'))
        .setNavigation(CardService.newNavigation().popCard())
        .build();
    } catch (err) {
      return notificationResponse('Error replacing draft: ' + err.message);
    }
  }

  // Diagnostic: show why we couldn't replace
  return notificationResponse('No draft ID found in cache. meta=' + JSON.stringify(meta) + ' text_len=' + (polishedText ? polishedText.length : 0));
}

// ── Polish & insert (instant): polishes notes from the sidebar input, inserts live into compose ──
function polishFromInput(e) {
  try {
    return polishFromInputInner(e);
  } catch (globalErr) {
    return notificationResponse('Caught: ' + globalErr.message);
  }
}

function polishFromInputInner(e) {
  var notes = '';
  if (e && e.formInput && e.formInput.dharmaNotes) notes = e.formInput.dharmaNotes;
  notes = (notes || '').trim();
  if (!notes) {
    return notificationResponse('Type or paste your notes first, then click Polish & insert.');
  }

  var accessToken = ScriptApp.getOAuthToken();

  var response;
  try {
    response = UrlFetchApp.fetch(DHARMA_API + '/api/emails/thread-draft', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'GoogleBearer ' + accessToken },
      payload: JSON.stringify({ threadId: 'none', draftText: notes }),
      muteHttpExceptions: true,
    });
  } catch (err) {
    return notificationResponse('Network error: ' + err.message);
  }

  var data;
  try {
    data = JSON.parse(response.getContentText());
  } catch (_) {
    return notificationResponse('HTTP ' + response.getResponseCode() + ': server error');
  }

  if (!data.ok || !data.text) {
    return notificationResponse(data.error || 'Polish failed.');
  }

  // Native compose action → inserts live into the open compose box (empty box = clean replace).
  return CardService.newUpdateDraftActionResponseBuilder()
    .setUpdateDraftBodyAction(
      CardService.newUpdateDraftBodyAction()
        .addUpdateContent(textToGmailHtml(data.text), CardService.ContentType.MUTABLE_HTML)
        .setUpdateType(CardService.UpdateDraftBodyType.INSERT_AT_START)
    )
    .build();
}

function textToGmailHtml(text) {
  return text.split('\n').map(function(line) {
    var safe = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return '<div>' + (safe === '' ? '<br>' : safe) + '</div>';
  }).join('');
}

function generateFromCompose(e) {
  var subject = e.parameters.subject || '';
  var tone = e.parameters.tone || 'Concise';
  var accessToken = ScriptApp.getOAuthToken();
  var threadId = e.parameters.threadId || null;

  // Fall back to subject search only if thread ID wasn't resolved at compose-open time
  if (!threadId) {
    var originalSubject = subject.replace(/^(Re:\s*)+/i, '').trim();
    if (originalSubject) {
      try {
        var threads = GmailApp.search('subject:"' + originalSubject + '"', 0, 1);
        if (threads.length > 0) threadId = threads[0].getId();
      } catch (err) {
        Logger.log('Thread search error: ' + err.message);
      }
    }
  }

  if (!threadId) {
    return notificationResponse('Could not find the original thread. Try generating from the email view instead.');
  }

  var response;
  try {
    response = UrlFetchApp.fetch(DHARMA_API + '/api/emails/thread-draft', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'GoogleBearer ' + accessToken },
      payload: JSON.stringify({ threadId: threadId, tone: tone }),
      muteHttpExceptions: true,
    });
  } catch (err) {
    return notificationResponse('Network error: ' + err.message);
  }

  var data;
  try {
    data = JSON.parse(response.getContentText());
  } catch (_) {
    return notificationResponse('HTTP ' + response.getResponseCode() + ': server error');
  }

  if (!data.ok || !data.text) {
    return notificationResponse(data.error || 'Draft generation failed.');
  }

  return CardService.newUpdateDraftActionResponseBuilder()
    .setUpdateDraftBodyAction(
      CardService.newUpdateDraftBodyAction()
        .addUpdateContent(textToGmailHtml(data.text), CardService.ContentType.MUTABLE_HTML)
        .setUpdateType(CardService.UpdateDraftBodyType.INSERT_AT_START)
    )
    .build();
}

function generateDraft(e) {
  var messageId = e.parameters.messageId;
  var tone = e.parameters.tone || 'Concise';
  var accessToken = ScriptApp.getOAuthToken();

  var message;
  try {
    message = Gmail.Users.Messages.get('me', messageId, { format: 'minimal' });
  } catch (err) {
    return notificationResponse('Gmail error: ' + err.message);
  }
  var threadId = message.threadId;

  var response;
  try {
    response = UrlFetchApp.fetch(DHARMA_API + '/api/emails/thread-draft', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'GoogleBearer ' + accessToken },
      payload: JSON.stringify({ threadId: threadId, tone: tone }),
      muteHttpExceptions: true,
    });
  } catch (err) {
    return notificationResponse('Network error: ' + err.message);
  }

  var data;
  try {
    data = JSON.parse(response.getContentText());
  } catch (_) {
    return notificationResponse('HTTP ' + response.getResponseCode() + ': server error');
  }

  if (!data.ok || !data.text) {
    return notificationResponse(data.error || 'Draft generation failed.');
  }

  var cacheKey = 'draft_' + Utilities.getUuid();
  CacheService.getUserCache().put(cacheKey, data.text, 600);

  var resultSection = CardService.newCardSection().setHeader('Suggested reply')
    .addWidget(CardService.newTextParagraph().setText(data.text))
    .addWidget(CardService.newDivider())
    .addWidget(
      CardService.newTextButton()
        .setText('Save as draft')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setBackgroundColor(BRAND_PRIMARY)
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('saveDraft')
            .setParameters({ cacheKey: cacheKey, messageId: messageId })
        )
    )
    .addWidget(
      CardService.newTextButton()
        .setText('Regenerate')
        .setOnClickAction(CardService.newAction().setFunctionName('popCard'))
    );

  return CardService.newActionResponseBuilder()
    .setNavigation(
      CardService.newNavigation().pushCard(
        CardService.newCardBuilder()
          .setHeader(dharmaHeader('Draft reply'))
          .addSection(resultSection)
          .build()
      )
    )
    .build();
}

function saveDraft(e) {
  var cacheKey = e.parameters.cacheKey;
  var messageId = e.parameters.messageId;
  var text = CacheService.getUserCache().get(cacheKey);

  if (!text) {
    return notificationResponse('Draft expired - please generate again.');
  }

  var message = Gmail.Users.Messages.get('me', messageId, {
    format: 'metadata',
    metadataHeaders: ['From', 'Subject', 'Message-ID', 'References'],
  });

  var headers = message.payload.headers;
  var get = function(name) {
    var h = headers.filter(function(h) { return h.name.toLowerCase() === name.toLowerCase(); })[0];
    return h ? h.value : '';
  };

  var from = get('From');
  var subject = get('Subject') || '(no subject)';
  var replySubject = /^re:/i.test(subject) ? subject : 'Re: ' + subject;
  var msgId = get('Message-ID');
  var refs = get('References');
  var threadId = message.threadId;
  var userEmail = Session.getActiveUser().getEmail();

  var emailLines = [
    'From: ' + userEmail,
    'To: ' + from,
    'Subject: ' + replySubject,
    'Content-Type: text/plain; charset=utf-8'
  ];
  if (msgId) emailLines.push('In-Reply-To: ' + msgId);
  if (refs || msgId) emailLines.push('References: ' + ((refs ? refs + ' ' : '') + (msgId || '')).trim());
  var raw = emailLines.join('\r\n') + '\r\n\r\n' + text;
  var encoded = Utilities.base64EncodeWebSafe(raw);

  try {
    Gmail.Users.Drafts.create({ message: { raw: encoded, threadId: threadId } }, 'me');
  } catch (err) {
    return notificationResponse('Could not save draft: ' + err.message);
  }

  CacheService.getUserCache().remove(cacheKey);

  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('Draft saved to Gmail!'))
    .setNavigation(CardService.newNavigation().popCard())
    .build();
}

function saveRescheduleDraft(e) {
  var p = e.parameters || {};
  var text = CacheService.getUserCache().get(p.cacheKey);
  if (!text) return notificationResponse('Draft expired - please generate again.');
  if (!p.organizer) return notificationResponse('No organizer email available; reply manually in Gmail.');

  var subject = 'Re: ' + (p.summary || 'Meeting');
  var emailLines = [
    'From: ' + Session.getActiveUser().getEmail(),
    'To: ' + p.organizer,
    'Subject: ' + subject,
    'Content-Type: text/plain; charset=utf-8',
  ];
  var raw = emailLines.join('\r\n') + '\r\n\r\n' + text;
  var encoded = Utilities.base64EncodeWebSafe(raw);

  try {
    Gmail.Users.Drafts.create({ message: { raw: encoded } }, 'me');
  } catch (err) {
    return notificationResponse('Could not save draft: ' + err.message);
  }

  CacheService.getUserCache().remove(p.cacheKey);
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('Reschedule draft saved to Gmail'))
    .setNavigation(CardService.newNavigation().popCard())
    .build();
}

function popCard(e) {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().popCard())
    .build();
}

function notificationResponse(message) {
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(message))
    .build();
}

// ── My Tone setup ─────────────────────────────────────────────────────────────
// The tone profile is per-user (keyed by Google account). Analysis runs only
// when the user clicks Set up / Refresh — never automatically on OAuth.

function fetchToneProfile() {
  var accessToken = ScriptApp.getOAuthToken();
  try {
    var res = UrlFetchApp.fetch(DHARMA_API + '/api/preferences/tone', {
      method: 'get',
      headers: { 'Authorization': 'GoogleBearer ' + accessToken },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
      return JSON.parse(res.getContentText());
    }
  } catch (err) {
    Logger.log('fetchToneProfile failed: ' + err.message);
  }
  return null;
}

function buildToneStatusSection() {
  var profile = fetchToneProfile();
  var section = CardService.newCardSection().setHeader('Your voice');

  if (!profile || !profile.toneProfile) {
    section.addWidget(
      CardService.newDecoratedText()
        .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.PERSON))
        .setTopLabel('Not set up')
        .setText('<b><font color="' + BRAND_SECONDARY + '">Teach Dharma how you write</font></b>')
        .setBottomLabel('Analyzes your last 15 sent emails. Nothing runs until you tap below.')
        .setWrapText(true)
    );
    section.addWidget(CardService.newTextButton()
      .setText('Set up My Tone')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setBackgroundColor(BRAND_PRIMARY)
      .setOnClickAction(CardService.newAction().setFunctionName('setupTone')));
  } else {
    var summary = profile.toneProfile;
    // Only truncate truly long summaries, and break at the last word boundary
    // so we never cut mid-word.
    if (summary.length > 360) {
      var cut = summary.substring(0, 360);
      var lastSpace = cut.lastIndexOf(' ');
      summary = (lastSpace > 200 ? cut.substring(0, lastSpace) : cut) + '…';
    }
    section.addWidget(
      CardService.newDecoratedText()
        .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.PERSON))
        .setTopLabel('Style summary')
        .setText('<font color="' + BRAND_SECONDARY + '">' + summary + '</font>')
        .setWrapText(true)
    );
    section.addWidget(CardService.newTextButton()
      .setText('Edit tone')
      .setTextButtonStyle(CardService.TextButtonStyle.TEXT)
      .setOnClickAction(CardService.newAction().setFunctionName('editTone')));
    section.addWidget(CardService.newTextButton()
      .setText('Refresh from sent mail')
      .setTextButtonStyle(CardService.TextButtonStyle.TEXT)
      .setOnClickAction(CardService.newAction().setFunctionName('setupTone')));
  }

  return section;
}

function setupTone(e) {
  var accessToken = ScriptApp.getOAuthToken();
  try {
    var res = UrlFetchApp.fetch(DHARMA_API + '/api/preferences/tone/sync', {
      method: 'post',
      headers: { 'Authorization': 'GoogleBearer ' + accessToken },
      muteHttpExceptions: true,
    });
    var code = res.getResponseCode();
    if (code < 200 || code >= 300) {
      var errMsg = 'Tone setup failed (' + code + ')';
      try { errMsg = JSON.parse(res.getContentText()).error || errMsg; } catch (_) {}
      return notificationResponse(errMsg);
    }
    var profile = JSON.parse(res.getContentText());
    // The sync response uses fields {summary, example, intro, signOff}; the
    // edit card expects {toneProfile, inferredIntro, inferredSignOff}. Normalize.
    var normalized = {
      toneProfile: profile.summary || profile.toneProfile || '',
      toneExample: profile.example || profile.toneExample || '',
      inferredIntro: profile.intro || profile.inferredIntro || '',
      inferredSignOff: profile.signOff || profile.inferredSignOff || '',
    };
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(buildToneEditCard(normalized)))
      .build();
  } catch (err) {
    return notificationResponse('Tone setup failed: ' + err.message);
  }
}

function editTone(e) {
  var profile = fetchToneProfile() || {};
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(buildToneEditCard(profile)))
    .build();
}

function buildToneEditCard(profile) {
  var section = CardService.newCardSection();

  section.addWidget(CardService.newTextParagraph()
    .setText('<b>Your style</b>: how Dharma describes your writing. Edit freely.'));
  section.addWidget(CardService.newTextInput()
    .setFieldName('toneProfile')
    .setTitle('Style summary')
    .setValue(profile.toneProfile || '')
    .setMultiline(true));

  section.addWidget(CardService.newDivider());

  section.addWidget(CardService.newTextParagraph()
    .setText('<b>Greeting</b>: how you typically open emails. Leave blank to skip greetings.'));
  section.addWidget(CardService.newTextInput()
    .setFieldName('inferredIntro')
    .setTitle('e.g. Hi, or Hey {name},')
    .setValue(profile.inferredIntro || ''));

  section.addWidget(CardService.newDivider());

  section.addWidget(CardService.newTextParagraph()
    .setText('<b>Sign-off</b>: how you typically close emails. Use \\n for a line break before your name.'));
  section.addWidget(CardService.newTextInput()
    .setFieldName('inferredSignOff')
    .setTitle('e.g. Thanks,\\nAlex')
    .setValue(profile.inferredSignOff || '')
    .setMultiline(true));

  section.addWidget(CardService.newDivider());

  var buttonSet = CardService.newButtonSet()
    .addButton(CardService.newTextButton()
      .setText('Save')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setBackgroundColor(BRAND_PRIMARY)
      .setOnClickAction(CardService.newAction().setFunctionName('saveToneEdits')))
    .addButton(CardService.newTextButton()
      .setText('Back')
      .setTextButtonStyle(CardService.TextButtonStyle.TEXT)
      .setOnClickAction(CardService.newAction().setFunctionName('popCard')));
  section.addWidget(buttonSet);

  return CardService.newCardBuilder()
    .setHeader(dharmaHeader('My tone'))
    .addSection(section)
    .build();
}

function saveToneEdits(e) {
  var formInputs = (e && e.formInputs) || {};
  var get = function(key) {
    var v = formInputs[key];
    if (!v) return '';
    // Apps Script form inputs come back as { key: [value] } or { key: { stringInputs: { value: [...] } } }
    if (Array.isArray(v)) return v[0] || '';
    if (v.stringInputs && Array.isArray(v.stringInputs.value)) return v.stringInputs.value[0] || '';
    return '';
  };

  var payload = {
    toneProfile: get('toneProfile'),
    inferredIntro: get('inferredIntro'),
    inferredSignOff: get('inferredSignOff'),
  };

  var accessToken = ScriptApp.getOAuthToken();
  try {
    var res = UrlFetchApp.fetch(DHARMA_API + '/api/preferences/tone', {
      method: 'post',
      headers: {
        'Authorization': 'GoogleBearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    var code = res.getResponseCode();
    if (code < 200 || code >= 300) {
      var errMsg = 'Save failed (' + code + ')';
      try { errMsg = JSON.parse(res.getContentText()).error || errMsg; } catch (_) {}
      return notificationResponse(errMsg);
    }
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().popCard())
      .setNotification(CardService.newNotification().setText('Tone saved'))
      .build();
  } catch (err) {
    return notificationResponse('Save failed: ' + err.message);
  }
}

// ── Compose flow: show both paths ─────────────────────────────────────────────
// The card can't reliably detect whether the box already has text — Gmail
// autosaves the draft on a delay, and the card is a one-time snapshot that
// can't react to text typed after it opens. So rather than guess a mode, we
// always offer both: draft a fresh reply from the email, or rewrite what's
// already in the box (the latter reuses the polishDraft -> insertPolishedDraft
// replace path, verified to update the open box live).
function buildComposeCard(subject, threadId) {
  return CardService.newCardBuilder()
    .setHeader(dharmaHeader('Dharma'))
    .addSection(buildToneStatusSection())
    .addSection(buildDraftSection(subject, threadId))
    .addSection(buildRewriteSection(subject))
    .build();
}

function buildDraftSection(subject, threadId) {
  var section = CardService.newCardSection().setHeader('Draft a reply');
  section.addWidget(CardService.newTextParagraph()
    .setText('Dharma reads this email and drafts a reply in your voice, straight into the box.'));

  section.addWidget(CardService.newTextButton()
    .setText('Draft reply')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setBackgroundColor(BRAND_PRIMARY)
    .setOnClickAction(CardService.newAction()
      .setFunctionName('generateFromCompose')
      .setParameters({ subject: subject || '', tone: 'My Tone', threadId: threadId || '' })));

  var alt = ['Concise', 'Formal / Legal', 'Scheduling'];
  var chips = CardService.newButtonSet();
  for (var i = 0; i < alt.length; i++) {
    chips.addButton(CardService.newTextButton()
      .setText(alt[i])
      .setTextButtonStyle(CardService.TextButtonStyle.TEXT)
      .setOnClickAction(CardService.newAction()
        .setFunctionName('generateFromCompose')
        .setParameters({ subject: subject || '', tone: alt[i], threadId: threadId || '' })));
  }
  section.addWidget(chips);
  return section;
}

function buildRewriteSection(subject) {
  var section = CardService.newCardSection().setHeader('Rewrite what you typed');
  section.addWidget(CardService.newTextParagraph()
    .setText('Already typed something in the box? Dharma rewrites it in your voice and replaces it. You approve a preview first, nothing changes without your OK.'));

  section.addWidget(CardService.newTextButton()
    .setText('Rewrite in my voice')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setBackgroundColor(BRAND_SECONDARY)
    .setOnClickAction(CardService.newAction()
      .setFunctionName('polishDraft')
      .setParameters({ subject: subject || '' })));
  return section;
}
