var DHARMA_API = 'https://dharma-lake.vercel.app';

function onHomepage(e) {
  return buildWelcomeCard();
}

function onGmailMessage(e) {
  return buildMainCard(e.gmail.messageId);
}

function onComposeOpen(e) {
  var subject = (e.draftMetadata && e.draftMetadata.subject) ? e.draftMetadata.subject : '';
  var threadId = '';

  // With draftAccess METADATA, e.gmail.messageId is the draft's message ID.
  // Use it to get the thread ID directly instead of guessing from subject.
  if (e.gmail && e.gmail.messageId) {
    try {
      var draft = Gmail.Users.Messages.get('me', e.gmail.messageId, { format: 'minimal' });
      if (draft && draft.threadId) threadId = draft.threadId;
    } catch (err) {
      Logger.log('Could not resolve threadId from draft: ' + err.message);
    }
  }

  return buildComposeToneCard(subject, threadId);
}

function buildWelcomeCard() {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('Dharma')
      .setSubtitle('AI Email Assistant'))
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newTextParagraph()
          .setText('Open an email to generate a draft reply with AI.'))
    )
    .build();
}

function buildMainCard(messageId) {
  return buildToneMenuCard('generateDraft', { messageId: messageId });
}

// ── Compose-specific card: includes Polish Draft ──────────────────────────────
function buildComposeToneCard(subject, threadId) {
  var tones = ['My Tone', 'Concise', 'Formal / Legal', 'Scheduling'];

  var section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText('Generate a reply:'));

  for (var i = 0; i < tones.length; i++) {
    section.addWidget(
      CardService.newTextButton()
        .setText(tones[i])
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setBackgroundColor('#b57bff')
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('generateFromCompose')
            .setParameters({ subject: subject, tone: tones[i], threadId: threadId || '' })
        )
    );
  }

  // Polish Draft separator + button
  section.addWidget(CardService.newDivider());
  section.addWidget(CardService.newTextParagraph().setText('Already have a draft?'));
  section.addWidget(
    CardService.newTextButton()
      .setText('Polish Draft')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setBackgroundColor('#9e9e9e')
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName('polishDraft')
          .setParameters({ subject: subject })
      )
  );

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Dharma'))
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
        .setBackgroundColor('#b57bff')
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName(actionFunction)
            .setParameters(params)
        )
    );
  }

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Dharma'))
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

  var resultSection = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText(data.text))
    .addWidget(CardService.newDivider())
    .addWidget(
      CardService.newTextButton()
        .setText('Insert into Draft')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('insertPolishedDraft')
            .setParameters({ cacheKey: cacheKey })
        )
    )
    .addWidget(
      CardService.newTextButton()
        .setText('Try Again')
        .setOnClickAction(CardService.newAction().setFunctionName('popCard'))
    );

  return CardService.newActionResponseBuilder()
    .setNavigation(
      CardService.newNavigation().pushCard(
        CardService.newCardBuilder()
          .setHeader(CardService.newCardHeader().setTitle('Polished Draft'))
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
        'Content-Type: text/plain; charset=utf-8'
      ];
      if (meta.inReplyTo) lines.push('In-Reply-To: ' + meta.inReplyTo);
      if (meta.references || meta.inReplyTo) {
        lines.push('References: ' + ((meta.references ? meta.references + ' ' : '') + (meta.inReplyTo || '')).trim());
      }
      var raw = lines.join('\r\n') + '\r\n\r\n' + polishedText;
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

  var resultSection = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText(data.text))
    .addWidget(
      CardService.newTextButton()
        .setText('Save as Draft in Gmail')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
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
          .setHeader(CardService.newCardHeader().setTitle('Draft Reply'))
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
